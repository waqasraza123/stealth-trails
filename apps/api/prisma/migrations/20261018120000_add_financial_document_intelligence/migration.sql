CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE "FinancialDocument" (
  "id" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "sizeBytes" INTEGER NOT NULL,
  "sha256" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'uploaded',
  "pageCount" INTEGER NOT NULL DEFAULT 0,
  "chunkCount" INTEGER NOT NULL DEFAULT 0,
  "embeddingModel" TEXT,
  "errorCode" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FinancialDocument_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "FinancialDocument_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "FinancialDocumentFile" (
  "documentId" TEXT NOT NULL,
  "content" BYTEA NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FinancialDocumentFile_pkey" PRIMARY KEY ("documentId"),
  CONSTRAINT "FinancialDocumentFile_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "FinancialDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "FinancialDocumentPage" (
  "id" TEXT NOT NULL,
  "documentId" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "pageNumber" INTEGER NOT NULL,
  "content" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FinancialDocumentPage_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "FinancialDocumentPage_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "FinancialDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "FinancialDocumentChunk" (
  "id" TEXT NOT NULL,
  "documentId" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "pageNumber" INTEGER NOT NULL,
  "chunkIndex" INTEGER NOT NULL,
  "content" TEXT NOT NULL,
  "tokenEstimate" INTEGER NOT NULL,
  "embeddingModel" TEXT,
  "embeddingDimensions" INTEGER,
  "embedding" vector(1536),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FinancialDocumentChunk_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "FinancialDocumentChunk_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "FinancialDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "FinancialDocumentChunk_embedding_dimensions_check" CHECK ("embedding" IS NULL OR vector_dims("embedding") = 1536)
);

CREATE TABLE "FinancialDocumentTrace" (
  "id" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "documentId" TEXT,
  "operation" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "durationMs" INTEGER NOT NULL,
  "chunkCount" INTEGER,
  "provider" TEXT,
  "model" TEXT,
  "failureCode" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FinancialDocumentTrace_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "FinancialDocumentTrace_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "FinancialDocumentTrace_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "FinancialDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "FinancialDocument_customerId_createdAt_idx" ON "FinancialDocument"("customerId", "createdAt");
CREATE INDEX "FinancialDocument_customerId_status_idx" ON "FinancialDocument"("customerId", "status");
CREATE UNIQUE INDEX "FinancialDocument_customerId_sha256_key" ON "FinancialDocument"("customerId", "sha256");
CREATE UNIQUE INDEX "FinancialDocumentPage_documentId_pageNumber_key" ON "FinancialDocumentPage"("documentId", "pageNumber");
CREATE INDEX "FinancialDocumentPage_customerId_documentId_pageNumber_idx" ON "FinancialDocumentPage"("customerId", "documentId", "pageNumber");
CREATE UNIQUE INDEX "FinancialDocumentChunk_documentId_chunkIndex_key" ON "FinancialDocumentChunk"("documentId", "chunkIndex");
CREATE INDEX "FinancialDocumentChunk_customerId_documentId_pageNumber_idx" ON "FinancialDocumentChunk"("customerId", "documentId", "pageNumber");
CREATE INDEX "FinancialDocumentChunk_embedding_hnsw_idx" ON "FinancialDocumentChunk" USING hnsw ("embedding" vector_cosine_ops) WHERE "embedding" IS NOT NULL;
CREATE INDEX "FinancialDocumentTrace_customerId_createdAt_idx" ON "FinancialDocumentTrace"("customerId", "createdAt");
CREATE INDEX "FinancialDocumentTrace_customerId_operation_status_idx" ON "FinancialDocumentTrace"("customerId", "operation", "status");
