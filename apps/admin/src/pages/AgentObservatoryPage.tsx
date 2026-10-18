import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AdminStatusBadge,
  DetailList,
  EmptyState,
  ErrorState,
  InlineNotice,
  LoadingState,
  MetricCard,
  SectionPanel,
  TimelinePanel
} from "@/components/console/primitives";
import { AdminStage, AdminStagger, AdminStaggerItem } from "@/components/motion/primitives";
import { getAgentObservatory } from "@/lib/api";
import { formatCount, formatDateTime } from "@/lib/format";
import type { AgentExecutionTrace, AgentTraceStatus } from "@/lib/types";
import { mapStatusToTone, useConfiguredSessionGuard } from "./shared";

const humanize = (value: string) =>
  value.replace(/_/gu, " ").replace(/\b\w/gu, (letter) => letter.toUpperCase());
const duration = (value: number | null) =>
  value === null ? "Unavailable" : `${formatCount(value)} ms`;

export function AgentObservatoryPage() {
  const { session, fallback } = useConfiguredSessionGuard();
  const [hours, setHours] = useState(168);
  const [agentId, setAgentId] = useState("");
  const [status, setStatus] = useState<AgentTraceStatus | "">("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const observatory = useQuery({
    queryKey: ["operator-agent-observatory", session?.baseUrl, hours, agentId, status],
    queryFn: () => getAgentObservatory(session!, {
      hours,
      limit: 200,
      agentId: agentId || undefined,
      status: status || undefined
    }),
    enabled: Boolean(session)
  });

  useEffect(() => {
    const traces = observatory.data?.traces ?? [];
    if (traces.length && !traces.some((trace) => trace.id === selectedId)) setSelectedId(traces[0].id);
    if (!traces.length) setSelectedId(null);
  }, [observatory.data, selectedId]);

  const selected = useMemo(
    () => observatory.data?.traces.find((trace) => trace.id === selectedId) ?? null,
    [observatory.data, selectedId]
  );

  if (fallback) return fallback;
  if (observatory.isLoading) return <LoadingState title="Loading AI agent diagnostics" description="Sanitized execution metadata, evidence lineage, and provider usage are loading." />;
  if (observatory.isError || !observatory.data) return <ErrorState title="AI agent diagnostics unavailable" description="The authorized observability endpoint could not return recorded execution metadata." />;
  const data = observatory.data;

  return (
    <AdminStage className="admin-page-grid">
      <SectionPanel title="AI Agent Observatory" description="Authorized, sanitized diagnostics for customer and worker AI workflows. No raw prompts, credentials, balances, or model output are exposed.">
        <InlineNotice title="Operator-only diagnostic scope" description={data.securityNote} tone="technical" />
        <AdminStagger className="admin-metrics-grid" delay={0.08}>
          <AdminStaggerItem><MetricCard label="Recorded executions" value={formatCount(data.metrics.recordedExecutionCount)} detail={`${formatCount(data.metrics.succeededCount)} succeeded · ${formatCount(data.metrics.fallbackCount)} fallback`} /></AdminStaggerItem>
          <AdminStaggerItem><MetricCard label="Execution errors" value={`${data.metrics.errorRatePercent}%`} detail={`${formatCount(data.metrics.failedCount)} failed`} /></AdminStaggerItem>
          <AdminStaggerItem><MetricCard label="Average latency" value={duration(data.metrics.averageLatencyMs)} detail={`P95 ${duration(data.metrics.p95LatencyMs)}`} /></AdminStaggerItem>
          <AdminStaggerItem><MetricCard label="Provider tokens" value={data.metrics.tokenUsage.totalTokens === null ? "Unavailable" : formatCount(data.metrics.tokenUsage.totalTokens)} detail={`${formatCount(data.metrics.tokenUsage.executionsWithUsage)} run(s) reported usage`} /></AdminStaggerItem>
          <AdminStaggerItem><MetricCard label="Estimated cost" value={data.metrics.tokenUsage.estimatedCostUsd === null ? "Unavailable" : `$${data.metrics.tokenUsage.estimatedCostUsd.toFixed(4)}`} detail={data.metrics.tokenUsage.note} /></AdminStaggerItem>
        </AdminStagger>
      </SectionPanel>

      <SectionPanel title="Filters and activity trend" description="All values come from bounded AuditEvent trace records in the selected window.">
        <div className="admin-form-grid">
          <label className="admin-field"><span>Time window</span><select value={hours} onChange={(event) => setHours(Number(event.target.value))}><option value={24}>24 hours</option><option value={168}>7 days</option><option value={720}>30 days</option></select></label>
          <label className="admin-field"><span>Agent or service</span><select value={agentId} onChange={(event) => setAgentId(event.target.value)}><option value="">All registered agents</option>{data.registry.map((agent) => <option key={agent.id} value={agent.id}>{agent.name}</option>)}</select></label>
          <label className="admin-field"><span>Run status</span><select value={status} onChange={(event) => setStatus(event.target.value as AgentTraceStatus | "")}><option value="">All statuses</option><option value="succeeded">Succeeded</option><option value="fallback">Fallback</option><option value="failed">Failed</option></select></label>
        </div>
        <div className="admin-list" style={{ marginTop: "1rem" }}>
          {data.trends.length ? data.trends.map((bucket) => <div key={bucket.bucket} className="admin-list-row"><div><strong>{formatDateTime(bucket.bucket)}</strong><p className="admin-copy">Average latency {duration(bucket.averageLatencyMs)}</p></div><span>{bucket.executions} runs · {bucket.failures} failed · {bucket.fallbacks} fallback</span></div>) : <EmptyState title="No recorded activity" description="No execution records match this window. Historical runs are never fabricated." />}
        </div>
      </SectionPanel>

      <SectionPanel title="Agent registry" description="Capabilities, execution modes, bounded tools, and operational status from real recorded activity.">
        <div className="admin-two-column">
          {data.registry.map((agent) => <div key={agent.id} className="admin-list-card"><div className="admin-panel-header"><h3>{agent.name}</h3><AdminStatusBadge label={humanize(agent.operationalStatus)} tone={agent.operationalStatus === "degraded" ? "critical" : agent.operationalStatus === "operational" ? "positive" : "neutral"} /></div><p className="admin-copy">{agent.description}</p><DetailList items={[{ label: "Modes", value: agent.executionModes.map(humanize).join(", ") }, { label: "Tools", value: agent.tools.map(humanize).join(" → ") }, { label: "Capabilities", value: agent.capabilities.join(", ") }, { label: "Last execution", value: agent.lastExecutionAt ? formatDateTime(agent.lastExecutionAt) : "No recorded activity" }]} /></div>)}
        </div>
      </SectionPanel>

      <SectionPanel title="Execution traces" description="Select a run to inspect its sanitized workflow timeline and grounding decisions.">
        <div className="admin-two-column">
          <div className="admin-list-card"><h3>Recorded runs</h3><div className="admin-list">{data.traces.length ? data.traces.map((trace) => <button key={trace.id} type="button" className={`admin-list-row admin-filter-chip${trace.id === selectedId ? " active" : ""}`} onClick={() => setSelectedId(trace.id)}><div><strong>{trace.agentName}</strong><p className="admin-copy">{humanize(trace.workflow)} · {formatDateTime(trace.startedAt)}</p></div><AdminStatusBadge label={trace.status} tone={mapStatusToTone(trace.status)} /></button>) : <EmptyState title="No execution traces" description="No sanitized traces match the active filters." />}</div></div>
          {selected ? <TraceInspector trace={selected} /> : <EmptyState title="No run selected" description="Select a recorded execution to inspect its stages." />}
        </div>
      </SectionPanel>

      <SectionPanel title="Error and fallback monitoring" description="Sanitized provider failures, bounded fallback events, rate limits, and incomplete executions.">
        <div className="admin-list">{data.errors.length ? data.errors.map((item) => <div key={item.category} className="admin-list-row"><div><strong>{humanize(item.category)}</strong><p className="admin-copy">Latest {formatDateTime(item.latestAt)}</p></div><AdminStatusBadge label={`${item.count} event(s)`} tone="warning" /></div>) : <EmptyState title="No recorded errors" description="No failures or fallback events were recorded in this window." />}</div>
        <p className="admin-copy">{data.retentionNote}</p>
      </SectionPanel>
    </AdminStage>
  );
}

function TraceInspector({ trace }: { trace: AgentExecutionTrace }) {
  return <div className="admin-page-grid"><div className="admin-list-card"><h3>Run detail</h3><DetailList items={[{ label: "Agent", value: trace.agentName }, { label: "Mode", value: humanize(trace.mode) }, { label: "Actor", value: humanize(trace.actorType) }, { label: "Duration", value: duration(trace.durationMs) }, { label: "Provider", value: trace.providerUsage.providerName ?? "Unavailable" }, { label: "Tokens", value: trace.providerUsage.totalTokens === null ? "Unavailable" : formatCount(trace.providerUsage.totalTokens) }, { label: "Estimated cost", value: trace.providerUsage.estimatedCostUsd === null ? "Unavailable" : `$${trace.providerUsage.estimatedCostUsd.toFixed(4)}` }]} /></div><TimelinePanel title="Workflow stages" description="Only total workflow duration is guaranteed; internal stage duration is unavailable unless directly measured." events={trace.steps.map((step, index) => ({ id: `${step.id}:${index}`, label: step.label, description: step.outputSummary, tone: step.status === "failed" ? "critical" : step.status === "fallback" ? "warning" : "positive", metadata: [{ label: "kind", value: step.kind }, { label: "tool", value: step.toolName ?? "internal" }, { label: "duration", value: duration(step.durationMs) }, ...(step.failureReason ? [{ label: "reason", value: step.failureReason }] : [])] }))} emptyState={{ title: "No stages recorded", description: "This execution ended before a safe stage summary was available." }} /><div className="admin-list-card"><h3>Evidence inspector</h3><div className="admin-list">{trace.evidence.length ? trace.evidence.map((item, index) => <div key={`${item.evidenceId}:${index}`} className="admin-list-row"><div><strong className="admin-ref">{item.evidenceId}</strong><p className="admin-copy">{item.sourceLabel} · {humanize(item.sourceType)} · {item.synthetic ? "synthetic" : "verified"}</p></div><AdminStatusBadge label={item.groundingDecision} tone={item.groundingDecision === "rejected" ? "warning" : "technical"} /></div>) : <EmptyState title="No evidence identifiers" description="This recorded execution did not attach evidence lineage." />}</div></div></div>;
}
