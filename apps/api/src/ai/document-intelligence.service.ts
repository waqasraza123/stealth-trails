import { createHash, randomUUID } from "node:crypto";
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  HttpException,
  HttpStatus,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import {
  DOCUMENT_INTELLIGENCE_PROVIDER,
  type DocumentIntelligenceProvider,
} from "./document-intelligence.provider";
import {
  chunkDocumentPages,
  DocumentTextExtractor,
} from "./document-text-extractor";
import type {
  DocumentChatResult,
  DocumentComparison,
  DocumentDetail,
  DocumentIntelligence,
  DocumentLibrary,
  DocumentPassage,
  FinancialDocumentSummary,
  IntelligenceFinding,
} from "./document-intelligence.types";

function boundedInteger(name: string, fallback: number, maximum: number): number {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isInteger(value) || value <= 0 || value > maximum) {
    throw new Error(`${name} must be a positive integer no greater than ${maximum}.`);
  }
  return value;
}

const MAX_FILE_BYTES = boundedInteger("DOCUMENT_MAX_FILE_BYTES", 10 * 1024 * 1024, 20 * 1024 * 1024);
const MAX_STORAGE_BYTES = boundedInteger("DOCUMENT_MAX_STORAGE_BYTES_PER_CUSTOMER", 50 * 1024 * 1024, 250 * 1024 * 1024);
const MAX_PAGES = boundedInteger("DOCUMENT_MAX_PAGES", 250, 500);
const MAX_CHUNKS = boundedInteger("DOCUMENT_MAX_CHUNKS", 1_000, 2_000);
const MAX_RESULTS = boundedInteger("DOCUMENT_MAX_RETRIEVAL_RESULTS", 8, 12);
const DISCLAIMER = "Evidence-based document research only—not financial advice, a promise of returns, religious certification, or a substitute for professional review.";

type UploadedFile = { originalname: string; mimetype: string; size: number; buffer: Buffer };
type DocumentRow = {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  status: FinancialDocumentSummary["status"];
  pageCount: number;
  chunkCount: number;
  embeddingModel: string | null;
  errorCode: string | null;
  createdAt: Date;
  updatedAt: Date;
};
type PassageRow = {
  chunkId: string;
  documentId: string;
  fileName: string;
  pageNumber: number;
  content: string;
  similarity: number;
};

function summary(row: DocumentRow): FinancialDocumentSummary {
  return { ...row, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() };
}

function safeFileName(value: string): string {
  const name = value.replace(/\\/gu, "/").split("/").pop()?.replace(/[\u0000-\u001f\u007f\[\]]/gu, "").trim();
  if (!name) throw new BadRequestException("A valid file name is required.");
  return name.slice(0, 180);
}

function failureCode(error: unknown): string {
  if (error instanceof BadRequestException) return "invalid_document";
  if (error instanceof Error && /^[a-z0-9_]+$/u.test(error.message)) return error.message.slice(0, 80);
  return "processing_failed";
}

@Injectable()
export class DocumentIntelligenceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly extractor: DocumentTextExtractor,
    @Inject(DOCUMENT_INTELLIGENCE_PROVIDER) private readonly provider: DocumentIntelligenceProvider,
  ) {}

  capabilities() {
    return this.provider.capabilities(MAX_FILE_BYTES, MAX_STORAGE_BYTES);
  }

  async library(supabaseUserId: string, query?: string): Promise<DocumentLibrary> {
    const customerId = await this.customerId(supabaseUserId);
    const pattern = query?.trim() ? `%${query.trim().replace(/[\\%_]/gu, "\\$&")}%` : null;
    const documents = await this.prisma.$queryRaw<DocumentRow[]>(Prisma.sql`
      SELECT "id", "fileName", "mimeType", "sizeBytes", "status", "pageCount", "chunkCount", "embeddingModel", "errorCode", "createdAt", "updatedAt"
      FROM "FinancialDocument"
      WHERE "customerId" = ${customerId}
        AND (${pattern}::text IS NULL OR "fileName" ILIKE ${pattern} ESCAPE '\\')
      ORDER BY "createdAt" DESC
      LIMIT 100
    `);
    const [{ usedBytes }] = await this.prisma.$queryRaw<Array<{ usedBytes: bigint }>>(Prisma.sql`
      SELECT COALESCE(SUM("sizeBytes"), 0)::bigint AS "usedBytes"
      FROM "FinancialDocument" WHERE "customerId" = ${customerId}
    `);
    return {
      capabilities: this.provider.capabilities(MAX_FILE_BYTES, MAX_STORAGE_BYTES),
      documents: documents.map(summary),
      storage: { usedBytes: Number(usedBytes), limitBytes: MAX_STORAGE_BYTES },
    };
  }

  async upload(supabaseUserId: string, file: UploadedFile | undefined, consent: boolean): Promise<FinancialDocumentSummary> {
    if (!file) throw new BadRequestException("A PDF or TXT file is required.");
    if (file.size <= 0 || file.size > MAX_FILE_BYTES || file.buffer.length !== file.size) {
      throw new BadRequestException(`Documents must be between 1 byte and ${MAX_FILE_BYTES} bytes.`);
    }
    const name = safeFileName(file.originalname);
    const isPdf = file.mimetype === "application/pdf" && /\.pdf$/iu.test(name) && file.buffer.subarray(0, 5).toString("ascii") === "%PDF-";
    const decodedText = file.mimetype === "text/plain" ? file.buffer.toString("utf8") : "";
    const isText = file.mimetype === "text/plain" && /\.txt$/iu.test(name) && !file.buffer.includes(0) && !decodedText.includes("\uFFFD");
    if (!isPdf && !isText) throw new BadRequestException("Only valid PDF and plain-text files are accepted.");
    const customerId = await this.customerId(supabaseUserId);
    const id = randomUUID();
    const sha256 = createHash("sha256").update(file.buffer).digest("hex");
    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${customerId}))`);
        const duplicate = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
          SELECT "id" FROM "FinancialDocument" WHERE "customerId" = ${customerId} AND "sha256" = ${sha256} LIMIT 1
        `);
        if (duplicate.length) throw new ConflictException("This document is already in your library.");
        const [{ usedBytes }] = await tx.$queryRaw<Array<{ usedBytes: bigint }>>(Prisma.sql`
          SELECT COALESCE(SUM("sizeBytes"), 0)::bigint AS "usedBytes" FROM "FinancialDocument" WHERE "customerId" = ${customerId}
        `);
        if (Number(usedBytes) + file.size > MAX_STORAGE_BYTES) throw new BadRequestException("Customer document storage limit exceeded.");
        await tx.$executeRaw(Prisma.sql`
          INSERT INTO "FinancialDocument" ("id", "customerId", "fileName", "mimeType", "sizeBytes", "sha256", "status", "createdAt", "updatedAt")
          VALUES (${id}, ${customerId}, ${name}, ${file.mimetype}, ${file.size}, ${sha256}, 'uploaded', NOW(), NOW())
        `);
        await tx.$executeRaw(Prisma.sql`
          INSERT INTO "FinancialDocumentFile" ("documentId", "content", "createdAt") VALUES (${id}, ${file.buffer}, NOW())
        `);
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (error instanceof ConflictException || error instanceof BadRequestException) throw error;
      throw error;
    }
    await this.audit(customerId, supabaseUserId, "financial_document.uploaded", id, { mimeType: file.mimetype, sizeBytes: file.size });
    await this.processOwned(customerId, id, consent);
    return this.getSummary(customerId, id);
  }

  async process(supabaseUserId: string, documentId: string, consent: boolean): Promise<FinancialDocumentSummary> {
    const customerId = await this.customerId(supabaseUserId);
    await this.processOwned(customerId, documentId, consent);
    await this.audit(customerId, supabaseUserId, "financial_document.processed", documentId, { externalAiConsent: consent });
    return this.getSummary(customerId, documentId);
  }

  private async processOwned(customerId: string, documentId: string, consent: boolean): Promise<void> {
    const started = Date.now();
    const source = await this.prisma.$queryRaw<Array<{ mimeType: string; content: Buffer }>>(Prisma.sql`
      SELECT d."mimeType", f."content"
      FROM "FinancialDocument" d JOIN "FinancialDocumentFile" f ON f."documentId" = d."id"
      WHERE d."id" = ${documentId} AND d."customerId" = ${customerId} LIMIT 1
    `);
    if (!source[0]) throw new NotFoundException("Document not found.");
    await this.prisma.$executeRaw(Prisma.sql`
      UPDATE "FinancialDocument" SET "status" = 'processing', "errorCode" = NULL, "updatedAt" = NOW()
      WHERE "id" = ${documentId} AND "customerId" = ${customerId}
    `);
    try {
      const pages = await this.extractor.extract(source[0].content, source[0].mimeType, MAX_PAGES);
      const chunks = chunkDocumentPages(pages, MAX_CHUNKS);
      const capabilities = this.provider.capabilities(MAX_FILE_BYTES, MAX_STORAGE_BYTES);
      let embeddings: number[][] | null = null;
      if (consent && capabilities.semanticRagAvailable) {
        await this.assertEmbeddingBudget(customerId, "processing");
        embeddings = [];
        for (let offset = 0; offset < chunks.length; offset += 32) {
          embeddings.push(...(await this.provider.embed(chunks.slice(offset, offset + 32).map((chunk) => chunk.content))));
        }
      }
      await this.prisma.$transaction(async (tx) => {
        await tx.$executeRaw(Prisma.sql`DELETE FROM "FinancialDocumentPage" WHERE "documentId" = ${documentId} AND "customerId" = ${customerId}`);
        await tx.$executeRaw(Prisma.sql`DELETE FROM "FinancialDocumentChunk" WHERE "documentId" = ${documentId} AND "customerId" = ${customerId}`);
        for (const page of pages) {
          await tx.$executeRaw(Prisma.sql`
            INSERT INTO "FinancialDocumentPage" ("id", "documentId", "customerId", "pageNumber", "content", "createdAt")
            VALUES (${randomUUID()}, ${documentId}, ${customerId}, ${page.pageNumber}, ${page.content}, NOW())
          `);
        }
        for (const chunk of chunks) {
          const embedding = embeddings?.[chunk.chunkIndex];
          const vector = embedding ? `[${embedding.join(",")}]` : null;
          await tx.$executeRaw(Prisma.sql`
            INSERT INTO "FinancialDocumentChunk" ("id", "documentId", "customerId", "pageNumber", "chunkIndex", "content", "tokenEstimate", "embeddingModel", "embeddingDimensions", "embedding", "createdAt")
            VALUES (${randomUUID()}, ${documentId}, ${customerId}, ${chunk.pageNumber}, ${chunk.chunkIndex}, ${chunk.content}, ${chunk.tokenEstimate}, ${embedding ? capabilities.embeddingModel : null}, ${embedding ? capabilities.embeddingDimensions : null}, ${vector}::vector, NOW())
          `);
        }
        await tx.$executeRaw(Prisma.sql`
          UPDATE "FinancialDocument"
          SET "status" = ${embeddings ? "ready" : "text_ready"}, "pageCount" = ${pages.length}, "chunkCount" = ${chunks.length},
              "embeddingModel" = ${embeddings ? capabilities.embeddingModel : null}, "errorCode" = NULL, "updatedAt" = NOW()
          WHERE "id" = ${documentId} AND "customerId" = ${customerId}
        `);
      });
      await this.trace(customerId, documentId, "processing", "succeeded", Date.now() - started, chunks.length, embeddings ? capabilities.embeddingModel : null, null);
    } catch (error) {
      const code = failureCode(error);
      await this.prisma.$executeRaw(Prisma.sql`
        UPDATE "FinancialDocument" SET "status" = 'failed', "errorCode" = ${code}, "updatedAt" = NOW()
        WHERE "id" = ${documentId} AND "customerId" = ${customerId}
      `);
      await this.trace(customerId, documentId, "processing", "failed", Date.now() - started, null, null, code);
      throw error;
    }
  }

  async detail(supabaseUserId: string, documentId: string): Promise<DocumentDetail> {
    const customerId = await this.customerId(supabaseUserId);
    const document = await this.getSummary(customerId, documentId);
    const pages = await this.prisma.$queryRaw<Array<{ pageNumber: number; content: string }>>(Prisma.sql`
      SELECT "pageNumber", "content" FROM "FinancialDocumentPage"
      WHERE "customerId" = ${customerId} AND "documentId" = ${documentId}
      ORDER BY "pageNumber" ASC LIMIT ${MAX_PAGES}
    `);
    return { ...document, pages };
  }

  async original(supabaseUserId: string, documentId: string): Promise<{ fileName: string; mimeType: string; content: Buffer }> {
    const customerId = await this.customerId(supabaseUserId);
    const rows = await this.prisma.$queryRaw<Array<{ fileName: string; mimeType: string; content: Buffer }>>(Prisma.sql`
      SELECT d."fileName", d."mimeType", f."content"
      FROM "FinancialDocument" d JOIN "FinancialDocumentFile" f ON f."documentId" = d."id"
      WHERE d."id" = ${documentId} AND d."customerId" = ${customerId} LIMIT 1
    `);
    if (!rows[0]) throw new NotFoundException("Document not found.");
    return rows[0];
  }

  async remove(supabaseUserId: string, documentId: string): Promise<void> {
    const customerId = await this.customerId(supabaseUserId);
    const count = await this.prisma.$executeRaw(Prisma.sql`
      DELETE FROM "FinancialDocument" WHERE "id" = ${documentId} AND "customerId" = ${customerId}
    `);
    if (!count) throw new NotFoundException("Document not found.");
    await this.audit(customerId, supabaseUserId, "financial_document.deleted", documentId, {});
  }

  /** Local, bounded passage retrieval. No query or document leaves PostgreSQL. */
  async searchLocal(supabaseUserId: string, query: string, documentId?: string, limit = 5): Promise<DocumentPassage[]> {
    const customerId = await this.customerId(supabaseUserId);
    if (query.length < 2 || query.length > 500) throw new BadRequestException("Invalid document query.");
    if (documentId) await this.getSummary(customerId, documentId);
    const words = query.match(/[\p{L}\p{N}]{2,40}/gu)?.slice(0, 12) ?? [];
    if (words.length === 0) return [];
    const patterns = words.map((word) => `%${word}%`);
    const rows = await this.prisma.$queryRaw<PassageRow[]>(Prisma.sql`
      SELECT c."id" AS "chunkId", c."documentId", d."fileName", c."pageNumber",
             LEFT(c."content", 1600) AS "content", 0::double precision AS "similarity"
      FROM "FinancialDocumentChunk" c
      JOIN "FinancialDocument" d ON d."id" = c."documentId" AND d."customerId" = c."customerId"
      WHERE c."customerId" = ${customerId} AND d."status" IN ('ready', 'text_ready')
        AND (${documentId ?? null}::text IS NULL OR c."documentId" = ${documentId ?? null})
        AND c."content" ILIKE ANY(ARRAY[${Prisma.join(patterns)}]::text[])
      ORDER BY d."createdAt" DESC, c."chunkIndex" ASC
      LIMIT ${Math.min(5, Math.max(1, limit))}
    `);
    return rows.map((row) => ({ ...row, citation: `[${row.fileName} p.${row.pageNumber}]` }));
  }

  async search(supabaseUserId: string, query: string, consent: boolean, documentId?: string, limit = MAX_RESULTS): Promise<DocumentPassage[]> {
    const customerId = await this.customerId(supabaseUserId);
    const normalizedQuery = query.replace(/\s+/gu, " ").trim();
    if (normalizedQuery.length < 2 || normalizedQuery.length > 500) {
      throw new BadRequestException("Search queries must contain between 2 and 500 characters.");
    }
    if (documentId) await this.getSummary(customerId, documentId);
    if (!consent) throw new BadRequestException("Explicit external AI consent is required to embed this search query.");
    const capabilities = this.provider.capabilities(MAX_FILE_BYTES, MAX_STORAGE_BYTES);
    if (!capabilities.semanticRagAvailable || !capabilities.embeddingModel) {
      throw new ServiceUnavailableException("Semantic RAG is unavailable because the embedding provider is not configured.");
    }
    const started = Date.now();
    try {
      await this.assertEmbeddingBudget(customerId, "retrieval");
      const [embedding] = await this.provider.embed([normalizedQuery]);
      const vector = `[${embedding.join(",")}]`;
      const rows = await this.prisma.$queryRaw<PassageRow[]>(Prisma.sql`
        SELECT c."id" AS "chunkId", c."documentId", d."fileName", c."pageNumber", c."content",
               (1 - (c."embedding" <=> ${vector}::vector))::double precision AS "similarity"
        FROM "FinancialDocumentChunk" c
        JOIN "FinancialDocument" d ON d."id" = c."documentId" AND d."customerId" = c."customerId"
        WHERE c."customerId" = ${customerId}
          AND d."status" = 'ready'
          AND c."embedding" IS NOT NULL
          AND c."embeddingModel" = ${capabilities.embeddingModel}
          AND (${documentId ?? null}::text IS NULL OR c."documentId" = ${documentId ?? null})
        ORDER BY c."embedding" <=> ${vector}::vector
        LIMIT ${Math.min(MAX_RESULTS, Math.max(1, limit))}
      `);
      const passages = rows
        .map((row) => ({ ...row, similarity: Math.max(-1, Math.min(1, Number(row.similarity))), citation: `[${row.fileName} p.${row.pageNumber}]` }))
        .filter((passage) => passage.similarity >= 0.18);
      await this.trace(customerId, documentId ?? null, "retrieval", "succeeded", Date.now() - started, passages.length, this.provider.capabilities(MAX_FILE_BYTES, MAX_STORAGE_BYTES).embeddingModel, null);
      return passages;
    } catch (error) {
      await this.trace(customerId, documentId ?? null, "retrieval", "failed", Date.now() - started, null, this.provider.capabilities(MAX_FILE_BYTES, MAX_STORAGE_BYTES).embeddingModel, failureCode(error));
      throw error;
    }
  }

  async chat(supabaseUserId: string, question: string, consent: boolean, documentId?: string): Promise<DocumentChatResult> {
    const passages = await this.search(supabaseUserId, question, consent, documentId);
    const customerId = await this.customerId(supabaseUserId);
    const started = Date.now();
    if (!passages.length) {
      await this.trace(customerId, documentId ?? null, "answer", "succeeded", Date.now() - started, 0, null, null);
      return { answer: "I could not find relevant embedded passages in the authorized document library.", passages, mode: "extractive", provider: null, disclaimer: DISCLAIMER };
    }
    const capabilities = this.provider.capabilities(MAX_FILE_BYTES, MAX_STORAGE_BYTES);
    if (capabilities.externalAiAvailable) {
      try {
        const result = { answer: await this.provider.answer(question, passages), passages, mode: "external_ai" as const, provider: capabilities.embeddingProvider, disclaimer: DISCLAIMER };
        await this.trace(customerId, documentId ?? null, "answer", "succeeded", Date.now() - started, passages.length, capabilities.embeddingModel, null);
        return result;
      } catch (error) {
        await this.trace(customerId, documentId ?? null, "answer", "failed", Date.now() - started, passages.length, capabilities.embeddingModel, failureCode(error));
        // A provider failure returns bounded source passages, never an invented answer.
      }
    }
    const result = {
      answer: `The configured answer model is unavailable. The most relevant verified passages are:\n\n${passages.slice(0, 4).map((passage) => `${passage.content} ${passage.citation}`).join("\n\n")}`,
      passages,
      mode: "extractive" as const,
      provider: null,
      disclaimer: DISCLAIMER,
    };
    await this.trace(customerId, documentId ?? null, "answer", "succeeded", Date.now() - started, passages.length, null, null);
    return result;
  }

  async intelligence(supabaseUserId: string, documentId: string, consent: boolean): Promise<DocumentIntelligence> {
    const prompts: Array<[IntelligenceFinding["category"], string, string]> = [
      ["key_fact", "Key facts", "principal amounts dates parties product purpose key facts"],
      ["fee", "Fees and charges", "fees charges expenses commission penalty cost interest rate"],
      ["risk", "Financial risks", "risk loss default volatility liquidity counterparty warning"],
      ["term", "Material terms", "term maturity renewal termination obligation covenant eligibility"],
      ["investment_consideration", "Investment considerations", "returns assumptions suitability performance liquidity investment consideration"],
      ["shariah_evidence", "Shariah-screening evidence", "interest riba debt leverage gambling maysir uncertainty gharar alcohol prohibited revenue asset backing profit sharing"],
    ];
    const findings = await Promise.all(prompts.map(async ([category, label, query]) => ({
      category,
      label,
      passages: await this.search(supabaseUserId, query, consent, documentId, 4),
    })));
    return { documentId, findings, halalResearchNotice: "This highlights evidence relevant to preliminary Shariah screening. It does not determine permissibility or provide religious certification; consult a qualified scholar." };
  }

  async compare(supabaseUserId: string, documentIds: string[], consent: boolean): Promise<DocumentComparison> {
    const uniqueIds = [...new Set(documentIds)];
    if (uniqueIds.length !== documentIds.length) throw new BadRequestException("Comparison documents must be unique.");
    const customerId = await this.customerId(supabaseUserId);
    const owned = await this.prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT "id" FROM "FinancialDocument" WHERE "customerId" = ${customerId} AND "id" IN (${Prisma.join(uniqueIds)})
    `);
    if (owned.length !== uniqueIds.length) throw new NotFoundException("One or more documents were not found.");
    const dimensions = await Promise.all([
      ["Fees and economics", "fees rates expenses returns yield economics"],
      ["Risk allocation", "risk liability default loss counterparty obligations"],
      ["Term and liquidity", "term maturity termination redemption liquidity lockup"],
      ["Shariah-screening evidence", "interest riba debt uncertainty gharar prohibited revenue asset backing"],
    ].map(async ([label, query]) => {
      const evidenceByDocument: Record<string, DocumentPassage[]> = {};
      for (const id of uniqueIds) evidenceByDocument[id] = await this.search(supabaseUserId, query, consent, id, 3);
      return { label, evidenceByDocument };
    }));
    return { documentIds: uniqueIds, dimensions, notice: "Comparison is limited to retrieved source passages. Missing evidence is shown as missing and is never inferred." };
  }

  private async customerId(supabaseUserId: string): Promise<string> {
    const customer = await this.prisma.customer.findUnique({ where: { supabaseUserId }, select: { id: true } });
    if (!customer) throw new NotFoundException("Customer profile not found.");
    return customer.id;
  }

  private async assertEmbeddingBudget(customerId: string, operation: "processing" | "retrieval"): Promise<void> {
    const hours = operation === "processing" ? 24 : 1;
    const limit = operation === "processing" ? 10 : 100;
    const rows = await this.prisma.$queryRaw<Array<{ count: bigint }>>(Prisma.sql`
      SELECT COUNT(*)::bigint AS "count" FROM "FinancialDocumentTrace"
      WHERE "customerId" = ${customerId} AND "operation" = ${operation}
        AND "createdAt" >= NOW() - (${hours} * INTERVAL '1 hour')
    `);
    if (Number(rows[0]?.count ?? 0) >= limit) {
      throw new HttpException(
        `Document ${operation} cost limit reached; try again later.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private async getSummary(customerId: string, documentId: string): Promise<FinancialDocumentSummary> {
    const rows = await this.prisma.$queryRaw<DocumentRow[]>(Prisma.sql`
      SELECT "id", "fileName", "mimeType", "sizeBytes", "status", "pageCount", "chunkCount", "embeddingModel", "errorCode", "createdAt", "updatedAt"
      FROM "FinancialDocument" WHERE "id" = ${documentId} AND "customerId" = ${customerId} LIMIT 1
    `);
    if (!rows[0]) throw new NotFoundException("Document not found.");
    return summary(rows[0]);
  }

  private async trace(customerId: string, documentId: string | null, operation: string, status: string, durationMs: number, chunkCount: number | null, model: string | null, code: string | null): Promise<void> {
    await this.prisma.$executeRaw(Prisma.sql`
      INSERT INTO "FinancialDocumentTrace" ("id", "customerId", "documentId", "operation", "status", "durationMs", "chunkCount", "provider", "model", "failureCode", "createdAt")
      VALUES (${randomUUID()}, ${customerId}, ${documentId}, ${operation}, ${status}, ${Math.max(0, durationMs)}, ${chunkCount}, ${model ? "openai_compatible" : null}, ${model}, ${code}, NOW())
    `);
  }

  private async audit(customerId: string, actorId: string, action: string, targetId: string, metadata: Record<string, unknown>): Promise<void> {
    await this.prisma.auditEvent.create({ data: { customerId, actorType: "customer", actorId, action, targetType: "financial_document", targetId, metadata: metadata as Prisma.InputJsonValue } });
  }
}
