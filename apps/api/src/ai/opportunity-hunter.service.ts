import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { MarketDataService } from "./market-data.service";
import {
  halalScreeningMethodology,
  loadHalalScreeningConfig,
} from "./halal-screening.engine";
import {
  InvalidOpportunityAnalystOutputError,
  OPPORTUNITY_ANALYST_PROVIDER,
  type OpportunityAnalystProvider,
} from "./opportunity-analyst.provider";
import { buildSyntheticOpportunityCatalog } from "./opportunity-hunter.catalog";
import type {
  Opportunity,
  OpportunityHunterResponse,
} from "./opportunity-hunter.types";
import { buildLiveOpportunityCatalog } from "./opportunity-live.catalog";
import { getAttachedProviderUsage } from "./ai-provider-usage";

@Injectable()
export class OpportunityHunterService {
  constructor(
    private readonly marketData: MarketDataService,
    @Inject(OPPORTUNITY_ANALYST_PROVIDER)
    private readonly analyst: OpportunityAnalystProvider,
  ) {}

  getAnalystCapabilities() {
    return this.analyst.getCapabilities();
  }

  async discover(): Promise<OpportunityHunterResponse> {
    const market = await this.marketData.getSnapshot();
    // Recorded fixtures remain explicitly synthetic research, never live-market evidence.
    const isLive = market.assets.length > 0 && market.provider !== "recorded";
    const screeningConfig = loadHalalScreeningConfig();
    const opportunities = isLive
      ? buildLiveOpportunityCatalog(market.assets, screeningConfig)
      : buildSyntheticOpportunityCatalog(screeningConfig);
    const capabilities = this.analyst.getCapabilities();
    const reliability = !isLive
      ? ("fallback" as const)
      : market.status === "live"
        ? ("live" as const)
        : market.status === "cached"
          ? ("cached" as const)
          : ("stale" as const);

    return {
      dataset: {
        kind: isLive ? "live_market" : "synthetic_research",
        label: isLive
          ? `${market.provider} verified market snapshot`
          : "Synthetic research fallback",
        asOf:
          market.fetchedAt ??
          opportunities[0]?.updatedAt ??
          new Date(0).toISOString(),
        methodologyVersion: isLive
          ? "market-opportunity-score-v2+preliminary-halal-screen-v1"
          : "opportunity-score-v1+preliminary-halal-screen-v1",
        disclaimer: isLive
          ? "Prices and market metrics are provider-supplied, point-in-time observations. Scores, scenarios, and plans are educational research outputs—not advice, forecasts, offers, or recommendations."
          : "Live market data is unavailable. Every opportunity, signal, evidence item, and scenario shown in this fallback is simulated.",
        provider: market.provider,
        reliability,
        failureReason: market.failureReason,
      },
      scoringMethodology: {
        deterministic: true,
        summary: isLive
          ? "Scores are calculated only from verified provider metrics. AI may rank evidence but cannot change a score."
          : "Fallback scores use fixed synthetic inputs. AI cannot change a score.",
        formula: isLive
          ? "Momentum (25) + liquidity depth (25) + volatility adjustment (20) + market maturity (15) + evidence completeness (15)."
          : "Fundamentals (30) + adoption momentum (20) + liquidity resilience (15) + evidence quality (15) + fixed risk adjustment (20).",
        maximumScore: 100,
      },
      halalScreeningMethodology: halalScreeningMethodology(screeningConfig),
      ai: {
        analysisMode: "deterministic_rules",
        externalAiUsed: false,
        analystEnabled: capabilities.available,
        capabilities: {
          externalAiAvailable: capabilities.available,
          providerName: capabilities.providerName,
          model: capabilities.model,
          disclosure: capabilities.disclosure,
        },
        boundaryNote: capabilities.available
          ? "AI analysis requires explicit consent for each request. It can only rank server-verified opportunity, evidence, and screening-rule IDs; it cannot create facts, alter deterministic scores or screens, or issue religious rulings."
          : "External opportunity analysis is disabled. Enablement requires the secured AI provider, a non-production environment, and the separate opportunity-analyst flag.",
        fallbackReason: null,
        providerUsage: null,
        insights: [],
      },
      opportunities,
    };
  }

  async analyze(externalAiOptIn: boolean): Promise<OpportunityHunterResponse> {
    const result = await this.discover();
    if (
      !externalAiOptIn ||
      !result.ai.analystEnabled ||
      result.dataset.kind !== "live_market"
    ) {
      return result;
    }

    try {
      const selections = await this.analyst.analyze(result.opportunities);
      const providerUsage = getAttachedProviderUsage(selections);
      const byId = new Map(
        result.opportunities.map((opportunity) => [opportunity.id, opportunity]),
      );
      const selectedIds = new Set(
        selections.map((selection) => selection.opportunityId),
      );
      result.opportunities = [
        ...selections
          .map((selection) => byId.get(selection.opportunityId))
          .filter((value): value is Opportunity => Boolean(value)),
        ...result.opportunities.filter(
          (opportunity) => !selectedIds.has(opportunity.id),
        ),
      ];
      result.ai = {
        ...result.ai,
        analysisMode: "ai_ranked",
        externalAiUsed: true,
        providerUsage,
        insights: selections.map((selection) => {
          const opportunity = byId.get(selection.opportunityId)!;
          const evidenceById = new Map(
            opportunity.evidence.map((evidence) => [evidence.id, evidence]),
          );
          return {
            opportunityId: opportunity.id,
            headline: `AI prioritized ${opportunity.name} for deeper research`,
            reasoning: selection.evidenceIds
              .map((id) => evidenceById.get(id)?.finding)
              .filter((value): value is string => Boolean(value)),
            evidenceIds: selection.evidenceIds,
            screeningRuleIds: selection.screeningRuleIds,
            halalExplanation: selection.screeningRuleIds
              .map(
                (id) =>
                  opportunity.halalScreening.ruleResults.find(
                    (result) => result.ruleId === id,
                  )?.explanation,
              )
              .filter((value): value is string => Boolean(value)),
            risks: opportunity.researchPlan.exitConditions.slice(0, 2),
          };
        }),
      };
      return result;
    } catch (error) {
      result.ai.fallbackReason =
        error instanceof InvalidOpportunityAnalystOutputError
          ? "invalid_provider_output"
          : "provider_failure";
      result.ai.boundaryNote =
        "The external analyst did not produce a valid evidence-bound selection. Deterministic research remains available and no AI output is shown.";
      return result;
    }
  }

  async findOne(id: string): Promise<Opportunity> {
    const opportunity = (await this.discover()).opportunities.find(
      (candidate) => candidate.id === id,
    );

    if (!opportunity) {
      throw new NotFoundException({
        code: "OPPORTUNITY_NOT_FOUND",
        message: "The requested research opportunity was not found.",
      });
    }

    return opportunity;
  }
}
