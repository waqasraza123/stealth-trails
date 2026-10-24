import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import {
  customerPasswordErrorMessage,
  validateCustomerPassword,
} from "@stealth-trails-bank/security";
import { RecoveryShell } from "@/components/auth/RecoveryShell";
import { Input } from "@/components/ui/input";
import { LoadingButton } from "@/components/ui/loading-button";
import {
  PasswordRecoveryError,
  requestPasswordRecovery,
} from "@/lib/password-recovery-api";
import { takePasswordRecoveryToken } from "@/lib/password-recovery-token";
import { useUserStore } from "@/stores/userStore";

export default function ResetPassword() {
  const [token, setToken] = useState(takePasswordRecoveryToken);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [method, setMethod] = useState<"totp" | "recovery_code">("totp");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [invalid, setInvalid] = useState(!token);
  const [error, setError] = useState<string | null>(null);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (loading || !token) return;
    const validation = validateCustomerPassword(password);
    if (!validation.valid) {
      setError(customerPasswordErrorMessage(validation));
      return;
    }
    if (password.normalize("NFC") !== confirmation.normalize("NFC")) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await requestPasswordRecovery("reset-password", {
        token,
        newPassword: password,
        verificationMethod: method,
        code: code.trim(),
      });
      useUserStore.getState().clearUser();
      setToken(null);
      setSuccess(true);
    } catch (failure) {
      if (
        failure instanceof PasswordRecoveryError &&
        failure.code === "PASSWORD_RESET_INVALID"
      ) {
        setInvalid(true);
        setToken(null);
      }
      setError(
        failure instanceof Error ? failure.message : "Please try again.",
      );
    } finally {
      setPassword("");
      setConfirmation("");
      setCode("");
      setLoading(false);
    }
  }
  return (
    <RecoveryShell
      title={success ? "Password updated" : "Reset your password"}
      description={
        success
          ? "Your sessions have been revoked. Sign in again to continue."
          : "Choose a unique passphrase and complete your security verification."
      }
    >
      {success ? (
        <p
          role="status"
          className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm"
        >
          Your password has been reset. Use your new password and authenticator
          to sign in.
        </p>
      ) : invalid ? (
        <div
          role="alert"
          className="space-y-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm"
        >
          <p>
            This reset link is invalid, expired, or already used. If you
            refreshed this page, reopen the link from your email.
          </p>
          <Link to="/auth/forgot-password" className="font-semibold underline">
            Request a new reset link
          </Link>
        </div>
      ) : (
        <form onSubmit={(event) => void submit(event)} className="space-y-5">
          <label htmlFor="reset-password" className="block space-y-2">
            <span className="text-sm font-medium">New password</span>
            <Input
              id="reset-password"
              aria-label="New password"
              type="password"
              autoComplete="new-password"
              required
              maxLength={512}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              disabled={loading}
              aria-describedby="password-requirements"
            />
            <span
              id="password-requirements"
              className="block text-xs text-auth-form-muted"
            >
              Use 15–128 characters. Common passwords and personal information
              are blocked.
            </span>
          </label>
          <label htmlFor="confirm-password" className="block space-y-2">
            <span className="text-sm font-medium">Confirm new password</span>
            <Input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              required
              maxLength={512}
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              disabled={loading}
            />
          </label>
          <label htmlFor="recovery-method" className="block space-y-2">
            <span className="text-sm font-medium">Security verification</span>
            <select
              id="recovery-method"
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={method}
              disabled={loading}
              onChange={(event) => {
                setMethod(event.target.value as typeof method);
                setCode("");
              }}
            >
              <option value="totp">Authenticator code</option>
              <option value="recovery_code">One-time recovery code</option>
            </select>
          </label>
          <label htmlFor="recovery-code" className="block space-y-2">
            <span className="text-sm font-medium">
              {method === "totp" ? "Authenticator code" : "Recovery code"}
            </span>
            <Input
              id="recovery-code"
              type="text"
              autoComplete="one-time-code"
              inputMode={method === "totp" ? "numeric" : "text"}
              pattern={
                method === "totp"
                  ? "[0-9]{6}"
                  : "[A-Za-z0-9_-]{5}-[A-Za-z0-9_-]{5}-[A-Za-z0-9_-]{4,5}"
              }
              maxLength={17}
              required
              value={code}
              onChange={(event) => setCode(event.target.value)}
              disabled={loading}
            />
          </label>
          <p className="text-xs text-auth-form-muted">
            Contact bank support if you cannot access your authenticator or
            one-time recovery codes.
          </p>
          {error && (
            <p
              role="alert"
              className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"
            >
              {error}
            </p>
          )}
          <LoadingButton
            type="submit"
            loading={loading}
            loadingLabel="Resetting password…"
            className="h-12 w-full rounded-2xl"
          >
            Reset password
          </LoadingButton>
        </form>
      )}
    </RecoveryShell>
  );
}
