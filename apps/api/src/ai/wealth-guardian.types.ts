import type {
  HalalScreeningStatus,
  OpportunityCategory,
  OpportunityRiskLevel,
} from "./opportunity-hunter.types";

export type WealthGuardianPreferences = {
  enabled: boolean;
  externalAiConsent: boolean;
  notificationsEnabled: boolean;
  morningReportHourUtc: number;
  minimumOpportunityScore: number;
  volatilityAlertPercent: number;
  categories: OpportunityCategory[];
  halalStatuses: HalalScreeningStatus[];
  monitoredAssetIds: string[];
  updatedAt: string | null;
};

export type WealthGuardianMarketMovement = {
  opportunityId: string;
  name: string;
  symbol: string;
  priceUsd: number | null;
  performance24hPercent: number | null;
  performance7dPercent: number | null;
  volatility7dPercent: number | null;
  score: number;
  scoreChange: number | null;
  riskLevel: OpportunityRiskLevel;
  previousRiskLevel: OpportunityRiskLevel | null;
  priceChangeSincePreviousReportPercent: number | null;
  evidenceAsOf: string;
  synthetic: boolean;
};

export type WealthGuardianHalalAlert = {
  opportunityId: string;
  name: string;
  currentStatus: HalalScreeningStatus;
  previousStatus: HalalScreeningStatus | null;
  changed: boolean;
  reason: string;
  evidenceIds: string[];
  evidenceAsOf: string;
  synthetic: boolean;
};

export type WealthGuardianReport = {
  id: string;
  generatedAt: string;
  trigger: "manual" | "scheduled";
  workerId: string | null;
  datasetKind: "live_market" | "synthetic_research";
  datasetLabel: string;
  evidenceAsOf: string;
  comparison: {
    previousReportId: string | null;
    available: boolean;
    reason: string;
  };
  summary: string;
  marketMovements: WealthGuardianMarketMovement[];
  notableOpportunities: Array<{
    opportunityId: string;
    name: string;
    symbol: string;
    score: number;
    riskLevel: OpportunityRiskLevel;
    halalStatus: HalalScreeningStatus;
    reason: string;
    synthetic: boolean;
  }>;
  risks: Array<{
    opportunityId: string;
    severity: "watch" | "high";
    finding: string;
    evidenceAsOf: string;
    synthetic: boolean;
  }>;
  halalAlerts: WealthGuardianHalalAlert[];
  researchPlans: Array<{
    opportunityId: string;
    objective: string;
    riskConsiderations: string[];
    ethicalConsiderations: string[];
    scenarios: Array<{
      kind: "upside" | "base" | "downside";
      returnRangePercent: [number, number];
      timeHorizonMonths: number;
      assumptions: string[];
    }>;
    monitoringConditions: string[];
    exitConditions: string[];
  }>;
  ai: {
    requested: boolean;
    externalAiUsed: boolean;
    mode: "deterministic_rules" | "ai_ranked";
    boundaryNote: string;
    insights: Array<{
      opportunityId: string;
      headline: string;
      evidenceIds: string[];
      screeningRuleIds: string[];
      halalExplanation: string[];
    }>;
  };
  monitoringSnapshot: Array<{
    opportunityId: string;
    priceUsd: number | null;
    score: number;
    riskLevel: OpportunityRiskLevel;
    halalStatus: HalalScreeningStatus;
    screeningEvidenceIds: string[];
    screeningMethodologyVersion: string;
    synthetic: boolean;
  }>;
  disclaimer: string;
};

export type WealthGuardianDashboard = {
  memoryPersonalization?: {
    applied: boolean;
    influences: Array<{ id: string; category: string; summary: string; source: string }>;
    note: string;
  };
  preferences: WealthGuardianPreferences;
  agent: {
    status: "disabled" | "scheduled";
    nextScheduledAt: string | null;
    lastRunAt: string | null;
    lastRunTrigger: "manual" | "scheduled" | null;
    externalAiAvailable: boolean;
    externalAiConsentActive: boolean;
    productionAiDisabled: boolean;
    scheduleNote: string;
  };
  latestReport: WealthGuardianReport | null;
  reportHistory: WealthGuardianReport[];
  historyNote: string;
};

export type WealthGuardianScheduleResult = {
  evaluatedCustomerCount: number;
  dueCustomerCount: number;
  generatedReportCount: number;
  skippedCustomerCount: number;
  failedCustomerCount: number;
};
