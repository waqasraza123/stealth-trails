import { Inject, Injectable, Logger } from "@nestjs/common";
import {
  InvalidWealthBriefProviderOutputError,
  WEALTH_BRIEF_PROVIDER,
  type WealthBriefProvider,
} from "./wealth-brief.provider";
import {
  buildWealthBriefStatementCatalog,
  renderCatalogInterpretation,
  renderSelectedInterpretation,
} from "./wealth-brief-catalog";
import type {
  WealthBriefCapabilities,
  WealthBriefResult,
  WealthSnapshot,
} from "./wealth-brief.types";
import { WealthSnapshotService } from "./wealth-snapshot.service";
import { getAttachedProviderUsage } from "./ai-provider-usage";

const DISCLAIMER =
  "This brief organizes available account information for research. Observations, risk flags, their severities, and all financial values are computed by the backend from verified snapshot data; in AI mode the external model only selected and ordered server-verified statements. It is not investment advice, does not promise returns, and cannot authorize or execute financial activity.";

function snapshotDataAsOf(snapshot: WealthSnapshot): string | null {
  const freshnessRelevantSources = snapshot.sources.filter(
    (source) =>
      source.status !== "unavailable" &&
      (source.recordCount > 0 ||
        source.asOf !== null ||
        source.status === "partial"),
  );
  if (
    freshnessRelevantSources.length === 0 ||
    freshnessRelevantSources.some((source) => source.asOf === null)
  ) {
    return null;
  }
  const timestamps = freshnessRelevantSources.map(
    (source) => source.asOf as string,
  );
  return timestamps.reduce((oldest, current) =>
    Date.parse(current) < Date.parse(oldest) ? current : oldest,
  );
}

@Injectable()
export class WealthBriefService {
  private readonly logger = new Logger(WealthBriefService.name);

  constructor(
    private readonly wealthSnapshotService: WealthSnapshotService,
    @Inject(WEALTH_BRIEF_PROVIDER)
    private readonly provider: WealthBriefProvider,
  ) {}

  getCapabilities(): WealthBriefCapabilities {
    return this.provider.getCapabilities();
  }

  async generate(
    supabaseUserId: string,
    externalAiOptIn: boolean,
  ): Promise<WealthBriefResult> {
    const snapshot = await this.wealthSnapshotService.collect(supabaseUserId);
    const catalog = buildWealthBriefStatementCatalog(snapshot);
    const capabilities = this.provider.getCapabilities();
    let interpretation = renderCatalogInterpretation(snapshot, catalog);
    let mode: WealthBriefResult["mode"] = "deterministic_preview";
    let fallbackReason: WealthBriefResult["fallbackReason"] = null;
    let externalDataShared = false;
    let providerUsage: WealthBriefResult["providerUsage"] = null;

    if (capabilities.externalAiAvailable && externalAiOptIn) {
      externalDataShared = true;
      try {
        const selection = await this.provider.generate(snapshot, catalog);
        providerUsage = getAttachedProviderUsage(selection);
        interpretation = renderSelectedInterpretation(
          snapshot,
          catalog,
          selection,
        );
        mode = "ai_generated";
      } catch (error) {
        fallbackReason =
          error instanceof InvalidWealthBriefProviderOutputError
            ? "invalid_provider_output"
            : "provider_failure";
        this.logger.warn(
          `AI wealth brief provider failed; deterministic preview returned (${fallbackReason}).`,
        );
      }
    }

    const { sources, ...financialPosition } = snapshot;
    return {
      ...interpretation,
      mode,
      generatedAt: new Date().toISOString(),
      dataAsOf: snapshotDataAsOf(snapshot),
      financialPosition,
      sources,
      externalDataShared,
      provider: {
        configured: capabilities.externalAiAvailable,
        name: capabilities.providerName,
        model: capabilities.model,
      },
      fallbackReason,
      providerUsage,
      disclaimer: DISCLAIMER,
    };
  }
}
