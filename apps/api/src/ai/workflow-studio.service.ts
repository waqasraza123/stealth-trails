import { randomUUID } from "node:crypto";
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import { PrismaService } from "../prisma/prisma.service";
import { NotificationsService } from "../notifications/notifications.service";
import { AgentObservatoryService } from "./agent-observatory.service";
import { CopilotService } from "./copilot.service";
import { DocumentIntelligenceService } from "./document-intelligence.service";
import type { CreateWorkflowDto, UpdateWorkflowDto } from "./dto/workflow-studio.dto";
import { InvestmentCommitteeService } from "./investment-committee.service";
import { OpportunityHunterService } from "./opportunity-hunter.service";
import type { OpportunityHunterResponse } from "./opportunity-hunter.types";
import { PortfolioRiskService } from "./portfolio-risk.service";
import { WealthBriefRateLimitService } from "./wealth-brief-rate-limit.service";
import type {
  WorkflowApprovalNode,
  WorkflowConditionNode,
  WorkflowDefinition,
  WorkflowNode,
  WorkflowRun,
  WorkflowRunStatus,
  WorkflowRunStep,
  WorkflowStarter,
  WorkflowStudioDashboard,
  WorkflowSummary,
  WorkflowToolNode,
  WorkflowToolType,
  WorkflowTriggerType,
  WorkflowWorkerSweepResult,
} from "./workflow-studio.types";
import { FinancialMemoryService } from "./financial-memory.service";

type JsonObject = Record<string, unknown>;

type WorkflowRow = {
  id: string;
  customerId: string;
  name: string;
  description: string | null;
  enabled: boolean;
  externalAiConsent: boolean;
  definition: unknown;
  triggerType: string;
  intervalMinutes: number | null;
  nextRunAt: Date | null;
  lastDataChangeAt: Date | null;
  maxConcurrentRuns: number;
  timeoutSeconds: number;
  retryLimit: number;
  revision: number;
  createdAt: Date;
  updatedAt: Date;
};

type RunRow = {
  id: string;
  workflowId: string;
  workflowName: string;
  customerId: string;
  supabaseUserId: string;
  workflowRevision: number;
  definitionSnapshot: unknown;
  externalAiConsent: boolean;
  timeoutSeconds: number;
  triggerType: string;
  triggerKey: string;
  status: string;
  currentNodeId: string | null;
  input: unknown;
  output: unknown;
  errorCode: string | null;
  errorMessage: string | null;
  attempt: number;
  maxAttempts: number;
  claimedByWorkerId: string | null;
  approvalRequestedAt: Date | null;
  approvalPrompt: string | null;
  approvedAt: Date | null;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type StepRow = {
  id: string;
  nodeId: string;
  nodeType: string;
  status: string;
  attempt: number;
  input: unknown;
  output: unknown;
  errorCode: string | null;
  errorMessage: string | null;
  durationMs: number | null;
  startedAt: Date;
  completedAt: Date | null;
};

type ExecutionStateValue = {
  run: RunRow;
  definition: WorkflowDefinition;
  currentNodeId: string;
  outputs: JsonObject;
  status: "running" | "awaiting_approval" | "succeeded";
};

const ExecutionState = Annotation.Root({
  value: Annotation<ExecutionStateValue>(),
});

const ALLOWED_TOOLS = new Set<WorkflowToolType>([
  "opportunity_hunter",
  "portfolio_risk",
  "halal_research",
  "document_intelligence",
  "financial_copilot",
  "investment_committee",
]);

const MAX_NODES = 20;
const MAX_GRAPH_STEPS = 40;

const STARTERS: WorkflowStarter[] = [
  {
    id: "portfolio-risk-review",
    name: "Periodic portfolio risk review",
    description:
      "Reviews the current evidence-backed research basket, runs deterministic portfolio stress analysis, and pauses for review when the health label is vulnerable.",
    triggerType: "schedule",
    intervalMinutes: 10_080,
    externalAiConsent: false,
    definition: {
      version: 1,
      entryNodeId: "opportunities",
      nodes: [
        { id: "opportunities", type: "tool", tool: "opportunity_hunter", name: "Refresh evidence", config: {}, next: "risk" },
        { id: "risk", type: "tool", tool: "portfolio_risk", name: "Run portfolio risk lab", config: { portfolioValueUsd: 10_000, allocationMode: "top_equal_weight", allocationCount: 3 }, next: "risk-gate" },
        { id: "risk-gate", type: "condition", name: "Check vulnerable risk threshold", sourceNodeId: "risk", path: "current.guardian.healthLabel", operator: "eq", value: "vulnerable", ifTrue: "approval", ifFalse: "summary" },
        { id: "approval", type: "approval", name: "Review elevated risk", prompt: "Portfolio Risk Lab reported a vulnerable health label. Review the evidence before the workflow continues.", next: "summary" },
        { id: "summary", type: "tool", tool: "financial_copilot", name: "Summarize findings", config: { message: "Summarize the latest workflow risk findings as educational research, preserving data freshness and uncertainty." }, next: "end" },
      ],
    },
  },
  {
    id: "investment-research",
    name: "Investment research with screening review",
    description:
      "Runs Opportunity Hunter and Halal Research, routes evidence gaps to approval, then delegates deeper synthesis to the existing Investment Committee orchestration.",
    triggerType: "manual",
    intervalMinutes: null,
    externalAiConsent: false,
    definition: {
      version: 1,
      entryNodeId: "opportunities",
      nodes: [
        { id: "opportunities", type: "tool", tool: "opportunity_hunter", name: "Discover opportunities", config: {}, next: "halal" },
        { id: "halal", type: "tool", tool: "halal_research", name: "Review screening evidence", config: { selectionCount: 3 }, next: "evidence-gate" },
        { id: "evidence-gate", type: "condition", name: "Check evidence availability", sourceNodeId: "halal", path: "summary.requiresReview", operator: "eq", value: true, ifTrue: "approval", ifFalse: "committee" },
        { id: "approval", type: "approval", name: "Approve deeper research", prompt: "Screening evidence is incomplete or requires review. Approve only if you want the read-only committee to continue researching.", next: "committee" },
        { id: "committee", type: "tool", tool: "investment_committee", name: "Delegate to Investment Committee", config: { goal: "Research the strongest evidence-backed opportunities while preserving risk and Shariah-screening uncertainty.", portfolioValueUsd: 10_000, horizonMonths: 36, riskTolerance: "balanced", ethicalPreferences: ["preliminary halal screening"] }, next: "end" },
      ],
    },
  },
  {
    id: "document-analysis",
    name: "Analyze newly prepared financial documents",
    description:
      "Runs cited Document Intelligence when a customer-owned document becomes ready. Requires an available embedding provider and explicit external-AI consent.",
    triggerType: "data_change",
    intervalMinutes: null,
    externalAiConsent: true,
    definition: {
      version: 1,
      entryNodeId: "document-intelligence",
      dataChangeSource: "financial_document_ready",
      nodes: [
        { id: "document-intelligence", type: "tool", tool: "document_intelligence", name: "Extract document intelligence", config: { operation: "intelligence" }, next: "approval" },
        { id: "approval", type: "approval", name: "Review extracted evidence", prompt: "Review the cited document findings before requesting a Copilot synthesis.", next: "summary" },
        { id: "summary", type: "tool", tool: "financial_copilot", name: "Summarize document evidence", config: { message: "Summarize the authorized document findings and explicitly identify missing evidence.", searchDocuments: true }, next: "end" },
      ],
    },
  },
];

function json(value: unknown): string {
  return JSON.stringify(value ?? null);
}

function object(value: unknown): JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as JsonObject)
    : {};
}

function safeErrorCode(error: unknown): string {
  if (!(error instanceof Error)) return "unknown_workflow_failure";
  const code = error.name.replace(/[^a-z0-9]+/giu, "_").toLowerCase();
  return code || "workflow_execution_failure";
}

function safeErrorMessage(error: unknown): string {
  if (!(error instanceof Error)) return "The workflow failed for an unknown reason.";
  return error.message.replace(/(?:sk-|Bearer\s+)[A-Za-z0-9._-]+/gu, "[redacted]").slice(0, 500);
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      timer = setTimeout(() => reject(new Error("workflow_node_timeout")), timeoutMs);
    }),
  ]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

function workflowProjection(row: WorkflowRow): WorkflowSummary {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    enabled: row.enabled,
    externalAiConsent: row.externalAiConsent,
    definition: row.definition as WorkflowDefinition,
    triggerType: row.triggerType as WorkflowTriggerType,
    intervalMinutes: row.intervalMinutes,
    nextRunAt: row.nextRunAt?.toISOString() ?? null,
    maxConcurrentRuns: row.maxConcurrentRuns,
    timeoutSeconds: row.timeoutSeconds,
    retryLimit: row.retryLimit,
    revision: row.revision,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function stepProjection(row: StepRow): WorkflowRunStep {
  return {
    ...row,
    startedAt: row.startedAt.toISOString(),
    completedAt: row.completedAt?.toISOString() ?? null,
  };
}

@Injectable()
export class WorkflowStudioService {
  private readonly logger = new Logger(WorkflowStudioService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly opportunities: OpportunityHunterService,
    private readonly risk: PortfolioRiskService,
    private readonly documents: DocumentIntelligenceService,
    private readonly copilot: CopilotService,
    private readonly committee: InvestmentCommitteeService,
    private readonly rateLimit: WealthBriefRateLimitService,
    private readonly observatory: AgentObservatoryService,
    private readonly notifications: NotificationsService,
    private readonly memory: FinancialMemoryService,
  ) {}

  async dashboard(supabaseUserId: string): Promise<WorkflowStudioDashboard> {
    const customerId = await this.customerId(supabaseUserId);
    const workflows = await this.listRows(customerId);
    const documentCapabilities = this.documents.capabilities();
    const opportunityCapabilities = this.opportunities.getAnalystCapabilities();
    return {
      workflows: workflows.map(workflowProjection),
      recentRuns: await this.listRunsForCustomer(customerId, 50),
      starters: STARTERS,
      supportedTriggers: [
        { type: "manual", available: true, detail: "Queues one idempotent worker run on explicit customer request." },
        { type: "schedule", available: true, detail: "Fixed intervals from 15 minutes to 30 days are evaluated by the existing worker tick." },
        { type: "data_change", available: true, detail: "Verified financial_document_ready changes are read from customer-owned PostgreSQL document state." },
      ],
      availableTools: [
        { type: "opportunity_hunter", name: "Opportunity Hunter", available: true, availability: opportunityCapabilities.available ? "Deterministic research and the configured opt-in analyst are available." : "Deterministic research is available; the external analyst is unavailable and will not be simulated.", boundary: "Evidence-bound market research; unavailable providers are labeled and deterministic fallback remains explicit." },
        { type: "portfolio_risk", name: "Portfolio Risk Lab", available: true, availability: "Deterministic engine available.", boundary: "Deterministic educational risk and stress analysis only." },
        { type: "halal_research", name: "Halal Research", available: true, availability: "Deterministic screening evidence is available after Opportunity Hunter.", boundary: "Preliminary screening evidence only; never a religious ruling." },
        { type: "document_intelligence", name: "Document Intelligence", available: documentCapabilities.semanticRagAvailable, availability: documentCapabilities.semanticRagAvailable ? "Configured semantic retrieval is available with explicit consent." : "Semantic retrieval is unavailable; document workflow nodes will report the missing provider instead of inventing results.", boundary: "Customer-owned documents with cited retrieval; provider and consent requirements are enforced." },
        { type: "financial_copilot", name: "Financial Copilot", available: true, availability: "Deterministic cited synthesis is available; external prioritization remains runtime-gated.", boundary: "Read-only grounded synthesis; provider fallback is reported." },
        { type: "investment_committee", name: "Investment Committee", available: true, availability: "Existing checkpointed committee orchestration is available with deterministic fallback.", boundary: "Delegates to the existing checkpointed LangGraph mission rather than duplicating its orchestration." },
      ],
      executionBoundary:
        "Workflow nodes are allow-listed, read-only research operations. Payments, trades, withdrawals, signing, broadcasting, and blockchain transactions are not available to this runtime.",
    };
  }

  async create(supabaseUserId: string, input: CreateWorkflowDto): Promise<WorkflowSummary> {
    const customerId = await this.customerId(supabaseUserId);
    const definition = this.validateDefinition(input.definition, input.triggerType);
    this.validateTrigger(input.triggerType, input.intervalMinutes, definition);
    const now = new Date();
    const nextRunAt = input.enabled && input.triggerType === "schedule" ? now : null;
    const rows = await this.prisma.$queryRaw<WorkflowRow[]>(Prisma.sql`
      INSERT INTO "AiWorkflow" (
        "id", "customerId", "name", "description", "enabled", "externalAiConsent",
        "definition", "triggerType", "intervalMinutes", "nextRunAt", "lastDataChangeAt",
        "maxConcurrentRuns", "timeoutSeconds", "retryLimit", "revision", "createdAt", "updatedAt"
      ) VALUES (
        ${randomUUID()}, ${customerId}, ${input.name.trim()}, ${input.description?.trim() || null},
        ${input.enabled}, ${input.externalAiConsent}, ${json(definition)}::jsonb, ${input.triggerType},
        ${input.triggerType === "schedule" ? input.intervalMinutes ?? null : null}, ${nextRunAt},
        ${input.triggerType === "data_change" ? now : null}, ${input.maxConcurrentRuns ?? 1},
        ${input.timeoutSeconds ?? 30}, ${input.retryLimit ?? 2}, 1, NOW(), NOW()
      ) RETURNING *
    `);
    await this.audit(customerId, supabaseUserId, "ai_workflow.created", rows[0].id, {
      note: `Workflow “${rows[0].name}” was created.`,
    });
    return workflowProjection(rows[0]);
  }

  async createStarter(
    supabaseUserId: string,
    starterId: WorkflowStarter["id"],
    name?: string,
  ): Promise<WorkflowSummary> {
    const starter = STARTERS.find((item) => item.id === starterId);
    if (!starter) throw new NotFoundException("Workflow starter not found.");
    return this.create(supabaseUserId, {
      name: name?.trim() || starter.name,
      description: starter.description,
      enabled: false,
      externalAiConsent: starter.externalAiConsent,
      triggerType: starter.triggerType,
      intervalMinutes: starter.intervalMinutes ?? undefined,
      maxConcurrentRuns: 1,
      timeoutSeconds: 30,
      retryLimit: 2,
      definition: starter.definition,
    });
  }

  async update(
    supabaseUserId: string,
    workflowId: string,
    input: UpdateWorkflowDto,
  ): Promise<WorkflowSummary> {
    const customerId = await this.customerId(supabaseUserId);
    const existing = await this.ownedWorkflow(customerId, workflowId);
    const definition = this.validateDefinition(input.definition, input.triggerType);
    this.validateTrigger(input.triggerType, input.intervalMinutes, definition);
    if (await this.hasActiveRuns(workflowId)) {
      throw new ConflictException("Wait for active workflow runs to finish or cancel them before editing the definition.");
    }
    const nextRunAt = input.enabled && input.triggerType === "schedule"
      ? existing.nextRunAt ?? new Date()
      : null;
    const rows = await this.prisma.$queryRaw<WorkflowRow[]>(Prisma.sql`
      UPDATE "AiWorkflow" SET
        "name" = ${input.name.trim()}, "description" = ${input.description?.trim() || null},
        "enabled" = ${input.enabled}, "externalAiConsent" = ${input.externalAiConsent},
        "definition" = ${json(definition)}::jsonb, "triggerType" = ${input.triggerType},
        "intervalMinutes" = ${input.triggerType === "schedule" ? input.intervalMinutes ?? null : null},
        "nextRunAt" = ${nextRunAt},
        "lastDataChangeAt" = CASE WHEN ${input.triggerType} = 'data_change' AND "triggerType" <> 'data_change' THEN NOW() ELSE "lastDataChangeAt" END,
        "maxConcurrentRuns" = ${input.maxConcurrentRuns ?? 1},
        "timeoutSeconds" = ${input.timeoutSeconds ?? 30}, "retryLimit" = ${input.retryLimit ?? 2},
        "revision" = "revision" + 1, "updatedAt" = NOW()
      WHERE "id" = ${workflowId} AND "customerId" = ${customerId} AND "deletedAt" IS NULL
      RETURNING *
    `);
    await this.audit(customerId, supabaseUserId, "ai_workflow.updated", workflowId, {
      note: `Workflow “${rows[0].name}” was updated to revision ${rows[0].revision}.`,
    });
    return workflowProjection(rows[0]);
  }

  async setEnabled(supabaseUserId: string, workflowId: string, enabled: boolean): Promise<WorkflowSummary> {
    const customerId = await this.customerId(supabaseUserId);
    const workflow = await this.ownedWorkflow(customerId, workflowId);
    const rows = await this.prisma.$queryRaw<WorkflowRow[]>(Prisma.sql`
      UPDATE "AiWorkflow" SET "enabled" = ${enabled},
        "nextRunAt" = CASE WHEN ${enabled} AND "triggerType" = 'schedule' THEN COALESCE("nextRunAt", NOW()) ELSE NULL END,
        "lastDataChangeAt" = CASE WHEN ${enabled} AND "triggerType" = 'data_change' THEN NOW() ELSE "lastDataChangeAt" END,
        "updatedAt" = NOW()
      WHERE "id" = ${workflowId} AND "customerId" = ${customerId} AND "deletedAt" IS NULL
      RETURNING *
    `);
    await this.audit(customerId, supabaseUserId, enabled ? "ai_workflow.enabled" : "ai_workflow.disabled", workflowId, {
      note: `Workflow “${workflow.name}” was ${enabled ? "enabled" : "disabled"}.`,
    });
    return workflowProjection(rows[0]);
  }

  async remove(supabaseUserId: string, workflowId: string): Promise<void> {
    const customerId = await this.customerId(supabaseUserId);
    const workflow = await this.ownedWorkflow(customerId, workflowId);
    if (await this.hasActiveRuns(workflowId)) {
      throw new ConflictException("Active or approval-pending runs must finish or be cancelled before deletion.");
    }
    await this.prisma.$executeRaw(Prisma.sql`
      UPDATE "AiWorkflow" SET "enabled" = false, "deletedAt" = NOW(), "nextRunAt" = NULL, "updatedAt" = NOW()
      WHERE "id" = ${workflowId} AND "customerId" = ${customerId} AND "deletedAt" IS NULL
    `);
    await this.audit(customerId, supabaseUserId, "ai_workflow.deleted", workflowId, {
      note: `Workflow “${workflow.name}” was deleted. Historical runs remain available.`,
    });
  }

  async enqueueManual(supabaseUserId: string, workflowId: string): Promise<WorkflowRun> {
    const customerId = await this.customerId(supabaseUserId);
    const workflow = await this.ownedWorkflow(customerId, workflowId);
    if (!workflow.enabled) throw new BadRequestException("Enable the workflow before running it.");
    const runId = await this.enqueue(workflow, "manual", `manual:${randomUUID()}`, {});
    await this.audit(customerId, supabaseUserId, "ai_workflow.run_queued", runId, {
      note: `Workflow “${workflow.name}” was queued for worker execution.`,
      workflowId,
    });
    return this.getRun(supabaseUserId, runId);
  }

  async approve(supabaseUserId: string, runId: string): Promise<WorkflowRun> {
    const customerId = await this.customerId(supabaseUserId);
    const rows = await this.prisma.$queryRaw<Array<{ workflowId: string; workflowName: string }>>(Prisma.sql`
      UPDATE "AiWorkflowRun" r SET
        "status" = 'queued', "availableAt" = NOW(), "approvedAt" = NOW(),
        "approvedByActorId" = ${supabaseUserId}, "claimedByWorkerId" = NULL,
        "claimedAt" = NULL, "leaseExpiresAt" = NULL, "updatedAt" = NOW()
      FROM "AiWorkflow" w
      WHERE r."id" = ${runId} AND r."workflowId" = w."id" AND r."customerId" = ${customerId}
        AND r."status" = 'awaiting_approval' AND w."deletedAt" IS NULL
      RETURNING r."workflowId", w."name" AS "workflowName"
    `);
    if (!rows[0]) throw new BadRequestException("This run is not awaiting your approval.");
    await this.audit(customerId, supabaseUserId, "ai_workflow.approved", runId, {
      note: `Approval recorded for workflow “${rows[0].workflowName}”. The run was safely re-queued.`,
      workflowId: rows[0].workflowId,
    });
    return this.getRun(supabaseUserId, runId);
  }

  async cancel(supabaseUserId: string, runId: string): Promise<WorkflowRun> {
    const customerId = await this.customerId(supabaseUserId);
    const changed = await this.prisma.$executeRaw(Prisma.sql`
      UPDATE "AiWorkflowRun" SET "status" = 'cancelled', "completedAt" = NOW(),
        "claimedByWorkerId" = NULL, "claimedAt" = NULL, "leaseExpiresAt" = NULL, "updatedAt" = NOW()
      WHERE "id" = ${runId} AND "customerId" = ${customerId}
        AND "status" IN ('queued', 'awaiting_approval')
    `);
    if (!changed) throw new BadRequestException("Only queued or approval-pending runs can be cancelled.");
    await this.audit(customerId, supabaseUserId, "ai_workflow.run_cancelled", runId, {
      note: "The workflow run was cancelled before another node could start.",
    });
    return this.getRun(supabaseUserId, runId);
  }

  async getRun(supabaseUserId: string, runId: string): Promise<WorkflowRun> {
    const customerId = await this.customerId(supabaseUserId);
    const rows = await this.runRows(Prisma.sql`r."id" = ${runId} AND r."customerId" = ${customerId}`, 1);
    if (!rows[0]) throw new NotFoundException("Workflow run not found.");
    return this.runProjection(rows[0]);
  }

  async listRuns(supabaseUserId: string, workflowId: string, limit = 50): Promise<WorkflowRun[]> {
    const customerId = await this.customerId(supabaseUserId);
    await this.ownedWorkflow(customerId, workflowId);
    return Promise.all((await this.runRows(Prisma.sql`r."workflowId" = ${workflowId} AND r."customerId" = ${customerId}`, limit)).map((row) => this.runProjection(row)));
  }

  async runWorkerSweep(workerId: string, limit: number): Promise<WorkflowWorkerSweepResult> {
    const boundedLimit = Math.min(25, Math.max(1, limit));
    const scheduledRunCount = await this.enqueueDueSchedules(boundedLimit);
    const dataChangeRunCount = await this.enqueueDataChanges(boundedLimit);
    const reclaimedRunCount = await this.reclaimExpiredRuns();
    const configuredConcurrency = Number(process.env.AI_WORKFLOW_WORKER_CONCURRENCY ?? 2);
    const globalConcurrency = Number.isInteger(configuredConcurrency)
      ? Math.min(8, Math.max(1, configuredConcurrency))
      : 2;
    const runs = await this.claimRuns(workerId, Math.min(boundedLimit, globalConcurrency));
    const outcomes = await Promise.all(runs.map((run) => this.executeClaimedRun(run)));
    return {
      scheduledRunCount,
      dataChangeRunCount,
      reclaimedRunCount,
      claimedRunCount: runs.length,
      succeededRunCount: outcomes.filter((value) => value === "succeeded").length,
      awaitingApprovalRunCount: outcomes.filter((value) => value === "awaiting_approval").length,
      retriedRunCount: outcomes.filter((value) => value === "queued").length,
      failedRunCount: outcomes.filter((value) => value === "failed").length,
      runIds: runs.map((run) => run.id),
    };
  }

  private validateTrigger(triggerType: WorkflowTriggerType, intervalMinutes: number | undefined, definition: WorkflowDefinition): void {
    if (triggerType === "schedule" && (!intervalMinutes || intervalMinutes < 15 || intervalMinutes > 43_200)) {
      throw new BadRequestException("Scheduled workflows require an interval from 15 to 43,200 minutes.");
    }
    if (triggerType !== "schedule" && intervalMinutes !== undefined) {
      throw new BadRequestException("Only scheduled workflows accept an interval.");
    }
    if (triggerType === "data_change" && definition.dataChangeSource !== "financial_document_ready") {
      throw new BadRequestException("The only currently verified data-change source is financial_document_ready.");
    }
  }

  private validateDefinition(value: unknown, triggerType: WorkflowTriggerType): WorkflowDefinition {
    const definition = object(value);
    if (json(value).length > 65_536) {
      throw new BadRequestException("Workflow definitions cannot exceed 64 KiB.");
    }
    if (definition.version !== 1 || typeof definition.entryNodeId !== "string" || !Array.isArray(definition.nodes)) {
      throw new BadRequestException("Workflow definitions require version 1, an entryNodeId, and a nodes array.");
    }
    if (definition.nodes.length < 1 || definition.nodes.length > MAX_NODES) {
      throw new BadRequestException(`Workflow definitions require between 1 and ${MAX_NODES} nodes.`);
    }
    const nodes = definition.nodes as WorkflowNode[];
    const ids = new Set<string>();
    for (const node of nodes) {
      if (!node || typeof node.id !== "string" || !/^[a-z][a-z0-9-]{0,63}$/u.test(node.id) || ids.has(node.id)) {
        throw new BadRequestException("Every node requires a unique lowercase identifier of at most 64 characters.");
      }
      ids.add(node.id);
      if (typeof node.name !== "string" || node.name.trim().length < 2 || node.name.length > 100) {
        throw new BadRequestException(`Node ${node.id} requires a name between 2 and 100 characters.`);
      }
      if (node.type === "tool") {
        if (!ALLOWED_TOOLS.has(node.tool) || typeof node.config !== "object" || node.config === null || Array.isArray(node.config) || typeof node.next !== "string") {
          throw new BadRequestException(`Node ${node.id} does not declare a supported read-only tool.`);
        }
      } else if (node.type === "condition") {
        const pathParts = typeof node.path === "string" ? node.path.split(".") : [];
        if (!node.sourceNodeId || !node.path || node.path.length > 160 || pathParts.some((part) => !/^[A-Za-z0-9_-]+$/u.test(part) || ["__proto__", "prototype", "constructor"].includes(part)) || !["eq", "neq", "gt", "gte", "lt", "lte", "includes", "exists"].includes(node.operator)) {
          throw new BadRequestException(`Condition ${node.id} is incomplete.`);
        }
      } else if (node.type === "approval") {
        if (typeof node.prompt !== "string" || node.prompt.trim().length < 8 || node.prompt.length > 500) {
          throw new BadRequestException(`Approval node ${node.id} requires a prompt between 8 and 500 characters.`);
        }
      } else {
        throw new BadRequestException("The workflow contains an unsupported node type.");
      }
    }
    if (!ids.has(definition.entryNodeId as string)) throw new BadRequestException("The entry node does not exist.");
    const targets = (node: WorkflowNode): string[] => node.type === "condition" ? [node.ifTrue, node.ifFalse] : [node.next];
    for (const node of nodes) {
      for (const target of targets(node)) {
        if (target !== "end" && !ids.has(target)) throw new BadRequestException(`Node ${node.id} targets missing node ${target}.`);
      }
      if (node.type === "condition" && !ids.has(node.sourceNodeId)) {
        throw new BadRequestException(`Condition ${node.id} references missing output ${node.sourceNodeId}.`);
      }
    }
    const visiting = new Set<string>();
    const visited = new Set<string>();
    const byId = new Map(nodes.map((node) => [node.id, node]));
    const walk = (id: string): void => {
      if (visiting.has(id)) throw new BadRequestException("Workflow cycles are not allowed; use recurring triggers for repetition.");
      if (visited.has(id)) return;
      visiting.add(id);
      for (const target of targets(byId.get(id)!)) if (target !== "end") walk(target);
      visiting.delete(id);
      visited.add(id);
    };
    walk(definition.entryNodeId as string);
    if (visited.size !== nodes.length) throw new BadRequestException("Every workflow node must be reachable from the entry node.");
    return {
      version: 1,
      entryNodeId: definition.entryNodeId as string,
      nodes,
      dataChangeSource: triggerType === "data_change" ? "financial_document_ready" : undefined,
    };
  }

  private async enqueueDueSchedules(limit: number): Promise<number> {
    const rows = await this.prisma.$queryRaw<WorkflowRow[]>(Prisma.sql`
      SELECT * FROM "AiWorkflow"
      WHERE "enabled" = true AND "deletedAt" IS NULL AND "triggerType" = 'schedule'
        AND "nextRunAt" IS NOT NULL AND "nextRunAt" <= NOW()
      ORDER BY "nextRunAt" ASC LIMIT ${limit}
    `);
    let count = 0;
    for (const workflow of rows) {
      if (await this.activeRunCount(workflow.id) >= workflow.maxConcurrentRuns) continue;
      const dueAt = workflow.nextRunAt ?? new Date();
      const runId = await this.enqueue(workflow, "schedule", `schedule:${dueAt.toISOString()}`, { dueAt: dueAt.toISOString() }, true);
      if (runId) count += 1;
      await this.prisma.$executeRaw(Prisma.sql`
        UPDATE "AiWorkflow" SET "nextRunAt" = ${new Date(Math.max(Date.now(), dueAt.getTime()) + (workflow.intervalMinutes ?? 15) * 60_000)}, "updatedAt" = NOW()
        WHERE "id" = ${workflow.id} AND "nextRunAt" = ${dueAt}
      `);
    }
    return count;
  }

  private async enqueueDataChanges(limit: number): Promise<number> {
    const rows = await this.prisma.$queryRaw<WorkflowRow[]>(Prisma.sql`
      SELECT * FROM "AiWorkflow"
      WHERE "enabled" = true AND "deletedAt" IS NULL AND "triggerType" = 'data_change'
      ORDER BY "updatedAt" ASC LIMIT ${limit}
    `);
    let count = 0;
    for (const workflow of rows) {
      if ((workflow.definition as WorkflowDefinition).dataChangeSource !== "financial_document_ready") continue;
      const changes = await this.prisma.$queryRaw<Array<{ id: string; updatedAt: Date; status: string }>>(Prisma.sql`
        SELECT "id", "updatedAt", "status" FROM "FinancialDocument"
        WHERE "customerId" = ${workflow.customerId} AND "status" = 'ready'
          AND "updatedAt" > ${workflow.lastDataChangeAt ?? new Date(0)}
        ORDER BY "updatedAt" ASC LIMIT ${Math.min(10, limit)}
      `);
      let cursor = workflow.lastDataChangeAt ?? new Date(0);
      for (const change of changes) {
        if (await this.activeRunCount(workflow.id) >= workflow.maxConcurrentRuns) break;
        const runId = await this.enqueue(
          workflow,
          "data_change",
          `financial_document_ready:${change.id}:${change.updatedAt.toISOString()}`,
          { source: "financial_document_ready", sourceId: change.id, observedAt: change.updatedAt.toISOString(), status: change.status },
          true,
        );
        if (runId) count += 1;
        cursor = change.updatedAt;
      }
      if (cursor > (workflow.lastDataChangeAt ?? new Date(0))) {
        await this.prisma.$executeRaw(Prisma.sql`
          UPDATE "AiWorkflow" SET "lastDataChangeAt" = ${cursor}, "updatedAt" = NOW() WHERE "id" = ${workflow.id}
        `);
      }
    }
    return count;
  }

  private async enqueue(
    workflow: WorkflowRow,
    triggerType: WorkflowTriggerType,
    triggerKey: string,
    input: JsonObject,
    tolerateDuplicate = false,
  ): Promise<string> {
    const id = randomUUID();
    const rows = await this.prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      INSERT INTO "AiWorkflowRun" (
        "id", "workflowId", "customerId", "workflowRevision", "definitionSnapshot", "triggerType",
        "triggerKey", "status", "input", "output", "attempt", "maxAttempts", "availableAt", "createdAt", "updatedAt"
      ) VALUES (
        ${id}, ${workflow.id}, ${workflow.customerId}, ${workflow.revision}, ${json(workflow.definition)}::jsonb,
        ${triggerType}, ${triggerKey}, 'queued', ${json(input)}::jsonb, '{}'::jsonb, 0, ${workflow.retryLimit + 1}, NOW(), NOW(), NOW()
      ) ON CONFLICT ("workflowId", "triggerKey") DO NOTHING RETURNING "id"
    `);
    if (!rows[0] && !tolerateDuplicate) throw new ConflictException("This workflow trigger was already queued.");
    return rows[0]?.id ?? "";
  }

  private async reclaimExpiredRuns(): Promise<number> {
    return this.prisma.$executeRaw(Prisma.sql`
      UPDATE "AiWorkflowRun" SET "status" = 'queued', "availableAt" = NOW(),
        "claimedByWorkerId" = NULL, "claimedAt" = NULL, "leaseExpiresAt" = NULL,
        "errorCode" = 'worker_lease_expired', "errorMessage" = 'The previous worker lease expired; execution was safely re-queued.', "updatedAt" = NOW()
      WHERE "status" = 'running' AND "leaseExpiresAt" < NOW()
    `);
  }

  private async claimRuns(workerId: string, limit: number): Promise<RunRow[]> {
    const runs: RunRow[] = [];
    for (let index = 0; index < limit; index += 1) {
      const rows = await this.prisma.$queryRaw<RunRow[]>(Prisma.sql`
        WITH candidate AS (
          SELECT r."id" FROM "AiWorkflowRun" r
          JOIN "AiWorkflow" w ON w."id" = r."workflowId"
          WHERE r."status" = 'queued' AND r."availableAt" <= NOW() AND w."deletedAt" IS NULL
            AND (SELECT COUNT(*) FROM "AiWorkflowRun" active WHERE active."workflowId" = r."workflowId" AND active."status" = 'running') < w."maxConcurrentRuns"
          ORDER BY r."availableAt" ASC, r."createdAt" ASC
          FOR UPDATE OF r, w SKIP LOCKED LIMIT 1
        )
        UPDATE "AiWorkflowRun" r SET "status" = 'running', "attempt" = r."attempt" + 1,
          "claimedByWorkerId" = ${workerId}, "claimedAt" = NOW(), "leaseExpiresAt" = NOW() + ((w."timeoutSeconds" + 60) * INTERVAL '1 second'),
          "startedAt" = COALESCE(r."startedAt", NOW()), "errorCode" = NULL, "errorMessage" = NULL, "updatedAt" = NOW()
        FROM candidate, "AiWorkflow" w, "Customer" c
        WHERE r."id" = candidate."id" AND w."id" = r."workflowId" AND c."id" = r."customerId"
        RETURNING r.*, w."name" AS "workflowName", w."externalAiConsent", w."timeoutSeconds", c."supabaseUserId"
      `);
      if (!rows[0]) break;
      runs.push(rows[0]);
    }
    return runs;
  }

  private async executeClaimedRun(run: RunRow): Promise<WorkflowRunStatus | "queued"> {
    try {
      const result = await this.observatory.observeCustomer(run.supabaseUserId, {
        agentId: "workflow-studio",
        workflow: `customer_workflow:${run.workflowId}`,
        execute: () => this.executeGraph(run),
        summarize: (value) => {
          const fallbackReason = value.status === "awaiting_approval"
            ? "human_approval_required"
            : this.workflowFallbackReason(value.outputs);
          return {
            mode: this.outputsUsedExternalAi(value.outputs) ? "hybrid" : "deterministic",
            status: fallbackReason ? "fallback" : "succeeded",
            fallbackReason,
            steps: Object.entries(value.outputs).slice(0, 19).map(([nodeId, output]) => {
              const node = value.definition.nodes.find((candidate) => candidate.id === nodeId);
              return {
                id: `workflow:${nodeId}`,
                label: node?.name ?? nodeId,
                kind: node?.type === "tool" ? "tool" as const : node?.type === "condition" ? "decision" as const : "workflow" as const,
                status: "succeeded" as const,
                toolName: node?.type === "tool" ? node.tool : null,
                outputSummary: object(output).summary && typeof object(output).summary === "string" ? String(object(output).summary).slice(0, 240) : "Workflow node produced a persisted bounded result.",
                evidenceIds: [],
                failureReason: null,
              };
            }),
          };
        },
      });
      if (result.status === "awaiting_approval") return "awaiting_approval";
      await this.completeRun(run, result.outputs);
      return "succeeded";
    } catch (error) {
      const code = safeErrorCode(error);
      const message = safeErrorMessage(error);
      const retry = run.attempt < run.maxAttempts;
      await this.prisma.$executeRaw(Prisma.sql`
        UPDATE "AiWorkflowRun" SET "status" = ${retry ? "queued" : "failed"},
          "availableAt" = ${new Date(Date.now() + Math.min(15 * 60_000, 30_000 * 2 ** Math.max(0, run.attempt - 1)))},
          "errorCode" = ${code}, "errorMessage" = ${message},
          "claimedByWorkerId" = NULL, "claimedAt" = NULL, "leaseExpiresAt" = NULL,
          "completedAt" = ${retry ? null : new Date()}, "updatedAt" = NOW()
        WHERE "id" = ${run.id} AND "status" = 'running'
      `);
      if (!retry) await this.notify(run, "ai_workflow.run_failed", `Workflow “${run.workflowName}” failed after bounded retries. ${message}`);
      this.logger.warn(`Workflow run ${run.id} ${retry ? "requeued" : "failed"}: ${code}`);
      return retry ? "queued" : "failed";
    }
  }

  private async executeGraph(run: RunRow): Promise<ExecutionStateValue> {
    const definition = run.definitionSnapshot as WorkflowDefinition;
    const initial: ExecutionStateValue = {
      run,
      definition,
      currentNodeId: run.currentNodeId ?? definition.entryNodeId,
      outputs: object(run.output),
      status: "running",
    };
    const graph = new StateGraph(ExecutionState)
      .addNode("execute", async (state) => ({ value: await this.executeCurrentNode(state.value) }))
      .addEdge(START, "execute")
      .addConditionalEdges("execute", (state) => state.value.status === "running" ? "execute" : END, ["execute", END])
      .compile();
    const result = await graph.invoke({ value: initial }, { recursionLimit: MAX_GRAPH_STEPS });
    return result.value;
  }

  private async executeCurrentNode(state: ExecutionStateValue): Promise<ExecutionStateValue> {
    const node = state.definition.nodes.find((candidate) => candidate.id === state.currentNodeId);
    if (!node) throw new Error("workflow_node_not_found");
    if (node.type === "approval") return this.executeApprovalNode(state, node);
    if (node.type === "condition") return this.executeConditionNode(state, node);
    return this.executeToolNode(state, node);
  }

  private async executeApprovalNode(state: ExecutionStateValue, node: WorkflowApprovalNode): Promise<ExecutionStateValue> {
    if (!state.run.approvedAt) {
      await this.recordStep(state.run, node, "awaiting_approval", { prompt: node.prompt }, { approved: false }, null, null, 0);
      await this.prisma.$executeRaw(Prisma.sql`
        UPDATE "AiWorkflowRun" SET "status" = 'awaiting_approval', "currentNodeId" = ${node.id},
          "approvalRequestedAt" = NOW(), "approvalPrompt" = ${node.prompt},
          "claimedByWorkerId" = NULL, "claimedAt" = NULL, "leaseExpiresAt" = NULL, "updatedAt" = NOW()
        WHERE "id" = ${state.run.id} AND "status" = 'running'
      `);
      await this.notify(state.run, "ai_workflow.approval_requested", `Workflow “${state.run.workflowName}” is paused for your review. ${node.prompt}`);
      return { ...state, status: "awaiting_approval" };
    }
    const outputs = { ...state.outputs, [node.id]: { approved: true, approvedAt: state.run.approvedAt.toISOString() } };
    await this.recordStep(state.run, node, "succeeded", { prompt: node.prompt }, outputs[node.id], null, null, 0);
    await this.prisma.$executeRaw(Prisma.sql`
      UPDATE "AiWorkflowRun" SET "approvedAt" = NULL, "approvedByActorId" = NULL,
        "approvalRequestedAt" = NULL, "approvalPrompt" = NULL, "updatedAt" = NOW()
      WHERE "id" = ${state.run.id} AND "status" = 'running'
    `);
    return this.advance({ ...state, run: { ...state.run, approvedAt: null } }, node.next, outputs);
  }

  private async executeConditionNode(state: ExecutionStateValue, node: WorkflowConditionNode): Promise<ExecutionStateValue> {
    const source = this.pathValue(state.outputs[node.sourceNodeId], node.path);
    const matched = this.evaluateCondition(source, node);
    const output = { matched, observedValue: source ?? null, selectedTarget: matched ? node.ifTrue : node.ifFalse };
    await this.recordStep(state.run, node, "succeeded", { sourceNodeId: node.sourceNodeId, path: node.path, operator: node.operator, expectedValue: node.value }, output, null, null, 0);
    return this.advance(state, matched ? node.ifTrue : node.ifFalse, { ...state.outputs, [node.id]: output });
  }

  private async executeToolNode(state: ExecutionStateValue, node: WorkflowToolNode): Promise<ExecutionStateValue> {
    const stepId = randomUUID();
    const started = Date.now();
    await this.prisma.$executeRaw(Prisma.sql`
      INSERT INTO "AiWorkflowRunStep" (
        "id", "runId", "workflowId", "customerId", "nodeId", "nodeType", "status", "attempt", "input", "startedAt", "createdAt"
      ) VALUES (${stepId}, ${state.run.id}, ${state.run.workflowId}, ${state.run.customerId}, ${node.id}, ${node.tool}, 'running', ${state.run.attempt}, ${json(node.config)}::jsonb, NOW(), NOW())
    `);
    await this.prisma.$executeRaw(Prisma.sql`
      UPDATE "AiWorkflowRun" SET "currentNodeId" = ${node.id},
        "leaseExpiresAt" = ${new Date(Date.now() + (state.run.timeoutSeconds + 60) * 1_000)}, "updatedAt" = NOW()
      WHERE "id" = ${state.run.id} AND "status" = 'running'
    `);
    try {
      const timeoutMs = Math.min(state.run.timeoutSeconds * 1_000, 45_000);
      const result = await withTimeout(this.invokeTool(state, node), timeoutMs);
      const outputs = { ...state.outputs, [node.id]: result };
      await this.prisma.$executeRaw(Prisma.sql`
        UPDATE "AiWorkflowRunStep" SET "status" = 'succeeded', "output" = ${json(result)}::jsonb,
          "durationMs" = ${Date.now() - started}, "completedAt" = NOW() WHERE "id" = ${stepId}
      `);
      return this.advance(state, node.next, outputs);
    } catch (error) {
      await this.prisma.$executeRaw(Prisma.sql`
        UPDATE "AiWorkflowRunStep" SET "status" = 'failed', "errorCode" = ${safeErrorCode(error)},
          "errorMessage" = ${safeErrorMessage(error)}, "durationMs" = ${Date.now() - started}, "completedAt" = NOW()
        WHERE "id" = ${stepId}
      `);
      throw error;
    }
  }

  private async invokeTool(state: ExecutionStateValue, node: WorkflowToolNode): Promise<unknown> {
    const config = object(node.config);
    const memoryContext = await this.memory.retrieveForAgent(
      state.run.supabaseUserId,
      "workflow-studio",
      `${node.name}: ${node.tool}`,
      state.run.externalAiConsent,
      4,
    );
    if (node.tool === "opportunity_hunter") {
      if (state.run.externalAiConsent) await this.rateLimit.assertAllowed(state.run.supabaseUserId);
      const research = await this.opportunities.analyze(state.run.externalAiConsent);
      return {
        ...research,
        personalization: {
          applied: memoryContext.influences.length > 0,
          influences: memoryContext.influences.map(({ id, category, summary, source }) => ({ id, category, summary, source })),
          note: memoryContext.notice,
        },
      };
    }
    if (node.tool === "portfolio_risk") {
      const research = this.findOpportunityOutput(state.outputs);
      const allocations = Array.isArray(config.allocations)
        ? config.allocations as Array<{ opportunityId: string; percent: number }>
        : this.equalWeightAllocations(research, Number(config.allocationCount ?? 3));
      return this.risk.analyze({
        allocations,
        portfolioValueUsd: this.boundedNumber(config.portfolioValueUsd, 10_000, 1, 1_000_000_000),
      });
    }
    if (node.tool === "halal_research") {
      const research = this.findOpportunityOutput(state.outputs);
      const count = Math.min(10, Math.max(1, Number(config.selectionCount ?? 3)));
      const findings = research.opportunities.slice(0, count).map((item) => ({
        opportunityId: item.id,
        name: item.name,
        status: item.halalScreening.status,
        rationale: item.halalScreening.rationale,
        evidenceGaps: item.halalScreening.evidenceGaps,
        evidenceIds: item.halalScreening.ruleResults.flatMap((rule) => rule.evidence.map((evidence) => evidence.evidenceId)),
      }));
      return {
        findings,
        summary: {
          eligibleCount: findings.filter((item) => item.status === "eligible").length,
          requiresReview: findings.some((item) => item.status !== "eligible" || item.evidenceGaps.length > 0),
          evidenceGapCount: findings.reduce((total, item) => total + item.evidenceGaps.length, 0),
        },
        notice: "Preliminary evidence screening only; no religious ruling or certification is produced.",
      };
    }
    if (node.tool === "document_intelligence") {
      const runInput = object(state.run.input);
      const documentId = typeof config.documentId === "string" ? config.documentId : typeof runInput.sourceId === "string" ? runInput.sourceId : null;
      if (!documentId) throw new BadRequestException("Document Intelligence requires a customer-owned documentId or financial_document_ready trigger.");
      if (!state.run.externalAiConsent) throw new BadRequestException("Document Intelligence workflow retrieval requires explicit external AI consent.");
      const operation = config.operation === "chat" ? "chat" : "intelligence";
      return operation === "chat"
        ? this.documents.chat(state.run.supabaseUserId, this.boundedText(config.query, "Summarize the material financial evidence and identify gaps.", 2, 500), true, documentId)
        : this.documents.intelligence(state.run.supabaseUserId, documentId, true);
    }
    if (node.tool === "financial_copilot") {
      const portfolioRiskContext = this.findPortfolioRiskContext(state.outputs);
      return this.copilot.sendMessage(state.run.supabaseUserId, {
        message: this.boundedText(config.message, "Summarize the workflow findings as educational research and preserve uncertainty.", 2, 500),
        externalAiOptIn: state.run.externalAiConsent,
        searchDocuments: config.searchDocuments === true,
        documentId: typeof config.documentId === "string" ? config.documentId : typeof object(state.run.input).sourceId === "string" ? String(object(state.run.input).sourceId) : undefined,
        portfolioRiskContext,
      });
    }
    if (node.tool === "investment_committee") {
      return this.committee.startMission(state.run.supabaseUserId, {
        goal: this.boundedText(config.goal, "Conduct bounded, evidence-backed investment research.", 8, 500),
        externalAiConsent: state.run.externalAiConsent,
        portfolioValueUsd: this.boundedNumber(config.portfolioValueUsd, 10_000, 1, 1_000_000_000),
        horizonMonths: this.boundedNumber(config.horizonMonths, 36, 1, 600),
        riskTolerance: ["conservative", "balanced", "growth"].includes(String(config.riskTolerance)) ? config.riskTolerance as "conservative" | "balanced" | "growth" : "balanced",
        ethicalPreferences: Array.isArray(config.ethicalPreferences) ? config.ethicalPreferences.filter((item): item is string => typeof item === "string").slice(0, 12) : [],
      });
    }
    throw new BadRequestException("Unsupported workflow tool.");
  }

  private async advance(state: ExecutionStateValue, target: string, outputs: JsonObject): Promise<ExecutionStateValue> {
    const status = target === "end" ? "succeeded" : "running";
    await this.prisma.$executeRaw(Prisma.sql`
      UPDATE "AiWorkflowRun" SET "currentNodeId" = ${target === "end" ? null : target}, "output" = ${json(outputs)}::jsonb,
        "leaseExpiresAt" = ${new Date(Date.now() + (state.run.timeoutSeconds + 60) * 1_000)}, "updatedAt" = NOW()
      WHERE "id" = ${state.run.id} AND "status" = 'running'
    `);
    return { ...state, currentNodeId: target, outputs, status };
  }

  private async completeRun(run: RunRow, outputs: JsonObject): Promise<void> {
    await this.prisma.$executeRaw(Prisma.sql`
      UPDATE "AiWorkflowRun" SET "status" = 'succeeded', "currentNodeId" = NULL, "output" = ${json(outputs)}::jsonb,
        "claimedByWorkerId" = NULL, "claimedAt" = NULL, "leaseExpiresAt" = NULL,
        "completedAt" = NOW(), "updatedAt" = NOW() WHERE "id" = ${run.id} AND "status" = 'running'
    `);
    await this.notify(run, "ai_workflow.run_completed", `Workflow “${run.workflowName}” completed. ${this.findingNote(outputs)}`);
  }

  private async notify(run: RunRow, action: string, note: string): Promise<void> {
    try {
      const event = await this.prisma.auditEvent.create({
        data: {
          customerId: run.customerId,
          actorType: "worker",
          actorId: run.claimedByWorkerId,
          action,
          targetType: "ai_workflow_run",
          targetId: run.id,
          metadata: { note, workflowId: run.workflowId, runId: run.id } as Prisma.InputJsonValue,
        },
      });
      await this.notifications.publishAuditEventRecord(event);
    } catch (error) {
      this.logger.warn(`Workflow run ${run.id} notification could not be published: ${safeErrorCode(error)}`);
    }
  }

  private async recordStep(
    run: RunRow,
    node: WorkflowNode,
    status: string,
    input: unknown,
    output: unknown,
    errorCode: string | null,
    errorMessage: string | null,
    durationMs: number,
  ): Promise<void> {
    await this.prisma.$executeRaw(Prisma.sql`
      INSERT INTO "AiWorkflowRunStep" (
        "id", "runId", "workflowId", "customerId", "nodeId", "nodeType", "status", "attempt",
        "input", "output", "errorCode", "errorMessage", "durationMs", "startedAt", "completedAt", "createdAt"
      ) VALUES (
        ${randomUUID()}, ${run.id}, ${run.workflowId}, ${run.customerId}, ${node.id}, ${node.type}, ${status}, ${run.attempt},
        ${json(input)}::jsonb, ${json(output)}::jsonb, ${errorCode}, ${errorMessage}, ${durationMs}, NOW(), NOW(), NOW()
      )
    `);
  }

  private evaluateCondition(actual: unknown, node: WorkflowConditionNode): boolean {
    if (node.operator === "exists") return actual !== undefined && actual !== null;
    if (node.operator === "includes") return Array.isArray(actual)
      ? actual.some((item) => item === node.value)
      : typeof actual === "string" && actual.includes(String(node.value ?? ""));
    if (node.operator === "eq") return actual === node.value;
    if (node.operator === "neq") return actual !== node.value;
    const left = Number(actual);
    const right = Number(node.value);
    if (!Number.isFinite(left) || !Number.isFinite(right)) return false;
    if (node.operator === "gt") return left > right;
    if (node.operator === "gte") return left >= right;
    if (node.operator === "lt") return left < right;
    return left <= right;
  }

  private pathValue(value: unknown, path: string): unknown {
    return path.split(".").reduce<unknown>((current, part) => object(current)[part], value);
  }

  private findOpportunityOutput(outputs: JsonObject): OpportunityHunterResponse {
    const result = Object.values(outputs).find((value) => Array.isArray(object(value).opportunities));
    if (!result) throw new BadRequestException("This node requires an earlier Opportunity Hunter result.");
    return result as OpportunityHunterResponse;
  }

  private findPortfolioRiskContext(outputs: JsonObject): { allocations: Array<{ opportunityId: string; percent: number }>; portfolioValueUsd: number } | undefined {
    for (const value of Object.values(outputs)) {
      const current = object(object(value).current);
      if (!Array.isArray(current.allocations)) continue;
      const allocations = current.allocations
        .map((item) => object(item))
        .filter((item) => typeof item.opportunityId === "string" && Number.isFinite(Number(item.percent)))
        .map((item) => ({ opportunityId: String(item.opportunityId), percent: Number(item.percent) }));
      if (!allocations.length) continue;
      const portfolioValueUsd = current.allocations
        .map((item) => Number(object(item).valueUsd ?? 0))
        .reduce((total, amount) => total + amount, 0);
      return { allocations, portfolioValueUsd: Math.max(1, portfolioValueUsd) };
    }
    return undefined;
  }

  private equalWeightAllocations(research: OpportunityHunterResponse, requestedCount: number): Array<{ opportunityId: string; percent: number }> {
    const selected = research.opportunities.slice(0, Math.min(8, Math.max(1, Math.floor(requestedCount))));
    if (!selected.length) throw new BadRequestException("No opportunity evidence is available for risk analysis.");
    const base = Number((100 / selected.length).toFixed(2));
    return selected.map((item, index) => ({
      opportunityId: item.id,
      percent: index === selected.length - 1 ? Number((100 - base * (selected.length - 1)).toFixed(2)) : base,
    }));
  }

  private boundedNumber(value: unknown, fallback: number, minimum: number, maximum: number): number {
    const number = Number(value ?? fallback);
    if (!Number.isFinite(number)) return fallback;
    return Math.min(maximum, Math.max(minimum, number));
  }

  private boundedText(value: unknown, fallback: string, minimum: number, maximum: number): string {
    const text = typeof value === "string" ? value.trim() : fallback;
    if (text.length < minimum || text.length > maximum) {
      throw new BadRequestException(`Workflow text inputs must contain between ${minimum} and ${maximum} characters.`);
    }
    return text;
  }

  private findingNote(outputs: JsonObject): string {
    const values = Object.values(outputs).map(object);
    const risk = values.find((value) => object(value.current).metrics);
    if (risk) {
      const current = object(risk.current);
      const metrics = object(current.metrics);
      const guardian = object(current.guardian);
      return `Portfolio Risk Lab reported ${String(metrics.riskLabel ?? "an unavailable")} risk and ${String(guardian.healthLabel ?? "an unavailable")} health. Open the workflow studio for evidence and limitations.`;
    }
    const screening = values.find((value) => object(value.summary).requiresReview !== undefined);
    if (screening) {
      const summary = object(screening.summary);
      return `Halal Research found ${Number(summary.eligibleCount ?? 0)} eligible item(s) and ${Number(summary.evidenceGapCount ?? 0)} evidence gap(s). This is preliminary screening, not a religious ruling.`;
    }
    const opportunities = values.find((value) => Array.isArray(value.opportunities));
    if (opportunities) {
      return `Opportunity Hunter returned ${(opportunities.opportunities as unknown[]).length} item(s) from a ${String(object(opportunities.dataset).reliability ?? "unavailable")} dataset. Open the workflow studio for freshness and evidence details.`;
    }
    const intelligence = values.find((value) => Array.isArray(value.findings));
    if (intelligence) {
      return `Document Intelligence produced ${(intelligence.findings as unknown[]).length} cited finding group(s). Open the workflow studio to review the source passages and missing evidence.`;
    }
    return "Open the workflow studio to inspect the persisted findings, evidence, and limitations.";
  }

  private outputsUsedExternalAi(outputs: JsonObject): boolean {
    return Object.values(outputs).some((value) => {
      const result = object(value);
      if (object(result.ai).externalAiUsed === true) return true;
      if (object(result.message).mode === "ai_prioritized") return true;
      if (result.mode === "external_ai") return true;
      return typeof result.documentId === "string" && Array.isArray(result.findings);
    });
  }

  private workflowFallbackReason(outputs: JsonObject): string | null {
    for (const value of Object.values(outputs)) {
      const result = object(value);
      const aiFallback = object(result.ai).fallbackReason;
      if (typeof aiFallback === "string" && aiFallback) return aiFallback;
      if (typeof result.fallbackReason === "string" && result.fallbackReason) return result.fallbackReason;
      if (object(result.dataset).reliability === "fallback") return "market_data_unavailable";
      if (object(result.dataQuality).reliability === "fallback") return "market_data_unavailable";
    }
    return null;
  }

  private async customerId(supabaseUserId: string): Promise<string> {
    const customer = await this.prisma.customer.findUnique({ where: { supabaseUserId }, select: { id: true } });
    if (!customer) throw new NotFoundException("Customer profile not found.");
    return customer.id;
  }

  private async listRows(customerId: string): Promise<WorkflowRow[]> {
    return this.prisma.$queryRaw<WorkflowRow[]>(Prisma.sql`
      SELECT * FROM "AiWorkflow" WHERE "customerId" = ${customerId} AND "deletedAt" IS NULL ORDER BY "updatedAt" DESC
    `);
  }

  private async ownedWorkflow(customerId: string, workflowId: string): Promise<WorkflowRow> {
    const rows = await this.prisma.$queryRaw<WorkflowRow[]>(Prisma.sql`
      SELECT * FROM "AiWorkflow" WHERE "id" = ${workflowId} AND "customerId" = ${customerId} AND "deletedAt" IS NULL LIMIT 1
    `);
    if (!rows[0]) throw new NotFoundException("Workflow not found.");
    return rows[0];
  }

  private async hasActiveRuns(workflowId: string): Promise<boolean> {
    return (await this.activeRunCount(workflowId)) > 0;
  }

  private async activeRunCount(workflowId: string): Promise<number> {
    const rows = await this.prisma.$queryRaw<Array<{ count: bigint }>>(Prisma.sql`
      SELECT COUNT(*)::bigint AS "count" FROM "AiWorkflowRun" WHERE "workflowId" = ${workflowId} AND "status" IN ('queued', 'running', 'awaiting_approval')
    `);
    return Number(rows[0]?.count ?? 0);
  }

  private async runRows(where: Prisma.Sql, limit: number): Promise<RunRow[]> {
    return this.prisma.$queryRaw<RunRow[]>(Prisma.sql`
      SELECT r.*, w."name" AS "workflowName", w."externalAiConsent", w."timeoutSeconds", c."supabaseUserId"
      FROM "AiWorkflowRun" r
      JOIN "AiWorkflow" w ON w."id" = r."workflowId"
      JOIN "Customer" c ON c."id" = r."customerId"
      WHERE ${where}
      ORDER BY r."createdAt" DESC LIMIT ${Math.min(100, Math.max(1, limit))}
    `);
  }

  private async runProjection(row: RunRow): Promise<WorkflowRun> {
    const steps = await this.prisma.$queryRaw<StepRow[]>(Prisma.sql`
      SELECT "id", "nodeId", "nodeType", "status", "attempt", "input", "output", "errorCode", "errorMessage", "durationMs", "startedAt", "completedAt"
      FROM "AiWorkflowRunStep" WHERE "runId" = ${row.id} ORDER BY "createdAt" ASC
    `);
    return {
      id: row.id,
      workflowId: row.workflowId,
      workflowName: row.workflowName,
      workflowRevision: row.workflowRevision,
      triggerType: row.triggerType,
      triggerKey: row.triggerKey,
      status: row.status as WorkflowRunStatus,
      currentNodeId: row.currentNodeId,
      input: row.input,
      output: row.output,
      errorCode: row.errorCode,
      errorMessage: row.errorMessage,
      attempt: row.attempt,
      maxAttempts: row.maxAttempts,
      approvalRequestedAt: row.approvalRequestedAt?.toISOString() ?? null,
      approvalPrompt: row.approvalPrompt,
      approvedAt: row.approvedAt?.toISOString() ?? null,
      startedAt: row.startedAt?.toISOString() ?? null,
      completedAt: row.completedAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      steps: steps.map(stepProjection),
    };
  }

  private async listRunsForCustomer(customerId: string, limit: number): Promise<WorkflowRun[]> {
    const rows = await this.runRows(Prisma.sql`r."customerId" = ${customerId}`, limit);
    return Promise.all(rows.map((row) => this.runProjection(row)));
  }

  private async audit(customerId: string, actorId: string, action: string, targetId: string, metadata: JsonObject): Promise<void> {
    await this.prisma.auditEvent.create({
      data: { customerId, actorType: "customer", actorId, action, targetType: "ai_workflow", targetId, metadata: metadata as Prisma.InputJsonValue },
    });
  }
}

