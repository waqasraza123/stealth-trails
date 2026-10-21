import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import {
  NotificationAudience,
  NotificationCategory,
  NotificationPriority,
  NotificationSourceType,
  Prisma,
} from "@prisma/client";
import { NotificationsService } from "../notifications/notifications.service";
import { PrismaService } from "../prisma/prisma.service";
import { OpportunityHunterService } from "./opportunity-hunter.service";
import type { Opportunity } from "./opportunity-hunter.types";
import { WealthBriefRateLimitService } from "./wealth-brief-rate-limit.service";
import type {
  WealthGuardianDashboard,
  WealthGuardianPreferences,
  WealthGuardianReport,
  WealthGuardianScheduleResult,
} from "./wealth-guardian.types";
import { FinancialMemoryService } from "./financial-memory.service";

const PREFERENCES_ACTION = "wealth_guardian.preferences_updated";
const REPORT_ACTIONS = [
  "wealth_guardian.report_generated",
  "wealth_guardian.attention_required",
] as const;
const DISCLAIMER =
  "This automated briefing is educational research, not investment advice, a promise of returns, a religious ruling, or authorization to trade. External AI, when permitted, can only prioritize server-verified evidence and screening-rule IDs.";

const DEFAULT_PREFERENCES: WealthGuardianPreferences = {
  enabled: false,
  externalAiConsent: false,
  notificationsEnabled: true,
  morningReportHourUtc: 6,
  minimumOpportunityScore: 60,
  volatilityAlertPercent: 90,
  categories: ["infrastructure", "income", "payments", "privacy", "security"],
  halalStatuses: [
    "eligible",
    "questionable",
    "excluded",
    "insufficient_evidence",
  ],
  monitoredAssetIds: [],
  updatedAt: null,
};

function scheduleBatchSize(): number {
  const parsed = Number(process.env.WEALTH_GUARDIAN_SCHEDULE_BATCH_SIZE ?? 3);
  return Number.isInteger(parsed) && parsed > 0 && parsed <= 25 ? parsed : 3;
}

type StoredMetadata = Record<string, unknown>;

function metadataRecord(value: Prisma.JsonValue | null): StoredMetadata {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as StoredMetadata)
    : {};
}

function normalizePreferences(
  value: unknown,
  updatedAt: string | null,
): WealthGuardianPreferences {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return { ...DEFAULT_PREFERENCES, updatedAt };
  }
  const candidate = value as Partial<WealthGuardianPreferences>;
  return {
    ...DEFAULT_PREFERENCES,
    ...candidate,
    categories: Array.isArray(candidate.categories)
      ? candidate.categories
      : DEFAULT_PREFERENCES.categories,
    halalStatuses: Array.isArray(candidate.halalStatuses)
      ? candidate.halalStatuses
      : DEFAULT_PREFERENCES.halalStatuses,
    monitoredAssetIds: Array.isArray(candidate.monitoredAssetIds)
      ? candidate.monitoredAssetIds
      : [],
    updatedAt,
  };
}

function reportFromEvent(event: {
  id: string;
  createdAt: Date;
  metadata: Prisma.JsonValue | null;
}): WealthGuardianReport | null {
  const report = metadataRecord(event.metadata).report;
  if (typeof report !== "object" || report === null || Array.isArray(report)) {
    return null;
  }
  return {
    ...(report as Omit<WealthGuardianReport, "id">),
    id: event.id,
    generatedAt:
      typeof (report as { generatedAt?: unknown }).generatedAt === "string"
        ? ((report as { generatedAt: string }).generatedAt)
        : event.createdAt.toISOString(),
  };
}

function utcDayKey(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function sortedIds(ids: string[]): string[] {
  return [...new Set(ids)].sort();
}

function sameIds(left: string[], right: string[]): boolean {
  return sortedIds(left).join("|") === sortedIds(right).join("|");
}

@Injectable()
export class WealthGuardianService {
  private readonly logger = new Logger(WealthGuardianService.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly opportunityHunter: OpportunityHunterService,
    private readonly rateLimitService: WealthBriefRateLimitService,
    private readonly notificationsService: NotificationsService,
    private readonly memory: FinancialMemoryService,
  ) {}

  async getDashboard(
    supabaseUserId: string,
  ): Promise<WealthGuardianDashboard> {
    const customer = await this.resolveCustomer(supabaseUserId);
    const [preferences, reports, memoryContext] = await Promise.all([
      this.getPreferencesForCustomer(customer.id),
      this.listReportsForCustomer(customer.id, 14),
      this.memory.retrieveForAgent(supabaseUserId, "wealth-guardian", "Monitor portfolio risk, goals, research interests, and ethical screening preferences", false),
    ]);
    const latestReport = reports[0] ?? null;
    const capabilities = this.opportunityHunter.getAnalystCapabilities();

    return {
      memoryPersonalization: {
        applied: memoryContext.influences.length > 0,
        influences: memoryContext.influences.map(({ id, category, summary, source }) => ({ id, category, summary, source })),
        note: memoryContext.notice,
      },
      preferences,
      agent: {
        status: preferences.enabled ? "scheduled" : "disabled",
        nextScheduledAt: preferences.enabled
          ? this.nextScheduledAt(preferences, latestReport)
          : null,
        lastRunAt: latestReport?.generatedAt ?? null,
        lastRunTrigger: latestReport?.trigger ?? null,
        externalAiAvailable: capabilities.available,
        externalAiConsentActive: preferences.externalAiConsent,
        productionAiDisabled: process.env.NODE_ENV === "production",
        scheduleNote:
          "The worker checks safely on each iteration; at most one report is stored per customer per UTC day after the configured hour.",
      },
      latestReport,
      reportHistory: reports,
      historyNote:
        reports.length > 0
          ? "History contains only reports persisted for this customer. Comparisons are shown only when compatible verified snapshots exist."
          : "No persisted guardian reports exist for this customer yet; historical comparisons are not inferred.",
    };
  }

  async updatePreferences(
    supabaseUserId: string,
    input: Omit<WealthGuardianPreferences, "updatedAt">,
  ): Promise<WealthGuardianDashboard> {
    const customer = await this.resolveCustomer(supabaseUserId);
    const now = new Date();
    const preferences: WealthGuardianPreferences = {
      ...input,
      categories: [...new Set(input.categories)],
      halalStatuses: [...new Set(input.halalStatuses)],
      monitoredAssetIds: [...new Set(input.monitoredAssetIds)],
      updatedAt: now.toISOString(),
    };

    await this.prismaService.auditEvent.create({
      data: {
        customerId: customer.id,
        actorType: "customer",
        actorId: supabaseUserId,
        action: PREFERENCES_ACTION,
        targetType: "wealth_guardian",
        targetId: customer.id,
        metadata: { preferences } as unknown as Prisma.InputJsonValue,
      },
    });

    return this.getDashboard(supabaseUserId);
  }

  async generateManualReport(
    supabaseUserId: string,
    externalAiOptIn: boolean,
  ): Promise<WealthGuardianDashboard> {
    const customer = await this.resolveCustomer(supabaseUserId);
    const preferences = await this.getPreferencesForCustomer(customer.id);
    if (externalAiOptIn && !preferences.externalAiConsent) {
      throw new BadRequestException(
        "Enable the Wealth Guardian external-AI consent setting before requesting AI prioritization.",
      );
    }
    await this.rateLimitService.assertAllowed(supabaseUserId);
    await this.generateAndPersistReport({
      customerId: customer.id,
      supabaseUserId,
      preferences,
      trigger: "manual",
      workerId: null,
      externalAiRequested: externalAiOptIn,
    });
    return this.getDashboard(supabaseUserId);
  }

  async runScheduledResearch(
    workerId: string,
  ): Promise<WealthGuardianScheduleResult> {
    const customers = await this.prismaService.customer.findMany({
      where: {
        auditEvents: { some: { action: PREFERENCES_ACTION } },
      },
      select: {
        id: true,
        supabaseUserId: true,
        auditEvents: {
          where: { action: PREFERENCES_ACTION },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });
    const result: WealthGuardianScheduleResult = {
      evaluatedCustomerCount: 0,
      dueCustomerCount: 0,
      generatedReportCount: 0,
      skippedCustomerCount: 0,
      failedCustomerCount: 0,
    };
    const now = new Date();
    const batchSize = scheduleBatchSize();

    for (const customer of customers) {
      if (
        result.generatedReportCount + result.failedCustomerCount >=
        batchSize
      ) {
        break;
      }
      result.evaluatedCustomerCount += 1;
      const event = customer.auditEvents[0];
      const preferences = normalizePreferences(
        event ? metadataRecord(event.metadata).preferences : null,
        event?.createdAt.toISOString() ?? null,
      );
      if (!(await this.isScheduledReportDue(customer.id, preferences, now))) {
        result.skippedCustomerCount += 1;
        continue;
      }
      const reservationId = await this.reserveScheduledReport(customer.id, now);
      if (!reservationId) {
        result.skippedCustomerCount += 1;
        continue;
      }
      result.dueCustomerCount += 1;
      try {
        await this.rateLimitService.assertAllowed(customer.supabaseUserId);
        await this.generateAndPersistReport({
          customerId: customer.id,
          supabaseUserId: customer.supabaseUserId,
          preferences,
          trigger: "scheduled",
          workerId,
          externalAiRequested: preferences.externalAiConsent,
        });
        result.generatedReportCount += 1;
      } catch (error) {
        result.failedCustomerCount += 1;
        this.logger.warn(
          `Scheduled Wealth Guardian report failed for customer ${customer.id}: ${error instanceof Error ? error.message : "unknown error"}`,
        );
      }
    }

    return result;
  }

  private async generateAndPersistReport(args: {
    customerId: string;
    supabaseUserId: string;
    preferences: WealthGuardianPreferences;
    trigger: "manual" | "scheduled";
    workerId: string | null;
    externalAiRequested: boolean;
  }): Promise<WealthGuardianReport> {
    const previousReport = (
      await this.listReportsForCustomer(args.customerId, 1)
    )[0] ?? null;
    const [research, memoryContext] = await Promise.all([
      this.opportunityHunter.analyze(args.externalAiRequested && args.preferences.externalAiConsent),
      this.memory.retrieveForAgent(
        args.supabaseUserId,
        "wealth-guardian",
        "Prioritize monitored opportunities, portfolio risks, and ethical screening alerts",
        args.externalAiRequested && args.preferences.externalAiConsent,
        4,
      ),
    ]);
    const matchingOpportunities = research.opportunities.filter((opportunity) =>
      this.matchesPreferences(opportunity, args.preferences),
    );
    const terms = memoryContext.influences.flatMap((item) => item.summary.toLowerCase().match(/[a-z0-9]{3,}/gu) ?? []);
    const relevance = (item: Opportunity) => terms.reduce((total, term) => total + (`${item.name} ${item.symbol} ${item.category} ${item.summary}`.toLowerCase().includes(term) ? 1 : 0), 0);
    const opportunities =
      research.ai.analysisMode === "ai_ranked"
        ? matchingOpportunities
        : matchingOpportunities.sort((left, right) => relevance(right) - relevance(left) || right.score - left.score);
    const previousById = new Map(
      previousReport?.monitoringSnapshot.map((item) => [
        item.opportunityId,
        item,
      ]) ?? [],
    );
    const hasComparableHistory =
      research.dataset.kind === "live_market" &&
      previousReport?.datasetKind === "live_market";
    const monitoringSnapshot: WealthGuardianReport["monitoringSnapshot"] =
      opportunities.map((opportunity) => ({
        opportunityId: opportunity.id,
        priceUsd: opportunity.marketData?.priceUsd ?? null,
        score: opportunity.score,
        riskLevel: opportunity.riskLevel,
        halalStatus: opportunity.halalScreening.status,
        screeningEvidenceIds: sortedIds(
          opportunity.halalScreening.ruleResults.flatMap((rule) =>
            rule.evidence.map((item) => item.evidenceId),
          ),
        ),
        screeningMethodologyVersion:
          opportunity.halalScreening.methodologyVersion,
        synthetic: opportunity.synthetic,
      }));

    const marketMovements: WealthGuardianReport["marketMovements"] =
      opportunities.map((opportunity) => {
        const previous = previousById.get(opportunity.id);
        const comparable =
          hasComparableHistory &&
          previous !== undefined &&
          !previous.synthetic &&
          !opportunity.synthetic;
        const currentPrice = opportunity.marketData?.priceUsd ?? null;
        const previousPrice = previous?.priceUsd ?? null;
        return {
          opportunityId: opportunity.id,
          name: opportunity.name,
          symbol: opportunity.symbol,
          priceUsd: currentPrice,
          performance24hPercent:
            opportunity.marketData?.performance24hPercent ?? null,
          performance7dPercent:
            opportunity.marketData?.performance7dPercent ?? null,
          volatility7dPercent:
            opportunity.marketData?.realizedVolatility7dPercent ?? null,
          score: opportunity.score,
          scoreChange: comparable ? opportunity.score - previous.score : null,
          riskLevel: opportunity.riskLevel,
          previousRiskLevel: comparable ? previous.riskLevel : null,
          priceChangeSincePreviousReportPercent:
            comparable &&
            currentPrice !== null &&
            previousPrice !== null &&
            previousPrice > 0
              ? Number(
                  (((currentPrice - previousPrice) / previousPrice) * 100).toFixed(
                    2,
                  ),
                )
              : null,
          evidenceAsOf: opportunity.updatedAt,
          synthetic: opportunity.synthetic,
        };
      });

    const halalAlerts: WealthGuardianReport["halalAlerts"] = opportunities
      .map((opportunity) => {
        const previous = previousById.get(opportunity.id);
        const currentEvidenceIds = sortedIds(
          opportunity.halalScreening.ruleResults.flatMap((rule) =>
            rule.evidence.map((item) => item.evidenceId),
          ),
        );
        const comparable =
          hasComparableHistory &&
          previous !== undefined &&
          !previous.synthetic &&
          !opportunity.synthetic;
        const statusChanged =
          comparable && previous.halalStatus !== opportunity.halalScreening.status;
        const evidenceChanged =
          comparable &&
          (!sameIds(previous.screeningEvidenceIds ?? [], currentEvidenceIds) ||
            previous.screeningMethodologyVersion !==
              opportunity.halalScreening.methodologyVersion);
        const flagged = ["questionable", "excluded"].includes(
          opportunity.halalScreening.status,
        );
        if (!flagged && !statusChanged && !evidenceChanged) return null;
        return {
          opportunityId: opportunity.id,
          name: opportunity.name,
          currentStatus: opportunity.halalScreening.status,
          previousStatus: comparable ? previous.halalStatus : null,
          changed: statusChanged || evidenceChanged,
          reason: statusChanged
            ? `Screening status changed from ${previous.halalStatus} to ${opportunity.halalScreening.status}.`
            : evidenceChanged
              ? "The verified screening evidence set or methodology changed since the previous report."
              : opportunity.halalScreening.rationale[0] ??
                "The current preliminary screen requires attention.",
          evidenceIds: currentEvidenceIds,
          evidenceAsOf: opportunity.halalScreening.assessedAt,
          synthetic: opportunity.synthetic,
        };
      })
      .filter(
        (alert): alert is WealthGuardianReport["halalAlerts"][number] =>
          alert !== null,
      );

    const risks: WealthGuardianReport["risks"] = opportunities
      .flatMap((opportunity) => {
        const findings: WealthGuardianReport["risks"] = [];
        const volatility =
          opportunity.marketData?.realizedVolatility7dPercent ?? null;
        if (
          volatility !== null &&
          volatility >= args.preferences.volatilityAlertPercent
        ) {
          findings.push({
            opportunityId: opportunity.id,
            severity: "high",
            finding: `${volatility}% annualized seven-day realized volatility meets or exceeds the configured ${args.preferences.volatilityAlertPercent}% alert threshold.`,
            evidenceAsOf: opportunity.marketData?.observedAt ?? opportunity.updatedAt,
            synthetic: opportunity.synthetic,
          });
        }
        if (opportunity.riskLevel === "higher") {
          findings.push({
            opportunityId: opportunity.id,
            severity: "watch",
            finding: `The deterministic opportunity model currently classifies ${opportunity.name} as higher risk.`,
            evidenceAsOf: opportunity.updatedAt,
            synthetic: opportunity.synthetic,
          });
        }
        return findings;
      });

    const notableOpportunities: WealthGuardianReport["notableOpportunities"] =
      opportunities.slice(0, 5).map((opportunity) => {
        const previous = previousById.get(opportunity.id);
        const emerging =
          hasComparableHistory && !previous && !opportunity.synthetic;
        return {
          opportunityId: opportunity.id,
          name: opportunity.name,
          symbol: opportunity.symbol,
          score: opportunity.score,
          riskLevel: opportunity.riskLevel,
          halalStatus: opportunity.halalScreening.status,
          reason: emerging
            ? "This evidence-backed opportunity was not present in the previous comparable live report."
            : `It ranks ${opportunity.score}/100 under the published deterministic methodology.`,
          synthetic: opportunity.synthetic,
        };
      });

    const generatedAt = new Date().toISOString();
    const reportWithoutId: Omit<WealthGuardianReport, "id"> = {
      generatedAt,
      trigger: args.trigger,
      workerId: args.workerId,
      datasetKind: research.dataset.kind,
      datasetLabel: research.dataset.label,
      evidenceAsOf: research.dataset.asOf,
      comparison: {
        previousReportId: hasComparableHistory ? previousReport?.id ?? null : null,
        available: hasComparableHistory,
        reason: hasComparableHistory
          ? "Compared with the previous persisted live-market report for this customer."
          : previousReport
            ? "The current and previous datasets are not both verified live-market snapshots, so no historical change is claimed."
            : "No previous persisted report exists for comparison.",
      },
      summary: `${opportunities.length} monitored opportunities matched the customer preferences; ${risks.length} risk flags and ${halalAlerts.length} halal-screening alerts require review.`,
      marketMovements,
      notableOpportunities,
      risks,
      halalAlerts,
      researchPlans: notableOpportunities.map((notable) => {
        const opportunity = opportunities.find(
          (candidate) => candidate.id === notable.opportunityId,
        )!;
        return {
          opportunityId: opportunity.id,
          objective: opportunity.researchPlan.objective,
          riskConsiderations: opportunity.researchPlan.riskConsiderations,
          ethicalConsiderations:
            opportunity.researchPlan.ethicalConsiderations,
          scenarios: opportunity.scenarios,
          monitoringConditions: opportunity.researchPlan.monitoringSignals,
          exitConditions: opportunity.researchPlan.exitConditions,
        };
      }),
      ai: {
        requested: args.externalAiRequested,
        externalAiUsed: research.ai.externalAiUsed,
        mode: research.ai.analysisMode,
        boundaryNote: research.ai.boundaryNote,
        insights: research.ai.insights.map((insight) => ({
          opportunityId: insight.opportunityId,
          headline: insight.headline,
          evidenceIds: insight.evidenceIds,
          screeningRuleIds: insight.screeningRuleIds,
          halalExplanation: insight.halalExplanation,
        })),
      },
      monitoringSnapshot,
      disclaimer: DISCLAIMER,
    };
    const needsAttention =
      halalAlerts.some(
        (alert) =>
          !alert.synthetic &&
          ["questionable", "excluded"].includes(alert.currentStatus),
      ) || risks.some((risk) => !risk.synthetic && risk.severity === "high");
    const event = await this.prismaService.auditEvent.create({
      data: {
        customerId: args.customerId,
        actorType: args.trigger === "scheduled" ? "worker" : "customer",
        actorId: args.workerId ?? args.supabaseUserId,
        action: needsAttention ? REPORT_ACTIONS[1] : REPORT_ACTIONS[0],
        targetType: "wealth_guardian_report",
        targetId: `${args.customerId}:${generatedAt}`,
        metadata: {
          note: needsAttention
            ? "Your latest Wealth Guardian briefing contains risk or halal-screening items that need review."
            : "Your latest Wealth Guardian morning briefing is ready.",
          report: reportWithoutId,
        } as unknown as Prisma.InputJsonValue,
      },
    });
    const report = { ...reportWithoutId, id: event.id };

    if (args.preferences.notificationsEnabled) {
      try {
        await this.notificationsService.publishAuditEventRecord(event);
      } catch (error) {
        this.logger.warn(
          `Wealth Guardian report ${event.id} was stored but its notification could not be published: ${error instanceof Error ? error.message : "unknown error"}`,
        );
      }
    }

    return report;
  }

  private matchesPreferences(
    opportunity: Opportunity,
    preferences: WealthGuardianPreferences,
  ): boolean {
    const monitoredIds = new Set(
      preferences.monitoredAssetIds.map((value) => value.toLowerCase()),
    );
    const assetMatches =
      monitoredIds.size === 0 ||
      monitoredIds.has(
        (opportunity.marketData?.providerAssetId ?? opportunity.id)
          .replace(/^live-/u, "")
          .toLowerCase(),
      ) ||
      monitoredIds.has(opportunity.symbol.toLowerCase());
    return (
      assetMatches &&
      opportunity.score >= preferences.minimumOpportunityScore &&
      (preferences.categories.length === 0 ||
        preferences.categories.includes(opportunity.category)) &&
      (preferences.halalStatuses.length === 0 ||
        preferences.halalStatuses.includes(opportunity.halalScreening.status))
    );
  }

  private async resolveCustomer(supabaseUserId: string) {
    const customer = await this.prismaService.customer.findUnique({
      where: { supabaseUserId },
      select: { id: true, supabaseUserId: true },
    });
    if (!customer) throw new NotFoundException("Customer profile not found.");
    return customer;
  }

  private async getPreferencesForCustomer(
    customerId: string,
  ): Promise<WealthGuardianPreferences> {
    const event = await this.prismaService.auditEvent.findFirst({
      where: { customerId, action: PREFERENCES_ACTION },
      orderBy: { createdAt: "desc" },
    });
    return normalizePreferences(
      event ? metadataRecord(event.metadata).preferences : null,
      event?.createdAt.toISOString() ?? null,
    );
  }

  private async listReportsForCustomer(
    customerId: string,
    take: number,
  ): Promise<WealthGuardianReport[]> {
    const events = await this.prismaService.auditEvent.findMany({
      where: { customerId, action: { in: [...REPORT_ACTIONS] } },
      orderBy: { createdAt: "desc" },
      take,
    });
    return events
      .map(reportFromEvent)
      .filter((report): report is WealthGuardianReport => report !== null);
  }

  private async isScheduledReportDue(
    customerId: string,
    preferences: WealthGuardianPreferences,
    now: Date,
  ): Promise<boolean> {
    if (!preferences.enabled || now.getUTCHours() < preferences.morningReportHourUtc) {
      return false;
    }
    const latest = (await this.listReportsForCustomer(customerId, 1))[0];
    return !latest || utcDayKey(new Date(latest.generatedAt)) !== utcDayKey(now);
  }

  private async reserveScheduledReport(
    customerId: string,
    now: Date,
  ): Promise<string | null> {
    try {
      const reservation = await this.prismaService.notificationEvent.create({
        data: {
          sourceType: NotificationSourceType.system_notice,
          sourceId: `wealth-guardian-schedule:${customerId}:${utcDayKey(now)}`,
          audience: NotificationAudience.customer,
          category: NotificationCategory.product,
          priority: NotificationPriority.low,
          title: "Wealth Guardian schedule reservation",
          summary:
            "Internal idempotency reservation for a customer-authorized daily research report.",
          metadata: {
            internalOnly: true,
            customerId,
            day: utcDayKey(now),
          },
          sourceCreatedAt: now,
        },
      });
      return reservation.id;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        return null;
      }
      throw error;
    }
  }

  private nextScheduledAt(
    preferences: WealthGuardianPreferences,
    latestReport: WealthGuardianReport | null,
  ): string {
    const now = new Date();
    const scheduled = new Date(now);
    scheduled.setUTCHours(preferences.morningReportHourUtc, 0, 0, 0);
    const alreadyRanToday =
      latestReport &&
      utcDayKey(new Date(latestReport.generatedAt)) === utcDayKey(now);
    if (alreadyRanToday || scheduled.getTime() <= now.getTime()) {
      scheduled.setUTCDate(scheduled.getUTCDate() + 1);
    }
    return scheduled.toISOString();
  }
}
