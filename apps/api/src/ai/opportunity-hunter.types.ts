import type { WealthBriefCapabilities } from "./wealth-brief.types";

export type OpportunityRiskLevel = "lower" | "moderate" | "higher";
export type HalalScreeningStatus =
  | "eligible"
  | "questionable"
  | "excluded"
  | "insufficient_evidence";

export type HalalScreeningRuleCategory =
  | "interest_based_activity"
  | "prohibited_industry"
  | "financial_ratio"
  | "ethical_concern";

export type HalalScreeningEvidenceReference = {
  evidenceId: string;
  sourceLabel: string;
  observedAt: string;
  synthetic: boolean;
};

export type HalalScreeningRuleResult = {
  ruleId: string;
  category: HalalScreeningRuleCategory;
  label: string;
  outcome: "passed" | "failed" | "review_required" | "not_assessed";
  explanation: string;
  evidence: HalalScreeningEvidenceReference[];
};

export type HalalScreeningHistoryEntry = {
  assessedAt: string;
  status: HalalScreeningStatus;
  reason: string;
  methodologyVersion: string;
  evidenceIds: string[];
  synthetic: boolean;
};

export type HalalScreeningAssessment = {
  status: HalalScreeningStatus;
  assessedAt: string;
  methodologyVersion: string;
  rationale: string[];
  evidenceGaps: string[];
  ruleResults: HalalScreeningRuleResult[];
  history: HalalScreeningHistoryEntry[];
  historyNote: string;
  disclaimer: string;
};

export type OpportunityCategory =
  | "infrastructure"
  | "income"
  | "payments"
  | "privacy"
  | "security";

export type OpportunityScoreInputs = {
  fundamentals: number;
  momentum: number;
  liquidity: number;
  evidenceQuality: number;
};

export type OpportunityScoreComponent = {
  key:
    | "fundamentals"
    | "momentum"
    | "liquidity"
    | "evidence"
    | "risk"
    | "market_maturity"
    | "volatility";
  label: string;
  points: number;
  maximum: number;
  explanation: string;
};

export type OpportunityScenario = {
  kind: "upside" | "base" | "downside";
  label: string;
  returnRangePercent: [number, number];
  timeHorizonMonths: number;
  assumptions: string[];
};

export type OpportunityEvidence = {
  id: string;
  title: string;
  finding: string;
  sourceLabel: string;
  observedAt: string;
  synthetic: boolean;
};

export type OpportunityMarketData = {
  providerAssetId: string;
  priceUsd: number;
  marketCapUsd: number | null;
  volume24hUsd: number | null;
  high24hUsd: number | null;
  low24hUsd: number | null;
  performance24hPercent: number | null;
  performance7dPercent: number | null;
  performance30dPercent: number | null;
  realizedVolatility7dPercent: number | null;
  volumeToMarketCapPercent: number | null;
  trend: "uptrend" | "sideways" | "downtrend" | "insufficient_data";
  sparkline7dUsd: number[];
  observedAt: string;
};

export type OpportunityResearchPlan = {
  objective: string;
  assumptions: string[];
  riskConsiderations: string[];
  ethicalConsiderations: string[];
  researchSteps: string[];
  monitoringSignals: string[];
  exitConditions: string[];
};

export type Opportunity = {
  id: string;
  name: string;
  symbol: string;
  category: OpportunityCategory;
  network: string;
  summary: string;
  thesis: string;
  riskLevel: OpportunityRiskLevel;
  score: number;
  scoreLabel: "developing" | "promising" | "high_conviction_research";
  scoreBreakdown: OpportunityScoreComponent[];
  scenarios: OpportunityScenario[];
  evidence: OpportunityEvidence[];
  halalScreening: HalalScreeningAssessment;
  researchPlan: OpportunityResearchPlan;
  marketData: OpportunityMarketData | null;
  updatedAt: string;
  synthetic: boolean;
};

export type OpportunityAiInsight = {
  opportunityId: string;
  headline: string;
  reasoning: string[];
  evidenceIds: string[];
  screeningRuleIds: string[];
  halalExplanation: string[];
  risks: string[];
};

export type OpportunityHunterResponse = {
  dataset: {
    kind: "live_market" | "synthetic_research";
    label: string;
    asOf: string;
    methodologyVersion: string;
    disclaimer: string;
    provider: string;
    reliability: "live" | "cached" | "stale" | "fallback";
    failureReason: string | null;
  };
  scoringMethodology: {
    deterministic: true;
    summary: string;
    formula: string;
    maximumScore: 100;
  };
  halalScreeningMethodology: {
    version: string;
    preliminaryOnly: true;
    interestBearingDebtMaximumPercent: number;
    nonPermissibleIncomeMaximumPercent: number;
    rules: Array<{
      id: string;
      category: HalalScreeningRuleCategory;
      label: string;
      description: string;
    }>;
    statusDefinitions: Record<HalalScreeningStatus, string>;
  };
  ai: {
    analysisMode: "deterministic_rules" | "ai_ranked";
    externalAiUsed: boolean;
    analystEnabled: boolean;
    capabilities: WealthBriefCapabilities;
    boundaryNote: string;
    fallbackReason: "provider_failure" | "invalid_provider_output" | null;
    providerUsage: {
      inputTokens: number;
      outputTokens: number;
      totalTokens: number;
    } | null;
    insights: OpportunityAiInsight[];
  };
  opportunities: Opportunity[];
};
