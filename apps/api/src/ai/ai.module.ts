import { Module } from "@nestjs/common";
import {
  loadAiWealthBriefRuntimeConfig,
  loadApiServerRuntimeConfig,
} from "@stealth-trails-bank/config/api";
import { PrismaService } from "../prisma/prisma.service";
import { InternalWorkerApiKeyGuard } from "../auth/guards/internal-worker-api-key.guard";
import { CustomerBalancesModule } from "../customer-balances/customer-balances.module";
import { LoansModule } from "../loans/loans.module";
import { RetirementVaultModule } from "../retirement-vault/retirement-vault.module";
import { SolvencyModule } from "../solvency/solvency.module";
import { StakingPoolModule } from "../staking/staking.module";
import { TransactionIntentsModule } from "../transaction-intents/transaction-intents.module";
import { AiController } from "./ai.controller";
import {
  createMarketDataProvider,
  loadMarketDataRuntimeConfig,
  MARKET_DATA_CONFIG,
  MARKET_DATA_PROVIDER,
  type MarketDataRuntimeConfig,
} from "./market-data.provider";
import { MarketDataService } from "./market-data.service";
import {
  createOpportunityAnalystProvider,
  OPPORTUNITY_ANALYST_PROVIDER,
} from "./opportunity-analyst.provider";
import { OpportunityHunterController } from "./opportunity-hunter.controller";
import { OpportunityHunterService } from "./opportunity-hunter.service";
import {
  createWealthBriefProvider,
  WEALTH_BRIEF_PROVIDER,
} from "./wealth-brief.provider";
import { WealthBriefRateLimitService } from "./wealth-brief-rate-limit.service";
import { WealthBriefService } from "./wealth-brief.service";
import { WealthSnapshotService } from "./wealth-snapshot.service";
import { WealthGuardianController } from "./wealth-guardian.controller";
import { WealthGuardianService } from "./wealth-guardian.service";
import { WealthGuardianWorkerController } from "./wealth-guardian-worker.controller";
import { CopilotController } from "./copilot.controller";
import { CopilotService } from "./copilot.service";
import {
  COPILOT_PROVIDER,
  createCopilotProvider,
} from "./copilot.provider";
import { ResearchPlanController } from "./research-plan.controller";
import { ResearchPlanService } from "./research-plan.service";
import { PortfolioRiskController } from "./portfolio-risk.controller";
import { PortfolioRiskService } from "./portfolio-risk.service";
import { AgentObservatoryController } from "./agent-observatory.controller";
import { AgentObservatoryService } from "./agent-observatory.service";
import { DocumentIntelligenceController } from "./document-intelligence.controller";
import { DocumentIntelligenceService } from "./document-intelligence.service";
import { DocumentTextExtractor } from "./document-text-extractor";
import {
  createDocumentIntelligenceProvider,
  DOCUMENT_INTELLIGENCE_PROVIDER,
} from "./document-intelligence.provider";
import { InvestmentCommitteeController } from "./investment-committee.controller";
import { InvestmentCommitteeService } from "./investment-committee.service";
import { InvestmentCommitteeLlmService } from "./investment-committee.llm.service";
import { InvestmentCommitteeTools } from "./investment-committee.tools";
import {
  WorkflowStudioController,
  WorkflowStudioWorkerController,
} from "./workflow-studio.controller";
import { WorkflowStudioService } from "./workflow-studio.service";
import { FinancialMemoryController } from "./financial-memory.controller";
import { FinancialMemoryService } from "./financial-memory.service";

@Module({
  imports: [
    CustomerBalancesModule,
    TransactionIntentsModule,
    StakingPoolModule,
    LoansModule,
    RetirementVaultModule,
    SolvencyModule,
  ],
  controllers: [
    AiController,
    OpportunityHunterController,
    WealthGuardianController,
    WealthGuardianWorkerController,
    CopilotController,
    ResearchPlanController,
    PortfolioRiskController,
    AgentObservatoryController,
    DocumentIntelligenceController,
    InvestmentCommitteeController,
    WorkflowStudioController,
    WorkflowStudioWorkerController,
    FinancialMemoryController,
  ],
  providers: [
    WealthSnapshotService,
    WealthBriefService,
    MarketDataService,
    OpportunityHunterService,
    WealthGuardianService,
    CopilotService,
    ResearchPlanService,
    PortfolioRiskService,
    AgentObservatoryService,
    DocumentIntelligenceService,
    DocumentTextExtractor,
    InvestmentCommitteeService,
    InvestmentCommitteeLlmService,
    InvestmentCommitteeTools,
    WorkflowStudioService,
    FinancialMemoryService,
    InternalWorkerApiKeyGuard,
    {
      provide: MARKET_DATA_CONFIG,
      useFactory: () => loadMarketDataRuntimeConfig(),
    },
    {
      provide: MARKET_DATA_PROVIDER,
      useFactory: (config: MarketDataRuntimeConfig) =>
        createMarketDataProvider(config),
      inject: [MARKET_DATA_CONFIG],
    },
    {
      provide: OPPORTUNITY_ANALYST_PROVIDER,
      useFactory: () =>
        createOpportunityAnalystProvider({
          aiConfig: loadAiWealthBriefRuntimeConfig(),
          environment: loadApiServerRuntimeConfig().environment,
          explicitlyEnabled:
            process.env.AI_OPPORTUNITY_ANALYST_ENABLED === "true",
        }),
    },
    {
      provide: COPILOT_PROVIDER,
      useFactory: () =>
        createCopilotProvider({
          aiConfig: loadAiWealthBriefRuntimeConfig(),
          environment: loadApiServerRuntimeConfig().environment,
          explicitlyEnabled: process.env.AI_COPILOT_ENABLED === "true",
        }),
    },
    {
      provide: DOCUMENT_INTELLIGENCE_PROVIDER,
      useFactory: () =>
        createDocumentIntelligenceProvider(
          loadApiServerRuntimeConfig().environment,
          loadAiWealthBriefRuntimeConfig(),
        ),
    },
    {
      provide: WealthBriefRateLimitService,
      useFactory: (prisma: PrismaService) =>
        new WealthBriefRateLimitService(prisma, {
          environment: loadApiServerRuntimeConfig().environment,
          externalAiEnabled:
            loadAiWealthBriefRuntimeConfig().provider !== "disabled",
        }),
      inject: [PrismaService],
    },
    {
      provide: WEALTH_BRIEF_PROVIDER,
      useFactory: () =>
        createWealthBriefProvider(loadAiWealthBriefRuntimeConfig()),
    },
  ],
})
export class AiModule {}
