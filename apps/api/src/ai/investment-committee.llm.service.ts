import { Injectable } from "@nestjs/common";
import {
  loadAiWealthBriefRuntimeConfig,
  loadApiServerRuntimeConfig,
  type AiWealthBriefRuntimeConfig,
} from "@stealth-trails-bank/config/api";
import type { StructuredToolInterface } from "@langchain/core/tools";
import { ChatOpenAI } from "@langchain/openai";
import { z } from "zod";
import type { AgentProviderUsage } from "./agent-observatory.types";

type ProviderUsage = Pick<
  AgentProviderUsage,
  "providerName" | "model" | "inputTokens" | "outputTokens" | "totalTokens"
>;

export type CommitteeLlmResult<T> = {
  value: T;
  externalAiUsed: boolean;
  fallbackReason: string | null;
  providerUsage: ProviderUsage | null;
};

const rankedFindingSchema = z.object({
  findingIds: z.array(z.string().min(1).max(120)).max(12),
});

function safeFailure(error: unknown): string {
  if (!(error instanceof Error)) return "unknown_provider_failure";
  return error.name.replace(/[^a-z0-9]+/giu, "_").toLowerCase() || "provider_failure";
}

function baseUrlFor(config: AiWealthBriefRuntimeConfig): string | undefined {
  if (!config.endpoint) return undefined;
  const endpoint = new URL(config.endpoint);
  endpoint.pathname = endpoint.pathname.replace(/\/chat\/completions\/?$/u, "").replace(/\/$/u, "");
  endpoint.search = "";
  endpoint.hash = "";
  return endpoint.toString().replace(/\/$/u, "");
}

function usageFrom(message: unknown, model: string): ProviderUsage {
  const usage = typeof message === "object" && message !== null
    ? (message as {
      usage_metadata?: {
        input_tokens?: number;
        output_tokens?: number;
        total_tokens?: number;
      };
    }).usage_metadata
    : undefined;
  return {
    providerName: "openai_compatible",
    model,
    inputTokens: usage?.input_tokens ?? null,
    outputTokens: usage?.output_tokens ?? null,
    totalTokens: usage?.total_tokens ?? null,
  };
}

@Injectable()
export class InvestmentCommitteeLlmService {
  private readonly config = loadAiWealthBriefRuntimeConfig();
  private readonly environment = loadApiServerRuntimeConfig().environment;

  isAvailable(consent: boolean): boolean {
    return Boolean(
      consent &&
        process.env.AI_INVESTMENT_COMMITTEE_ENABLED === "true" &&
        this.environment !== "production" &&
        this.config.provider === "openai_compatible" &&
        this.config.apiKey &&
        this.config.endpoint &&
        this.config.model,
    );
  }

  async callTool<T>(args: {
    consent: boolean;
    agentLabel: string;
    tool: StructuredToolInterface;
    invoke: (input: Record<string, never>) => Promise<T>;
  }): Promise<CommitteeLlmResult<T>> {
    if (!this.isAvailable(args.consent)) {
      return {
        value: await args.invoke({}),
        externalAiUsed: false,
        fallbackReason: "deterministic_fallback_provider_unavailable_or_not_consented",
        providerUsage: null,
      };
    }

    try {
      const model = this.createModel();
      const response = await model
        .bindTools([args.tool], {
          tool_choice: {
            type: "function",
            function: { name: args.tool.name },
          },
          strict: true,
        })
        .invoke([
          {
            role: "system",
            content:
              "You coordinate a read-only financial research workflow. Call the required tool exactly once with an empty object. Do not provide financial advice, invent inputs, or write prose.",
          },
          {
            role: "user",
            content: `Execute the authorized ${args.agentLabel} research step. No customer data is included in this request.`,
          },
        ]);
      const call = response.tool_calls?.find((item) => item.name === args.tool.name);
      if (!call || Object.keys(call.args ?? {}).length !== 0) {
        throw new Error("invalid_required_tool_call");
      }
      return {
        value: await args.invoke(call.args as Record<string, never>),
        externalAiUsed: true,
        fallbackReason: null,
        providerUsage: usageFrom(response, this.config.model!),
      };
    } catch (error) {
      return {
        value: await args.invoke({}),
        externalAiUsed: false,
        fallbackReason: `deterministic_fallback_${safeFailure(error)}`,
        providerUsage: null,
      };
    }
  }

  async rankFindings(args: {
    consent: boolean;
    findings: Array<{ id: string; category: string; evidenceStatus: string }>;
  }): Promise<CommitteeLlmResult<string[]>> {
    const deterministic = args.findings.map((item) => item.id);
    if (!this.isAvailable(args.consent)) {
      return {
        value: deterministic,
        externalAiUsed: false,
        fallbackReason: "deterministic_fallback_provider_unavailable_or_not_consented",
        providerUsage: null,
      };
    }

    try {
      const structured = this.createModel().withStructuredOutput(rankedFindingSchema, {
        name: "rank_committee_findings",
        strict: true,
        includeRaw: true,
      });
      const result = await structured.invoke([
        {
          role: "system",
          content:
            "Rank opaque, server-authored finding IDs for an educational committee report. Return only IDs supplied by the server. Do not infer facts or provide advice.",
        },
        {
          role: "user",
          content: JSON.stringify({ catalog: args.findings }),
        },
      ]);
      const allowed = new Set(deterministic);
      const ranked = [...new Set(result.parsed.findingIds)].filter((id) => allowed.has(id));
      if (ranked.length !== deterministic.length) throw new Error("invalid_structured_finding_ranking");
      return {
        value: ranked,
        externalAiUsed: true,
        fallbackReason: null,
        providerUsage: usageFrom(result.raw, this.config.model!),
      };
    } catch (error) {
      return {
        value: deterministic,
        externalAiUsed: false,
        fallbackReason: `deterministic_fallback_${safeFailure(error)}`,
        providerUsage: null,
      };
    }
  }

  private createModel(): ChatOpenAI {
    return new ChatOpenAI({
      apiKey: this.config.apiKey!,
      model: this.config.model!,
      temperature: 0,
      maxTokens: Math.min(this.config.maxOutputTokens, 500),
      maxRetries: 0,
      timeout: this.config.requestTimeoutMs,
      useResponsesApi: false,
      configuration: { baseURL: baseUrlFor(this.config) },
    });
  }
}
