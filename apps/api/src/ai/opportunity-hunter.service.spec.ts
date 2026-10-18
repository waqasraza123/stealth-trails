import { NotFoundException } from "@nestjs/common";
import { scoreOpportunity } from "./opportunity-hunter.catalog";
import { OpportunityHunterService } from "./opportunity-hunter.service";
import type { WealthBriefProvider } from "./wealth-brief.provider";

function createProvider(externalAiAvailable = false): WealthBriefProvider {
  return {
    getCapabilities: jest.fn().mockReturnValue({
      externalAiAvailable,
      providerName: externalAiAvailable ? "openai_compatible" : null,
      model: externalAiAvailable ? "configured-model" : null,
      disclosure: [],
    }),
    generate: jest.fn(),
  };
}

describe("OpportunityHunterService", () => {
  it("calculates scores from the published deterministic rule", () => {
    const result = scoreOpportunity(
      {
        fundamentals: 80,
        momentum: 70,
        liquidity: 60,
        evidenceQuality: 90,
      },
      "moderate",
    );

    expect(result.scoreBreakdown.map((component) => component.points)).toEqual([
      24, 14, 9, 14, 14,
    ]);
    expect(result.score).toBe(75);
    expect(result.scoreLabel).toBe("promising");
  });

  it("returns only clearly labeled synthetic research with complete explanations", () => {
    const provider = createProvider();
    const service = new OpportunityHunterService(provider);
    const result = service.discover();

    expect(result.dataset.kind).toBe("synthetic_research");
    expect(result.scoringMethodology.deterministic).toBe(true);
    expect(result.ai.externalAiUsed).toBe(false);
    expect(result.ai.capabilities.externalAiAvailable).toBe(false);
    expect(provider.generate).not.toHaveBeenCalled();
    expect(result.opportunities).toHaveLength(6);

    for (const opportunity of result.opportunities) {
      expect(opportunity.synthetic).toBe(true);
      expect(opportunity.score).toBeGreaterThanOrEqual(0);
      expect(opportunity.score).toBeLessThanOrEqual(100);
      expect(opportunity.scoreBreakdown).toHaveLength(5);
      expect(opportunity.scenarios.map((scenario) => scenario.kind)).toEqual([
        "upside",
        "base",
        "downside",
      ]);
      expect(opportunity.evidence.length).toBeGreaterThanOrEqual(2);
      expect(opportunity.researchPlan.exitConditions.length).toBeGreaterThan(0);
      expect(opportunity.halalScreening.disclaimer).toMatch(
        /not a fatwa, religious ruling, or certification/i,
      );
    }
  });

  it("reports provider availability without invoking the external provider", () => {
    const provider = createProvider(true);
    const service = new OpportunityHunterService(provider);

    const result = service.discover();

    expect(result.ai.capabilities.externalAiAvailable).toBe(true);
    expect(result.ai.analysisMode).toBe("deterministic_rules");
    expect(result.ai.externalAiUsed).toBe(false);
    expect(provider.generate).not.toHaveBeenCalled();
  });

  it("returns a synthetic detail record and rejects unknown ids", () => {
    const service = new OpportunityHunterService(createProvider());

    expect(service.findOne("syn-onchain-payments-index").symbol).toBe(
      "SYN-PAY",
    );
    expect(() => service.findOne("missing")).toThrow(NotFoundException);
  });
});
