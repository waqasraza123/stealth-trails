import { CustomerBalancesService } from "../customer-balances/customer-balances.service";
import { LoansService } from "../loans/loans.service";
import { RetirementVaultService } from "../retirement-vault/retirement-vault.service";
import { SolvencyService } from "../solvency/solvency.service";
import { StakingService } from "../staking/staking.service";
import { TransactionIntentsService } from "../transaction-intents/transaction-intents.service";
import { WealthSnapshotService } from "./wealth-snapshot.service";

function createService() {
  const balances = { listMyBalances: jest.fn() };
  const transactions = { listMyTransactionIntents: jest.fn() };
  const staking = { getMySnapshot: jest.fn() };
  const loans = { getCustomerDashboard: jest.fn() };
  const vaults = { listMyRetirementVaults: jest.fn() };
  const solvency = { getCustomerLiabilityInclusionProof: jest.fn() };

  return {
    balances,
    transactions,
    staking,
    loans,
    vaults,
    solvency,
    service: new WealthSnapshotService(
      balances as unknown as CustomerBalancesService,
      transactions as unknown as TransactionIntentsService,
      staking as unknown as StakingService,
      loans as unknown as LoansService,
      vaults as unknown as RetirementVaultService,
      solvency as unknown as SolvencyService,
    ),
  };
}

function arrangeCompleteSources(context: ReturnType<typeof createService>) {
  context.balances.listMyBalances.mockResolvedValue({
    customerAccountId: "account-secret",
    balances: [
      {
        asset: {
          id: "asset-secret",
          symbol: "ETH",
          displayName: "Ether",
          decimals: 18,
          chainId: 8453,
        },
        availableBalance: "2.5",
        pendingBalance: "0.1",
        updatedAt: "2026-10-15T08:00:00.000Z",
      },
    ],
  });
  context.transactions.listMyTransactionIntents.mockResolvedValue({
    limit: 12,
    intents: [
      {
        id: "intent-secret",
        intentType: "deposit",
        status: "settled",
        asset: { symbol: "ETH" },
        requestedAmount: "1",
        settledAmount: "1",
        createdAt: "2026-10-14T08:00:00.000Z",
        updatedAt: "2026-10-14T08:05:00.000Z",
        externalAddress: "0x-do-not-include",
        idempotencyKey: "do-not-include",
      },
    ],
  });
  context.staking.getMySnapshot.mockResolvedValue({
    status: "success",
    message: "ok",
    data: {
      walletAddress: "0x-do-not-include",
      pools: [
        {
          poolStatus: "active",
          updatedAt: "2026-10-13T08:00:00.000Z",
          position: {
            stakedBalance: "0.5",
            pendingReward: "0.02",
            canReadPosition: true,
          },
        },
      ],
    },
  });
  context.loans.getCustomerDashboard.mockResolvedValue({
    account: {
      email: "do-not-include@example.com",
      walletAddress: "0x-do-not-include",
    },
    agreements: [
      {
        status: "active",
        borrowAsset: { symbol: "USDC" },
        collateralAsset: { symbol: "ETH" },
        outstandingPrincipalAmount: "100",
        outstandingServiceFeeAmount: "5",
        outstandingTotalAmount: "105",
        collateralAmount: "0.2",
        autopayEnabled: true,
        nextDueAt: "2026-11-01T00:00:00.000Z",
        gracePeriodEndsAt: null,
        collateralPositions: [{ latestLtvBps: 4500 }],
      },
      {
        status: "closed",
        borrowAsset: { symbol: "USDC" },
        collateralAsset: { symbol: "ETH" },
        outstandingPrincipalAmount: "0",
        outstandingServiceFeeAmount: "0",
        outstandingTotalAmount: "0",
        collateralAmount: "0",
        autopayEnabled: false,
        nextDueAt: null,
        gracePeriodEndsAt: null,
        collateralPositions: [],
      },
    ],
  });
  context.vaults.listMyRetirementVaults.mockResolvedValue({
    customerAccountId: "account-secret",
    vaults: [
      {
        id: "vault-secret",
        status: "active",
        asset: { symbol: "ETH" },
        lockedBalance: "0.75",
        strictMode: true,
        unlockAt: "2030-01-01T00:00:00.000Z",
        updatedAt: "2026-10-12T08:00:00.000Z",
      },
    ],
  });
  context.solvency.getCustomerLiabilityInclusionProof.mockResolvedValue({
    customerAccountId: "account-secret",
    snapshot: {
      status: "healthy",
      evidenceFreshness: "fresh",
      generatedAt: "2026-10-15T07:00:00.000Z",
      policyActionsTriggered: false,
    },
    report: { publishedAt: "2026-10-15T07:01:00.000Z" },
    proofs: [
      {
        asset: { symbol: "ETH" },
        payload: { totalLiabilityAmount: "3.35" },
      },
    ],
  });
}

describe("WealthSnapshotService", () => {
  it("normalizes a minimized, customer-isolated financial snapshot", async () => {
    const context = createService();
    arrangeCompleteSources(context);

    const snapshot = await context.service.collect("authenticated-customer-a");

    for (const method of [
      context.balances.listMyBalances,
      context.staking.getMySnapshot,
      context.loans.getCustomerDashboard,
      context.vaults.listMyRetirementVaults,
      context.solvency.getCustomerLiabilityInclusionProof,
    ]) {
      expect(method).toHaveBeenCalledWith("authenticated-customer-a");
    }
    expect(context.transactions.listMyTransactionIntents).toHaveBeenCalledWith(
      "authenticated-customer-a",
      { limit: 12 },
    );
    expect(snapshot.balances).toEqual([
      expect.objectContaining({ assetSymbol: "ETH", availableBalance: "2.5" }),
    ]);
    expect(snapshot.outstandingLoans).toHaveLength(1);
    expect(snapshot.solvency?.liabilities).toEqual([
      { assetSymbol: "ETH", totalLiabilityAmount: "3.35" },
    ]);
    const serialized = JSON.stringify(snapshot);
    expect(serialized).not.toContain("account-secret");
    expect(serialized).not.toContain("intent-secret");
    expect(serialized).not.toContain("vault-secret");
    expect(serialized).not.toContain("0x-do-not-include");
    expect(serialized).not.toContain("do-not-include@example.com");
    expect(serialized).not.toContain("idempotencyKey");
  });

  it("marks incomplete sources unavailable without inventing records", async () => {
    const context = createService();
    arrangeCompleteSources(context);
    context.solvency.getCustomerLiabilityInclusionProof.mockRejectedValue(
      new Error("No report"),
    );
    context.staking.getMySnapshot.mockResolvedValue({
      status: "success",
      message: "ok",
      data: undefined,
    });

    const snapshot = await context.service.collect("authenticated-customer-a");

    expect(snapshot.solvency).toBeNull();
    expect(snapshot.stakingPositions).toEqual([]);
    expect(snapshot.sources.find((source) => source.id === "solvency")).toEqual(
      expect.objectContaining({ status: "unavailable", recordCount: 0 }),
    );
  });
});
