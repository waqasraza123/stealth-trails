#!/usr/bin/env node

import http from "node:http";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const defaultSmokeOrigin = "https://www.stealth-trails.space";
const defaultRetryAttempts = 1;
const defaultRetryDelayMs = 5_000;
const defaultHealthResponse = {
  status: "success",
  dataStatus: "healthy"
};

function parseArgs(argv) {
  const options = {
    baseUrl: null,
    local: false,
    origin: defaultSmokeOrigin,
    retryAttempts: defaultRetryAttempts,
    retryDelayMs: defaultRetryDelayMs,
    protectionBypassSecret:
      process.env["VERCEL_PROTECTION_BYPASS_SECRET"] ?? null
  };

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];

    if (current === "--local") {
      options.local = true;
      continue;
    }

    if (current === "--base-url") {
      options.baseUrl = argv[index + 1] ?? null;
      index += 1;
      continue;
    }

    if (current === "--origin") {
      options.origin = argv[index + 1] ?? defaultSmokeOrigin;
      index += 1;
      continue;
    }

    if (current === "--retry-attempts") {
      options.retryAttempts = Number(argv[index + 1] ?? defaultRetryAttempts);
      index += 1;
      continue;
    }

    if (current === "--retry-delay-ms") {
      options.retryDelayMs = Number(argv[index + 1] ?? defaultRetryDelayMs);
      index += 1;
      continue;
    }

    if (current === "--protection-bypass-secret") {
      options.protectionBypassSecret = argv[index + 1] ?? null;
      index += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${current}`);
  }

  if (!options.local && !options.baseUrl) {
    throw new Error("Provide either --local or --base-url.");
  }

  return options;
}

function sleep(durationMs) {
  return new Promise((resolve) => {
    setTimeout(resolve, durationMs);
  });
}

function buildHeaders(origin, protectionBypassSecret) {
  const headers = {};

  if (origin) {
    headers["Origin"] = origin;
  }

  if (protectionBypassSecret) {
    headers["x-vercel-protection-bypass"] = protectionBypassSecret;
  }

  return headers;
}

async function parseJsonResponse(response) {
  const text = await response.text();

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(
      `Expected JSON response but received: ${text.slice(0, 200)}`
    );
  }
}

async function assertHealthEndpoint(baseUrl, pathName, headers) {
  const response = await fetch(`${baseUrl}${pathName}`, {
    headers
  });
  const body = await parseJsonResponse(response);

  if (response.status !== 200) {
    throw new Error(
      `${pathName} returned ${response.status}: ${JSON.stringify(body)}`
    );
  }

  if (
    body?.status !== defaultHealthResponse.status ||
    body?.data?.status !== defaultHealthResponse.dataStatus
  ) {
    throw new Error(
      `${pathName} returned an unexpected body: ${JSON.stringify(body)}`
    );
  }
}

async function assertCorsPreflight(baseUrl, origin, protectionBypassSecret) {
  const response = await fetch(`${baseUrl}/auth/login`, {
    method: "OPTIONS",
    headers: {
      ...buildHeaders(origin, protectionBypassSecret),
      "Access-Control-Request-Method": "POST",
      "Access-Control-Request-Headers": "Content-Type"
    }
  });

  if (response.status !== 204 && response.status !== 200) {
    const text = await response.text();
    throw new Error(
      `OPTIONS /auth/login returned ${response.status}: ${text.slice(0, 200)}`
    );
  }

  const allowOrigin = response.headers.get("access-control-allow-origin");
  const allowMethods = response.headers.get("access-control-allow-methods") ?? "";

  if (allowOrigin !== origin) {
    throw new Error(
      `OPTIONS /auth/login returned access-control-allow-origin=${allowOrigin ?? "null"} instead of ${origin}`
    );
  }

  if (!allowMethods.toUpperCase().includes("POST")) {
    throw new Error(
      `OPTIONS /auth/login did not advertise POST support: ${allowMethods}`
    );
  }
}

async function runSmoke(baseUrl, origin, protectionBypassSecret) {
  const headers = buildHeaders(origin, protectionBypassSecret);

  await assertHealthEndpoint(baseUrl, "/healthz", headers);
  await assertHealthEndpoint(baseUrl, "/readyz", headers);
  await assertCorsPreflight(baseUrl, origin, protectionBypassSecret);
}

function applyLocalSmokeEnv(origin) {
  const defaults = {
    VERCEL: "1",
    NODE_ENV: "production",
    API_PORT: "9001",
    CORS_ALLOWED_ORIGINS: origin,
    DATABASE_URL:
      "postgresql://postgres:postgres@127.0.0.1:5432/stealth_trails_bank",
    DIRECT_URL:
      "postgresql://postgres:postgres@127.0.0.1:5432/stealth_trails_bank",
    JWT_SECRET: "local-smoke-jwt-secret",
    JWT_EXPIRY_SECONDS: "3600",
    SUPABASE_JWT_SECRET: "local-smoke-supabase-secret",
    OPERATOR_RUNTIME_ENVIRONMENT: "production",
    ALLOW_LEGACY_OPERATOR_API_KEY_AUTH: "false",
    INTERNAL_OPERATOR_API_KEY: "local-smoke-operator-key",
    INTERNAL_WORKER_API_KEY: "local-smoke-worker-key"
  };

  for (const [key, value] of Object.entries(defaults)) {
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

async function startLocalHandlerServer(origin) {
  applyLocalSmokeEnv(origin);

  const distEntry = path.join(repoRoot, "apps", "api", "dist", "main.js");
  const compiledModule = await import(
    `${pathToFileURL(distEntry).href}?smoke=${Date.now()}`
  );
  const handler =
    compiledModule.default?.default ?? compiledModule.default ?? compiledModule;

  if (typeof handler !== "function") {
    throw new Error(
      `Compiled API entrypoint does not export a default handler function at ${distEntry}.`
    );
  }

  return await new Promise((resolve, reject) => {
    const server = http.createServer((request, response) => {
      Promise.resolve(handler(request, response)).catch((error) => {
        response.statusCode = 500;
        response.end(
          JSON.stringify({
            status: "failed",
            message:
              error instanceof Error ? error.message : "Unhandled smoke error."
          })
        );
      });
    });

    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();

      if (!address || typeof address === "string") {
        reject(new Error("Failed to determine local smoke server address."));
        return;
      }

      resolve({
        server,
        baseUrl: `http://127.0.0.1:${address.port}`
      });
    });
  });
}

async function withRetries(callback, retryAttempts, retryDelayMs) {
  let lastError = null;

  for (let attempt = 1; attempt <= retryAttempts; attempt += 1) {
    try {
      return await callback();
    } catch (error) {
      lastError = error;

      if (attempt === retryAttempts) {
        break;
      }

      await sleep(retryDelayMs);
    }
  }

  throw lastError;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  let localServer = null;
  let baseUrl = options.baseUrl;

  if (options.local) {
    localServer = await startLocalHandlerServer(options.origin);
    baseUrl = localServer.baseUrl;
  }

  try {
    await withRetries(
      () => runSmoke(baseUrl, options.origin, options.protectionBypassSecret),
      options.retryAttempts,
      options.retryDelayMs
    );

    console.log(`API smoke passed for ${baseUrl}`);
  } finally {
    if (localServer) {
      await new Promise((resolve, reject) => {
        localServer.server.close((error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        });
      });
    }
  }
}

main().catch((error) => {
  console.error(
    error instanceof Error ? error.message : "API smoke failed unexpectedly."
  );
  process.exit(1);
});
