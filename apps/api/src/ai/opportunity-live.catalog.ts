import type { MarketAssetSnapshot } from "./market-data.provider";
import {
  DEFAULT_HALAL_SCREENING_CONFIG,
  screenOpportunity,
  type HalalScreeningConfig,
} from "./halal-screening.engine";
import type {
  Opportunity,
  OpportunityCategory,
  OpportunityMarketData,
  OpportunityRiskLevel,
  OpportunityScoreComponent,
} from "./opportunity-hunter.types";

const ASSET_METADATA: Record<
  string,
  { category: OpportunityCategory; network: string }
> = {
  ethereum: { category: "infrastructure", network: "Ethereum" },
  "lido-staked-ether": { category: "income", network: "Ethereum" },
  chainlink: { category: "infrastructure", network: "Multi-chain" },
  aave: { category: "income", network: "Multi-chain" },
  uniswap: { category: "infrastructure", network: "Ethereum" },
};

const clamp = (value: number, minimum = 0, maximum = 100): number =>
  Math.max(minimum, Math.min(maximum, value));
const round = (value: number, digits = 2): number =>
  Number(value.toFixed(digits));

function realizedVolatility(prices: number[]): number | null {
  if (prices.length < 24) return null;
  const returns = prices
    .slice(1)
    .map((price, index) => {
      const previous = prices[index];
      return previous > 0 && price > 0 ? Math.log(price / previous) : null;
    })
    .filter((value): value is number => value !== null);
  if (returns.length < 23) return null;
  const mean = returns.reduce((total, value) => total + value, 0) / returns.length;
  const variance =
    returns.reduce((total, value) => total + (value - mean) ** 2, 0) /
    returns.length;
  return round(Math.sqrt(variance) * Math.sqrt(24 * 365) * 100);
}

function toMarketData(asset: MarketAssetSnapshot): OpportunityMarketData {
  const volumeToMarketCapPercent =
    asset.marketCapUsd && asset.totalVolumeUsd !== null
      ? round((asset.totalVolumeUsd / asset.marketCapUsd) * 100)
      : null;
  const thirtyDay = asset.priceChange30dPercent;

  return {
    providerAssetId: asset.id,
    priceUsd: asset.currentPriceUsd,
    marketCapUsd: asset.marketCapUsd,
    volume24hUsd: asset.totalVolumeUsd,
    high24hUsd: asset.high24hUsd,
    low24hUsd: asset.low24hUsd,
    performance24hPercent: asset.priceChange24hPercent,
    performance7dPercent: asset.priceChange7dPercent,
    performance30dPercent: thirtyDay,
    realizedVolatility7dPercent: realizedVolatility(asset.sparkline7dUsd),
    volumeToMarketCapPercent,
    trend:
      thirtyDay === null
        ? "insufficient_data"
        : thirtyDay > 8
          ? "uptrend"
          : thirtyDay < -8
            ? "downtrend"
            : "sideways",
    sparkline7dUsd: asset.sparkline7dUsd,
    observedAt: asset.lastUpdated,
  };
}

function riskLevelFor(market: OpportunityMarketData): OpportunityRiskLevel {
  if (
    market.realizedVolatility7dPercent === null ||
    market.realizedVolatility7dPercent >= 90 ||
    (market.marketCapUsd !== null && market.marketCapUsd < 1_000_000_000)
  ) {
    return "higher";
  }
  if (
    market.realizedVolatility7dPercent < 55 &&
    market.marketCapUsd !== null &&
    market.marketCapUsd >= 10_000_000_000
  ) {
    return "lower";
  }
  return "moderate";
}

function scoreLiveOpportunity(
  market: OpportunityMarketData,
): Pick<Opportunity, "score" | "scoreLabel" | "scoreBreakdown"> {
  const momentumValues = [
    market.performance7dPercent,
    market.performance30dPercent,
  ].filter((value): value is number => value !== null);
  const momentumSignal =
    momentumValues.length > 0
      ? clamp(
          50 +
            momentumValues.reduce((total, value) => total + value, 0) /
              momentumValues.length,
        )
      : 0;
  const marketCap = market.marketCapUsd ?? 0;
  const marketMaturityPoints =
    marketCap >= 100_000_000_000
      ? 15
      : marketCap >= 10_000_000_000
        ? 12
        : marketCap >= 1_000_000_000
          ? 8
          : marketCap > 0
            ? 4
            : 0;
  const liquidityRatio = market.volumeToMarketCapPercent;
  const liquidityPoints =
    liquidityRatio === null
      ? 0
      : liquidityRatio >= 5
        ? 25
        : liquidityRatio >= 2
          ? 20
          : liquidityRatio >= 1
            ? 14
            : 7;
  const volatilityPoints =
    market.realizedVolatility7dPercent === null
      ? 4
      : market.realizedVolatility7dPercent < 55
        ? 20
        : market.realizedVolatility7dPercent < 90
          ? 13
          : 6;
  const availableEvidence = [
    market.priceUsd,
    market.marketCapUsd,
    market.volume24hUsd,
    market.performance7dPercent,
    market.performance30dPercent,
    market.realizedVolatility7dPercent,
  ].filter((value) => value !== null).length;
  const evidencePoints = Math.round((availableEvidence / 6) * 15);
  const momentumPoints = Math.round((momentumSignal / 100) * 25);

  const scoreBreakdown: OpportunityScoreComponent[] = [
    {
      key: "momentum",
      label: "Market momentum",
      points: momentumPoints,
      maximum: 25,
      explanation:
        momentumValues.length > 0
          ? `Derived from verified 7-day and 30-day price performance; normalized signal ${round(momentumSignal, 0)}/100.`
          : "No verified 7-day or 30-day performance was available, so no momentum points were awarded.",
    },
    {
      key: "liquidity",
      label: "Liquidity depth",
      points: liquidityPoints,
      maximum: 25,
      explanation:
        liquidityRatio === null
          ? "Volume-to-market-cap data was incomplete."
          : `24-hour volume equals ${liquidityRatio}% of market capitalization under the fixed liquidity table.`,
    },
    {
      key: "volatility",
      label: "Volatility adjustment",
      points: volatilityPoints,
      maximum: 20,
      explanation:
        market.realizedVolatility7dPercent === null
          ? "The 7-day series was insufficient for a complete realized-volatility estimate."
          : `${market.realizedVolatility7dPercent}% annualized realized volatility from the verified 7-day price series.`,
    },
    {
      key: "market_maturity",
      label: "Market maturity",
      points: marketMaturityPoints,
      maximum: 15,
      explanation:
        market.marketCapUsd === null
          ? "Market capitalization was unavailable."
          : "Points follow fixed market-cap bands; size is not treated as a guarantee of safety.",
    },
    {
      key: "evidence",
      label: "Evidence completeness",
      points: evidencePoints,
      maximum: 15,
      explanation: `${availableEvidence} of 6 required market fields were present in the verified provider response.`,
    },
  ];
  const score = scoreBreakdown.reduce(
    (total, component) => total + component.points,
    0,
  );

  return {
    score,
    scoreLabel:
      score >= 80
        ? "high_conviction_research"
        : score >= 65
          ? "promising"
          : "developing",
    scoreBreakdown,
  };
}

function buildScenarios(
  market: OpportunityMarketData,
): Opportunity["scenarios"] {
  const volatility = market.realizedVolatility7dPercent;
  const scenarioMove = volatility === null ? 0 : round(volatility / Math.sqrt(2));
  const baseCenter = market.performance30dPercent ?? 0;

  return [
    {
      kind: "upside",
      label: "Momentum persists with improving liquidity",
      returnRangePercent: [
        round(Math.max(0, baseCenter)),
        round(Math.max(0, baseCenter) + scenarioMove),
      ],
      timeHorizonMonths: 6,
      assumptions: [
        "Recent verified trend persists",
        "Liquidity does not deteriorate materially",
      ],
    },
    {
      kind: "base",
      label: "Performance normalizes around the recent trend",
      returnRangePercent: [
        round(baseCenter - scenarioMove / 3),
        round(baseCenter + scenarioMove / 3),
      ],
      timeHorizonMonths: 6,
      assumptions: [
        "No forecast is implied",
        "Range is mechanically derived from recent performance and volatility",
      ],
    },
    {
      kind: "downside",
      label: "Volatility expands as trend weakens",
      returnRangePercent: [
        round(Math.min(0, baseCenter) - scenarioMove),
        round(Math.min(0, baseCenter)),
      ],
      timeHorizonMonths: 6,
      assumptions: [
        "Realized volatility remains elevated",
        "Recent momentum fails to persist",
      ],
    },
  ];
}

function money(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: value >= 1_000_000 ? "compact" : "standard",
    maximumFractionDigits: value >= 1_000 ? 1 : 4,
  }).format(value);
}

export function buildLiveOpportunityCatalog(
  assets: MarketAssetSnapshot[],
  screeningConfig: HalalScreeningConfig = DEFAULT_HALAL_SCREENING_CONFIG,
): Opportunity[] {
  return assets.map((asset) => {
    const marketData = toMarketData(asset);
    const riskLevel = riskLevelFor(marketData);
    const score = scoreLiveOpportunity(marketData);
    const metadata = ASSET_METADATA[asset.id] ?? {
      category: "infrastructure" as const,
      network: "Ethereum ecosystem",
    };
    const evidence: Opportunity["evidence"] = [
      {
        id: `${asset.id}:price`,
        title: "Verified spot price",
        finding: `${asset.symbol} was reported at ${money(asset.currentPriceUsd)}.`,
        sourceLabel: "CoinGecko market response",
        observedAt: asset.lastUpdated,
        synthetic: false,
      },
    ];

    if (asset.marketCapUsd !== null && asset.totalVolumeUsd !== null) {
      evidence.push({
        id: `${asset.id}:liquidity`,
        title: "Market size and trading volume",
        finding: `Reported market capitalization was ${money(asset.marketCapUsd)} and 24-hour volume was ${money(asset.totalVolumeUsd)}.`,
        sourceLabel: "CoinGecko market response",
        observedAt: asset.lastUpdated,
        synthetic: false,
      });
    }
    if (
      asset.priceChange7dPercent !== null ||
      asset.priceChange30dPercent !== null
    ) {
      evidence.push({
        id: `${asset.id}:performance`,
        title: "Historical performance",
        finding: `Reported price performance was ${asset.priceChange7dPercent === null ? "unavailable" : `${round(asset.priceChange7dPercent)}% over 7 days`} and ${asset.priceChange30dPercent === null ? "unavailable" : `${round(asset.priceChange30dPercent)}% over 30 days`}.`,
        sourceLabel: "CoinGecko market response",
        observedAt: asset.lastUpdated,
        synthetic: false,
      });
    }

    return {
      id: `live-${asset.id}`,
      name: asset.name,
      symbol: asset.symbol,
      category: metadata.category,
      network: metadata.network,
      summary: `Live market research view for ${asset.name}, based on verified price, liquidity, performance, and volatility fields.`,
      thesis: `${asset.name} is surfaced for further research because its deterministic market score is ${score.score}/100; this is a screening result, not an investment recommendation.`,
      riskLevel,
      ...score,
      scenarios: buildScenarios(marketData),
      evidence,
      halalScreening: screenOpportunity(
        {
          assessedAt: asset.lastUpdated,
          synthetic: false,
          interestBasedActivity: {
            outcome: "not_assessed",
            explanation:
              "Market-price data cannot establish whether interest-based activity is material.",
            evidenceIds: [],
          },
          prohibitedIndustry: {
            outcome: "not_assessed",
            explanation:
              "Market-price data does not provide a verified industry or revenue breakdown.",
            evidenceIds: [],
          },
          financialRatios: {
            interestBearingDebtPercent: null,
            nonPermissibleIncomePercent: null,
            evidenceIds: [],
          },
          ethicalConcerns: {
            outcome: "not_assessed",
            explanation:
              "Market-price data cannot verify governance, exploitation, asset backing, or other ethical concerns.",
            evidenceIds: [],
          },
        },
        evidence,
        screeningConfig,
      ),
      researchPlan: {
        objective: `Evaluate whether ${asset.name}'s verified liquidity, trend, and risk profile merits continued research.`,
        assumptions: [
          "Provider observations are point-in-time and may change",
          "Scenario ranges are deterministic stress illustrations, not forecasts",
          "No allocation or trade is authorized",
        ],
        riskConsiderations: [
          "Cryptoasset prices, liquidity, and volatility can change abruptly",
          "Smart-contract, governance, concentration, and regulatory risks are not resolved by market data",
          "Scenario ranges are stress illustrations and do not imply returns",
        ],
        ethicalConsiderations: [
          "Do not infer halal eligibility from token identity, popularity, or price performance",
          "Require dated primary evidence for activity, sector exposure, financial ratios, governance, and token use",
          "Seek qualified review before treating a preliminary screen as decision support",
        ],
        researchSteps: [
          "Verify the protocol purpose and token utility from primary documentation",
          "Compare liquidity across multiple market venues",
          "Review smart-contract, governance, and concentration risks",
          "Complete a qualified halal screen beyond price data",
        ],
        monitoringSignals: [
          "Price trend over 7 and 30 days",
          "24-hour volume-to-market-cap ratio",
          "7-day realized volatility",
          "Material protocol or governance events",
        ],
        exitConditions: [
          "Verified market data becomes stale or unavailable",
          "Liquidity falls below the researcher's documented threshold",
          "The investment thesis is invalidated by protocol or governance changes",
          "Screening identifies prohibited activity or unresolved evidence gaps",
        ],
      },
      marketData,
      updatedAt: asset.lastUpdated,
      synthetic: false,
    };
  });
}
