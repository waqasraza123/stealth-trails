import { buildSyntheticOpportunityCatalog } from "./opportunity-hunter.catalog";
import { ResearchPlanService } from "./research-plan.service";
import type { InvestmentCommitteeReview } from "./investment-committee.types";

describe("committee review propagation to saved strategy", () => {
  it("persists specialist objections and reassessment conditions with the plan", async () => {
    const catalog = buildSyntheticOpportunityCatalog();
    const prisma = {
      customer: { findUnique: jest.fn().mockResolvedValue({ id: "customer" }) },
      auditEvent: { create: jest.fn().mockResolvedValue({ id: "event" }) },
    };
    const opportunities = {
      analyze: jest.fn().mockResolvedValue({
        opportunities: catalog,
        ai: { insights: [], externalAiUsed: false },
        dataset: { kind: "synthetic_research", asOf: "2026-10-24T00:00:00Z", methodologyVersion: "test" },
      }),
    };
    type Dependencies = ConstructorParameters<typeof ResearchPlanService>;
    const service = new ResearchPlanService(
      prisma as unknown as Dependencies[0],
      opportunities as unknown as Dependencies[1],
      {} as Dependencies[2],
      { assertAllowed: jest.fn().mockResolvedValue(undefined) } as unknown as Dependencies[3],
    );
    const review: InvestmentCommitteeReview = {
      methodology: "cross_agent_evidence_review_v1", conclusion: "evidence_limited",
      summary: "A synthetic scenario cannot establish a verified thesis.",
      challenges: [{ id: "evidence_quality", reviewer: "chief-research-agent", target: "strategy-agent", severity: "high", reason: "Synthetic inputs require qualification.", evidenceIds: [], reassessmentCondition: "Replace synthetic evidence and repeat stress analysis." }],
      nextResearchSteps: ["Replace synthetic evidence and repeat stress analysis."],
    };
    const plan = await service.createPlan("user", {
      title: "Committee scenario", externalAiOptIn: false,
      goal: { objective: "Compare scenarios", initialAmountUsd: 1000, monthlyContributionUsd: 0, targetAmountUsd: null, horizonMonths: 24, riskTolerance: "balanced", ethicalPreferences: [] },
      allocations: [{ opportunityId: catalog[0].id, percent: 100 }],
    }, review);
    expect(plan.strategy.rationale[0]).toBe(review.summary);
    expect(plan.strategy.risks).toContain(review.challenges[0].reason);
    expect(plan.strategy.researchSteps[0]).toBe(review.nextResearchSteps[0]);
    expect(plan.strategy.reassessmentConditions).toContain(review.nextResearchSteps[0]);
    expect(prisma.auditEvent.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ metadata: { plan } }) }));
    expect(plan.scenarios).toHaveLength(3);
  });
});
