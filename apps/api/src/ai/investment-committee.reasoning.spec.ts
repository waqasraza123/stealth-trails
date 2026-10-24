import { reviewCommitteeEvidence } from "./investment-committee.reasoning";
import type { OpportunityHunterResponse } from "./opportunity-hunter.types";
import type { PortfolioRiskAnalysis } from "./portfolio-risk.types";
import type { InvestmentCommitteeMissionInput } from "./investment-committee.types";
import type { HalalFinding } from "./investment-committee.tools";

function fixture() {
  const input: InvestmentCommitteeMissionInput = {
    goal: "Research a balanced scenario", externalAiConsent: false,
    portfolioValueUsd: 1000, horizonMonths: 24, riskTolerance: "balanced", ethicalPreferences: [],
  };
  // Only fields read by the pure reviewer are needed in these tool-result fixtures.
  const research = {
    dataset: { kind: "live_market", reliability: "live" },
    opportunities: [{ id: "selected", synthetic: false, evidence: [{ id: "market", synthetic: false }], halalScreening: { ruleResults: [{ evidence: [{ evidenceId: "screen", synthetic: false }] }] } }],
  } as OpportunityHunterResponse;
  const risk = {
    current: { metrics: { weightedRiskScore: 2, riskLabel: "moderate", maximumAssetWeightPercent: 40, historicalCoveragePercent: 100 }, guardian: { healthLabel: "resilient" } },
    evidence: [{ id: "risk", synthetic: false }],
    dataQuality: { datasetKind: "live_market", reliability: "live" },
  } as PortfolioRiskAnalysis;
  const halal: HalalFinding[] = [{ opportunityId: "selected", name: "Selected asset", status: "eligible", rationale: [], evidenceGaps: [], evidenceIds: ["screen"] }];
  return { input, research, risk, halal, allocations: [{ opportunityId: "selected", percent: 100 }] };
}

describe("committee cross-agent evidence review", () => {
  it("supports only further research when the implemented checks find no conflict", () => {
    const review = reviewCommitteeEvidence(fixture());
    expect(review.conclusion).toBe("ready_for_research");
    expect(review.challenges).toEqual([]);
    expect(review.summary).toContain("not investment suitability");
  });

  it.each(["synthetic", "stale", "missing", "mixed", "risk-fallback", "risk-missing", "synthetic-screen"])("does not turn %s evidence into a verified thesis", (mode) => {
    const args = fixture();
    if (mode === "synthetic") args.research.dataset.kind = "synthetic_research";
    if (mode === "stale") args.research.dataset.reliability = "stale";
    if (mode === "missing") args.research.opportunities[0].evidence = [];
    if (mode === "mixed") args.research.opportunities[0].evidence[0].synthetic = true;
    if (mode === "risk-fallback") args.risk.dataQuality.reliability = "fallback";
    if (mode === "risk-missing") args.risk.evidence = [];
    if (mode === "synthetic-screen") args.research.opportunities[0].halalScreening.ruleResults[0].evidence[0].synthetic = true;
    const review = reviewCommitteeEvidence(args);
    expect(review.conclusion).toBe("evidence_limited");
    expect(review.challenges).toEqual(expect.arrayContaining([expect.objectContaining({ id: "evidence_quality", severity: "high" })]));
  });

  it("carries independent objections and concrete reassessment conditions to strategy", () => {
    const args = fixture();
    args.input.riskTolerance = "conservative";
    args.risk.current.metrics.maximumAssetWeightPercent = 75;
    args.risk.current.metrics.historicalCoveragePercent = 35;
    args.risk.current.guardian.healthLabel = "vulnerable";
    args.halal[0].evidenceGaps = ["Missing issuer disclosure"];
    const review = reviewCommitteeEvidence(args);
    expect(review.conclusion).toBe("review_required");
    expect(review.challenges.map((item) => item.id)).toEqual(["risk_tolerance", "concentration", "stress_resilience", "historical_coverage", "screening:selected"]);
    expect(review.challenges.find((item) => item.id === "risk_tolerance")).toMatchObject({ reviewer: "risk-agent", target: "strategy-agent", evidenceIds: ["risk"] });
    expect(review.nextResearchSteps).toHaveLength(5);
    expect(review.challenges.every((item) => item.reassessmentCondition.length > 0)).toBe(true);
  });

  it("reviews selected allocations instead of unrelated high-scoring catalog entries", () => {
    const args = fixture();
    args.research.opportunities.unshift({ ...args.research.opportunities[0], id: "unselected", synthetic: true, evidence: [] });
    args.halal.push({ opportunityId: "unselected", name: "Other asset", status: "excluded", rationale: [], evidenceGaps: [], evidenceIds: [] });
    expect(reviewCommitteeEvidence(args).challenges).toEqual([]);
  });

  it("treats absent selected assets and absent screening results as missing evidence", () => {
    const args = fixture();
    args.allocations.push({ opportunityId: "unknown", percent: 10 });
    const review = reviewCommitteeEvidence(args);
    expect(review.conclusion).toBe("evidence_limited");
    expect(review.challenges.map((item) => item.id)).toContain("screening:unknown");
  });

  it("requires linked evidence even when a screen says eligible", () => {
    const args = fixture();
    args.halal[0].evidenceIds = [];
    expect(reviewCommitteeEvidence(args).challenges[0]).toMatchObject({ id: "screening:selected", severity: "high" });
  });

  it("does not flag higher risk as a tolerance conflict for a growth mandate", () => {
    const args = fixture();
    args.input.riskTolerance = "growth";
    args.risk.current.metrics.riskLabel = "higher";
    args.risk.current.metrics.weightedRiskScore = 3;
    expect(reviewCommitteeEvidence(args).challenges).toEqual([]);
  });

  it("detects a tolerance breach even within the same broad risk label", () => {
    const args = fixture();
    args.risk.current.metrics.weightedRiskScore = 2.3;
    expect(reviewCommitteeEvidence(args).challenges.map((item) => item.id)).toContain("risk_tolerance");
  });
});
