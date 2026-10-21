import axios from "axios";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { loadWebRuntimeConfig } from "@stealth-trails-bank/config/web";
import { useUserStore } from "@/stores/userStore";

const runtime = loadWebRuntimeConfig(import.meta.env as Record<string, string | boolean | undefined>);
type ApiResponse<T> = { status: "success" | "failed"; message: string; data?: T };

export type WorkflowTriggerType = "manual" | "schedule" | "data_change";
export type WorkflowToolType = "opportunity_hunter" | "portfolio_risk" | "halal_research" | "document_intelligence" | "financial_copilot" | "investment_committee";
export type WorkflowNode =
  | { id: string; type: "tool"; tool: WorkflowToolType; name: string; config: Record<string, unknown>; next: string }
  | { id: string; type: "condition"; name: string; sourceNodeId: string; path: string; operator: "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "includes" | "exists"; value?: unknown; ifTrue: string; ifFalse: string }
  | { id: string; type: "approval"; name: string; prompt: string; next: string };
export type WorkflowDefinition = { version: 1; entryNodeId: string; nodes: WorkflowNode[]; dataChangeSource?: "financial_document_ready" };
export type WorkflowSummary = {
  id: string; name: string; description: string | null; enabled: boolean; externalAiConsent: boolean;
  definition: WorkflowDefinition; triggerType: WorkflowTriggerType; intervalMinutes: number | null; nextRunAt: string | null;
  maxConcurrentRuns: number; timeoutSeconds: number; retryLimit: number; revision: number; createdAt: string; updatedAt: string;
};
export type WorkflowRunStep = {
  id: string; nodeId: string; nodeType: string; status: string; attempt: number; input: unknown; output: unknown;
  errorCode: string | null; errorMessage: string | null; durationMs: number | null; startedAt: string; completedAt: string | null;
};
export type WorkflowRun = {
  id: string; workflowId: string; workflowName: string; workflowRevision: number; triggerType: string; triggerKey: string;
  status: "queued" | "running" | "awaiting_approval" | "succeeded" | "failed" | "cancelled"; currentNodeId: string | null;
  input: unknown; output: unknown; errorCode: string | null; errorMessage: string | null; attempt: number; maxAttempts: number;
  approvalRequestedAt: string | null; approvalPrompt: string | null; approvedAt: string | null; startedAt: string | null;
  completedAt: string | null; createdAt: string; updatedAt: string; steps: WorkflowRunStep[];
};
export type WorkflowStarter = {
  id: "portfolio-risk-review" | "investment-research" | "document-analysis"; name: string; description: string;
  triggerType: WorkflowTriggerType; intervalMinutes: number | null; externalAiConsent: boolean; definition: WorkflowDefinition;
};
export type WorkflowStudioDashboard = {
  workflows: WorkflowSummary[]; recentRuns: WorkflowRun[]; starters: WorkflowStarter[];
  supportedTriggers: Array<{ type: WorkflowTriggerType; available: boolean; detail: string }>;
  availableTools: Array<{ type: WorkflowToolType; name: string; available: boolean; availability: string; boundary: string }>;
  executionBoundary: string;
};
export type WorkflowInput = Omit<WorkflowSummary, "id" | "nextRunAt" | "revision" | "createdAt" | "updatedAt" | "intervalMinutes"> & { intervalMinutes?: number };

function headers(token: string) { return { Authorization: `Bearer ${token}` }; }
function data<T>(response: { data: ApiResponse<T> }): T {
  if (response.data.status !== "success" || response.data.data === undefined) throw new Error(response.data.message || "Workflow request failed.");
  return response.data.data;
}

export function useWorkflowStudio() {
  const token = useUserStore((state) => state.token);
  return useQuery({
    queryKey: ["workflow-studio", token],
    enabled: Boolean(token),
    refetchInterval: (query) => query.state.data?.recentRuns.some((run) => ["queued", "running"].includes(run.status)) ? 3000 : false,
    queryFn: async () => {
      if (!token) throw new Error("Authentication is required.");
      return data(await axios.get<ApiResponse<WorkflowStudioDashboard>>(`${runtime.serverUrl}/ai/workflows`, { headers: headers(token) }));
    },
  });
}

function useWorkflowMutation<TInput, TResult>(request: (token: string, input: TInput) => Promise<TResult>) {
  const token = useUserStore((state) => state.token);
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: TInput) => {
      if (!token) throw new Error("Authentication is required.");
      return request(token, input);
    },
    onSuccess: () => client.invalidateQueries({ queryKey: ["workflow-studio"] }),
  });
}

export function useSaveWorkflow() {
  return useWorkflowMutation<{ workflowId?: string; input: WorkflowInput }, WorkflowSummary>(async (token, request) => request.workflowId
    ? data(await axios.put<ApiResponse<WorkflowSummary>>(`${runtime.serverUrl}/ai/workflows/${request.workflowId}`, request.input, { headers: headers(token) }))
    : data(await axios.post<ApiResponse<WorkflowSummary>>(`${runtime.serverUrl}/ai/workflows`, request.input, { headers: headers(token) })));
}

export function useCreateStarterWorkflow() {
  return useWorkflowMutation<{ starterId: WorkflowStarter["id"]; name?: string }, WorkflowSummary>(async (token, input) =>
    data(await axios.post<ApiResponse<WorkflowSummary>>(`${runtime.serverUrl}/ai/workflows/starters`, input, { headers: headers(token) })));
}

export function useSetWorkflowEnabled() {
  return useWorkflowMutation<{ workflowId: string; enabled: boolean }, WorkflowSummary>(async (token, input) =>
    data(await axios.patch<ApiResponse<WorkflowSummary>>(`${runtime.serverUrl}/ai/workflows/${input.workflowId}/enabled`, { enabled: input.enabled }, { headers: headers(token) })));
}

export function useRunWorkflow() {
  return useWorkflowMutation<string, WorkflowRun>(async (token, workflowId) =>
    data(await axios.post<ApiResponse<WorkflowRun>>(`${runtime.serverUrl}/ai/workflows/${workflowId}/runs`, {}, { headers: headers(token) })));
}

export function useWorkflowRunAction() {
  return useWorkflowMutation<{ runId: string; action: "approve" | "cancel" }, WorkflowRun>(async (token, input) =>
    data(await axios.post<ApiResponse<WorkflowRun>>(`${runtime.serverUrl}/ai/workflows/executions/${input.runId}/${input.action}`, {}, { headers: headers(token) })));
}

export function useDeleteWorkflow() {
  return useWorkflowMutation<string, null>(async (token, workflowId) =>
    data(await axios.delete<ApiResponse<null>>(`${runtime.serverUrl}/ai/workflows/${workflowId}`, { headers: headers(token) })));
}

