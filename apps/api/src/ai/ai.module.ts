import { Module } from "@nestjs/common";
import { loadAiWealthBriefRuntimeConfig } from "@stealth-trails-bank/config/api";
import { CustomerBalancesModule } from "../customer-balances/customer-balances.module";
import { LoansModule } from "../loans/loans.module";
import { RetirementVaultModule } from "../retirement-vault/retirement-vault.module";
import { SolvencyModule } from "../solvency/solvency.module";
import { StakingPoolModule } from "../staking/staking.module";
import { TransactionIntentsModule } from "../transaction-intents/transaction-intents.module";
import { AiController } from "./ai.controller";
import {
  createWealthBriefProvider,
  WEALTH_BRIEF_PROVIDER,
} from "./wealth-brief.provider";
import { WealthBriefRateLimitService } from "./wealth-brief-rate-limit.service";
import { WealthBriefService } from "./wealth-brief.service";
import { WealthSnapshotService } from "./wealth-snapshot.service";

@Module({
  imports: [
    CustomerBalancesModule,
    TransactionIntentsModule,
    StakingPoolModule,
    LoansModule,
    RetirementVaultModule,
    SolvencyModule,
  ],
  controllers: [AiController],
  providers: [
    WealthSnapshotService,
    WealthBriefService,
    WealthBriefRateLimitService,
    {
      provide: WEALTH_BRIEF_PROVIDER,
      useFactory: () =>
        createWealthBriefProvider(loadAiWealthBriefRuntimeConfig()),
    },
  ],
})
export class AiModule {}
