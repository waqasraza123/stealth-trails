import axios from "axios";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { loadWebRuntimeConfig } from "@stealth-trails-bank/config/web";
import { useUserStore } from "@/stores/userStore";

const runtime = loadWebRuntimeConfig(import.meta.env as Record<string, string | boolean | undefined>);
type ApiResponse<T> = { status: "success" | "failed"; message: string; data?: T };

export type CommitteeMissionStatus = "queued" | "running" | "paused" | "awaiting_approval" | "completed" | "cancelled" | "failed";
export type CommitteeAgent = {
  id: string;
  name: string;
  status: "pending" | "running" | "completed" | "failed" | "paused" | "cancelled";
  startedAt: string | null;
  completedAt: string | null;
  durationMs: number | null;
  reasoningSummary: string;
  toolActivity: Array<{ tool: string; status: "running" | "completed" | "failed"; summary: string }>;
  failureReason: string | null;
};
export type CommitteeMission = {
  id: string;
  goal: string;
  status: CommitteeMissionStatus;
  requestedAt: string;
  startedAt: string | null;
  completedAt: string | null;
  updatedAt: string;
  externalAiConsent: boolean;
  executionMode: "deterministic_only" | "hybrid_ai_evidence_ranking";
  controlNote: string;
  agents: CommitteeAgent[];
  failureReason: string | null;
  configuration: { perAgentTimeoutMs: number; maximumToolCalls: number; retryLimit: number };
  report: null | {
    title: string;
    executiveSummary: string[];
    findings: Array<{ agentId: string; category: string; title: string; summary: string; evidenceIds: string[]; evidenceStatus: "verified" | "mixed" | "synthetic" | "assumption" }>;
    assumptions: string[];
    disagreements: Array<{ topic: string; agentIds: string[]; positions: string[]; resolution: string }>;
    review?: {
      methodology: string;
      conclusion: "evidence_limited" | "review_required" | "ready_for_research";
      summary: string;
      challenges: Array<{ id: string; reviewer: string; target: string; severity: "warning" | "high"; reason: string; evidenceIds: string[]; reassessmentCondition: string }>;
      nextResearchSteps: string[];
    };
    researchPlanId: string | null;
    copilotConversationId: string | null;
    evidenceAsOf: string | null;
    executionMode: "deterministic_only" | "hybrid_ai_evidence_ranking";
    limitations: string[];
    disclaimer: string;
  };
};

export type CommitteeDashboard = {
  missions: CommitteeMission[];
  activeMissionCount: number;
  historyNote: string;
  executionBoundary: string;
};

export type StartCommitteeMission = {
  goal: string;
  externalAiConsent: boolean;
  portfolioValueUsd: number;
  horizonMonths: number;
  riskTolerance: "conservative" | "balanced" | "growth";
  ethicalPreferences: string[];
};

function headers(token: string) {
  return { Authorization: `Bearer ${token}` };
}

export function useInvestmentCommittee() {
  const token = useUserStore((state) => state.token);
  return useQuery({
    queryKey: ["investment-committee", token],
    enabled: Boolean(token),
    refetchInterval: (query) =>
      query.state.data?.missions.some((mission) => ["queued", "running"].includes(mission.status)) ? 2000 : false,
    queryFn: async () => {
      if (!token) throw new Error("Authentication is required.");
      const response = await axios.get<ApiResponse<CommitteeDashboard>>(`${runtime.serverUrl}/ai/investment-committee`, { headers: headers(token) });
      if (response.data.status !== "success" || !response.data.data) throw new Error(response.data.message || "Investment committee is unavailable.");
      return response.data.data;
    }
  });
}

export function useStartCommitteeMission() {
  const token = useUserStore((state) => state.token);
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: StartCommitteeMission) => {
      if (!token) throw new Error("Authentication is required.");
      const response = await axios.post<ApiResponse<CommitteeMission>>(`${runtime.serverUrl}/ai/investment-committee/missions`, input, { headers: headers(token) });
      if (response.data.status !== "success" || !response.data.data) throw new Error(response.data.message || "Mission could not be started.");
      return response.data.data;
    },
    onSuccess: () => client.invalidateQueries({ queryKey: ["investment-committee"] })
  });
}

export function useCommitteeMissionControl() {
  const token = useUserStore((state) => state.token);
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ missionId, action }: { missionId: string; action: "pause" | "resume" | "cancel" | "approve" }) => {
      if (!token) throw new Error("Authentication is required.");
      const response = await axios.post<ApiResponse<CommitteeMission>>(`${runtime.serverUrl}/ai/investment-committee/missions/${missionId}/control`, { action }, { headers: headers(token) });
      if (response.data.status !== "success" || !response.data.data) throw new Error(response.data.message || "Mission control failed.");
      return response.data.data;
    },
    onSuccess: () => client.invalidateQueries({ queryKey: ["investment-committee"] })
  });
}
