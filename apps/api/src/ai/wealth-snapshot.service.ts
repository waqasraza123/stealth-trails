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

type SettledSource = PromiseSettledResult<unknown>;
type SourceStatus = WealthBriefSource["status"];
type Liability = NonNullable<WealthSnapshot["solvency"]>["liabilities"][number];

type ParsedRecord<T> = {
  value: T;
  timestamp: string;
  partial?: boolean;
};

type NormalizedSource<T> = {
  records: T[];
  status: SourceStatus;
  asOf: string | null;
  note: string | null;
};

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

const PARTIAL_NOTE =
  "Some records or fields from this source could not be included safely.";
const UNAVAILABLE_NOTE =
  "This source was unavailable when the brief was generated.";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function isNullableTimestamp(value: unknown): value is string | null {
  return value === null || isTimestamp(value);
}

function isTimestamp(value: unknown): value is string {
  return isString(value) && Number.isFinite(Date.parse(value));
}

function isDecimal(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/u.test(value.trim())
  );
}

function isPositiveDecimal(value: string): boolean {
  return (
    !/^[-+]?0*(?:\.0*)?$/u.test(value.trim()) && !value.trim().startsWith("-")
  );
}

// A collection-level timestamp must be true for every included record. The
// oldest record timestamp is the conservative freshness floor; using the
// newest would make mixed-age collections look uniformly fresh.
function collectionAsOf(timestamps: string[]): string | null {
  if (timestamps.length === 0) {
    return null;
  }
  return timestamps.reduce((oldest, current) =>
    Date.parse(current) < Date.parse(oldest) ? current : oldest,
  );
}

function unavailableSource<T>(): NormalizedSource<T> {
  return {
    records: [],
    status: "unavailable",
    asOf: null,
    note: UNAVAILABLE_NOTE,
  };
}

function normalizeArraySource<T>(
  result: SettledSource,
  arrayPath: (value: Record<string, unknown>) => unknown,
  parseRecord: (value: unknown) => ParsedRecord<T> | null,
  limit?: number,
): NormalizedSource<T> {
  if (result.status === "rejected" || !isRecord(result.value)) {
    return unavailableSource();
  }

  const candidate = arrayPath(result.value);
  if (!Array.isArray(candidate)) {
    return {
      records: [],
      status: "partial",
      asOf: null,
      note: PARTIAL_NOTE,
    };
  }

  const parsed = candidate.map(parseRecord);
  const valid = parsed.filter((item): item is ParsedRecord<T> => item !== null);
  const partial =
    valid.length !== candidate.length ||
    valid.some((item) => item.partial === true);
  const included = limit === undefined ? valid : valid.slice(0, limit);
  const records = included.map((item) => item.value);

  return {
    records,
    status: partial
      ? "partial"
      : records.length === 0
        ? "available_empty"
        : "available",
    // A partial response cannot establish freshness for the whole collection.
    asOf: partial
      ? null
      : collectionAsOf(included.map((item) => item.timestamp)),
    note: partial ? PARTIAL_NOTE : null,
  };
}

function sourceDescriptor<T>(
  id: WealthBriefSourceId,
  source: NormalizedSource<T>,
): WealthBriefSource {
  return {
    id,
    label: SOURCE_LABELS[id],
    status: source.status,
    asOf: source.asOf,
    recordCount: source.records.length,
    note: source.note,
  };
}

function parseBalance(
  value: unknown,
): ParsedRecord<WealthSnapshot["balances"][number]> | null {
  if (!isRecord(value) || !isRecord(value.asset)) {
    return null;
  }
  if (
    !isString(value.asset.symbol) ||
    !isString(value.asset.displayName) ||
    typeof value.asset.chainId !== "number" ||
    !Number.isInteger(value.asset.chainId) ||
    !isDecimal(value.availableBalance) ||
    !isDecimal(value.pendingBalance) ||
    !isTimestamp(value.updatedAt)
  ) {
    return null;
  }
  return {
    timestamp: value.updatedAt,
    value: {
      assetSymbol: value.asset.symbol,
      assetName: value.asset.displayName,
      chainId: value.asset.chainId,
      availableBalance: value.availableBalance,
      pendingBalance: value.pendingBalance,
      updatedAt: value.updatedAt,
    },
  };
}

function parseTransaction(
  value: unknown,
): ParsedRecord<WealthSnapshot["recentTransactions"][number]> | null {
  if (!isRecord(value) || !isRecord(value.asset)) {
    return null;
  }
  if (
    !isString(value.intentType) ||
    !isString(value.status) ||
    !isString(value.asset.symbol) ||
    !isDecimal(value.requestedAmount) ||
    !(value.settledAmount === null || isDecimal(value.settledAmount)) ||
    !isTimestamp(value.createdAt) ||
    !isTimestamp(value.updatedAt)
  ) {
    return null;
  }
  return {
    timestamp: value.updatedAt,
    value: {
      type: value.intentType,
      status: value.status,
      assetSymbol: value.asset.symbol,
      requestedAmount: value.requestedAmount,
      settledAmount: value.settledAmount,
      createdAt: value.createdAt,
      updatedAt: value.updatedAt,
    },
  };
}

function parseStakingPosition(
  value: unknown,
): ParsedRecord<WealthSnapshot["stakingPositions"][number]> | null {
  if (
    !isRecord(value) ||
    !isRecord(value.position) ||
    !isString(value.poolStatus) ||
    !isTimestamp(value.updatedAt) ||
    typeof value.position.canReadPosition !== "boolean"
  ) {
    return null;
  }

  if (!value.position.canReadPosition) {
    return {
      timestamp: value.updatedAt,
      partial: true,
      value: {
        poolStatus: value.poolStatus,
        stakedBalance: null,
        pendingReward: null,
        canReadPosition: false,
        updatedAt: value.updatedAt,
      },
    };
  }

  if (
    !isDecimal(value.position.stakedBalance) ||
    !isDecimal(value.position.pendingReward)
  ) {
    return null;
  }
  return {
    timestamp: value.updatedAt,
    value: {
      poolStatus: value.poolStatus,
      stakedBalance: value.position.stakedBalance,
      pendingReward: value.position.pendingReward,
      canReadPosition: true,
      updatedAt: value.updatedAt,
    },
  };
}

function parseLoan(
  value: unknown,
): ParsedRecord<WealthSnapshot["outstandingLoans"][number]> | null {
  if (
    !isRecord(value) ||
    !isRecord(value.borrowAsset) ||
    !isRecord(value.collateralAsset) ||
    !Array.isArray(value.collateralPositions)
  ) {
    return null;
  }
  if (
    !isString(value.status) ||
    !isString(value.borrowAsset.symbol) ||
    !isString(value.collateralAsset.symbol) ||
    !isDecimal(value.outstandingPrincipalAmount) ||
    !isDecimal(value.outstandingServiceFeeAmount) ||
    !isDecimal(value.outstandingTotalAmount) ||
    !isDecimal(value.collateralAmount) ||
    typeof value.autopayEnabled !== "boolean" ||
    !isNullableTimestamp(value.nextDueAt) ||
    !isNullableTimestamp(value.gracePeriodEndsAt) ||
    !isTimestamp(value.updatedAt)
  ) {
    return null;
  }
  const ltvPosition = value.collateralPositions.find(
    (position) =>
      isRecord(position) &&
      (position.latestLtvBps === null ||
        typeof position.latestLtvBps === "number"),
  );
  const latestLtvBps =
    isRecord(ltvPosition) && typeof ltvPosition.latestLtvBps === "number"
      ? ltvPosition.latestLtvBps
      : null;
  const collateralPartial = value.collateralPositions.some(
    (position) =>
      !isRecord(position) ||
      !(
        position.latestLtvBps === null ||
        (typeof position.latestLtvBps === "number" &&
          Number.isFinite(position.latestLtvBps))
      ),
  );

  return {
    timestamp: value.updatedAt,
    partial: collateralPartial,
    value: {
      status: value.status,
      borrowAssetSymbol: value.borrowAsset.symbol,
      collateralAssetSymbol: value.collateralAsset.symbol,
      outstandingPrincipalAmount: value.outstandingPrincipalAmount,
      outstandingServiceFeeAmount: value.outstandingServiceFeeAmount,
      outstandingTotalAmount: value.outstandingTotalAmount,
      collateralAmount: value.collateralAmount,
      latestLtvBps,
      autopayEnabled: value.autopayEnabled,
      nextDueAt: value.nextDueAt,
      gracePeriodEndsAt: value.gracePeriodEndsAt,
      updatedAt: value.updatedAt,
    },
  };
}

function parseVault(
  value: unknown,
): ParsedRecord<WealthSnapshot["retirementVaults"][number]> | null {
  if (!isRecord(value) || !isRecord(value.asset)) {
    return null;
  }
  if (
    !isString(value.status) ||
    !isString(value.asset.symbol) ||
    !isDecimal(value.lockedBalance) ||
    typeof value.strictMode !== "boolean" ||
    !isTimestamp(value.unlockAt) ||
    !isTimestamp(value.updatedAt)
  ) {
    return null;
  }
  return {
    timestamp: value.updatedAt,
    value: {
      status: value.status,
      assetSymbol: value.asset.symbol,
      lockedBalance: value.lockedBalance,
      strictMode: value.strictMode,
      unlockAt: value.unlockAt,
      updatedAt: value.updatedAt,
    },
  };
}

function normalizeSolvency(
  result: SettledSource,
): NormalizedSource<Liability> & { solvency: WealthSnapshot["solvency"] } {
  if (result.status === "rejected" || !isRecord(result.value)) {
    return { ...unavailableSource<Liability>(), solvency: null };
  }
  const { snapshot, report, proofs } = result.value;
  if (
    !isRecord(snapshot) ||
    !isRecord(report) ||
    !isString(snapshot.status) ||
    !isString(snapshot.evidenceFreshness) ||
    !isTimestamp(snapshot.generatedAt) ||
    !isTimestamp(report.publishedAt) ||
    typeof snapshot.policyActionsTriggered !== "boolean"
  ) {
    return { ...unavailableSource<Liability>(), solvency: null };
  }

  let partial = !Array.isArray(proofs);
  const candidates = Array.isArray(proofs) ? proofs : [];
  const liabilities: Liability[] = [];
  for (const proof of candidates) {
    if (
      !isRecord(proof) ||
      !isRecord(proof.asset) ||
      !isRecord(proof.payload) ||
      !isString(proof.asset.symbol) ||
      !isDecimal(proof.payload.totalLiabilityAmount)
    ) {
      partial = true;
      continue;
    }
    liabilities.push({
      assetSymbol: proof.asset.symbol,
      totalLiabilityAmount: proof.payload.totalLiabilityAmount,
    });
  }
  const limited = liabilities.slice(0, SNAPSHOT_LIMITS.solvencyLiabilities);
  return {
    records: limited,
    status: partial
      ? "partial"
      : limited.length === 0
        ? "available_empty"
        : "available",
    asOf: partial ? null : snapshot.generatedAt,
    note: partial ? PARTIAL_NOTE : null,
    solvency: {
      status: snapshot.status,
      evidenceFreshness: snapshot.evidenceFreshness,
      generatedAt: snapshot.generatedAt,
      publishedAt: report.publishedAt,
      policyActionsTriggered: snapshot.policyActionsTriggered,
      liabilities: limited,
    },
  };
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
    const results = await Promise.allSettled([
      this.customerBalancesService.listMyBalances(supabaseUserId),
      this.transactionIntentsService.listMyTransactionIntents(supabaseUserId, {
        limit: SNAPSHOT_LIMITS.transactions,
      }),
      this.stakingService.getMySnapshot(supabaseUserId),
      this.loansService.getCustomerDashboard(supabaseUserId),
      this.retirementVaultService.listMyRetirementVaults(supabaseUserId),
      this.solvencyService.getCustomerLiabilityInclusionProof(supabaseUserId),
    ]);

    const balances = normalizeArraySource(
      results[0],
      (value) => value.balances,
      parseBalance,
      SNAPSHOT_LIMITS.balances,
    );

    const transactions = normalizeArraySource(
      results[1],
      (value) => value.intents,
      parseTransaction,
      SNAPSHOT_LIMITS.transactions,
    );

    const stakingResult = results[2];
    const staking =
      stakingResult.status === "fulfilled" &&
      isRecord(stakingResult.value) &&
      stakingResult.value.status !== "success"
        ? unavailableSource<WealthSnapshot["stakingPositions"][number]>()
        : normalizeArraySource(
            stakingResult,
            (value) => (isRecord(value.data) ? value.data.pools : undefined),
            parseStakingPosition,
            SNAPSHOT_LIMITS.stakingPositions,
          );

    const allLoans = normalizeArraySource(
      results[3],
      (value) => value.agreements,
      parseLoan,
    );
    const outstandingLoans = allLoans.records
      .filter(
        (agreement) =>
          agreement.status !== "closed" &&
          isPositiveDecimal(agreement.outstandingTotalAmount),
      )
      .slice(0, SNAPSHOT_LIMITS.outstandingLoans);
    const loans: NormalizedSource<WealthSnapshot["outstandingLoans"][number]> =
      {
        ...allLoans,
        records: outstandingLoans,
        status:
          allLoans.status === "available" && outstandingLoans.length === 0
            ? "available_empty"
            : allLoans.status,
        asOf:
          allLoans.status === "partial"
            ? null
            : collectionAsOf(outstandingLoans.map((loan) => loan.updatedAt)),
      };

    const vaults = normalizeArraySource(
      results[4],
      (value) => value.vaults,
      parseVault,
      SNAPSHOT_LIMITS.retirementVaults,
    );

    const solvency = normalizeSolvency(results[5]);

    return {
      generatedAt,
      balances: balances.records,
      recentTransactions: transactions.records,
      stakingPositions: staking.records,
      outstandingLoans: loans.records,
      retirementVaults: vaults.records,
      solvency: solvency.solvency,
      sources: [
        sourceDescriptor("balances", balances),
        sourceDescriptor("transactions", transactions),
        sourceDescriptor("staking", staking),
        sourceDescriptor("loans", loans),
        sourceDescriptor("retirement_vaults", vaults),
        sourceDescriptor("solvency", solvency),
      ],
    };
  }
}
