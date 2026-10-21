CREATE TABLE "AiWorkflow" (
  "id" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "externalAiConsent" BOOLEAN NOT NULL DEFAULT false,
  "definition" JSONB NOT NULL,
  "triggerType" TEXT NOT NULL,
  "intervalMinutes" INTEGER,
  "nextRunAt" TIMESTAMP(3),
  "lastDataChangeAt" TIMESTAMP(3),
  "maxConcurrentRuns" INTEGER NOT NULL DEFAULT 1,
  "timeoutSeconds" INTEGER NOT NULL DEFAULT 30,
  "retryLimit" INTEGER NOT NULL DEFAULT 2,
  "revision" INTEGER NOT NULL DEFAULT 1,
  "deletedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "AiWorkflow_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AiWorkflowRun" (
  "id" TEXT NOT NULL,
  "workflowId" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "workflowRevision" INTEGER NOT NULL,
  "definitionSnapshot" JSONB NOT NULL,
  "triggerType" TEXT NOT NULL,
  "triggerKey" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'queued',
  "currentNodeId" TEXT,
  "input" JSONB,
  "output" JSONB,
  "errorCode" TEXT,
  "errorMessage" TEXT,
  "attempt" INTEGER NOT NULL DEFAULT 0,
  "maxAttempts" INTEGER NOT NULL DEFAULT 3,
  "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "claimedByWorkerId" TEXT,
  "claimedAt" TIMESTAMP(3),
  "leaseExpiresAt" TIMESTAMP(3),
  "approvalRequestedAt" TIMESTAMP(3),
  "approvalPrompt" TEXT,
  "approvedAt" TIMESTAMP(3),
  "approvedByActorId" TEXT,
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "AiWorkflowRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AiWorkflowRunStep" (
  "id" TEXT NOT NULL,
  "runId" TEXT NOT NULL,
  "workflowId" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "nodeId" TEXT NOT NULL,
  "nodeType" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "attempt" INTEGER NOT NULL,
  "input" JSONB,
  "output" JSONB,
  "errorCode" TEXT,
  "errorMessage" TEXT,
  "durationMs" INTEGER,
  "startedAt" TIMESTAMP(3) NOT NULL,
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "AiWorkflowRunStep_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AiWorkflow_customerId_deletedAt_updatedAt_idx" ON "AiWorkflow"("customerId", "deletedAt", "updatedAt");
CREATE INDEX "AiWorkflow_enabled_triggerType_nextRunAt_idx" ON "AiWorkflow"("enabled", "triggerType", "nextRunAt");
CREATE UNIQUE INDEX "AiWorkflowRun_workflowId_triggerKey_key" ON "AiWorkflowRun"("workflowId", "triggerKey");
CREATE INDEX "AiWorkflowRun_customerId_createdAt_idx" ON "AiWorkflowRun"("customerId", "createdAt");
CREATE INDEX "AiWorkflowRun_workflowId_status_createdAt_idx" ON "AiWorkflowRun"("workflowId", "status", "createdAt");
CREATE INDEX "AiWorkflowRun_status_availableAt_leaseExpiresAt_idx" ON "AiWorkflowRun"("status", "availableAt", "leaseExpiresAt");
CREATE INDEX "AiWorkflowRunStep_runId_createdAt_idx" ON "AiWorkflowRunStep"("runId", "createdAt");
CREATE INDEX "AiWorkflowRunStep_workflowId_createdAt_idx" ON "AiWorkflowRunStep"("workflowId", "createdAt");
CREATE INDEX "AiWorkflowRunStep_customerId_createdAt_idx" ON "AiWorkflowRunStep"("customerId", "createdAt");

ALTER TABLE "AiWorkflow" ADD CONSTRAINT "AiWorkflow_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AiWorkflowRun" ADD CONSTRAINT "AiWorkflowRun_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "AiWorkflow"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AiWorkflowRun" ADD CONSTRAINT "AiWorkflowRun_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AiWorkflowRunStep" ADD CONSTRAINT "AiWorkflowRunStep_runId_fkey" FOREIGN KEY ("runId") REFERENCES "AiWorkflowRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AiWorkflowRunStep" ADD CONSTRAINT "AiWorkflowRunStep_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "AiWorkflow"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AiWorkflowRunStep" ADD CONSTRAINT "AiWorkflowRunStep_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
