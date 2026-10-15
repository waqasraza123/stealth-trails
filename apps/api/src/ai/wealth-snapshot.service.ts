import { Injectable } from "@nestjs/common";
import { CustomerBalancesService } from "../customer-balances/customer-balances.service";
import { LoansService } from "../loans/loans.service";
import { RetirementVaultService } from "../retirement-vault/retirement-vault.service";
import { SolvencyService } from "../solvency/solvency.service";
import { StakingService } from "../staking/staking.service";
import { TransactionIntentsService } from "../transaction-intents/transaction-intents.service";
import type {
  WealthBriefSource,
  WealthBriefSourceId,
  WealthSnapshot,
} from "./wealth-brief.types";

type SettledSource<T> =
  | { status: "fulfilled"; value: T }
  | { status: "rejected"; reason: unknown };

const SOURCE_LABELS: Record<WealthBriefSourceId, string> = {
  balances: "Account and asset balances",
  transactions: "Recent transaction activity",
  staking: "Staking and yield positions",
  loans: "Outstanding loans",
  retirement_vaults: "Retirement vault positions",
  solvency: "Customer solvency information",
};
const SNAPSHOT_LIMITS = {
  balances: 50,
  transactions: 12,
  stakingPositions: 25,
  outstandingLoans: 25,
  retirementVaults: 25,
  solvencyLiabilities: 50,
} as const;

function latestTimestamp(values: Array<string | null | undefined>, fallback: string): string {
  let latest = Number.NEGATIVE_INFINITY;
  let latestValue = fallback;

  for (const value of values) {
    if (!value) {
      continue;
    }
    const timestamp = Date.parse(value);
    if (Number.isFinite(timestamp) && timestamp > latest) {
      latest = timestamp;
      latestValue = value;
    }
  }

  return latestValue;
}

function isPositiveDecimal(value: string): boolean {
  return !/^[-+]?0*(?:\.0*)?$/u.test(value.trim());
}

@Injectable()
export class WealthSnapshotService {
  constructor(
    private readonly customerBalancesService: CustomerBalancesService,
    private readonly transactionIntentsService: TransactionIntentsService,
    private readonly stakingService: StakingService,
    private readonly loansService: LoansService,
    private readonly retirementVaultService: RetirementVaultService,
    private readonly solvencyService: SolvencyService,
  ) {}

  async collect(supabaseUserId: string): Promise<WealthSnapshot> {
    const generatedAt = new Date().toISOString();
    const [balancesResult, transactionsResult, stakingResult, loansResult, vaultsResult, solvencyResult] =
      (await Promise.allSettled([
        this.customerBalancesService.listMyBalances(supabaseUserId),
        this.transactionIntentsService.listMyTransactionIntents(supabaseUserId, {
          limit: 12,
        }),
        this.stakingService.getMySnapshot(supabaseUserId),
        this.loansService.getCustomerDashboard(supabaseUserId),
        this.retirementVaultService.listMyRetirementVaults(supabaseUserId),
        this.solvencyService.getCustomerLiabilityInclusionProof(supabaseUserId),
      ])) as [
        SettledSource<Awaited<ReturnType<CustomerBalancesService["listMyBalances"]>>>,
        SettledSource<Awaited<ReturnType<TransactionIntentsService["listMyTransactionIntents"]>>>,
        SettledSource<Awaited<ReturnType<StakingService["getMySnapshot"]>>>,
        SettledSource<Awaited<ReturnType<LoansService["getCustomerDashboard"]>>>,
        SettledSource<Awaited<ReturnType<RetirementVaultService["listMyRetirementVaults"]>>>,
        SettledSource<Awaited<ReturnType<SolvencyService["getCustomerLiabilityInclusionProof"]>>>,
      ];

    const balances =
      balancesResult.status === "fulfilled"
        ? balancesResult.value.balances.slice(0, SNAPSHOT_LIMITS.balances).map((balance) => ({
            assetSymbol: balance.asset.symbol,
            assetName: balance.asset.displayName,
            chainId: balance.asset.chainId,
            availableBalance: balance.availableBalance,
            pendingBalance: balance.pendingBalance,
            updatedAt: balance.updatedAt,
          }))
        : [];

    const recentTransactions =
      transactionsResult.status === "fulfilled"
        ? transactionsResult.value.intents.slice(0, SNAPSHOT_LIMITS.transactions).map((intent) => ({
            type: intent.intentType,
            status: intent.status,
            assetSymbol: intent.asset.symbol,
            requestedAmount: intent.requestedAmount,
            settledAmount: intent.settledAmount,
            createdAt: intent.createdAt,
            updatedAt: intent.updatedAt,
          }))
        : [];

    const stakingData =
      stakingResult.status === "fulfilled" ? stakingResult.value.data : undefined;
    const stakingPositions =
      stakingData?.pools.slice(0, SNAPSHOT_LIMITS.stakingPositions).map((pool) => ({
        poolStatus: pool.poolStatus,
        stakedBalance: pool.position.stakedBalance,
        pendingReward: pool.position.pendingReward,
        canReadPosition: pool.position.canReadPosition,
        updatedAt: pool.updatedAt,
      })) ?? [];

    const outstandingLoans =
      loansResult.status === "fulfilled"
        ? loansResult.value.agreements
            .filter(
              (agreement) =>
                agreement.status !== "closed" &&
                isPositiveDecimal(agreement.outstandingTotalAmount),
            )
            .slice(0, SNAPSHOT_LIMITS.outstandingLoans)
            .map((agreement) => ({
              status: agreement.status,
              borrowAssetSymbol: agreement.borrowAsset.symbol,
              collateralAssetSymbol: agreement.collateralAsset.symbol,
              outstandingPrincipalAmount: agreement.outstandingPrincipalAmount,
              outstandingServiceFeeAmount:
                agreement.outstandingServiceFeeAmount,
              outstandingTotalAmount: agreement.outstandingTotalAmount,
              collateralAmount: agreement.collateralAmount,
              latestLtvBps:
                agreement.collateralPositions.find(
                  (position) => position.latestLtvBps !== null,
                )?.latestLtvBps ?? null,
              autopayEnabled: agreement.autopayEnabled,
              nextDueAt: agreement.nextDueAt,
              gracePeriodEndsAt: agreement.gracePeriodEndsAt,
            }))
        : [];

    const retirementVaults =
      vaultsResult.status === "fulfilled"
        ? vaultsResult.value.vaults.slice(0, SNAPSHOT_LIMITS.retirementVaults).map((vault) => ({
            status: vault.status,
            assetSymbol: vault.asset.symbol,
            lockedBalance: vault.lockedBalance,
            strictMode: vault.strictMode,
            unlockAt: vault.unlockAt,
            updatedAt: vault.updatedAt,
          }))
        : [];

    const solvency =
      solvencyResult.status === "fulfilled"
        ? {
            status: solvencyResult.value.snapshot.status,
            evidenceFreshness: solvencyResult.value.snapshot.evidenceFreshness,
            generatedAt: solvencyResult.value.snapshot.generatedAt,
            publishedAt: solvencyResult.value.report.publishedAt,
            policyActionsTriggered:
              solvencyResult.value.snapshot.policyActionsTriggered,
            liabilities: solvencyResult.value.proofs
              .slice(0, SNAPSHOT_LIMITS.solvencyLiabilities)
              .map((proof) => ({
              assetSymbol: proof.asset.symbol,
              totalLiabilityAmount: proof.payload.totalLiabilityAmount,
              })),
          }
        : null;

    const sources: WealthBriefSource[] = [
      this.buildSource(
        "balances",
        balancesResult,
        balances.length,
        latestTimestamp(balances.map((item) => item.updatedAt), generatedAt),
      ),
      this.buildSource(
        "transactions",
        transactionsResult,
        recentTransactions.length,
        latestTimestamp(recentTransactions.map((item) => item.updatedAt), generatedAt),
      ),
      this.buildSource(
        "staking",
        stakingResult,
        stakingPositions.length,
        latestTimestamp(stakingPositions.map((item) => item.updatedAt), generatedAt),
      ),
      this.buildSource(
        "loans",
        loansResult,
        outstandingLoans.length,
        generatedAt,
      ),
      this.buildSource(
        "retirement_vaults",
        vaultsResult,
        retirementVaults.length,
        latestTimestamp(retirementVaults.map((item) => item.updatedAt), generatedAt),
      ),
      this.buildSource(
        "solvency",
        solvencyResult,
        solvency?.liabilities.length ?? 0,
        solvency?.generatedAt ?? generatedAt,
      ),
    ];

    return {
      generatedAt,
      balances,
      recentTransactions,
      stakingPositions,
      outstandingLoans,
      retirementVaults,
      solvency,
      sources,
    };
  }

  private buildSource<T>(
    id: WealthBriefSourceId,
    result: SettledSource<T>,
    recordCount: number,
    asOf: string,
  ): WealthBriefSource {
    return {
      id,
      label: SOURCE_LABELS[id],
      status: result.status === "fulfilled" ? "available" : "unavailable",
      asOf,
      recordCount,
      note:
        result.status === "fulfilled"
          ? null
          : "This source was unavailable when the brief was generated.",
    };
  }
}
