import { loadApiServerRuntimeConfig } from "@stealth-trails-bank/config/api";
import { isIP } from "node:net";

export function loadAuthTrustedProxyCidrs(env = process.env): string[] {
  const proxies = (env.AUTH_TRUSTED_PROXY_CIDRS ?? "").split(",").map((value) => value.trim()).filter(Boolean);
  for (const proxy of proxies) {
    const [address, prefix, ...extra] = proxy.split("/");
    const family = isIP(address);
    const maxBits = family === 4 ? 32 : 128;
    if (!family || extra.length || (prefix !== undefined &&
      (!/^\d+$/u.test(prefix) || Number(prefix) < 1 || Number(prefix) > maxBits))) {
      throw new Error("AUTH_TRUSTED_PROXY_CIDRS requires explicit proxy IP addresses or CIDR ranges.");
    }
  }
  return proxies;
}

type RuntimeEnvShape = Record<string, string | boolean | undefined>;

type CorsOriginDecisionCallback = (
  error: Error | null,
  allow?: boolean
) => void;

export function createCorsOriginDelegate(allowedOrigins: readonly string[]) {
  const allowedOriginSet = new Set(allowedOrigins);

  return (origin: string | undefined, callback: CorsOriginDecisionCallback) => {
    if (!origin) {
      callback(null, true);
      return;
    }

    callback(null, allowedOriginSet.has(origin));
  };
}

export function loadApiBootstrapRuntime(env?: RuntimeEnvShape) {
  const runtimeConfig = loadApiServerRuntimeConfig(env);

  return {
    port: runtimeConfig.port,
    environment: runtimeConfig.environment,
    corsAllowedOrigins: runtimeConfig.corsAllowedOrigins,
    corsOriginDelegate: createCorsOriginDelegate(
      runtimeConfig.corsAllowedOrigins
    )
  };
}
