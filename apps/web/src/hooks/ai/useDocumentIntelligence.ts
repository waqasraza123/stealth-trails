import axios from "axios";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { loadWebRuntimeConfig } from "@stealth-trails-bank/config/web";
import { getWebCsrfToken, WEB_COOKIE_SESSION_MARKER } from "@/lib/auth-session";
import { useUserStore } from "@/stores/userStore";

const config = loadWebRuntimeConfig(import.meta.env as Record<string, string | boolean | undefined>);

type ApiResponse<T> = { status: "success" | "failed"; message: string; data?: T };
export type DocumentSummary = {
  id: string; fileName: string; mimeType: string; sizeBytes: number;
  status: "uploaded" | "processing" | "text_ready" | "ready" | "failed";
  pageCount: number; chunkCount: number; embeddingModel: string | null;
  errorCode: string | null; createdAt: string; updatedAt: string;
};
export type DocumentPassage = {
  chunkId: string; documentId: string; fileName: string; pageNumber: number;
  content: string; similarity: number; citation: string;
};
export type DocumentLibrary = {
  capabilities: {
    semanticRagAvailable: boolean; externalAiAvailable: boolean;
    embeddingProvider: string | null; embeddingModel: string | null;
    embeddingDimensions: number; productionExternalAiDisabled: boolean;
    acceptedTypes: ["application/pdf", "text/plain"];
    maxFileBytes: number; maxStorageBytesPerCustomer: number; disclosure: string;
  };
  documents: DocumentSummary[];
  storage: { usedBytes: number; limitBytes: number };
};
export type DocumentDetail = DocumentSummary & { pages: Array<{ pageNumber: number; content: string }> };
export type ChatResult = {
  answer: string; passages: DocumentPassage[]; mode: "extractive" | "external_ai";
  provider: string | null; disclaimer: string;
};
export type IntelligenceResult = {
  documentId: string;
  findings: Array<{ category: string; label: string; passages: DocumentPassage[] }>;
  halalResearchNotice: string;
};
export type ComparisonResult = {
  documentIds: string[];
  dimensions: Array<{ label: string; evidenceByDocument: Record<string, DocumentPassage[]> }>;
  notice: string;
};

function data<T>(response: ApiResponse<T>): T {
  if (response.status !== "success" || response.data === undefined) throw new Error(response.message || "Document request failed.");
  return response.data;
}

function headers(token: string, json = true): Record<string, string> {
  const result: Record<string, string> = { "X-Stb-Client-Platform": "web" };
  if (json) result["Content-Type"] = "application/json";
  if (token !== WEB_COOKIE_SESSION_MARKER) result.Authorization = `Bearer ${token}`;
  const csrf = getWebCsrfToken();
  if (csrf) result["X-CSRF-Token"] = csrf;
  return result;
}

async function request<T>(token: string, path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${config.serverUrl}${path}`, {
    credentials: "include",
    ...init,
    headers: headers(token, init?.body !== undefined && !(init.body instanceof FormData)),
  });
  const body = (await response.json()) as ApiResponse<T>;
  if (!response.ok) throw new Error(body.message || "Document request failed.");
  return data(body);
}

export function useDocumentLibrary(query = "") {
  const token = useUserStore((state) => state.token);
  return useQuery({
    queryKey: ["document-intelligence", "library", query],
    enabled: Boolean(token),
    queryFn: async () => {
      if (!token) throw new Error("Authentication is required.");
      const response = await axios.get<ApiResponse<DocumentLibrary>>(`${config.serverUrl}/ai/documents`, {
        params: query ? { query } : undefined,
        headers: token === WEB_COOKIE_SESSION_MARKER ? undefined : { Authorization: `Bearer ${token}` },
        withCredentials: true,
      });
      return data(response.data);
    },
  });
}

export function useDocumentDetail(documentId: string | null) {
  const token = useUserStore((state) => state.token);
  return useQuery({
    queryKey: ["document-intelligence", "detail", documentId],
    enabled: Boolean(token && documentId),
    queryFn: () => request<DocumentDetail>(token!, `/ai/documents/${encodeURIComponent(documentId!)}`),
  });
}

export function useDocumentActions() {
  const token = useUserStore((state) => state.token);
  const client = useQueryClient();
  const requireToken = () => {
    if (!token) throw new Error("Authentication is required.");
    return token;
  };
  const refresh = () => client.invalidateQueries({ queryKey: ["document-intelligence"] });
  return {
    upload: useMutation({
      mutationFn: ({ file, consent }: { file: File; consent: boolean }) => {
        const body = new FormData(); body.append("file", file); body.append("externalAiConsent", String(consent));
        return request<DocumentSummary>(requireToken(), "/ai/documents", { method: "POST", body });
      },
      onSuccess: refresh,
    }),
    process: useMutation({
      mutationFn: ({ documentId, consent }: { documentId: string; consent: boolean }) => request<DocumentSummary>(requireToken(), `/ai/documents/${encodeURIComponent(documentId)}/process`, { method: "POST", body: JSON.stringify({ externalAiConsent: consent }) }),
      onSuccess: refresh,
    }),
    remove: useMutation({
      mutationFn: (documentId: string) => request<null>(requireToken(), `/ai/documents/${encodeURIComponent(documentId)}`, { method: "DELETE" }),
      onSuccess: refresh,
    }),
    chat: useMutation({
      mutationFn: ({ query, documentId, consent }: { query: string; documentId?: string; consent: boolean }) => request<ChatResult>(requireToken(), "/ai/documents/chat", { method: "POST", body: JSON.stringify({ query, documentId, externalAiConsent: consent }) }),
    }),
    intelligence: useMutation({
      mutationFn: ({ documentId, consent }: { documentId: string; consent: boolean }) => request<IntelligenceResult>(requireToken(), `/ai/documents/${encodeURIComponent(documentId)}/intelligence`, { method: "POST", body: JSON.stringify({ externalAiConsent: consent }) }),
    }),
    compare: useMutation({
      mutationFn: ({ documentIds, consent }: { documentIds: string[]; consent: boolean }) => request<ComparisonResult>(requireToken(), "/ai/documents/compare", { method: "POST", body: JSON.stringify({ documentIds, externalAiConsent: consent }) }),
    }),
  };
}
