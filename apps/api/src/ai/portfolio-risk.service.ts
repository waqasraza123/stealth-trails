import { BadRequestException, Injectable } from "@nestjs/common";
import {
  calculateDiversification,
  calculateHalalWeights,
  calculateWeightedRisk,
  roundRiskValue,
} from "./portfolio-risk.engine";
import { OpportunityHunterService } from "./opportunity-hunter.service";
import type { Opportunity } from "./opportunity-hunter.types";
import type {
  PortfolioRiskAnalysis,
  PortfolioRiskEvidence,
  PortfolioRiskRequest,
  PortfolioRiskSnapshot,
} from "./portfolio-risk.types";

const DISCLAIMER =
  "Portfolio Risk Lab is an educational, read-only simulation. Stress results are hypothetical, not forecasts, personalized investment instructions, guaranteed outcomes, or authorization to rebalance or transact.";

type SelectedAllocation = {
  opportunity: Opportunity;
  percent: number;
};

function drawdownPercent(prices: number[]): number | null {
  if (prices.length < 2) return null;
  let peak = prices[0];
  let largest = 0;
  for (const price of prices) {
    if (price <= 0) continue;
    peak = Math.max(peak, price);
    if (peak > 0) largest = Math.max(largest, ((peak - price) / peak) * 100);
  }
  return roundRiskValue(largest);
}

function aggregateExposure(
  selected: SelectedAllocation[],
  label: (item: SelectedAllocation) => string,
): Array<{ label: string; percent: number }> {
  const values = new Map<string, number>();
  for (const item of selected) {
    const key = label(item);
    values.set(key, roundRiskValue((values.get(key) ?? 0) + item.percent));
  }
  return [...values.entries()]
    .map(([exposureLabel, percent]) => ({ label: exposureLabel, percent }))
    .sort((left, right) => right.percent - left.percent);
}

@Injectable()
export class PortfolioRiskService {
  constructor(private readonly opportunities: OpportunityHunterService) {}

  async analyze(input: {
    allocations: PortfolioRiskRequest["allocations"];
    portfolioValueUsd: number;
    hypothetical?: PortfolioRiskRequest;
  }): Promise<PortfolioRiskAnalysis> {
    const research = await this.opportunities.discover();
    const evidence: PortfolioRiskEvidence[] = [];
    const current = this.buildSnapshot(
      input.allocations,
      input.portfolioValueUsd,
      research.opportunities,
      evidence,
    );
    const hypothetical = input.hypothetical
      ? this.buildSnapshot(
          input.hypothetical.allocations,
          input.hypothetical.portfolioValueUsd,
          research.opportunities,
          evidence,
        )
      : null;
    const currentCrash = current.stressTests.find(
      (scenario) => scenario.id === "market_crash",
    )!;
    const hypotheticalCrash = hypothetical?.stressTests.find(
      (scenario) => scenario.id === "market_crash",
    );

    return {
      current,
      hypothetical,
      comparison:
        hypothetical && hypotheticalCrash
          ? {
              weightedRiskDelta: roundRiskValue(
                hypothetical.metrics.weightedRiskScore -
                  current.metrics.weightedRiskScore,
              ),
              diversificationDelta: roundRiskValue(
                hypothetical.metrics.diversificationScore -
                  current.metrics.diversificationScore,
              ),
              maximumWeightDelta: roundRiskValue(
                hypothetical.metrics.maximumAssetWeightPercent -
                  current.metrics.maximumAssetWeightPercent,
              ),
              weightedVolatilityDelta:
                hypothetical.metrics.weightedVolatilityPercent === null ||
                current.metrics.weightedVolatilityPercent === null
                  ? null
                  : roundRiskValue(
                      hypothetical.metrics.weightedVolatilityPercent -
                        current.metrics.weightedVolatilityPercent,
                    ),
              crashOutcomeDeltaUsd: roundRiskValue(
                hypotheticalCrash.changeUsd - currentCrash.changeUsd,
              ),
              healthScoreDelta:
                hypothetical.guardian.healthScore - current.guardian.healthScore,
            }
          : null,
      evidence: evidence.filter(
        (item, index, all) =>
          all.findIndex((candidate) => candidate.id === item.id) === index,
      ),
      dataQuality: {
        datasetKind: research.dataset.kind,
        provider: research.dataset.provider,
        reliability: research.dataset.reliability,
        asOf: research.dataset.asOf,
        historicalWindow:
          research.dataset.kind === "live_market" &&
          research.opportunities.some(
            (opportunity) =>
              (opportunity.marketData?.sparkline7dUsd.length ?? 0) >= 2,
          )
            ? "verified_7_day_price_series"
            : "unavailable",
        note:
          research.dataset.kind === "live_market"
            ? "Volatility and drawdown use provider-supplied seven-day price observations where complete. Stress tests remain hypothetical."
            : "Verified historical price series are unavailable. Market history is not inferred; every stress result is labeled hypothetical.",
      },
      methodology: {
        version: `portfolio-risk-v1+${research.dataset.methodologyVersion}`,
        deterministic: true,
        reproducible: true,
        externalAiUsed: false,
        notes: [
          "Weighted risk, diversification, and halal exposure reuse the Research Plan Studio calculation engine.",
          "Concentration uses the Herfindahl index; effective asset count is its reciprocal.",
          "Weighted volatility normalizes across allocations with verified volatility and reports historical coverage separately.",
          "Scenario shocks use fixed published rules and never initiate rebalancing or a transaction.",
        ],
      },
      disclaimer: DISCLAIMER,
    };
  }

  private buildSnapshot(
    inputs: PortfolioRiskRequest["allocations"],
    portfolioValueUsd: number,
    opportunities: Opportunity[],
    evidence: PortfolioRiskEvidence[],
  ): PortfolioRiskSnapshot {
    this.validateAllocations(inputs);
    const byId = new Map(opportunities.map((item) => [item.id, item]));
    const selected = inputs.map((allocation) => {
      const opportunity = byId.get(allocation.opportunityId);
      if (!opportunity) {
        throw new BadRequestException(
          `Opportunity ${allocation.opportunityId} is not available in the current research dataset.`,
        );
      }
      return { opportunity, percent: roundRiskValue(allocation.percent) };
    });
    const weighted = selected.map(({ opportunity, percent }) => ({
      percent,
      riskLevel: opportunity.riskLevel,
      halalStatus: opportunity.halalScreening.status,
    }));
    const risk = calculateWeightedRisk(weighted);
    const diversification = calculateDiversification(weighted);
    const halal = calculateHalalWeights(weighted);
    const historicalCoverage = selected.reduce(
      (total, item) =>
        total +
        (item.opportunity.marketData?.realizedVolatility7dPercent === null ||
        item.opportunity.marketData?.realizedVolatility7dPercent === undefined
          ? 0
          : item.percent),
      0,
    );
    const weightedVolatility =
      historicalCoverage === 0
        ? null
        : roundRiskValue(
            selected.reduce(
              (total, item) =>
                total +
                (item.opportunity.marketData?.realizedVolatility7dPercent ?? 0) *
                  item.percent,
              0,
            ) / historicalCoverage,
          );
    const allocationRows = selected.map(({ opportunity, percent }) => {
      const marketEvidenceId = opportunity.marketData
        ? `risk-market:${opportunity.id}:${opportunity.marketData.observedAt}`
        : `risk-synthetic:${opportunity.id}:${opportunity.updatedAt}`;
      evidence.push({
        id: marketEvidenceId,
        label: opportunity.marketData
          ? `${opportunity.name} verified market snapshot`
          : `${opportunity.name} synthetic research fallback`,
        sourceType: opportunity.marketData
          ? "verified_market"
          : "synthetic_research",
        observedAt:
          opportunity.marketData?.observedAt ?? opportunity.updatedAt,
        synthetic: opportunity.synthetic,
      });
      const screeningEvidenceIds = opportunity.halalScreening.ruleResults
        .flatMap((rule) => rule.evidence)
        .map((item) => {
          const id = `risk-halal:${opportunity.id}:${item.evidenceId}`;
          evidence.push({
            id,
            label: `${opportunity.name}: ${item.sourceLabel}`,
            sourceType: "halal_screen",
            observedAt: item.observedAt,
            synthetic: item.synthetic,
          });
          return id;
        });
      return {
        opportunityId: opportunity.id,
        name: opportunity.name,
        symbol: opportunity.symbol,
        category: opportunity.category,
        network: opportunity.network,
        percent,
        valueUsd: roundRiskValue((portfolioValueUsd * percent) / 100),
        riskLevel: opportunity.riskLevel,
        halalStatus: opportunity.halalScreening.status,
        volatility7dAnnualizedPercent:
          opportunity.marketData?.realizedVolatility7dPercent ?? null,
        historicalDrawdown7dPercent: opportunity.marketData
          ? drawdownPercent(opportunity.marketData.sparkline7dUsd)
          : null,
        evidenceIds: [marketEvidenceId, ...screeningEvidenceIds],
      };
    });
    const stressTests = this.buildStressTests(selected, portfolioValueUsd);
    const flaggedAllocations: PortfolioRiskSnapshot["halal"]["flaggedAllocations"] =
      allocationRows.flatMap((allocation) =>
        allocation.halalStatus === "eligible"
          ? []
          : [
              {
                opportunityId: allocation.opportunityId,
                name: allocation.name,
                percent: allocation.percent,
                status: allocation.halalStatus,
                evidenceIds: allocation.evidenceIds,
              },
            ],
      );
    const healthScore = Math.max(
      0,
      Math.min(
        100,
        Math.round(
          100 -
            Math.max(0, diversification.maximumWeight - 35) * 0.75 -
            Math.max(0, risk.score - 1) * 18 -
            (weightedVolatility === null
              ? 12
              : Math.max(0, weightedVolatility - 45) * 0.12) -
            (halal.statusWeights.excluded * 0.45 +
              halal.statusWeights.questionable * 0.22 +
              halal.statusWeights.insufficient_evidence * 0.16),
        ),
      ),
    );
    const largest = [...allocationRows].sort(
      (left, right) => right.percent - left.percent,
    )[0];
    const weaknesses: PortfolioRiskSnapshot["guardian"]["weaknesses"] = [];
    if (largest.percent >= 50) {
      weaknesses.push({
        severity: largest.percent >= 70 ? "high" : "warning",
        finding: `${largest.percent}% is concentrated in ${largest.name}; this is the portfolio's largest single-asset dependency.`,
        evidenceIds: largest.evidenceIds,
      });
    }
    if (halal.statusWeights.excluded > 0 || halal.statusWeights.questionable > 0) {
      weaknesses.push({
        severity: halal.statusWeights.excluded > 0 ? "high" : "warning",
        finding: `${roundRiskValue(halal.statusWeights.excluded + halal.statusWeights.questionable)}% of allocation is excluded or questionable under the preliminary halal screen.`,
        evidenceIds: flaggedAllocations.flatMap((item) => item.evidenceIds),
      });
    }
    if (historicalCoverage < 100) {
      weaknesses.push({
        severity: historicalCoverage === 0 ? "warning" : "info",
        finding: `Verified seven-day volatility covers ${roundRiskValue(historicalCoverage)}% of allocation; missing history is not estimated.`,
        evidenceIds: allocationRows.flatMap((item) => item.evidenceIds),
      });
    }
    const emergingRisks = allocationRows.flatMap((allocation) => {
      const opportunity = byId.get(allocation.opportunityId)!;
      const findings: PortfolioRiskSnapshot["guardian"]["emergingRisks"] = [];
      if ((allocation.volatility7dAnnualizedPercent ?? 0) >= 90) {
        findings.push({
          severity: "high",
          finding: `${allocation.name} has ${allocation.volatility7dAnnualizedPercent}% annualized realized volatility in the verified seven-day series and represents ${allocation.percent}% of allocation.`,
          evidenceIds: allocation.evidenceIds,
        });
      }
      if (opportunity.marketData?.trend === "downtrend") {
        findings.push({
          severity: "warning",
          finding: `${allocation.name} is in the deterministic downtrend band in the latest provider snapshot.`,
          evidenceIds: allocation.evidenceIds,
        });
      }
      return findings;
    });
    const monitoringOpportunities = allocationRows
      .sort((left, right) => right.percent - left.percent)
      .slice(0, 3)
      .map((allocation) => ({
        finding: `Monitor ${allocation.name} volatility, trend, liquidity, and halal-screen evidence because it contributes ${allocation.percent}% of portfolio exposure.`,
        evidenceIds: allocation.evidenceIds,
      }));

    return {
      allocations: allocationRows,
      metrics: {
        weightedRiskScore: risk.score,
        riskLabel: risk.label,
        diversificationScore: diversification.score,
        concentrationIndex: diversification.concentrationIndex,
        effectiveAssetCount: diversification.effectiveAssetCount,
        maximumAssetWeightPercent: diversification.maximumWeight,
        weightedVolatilityPercent: weightedVolatility,
        historicalCoveragePercent: roundRiskValue(historicalCoverage),
      },
      exposures: {
        byAsset: aggregateExposure(selected, (item) => item.opportunity.symbol),
        byCategory: aggregateExposure(
          selected,
          (item) => item.opportunity.category,
        ),
        byNetwork: aggregateExposure(selected, (item) => item.opportunity.network),
        byRisk: aggregateExposure(
          selected,
          (item) => item.opportunity.riskLevel,
        ) as PortfolioRiskSnapshot["exposures"]["byRisk"],
      },
      halal: {
        ...halal,
        flaggedAllocations,
        disclaimer:
          "These are transparent preliminary screens, not religious certification. Questionable, excluded, and insufficient-evidence exposure is not reinterpreted.",
      },
      stressTests,
      guardian: {
        mode: "deterministic_evidence_guardian",
        externalAiUsed: false,
        healthScore,
        healthLabel:
          healthScore >= 75
            ? "resilient"
            : healthScore >= 50
              ? "watch"
              : "vulnerable",
        weaknesses:
          weaknesses.length > 0
            ? weaknesses
            : [
                {
                  severity: "info",
                  finding:
                    "No threshold-level concentration or halal-screen weakness was detected; this does not establish that the portfolio is safe.",
                  evidenceIds: allocationRows.flatMap((item) => item.evidenceIds),
                },
              ],
        emergingRisks:
          emergingRisks.length > 0
            ? emergingRisks
            : [
                {
                  severity: "info",
                  finding:
                    "No configured volatility or downtrend threshold is currently triggered; continue monitoring as market conditions change.",
                  evidenceIds: allocationRows.flatMap((item) => item.evidenceIds),
                },
              ],
        monitoringOpportunities,
        boundaryNote:
          "The Risk Guardian is evidence-bound and deterministic. External AI is disabled, it does not predict prices, and it cannot rebalance or transact.",
      },
    };
  }

  private buildStressTests(
    selected: SelectedAllocation[],
    portfolioValueUsd: number,
  ): PortfolioRiskSnapshot["stressTests"] {
    const largestId = [...selected].sort(
      (left, right) => right.percent - left.percent,
    )[0].opportunity.id;
    const definitions: Array<{
      id: PortfolioRiskSnapshot["stressTests"][number]["id"];
      label: string;
      description: string;
      shock: (item: SelectedAllocation) => number;
      assumptions: string[];
    }> = [
      {
        id: "market_crash",
        label: "Broad market crash",
        description: "A simultaneous downside shock scaled by the existing risk band.",
        shock: (item) =>
          ({ lower: -24, moderate: -36, higher: -48 })[
            item.opportunity.riskLevel
          ],
        assumptions: [
          "All assets reprice at once",
          "No diversification benefit or rebalancing is assumed during the shock",
        ],
      },
      {
        id: "asset_shock",
        label: "Largest-asset shock",
        description: "The largest allocation falls sharply while other positions experience spillover.",
        shock: (item) => (item.opportunity.id === largestId ? -60 : -8),
        assumptions: [
          "The largest allocation declines 60%",
          "Every other allocation declines 8% from spillover",
        ],
      },
      {
        id: "volatility_spike",
        label: "Volatility spike",
        description: "A fixed adverse move scaled by each asset's current risk classification.",
        shock: (item) =>
          ({ lower: -12, moderate: -20, higher: -30 })[
            item.opportunity.riskLevel
          ],
        assumptions: [
          "Risk classifications remain fixed for the scenario",
          "No liquidity, fee, slippage, or tax effects are modeled",
        ],
      },
      {
        id: "recovery",
        label: "Partial recovery",
        description: "A hypothetical positive recovery with larger moves in higher-risk assets.",
        shock: (item) =>
          ({ lower: 14, moderate: 24, higher: 34 })[
            item.opportunity.riskLevel
          ],
        assumptions: [
          "The recovery is hypothetical and is not linked to a forecast horizon",
          "Allocation weights are held constant without rebalancing",
        ],
      },
    ];
    return definitions.map((definition) => {
      const assetImpacts = selected.map((item) => {
        const shockPercent = definition.shock(item);
        return {
          opportunityId: item.opportunity.id,
          symbol: item.opportunity.symbol,
          shockPercent,
          impactUsd: roundRiskValue(
            portfolioValueUsd * (item.percent / 100) * (shockPercent / 100),
          ),
        };
      });
      const changeUsd = roundRiskValue(
        assetImpacts.reduce((total, item) => total + item.impactUsd, 0),
      );
      return {
        id: definition.id,
        label: definition.label,
        description: definition.description,
        basis: "hypothetical" as const,
        portfolioReturnPercent:
          portfolioValueUsd === 0
            ? roundRiskValue(
                selected.reduce(
                  (total, item) =>
                    total + definition.shock(item) * (item.percent / 100),
                  0,
                ),
              )
            : roundRiskValue((changeUsd / portfolioValueUsd) * 100),
        projectedValueUsd: roundRiskValue(portfolioValueUsd + changeUsd),
        changeUsd,
        assetImpacts,
        assumptions: definition.assumptions,
      };
    });
  }

  private validateAllocations(
    allocations: PortfolioRiskRequest["allocations"],
  ): void {
    if (
      new Set(allocations.map((item) => item.opportunityId)).size !==
      allocations.length
    ) {
      throw new BadRequestException("Each opportunity may appear only once.");
    }
    const total = allocations.reduce((sum, item) => sum + item.percent, 0);
    if (Math.abs(total - 100) > 0.01) {
      throw new BadRequestException(
        `Allocation percentages must total 100; received ${roundRiskValue(total)}.`,
      );
    }
  }
}
