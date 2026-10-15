import axios from "axios";
import { useMutation, useQuery } from "@tanstack/react-query";
import { loadWebRuntimeConfig } from "@stealth-trails-bank/config/web";
import { useUserStore } from "@/stores/userStore";

const webRuntimeConfig = loadWebRuntimeConfig(
  import.meta.env as Record<string, string | boolean | undefined>
);

type ApiResponse<T> = {
  status: "success" | "failed";
  message: string;
  data?: T;
};

export type WealthBriefSourceId =
  | "balances"
  | "transactions"
  | "staking"
  | "loans"
  | "retirement_vaults"
  | "solvency";

export type WealthBriefCapabilities = {
  externalAiAvailable: boolean;
  providerName: string | null;
  model: string | null;
  disclosure: string[];
};

export type WealthBriefResult = {
  mode: "ai_generated" | "deterministic_preview";
  generatedAt: string;
  dataAsOf: string;
  summary: string;
  observations: Array<{
    text: string;
    sourceIds: WealthBriefSourceId[];
  }>;
  riskFlags: Array<{
    severity: "info" | "warning" | "critical";
    title: string;
    detail: string;
    sourceIds: WealthBriefSourceId[];
  }>;
  researchQuestions: string[];
  financialPosition: {
    generatedAt: string;
    balances: Array<{
      assetSymbol: string;
      assetName: string;
      chainId: number;
      availableBalance: string;
      pendingBalance: string;
      updatedAt: string;
    }>;
    recentTransactions: Array<{
      type: string;
      status: string;
      assetSymbol: string;
      requestedAmount: string;
      settledAmount: string | null;
      createdAt: string;
      updatedAt: string;
    }>;
    stakingPositions: Array<{
      poolStatus: string;
      stakedBalance: string;
      pendingReward: string;
      canReadPosition: boolean;
      updatedAt: string;
    }>;
    outstandingLoans: Array<{
      status: string;
      borrowAssetSymbol: string;
      collateralAssetSymbol: string;
      outstandingPrincipalAmount: string;
      outstandingServiceFeeAmount: string;
      outstandingTotalAmount: string;
      collateralAmount: string;
      latestLtvBps: number | null;
      autopayEnabled: boolean;
      nextDueAt: string | null;
      gracePeriodEndsAt: string | null;
    }>;
    retirementVaults: Array<{
      status: string;
      assetSymbol: string;
      lockedBalance: string;
      strictMode: boolean;
      unlockAt: string;
      updatedAt: string;
    }>;
    solvency: {
      status: string;
      evidenceFreshness: string;
      generatedAt: string;
      publishedAt: string;
      policyActionsTriggered: boolean;
      liabilities: Array<{
        assetSymbol: string;
        totalLiabilityAmount: string;
      }>;
    } | null;
  };
  sources: Array<{
    id: WealthBriefSourceId;
    label: string;
    status: "available" | "unavailable";
    asOf: string;
    recordCount: number;
    note: string | null;
  }>;
  externalDataShared: boolean;
  provider: {
    configured: boolean;
    name: string | null;
    model: string | null;
  };
  fallbackReason: "provider_failure" | "invalid_provider_output" | null;
  disclaimer: string;
};

function requireData<T>(response: ApiResponse<T>): T {
  if (response.status !== "success" || !response.data) {
    throw new Error(response.message || "Wealth brief request failed.");
  }
  return response.data;
}

export function useWealthBriefCapabilities() {
  const token = useUserStore((state) => state.token);

  return useQuery({
    queryKey: ["ai-wealth-brief-capabilities"],
    enabled: Boolean(token),
    queryFn: async () => {
      if (!token) {
        throw new Error("Auth token is required.");
      }
      const response = await axios.get<ApiResponse<WealthBriefCapabilities>>(
        `${webRuntimeConfig.serverUrl}/ai/wealth-brief/capabilities`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      return requireData(response.data);
    }
  });
}

export function useGenerateWealthBrief() {
  const token = useUserStore((state) => state.token);

  return useMutation({
    mutationFn: async (externalAiOptIn: boolean) => {
      if (!token) {
        throw new Error("Auth token is required.");
      }
      const response = await axios.post<ApiResponse<WealthBriefResult>>(
        `${webRuntimeConfig.serverUrl}/ai/wealth-brief`,
        { externalAiOptIn },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      return requireData(response.data);
    }
  });
}
