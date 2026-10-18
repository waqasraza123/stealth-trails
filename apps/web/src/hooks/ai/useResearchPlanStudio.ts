import axios from "axios";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { loadWebRuntimeConfig } from "@stealth-trails-bank/config/web";
import { useUserStore } from "@/stores/userStore";
import type {
  HalalScreeningStatus,
  OpportunityRiskLevel,
} from "./useOpportunityHunter";

const webRuntimeConfig = loadWebRuntimeConfig(
  import.meta.env as Record<string, string | boolean | undefined>,
);

type ApiResponse<T> = {
  status: "success" | "failed";
  message: string;
  data?: T;
};

export type ResearchRiskTolerance = "conservative" | "balanced" | "growth";

export type ResearchPlanInput = {
  title: string;
  sourceConversationId?: string;
  externalAiOptIn: boolean;
  goal: {
    objective: string;
    initialAmountUsd: number;
    monthlyContributionUsd: number;
    targetAmountUsd: number | null;
    horizonMonths: number;
    riskTolerance: ResearchRiskTolerance;
    ethicalPreferences: string[];
  };
  allocations: Array<{ opportunityId: string; percent: number }>;
};

export type InvestmentResearchPlan = {
  id: string;
  revision: number;
  title: string;
  createdAt: string;
  updatedAt: string;
  sourceConversationId: string | null;
  goal: ResearchPlanInput["goal"];
  allocations: Array<{
    opportunityId: string;
    name: string;
    symbol: string;
    percent: number;
    riskLevel: OpportunityRiskLevel;
    halalStatus: HalalScreeningStatus;
    synthetic: boolean;
  }>;
  portfolioAnalysis: {
    weightedRiskScore: number;
    riskLabel: OpportunityRiskLevel;
    diversificationScore: number;
    concentrationWarning: string | null;
    riskToleranceAlignment: string;
  };
  scenarios: Array<{
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
  }>;
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

export type ResearchPlanSummary = {
  id: string;
  revision: number;
  title: string;
  createdAt: string;
  updatedAt: string;
  datasetKind: "live_market" | "synthetic_research";
  evidenceAsOf: string;
  allocationCount: number;
  riskLabel: OpportunityRiskLevel;
  halalStatus: HalalScreeningStatus;
};

export type ResearchPlanDashboard = {
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

function requireData<T>(response: ApiResponse<T>): T {
  if (response.status !== "success" || !response.data) {
    throw new Error(response.message || "Research plan request failed.");
  }
  return response.data;
}

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}` };
}

export function useResearchPlanStudio() {
  const token = useUserStore((state) => state.token);
  return useQuery({
    queryKey: ["research-plan-studio"],
    enabled: Boolean(token),
    queryFn: async () => {
      if (!token) throw new Error("Authentication is required.");
      const response = await axios.get<ApiResponse<ResearchPlanDashboard>>(
        `${webRuntimeConfig.serverUrl}/ai/research-plans`,
        { headers: authHeaders(token) },
      );
      return requireData(response.data);
    },
  });
}

export function useResearchPlan(planId: string | null) {
  const token = useUserStore((state) => state.token);
  return useQuery({
    queryKey: ["research-plan-studio", "plan", planId],
    enabled: Boolean(token && planId),
    queryFn: async () => {
      if (!token || !planId) throw new Error("A plan is required.");
      const response = await axios.get<ApiResponse<InvestmentResearchPlan>>(
        `${webRuntimeConfig.serverUrl}/ai/research-plans/${encodeURIComponent(planId)}`,
        { headers: authHeaders(token) },
      );
      return requireData(response.data);
    },
  });
}

export function useSaveResearchPlan() {
  const token = useUserStore((state) => state.token);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (args: { input: ResearchPlanInput; planId?: string }) => {
      if (!token) throw new Error("Authentication is required.");
      const url = args.planId
        ? `${webRuntimeConfig.serverUrl}/ai/research-plans/${encodeURIComponent(args.planId)}`
        : `${webRuntimeConfig.serverUrl}/ai/research-plans`;
      const response = args.planId
        ? await axios.patch<ApiResponse<InvestmentResearchPlan>>(url, args.input, { headers: authHeaders(token) })
        : await axios.post<ApiResponse<InvestmentResearchPlan>>(url, args.input, { headers: authHeaders(token) });
      return requireData(response.data);
    },
    onSuccess: (plan) => {
      queryClient.setQueryData(["research-plan-studio", "plan", plan.id], plan);
      void queryClient.invalidateQueries({ queryKey: ["research-plan-studio"] });
    },
  });
}

export function useCompareResearchPlans() {
  const token = useUserStore((state) => state.token);
  return useMutation({
    mutationFn: async (planIds: string[]) => {
      if (!token) throw new Error("Authentication is required.");
      const response = await axios.post<ApiResponse<ResearchPlanComparison>>(
        `${webRuntimeConfig.serverUrl}/ai/research-plans/compare`,
        { planIds },
        { headers: authHeaders(token) },
      );
      return requireData(response.data);
    },
  });
}

export async function exportResearchPlan(
  token: string,
  planId: string,
): Promise<InvestmentResearchPlan> {
  const response = await axios.get<ApiResponse<InvestmentResearchPlan>>(
    `${webRuntimeConfig.serverUrl}/ai/research-plans/${encodeURIComponent(planId)}/export`,
    { headers: authHeaders(token) },
  );
  return requireData(response.data);
}
