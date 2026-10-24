import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { OperatorIdentityService } from "./operator-identity.service";
import { PasswordRecoveryService } from "./password-recovery.service";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";
import { InternalOperatorBearerGuard } from "./guards/internal-operator-bearer.guard";
import { createIntegrationTestApp } from "../test-utils/create-integration-test-app";

describe("password recovery HTTP authorization and validation", () => {
  let app: INestApplication;
  const recovery = { forgotPassword: jest.fn(), resetPassword: jest.fn() };
  const reset = {
    token: "A".repeat(43),
    newPassword: "Cedar lanterns beside quiet rivers 83",
    verificationMethod: "totp",
    code: "123456",
  };
  beforeAll(async () => {
    ({ app } = await createIntegrationTestApp({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: {} },
        { provide: OperatorIdentityService, useValue: {} },
        { provide: PasswordRecoveryService, useValue: recovery },
        JwtAuthGuard,
        InternalOperatorBearerGuard,
      ],
    }));
  });
  afterAll(async () => {
    await app.close();
  });
  beforeEach(() => {
    recovery.forgotPassword.mockResolvedValue({
      status: "success",
      message: "Generic response.",
    });
    recovery.resetPassword.mockResolvedValue({
      status: "success",
      message: "Password reset.",
    });
  });

  it("permits public requests, normalizes email, and ignores spoofed forwarding headers", async () => {
    await request(app.getHttpServer())
      .post("/auth/forgot-password")
      .set("X-Forwarded-For", "attacker-controlled-ip")
      .send({ email: "  AMINA@example.com " })
      .expect(200);
    expect(recovery.forgotPassword).toHaveBeenCalledWith(
      "amina@example.com",
      expect.any(String),
    );
    expect(recovery.forgotPassword.mock.calls[0][1]).not.toBe(
      "attacker-controlled-ip",
    );
  });

  it("accepts a reset token and MFA proof without a login session", async () => {
    const response = await request(app.getHttpServer())
      .post("/auth/reset-password")
      .send(reset)
      .expect(200);
    expect(recovery.resetPassword).toHaveBeenCalledWith(
      expect.objectContaining(reset),
      expect.any(String),
    );
    expect(JSON.stringify(response.body)).not.toContain(reset.token);
    expect(JSON.stringify(response.body)).not.toContain(reset.newPassword);
  });

  it.each([
    { ...reset, token: "bad" },
    { ...reset, code: "" },
    { ...reset, verificationMethod: "email" },
    { ...reset, customerId: "another-customer" },
    { ...reset, email: "victim@example.com" },
    { ...reset, newPassword: 123 },
    { ...reset, newPassword: "x".repeat(513) },
  ])(
    "rejects malformed or identity-overriding reset requests",
    async (payload) => {
      const response = await request(app.getHttpServer())
        .post("/auth/reset-password")
        .send(payload)
        .expect(400);
      expect(recovery.resetPassword).not.toHaveBeenCalled();
      expect(JSON.stringify(response.body)).not.toContain(reset.token);
      expect(JSON.stringify(response.body)).not.toContain(reset.newPassword);
    },
  );

  it("rejects invalid email input", async () => {
    await request(app.getHttpServer())
      .post("/auth/forgot-password")
      .send({ email: "invalid" })
      .expect(400);
    expect(recovery.forgotPassword).not.toHaveBeenCalled();
  });
});
