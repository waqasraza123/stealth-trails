import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Request,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import type { CustomJsonResponse } from "../types/CustomJsonResponse";
import {
  ChatWithDocumentsDto,
  CompareFinancialDocumentsDto,
  DocumentIntelligenceDto,
  ListFinancialDocumentsDto,
  ProcessFinancialDocumentDto,
  SearchFinancialDocumentsDto,
  UploadFinancialDocumentDto,
} from "./dto/document-intelligence.dto";
import { DocumentIntelligenceService } from "./document-intelligence.service";
import type {
  DocumentChatResult,
  DocumentComparison,
  DocumentDetail,
  DocumentIntelligence,
  DocumentLibrary,
  DocumentPassage,
  FinancialDocumentSummary,
} from "./document-intelligence.types";

type AuthenticatedRequest = { user: { id: string } };
type UploadedDocument = { originalname: string; mimetype: string; size: number; buffer: Buffer };
type FileResponse = {
  setHeader(name: string, value: string): void;
  end(content: Buffer): void;
};

@UseGuards(JwtAuthGuard)
@Controller("ai/documents")
export class DocumentIntelligenceController {
  constructor(private readonly documents: DocumentIntelligenceService) {}

  @Get()
  async library(
    @Request() request: AuthenticatedRequest,
    @Query() dto: ListFinancialDocumentsDto,
  ): Promise<CustomJsonResponse<DocumentLibrary>> {
    return { status: "success", message: "Document library retrieved successfully.", data: await this.documents.library(request.user.id, dto.query) };
  }

  @Post()
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: 20 * 1024 * 1024, files: 1 } }))
  async upload(
    @Request() request: AuthenticatedRequest,
    @UploadedFile() file: UploadedDocument | undefined,
    @Body() dto: UploadFinancialDocumentDto,
  ): Promise<CustomJsonResponse<FinancialDocumentSummary>> {
    return { status: "success", message: "Document uploaded and inspected successfully.", data: await this.documents.upload(request.user.id, file, dto.externalAiConsent === true) };
  }

  @Post("search")
  async search(
    @Request() request: AuthenticatedRequest,
    @Body() dto: SearchFinancialDocumentsDto,
  ): Promise<CustomJsonResponse<DocumentPassage[]>> {
    return { status: "success", message: "Authorized document passages retrieved successfully.", data: await this.documents.search(request.user.id, dto.query, dto.externalAiConsent, dto.documentId, dto.limit) };
  }

  @Post("chat")
  async chat(
    @Request() request: AuthenticatedRequest,
    @Body() dto: ChatWithDocumentsDto,
  ): Promise<CustomJsonResponse<DocumentChatResult>> {
    return { status: "success", message: "Document question answered from retrieved evidence.", data: await this.documents.chat(request.user.id, dto.query, dto.externalAiConsent, dto.documentId) };
  }

  @Post("compare")
  async compare(
    @Request() request: AuthenticatedRequest,
    @Body() dto: CompareFinancialDocumentsDto,
  ): Promise<CustomJsonResponse<DocumentComparison>> {
    return { status: "success", message: "Documents compared from retrieved evidence.", data: await this.documents.compare(request.user.id, dto.documentIds, dto.externalAiConsent) };
  }

  @Get(":documentId")
  async detail(
    @Request() request: AuthenticatedRequest,
    @Param("documentId") documentId: string,
  ): Promise<CustomJsonResponse<DocumentDetail>> {
    return { status: "success", message: "Document preview retrieved successfully.", data: await this.documents.detail(request.user.id, documentId) };
  }

  @Get(":documentId/original")
  async original(
    @Request() request: AuthenticatedRequest,
    @Param("documentId") documentId: string,
    @Res() response: FileResponse,
  ): Promise<void> {
    const file = await this.documents.original(request.user.id, documentId);
    response.setHeader("Content-Type", file.mimeType);
    response.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(file.fileName)}`);
    response.setHeader("Cache-Control", "private, no-store");
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.end(file.content);
  }

  @Post(":documentId/process")
  async process(
    @Request() request: AuthenticatedRequest,
    @Param("documentId") documentId: string,
    @Body() dto: ProcessFinancialDocumentDto,
  ): Promise<CustomJsonResponse<FinancialDocumentSummary>> {
    return { status: "success", message: "Document processing completed.", data: await this.documents.process(request.user.id, documentId, dto.externalAiConsent) };
  }

  @Post(":documentId/intelligence")
  async intelligence(
    @Request() request: AuthenticatedRequest,
    @Param("documentId") documentId: string,
    @Body() dto: DocumentIntelligenceDto,
  ): Promise<CustomJsonResponse<DocumentIntelligence>> {
    return { status: "success", message: "Document intelligence retrieved from cited evidence.", data: await this.documents.intelligence(request.user.id, documentId, dto.externalAiConsent) };
  }

  @Delete(":documentId")
  async remove(
    @Request() request: AuthenticatedRequest,
    @Param("documentId") documentId: string,
  ): Promise<CustomJsonResponse<null>> {
    await this.documents.remove(request.user.id, documentId);
    return { status: "success", message: "Document, extracted text, and embeddings deleted.", data: null };
  }
}
