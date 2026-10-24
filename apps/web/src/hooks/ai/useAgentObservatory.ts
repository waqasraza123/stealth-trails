import axios from "axios";
import { useQuery } from "@tanstack/react-query";
import { loadWebRuntimeConfig } from "@stealth-trails-bank/config/web";
import { useUserStore } from "@/stores/userStore";

const webRuntimeConfig = loadWebRuntimeConfig(
  import.meta.env as Record<string, string | boolean | undefined>,
);

export type AgentTraceStatus = "succeeded" | "failed" | "fallback" | "running";
export type AgentExecutionMode =
  | "deterministic"
  | "llm_opt_in"
  | "hybrid"
  | "scheduled_deterministic"
  | "unavailable";

export type AgentExecutionTrace = {
  id: string;
  agentId: string;
  agentName: string;
  workflow: string;
  mode: AgentExecutionMode;
  status: AgentTraceStatus;
  actorType: "customer" | "worker" | "system";
  startedAt: string;
  completedAt: string;
  durationMs: number;
  steps: Array<{
    id: string;
    label: string;
    kind: "workflow" | "tool" | "decision" | "persistence";
    status: AgentTraceStatus;
    durationMs: number | null;
    toolName: string | null;
    outputSummary: string;
    evidenceIds: string[];
    failureReason: string | null;
  }>;
  providerUsage: {
    providerName: string | null;
    model: string | null;
    inputTokens: number | null;
    outputTokens: number | null;
    totalTokens: number | null;
    estimatedCostUsd: number | null;
    costNote: string;
  };
  evidence: Array<{
    evidenceId: string;
    sourceLabel: string;
    sourceType: string;
    observedAt: string | null;
    synthetic: boolean;
    groundingDecision: "used" | "available" | "rejected";
  }>;
  fallbackReason: string | null;
  failureReason: string | null;
};

export type AgentObservatoryDashboard = {
  scope: "customer" | "operator";
  registry: Array<{
    id: string;
    name: string;
    description: string;
    capabilities: string[];
    executionModes: AgentExecutionMode[];
    tools: string[];
    operationalStatus: "operational" | "degraded" | "no_recorded_activity";
    lastExecutionAt: string | null;
    customerVisible: boolean;
    externalAiProductionDisabled: true;
  }>;
  metrics: {
    recordedExecutionCount: number;
    succeededCount: number;
    failedCount: number;
    fallbackCount: number;
    errorRatePercent: number;
    averageLatencyMs: number | null;
    p95LatencyMs: number | null;
    tokenUsage: {
      executionsWithUsage: number;
      inputTokens: number | null;
      outputTokens: number | null;
      totalTokens: number | null;
      estimatedCostUsd: number | null;
      note: string;
    };
  };
  trends: Array<{
    bucket: string;
    executions: number;
    failures: number;
    fallbacks: number;
    averageLatencyMs: number | null;
  }>;
  errors: Array<{ category: string; count: number; latestAt: string }>;
  traces: AgentExecutionTrace[];
  generatedAt: string;
  retentionNote: string;
  securityNote: string;
};

type ApiResponse<T> = { status: "success" | "failed"; message: string; data?: T };

export function useAgentObservatory(filters: {
  hours: number;
  agentId?: string;
  status?: AgentTraceStatus;
}) {
  const token = useUserStore((state) => state.token);
  return useQuery({
    queryKey: ["agent-observatory", filters, token],
    enabled: Boolean(token),
    queryFn: async () => {
      if (!token) throw new Error("Authentication is required.");
      const response = await axios.get<ApiResponse<AgentObservatoryDashboard>>(
        `${webRuntimeConfig.serverUrl}/ai/observatory`,
        { headers: { Authorization: `Bearer ${token}` }, params: { ...filters, limit: 100 } },
      );
      if (response.data.status !== "success" || !response.data.data) {
        throw new Error(response.data.message || "Agent observatory is unavailable.");
      }
      return response.data.data;
    },
  });
}
