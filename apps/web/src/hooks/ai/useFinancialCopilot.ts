import axios from "axios";
import { useQuery } from "@tanstack/react-query";
import { loadWebRuntimeConfig } from "@stealth-trails-bank/config/web";
import {
  getWebCsrfToken,
  WEB_COOKIE_SESSION_MARKER,
} from "@/lib/auth-session";
import { useUserStore } from "@/stores/userStore";
import type { PortfolioRiskInput } from "./usePortfolioRiskLab";

const webRuntimeConfig = loadWebRuntimeConfig(
  import.meta.env as Record<string, string | boolean | undefined>,
);

type ApiResponse<T> = {
  status: "success" | "failed";
  message: string;
  data?: T;
};

export type CopilotResponseMode = "deterministic_preview" | "ai_prioritized";

export type CopilotCitation = {
  id: string;
  label: string;
  sourceType: string;
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
  memoryInfluences?: Array<{ id: string; category: string; summary: string; source: "profile" | "long_term_memory" }>;
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

export type CopilotDashboard = {
  capabilities: {
    externalAiAvailable: boolean;
    providerName: string | null;
    model: string | null;
    productionAiDisabled: boolean;
    streamingSupported: boolean;
    memoryStore: string;
    disclosure: string[];
    boundaryNote: string;
    documentSearchAvailable: boolean;
  };
  conversations: CopilotConversationSummary[];
  suggestedQuestions: string[];
  historyNote: string;
};

export type CopilotTurnResult = {
  conversation: CopilotConversationSummary;
  message: CopilotMessage;
  fallbackReason: "provider_failure" | "invalid_provider_output" | null;
};

function requireData<T>(response: ApiResponse<T>): T {
  if (response.status !== "success" || !response.data) {
    throw new Error(response.message || "Copilot request failed.");
  }
  return response.data;
}

export function useFinancialCopilot() {
  const token = useUserStore((state) => state.token);
  return useQuery({
    queryKey: ["financial-copilot"],
    enabled: Boolean(token),
    queryFn: async () => {
      if (!token) throw new Error("Authentication is required.");
      const response = await axios.get<ApiResponse<CopilotDashboard>>(
        `${webRuntimeConfig.serverUrl}/ai/copilot`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      return requireData(response.data);
    },
  });
}

export function useCopilotConversation(conversationId: string | null) {
  const token = useUserStore((state) => state.token);
  return useQuery({
    queryKey: ["financial-copilot", "conversation", conversationId],
    enabled: Boolean(token && conversationId),
    queryFn: async () => {
      if (!token || !conversationId) throw new Error("Conversation is required.");
      const response = await axios.get<ApiResponse<CopilotConversation>>(
        `${webRuntimeConfig.serverUrl}/ai/copilot/conversations/${encodeURIComponent(conversationId)}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      return requireData(response.data);
    },
  });
}

function browserEndpoint(path: string): string {
  const absolute = `${webRuntimeConfig.serverUrl}${path}`;
  if (
    typeof window !== "undefined" &&
    !["localhost", "127.0.0.1"].includes(window.location.hostname) &&
    /^https?:\/\//u.test(absolute)
  ) {
    const url = new URL(absolute);
    if (url.origin === new URL(webRuntimeConfig.serverUrl).origin) {
      return `/api${url.pathname}${url.search}`;
    }
  }
  return absolute;
}

export async function streamCopilotMessage(args: {
  token: string;
  conversationId?: string;
  message: string;
  externalAiOptIn: boolean;
  approveMemoryChange?: boolean;
  searchDocuments?: boolean;
  documentId?: string;
  portfolioRiskContext?: PortfolioRiskInput;
  onDelta: (content: string) => void;
}): Promise<CopilotTurnResult> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Stb-Client-Platform": "web",
  };
  const csrf = getWebCsrfToken();
  if (csrf) headers["X-CSRF-Token"] = csrf;
  if (args.token !== WEB_COOKIE_SESSION_MARKER) {
    headers.Authorization = `Bearer ${args.token}`;
  }
  const response = await fetch(browserEndpoint("/ai/copilot/messages/stream"), {
    method: "POST",
    credentials: "include",
    headers,
    body: JSON.stringify({
      conversationId: args.conversationId,
      message: args.message,
      externalAiOptIn: args.externalAiOptIn,
      approveMemoryChange: args.approveMemoryChange,
      searchDocuments: args.searchDocuments,
      documentId: args.documentId,
      portfolioRiskContext: args.portfolioRiskContext,
    }),
  });
  if (!response.ok || !response.body) {
    let message = "The copilot request failed.";
    try {
      const error = (await response.json()) as { message?: string };
      if (error.message) message = error.message;
    } catch {
      // Keep the safe fallback when an intermediary returned a non-JSON error.
    }
    throw new Error(message);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let result: CopilotTurnResult | null = null;
  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.trim()) continue;
      const event = JSON.parse(line) as {
        type: "delta" | "done" | "error" | "meta";
        content?: string;
        result?: CopilotTurnResult;
        message?: string;
      };
      if (event.type === "delta" && event.content) args.onDelta(event.content);
      if (event.type === "done" && event.result) result = event.result;
      if (event.type === "error") throw new Error(event.message ?? "Streaming failed.");
    }
    if (done) break;
  }
  if (!result) throw new Error("The copilot stream ended before a verified response was delivered.");
  return result;
}
