export const FINANCIAL_MEMORY_AGENT_IDS = [
  "financial-copilot",
  "investment-committee",
  "opportunity-hunter",
  "wealth-guardian",
  "workflow-studio",
] as const;

export type FinancialMemoryAgentId = (typeof FINANCIAL_MEMORY_AGENT_IDS)[number];
export type FinancialMemoryCategory =
  | "preference"
  | "goal"
  | "research_interest"
  | "investment_horizon"
  | "risk_preference"
  | "ethical_screening"
  | "research_context";

export type FinancialMemoryProfile = {
  preferredCurrencies: string[];
  financialGoals: string[];
  researchInterests: string[];
  investmentHorizon: string | null;
  riskPreference: string | null;
  ethicalPreferences: string[];
  shariahScreening: boolean | null;
  personalizationEnabled: boolean;
  memorySavingEnabled: boolean;
  externalAiConsent: boolean;
  allowedAgentIds: FinancialMemoryAgentId[];
  retentionDays: number;
  updatedAt: string | null;
};

export type FinancialMemoryEntry = {
  id: string;
  category: FinancialMemoryCategory;
  content: string;
  sourceType: "customer_dashboard" | "copilot_explicit";
  verificationStatus: "customer_provided" | "customer_confirmed" | "ai_interpretation";
  authorizedAgentIds: FinancialMemoryAgentId[];
  semanticIndexStatus: "indexed" | "not_indexed";
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type FinancialMemoryDashboard = {
  profile: FinancialMemoryProfile;
  memories: FinancialMemoryEntry[];
  availableAgents: Array<{ id: FinancialMemoryAgentId; name: string; purpose: string }>;
  categories: FinancialMemoryCategory[];
  capabilities: {
    semanticRetrievalAvailable: boolean;
    semanticRetrievalModel: string | null;
    persistence: "postgresql_customer_scoped";
    checkpointSeparation: true;
    maximumRetrievalResults: number;
  };
  privacyNotice: string;
};

export type FinancialMemoryInfluence = {
  id: string;
  category: FinancialMemoryCategory;
  summary: string;
  source: "profile" | "long_term_memory";
  verificationStatus: "customer_provided" | "customer_confirmed" | "ai_interpretation";
};

export type FinancialMemoryContext = {
  agentId: FinancialMemoryAgentId;
  task: string;
  influences: FinancialMemoryInfluence[];
  externalAiUseAuthorized: boolean;
  notice: string;
};
