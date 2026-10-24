export type AgentExecutionMode =
  | "deterministic"
  | "llm_opt_in"
  | "hybrid"
  | "scheduled_deterministic"
  | "unavailable";

export type AgentTraceStatus = "succeeded" | "failed" | "fallback" | "running";

export type AgentEvidenceTrace = {
  evidenceId: string;
  sourceLabel: string;
  sourceType: string;
  observedAt: string | null;
  synthetic: boolean;
  groundingDecision: "used" | "available" | "rejected";
};

export type AgentProviderUsage = {
  providerName: string | null;
  model: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
  estimatedCostUsd: number | null;
  costNote: string;
};

export type AgentTraceStep = {
  id: string;
  label: string;
  kind: "workflow" | "tool" | "decision" | "persistence";
  status: AgentTraceStatus;
  durationMs: number | null;
  toolName: string | null;
  outputSummary: string;
  evidenceIds: string[];
  failureReason: string | null;
};

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
  steps: AgentTraceStep[];
  providerUsage: AgentProviderUsage;
  evidence: AgentEvidenceTrace[];
  fallbackReason: string | null;
  failureReason: string | null;
};

export type AgentRegistryEntry = {
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
};

export type AgentObservatoryDashboard = {
  scope: "customer" | "operator";
  registry: AgentRegistryEntry[];
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
  errors: Array<{
    category: string;
    count: number;
    latestAt: string;
  }>;
  traces: AgentExecutionTrace[];
  generatedAt: string;
  retentionNote: string;
  securityNote: string;
};

export type TraceSummary = {
  mode: AgentExecutionMode;
  status?: AgentTraceStatus;
  steps: Omit<AgentTraceStep, "durationMs">[];
  evidence?: AgentEvidenceTrace[];
  providerUsage?: Partial<AgentProviderUsage>;
  fallbackReason?: string | null;
};
