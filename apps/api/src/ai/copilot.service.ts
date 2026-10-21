import { randomUUID } from "node:crypto";
import {
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import {
  COPILOT_PROVIDER,
  InvalidCopilotProviderOutputError,
  type CopilotProvider,
} from "./copilot.provider";
import type {
  CopilotCitation,
  CopilotConversation,
  CopilotConversationSummary,
  CopilotDashboard,
  CopilotIntent,
  CopilotMessage,
  CopilotStatement,
  CopilotTurnResult,
} from "./copilot.types";
import { OpportunityHunterService } from "./opportunity-hunter.service";
import type { OpportunityHunterResponse } from "./opportunity-hunter.types";
import type { Opportunity } from "./opportunity-hunter.types";
import { WealthBriefRateLimitService } from "./wealth-brief-rate-limit.service";
import { WealthBriefService } from "./wealth-brief.service";
import type { WealthBriefResult } from "./wealth-brief.types";
import { WealthGuardianService } from "./wealth-guardian.service";
import type { WealthGuardianDashboard } from "./wealth-guardian.types";
import { PortfolioRiskService } from "./portfolio-risk.service";
import type {
  PortfolioRiskAnalysis,
  PortfolioRiskRequest,
} from "./portfolio-risk.types";
import { getAttachedProviderUsage } from "./ai-provider-usage";
import { DocumentIntelligenceService } from "./document-intelligence.service";
import { FinancialMemoryService } from "./financial-memory.service";
import type { FinancialMemoryCategory, FinancialMemoryContext } from "./financial-memory.types";

const CONVERSATION_ACTION = "ai_copilot.conversation_created";
const TURN_ACTION = "ai_copilot.turn_recorded";
const DISCLAIMER =
  "Educational, read-only research—not financial advice, a religious ruling, a promise of returns, or authorization to trade or move money. Scenario ranges are assumptions, not forecasts.";
const SUGGESTED_QUESTIONS = [
  "Summarize my current financial position and data freshness.",
  "What changed in my latest Wealth Guardian report?",
  "Which opportunities need halal-screening review and why?",
  "Build an educational research plan for the strongest evidenced opportunity.",
  "Explain my portfolio concentration and stress-test results.",
  "Explain my outstanding loans and key dates.",
  "Search my authorized documents for material fees, risks, and termination terms.",
  "Show recent transactions and any unresolved status.",
];

type StoredObject = Record<string, unknown>;

function asObject(value: Prisma.JsonValue | null): StoredObject {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as StoredObject)
    : {};
}

function classifyIntent(message: string): CopilotIntent {
  const value = message.toLowerCase();
  if (/portfolio risk|stress test|drawdown|concentration|diversification|risk lab/u.test(value)) return "portfolio_risk";
  if (/halal|sharia|ethical|permissib|screen/u.test(value)) return "halal_screening";
  if (/guardian|overnight|morning|alert|briefing|changed/u.test(value)) return "wealth_guardian";
  if (/research plan|scenario|assumption|monitor|exit condition/u.test(value)) return "research_plan";
  if (/opportunit|market|trend|volatil|risk score|asset/u.test(value)) return "opportunities";
  if (/loan|borrow|collateral|ltv|due date/u.test(value)) return "loans";
  if (/stak|yield|reward|pool/u.test(value)) return "staking";
  if (/transaction|transfer|deposit|withdraw|payment/u.test(value)) return "transactions";
  if (/balance|wallet|holding|financial position|portfolio/u.test(value)) return "balances";
  return "overview";
}

function titleFromMessage(message: string): string {
  const compact = message.replace(/\s+/gu, " ").trim();
  return compact.length > 72 ? `${compact.slice(0, 69)}…` : compact;
}

function memoryCommand(message: string): { action: "save" | "forget"; content: string } | null {
  const save = message.match(/^\s*(?:remember(?:\s+that)?|save(?:\s+(?:this|my))?(?:\s+(?:preference|goal|interest))?)\s*[:,-]?\s*(.+?)\s*$/iu);
  if (save?.[1]) return { action: "save", content: save[1] };
  const forget = message.match(/^\s*(?:forget|delete\s+(?:the\s+)?memory(?:\s+that)?|remove\s+(?:the\s+)?memory(?:\s+that)?)\s*[:,-]?\s*(.+?)\s*$/iu);
  return forget?.[1] ? { action: "forget", content: forget[1] } : null;
}

function memoryCategory(content: string): FinancialMemoryCategory {
  if (/goal|save for|retire|retirement|target/u.test(content.toLowerCase())) return "goal";
  if (/halal|sharia|ethical|exclude|avoid/u.test(content.toLowerCase())) return "ethical_screening";
  if (/risk|conservative|balanced|growth|aggressive/u.test(content.toLowerCase())) return "risk_preference";
  if (/horizon|month|year|long[- ]term|short[- ]term/u.test(content.toLowerCase())) return "investment_horizon";
  if (/research|interest|sector|asset|market/u.test(content.toLowerCase())) return "research_interest";
  return "preference";
}

function stringifyList(values: string[]): string {
  return values.length > 0 ? values.join("; ") : "None recorded";
}

function referencedOpportunity(
  opportunities: Opportunity[],
  currentMessage: string,
  priorMessages: CopilotMessage[],
): Opportunity | null {
  const candidates = [
    currentMessage,
    ...priorMessages
      .filter((message) => message.role === "user")
      .slice(-6)
      .reverse()
      .map((message) => message.content),
  ];
  for (const candidate of candidates) {
    const normalized = candidate.toLowerCase();
    const tokens = new Set(normalized.split(/[^a-z0-9-]+/u).filter(Boolean));
    const match = opportunities.find((opportunity) => {
      const symbol = opportunity.symbol.toLowerCase();
      const name = opportunity.name.toLowerCase();
      const providerId = opportunity.marketData?.providerAssetId.toLowerCase();
      return (
        tokens.has(symbol) ||
        normalized.includes(name) ||
        (providerId ? normalized.includes(providerId) : false)
      );
    });
    if (match) return match;
  }
  return null;
}

@Injectable()
export class CopilotService {
  private readonly logger = new Logger(CopilotService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly wealthBrief: WealthBriefService,
    private readonly opportunityHunter: OpportunityHunterService,
    private readonly wealthGuardian: WealthGuardianService,
    private readonly portfolioRisk: PortfolioRiskService,
    private readonly documents: DocumentIntelligenceService,
    private readonly memory: FinancialMemoryService,
    private readonly rateLimit: WealthBriefRateLimitService,
    @Inject(COPILOT_PROVIDER) private readonly provider: CopilotProvider,
  ) {}

  async getDashboard(supabaseUserId: string): Promise<CopilotDashboard> {
    const customerId = await this.resolveCustomerId(supabaseUserId);
    const conversations = await this.listConversationSummaries(customerId);
    return {
      capabilities: {
        ...this.provider.getCapabilities(),
        documentSearchAvailable: this.documents.capabilities().semanticRagAvailable,
      },
      conversations,
      suggestedQuestions: SUGGESTED_QUESTIONS,
      historyNote:
        conversations.length > 0
          ? "Only conversations persisted for this authenticated customer are shown."
          : "No persisted copilot conversations exist for this customer yet.",
    };
  }

  async getConversation(
    supabaseUserId: string,
    conversationId: string,
  ): Promise<CopilotConversation> {
    const customerId = await this.resolveCustomerId(supabaseUserId);
    return this.loadConversation(customerId, conversationId);
  }

  async sendMessage(
    supabaseUserId: string,
    input: {
      conversationId?: string;
      message: string;
      externalAiOptIn: boolean;
      approveMemoryChange?: boolean;
      portfolioRiskContext?: PortfolioRiskRequest;
      searchDocuments?: boolean;
      documentId?: string;
    },
  ): Promise<CopilotTurnResult> {
    await this.rateLimit.assertAllowed(supabaseUserId);
    const customerId = await this.resolveCustomerId(supabaseUserId);
    const now = new Date();
    let conversationId = input.conversationId;
    let priorMessages: CopilotMessage[] = [];
    if (conversationId) {
      priorMessages = (
        await this.loadConversation(customerId, conversationId)
      ).messages;
    } else {
      conversationId = randomUUID();
      await this.prisma.auditEvent.create({
        data: {
          customerId,
          actorType: "customer",
          actorId: supabaseUserId,
          action: CONVERSATION_ACTION,
          targetType: "ai_copilot_conversation",
          targetId: conversationId,
          metadata: {
            title: titleFromMessage(input.message),
            createdAt: now.toISOString(),
          } as Prisma.InputJsonValue,
        },
      });
    }

    const command = memoryCommand(input.message);
    let memoryActionNote: string | null = null;
    if (command && !input.approveMemoryChange) {
      memoryActionNote = "No memory was changed. Re-send this request with the one-turn ‘Approve memory change’ control enabled.";
    } else if (command?.action === "save") {
      await this.memory.create(supabaseUserId, {
        category: memoryCategory(command.content),
        content: command.content,
        authorizedAgentIds: ["financial-copilot"],
      }, "copilot_explicit", "customer_confirmed");
      memoryActionNote = "I saved that as customer-confirmed Financial Copilot memory.";
    } else if (command?.action === "forget") {
      const forgotten = await this.memory.forgetExact(supabaseUserId, command.content);
      memoryActionNote = forgotten
        ? "I deleted the matching long-term memory."
        : "I did not delete anything because there was not exactly one matching long-term memory.";
    }

    let intent = classifyIntent(input.message);
    if (
      intent === "overview" &&
      /\b(why|more|that|it|those|continue|detail|explain)\b/iu.test(input.message)
    ) {
      const previousUserMessages = priorMessages.filter(
        (message) => message.role === "user",
      );
      const previousUserMessage =
        previousUserMessages[previousUserMessages.length - 1];
      if (previousUserMessage) intent = classifyIntent(previousUserMessage.content);
    }
    const [brief, opportunities, guardian, riskAnalysis, memoryContext] = await Promise.all([
      this.wealthBrief.generate(supabaseUserId, false),
      this.opportunityHunter.discover(),
      this.wealthGuardian.getDashboard(supabaseUserId),
      input.portfolioRiskContext
        ? this.portfolioRisk.analyze(input.portfolioRiskContext)
        : Promise.resolve(null),
      this.memory.retrieveForAgent(
        supabaseUserId,
        "financial-copilot",
        input.message,
        input.externalAiOptIn,
      ),
    ]);
    const { statements, citations } = this.buildCatalog(
      brief,
      opportunities,
      guardian,
      riskAnalysis,
      referencedOpportunity(
        opportunities.opportunities,
        input.message,
        priorMessages,
      )?.id ?? null,
    );
    this.addMemoryContext(intent, memoryContext, statements, citations);
    if (input.searchDocuments) {
      try {
        const passages = await this.documents.search(
          supabaseUserId,
          input.message,
          input.externalAiOptIn,
          input.documentId,
          5,
        );
        for (const passage of passages) {
          const citationId = `document:${passage.chunkId}`;
          citations.push({
            id: citationId,
            label: passage.citation,
            sourceType: "financial_document",
            observedAt: null,
            evidenceId: passage.chunkId,
            synthetic: false,
          });
          statements.push({
            id: `document-statement-${passage.chunkId}`,
            intent,
            topic: `authorized document · ${passage.fileName} · page ${passage.pageNumber}`,
            priority: Math.round(70 + Math.max(0, passage.similarity) * 25),
            text: `${passage.content} ${passage.citation}`,
            citationIds: [citationId],
          });
        }
      } catch (error) {
        this.logger.warn(
          `Authorized document retrieval was unavailable; copilot continued without document evidence (${error instanceof Error ? error.name : "unknown"}).`,
        );
      }
    }
    let selected = this.deterministicSelection(intent, statements);
    let mode: CopilotMessage["mode"] = "deterministic_preview";
    let fallbackReason: CopilotTurnResult["fallbackReason"] = null;
    let providerUsage: CopilotTurnResult["providerUsage"] = null;
    const capabilities = this.provider.getCapabilities();
    if (input.externalAiOptIn && capabilities.externalAiAvailable) {
      try {
        const providerStatements = memoryContext.externalAiUseAuthorized
          ? statements
          : statements.filter((statement) => !statement.id.startsWith("memory-statement-"));
        const ids = await this.provider.prioritize(intent, providerStatements);
        providerUsage = getAttachedProviderUsage(ids);
        const selectedByProvider = ids
          .map((id) => statements.find((statement) => statement.id === id))
          .filter((item): item is CopilotStatement => item !== undefined);
        if (selectedByProvider.length > 0) {
          const localMemory = memoryContext.externalAiUseAuthorized
            ? []
            : statements.filter((statement) => statement.id.startsWith("memory-statement-")).slice(0, 2);
          selected = [...localMemory, ...selectedByProvider].slice(0, 8);
        }
        mode = "ai_prioritized";
      } catch (error) {
        fallbackReason =
          error instanceof InvalidCopilotProviderOutputError
            ? "invalid_provider_output"
            : "provider_failure";
        this.logger.warn(
          `AI copilot prioritization failed; deterministic response returned (${fallbackReason}).`,
        );
      }
    }

    const usedCitationIds = new Set(selected.flatMap((item) => item.citationIds));
    const assistantMessage: CopilotMessage = {
      id: randomUUID(),
      role: "assistant",
      content: `${memoryActionNote ? `${memoryActionNote}\n\n` : ""}${this.renderAnswer(intent, selected)}`,
      createdAt: new Date().toISOString(),
      mode,
      providerName: mode === "ai_prioritized" ? capabilities.providerName : null,
      citations: citations.filter((citation) => usedCitationIds.has(citation.id)),
      suggestedQuestions: this.followUps(intent),
      disclaimer: DISCLAIMER,
      memoryInfluences: memoryContext.influences
        .filter((influence) => usedCitationIds.has(`memory:${influence.id}`))
        .map(({ id, category, summary, source }) => ({ id, category, summary, source })),
    };
    const userMessage: CopilotMessage = {
      id: randomUUID(),
      role: "user",
      content: input.message.trim(),
      createdAt: now.toISOString(),
      mode: null,
      providerName: null,
      citations: [],
      suggestedQuestions: [],
      disclaimer: null,
      memoryInfluences: [],
    };
    await this.prisma.auditEvent.create({
      data: {
        customerId,
        actorType: "customer",
        actorId: supabaseUserId,
        action: TURN_ACTION,
        targetType: "ai_copilot_conversation",
        targetId: conversationId,
        metadata: {
          intent,
          externalAiOptIn: input.externalAiOptIn,
          memoryChangeApproved: input.approveMemoryChange === true,
          memoryAction: command?.action ?? null,
          portfolioRiskContext: input.portfolioRiskContext ?? null,
          documentSearchRequested: input.searchDocuments === true,
          documentId: input.documentId ?? null,
          userMessage,
          assistantMessage,
          fallbackReason,
        } as unknown as Prisma.InputJsonValue,
      },
    });

    const conversation = await this.loadConversation(customerId, conversationId);
    const { messages: _messages, ...summary } = conversation;
    return {
      conversation: summary,
      message: assistantMessage,
      fallbackReason,
      providerUsage,
    };
  }

  private buildCatalog(
    brief: WealthBriefResult,
    research: OpportunityHunterResponse,
    guardian: WealthGuardianDashboard,
    riskAnalysis: PortfolioRiskAnalysis | null,
    focusedOpportunityId: string | null,
  ): { statements: CopilotStatement[]; citations: CopilotCitation[] } {
    const statements: CopilotStatement[] = [];
    const citations: CopilotCitation[] = [];
    const addCitation = (citation: CopilotCitation) => {
      if (!citations.some((item) => item.id === citation.id)) citations.push(citation);
      return citation.id;
    };
    const sourceCitationIds = new Map<string, string>(
      brief.sources.map((source) => {
        const id = addCitation({
          id: `account:${source.id}`,
          label: `${source.label} (${source.status.replace(/_/gu, " ")})`,
          sourceType: "account_snapshot",
          observedAt: source.asOf,
          evidenceId: null,
          synthetic: false,
        });
        return [source.id, id] as const;
      }),
    );
    const citationForSource = (sourceId: string) =>
      sourceCitationIds.get(sourceId) ??
      addCitation({
        id: `brief:${sourceId}`,
        label: "Wealth Brief snapshot",
        sourceType: "wealth_brief",
        observedAt: brief.dataAsOf,
        evidenceId: null,
        synthetic: false,
      });
    let statementIndex = 0;
    const addStatement = (
      statementIntent: CopilotIntent,
      topic: string,
      priority: number,
      text: string,
      citationIds: string[],
    ) => statements.push({
      id: `statement-${++statementIndex}`,
      intent: statementIntent,
      topic,
      priority,
      text,
      citationIds: [...new Set(citationIds)],
    });

    addStatement(
      "overview",
      "wealth brief summary",
      100,
      brief.summary,
      brief.sources.map((source) => citationForSource(source.id)),
    );
    for (const observation of brief.observations.slice(0, 5)) {
      addStatement(
        "overview",
        "verified account observation",
        78,
        observation.text,
        observation.sourceIds.map(citationForSource),
      );
    }
    for (const risk of brief.riskFlags.slice(0, 5)) {
      addStatement(
        "overview",
        `${risk.severity} account risk flag`,
        risk.severity === "critical" ? 98 : risk.severity === "warning" ? 90 : 70,
        `${risk.title}: ${risk.detail}`,
        risk.sourceIds.map(citationForSource),
      );
    }

    const position = brief.financialPosition;
    if (position.balances.length === 0) {
      addStatement("balances", "balance availability", 90, "No balance records are available in the current authenticated snapshot.", [citationForSource("balances")]);
    }
    for (const balance of position.balances.slice(0, 8)) {
      addStatement(
        "balances",
        `${balance.assetSymbol} balance`,
        92,
        `${balance.assetName} (${balance.assetSymbol}) on chain ${balance.chainId}: ${balance.availableBalance} available and ${balance.pendingBalance} pending.`,
        [citationForSource("balances")],
      );
    }
    if (position.recentTransactions.length === 0) {
      addStatement("transactions", "transaction availability", 90, "No recent transaction records are available in the current snapshot.", [citationForSource("transactions")]);
    }
    for (const transaction of position.recentTransactions.slice(0, 6)) {
      addStatement(
        "transactions",
        `${transaction.type} transaction status`,
        transaction.status.toLowerCase().includes("fail") ? 98 : 86,
        `${transaction.type} of ${transaction.requestedAmount} ${transaction.assetSymbol} is ${transaction.status}${transaction.settledAmount ? `; ${transaction.settledAmount} settled` : ""}.`,
        [citationForSource("transactions")],
      );
    }
    if (position.outstandingLoans.length === 0) {
      addStatement("loans", "loan availability", 90, "No outstanding loan records are available in the current snapshot.", [citationForSource("loans")]);
    }
    for (const loan of position.outstandingLoans.slice(0, 5)) {
      addStatement(
        "loans",
        `${loan.borrowAssetSymbol} loan`,
        94,
        `${loan.status} loan: ${loan.outstandingTotalAmount} ${loan.borrowAssetSymbol} outstanding, backed by ${loan.collateralAmount} ${loan.collateralAssetSymbol}${loan.latestLtvBps === null ? "" : ` at ${(loan.latestLtvBps / 100).toFixed(2)}% LTV`}. Next due: ${loan.nextDueAt ?? "not recorded"}; autopay is ${loan.autopayEnabled ? "enabled" : "disabled"}.`,
        [citationForSource("loans")],
      );
    }
    if (position.stakingPositions.length === 0) {
      addStatement("staking", "staking availability", 90, "No staking-position records are available in the current snapshot.", [citationForSource("staking")]);
    }
    for (const staking of position.stakingPositions.slice(0, 5)) {
      addStatement(
        "staking",
        "staking position",
        90,
        `${staking.poolStatus} staking position: ${staking.stakedBalance ?? "unavailable"} staked and ${staking.pendingReward ?? "unavailable"} pending reward. Read access is ${staking.canReadPosition ? "available" : "unavailable"}.`,
        [citationForSource("staking")],
      );
    }

    const catalogOpportunities = [...research.opportunities]
      .sort((left, right) =>
        left.id === focusedOpportunityId
          ? -1
          : right.id === focusedOpportunityId
            ? 1
            : right.score - left.score,
      )
      .slice(0, 7);
    for (const opportunity of catalogOpportunities) {
      const focusBoost = opportunity.id === focusedOpportunityId ? 200 : 0;
      const evidenceCitationIds = opportunity.evidence.slice(0, 4).map((evidence) =>
        addCitation({
          id: `opportunity:${opportunity.id}:${evidence.id}`,
          label: `${opportunity.name}: ${evidence.sourceLabel}`,
          sourceType: "market_data",
          observedAt: evidence.observedAt,
          evidenceId: evidence.id,
          synthetic: evidence.synthetic,
        }),
      );
      const screeningCitationIds = opportunity.halalScreening.ruleResults
        .flatMap((rule) => rule.evidence)
        .slice(0, 5)
        .map((evidence) =>
          addCitation({
            id: `screening:${opportunity.id}:${evidence.evidenceId}`,
            label: `${opportunity.name}: ${evidence.sourceLabel}`,
            sourceType: "halal_screening",
            observedAt: evidence.observedAt,
            evidenceId: evidence.evidenceId,
            synthetic: evidence.synthetic,
          }),
        );
      addStatement(
        "opportunities",
        `${opportunity.name} market research`,
        opportunity.score + focusBoost,
        `${opportunity.name} (${opportunity.symbol}) scores ${opportunity.score}/100 with ${opportunity.riskLevel} risk. ${opportunity.marketData ? `Price is $${opportunity.marketData.priceUsd} and the published trend is ${opportunity.marketData.trend}.` : "No verified live market observation is available."} ${opportunity.synthetic ? "This is a clearly labeled synthetic research example." : "This uses verified market observations."}`,
        evidenceCitationIds,
      );
      addStatement(
        "halal_screening",
        `${opportunity.name} preliminary halal screen`,
        focusBoost + (opportunity.halalScreening.status === "excluded" ? 100 : opportunity.halalScreening.status === "questionable" ? 96 : 88),
        `${opportunity.name} is preliminarily ${opportunity.halalScreening.status.replace(/_/gu, " ")} under methodology ${opportunity.halalScreening.methodologyVersion}. ${stringifyList(opportunity.halalScreening.rationale)}${opportunity.halalScreening.evidenceGaps.length > 0 ? ` Evidence gaps: ${stringifyList(opportunity.halalScreening.evidenceGaps)}.` : ""}`,
        screeningCitationIds.length > 0 ? screeningCitationIds : evidenceCitationIds,
      );
      const scenarios = opportunity.scenarios
        .map((scenario) => `${scenario.label}: ${scenario.returnRangePercent[0]}% to ${scenario.returnRangePercent[1]}% over ${scenario.timeHorizonMonths} months, assuming ${stringifyList(scenario.assumptions)}`)
        .join(" | ");
      addStatement(
        "research_plan",
        `${opportunity.name} educational plan`,
        opportunity.score + focusBoost,
        `${opportunity.researchPlan.objective} Risks: ${stringifyList(opportunity.researchPlan.riskConsiderations)}. Ethical considerations: ${stringifyList(opportunity.researchPlan.ethicalConsiderations)}. Scenario assumptions (not forecasts): ${scenarios}. Monitor: ${stringifyList(opportunity.researchPlan.monitoringSignals)}. Stop or reassess if: ${stringifyList(opportunity.researchPlan.exitConditions)}.`,
        [...evidenceCitationIds, ...screeningCitationIds],
      );
    }

    const latest = guardian.latestReport;
    if (!latest) {
      const guardianCitation = addCitation({
        id: "guardian:none",
        label: "Customer Wealth Guardian history",
        sourceType: "guardian_report",
        observedAt: null,
        evidenceId: null,
        synthetic: false,
      });
      addStatement("wealth_guardian", "guardian report availability", 100, "No persisted Wealth Guardian report exists for this customer, so no overnight change or historical comparison is claimed.", [guardianCitation]);
    } else {
      const guardianCitation = addCitation({
        id: `guardian:${latest.id}`,
        label: `Wealth Guardian ${latest.trigger} report`,
        sourceType: "guardian_report",
        observedAt: latest.evidenceAsOf,
        evidenceId: latest.id,
        synthetic: latest.datasetKind === "synthetic_research",
      });
      addStatement("wealth_guardian", "latest guardian summary", 100, `${latest.summary} ${latest.comparison.reason}`, [guardianCitation]);
      for (const risk of latest.risks.slice(0, 4)) {
        addStatement("wealth_guardian", `${risk.severity} guardian risk`, risk.severity === "high" ? 98 : 90, risk.finding, [guardianCitation]);
      }
      for (const alert of latest.halalAlerts.slice(0, 4)) {
        addStatement("wealth_guardian", "guardian halal alert", alert.currentStatus === "excluded" ? 100 : 95, `${alert.name}: ${alert.currentStatus.replace(/_/gu, " ")}. ${alert.reason}`, [guardianCitation]);
      }
    }

    if (riskAnalysis) {
      const snapshot = riskAnalysis.current;
      const riskCitation = addCitation({
        id: `portfolio-risk:${riskAnalysis.dataQuality.asOf}`,
        label: `Portfolio Risk Lab (${riskAnalysis.dataQuality.reliability})`,
        sourceType: "portfolio_risk",
        observedAt: riskAnalysis.dataQuality.asOf,
        evidenceId: riskAnalysis.methodology.version,
        synthetic: riskAnalysis.dataQuality.datasetKind === "synthetic_research",
      });
      addStatement(
        "portfolio_risk",
        "portfolio health",
        110,
        `The deterministic health score is ${snapshot.guardian.healthScore}/100 (${snapshot.guardian.healthLabel}). Weighted risk is ${snapshot.metrics.weightedRiskScore}/3 (${snapshot.metrics.riskLabel}), diversification is ${snapshot.metrics.diversificationScore}/100, and the largest asset weight is ${snapshot.metrics.maximumAssetWeightPercent}%.`,
        [riskCitation],
      );
      for (const weakness of snapshot.guardian.weaknesses.slice(0, 4)) {
        addStatement(
          "portfolio_risk",
          `${weakness.severity} portfolio weakness`,
          weakness.severity === "high" ? 108 : weakness.severity === "warning" ? 102 : 88,
          weakness.finding,
          [riskCitation],
        );
      }
      for (const scenario of snapshot.stressTests) {
        addStatement(
          "portfolio_risk",
          `${scenario.label} hypothetical scenario`,
          scenario.id === "market_crash" ? 106 : 92,
          `${scenario.label} is a hypothetical fixed-rule scenario: ${scenario.portfolioReturnPercent}% (${scenario.changeUsd} USD), leaving a modeled value of ${scenario.projectedValueUsd} USD. ${scenario.description}`,
          [riskCitation],
        );
      }
      addStatement(
        "portfolio_risk",
        "halal exposure",
        104,
        `Preliminary halal exposure is ${snapshot.halal.statusWeights.eligible}% eligible, ${snapshot.halal.statusWeights.questionable}% questionable, ${snapshot.halal.statusWeights.excluded}% excluded, and ${snapshot.halal.statusWeights.insufficient_evidence}% insufficient evidence. This is not religious certification.`,
        [riskCitation],
      );
    }

    return { statements, citations };
  }

  private addMemoryContext(
    intent: CopilotIntent,
    context: FinancialMemoryContext,
    statements: CopilotStatement[],
    citations: CopilotCitation[],
  ): void {
    for (const [index, influence] of context.influences.entries()) {
      const citationId = `memory:${influence.id}`;
      citations.push({
        id: citationId,
        label: `Your ${influence.category.replace(/_/gu, " ")}: ${influence.summary}`,
        sourceType: "customer_memory",
        observedAt: null,
        evidenceId: influence.id,
        synthetic: false,
      });
      statements.push({
        id: `memory-statement-${index + 1}`,
        intent,
        topic: `authorized customer ${influence.category.replace(/_/gu, " ")}`,
        priority: 115 - index,
        text: `Personalization applied: ${influence.summary}`,
        citationIds: [citationId],
      });
    }
  }

  private deterministicSelection(
    intent: CopilotIntent,
    statements: CopilotStatement[],
  ): CopilotStatement[] {
    const direct = statements.filter((item) => item.intent === intent);
    const candidates = direct.length > 0
      ? [...direct, ...statements.filter((item) => item.intent === "overview").slice(0, 1)]
      : statements.filter((item) => item.intent === "overview");
    return candidates.sort((left, right) => right.priority - left.priority).slice(0, 8);
  }

  private renderAnswer(intent: CopilotIntent, statements: CopilotStatement[]): string {
    const introductions: Record<CopilotIntent, string> = {
      overview: "Here is the current evidence-backed overview.",
      balances: "Here is what the authenticated account snapshot shows about balances.",
      transactions: "Here are the recent transaction facts available to the copilot.",
      loans: "Here is the current read-only loan context.",
      staking: "Here is the current staking context.",
      opportunities: "Here are the current evidence-backed opportunity findings.",
      halal_screening: "Here are the preliminary halal-screening results; these are transparent research screens, not religious certification.",
      wealth_guardian: "Here is what the persisted Wealth Guardian record supports.",
      research_plan: "Here is an educational research plan built from existing evidence and server-authored scenarios.",
      portfolio_risk: "Here is the deterministic Portfolio Risk Lab context. Historical observations and hypothetical stress assumptions are identified separately.",
    };
    return `${introductions[intent]}\n\n${statements.map((item) => `• ${item.text}`).join("\n\n")}`;
  }

  private followUps(intent: CopilotIntent): string[] {
    const withoutCurrent = SUGGESTED_QUESTIONS.filter((question) =>
      classifyIntent(question) !== intent,
    );
    return withoutCurrent.slice(0, 3);
  }

  private async resolveCustomerId(supabaseUserId: string): Promise<string> {
    const customer = await this.prisma.customer.findUnique({
      where: { supabaseUserId },
      select: { id: true },
    });
    if (!customer) throw new NotFoundException("Customer profile not found.");
    return customer.id;
  }

  private async listConversationSummaries(
    customerId: string,
  ): Promise<CopilotConversationSummary[]> {
    const conversations = await this.prisma.auditEvent.findMany({
      where: {
        customerId,
        action: CONVERSATION_ACTION,
        targetType: "ai_copilot_conversation",
      },
      orderBy: { createdAt: "desc" },
      take: 30,
    });
    const ids = conversations
      .map((event) => event.targetId)
      .filter((id): id is string => id !== null);
    const turns = ids.length === 0
      ? []
      : await this.prisma.auditEvent.findMany({
          where: { customerId, action: TURN_ACTION, targetId: { in: ids } },
          orderBy: { createdAt: "asc" },
        });
    return conversations.flatMap((event) => {
      if (!event.targetId) return [];
      const metadata = asObject(event.metadata);
      const conversationTurns = turns.filter((turn) => turn.targetId === event.targetId);
      return [{
        id: event.targetId,
        title: typeof metadata.title === "string" ? metadata.title : "Copilot conversation",
        createdAt: event.createdAt.toISOString(),
        updatedAt:
          conversationTurns[conversationTurns.length - 1]?.createdAt.toISOString() ??
          event.createdAt.toISOString(),
        messageCount: conversationTurns.length * 2,
      }];
    }).sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt));
  }

  private async loadConversation(
    customerId: string,
    conversationId: string,
  ): Promise<CopilotConversation> {
    const created = await this.prisma.auditEvent.findFirst({
      where: {
        customerId,
        action: CONVERSATION_ACTION,
        targetType: "ai_copilot_conversation",
        targetId: conversationId,
      },
    });
    if (!created) throw new NotFoundException("Copilot conversation not found.");
    const turns = await this.prisma.auditEvent.findMany({
      where: { customerId, action: TURN_ACTION, targetId: conversationId },
      orderBy: { createdAt: "asc" },
      take: 100,
    });
    const messages = turns.flatMap((turn) => {
      const metadata = asObject(turn.metadata);
      const userMessage = metadata.userMessage;
      const assistantMessage = metadata.assistantMessage;
      if (
        typeof userMessage !== "object" || userMessage === null || Array.isArray(userMessage) ||
        typeof assistantMessage !== "object" || assistantMessage === null || Array.isArray(assistantMessage)
      ) return [];
      return [userMessage as unknown as CopilotMessage, assistantMessage as unknown as CopilotMessage];
    });
    const metadata = asObject(created.metadata);
    return {
      id: conversationId,
      title: typeof metadata.title === "string" ? metadata.title : "Copilot conversation",
      createdAt: created.createdAt.toISOString(),
      updatedAt:
        turns[turns.length - 1]?.createdAt.toISOString() ??
        created.createdAt.toISOString(),
      messageCount: messages.length,
      messages,
    };
  }
}
