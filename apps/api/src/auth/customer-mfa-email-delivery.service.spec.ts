import axios from "axios";
import {
  PlatformAlertCategory,
  PlatformAlertSeverity,
  PlatformAlertStatus,
} from "@prisma/client";
import { loadCustomerMfaEmailDeliveryRuntimeConfig } from "@stealth-trails-bank/config/api";
import { ServiceUnavailableException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { PlatformAlertDeliveryService } from "../operations-monitoring/platform-alert-delivery.service";
import { CustomerMfaEmailDeliveryService } from "./customer-mfa-email-delivery.service";

jest.mock("axios");
jest.mock("@stealth-trails-bank/config/api", () => ({
  loadCustomerMfaEmailDeliveryRuntimeConfig: jest.fn(() => ({
    mode: "preview",
    resendApiKey: null,
    webhookUrl: null,
    bearerToken: null,
    requestTimeoutMs: 5000,
    fromEmail: "security@example.com",
    fromName: "Security",
  })),
}));

function createService() {
  const prismaService = {
    auditEvent: {
      create: jest.fn(),
    },
    platformAlert: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  } as unknown as PrismaService;

  const platformAlertDeliveryService = {
    enqueueAlertEvent: jest.fn().mockResolvedValue(0),
  } as unknown as PlatformAlertDeliveryService;

  return {
    prismaService,
    platformAlertDeliveryService,
    service: new CustomerMfaEmailDeliveryService(
      prismaService,
      platformAlertDeliveryService,
    ),
  };
}

describe("CustomerMfaEmailDeliveryService", () => {
  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  it("returns a preview code in preview mode and records success", async () => {
    (loadCustomerMfaEmailDeliveryRuntimeConfig as jest.Mock).mockReturnValue({
      mode: "preview",
      resendApiKey: null,
      webhookUrl: null,
      bearerToken: null,
      requestTimeoutMs: 5000,
      fromEmail: "security@example.com",
      fromName: "Security",
    });
    const { service, prismaService } = createService();
    (prismaService.platformAlert.findUnique as jest.Mock).mockResolvedValue(
      null,
    );
    (prismaService.auditEvent.create as jest.Mock).mockResolvedValue({
      id: "audit_1",
    });

    const result = await service.sendCode({
      customerId: "customer_1",
      actorId: "supabase_1",
      email: "ada@example.com",
      challengeId: "challenge_1",
      purpose: "email_enrollment",
      code: "123456",
      expiresAt: "2026-04-19T20:00:00.000Z",
    });

    expect(result).toEqual({
      deliveryChannel: "email",
      previewCode: "123456",
      backendType: "preview",
      backendReference: null,
    });
    expect(prismaService.auditEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "customer_account.mfa_email_delivery_succeeded",
        }),
      }),
    );
    expect(axios.post).not.toHaveBeenCalled();
    expect(prismaService.platformAlert.create).not.toHaveBeenCalled();
  });

  it("delivers through the configured webhook and records success", async () => {
    (loadCustomerMfaEmailDeliveryRuntimeConfig as jest.Mock).mockReturnValue({
      mode: "webhook",
      resendApiKey: null,
      webhookUrl: "https://mailer.example.com/mfa",
      bearerToken: "secret-token",
      requestTimeoutMs: 5000,
      fromEmail: "security@example.com",
      fromName: "Security",
    });
    const { service, prismaService } = createService();
    (axios.post as jest.Mock).mockResolvedValue({
      status: 202,
      data: {
        deliveryId: "delivery_1",
      },
    });
    (prismaService.auditEvent.create as jest.Mock).mockResolvedValue({
      id: "audit_1",
    });
    (prismaService.platformAlert.findUnique as jest.Mock).mockResolvedValue(
      null,
    );

    const result = await service.sendCode({
      customerId: "customer_1",
      actorId: "supabase_1",
      email: "ada@example.com",
      challengeId: "challenge_1",
      purpose: "withdrawal_step_up",
      code: "123456",
      expiresAt: "2026-04-19T20:00:00.000Z",
    });

    expect(axios.post).toHaveBeenCalledWith(
      "https://mailer.example.com/mfa",
      expect.objectContaining({
        type: "customer_mfa_email_otp",
        recipient: {
          email: "ada@example.com",
        },
      }),
      expect.objectContaining({
        timeout: 5000,
        headers: {
          Authorization: "Bearer secret-token",
        },
      }),
    );
    expect(result).toEqual({
      deliveryChannel: "email",
      previewCode: null,
      backendType: "webhook",
      backendReference: "delivery_1",
    });
  });

  it("delivers directly through Resend and records its email id", async () => {
    (loadCustomerMfaEmailDeliveryRuntimeConfig as jest.Mock).mockReturnValue({
      mode: "resend",
      resendApiKey: "re_test",
      webhookUrl: null,
      bearerToken: null,
      requestTimeoutMs: 5000,
      fromEmail: "security@auth.waqasraza.dev",
      fromName: "Stealth Trails Bank Security",
    });
    const { service, prismaService } = createService();
    (axios.post as jest.Mock).mockResolvedValue({
      status: 200,
      data: { id: "resend_email_1" },
    });
    (prismaService.auditEvent.create as jest.Mock).mockResolvedValue({
      id: "audit_1",
    });
    (prismaService.platformAlert.findUnique as jest.Mock).mockResolvedValue(
      null,
    );

    const result = await service.sendCode({
      customerId: "customer_1",
      actorId: "customer_actor_1",
      email: "ada@example.com",
      challengeId: "challenge_1",
      purpose: "primary_email_verification",
      code: "12345678",
      expiresAt: "2026-10-16T04:00:00.000Z",
    });

    expect(axios.post).toHaveBeenCalledWith(
      "https://api.resend.com/emails",
      {
        from: "Stealth Trails Bank Security <security@auth.waqasraza.dev>",
        to: ["ada@example.com"],
        subject: "Verify your Stealth Trails Bank email",
        text: expect.stringContaining("12345678"),
      },
      {
        timeout: 5000,
        headers: {
          Authorization: "Bearer re_test",
          "Content-Type": "application/json",
          "Idempotency-Key": "challenge_1",
        },
      },
    );
    expect(result).toEqual({
      deliveryChannel: "email",
      previewCode: null,
      backendType: "resend",
      backendReference: "resend_email_1",
    });
  });

  it("raises a platform alert and throws when webhook delivery fails", async () => {
    (loadCustomerMfaEmailDeliveryRuntimeConfig as jest.Mock).mockReturnValue({
      mode: "webhook",
      resendApiKey: null,
      webhookUrl: "https://mailer.example.com/mfa",
      bearerToken: "secret-token",
      requestTimeoutMs: 5000,
      fromEmail: "security@example.com",
      fromName: "Security",
    });
    const { service, prismaService, platformAlertDeliveryService } =
      createService();
    (axios.post as jest.Mock).mockRejectedValue(
      new Error("SMTP provider down"),
    );
    (prismaService.auditEvent.create as jest.Mock).mockResolvedValue({
      id: "audit_1",
    });
    (prismaService.platformAlert.findUnique as jest.Mock).mockResolvedValue(
      null,
    );
    (prismaService.platformAlert.create as jest.Mock).mockResolvedValue({
      id: "alert_1",
      dedupeKey: "customer_mfa_email_delivery_failed:webhook:password_step_up",
      category: PlatformAlertCategory.operations,
      severity: PlatformAlertSeverity.critical,
      status: PlatformAlertStatus.open,
      summary: "Customer MFA email delivery failed.",
      detail: "SMTP provider down",
      routingStatus: "unrouted",
      ownerOperatorId: null,
      acknowledgedAt: null,
      suppressedUntil: null,
      metadata: null,
    });

    await expect(
      service.sendCode({
        customerId: "customer_1",
        actorId: "supabase_1",
        email: "ada@example.com",
        challengeId: "challenge_1",
        purpose: "password_step_up",
        code: "123456",
        expiresAt: "2026-04-19T20:00:00.000Z",
      }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);

    expect(prismaService.auditEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "customer_account.mfa_email_delivery_failed",
        }),
      }),
    );
    expect(prismaService.platformAlert.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          code: "customer_mfa_email_delivery_failed",
        }),
      }),
    );
    expect(platformAlertDeliveryService.enqueueAlertEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "opened",
      }),
    );
  });
});
