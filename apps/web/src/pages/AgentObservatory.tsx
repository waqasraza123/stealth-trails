import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Bot,
  Clock3,
  Coins,
  Database,
  ShieldCheck,
  Workflow,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Layout } from "@/components/Layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { LoadingPanel } from "@/components/ui/loading-panel";
import {
  useAgentObservatory,
  type AgentExecutionTrace,
  type AgentTraceStatus,
} from "@/hooks/ai/useAgentObservatory";
import { readApiErrorMessage } from "@/lib/api";
import { cn } from "@/lib/utils";

const dateTime = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value))
    : "Unavailable";
const latency = (value: number | null) => (value === null ? "Unavailable" : `${value.toLocaleString()} ms`);
const titleCase = (value: string) => value.replace(/_/gu, " ").replace(/\b\w/gu, (letter) => letter.toUpperCase());

function Metric({ icon: Icon, label, value, detail }: { icon: typeof Activity; label: string; value: string; detail: string }) {
  return (
    <Card className="p-5">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-800"><Icon className="h-5 w-5" /></div>
      <p className="mt-4 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-950">{value}</p>
      <p className="mt-2 text-xs leading-5 text-slate-500">{detail}</p>
    </Card>
  );
}

function statusClass(status: AgentTraceStatus | "operational" | "degraded" | "no_recorded_activity") {
  return status === "failed" || status === "degraded"
    ? "border-rose-200 bg-rose-50 text-rose-800"
    : status === "fallback"
      ? "border-amber-200 bg-amber-50 text-amber-800"
      : status === "no_recorded_activity"
        ? "border-slate-200 bg-slate-50 text-slate-600"
        : "border-emerald-200 bg-emerald-50 text-emerald-800";
}

export default function AgentObservatory() {
  const [hours, setHours] = useState(168);
  const [agentId, setAgentId] = useState("");
  const [status, setStatus] = useState<AgentTraceStatus | "">("");
  const observatory = useAgentObservatory({ hours, agentId: agentId || undefined, status: status || undefined });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const data = observatory.data;

  useEffect(() => {
    if (data?.traces.length && !data.traces.some((trace) => trace.id === selectedId)) setSelectedId(data.traces[0].id);
    if (data && data.traces.length === 0) setSelectedId(null);
  }, [data, selectedId]);

  const selected = useMemo(() => data?.traces.find((trace) => trace.id === selectedId) ?? null, [data, selectedId]);
  const selectedAgent = data?.registry.find((agent) => agent.id === (selected?.agentId || agentId)) ?? data?.registry[0];

  if (observatory.isLoading) return <Layout><LoadingPanel title="Opening AI Agent Observatory" description="Loading sanitized, customer-scoped execution records." /></Layout>;

  if (observatory.isError || !data) {
    return <Layout><Card className="p-8"><h2 className="text-xl font-semibold">Observatory unavailable</h2><p className="mt-2 text-slate-600">{readApiErrorMessage(observatory.error, "Recorded agent activity could not be loaded.")}</p></Card></Layout>;
  }

  return (
    <Layout>
      <div className="space-y-6">
        <section className="overflow-hidden rounded-[2rem] bg-slate-950 p-7 text-white">
          <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
            <div><p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-300">AI operations · customer scope</p><h2 className="mt-3 text-3xl font-semibold">Agent Observatory</h2><p className="mt-3 max-w-3xl text-sm leading-7 text-white/70">Inspect real recorded runs, bounded workflow stages, evidence lineage, latency, failures, fallbacks, and provider-reported usage. Raw prompts and private financial values are excluded.</p></div>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-sm text-white/75"><ShieldCheck className="mb-2 h-5 w-5 text-emerald-300" />{data.securityNote}</div>
          </div>
        </section>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <Metric icon={Activity} label="Recorded runs" value={data.metrics.recordedExecutionCount.toLocaleString()} detail={`${data.metrics.succeededCount} succeeded · ${data.metrics.fallbackCount} fallback`} />
          <Metric icon={AlertTriangle} label="Error rate" value={`${data.metrics.errorRatePercent}%`} detail={`${data.metrics.failedCount} failed execution${data.metrics.failedCount === 1 ? "" : "s"}`} />
          <Metric icon={Clock3} label="Average latency" value={latency(data.metrics.averageLatencyMs)} detail={`P95 ${latency(data.metrics.p95LatencyMs)}`} />
          <Metric icon={Bot} label="Reported tokens" value={data.metrics.tokenUsage.totalTokens?.toLocaleString() ?? "Unavailable"} detail={`${data.metrics.tokenUsage.executionsWithUsage} run(s) exposed usage`} />
          <Metric icon={Coins} label="Estimated AI cost" value={data.metrics.tokenUsage.estimatedCostUsd === null ? "Unavailable" : `$${data.metrics.tokenUsage.estimatedCostUsd.toFixed(4)}`} detail={data.metrics.tokenUsage.note} />
        </div>

        <Card className="p-5">
          <div className="flex flex-wrap items-end gap-3">
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Window<select className="mt-2 block rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900" value={hours} onChange={(event) => setHours(Number(event.target.value))}><option value={24}>24 hours</option><option value={168}>7 days</option><option value={720}>30 days</option></select></label>
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Agent<select className="mt-2 block rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900" value={agentId} onChange={(event) => setAgentId(event.target.value)}><option value="">All agents</option>{data.registry.map((agent) => <option key={agent.id} value={agent.id}>{agent.name}</option>)}</select></label>
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Status<select className="mt-2 block rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900" value={status} onChange={(event) => setStatus(event.target.value as AgentTraceStatus | "")}><option value="">All statuses</option><option value="succeeded">Succeeded</option><option value="fallback">Fallback</option><option value="failed">Failed</option></select></label>
            <Button variant="outline" onClick={() => observatory.refetch()}>Refresh records</Button>
          </div>
        </Card>

        <div className="grid gap-6 xl:grid-cols-[1.25fr_.75fr]">
          <Card className="p-6"><div className="flex items-center justify-between"><div><h3 className="text-lg font-semibold">Recorded activity</h3><p className="text-sm text-slate-500">Execution, failure, and fallback counts by recorded time bucket.</p></div><Activity className="h-5 w-5 text-emerald-600" /></div><div className="mt-5 h-72">{data.trends.length ? <ResponsiveContainer width="100%" height="100%"><AreaChart data={data.trends}><defs><linearGradient id="runFill" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10b981" stopOpacity={0.35}/><stop offset="95%" stopColor="#10b981" stopOpacity={0}/></linearGradient></defs><CartesianGrid strokeDasharray="3 3" vertical={false}/><XAxis dataKey="bucket" tickFormatter={(value) => new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric" })}/><YAxis allowDecimals={false}/><Tooltip labelFormatter={(value) => dateTime(String(value))}/><Area type="monotone" dataKey="executions" stroke="#059669" fill="url(#runFill)"/><Area type="monotone" dataKey="failures" stroke="#e11d48" fillOpacity={0}/><Area type="monotone" dataKey="fallbacks" stroke="#d97706" fillOpacity={0}/></AreaChart></ResponsiveContainer> : <div className="flex h-full items-center justify-center rounded-2xl bg-slate-50 text-sm text-slate-500">No recorded executions in this window.</div>}</div></Card>
          <Card className="p-6"><h3 className="text-lg font-semibold">Workflow map</h3><p className="mt-1 text-sm text-slate-500">Declared bounded processing path for {selectedAgent?.name ?? "the selected agent"}.</p><div className="mt-5 space-y-2">{selectedAgent?.tools.map((tool, index) => <div key={tool} className="flex items-center gap-3"><span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-950 text-xs font-semibold text-white">{index + 1}</span><div className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium">{titleCase(tool)}</div>{index < selectedAgent.tools.length - 1 ? <Workflow className="h-4 w-4 text-slate-400" /> : null}</div>)}</div></Card>
        </div>

        <Card className="p-6"><div className="flex items-center justify-between"><div><h3 className="text-lg font-semibold">Agent registry</h3><p className="text-sm text-slate-500">Execution modes and status derive from this window's recorded runs.</p></div><Bot className="h-5 w-5 text-indigo-600" /></div><div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{data.registry.map((agent) => <button key={agent.id} type="button" onClick={() => setAgentId(agent.id)} className="rounded-2xl border border-slate-200 p-4 text-left transition hover:border-slate-400 hover:shadow-sm"><div className="flex items-start justify-between gap-3"><strong>{agent.name}</strong><Badge variant="outline" className={statusClass(agent.operationalStatus)}>{titleCase(agent.operationalStatus)}</Badge></div><p className="mt-2 text-sm leading-6 text-slate-600">{agent.description}</p><div className="mt-3 flex flex-wrap gap-2">{agent.executionModes.map((mode) => <Badge key={mode} variant="outline">{titleCase(mode)}</Badge>)}</div><p className="mt-3 text-xs text-slate-500">Last run: {dateTime(agent.lastExecutionAt)}</p></button>)}</div></Card>

        <div className="grid gap-6 xl:grid-cols-[.8fr_1.2fr]">
          <Card className="p-6"><h3 className="text-lg font-semibold">Execution traces</h3><p className="mt-1 text-sm text-slate-500">Select a sanitized record to inspect its actual timeline.</p><div className="mt-4 max-h-[34rem] space-y-2 overflow-auto">{data.traces.length ? data.traces.map((trace) => <button key={trace.id} type="button" onClick={() => setSelectedId(trace.id)} className={cn("w-full rounded-xl border p-4 text-left", selectedId === trace.id ? "border-slate-950 bg-slate-50" : "border-slate-200")}><div className="flex items-start justify-between gap-2"><strong className="text-sm">{trace.agentName}</strong><Badge variant="outline" className={statusClass(trace.status)}>{trace.status}</Badge></div><p className="mt-1 text-xs text-slate-500">{titleCase(trace.workflow)} · {latency(trace.durationMs)}</p><p className="mt-1 text-xs text-slate-400">{dateTime(trace.startedAt)}</p></button>) : <div className="rounded-2xl bg-slate-50 p-6 text-center text-sm text-slate-500">No executions have been recorded for these filters. The Observatory does not synthesize prior runs.</div>}</div></Card>
          <Card className="p-6"><h3 className="text-lg font-semibold">Run detail</h3>{selected ? <RunDetail trace={selected} /> : <p className="mt-4 rounded-2xl bg-slate-50 p-6 text-sm text-slate-500">Select a recorded run to inspect workflow stages and evidence.</p>}</Card>
        </div>

        <Card className="p-6"><div className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-rose-600"/><h3 className="text-lg font-semibold">Error monitoring</h3></div><div className="mt-4 grid gap-3 md:grid-cols-3">{data.errors.length ? data.errors.map((error) => <div key={error.category} className="rounded-xl border border-rose-100 bg-rose-50 p-4"><strong className="text-sm text-rose-900">{titleCase(error.category)}</strong><p className="mt-1 text-sm text-rose-700">{error.count} event(s) · latest {dateTime(error.latestAt)}</p></div>) : <p className="text-sm text-slate-500">No failures or fallback events were recorded in this window.</p>}</div><p className="mt-5 text-xs leading-5 text-slate-500">{data.retentionNote}</p></Card>
      </div>
    </Layout>
  );
}

function RunDetail({ trace }: { trace: AgentExecutionTrace }) {
  return <div className="mt-4 space-y-6"><div className="grid gap-3 sm:grid-cols-3"><div className="rounded-xl bg-slate-50 p-3"><span className="text-xs text-slate-500">Mode</span><p className="mt-1 text-sm font-semibold">{titleCase(trace.mode)}</p></div><div className="rounded-xl bg-slate-50 p-3"><span className="text-xs text-slate-500">Duration</span><p className="mt-1 text-sm font-semibold">{latency(trace.durationMs)}</p></div><div className="rounded-xl bg-slate-50 p-3"><span className="text-xs text-slate-500">Tokens</span><p className="mt-1 text-sm font-semibold">{trace.providerUsage.totalTokens?.toLocaleString() ?? "Unavailable"}</p></div></div><div><h4 className="text-sm font-semibold">Execution timeline</h4><div className="mt-3 space-y-3">{trace.steps.map((step, index) => <div key={`${step.id}:${index}`} className="relative border-l-2 border-slate-200 pb-3 pl-5"><span className={cn("absolute -left-[7px] top-1 h-3 w-3 rounded-full border-2 border-white", step.status === "failed" ? "bg-rose-500" : step.status === "fallback" ? "bg-amber-500" : "bg-emerald-500")}/><div className="flex flex-wrap items-start justify-between gap-2"><div><strong className="text-sm">{step.label}</strong><p className="mt-1 text-xs text-slate-500">{titleCase(step.kind)}{step.toolName ? ` · ${titleCase(step.toolName)}` : ""} · {latency(step.durationMs)}</p></div><Badge variant="outline" className={statusClass(step.status)}>{step.status}</Badge></div><p className="mt-2 text-sm leading-6 text-slate-600">{step.outputSummary}</p>{step.failureReason ? <p className="mt-1 text-xs text-rose-700">Reason: {titleCase(step.failureReason)}</p> : null}</div>)}</div></div><div><div className="flex items-center gap-2"><Database className="h-4 w-4 text-indigo-600"/><h4 className="text-sm font-semibold">Evidence inspector</h4></div><div className="mt-3 space-y-2">{trace.evidence.length ? trace.evidence.map((item, index) => <div key={`${item.evidenceId}:${index}`} className="rounded-xl border border-slate-200 p-3"><div className="flex flex-wrap items-center justify-between gap-2"><strong className="break-all text-xs">{item.evidenceId}</strong><Badge variant="outline">{item.groundingDecision}</Badge></div><p className="mt-1 text-sm text-slate-700">{item.sourceLabel}</p><p className="mt-1 text-xs text-slate-500">{titleCase(item.sourceType)} · {item.synthetic ? "Hypothetical/synthetic" : "Verified source"} · {dateTime(item.observedAt)}</p></div>) : <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">No evidence identifiers were attached to this recorded run.</p>}</div></div></div>;
}
