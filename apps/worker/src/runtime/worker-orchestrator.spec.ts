import assert from "node:assert/strict";
import test from "node:test";
import { ManagedExecutionIntentError } from "./deposit-broadcaster";
import { WorkerOrchestrator } from "./worker-orchestrator";
import type {
  DepositBroadcastResult,
  ManagedWithdrawalBroadcaster,
  PolicyControlledWithdrawalBroadcaster,
  PreparedManagedWithdrawalTransaction,
  WorkerIntentProjection,
  WorkerLogger
} from "./worker-types";

function createIntent(
  id: string,
  overrides: Partial<WorkerIntentProjection> = {}
): WorkerIntentProjection {
  return {
    id,
    customerAccountId: "account_1",
    asset: {
      id: "asset_1",
      symbol: "ETH",
      displayName: "Ether",
      decimals: 18,
      chainId: 8453,
      assetType: "native",
      contractAddress: null
    },
    destinationWalletAddress: "0x0000000000000000000000000000000000000abc",
    sourceWalletAddress: "0x0000000000000000000000000000000000000def",
    sourceWalletCustodyType: "platform_managed",
    externalAddress: "0x0000000000000000000000000000000000000fed",
    chainId: 8453,
    status: "queued",
    requestedAmount: "1.25",
    latestBlockchainTransaction: null,
    ...overrides
  };
}

function createLogger(): WorkerLogger {
  return {
    info() {},
    warn() {},
    error() {}
  };
}

function createCapturingLogger() {
  const warnings: Array<{ event: string; metadata: Record<string, unknown> }> = [];
  const infos: Array<{ event: string; metadata: Record<string, unknown> }> = [];
  const errors: Array<{ event: string; metadata: Record<string, unknown> }> = [];

  const logger: WorkerLogger = {
    info(event, metadata) {
      infos.push({ event, metadata });
    },
    warn(event, metadata) {
      warnings.push({ event, metadata });
    },
    error(event, metadata) {
      errors.push({ event, metadata });
    }
  };

  return {
    logger,
    warnings,
    infos,
    errors
  };
}

function createInternalApiClient(overrides: Record<string, unknown>) {
  return {
    async listClaimableGovernedExecutionRequests() {
      return { requests: [], limit: 20, generatedAt: new Date().toISOString() };
    },
    async claimGovernedExecutionRequest() {
      return {
        request: {
          id: "execution_request_1"
        },
        claimReused: false
      };
    },
    async dispatchGovernedExecutionRequest() {
      return {
        request: {
          id: "execution_request_1",
          executionPackageHash: "0xpackage"
        },
        dispatchRecorded: true,
        verificationSucceeded: true,
        verificationFailureReason: null
      };
    },
    async listAwaitingFundingLoans() {
      return { agreements: [], limit: 20 };
    },
    async fundLoanAgreement() {},
    async listDueLoanInstallments() {
      return { installments: [], limit: 20 };
    },
    async runLoanAutopay() {
      return { loanAgreementId: "loan_agreement_1", attempted: false };
    },
    async listValuationMonitorLoans() {
      return { agreements: [], limit: 20 };
    },
    async refreshLoanValuation() {},
    async listGracePeriodExpiredLoans() {
      return { agreements: [], limit: 20 };
    },
    async escalateLoanDefault() {},
    async listLoanLiquidationCandidates() {
      return { agreements: [], limit: 20 };
    },
    async listRequestedSolvencyReportAnchors() {
      return { anchors: [], limit: 20 };
    },
    async listSubmittedSolvencyReportAnchors() {
      return { anchors: [], limit: 20 };
    },
    async recordSolvencyReportAnchorSubmitted() {
      return {
        anchor: {},
        stateReused: false
      };
    },
    async recordSolvencyReportAnchorConfirmed() {
      return {
        anchor: {},
        stateReused: false
      };
    },
    async recordSolvencyReportAnchorFailed() {
      return {
        anchor: {},
        stateReused: false
      };
    },
    async sweepRetirementVaultReleaseRequests() {
      return {
        limit: 20,
        readyForReleaseCount: 0,
        releasedCount: 0,
        failedCount: 0,
        blockedReleaseCount: 0,
        staleReviewRequiredCount: 0,
        staleCooldownCount: 0,
        staleReadyForReleaseCount: 0,
        staleExecutingCount: 0,
        processedReleaseRequestIds: []
      };
    },
    async sweepRetirementVaultRuleChangeRequests() {
      return {
        limit: 20,
        readyToApplyCount: 0,
        appliedCount: 0,
        failedCount: 0,
        blockedRuleChangeCount: 0,
        staleReviewRequiredCount: 0,
        staleCooldownCount: 0,
        staleReadyToApplyCount: 0,
        staleApplyingCount: 0,
        processedRuleChangeRequestIds: []
      };
    },
    ...overrides
  };
}

function createManagedWithdrawalBroadcaster(
  overrides: Partial<ManagedWithdrawalBroadcaster> = {}
): ManagedWithdrawalBroadcaster {
  return {
    canManageWallet() {
      return false;
    },
    async prepare(): Promise<PreparedManagedWithdrawalTransaction> {
      throw new Error("withdrawal prepare should not be called");
    },
    async broadcastSignedTransaction(): Promise<DepositBroadcastResult> {
      throw new Error("withdrawal broadcast should not be called");
    },
    ...overrides
  };
}

function createPolicyControlledWithdrawalBroadcaster(
  overrides: Partial<PolicyControlledWithdrawalBroadcaster> = {}
): PolicyControlledWithdrawalBroadcaster {
  return {
    async prepare(): Promise<PreparedManagedWithdrawalTransaction> {
      throw new Error("policy-controlled withdrawal prepare should not be called");
    },
    async broadcastSignedTransaction(): Promise<DepositBroadcastResult> {
      throw new Error("policy-controlled withdrawal broadcast should not be called");
    },
    ...overrides
  };
}

function createRuntime<T extends Record<string, unknown>>(
  overrides: T
): T & {
  solvencySnapshotIntervalMs: number;
  governedExecutionDispatchIntervalMs: number;
  governedExecutorDispatchBaseUrl: null;
  governedExecutorDispatchApiKey: null;
  governedExecutorDispatchTimeoutMs: number;
  managedWithdrawalClaimTimeoutMs: number;
  policyControlledWithdrawalExecutorPrivateKey: null;
  policyControlledWithdrawalPolicySignerPrivateKey: null;
  policyControlledWithdrawalAuthorizationTtlSeconds: number;
  solvencyAnchorContractAddress: null;
  solvencyAnchorSignerPrivateKey: null;
  managedWithdrawalSigners: [];
} {
  return {
    solvencySnapshotIntervalMs: 300000,
    governedExecutionDispatchIntervalMs: 60000,
    governedExecutorDispatchBaseUrl: null,
    governedExecutorDispatchApiKey: null,
    governedExecutorDispatchTimeoutMs: 1000,
    managedWithdrawalClaimTimeoutMs: 60000,
    policyControlledWithdrawalExecutorPrivateKey: null,
    policyControlledWithdrawalPolicySignerPrivateKey: null,
    policyControlledWithdrawalAuthorizationTtlSeconds: 300,
    solvencyAnchorContractAddress: null,
    solvencyAnchorSignerPrivateKey: null,
    managedWithdrawalSigners: [],
    ...overrides
  };
}

function createIdleWorker(
  overrides: Record<string, unknown>,
  dependencies: Partial<
    ConstructorParameters<typeof WorkerOrchestrator>[0]
  > = {},
  executionMode: ConstructorParameters<
    typeof WorkerOrchestrator
  >[0]["runtime"]["executionMode"] = "monitor",
) {
  const empty = async () => ({ intents: [], limit: 20 });
  const internalApiClient = createInternalApiClient({
    listQueuedDepositIntents: empty,
    listQueuedWithdrawalIntents: empty,
    listBroadcastDepositIntents: empty,
    listBroadcastWithdrawalIntents: empty,
    listConfirmedDepositIntentsReadyToSettle: empty,
    listConfirmedWithdrawalIntentsReadyToSettle: empty,
    ...overrides,
  });
  return new WorkerOrchestrator({
    runtime: createRuntime({
      environment: "development",
      workerId: "worker_1",
      internalApiBaseUrl: "http://localhost:9001",
      internalWorkerApiKey: "fixture-key",
      executionMode,
      pollIntervalMs: 10,
      batchLimit: 20,
      requestTimeoutMs: 1000,
      internalApiStartupGracePeriodMs: 45000,
      confirmationBlocks: 3,
      reconciliationScanIntervalMs: 300000,
      platformAlertReEscalationIntervalMs: 300000,
      rpcUrl: null,
      depositSignerPrivateKey: null,
    }),
    internalApiClient: internalApiClient as never,
    rpcClient: null,
    depositBroadcaster: null,
    withdrawalBroadcaster: null,
    policyControlledWithdrawalBroadcaster: null,
    logger: createLogger(),
    ...dependencies,
  });
}

test("scheduled research reports approval state and isolates provider failures", async () => {
  const { logger, infos, errors } = createCapturingLogger();
  const workflow = {
    scheduledRunCount: 1,
    dataChangeRunCount: 2,
    claimedRunCount: 3,
    succeededRunCount: 1,
    awaitingApprovalRunCount: 1,
    retriedRunCount: 1,
    failedRunCount: 0,
    reclaimedRunCount: 1,
  };
  const worker = createIdleWorker(
    {
      async runScheduledWealthGuardianResearch() {
        return { dueCustomerCount: 2, failedCustomerCount: 1 };
      },
      async runDueAiWorkflows(limit: number) {
        assert.equal(limit, 20);
        return workflow;
      },
      async sweepRetirementVaultReleaseRequests() {
        return {
          readyForReleaseCount: 1,
          releasedCount: 1,
          failedCount: 0,
          processedReleaseRequestIds: ["release-1"],
        };
      },
      async sweepRetirementVaultRuleChangeRequests() {
        return {
          readyToApplyCount: 1,
          appliedCount: 1,
          failedCount: 0,
          processedRuleChangeRequestIds: ["rule-1"],
        };
      },
    },
    { logger },
  );
  const metrics = await worker.runOnce();
  assert.equal(metrics.aiWorkflowAwaitingApprovalRunCount, 1);
  assert.equal(metrics.aiWorkflowSucceededRunCount, 1);
  assert.equal(metrics.aiWorkflowRetriedRunCount, 1);
  assert.equal(metrics.retirementVaultReleasedCount, 1);
  assert.equal(metrics.retirementVaultRuleChangeAppliedCount, 1);
  assert.ok(
    infos.some(
      ({ event }) => event === "wealth_guardian_scheduled_research_completed",
    ),
  );
  assert.ok(infos.some(({ event }) => event === "ai_workflow_sweep_completed"));
  assert.equal(errors.length, 0);
  let workflowsAttempted = false;
  const failed = createIdleWorker(
    {
      async runScheduledWealthGuardianResearch() {
        throw new Error("provider unavailable");
      },
      async runDueAiWorkflows() {
        workflowsAttempted = true;
        throw new Error("workflow unavailable");
      },
    },
    { logger },
  );
  const failedMetrics = await failed.runOnce();
  assert.equal(workflowsAttempted, true);
  assert.equal(failedMetrics.aiWorkflowSucceededRunCount, 0);
  assert.deepEqual(
    errors.map(({ event }) => event),
    ["wealth_guardian_scheduled_research_failed", "ai_workflow_sweep_failed"],
  );
});

test("synthetic solvency anchors use fixture submission and confirmation paths", async () => {
  const submitted: Array<{ id: string; txHash: string }> = [];
  const confirmed: string[] = [];
  const worker = createIdleWorker(
    {
      async listRequestedSolvencyReportAnchors() {
        return {
          anchors: [
            { id: "anchor-new", reportId: "report-1", contractAddress: null },
          ],
        };
      },
      async listSubmittedSolvencyReportAnchors() {
        return {
          anchors: [
            {
              id: "anchor-pending",
              reportId: "report-2",
              txHash: "fixture-tx",
              contractAddress: null,
            },
          ],
        };
      },
      async recordSolvencyReportAnchorSubmitted(
        id: string,
        payload: { txHash: string },
      ) {
        submitted.push({ id, txHash: payload.txHash });
      },
      async recordSolvencyReportAnchorConfirmed(id: string) {
        confirmed.push(id);
      },
    },
    {},
    "synthetic",
  );
  const metrics = await worker.runOnce();
  assert.equal(submitted[0].id, "anchor-new");
  assert.match(submitted[0].txHash, /^0x[0-9a-f]{64}$/u);
  assert.deepEqual(confirmed, ["anchor-pending"]);
  assert.equal(metrics.solvencyReportAnchorSubmittedCount, 1);
  assert.equal(metrics.solvencyReportAnchorConfirmedCount, 1);
});

test("solvency monitoring confirms only successful sufficiently confirmed receipts", async () => {
  const { logger, infos, warnings } = createCapturingLogger();
  const confirmed: string[] = [];
  const failed: string[] = [];
  const worker = createIdleWorker(
    {
      async listSubmittedSolvencyReportAnchors() {
        return {
          anchors: ["missing", "pending", "reverted", "early", "confirmed"].map(
            (id) => ({
              id,
              reportId: id,
              txHash: id === "missing" ? null : id,
              contractAddress: null,
            }),
          ),
        };
      },
      async recordSolvencyReportAnchorConfirmed(
        id: string,
        payload: { blockNumber: number },
      ) {
        confirmed.push(id);
        assert.equal(payload.blockNumber, 95);
      },
      async recordSolvencyReportAnchorFailed(
        id: string,
        payload: { failureReason: string },
      ) {
        failed.push(id);
        assert.match(payload.failureReason, /reverted/u);
      },
    },
    {
      logger,
      rpcClient: {
        async getBlockNumber() {
          return 100n;
        },
        async getTransactionReceipt(hash: string) {
          return hash === "pending"
            ? null
            : {
                succeeded: hash !== "reverted",
                blockNumber: hash === "early" ? 100n : 95n,
                fromAddress: null,
                toAddress: null,
              };
        },
      },
    },
  );
  const metrics = await worker.runOnce();
  assert.deepEqual(confirmed, ["confirmed"]);
  assert.deepEqual(failed, ["reverted"]);
  assert.equal(metrics.solvencyReportAnchorConfirmedCount, 1);
  assert.equal(metrics.solvencyReportAnchorFailedCount, 1);
  assert.ok(
    warnings.some(
      ({ event }) =>
        event === "submitted_solvency_report_anchor_missing_tx_hash",
    ),
  );
  assert.ok(
    infos.some(
      ({ event }) => event === "solvency_report_anchor_pending_confirmation",
    ),
  );
  assert.ok(
    infos.some(
      ({ event }) => event === "solvency_report_anchor_waiting_confirmations",
    ),
  );
});

test("solvency submission waits for a configured broadcaster and records failed attempts", async () => {
  const anchor = {
    id: "anchor-1",
    reportId: "report-1",
    chainId: 1,
    contractAddress: "fixture-contract",
    anchorPayloadHash: "fixture-hash",
  };
  const { logger, infos } = createCapturingLogger();
  const waiting = await createIdleWorker(
    {
      async listRequestedSolvencyReportAnchors() {
        return { anchors: [anchor] };
      },
    },
    { logger },
  ).runOnce();
  assert.equal(waiting.solvencyReportAnchorSubmittedCount, 0);
  assert.ok(
    infos.some(
      ({ event }) => event === "solvency_report_anchor_waiting_for_broadcast",
    ),
  );
  for (const error of [new Error("provider unavailable"), "unknown failure"]) {
    const failures: string[] = [];
    const result = await createIdleWorker(
      {
        async listRequestedSolvencyReportAnchors() {
          return { anchors: [anchor] };
        },
        async recordSolvencyReportAnchorFailed(
          _id: string,
          payload: { failureReason: string },
        ) {
          failures.push(payload.failureReason);
        },
      },
      {
        solvencyReportAnchorBroadcaster: {
          signerAddress: "fixture-signer",
          contractAddress: "fixture-contract",
          async broadcast() {
            throw error;
          },
        },
      },
    ).runOnce();
    assert.equal(result.solvencyReportAnchorFailedCount, 1);
    assert.deepEqual(failures, [
      error instanceof Error
        ? error.message
        : "Solvency report anchor broadcast failed.",
    ]);
  }
  const submitted: string[] = [];
  const success = await createIdleWorker(
    {
      async listRequestedSolvencyReportAnchors() {
        return { anchors: [anchor] };
      },
      async recordSolvencyReportAnchorSubmitted(id: string) {
        submitted.push(id);
      },
    },
    {
      solvencyReportAnchorBroadcaster: {
        signerAddress: "fixture-signer",
        contractAddress: "fixture-contract",
        async broadcast() {
          return {
            txHash: "fixture-tx",
            fromAddress: "fixture-signer",
            toAddress: "fixture-contract",
          };
        },
      },
    },
  ).runOnce();
  assert.equal(success.solvencyReportAnchorSubmittedCount, 1);
  assert.deepEqual(submitted, ["anchor-1"]);
  await assert.rejects(
    createIdleWorker({
      async listSubmittedSolvencyReportAnchors() {
        return { anchors: [{ id: "anchor-1", txHash: "fixture-tx" }] };
      },
    }).runOnce(),
    /RPC client is required for solvency anchor monitoring/u,
  );
});

test("loan monitoring deduplicates autopay and records valuation and default work", async () => {
  const attempts: string[] = [];
  const valuations: string[] = [];
  const defaults: string[] = [];
  const worker = createIdleWorker({
    async listDueLoanInstallments() {
      return {
        installments: ["paid", "paid", "failed", "not-due"].map(
          (loanAgreementId) => ({ loanAgreementId }),
        ),
      };
    },
    async runLoanAutopay(id: string) {
      attempts.push(id);
      return { attempted: id !== "not-due", succeeded: id === "paid" };
    },
    async listValuationMonitorLoans() {
      return { agreements: [{ loanAgreementId: "loan-1" }] };
    },
    async refreshLoanValuation(id: string) {
      valuations.push(id);
    },
    async listGracePeriodExpiredLoans() {
      return { agreements: [{ loanAgreementId: "loan-2" }] };
    },
    async escalateLoanDefault(id: string) {
      defaults.push(id);
    },
    async listLoanLiquidationCandidates() {
      return { agreements: [{ loanAgreementId: "loan-2" }] };
    },
  });
  const metrics = await worker.runOnce();
  assert.deepEqual(attempts, ["paid", "failed", "not-due"]);
  assert.deepEqual(valuations, ["loan-1"]);
  assert.deepEqual(defaults, ["loan-2"]);
  assert.equal(metrics.autopayLoanSweepCount, 2);
  assert.equal(metrics.autopayLoanSuccessCount, 1);
  assert.equal(metrics.autopayLoanFailureCount, 1);
  assert.equal(metrics.valuationRefreshCount, 1);
  assert.equal(metrics.defaultEscalatedLoanCount, 1);
});

test("worker claims and dispatches governed execution requests before downstream funding", async () => {
  const operations: string[] = [];
  const client = createInternalApiClient({
    async listQueuedDepositIntents() {
      return { intents: [], limit: 20 };
    },
    async listQueuedWithdrawalIntents() {
      return { intents: [], limit: 20 };
    },
    async listBroadcastDepositIntents() {
      return { intents: [], limit: 20 };
    },
    async listBroadcastWithdrawalIntents() {
      return { intents: [], limit: 20 };
    },
    async listConfirmedDepositIntentsReadyToSettle() {
      return { intents: [], limit: 20 };
    },
    async listConfirmedWithdrawalIntentsReadyToSettle() {
      return { intents: [], limit: 20 };
    },
    async listClaimableGovernedExecutionRequests() {
      return {
        requests: [
          {
            id: "execution_request_1",
            executionType: "loan_contract_creation",
            targetType: "LoanAgreement",
            targetId: "loan_1",
            executionPackageHash: "0xpackage",
            dispatchStatus: "not_dispatched"
          }
        ],
        limit: 20,
        generatedAt: new Date().toISOString()
      };
    },
    async claimGovernedExecutionRequest(requestId: string) {
      operations.push(`claim:${requestId}`);
      return {
        request: {
          id: requestId,
          executionPackageHash: "0xpackage"
        },
        claimReused: false
      };
    },
    async dispatchGovernedExecutionRequest(requestId: string) {
      operations.push(`dispatch:${requestId}`);
      return {
        request: {
          id: requestId,
          executionPackageHash: "0xpackage"
        },
        dispatchRecorded: true,
        verificationSucceeded: true,
        verificationFailureReason: null
      };
    }
  });

  const orchestrator = new WorkerOrchestrator({
    runtime: createRuntime({
      environment: "production",
      workerId: "worker_1",
      internalApiBaseUrl: "https://internal.example.com",
      internalWorkerApiKey: "worker-key",
      batchLimit: 20,
      executionMode: "monitor",
      pollIntervalMs: 10,
      requestTimeoutMs: 1000,
      internalApiStartupGracePeriodMs: 45000,
      confirmationBlocks: 1,
      reconciliationScanIntervalMs: 300000,
      platformAlertReEscalationIntervalMs: 300000,
      rpcUrl: null,
      depositSignerPrivateKey: null
    }),
    internalApiClient: client as never,
    rpcClient: null,
    depositBroadcaster: null,
    withdrawalBroadcaster: null,
    policyControlledWithdrawalBroadcaster: null,
    logger: createLogger()
  });

  const metrics = await orchestrator.runOnce();

  assert.equal(metrics.claimableGovernedExecutionRequestCount, 1);
  assert.equal(metrics.claimedGovernedExecutionRequestCount, 1);
  assert.equal(metrics.dispatchedGovernedExecutionRequestCount, 1);
  assert.deepEqual(operations, [
    "claim:execution_request_1",
    "dispatch:execution_request_1"
  ]);
});

test("worker delivers dispatched governed execution packages to the configured executor backend", async () => {
  const operations: string[] = [];
  const client = createInternalApiClient({
    async listQueuedDepositIntents() {
      return { intents: [], limit: 20 };
    },
    async listQueuedWithdrawalIntents() {
      return { intents: [], limit: 20 };
    },
    async listBroadcastDepositIntents() {
      return { intents: [], limit: 20 };
    },
    async listBroadcastWithdrawalIntents() {
      return { intents: [], limit: 20 };
    },
    async listConfirmedDepositIntentsReadyToSettle() {
      return { intents: [], limit: 20 };
    },
    async listConfirmedWithdrawalIntentsReadyToSettle() {
      return { intents: [], limit: 20 };
    },
    async listClaimableGovernedExecutionRequests() {
      return {
        requests: [
          {
            id: "execution_request_1",
            executionType: "loan_contract_creation",
            targetType: "LoanAgreement",
            targetId: "loan_1",
            executionPackageHash: "0xpackage",
            dispatchStatus: "not_dispatched"
          }
        ],
        limit: 20,
        generatedAt: new Date().toISOString()
      };
    },
    async claimGovernedExecutionRequest(requestId: string) {
      operations.push(`claim:${requestId}`);
      return {
        request: {
          id: requestId,
          executionPackageHash: "0xpackage"
        },
        claimReused: false
      };
    },
    async dispatchGovernedExecutionRequest(requestId: string) {
      operations.push(`dispatch:${requestId}`);
      return {
        request: {
          id: requestId,
          environment: "production",
          chainId: 8453,
          executionType: "loan_contract_creation",
          status: "pending_execution",
          targetType: "LoanAgreement",
          targetId: "loan_1",
          loanAgreementId: "loan_1",
          stakingPoolGovernanceRequestId: null,
          contractAddress: "0x0000000000000000000000000000000000000def",
          contractMethod: "createLoan",
          walletAddress: "0x0000000000000000000000000000000000000abc",
          requestNote: null,
          requestedByActorType: "operator",
          requestedByActorId: "op_1",
          requestedByActorRole: "risk_manager",
          requestedAt: new Date().toISOString(),
          executedByActorType: null,
          executedByActorId: null,
          executedByActorRole: null,
          executedAt: null,
          blockchainTransactionHash: null,
          externalExecutionReference: null,
          failureReason: null,
          failedAt: null,
          metadata: null,
          executionPayload: { principalAmount: "1000" },
          executionResult: null,
          canonicalExecutionPayload: { principalAmount: "1000" },
          canonicalExecutionPayloadText: "{\"principalAmount\":\"1000\"}",
          executionPackageHash: "0xpackage",
          executionPackageChecksumSha256: "checksum",
          executionPackageSignature: "0xsig",
          executionPackageSignatureAlgorithm:
            "ethereum-secp256k1-keccak256-v1",
          executionPackageSignerAddress:
            "0x0000000000000000000000000000000000000aaa",
          executionPackagePublishedAt: new Date().toISOString(),
          claimedByWorkerId: null,
          claimedAt: null,
          claimExpiresAt: null,
          dispatchStatus: "dispatched",
          dispatchPreparedAt: new Date().toISOString(),
          dispatchedByWorkerId: "worker_1",
          dispatchReference: "worker:worker_1:execution_request_1",
          dispatchVerificationChecksumSha256: "checksum",
          dispatchFailureReason: null,
          deliveryStatus: "not_delivered",
          deliveryAttemptedAt: null,
          deliveryAcceptedAt: null,
          deliveredByWorkerId: null,
          deliveryBackendType: null,
          deliveryBackendReference: null,
          deliveryHttpStatus: null,
          deliveryFailureReason: null,
          expectedExecutionCalldataHash: "0xcalldatahash",
          expectedExecutionMethodSelector: "0x12345678",
          updatedAt: new Date().toISOString()
        },
        dispatchRecorded: true,
        verificationSucceeded: true,
        verificationFailureReason: null
      };
    },
    async recordGovernedExecutionDeliveryAccepted(requestId: string) {
      operations.push(`deliveryAccepted:${requestId}`);
      return {
        request: {
          id: requestId
        },
        deliveryRecorded: true,
        stateReused: false
      };
    }
  });

  const dispatchClient = {
    async deliverExecutionRequest() {
      operations.push("deliver:execution_request_1");
      return {
        backendReference: "executor-job-1",
        httpStatus: 202
      };
    }
  };

  const orchestrator = new WorkerOrchestrator({
    runtime: createRuntime({
      environment: "production",
      workerId: "worker_1",
      internalApiBaseUrl: "https://internal.example.com",
      internalWorkerApiKey: "worker-key",
      batchLimit: 20,
      executionMode: "monitor",
      pollIntervalMs: 10,
      requestTimeoutMs: 1000,
      internalApiStartupGracePeriodMs: 45000,
      confirmationBlocks: 1,
      reconciliationScanIntervalMs: 300000,
      platformAlertReEscalationIntervalMs: 300000,
      rpcUrl: null,
      depositSignerPrivateKey: null,
      governedExecutorDispatchBaseUrl: "https://executor.example.com",
      governedExecutorDispatchApiKey: "dispatch-key"
    }),
    internalApiClient: client as never,
    governedExecutorDispatchClient: dispatchClient as never,
    rpcClient: null,
    depositBroadcaster: null,
    withdrawalBroadcaster: null,
    policyControlledWithdrawalBroadcaster: null,
    logger: createLogger()
  });

  const metrics = await orchestrator.runOnce();

  assert.equal(metrics.dispatchedGovernedExecutionRequestCount, 1);
  assert.equal(metrics.governedExecutionDeliveryAcceptedCount, 1);
  assert.deepEqual(operations, [
    "claim:execution_request_1",
    "dispatch:execution_request_1",
    "deliver:execution_request_1",
    "deliveryAccepted:execution_request_1"
  ]);
});

test("synthetic mode records broadcasts and settles them", async () => {
  const queuedDepositIntent = createIntent("deposit_1");
  const queuedWithdrawalIntent = createIntent("withdrawal_1");
  const operations: string[] = [];

  const client = createInternalApiClient({
    async listQueuedDepositIntents() {
      return { intents: [queuedDepositIntent], limit: 20 };
    },
    async listQueuedWithdrawalIntents() {
      return { intents: [queuedWithdrawalIntent], limit: 20 };
    },
    async listBroadcastDepositIntents() {
      return {
        intents: [
          createIntent("deposit_1", {
            status: "broadcast",
            latestBlockchainTransaction: {
              id: "btx_1",
              txHash:
                "0x1111111111111111111111111111111111111111111111111111111111111111",
              nonce: null,
              serializedTransaction: null,
              status: "broadcast",
              fromAddress: "0x000000000000000000000000000000000000dEaD",
              toAddress: "0x0000000000000000000000000000000000000abc",
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              confirmedAt: null
            }
          })
        ],
        limit: 20
      };
    },
    async listBroadcastWithdrawalIntents() {
      return {
        intents: [
          createIntent("withdrawal_1", {
            status: "broadcast",
            latestBlockchainTransaction: {
              id: "btx_2",
              txHash:
                "0x2222222222222222222222222222222222222222222222222222222222222222",
              nonce: null,
              serializedTransaction: null,
              status: "broadcast",
              fromAddress: "0x0000000000000000000000000000000000000def",
              toAddress: "0x0000000000000000000000000000000000000fed",
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              confirmedAt: null
            }
          })
        ],
        limit: 20
      };
    },
    async listConfirmedDepositIntentsReadyToSettle() {
      return { intents: [], limit: 20 };
    },
    async listConfirmedWithdrawalIntentsReadyToSettle() {
      return { intents: [], limit: 20 };
    },
    async recordDepositBroadcast(intentId: string) {
      operations.push(`recordDepositBroadcast:${intentId}`);
    },
    async confirmDepositIntent(intentId: string) {
      operations.push(`confirmDepositIntent:${intentId}`);
    },
    async settleDepositIntent(intentId: string) {
      operations.push(`settleDepositIntent:${intentId}`);
    },
    async failDepositIntent() {
      throw new Error("should not fail deposit intent in synthetic mode");
    },
    async recordWithdrawalBroadcast(intentId: string) {
      operations.push(`recordWithdrawalBroadcast:${intentId}`);
    },
    async confirmWithdrawalIntent(intentId: string) {
      operations.push(`confirmWithdrawalIntent:${intentId}`);
    },
    async settleWithdrawalIntent(intentId: string) {
      operations.push(`settleWithdrawalIntent:${intentId}`);
    },
    async failWithdrawalIntent() {
      throw new Error("should not fail withdrawal intent in synthetic mode");
    },
    async reportWorkerHeartbeat() {
      throw new Error("worker heartbeat reporting is handled outside the orchestrator");
    },
    async triggerLedgerReconciliationScan() {
      throw new Error("reconciliation scan scheduling is handled outside the orchestrator");
    },
    async triggerCriticalAlertReEscalationSweep() {
      throw new Error("platform alert re-escalation is handled outside the orchestrator");
    }
  });

  const orchestrator = new WorkerOrchestrator({
    runtime: createRuntime({
      environment: "development",
      workerId: "worker_1",
      internalApiBaseUrl: "http://localhost:9001",
      internalWorkerApiKey: "secret",
      executionMode: "synthetic",
      pollIntervalMs: 10,
      batchLimit: 20,
      requestTimeoutMs: 1000,
      internalApiStartupGracePeriodMs: 45000,
      confirmationBlocks: 1,
      reconciliationScanIntervalMs: 300000,
      platformAlertReEscalationIntervalMs: 300000,
      rpcUrl: null,
      depositSignerPrivateKey: null
    }),
    internalApiClient: client as never,
    rpcClient: null,
    depositBroadcaster: {
      signerAddress: "0x0000000000000000000000000000000000000aaa",
      async broadcast() {
        throw new Error("deposit broadcaster should not be called");
      }
    },
    withdrawalBroadcaster: null,
    policyControlledWithdrawalBroadcaster: null,
    logger: createLogger()
  });

  await orchestrator.runOnce();

  assert.deepEqual(operations, [
    "recordDepositBroadcast:deposit_1",
    "recordWithdrawalBroadcast:withdrawal_1",
    "confirmDepositIntent:deposit_1",
    "settleDepositIntent:deposit_1",
    "confirmWithdrawalIntent:withdrawal_1",
    "settleWithdrawalIntent:withdrawal_1"
  ]);
});

test("monitor mode confirms and settles broadcast intents with enough confirmations", async () => {
  const operations: string[] = [];

  const client = createInternalApiClient({
    async listQueuedDepositIntents() {
      return { intents: [], limit: 20 };
    },
    async listQueuedWithdrawalIntents() {
      return { intents: [], limit: 20 };
    },
    async listBroadcastDepositIntents() {
      return {
        intents: [
          createIntent("deposit_1", {
            status: "broadcast",
            latestBlockchainTransaction: {
              id: "btx_1",
              txHash:
                "0x3333333333333333333333333333333333333333333333333333333333333333",
              nonce: null,
              serializedTransaction: null,
              status: "broadcast",
              fromAddress: "0x000000000000000000000000000000000000dEaD",
              toAddress: "0x0000000000000000000000000000000000000abc",
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              confirmedAt: null
            }
          })
        ],
        limit: 20
      };
    },
    async listBroadcastWithdrawalIntents() {
      return { intents: [], limit: 20 };
    },
    async listConfirmedDepositIntentsReadyToSettle() {
      return { intents: [], limit: 20 };
    },
    async listConfirmedWithdrawalIntentsReadyToSettle() {
      return { intents: [], limit: 20 };
    },
    async recordDepositBroadcast() {
      throw new Error("should not broadcast in monitor mode");
    },
    async confirmDepositIntent(intentId: string) {
      operations.push(`confirmDepositIntent:${intentId}`);
    },
    async settleDepositIntent(intentId: string) {
      operations.push(`settleDepositIntent:${intentId}`);
    },
    async failDepositIntent() {
      throw new Error("should not fail a successful monitored intent");
    },
    async recordWithdrawalBroadcast() {
      throw new Error("should not broadcast in monitor mode");
    },
    async confirmWithdrawalIntent() {
      throw new Error("no withdrawal intents expected");
    },
    async settleWithdrawalIntent() {
      throw new Error("no withdrawal intents expected");
    },
    async failWithdrawalIntent() {
      throw new Error("no withdrawal intents expected");
    },
    async reportWorkerHeartbeat() {
      throw new Error("worker heartbeat reporting is handled outside the orchestrator");
    },
    async triggerLedgerReconciliationScan() {
      throw new Error("reconciliation scan scheduling is handled outside the orchestrator");
    },
    async triggerCriticalAlertReEscalationSweep() {
      throw new Error("platform alert re-escalation is handled outside the orchestrator");
    }
  });

  const orchestrator = new WorkerOrchestrator({
    runtime: createRuntime({
      environment: "production",
      workerId: "worker_1",
      internalApiBaseUrl: "https://internal.example.com",
      internalWorkerApiKey: "secret",
      executionMode: "monitor",
      pollIntervalMs: 10,
      batchLimit: 20,
      requestTimeoutMs: 1000,
      internalApiStartupGracePeriodMs: 45000,
      confirmationBlocks: 2,
      reconciliationScanIntervalMs: 300000,
      platformAlertReEscalationIntervalMs: 300000,
      rpcUrl: "https://rpc.example.com",
      depositSignerPrivateKey: null
    }),
    internalApiClient: client as never,
    rpcClient: {
      async getBlockNumber() {
        return 101n;
      },
      async getTransactionReceipt() {
        return {
          txHash:
            "0x3333333333333333333333333333333333333333333333333333333333333333",
          fromAddress: "0x000000000000000000000000000000000000dEaD",
          toAddress: "0x0000000000000000000000000000000000000abc",
          blockNumber: 100n,
          succeeded: true
        };
      }
    },
    depositBroadcaster: {
      signerAddress: "0x0000000000000000000000000000000000000aaa",
      async broadcast() {
        throw new Error("deposit broadcaster should not be called");
      }
    },
    withdrawalBroadcaster: null,
    policyControlledWithdrawalBroadcaster: null,
    logger: createLogger()
  });

  await orchestrator.runOnce();

  assert.deepEqual(operations, [
    "confirmDepositIntent:deposit_1",
    "settleDepositIntent:deposit_1"
  ]);
});

test("worker settles confirmed recovery backlog after the broadcast pass", async () => {
  const operations: string[] = [];

  const client = createInternalApiClient({
    async listQueuedDepositIntents() {
      return { intents: [], limit: 20 };
    },
    async listQueuedWithdrawalIntents() {
      return { intents: [], limit: 20 };
    },
    async listBroadcastDepositIntents() {
      return { intents: [], limit: 20 };
    },
    async listBroadcastWithdrawalIntents() {
      return { intents: [], limit: 20 };
    },
    async listConfirmedDepositIntentsReadyToSettle() {
      return {
        intents: [
          createIntent("deposit_confirmed_1", {
            status: "confirmed",
            latestBlockchainTransaction: {
              id: "btx_3",
              txHash:
                "0x4444444444444444444444444444444444444444444444444444444444444444",
              nonce: null,
              serializedTransaction: null,
              status: "confirmed",
              fromAddress: "0x000000000000000000000000000000000000dEaD",
              toAddress: "0x0000000000000000000000000000000000000abc",
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              confirmedAt: new Date().toISOString()
            }
          })
        ],
        limit: 20
      };
    },
    async listConfirmedWithdrawalIntentsReadyToSettle() {
      return {
        intents: [
          createIntent("withdrawal_confirmed_1", {
            status: "confirmed",
            latestBlockchainTransaction: {
              id: "btx_4",
              txHash:
                "0x5555555555555555555555555555555555555555555555555555555555555555",
              nonce: null,
              serializedTransaction: null,
              status: "confirmed",
              fromAddress: "0x0000000000000000000000000000000000000def",
              toAddress: "0x0000000000000000000000000000000000000fed",
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              confirmedAt: new Date().toISOString()
            }
          })
        ],
        limit: 20
      };
    },
    async recordDepositBroadcast() {
      throw new Error("no broadcast expected");
    },
    async confirmDepositIntent() {
      throw new Error("no confirm expected");
    },
    async settleDepositIntent(intentId: string) {
      operations.push(`settleDepositIntent:${intentId}`);
    },
    async failDepositIntent() {
      throw new Error("no deposit failure expected");
    },
    async recordWithdrawalBroadcast() {
      throw new Error("no broadcast expected");
    },
    async confirmWithdrawalIntent() {
      throw new Error("no confirm expected");
    },
    async settleWithdrawalIntent(intentId: string) {
      operations.push(`settleWithdrawalIntent:${intentId}`);
    },
    async failWithdrawalIntent() {
      throw new Error("no withdrawal failure expected");
    },
    async reportWorkerHeartbeat() {
      throw new Error("worker heartbeat reporting is handled outside the orchestrator");
    },
    async triggerLedgerReconciliationScan() {
      throw new Error("reconciliation scan scheduling is handled outside the orchestrator");
    },
    async triggerCriticalAlertReEscalationSweep() {
      throw new Error("platform alert re-escalation is handled outside the orchestrator");
    }
  });

  const orchestrator = new WorkerOrchestrator({
    runtime: createRuntime({
      environment: "production",
      workerId: "worker_1",
      internalApiBaseUrl: "https://internal.example.com",
      internalWorkerApiKey: "secret",
      executionMode: "monitor",
      pollIntervalMs: 10,
      batchLimit: 20,
      requestTimeoutMs: 1000,
      internalApiStartupGracePeriodMs: 45000,
      confirmationBlocks: 2,
      reconciliationScanIntervalMs: 300000,
      platformAlertReEscalationIntervalMs: 300000,
      rpcUrl: "https://rpc.example.com",
      depositSignerPrivateKey: null
    }),
    internalApiClient: client as never,
    rpcClient: {
      async getBlockNumber() {
        return 101n;
      },
      async getTransactionReceipt() {
        return null;
      }
    },
    depositBroadcaster: {
      signerAddress: "0x0000000000000000000000000000000000000aaa",
      async broadcast() {
        throw new Error("deposit broadcaster should not be called");
      }
    },
    withdrawalBroadcaster: null,
    policyControlledWithdrawalBroadcaster: null,
    logger: createLogger()
  });

  await orchestrator.runOnce();

  assert.deepEqual(operations, [
    "settleDepositIntent:deposit_confirmed_1",
    "settleWithdrawalIntent:withdrawal_confirmed_1"
  ]);
});

test("monitor mode waits when a broadcast intent does not yet have enough confirmations", async () => {
  const operations: string[] = [];

  const client = createInternalApiClient({
    async listQueuedDepositIntents() {
      return { intents: [], limit: 20 };
    },
    async listQueuedWithdrawalIntents() {
      return { intents: [], limit: 20 };
    },
    async listBroadcastDepositIntents() {
      return {
        intents: [
          createIntent("deposit_waiting_1", {
            status: "broadcast",
            latestBlockchainTransaction: {
              id: "btx_waiting_1",
              txHash:
                "0x6666666666666666666666666666666666666666666666666666666666666666",
              nonce: null,
              serializedTransaction: null,
              status: "broadcast",
              fromAddress: "0x000000000000000000000000000000000000dEaD",
              toAddress: "0x0000000000000000000000000000000000000abc",
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              confirmedAt: null
            }
          })
        ],
        limit: 20
      };
    },
    async listBroadcastWithdrawalIntents() {
      return { intents: [], limit: 20 };
    },
    async listConfirmedDepositIntentsReadyToSettle() {
      return { intents: [], limit: 20 };
    },
    async listConfirmedWithdrawalIntentsReadyToSettle() {
      return { intents: [], limit: 20 };
    },
    async recordDepositBroadcast() {
      throw new Error("monitor mode should not record broadcasts");
    },
    async confirmDepositIntent(intentId: string) {
      operations.push(`confirmDepositIntent:${intentId}`);
    },
    async settleDepositIntent(intentId: string) {
      operations.push(`settleDepositIntent:${intentId}`);
    },
    async failDepositIntent() {
      throw new Error("successful receipts should not fail");
    },
    async recordWithdrawalBroadcast() {
      throw new Error("no withdrawals expected");
    },
    async confirmWithdrawalIntent() {
      throw new Error("no withdrawals expected");
    },
    async settleWithdrawalIntent() {
      throw new Error("no withdrawals expected");
    },
    async failWithdrawalIntent() {
      throw new Error("no withdrawals expected");
    },
    async reportWorkerHeartbeat() {
      throw new Error("worker heartbeat reporting is handled outside the orchestrator");
    },
    async triggerLedgerReconciliationScan() {
      throw new Error("reconciliation scan scheduling is handled outside the orchestrator");
    },
    async triggerCriticalAlertReEscalationSweep() {
      throw new Error("platform alert re-escalation is handled outside the orchestrator");
    }
  });

  const orchestrator = new WorkerOrchestrator({
    runtime: createRuntime({
      environment: "production",
      workerId: "worker_1",
      internalApiBaseUrl: "https://internal.example.com",
      internalWorkerApiKey: "secret",
      executionMode: "monitor",
      pollIntervalMs: 10,
      batchLimit: 20,
      requestTimeoutMs: 1000,
      internalApiStartupGracePeriodMs: 45000,
      confirmationBlocks: 3,
      reconciliationScanIntervalMs: 300000,
      platformAlertReEscalationIntervalMs: 300000,
      rpcUrl: "https://rpc.example.com",
      depositSignerPrivateKey: null
    }),
    internalApiClient: client as never,
    rpcClient: {
      async getBlockNumber() {
        return 101n;
      },
      async getTransactionReceipt() {
        return {
          txHash:
            "0x6666666666666666666666666666666666666666666666666666666666666666",
          fromAddress: "0x000000000000000000000000000000000000dEaD",
          toAddress: "0x0000000000000000000000000000000000000abc",
          blockNumber: 100n,
          succeeded: true
        };
      }
    },
    depositBroadcaster: {
      signerAddress: "0x0000000000000000000000000000000000000aaa",
      async broadcast() {
        throw new Error("deposit broadcaster should not be called");
      }
    },
    withdrawalBroadcaster: null,
    policyControlledWithdrawalBroadcaster: null,
    logger: createLogger()
  });

  await orchestrator.runOnce();

  assert.deepEqual(operations, []);
});

test("managed mode broadcasts queued deposits and leaves withdrawals for manual custody execution", async () => {
  const operations: string[] = [];
  const { logger, warnings } = createCapturingLogger();

  const client = createInternalApiClient({
    async listQueuedDepositIntents() {
      return { intents: [createIntent("deposit_1")], limit: 20 };
    },
    async listQueuedWithdrawalIntents() {
      return { intents: [createIntent("withdrawal_1")], limit: 20 };
    },
    async listBroadcastDepositIntents() {
      return { intents: [], limit: 20 };
    },
    async listBroadcastWithdrawalIntents() {
      return { intents: [], limit: 20 };
    },
    async listConfirmedDepositIntentsReadyToSettle() {
      return { intents: [], limit: 20 };
    },
    async listConfirmedWithdrawalIntentsReadyToSettle() {
      return { intents: [], limit: 20 };
    },
    async recordDepositBroadcast(intentId: string, payload: { txHash: string }) {
      operations.push(`recordDepositBroadcast:${intentId}:${payload.txHash}`);
    },
    async confirmDepositIntent() {
      throw new Error("no monitored deposits expected");
    },
    async settleDepositIntent() {
      throw new Error("no monitored deposits expected");
    },
    async failDepositIntent() {
      throw new Error("deposit should broadcast successfully");
    },
    async recordWithdrawalBroadcast() {
      throw new Error("withdrawals must not auto-broadcast in managed mode");
    },
    async confirmWithdrawalIntent() {
      throw new Error("no monitored withdrawals expected");
    },
    async settleWithdrawalIntent() {
      throw new Error("no monitored withdrawals expected");
    },
    async failWithdrawalIntent(intentId: string, payload: {
      failureCode: string;
      failureCategory?: string;
    }) {
      operations.push(
        `failWithdrawalIntent:${intentId}:${payload.failureCode}:${payload.failureCategory}`
      );
    },
    async reportWorkerHeartbeat() {
      throw new Error("worker heartbeat reporting is handled outside the orchestrator");
    },
    async triggerLedgerReconciliationScan() {
      throw new Error("reconciliation scan scheduling is handled outside the orchestrator");
    },
    async triggerCriticalAlertReEscalationSweep() {
      throw new Error("platform alert re-escalation is handled outside the orchestrator");
    }
  });

  const orchestrator = new WorkerOrchestrator({
    runtime: createRuntime({
      environment: "production",
      workerId: "worker_1",
      internalApiBaseUrl: "https://internal.example.com",
      internalWorkerApiKey: "secret",
      executionMode: "managed",
      pollIntervalMs: 10,
      batchLimit: 20,
      requestTimeoutMs: 1000,
      internalApiStartupGracePeriodMs: 45000,
      confirmationBlocks: 2,
      reconciliationScanIntervalMs: 300000,
      platformAlertReEscalationIntervalMs: 300000,
      rpcUrl: "https://rpc.example.com",
      depositSignerPrivateKey:
        "0x59c6995e998f97a5a0044966f094538c5f6d4e07f16b8ad8cc7658f0f1b0f9d8"
    }),
    internalApiClient: client as never,
    rpcClient: {
      async getBlockNumber() {
        return 100n;
      },
      async getTransactionReceipt() {
        return null;
      }
    },
    depositBroadcaster: {
      signerAddress: "0x0000000000000000000000000000000000000aaa",
      async broadcast() {
        return {
          txHash:
            "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          fromAddress: "0x0000000000000000000000000000000000000aaa",
          toAddress: "0x0000000000000000000000000000000000000abc"
        };
      }
    },
    withdrawalBroadcaster: createManagedWithdrawalBroadcaster(),
    policyControlledWithdrawalBroadcaster: null,
    logger
  });

  await orchestrator.runOnce();

  assert.deepEqual(operations, [
    "recordDepositBroadcast:deposit_1:0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    "failWithdrawalIntent:withdrawal_1:managed_withdrawal_signer_unavailable:manual_intervention_required"
  ]);
  assert.equal(warnings.length, 0);
});

test("managed mode permanently fails malformed deposit intents", async () => {
  const operations: string[] = [];

  const client = createInternalApiClient({
    async listQueuedDepositIntents() {
      return {
        intents: [
          createIntent("deposit_1", {
            destinationWalletAddress: null
          })
        ],
        limit: 20
      };
    },
    async listQueuedWithdrawalIntents() {
      return { intents: [], limit: 20 };
    },
    async listBroadcastDepositIntents() {
      return { intents: [], limit: 20 };
    },
    async listBroadcastWithdrawalIntents() {
      return { intents: [], limit: 20 };
    },
    async listConfirmedDepositIntentsReadyToSettle() {
      return { intents: [], limit: 20 };
    },
    async listConfirmedWithdrawalIntentsReadyToSettle() {
      return { intents: [], limit: 20 };
    },
    async recordDepositBroadcast() {
      throw new Error("malformed deposit intent should not broadcast");
    },
    async confirmDepositIntent() {
      throw new Error("no monitored deposits expected");
    },
    async settleDepositIntent() {
      throw new Error("no monitored deposits expected");
    },
    async failDepositIntent(intentId: string, payload: { failureCode: string }) {
      operations.push(`failDepositIntent:${intentId}:${payload.failureCode}`);
    },
    async recordWithdrawalBroadcast() {
      throw new Error("no withdrawals expected");
    },
    async confirmWithdrawalIntent() {
      throw new Error("no withdrawals expected");
    },
    async settleWithdrawalIntent() {
      throw new Error("no withdrawals expected");
    },
    async failWithdrawalIntent() {
      throw new Error("no withdrawals expected");
    },
    async reportWorkerHeartbeat() {
      throw new Error("worker heartbeat reporting is handled outside the orchestrator");
    },
    async triggerLedgerReconciliationScan() {
      throw new Error("reconciliation scan scheduling is handled outside the orchestrator");
    },
    async triggerCriticalAlertReEscalationSweep() {
      throw new Error("platform alert re-escalation is handled outside the orchestrator");
    }
  });

  const orchestrator = new WorkerOrchestrator({
    runtime: createRuntime({
      environment: "production",
      workerId: "worker_1",
      internalApiBaseUrl: "https://internal.example.com",
      internalWorkerApiKey: "secret",
      executionMode: "managed",
      pollIntervalMs: 10,
      batchLimit: 20,
      requestTimeoutMs: 1000,
      internalApiStartupGracePeriodMs: 45000,
      confirmationBlocks: 2,
      reconciliationScanIntervalMs: 300000,
      platformAlertReEscalationIntervalMs: 300000,
      rpcUrl: "https://rpc.example.com",
      depositSignerPrivateKey:
        "0x59c6995e998f97a5a0044966f094538c5f6d4e07f16b8ad8cc7658f0f1b0f9d8"
    }),
    internalApiClient: client as never,
    rpcClient: {
      async getBlockNumber() {
        return 100n;
      },
      async getTransactionReceipt() {
        return null;
      }
    },
    depositBroadcaster: {
      signerAddress: "0x0000000000000000000000000000000000000aaa",
      async broadcast() {
        throw new ManagedExecutionIntentError({
          failureCode: "missing_destination_wallet",
          failureReason:
            "Deposit intent is missing a destination wallet address and cannot be broadcast."
        });
      }
    },
    withdrawalBroadcaster: createManagedWithdrawalBroadcaster(),
    policyControlledWithdrawalBroadcaster: null,
    logger: createLogger()
  });

  await orchestrator.runOnce();

  assert.deepEqual(operations, [
    "failDepositIntent:deposit_1:missing_destination_wallet"
  ]);
});

test("managed mode broadcasts, confirms, and settles queued withdrawals", async () => {
  const operations: string[] = [];
  let phase: "queued" | "broadcast" | "settled" = "queued";

  const queuedIntent = createIntent("withdrawal_managed_1");
  const txHash =
    "0x7777777777777777777777777777777777777777777777777777777777777777";
  const serializedTransaction = "0xabc123";

  const client = createInternalApiClient({
    async listQueuedDepositIntents() {
      return { intents: [], limit: 20 };
    },
    async listQueuedWithdrawalIntents() {
      return phase === "queued" ? { intents: [queuedIntent], limit: 20 } : { intents: [], limit: 20 };
    },
    async startManagedWithdrawalExecution(intentId: string) {
      operations.push(`startManagedWithdrawalExecution:${intentId}`);

      return {
        intent: createIntent(intentId, {
          latestBlockchainTransaction: {
            id: "withdrawal_tx_created_1",
            txHash: null,
            nonce: null,
            serializedTransaction: null,
            status: "created",
            fromAddress: queuedIntent.sourceWalletAddress,
            toAddress: queuedIntent.externalAddress,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            confirmedAt: null
          }
        }),
        executionClaimed: true,
        executionReused: false
      };
    },
    async recordSignedWithdrawalExecution(intentId: string, payload: { txHash: string }) {
      operations.push(`recordSignedWithdrawalExecution:${intentId}:${payload.txHash}`);
      return {
        intent: createIntent(intentId, {
          latestBlockchainTransaction: {
            id: "withdrawal_tx_signed_1",
            txHash,
            nonce: 9,
            serializedTransaction,
            status: "signed",
            fromAddress: queuedIntent.sourceWalletAddress,
            toAddress: queuedIntent.externalAddress,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            confirmedAt: null
          }
        }),
        signedStateReused: false
      };
    },
    async listBroadcastDepositIntents() {
      return { intents: [], limit: 20 };
    },
    async listBroadcastWithdrawalIntents() {
      return phase === "broadcast"
        ? {
            intents: [
              createIntent("withdrawal_managed_1", {
                status: "broadcast",
                latestBlockchainTransaction: {
                  id: "withdrawal_tx_broadcast_1",
                  txHash,
                  nonce: 9,
                  serializedTransaction,
                  status: "broadcast",
                  fromAddress: queuedIntent.sourceWalletAddress,
                  toAddress: queuedIntent.externalAddress,
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                  confirmedAt: null
                }
              })
            ],
            limit: 20
          }
        : { intents: [], limit: 20 };
    },
    async listConfirmedDepositIntentsReadyToSettle() {
      return { intents: [], limit: 20 };
    },
    async listConfirmedWithdrawalIntentsReadyToSettle() {
      return { intents: [], limit: 20 };
    },
    async recordDepositBroadcast() {
      throw new Error("not expected");
    },
    async confirmDepositIntent() {
      throw new Error("not expected");
    },
    async settleDepositIntent() {
      throw new Error("not expected");
    },
    async failDepositIntent() {
      throw new Error("not expected");
    },
    async recordWithdrawalBroadcast(intentId: string, payload: { txHash: string }) {
      operations.push(`recordWithdrawalBroadcast:${intentId}:${payload.txHash}`);
      phase = "broadcast";
    },
    async confirmWithdrawalIntent(intentId: string, payload: { txHash?: string }) {
      operations.push(`confirmWithdrawalIntent:${intentId}:${payload.txHash ?? ""}`);
    },
    async settleWithdrawalIntent(intentId: string) {
      operations.push(`settleWithdrawalIntent:${intentId}`);
      phase = "settled";
    },
    async failWithdrawalIntent() {
      throw new Error("not expected");
    },
    async reportWorkerHeartbeat() {
      throw new Error("worker heartbeat reporting is handled outside the orchestrator");
    },
    async triggerLedgerReconciliationScan() {
      throw new Error("reconciliation scan scheduling is handled outside the orchestrator");
    },
    async triggerCriticalAlertReEscalationSweep() {
      throw new Error("platform alert re-escalation is handled outside the orchestrator");
    }
  });

  const broadcasterOperations: string[] = [];
  const orchestrator = new WorkerOrchestrator({
    runtime: createRuntime({
      environment: "production",
      workerId: "worker_1",
      internalApiBaseUrl: "https://internal.example.com",
      internalWorkerApiKey: "secret",
      executionMode: "managed",
      pollIntervalMs: 10,
      batchLimit: 20,
      requestTimeoutMs: 1000,
      internalApiStartupGracePeriodMs: 45000,
      confirmationBlocks: 1,
      reconciliationScanIntervalMs: 300000,
      platformAlertReEscalationIntervalMs: 300000,
      rpcUrl: "https://rpc.example.com",
      depositSignerPrivateKey:
        "0x59c6995e998f97a5a0044966f094538c5f6d4e07f16b8ad8cc7658f0f1b0f9d8"
    }),
    internalApiClient: client as never,
    rpcClient: {
      async getBlockNumber() {
        return 101n;
      },
      async getTransactionReceipt() {
        return {
          txHash,
          fromAddress: queuedIntent.sourceWalletAddress,
          toAddress: queuedIntent.externalAddress,
          blockNumber: 101n,
          succeeded: true
        };
      }
    },
    depositBroadcaster: {
      signerAddress: "0x0000000000000000000000000000000000000aaa",
      async broadcast() {
        throw new Error("deposit broadcaster should not be called");
      }
    },
    withdrawalBroadcaster: createManagedWithdrawalBroadcaster({
      canManageWallet() {
        return true;
      },
      async prepare() {
        broadcasterOperations.push("prepare");
        return {
          txHash,
          nonce: 9,
          serializedTransaction,
          fromAddress: queuedIntent.sourceWalletAddress!,
          toAddress: queuedIntent.externalAddress!
        };
      },
      async broadcastSignedTransaction() {
        broadcasterOperations.push("broadcastSignedTransaction");
        return {
          txHash,
          fromAddress: queuedIntent.sourceWalletAddress!,
          toAddress: queuedIntent.externalAddress!
        };
      }
    }),
    policyControlledWithdrawalBroadcaster: null,
    logger: createLogger()
  });

  await orchestrator.runOnce();

  assert.deepEqual(broadcasterOperations, ["prepare", "broadcastSignedTransaction"]);
  assert.deepEqual(operations, [
    "startManagedWithdrawalExecution:withdrawal_managed_1",
    "recordSignedWithdrawalExecution:withdrawal_managed_1:0x7777777777777777777777777777777777777777777777777777777777777777",
    "recordWithdrawalBroadcast:withdrawal_managed_1:0x7777777777777777777777777777777777777777777777777777777777777777",
    "confirmWithdrawalIntent:withdrawal_managed_1:0x7777777777777777777777777777777777777777777777777777777777777777",
    "settleWithdrawalIntent:withdrawal_managed_1"
  ]);
  assert.equal(phase, "settled");
});

test("managed mode executes contract-controlled withdrawals through the policy-controlled broadcaster", async () => {
  const txHash =
    "0x3333333333333333333333333333333333333333333333333333333333333333";
  const serializedTransaction = "0xfeedface";
  const operations: string[] = [];
  const broadcasterOperations: string[] = [];
  const queuedIntent = createIntent("withdrawal_policy_1", {
    sourceWalletAddress: "0x0000000000000000000000000000000000000cab",
    sourceWalletCustodyType: "contract_controlled"
  });

  const orchestrator = new WorkerOrchestrator({
    runtime: createRuntime({
      environment: "production",
      workerId: "worker_1",
      internalApiBaseUrl: "https://internal.example.com",
      internalWorkerApiKey: "secret",
      executionMode: "managed",
      pollIntervalMs: 10,
      batchLimit: 20,
      requestTimeoutMs: 1000,
      internalApiStartupGracePeriodMs: 45000,
      confirmationBlocks: 2,
      reconciliationScanIntervalMs: 300000,
      platformAlertReEscalationIntervalMs: 300000,
      rpcUrl: "https://rpc.example.com",
      depositSignerPrivateKey:
        "0x59c6995e998f97a5a0044966f094538c5f6d4e07f16b8ad8cc7658f0f1b0f9d8"
    }),
    internalApiClient: createInternalApiClient({
      async listQueuedDepositIntents() {
        return { intents: [], limit: 20 };
      },
      async listQueuedWithdrawalIntents() {
        return { intents: [queuedIntent], limit: 20 };
      },
      async startManagedWithdrawalExecution(intentId: string) {
        operations.push(`startManagedWithdrawalExecution:${intentId}`);
        return {
          intent: queuedIntent,
          executionClaimed: true,
          executionReused: false
        };
      },
      async recordSignedWithdrawalExecution(intentId: string, payload: {
        txHash: string;
      }) {
        operations.push(
          `recordSignedWithdrawalExecution:${intentId}:${payload.txHash}`
        );
        return {
          intent: createIntent("withdrawal_policy_1", {
            sourceWalletAddress: queuedIntent.sourceWalletAddress,
            sourceWalletCustodyType: "contract_controlled",
            status: "queued",
            latestBlockchainTransaction: {
              id: "withdrawal_policy_tx_signed_1",
              txHash,
              nonce: 4,
              serializedTransaction,
              status: "signed",
              fromAddress: "0x0000000000000000000000000000000000000bee",
              toAddress: queuedIntent.sourceWalletAddress,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              confirmedAt: null
            }
          }),
          signedStateReused: false
        };
      },
      async listBroadcastDepositIntents() {
        return { intents: [], limit: 20 };
      },
      async listBroadcastWithdrawalIntents() {
        return {
          intents: [
            createIntent("withdrawal_policy_1", {
              sourceWalletAddress: queuedIntent.sourceWalletAddress,
              sourceWalletCustodyType: "contract_controlled",
              status: "broadcast",
              latestBlockchainTransaction: {
                id: "withdrawal_policy_tx_broadcast_1",
                txHash,
                nonce: 4,
                serializedTransaction,
                status: "broadcast",
                fromAddress: "0x0000000000000000000000000000000000000bee",
                toAddress: queuedIntent.sourceWalletAddress,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                confirmedAt: null
              }
            })
          ],
          limit: 20
        };
      },
      async listConfirmedDepositIntentsReadyToSettle() {
        return { intents: [], limit: 20 };
      },
      async listConfirmedWithdrawalIntentsReadyToSettle() {
        return { intents: [], limit: 20 };
      },
      async recordWithdrawalBroadcast(intentId: string, payload: {
        txHash: string;
      }) {
        operations.push(`recordWithdrawalBroadcast:${intentId}:${payload.txHash}`);
      },
      async confirmWithdrawalIntent(intentId: string, payload: {
        txHash?: string;
      }) {
        operations.push(`confirmWithdrawalIntent:${intentId}:${payload.txHash}`);
      },
      async settleWithdrawalIntent(intentId: string) {
        operations.push(`settleWithdrawalIntent:${intentId}`);
      },
      async recordDepositBroadcast() {
        throw new Error("deposit flow not expected");
      },
      async confirmDepositIntent() {
        throw new Error("deposit flow not expected");
      },
      async settleDepositIntent() {
        throw new Error("deposit flow not expected");
      },
      async failDepositIntent() {
        throw new Error("deposit flow not expected");
      },
      async failWithdrawalIntent() {
        throw new Error("policy-controlled withdrawal should not fail");
      },
      async reportWorkerHeartbeat() {
        throw new Error("worker heartbeat reporting is handled outside the orchestrator");
      },
      async triggerLedgerReconciliationScan() {
        throw new Error("reconciliation scan scheduling is handled outside the orchestrator");
      },
      async triggerCriticalAlertReEscalationSweep() {
        throw new Error("platform alert re-escalation is handled outside the orchestrator");
      }
    }) as never,
    rpcClient: {
      async getBlockNumber() {
        return 101n;
      },
      async getTransactionReceipt(requestedTxHash: string) {
        assert.equal(requestedTxHash, txHash);
        return {
          txHash,
          fromAddress: "0x0000000000000000000000000000000000000bee",
          toAddress: queuedIntent.sourceWalletAddress!,
          blockNumber: 100n,
          succeeded: true
        };
      }
    },
    depositBroadcaster: {
      signerAddress: "0x0000000000000000000000000000000000000aaa",
      async broadcast() {
        throw new Error("deposit broadcaster should not be called");
      }
    },
    withdrawalBroadcaster: createManagedWithdrawalBroadcaster({
      canManageWallet() {
        return false;
      }
    }),
    policyControlledWithdrawalBroadcaster:
      createPolicyControlledWithdrawalBroadcaster({
        async prepare(intent: WorkerIntentProjection) {
          broadcasterOperations.push(`prepare:${intent.id}`);
          return {
            txHash,
            nonce: 4,
            serializedTransaction,
            fromAddress: "0x0000000000000000000000000000000000000bee",
            toAddress: queuedIntent.sourceWalletAddress!
          };
        },
        async broadcastSignedTransaction(signedTransaction: string) {
          broadcasterOperations.push(
            `broadcastSignedTransaction:${signedTransaction}`
          );
          return {
            txHash,
            fromAddress: "0x0000000000000000000000000000000000000bee",
            toAddress: queuedIntent.sourceWalletAddress!
          };
        }
      }),
    logger: createLogger()
  });

  await orchestrator.runOnce();

  assert.deepEqual(operations, [
    "startManagedWithdrawalExecution:withdrawal_policy_1",
    "recordSignedWithdrawalExecution:withdrawal_policy_1:0x3333333333333333333333333333333333333333333333333333333333333333",
    "recordWithdrawalBroadcast:withdrawal_policy_1:0x3333333333333333333333333333333333333333333333333333333333333333",
    "confirmWithdrawalIntent:withdrawal_policy_1:0x3333333333333333333333333333333333333333333333333333333333333333",
    "settleWithdrawalIntent:withdrawal_policy_1"
  ]);
  assert.deepEqual(broadcasterOperations, [
    "prepare:withdrawal_policy_1",
    "broadcastSignedTransaction:0xfeedface"
  ]);
});

test("managed mode does not double-broadcast or double-settle signed withdrawals across duplicate runs", async () => {
  let phase: "queued" | "broadcast" | "settled" = "queued";
  let broadcastCount = 0;
  let settleCount = 0;
  const txHash =
    "0x8888888888888888888888888888888888888888888888888888888888888888";
  const serializedTransaction = "0xfeed";

  const client = createInternalApiClient({
    async listQueuedDepositIntents() {
      return { intents: [], limit: 20 };
    },
    async listQueuedWithdrawalIntents() {
      return phase === "queued"
        ? {
            intents: [
              createIntent("withdrawal_duplicate_1", {
                latestBlockchainTransaction: {
                  id: "withdrawal_tx_signed_duplicate_1",
                  txHash,
                  nonce: 12,
                  serializedTransaction,
                  status: "signed",
                  fromAddress: "0x0000000000000000000000000000000000000def",
                  toAddress: "0x0000000000000000000000000000000000000fed",
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                  confirmedAt: null
                }
              })
            ],
            limit: 20
          }
        : { intents: [], limit: 20 };
    },
    async startManagedWithdrawalExecution() {
      throw new Error("signed withdrawals should not restart execution");
    },
    async recordSignedWithdrawalExecution() {
      throw new Error("signed withdrawals should reuse the durable signed state");
    },
    async listBroadcastDepositIntents() {
      return { intents: [], limit: 20 };
    },
    async listBroadcastWithdrawalIntents() {
      return phase === "broadcast"
        ? {
            intents: [
              createIntent("withdrawal_duplicate_1", {
                status: "broadcast",
                latestBlockchainTransaction: {
                  id: "withdrawal_tx_broadcast_duplicate_1",
                  txHash,
                  nonce: 12,
                  serializedTransaction,
                  status: "broadcast",
                  fromAddress: "0x0000000000000000000000000000000000000def",
                  toAddress: "0x0000000000000000000000000000000000000fed",
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                  confirmedAt: null
                }
              })
            ],
            limit: 20
          }
        : { intents: [], limit: 20 };
    },
    async listConfirmedDepositIntentsReadyToSettle() {
      return { intents: [], limit: 20 };
    },
    async listConfirmedWithdrawalIntentsReadyToSettle() {
      return { intents: [], limit: 20 };
    },
    async recordDepositBroadcast() {
      throw new Error("not expected");
    },
    async confirmDepositIntent() {
      throw new Error("not expected");
    },
    async settleDepositIntent() {
      throw new Error("not expected");
    },
    async failDepositIntent() {
      throw new Error("not expected");
    },
    async recordWithdrawalBroadcast() {
      broadcastCount += 1;
      phase = "broadcast";
    },
    async confirmWithdrawalIntent() {},
    async settleWithdrawalIntent() {
      settleCount += 1;
      phase = "settled";
    },
    async failWithdrawalIntent() {
      throw new Error("not expected");
    },
    async reportWorkerHeartbeat() {
      throw new Error("worker heartbeat reporting is handled outside the orchestrator");
    },
    async triggerLedgerReconciliationScan() {
      throw new Error("reconciliation scan scheduling is handled outside the orchestrator");
    },
    async triggerCriticalAlertReEscalationSweep() {
      throw new Error("platform alert re-escalation is handled outside the orchestrator");
    }
  });

  const orchestrator = new WorkerOrchestrator({
    runtime: createRuntime({
      environment: "production",
      workerId: "worker_1",
      internalApiBaseUrl: "https://internal.example.com",
      internalWorkerApiKey: "secret",
      executionMode: "managed",
      pollIntervalMs: 10,
      batchLimit: 20,
      requestTimeoutMs: 1000,
      internalApiStartupGracePeriodMs: 45000,
      confirmationBlocks: 1,
      reconciliationScanIntervalMs: 300000,
      platformAlertReEscalationIntervalMs: 300000,
      rpcUrl: "https://rpc.example.com",
      depositSignerPrivateKey:
        "0x59c6995e998f97a5a0044966f094538c5f6d4e07f16b8ad8cc7658f0f1b0f9d8"
    }),
    internalApiClient: client as never,
    rpcClient: {
      async getBlockNumber() {
        return 101n;
      },
      async getTransactionReceipt() {
        return {
          txHash,
          fromAddress: "0x0000000000000000000000000000000000000def",
          toAddress: "0x0000000000000000000000000000000000000fed",
          blockNumber: 101n,
          succeeded: true
        };
      }
    },
    depositBroadcaster: {
      signerAddress: "0x0000000000000000000000000000000000000aaa",
      async broadcast() {
        throw new Error("deposit broadcaster should not be called");
      }
    },
    withdrawalBroadcaster: createManagedWithdrawalBroadcaster({
      canManageWallet() {
        return true;
      },
      async prepare() {
        throw new Error("signed withdrawal should not be re-prepared");
      },
      async broadcastSignedTransaction() {
        return {
          txHash,
          fromAddress: "0x0000000000000000000000000000000000000def",
          toAddress: "0x0000000000000000000000000000000000000fed"
        };
      }
    }),
    policyControlledWithdrawalBroadcaster: null,
    logger: createLogger()
  });

  await orchestrator.runOnce();
  await orchestrator.runOnce();

  assert.equal(broadcastCount, 1);
  assert.equal(settleCount, 1);
});

test("managed mode safely fails unrecoverable withdrawal execution errors", async () => {
  const operations: string[] = [];

  const client = createInternalApiClient({
    async listQueuedDepositIntents() {
      return { intents: [], limit: 20 };
    },
    async listQueuedWithdrawalIntents() {
      return { intents: [createIntent("withdrawal_fail_1")], limit: 20 };
    },
    async startManagedWithdrawalExecution(intentId: string) {
      return {
        intent: createIntent(intentId, {
          latestBlockchainTransaction: {
            id: "withdrawal_tx_created_failure_1",
            txHash: null,
            nonce: null,
            serializedTransaction: null,
            status: "created",
            fromAddress: "0x0000000000000000000000000000000000000def",
            toAddress: "0x0000000000000000000000000000000000000fed",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            confirmedAt: null
          }
        }),
        executionClaimed: true,
        executionReused: false
      };
    },
    async recordSignedWithdrawalExecution() {
      throw new Error("not expected");
    },
    async listBroadcastDepositIntents() {
      return { intents: [], limit: 20 };
    },
    async listBroadcastWithdrawalIntents() {
      return { intents: [], limit: 20 };
    },
    async listConfirmedDepositIntentsReadyToSettle() {
      return { intents: [], limit: 20 };
    },
    async listConfirmedWithdrawalIntentsReadyToSettle() {
      return { intents: [], limit: 20 };
    },
    async recordDepositBroadcast() {
      throw new Error("not expected");
    },
    async confirmDepositIntent() {
      throw new Error("not expected");
    },
    async settleDepositIntent() {
      throw new Error("not expected");
    },
    async failDepositIntent() {
      throw new Error("not expected");
    },
    async recordWithdrawalBroadcast() {
      throw new Error("not expected");
    },
    async confirmWithdrawalIntent() {
      throw new Error("not expected");
    },
    async settleWithdrawalIntent() {
      throw new Error("not expected");
    },
    async failWithdrawalIntent(intentId: string, payload: { failureCode: string }) {
      operations.push(`failWithdrawalIntent:${intentId}:${payload.failureCode}`);
    },
    async reportWorkerHeartbeat() {
      throw new Error("worker heartbeat reporting is handled outside the orchestrator");
    },
    async triggerLedgerReconciliationScan() {
      throw new Error("reconciliation scan scheduling is handled outside the orchestrator");
    },
    async triggerCriticalAlertReEscalationSweep() {
      throw new Error("platform alert re-escalation is handled outside the orchestrator");
    }
  });

  const orchestrator = new WorkerOrchestrator({
    runtime: createRuntime({
      environment: "production",
      workerId: "worker_1",
      internalApiBaseUrl: "https://internal.example.com",
      internalWorkerApiKey: "secret",
      executionMode: "managed",
      pollIntervalMs: 10,
      batchLimit: 20,
      requestTimeoutMs: 1000,
      internalApiStartupGracePeriodMs: 45000,
      confirmationBlocks: 1,
      reconciliationScanIntervalMs: 300000,
      platformAlertReEscalationIntervalMs: 300000,
      rpcUrl: "https://rpc.example.com",
      depositSignerPrivateKey:
        "0x59c6995e998f97a5a0044966f094538c5f6d4e07f16b8ad8cc7658f0f1b0f9d8"
    }),
    internalApiClient: client as never,
    rpcClient: {
      async getBlockNumber() {
        return 101n;
      },
      async getTransactionReceipt() {
        return null;
      }
    },
    depositBroadcaster: {
      signerAddress: "0x0000000000000000000000000000000000000aaa",
      async broadcast() {
        throw new Error("deposit broadcaster should not be called");
      }
    },
    withdrawalBroadcaster: createManagedWithdrawalBroadcaster({
      canManageWallet() {
        return true;
      },
      async prepare() {
        throw new ManagedExecutionIntentError({
          failureCode: "invalid_withdrawal_requested_amount",
          failureReason: "Withdrawal amount is invalid."
        });
      }
    }),
    policyControlledWithdrawalBroadcaster: null,
    logger: createLogger()
  });

  await orchestrator.runOnce();

  assert.deepEqual(operations, [
    "failWithdrawalIntent:withdrawal_fail_1:invalid_withdrawal_requested_amount"
  ]);
});

test("monitor mode warns and skips broadcast intents that are missing a tx hash", async () => {
  const { logger, warnings } = createCapturingLogger();

  const orchestrator = new WorkerOrchestrator({
    runtime: createRuntime({
      environment: "production",
      workerId: "worker_1",
      internalApiBaseUrl: "https://internal.example.com",
      internalWorkerApiKey: "secret",
      executionMode: "monitor",
      pollIntervalMs: 10,
      batchLimit: 20,
      requestTimeoutMs: 1000,
      internalApiStartupGracePeriodMs: 45000,
      confirmationBlocks: 2,
      reconciliationScanIntervalMs: 300000,
      platformAlertReEscalationIntervalMs: 300000,
      rpcUrl: "https://rpc.example.com",
      depositSignerPrivateKey: null
    }),
    internalApiClient: createInternalApiClient({
      async listQueuedDepositIntents() {
        return { intents: [], limit: 20 };
      },
      async listQueuedWithdrawalIntents() {
        return { intents: [], limit: 20 };
      },
      async listBroadcastDepositIntents() {
        return {
          intents: [
            createIntent("deposit_missing_hash_1", {
              status: "broadcast",
              latestBlockchainTransaction: null
            })
          ],
          limit: 20
        };
      },
      async listBroadcastWithdrawalIntents() {
        return { intents: [], limit: 20 };
      },
      async listConfirmedDepositIntentsReadyToSettle() {
        return { intents: [], limit: 20 };
      },
      async listConfirmedWithdrawalIntentsReadyToSettle() {
        return { intents: [], limit: 20 };
      },
      async recordDepositBroadcast() {
        throw new Error("not expected");
      },
      async confirmDepositIntent() {
        throw new Error("not expected");
      },
      async settleDepositIntent() {
        throw new Error("not expected");
      },
      async failDepositIntent() {
        throw new Error("not expected");
      },
      async recordWithdrawalBroadcast() {
        throw new Error("not expected");
      },
      async confirmWithdrawalIntent() {
        throw new Error("not expected");
      },
      async settleWithdrawalIntent() {
        throw new Error("not expected");
      },
      async failWithdrawalIntent() {
        throw new Error("not expected");
      },
      async reportWorkerHeartbeat() {
        throw new Error("worker heartbeat reporting is handled outside the orchestrator");
      },
      async triggerLedgerReconciliationScan() {
        throw new Error("reconciliation scan scheduling is handled outside the orchestrator");
      },
      async triggerCriticalAlertReEscalationSweep() {
        throw new Error("platform alert re-escalation is handled outside the orchestrator");
      }
    }) as never,
    rpcClient: {
      async getBlockNumber() {
        throw new Error("missing tx hash should return before block lookup");
      },
      async getTransactionReceipt() {
        throw new Error("missing tx hash should return before receipt lookup");
      }
    },
    depositBroadcaster: null,
    withdrawalBroadcaster: null,
    policyControlledWithdrawalBroadcaster: null,
    logger
  });

  await orchestrator.runOnce();

  assert.equal(warnings.length, 1);
  assert.equal(warnings[0]?.event, "broadcast_intent_missing_tx_hash");
});

test("monitor mode marks reverted withdrawal receipts as failed", async () => {
  const operations: string[] = [];
  const { logger, warnings } = createCapturingLogger();

  const orchestrator = new WorkerOrchestrator({
    runtime: createRuntime({
      environment: "production",
      workerId: "worker_1",
      internalApiBaseUrl: "https://internal.example.com",
      internalWorkerApiKey: "secret",
      executionMode: "monitor",
      pollIntervalMs: 10,
      batchLimit: 20,
      requestTimeoutMs: 1000,
      internalApiStartupGracePeriodMs: 45000,
      confirmationBlocks: 2,
      reconciliationScanIntervalMs: 300000,
      platformAlertReEscalationIntervalMs: 300000,
      rpcUrl: "https://rpc.example.com",
      depositSignerPrivateKey: null
    }),
    internalApiClient: createInternalApiClient({
      async listQueuedDepositIntents() {
        return { intents: [], limit: 20 };
      },
      async listQueuedWithdrawalIntents() {
        return { intents: [], limit: 20 };
      },
      async listBroadcastDepositIntents() {
        return { intents: [], limit: 20 };
      },
      async listBroadcastWithdrawalIntents() {
        return {
          intents: [
            createIntent("withdrawal_reverted_1", {
              status: "broadcast",
              latestBlockchainTransaction: {
                id: "btx_reverted_1",
                txHash:
                  "0x7777777777777777777777777777777777777777777777777777777777777777",
                nonce: null,
                serializedTransaction: null,
                status: "broadcast",
                fromAddress: "0x0000000000000000000000000000000000000def",
                toAddress: "0x0000000000000000000000000000000000000fed",
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                confirmedAt: null
              }
            })
          ],
          limit: 20
        };
      },
      async listConfirmedDepositIntentsReadyToSettle() {
        return { intents: [], limit: 20 };
      },
      async listConfirmedWithdrawalIntentsReadyToSettle() {
        return { intents: [], limit: 20 };
      },
      async recordDepositBroadcast() {
        throw new Error("not expected");
      },
      async confirmDepositIntent() {
        throw new Error("not expected");
      },
      async settleDepositIntent() {
        throw new Error("not expected");
      },
      async failDepositIntent() {
        throw new Error("not expected");
      },
      async recordWithdrawalBroadcast() {
        throw new Error("not expected");
      },
      async confirmWithdrawalIntent() {
        throw new Error("not expected");
      },
      async settleWithdrawalIntent() {
        throw new Error("not expected");
      },
      async failWithdrawalIntent(intentId: string, payload: { failureCode: string }) {
        operations.push(`failWithdrawalIntent:${intentId}:${payload.failureCode}`);
      },
      async reportWorkerHeartbeat() {
        throw new Error("worker heartbeat reporting is handled outside the orchestrator");
      },
      async triggerLedgerReconciliationScan() {
        throw new Error("reconciliation scan scheduling is handled outside the orchestrator");
      },
      async triggerCriticalAlertReEscalationSweep() {
        throw new Error("platform alert re-escalation is handled outside the orchestrator");
      }
    }) as never,
    rpcClient: {
      async getBlockNumber() {
        return 101n;
      },
      async getTransactionReceipt() {
        return {
          txHash:
            "0x7777777777777777777777777777777777777777777777777777777777777777",
          fromAddress: "0x0000000000000000000000000000000000000def",
          toAddress: "0x0000000000000000000000000000000000000fed",
          blockNumber: 100n,
          succeeded: false
        };
      }
    },
    depositBroadcaster: null,
    withdrawalBroadcaster: null,
    policyControlledWithdrawalBroadcaster: null,
    logger
  });

  await orchestrator.runOnce();

  assert.deepEqual(operations, [
    "failWithdrawalIntent:withdrawal_reverted_1:onchain_reverted"
  ]);
  assert.equal(warnings[0]?.event, "broadcast_intent_marked_failed");
});

test("monitor mode marks reverted deposit receipts as failed", async () => {
  const operations: string[] = [];

  const orchestrator = new WorkerOrchestrator({
    runtime: createRuntime({
      environment: "production",
      workerId: "worker_1",
      internalApiBaseUrl: "https://internal.example.com",
      internalWorkerApiKey: "secret",
      executionMode: "monitor",
      pollIntervalMs: 10,
      batchLimit: 20,
      requestTimeoutMs: 1000,
      internalApiStartupGracePeriodMs: 45000,
      confirmationBlocks: 2,
      reconciliationScanIntervalMs: 300000,
      platformAlertReEscalationIntervalMs: 300000,
      rpcUrl: "https://rpc.example.com",
      depositSignerPrivateKey: null
    }),
    internalApiClient: createInternalApiClient({
      async listQueuedDepositIntents() {
        return { intents: [], limit: 20 };
      },
      async listQueuedWithdrawalIntents() {
        return { intents: [], limit: 20 };
      },
      async listBroadcastDepositIntents() {
        return {
          intents: [
            createIntent("deposit_reverted_1", {
              status: "broadcast",
              latestBlockchainTransaction: {
                id: "btx_reverted_deposit_1",
                txHash:
                  "0x9999999999999999999999999999999999999999999999999999999999999999",
                nonce: null,
                serializedTransaction: null,
                status: "broadcast",
                fromAddress: "0x000000000000000000000000000000000000dEaD",
                toAddress: "0x0000000000000000000000000000000000000abc",
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                confirmedAt: null
              }
            })
          ],
          limit: 20
        };
      },
      async listBroadcastWithdrawalIntents() {
        return { intents: [], limit: 20 };
      },
      async listConfirmedDepositIntentsReadyToSettle() {
        return { intents: [], limit: 20 };
      },
      async listConfirmedWithdrawalIntentsReadyToSettle() {
        return { intents: [], limit: 20 };
      },
      async recordDepositBroadcast() {
        throw new Error("not expected");
      },
      async confirmDepositIntent() {
        throw new Error("not expected");
      },
      async settleDepositIntent() {
        throw new Error("not expected");
      },
      async failDepositIntent(intentId: string, payload: { failureCode: string }) {
        operations.push(`failDepositIntent:${intentId}:${payload.failureCode}`);
      },
      async recordWithdrawalBroadcast() {
        throw new Error("not expected");
      },
      async confirmWithdrawalIntent() {
        throw new Error("not expected");
      },
      async settleWithdrawalIntent() {
        throw new Error("not expected");
      },
      async failWithdrawalIntent() {
        throw new Error("not expected");
      },
      async reportWorkerHeartbeat() {
        throw new Error("worker heartbeat reporting is handled outside the orchestrator");
      },
      async triggerLedgerReconciliationScan() {
        throw new Error("reconciliation scan scheduling is handled outside the orchestrator");
      },
      async triggerCriticalAlertReEscalationSweep() {
        throw new Error("platform alert re-escalation is handled outside the orchestrator");
      }
    }) as never,
    rpcClient: {
      async getBlockNumber() {
        return 101n;
      },
      async getTransactionReceipt() {
        return {
          txHash:
            "0x9999999999999999999999999999999999999999999999999999999999999999",
          fromAddress: "0x000000000000000000000000000000000000dEaD",
          toAddress: "0x0000000000000000000000000000000000000abc",
          blockNumber: 100n,
          succeeded: false
        };
      }
    },
    depositBroadcaster: null,
    withdrawalBroadcaster: null,
    policyControlledWithdrawalBroadcaster: null,
    logger: createLogger()
  });

  await orchestrator.runOnce();

  assert.deepEqual(operations, [
    "failDepositIntent:deposit_reverted_1:onchain_reverted"
  ]);
});

test("monitor mode confirms and settles withdrawal intents with enough confirmations", async () => {
  const operations: string[] = [];

  const orchestrator = new WorkerOrchestrator({
    runtime: createRuntime({
      environment: "production",
      workerId: "worker_1",
      internalApiBaseUrl: "https://internal.example.com",
      internalWorkerApiKey: "secret",
      executionMode: "monitor",
      pollIntervalMs: 10,
      batchLimit: 20,
      requestTimeoutMs: 1000,
      internalApiStartupGracePeriodMs: 45000,
      confirmationBlocks: 2,
      reconciliationScanIntervalMs: 300000,
      platformAlertReEscalationIntervalMs: 300000,
      rpcUrl: "https://rpc.example.com",
      depositSignerPrivateKey: null
    }),
    internalApiClient: createInternalApiClient({
      async listQueuedDepositIntents() {
        return { intents: [], limit: 20 };
      },
      async listQueuedWithdrawalIntents() {
        return { intents: [], limit: 20 };
      },
      async listBroadcastDepositIntents() {
        return { intents: [], limit: 20 };
      },
      async listBroadcastWithdrawalIntents() {
        return {
          intents: [
            createIntent("withdrawal_confirmed_2", {
              status: "broadcast",
              latestBlockchainTransaction: {
                id: "btx_confirmed_withdrawal_2",
                txHash:
                  "0xabababababababababababababababababababababababababababababababab",
                nonce: null,
                serializedTransaction: null,
                status: "broadcast",
                fromAddress: "0x0000000000000000000000000000000000000def",
                toAddress: "0x0000000000000000000000000000000000000fed",
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                confirmedAt: null
              }
            })
          ],
          limit: 20
        };
      },
      async listConfirmedDepositIntentsReadyToSettle() {
        return { intents: [], limit: 20 };
      },
      async listConfirmedWithdrawalIntentsReadyToSettle() {
        return { intents: [], limit: 20 };
      },
      async recordDepositBroadcast() {
        throw new Error("not expected");
      },
      async confirmDepositIntent() {
        throw new Error("not expected");
      },
      async settleDepositIntent() {
        throw new Error("not expected");
      },
      async failDepositIntent() {
        throw new Error("not expected");
      },
      async recordWithdrawalBroadcast() {
        throw new Error("not expected");
      },
      async confirmWithdrawalIntent(intentId: string) {
        operations.push(`confirmWithdrawalIntent:${intentId}`);
      },
      async settleWithdrawalIntent(intentId: string) {
        operations.push(`settleWithdrawalIntent:${intentId}`);
      },
      async failWithdrawalIntent() {
        throw new Error("not expected");
      },
      async reportWorkerHeartbeat() {
        throw new Error("worker heartbeat reporting is handled outside the orchestrator");
      },
      async triggerLedgerReconciliationScan() {
        throw new Error("reconciliation scan scheduling is handled outside the orchestrator");
      },
      async triggerCriticalAlertReEscalationSweep() {
        throw new Error("platform alert re-escalation is handled outside the orchestrator");
      }
    }) as never,
    rpcClient: {
      async getBlockNumber() {
        return 101n;
      },
      async getTransactionReceipt() {
        return {
          txHash:
            "0xabababababababababababababababababababababababababababababababab",
          fromAddress: "0x0000000000000000000000000000000000000def",
          toAddress: "0x0000000000000000000000000000000000000fed",
          blockNumber: 100n,
          succeeded: true
        };
      }
    },
    depositBroadcaster: null,
    withdrawalBroadcaster: null,
    policyControlledWithdrawalBroadcaster: null,
    logger: createLogger()
  });

  await orchestrator.runOnce();

  assert.deepEqual(operations, [
    "confirmWithdrawalIntent:withdrawal_confirmed_2",
    "settleWithdrawalIntent:withdrawal_confirmed_2"
  ]);
});

test("monitor mode requires an rpc client once broadcast intents need confirmation checks", async () => {
  const orchestrator = new WorkerOrchestrator({
    runtime: createRuntime({
      environment: "production",
      workerId: "worker_1",
      internalApiBaseUrl: "https://internal.example.com",
      internalWorkerApiKey: "secret",
      executionMode: "monitor",
      pollIntervalMs: 10,
      batchLimit: 20,
      requestTimeoutMs: 1000,
      internalApiStartupGracePeriodMs: 45000,
      confirmationBlocks: 2,
      reconciliationScanIntervalMs: 300000,
      platformAlertReEscalationIntervalMs: 300000,
      rpcUrl: "https://rpc.example.com",
      depositSignerPrivateKey: null
    }),
    internalApiClient: createInternalApiClient({
      async listQueuedDepositIntents() {
        return { intents: [], limit: 20 };
      },
      async listQueuedWithdrawalIntents() {
        return { intents: [], limit: 20 };
      },
      async listBroadcastDepositIntents() {
        return {
          intents: [
            createIntent("deposit_requires_rpc_1", {
              status: "broadcast",
              latestBlockchainTransaction: {
                id: "btx_requires_rpc_1",
                txHash:
                  "0x8888888888888888888888888888888888888888888888888888888888888888",
                nonce: null,
                serializedTransaction: null,
                status: "broadcast",
                fromAddress: "0x000000000000000000000000000000000000dEaD",
                toAddress: "0x0000000000000000000000000000000000000abc",
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                confirmedAt: null
              }
            })
          ],
          limit: 20
        };
      },
      async listBroadcastWithdrawalIntents() {
        return { intents: [], limit: 20 };
      },
      async listConfirmedDepositIntentsReadyToSettle() {
        return { intents: [], limit: 20 };
      },
      async listConfirmedWithdrawalIntentsReadyToSettle() {
        return { intents: [], limit: 20 };
      },
      async recordDepositBroadcast() {
        throw new Error("not expected");
      },
      async confirmDepositIntent() {
        throw new Error("not expected");
      },
      async settleDepositIntent() {
        throw new Error("not expected");
      },
      async failDepositIntent() {
        throw new Error("not expected");
      },
      async recordWithdrawalBroadcast() {
        throw new Error("not expected");
      },
      async confirmWithdrawalIntent() {
        throw new Error("not expected");
      },
      async settleWithdrawalIntent() {
        throw new Error("not expected");
      },
      async failWithdrawalIntent() {
        throw new Error("not expected");
      },
      async reportWorkerHeartbeat() {
        throw new Error("worker heartbeat reporting is handled outside the orchestrator");
      },
      async triggerLedgerReconciliationScan() {
        throw new Error("reconciliation scan scheduling is handled outside the orchestrator");
      },
      async triggerCriticalAlertReEscalationSweep() {
        throw new Error("platform alert re-escalation is handled outside the orchestrator");
      }
    }) as never,
    rpcClient: null,
    depositBroadcaster: null,
    withdrawalBroadcaster: null,
    policyControlledWithdrawalBroadcaster: null,
    logger: createLogger()
  });

  await assert.rejects(() => orchestrator.runOnce(), /RPC client is required/);
});

test("monitor mode logs queued backlog when an external broadcaster is still responsible", async () => {
  const { logger, warnings } = createCapturingLogger();

  const orchestrator = new WorkerOrchestrator({
    runtime: createRuntime({
      environment: "production",
      workerId: "worker_1",
      internalApiBaseUrl: "https://internal.example.com",
      internalWorkerApiKey: "secret",
      executionMode: "monitor",
      pollIntervalMs: 10,
      batchLimit: 20,
      requestTimeoutMs: 1000,
      internalApiStartupGracePeriodMs: 45000,
      confirmationBlocks: 2,
      reconciliationScanIntervalMs: 300000,
      platformAlertReEscalationIntervalMs: 300000,
      rpcUrl: "https://rpc.example.com",
      depositSignerPrivateKey: null
    }),
    internalApiClient: createInternalApiClient({
      async listQueuedDepositIntents() {
        return { intents: [createIntent("deposit_backlog_1")], limit: 20 };
      },
      async listQueuedWithdrawalIntents() {
        return { intents: [createIntent("withdrawal_backlog_1")], limit: 20 };
      },
      async listBroadcastDepositIntents() {
        return { intents: [], limit: 20 };
      },
      async listBroadcastWithdrawalIntents() {
        return { intents: [], limit: 20 };
      },
      async listConfirmedDepositIntentsReadyToSettle() {
        return { intents: [], limit: 20 };
      },
      async listConfirmedWithdrawalIntentsReadyToSettle() {
        return { intents: [], limit: 20 };
      },
      async recordDepositBroadcast() {
        throw new Error("not expected");
      },
      async confirmDepositIntent() {
        throw new Error("not expected");
      },
      async settleDepositIntent() {
        throw new Error("not expected");
      },
      async failDepositIntent() {
        throw new Error("not expected");
      },
      async recordWithdrawalBroadcast() {
        throw new Error("not expected");
      },
      async confirmWithdrawalIntent() {
        throw new Error("not expected");
      },
      async settleWithdrawalIntent() {
        throw new Error("not expected");
      },
      async failWithdrawalIntent() {
        throw new Error("not expected");
      },
      async reportWorkerHeartbeat() {
        throw new Error("worker heartbeat reporting is handled outside the orchestrator");
      },
      async triggerLedgerReconciliationScan() {
        throw new Error("reconciliation scan scheduling is handled outside the orchestrator");
      },
      async triggerCriticalAlertReEscalationSweep() {
        throw new Error("platform alert re-escalation is handled outside the orchestrator");
      }
    }) as never,
    rpcClient: {
      async getBlockNumber() {
        return 100n;
      },
      async getTransactionReceipt() {
        return null;
      }
    },
    depositBroadcaster: null,
    withdrawalBroadcaster: null,
    policyControlledWithdrawalBroadcaster: null,
    logger
  });

  await orchestrator.runOnce();

  assert.equal(warnings.length, 2);
  assert.equal(
    warnings[0]?.event,
    "queued_execution_pending_external_broadcaster"
  );
  assert.equal(
    warnings[1]?.event,
    "queued_execution_pending_external_broadcaster"
  );
});

test("managed mode logs retryable deposit broadcaster failures without marking the intent failed", async () => {
  const operations: string[] = [];
  const { logger, errors } = createCapturingLogger();

  const orchestrator = new WorkerOrchestrator({
    runtime: createRuntime({
      environment: "production",
      workerId: "worker_1",
      internalApiBaseUrl: "https://internal.example.com",
      internalWorkerApiKey: "secret",
      executionMode: "managed",
      pollIntervalMs: 10,
      batchLimit: 20,
      requestTimeoutMs: 1000,
      internalApiStartupGracePeriodMs: 45000,
      confirmationBlocks: 2,
      reconciliationScanIntervalMs: 300000,
      platformAlertReEscalationIntervalMs: 300000,
      rpcUrl: "https://rpc.example.com",
      depositSignerPrivateKey:
        "0x59c6995e998f97a5a0044966f094538c5f6d4e07f16b8ad8cc7658f0f1b0f9d8"
    }),
    internalApiClient: createInternalApiClient({
      async listQueuedDepositIntents() {
        return { intents: [createIntent("deposit_retryable_1")], limit: 20 };
      },
      async listQueuedWithdrawalIntents() {
        return { intents: [], limit: 20 };
      },
      async listBroadcastDepositIntents() {
        return { intents: [], limit: 20 };
      },
      async listBroadcastWithdrawalIntents() {
        return { intents: [], limit: 20 };
      },
      async listConfirmedDepositIntentsReadyToSettle() {
        return { intents: [], limit: 20 };
      },
      async listConfirmedWithdrawalIntentsReadyToSettle() {
        return { intents: [], limit: 20 };
      },
      async recordDepositBroadcast(intentId: string) {
        operations.push(`recordDepositBroadcast:${intentId}`);
      },
      async confirmDepositIntent() {
        throw new Error("not expected");
      },
      async settleDepositIntent() {
        throw new Error("not expected");
      },
      async failDepositIntent(intentId: string) {
        operations.push(`failDepositIntent:${intentId}`);
      },
      async recordWithdrawalBroadcast() {
        throw new Error("not expected");
      },
      async confirmWithdrawalIntent() {
        throw new Error("not expected");
      },
      async settleWithdrawalIntent() {
        throw new Error("not expected");
      },
      async failWithdrawalIntent() {
        throw new Error("not expected");
      },
      async reportWorkerHeartbeat() {
        throw new Error("worker heartbeat reporting is handled outside the orchestrator");
      },
      async triggerLedgerReconciliationScan() {
        throw new Error("reconciliation scan scheduling is handled outside the orchestrator");
      },
      async triggerCriticalAlertReEscalationSweep() {
        throw new Error("platform alert re-escalation is handled outside the orchestrator");
      }
    }) as never,
    rpcClient: {
      async getBlockNumber() {
        return 100n;
      },
      async getTransactionReceipt() {
        return null;
      }
    },
    depositBroadcaster: {
      signerAddress: "0x0000000000000000000000000000000000000aaa",
      async broadcast() {
        throw new Error("rpc down");
      }
    },
    withdrawalBroadcaster: createManagedWithdrawalBroadcaster(),
    policyControlledWithdrawalBroadcaster: null,
    logger
  });

  await orchestrator.runOnce();

  assert.deepEqual(operations, []);
  assert.equal(errors[0]?.event, "managed_deposit_execution_failed_retryable");
});

test("managed mode requires a deposit broadcaster when queued deposits exist", async () => {
  const orchestrator = new WorkerOrchestrator({
    runtime: createRuntime({
      environment: "production",
      workerId: "worker_1",
      internalApiBaseUrl: "https://internal.example.com",
      internalWorkerApiKey: "secret",
      executionMode: "managed",
      pollIntervalMs: 10,
      batchLimit: 20,
      requestTimeoutMs: 1000,
      internalApiStartupGracePeriodMs: 45000,
      confirmationBlocks: 2,
      reconciliationScanIntervalMs: 300000,
      platformAlertReEscalationIntervalMs: 300000,
      rpcUrl: "https://rpc.example.com",
      depositSignerPrivateKey:
        "0x59c6995e998f97a5a0044966f094538c5f6d4e07f16b8ad8cc7658f0f1b0f9d8"
    }),
    internalApiClient: createInternalApiClient({
      async listQueuedDepositIntents() {
        return { intents: [createIntent("deposit_missing_broadcaster_1")], limit: 20 };
      },
      async listQueuedWithdrawalIntents() {
        return { intents: [], limit: 20 };
      },
      async listBroadcastDepositIntents() {
        return { intents: [], limit: 20 };
      },
      async listBroadcastWithdrawalIntents() {
        return { intents: [], limit: 20 };
      },
      async listConfirmedDepositIntentsReadyToSettle() {
        return { intents: [], limit: 20 };
      },
      async listConfirmedWithdrawalIntentsReadyToSettle() {
        return { intents: [], limit: 20 };
      },
      async recordDepositBroadcast() {
        throw new Error("not expected");
      },
      async confirmDepositIntent() {
        throw new Error("not expected");
      },
      async settleDepositIntent() {
        throw new Error("not expected");
      },
      async failDepositIntent() {
        throw new Error("not expected");
      },
      async recordWithdrawalBroadcast() {
        throw new Error("not expected");
      },
      async confirmWithdrawalIntent() {
        throw new Error("not expected");
      },
      async settleWithdrawalIntent() {
        throw new Error("not expected");
      },
      async failWithdrawalIntent() {
        throw new Error("not expected");
      },
      async reportWorkerHeartbeat() {
        throw new Error("worker heartbeat reporting is handled outside the orchestrator");
      },
      async triggerLedgerReconciliationScan() {
        throw new Error("reconciliation scan scheduling is handled outside the orchestrator");
      },
      async triggerCriticalAlertReEscalationSweep() {
        throw new Error("platform alert re-escalation is handled outside the orchestrator");
      }
    }) as never,
    rpcClient: {
      async getBlockNumber() {
        return 100n;
      },
      async getTransactionReceipt() {
        return null;
      }
    },
    depositBroadcaster: null,
    withdrawalBroadcaster: null,
    policyControlledWithdrawalBroadcaster: null,
    logger: createLogger()
  });

  await assert.rejects(
    () => orchestrator.runOnce(),
    /Managed deposit broadcaster is required/
  );
});

test("managed mode skips queued withdrawals when another worker already holds the execution claim", async () => {
  const operations: string[] = [];

  const orchestrator = new WorkerOrchestrator({
    runtime: createRuntime({
      environment: "production",
      workerId: "worker_1",
      internalApiBaseUrl: "https://internal.example.com",
      internalWorkerApiKey: "secret",
      executionMode: "managed",
      pollIntervalMs: 10,
      batchLimit: 20,
      requestTimeoutMs: 1000,
      internalApiStartupGracePeriodMs: 45000,
      confirmationBlocks: 1,
      reconciliationScanIntervalMs: 300000,
      platformAlertReEscalationIntervalMs: 300000,
      rpcUrl: "https://rpc.example.com",
      depositSignerPrivateKey:
        "0x59c6995e998f97a5a0044966f094538c5f6d4e07f16b8ad8cc7658f0f1b0f9d8"
    }),
    internalApiClient: createInternalApiClient({
      async listQueuedDepositIntents() {
        return { intents: [], limit: 20 };
      },
      async listQueuedWithdrawalIntents() {
        return { intents: [createIntent("withdrawal_claimed_elsewhere_1")], limit: 20 };
      },
      async startManagedWithdrawalExecution(intentId: string) {
        operations.push(`startManagedWithdrawalExecution:${intentId}`);
        return {
          intent: createIntent(intentId),
          executionClaimed: false,
          executionReused: false
        };
      },
      async recordSignedWithdrawalExecution() {
        throw new Error("not expected");
      },
      async listBroadcastDepositIntents() {
        return { intents: [], limit: 20 };
      },
      async listBroadcastWithdrawalIntents() {
        return { intents: [], limit: 20 };
      },
      async listConfirmedDepositIntentsReadyToSettle() {
        return { intents: [], limit: 20 };
      },
      async listConfirmedWithdrawalIntentsReadyToSettle() {
        return { intents: [], limit: 20 };
      },
      async recordDepositBroadcast() {
        throw new Error("not expected");
      },
      async confirmDepositIntent() {
        throw new Error("not expected");
      },
      async settleDepositIntent() {
        throw new Error("not expected");
      },
      async failDepositIntent() {
        throw new Error("not expected");
      },
      async recordWithdrawalBroadcast() {
        throw new Error("not expected");
      },
      async confirmWithdrawalIntent() {
        throw new Error("not expected");
      },
      async settleWithdrawalIntent() {
        throw new Error("not expected");
      },
      async failWithdrawalIntent() {
        throw new Error("not expected");
      },
      async reportWorkerHeartbeat() {
        throw new Error("worker heartbeat reporting is handled outside the orchestrator");
      },
      async triggerLedgerReconciliationScan() {
        throw new Error("reconciliation scan scheduling is handled outside the orchestrator");
      },
      async triggerCriticalAlertReEscalationSweep() {
        throw new Error("platform alert re-escalation is handled outside the orchestrator");
      }
    }) as never,
    rpcClient: {
      async getBlockNumber() {
        return 100n;
      },
      async getTransactionReceipt() {
        return null;
      }
    },
    depositBroadcaster: {
      signerAddress: "0x0000000000000000000000000000000000000aaa",
      async broadcast() {
        throw new Error("not expected");
      }
    },
    withdrawalBroadcaster: createManagedWithdrawalBroadcaster({
      canManageWallet() {
        return true;
      },
      async prepare() {
        throw new Error("not expected");
      }
    }),
    policyControlledWithdrawalBroadcaster: null,
    logger: createLogger()
  });

  await orchestrator.runOnce();

  assert.deepEqual(operations, [
    "startManagedWithdrawalExecution:withdrawal_claimed_elsewhere_1"
  ]);
});

test("managed mode fails queued withdrawals with incomplete durable signed state", async () => {
  const operations: string[] = [];

  const orchestrator = new WorkerOrchestrator({
    runtime: createRuntime({
      environment: "production",
      workerId: "worker_1",
      internalApiBaseUrl: "https://internal.example.com",
      internalWorkerApiKey: "secret",
      executionMode: "managed",
      pollIntervalMs: 10,
      batchLimit: 20,
      requestTimeoutMs: 1000,
      internalApiStartupGracePeriodMs: 45000,
      confirmationBlocks: 1,
      reconciliationScanIntervalMs: 300000,
      platformAlertReEscalationIntervalMs: 300000,
      rpcUrl: "https://rpc.example.com",
      depositSignerPrivateKey:
        "0x59c6995e998f97a5a0044966f094538c5f6d4e07f16b8ad8cc7658f0f1b0f9d8"
    }),
    internalApiClient: createInternalApiClient({
      async listQueuedDepositIntents() {
        return { intents: [], limit: 20 };
      },
      async listQueuedWithdrawalIntents() {
        return {
          intents: [
            createIntent("withdrawal_invalid_signed_queued_1", {
              latestBlockchainTransaction: {
                id: "withdrawal_tx_invalid_signed_queued_1",
                txHash:
                  "0x9999999999999999999999999999999999999999999999999999999999999999",
                nonce: 7,
                serializedTransaction: null,
                status: "signed",
                fromAddress: "0x0000000000000000000000000000000000000def",
                toAddress: "0x0000000000000000000000000000000000000fed",
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                confirmedAt: null
              }
            })
          ],
          limit: 20
        };
      },
      async startManagedWithdrawalExecution() {
        throw new Error("not expected");
      },
      async recordSignedWithdrawalExecution() {
        throw new Error("not expected");
      },
      async listBroadcastDepositIntents() {
        return { intents: [], limit: 20 };
      },
      async listBroadcastWithdrawalIntents() {
        return { intents: [], limit: 20 };
      },
      async listConfirmedDepositIntentsReadyToSettle() {
        return { intents: [], limit: 20 };
      },
      async listConfirmedWithdrawalIntentsReadyToSettle() {
        return { intents: [], limit: 20 };
      },
      async recordDepositBroadcast() {
        throw new Error("not expected");
      },
      async confirmDepositIntent() {
        throw new Error("not expected");
      },
      async settleDepositIntent() {
        throw new Error("not expected");
      },
      async failDepositIntent() {
        throw new Error("not expected");
      },
      async recordWithdrawalBroadcast() {
        throw new Error("not expected");
      },
      async confirmWithdrawalIntent() {
        throw new Error("not expected");
      },
      async settleWithdrawalIntent() {
        throw new Error("not expected");
      },
      async failWithdrawalIntent(intentId: string, payload: { failureCode: string }) {
        operations.push(`failWithdrawalIntent:${intentId}:${payload.failureCode}`);
      },
      async reportWorkerHeartbeat() {
        throw new Error("worker heartbeat reporting is handled outside the orchestrator");
      },
      async triggerLedgerReconciliationScan() {
        throw new Error("reconciliation scan scheduling is handled outside the orchestrator");
      },
      async triggerCriticalAlertReEscalationSweep() {
        throw new Error("platform alert re-escalation is handled outside the orchestrator");
      }
    }) as never,
    rpcClient: {
      async getBlockNumber() {
        return 100n;
      },
      async getTransactionReceipt() {
        return null;
      }
    },
    depositBroadcaster: {
      signerAddress: "0x0000000000000000000000000000000000000aaa",
      async broadcast() {
        throw new Error("not expected");
      }
    },
    withdrawalBroadcaster: createManagedWithdrawalBroadcaster({
      canManageWallet() {
        return true;
      },
      async prepare() {
        throw new Error("not expected");
      }
    }),
    policyControlledWithdrawalBroadcaster: null,
    logger: createLogger()
  });

  await orchestrator.runOnce();

  assert.deepEqual(operations, [
    "failWithdrawalIntent:withdrawal_invalid_signed_queued_1:managed_signed_withdrawal_state_invalid"
  ]);
});

test("managed mode fails claimed withdrawals with incomplete durable signed state", async () => {
  const operations: string[] = [];

  const orchestrator = new WorkerOrchestrator({
    runtime: createRuntime({
      environment: "production",
      workerId: "worker_1",
      internalApiBaseUrl: "https://internal.example.com",
      internalWorkerApiKey: "secret",
      executionMode: "managed",
      pollIntervalMs: 10,
      batchLimit: 20,
      requestTimeoutMs: 1000,
      internalApiStartupGracePeriodMs: 45000,
      confirmationBlocks: 1,
      reconciliationScanIntervalMs: 300000,
      platformAlertReEscalationIntervalMs: 300000,
      rpcUrl: "https://rpc.example.com",
      depositSignerPrivateKey:
        "0x59c6995e998f97a5a0044966f094538c5f6d4e07f16b8ad8cc7658f0f1b0f9d8"
    }),
    internalApiClient: createInternalApiClient({
      async listQueuedDepositIntents() {
        return { intents: [], limit: 20 };
      },
      async listQueuedWithdrawalIntents() {
        return { intents: [createIntent("withdrawal_invalid_signed_claimed_1")], limit: 20 };
      },
      async startManagedWithdrawalExecution(intentId: string) {
        return {
          intent: createIntent(intentId, {
            latestBlockchainTransaction: {
              id: "withdrawal_tx_invalid_signed_claimed_1",
              txHash:
                "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
              nonce: 9,
              serializedTransaction: null,
              status: "signed",
              fromAddress: "0x0000000000000000000000000000000000000def",
              toAddress: "0x0000000000000000000000000000000000000fed",
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              confirmedAt: null
            }
          }),
          executionClaimed: true,
          executionReused: false
        };
      },
      async recordSignedWithdrawalExecution() {
        throw new Error("not expected");
      },
      async listBroadcastDepositIntents() {
        return { intents: [], limit: 20 };
      },
      async listBroadcastWithdrawalIntents() {
        return { intents: [], limit: 20 };
      },
      async listConfirmedDepositIntentsReadyToSettle() {
        return { intents: [], limit: 20 };
      },
      async listConfirmedWithdrawalIntentsReadyToSettle() {
        return { intents: [], limit: 20 };
      },
      async recordDepositBroadcast() {
        throw new Error("not expected");
      },
      async confirmDepositIntent() {
        throw new Error("not expected");
      },
      async settleDepositIntent() {
        throw new Error("not expected");
      },
      async failDepositIntent() {
        throw new Error("not expected");
      },
      async recordWithdrawalBroadcast() {
        throw new Error("not expected");
      },
      async confirmWithdrawalIntent() {
        throw new Error("not expected");
      },
      async settleWithdrawalIntent() {
        throw new Error("not expected");
      },
      async failWithdrawalIntent(intentId: string, payload: { failureCode: string }) {
        operations.push(`failWithdrawalIntent:${intentId}:${payload.failureCode}`);
      },
      async reportWorkerHeartbeat() {
        throw new Error("worker heartbeat reporting is handled outside the orchestrator");
      },
      async triggerLedgerReconciliationScan() {
        throw new Error("reconciliation scan scheduling is handled outside the orchestrator");
      },
      async triggerCriticalAlertReEscalationSweep() {
        throw new Error("platform alert re-escalation is handled outside the orchestrator");
      }
    }) as never,
    rpcClient: {
      async getBlockNumber() {
        return 100n;
      },
      async getTransactionReceipt() {
        return null;
      }
    },
    depositBroadcaster: {
      signerAddress: "0x0000000000000000000000000000000000000aaa",
      async broadcast() {
        throw new Error("not expected");
      }
    },
    withdrawalBroadcaster: createManagedWithdrawalBroadcaster({
      canManageWallet() {
        return true;
      },
      async prepare() {
        throw new Error("not expected");
      }
    }),
    policyControlledWithdrawalBroadcaster: null,
    logger: createLogger()
  });

  await orchestrator.runOnce();

  assert.deepEqual(operations, [
    "failWithdrawalIntent:withdrawal_invalid_signed_claimed_1:managed_signed_withdrawal_state_invalid"
  ]);
});

test("managed mode routes policy-controlled manual failures into the intervention backlog", async () => {
  const { logger, warnings } = createCapturingLogger();

  const orchestrator = new WorkerOrchestrator({
    runtime: createRuntime({
      environment: "production",
      workerId: "worker_1",
      internalApiBaseUrl: "https://internal.example.com",
      internalWorkerApiKey: "secret",
      executionMode: "managed",
      pollIntervalMs: 10,
      batchLimit: 20,
      requestTimeoutMs: 1000,
      internalApiStartupGracePeriodMs: 45000,
      confirmationBlocks: 1,
      reconciliationScanIntervalMs: 300000,
      platformAlertReEscalationIntervalMs: 300000,
      rpcUrl: "https://rpc.example.com",
      depositSignerPrivateKey:
        "0x59c6995e998f97a5a0044966f094538c5f6d4e07f16b8ad8cc7658f0f1b0f9d8"
    }),
    internalApiClient: createInternalApiClient({
      async listQueuedDepositIntents() {
        return { intents: [], limit: 20 };
      },
      async listQueuedWithdrawalIntents() {
        return {
          intents: [
            createIntent("withdrawal_policy_manual_1", {
              sourceWalletCustodyType: "contract_controlled"
            })
          ],
          limit: 20
        };
      },
      async startManagedWithdrawalExecution(intentId: string) {
        return {
          intent: createIntent(intentId, {
            sourceWalletCustodyType: "contract_controlled"
          }),
          executionClaimed: true,
          executionReused: false
        };
      },
      async recordSignedWithdrawalExecution() {
        throw new Error("not expected");
      },
      async listBroadcastDepositIntents() {
        return { intents: [], limit: 20 };
      },
      async listBroadcastWithdrawalIntents() {
        return { intents: [], limit: 20 };
      },
      async listConfirmedDepositIntentsReadyToSettle() {
        return { intents: [], limit: 20 };
      },
      async listConfirmedWithdrawalIntentsReadyToSettle() {
        return { intents: [], limit: 20 };
      },
      async recordDepositBroadcast() {
        throw new Error("not expected");
      },
      async confirmDepositIntent() {
        throw new Error("not expected");
      },
      async settleDepositIntent() {
        throw new Error("not expected");
      },
      async failDepositIntent() {
        throw new Error("not expected");
      },
      async recordWithdrawalBroadcast() {
        throw new Error("not expected");
      },
      async confirmWithdrawalIntent() {
        throw new Error("not expected");
      },
      async settleWithdrawalIntent() {
        throw new Error("not expected");
      },
      async failWithdrawalIntent(intentId: string, payload: {
        failureCode: string;
        failureCategory?: string;
      }) {
        warnings.push({
          event: "manual_intervention_recorded",
          metadata: {
            intentId,
            failureCode: payload.failureCode,
            failureCategory: payload.failureCategory
          }
        });
      },
      async reportWorkerHeartbeat() {
        throw new Error("worker heartbeat reporting is handled outside the orchestrator");
      },
      async triggerLedgerReconciliationScan() {
        throw new Error("reconciliation scan scheduling is handled outside the orchestrator");
      },
      async triggerCriticalAlertReEscalationSweep() {
        throw new Error("platform alert re-escalation is handled outside the orchestrator");
      }
    }) as never,
    rpcClient: {
      async getBlockNumber() {
        return 100n;
      },
      async getTransactionReceipt() {
        return null;
      }
    },
    depositBroadcaster: {
      signerAddress: "0x0000000000000000000000000000000000000aaa",
      async broadcast() {
        throw new Error("not expected");
      }
    },
    withdrawalBroadcaster: createManagedWithdrawalBroadcaster(),
    policyControlledWithdrawalBroadcaster: createPolicyControlledWithdrawalBroadcaster({
      async prepare() {
        throw new ManagedExecutionIntentError({
          failureCode: "policy_controlled_wallet_executor_mismatch",
          failureReason: "Configured executor is not authorized by the wallet."
        });
      }
    }),
    logger
  });

  await orchestrator.runOnce();

  assert.equal(warnings.length, 1);
  assert.equal(warnings[0]?.event, "manual_intervention_recorded");
  assert.equal(
    warnings[0]?.metadata.failureCode,
    "policy_controlled_wallet_executor_mismatch"
  );
});

test("managed mode logs retryable withdrawal execution failures without failing the intent", async () => {
  const { logger, errors } = createCapturingLogger();

  const orchestrator = new WorkerOrchestrator({
    runtime: createRuntime({
      environment: "production",
      workerId: "worker_1",
      internalApiBaseUrl: "https://internal.example.com",
      internalWorkerApiKey: "secret",
      executionMode: "managed",
      pollIntervalMs: 10,
      batchLimit: 20,
      requestTimeoutMs: 1000,
      internalApiStartupGracePeriodMs: 45000,
      confirmationBlocks: 1,
      reconciliationScanIntervalMs: 300000,
      platformAlertReEscalationIntervalMs: 300000,
      rpcUrl: "https://rpc.example.com",
      depositSignerPrivateKey:
        "0x59c6995e998f97a5a0044966f094538c5f6d4e07f16b8ad8cc7658f0f1b0f9d8"
    }),
    internalApiClient: createInternalApiClient({
      async listQueuedDepositIntents() {
        return { intents: [], limit: 20 };
      },
      async listQueuedWithdrawalIntents() {
        return { intents: [createIntent("withdrawal_retryable_1")], limit: 20 };
      },
      async startManagedWithdrawalExecution(intentId: string) {
        return {
          intent: createIntent(intentId),
          executionClaimed: true,
          executionReused: false
        };
      },
      async recordSignedWithdrawalExecution() {
        throw new Error("not expected");
      },
      async listBroadcastDepositIntents() {
        return { intents: [], limit: 20 };
      },
      async listBroadcastWithdrawalIntents() {
        return { intents: [], limit: 20 };
      },
      async listConfirmedDepositIntentsReadyToSettle() {
        return { intents: [], limit: 20 };
      },
      async listConfirmedWithdrawalIntentsReadyToSettle() {
        return { intents: [], limit: 20 };
      },
      async recordDepositBroadcast() {
        throw new Error("not expected");
      },
      async confirmDepositIntent() {
        throw new Error("not expected");
      },
      async settleDepositIntent() {
        throw new Error("not expected");
      },
      async failDepositIntent() {
        throw new Error("not expected");
      },
      async recordWithdrawalBroadcast() {
        throw new Error("not expected");
      },
      async confirmWithdrawalIntent() {
        throw new Error("not expected");
      },
      async settleWithdrawalIntent() {
        throw new Error("not expected");
      },
      async failWithdrawalIntent(intentId: string, payload: {
        failureCode: string;
        failureCategory?: string;
      }) {
        errors.push({
          event: "retryable_failure_recorded",
          metadata: {
            intentId,
            failureCode: payload.failureCode,
            failureCategory: payload.failureCategory
          }
        });
      },
      async reportWorkerHeartbeat() {
        throw new Error("worker heartbeat reporting is handled outside the orchestrator");
      },
      async triggerLedgerReconciliationScan() {
        throw new Error("reconciliation scan scheduling is handled outside the orchestrator");
      },
      async triggerCriticalAlertReEscalationSweep() {
        throw new Error("platform alert re-escalation is handled outside the orchestrator");
      }
    }) as never,
    rpcClient: {
      async getBlockNumber() {
        return 100n;
      },
      async getTransactionReceipt() {
        return null;
      }
    },
    depositBroadcaster: {
      signerAddress: "0x0000000000000000000000000000000000000aaa",
      async broadcast() {
        throw new Error("not expected");
      }
    },
    withdrawalBroadcaster: createManagedWithdrawalBroadcaster({
      canManageWallet() {
        return true;
      },
      async prepare() {
        throw new Error("rpc down");
      }
    }),
    policyControlledWithdrawalBroadcaster: null,
    logger
  });

  await orchestrator.runOnce();

  assert.equal(errors.length, 2);
  assert.equal(
    errors[0]?.event,
    "managed_withdrawal_execution_failed_retryable"
  );
  assert.equal(errors[1]?.event, "retryable_failure_recorded");
});

test("monitor mode logs pending confirmation when a withdrawal receipt is still unavailable", async () => {
  const { logger, infos } = createCapturingLogger();

  const orchestrator = new WorkerOrchestrator({
    runtime: createRuntime({
      environment: "production",
      workerId: "worker_1",
      internalApiBaseUrl: "https://internal.example.com",
      internalWorkerApiKey: "secret",
      executionMode: "monitor",
      pollIntervalMs: 10,
      batchLimit: 20,
      requestTimeoutMs: 1000,
      internalApiStartupGracePeriodMs: 45000,
      confirmationBlocks: 2,
      reconciliationScanIntervalMs: 300000,
      platformAlertReEscalationIntervalMs: 300000,
      rpcUrl: "https://rpc.example.com",
      depositSignerPrivateKey: null
    }),
    internalApiClient: createInternalApiClient({
      async listQueuedDepositIntents() {
        return { intents: [], limit: 20 };
      },
      async listQueuedWithdrawalIntents() {
        return { intents: [], limit: 20 };
      },
      async listBroadcastDepositIntents() {
        return { intents: [], limit: 20 };
      },
      async listBroadcastWithdrawalIntents() {
        return {
          intents: [
            createIntent("withdrawal_pending_confirmation_1", {
              status: "broadcast",
              latestBlockchainTransaction: {
                id: "withdrawal_tx_pending_confirmation_1",
                txHash:
                  "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
                nonce: 4,
                serializedTransaction: "0xfeed",
                status: "broadcast",
                fromAddress: "0x0000000000000000000000000000000000000def",
                toAddress: "0x0000000000000000000000000000000000000fed",
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                confirmedAt: null
              }
            })
          ],
          limit: 20
        };
      },
      async listConfirmedDepositIntentsReadyToSettle() {
        return { intents: [], limit: 20 };
      },
      async listConfirmedWithdrawalIntentsReadyToSettle() {
        return { intents: [], limit: 20 };
      },
      async recordDepositBroadcast() {
        throw new Error("not expected");
      },
      async confirmDepositIntent() {
        throw new Error("not expected");
      },
      async settleDepositIntent() {
        throw new Error("not expected");
      },
      async failDepositIntent() {
        throw new Error("not expected");
      },
      async recordWithdrawalBroadcast() {
        throw new Error("not expected");
      },
      async confirmWithdrawalIntent() {
        throw new Error("not expected");
      },
      async settleWithdrawalIntent() {
        throw new Error("not expected");
      },
      async failWithdrawalIntent() {
        throw new Error("not expected");
      },
      async reportWorkerHeartbeat() {
        throw new Error("worker heartbeat reporting is handled outside the orchestrator");
      },
      async triggerLedgerReconciliationScan() {
        throw new Error("reconciliation scan scheduling is handled outside the orchestrator");
      },
      async triggerCriticalAlertReEscalationSweep() {
        throw new Error("platform alert re-escalation is handled outside the orchestrator");
      }
    }) as never,
    rpcClient: {
      async getBlockNumber() {
        return 100n;
      },
      async getTransactionReceipt() {
        return null;
      }
    },
    depositBroadcaster: null,
    withdrawalBroadcaster: null,
    policyControlledWithdrawalBroadcaster: null,
    logger
  });

  await orchestrator.runOnce();

  assert.ok(
    infos.some(
      (entry) => entry.event === "broadcast_intent_pending_confirmation"
    )
  );
});
