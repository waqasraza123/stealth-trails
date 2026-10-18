import axios from "axios";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { loadWebRuntimeConfig } from "@stealth-trails-bank/config/web";
import { useUserStore } from "@/stores/userStore";

const webRuntimeConfig = loadWebRuntimeConfig(
  import.meta.env as Record<string, string | boolean | undefined>,
);

type ApiResponse<T> = {
  status: "success" | "failed";
  message: string;
  data?: T;
};

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
export type OpportunityCategory =
  | "infrastructure"
  | "income"
  | "payments"
  | "privacy"
  | "security";

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
  scoreBreakdown: Array<{
    key: string;
    label: string;
    points: number;
    maximum: number;
    explanation: string;
  }>;
  scenarios: Array<{
    kind: "upside" | "base" | "downside";
    label: string;
    returnRangePercent: [number, number];
    timeHorizonMonths: number;
    assumptions: string[];
  }>;
  evidence: Array<{
    id: string;
    title: string;
    finding: string;
    sourceLabel: string;
    observedAt: string;
    synthetic: boolean;
  }>;
  halalScreening: {
    status: HalalScreeningStatus;
    assessedAt: string;
    methodologyVersion: string;
    rationale: string[];
    evidenceGaps: string[];
    ruleResults: Array<{
      ruleId: string;
      category: HalalScreeningRuleCategory;
      label: string;
      outcome: "passed" | "failed" | "review_required" | "not_assessed";
      explanation: string;
      evidence: Array<{
        evidenceId: string;
        sourceLabel: string;
        observedAt: string;
        synthetic: boolean;
      }>;
    }>;
    history: Array<{
      assessedAt: string;
      status: HalalScreeningStatus;
      reason: string;
      methodologyVersion: string;
      evidenceIds: string[];
      synthetic: boolean;
    }>;
    historyNote: string;
    disclaimer: string;
  };
  researchPlan: {
    objective: string;
    assumptions: string[];
    riskConsiderations: string[];
    ethicalConsiderations: string[];
    researchSteps: string[];
    monitoringSignals: string[];
    exitConditions: string[];
  };
  marketData: {
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
  } | null;
  updatedAt: string;
  synthetic: boolean;
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
    capabilities: {
      externalAiAvailable: boolean;
      providerName: string | null;
      model: string | null;
      disclosure: string[];
    };
    boundaryNote: string;
    fallbackReason: "provider_failure" | "invalid_provider_output" | null;
    insights: Array<{
      opportunityId: string;
      headline: string;
      reasoning: string[];
      evidenceIds: string[];
      screeningRuleIds: string[];
      halalExplanation: string[];
      risks: string[];
    }>;
  };
  opportunities: Opportunity[];
};

function requireData<T>(response: ApiResponse<T>): T {
  if (response.status !== "success" || !response.data) {
    throw new Error(response.message || "Opportunity research request failed.");
  }
  return response.data;
}

export function useOpportunityHunter() {
  const token = useUserStore((state) => state.token);

  return useQuery({
    queryKey: ["ai-opportunity-hunter"],
    enabled: Boolean(token),
    queryFn: async () => {
      if (!token) {
        throw new Error("Auth token is required.");
      }
      const response = await axios.get<ApiResponse<OpportunityHunterResponse>>(
        `${webRuntimeConfig.serverUrl}/ai/opportunities`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      return requireData(response.data);
    },
  });
}

export function useAnalyzeOpportunities() {
  const token = useUserStore((state) => state.token);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (externalAiOptIn: boolean) => {
      if (!token) {
        throw new Error("Auth token is required.");
      }
      const response = await axios.post<ApiResponse<OpportunityHunterResponse>>(
        `${webRuntimeConfig.serverUrl}/ai/opportunities/analyze`,
        { externalAiOptIn },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      return requireData(response.data);
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["ai-opportunity-hunter"], data);
    },
  });
}
