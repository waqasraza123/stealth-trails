import { passwordRecoveryUrl } from "./password-recovery.config";
import { loadAuthTrustedProxyCidrs } from "../bootstrap/api-server.util";

describe("password recovery link configuration", () => {
  const env = {
    NODE_ENV: "production",
    PASSWORD_RECOVERY_APP_URL: "https://bank.example",
    PASSWORD_RECOVERY_ALLOWED_ORIGINS: "https://bank.example",
  };

  it("uses an exact allow-listed origin and keeps the token out of HTTP URLs", () => {
    const link = new URL(passwordRecoveryUrl("secret-token", env));
    expect(link.origin).toBe("https://bank.example");
    expect(link.pathname).toBe("/auth/reset-password");
    expect(link.search).toBe("");
    expect(link.hash).toBe("#token=secret-token");
  });

  it.each([
    "http://bank.example",
    "https://bank.example.attacker.com",
    "https://bank.example@attacker.com",
    "https://user:password@bank.example",
    "https://bank.example/subpath",
    "https://bank.example?redirect=evil",
    "https://bank.example#fragment",
    "javascript:alert(1)",
    "",
    "http://localhost:5173",
  ])("fails closed for unsafe origin %s", (url) => {
    expect(() =>
      passwordRecoveryUrl("secret-token", {
        ...env,
        PASSWORD_RECOVERY_APP_URL: url,
      }),
    ).toThrow();
  });

  it("requires an allow list even for HTTPS and permits explicitly allowed local HTTP only outside production", () => {
    expect(() =>
      passwordRecoveryUrl("secret-token", {
        ...env,
        PASSWORD_RECOVERY_ALLOWED_ORIGINS: "",
      }),
    ).toThrow();
    const local = {
      NODE_ENV: "test",
      PASSWORD_RECOVERY_APP_URL: "http://localhost:5173",
      PASSWORD_RECOVERY_ALLOWED_ORIGINS: "http://localhost:5173",
    };
    expect(passwordRecoveryUrl("secret-token", local)).toContain(
      "http://localhost:5173/auth/reset-password#token=",
    );
    expect(() =>
      passwordRecoveryUrl("secret-token", { ...local, NODE_ENV: "production" }),
    ).toThrow();
  });
});

describe("trusted proxy configuration for recovery IP throttling", () => {
  it("defaults to the peer address and accepts only explicit proxy networks", () => {
    expect(loadAuthTrustedProxyCidrs({})).toEqual([]);
    expect(
      loadAuthTrustedProxyCidrs({
        AUTH_TRUSTED_PROXY_CIDRS: "127.0.0.1,10.0.0.0/24,::1",
      }),
    ).toEqual(["127.0.0.1", "10.0.0.0/24", "::1"]);
  });
  it.each([
    "true",
    "*",
    "1",
    "0.0.0.0/0",
    "::/0",
    "10.0.0.0/33",
    "10.0.0.1/24/evil",
  ])("rejects unsafe proxy trust %s", (value) => {
    expect(() =>
      loadAuthTrustedProxyCidrs({ AUTH_TRUSTED_PROXY_CIDRS: value }),
    ).toThrow();
  });
});
