import { BadRequestException, Injectable } from "@nestjs/common";

export type ExtractedPage = { pageNumber: number; content: string };

type PdfPage = {
  getTextContent(): Promise<{ items: Array<{ str?: string; hasEOL?: boolean }> }>;
};

type PdfParse = (
  buffer: Buffer,
  options: { pagerender(page: PdfPage): Promise<string>; max: number },
) => Promise<{ numpages?: number }>;

function normalizeText(value: string): string {
  return value
    .replace(/\u0000/gu, "")
    .replace(/\r\n?/gu, "\n")
    .replace(/[\t\f\v]+/gu, " ")
    .replace(/ +\n/gu, "\n")
    .replace(/\n{4,}/gu, "\n\n\n")
    .trim();
}

async function loadPdfParser(): Promise<PdfParse> {
  try {
    const dynamicImport = new Function("specifier", "return import(specifier)") as (
      specifier: string,
    ) => Promise<{ default?: PdfParse }>;
    const module = await dynamicImport("pdf-parse");
    if (typeof module.default !== "function") throw new Error("invalid_pdf_parser");
    return module.default;
  } catch {
    throw new BadRequestException(
      "PDF extraction is unavailable until the approved pdf-parse dependency is installed.",
    );
  }
}

@Injectable()
export class DocumentTextExtractor {
  async extract(buffer: Buffer, mimeType: string, maxPages: number): Promise<ExtractedPage[]> {
    if (mimeType === "text/plain") {
      const content = normalizeText(buffer.toString("utf8"));
      if (!content) throw new BadRequestException("The text document is empty.");
      return [{ pageNumber: 1, content }];
    }
    const parser = await loadPdfParser();
    const pages: ExtractedPage[] = [];
    await parser(buffer, {
      max: maxPages + 1,
      pagerender: async (page) => {
        if (pages.length >= maxPages) {
          throw new BadRequestException(`PDF documents are limited to ${maxPages} pages.`);
        }
        const text = await page.getTextContent();
        const content = normalizeText(
          text.items.map((item) => `${item.str ?? ""}${item.hasEOL ? "\n" : " "}`).join(""),
        );
        pages.push({ pageNumber: pages.length + 1, content });
        return content;
      },
    });
    if (!pages.some((page) => page.content)) {
      throw new BadRequestException("No extractable text was found. Scanned PDFs require OCR, which is not enabled.");
    }
    return pages;
  }
}

export function chunkDocumentPages(
  pages: ExtractedPage[],
  maxChunks: number,
): Array<ExtractedPage & { chunkIndex: number; tokenEstimate: number }> {
  const chunks: Array<ExtractedPage & { chunkIndex: number; tokenEstimate: number }> = [];
  const target = 1_200;
  const overlap = 180;
  for (const page of pages) {
    let start = 0;
    while (start < page.content.length) {
      if (chunks.length >= maxChunks) {
        throw new BadRequestException(`Document extraction exceeds the ${maxChunks} chunk limit.`);
      }
      let end = Math.min(page.content.length, start + target);
      if (end < page.content.length) {
        const boundary = Math.max(
          page.content.lastIndexOf("\n", end),
          page.content.lastIndexOf(". ", end),
          page.content.lastIndexOf(" ", end),
        );
        if (boundary > start + target * 0.6) end = boundary + 1;
      }
      const content = page.content.slice(start, end).trim();
      if (content) {
        chunks.push({
          pageNumber: page.pageNumber,
          content,
          chunkIndex: chunks.length,
          tokenEstimate: Math.ceil(content.length / 4),
        });
      }
      if (end >= page.content.length) break;
      start = Math.max(start + 1, end - overlap);
    }
  }
  return chunks;
}
