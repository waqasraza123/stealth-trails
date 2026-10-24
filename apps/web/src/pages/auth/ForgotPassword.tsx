import { useState, type FormEvent } from "react";
import { RecoveryShell } from "@/components/auth/RecoveryShell";
import { Input } from "@/components/ui/input";
import { LoadingButton } from "@/components/ui/loading-button";
import { requestPasswordRecovery } from "@/lib/password-recovery-api";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      await requestPasswordRecovery("forgot-password", {
        email: email.trim().toLowerCase(),
      });
      setEmail("");
      setSent(true);
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : "Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }
  return (
    <RecoveryShell
      title="Forgot your password?"
      description="Enter your verified email address to request a password reset link."
    >
      {sent ? (
        <div
          role="status"
          className="space-y-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm"
        >
          <p>
            If this email is eligible for password recovery, a reset link will
            be sent. Check your inbox and spam folder.
          </p>
          <p>
            The link expires after 15 minutes. You will also need your
            authenticator or a one-time recovery code.
          </p>
          <button
            type="button"
            className="font-semibold underline"
            onClick={() => setSent(false)}
          >
            Request another link
          </button>
        </div>
      ) : (
        <form onSubmit={(event) => void submit(event)} className="space-y-5">
          <label htmlFor="recovery-email" className="block space-y-2">
            <span className="text-sm font-medium">Email address</span>
            <Input
              id="recovery-email"
              type="email"
              autoComplete="email"
              required
              maxLength={254}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              disabled={loading}
            />
          </label>
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
            loadingLabel="Requesting link…"
            className="h-12 w-full rounded-2xl"
          >
            Send reset link
          </LoadingButton>
        </form>
      )}
    </RecoveryShell>
  );
}
