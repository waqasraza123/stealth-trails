import axios, { AxiosError, AxiosHeaders } from "axios";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  PasswordRecoveryError,
  requestPasswordRecovery,
} from "@/lib/password-recovery-api";
import { reportWebApiError, webTelemetry } from "@/lib/observability";

describe("password recovery transport privacy", () => {
  afterEach(() => { vi.restoreAllMocks(); });
  it("uses the real backend path and sends credentials only in the POST body", async () => {
    const post = vi
      .spyOn(axios, "post")
      .mockResolvedValue({ data: { status: "success" } });
    const payload = {
      token: "secret-token",
      newPassword: "secret-password",
      verificationMethod: "totp",
      code: "123456",
    };
    await requestPasswordRecovery("reset-password", payload);
    expect(post).toHaveBeenCalledWith(
      expect.stringMatching(/\/auth\/reset-password$/u),
      payload,
    );
  });

  it("replaces sensitive Axios errors and excludes recovery requests from telemetry", async () => {
    const error = new AxiosError(
      "provider echoed secret-token secret-password",
      "ERR_NETWORK",
      {
        url: "/api/auth/reset-password",
        method: "post",
        headers: new AxiosHeaders(),
        data: JSON.stringify({
          token: "secret-token",
          newPassword: "secret-password",
        }),
      },
    );
    vi.spyOn(axios, "post").mockRejectedValue(error);
    const capture = vi.spyOn(webTelemetry, "captureException");
    reportWebApiError(error);
    expect(capture).not.toHaveBeenCalled();
    const result = await requestPasswordRecovery("reset-password", {}).catch(
      (failure) => failure,
    );
    expect(result).toBeInstanceOf(PasswordRecoveryError);
    expect(result.message).toBe(
      "Password recovery is temporarily unavailable. Please try again.",
    );
    expect(JSON.stringify(result)).not.toContain("secret-token");
    expect(JSON.stringify(result)).not.toContain("secret-password");
    expect(result.cause).toBeUndefined();
  });
});
