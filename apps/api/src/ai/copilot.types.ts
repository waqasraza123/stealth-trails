export type CopilotIntent =
  | "overview"
  | "balances"
  | "transactions"
  | "loans"
  | "staking"
  | "opportunities"
  | "halal_screening"
  | "wealth_guardian"
  | "research_plan"
  | "portfolio_risk";

export type CopilotResponseMode =
  | "deterministic_preview"
  | "ai_prioritized";

export type CopilotCitation = {
  id: string;
  label: string;
  sourceType:
    | "account_snapshot"
    | "wealth_brief"
    | "market_data"
    | "halal_screening"
    | "guardian_report"
    | "portfolio_risk"
    | "financial_document";
  observedAt: string | null;
  evidenceId: string | null;
  synthetic: boolean;
};

export type CopilotMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  mode: CopilotResponseMode | null;
  providerName: string | null;
  citations: CopilotCitation[];
  suggestedQuestions: string[];
  disclaimer: string | null;
};

export type CopilotConversationSummary = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
};

export type CopilotConversation = CopilotConversationSummary & {
  messages: CopilotMessage[];
};

export type CopilotCapabilities = {
  externalAiAvailable: boolean;
  providerName: string | null;
  model: string | null;
  productionAiDisabled: boolean;
  streamingSupported: true;
  memoryStore: "customer_isolated_audit_history";
  disclosure: string[];
  boundaryNote: string;
  documentSearchAvailable: boolean;
};

export type CopilotDashboard = {
  capabilities: CopilotCapabilities;
  conversations: CopilotConversationSummary[];
  suggestedQuestions: string[];
  historyNote: string;
};

export type CopilotTurnResult = {
  conversation: CopilotConversationSummary;
  message: CopilotMessage;
  fallbackReason: "provider_failure" | "invalid_provider_output" | null;
  providerUsage: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  } | null;
};

export type CopilotStatement = {
  id: string;
  intent: CopilotIntent;
  topic: string;
  priority: number;
  text: string;
  citationIds: string[];
};
