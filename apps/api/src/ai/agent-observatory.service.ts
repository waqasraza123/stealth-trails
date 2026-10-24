import { Injectable, Logger } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { PrismaService } from "../prisma/prisma.service";
import type { ResearchExecution } from "./financial-research.types";
import { hashResearchValue } from "./financial-research.config";
import type { GetAgentObservatoryDto } from "./dto/get-agent-observatory.dto";
import type {
  AgentExecutionTrace,
  AgentObservatoryDashboard,
  AgentProviderUsage,
  AgentRegistryEntry,
  TraceSummary,
} from "./agent-observatory.types";

const TRACE_ACTION = "ai_agent.execution_recorded";
const TRACE_TARGET = "ai_agent_execution";
const MAX_STEPS = 20;
const MAX_EVIDENCE = 30;

const REGISTRY: Omit<AgentRegistryEntry, "operationalStatus" | "lastExecutionAt">[] = [
  {
    id: "financial-research-agent", name: "Financial Research Agent",
    description: "Opt-in, bounded LangGraph model-directed research with backend authorization.",
    capabilities: ["dynamic tool selection", "identity-bound reads", "policy decisions", "execution evidence"],
    executionModes: ["llm_opt_in"], tools: ["portfolio_snapshot", "transaction_history", "market_observations", "opportunity_research", "portfolio_risk", "document_passages", "financial_memory", "research_plan"],
    customerVisible: true, externalAiProductionDisabled: true,
  },
  {
    id: "financial-memory",
    name: "AI Financial Memory",
    description: "Retrieves and maintains explicitly authorized customer preferences with bounded, customer-isolated access.",
    capabilities: ["consent enforcement", "bounded retrieval", "retention", "sanitized access audit"],
    executionModes: ["deterministic"],
    tools: ["customer-scoped-postgres", "optional-pgvector"],
    customerVisible: true,
    externalAiProductionDisabled: true,
  },
  {
    id: "workflow-studio",
    name: "AI Agent Workflow Studio",
    description: "Executes customer-owned, allow-listed research graphs with durable runs, conditions, retries, and human approval.",
    capabilities: ["workflow routing", "durable execution", "conditional logic", "human approval"],
    executionModes: ["deterministic", "hybrid", "scheduled_deterministic"],
    tools: ["langgraph-state-graph", "workflow-postgres-store", "read-only-agent-tools", "internal-worker-api"],
    customerVisible: true,
    externalAiProductionDisabled: true,
  },
  {
    id: "chief-research-agent",
    name: "Chief Research Agent",
    description: "Coordinates checkpointed LangGraph investment-research missions and consolidates evidence, assumptions, and disagreements.",
    capabilities: ["LangGraph routing", "durable interrupts", "agent coordination", "structured consolidation"],
    executionModes: ["deterministic", "hybrid"],
    tools: ["langgraph-state-graph", "financial_copilot_synthesis_read_only"],
    customerVisible: true,
    externalAiProductionDisabled: true,
  },
  {
    id: "opportunity-agent",
    name: "Opportunity Agent",
    description: "Uses Opportunity Hunter to discover and rank evidence-bound market research candidates.",
    capabilities: ["market discovery", "evidence scoring", "opportunity ranking"],
    executionModes: ["deterministic", "hybrid"],
    tools: ["opportunity_hunter_read_only", "market-data-provider"],
    customerVisible: true,
    externalAiProductionDisabled: true,
  },
  {
    id: "risk-agent",
    name: "Risk Agent",
    description: "Independently runs deterministic exposure, volatility, drawdown, and stress analysis.",
    capabilities: ["volatility", "exposure", "stress scenarios", "concentration"],
    executionModes: ["deterministic"],
    tools: ["portfolio_risk_lab_read_only", "portfolio-risk-engine"],
    customerVisible: true,
    externalAiProductionDisabled: true,
  },
  {
    id: "halal-research-agent",
    name: "Halal Research Agent",
    description: "Reviews available Shariah-screening evidence while preserving gaps and uncertainty.",
    capabilities: ["screening evidence", "uncertainty flags", "rule lineage"],
    executionModes: ["deterministic"],
    tools: ["halal_evidence_screen_read_only", "opportunity-evidence"],
    customerVisible: true,
    externalAiProductionDisabled: true,
  },
  {
    id: "strategy-agent",
    name: "Strategy Agent",
    description: "Creates customer-owned educational plans, scenarios, monitoring signals, and reassessment conditions.",
    capabilities: ["educational planning", "scenario analysis", "monitoring plans"],
    executionModes: ["deterministic", "hybrid"],
    tools: ["research_plan_studio_read_only", "financial_copilot_synthesis_read_only"],
    customerVisible: true,
    externalAiProductionDisabled: true,
  },
  {
    id: "wealth-brief",
    name: "Wealth Brief",
    description: "Builds a read-only financial snapshot and optionally prioritizes server-authored statements.",
    capabilities: ["financial snapshot", "risk flags", "research questions", "evidence selection"],
    executionModes: ["deterministic", "llm_opt_in", "hybrid"],
    tools: ["wealth-snapshot", "statement-catalog", "wealth-brief-provider"],
    customerVisible: true,
    externalAiProductionDisabled: true,
  },
  {
    id: "opportunity-hunter",
    name: "Opportunity Hunter",
    description: "Builds deterministic market opportunity scores and optional evidence-only AI ranking.",
    capabilities: ["market discovery", "risk scoring", "halal screening", "evidence ranking"],
    executionModes: ["deterministic", "llm_opt_in", "hybrid"],
    tools: ["market-data-provider", "halal-screening-engine", "opportunity-analyst-provider"],
    customerVisible: true,
    externalAiProductionDisabled: true,
  },
  {
    id: "wealth-guardian",
    name: "Wealth Guardian",
    description: "Produces manual and scheduled evidence-backed monitoring reports.",
    capabilities: ["risk monitoring", "halal alerts", "change detection", "scheduled reports"],
    executionModes: ["deterministic", "hybrid", "scheduled_deterministic"],
    tools: ["wealth-snapshot", "opportunity-hunter", "audit-events", "notifications"],
    customerVisible: true,
    externalAiProductionDisabled: true,
  },
  {
    id: "financial-copilot",
    name: "Financial Copilot",
    description: "Answers read-only questions from server-authored statements and citations.",
    capabilities: ["conversational research", "citation selection", "streaming", "portfolio-risk context"],
    executionModes: ["deterministic", "llm_opt_in", "hybrid"],
    tools: ["wealth-brief", "opportunity-hunter", "wealth-guardian", "portfolio-risk-lab"],
    customerVisible: true,
    externalAiProductionDisabled: true,
  },
  {
    id: "research-plan-studio",
    name: "Research Plan Studio",
    description: "Calculates customer-owned educational plans and scenario comparisons.",
    capabilities: ["allocation analysis", "scenario modeling", "plan revisions", "evidence linking"],
    executionModes: ["deterministic", "hybrid"],
    tools: ["opportunity-hunter", "portfolio-risk-engine", "audit-events"],
    customerVisible: true,
    externalAiProductionDisabled: true,
  },
  {
    id: "portfolio-risk-lab",
    name: "Portfolio Risk Lab",
    description: "Runs deterministic portfolio exposure, stress, historical, and halal-risk analysis.",
    capabilities: ["concentration", "volatility", "stress testing", "risk guardian"],
    executionModes: ["deterministic"],
    tools: ["opportunity-hunter", "portfolio-risk-engine"],
    customerVisible: true,
    externalAiProductionDisabled: true,
  },
  {
    id: "wealth-guardian-worker",
    name: "Wealth Guardian Worker",
    description: "Invokes bounded scheduled Guardian research through the internal worker API.",
    capabilities: ["schedule evaluation", "bounded batch processing", "failure isolation"],
    executionModes: ["scheduled_deterministic"],
    tools: ["internal-worker-api", "wealth-guardian"],
    customerVisible: false,
    externalAiProductionDisabled: true,
  },
];

type ObserveArgs<T> = {
  customerId: string | null;
  actorType: "customer" | "worker" | "system";
  actorId: string | null;
  agentId: string;
  workflow: string;
  execute: () => Promise<T>;
  summarize: (result: T) => TraceSummary;
};

function asObject(value: Prisma.JsonValue | null): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function percentile(values: number[], quantile: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * quantile) - 1)];
}

function safeFailureReason(error: unknown): string {
  if (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    Number((error as { status?: unknown }).status) === 429
  ) return "rate_limit_exceeded";
  if (!(error instanceof Error)) return "unknown_execution_failure";
  if (/rate.?limit|too.?many.?requests/iu.test(`${error.name} ${error.message}`)) {
    return "rate_limit_exceeded";
  }
  const name = error.name.replace(/[^a-z0-9]+/giu, "_").toLowerCase();
  return name || "execution_error";
}

@Injectable()
export class AgentObservatoryService {
  private readonly logger = new Logger(AgentObservatoryService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Durable checkpoints use the existing Observatory audit stream; failure is fatal. */
  async recordResearchExecution(customerId: string, subject: string, execution: ResearchExecution): Promise<void> {
    const research = { ...execution, output: `[output omitted; sha256=${hashResearchValue(execution.output)}]` };
    const trace = {
      agentId: execution.agent, agentName: "Financial Research Agent", workflow: "copilot_research",
      mode: execution.mode === "live_llm" ? "llm_opt_in" : "unavailable",
      status: execution.status === "running" ? "running" : execution.stopReason === "completed" ? "succeeded" : "failed", actorType: "customer",
      startedAt: execution.timestamp, completedAt: new Date().toISOString(), durationMs: execution.durationMs,
      steps: execution.toolCalls.slice(0, 20).map((call) => ({ id: call.id, label: call.requestedName, kind: "tool", status: ["requested", "accepted", "running"].includes(call.status) ? "running" : call.status === "succeeded" ? "succeeded" : "failed", durationMs: call.durationMs, toolName: call.executedName, outputSummary: call.summary ?? call.denialReason ?? call.status, evidenceIds: call.resultRef ? [call.resultRef] : [], failureReason: call.error })),
      providerUsage: { providerName: execution.provider, model: execution.model, ...execution.usage, costNote: "Reserved spending uses operator-configured upper-bound rates; verified pricing unavailable." },
      evidence: [], fallbackReason: null, failureReason: execution.errors[0] ?? null,
    };
    const data = { customerId, actorType: "customer", actorId: subject, action: TRACE_ACTION, targetType: TRACE_TARGET, targetId: execution.executionId, metadata: { trace, research } as unknown as Prisma.InputJsonValue };
    await this.prisma.auditEvent.upsert({ where: { id: execution.executionId }, create: { id: execution.executionId, ...data }, update: { metadata: data.metadata } });
  }

  async getResearchExecution(customerId: string, executionId: string): Promise<ResearchExecution | null> {
    const event = await this.prisma.auditEvent.findFirst({ where: { id: executionId, customerId, action: TRACE_ACTION, targetType: TRACE_TARGET }, select: { metadata: true } });
    const metadata = asObject(event?.metadata ?? null);
    return metadata.research ? metadata.research as unknown as ResearchExecution : null;
  }

  async recordCustomerMemoryActivity(
    supabaseUserId: string,
    input: { operation: string; agentId: string; count: number; categories: string[] },
  ): Promise<void> {
    await this.observeCustomer(supabaseUserId, {
      agentId: "financial-memory",
      workflow: input.operation.replace(/[^a-z0-9_-]+/giu, "_").slice(0, 80),
      execute: async () => input,
      summarize: (value) => ({
        mode: "deterministic",
        steps: [{
          id: "memory-policy-boundary",
          label: "Apply customer memory policy",
          kind: "persistence",
          status: "succeeded",
          toolName: "customer-scoped-memory-store",
          outputSummary: `${Math.max(0, value.count)} memory item(s) processed for ${value.agentId}; categories: ${value.categories.slice(0, 7).join(", ") || "none"}. Raw memory content was excluded from this trace.`,
          evidenceIds: [],
          failureReason: null,
        }],
      }),
    });
  }

  async observeCustomer<T>(
    supabaseUserId: string,
    args: Omit<ObserveArgs<T>, "customerId" | "actorType" | "actorId">,
  ): Promise<T> {
    let customerId: string | null = null;
    try {
      customerId = (
        await this.prisma.customer.findUnique({
          where: { supabaseUserId },
          select: { id: true },
        })
      )?.id ?? null;
    } catch (error) {
      this.logger.warn(`Agent trace customer resolution failed: ${safeFailureReason(error)}`);
    }
    return this.observe({
      ...args,
      customerId,
      actorType: "customer",
      actorId: supabaseUserId,
    });
  }

  async observeWorker<T>(
    workerId: string,
    args: Omit<ObserveArgs<T>, "customerId" | "actorType" | "actorId">,
  ): Promise<T> {
    return this.observe({
      ...args,
      customerId: null,
      actorType: "worker",
      actorId: workerId,
    });
  }

  async getCustomerDashboard(
    supabaseUserId: string,
    query: GetAgentObservatoryDto,
  ): Promise<AgentObservatoryDashboard> {
    const customer = await this.prisma.customer.findUnique({
      where: { supabaseUserId },
      select: { id: true },
    });
    return this.buildDashboard("customer", query, customer?.id ?? "__missing_customer__");
  }

  async getOperatorDashboard(
    query: GetAgentObservatoryDto,
  ): Promise<AgentObservatoryDashboard> {
    return this.buildDashboard("operator", query, null);
  }

  private async observe<T>(args: ObserveArgs<T>): Promise<T> {
    const runId = randomUUID();
    const startedAt = new Date();
    const startedMs = Date.now();
    try {
      const result = await args.execute();
      const summary = args.summarize(result);
      await this.record({
        runId,
        args,
        startedAt,
        durationMs: Date.now() - startedMs,
        summary,
        failureReason: null,
      });
      return result;
    } catch (error) {
      await this.record({
        runId,
        args,
        startedAt,
        durationMs: Date.now() - startedMs,
        summary: {
          mode: "unavailable",
          status: "failed",
          steps: [],
        },
        failureReason: safeFailureReason(error),
      });
      throw error;
    }
  }

  private async record<T>(input: {
    runId: string;
    args: ObserveArgs<T>;
    startedAt: Date;
    durationMs: number;
    summary: TraceSummary;
    failureReason: string | null;
  }): Promise<void> {
    const completedAt = new Date();
    const registry = REGISTRY.find((item) => item.id === input.args.agentId);
    const usage: AgentProviderUsage = {
      providerName: input.summary.providerUsage?.providerName ?? null,
      model: input.summary.providerUsage?.model ?? null,
      inputTokens: input.summary.providerUsage?.inputTokens ?? null,
      outputTokens: input.summary.providerUsage?.outputTokens ?? null,
      totalTokens: input.summary.providerUsage?.totalTokens ?? null,
      estimatedCostUsd: input.summary.providerUsage?.estimatedCostUsd ?? null,
      costNote:
        input.summary.providerUsage?.costNote ??
        "Provider pricing was not available to this execution; cost is unavailable.",
    };
    const status = input.failureReason
      ? "failed"
      : input.summary.status ??
        (input.summary.fallbackReason ? "fallback" : "succeeded");
    const trace: Omit<AgentExecutionTrace, "id"> = {
      agentId: input.args.agentId,
      agentName: registry?.name ?? input.args.agentId,
      workflow: input.args.workflow,
      mode: input.summary.mode,
      status,
      actorType: input.args.actorType,
      startedAt: input.startedAt.toISOString(),
      completedAt: completedAt.toISOString(),
      durationMs: input.durationMs,
      steps: [
        {
          id: "workflow-execution",
          label: "Execute bounded workflow",
          kind: "workflow",
          status,
          durationMs: input.durationMs,
          toolName: null,
          outputSummary:
            status === "failed"
              ? "Workflow stopped before a safe result was returned."
              : "Workflow returned a bounded, server-authored result.",
          evidenceIds: [],
          failureReason: input.failureReason,
        },
        ...input.summary.steps.slice(0, MAX_STEPS - 1).map((step) => ({
          ...step,
          durationMs: null,
        })),
      ],
      providerUsage: usage,
      evidence: (input.summary.evidence ?? []).slice(0, MAX_EVIDENCE),
      fallbackReason: input.summary.fallbackReason ?? null,
      failureReason: input.failureReason,
    };
    try {
      await this.prisma.auditEvent.create({
        data: {
          customerId: input.args.customerId,
          actorType: input.args.actorType,
          actorId: input.args.actorId,
          action: TRACE_ACTION,
          targetType: TRACE_TARGET,
          targetId: input.runId,
          metadata: { trace } as unknown as Prisma.InputJsonValue,
        },
      });
    } catch (error) {
      this.logger.warn(`Agent trace persistence skipped: ${safeFailureReason(error)}`);
    }
  }

  private async buildDashboard(
    scope: "customer" | "operator",
    query: GetAgentObservatoryDto,
    customerId: string | null,
  ): Promise<AgentObservatoryDashboard> {
    const hours = query.hours ?? 168;
    const events = await this.prisma.auditEvent.findMany({
      where: {
        ...(customerId === null ? {} : { customerId }),
        action: TRACE_ACTION,
        targetType: TRACE_TARGET,
        createdAt: { gte: new Date(Date.now() - hours * 60 * 60 * 1000) },
      },
      orderBy: { createdAt: "desc" },
      take: Math.min(200, Math.max(query.limit ?? 100, 100)),
    });
    const windowTraces = events.flatMap((event) => {
      const trace = asObject(event.metadata).trace;
      if (typeof trace !== "object" || trace === null || Array.isArray(trace)) return [];
      return [{ ...(trace as unknown as Omit<AgentExecutionTrace, "id">), id: event.id }];
    });
    const traces = windowTraces.filter((trace) =>
      (!query.agentId || trace.agentId === query.agentId) &&
      (!query.status || trace.status === query.status),
    ).slice(0, query.limit ?? 100);
    const durations = traces.map((trace) => trace.durationMs);
    const successes = traces.filter((trace) => trace.status === "succeeded").length;
    const failures = traces.filter((trace) => trace.status === "failed").length;
    const fallbacks = traces.filter((trace) => trace.status === "fallback").length;
    const withUsage = traces.filter(
      (trace) => trace.providerUsage.totalTokens !== null,
    );
    const usageTotal = (key: "inputTokens" | "outputTokens" | "totalTokens") =>
      withUsage.length === 0
        ? null
        : withUsage.reduce(
            (total, trace) => total + (trace.providerUsage[key] ?? 0),
            0,
          );
    const buckets = new Map<string, AgentExecutionTrace[]>();
    for (const trace of traces) {
      const bucket = trace.startedAt.slice(0, 10);
      buckets.set(bucket, [...(buckets.get(bucket) ?? []), trace]);
    }
    const errorMap = new Map<string, { count: number; latestAt: string }>();
    for (const trace of traces.filter((item) => item.status === "failed" || item.status === "fallback")) {
      const category = trace.failureReason ?? trace.fallbackReason ?? "unspecified_fallback";
      const current = errorMap.get(category);
      errorMap.set(category, {
        count: (current?.count ?? 0) + 1,
        latestAt:
          !current || Date.parse(trace.completedAt) > Date.parse(current.latestAt)
            ? trace.completedAt
            : current.latestAt,
      });
    }
    const visibleRegistry = REGISTRY.filter(
      (item) => scope === "operator" || item.customerVisible,
    ).map((item) => {
      const runs = windowTraces.filter((trace) => trace.agentId === item.id);
      return {
        ...item,
        operationalStatus:
          runs.length === 0
            ? "no_recorded_activity" as const
            : runs[0].status === "failed" || runs.some((run) => run.status === "failed")
              ? "degraded" as const
              : "operational" as const,
        lastExecutionAt: runs[0]?.completedAt ?? null,
      };
    });

    return {
      scope,
      registry: visibleRegistry,
      metrics: {
        recordedExecutionCount: traces.length,
        succeededCount: successes,
        failedCount: failures,
        fallbackCount: fallbacks,
        errorRatePercent:
          traces.length === 0
            ? 0
            : Number(((failures / traces.length) * 100).toFixed(2)),
        averageLatencyMs:
          durations.length === 0
            ? null
            : Math.round(durations.reduce((sum, value) => sum + value, 0) / durations.length),
        p95LatencyMs: percentile(durations, 0.95),
        tokenUsage: {
          executionsWithUsage: withUsage.length,
          inputTokens: usageTotal("inputTokens"),
          outputTokens: usageTotal("outputTokens"),
          totalTokens: usageTotal("totalTokens"),
          estimatedCostUsd: null,
          note:
            withUsage.length > 0
              ? "Token totals are provider-reported. Cost is unavailable because no approved pricing configuration is present."
              : "No provider usage metadata was recorded for the selected executions; tokens and cost are unavailable.",
        },
      },
      trends: [...buckets.entries()].map(([bucket, runs]) => ({
        bucket,
        executions: runs.length,
        failures: runs.filter((run) => run.status === "failed").length,
        fallbacks: runs.filter((run) => run.status === "fallback").length,
        averageLatencyMs:
          runs.length === 0
            ? null
            : Math.round(runs.reduce((sum, run) => sum + run.durationMs, 0) / runs.length),
      })).sort((left, right) => left.bucket.localeCompare(right.bucket)),
      errors: [...errorMap.entries()].map(([category, value]) => ({
        category,
        ...value,
      })).sort((left, right) => right.count - left.count),
      traces,
      generatedAt: new Date().toISOString(),
      retentionNote: `This view reads at most 200 recorded executions from the selected ${hours}-hour window; it does not infer missing historical runs.`,
      securityNote:
        scope === "operator"
          ? "Authorized operator diagnostics contain sanitized cross-customer execution metadata only. Customer identity, prompts, credentials, balances, and raw model output are excluded."
          : "Only executions attached to this authenticated customer are returned. Internal worker and other-customer diagnostics are excluded.",
    };
  }
}
