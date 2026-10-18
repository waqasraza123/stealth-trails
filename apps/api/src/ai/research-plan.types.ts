import type {
  HalalScreeningStatus,
  OpportunityRiskLevel,
} from "./opportunity-hunter.types";

export type ResearchRiskTolerance = "conservative" | "balanced" | "growth";

export type ResearchPlanGoal = {
  objective: string;
  initialAmountUsd: number;
  monthlyContributionUsd: number;
  targetAmountUsd: number | null;
  horizonMonths: number;
  riskTolerance: ResearchRiskTolerance;
  ethicalPreferences: string[];
};

export type ResearchPlanAllocation = {
  opportunityId: string;
  name: string;
  symbol: string;
  percent: number;
  riskLevel: OpportunityRiskLevel;
  halalStatus: HalalScreeningStatus;
  synthetic: boolean;
};

export type ResearchPlanScenario = {
  kind: "optimistic" | "baseline" | "pessimistic";
  weightedReturnRangePercent: [number, number];
  modeledReturnPercent: number;
  projectedValueUsd: number;
  projectedRangeUsd: [number, number];
  contributedAmountUsd: number;
  gainOrLossUsd: number;
  targetGapUsd: number | null;
  targetMet: boolean | null;
  assumptions: string[];
};

export type InvestmentResearchPlan = {
  id: string;
  revision: number;
  title: string;
  createdAt: string;
  updatedAt: string;
  sourceConversationId: string | null;
  goal: ResearchPlanGoal;
  allocations: ResearchPlanAllocation[];
  portfolioAnalysis: {
    weightedRiskScore: number;
    riskLabel: "lower" | "moderate" | "higher";
    diversificationScore: number;
    concentrationWarning: string | null;
    riskToleranceAlignment: string;
  };
  scenarios: ResearchPlanScenario[];
  halalAnalysis: {
    statusWeights: Record<HalalScreeningStatus, number>;
    overallStatus: HalalScreeningStatus;
    uncertaintyWarnings: string[];
    evidence: Array<{
      opportunityId: string;
      evidenceId: string;
      sourceLabel: string;
      observedAt: string;
      synthetic: boolean;
    }>;
    disclaimer: string;
  };
  strategy: {
    rationale: string[];
    assumptions: string[];
    risks: string[];
    monitoringSignals: string[];
    reassessmentConditions: string[];
    researchSteps: string[];
    externalAiUsed: boolean;
    mode: "deterministic" | "ai_prioritized_evidence";
    boundaryNote: string;
  };
  evidenceAsOf: string;
  datasetKind: "live_market" | "synthetic_research";
  methodologyVersion: string;
  disclaimer: string;
};

export type ResearchPlanSummary = Pick<
  InvestmentResearchPlan,
  | "id"
  | "revision"
  | "title"
  | "createdAt"
  | "updatedAt"
  | "datasetKind"
  | "evidenceAsOf"
> & {
  allocationCount: number;
  riskLabel: InvestmentResearchPlan["portfolioAnalysis"]["riskLabel"];
  halalStatus: HalalScreeningStatus;
};

export type ResearchPlanStudioDashboard = {
  plans: ResearchPlanSummary[];
  opportunities: Array<{
    id: string;
    name: string;
    symbol: string;
    score: number;
    riskLevel: OpportunityRiskLevel;
    halalStatus: HalalScreeningStatus;
    synthetic: boolean;
    evidenceAsOf: string;
  }>;
  capabilities: {
    externalAiAvailable: boolean;
    productionAiDisabled: boolean;
    calculationsDeterministic: true;
    exportFormat: "json";
  };
  historyNote: string;
};

export type ResearchPlanComparison = {
  plans: InvestmentResearchPlan[];
  metrics: Array<{
    planId: string;
    title: string;
    baselineProjectedValueUsd: number;
    pessimisticProjectedValueUsd: number;
    optimisticProjectedValueUsd: number;
    weightedRiskScore: number;
    diversificationScore: number;
    halalStatus: HalalScreeningStatus;
  }>;
  note: string;
};

export type ResearchPlanInput = {
  title: string;
  sourceConversationId?: string;
  externalAiOptIn: boolean;
  goal: ResearchPlanGoal;
  allocations: Array<{ opportunityId: string; percent: number }>;
};
