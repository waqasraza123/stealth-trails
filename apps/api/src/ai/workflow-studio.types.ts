export type WorkflowTriggerType = "manual" | "schedule" | "data_change";
export type WorkflowRunStatus =
  | "queued"
  | "running"
  | "awaiting_approval"
  | "succeeded"
  | "failed"
  | "cancelled";

export type WorkflowToolType =
  | "opportunity_hunter"
  | "portfolio_risk"
  | "halal_research"
  | "document_intelligence"
  | "financial_copilot"
  | "investment_committee";

export type WorkflowConditionOperator =
  | "eq"
  | "neq"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "includes"
  | "exists";

export type WorkflowToolNode = {
  id: string;
  type: "tool";
  tool: WorkflowToolType;
  name: string;
  config: Record<string, unknown>;
  next: string | "end";
};

export type WorkflowConditionNode = {
  id: string;
  type: "condition";
  name: string;
  sourceNodeId: string;
  path: string;
  operator: WorkflowConditionOperator;
  value?: unknown;
  ifTrue: string | "end";
  ifFalse: string | "end";
};

export type WorkflowApprovalNode = {
  id: string;
  type: "approval";
  name: string;
  prompt: string;
  next: string | "end";
};

export type WorkflowNode =
  | WorkflowToolNode
  | WorkflowConditionNode
  | WorkflowApprovalNode;

export type WorkflowDefinition = {
  version: 1;
  entryNodeId: string;
  nodes: WorkflowNode[];
  dataChangeSource?: "financial_document_ready";
};

export type WorkflowSummary = {
  id: string;
  name: string;
  description: string | null;
  enabled: boolean;
  externalAiConsent: boolean;
  definition: WorkflowDefinition;
  triggerType: WorkflowTriggerType;
  intervalMinutes: number | null;
  nextRunAt: string | null;
  maxConcurrentRuns: number;
  timeoutSeconds: number;
  retryLimit: number;
  revision: number;
  createdAt: string;
  updatedAt: string;
};

export type WorkflowRunStep = {
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
  startedAt: string;
  completedAt: string | null;
};

export type WorkflowRun = {
  id: string;
  workflowId: string;
  workflowName: string;
  workflowRevision: number;
  triggerType: string;
  triggerKey: string;
  status: WorkflowRunStatus;
  currentNodeId: string | null;
  input: unknown;
  output: unknown;
  errorCode: string | null;
  errorMessage: string | null;
  attempt: number;
  maxAttempts: number;
  approvalRequestedAt: string | null;
  approvalPrompt: string | null;
  approvedAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  steps: WorkflowRunStep[];
};

export type WorkflowStarter = {
  id: "portfolio-risk-review" | "investment-research" | "document-analysis";
  name: string;
  description: string;
  triggerType: WorkflowTriggerType;
  intervalMinutes: number | null;
  externalAiConsent: boolean;
  definition: WorkflowDefinition;
};

export type WorkflowStudioDashboard = {
  workflows: WorkflowSummary[];
  recentRuns: WorkflowRun[];
  starters: WorkflowStarter[];
  supportedTriggers: Array<{
    type: WorkflowTriggerType;
    available: boolean;
    detail: string;
  }>;
  availableTools: Array<{
    type: WorkflowToolType;
    name: string;
    available: boolean;
    availability: string;
    boundary: string;
  }>;
  executionBoundary: string;
};

export type WorkflowWorkerSweepResult = {
  scheduledRunCount: number;
  dataChangeRunCount: number;
  reclaimedRunCount: number;
  claimedRunCount: number;
  succeededRunCount: number;
  awaitingApprovalRunCount: number;
  retriedRunCount: number;
  failedRunCount: number;
  runIds: string[];
};

