import { loadCustomerMfaEmailDeliveryRuntimeConfig } from "@stealth-trails-bank/config/api";

describe("loadCustomerMfaEmailDeliveryRuntimeConfig", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
    };
    delete process.env["CUSTOMER_MFA_EMAIL_DELIVERY_MODE"];
    delete process.env["RESEND_API_KEY"];
    delete process.env["CUSTOMER_MFA_EMAIL_DELIVERY_WEBHOOK_URL"];
    delete process.env["CUSTOMER_MFA_EMAIL_DELIVERY_BEARER_TOKEN"];
    delete process.env["CUSTOMER_MFA_EMAIL_DELIVERY_REQUEST_TIMEOUT_MS"];
    delete process.env["CUSTOMER_MFA_EMAIL_DELIVERY_FROM_EMAIL"];
    delete process.env["CUSTOMER_MFA_EMAIL_DELIVERY_FROM_NAME"];
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("loads preview-mode defaults when no values are configured", () => {
    expect(loadCustomerMfaEmailDeliveryRuntimeConfig(process.env)).toEqual({
      mode: "preview",
      resendApiKey: null,
      webhookUrl: null,
      bearerToken: null,
      requestTimeoutMs: 5000,
      fromEmail: "security@stealthtrailsbank.local",
      fromName: "Stealth Trails Bank Security",
    });
  });

  it("requires a webhook url in webhook mode", () => {
    process.env["CUSTOMER_MFA_EMAIL_DELIVERY_MODE"] = "webhook";

    expect(() =>
      loadCustomerMfaEmailDeliveryRuntimeConfig(process.env),
    ).toThrow(
      "CUSTOMER_MFA_EMAIL_DELIVERY_WEBHOOK_URL is required when CUSTOMER_MFA_EMAIL_DELIVERY_MODE=webhook.",
    );
  });

  it("requires an API key in Resend mode", () => {
    process.env["CUSTOMER_MFA_EMAIL_DELIVERY_MODE"] = "resend";

    expect(() =>
      loadCustomerMfaEmailDeliveryRuntimeConfig(process.env),
    ).toThrow(
      "RESEND_API_KEY is required when CUSTOMER_MFA_EMAIL_DELIVERY_MODE=resend.",
    );
  });

  it("loads Resend mode when an API key is configured", () => {
    process.env["CUSTOMER_MFA_EMAIL_DELIVERY_MODE"] = "resend";
    process.env["RESEND_API_KEY"] = "re_test";

    expect(loadCustomerMfaEmailDeliveryRuntimeConfig(process.env)).toEqual(
      expect.objectContaining({
        mode: "resend",
        resendApiKey: "re_test",
      }),
    );
  });
});
