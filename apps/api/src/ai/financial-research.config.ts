import { createHash } from "node:crypto";
import { z } from "zod";

export const hashResearchValue = (value: unknown): string =>
  createHash("sha256")
    .update(typeof value === "string" ? value : JSON.stringify(value))
    .digest("hex");
export const RESEARCH_POLICY =
  "financial-research-read-only-v1:identity-bound;allowlist;strict-schemas;ownership;external-consent;bounded-results;no-writes;untrusted-evidence";
const limits = z.object({
  maxSteps: z.coerce.number().int().min(1).max(20).default(8),
  maxToolCalls: z.coerce.number().int().min(1).max(30).default(12),
  timeoutMs: z.coerce.number().int().min(100).max(120000).default(60000),
  maxTokens: z.coerce.number().int().min(256).max(100000).default(48000),
  maxOutputTokens: z.coerce.number().int().min(32).max(4096).default(1000),
  maxSpendUsd: z.coerce.number().positive().max(5).default(0.5),
  maxDailySpendUsd: z.coerce.number().positive().max(100).default(30),
  inputUsdPerMillion: z.coerce.number().nonnegative().max(1000).default(10),
  outputUsdPerMillion: z.coerce.number().nonnegative().max(1000).default(30),
});
export function researchConfig(env: NodeJS.ProcessEnv = process.env) {
  return limits.parse({
    maxSteps: env.AI_RESEARCH_MAX_STEPS,
    maxToolCalls: env.AI_RESEARCH_MAX_TOOL_CALLS,
    timeoutMs: env.AI_RESEARCH_TIMEOUT_MS,
    maxTokens: env.AI_RESEARCH_MAX_TOKENS,
    maxOutputTokens: env.AI_RESEARCH_MAX_OUTPUT_TOKENS,
    maxSpendUsd: env.AI_RESEARCH_MAX_SPEND_USD,
    maxDailySpendUsd: env.AI_RESEARCH_MAX_DAILY_SPEND_USD,
    inputUsdPerMillion: env.AI_RESEARCH_INPUT_USD_PER_MILLION,
    outputUsdPerMillion: env.AI_RESEARCH_OUTPUT_USD_PER_MILLION,
  });
}

// Defense in depth; authorization comes from scoped queries, never redaction.
export function sanitizeResearchText(value: string, max = 12000): string {
  let text = value;
  for (const key of [
    "AI_WEALTH_BRIEF_API_KEY",
    "AI_EVALUATION_API_KEY",
    "DATABASE_URL",
    "DIRECT_URL",
  ]) {
    const secret = process.env[key];
    if (secret) text = text.split(secret).join("[REDACTED]");
  }
  return text
    .replace(
      /\b(?:sk-[a-zA-Z0-9_-]{8,}|Bearer\s+[a-zA-Z0-9._~-]+|0x[a-fA-F0-9]{64})\b/gu,
      "[REDACTED]",
    )
    .replace(/\b(?:postgres(?:ql)?):\/\/[^\s"<>]+/giu, "[REDACTED]")
    .replace(
      /((?:password|api[_ -]?key|private[_ -]?key|secret|token)\s*[:=]\s*)[^\s,;"}]+/giu,
      "$1[REDACTED]",
    )
    .slice(0, max);
}
export function sanitizeResearchArgs(
  args: Record<string, unknown>,
): Record<string, unknown> {
  // Free text and resource IDs are represented by hashes in durable traces.
  return Object.fromEntries(
    Object.entries(args)
      .slice(0, 20)
      .map(([key, value]) => [
        /^[a-zA-Z0-9_]{1,64}$/u.test(key) ? key : "invalid_parameter",
        typeof value === "number" || typeof value === "boolean"
          ? value
          : { sha256: hashResearchValue(value), omitted: true },
      ]),
  );
}
