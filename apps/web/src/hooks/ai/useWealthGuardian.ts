import axios from "axios";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { loadWebRuntimeConfig } from "@stealth-trails-bank/config/web";
import { useUserStore } from "@/stores/userStore";
import type {
  HalalScreeningStatus,
  OpportunityCategory,
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
  marketMovements: Array<{
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
  }>;
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
  halalAlerts: Array<{
    opportunityId: string;
    name: string;
    currentStatus: HalalScreeningStatus;
    previousStatus: HalalScreeningStatus | null;
    changed: boolean;
    reason: string;
    evidenceIds: string[];
    evidenceAsOf: string;
    synthetic: boolean;
  }>;
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
  disclaimer: string;
};

export type WealthGuardianDashboard = {
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

function requireData<T>(response: ApiResponse<T>): T {
  if (response.status !== "success" || !response.data) {
    throw new Error(response.message || "Wealth Guardian request failed.");
  }
  return response.data;
}

export function useWealthGuardian() {
  const token = useUserStore((state) => state.token);
  return useQuery({
    queryKey: ["wealth-guardian"],
    enabled: Boolean(token),
    queryFn: async () => {
      if (!token) throw new Error("Auth token is required.");
      const response = await axios.get<ApiResponse<WealthGuardianDashboard>>(
        `${webRuntimeConfig.serverUrl}/ai/wealth-guardian`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      return requireData(response.data);
    },
  });
}

export function useUpdateWealthGuardianPreferences() {
  const token = useUserStore((state) => state.token);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (
      preferences: Omit<WealthGuardianPreferences, "updatedAt">,
    ) => {
      if (!token) throw new Error("Auth token is required.");
      const response = await axios.patch<ApiResponse<WealthGuardianDashboard>>(
        `${webRuntimeConfig.serverUrl}/ai/wealth-guardian/preferences`,
        preferences,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      return requireData(response.data);
    },
    onSuccess: (data) => queryClient.setQueryData(["wealth-guardian"], data),
  });
}

export function useGenerateWealthGuardianReport() {
  const token = useUserStore((state) => state.token);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (externalAiOptIn: boolean) => {
      if (!token) throw new Error("Auth token is required.");
      const response = await axios.post<ApiResponse<WealthGuardianDashboard>>(
        `${webRuntimeConfig.serverUrl}/ai/wealth-guardian/reports`,
        { externalAiOptIn },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      return requireData(response.data);
    },
    onSuccess: (data) => queryClient.setQueryData(["wealth-guardian"], data),
  });
}
