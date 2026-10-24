import { createHmac, randomUUID } from "node:crypto";
import { HttpException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { PasswordRecoveryService } from "./password-recovery.service";
import { PasswordSecurityService } from "./password-security.service";
import { AuthRateLimitService } from "./auth-rate-limit.service";
import { CustomerMfaEmailDeliveryService } from "./customer-mfa-email-delivery.service";
import {
  customerAuthHmac,
  encryptCustomerAuthSecret,
  generateRecoveryCodes,
} from "./customer-auth-crypto";
import { ResetPasswordDto } from "./dto/password-recovery.dto";
import { writeStructuredApiLog } from "../logging/structured-api-logger";
import { AuthService } from "./auth.service";
import * as bcrypt from "bcryptjs";

jest.mock("../logging/structured-api-logger", () => ({
  writeStructuredApiLog: jest.fn(),
}));

// Opt-in, dedicated loopback PostgreSQL only. Never reads the application's DB URL.
const databaseUrl = process.env.PASSWORD_RECOVERY_TEST_DATABASE_URL;
const integration = databaseUrl ? describe : describe.skip;

integration("Password recovery with PostgreSQL", () => {
  let prisma: PrismaService;
  let service: PasswordRecoveryService;
  const passwords = new PasswordSecurityService();
  const sendPasswordReset = jest.fn();
  const newPassword = "Cedar lanterns beside quiet rivers 83";
  let recoveryCode: string;
  let customer: Awaited<ReturnType<PrismaService["customer"]["create"]>>;
  let ip: string;
  let oldPasswordHash: string;
  const originalEnv = process.env;

  beforeAll(async () => {
    const url = new URL(databaseUrl!);
    if (
      !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) ||
      !url.pathname.startsWith("/password_recovery_test")
    )
      throw new Error("Use a dedicated local recovery test database.");
    process.env = {
      ...originalEnv,
      NODE_ENV: "test",
      CUSTOMER_AUTH_HMAC_PEPPER:
        "password-recovery-test-pepper-at-least-32-characters",
      CUSTOMER_AUTH_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString("base64"),
      CUSTOMER_AUTH_ENCRYPTION_KEY_VERSION: "v1",
      PASSWORD_RECOVERY_APP_URL: "https://bank.example.invalid",
      PASSWORD_RECOVERY_ALLOWED_ORIGINS: "https://bank.example.invalid",
    };
    prisma = new PrismaService({ datasourceUrl: databaseUrl });
    await prisma.$connect();
    oldPasswordHash = await passwords.hash(
      "Original violet mountains of winter 42",
    );
    service = new PasswordRecoveryService(
      prisma,
      {
        sendPasswordReset,
        passwordRecoveryResponseWindowMs: 0,
      } as unknown as CustomerMfaEmailDeliveryService,
      passwords,
      new AuthRateLimitService(prisma),
    );
  });

  beforeEach(async () => {
    sendPasswordReset.mockReset().mockResolvedValue(undefined);
    ip = randomUUID();
    recoveryCode = generateRecoveryCodes(1)[0];
    customer = await prisma.customer.create({
      data: {
        supabaseUserId: randomUUID(),
        email: `${randomUUID()}@example.invalid`,
        firstName: "Amina",
        lastName: "Rahman",
        passwordHash: oldPasswordHash,
        passwordPolicyVersion: 2,
        mfaLastVerifiedAt: new Date(),
        emailVerifiedAt: new Date(),
        mfaTotpEnrolled: true,
        mfaTotpSecretEncrypted: encryptCustomerAuthSecret(
          "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ",
        ).ciphertext,
        mfaTotpSecretKeyVersion: "v1",
      },
    });
    await prisma.customerRecoveryCode.create({
      data: {
        customerId: customer.id,
        codeHash: customerAuthHmac(`recovery-code:${recoveryCode}`),
      },
    });
  });

  afterAll(async () => {
    await prisma?.$disconnect();
    process.env = originalEnv;
  });

  async function issue(email = customer.email) {
    const response = await service.forgotPassword(email, ip);
    const delivery = sendPasswordReset.mock.calls.at(-1)?.[0];
    const token = delivery
      ? new URLSearchParams(new URL(delivery.link).hash.slice(1)).get("token")
      : null;
    return { response, token: token as string };
  }

  function reset(token: string, overrides: Partial<ResetPasswordDto> = {}) {
    return service.resetPassword(
      {
        token,
        newPassword,
        verificationMethod: "recovery_code",
        code: recoveryCode,
        ...overrides,
      },
      ip,
    );
  }

  function authWithPasswordService(passwordService: PasswordSecurityService) {
    return new AuthService(
      prisma,
      {} as never,
      {} as never,
      {} as never,
      { publishAuditEventRecord: async () => undefined } as never,
      passwordService,
      new AuthRateLimitService(prisma),
    );
  }

  function barrier() {
    let release!: () => void;
    let enter!: () => void;
    const entered = new Promise<void>((resolve) => {
      enter = resolve;
    });
    const resumed = new Promise<void>((resolve) => {
      release = resolve;
    });
    return {
      entered,
      release,
      wait: async () => {
        enter();
        await resumed;
      },
    };
  }

  it("returns identical public responses for registered, unknown, and unverified emails", async () => {
    const registered = await issue(` ${customer.email.toUpperCase()} `);
    const unknown = await service.forgotPassword("missing@example.invalid", ip);
    await prisma.customer.update({
      where: { id: customer.id },
      data: { emailVerifiedAt: null },
    });
    const unverified = await service.forgotPassword(customer.email, ip);
    expect(registered.response).toEqual(unknown);
    expect(unverified).toEqual(unknown);
    expect(sendPasswordReset).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(registered.response)).not.toContain(registered.token);
  });

  it("persists only a hash and expires the reset token after 15 minutes", async () => {
    const before = Date.now();
    const { token } = await issue();
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/u);
    const flow = await prisma.customerAuthFlow.findUniqueOrThrow({
      where: { id: customerAuthHmac(`password-reset:${token}`) },
    });
    expect(JSON.stringify(flow)).not.toContain(token);
    expect(flow.purpose).toBe("password_recovery");
    expect(flow.expiresAt.getTime()).toBeGreaterThanOrEqual(before + 900_000);
    expect(flow.expiresAt.getTime()).toBeLessThanOrEqual(Date.now() + 900_000);
    await prisma.customerAuthFlow.update({
      where: { id: flow.id },
      data: { expiresAt: new Date(Date.now() - 1) },
    });
    await expect(reset(token)).rejects.toThrow(
      "Reset link is invalid or expired",
    );
    expect(
      (await prisma.customer.findUniqueOrThrow({ where: { id: customer.id } }))
        .passwordHash,
    ).toBe(oldPasswordHash);
  });

  it("rejects previous tokens and serializes concurrent issuance", async () => {
    const first = await issue();
    await Promise.all([issue(), issue()]);
    expect(
      await prisma.customerAuthFlow.count({
        where: {
          customerId: customer.id,
          purpose: "password_recovery",
          consumedAt: null,
        },
      }),
    ).toBe(1);
    await expect(reset(first.token)).rejects.toThrow(
      "Reset link is invalid or expired",
    );
  });

  it("allows exactly one concurrent reset, consumes its recovery code, and rejects replay", async () => {
    const { token } = await issue();
    const results = await Promise.allSettled([reset(token), reset(token)]);
    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    expect(
      results.filter((result) => result.status === "rejected"),
    ).toHaveLength(1);
    await expect(reset(token)).rejects.toThrow(
      "Reset link is invalid or expired",
    );
    const updated = await prisma.customer.findUniqueOrThrow({
      where: { id: customer.id },
    });
    expect(
      (await passwords.verify(updated.passwordHash!, newPassword)).valid,
    ).toBe(true);
    expect(updated.authTokenVersion).toBe(1);
    expect(
      await prisma.customerRecoveryCode.count({
        where: { customerId: customer.id, consumedAt: null },
      }),
    ).toBe(0);
    expect(updated.mfaTotpSecretEncrypted).toBe(
      customer.mfaTotpSecretEncrypted,
    );
    expect(updated.mfaTotpEnrolled).toBe(true);
  });

  it("rolls back token/code consumption and password changes if revocation fails", async () => {
    const { token } = await issue();
    const runTransaction = prisma.$transaction.bind(prisma);
    const spy = jest
      .spyOn(prisma, "$transaction")
      .mockImplementationOnce(async (callback: any) => {
        return runTransaction(async (tx: any) => {
          tx.customerAuthSession.updateMany = async () => {
            throw new Error("simulated failure");
          };
          return callback(tx);
        });
      });
    await expect(reset(token)).rejects.toThrow("temporarily unavailable");
    spy.mockRestore();
    const updated = await prisma.customer.findUniqueOrThrow({
      where: { id: customer.id },
    });
    expect(updated.passwordHash).toBe(oldPasswordHash);
    expect(
      await prisma.customerRecoveryCode.count({
        where: { customerId: customer.id, consumedAt: null },
      }),
    ).toBe(1);
    expect(
      await prisma.customerAuthFlow.count({
        where: { customerId: customer.id, consumedAt: null },
      }),
    ).toBe(1);
  });

  it("revokes web, mobile refresh, legacy, and remembered sessions and pre-auth flows only for the token owner", async () => {
    const other = await prisma.customer.create({
      data: {
        supabaseUserId: randomUUID(),
        email: `${randomUUID()}@example.invalid`,
      },
    });
    for (const clientPlatform of ["web", "mobile", "unknown"] as const) {
      await prisma.customerAuthSession.create({
        data: {
          customerId: customer.id,
          tokenVersion: 0,
          clientPlatform,
          trustedAt: new Date(),
          sessionSecretHash: randomUUID(),
          refreshTokenHash: randomUUID(),
          csrfTokenHash: randomUUID(),
          trustChallengeCodeHash: "old-challenge",
          trustChallengeExpiresAt: new Date(Date.now() + 60_000),
        },
      });
    }
    await prisma.customerAuthSession.create({
      data: { customerId: other.id, tokenVersion: 0 },
    });
    for (const owner of [customer, other]) {
      await prisma.notificationSocketSession.create({
        data: {
          audience: "customer",
          recipientKey: `customer:${owner.id}`,
          customerId: owner.id,
          tokenHash: randomUUID(),
          expiresAt: new Date(Date.now() + 60_000),
        },
      });
    }
    await prisma.customerAuthFlow.create({
      data: {
        customerId: customer.id,
        nextAction: "verify_totp",
        expiresAt: new Date(Date.now() + 60_000),
      },
    });
    const { token } = await issue();
    await reset(token);
    const sessions = await prisma.customerAuthSession.findMany({
      where: { customerId: customer.id },
    });
    expect(sessions).toHaveLength(3);
    for (const session of sessions) {
      expect(session.revokedAt).not.toBeNull();
      expect(session.revokedReason).toBe("password_rotation");
      expect(session.trustedAt).toBeNull();
      expect(session.refreshTokenHash).toBeNull();
      expect(session.sessionSecretHash).toBeNull();
      expect(session.csrfTokenHash).toBeNull();
      expect(session.trustChallengeCodeHash).toBeNull();
    }
    expect(
      await prisma.customerAuthSession.count({
        where: { customerId: other.id, revokedAt: null },
      }),
    ).toBe(1);
    expect(
      await prisma.customerAuthFlow.count({
        where: { customerId: customer.id, consumedAt: null },
      }),
    ).toBe(0);
    expect(
      await prisma.notificationSocketSession.count({
        where: { customerId: customer.id },
      }),
    ).toBe(0);
    expect(
      await prisma.notificationSocketSession.count({
        where: { customerId: other.id },
      }),
    ).toBe(1);
    const audit = await prisma.auditEvent.findMany({
      where: { customerId: customer.id },
    });
    expect(audit).toHaveLength(1);
    expect(JSON.stringify(audit)).not.toContain(token);
    expect(JSON.stringify(audit)).not.toContain(newPassword);
    expect(JSON.stringify(audit)).not.toContain(recoveryCode);
  });

  it("requires MFA, rejects another customer's recovery code and persists failed attempts", async () => {
    const { token } = await issue();
    const otherCode = generateRecoveryCodes(1)[0];
    await prisma.customerRecoveryCode.create({
      data: {
        customerId: (
          await prisma.customer.create({
            data: {
              supabaseUserId: randomUUID(),
              email: `${randomUUID()}@example.invalid`,
            },
          })
        ).id,
        codeHash: customerAuthHmac(`recovery-code:${otherCode}`),
      },
    });
    await expect(reset(token, { code: otherCode })).rejects.toThrow(
      "Security verification failed",
    );
    await expect(
      reset(token, { verificationMethod: "totp", code: "invalid" }),
    ).rejects.toThrow("Security verification failed");
    const updated = await prisma.customer.findUniqueOrThrow({
      where: { id: customer.id },
    });
    expect(updated.passwordHash).toBe(oldPasswordHash);
    expect(updated.mfaFailedAttemptCount).toBe(2);
  });

  it("accepts encrypted TOTP once and preserves MFA enrollment", async () => {
    const { token } = await issue();
    const counter = Math.floor(Date.now() / 30_000);
    const buffer = Buffer.alloc(8);
    buffer.writeBigUInt64BE(BigInt(counter));
    const digest = createHmac("sha1", "12345678901234567890")
      .update(buffer)
      .digest();
    const offset = digest[digest.length - 1] & 15;
    const code = String(
      (digest.readUInt32BE(offset) & 0x7fffffff) % 1_000_000,
    ).padStart(6, "0");
    await expect(
      reset(token, { verificationMethod: "totp", code }),
    ).resolves.toMatchObject({ status: "success" });
    expect(
      (await prisma.customer.findUniqueOrThrow({ where: { id: customer.id } }))
        .mfaLastAcceptedTotpCounter,
    ).toBe(counter);
    const second = await issue();
    await expect(
      reset(second.token, {
        verificationMethod: "totp",
        code,
        newPassword: `${newPassword} again`,
      }),
    ).rejects.toThrow("Security verification failed");
  });

  it("preserves MFA lockouts and rejects wrong flow purposes and unknown tokens", async () => {
    const { token } = await issue();
    await prisma.customer.update({
      where: { id: customer.id },
      data: { mfaLockedUntil: new Date(Date.now() + 60_000) },
    });
    await expect(reset(token)).rejects.toThrow("Security verification failed");
    await prisma.customerAuthFlow.updateMany({
      where: { customerId: customer.id },
      data: { purpose: "login" },
    });
    await expect(reset(token)).rejects.toThrow(
      "Reset link is invalid or expired",
    );
    await expect(reset("A".repeat(43))).rejects.toThrow(
      "Reset link is invalid or expired",
    );
  });

  it("enforces shared password policy without consuming a valid token", async () => {
    const { token } = await issue();
    for (const password of [
      "short",
      "password123456789",
      "Amina has a new passphrase 28",
      "x".repeat(129),
    ]) {
      await expect(
        reset(token, { newPassword: password }),
      ).rejects.toBeInstanceOf(HttpException);
    }
    await expect(reset(token)).resolves.toMatchObject({ status: "success" });
  });

  it("returns generic success on delivery failure and invalidates the undelivered token", async () => {
    sendPasswordReset.mockRejectedValue(
      new Error("provider echoed sensitive request"),
    );
    const { response, token } = await issue();
    expect(response.status).toBe("success");
    await expect(reset(token)).rejects.toThrow(
      "Reset link is invalid or expired",
    );
    expect(
      JSON.stringify((writeStructuredApiLog as jest.Mock).mock.calls),
    ).not.toContain(token);
    expect(
      JSON.stringify((writeStructuredApiLog as jest.Mock).mock.calls),
    ).not.toContain("provider echoed");
  });

  it("silently throttles accounts across IPs and atomically limits IP requests", async () => {
    const responses = await Promise.all(
      Array.from({ length: 7 }, (_, i) =>
        service.forgotPassword(customer.email, `${ip}-${i}`),
      ),
    );
    expect(sendPasswordReset).toHaveBeenCalledTimes(3);
    expect(
      responses.every(
        (response) => JSON.stringify(response) === JSON.stringify(responses[0]),
      ),
    ).toBe(true);
    const limiter = new AuthRateLimitService(prisma);
    const allowed = await Promise.all(
      Array.from({ length: 15 }, () =>
        limiter.consume({
          action: "recovery_test",
          subject: ip,
          limit: 3,
          windowSeconds: 900,
        }),
      ),
    );
    expect(allowed.filter(Boolean)).toHaveLength(3);
    const results = await Promise.allSettled(
      Array.from({ length: 11 }, (_, i) =>
        service.forgotPassword(`unknown-${i}@example.invalid`, ip),
      ),
    );
    expect(
      results.filter((result) => result.status === "rejected"),
    ).toHaveLength(1);
  });

  it("limits reset attempts per account across IPs and across replacement links", async () => {
    const { token } = await issue();
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await expect(
        service.resetPassword(
          { token, newPassword, verificationMethod: "totp", code: "invalid" },
          `${ip}-${attempt}`,
        ),
      ).rejects.toThrow("Security verification failed");
    }
    const second = await issue();
    await expect(reset(second.token)).rejects.toMatchObject({ status: 429 });
    expect(
      (await prisma.customer.findUniqueOrThrow({ where: { id: customer.id } }))
        .mfaLockedUntil,
    ).not.toBeNull();
  });

  it("suppresses delivery when the recovery origin is unconfigured", async () => {
    delete process.env.PASSWORD_RECOVERY_APP_URL;
    try {
      const { response } = await issue();
      expect(response.status).toBe("success");
      expect(sendPasswordReset).not.toHaveBeenCalled();
      expect(
        await prisma.customerAuthFlow.count({
          where: { customerId: customer.id },
        }),
      ).toBe(0);
    } finally {
      process.env.PASSWORD_RECOVERY_APP_URL = "https://bank.example.invalid";
    }
  });

  it("rejects an old-password login that finishes verification after reset", async () => {
    const { token } = await issue();
    const gate = barrier();
    const delayed = new PasswordSecurityService();
    jest.spyOn(delayed, "verify").mockImplementation(async (hash, password) => {
      await gate.wait();
      return passwords.verify(hash, password);
    });
    const login = authWithPasswordService(delayed).login(
      customer.email,
      "Original violet mountains of winter 42",
      { ipAddress: ip },
    );
    await gate.entered;
    await reset(token);
    gate.release();
    await expect(login).rejects.toThrow("Invalid email or password.");
    expect(
      await prisma.customerAuthFlow.count({
        where: { customerId: customer.id, consumedAt: null },
      }),
    ).toBe(0);
  });

  it("prevents an in-flight legacy rehash from overwriting the reset password", async () => {
    const oldPassword = "Original violet mountains of winter 42";
    await prisma.customer.update({
      where: { id: customer.id },
      data: { passwordHash: await bcrypt.hash(oldPassword, 4) },
    });
    const { token } = await issue();
    const gate = barrier();
    const delayed = new PasswordSecurityService();
    jest.spyOn(delayed, "hash").mockImplementation(async (password) => {
      await gate.wait();
      return passwords.hash(password);
    });
    const login = authWithPasswordService(delayed).login(
      customer.email,
      oldPassword,
      { ipAddress: ip },
    );
    await gate.entered;
    await reset(token);
    gate.release();
    await expect(login).rejects.toThrow("Invalid email or password.");
    const updated = await prisma.customer.findUniqueOrThrow({
      where: { id: customer.id },
    });
    expect(
      (await passwords.verify(updated.passwordHash!, newPassword)).valid,
    ).toBe(true);
  });

  it("prevents an in-flight login recovery code from disabling MFA after reset", async () => {
    const flow = await prisma.customerAuthFlow.create({
      data: {
        customerId: customer.id,
        nextAction: "verify_totp",
        passwordVerifiedAt: new Date(),
        expiresAt: new Date(Date.now() + 60_000),
      },
    });
    const { token } = await issue();
    const gate = barrier();
    const findCode = prisma.customerRecoveryCode.findUnique.bind(
      prisma.customerRecoveryCode,
    );
    const delayed = jest.spyOn(prisma.customerRecoveryCode, "findUnique");
    // The service awaits this result; it does not use Prisma's relation helpers.
    (delayed as jest.Mock).mockImplementationOnce(async (args) => {
      const result = await findCode(args);
      await gate.wait();
      return result;
    });
    const verification = authWithPasswordService(
      passwords,
    ).verifyLoginRecoveryCode(flow.id, recoveryCode);
    await gate.entered;
    await reset(token);
    gate.release();
    await expect(verification).rejects.toThrow("Authentication state changed");
    delayed.mockRestore();
    const updated = await prisma.customer.findUniqueOrThrow({
      where: { id: customer.id },
    });
    expect(updated.mfaTotpEnrolled).toBe(true);
    expect(updated.mfaTotpSecretEncrypted).toBe(
      customer.mfaTotpSecretEncrypted,
    );
  });

  it("prevents an in-flight login password upgrade from overwriting reset", async () => {
    const flow = await prisma.customerAuthFlow.create({
      data: {
        customerId: customer.id,
        nextAction: "upgrade_password",
        passwordVerifiedAt: new Date(),
        mfaVerifiedAt: new Date(),
        expiresAt: new Date(Date.now() + 60_000),
      },
    });
    const { token } = await issue();
    const gate = barrier();
    const delayed = new PasswordSecurityService();
    jest.spyOn(delayed, "hash").mockImplementation(async (password) => {
      await gate.wait();
      return passwords.hash(password);
    });
    const upgrade = authWithPasswordService(delayed).upgradeLoginPassword(
      flow.id,
      "Another winter moonlit forest trail 27",
    );
    await gate.entered;
    await reset(token);
    gate.release();
    await expect(upgrade).rejects.toThrow("Authentication state changed");
    const updated = await prisma.customer.findUniqueOrThrow({
      where: { id: customer.id },
    });
    expect(
      (await passwords.verify(updated.passwordHash!, newPassword)).valid,
    ).toBe(true);
  });

  it("prevents a previously authorized password change from overwriting reset", async () => {
    const session = await prisma.customerAuthSession.create({
      data: {
        customerId: customer.id,
        tokenVersion: 0,
        trustedAt: new Date(),
      },
    });
    const { token } = await issue();
    const gate = barrier();
    const delayed = new PasswordSecurityService();
    jest.spyOn(delayed, "hash").mockImplementation(async (password) => {
      await gate.wait();
      return passwords.hash(password);
    });
    const change = authWithPasswordService(delayed).updatePassword(
      customer.supabaseUserId,
      "Original violet mountains of winter 42",
      "Another winter moonlit forest trail 27",
      { currentSessionId: session.id },
    );
    await gate.entered;
    await reset(token);
    gate.release();
    await expect(change).rejects.toThrow("Authentication state changed");
    const updated = await prisma.customer.findUniqueOrThrow({
      where: { id: customer.id },
    });
    expect(
      (await passwords.verify(updated.passwordHash!, newPassword)).valid,
    ).toBe(true);
  });
});
