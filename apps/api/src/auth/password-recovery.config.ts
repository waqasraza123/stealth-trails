// Recovery origins are operator configuration, never Host/Origin/request input.
export function passwordRecoveryUrl(token: string, env = process.env): string {
  const origin = new URL(env.PASSWORD_RECOVERY_APP_URL ?? "");
  const allowedOrigins = (env.PASSWORD_RECOVERY_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname);
  if (
    !allowedOrigins.includes(origin.origin) ||
    origin.username ||
    origin.password ||
    origin.search ||
    origin.hash ||
    origin.pathname !== "/" ||
    (origin.protocol !== "https:" &&
      !(env.NODE_ENV !== "production" && local && origin.protocol === "http:"))
  ) {
    throw new Error("Password recovery application origin is not allowed.");
  }
  const link = new URL("/auth/reset-password", origin);
  // Fragments are not sent to HTTP servers or in the Referer header.
  link.hash = new URLSearchParams({ token }).toString();
  return link.toString();
}
