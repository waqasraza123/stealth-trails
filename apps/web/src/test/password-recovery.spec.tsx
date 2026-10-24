import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ForgotPassword from "@/pages/auth/ForgotPassword";
import ResetPassword from "@/pages/auth/ResetPassword";
import {
  PasswordRecoveryError,
  requestPasswordRecovery,
} from "@/lib/password-recovery-api";
import { capturePasswordRecoveryToken } from "@/lib/password-recovery-token";
import { useUserStore } from "@/stores/userStore";
import { renderWithRouter } from "./render-with-router";

vi.mock("@/lib/password-recovery-api", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/password-recovery-api")
  >("@/lib/password-recovery-api");
  return { ...actual, requestPasswordRecovery: vi.fn() };
});
const request = vi.mocked(requestPasswordRecovery);
const token = "A".repeat(43);
const password = "Cedar lanterns beside quiet rivers 83";

function openReset() {
  window.history.replaceState({}, "", `/auth/reset-password#token=${token}`);
  capturePasswordRecoveryToken();
  renderWithRouter(<ResetPassword />);
}
function fillReset(confirmation = password) {
  fireEvent.change(screen.getByLabelText(/^New password$/), {
    target: { value: password },
  });
  fireEvent.change(screen.getByLabelText(/Confirm new password/), {
    target: { value: confirmation },
  });
  fireEvent.change(screen.getByLabelText(/^Authenticator code$/), {
    target: { value: "123456" },
  });
}
describe("password recovery pages", () => {
  beforeEach(() => {
    request.mockReset().mockResolvedValue(undefined);
    window.history.replaceState({}, "", "/");
    useUserStore.getState().clearUser();
    capturePasswordRecoveryToken();
  });
  afterEach(cleanup);

  it("submits the normalized email to the forgot endpoint and displays generic success", async () => {
    renderWithRouter(<ForgotPassword />);
    fireEvent.change(screen.getByLabelText(/Email address/), {
      target: { value: "Amina@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send reset link" }));
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(
        /If this email is eligible/,
      ),
    );
    expect(request).toHaveBeenCalledWith("forgot-password", {
      email: "amina@example.com",
    });
    expect(
      screen.getByRole("link", { name: /Back to sign in/ }),
    ).toHaveAttribute("href", "/auth/sign-in");
  });

  it("disables repeat submission while a request is pending and shows errors", async () => {
    let reject!: (reason: Error) => void;
    request.mockImplementationOnce(
      () =>
        new Promise((_, rejectPromise) => {
          reject = rejectPromise;
        }),
    );
    renderWithRouter(<ForgotPassword />);
    fireEvent.change(screen.getByLabelText(/Email address/), {
      target: { value: "a@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send reset link" }));
    expect(
      screen.getByRole("button", { name: /Requesting link/ }),
    ).toBeDisabled();
    reject(
      new PasswordRecoveryError(
        "AUTH_RATE_LIMITED",
        "Too many attempts. Please try again in 15 minutes.",
      ),
    );
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(/Too many attempts/),
    );
    expect(
      screen.getByRole("button", { name: "Send reset link" }),
    ).toBeEnabled();
  });

  it("scrubs the URL, keeps the token out of browser storage, and sends it only in the reset body", async () => {
    openReset();
    expect(window.location.hash).toBe("");
    expect(window.location.search).toBe("");
    expect(JSON.stringify(localStorage)).not.toContain(token);
    expect(JSON.stringify(sessionStorage)).not.toContain(token);
    fillReset();
    useUserStore.setState({ token: "old-session" });
    fireEvent.click(screen.getByRole("button", { name: "Reset password" }));
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(
        /password has been reset/,
      ),
    );
    expect(request).toHaveBeenCalledWith("reset-password", {
      token,
      newPassword: password,
      verificationMethod: "totp",
      code: "123456",
    });
    expect(useUserStore.getState().token).toBeNull();
    expect(screen.queryByLabelText(/^New password$/)).not.toBeInTheDocument();
  });

  it("validates password confirmation and the shared password policy locally", async () => {
    openReset();
    fillReset("different password");
    fireEvent.click(screen.getByRole("button", { name: "Reset password" }));
    expect(screen.getByRole("alert")).toHaveTextContent(
      /Passwords do not match/,
    );
    expect(request).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText(/^New password$/), {
      target: { value: "short" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Reset password" }));
    expect(screen.getByRole("alert")).toHaveTextContent(
      /at least 15 characters/,
    );
  });

  it("offers a new link for a missing, expired, or used token", async () => {
    renderWithRouter(<ResetPassword />);
    expect(screen.getByRole("alert")).toHaveTextContent(
      /invalid, expired, or already used/,
    );
    expect(request).not.toHaveBeenCalled();
    cleanup();
    openReset();
    request.mockRejectedValueOnce(
      new PasswordRecoveryError("PASSWORD_RESET_INVALID", "expired"),
    );
    fillReset();
    fireEvent.click(screen.getByRole("button", { name: "Reset password" }));
    await waitFor(() =>
      expect(
        screen.getByRole("link", { name: /Request a new reset link/ }),
      ).toHaveAttribute("href", "/auth/forgot-password"),
    );
  });

  it("allows recovery-code verification and clears entered secrets after an error", async () => {
    openReset();
    fillReset();
    fireEvent.change(screen.getByLabelText(/Security verification/), {
      target: { value: "recovery_code" },
    });
    fireEvent.change(screen.getByLabelText(/^Recovery code$/), {
      target: { value: "ABCDE-FGHIJ-KLMN" },
    });
    request.mockRejectedValueOnce(
      new PasswordRecoveryError(
        "PASSWORD_RESET_VERIFICATION_FAILED",
        "Security verification failed.",
      ),
    );
    fireEvent.click(screen.getByRole("button", { name: "Reset password" }));
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        /Security verification failed/,
      ),
    );
    expect(request).toHaveBeenCalledWith(
      "reset-password",
      expect.objectContaining({
        verificationMethod: "recovery_code",
        code: "ABCDE-FGHIJ-KLMN",
      }),
    );
    expect(screen.getByLabelText(/^New password$/)).toHaveValue("");
    expect(screen.getByLabelText(/^Recovery code$/)).toHaveValue("");
  });
});
