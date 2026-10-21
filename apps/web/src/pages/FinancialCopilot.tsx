import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "react-router-dom";
import {
  Bot,
  BrainCircuit,
  CheckCircle2,
  Clock3,
  Database,
  MessageSquarePlus,
  Send,
  ShieldCheck,
  Sparkles,
  UserRound,
} from "lucide-react";
import { Layout } from "@/components/Layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { LoadingPanel } from "@/components/ui/loading-panel";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import {
  streamCopilotMessage,
  useCopilotConversation,
  useFinancialCopilot,
  type CopilotMessage,
} from "@/hooks/ai/useFinancialCopilot";
import { readApiErrorMessage } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useUserStore } from "@/stores/userStore";
import type { PortfolioRiskInput } from "@/hooks/ai/usePortfolioRiskLab";

const formatDate = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat("en-US", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(value))
    : "Timestamp unavailable";

function MessageCard({
  message,
  onAsk,
}: {
  message: CopilotMessage;
  onAsk: (question: string) => void;
}) {
  const assistant = message.role === "assistant";
  return (
    <div className={cn("flex gap-3", assistant ? "justify-start" : "justify-end")}>
      {assistant ? (
        <div className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-800">
          <Bot className="h-4 w-4" />
        </div>
      ) : null}
      <div className={cn("max-w-[88%]", assistant ? "space-y-3" : "")}>
        <div
          className={cn(
            "rounded-[1.35rem] px-4 py-3 text-sm leading-7",
            assistant
              ? "border border-slate-200 bg-white text-slate-700"
              : "bg-slate-950 text-white",
          )}
        >
          {assistant && message.mode ? (
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <Badge variant={message.mode === "ai_prioritized" ? "default" : "outline"}>
                {message.mode === "ai_prioritized"
                  ? "Live AI prioritized"
                  : "Deterministic preview"}
              </Badge>
              {message.providerName ? (
                <span className="text-[11px] text-slate-500">
                  {message.providerName}
                </span>
              ) : null}
            </div>
          ) : null}
          <p className="whitespace-pre-wrap">{message.content || "Thinking from verified sources…"}</p>
        </div>

        {assistant && message.citations.length > 0 ? (
          <div className="grid gap-2 sm:grid-cols-2">
            {message.citations.map((citation) => (
              <div
                key={citation.id}
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600"
              >
                <div className="flex items-center gap-2 font-semibold text-slate-800">
                  <Database className="h-3.5 w-3.5 text-emerald-700" />
                  {citation.label}
                </div>
                <p className="mt-1">
                  {citation.synthetic ? "Synthetic example" : "Verified source"} ·{" "}
                  {formatDate(citation.observedAt)}
                </p>
                {citation.evidenceId ? (
                  <p className="mt-1 font-mono text-[10px] text-slate-500">
                    Evidence {citation.evidenceId}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}

        {assistant && (message.memoryInfluences?.length ?? 0) > 0 ? (
          <div className="rounded-xl border border-violet-200 bg-violet-50 p-3 text-xs text-violet-950">
            <div className="flex items-center gap-2 font-semibold"><BrainCircuit className="h-3.5 w-3.5" /> Preferences that influenced this response</div>
            <ul className="mt-2 space-y-1">{message.memoryInfluences?.map((item) => <li key={item.id}>• {item.summary} <span className="text-violet-600">({item.source.replace(/_/gu, " ")})</span></li>)}</ul>
          </div>
        ) : null}

        {assistant && message.disclaimer ? (
          <p className="px-1 text-[11px] leading-5 text-slate-500">
            {message.disclaimer}
          </p>
        ) : null}
        {assistant && message.suggestedQuestions.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {message.suggestedQuestions.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => onAsk(suggestion)}
                className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-left text-xs text-emerald-900 hover:bg-emerald-100"
              >
                {suggestion}
              </button>
            ))}
          </div>
        ) : null}
      </div>
      {!assistant ? (
        <div className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-200 text-slate-700">
          <UserRound className="h-4 w-4" />
        </div>
      ) : null}
    </div>
  );
}

export default function FinancialCopilot() {
  const location = useLocation();
  const riskLabState = location.state as
    | {
        portfolioRiskContext?: PortfolioRiskInput;
        suggestedPrompt?: string;
      }
    | null;
  const token = useUserStore((state) => state.token);
  const queryClient = useQueryClient();
  const dashboard = useFinancialCopilot();
  const [conversationId, setConversationId] = useState<string | null>(null);
  const conversation = useCopilotConversation(conversationId);
  const [messages, setMessages] = useState<CopilotMessage[]>([]);
  const [question, setQuestion] = useState(riskLabState?.suggestedPrompt ?? "");
  const [externalAiOptIn, setExternalAiOptIn] = useState(false);
  const [searchDocuments, setSearchDocuments] = useState(false);
  const [approveMemoryChange, setApproveMemoryChange] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (conversation.data && !sending) setMessages(conversation.data.messages);
  }, [conversation.data, sending]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (dashboard.isLoading) {
    return (
      <Layout>
        <LoadingPanel
          title="Opening Financial Copilot"
          description="Loading customer-isolated conversation history and AI capabilities."
        />
      </Layout>
    );
  }

  if (dashboard.isError || !dashboard.data) {
    return (
      <Layout>
        <Card className="p-6">
          <h2 className="text-xl font-semibold text-slate-950">Copilot unavailable</h2>
          <p className="mt-2 text-sm text-slate-600">
            {readApiErrorMessage(dashboard.error, "The copilot workspace could not be loaded.")}
          </p>
        </Card>
      </Layout>
    );
  }

  const capabilities = dashboard.data.capabilities;
  const startNew = () => {
    setConversationId(null);
    setMessages([]);
    setQuestion("");
    setError(null);
  };
  const selectConversation = (id: string) => {
    if (sending) return;
    setConversationId(id);
    setMessages([]);
    setError(null);
  };
  const ask = async (prompt?: string) => {
    const content = (prompt ?? question).trim();
    if (!content || !token || sending) return;
    setQuestion("");
    setError(null);
    setSending(true);
    const now = new Date().toISOString();
    const userMessage: CopilotMessage = {
      id: `local-user-${now}`,
      role: "user",
      content,
      createdAt: now,
      mode: null,
      providerName: null,
      citations: [],
      suggestedQuestions: [],
      disclaimer: null,
      memoryInfluences: [],
    };
    const assistantId = `local-assistant-${now}`;
    const assistantMessage: CopilotMessage = {
      id: assistantId,
      role: "assistant",
      content: "",
      createdAt: now,
      mode: externalAiOptIn ? "ai_prioritized" : "deterministic_preview",
      providerName: null,
      citations: [],
      suggestedQuestions: [],
      disclaimer: null,
      memoryInfluences: [],
    };
    setMessages((current) => [...current, userMessage, assistantMessage]);
    try {
      const result = await streamCopilotMessage({
        token,
        conversationId: conversationId ?? undefined,
        message: content,
        externalAiOptIn,
        approveMemoryChange,
        searchDocuments,
        portfolioRiskContext: riskLabState?.portfolioRiskContext,
        onDelta: (delta) =>
          setMessages((current) =>
            current.map((message) =>
              message.id === assistantId
                ? { ...message, content: `${message.content}${delta}` }
                : message,
            ),
          ),
      });
      setMessages((current) =>
        current.map((message) =>
          message.id === assistantId ? result.message : message,
        ),
      );
      setConversationId(result.conversation.id);
      setApproveMemoryChange(false);
      await queryClient.invalidateQueries({ queryKey: ["financial-copilot"] });
    } catch (requestError) {
      setMessages((current) => current.filter((message) => message.id !== assistantId));
      setError(readApiErrorMessage(requestError, "The copilot could not answer right now."));
    } finally {
      setSending(false);
    }
  };

  return (
    <Layout>
      <div className="space-y-5">
        <Card className="overflow-hidden border-slate-800 bg-slate-950 p-6 text-white">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(52,211,153,0.18),transparent_35%)]" />
          <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300">
                <Sparkles className="h-4 w-4" /> AI Financial Copilot
              </div>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight">
                Ask your finances. See the evidence.
              </h2>
              <p className="mt-3 text-sm leading-7 text-white/70">
                A conversational, read-only view across your account snapshot, Opportunity Hunter, Portfolio Risk Lab, halal screens, and Wealth Guardian history.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge className="bg-emerald-400 text-slate-950 hover:bg-emerald-400">
                <ShieldCheck className="mr-1 h-3.5 w-3.5" /> No transaction access
              </Badge>
              <Badge variant="outline" className="border-white/20 text-white">
                {capabilities.streamingSupported ? "Streaming enabled" : "Complete responses"}
              </Badge>
            </div>
          </div>
        </Card>

        <div className="grid min-h-[720px] gap-5 lg:grid-cols-[300px_minmax(0,1fr)]">
          <Card className="flex flex-col p-4">
            <Button onClick={startNew} className="w-full justify-start gap-2">
              <MessageSquarePlus className="h-4 w-4" /> New conversation
            </Button>
            <div className="mt-5 flex items-center justify-between px-1">
              <h3 className="text-sm font-semibold text-slate-950">History</h3>
              <Badge variant="outline">{dashboard.data.conversations.length}</Badge>
            </div>
            <ScrollArea className="mt-3 h-[390px] pr-3">
              <div className="space-y-2">
                {dashboard.data.conversations.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => selectConversation(item.id)}
                    className={cn(
                      "w-full rounded-xl border p-3 text-left transition-colors",
                      conversationId === item.id
                        ? "border-emerald-300 bg-emerald-50"
                        : "border-slate-200 bg-white hover:bg-slate-50",
                    )}
                  >
                    <p className="line-clamp-2 text-sm font-semibold text-slate-800">
                      {item.title}
                    </p>
                    <p className="mt-2 flex items-center gap-1 text-[11px] text-slate-500">
                      <Clock3 className="h-3 w-3" /> {formatDate(item.updatedAt)} · {item.messageCount} messages
                    </p>
                  </button>
                ))}
                {dashboard.data.conversations.length === 0 ? (
                  <p className="rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-500">
                    {dashboard.data.historyNote}
                  </p>
                ) : null}
              </div>
            </ScrollArea>

            <div className="mt-auto rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs leading-5 text-slate-600">
              <div className="flex items-center gap-2 font-semibold text-slate-800">
                <CheckCircle2 className="h-4 w-4 text-emerald-700" /> Secure AI boundary
              </div>
              <p className="mt-2">{capabilities.boundaryNote}</p>
            </div>
          </Card>

          <Card className="flex min-w-0 flex-col p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
              <div>
                <h3 className="font-semibold text-slate-950">
                  {conversation.data?.title ?? "New research conversation"}
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  Sources and observation times appear with every supported answer.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {riskLabState?.portfolioRiskContext ? (
                  <Badge className="bg-indigo-100 text-indigo-800 hover:bg-indigo-100">
                    <ShieldCheck className="mr-1 h-3.5 w-3.5" /> Risk Lab context attached
                  </Badge>
                ) : null}
                {conversationId ? (
                  <Button asChild size="sm" variant="outline">
                    <Link to={`/research-plans?conversationId=${encodeURIComponent(conversationId)}`}>
                      <Sparkles className="mr-1 h-3.5 w-3.5" /> Open Plan Studio
                    </Link>
                  </Button>
                ) : null}
                <Badge variant="outline">
                  <Database className="mr-1 h-3.5 w-3.5" /> Customer-isolated memory
                </Badge>
                <Button asChild size="sm" variant="outline"><Link to="/ai-memory"><BrainCircuit className="mr-1 h-3.5 w-3.5" />Manage memory</Link></Button>
              </div>
            </div>

            <ScrollArea className="h-[470px] py-5 pr-3">
              {conversation.isLoading && messages.length === 0 ? (
                <LoadingPanel title="Loading conversation" description="Retrieving this customer's stored turns." />
              ) : messages.length > 0 ? (
                <div className="space-y-5">
                  {messages.map((message) => (
                    <MessageCard
                      key={message.id}
                      message={message}
                      onAsk={(suggestion) => void ask(suggestion)}
                    />
                  ))}
                  <div ref={bottomRef} />
                </div>
              ) : (
                <div className="mx-auto max-w-2xl py-8 text-center">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-800">
                    <Bot className="h-6 w-6" />
                  </div>
                  <h3 className="mt-4 text-xl font-semibold text-slate-950">What would you like to understand?</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    Ask about balances, transactions, loans, staking, market research, halal screening, or your latest guardian report.
                  </p>
                  <div className="mt-5 grid gap-2 text-left sm:grid-cols-2">
                    {dashboard.data.suggestedQuestions.slice(0, 4).map((suggestion) => (
                      <button
                        key={suggestion}
                        type="button"
                        onClick={() => void ask(suggestion)}
                        className="rounded-xl border border-slate-200 bg-white p-3 text-sm leading-5 text-slate-700 hover:border-emerald-300 hover:bg-emerald-50"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </ScrollArea>

            {error ? (
              <p className="mb-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</p>
            ) : null}
            <div className="mt-auto rounded-[1.35rem] border border-slate-200 bg-slate-50 p-3">
              <Textarea
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void ask();
                  }
                }}
                placeholder="Ask a read-only financial research question…"
                rows={3}
                maxLength={1200}
                disabled={sending}
                className="resize-none border-0 bg-transparent shadow-none focus-visible:ring-0"
              />
              <div className="mt-2 flex flex-col gap-3 border-t border-slate-200 pt-3 sm:flex-row sm:items-end sm:justify-between">
                <div className="space-y-2">
                  <label className={cn("flex items-start gap-2 text-xs leading-5", !capabilities.externalAiAvailable && !capabilities.documentSearchAvailable && "opacity-55")}>
                    <Checkbox
                      checked={externalAiOptIn}
                      disabled={(!capabilities.externalAiAvailable && !capabilities.documentSearchAvailable) || sending}
                      onCheckedChange={(checked) => {
                        setExternalAiOptIn(checked === true);
                        if (checked !== true) setSearchDocuments(false);
                      }}
                    />
                    <span>
                      Allow configured external AI for this message
                      {!capabilities.externalAiAvailable && !capabilities.documentSearchAvailable ? " (unavailable here)" : ""}
                    </span>
                  </label>
                  <label className={cn("flex items-start gap-2 text-xs leading-5", !externalAiOptIn && "opacity-55")}>
                    <Checkbox
                      checked={searchDocuments}
                      disabled={!externalAiOptIn || !capabilities.documentSearchAvailable || sending}
                      onCheckedChange={(checked) => setSearchDocuments(checked === true)}
                    />
                    <span>Search my authorized document library; relevant extracted passages may be embedded externally{!capabilities.documentSearchAvailable ? " (unavailable here)" : ""}.</span>
                  </label>
                  <label className="flex items-start gap-2 text-xs leading-5">
                    <Checkbox checked={approveMemoryChange} disabled={sending} onCheckedChange={(checked) => setApproveMemoryChange(checked === true)} />
                    <span>Approve one explicit “remember…” or “forget…” request in this message. This resets after sending.</span>
                  </label>
                </div>
                <Button onClick={() => void ask()} disabled={!question.trim() || sending} className="gap-2">
                  <Send className="h-4 w-4" /> {sending ? "Researching…" : "Send"}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
