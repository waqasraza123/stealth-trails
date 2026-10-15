export type WealthBriefSourceId =
  | "balances"
  | "transactions"
  | "staking"
  | "loans"
  | "retirement_vaults"
  | "solvency";

export type WealthBriefSource = {
  id: WealthBriefSourceId;
  label: string;
  status: "available" | "unavailable";
  asOf: string;
  recordCount: number;
  note: string | null;
};

export type WealthSnapshot = {
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
  sources: WealthBriefSource[];
};

export type WealthBriefObservation = {
  text: string;
  sourceIds: WealthBriefSourceId[];
};

export type WealthBriefRiskFlag = {
  severity: "info" | "warning" | "critical";
  title: string;
  detail: string;
  sourceIds: WealthBriefSourceId[];
};

export type WealthBriefInterpretation = {
  summary: string;
  observations: WealthBriefObservation[];
  riskFlags: WealthBriefRiskFlag[];
  researchQuestions: string[];
};

export type WealthBriefMode = "ai_generated" | "deterministic_preview";

export type WealthBriefResult = WealthBriefInterpretation & {
  mode: WealthBriefMode;
  generatedAt: string;
  dataAsOf: string;
  financialPosition: Omit<WealthSnapshot, "sources">;
  sources: WealthBriefSource[];
  externalDataShared: boolean;
  provider: {
    configured: boolean;
    name: string | null;
    model: string | null;
  };
  fallbackReason: "provider_failure" | "invalid_provider_output" | null;
  disclaimer: string;
};

export type WealthBriefCapabilities = {
  externalAiAvailable: boolean;
  providerName: string | null;
  model: string | null;
  disclosure: string[];
};
