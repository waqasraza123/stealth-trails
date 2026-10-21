CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE "AiFinancialMemoryProfile" (
  "id" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "preferredCurrencies" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "financialGoals" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "researchInterests" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "investmentHorizon" TEXT,
  "riskPreference" TEXT,
  "ethicalPreferences" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "shariahScreening" BOOLEAN,
  "personalizationEnabled" BOOLEAN NOT NULL DEFAULT false,
  "memorySavingEnabled" BOOLEAN NOT NULL DEFAULT false,
  "externalAiConsent" BOOLEAN NOT NULL DEFAULT false,
  "allowedAgentIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "retentionDays" INTEGER NOT NULL DEFAULT 365,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "AiFinancialMemoryProfile_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AiFinancialMemoryProfile_retentionDays_check" CHECK ("retentionDays" BETWEEN 1 AND 3650)
);

CREATE TABLE "AiFinancialMemory" (
  "id" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "contentHash" TEXT NOT NULL,
  "sourceType" TEXT NOT NULL,
  "verificationStatus" TEXT NOT NULL,
  "authorizedAgentIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "embeddingModel" TEXT,
  "embeddingDimensions" INTEGER,
  "embedding" vector(1536),
  "expiresAt" TIMESTAMP(3),
  "deletedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "AiFinancialMemory_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AiFinancialMemory_category_check" CHECK ("category" IN ('preference', 'goal', 'research_interest', 'investment_horizon', 'risk_preference', 'ethical_screening', 'research_context')),
  CONSTRAINT "AiFinancialMemory_sourceType_check" CHECK ("sourceType" IN ('customer_dashboard', 'copilot_explicit')),
  CONSTRAINT "AiFinancialMemory_verificationStatus_check" CHECK ("verificationStatus" IN ('customer_provided', 'customer_confirmed', 'ai_interpretation')),
  CONSTRAINT "AiFinancialMemory_embedding_dimensions_check" CHECK ("embedding" IS NULL OR vector_dims("embedding") = 1536)
);

CREATE UNIQUE INDEX "AiFinancialMemoryProfile_customerId_key" ON "AiFinancialMemoryProfile"("customerId");
CREATE UNIQUE INDEX "AiFinancialMemory_customerId_contentHash_key" ON "AiFinancialMemory"("customerId", "contentHash");
CREATE INDEX "AiFinancialMemory_customerId_category_deletedAt_updatedAt_idx" ON "AiFinancialMemory"("customerId", "category", "deletedAt", "updatedAt");
CREATE INDEX "AiFinancialMemory_customerId_expiresAt_idx" ON "AiFinancialMemory"("customerId", "expiresAt");
CREATE INDEX "AiFinancialMemory_embedding_hnsw_idx" ON "AiFinancialMemory" USING hnsw ("embedding" vector_cosine_ops) WHERE "embedding" IS NOT NULL AND "deletedAt" IS NULL;

ALTER TABLE "AiFinancialMemoryProfile" ADD CONSTRAINT "AiFinancialMemoryProfile_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AiFinancialMemory" ADD CONSTRAINT "AiFinancialMemory_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
