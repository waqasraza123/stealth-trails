import { NotFoundException } from "@nestjs/common";
import { scoreOpportunity } from "./opportunity-hunter.catalog";
import { OpportunityHunterService } from "./opportunity-hunter.service";
import type { OpportunityAnalystProvider } from "./opportunity-analyst.provider";
import { MarketDataService } from "./market-data.service";

function createProvider(
  externalAiAvailable = false,
): OpportunityAnalystProvider {
  return {
    getCapabilities: jest.fn().mockReturnValue({
      available: externalAiAvailable,
      providerName: externalAiAvailable ? "openai_compatible" : null,
      model: externalAiAvailable ? "configured-model" : null,
      disclosure: [],
    }),
    analyze: jest.fn(),
  };
}

function createService(provider = createProvider()) {
  const market = {
    getSnapshot: jest
      .fn()
      .mockResolvedValue({
        assets: [],
        provider: "disabled",
        status: "unavailable",
        fetchedAt: null,
        failureReason: null,
      }),
  } as unknown as MarketDataService;
  return new OpportunityHunterService(market, provider);
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

  it("returns only clearly labeled synthetic research with complete explanations", async () => {
    const provider = createProvider();
    const service = createService(provider);
    const result = await service.discover();

    expect(result.dataset.kind).toBe("synthetic_research");
    expect(result.scoringMethodology.deterministic).toBe(true);
    expect(result.ai.externalAiUsed).toBe(false);
    expect(result.ai.capabilities.externalAiAvailable).toBe(false);
    expect(provider.analyze).not.toHaveBeenCalled();
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

  it("reports provider availability without invoking the external provider", async () => {
    const provider = createProvider(true);
    const service = createService(provider);

    const result = await service.discover();

    expect(result.ai.capabilities.externalAiAvailable).toBe(true);
    expect(result.ai.analysisMode).toBe("deterministic_rules");
    expect(result.ai.externalAiUsed).toBe(false);
    expect(provider.analyze).not.toHaveBeenCalled();
  });

  it("returns a synthetic detail record and rejects unknown ids", async () => {
    const service = createService();

    expect((await service.findOne("syn-onchain-payments-index")).symbol).toBe(
      "SYN-PAY",
    );
    await expect(service.findOne("missing")).rejects.toThrow(NotFoundException);
  });
});
