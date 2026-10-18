import axios from "axios";
import { useMutation } from "@tanstack/react-query";
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

export type PortfolioRiskInput = {
  allocations: Array<{ opportunityId: string; percent: number }>;
  portfolioValueUsd: number;
};

export type PortfolioRiskSnapshot = {
  allocations: Array<{
    opportunityId: string;
    name: string;
    symbol: string;
    category: OpportunityCategory;
    network: string;
    percent: number;
    valueUsd: number;
    riskLevel: OpportunityRiskLevel;
    halalStatus: HalalScreeningStatus;
    volatility7dAnnualizedPercent: number | null;
    historicalDrawdown7dPercent: number | null;
    evidenceIds: string[];
  }>;
  metrics: {
    weightedRiskScore: number;
    riskLabel: OpportunityRiskLevel;
    diversificationScore: number;
    concentrationIndex: number;
    effectiveAssetCount: number;
    maximumAssetWeightPercent: number;
    weightedVolatilityPercent: number | null;
    historicalCoveragePercent: number;
  };
  exposures: {
    byAsset: Array<{ label: string; percent: number }>;
    byCategory: Array<{ label: string; percent: number }>;
    byNetwork: Array<{ label: string; percent: number }>;
    byRisk: Array<{ label: OpportunityRiskLevel; percent: number }>;
  };
  halal: {
    statusWeights: Record<HalalScreeningStatus, number>;
    overallStatus: HalalScreeningStatus;
    flaggedAllocations: Array<{
      opportunityId: string;
      name: string;
      percent: number;
      status: Exclude<HalalScreeningStatus, "eligible">;
      evidenceIds: string[];
    }>;
    disclaimer: string;
  };
  stressTests: Array<{
    id: "market_crash" | "asset_shock" | "volatility_spike" | "recovery";
    label: string;
    description: string;
    basis: "hypothetical";
    portfolioReturnPercent: number;
    projectedValueUsd: number;
    changeUsd: number;
    assetImpacts: Array<{
      opportunityId: string;
      symbol: string;
      shockPercent: number;
      impactUsd: number;
    }>;
    assumptions: string[];
  }>;
  guardian: {
    mode: "deterministic_evidence_guardian";
    externalAiUsed: false;
    healthScore: number;
    healthLabel: "resilient" | "watch" | "vulnerable";
    weaknesses: Array<{
      severity: "info" | "warning" | "high";
      finding: string;
      evidenceIds: string[];
    }>;
    emergingRisks: Array<{
      severity: "info" | "warning" | "high";
      finding: string;
      evidenceIds: string[];
    }>;
    monitoringOpportunities: Array<{
      finding: string;
      evidenceIds: string[];
    }>;
    boundaryNote: string;
  };
};

export type PortfolioRiskAnalysis = {
  current: PortfolioRiskSnapshot;
  hypothetical: PortfolioRiskSnapshot | null;
  comparison: {
    weightedRiskDelta: number;
    diversificationDelta: number;
    maximumWeightDelta: number;
    weightedVolatilityDelta: number | null;
    crashOutcomeDeltaUsd: number;
    healthScoreDelta: number;
  } | null;
  evidence: Array<{
    id: string;
    label: string;
    sourceType: "verified_market" | "halal_screen" | "synthetic_research";
    observedAt: string;
    synthetic: boolean;
  }>;
  dataQuality: {
    datasetKind: "live_market" | "synthetic_research";
    provider: string;
    reliability: "live" | "cached" | "stale" | "fallback";
    asOf: string;
    historicalWindow: "verified_7_day_price_series" | "unavailable";
    note: string;
  };
  methodology: {
    version: string;
    deterministic: true;
    reproducible: true;
    externalAiUsed: false;
    notes: string[];
  };
  disclaimer: string;
};

type ApiResponse<T> = {
  status: "success" | "failed";
  message: string;
  data?: T;
};

export function usePortfolioRiskAnalysis() {
  const token = useUserStore((state) => state.token);
  return useMutation({
    mutationFn: async (input: PortfolioRiskInput & { hypothetical?: PortfolioRiskInput }) => {
      if (!token) throw new Error("Authentication is required.");
      const response = await axios.post<ApiResponse<PortfolioRiskAnalysis>>(
        `${webRuntimeConfig.serverUrl}/ai/portfolio-risk/analyze`,
        input,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (response.data.status !== "success" || !response.data.data) {
        throw new Error(response.data.message || "Portfolio risk analysis failed.");
      }
      return response.data.data;
    },
  });
}
