import { Inject, Injectable } from "@nestjs/common";
import {
  MARKET_DATA_CONFIG,
  MARKET_DATA_PROVIDER,
  type MarketAssetSnapshot,
  type MarketDataProvider,
  type MarketDataRuntimeConfig,
} from "./market-data.provider";

export type MarketDataResult = {
  assets: MarketAssetSnapshot[];
  provider: string;
  status: "live" | "cached" | "stale" | "unavailable";
  fetchedAt: string | null;
  failureReason: string | null;
};

@Injectable()
export class MarketDataService {
  private cache: { assets: MarketAssetSnapshot[]; fetchedAtMs: number } | null =
    null;

  constructor(
    @Inject(MARKET_DATA_PROVIDER)
    private readonly provider: MarketDataProvider,
    @Inject(MARKET_DATA_CONFIG)
    private readonly config: MarketDataRuntimeConfig,
  ) {}

  async getSnapshot(): Promise<MarketDataResult> {
    const now = Date.now();
    const cacheAge = this.cache ? now - this.cache.fetchedAtMs : null;

    if (this.cache && cacheAge !== null && cacheAge <= this.config.cacheTtlMs) {
      return this.fromCache("cached", null);
    }

    if (this.provider.name === "disabled") {
      return {
        assets: [],
        provider: this.provider.name,
        status: "unavailable",
        fetchedAt: null,
        failureReason: "Live market data is disabled by configuration.",
      };
    }

    try {
      const assets = await this.provider.fetchMarketSnapshot();
      this.cache = { assets, fetchedAtMs: now };
      return {
        assets,
        provider: this.provider.name,
        status: "live",
        fetchedAt: new Date(now).toISOString(),
        failureReason: null,
      };
    } catch {
      if (
        this.cache &&
        cacheAge !== null &&
        cacheAge <= this.config.staleTtlMs
      ) {
        return this.fromCache(
          "stale",
          "The live refresh failed; the last verified cached snapshot is shown.",
        );
      }

      return {
        assets: [],
        provider: this.provider.name,
        status: "unavailable",
        fetchedAt: null,
        failureReason:
          "The live market-data provider is unavailable; synthetic fallback research is shown.",
      };
    }
  }

  private fromCache(
    status: "cached" | "stale",
    failureReason: string | null,
  ): MarketDataResult {
    return {
      assets: this.cache?.assets ?? [],
      provider: this.provider.name,
      status,
      fetchedAt: this.cache
        ? new Date(this.cache.fetchedAtMs).toISOString()
        : null,
      failureReason,
    };
  }
}
