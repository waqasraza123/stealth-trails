import { ChatOpenAI } from "@langchain/openai";
import { loadAiWealthBriefRuntimeConfig } from "@stealth-trails-bank/config/api";
import type { ResearchModel } from "./financial-research.types";

export class ResearchProviderError extends Error {
  constructor(
    readonly code:
      | "provider_timeout"
      | "provider_rate_limited"
      | "provider_unavailable"
      | "provider_authentication_failed"
      | "provider_request_failed",
  ) {
    super(code);
  }
}

export function createResearchModel(): ResearchModel | null {
  const config = loadAiWealthBriefRuntimeConfig();
  if (
    process.env.NODE_ENV === "production" ||
    process.env.VERCEL_ENV === "production" ||
    process.env.AI_RESEARCH_ENABLED !== "true" ||
    config.provider !== "openai_compatible" ||
    !config.apiKey ||
    !config.endpoint ||
    !config.model
  )
    return null;
  const endpoint = new URL(config.endpoint);
  endpoint.pathname = endpoint.pathname.replace(/\/chat\/completions\/?$/u, "");
  endpoint.search = "";
  const createModel = (maxTokens: number) =>
    new ChatOpenAI({
      apiKey: config.apiKey!,
      model: config.model!,
      temperature: 0,
      maxTokens,
      maxRetries: 0,
      timeout: config.requestTimeoutMs,
      configuration: {
        baseURL: endpoint.toString().replace(/\/$/u, ""),
        fetch: async (url, init) => {
          // Never follow provider redirects to an unapproved destination.
          const target = new URL(String(url));
          if (target.origin !== endpoint.origin)
            throw new Error("provider_destination_denied");
          return fetch(url, { ...init, redirect: "error" });
        },
      },
    });
  return {
    modelId: config.model,
    providerOrigin: endpoint.origin,
    invoke: async (messages, tools, signal, maxTokens) => {
      try {
        return await createModel(maxTokens)
          .bindTools(tools, { tool_choice: "auto" })
          .invoke(messages, { signal });
      } catch (error) {
        const status =
          typeof error === "object" && error !== null && "status" in error
            ? Number(error.status)
            : 0;
        const name = error instanceof Error ? error.name : "";
        throw new ResearchProviderError(
          /timeout/iu.test(name)
            ? "provider_timeout"
            : status === 429
              ? "provider_rate_limited"
              : status === 401 || status === 403
                ? "provider_authentication_failed"
                : status >= 500 || /connection/iu.test(name)
                  ? "provider_unavailable"
                  : "provider_request_failed",
        );
      }
    },
  };
}
