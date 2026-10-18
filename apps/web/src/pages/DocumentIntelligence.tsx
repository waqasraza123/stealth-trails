import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BookOpen,
  Bot,
  CheckCircle2,
  FileSearch,
  FileText,
  GitCompareArrows,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
  UploadCloud,
} from "lucide-react";
import { Layout } from "@/components/Layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { LoadingPanel } from "@/components/ui/loading-panel";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import {
  useDocumentActions,
  useDocumentDetail,
  useDocumentLibrary,
  type DocumentPassage,
} from "@/hooks/ai/useDocumentIntelligence";
import { readApiErrorMessage } from "@/lib/api";
import { cn } from "@/lib/utils";

const bytes = (value: number) => {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
};

function Evidence({ passages }: { passages: DocumentPassage[] }) {
  if (!passages.length) return <p className="text-sm text-slate-500">No supporting passage was retrieved. Nothing is inferred.</p>;
  return (
    <div className="space-y-3">
      {passages.map((passage) => (
        <div key={passage.chunkId} className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <Badge variant="outline">{passage.citation}</Badge>
            <span className="text-xs text-slate-500">{Math.round(passage.similarity * 100)}% semantic similarity</span>
          </div>
          <p className="text-sm leading-6 text-slate-700">{passage.content}</p>
        </div>
      ))}
    </div>
  );
}

export default function DocumentIntelligence() {
  const [filter, setFilter] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [question, setQuestion] = useState("");
  const [consent, setConsent] = useState(false);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const library = useDocumentLibrary(filter);
  const detail = useDocumentDetail(selectedId);
  const actions = useDocumentActions();
  const documents = library.data?.documents ?? [];

  useEffect(() => {
    if (!selectedId && documents[0]) setSelectedId(documents[0].id);
    if (selectedId && library.data && !documents.some((document) => document.id === selectedId)) setSelectedId(documents[0]?.id ?? null);
  }, [documents, library.data, selectedId]);

  const error = [library.error, actions.upload.error, actions.process.error, actions.remove.error, actions.chat.error, actions.intelligence.error, actions.compare.error].find(Boolean);
  const selected = documents.find((document) => document.id === selectedId);
  const storagePercent = library.data ? (library.data.storage.usedBytes / library.data.storage.limitBytes) * 100 : 0;
  const busy = actions.upload.isPending || actions.process.isPending || actions.remove.isPending;
  const statusTone = useMemo(() => ({ ready: "bg-emerald-100 text-emerald-800", text_ready: "bg-amber-100 text-amber-800", failed: "bg-rose-100 text-rose-800", processing: "bg-indigo-100 text-indigo-800", uploaded: "bg-slate-100 text-slate-700" }), []);

  if (library.isLoading) return <Layout><LoadingPanel title="Opening document intelligence" description="Loading your private, customer-isolated document library." /></Layout>;

  return (
    <Layout>
      <div className="space-y-6">
        <section className="grid gap-4 lg:grid-cols-[1.4fr_0.6fr]">
          <Card className="overflow-hidden border-0 bg-slate-950 p-7 text-white shadow-xl">
            <div className="flex items-start justify-between gap-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-300">Private research workspace</p>
                <h2 className="mt-3 text-3xl font-semibold">Financial Document Intelligence</h2>
                <p className="mt-3 max-w-2xl text-sm leading-7 text-white/70">Upload statements, disclosures, agreements, and research. Answers stay grounded in customer-authorized passages with document and page citations.</p>
              </div>
              <div className="rounded-2xl bg-white/10 p-3"><FileSearch className="h-7 w-7 text-emerald-300" /></div>
            </div>
            <div className="mt-6 flex flex-wrap gap-3 text-xs text-white/70">
              <span className="rounded-full border border-white/15 px-3 py-2">PDF + TXT</span>
              <span className="rounded-full border border-white/15 px-3 py-2">Customer-scoped pgvector</span>
              <span className="rounded-full border border-white/15 px-3 py-2">Page-level evidence</span>
              <span className="rounded-full border border-white/15 px-3 py-2">No autonomous transactions</span>
            </div>
          </Card>
          <Card className="p-6">
            <div className="flex items-center gap-3"><ShieldCheck className="h-5 w-5 text-emerald-600" /><h3 className="font-semibold">RAG availability</h3></div>
            <p className={cn("mt-4 text-lg font-semibold", library.data?.capabilities.semanticRagAvailable ? "text-emerald-700" : "text-amber-700")}>{library.data?.capabilities.semanticRagAvailable ? "Semantic retrieval configured" : "Semantic retrieval unavailable"}</p>
            <p className="mt-2 text-sm leading-6 text-slate-500">{library.data?.capabilities.semanticRagAvailable ? `${library.data.capabilities.embeddingModel} · ${library.data.capabilities.embeddingDimensions} dimensions` : "Configure the embedding provider to process vectors. Extracted text remains previewable."}</p>
            <div className="mt-5"><div className="mb-2 flex justify-between text-xs text-slate-500"><span>Private storage</span><span>{bytes(library.data?.storage.usedBytes ?? 0)} / {bytes(library.data?.storage.limitBytes ?? 0)}</span></div><Progress value={storagePercent} /></div>
          </Card>
        </section>

        {error ? <div className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{readApiErrorMessage(error, "Document operation failed.")}</div> : null}

        <section className="grid gap-6 xl:grid-cols-[0.72fr_1.28fr]">
          <div className="space-y-4">
            <Card className="p-5">
              <div className="flex items-center justify-between gap-3"><div><h3 className="font-semibold">Document library</h3><p className="mt-1 text-xs text-slate-500">Originals are private and never copied into audit events.</p></div><UploadCloud className="h-5 w-5 text-indigo-600" /></div>
              <label className="mt-4 flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-sm font-semibold text-slate-700 hover:border-emerald-400 hover:bg-emerald-50">
                <UploadCloud className="h-4 w-4" />{actions.upload.isPending ? "Extracting and indexing…" : "Upload PDF or TXT"}
                <input className="sr-only" type="file" accept="application/pdf,text/plain,.pdf,.txt" disabled={busy} onChange={(event) => { const file = event.target.files?.[0]; if (file) actions.upload.mutate({ file, consent }); event.currentTarget.value = ""; }} />
              </label>
              <div className="relative mt-4"><Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" /><Input className="pl-9" value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Filter by file name" /></div>
              <label className="mt-4 flex items-start gap-3 rounded-xl bg-indigo-50 p-3 text-xs leading-5 text-indigo-900"><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} className="mt-1" /><span><strong>External AI consent for this action.</strong> Extracted passages and search questions may be sent to the configured provider. Originals and identity are not sent.</span></label>
            </Card>

            <div className="space-y-2">
              {documents.map((document) => (
                <button key={document.id} type="button" onClick={() => setSelectedId(document.id)} className={cn("w-full rounded-2xl border bg-white p-4 text-left transition", selectedId === document.id ? "border-emerald-400 shadow-md" : "border-slate-200 hover:border-slate-300")}>
                  <div className="flex items-start gap-3"><div className="rounded-xl bg-slate-100 p-2"><FileText className="h-5 w-5 text-slate-600" /></div><div className="min-w-0 flex-1"><p className="truncate font-semibold text-slate-950">{document.fileName}</p><p className="mt-1 text-xs text-slate-500">{document.pageCount} pages · {document.chunkCount} passages · {bytes(document.sizeBytes)}</p><span className={cn("mt-2 inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold", statusTone[document.status])}>{document.status.replace("_", " ")}</span></div><input type="checkbox" aria-label={`Compare ${document.fileName}`} checked={compareIds.includes(document.id)} onClick={(event) => event.stopPropagation()} onChange={(event) => setCompareIds((current) => event.target.checked ? [...current, document.id].slice(-4) : current.filter((id) => id !== document.id))} /></div>
                </button>
              ))}
              {!documents.length ? <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">No documents match this library view.</div> : null}
            </div>
          </div>

          <div className="space-y-5">
            <Card className="p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Selected document</p><h3 className="mt-2 text-xl font-semibold">{selected?.fileName ?? "Choose a document"}</h3></div>
                {selected ? <div className="flex flex-wrap gap-2"><Button variant="outline" disabled={!consent || actions.process.isPending} onClick={() => actions.process.mutate({ documentId: selected.id, consent })}><Sparkles className="mr-2 h-4 w-4" />Index</Button><Button variant="outline" className="text-rose-700" disabled={actions.remove.isPending} onClick={() => { if (window.confirm(`Delete ${selected.fileName} and all extracted data?`)) actions.remove.mutate(selected.id); }}><Trash2 className="mr-2 h-4 w-4" />Delete</Button></div> : null}
              </div>
              {detail.isLoading ? <div className="mt-5 text-sm text-slate-500">Loading private preview…</div> : null}
              {detail.data ? <div className="mt-5 max-h-[28rem] space-y-4 overflow-y-auto rounded-2xl bg-slate-50 p-4">{detail.data.pages.map((page) => <article key={page.pageNumber} className="rounded-xl border border-slate-200 bg-white p-5"><div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500"><BookOpen className="h-4 w-4" />Page {page.pageNumber}</div><p className="whitespace-pre-wrap text-sm leading-7 text-slate-700">{page.content || "No extractable text on this page."}</p></article>)}</div> : null}
            </Card>

            <Card className="p-6">
              <div className="flex items-center gap-3"><Bot className="h-5 w-5 text-indigo-600" /><div><h3 className="font-semibold">Ask the authorized library</h3><p className="text-xs text-slate-500">Responses cite retrieved document pages; document text is treated as untrusted.</p></div></div>
              <Textarea className="mt-4 min-h-24" value={question} maxLength={500} onChange={(event) => setQuestion(event.target.value)} placeholder="What fees, risks, and termination terms should I understand?" />
              <div className="mt-3 flex flex-wrap gap-2"><Button disabled={!consent || question.trim().length < 2 || actions.chat.isPending} onClick={() => actions.chat.mutate({ query: question, documentId: selectedId ?? undefined, consent })}><Search className="mr-2 h-4 w-4" />{actions.chat.isPending ? "Retrieving…" : "Ask with evidence"}</Button><Button variant="outline" disabled={!selectedId || !consent || actions.intelligence.isPending} onClick={() => actions.intelligence.mutate({ documentId: selectedId!, consent })}><Sparkles className="mr-2 h-4 w-4" />Extract intelligence</Button><Button variant="outline" disabled={compareIds.length < 2 || !consent || actions.compare.isPending} onClick={() => actions.compare.mutate({ documentIds: compareIds, consent })}><GitCompareArrows className="mr-2 h-4 w-4" />Compare {compareIds.length || ""}</Button></div>
              {actions.chat.data ? <div className="mt-5 rounded-2xl border border-indigo-100 bg-indigo-50/60 p-5"><div className="flex items-center justify-between gap-3"><h4 className="font-semibold text-indigo-950">Evidence-backed answer</h4><Badge variant="outline">{actions.chat.data.mode.replace("_", " ")}</Badge></div><p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-800">{actions.chat.data.answer}</p><p className="mt-3 text-xs text-slate-500">{actions.chat.data.disclaimer}</p><div className="mt-4"><Evidence passages={actions.chat.data.passages} /></div></div> : null}
            </Card>

            {actions.intelligence.data ? <Card className="p-6"><div className="flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-emerald-600" /><h3 className="font-semibold">Financial intelligence</h3></div><div className="mt-5 space-y-5">{actions.intelligence.data.findings.map((finding) => <section key={finding.category}><h4 className="mb-3 text-sm font-semibold text-slate-950">{finding.label}</h4><Evidence passages={finding.passages} /></section>)}</div><p className="mt-5 rounded-xl bg-amber-50 p-4 text-xs leading-5 text-amber-900">{actions.intelligence.data.halalResearchNotice}</p></Card> : null}

            {actions.compare.data ? <Card className="p-6"><h3 className="font-semibold">Evidence comparison</h3><p className="mt-2 text-xs text-slate-500">{actions.compare.data.notice}</p><div className="mt-5 space-y-6">{actions.compare.data.dimensions.map((dimension) => <section key={dimension.label}><h4 className="mb-3 text-sm font-semibold">{dimension.label}</h4><div className="grid gap-3 lg:grid-cols-2">{Object.entries(dimension.evidenceByDocument).map(([id, passages]) => <div key={id} className="rounded-2xl bg-slate-50 p-4"><p className="mb-3 truncate text-xs font-semibold text-slate-600">{documents.find((document) => document.id === id)?.fileName ?? id}</p><Evidence passages={passages} /></div>)}</div></section>)}</div></Card> : null}
          </div>
        </section>
      </div>
    </Layout>
  );
}
