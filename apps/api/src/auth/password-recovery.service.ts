import {
  BadRequestException,
  HttpException,
  Injectable,
  ServiceUnavailableException,
} from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { setTimeout as delay } from "node:timers/promises";
import { loadCustomerMfaPolicyRuntimeConfig } from "@stealth-trails-bank/config/api";
import {
  CUSTOMER_PASSWORD_POLICY_VERSION,
  customerPasswordErrorMessage,
  validateCustomerPassword,
} from "@stealth-trails-bank/security";
import { PrismaService } from "../prisma/prisma.service";
import { writeStructuredApiLog } from "../logging/structured-api-logger";
import { AuthRateLimitService } from "./auth-rate-limit.service";
import {
  customerAuthHmac,
  decryptCustomerAuthSecret,
  generateOpaqueToken,
} from "./customer-auth-crypto";
import { CustomerMfaEmailDeliveryService } from "./customer-mfa-email-delivery.service";
import { findValidTotpCounter } from "./customer-mfa.util";
import { PasswordSecurityService } from "./password-security.service";
import { passwordRecoveryUrl } from "./password-recovery.config";
import { ResetPasswordDto } from "./dto/password-recovery.dto";

const RECOVERY_PURPOSE = "password_recovery" as const;
const genericResponse = () => ({
  status: "success" as const,
  message:
    "If this email is eligible for password recovery, a reset link will be sent. Check your inbox and spam folder.",
});
const invalidLink = () =>
  new BadRequestException({
    status: "failed",
    code: "PASSWORD_RESET_INVALID",
    message: "Reset link is invalid or expired. Request a new link.",
  });
const verificationFailed = () =>
  new BadRequestException({
    status: "failed",
    code: "PASSWORD_RESET_VERIFICATION_FAILED",
    message:
      "Security verification failed. Check your code or try again later. Contact support if you cannot access your authenticator or recovery codes.",
  });
const rateLimited = () =>
  new HttpException(
    {
      status: "failed",
      code: "AUTH_RATE_LIMITED",
      message: "Too many recovery attempts. Try again later.",
      retryAfter: 900,
    },
    429,
  );

@Injectable()
export class PasswordRecoveryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly emailDelivery: CustomerMfaEmailDeliveryService,
    private readonly passwords: PasswordSecurityService,
    private readonly rateLimits: AuthRateLimitService,
  ) {}

  async forgotPassword(email: string, ipAddress: string) {
    const startedAt = Date.now();
    const normalizedEmail = email.trim().toLowerCase();
    try {
      if (
        !(await this.rateLimits.consume({
          action: "password_recovery_request_ip",
          subject: ipAddress,
          limit: 10,
          windowSeconds: 900,
        }))
      )
        throw rateLimited();

      // Account throttling is deliberately invisible, including for unknown emails.
      if (
        await this.rateLimits.consume({
          action: "password_recovery_request_account",
          subject: normalizedEmail,
          limit: 3,
          windowSeconds: 900,
        })
      ) {
        await this.issueReset(normalizedEmail);
      }
    } catch (error) {
      if (error instanceof HttpException && error.getStatus() === 429)
        throw error;
      // Never serialize DB/provider errors: they may embed a request or secrets.
      writeStructuredApiLog(
        "warn",
        "password_recovery_request_unavailable",
        {},
      );
    }
    // Bound provider requests and pad all account outcomes to the same delivery
    // window. This also covers disabled delivery and account-level throttling.
    await delay(
      Math.max(
        0,
        this.emailDelivery.passwordRecoveryResponseWindowMs -
          (Date.now() - startedAt),
      ),
    );
    return genericResponse();
  }

  private async issueReset(email: string): Promise<void> {
    const token = generateOpaqueToken(32);
    const tokenHash = customerAuthHmac(`password-reset:${token}`);
    const link = passwordRecoveryUrl(token);
    const customer = await this.prisma.customer.findUnique({
      where: { email },
    });
    if (!customer?.passwordHash || !customer.emailVerifiedAt) return;
    const expiresAt = new Date(Date.now() + 15 * 60_000);

    await this.prisma.$transaction(
      async (tx) => {
        // Serialize new issuance and reset for this customer, including when no
        // previous recovery flow exists. Never persist the plaintext token.
        await tx.$queryRaw`SELECT "id" FROM "Customer" WHERE "id" = ${customer.id} FOR UPDATE`;
        await tx.customerAuthFlow.updateMany({
          where: {
            customerId: customer.id,
            purpose: RECOVERY_PURPOSE,
            consumedAt: null,
          },
          data: { consumedAt: new Date() },
        });
        await tx.customerAuthFlow.create({
          data: {
            id: tokenHash,
            customerId: customer.id,
            purpose: RECOVERY_PURPOSE,
            nextAction: "verify_totp",
            expiresAt,
          },
        });
      },
      { maxWait: 1000, timeout: 2000 },
    );

    try {
      await this.emailDelivery.sendPasswordReset({
        email: customer.email,
        link,
        deliveryId: randomUUID(),
        expiresAt: expiresAt.toISOString(),
      });
    } catch {
      // Conditional cleanup cannot invalidate a newer request's token.
      await this.prisma.customerAuthFlow.updateMany({
        where: { id: tokenHash, purpose: RECOVERY_PURPOSE, consumedAt: null },
        data: { consumedAt: new Date() },
      });
      writeStructuredApiLog("warn", "password_recovery_delivery_failed", {});
    }
  }

  async resetPassword(input: ResetPasswordDto, ipAddress: string) {
    try {
      return await this.completeReset(input, ipAddress);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      writeStructuredApiLog("warn", "password_recovery_reset_unavailable", {});
      throw new ServiceUnavailableException(
        "Password recovery is temporarily unavailable. Try again later.",
      );
    }
  }

  private async completeReset(input: ResetPasswordDto, ipAddress: string) {
    if (
      !(await this.rateLimits.consume({
        action: "password_recovery_reset_ip",
        subject: ipAddress,
        limit: 20,
        windowSeconds: 900,
      }))
    )
      throw rateLimited();
    const tokenHash = customerAuthHmac(`password-reset:${input.token}`);
    const initial = await this.prisma.customerAuthFlow.findUnique({
      where: { id: tokenHash },
      include: { customer: true },
    });
    if (
      !initial ||
      initial.purpose !== RECOVERY_PURPOSE ||
      initial.consumedAt ||
      initial.expiresAt.getTime() <= Date.now() ||
      !initial.customer.emailVerifiedAt
    )
      throw invalidLink();

    if (
      !(await this.rateLimits.consume({
        action: "password_recovery_reset_account",
        subject: initial.customerId,
        limit: 5,
        windowSeconds: 900,
      }))
    )
      throw rateLimited();

    const validation = validateCustomerPassword(
      input.newPassword,
      initial.customer,
    );
    if (!validation.valid)
      throw new BadRequestException(customerPasswordErrorMessage(validation));
    if (
      initial.customer.passwordHash &&
      (
        await this.passwords.verify(
          initial.customer.passwordHash,
          validation.normalizedPassword,
        )
      ).valid
    ) {
      throw new BadRequestException(
        "New password must be different from the current password.",
      );
    }
    const passwordHash = await this.passwords.hash(
      validation.normalizedPassword,
    );
    const policy = loadCustomerMfaPolicyRuntimeConfig();

    const completed = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "Customer" WHERE "id" = ${initial.customerId} FOR UPDATE`;
      const flow = await tx.customerAuthFlow.findUnique({
        where: { id: tokenHash },
        include: { customer: true },
      });
      const now = new Date();
      if (
        !flow ||
        flow.purpose !== RECOVERY_PURPOSE ||
        flow.consumedAt ||
        flow.expiresAt <= now ||
        flow.customer.passwordHash !== initial.customer.passwordHash ||
        !flow.customer.emailVerifiedAt
      )
        throw invalidLink();
      const customer = flow.customer;
      if (
        (customer.mfaLockedUntil && customer.mfaLockedUntil > now) ||
        flow.failedAttemptCount >= policy.maxFailedAttempts
      )
        throw verificationFailed();

      let verified = false;
      if (input.verificationMethod === "totp" && customer.mfaTotpEnrolled) {
        const secret =
          customer.mfaTotpSecretEncrypted && customer.mfaTotpSecretKeyVersion
            ? decryptCustomerAuthSecret(
                customer.mfaTotpSecretEncrypted,
                customer.mfaTotpSecretKeyVersion,
              )
            : customer.mfaTotpSecret;
        const counter = secret
          ? findValidTotpCounter(secret, input.code)
          : null;
        if (counter !== null) {
          // CAS also rejects a code concurrently accepted by the login flow.
          const accepted = await tx.customer.updateMany({
            where: {
              id: customer.id,
              OR: [
                { mfaLastAcceptedTotpCounter: null },
                { mfaLastAcceptedTotpCounter: { lt: counter } },
              ],
            },
            data: { mfaLastAcceptedTotpCounter: counter },
          });
          verified = accepted.count === 1;
        }
      } else if (input.verificationMethod === "recovery_code") {
        const accepted = await tx.customerRecoveryCode.updateMany({
          where: {
            customerId: customer.id,
            consumedAt: null,
            codeHash: customerAuthHmac(
              `recovery-code:${input.code.trim().toUpperCase()}`,
            ),
          },
          data: { consumedAt: now },
        });
        verified = accepted.count === 1;
      }

      if (!verified) {
        const locked =
          flow.failedAttemptCount + 1 >= policy.maxFailedAttempts ||
          customer.mfaFailedAttemptCount + 1 >= policy.maxFailedAttempts;
        await tx.customerAuthFlow.update({
          where: { id: tokenHash },
          data: {
            failedAttemptCount: { increment: 1 },
            ...(locked ? { consumedAt: now } : {}),
          },
        });
        await tx.customer.update({
          where: { id: customer.id },
          data: {
            mfaFailedAttemptCount: { increment: 1 },
            ...(locked
              ? {
                  mfaLockedUntil: new Date(
                    now.getTime() + policy.lockoutSeconds * 1000,
                  ),
                }
              : {}),
          },
        });
        return false; // Commit failure counters before returning an error.
      }

      const consumed = await tx.customerAuthFlow.updateMany({
        where: {
          id: tokenHash,
          customerId: customer.id,
          purpose: RECOVERY_PURPOSE,
          consumedAt: null,
          expiresAt: { gt: new Date() },
        },
        data: { consumedAt: now },
      });
      if (consumed.count !== 1) throw invalidLink();
      await tx.customer.update({
        where: { id: customer.id },
        data: {
          passwordHash,
          passwordPolicyVersion: CUSTOMER_PASSWORD_POLICY_VERSION,
          authTokenVersion: { increment: 1 },
          mfaFailedAttemptCount: 0,
          mfaLockedUntil: null,
          mfaActiveChallenge: Prisma.DbNull,
          mfaLastVerifiedAt: null,
          mfaPendingTotpSecret: null,
          mfaPendingTotpSecretEncrypted: null,
          mfaPendingTotpSecretKeyVersion: null,
          mfaPendingTotpIssuedAt: null,
        },
      });
      await tx.customerAuthSession.updateMany({
        where: { customerId: customer.id, revokedAt: null },
        data: {
          revokedAt: now,
          revokedReason: "password_rotation",
          trustedAt: null,
          sessionSecretHash: null,
          refreshTokenHash: null,
          csrfTokenHash: null,
          trustChallengeCodeHash: null,
          trustChallengeExpiresAt: null,
          trustChallengeSentAt: null,
        },
      });
      // Also invalidate every pre-authentication flow so an old password check
      // cannot be resumed after recovery. MFA enrollment/secrets remain intact.
      await tx.customerAuthFlow.updateMany({
        where: { customerId: customer.id, consumedAt: null },
        data: { consumedAt: now },
      });
      await tx.notificationSocketSession.deleteMany({
        where: { customerId: customer.id },
      });
      await tx.auditEvent.create({
        data: {
          customerId: customer.id,
          actorId: customer.supabaseUserId,
          actorType: "customer",
          action: "customer_account.password_rotated",
          targetType: "Customer",
          targetId: customer.id,
          metadata: {
            source: "password_recovery",
            revokedOtherSessions: true,
            verificationMethod: input.verificationMethod,
          },
        },
      });
      return true;
    });
    if (!completed) throw verificationFailed();
    return {
      status: "success" as const,
      message:
        "Password reset successfully. Sign in again with your password and authenticator.",
    };
  }
}
