import type { BaseMessage, AIMessage } from "@langchain/core/messages";
import { z } from "zod";

export const researchRequestSchema = z
  .object({
    prompt: z.string().min(1).max(16000),
    runId: z
      .string()
      .regex(/^[a-zA-Z0-9_.:-]{1,100}$/u)
      .optional(),
  })
  .strict();
export type ResearchRequest = z.infer<typeof researchRequestSchema>;
export type ResearchStopReason =
  | "completed"
  | "rejected"
  | "approval_required"
  | "timeout"
  | "tool_limit_reached"
  | "step_limit_reached"
  | "token_limit_reached"
  | "spend_limit_reached"
  | "model_error"
  | "policy_violation"
  | "infrastructure_error"
  | "interrupted";
export type ResearchIdentity = Readonly<{
  subject: string;
  customerId: string;
  externalAiConsent: boolean;
  allowedTools: readonly string[];
}>;
export type ResearchToolCall = {
  id: string;
  requestedName: string;
  arguments: Record<string, unknown>;
  permitted: boolean;
  denialReason: string | null;
  executedName: string | null;
  status:
    | "requested"
    | "denied"
    | "accepted"
    | "running"
    | "succeeded"
    | "failed"
    | "timed_out";
  resultRef: string | null;
  resultHash: string | null;
  summary: string | null;
  durationMs: number;
  error: string | null;
};
export type ResearchExecution = {
  executionId: string;
  traceId: string;
  runId: string | null;
  timestamp: string;
  agent: "financial-research-agent";
  version: string;
  gitSha: string | null;
  tenantRef: string;
  promptHash: string;
  mode: "live_llm" | "unavailable";
  benchmarkEligible: boolean;
  fallback: false;
  model: string | null;
  provider: string;
  status: "running" | "finished";
  availableTools: string[];
  settings: Record<string, string | number | boolean>;
  configFingerprint: string;
  policyHash: string;
  output: string;
  outputHash: string;
  toolCalls: ResearchToolCall[];
  policyDecisions: Array<{
    callId: string;
    permitted: boolean;
    reason: string;
  }>;
  modelDecisions: Array<{
    step: number;
    contentHash: string;
    response: string;
    requestedCallIds: string[];
    durationMs: number;
    model: string | null;
  }>;
  stopReason: ResearchStopReason;
  durationMs: number;
  retries: number;
  usage: {
    inputTokens: number | null;
    outputTokens: number | null;
    totalTokens: number | null;
    estimatedCostUsd: number | null;
    reservedCostUsd: number;
  };
  errors: string[];
};
export interface ResearchModel {
  readonly modelId: string;
  readonly providerOrigin?: string;
  invoke(
    messages: BaseMessage[],
    tools: ResearchModelTool[],
    signal: AbortSignal,
    maxTokens: number,
  ): Promise<AIMessage>;
}
export type ResearchModelTool = {
  name: string;
  description: string;
  schema: z.AnyZodObject;
};
export const RESEARCH_MODEL = Symbol("RESEARCH_MODEL");
