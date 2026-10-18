import type { TraceSummary } from "./agent-observatory.types";
import type { CopilotTurnResult } from "./copilot.types";
import type { OpportunityHunterResponse } from "./opportunity-hunter.types";
import type { PortfolioRiskAnalysis } from "./portfolio-risk.types";
import type {
  InvestmentResearchPlan,
  ResearchPlanComparison,
} from "./research-plan.types";
import type {
  WealthGuardianDashboard,
  WealthGuardianScheduleResult,
} from "./wealth-guardian.types";
import type { WealthBriefResult } from "./wealth-brief.types";

export function summarizeWealthBriefRun(
  result: WealthBriefResult,
): TraceSummary {
  return {
    mode: result.mode === "ai_generated" ? "hybrid" : "deterministic",
    status: result.fallbackReason ? "fallback" : "succeeded",
    fallbackReason: result.fallbackReason,
    steps: [
      {
        id: "collect-wealth-snapshot",
        label: "Collect verified financial snapshot",
        kind: "tool",
        status: "succeeded",
        toolName: "wealth-snapshot",
        outputSummary: `${result.sources.length} bounded source categories were evaluated. Financial values are excluded from telemetry.`,
        evidenceIds: result.sources.map((source) => source.id),
        failureReason: null,
      },
      {
        id: "select-brief-statements",
        label: "Select server-authored brief statements",
        kind: "decision",
        status: result.fallbackReason ? "fallback" : "succeeded",
        toolName: result.provider.name ?? "deterministic-renderer",
        outputSummary: `${result.observations.length} observations and ${result.riskFlags.length} risk flags were selected. Raw financial records are excluded from telemetry.`,
        evidenceIds: result.sources.map((source) => source.id),
        failureReason: result.fallbackReason,
      },
    ],
    evidence: result.sources.map((source) => ({
      evidenceId: source.id,
      sourceLabel: source.label,
      sourceType: "account_snapshot",
      observedAt: source.asOf,
      synthetic: false,
      groundingDecision:
        source.status === "unavailable" ? "rejected" as const : "used" as const,
    })),
    providerUsage: {
      providerName: result.mode === "ai_generated" ? result.provider.name : null,
      model: result.mode === "ai_generated" ? result.provider.model : null,
      inputTokens: result.providerUsage?.inputTokens ?? null,
      outputTokens: result.providerUsage?.outputTokens ?? null,
      totalTokens: result.providerUsage?.totalTokens ?? null,
    },
  };
}

export function summarizeOpportunityRun(
  result: OpportunityHunterResponse,
): TraceSummary {
  const fallbackReason =
    result.ai.fallbackReason ??
    (result.dataset.reliability === "fallback"
      ? "market_data_unavailable"
      : null);
  return {
    mode: result.ai.externalAiUsed ? "hybrid" : "deterministic",
    status: fallbackReason ? "fallback" : "succeeded",
    fallbackReason,
    steps: [
      {
        id: "market-snapshot",
        label: "Load market snapshot",
        kind: "tool",
        status: result.dataset.reliability === "fallback" ? "fallback" : "succeeded",
        toolName: result.dataset.provider,
        outputSummary: `${result.dataset.reliability} market dataset selected; ${result.opportunities.length} bounded opportunities returned.`,
        evidenceIds: result.opportunities.flatMap((item) => item.evidence.map((evidence) => evidence.id)).slice(0, 20),
        failureReason:
          result.dataset.reliability === "fallback"
            ? "market_data_unavailable"
            : null,
      },
      {
        id: "deterministic-analysis",
        label: "Score and screen opportunities",
        kind: "decision",
        status: "succeeded",
        toolName: "opportunity-score-and-halal-screen",
        outputSummary: "Deterministic scores, risk bands, scenarios, and preliminary halal screens were calculated.",
        evidenceIds: result.opportunities.flatMap((item) => item.halalScreening.ruleResults.flatMap((rule) => rule.evidence.map((evidence) => evidence.evidenceId))).slice(0, 20),
        failureReason: null,
      },
      ...(result.ai.externalAiUsed || result.ai.fallbackReason
        ? [{
            id: "provider-ranking",
            label: "Prioritize evidence IDs",
            kind: "tool" as const,
            status: result.ai.fallbackReason ? "fallback" as const : "succeeded" as const,
            toolName: result.ai.capabilities.providerName,
            outputSummary: result.ai.externalAiUsed
              ? "The opt-in provider selected existing opportunity and evidence IDs."
              : "The provider did not return a valid selection; deterministic ordering was retained.",
            evidenceIds: result.ai.insights.flatMap((insight) => insight.evidenceIds).slice(0, 20),
            failureReason: result.ai.fallbackReason,
          }]
        : []),
    ],
    evidence: result.opportunities.flatMap((opportunity) =>
      opportunity.evidence.map((item) => ({
        evidenceId: item.id,
        sourceLabel: item.sourceLabel,
        sourceType: opportunity.marketData ? "market_data" : "synthetic_research",
        observedAt: item.observedAt,
        synthetic: item.synthetic,
        groundingDecision: result.ai.insights.some((insight) => insight.evidenceIds.includes(item.id))
          ? "used" as const
          : "available" as const,
      })),
    ),
    providerUsage: {
      providerName: result.ai.externalAiUsed
        ? result.ai.capabilities.providerName
        : null,
      model: result.ai.externalAiUsed ? result.ai.capabilities.model : null,
      inputTokens: result.ai.providerUsage?.inputTokens ?? null,
      outputTokens: result.ai.providerUsage?.outputTokens ?? null,
      totalTokens: result.ai.providerUsage?.totalTokens ?? null,
    },
  };
}

export function summarizeGuardianRun(
  dashboard: WealthGuardianDashboard,
): TraceSummary {
  const report = dashboard.latestReport;
  const externalAiUsed = report?.ai.externalAiUsed === true;
  return {
    mode: externalAiUsed ? "hybrid" : "deterministic",
    steps: [
      {
        id: "collect-monitoring-data",
        label: "Collect monitoring snapshot",
        kind: "tool",
        status: "succeeded",
        toolName: "opportunity-hunter",
        outputSummary: `${report?.monitoringSnapshot.length ?? 0} monitored entries were evaluated.`,
        evidenceIds: report?.monitoringSnapshot.flatMap((item) => item.screeningEvidenceIds).slice(0, 20) ?? [],
        failureReason: null,
      },
      {
        id: "persist-guardian-report",
        label: "Persist customer report",
        kind: "persistence",
        status: "succeeded",
        toolName: "audit-events",
        outputSummary: report
          ? `A ${report.trigger} Guardian report was recorded.`
          : "No report was generated by this dashboard read.",
        evidenceIds: report?.halalAlerts.flatMap((item) => item.evidenceIds).slice(0, 20) ?? [],
        failureReason: null,
      },
    ],
    evidence: report?.halalAlerts.flatMap((alert) =>
      alert.evidenceIds.map((evidenceId) => ({
        evidenceId,
        sourceLabel: `${alert.name} halal-screen evidence`,
        sourceType: "halal_screening",
        observedAt: alert.evidenceAsOf,
        synthetic: alert.synthetic,
        groundingDecision: "used" as const,
      })),
    ) ?? [],
    providerUsage: {
      providerName: externalAiUsed ? "configured_opportunity_analyst" : null,
    },
  };
}

export function summarizeCopilotRun(result: CopilotTurnResult): TraceSummary {
  return {
    mode: result.message.mode === "ai_prioritized" ? "hybrid" : "deterministic",
    status: result.fallbackReason ? "fallback" : "succeeded",
    fallbackReason: result.fallbackReason,
    steps: [
      {
        id: "assemble-statement-catalog",
        label: "Assemble server-authored statement catalog",
        kind: "decision",
        status: "succeeded",
        toolName: "copilot-statement-catalog",
        outputSummary: "Read-only account, market, Guardian, and risk statements were assembled without storing the raw prompt.",
        evidenceIds: result.message.citations.map((item) => item.evidenceId ?? item.id),
        failureReason: null,
      },
      {
        id: "select-citations",
        label: "Select grounded citations",
        kind: "tool",
        status: result.fallbackReason ? "fallback" : "succeeded",
        toolName: result.message.providerName ?? "deterministic-selector",
        outputSummary: `${result.message.citations.length} citations support the rendered answer. Raw response content is excluded from telemetry.`,
        evidenceIds: result.message.citations.map((item) => item.evidenceId ?? item.id),
        failureReason: result.fallbackReason,
      },
      {
        id: "persist-conversation-turn",
        label: "Persist customer-isolated turn",
        kind: "persistence",
        status: "succeeded",
        toolName: "audit-events",
        outputSummary: "Conversation metadata and the customer-visible answer were stored by the existing Copilot workflow.",
        evidenceIds: [],
        failureReason: null,
      },
    ],
    evidence: result.message.citations.map((citation) => ({
      evidenceId: citation.evidenceId ?? citation.id,
      sourceLabel: citation.label,
      sourceType: citation.sourceType,
      observedAt: citation.observedAt,
      synthetic: citation.synthetic,
      groundingDecision: "used",
    })),
    providerUsage: {
      providerName: result.message.providerName,
      inputTokens: result.providerUsage?.inputTokens ?? null,
      outputTokens: result.providerUsage?.outputTokens ?? null,
      totalTokens: result.providerUsage?.totalTokens ?? null,
    },
  };
}

export function summarizeResearchPlanRun(
  result: InvestmentResearchPlan,
): TraceSummary {
  return {
    mode: result.strategy.externalAiUsed ? "hybrid" : "deterministic",
    steps: [
      {
        id: "validate-allocations",
        label: "Validate hypothetical allocations",
        kind: "decision",
        status: "succeeded",
        toolName: "research-plan-validator",
        outputSummary: `${result.allocations.length} allocations passed bounded plan validation.`,
        evidenceIds: [],
        failureReason: null,
      },
      {
        id: "calculate-plan",
        label: "Calculate plan and scenarios",
        kind: "tool",
        status: "succeeded",
        toolName: "portfolio-risk-engine",
        outputSummary: `${result.scenarios.length} deterministic educational scenarios were calculated.`,
        evidenceIds: result.halalAnalysis.evidence.map((item) => item.evidenceId).slice(0, 20),
        failureReason: null,
      },
      {
        id: "persist-plan",
        label: "Persist plan revision",
        kind: "persistence",
        status: "succeeded",
        toolName: "audit-events",
        outputSummary: `Plan revision ${result.revision} was stored in customer-owned audit history.`,
        evidenceIds: [],
        failureReason: null,
      },
    ],
    evidence: result.halalAnalysis.evidence.map((item) => ({
      evidenceId: item.evidenceId,
      sourceLabel: item.sourceLabel,
      sourceType: "halal_screening",
      observedAt: item.observedAt,
      synthetic: item.synthetic,
      groundingDecision: "used",
    })),
    providerUsage: {
      providerName: result.strategy.externalAiUsed
        ? "configured_opportunity_analyst"
        : null,
    },
  };
}

export function summarizePlanComparison(
  result: ResearchPlanComparison,
): TraceSummary {
  return {
    mode: "deterministic",
    steps: [{
      id: "compare-saved-plans",
      label: "Compare saved deterministic plan outputs",
      kind: "decision",
      status: "succeeded",
      toolName: "research-plan-comparator",
      outputSummary: `${result.metrics.length} customer-owned plans were compared.`,
      evidenceIds: [],
      failureReason: null,
    }],
  };
}

export function summarizePortfolioRiskRun(
  result: PortfolioRiskAnalysis,
): TraceSummary {
  return {
    mode: "deterministic",
    status:
      result.dataQuality.reliability === "fallback" ? "fallback" : "succeeded",
    fallbackReason:
      result.dataQuality.reliability === "fallback"
        ? "market_data_unavailable"
        : null,
    steps: [
      {
        id: "calculate-risk",
        label: "Calculate portfolio risk and exposure",
        kind: "tool",
        status: "succeeded",
        toolName: "portfolio-risk-engine",
        outputSummary: `${result.current.allocations.length} allocations were analyzed with deterministic concentration, diversification, volatility, and halal exposure rules.`,
        evidenceIds: result.evidence.map((item) => item.id).slice(0, 20),
        failureReason: null,
      },
      {
        id: "run-stress-scenarios",
        label: "Run fixed stress scenarios",
        kind: "decision",
        status: "succeeded",
        toolName: "portfolio-stress-engine",
        outputSummary: `${result.current.stressTests.length} clearly hypothetical scenarios were calculated without transaction access.`,
        evidenceIds: [],
        failureReason: null,
      },
    ],
    evidence: result.evidence.map((item) => ({
      evidenceId: item.id,
      sourceLabel: item.label,
      sourceType: item.sourceType,
      observedAt: item.observedAt,
      synthetic: item.synthetic,
      groundingDecision: "used",
    })),
  };
}

export function summarizeGuardianWorkerRun(
  result: WealthGuardianScheduleResult,
): TraceSummary {
  return {
    mode: "scheduled_deterministic",
    status: result.failedCustomerCount > 0 ? "fallback" : "succeeded",
    fallbackReason:
      result.failedCustomerCount > 0 ? "partial_scheduled_execution" : null,
    steps: [
      {
        id: "evaluate-schedule",
        label: "Evaluate due customer schedules",
        kind: "decision",
        status: "succeeded",
        toolName: "wealth-guardian-scheduler",
        outputSummary: `${result.evaluatedCustomerCount} schedules evaluated; ${result.dueCustomerCount} were due.`,
        evidenceIds: [],
        failureReason: null,
      },
      {
        id: "generate-bounded-batch",
        label: "Generate bounded report batch",
        kind: "tool",
        status: result.failedCustomerCount > 0 ? "fallback" : "succeeded",
        toolName: "wealth-guardian",
        outputSummary: `${result.generatedReportCount} reports generated, ${result.skippedCustomerCount} skipped, and ${result.failedCustomerCount} failed.`,
        evidenceIds: [],
        failureReason:
          result.failedCustomerCount > 0 ? "partial_scheduled_execution" : null,
      },
    ],
  };
}
