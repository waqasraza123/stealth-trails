import axios from "axios";

export const MARKET_DATA_PROVIDER = Symbol("MARKET_DATA_PROVIDER");
export const MARKET_DATA_CONFIG = Symbol("MARKET_DATA_CONFIG");

const COINGECKO_MARKETS_ENDPOINT =
  "https://api.coingecko.com/api/v3/coins/markets";
const DEFAULT_ASSET_IDS = [
  "ethereum",
  "lido-staked-ether",
  "chainlink",
  "aave",
  "uniswap",
] as const;

export type MarketDataProviderName = "disabled" | "coingecko" | "recorded";

export type MarketAssetSnapshot = {
  id: string;
  symbol: string;
  name: string;
  currentPriceUsd: number;
  marketCapUsd: number | null;
  totalVolumeUsd: number | null;
  high24hUsd: number | null;
  low24hUsd: number | null;
  priceChange24hPercent: number | null;
  priceChange7dPercent: number | null;
  priceChange30dPercent: number | null;
  sparkline7dUsd: number[];
  lastUpdated: string;
};

export type MarketDataRuntimeConfig = {
  provider: MarketDataProviderName;
  apiKey: string | null;
  assetIds: string[];
  requestTimeoutMs: number;
  cacheTtlMs: number;
  staleTtlMs: number;
};

export interface MarketDataProvider {
  readonly name: MarketDataProviderName;
  fetchMarketSnapshot(): Promise<MarketAssetSnapshot[]>;
}

type CoinGeckoMarket = {
  id?: unknown;
  symbol?: unknown;
  name?: unknown;
  current_price?: unknown;
  market_cap?: unknown;
  total_volume?: unknown;
  high_24h?: unknown;
  low_24h?: unknown;
  price_change_percentage_24h?: unknown;
  price_change_percentage_7d_in_currency?: unknown;
  price_change_percentage_30d_in_currency?: unknown;
  sparkline_in_7d?: { price?: unknown };
  last_updated?: unknown;
};

const positiveInteger = (
  value: string | undefined,
  fallback: number,
  maximum: number,
): number => {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 && parsed <= maximum
    ? parsed
    : fallback;
};

const optionalFiniteNumber = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

const requiredText = (value: unknown): string | null =>
  typeof value === "string" && value.trim().length > 0 ? value.trim() : null;

export function loadMarketDataRuntimeConfig(
  env: NodeJS.ProcessEnv = process.env,
): MarketDataRuntimeConfig {
  const provider = env.MARKET_DATA_PROVIDER === "coingecko" ? "coingecko" : "disabled";
  const assetIds = (env.MARKET_DATA_ASSET_IDS ?? DEFAULT_ASSET_IDS.join(","))
    .split(",")
    .map((id) => id.trim().toLowerCase())
    .filter((id) => /^[a-z0-9-]{1,80}$/u.test(id))
    .slice(0, 20);
  const cacheTtlSeconds = positiveInteger(
    env.MARKET_DATA_CACHE_TTL_SECONDS,
    300,
    3_600,
  );
  const staleTtlSeconds = positiveInteger(
    env.MARKET_DATA_STALE_TTL_SECONDS,
    3_600,
    86_400,
  );

  return {
    provider,
    apiKey: env.COINGECKO_API_KEY?.trim() || null,
    assetIds: assetIds.length > 0 ? assetIds : [...DEFAULT_ASSET_IDS],
    requestTimeoutMs: positiveInteger(
      env.MARKET_DATA_REQUEST_TIMEOUT_MS,
      6_000,
      15_000,
    ),
    cacheTtlMs: cacheTtlSeconds * 1_000,
    staleTtlMs: Math.max(staleTtlSeconds, cacheTtlSeconds) * 1_000,
  };
}

function parseCoinGeckoMarket(value: CoinGeckoMarket): MarketAssetSnapshot | null {
  const id = requiredText(value.id);
  const symbol = requiredText(value.symbol);
  const name = requiredText(value.name);
  const currentPriceUsd = optionalFiniteNumber(value.current_price);
  const lastUpdated = requiredText(value.last_updated);

  if (!id || !symbol || !name || currentPriceUsd === null || !lastUpdated) {
    return null;
  }
  if (currentPriceUsd < 0 || !Number.isFinite(Date.parse(lastUpdated))) {
    return null;
  }

  const sparkline = Array.isArray(value.sparkline_in_7d?.price)
    ? value.sparkline_in_7d.price
        .map(optionalFiniteNumber)
        .filter((price): price is number => price !== null && price >= 0)
        .slice(-168)
    : [];

  return {
    id,
    symbol: symbol.toUpperCase(),
    name,
    currentPriceUsd,
    marketCapUsd: optionalFiniteNumber(value.market_cap),
    totalVolumeUsd: optionalFiniteNumber(value.total_volume),
    high24hUsd: optionalFiniteNumber(value.high_24h),
    low24hUsd: optionalFiniteNumber(value.low_24h),
    priceChange24hPercent: optionalFiniteNumber(
      value.price_change_percentage_24h,
    ),
    priceChange7dPercent: optionalFiniteNumber(
      value.price_change_percentage_7d_in_currency,
    ),
    priceChange30dPercent: optionalFiniteNumber(
      value.price_change_percentage_30d_in_currency,
    ),
    sparkline7dUsd: sparkline,
    lastUpdated,
  };
}

export class DisabledMarketDataProvider implements MarketDataProvider {
  readonly name = "disabled" as const;

  async fetchMarketSnapshot(): Promise<MarketAssetSnapshot[]> {
    throw new Error("Live market data is not configured.");
  }
}

export class CoinGeckoMarketDataProvider implements MarketDataProvider {
  readonly name = "coingecko" as const;

  constructor(private readonly config: MarketDataRuntimeConfig) {}

  async fetchMarketSnapshot(): Promise<MarketAssetSnapshot[]> {
    const response = await axios.get<unknown>(COINGECKO_MARKETS_ENDPOINT, {
      params: {
        vs_currency: "usd",
        ids: this.config.assetIds.join(","),
        order: "market_cap_desc",
        sparkline: "true",
        price_change_percentage: "24h,7d,30d",
      },
      headers: this.config.apiKey
        ? { "x-cg-demo-api-key": this.config.apiKey }
        : undefined,
      timeout: this.config.requestTimeoutMs,
      maxRedirects: 0,
      maxContentLength: 512 * 1024,
      maxBodyLength: 32 * 1024,
    });

    if (!Array.isArray(response.data)) {
      throw new Error("The market-data provider returned an invalid payload.");
    }

    const parsed = response.data
      .slice(0, this.config.assetIds.length)
      .map((value) =>
        typeof value === "object" && value !== null
          ? parseCoinGeckoMarket(value as CoinGeckoMarket)
          : null,
      )
      .filter((value): value is MarketAssetSnapshot => value !== null);

    if (parsed.length === 0) {
      throw new Error("The market-data provider returned no usable assets.");
    }

    return parsed;
  }
}

export function createMarketDataProvider(
  config: MarketDataRuntimeConfig,
): MarketDataProvider {
  return config.provider === "coingecko"
    ? new CoinGeckoMarketDataProvider(config)
    : new DisabledMarketDataProvider();
}
