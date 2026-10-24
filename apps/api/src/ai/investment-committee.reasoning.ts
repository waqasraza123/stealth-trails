import type { HalalFinding } from "./investment-committee.tools";
import type { InvestmentCommitteeMissionInput, InvestmentCommitteeReview } from "./investment-committee.types";
import type { OpportunityHunterResponse } from "./opportunity-hunter.types";
import type { PortfolioRiskAnalysis } from "./portfolio-risk.types";
import { RISK_TOLERANCE_MAXIMUM } from "./portfolio-risk.engine";

/** Evidence review uses the selected scenario, never unrelated catalog leaders. */
export function reviewCommitteeEvidence(args: {
  input: InvestmentCommitteeMissionInput;
  allocations: Array<{ opportunityId: string; percent: number }>;
  research: OpportunityHunterResponse;
  risk: PortfolioRiskAnalysis;
  halal: HalalFinding[];
}): InvestmentCommitteeReview {
  const { input, research, risk, halal } = args;
  const selectedIds = new Set(args.allocations.filter((item) => item.percent > 0).map((item) => item.opportunityId));
  const selected = research.opportunities.filter((item) => selectedIds.has(item.id));
  const challenges: InvestmentCommitteeReview["challenges"] = [];
  const add = (challenge: InvestmentCommitteeReview["challenges"][number]) => challenges.push({
    ...challenge, evidenceIds: [...new Set(challenge.evidenceIds)],
  });
  const riskEvidence = risk.evidence.map((item) => item.id);
  const evidenceLimited = selected.length !== selectedIds.size || selected.length === 0 ||
    research.dataset.kind === "synthetic_research" || ["stale", "fallback"].includes(research.dataset.reliability) ||
    risk.dataQuality.datasetKind === "synthetic_research" || ["stale", "fallback"].includes(risk.dataQuality.reliability) ||
    selected.some((item) => item.synthetic || item.evidence.length === 0 || item.evidence.some((evidence) => evidence.synthetic) ||
      item.halalScreening.ruleResults.some((rule) => rule.evidence.some((evidence) => evidence.synthetic))) ||
    risk.evidence.length === 0 || risk.evidence.some((item) => item.synthetic);
  if (evidenceLimited) add({
    id: "evidence_quality", reviewer: "chief-research-agent", target: "opportunity-agent", severity: "high",
    reason: "Selected research has missing, synthetic, stale, or fallback evidence. A high opportunity score cannot establish a verified investment thesis.",
    evidenceIds: selected.flatMap((item) => item.evidence.map((evidence) => evidence.id)),
    reassessmentCondition: "Obtain current, non-synthetic evidence for every selected opportunity and rerun both opportunity and portfolio analysis.",
  });
  if (risk.current.metrics.weightedRiskScore > RISK_TOLERANCE_MAXIMUM[input.riskTolerance]) add({
    id: "risk_tolerance", reviewer: "risk-agent", target: "strategy-agent", severity: "high",
    reason: `The scenario's weighted risk score of ${risk.current.metrics.weightedRiskScore} exceeds the configured ${input.riskTolerance} tolerance ceiling of ${RISK_TOLERANCE_MAXIMUM[input.riskTolerance]}.`,
    evidenceIds: riskEvidence,
    reassessmentCondition: "Compare a separately modeled scenario within the stated risk tolerance before accepting the strategy rationale.",
  });
  if (risk.current.metrics.maximumAssetWeightPercent > 50) add({
    id: "concentration", reviewer: "risk-agent", target: "opportunity-agent", severity: "warning",
    reason: `One asset represents ${risk.current.metrics.maximumAssetWeightPercent}% of the scenario. Opportunity scores do not offset majority exposure.`,
    evidenceIds: riskEvidence,
    reassessmentCondition: "Compare a less concentrated hypothetical scenario using the same evidence and stress assumptions.",
  });
  if (risk.current.guardian.healthLabel === "vulnerable") add({
    id: "stress_resilience", reviewer: "risk-agent", target: "strategy-agent", severity: "high",
    reason: "Portfolio stress resilience is vulnerable; a positive opportunity thesis does not resolve the modeled downside.",
    evidenceIds: riskEvidence,
    reassessmentCondition: "Review the adverse stress scenarios and document how a comparison scenario changes the identified weaknesses.",
  });
  if (risk.current.metrics.historicalCoveragePercent < 100) add({
    id: "historical_coverage", reviewer: "risk-agent", target: "strategy-agent", severity: "warning",
    reason: `Verified price history covers ${risk.current.metrics.historicalCoveragePercent}% of portfolio weight. Missing history is uncertainty, not zero volatility.`,
    evidenceIds: riskEvidence,
    reassessmentCondition: "Obtain verified historical series for uncovered allocations and recompute volatility and drawdown.",
  });
  for (const id of selectedIds) {
    const screen = halal.find((item) => item.opportunityId === id);
    if (!screen || screen.status !== "eligible" || screen.evidenceGaps.length || !screen.evidenceIds.length) add({
      id: `screening:${id}`, reviewer: "halal-research-agent", target: "strategy-agent", severity: "high",
      reason: screen
        ? `${screen.name} has ${screen.status.replace(/_/gu, " ")} screening status${screen.evidenceGaps.length ? ` with unresolved gaps: ${screen.evidenceGaps.join("; ")}` : ""}${!screen.evidenceIds.length ? " without linked screening evidence" : ""}. Market attractiveness cannot establish permissibility.`
        : "A selected allocation has no specialist screening result. Absence of a result cannot establish permissibility.",
      evidenceIds: screen?.evidenceIds ?? [],
      reassessmentCondition: "Obtain the missing screening evidence and qualified independent review; retain the unresolved qualification until then.",
    });
  }
  const conclusion = evidenceLimited ? "evidence_limited" : challenges.length ? "review_required" : "ready_for_research";
  return {
    methodology: "cross_agent_evidence_review_v1",
    conclusion,
    summary: conclusion === "evidence_limited"
      ? "The committee cannot establish a verified thesis from the available evidence; unresolved challenges take precedence over opportunity rankings."
      : conclusion === "review_required"
        ? "Specialist challenges remain unresolved. Preserve the scenario as a research baseline and investigate the stated conditions before accepting its rationale."
        : "No conflict was detected by the implemented evidence, risk-tolerance, concentration, stress, history, and screening checks. This supports further research, not investment suitability.",
    challenges,
    nextResearchSteps: [...new Set(challenges.map((item) => item.reassessmentCondition))],
  };
}
