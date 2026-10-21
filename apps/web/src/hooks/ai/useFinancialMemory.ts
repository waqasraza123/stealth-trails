import axios from "axios";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { loadWebRuntimeConfig } from "@stealth-trails-bank/config/web";
import { getWebCsrfToken, WEB_COOKIE_SESSION_MARKER } from "@/lib/auth-session";
import { useUserStore } from "@/stores/userStore";

const config = loadWebRuntimeConfig(import.meta.env as Record<string, string | boolean | undefined>);
type ApiResponse<T> = { status: "success" | "failed"; message: string; data?: T };
export type MemoryAgentId = "financial-copilot" | "investment-committee" | "opportunity-hunter" | "wealth-guardian" | "workflow-studio";
export type MemoryCategory = "preference" | "goal" | "research_interest" | "investment_horizon" | "risk_preference" | "ethical_screening" | "research_context";
export type MemoryProfile = {
  preferredCurrencies: string[]; financialGoals: string[]; researchInterests: string[];
  investmentHorizon: string | null; riskPreference: string | null; ethicalPreferences: string[];
  shariahScreening: boolean | null; personalizationEnabled: boolean; memorySavingEnabled: boolean;
  externalAiConsent: boolean; allowedAgentIds: MemoryAgentId[]; retentionDays: number; updatedAt: string | null;
};
export type MemoryEntry = {
  id: string; category: MemoryCategory; content: string; sourceType: "customer_dashboard" | "copilot_explicit";
  verificationStatus: "customer_provided" | "customer_confirmed" | "ai_interpretation";
  authorizedAgentIds: MemoryAgentId[]; semanticIndexStatus: "indexed" | "not_indexed";
  expiresAt: string | null; createdAt: string; updatedAt: string;
};
export type MemoryDashboard = {
  profile: MemoryProfile; memories: MemoryEntry[];
  availableAgents: Array<{ id: MemoryAgentId; name: string; purpose: string }>;
  categories: MemoryCategory[];
  capabilities: { semanticRetrievalAvailable: boolean; semanticRetrievalModel: string | null; persistence: string; checkpointSeparation: boolean; maximumRetrievalResults: number };
  privacyNotice: string;
};
export type MemoryInput = { category: MemoryCategory; content: string; authorizedAgentIds: MemoryAgentId[]; expiresAt?: string | null };

function unwrap<T>(body: ApiResponse<T>): T {
  if (body.status !== "success" || body.data === undefined) throw new Error(body.message || "AI memory request failed.");
  return body.data;
}

function headers(token: string): Record<string, string> {
  const result: Record<string, string> = { "Content-Type": "application/json", "X-Stb-Client-Platform": "web" };
  if (token !== WEB_COOKIE_SESSION_MARKER) result.Authorization = `Bearer ${token}`;
  const csrf = getWebCsrfToken();
  if (csrf) result["X-CSRF-Token"] = csrf;
  return result;
}

async function request<T>(token: string, path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${config.serverUrl}${path}`, { credentials: "include", ...init, headers: headers(token) });
  const body = (await response.json()) as ApiResponse<T>;
  if (!response.ok) throw new Error(body.message || "AI memory request failed.");
  return unwrap(body);
}

export function useFinancialMemory(query = "", category = "") {
  const token = useUserStore((state) => state.token);
  return useQuery({
    queryKey: ["financial-memory", query, category],
    enabled: Boolean(token),
    queryFn: async () => {
      if (!token) throw new Error("Authentication is required.");
      const response = await axios.get<ApiResponse<MemoryDashboard>>(`${config.serverUrl}/ai/memory`, {
        params: { ...(query ? { query } : {}), ...(category ? { category } : {}) },
        headers: token === WEB_COOKIE_SESSION_MARKER ? undefined : { Authorization: `Bearer ${token}` }, withCredentials: true,
      });
      return unwrap(response.data);
    },
  });
}

export function useFinancialMemoryActions() {
  const token = useUserStore((state) => state.token);
  const client = useQueryClient();
  const requireToken = () => { if (!token) throw new Error("Authentication is required."); return token; };
  const refresh = () => client.invalidateQueries({ queryKey: ["financial-memory"] });
  return {
    updateProfile: useMutation({ mutationFn: (profile: Partial<MemoryProfile>) => request<MemoryProfile>(requireToken(), "/ai/memory/profile", { method: "PUT", body: JSON.stringify(profile) }), onSuccess: refresh }),
    create: useMutation({ mutationFn: (input: MemoryInput) => request<MemoryEntry>(requireToken(), "/ai/memory/entries", { method: "POST", body: JSON.stringify(input) }), onSuccess: refresh }),
    update: useMutation({ mutationFn: ({ id, input }: { id: string; input: Partial<MemoryInput> }) => request<MemoryEntry>(requireToken(), `/ai/memory/entries/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(input) }), onSuccess: refresh }),
    remove: useMutation({ mutationFn: (id: string) => request<null>(requireToken(), `/ai/memory/entries/${encodeURIComponent(id)}`, { method: "DELETE" }), onSuccess: refresh }),
    exportData: useMutation({ mutationFn: () => request<{ exportedAt: string; profile: MemoryProfile; memories: MemoryEntry[] }>(requireToken(), "/ai/memory/export") }),
    deleteAll: useMutation({ mutationFn: () => request<null>(requireToken(), "/ai/memory", { method: "DELETE", body: JSON.stringify({ confirmation: "DELETE MY AI MEMORY" }) }), onSuccess: refresh }),
  };
}
