let recoveryToken: string | null = null;

export function capturePasswordRecoveryToken(): void {
  if (window.location.pathname !== "/auth/reset-password") return;
  const candidate = new URLSearchParams(window.location.hash.slice(1)).get(
    "token",
  );
  recoveryToken =
    candidate && /^[A-Za-z0-9_-]{43}$/u.test(candidate) ? candidate : null;
  // Clear before auth restoration, route rendering, or telemetry installation.
  window.history.replaceState(
    window.history.state,
    "",
    window.location.pathname,
  );
}

export function takePasswordRecoveryToken(): string | null {
  const token = recoveryToken;
  recoveryToken = null;
  return token;
}
