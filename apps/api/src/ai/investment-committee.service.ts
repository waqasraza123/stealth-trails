import { randomUUID } from "node:crypto";
import { BadRequestException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { Annotation, Command, END, START, StateGraph, interrupt } from "@langchain/langgraph";
import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";
import { PrismaService } from "../prisma/prisma.service";
import { AgentObservatoryService } from "./agent-observatory.service";
import type { AgentProviderUsage } from "./agent-observatory.types";
import type { CopilotService } from "./copilot.service";
import { InvestmentCommitteeLlmService, type CommitteeLlmResult } from "./investment-committee.llm.service";
import { InvestmentCommitteeTools, type HalalFinding } from "./investment-committee.tools";
import type {
  InvestmentCommitteeAgentId,
  InvestmentCommitteeAgentState,
  InvestmentCommitteeDashboard,
  InvestmentCommitteeDisagreement,
  InvestmentCommitteeFinding,
  InvestmentCommitteeMission,
  InvestmentCommitteeMissionInput,
} from "./investment-committee.types";
import type { Opportunity, OpportunityHunterResponse } from "./opportunity-hunter.types";
import type { PortfolioRiskAnalysis } from "./portfolio-risk.types";
import type { InvestmentResearchPlan } from "./research-plan.types";

const SNAPSHOT_ACTION = "ai_investment_committee.mission_snapshot";
const SNAPSHOT_TARGET = "ai_investment_committee_mission";
const CHECKPOINT_SCHEMA = "langgraph";
const DISCLAIMER =
  "Educational investment research only—not financial advice, a religious ruling, a recommendation, an offer, or authorization to trade, rebalance, transfer, or execute any financial transaction.";
const MAXIMUM_TOOL_CALLS = 8;
const RETRY_LIMIT = 1;
const RECURSION_LIMIT = 20;

type Allocation = { opportunityId: string; percent: number };
type CopilotResult = Awaited<ReturnType<CopilotService["sendMessage"]>>;
type ResumeAction = "resume" | "approve" | "cancel";

const AGENTS: Array<{ id: InvestmentCommitteeAgentId; name: string }> = [
  { id: "chief-research-agent", name: "Chief Research Agent" },
  { id: "opportunity-agent", name: "Opportunity Agent" },
  { id: "risk-agent", name: "Risk Agent" },
  { id: "halal-research-agent", name: "Halal Research Agent" },
  { id: "strategy-agent", name: "Strategy Agent" },
];

const CommitteeState = Annotation.Root({
  supabaseUserId: Annotation<string>(),
  customerId: Annotation<string>(),
  missionId: Annotation<string>(),
  mission: Annotation<InvestmentCommitteeMission>(),
  opportunityResearch: Annotation<OpportunityHunterResponse | null>(),
  allocations: Annotation<Allocation[]>(),
  riskResearch: Annotation<PortfolioRiskAnalysis | null>(),
  halalFindings: Annotation<HalalFinding[]>(),
  strategyPlan: Annotation<InvestmentResearchPlan | null>(),
  copilotResult: Annotation<CopilotResult | null>(),
  externalAiUsed: Annotation<boolean>({ reducer: (current, update) => current || update, default: () => false }),
  providerUsage: Annotation<AgentProviderUsage[]>({ reducer: (current, update) => [...current, ...update], default: () => [] }),
  fallbackReasons: Annotation<string[]>({ reducer: (current, update) => [...current, ...update], default: () => [] }),
  approved: Annotation<boolean>(),
  cancelled: Annotation<boolean>(),
  failureReason: Annotation<string | null>(),
});

type CommitteeGraphState = typeof CommitteeState.State;

function asObject(value: Prisma.JsonValue | null): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function safeFailure(error: unknown): string {
  if (!(error instanceof Error)) return "unknown_execution_failure";
  return error.message.startsWith("committee_")
    ? error.message
    : error.name.replace(/[^a-z0-9]+/giu, "_").toLowerCase() || "execution_failure";
}

function loadPerAgentTimeoutMs(): number {
  const configured = Number(process.env.AI_INVESTMENT_COMMITTEE_AGENT_TIMEOUT_MS ?? 20_000);
  return Number.isFinite(configured) ? Math.min(60_000, Math.max(5_000, configured)) : 20_000;
}

function missionFromMetadata(value: Prisma.JsonValue | null): InvestmentCommitteeMission | null {
  const mission = asObject(value).mission;
  return typeof mission === "object" && mission !== null && !Array.isArray(mission)
    ? (mission as unknown as InvestmentCommitteeMission)
    : null;
}

function createAgent(id: InvestmentCommitteeAgentId, name: string): InvestmentCommitteeAgentState {
  return {
    id,
    name,
    status: "pending",
    startedAt: null,
    completedAt: null,
    durationMs: null,
    reasoningSummary: "Waiting for the Chief Research Agent to assign a bounded graph node.",
    toolActivity: [],
    failureReason: null,
  };
}

function providerUsage(result: CommitteeLlmResult<unknown>): AgentProviderUsage[] {
  if (!result.providerUsage) return [];
  return [{
    ...result.providerUsage,
    estimatedCostUsd: null,
    costNote: "Provider-reported tokens are recorded; cost is unavailable because no approved pricing configuration is present.",
  }];
}

function aggregateUsage(items: AgentProviderUsage[]): Partial<AgentProviderUsage> | undefined {
  if (items.length === 0) return undefined;
  const sum = (key: "inputTokens" | "outputTokens" | "totalTokens") => {
    const values = items.map((item) => item[key]).filter((value): value is number => value !== null);
    return values.length ? values.reduce((total, value) => total + value, 0) : null;
  };
  return {
    providerName: items[0].providerName,
    model: items[0].model,
    inputTokens: sum("inputTokens"),
    outputTokens: sum("outputTokens"),
    totalTokens: sum("totalTokens"),
    estimatedCostUsd: null,
    costNote: "Provider-reported tokens are recorded; cost is unavailable because no approved pricing configuration is present.",
  };
}

@Injectable()
export class InvestmentCommitteeService {
  private readonly logger = new Logger(InvestmentCommitteeService.name);
  private readonly activeMissionIds = new Set<string>();
  private readonly pendingResumeActions = new Map<string, ResumeAction>();
  private readonly perAgentTimeoutMs = loadPerAgentTimeoutMs();
  private checkpointerPromise: Promise<PostgresSaver> | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly tools: InvestmentCommitteeTools,
    private readonly llm: InvestmentCommitteeLlmService,
    private readonly observatory: AgentObservatoryService,
  ) {}

  async startMission(supabaseUserId: string, input: InvestmentCommitteeMissionInput): Promise<InvestmentCommitteeMission> {
    const customerId = await this.resolveCustomerId(supabaseUserId);
    this.validateAllocations(input.allocations);
    const now = new Date().toISOString();
    const mission: InvestmentCommitteeMission = {
      id: randomUUID(),
      goal: input.goal.trim(),
      status: "queued",
      requestedAt: now,
      startedAt: null,
      completedAt: null,
      updatedAt: now,
      externalAiConsent: input.externalAiConsent,
      executionMode: "deterministic_only",
      controlNote: "Mission accepted and queued for a checkpointed LangGraph research run.",
      agents: AGENTS.map((agent) => createAgent(agent.id, agent.name)),
      report: null,
      failureReason: null,
      configuration: { perAgentTimeoutMs: this.perAgentTimeoutMs, maximumToolCalls: MAXIMUM_TOOL_CALLS, retryLimit: RETRY_LIMIT },
      input: { ...input, goal: input.goal.trim() },
    };
    await this.persist(customerId, supabaseUserId, mission);
    queueMicrotask(() => void this.schedule(supabaseUserId, mission.id));
    return mission;
  }

  async getDashboard(supabaseUserId: string): Promise<InvestmentCommitteeDashboard> {
    const customerId = await this.resolveCustomerId(supabaseUserId);
    const missions = await this.listLatest(customerId);
    missions
      .filter((mission) => mission.status === "queued" || mission.status === "running")
      .forEach((mission) => queueMicrotask(() => void this.schedule(supabaseUserId, mission.id)));
    return {
      missions,
      activeMissionCount: missions.filter((mission) => ["queued", "running", "paused", "awaiting_approval"].includes(mission.status)).length,
      historyNote: "LangGraph checkpoints are stored in the customer-scoped mission thread on Neon PostgreSQL; sanitized dashboard snapshots remain in the audit-event store.",
      executionBoundary: "Graph tools perform bounded, read-only research. They cannot place trades, rebalance portfolios, transfer funds, or invoke banking transaction services.",
    };
  }

  async getMission(supabaseUserId: string, missionId: string): Promise<InvestmentCommitteeMission> {
    const customerId = await this.resolveCustomerId(supabaseUserId);
    return this.getLatest(customerId, missionId);
  }

  async controlMission(
    supabaseUserId: string,
    missionId: string,
    action: "pause" | "resume" | "cancel" | "approve",
  ): Promise<InvestmentCommitteeMission> {
    const customerId = await this.resolveCustomerId(supabaseUserId);
    const mission = await this.getLatest(customerId, missionId);
    if (["completed", "cancelled"].includes(mission.status)) {
      throw new BadRequestException("Completed or cancelled missions cannot be changed.");
    }
    if (action === "approve" && mission.status !== "awaiting_approval") {
      throw new BadRequestException("This mission is not awaiting approval.");
    }
    const wasInterrupted = mission.status === "paused" || mission.status === "awaiting_approval";

    if (action === "pause") {
      mission.status = "paused";
      mission.controlNote = "Pause requested. LangGraph will interrupt at the next node boundary.";
      mission.agents = mission.agents.map((agent) => agent.status === "running" ? { ...agent, status: "paused" } : agent);
    } else if (action === "cancel") {
      mission.status = "cancelled";
      mission.completedAt = new Date().toISOString();
      mission.controlNote = "Mission cancelled. The graph cannot start further read-only tools.";
      mission.agents = mission.agents.map((agent) => agent.status === "completed" ? agent : { ...agent, status: "cancelled" });
    } else {
      mission.status = wasInterrupted ? mission.status : "queued";
      mission.completedAt = null;
      mission.failureReason = null;
      mission.controlNote = action === "approve"
        ? "Human approval recorded. LangGraph will consume the approval and resume consolidated reporting."
        : "Resume requested. LangGraph will continue from its durable interrupt checkpoint.";
      if (!wasInterrupted) {
        mission.agents = mission.agents.map((agent) => agent.status === "completed" ? agent : { ...agent, status: "pending", failureReason: null });
      }
    }
    mission.updatedAt = new Date().toISOString();
    await this.persist(customerId, supabaseUserId, mission);

    const active = this.activeMissionIds.has(missionId);
    if (action !== "pause" && (active || action !== "cancel" || wasInterrupted)) {
      this.pendingResumeActions.set(missionId, action);
      if (!active) queueMicrotask(() => void this.schedule(supabaseUserId, mission.id));
    }
    return mission;
  }

  private async schedule(supabaseUserId: string, missionId: string): Promise<void> {
    if (this.activeMissionIds.has(missionId)) return;
    this.activeMissionIds.add(missionId);
    try {
      await this.observatory.observeCustomer(supabaseUserId, {
        agentId: "chief-research-agent",
        workflow: "langgraph_investment_committee",
        execute: () => this.executeMission(supabaseUserId, missionId),
        summarize: (result) => ({
          mode: result.executionMode === "deterministic_only" ? "deterministic" : "hybrid",
          status: result.status === "failed" ? "failed" : result.status === "completed" ? "succeeded" : "fallback",
          fallbackReason: result.status === "paused"
            ? "langgraph_interrupted_for_pause"
            : result.status === "awaiting_approval"
              ? "langgraph_interrupted_for_human_approval"
              : result.executionMode === "deterministic_only"
                ? "deterministic_fallback_explicitly_labeled"
                : null,
          steps: result.agents.map((agent) => ({
            id: `graph-node:${agent.id}`,
            label: agent.name,
            kind: "workflow" as const,
            status: agent.status === "failed" ? "failed" as const : agent.status === "completed" ? "succeeded" as const : "fallback" as const,
            toolName: agent.toolActivity[0]?.tool ?? null,
            outputSummary: agent.reasoningSummary,
            evidenceIds: [],
            failureReason: agent.failureReason,
          })),
        }),
      });
    } catch (error) {
      this.logger.warn(`Investment committee mission ${missionId} stopped: ${safeFailure(error)}`);
    } finally {
      this.activeMissionIds.delete(missionId);
      const customerId = await this.resolveCustomerId(supabaseUserId).catch(() => null);
      const latest = customerId ? await this.getLatest(customerId, missionId).catch(() => null) : null;
      if (latest?.status === "queued" || this.pendingResumeActions.has(missionId)) {
        queueMicrotask(() => void this.schedule(supabaseUserId, missionId));
      }
    }
  }

  private async executeMission(supabaseUserId: string, missionId: string): Promise<InvestmentCommitteeMission> {
    const customerId = await this.resolveCustomerId(supabaseUserId);
    let mission = await this.getLatest(customerId, missionId);
    const resumeAction = this.pendingResumeActions.get(missionId);
    this.pendingResumeActions.delete(missionId);
    if (mission.status === "cancelled" && !resumeAction) return mission;

    const checkpointer = await this.getCheckpointer();
    const graph = this.buildGraph(checkpointer);
    const config = {
      configurable: { thread_id: `investment-committee:${customerId}:${missionId}`, checkpoint_ns: "" },
      recursionLimit: RECURSION_LIMIT,
    };

    try {
      const snapshot = await graph.getState(config);
      const hasCheckpoint = Boolean(snapshot.config?.configurable?.checkpoint_id);
      const interrupted = snapshot.tasks.some((task) => task.interrupts.length > 0);
      let result: CommitteeGraphState;
      if (interrupted && resumeAction) {
        result = await graph.invoke(new Command({ resume: { action: resumeAction, approved: resumeAction === "approve" } }), config);
      } else if (hasCheckpoint) {
        result = await graph.invoke(null, config);
      } else {
        result = await graph.invoke({
          supabaseUserId,
          customerId,
          missionId,
          mission,
          opportunityResearch: null,
          allocations: [],
          riskResearch: null,
          halalFindings: [],
          strategyPlan: null,
          copilotResult: null,
          externalAiUsed: false,
          providerUsage: [],
          fallbackReasons: [],
          approved: false,
          cancelled: false,
          failureReason: null,
        }, config);
      }

      mission = await this.getLatest(customerId, missionId);
      if (["paused", "awaiting_approval", "cancelled"].includes(mission.status)) return mission;
      if (result.failureReason) throw new Error(result.failureReason);
      return this.completeMission(result);
    } catch (error) {
      mission = await this.getLatest(customerId, missionId);
      if (["paused", "awaiting_approval", "cancelled"].includes(mission.status)) return mission;
      return this.failMission(customerId, supabaseUserId, mission, error);
    }
  }

  private buildGraph(checkpointer: PostgresSaver) {
    return new StateGraph(CommitteeState)
      .addNode("chief", (state) => this.runChiefNode(state))
      .addNode("opportunity", (state) => this.runOpportunityNode(state), { retryPolicy: { maxAttempts: RETRY_LIMIT + 1 } })
      .addNode("risk", (state) => this.runRiskNode(state), { retryPolicy: { maxAttempts: RETRY_LIMIT + 1 } })
      .addNode("halal", (state) => this.runHalalNode(state), { retryPolicy: { maxAttempts: RETRY_LIMIT + 1 } })
      .addNode("strategy", (state) => this.runStrategyNode(state))
      .addNode("approval", (state) => this.runApprovalNode(state))
      .addNode("synthesis", (state) => this.runSynthesisNode(state))
      .addNode("failure", (state) => ({ failureReason: state.failureReason ?? "committee_graph_missing_research_data" }))
      .addEdge(START, "chief")
      .addEdge("chief", "opportunity")
      .addConditionalEdges("opportunity", (state) => state.opportunityResearch?.opportunities.length ? "risk" : "failure", ["risk", "failure"])
      .addEdge("risk", "halal")
      .addEdge("halal", "strategy")
      .addConditionalEdges("strategy", (state) => this.llm.isAvailable(state.mission.externalAiConsent) ? "approval" : "synthesis", ["approval", "synthesis"])
      .addConditionalEdges("approval", (state) => state.cancelled ? END : "synthesis", ["synthesis", END])
      .addEdge("synthesis", END)
      .addEdge("failure", END)
      .compile({ checkpointer });
  }

  private async runChiefNode(state: CommitteeGraphState) {
    await this.ensureCanRun(state);
    let mission = await this.getLatest(state.customerId, state.missionId);
    const now = new Date().toISOString();
    mission.status = "running";
    mission.startedAt ??= now;
    mission.controlNote = "Chief Research Agent is routing a durable LangGraph across four read-only specialist nodes.";
    mission = this.updateAgent(mission, "chief-research-agent", {
      status: "running",
      startedAt: mission.agents[0]?.startedAt ?? now,
      reasoningSummary: "LangGraph decomposed the mandate into opportunity, risk, Shariah-evidence, and educational strategy nodes.",
      toolActivity: [{ tool: "langgraph-state-graph", status: "running", summary: "Routing bounded graph nodes with PostgreSQL checkpoints and conditional transitions." }],
    });
    await this.persist(state.customerId, state.supabaseUserId, mission);
    return { mission };
  }

  private async runOpportunityNode(state: CommitteeGraphState) {
    await this.ensureCanRun(state);
    await this.startAgent(state, "opportunity-agent", "opportunity_hunter_read_only");
    const tool = this.tools.opportunity(state.supabaseUserId, state.mission);
    const result = await this.runTimed(() => this.observatory.observeCustomer(state.supabaseUserId, {
      agentId: "opportunity-agent",
      workflow: "langgraph_opportunity_node",
      execute: () => this.llm.callTool<OpportunityHunterResponse>({
        consent: state.mission.externalAiConsent,
        agentLabel: "opportunity",
        tool,
        invoke: async (input) => await tool.invoke(input) as OpportunityHunterResponse,
      }),
      summarize: (execution) => ({
        mode: execution.externalAiUsed ? "hybrid" : "deterministic",
        fallbackReason: execution.fallbackReason,
        providerUsage: execution.providerUsage ?? undefined,
        steps: [{ id: "langgraph:opportunity", label: "Opportunity graph node and typed tool", kind: "tool" as const, status: execution.fallbackReason ? "fallback" as const : "succeeded" as const, toolName: tool.name, outputSummary: `${execution.value.opportunities.length} opportunities returned by the existing research service.`, evidenceIds: execution.value.opportunities.flatMap((item) => item.evidence.map((evidence) => evidence.id)).slice(0, 20), failureReason: null }],
      }),
    }));
    const summary = `${result.value.opportunities.length} opportunities analyzed; dataset reliability is ${result.value.dataset.reliability}.`;
    await this.finishAgent(state, "opportunity-agent", summary, result.fallbackReason);
    return {
      opportunityResearch: result.value,
      allocations: this.resolveAllocations(state.mission.input.allocations, result.value.opportunities),
      externalAiUsed: result.externalAiUsed || result.value.ai.externalAiUsed,
      providerUsage: providerUsage(result),
      fallbackReasons: result.fallbackReason ? [result.fallbackReason] : [],
    };
  }

  private async runRiskNode(state: CommitteeGraphState) {
    await this.ensureCanRun(state);
    await this.startAgent(state, "risk-agent", "portfolio_risk_lab_read_only");
    const tool = this.tools.portfolioRisk(state.mission, state.allocations);
    const result = await this.runTimed(() => this.observatory.observeCustomer(state.supabaseUserId, {
      agentId: "risk-agent",
      workflow: "langgraph_risk_node",
      execute: () => this.llm.callTool<PortfolioRiskAnalysis>({
        consent: state.mission.externalAiConsent,
        agentLabel: "independent risk",
        tool,
        invoke: async (input) => await tool.invoke(input) as PortfolioRiskAnalysis,
      }),
      summarize: (execution) => ({
        mode: execution.externalAiUsed ? "hybrid" : "deterministic",
        fallbackReason: execution.fallbackReason,
        providerUsage: execution.providerUsage ?? undefined,
        evidence: execution.value.evidence.map((item) => ({ evidenceId: item.id, sourceLabel: item.label, sourceType: item.sourceType, observedAt: item.observedAt, synthetic: item.synthetic, groundingDecision: "used" as const })),
        steps: [{ id: "langgraph:risk", label: "Risk graph node and typed tool", kind: "tool" as const, status: execution.fallbackReason ? "fallback" as const : "succeeded" as const, toolName: tool.name, outputSummary: `Risk ${execution.value.current.metrics.riskLabel}; health ${execution.value.current.guardian.healthLabel}.`, evidenceIds: execution.value.evidence.map((item) => item.id), failureReason: null }],
      }),
    }));
    const summary = `Independent risk review rates the portfolio ${result.value.current.metrics.riskLabel} risk with ${result.value.current.metrics.maximumAssetWeightPercent}% maximum concentration.`;
    await this.finishAgent(state, "risk-agent", summary, result.fallbackReason);
    return { riskResearch: result.value, externalAiUsed: result.externalAiUsed, providerUsage: providerUsage(result), fallbackReasons: result.fallbackReason ? [result.fallbackReason] : [] };
  }

  private async runHalalNode(state: CommitteeGraphState) {
    await this.ensureCanRun(state);
    if (!state.opportunityResearch) return { failureReason: "committee_missing_opportunity_research" };
    await this.startAgent(state, "halal-research-agent", "halal_evidence_screen_read_only");
    const tool = this.tools.halalResearch(state.opportunityResearch, state.allocations);
    const result = await this.runTimed(() => this.observatory.observeCustomer(state.supabaseUserId, {
      agentId: "halal-research-agent",
      workflow: "langgraph_halal_node",
      execute: () => this.llm.callTool<HalalFinding[]>({
        consent: state.mission.externalAiConsent,
        agentLabel: "Shariah evidence",
        tool,
        invoke: async (input) => await tool.invoke(input) as HalalFinding[],
      }),
      summarize: (execution) => ({
        mode: execution.externalAiUsed ? "hybrid" : "deterministic",
        fallbackReason: execution.fallbackReason,
        providerUsage: execution.providerUsage ?? undefined,
        steps: [{ id: "langgraph:halal", label: "Halal evidence graph node and typed tool", kind: "tool" as const, status: execution.fallbackReason ? "fallback" as const : "succeeded" as const, toolName: tool.name, outputSummary: `${execution.value.length} selected opportunities screened without producing a religious ruling.`, evidenceIds: execution.value.flatMap((item) => item.evidenceIds).slice(0, 20), failureReason: null }],
      }),
    }));
    const uncertain = result.value.filter((item) => item.status !== "eligible" || item.evidenceGaps.length > 0);
    await this.finishAgent(state, "halal-research-agent", `${uncertain.length} of ${result.value.length} selected opportunities require qualification, further evidence, or scholar review.`, result.fallbackReason);
    return { halalFindings: result.value, externalAiUsed: result.externalAiUsed, providerUsage: providerUsage(result), fallbackReasons: result.fallbackReason ? [result.fallbackReason] : [] };
  }

  private async runStrategyNode(state: CommitteeGraphState) {
    await this.ensureCanRun(state);
    if (!state.riskResearch) return { failureReason: "committee_missing_risk_research" };
    await this.startAgent(state, "strategy-agent", "research_plan_studio_read_only");
    const tool = this.tools.strategy(state.supabaseUserId, state.mission, state.allocations);
    const result = await this.runTimed(() => this.observatory.observeCustomer(state.supabaseUserId, {
      agentId: "strategy-agent",
      workflow: "langgraph_strategy_node",
      execute: () => this.llm.callTool<InvestmentResearchPlan>({
        consent: state.mission.externalAiConsent,
        agentLabel: "educational strategy",
        tool,
        invoke: async (input) => await tool.invoke(input) as InvestmentResearchPlan,
      }),
      summarize: (execution) => ({
        mode: execution.externalAiUsed || execution.value.strategy.externalAiUsed ? "hybrid" : "deterministic",
        fallbackReason: execution.fallbackReason,
        providerUsage: execution.providerUsage ?? undefined,
        steps: [{ id: "langgraph:strategy", label: "Strategy graph node and typed tool", kind: "tool" as const, status: execution.fallbackReason ? "fallback" as const : "succeeded" as const, toolName: tool.name, outputSummary: `Plan ${execution.value.id} created with ${execution.value.scenarios.length} deterministic scenarios.`, evidenceIds: execution.value.halalAnalysis.evidence.map((item) => item.evidenceId), failureReason: null }],
      }),
    }));
    await this.finishAgent(state, "strategy-agent", `Educational plan ${result.value.id} prepared across ${result.value.scenarios.length} scenarios; ${result.value.portfolioAnalysis.riskToleranceAlignment}`, result.fallbackReason);
    return { strategyPlan: result.value, externalAiUsed: result.externalAiUsed || result.value.strategy.externalAiUsed, providerUsage: providerUsage(result), fallbackReasons: result.fallbackReason ? [result.fallbackReason] : [] };
  }

  private async runApprovalNode(state: CommitteeGraphState) {
    let mission = await this.getLatest(state.customerId, state.missionId);
    const cancelledBeforeResume = mission.status === "cancelled";
    if (!cancelledBeforeResume) {
      mission.status = "awaiting_approval";
      mission.controlNote = "LangGraph paused before external-AI-assisted consolidation and is awaiting explicit human approval.";
      await this.persist(state.customerId, state.supabaseUserId, mission);
    }
    const decision = interrupt<{ kind: "committee_approval"; missionId: string }, { action: ResumeAction; approved: boolean }>({ kind: "committee_approval", missionId: state.missionId });
    if (cancelledBeforeResume || !decision.approved || decision.action === "cancel") {
      mission = await this.getLatest(state.customerId, state.missionId);
      mission.status = "cancelled";
      mission.completedAt = new Date().toISOString();
      mission.controlNote = "Human approval was not granted; the graph ended without consolidation or financial action.";
      await this.persist(state.customerId, state.supabaseUserId, mission);
      return { cancelled: true };
    }
    mission = await this.getLatest(state.customerId, state.missionId);
    mission.status = "running";
    mission.controlNote = "Human approval recorded; LangGraph resumed from its PostgreSQL checkpoint.";
    await this.persist(state.customerId, state.supabaseUserId, mission);
    return { approved: true };
  }

  private async runSynthesisNode(state: CommitteeGraphState) {
    await this.ensureCanRun(state);
    if (!state.opportunityResearch || !state.riskResearch || !state.strategyPlan) return { failureReason: "committee_graph_incomplete_before_synthesis" };
    const tool = this.tools.synthesis(state.supabaseUserId, state.mission, state.allocations);
    const synthesis = await this.runTimed(() => this.llm.callTool<CopilotResult>({
      consent: state.mission.externalAiConsent,
      agentLabel: "chief synthesis",
      tool,
      invoke: async (input) => await tool.invoke(input) as CopilotResult,
    }));
    const findings = this.buildFindings(state.opportunityResearch, state.riskResearch, state.halalFindings, state.strategyPlan.id);
    const ids = findings.map((_, index) => `finding-${index + 1}`);
    const ranking = await this.llm.rankFindings({
      consent: state.mission.externalAiConsent,
      findings: findings.map((finding, index) => ({ id: ids[index], category: finding.category, evidenceStatus: finding.evidenceStatus })),
    });
    const byId = new Map(ids.map((id, index) => [id, findings[index]]));
    const rankedFindings = ranking.value.flatMap((id) => byId.get(id) ?? []);
    return {
      copilotResult: synthesis.value,
      externalAiUsed: synthesis.externalAiUsed || ranking.externalAiUsed || synthesis.value.message.mode === "ai_prioritized",
      providerUsage: [...providerUsage(synthesis), ...providerUsage(ranking)],
      fallbackReasons: [synthesis.fallbackReason, ranking.fallbackReason].filter((item): item is string => Boolean(item)),
      mission: {
        ...state.mission,
        report: {
          title: `Investment committee research · ${state.mission.goal.slice(0, 80)}`,
          executiveSummary: [
            `${state.opportunityResearch.opportunities.length} opportunities were evaluated against ${state.opportunityResearch.dataset.reliability} evidence.`,
            `Independent risk review classified the scenario as ${state.riskResearch.current.metrics.riskLabel} risk with ${state.riskResearch.current.guardian.healthLabel} stress resilience.`,
            `${state.halalFindings.filter((item) => item.status !== "eligible" || item.evidenceGaps.length > 0).length} selected opportunities retain Shariah-evidence qualifications or gaps.`,
            synthesis.value.message.content,
          ],
          findings: rankedFindings,
          assumptions: [...new Set([
            "Portfolio weights are educational scenario inputs and do not trigger rebalancing.",
            "Stress scenarios are hypothetical rather than forecasts.",
            ...(state.opportunityResearch.dataset.kind === "synthetic_research" ? ["Live market evidence was unavailable; opportunity inputs are explicitly synthetic."] : []),
            ...state.strategyPlan.strategy.assumptions.slice(0, 6),
          ])],
          disagreements: this.buildDisagreements(state.opportunityResearch, state.riskResearch, state.halalFindings),
          researchPlanId: state.strategyPlan.id,
          copilotConversationId: synthesis.value.conversation.id,
          evidenceAsOf: state.opportunityResearch.dataset.asOf,
          executionMode: "deterministic_only",
          limitations: [
            state.opportunityResearch.dataset.disclaimer,
            state.riskResearch.dataQuality.note,
            "Preliminary Shariah screening is evidence triage, not religious certification.",
            "Pause and approval use durable LangGraph interrupts; cancellation is checked at every graph node boundary.",
          ],
          disclaimer: DISCLAIMER,
        },
      },
    };
  }

  private async completeMission(state: CommitteeGraphState): Promise<InvestmentCommitteeMission> {
    let mission = await this.getLatest(state.customerId, state.missionId);
    if (!state.mission.report) throw new Error("committee_graph_missing_report");
    const completedAt = new Date().toISOString();
    const externalAiUsed = state.externalAiUsed;
    mission.status = "completed";
    mission.completedAt = completedAt;
    mission.executionMode = externalAiUsed ? "hybrid_ai_evidence_ranking" : "deterministic_only";
    mission.controlNote = externalAiUsed
      ? "LangGraph completed with consented external model tool calls and structured finding ranking."
      : `LangGraph completed with explicitly labeled deterministic fallback${state.fallbackReasons.length ? ` (${[...new Set(state.fallbackReasons)].join(", ")})` : ""}.`;
    mission.report = { ...state.mission.report, executionMode: mission.executionMode };
    mission = this.updateAgent(mission, "chief-research-agent", {
      status: "completed",
      completedAt,
      durationMs: mission.startedAt ? Date.now() - Date.parse(mission.startedAt) : null,
      reasoningSummary: `Consolidated ${mission.report.findings.length} graph findings and ${mission.report.disagreements.length} explicit disagreements without issuing an investment instruction.`,
      toolActivity: [{ tool: "langgraph-state-graph", status: "completed", summary: `Graph completed with Neon PostgreSQL checkpoints. ${externalAiUsed ? "Provider tool calls were used." : "Deterministic fallback was used and labeled."}` }],
    });
    await this.persist(state.customerId, state.supabaseUserId, mission);

    if (state.providerUsage.length) {
      await this.observatory.observeCustomer(state.supabaseUserId, {
        agentId: "chief-research-agent",
        workflow: "langgraph_provider_usage_rollup",
        execute: async () => mission,
        summarize: () => ({
          mode: externalAiUsed ? "hybrid" : "deterministic",
          providerUsage: aggregateUsage(state.providerUsage),
          steps: [{ id: "langgraph:provider-rollup", label: "Aggregate provider-reported graph usage", kind: "workflow" as const, status: "succeeded" as const, toolName: null, outputSummary: `${state.providerUsage.length} provider response usage record(s) aggregated.`, evidenceIds: [], failureReason: null }],
        }),
      });
    }
    return mission;
  }

  private async ensureCanRun(state: CommitteeGraphState): Promise<void> {
    let mission = await this.getLatest(state.customerId, state.missionId);
    const cancelledBeforeResume = mission.status === "cancelled";
    if (mission.status !== "paused" && !cancelledBeforeResume) return;
    const decision = interrupt<{ kind: "committee_pause"; missionId: string }, { action: ResumeAction; approved: boolean }>({ kind: "committee_pause", missionId: state.missionId });
    if (cancelledBeforeResume || decision.action === "cancel") throw new Error("committee_mission_cancelled");
    mission = await this.getLatest(state.customerId, state.missionId);
    mission.status = "running";
    mission.controlNote = "LangGraph consumed the resume command and continued from its durable checkpoint.";
    mission.agents = mission.agents.map((agent) => agent.status === "paused" ? { ...agent, status: "pending" } : agent);
    await this.persist(state.customerId, state.supabaseUserId, mission);
  }

  private async startAgent(state: CommitteeGraphState, agentId: InvestmentCommitteeAgentId, toolName: string): Promise<void> {
    const latest = await this.getLatest(state.customerId, state.missionId);
    const started = this.updateAgent(latest, agentId, {
      status: "running",
      startedAt: new Date().toISOString(),
      completedAt: null,
      reasoningSummary: "Executing a real LangGraph node with a validated, read-only LangChain tool.",
      toolActivity: [{ tool: toolName, status: "running", summary: `Invoking ${toolName} within the graph node timeout.` }],
      failureReason: null,
    });
    await this.persist(state.customerId, state.supabaseUserId, started);
  }

  private async finishAgent(state: CommitteeGraphState, agentId: InvestmentCommitteeAgentId, summary: string, fallbackReason: string | null): Promise<void> {
    const latest = await this.getLatest(state.customerId, state.missionId);
    const current = latest.agents.find((agent) => agent.id === agentId);
    const completedAt = new Date().toISOString();
    const labeledSummary = fallbackReason ? `${summary} Deterministic fallback: ${fallbackReason}.` : summary;
    const updated = this.updateAgent(latest, agentId, {
      status: "completed",
      completedAt,
      durationMs: current?.startedAt ? Date.now() - Date.parse(current.startedAt) : null,
      reasoningSummary: labeledSummary,
      toolActivity: (current?.toolActivity ?? []).map((activity) => ({ ...activity, status: "completed" as const, summary: labeledSummary })),
      failureReason: null,
    });
    await this.persist(state.customerId, state.supabaseUserId, updated);
  }

  private updateAgent(mission: InvestmentCommitteeMission, agentId: InvestmentCommitteeAgentId, patch: Partial<InvestmentCommitteeAgentState>): InvestmentCommitteeMission {
    return { ...mission, agents: mission.agents.map((agent) => agent.id === agentId ? { ...agent, ...patch } : agent) };
  }

  private async runTimed<T>(execute: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("committee_graph_node_timeout")), this.perAgentTimeoutMs);
      execute().then(
        (result) => { clearTimeout(timeout); resolve(result); },
        (error) => { clearTimeout(timeout); reject(error); },
      );
    });
  }

  private resolveAllocations(requested: InvestmentCommitteeMissionInput["allocations"], opportunities: Opportunity[]): Allocation[] {
    if (requested?.length) return requested;
    const selected = [...opportunities].sort((left, right) => right.score - left.score).slice(0, 3);
    if (selected.length === 0) throw new BadRequestException("No research opportunities are available.");
    const base = Math.floor(100 / selected.length);
    return selected.map((item, index) => ({ opportunityId: item.id, percent: index === 0 ? 100 - base * (selected.length - 1) : base }));
  }

  private buildFindings(research: OpportunityHunterResponse, risk: PortfolioRiskAnalysis, halal: HalalFinding[], planId: string): InvestmentCommitteeFinding[] {
    return [
      ...research.opportunities.slice(0, 3).map((item) => ({
        agentId: "opportunity-agent" as const,
        category: "opportunity" as const,
        title: `${item.name} opportunity evidence`,
        summary: `${item.thesis} Deterministic score ${item.score}/100; ${item.riskLevel} risk.`,
        evidenceIds: item.evidence.map((evidence) => evidence.id),
        evidenceStatus: item.synthetic ? "synthetic" as const : "verified" as const,
      })),
      { agentId: "risk-agent", category: "risk", title: "Independent portfolio risk review", summary: `${risk.current.metrics.riskLabel} weighted risk; ${risk.current.metrics.maximumAssetWeightPercent}% maximum asset exposure; ${risk.current.guardian.healthLabel} stress health.`, evidenceIds: risk.evidence.map((item) => item.id), evidenceStatus: risk.dataQuality.datasetKind === "live_market" ? "verified" : "synthetic" },
      ...halal.map((item) => ({ agentId: "halal-research-agent" as const, category: "halal" as const, title: `${item.name} preliminary Shariah screen`, summary: `${item.status.replace(/_/gu, " ")}. ${item.rationale.join(" ")} ${item.evidenceGaps.length ? `Evidence gaps: ${item.evidenceGaps.join("; ")}.` : "No recorded evidence gap."}`, evidenceIds: item.evidenceIds, evidenceStatus: item.evidenceGaps.length ? "mixed" as const : "verified" as const })),
      { agentId: "strategy-agent", category: "strategy", title: "Educational research plan", summary: `Research Plan Studio persisted plan ${planId} with assumptions, scenarios, monitoring signals, and reassessment conditions.`, evidenceIds: [], evidenceStatus: "assumption" },
    ];
  }

  private buildDisagreements(research: OpportunityHunterResponse, risk: PortfolioRiskAnalysis, halal: HalalFinding[]): InvestmentCommitteeDisagreement[] {
    const disagreements: InvestmentCommitteeDisagreement[] = [];
    const top = research.opportunities[0];
    if (top && top.score >= 70 && (risk.current.metrics.riskLabel === "higher" || risk.current.guardian.healthLabel === "vulnerable")) {
      disagreements.push({ topic: `${top.name} attractiveness versus portfolio risk`, agentIds: ["opportunity-agent", "risk-agent"], positions: [`Opportunity Agent identifies a ${top.score}/100 evidence score.`, `Risk Agent reports ${risk.current.metrics.riskLabel} risk and ${risk.current.guardian.healthLabel} stress health.`], resolution: "Retain both findings. A high research score does not override portfolio-level risk or authorize allocation." });
    }
    for (const item of halal.filter((candidate) => candidate.status !== "eligible" || candidate.evidenceGaps.length > 0)) {
      disagreements.push({ topic: `${item.name} market evidence versus Shariah uncertainty`, agentIds: ["opportunity-agent", "halal-research-agent"], positions: ["Opportunity evidence may justify deeper financial research.", `Halal Research Agent records ${item.status.replace(/_/gu, " ")} status${item.evidenceGaps.length ? " with unresolved evidence gaps" : ""}.`], resolution: "Do not infer permissibility from market quality. Preserve the uncertainty and seek qualified independent review." });
    }
    return disagreements.slice(0, 8);
  }

  private validateAllocations(allocations: InvestmentCommitteeMissionInput["allocations"]): void {
    if (!allocations?.length) return;
    if (new Set(allocations.map((item) => item.opportunityId)).size !== allocations.length) throw new BadRequestException("Each opportunity may appear only once.");
    const total = allocations.reduce((sum, item) => sum + item.percent, 0);
    if (Math.abs(total - 100) > 0.01) throw new BadRequestException("Mission allocations must total 100%.");
  }

  private async failMission(customerId: string, supabaseUserId: string, mission: InvestmentCommitteeMission, error: unknown): Promise<InvestmentCommitteeMission> {
    const completedAt = new Date().toISOString();
    mission.status = "failed";
    mission.completedAt = completedAt;
    mission.failureReason = safeFailure(error);
    mission.controlNote = "The LangGraph run failed safely after bounded retries. No transaction capability was available.";
    mission.agents = mission.agents.map((agent) => agent.status === "running" || agent.status === "paused" ? { ...agent, status: "failed", completedAt, durationMs: agent.startedAt ? Date.now() - Date.parse(agent.startedAt) : null, failureReason: safeFailure(error), toolActivity: agent.toolActivity.map((activity) => ({ ...activity, status: "failed" as const })) } : agent);
    mission = this.updateAgent(mission, "chief-research-agent", {
      status: "failed",
      completedAt,
      durationMs: mission.startedAt ? Date.now() - Date.parse(mission.startedAt) : null,
      reasoningSummary: "A graph node failed after its bounded retry policy; execution stopped without financial action.",
      failureReason: safeFailure(error),
      toolActivity: [{ tool: "langgraph-state-graph", status: "failed", summary: "Stopped at a durable checkpoint after bounded retry exhaustion." }],
    });
    await this.persist(customerId, supabaseUserId, mission);
    return mission;
  }

  private async getCheckpointer(): Promise<PostgresSaver> {
    if (!this.checkpointerPromise) {
      this.checkpointerPromise = (async () => {
        const connectionString = process.env.DATABASE_URL?.trim();
        if (!connectionString) throw new Error("committee_checkpoint_database_unconfigured");
        const saver = PostgresSaver.fromConnString(connectionString, { schema: CHECKPOINT_SCHEMA });
        await saver.setup();
        return saver;
      })().catch((error) => { this.checkpointerPromise = null; throw error; });
    }
    return this.checkpointerPromise;
  }

  private async persist(customerId: string, actorId: string, mission: InvestmentCommitteeMission): Promise<void> {
    mission.updatedAt = new Date().toISOString();
    await this.prisma.auditEvent.create({ data: { customerId, actorType: "customer", actorId, action: SNAPSHOT_ACTION, targetType: SNAPSHOT_TARGET, targetId: mission.id, metadata: { mission } as unknown as Prisma.InputJsonValue } });
  }

  private async listLatest(customerId: string): Promise<InvestmentCommitteeMission[]> {
    const events = await this.prisma.auditEvent.findMany({ where: { customerId, action: SNAPSHOT_ACTION, targetType: SNAPSHOT_TARGET }, orderBy: { createdAt: "desc" }, take: 300 });
    const seen = new Set<string>();
    return events.flatMap((event) => {
      if (!event.targetId || seen.has(event.targetId)) return [];
      const mission = missionFromMetadata(event.metadata);
      if (!mission) return [];
      seen.add(event.targetId);
      return [mission];
    }).slice(0, 50);
  }

  private async getLatest(customerId: string, missionId: string): Promise<InvestmentCommitteeMission> {
    const event = await this.prisma.auditEvent.findFirst({ where: { customerId, action: SNAPSHOT_ACTION, targetType: SNAPSHOT_TARGET, targetId: missionId }, orderBy: { createdAt: "desc" } });
    const mission = event ? missionFromMetadata(event.metadata) : null;
    if (!mission) throw new NotFoundException("Investment committee mission not found.");
    return mission;
  }

  private async resolveCustomerId(supabaseUserId: string): Promise<string> {
    const customer = await this.prisma.customer.findUnique({ where: { supabaseUserId }, select: { id: true } });
    if (!customer) throw new NotFoundException("Customer profile not found.");
    return customer.id;
  }
}
