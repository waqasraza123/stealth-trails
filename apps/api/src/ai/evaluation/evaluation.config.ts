import { timingSafeEqual } from "node:crypto";
import { isIP } from "node:net";

export const EVALUATION_FIXTURE_VERSION = "financial-research-fixtures-v1";
export const EVALUATION_SUBJECTS = ["eval-aurora", "eval-boreal"] as const;
export function assertEvaluationEnvironment(
  env: NodeJS.ProcessEnv = process.env,
) {
  if (
    env.AI_EVALUATION_ENABLED !== "true" ||
    !["test", "development"].includes(env.NODE_ENV ?? "") ||
    env.VERCEL ||
    env.VERCEL_ENV === "production" ||
    env.DEPLOYMENT_ENV === "production"
  )
    throw new Error("evaluation_environment_denied");
  const database = new URL(env.DATABASE_URL ?? "");
  const direct = new URL(env.DIRECT_URL ?? env.DATABASE_URL ?? "");
  const permitted =
    env.AI_EVALUATION_CONTAINER === "true"
      ? ["db"]
      : ["localhost", "127.0.0.1", "[::1]"];
  if (
    !["postgres:", "postgresql:"].includes(database.protocol) ||
    !permitted.includes(database.hostname) ||
    database.pathname !== "/stealth_trails_agent_eval" ||
    (database.searchParams.get("schema") ?? "public") !== "public" ||
    direct.hostname !== database.hostname ||
    direct.pathname !== database.pathname ||
    direct.port !== database.port
  )
    throw new Error("isolated_evaluation_database_required");
  for (const key of Object.keys(env)) {
    if (
      /(?:PRIVATE_KEY|MNEMONIC|SIGNING_SECRET|WALLET_SECRET)/u.test(key) &&
      env[key]
    )
      throw new Error("wallet_credentials_forbidden_in_evaluation");
  }
  if (
    env.DOCUMENT_AI_ENABLED === "true" ||
    env.AI_OPPORTUNITY_ANALYST_ENABLED === "true" ||
    env.MARKET_DATA_PROVIDER === "coingecko"
  )
    throw new Error("evaluation_external_data_provider_denied");
  return {
    database,
    port: Number(env.AI_EVALUATION_PORT ?? 9011),
    container: env.AI_EVALUATION_CONTAINER === "true",
  };
}
export function evaluationSubject(
  header: string | undefined,
  env: NodeJS.ProcessEnv = process.env,
): string | null {
  const pairs = [
    [env.AI_EVALUATION_API_KEY, EVALUATION_SUBJECTS[0]],
    [env.AI_EVALUATION_PEER_API_KEY, EVALUATION_SUBJECTS[1]],
  ] as const;
  for (const [key, subject] of pairs) {
    if (!key || key.length < 32 || !header) continue;
    const actual = Buffer.from(header);
    const expected = Buffer.from(`Bearer ${key}`);
    if (actual.length === expected.length && timingSafeEqual(actual, expected))
      return subject;
  }
  return null;
}
export function isPrivateEvaluationPeer(address: string | undefined): boolean {
  if (!address) return false;
  const normalized = address.replace(/^::ffff:/u, "");
  if (normalized === "::1") return true;
  if (isIP(normalized) !== 4) return false;
  const [a, b] = normalized.split(".").map(Number);
  return (
    a === 127 ||
    a === 10 ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168)
  );
}
