import axios from "axios";
import { loadWebRuntimeConfig } from "@stealth-trails-bank/config/web";

const { serverUrl } = loadWebRuntimeConfig(import.meta.env);

export class PasswordRecoveryError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export async function requestPasswordRecovery(
  path: "forgot-password" | "reset-password",
  payload: unknown,
): Promise<void> {
  try {
    const response = await axios.post(`${serverUrl}/auth/${path}`, payload);
    if (response.data.status !== "success") throw new Error("Request failed.");
  } catch (error) {
    // Never return the AxiosError (which contains the password and token).
    const data = axios.isAxiosError(error) ? error.response?.data : null;
    const code = typeof data?.code === "string" ? data.code : "REQUEST_FAILED";
    const message =
      code === "PASSWORD_RESET_INVALID"
        ? "This reset link is invalid, expired, or already used. Request a new link."
        : code === "PASSWORD_RESET_VERIFICATION_FAILED"
          ? "Security verification failed. Check your code or try again later. Contact support if you cannot access your authenticator or recovery codes."
          : code === "AUTH_RATE_LIMITED"
            ? "Too many attempts. Please try again in 15 minutes."
            : path === "reset-password" &&
                axios.isAxiosError(error) &&
                error.response?.status === 400 &&
                typeof data?.message === "string"
              ? data.message
              : "Password recovery is temporarily unavailable. Please try again.";
    throw new PasswordRecoveryError(code, message);
  }
}
