import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  Clock3,
  GitBranch,
  History,
  PauseCircle,
  Play,
  Plus,
  Save,
  Settings2,
  ShieldCheck,
  Trash2,
  Workflow,
  XCircle,
} from "lucide-react";
import { Layout } from "@/components/Layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadingPanel } from "@/components/ui/loading-panel";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  useCreateStarterWorkflow,
  useDeleteWorkflow,
  useRunWorkflow,
  useSaveWorkflow,
  useSetWorkflowEnabled,
  useWorkflowRunAction,
  useWorkflowStudio,
  type WorkflowDefinition,
  type WorkflowInput,
  type WorkflowNode,
  type WorkflowRun,
  type WorkflowSummary,
  type WorkflowToolType,
  type WorkflowTriggerType,
} from "@/hooks/ai/useWorkflowStudio";
import { readApiErrorMessage } from "@/lib/api";
import { cn } from "@/lib/utils";

type Draft = WorkflowInput;
const toolLabels: Record<WorkflowToolType, string> = {
  opportunity_hunter: "Opportunity Hunter",
  portfolio_risk: "Portfolio Risk Lab",
  halal_research: "Halal Research",
  document_intelligence: "Document Intelligence",
  financial_copilot: "Financial Copilot",
  investment_committee: "Investment Committee",
};

const emptyDraft = (): Draft => ({
  name: "New AI workflow",
  description: "",
  enabled: false,
  externalAiConsent: false,
  triggerType: "manual",
  maxConcurrentRuns: 1,
  timeoutSeconds: 30,
  retryLimit: 2,
  definition: {
    version: 1,
    entryNodeId: "opportunities",
    nodes: [{ id: "opportunities", type: "tool", tool: "opportunity_hunter", name: "Discover opportunities", config: {}, next: "end" }],
  },
});

function fromWorkflow(workflow: WorkflowSummary): Draft {
  return {
    name: workflow.name,
    description: workflow.description,
    enabled: workflow.enabled,
    externalAiConsent: workflow.externalAiConsent,
    triggerType: workflow.triggerType,
    intervalMinutes: workflow.intervalMinutes ?? undefined,
    maxConcurrentRuns: workflow.maxConcurrentRuns,
    timeoutSeconds: workflow.timeoutSeconds,
    retryLimit: workflow.retryLimit,
    definition: structuredClone(workflow.definition),
  };
}

const titleCase = (value: string) => value.replace(/_/gu, " ").replace(/\b\w/gu, (letter) => letter.toUpperCase());
const dateTime = (value: string | null) => value ? new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "—";

function statusClass(status: string) {
  if (status === "failed" || status === "cancelled") return "border-rose-200 bg-rose-50 text-rose-800";
  if (status === "awaiting_approval") return "border-amber-200 bg-amber-50 text-amber-800";
  if (status === "succeeded") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  return "border-indigo-200 bg-indigo-50 text-indigo-800";
}

export default function WorkflowStudio() {
  const query = useWorkflowStudio();
  const save = useSaveWorkflow();
  const starter = useCreateStarterWorkflow();
  const enabled = useSetWorkflowEnabled();
  const run = useRunWorkflow();
  const runAction = useWorkflowRunAction();
  const remove = useDeleteWorkflow();
  const { toast } = useToast();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [isNew, setIsNew] = useState(true);

  useEffect(() => {
    if (!query.data || selectedId || isNew) return;
    const first = query.data.workflows[0];
    if (first) {
      setSelectedId(first.id);
      setDraft(fromWorkflow(first));
      setIsNew(false);
    }
  }, [query.data, selectedId, isNew]);

  const selected = query.data?.workflows.find((workflow) => workflow.id === selectedId) ?? null;
  const selectedRun = query.data?.recentRuns.find((item) => item.id === selectedRunId)
    ?? query.data?.recentRuns.find((item) => item.workflowId === selectedId)
    ?? null;
  const workflowRuns = useMemo(() => query.data?.recentRuns.filter((item) => !selectedId || item.workflowId === selectedId) ?? [], [query.data, selectedId]);

  const choose = (workflow: WorkflowSummary) => {
    setSelectedId(workflow.id);
    setDraft(fromWorkflow(workflow));
    setIsNew(false);
    setSelectedRunId(null);
  };

  const beginNew = () => {
    setSelectedId(null);
    setDraft(emptyDraft());
    setIsNew(true);
    setSelectedRunId(null);
  };

  const notifyError = (error: unknown, fallback: string) => toast({ title: fallback, description: readApiErrorMessage(error, fallback), variant: "destructive" });

  const saveDraft = async () => {
    try {
      const result = await save.mutateAsync({ workflowId: isNew ? undefined : selectedId ?? undefined, input: draft });
      setSelectedId(result.id);
      setDraft(fromWorkflow(result));
      setIsNew(false);
      toast({ title: "Workflow saved", description: `Revision ${result.revision} is persisted and ready for worker execution.` });
    } catch (error) { notifyError(error, "Workflow could not be saved"); }
  };

  const patchDefinition = (definition: WorkflowDefinition) => setDraft((current) => ({ ...current, definition }));
  const patchNode = (nodeId: string, patch: Partial<WorkflowNode>) => patchDefinition({
    ...draft.definition,
    nodes: draft.definition.nodes.map((node) => node.id === nodeId ? ({ ...node, ...patch } as WorkflowNode) : node),
  });
  const addNode = (type: WorkflowNode["type"]) => {
    const id = `node-${Date.now().toString(36)}`;
    const node: WorkflowNode = type === "tool"
      ? { id, type, tool: "opportunity_hunter", name: "Research tool", config: {}, next: "end" }
      : type === "condition"
        ? { id, type, name: "Route by finding", sourceNodeId: draft.definition.entryNodeId, path: "dataset.reliability", operator: "eq", value: "live", ifTrue: "end", ifFalse: "end" }
        : { id, type, name: "Human review", prompt: "Review the persisted findings before this workflow continues.", next: "end" };
    patchDefinition({ ...draft.definition, nodes: [...draft.definition.nodes, node] });
  };
  const deleteNode = (nodeId: string) => {
    if (draft.definition.nodes.length === 1) return;
    const remaining = draft.definition.nodes.filter((node) => node.id !== nodeId).map((node) => {
      if (node.type === "condition") return { ...node, ifTrue: node.ifTrue === nodeId ? "end" : node.ifTrue, ifFalse: node.ifFalse === nodeId ? "end" : node.ifFalse };
      return { ...node, next: node.next === nodeId ? "end" : node.next };
    });
    patchDefinition({ ...draft.definition, entryNodeId: draft.definition.entryNodeId === nodeId ? remaining[0].id : draft.definition.entryNodeId, nodes: remaining });
  };

  if (query.isLoading) return <Layout><LoadingPanel title="Opening AI Agent Workflow Studio" description="Loading customer-owned definitions and durable execution history." /></Layout>;
  if (query.isError || !query.data) return <Layout><Card className="p-8"><h2 className="text-xl font-semibold">Workflow Studio unavailable</h2><p className="mt-2 text-slate-600">{readApiErrorMessage(query.error)}</p></Card></Layout>;

  return (
    <Layout>
      <div className="space-y-6">
        <section className="overflow-hidden rounded-[2rem] bg-slate-950 p-7 text-white">
          <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
            <div><p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-300">LangGraph · durable worker execution</p><h1 className="mt-3 text-3xl font-semibold">AI Agent Workflow Studio</h1><p className="mt-3 max-w-3xl text-sm leading-7 text-white/70">Compose real research agents, route on their persisted findings, pause for explicit approval, and inspect every worker step. Definitions and results remain customer-isolated in PostgreSQL.</p></div>
            <div className="max-w-sm rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-sm leading-6 text-white/75"><ShieldCheck className="mb-2 h-5 w-5 text-emerald-300" />{query.data.executionBoundary}</div>
          </div>
        </section>

        <div className="grid gap-4 md:grid-cols-3">
          {query.data.supportedTriggers.map((trigger) => <Card className="p-5" key={trigger.type}><div className="flex items-center justify-between"><strong className="text-sm">{titleCase(trigger.type)}</strong><Badge variant="outline" className={trigger.available ? statusClass("succeeded") : statusClass("failed")}>{trigger.available ? "Available" : "Unavailable"}</Badge></div><p className="mt-2 text-sm leading-6 text-slate-600">{trigger.detail}</p></Card>)}
        </div>

        <Card className="p-6"><div className="flex items-center gap-2"><Bot className="h-5 w-5 text-indigo-600" /><h2 className="text-lg font-semibold">Connected read-only tools</h2></div><div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{query.data.availableTools.map((tool) => <div className="rounded-2xl border border-slate-200 p-4" key={tool.type}><div className="flex items-start justify-between gap-2"><strong className="text-sm">{tool.name}</strong><Badge variant="outline" className={tool.available ? statusClass("succeeded") : statusClass("failed")}>{tool.available ? "Available" : "Unavailable"}</Badge></div><p className="mt-2 text-xs leading-5 text-slate-600">{tool.availability}</p><p className="mt-2 text-xs leading-5 text-slate-400">{tool.boundary}</p></div>)}</div></Card>

        <Card className="p-6">
          <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-semibold">Starter workflows</h2><p className="mt-1 text-sm text-slate-500">Created disabled so you can inspect consent, trigger, routing, and inputs first.</p></div><Button variant="outline" onClick={beginNew}><Plus className="mr-2 h-4 w-4" />Blank workflow</Button></div>
          <div className="mt-5 grid gap-4 lg:grid-cols-3">{query.data.starters.map((item) => <div key={item.id} className="rounded-2xl border border-slate-200 p-5"><div className="flex items-start justify-between gap-3"><strong>{item.name}</strong><Badge variant="outline">{titleCase(item.triggerType)}</Badge></div><p className="mt-2 text-sm leading-6 text-slate-600">{item.description}</p><p className="mt-3 text-xs text-slate-500">{item.definition.nodes.length} nodes · {item.externalAiConsent ? "External AI consent required" : "Deterministic by default"}</p><Button className="mt-4 w-full" variant="outline" disabled={starter.isPending} onClick={async () => { try { const result = await starter.mutateAsync({ starterId: item.id }); choose(result); } catch (error) { notifyError(error, "Starter could not be created"); } }}>Use starter</Button></div>)}</div>
        </Card>

        <div className="grid gap-6 xl:grid-cols-[.72fr_1.28fr]">
          <Card className="p-5">
            <div className="flex items-center justify-between"><div><h2 className="font-semibold">Your workflows</h2><p className="text-xs text-slate-500">Customer-owned definitions</p></div><Workflow className="h-5 w-5 text-indigo-600" /></div>
            <div className="mt-4 space-y-2">{query.data.workflows.map((workflow) => <button key={workflow.id} type="button" onClick={() => choose(workflow)} className={cn("w-full rounded-2xl border p-4 text-left", selectedId === workflow.id ? "border-slate-950 bg-slate-50" : "border-slate-200")}><div className="flex items-start justify-between gap-2"><strong className="text-sm">{workflow.name}</strong><Badge variant="outline" className={workflow.enabled ? statusClass("succeeded") : "border-slate-200 text-slate-600"}>{workflow.enabled ? "Enabled" : "Disabled"}</Badge></div><p className="mt-2 text-xs text-slate-500">{titleCase(workflow.triggerType)} · revision {workflow.revision} · {workflow.definition.nodes.length} nodes</p></button>)}{query.data.workflows.length === 0 ? <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">No workflows yet. Choose a starter or create a blank definition.</p> : null}</div>
          </Card>

          <Card className="p-6">
            <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[.16em] text-indigo-600">{isNew ? "Unsaved definition" : `Revision ${selected?.revision ?? "—"}`}</p><h2 className="mt-1 text-xl font-semibold">Workflow builder</h2></div><div className="flex flex-wrap gap-2">{selected ? <><Button variant="outline" disabled={enabled.isPending} onClick={async () => { try { const result = await enabled.mutateAsync({ workflowId: selected.id, enabled: !selected.enabled }); choose(result); } catch (error) { notifyError(error, "Workflow state could not be changed"); } }}>{selected.enabled ? "Disable" : "Enable"}</Button><Button variant="outline" disabled={!selected.enabled || run.isPending} onClick={async () => { try { const result = await run.mutateAsync(selected.id); setSelectedRunId(result.id); toast({ title: "Run queued", description: "The existing worker will claim this execution." }); } catch (error) { notifyError(error, "Run could not be queued"); } }}><Play className="mr-2 h-4 w-4" />Run</Button></> : null}<Button disabled={save.isPending} onClick={() => void saveDraft()}><Save className="mr-2 h-4 w-4" />{save.isPending ? "Saving…" : "Save"}</Button></div></div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <Field label="Name"><Input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></Field>
              <Field label="Trigger"><select className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm" value={draft.triggerType} onChange={(event) => { const triggerType = event.target.value as WorkflowTriggerType; setDraft({ ...draft, triggerType, intervalMinutes: triggerType === "schedule" ? draft.intervalMinutes ?? 10_080 : undefined, definition: { ...draft.definition, dataChangeSource: triggerType === "data_change" ? "financial_document_ready" : undefined } }); }}><option value="manual">Manual</option><option value="schedule">Recurring schedule</option><option value="data_change">Document ready</option></select></Field>
              <Field label="Description" wide><Textarea value={draft.description ?? ""} onChange={(event) => setDraft({ ...draft, description: event.target.value })} /></Field>
              {draft.triggerType === "schedule" ? <Field label="Interval minutes"><Input type="number" min={15} max={43200} value={draft.intervalMinutes ?? 10080} onChange={(event) => setDraft({ ...draft, intervalMinutes: Number(event.target.value) })} /></Field> : null}
              <Field label="Node timeout seconds"><Input type="number" min={5} max={45} value={draft.timeoutSeconds} onChange={(event) => setDraft({ ...draft, timeoutSeconds: Number(event.target.value) })} /></Field>
              <Field label="Retry limit"><Input type="number" min={0} max={4} value={draft.retryLimit} onChange={(event) => setDraft({ ...draft, retryLimit: Number(event.target.value) })} /></Field>
              <Field label="Concurrent runs"><Input type="number" min={1} max={3} value={draft.maxConcurrentRuns} onChange={(event) => setDraft({ ...draft, maxConcurrentRuns: Number(event.target.value) })} /></Field>
              <div className="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-3"><div><Label>External AI consent</Label><p className="mt-1 text-xs text-slate-500">Providers still obey availability and production gates.</p></div><Switch checked={draft.externalAiConsent} onCheckedChange={(value) => setDraft({ ...draft, externalAiConsent: value })} /></div>
            </div>

            <div className="mt-7 flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-semibold">Graph nodes</h3><p className="text-xs text-slate-500">Entry: {draft.definition.entryNodeId}</p></div><div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => addNode("tool")}><Bot className="mr-1 h-4 w-4" />Tool</Button><Button size="sm" variant="outline" onClick={() => addNode("condition")}><GitBranch className="mr-1 h-4 w-4" />Condition</Button><Button size="sm" variant="outline" onClick={() => addNode("approval")}><PauseCircle className="mr-1 h-4 w-4" />Approval</Button></div></div>
            <div className="mt-4 space-y-4">{draft.definition.nodes.map((node, index) => <NodeEditor key={node.id} node={node} index={index} definition={draft.definition} tools={query.data.availableTools.map((tool) => tool.type)} onPatch={(patch) => patchNode(node.id, patch)} onEntry={() => patchDefinition({ ...draft.definition, entryNodeId: node.id })} onDelete={() => deleteNode(node.id)} onError={(message) => toast({ title: "Invalid node configuration", description: message, variant: "destructive" })} />)}</div>

            {selected ? <div className="mt-6 flex justify-end"><Button variant="outline" className="text-rose-700" disabled={remove.isPending} onClick={async () => { if (!window.confirm(`Delete ${selected.name}? Historical runs will remain available.`)) return; try { await remove.mutateAsync(selected.id); beginNew(); } catch (error) { notifyError(error, "Workflow could not be deleted"); } }}><Trash2 className="mr-2 h-4 w-4" />Delete workflow</Button></div> : null}
          </Card>
        </div>

        <div className="grid gap-6 xl:grid-cols-[.75fr_1.25fr]">
          <Card className="p-6"><div className="flex items-center gap-2"><History className="h-5 w-5 text-indigo-600" /><h2 className="text-lg font-semibold">Execution history</h2></div><div className="mt-4 max-h-[38rem] space-y-2 overflow-auto">{workflowRuns.map((item) => <button key={item.id} type="button" onClick={() => setSelectedRunId(item.id)} className={cn("w-full rounded-xl border p-4 text-left", selectedRun?.id === item.id ? "border-slate-950 bg-slate-50" : "border-slate-200")}><div className="flex items-start justify-between gap-2"><strong className="text-sm">{item.workflowName}</strong><Badge variant="outline" className={statusClass(item.status)}>{titleCase(item.status)}</Badge></div><p className="mt-1 text-xs text-slate-500">{titleCase(item.triggerType)} · attempt {item.attempt}/{item.maxAttempts} · {dateTime(item.createdAt)}</p>{item.currentNodeId ? <p className="mt-1 text-xs text-indigo-600">Current node: {item.currentNodeId}</p> : null}</button>)}{workflowRuns.length === 0 ? <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">No persisted runs for this selection.</p> : null}</div></Card>
          <Card className="p-6"><h2 className="text-lg font-semibold">Run progress and findings</h2>{selectedRun ? <RunDetail run={selectedRun} busy={runAction.isPending} onAction={async (action) => { try { await runAction.mutateAsync({ runId: selectedRun.id, action }); toast({ title: action === "approve" ? "Approval recorded" : "Run cancelled", description: action === "approve" ? "The run will resume on the next worker tick." : "No additional nodes will start." }); } catch (error) { notifyError(error, "Run action failed"); } }} /> : <p className="mt-4 rounded-xl bg-slate-50 p-5 text-sm text-slate-500">Select a run to inspect node calls, failures, timing, and persisted output.</p>}</Card>
        </div>
      </div>
    </Layout>
  );
}

function Field({ label, wide = false, children }: { label: string; wide?: boolean; children: ReactNode }) {
  return <div className={wide ? "md:col-span-2" : ""}><Label>{label}</Label><div className="mt-2">{children}</div></div>;
}

function NodeEditor({ node, index, definition, tools, onPatch, onEntry, onDelete, onError }: { node: WorkflowNode; index: number; definition: WorkflowDefinition; tools: WorkflowToolType[]; onPatch: (patch: Partial<WorkflowNode>) => void; onEntry: () => void; onDelete: () => void; onError: (message: string) => void }) {
  const targets = [...definition.nodes.map((item) => item.id), "end"];
  const selectClass = "h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm";
  return <div className="rounded-2xl border border-slate-200 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div className="flex items-center gap-3"><span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-950 text-xs font-semibold text-white">{index + 1}</span><div><div className="flex items-center gap-2"><strong className="text-sm">{node.name}</strong>{definition.entryNodeId === node.id ? <Badge>Entry</Badge> : null}</div><p className="text-xs text-slate-500">{node.id} · {titleCase(node.type)}</p></div></div><div className="flex gap-2"><Button size="sm" variant="outline" disabled={definition.entryNodeId === node.id} onClick={onEntry}>Set entry</Button><Button size="sm" variant="ghost" disabled={definition.nodes.length === 1} onClick={onDelete}><Trash2 className="h-4 w-4 text-rose-600" /></Button></div></div><div className="mt-4 grid gap-3 md:grid-cols-2"><Field label="Node name"><Input value={node.name} onChange={(event) => onPatch({ name: event.target.value })} /></Field>{node.type === "tool" ? <><Field label="Read-only tool"><select className={selectClass} value={node.tool} onChange={(event) => onPatch({ tool: event.target.value as WorkflowToolType })}>{tools.map((tool) => <option key={tool} value={tool}>{toolLabels[tool]}</option>)}</select></Field><Field label="Next node"><select className={selectClass} value={node.next} onChange={(event) => onPatch({ next: event.target.value })}>{targets.filter((target) => target !== node.id).map((target) => <option key={target}>{target}</option>)}</select></Field><Field label="Tool configuration (JSON)" wide><Textarea key={`${node.id}:${JSON.stringify(node.config)}`} defaultValue={JSON.stringify(node.config, null, 2)} className="min-h-28 font-mono text-xs" onBlur={(event) => { try { const parsed = JSON.parse(event.target.value); if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") throw new Error("Configuration must be a JSON object."); onPatch({ config: parsed }); } catch (error) { onError(error instanceof Error ? error.message : "Configuration must be valid JSON."); } }} /></Field></> : node.type === "condition" ? <><Field label="Source node"><select className={selectClass} value={node.sourceNodeId} onChange={(event) => onPatch({ sourceNodeId: event.target.value })}>{definition.nodes.filter((item) => item.id !== node.id).map((item) => <option key={item.id}>{item.id}</option>)}</select></Field><Field label="Output path"><Input value={node.path} onChange={(event) => onPatch({ path: event.target.value })} /></Field><Field label="Operator"><select className={selectClass} value={node.operator} onChange={(event) => onPatch({ operator: event.target.value as typeof node.operator })}>{["eq", "neq", "gt", "gte", "lt", "lte", "includes", "exists"].map((operator) => <option key={operator}>{operator}</option>)}</select></Field><Field label="Expected value"><Input value={typeof node.value === "string" ? node.value : JSON.stringify(node.value ?? null)} onChange={(event) => { const value = event.target.value; try { onPatch({ value: JSON.parse(value) }); } catch { onPatch({ value }); } }} /></Field><Field label="If true"><select className={selectClass} value={node.ifTrue} onChange={(event) => onPatch({ ifTrue: event.target.value })}>{targets.filter((target) => target !== node.id).map((target) => <option key={target}>{target}</option>)}</select></Field><Field label="If false"><select className={selectClass} value={node.ifFalse} onChange={(event) => onPatch({ ifFalse: event.target.value })}>{targets.filter((target) => target !== node.id).map((target) => <option key={target}>{target}</option>)}</select></Field></> : <><Field label="Approval prompt" wide><Textarea value={node.prompt} onChange={(event) => onPatch({ prompt: event.target.value })} /></Field><Field label="Next node"><select className={selectClass} value={node.next} onChange={(event) => onPatch({ next: event.target.value })}>{targets.filter((target) => target !== node.id).map((target) => <option key={target}>{target}</option>)}</select></Field></>}</div></div>;
}

function RunDetail({ run, busy, onAction }: { run: WorkflowRun; busy: boolean; onAction: (action: "approve" | "cancel") => void }) {
  return <div className="mt-4 space-y-5"><div className="grid gap-3 sm:grid-cols-3"><Stat icon={Clock3} label="Status" value={titleCase(run.status)} /><Stat icon={Settings2} label="Attempt" value={`${run.attempt} / ${run.maxAttempts}`} /><Stat icon={Workflow} label="Trigger" value={titleCase(run.triggerType)} /></div>{run.status === "awaiting_approval" ? <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5"><div className="flex items-center gap-2 text-amber-900"><PauseCircle className="h-5 w-5" /><strong>Explicit approval required</strong></div><p className="mt-2 text-sm leading-6 text-amber-800">{run.approvalPrompt}</p><div className="mt-4 flex gap-2"><Button disabled={busy} onClick={() => onAction("approve")}><CheckCircle2 className="mr-2 h-4 w-4" />Approve and resume</Button><Button variant="outline" disabled={busy} onClick={() => onAction("cancel")}><XCircle className="mr-2 h-4 w-4" />Cancel</Button></div></div> : run.status === "queued" ? <Button variant="outline" disabled={busy} onClick={() => onAction("cancel")}><XCircle className="mr-2 h-4 w-4" />Cancel queued run</Button> : null}{run.errorMessage ? <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800"><AlertTriangle className="mr-2 inline h-4 w-4" />{run.errorCode ? `${titleCase(run.errorCode)}: ` : ""}{run.errorMessage}</div> : null}<div><h3 className="text-sm font-semibold">Tool calls and decisions</h3><div className="mt-3 space-y-3">{run.steps.map((step) => <div key={step.id} className="border-l-2 border-slate-200 pb-3 pl-4"><div className="flex items-start justify-between gap-2"><div><strong className="text-sm">{step.nodeId}</strong><p className="text-xs text-slate-500">{titleCase(step.nodeType)} · attempt {step.attempt} · {step.durationMs === null ? "in progress" : `${step.durationMs} ms`}</p></div><Badge variant="outline" className={statusClass(step.status)}>{titleCase(step.status)}</Badge></div>{step.errorMessage ? <p className="mt-2 text-xs text-rose-700">{step.errorMessage}</p> : null}</div>)}{run.steps.length === 0 ? <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">Queued runs show steps after a worker claims them.</p> : null}</div></div><div><h3 className="text-sm font-semibold">Persisted result</h3><pre className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap break-words rounded-2xl bg-slate-950 p-4 text-xs leading-5 text-slate-100">{JSON.stringify(run.output, null, 2)}</pre></div><p className="text-xs text-slate-500">Created {dateTime(run.createdAt)} · started {dateTime(run.startedAt)} · completed {dateTime(run.completedAt)}</p></div>;
}

function Stat({ icon: Icon, label, value }: { icon: typeof Clock3; label: string; value: string }) {
  return <div className="rounded-xl bg-slate-50 p-3"><div className="flex items-center gap-2 text-xs text-slate-500"><Icon className="h-4 w-4" />{label}</div><p className="mt-1 text-sm font-semibold">{value}</p></div>;
}

