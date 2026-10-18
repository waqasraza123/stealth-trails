export type ProviderReportedUsage = {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
};

const PROVIDER_USAGE = Symbol("AI_PROVIDER_USAGE");

export function readOpenAiCompatibleUsage(value: unknown): ProviderReportedUsage | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const usage = (value as { usage?: unknown }).usage;
  if (typeof usage !== "object" || usage === null || Array.isArray(usage)) return null;
  const candidate = usage as {
    prompt_tokens?: unknown;
    completion_tokens?: unknown;
    total_tokens?: unknown;
  };
  if (
    typeof candidate.prompt_tokens !== "number" ||
    typeof candidate.completion_tokens !== "number" ||
    typeof candidate.total_tokens !== "number"
  ) return null;
  return {
    inputTokens: candidate.prompt_tokens,
    outputTokens: candidate.completion_tokens,
    totalTokens: candidate.total_tokens,
  };
}

export function attachProviderUsage<T extends object>(
  value: T,
  usage: ProviderReportedUsage | null,
): T {
  if (usage) {
    Object.defineProperty(value, PROVIDER_USAGE, {
      value: usage,
      enumerable: false,
      configurable: false,
    });
  }
  return value;
}

export function getAttachedProviderUsage(
  value: object,
): ProviderReportedUsage | null {
  return (value as { [PROVIDER_USAGE]?: ProviderReportedUsage })[PROVIDER_USAGE] ?? null;
}
