import { Module } from "@nestjs/common";
import { loadAiWealthBriefRuntimeConfig } from "@stealth-trails-bank/config/api";
import { PrismaService } from "../../prisma/prisma.service";
import { CustomerBalancesService } from "../../customer-balances/customer-balances.service";
import { AgentObservatoryService } from "../agent-observatory.service";
import { DocumentIntelligenceService } from "../document-intelligence.service";
import { DocumentTextExtractor } from "../document-text-extractor";
import {
  createDocumentIntelligenceProvider,
  DOCUMENT_INTELLIGENCE_PROVIDER,
} from "../document-intelligence.provider";
import { FinancialMemoryService } from "../financial-memory.service";
import { MarketDataService } from "../market-data.service";
import {
  MARKET_DATA_CONFIG,
  MARKET_DATA_PROVIDER,
  type MarketDataProvider,
  type MarketAssetSnapshot,
} from "../market-data.provider";
import { OpportunityHunterService } from "../opportunity-hunter.service";
import {
  createOpportunityAnalystProvider,
  OPPORTUNITY_ANALYST_PROVIDER,
} from "../opportunity-analyst.provider";
import { PortfolioRiskService } from "../portfolio-risk.service";
import { FinancialResearchTools } from "../financial-research.tools";
import { FinancialResearchService } from "../financial-research.service";
import { FinancialResearchPolicy } from "../financial-research.policy";
import { RESEARCH_MODEL } from "../financial-research.types";
import { createResearchModel } from "../financial-research.provider";
import { EvaluationController, EvaluationGuard } from "./evaluation.controller";

// Same runtime, registry and business services as Copilot. No financial executors,
// wallet infrastructure, workers, regular login endpoints, or transaction writers.
@Module({
  controllers: [EvaluationController],
  providers: [
    PrismaService,
    CustomerBalancesService,
    AgentObservatoryService,
    DocumentIntelligenceService,
    DocumentTextExtractor,
    FinancialMemoryService,
    MarketDataService,
    OpportunityHunterService,
    PortfolioRiskService,
    FinancialResearchTools,
    FinancialResearchPolicy,
    FinancialResearchService,
    EvaluationGuard,
    { provide: RESEARCH_MODEL, useFactory: createResearchModel },
    {
      provide: DOCUMENT_INTELLIGENCE_PROVIDER,
      useFactory: () =>
        createDocumentIntelligenceProvider(
          "test",
          loadAiWealthBriefRuntimeConfig(),
        ),
    },
    {
      provide: OPPORTUNITY_ANALYST_PROVIDER,
      useFactory: () =>
        createOpportunityAnalystProvider({
          environment: "test",
          aiConfig: loadAiWealthBriefRuntimeConfig(),
          explicitlyEnabled: false,
        }),
    },
    {
      provide: MARKET_DATA_CONFIG,
      useValue: { provider: "recorded", cacheTtlMs: 0, staleTtlMs: 0 },
    },
    {
      provide: MARKET_DATA_PROVIDER,
      inject: [PrismaService],
      useFactory: (prisma: PrismaService): MarketDataProvider => ({
        name: "recorded",
        fetchMarketSnapshot: async () => {
          const row = await prisma.auditEvent.findUnique({
            where: { id: "agent-evaluation-market-observations" },
            select: { metadata: true },
          });
          const data = row?.metadata as unknown as {
            assets?: MarketAssetSnapshot[];
          } | null;
          if (!data?.assets?.length)
            throw new Error("recorded_market_observations_unavailable");
          return data.assets;
        },
      }),
    },
  ],
})
export class EvaluationModule {}
