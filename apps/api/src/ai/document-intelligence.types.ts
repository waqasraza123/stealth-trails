export type DocumentStatus =
  | "uploaded"
  | "processing"
  | "text_ready"
  | "ready"
  | "failed";

export type FinancialDocumentSummary = {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  status: DocumentStatus;
  pageCount: number;
  chunkCount: number;
  embeddingModel: string | null;
  errorCode: string | null;
  createdAt: string;
  updatedAt: string;
};

export type DocumentCapabilities = {
  semanticRagAvailable: boolean;
  externalAiAvailable: boolean;
  embeddingProvider: string | null;
  embeddingModel: string | null;
  embeddingDimensions: number;
  productionExternalAiDisabled: boolean;
  acceptedTypes: readonly ["application/pdf", "text/plain"];
  maxFileBytes: number;
  maxStorageBytesPerCustomer: number;
  disclosure: string;
};

export type DocumentLibrary = {
  capabilities: DocumentCapabilities;
  documents: FinancialDocumentSummary[];
  storage: { usedBytes: number; limitBytes: number };
};

export type DocumentPage = { pageNumber: number; content: string };

export type DocumentDetail = FinancialDocumentSummary & {
  pages: DocumentPage[];
};

export type DocumentPassage = {
  chunkId: string;
  documentId: string;
  fileName: string;
  pageNumber: number;
  content: string;
  similarity: number;
  citation: string;
};

export type DocumentChatResult = {
  answer: string;
  passages: DocumentPassage[];
  mode: "extractive" | "external_ai";
  provider: string | null;
  disclaimer: string;
};

export type IntelligenceFinding = {
  category: "key_fact" | "fee" | "risk" | "term" | "investment_consideration" | "shariah_evidence";
  label: string;
  passages: DocumentPassage[];
};

export type DocumentIntelligence = {
  documentId: string;
  findings: IntelligenceFinding[];
  halalResearchNotice: string;
};

export type DocumentComparison = {
  documentIds: string[];
  dimensions: Array<{ label: string; evidenceByDocument: Record<string, DocumentPassage[]> }>;
  notice: string;
};
