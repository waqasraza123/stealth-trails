import type { ResearchRiskTolerance } from "./research-plan.types";

export type InvestmentCommitteeMissionStatus =
  | "queued"
  | "running"
  | "paused"
  | "awaiting_approval"
  | "completed"
  | "cancelled"
  | "failed";

export type InvestmentCommitteeAgentId =
  | "chief-research-agent"
  | "opportunity-agent"
  | "risk-agent"
  | "halal-research-agent"
  | "strategy-agent";

export type InvestmentCommitteeAgentState = {
  id: InvestmentCommitteeAgentId;
  name: string;
  status: "pending" | "running" | "completed" | "failed" | "paused" | "cancelled";
  startedAt: string | null;
  completedAt: string | null;
  durationMs: number | null;
  reasoningSummary: string;
  toolActivity: Array<{
    tool: string;
    status: "running" | "completed" | "failed";
    summary: string;
  }>;
  failureReason: string | null;
};

export type InvestmentCommitteeFinding = {
  agentId: InvestmentCommitteeAgentId;
  category: "opportunity" | "risk" | "halal" | "strategy" | "committee";
  title: string;
  summary: string;
  evidenceIds: string[];
  evidenceStatus: "verified" | "mixed" | "synthetic" | "assumption";
};

export type InvestmentCommitteeDisagreement = {
  topic: string;
  agentIds: InvestmentCommitteeAgentId[];
  positions: string[];
  resolution: string;
};

export type InvestmentCommitteeReview = {
  methodology: "cross_agent_evidence_review_v1";
  conclusion: "evidence_limited" | "review_required" | "ready_for_research";
  summary: string;
  challenges: Array<{
    id: string;
    reviewer: InvestmentCommitteeAgentId;
    target: InvestmentCommitteeAgentId;
    severity: "warning" | "high";
    reason: string;
    evidenceIds: string[];
    reassessmentCondition: string;
  }>;
  nextResearchSteps: string[];
};

export type InvestmentCommitteeMissionInput = {
  goal: string;
  externalAiConsent: boolean;
  portfolioValueUsd: number;
  horizonMonths: number;
  riskTolerance: ResearchRiskTolerance;
  ethicalPreferences: string[];
  allocations?: Array<{ opportunityId: string; percent: number }>;
};

export type InvestmentCommitteeReport = {
  title: string;
  executiveSummary: string[];
  findings: InvestmentCommitteeFinding[];
  assumptions: string[];
  disagreements: InvestmentCommitteeDisagreement[];
  review?: InvestmentCommitteeReview;
  researchPlanId: string | null;
  copilotConversationId: string | null;
  evidenceAsOf: string | null;
  executionMode: "deterministic_only" | "hybrid_ai_evidence_ranking";
  limitations: string[];
  disclaimer: string;
};

export type InvestmentCommitteeMission = {
  id: string;
  goal: string;
  status: InvestmentCommitteeMissionStatus;
  requestedAt: string;
  startedAt: string | null;
  completedAt: string | null;
  updatedAt: string;
  externalAiConsent: boolean;
  executionMode: "deterministic_only" | "hybrid_ai_evidence_ranking";
  controlNote: string;
  agents: InvestmentCommitteeAgentState[];
  report: InvestmentCommitteeReport | null;
  failureReason: string | null;
  configuration: {
    perAgentTimeoutMs: number;
    maximumToolCalls: number;
    retryLimit: number;
  };
  input: InvestmentCommitteeMissionInput;
};

export type InvestmentCommitteeDashboard = {
  missions: InvestmentCommitteeMission[];
  activeMissionCount: number;
  historyNote: string;
  executionBoundary: string;
};
