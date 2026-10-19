import { useEffect, useMemo, useState, type FormEvent } from "react";
import { AlertTriangle, Bot, CheckCircle2, Clock3, Pause, Play, RefreshCw, ShieldCheck, Square, Workflow } from "lucide-react";
import { Layout } from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LoadingPanel } from "@/components/ui/loading-panel";
import { Badge } from "@/components/ui/badge";
import { ScreenTransition } from "@/components/motion/primitives";
import { useCommitteeMissionControl, useInvestmentCommittee, useStartCommitteeMission, type CommitteeAgent, type CommitteeMission } from "@/hooks/ai/useInvestmentCommittee";
import { readApiErrorMessage } from "@/lib/api";
import { cn } from "@/lib/utils";

const formatDate = (value: string | null) => value ? new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "Not available";
const titleCase = (value: string) => value.replace(/_/gu, " ").replace(/\b\w/gu, (letter) => letter.toUpperCase());

function statusTone(status: string) {
  if (status === "completed") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (status === "failed" || status === "cancelled") return "border-rose-200 bg-rose-50 text-rose-800";
  if (status === "running") return "border-sky-200 bg-sky-50 text-sky-800";
  if (status === "paused" || status === "awaiting_approval") return "border-amber-200 bg-amber-50 text-amber-800";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

export default function InvestmentCommittee() {
  const dashboard = useInvestmentCommittee();
  const start = useStartCommitteeMission();
  const control = useCommitteeMissionControl();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [goal, setGoal] = useState("Compare evidence-backed digital asset opportunities for a balanced, diversified 24-month educational research plan.");
  const [portfolioValueUsd, setPortfolioValueUsd] = useState(25_000);
  const [horizonMonths, setHorizonMonths] = useState(24);
  const [riskTolerance, setRiskTolerance] = useState<"conservative" | "balanced" | "growth">("balanced");
  const [ethicalPreferences, setEthicalPreferences] = useState("Avoid interest-based activity; flag unresolved Shariah evidence");
  const [externalAiConsent, setExternalAiConsent] = useState(false);

  useEffect(() => {
    if (!selectedId && dashboard.data?.missions[0]) setSelectedId(dashboard.data.missions[0].id);
  }, [dashboard.data?.missions, selectedId]);
  const selected = useMemo(() => dashboard.data?.missions.find((mission) => mission.id === selectedId) ?? dashboard.data?.missions[0] ?? null, [dashboard.data?.missions, selectedId]);

  function submit(event: FormEvent) {
    event.preventDefault();
    start.mutate({ goal, portfolioValueUsd, horizonMonths, riskTolerance, externalAiConsent, ethicalPreferences: ethicalPreferences.split(";").map((item) => item.trim()).filter(Boolean) }, { onSuccess: (mission) => setSelectedId(mission.id) });
  }

  if (dashboard.isLoading) return <Layout><LoadingPanel title="Loading investment committee" description="Retrieving your customer-isolated mission history." /></Layout>;
  if (dashboard.isError || !dashboard.data) return <Layout><Card className="p-6 text-sm text-rose-700">{readApiErrorMessage(dashboard.error, "Investment committee is unavailable.")}</Card></Layout>;

  return (
    <Layout>
      <ScreenTransition className="stb-page-stack">
        <section className="stb-inverse-surface overflow-hidden rounded-[2rem] p-6 sm:p-8">
          <div className="grid gap-6 xl:grid-cols-[1fr_auto] xl:items-end">
            <div><p className="stb-section-kicker !text-emerald-300">Autonomous research · read only</p><h1 className="stb-page-title mt-3 text-3xl font-semibold text-white sm:text-4xl">AI Investment Committee</h1><p className="mt-4 max-w-3xl text-sm leading-7 text-white/70">Give the Chief Research Agent a goal. Specialized opportunity, risk, Shariah-evidence, and strategy agents use the bank’s existing research engines, challenge one another, and produce a consolidated educational report.</p></div>
            <div className="grid gap-2 rounded-2xl border border-white/10 bg-white/5 p-4 text-xs text-white/70"><span><strong className="text-white">{dashboard.data.activeMissionCount}</strong> active missions</span><span>Maximum 8 bounded tool attempts · 1 retry per read-only specialist</span><span>No trading or money-movement tools</span></div>
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
          <div className="space-y-6">
            <Card className="stb-surface rounded-[2rem] border-0 p-5">
              <p className="stb-section-kicker">New mission</p><h2 className="stb-page-title mt-2 text-xl font-semibold">Set the research mandate</h2>
              <form className="mt-5 space-y-4" onSubmit={submit}>
                <label className="grid gap-2 text-sm font-semibold">Research goal<textarea className="stb-premium-input min-h-32 resize-y" maxLength={500} minLength={8} required value={goal} onChange={(event) => setGoal(event.target.value)} /></label>
                <div className="grid grid-cols-2 gap-3"><label className="grid gap-2 text-sm font-semibold">Scenario value<input className="stb-premium-input" min={1} type="number" value={portfolioValueUsd} onChange={(event) => setPortfolioValueUsd(Number(event.target.value))} /></label><label className="grid gap-2 text-sm font-semibold">Horizon months<input className="stb-premium-input" min={1} max={600} type="number" value={horizonMonths} onChange={(event) => setHorizonMonths(Number(event.target.value))} /></label></div>
                <label className="grid gap-2 text-sm font-semibold">Risk tolerance<select className="stb-premium-input" value={riskTolerance} onChange={(event) => setRiskTolerance(event.target.value as typeof riskTolerance)}><option value="conservative">Conservative</option><option value="balanced">Balanced</option><option value="growth">Growth</option></select></label>
                <label className="grid gap-2 text-sm font-semibold">Ethical preferences<input className="stb-premium-input" value={ethicalPreferences} onChange={(event) => setEthicalPreferences(event.target.value)} /><span className="text-xs font-normal text-slate-500">Separate multiple preferences with semicolons.</span></label>
                <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm"><input className="mt-1" type="checkbox" checked={externalAiConsent} onChange={(event) => setExternalAiConsent(event.target.checked)} /><span><strong className="block">Consent to external AI evidence ranking</strong><span className="mt-1 block text-xs leading-5 text-slate-500">Optional. Existing production restrictions still apply; deterministic research remains available.</span></span></label>
                <Button className="w-full" disabled={start.isPending} type="submit"><Play className="mr-2 h-4 w-4" />{start.isPending ? "Queuing mission…" : "Start research mission"}</Button>
                {start.isError ? <p className="text-sm text-rose-700">{readApiErrorMessage(start.error, "Mission could not be started.")}</p> : null}
              </form>
            </Card>

            <Card className="stb-surface rounded-[2rem] border-0 p-5"><div className="flex items-center justify-between"><div><p className="stb-section-kicker">Mission history</p><h2 className="stb-page-title mt-2 text-xl font-semibold">Your research</h2></div><Button size="icon" variant="outline" onClick={() => dashboard.refetch()}><RefreshCw className="h-4 w-4" /></Button></div><div className="mt-4 max-h-[32rem] space-y-2 overflow-auto">{dashboard.data.missions.length ? dashboard.data.missions.map((mission) => <button key={mission.id} type="button" onClick={() => setSelectedId(mission.id)} className={cn("w-full rounded-xl border p-3 text-left", selected?.id === mission.id ? "border-slate-950 bg-slate-50" : "border-slate-200 bg-white")}><div className="flex items-start justify-between gap-2"><strong className="line-clamp-2 text-sm">{mission.goal}</strong><Badge variant="outline" className={statusTone(mission.status)}>{mission.status}</Badge></div><p className="mt-2 text-xs text-slate-500">{formatDate(mission.requestedAt)}</p></button>) : <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">No missions yet.</p>}</div></Card>
          </div>

          <div className="space-y-6">{selected ? <MissionDetail mission={selected} busy={control.isPending} onControl={(action) => control.mutate({ missionId: selected.id, action })} /> : <Card className="p-8 text-center text-sm text-slate-500">Start a mission to inspect live agent progress.</Card>}</div>
        </div>
      </ScreenTransition>
    </Layout>
  );
}

function MissionDetail({ mission, busy, onControl }: { mission: CommitteeMission; busy: boolean; onControl: (action: "pause" | "resume" | "cancel" | "approve") => void }) {
  const completed = mission.agents.filter((agent) => agent.status === "completed").length;
  return <>
    <Card className="stb-surface rounded-[2rem] border-0 p-6"><div className="flex flex-wrap items-start justify-between gap-4"><div><div className="flex flex-wrap items-center gap-2"><Badge variant="outline" className={statusTone(mission.status)}>{titleCase(mission.status)}</Badge><Badge variant="outline">{titleCase(mission.executionMode)}</Badge></div><h2 className="stb-page-title mt-3 text-2xl font-semibold">{mission.goal}</h2><p className="mt-3 text-sm leading-6 text-slate-600">{mission.controlNote}</p></div><div className="flex gap-2">{mission.status === "running" || mission.status === "queued" ? <Button variant="outline" disabled={busy} onClick={() => onControl("pause")}><Pause className="mr-2 h-4 w-4" />Pause</Button> : null}{mission.status === "paused" || mission.status === "failed" ? <Button variant="outline" disabled={busy} onClick={() => onControl("resume")}><Play className="mr-2 h-4 w-4" />Resume</Button> : null}{mission.status === "awaiting_approval" ? <Button disabled={busy} onClick={() => onControl("approve")}><ShieldCheck className="mr-2 h-4 w-4" />Approve report</Button> : null}{!["completed", "cancelled"].includes(mission.status) ? <Button variant="outline" className="text-rose-700" disabled={busy} onClick={() => onControl("cancel")}><Square className="mr-2 h-4 w-4" />Cancel</Button> : null}</div></div><div className="mt-5"><div className="flex justify-between text-xs text-slate-500"><span>{completed} of {mission.agents.length} agents complete</span><span>Updated {formatDate(mission.updatedAt)}</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${(completed / mission.agents.length) * 100}%` }} /></div></div></Card>
    <Card className="stb-surface rounded-[2rem] border-0 p-6"><div className="flex items-center gap-2"><Workflow className="h-5 w-5 text-emerald-700" /><h3 className="stb-page-title text-xl font-semibold">Live agent mission map</h3></div><div className="mt-5 grid gap-4 lg:grid-cols-2">{mission.agents.map((agent) => <AgentCard key={agent.id} agent={agent} />)}</div></Card>
    {mission.report ? <Report mission={mission} /> : <Card className="rounded-[2rem] border border-dashed border-slate-300 bg-white/60 p-6 text-sm text-slate-500"><Clock3 className="mb-3 h-5 w-5" />The consolidated report appears after all independent workstreams reach a safe completion checkpoint.</Card>}
  </>;
}

function AgentCard({ agent }: { agent: CommitteeAgent }) {
  return <article className="rounded-2xl border border-slate-200 bg-white p-4"><div className="flex items-start justify-between gap-3"><div className="flex items-center gap-3"><span className={cn("flex h-10 w-10 items-center justify-center rounded-xl", agent.status === "running" ? "bg-sky-100 text-sky-700" : agent.status === "completed" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600")}><Bot className="h-5 w-5" /></span><div><strong className="text-sm">{agent.name}</strong><p className="mt-1 text-xs text-slate-500">{agent.durationMs === null ? "Awaiting duration" : `${agent.durationMs.toLocaleString()} ms`}</p></div></div><Badge variant="outline" className={statusTone(agent.status)}>{agent.status}</Badge></div><p className="mt-4 text-sm leading-6 text-slate-600">{agent.reasoningSummary}</p><div className="mt-3 space-y-2">{agent.toolActivity.map((activity, index) => <div className="rounded-xl bg-slate-50 p-3" key={`${activity.tool}:${index}`}><div className="flex items-center justify-between gap-2"><strong className="text-xs">{titleCase(activity.tool)}</strong><span className="text-[11px] text-slate-500">{activity.status}</span></div><p className="mt-1 text-xs leading-5 text-slate-500">{activity.summary}</p></div>)}</div></article>;
}

function Report({ mission }: { mission: CommitteeMission }) {
  const report = mission.report!;
  return <Card className="stb-surface rounded-[2rem] border-0 p-6"><div className="flex items-start justify-between gap-4"><div><p className="stb-section-kicker">Consolidated committee report</p><h3 className="stb-page-title mt-2 text-2xl font-semibold">{report.title}</h3></div><ShieldCheck className="h-6 w-6 text-emerald-700" /></div><div className="mt-6 space-y-3">{report.executiveSummary.map((item, index) => <p className="rounded-xl bg-slate-50 p-4 text-sm leading-6 text-slate-700" key={index}>{item}</p>)}</div><div className="mt-7 grid gap-6 xl:grid-cols-2"><section><h4 className="font-semibold">Evidence-backed findings</h4><div className="mt-3 space-y-3">{report.findings.map((finding, index) => <article className="rounded-xl border border-slate-200 p-4" key={`${finding.title}:${index}`}><div className="flex items-start justify-between gap-2"><strong className="text-sm">{finding.title}</strong><Badge variant="outline">{finding.evidenceStatus}</Badge></div><p className="mt-2 text-sm leading-6 text-slate-600">{finding.summary}</p><p className="mt-2 text-xs text-slate-400">{finding.evidenceIds.length} linked evidence reference(s)</p></article>)}</div></section><section><h4 className="flex items-center gap-2 font-semibold"><AlertTriangle className="h-4 w-4 text-amber-600" />Disagreements and resolution</h4><div className="mt-3 space-y-3">{report.disagreements.length ? report.disagreements.map((item, index) => <article className="rounded-xl border border-amber-200 bg-amber-50 p-4" key={`${item.topic}:${index}`}><strong className="text-sm text-amber-950">{item.topic}</strong>{item.positions.map((position, positionIndex) => <p className="mt-2 text-sm text-amber-900" key={positionIndex}>• {position}</p>)}<p className="mt-3 text-sm font-medium text-amber-950">Resolution: {item.resolution}</p></article>) : <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">No material cross-agent disagreement was detected.</p>}</div><h4 className="mt-6 font-semibold">Assumptions</h4><ul className="mt-3 space-y-2 text-sm leading-6 text-slate-600">{report.assumptions.map((item, index) => <li key={index}>• {item}</li>)}</ul></section></div><div className="mt-7 rounded-xl border border-slate-200 bg-slate-950 p-4 text-sm leading-6 text-white/75"><CheckCircle2 className="mb-2 h-5 w-5 text-emerald-300" /><strong className="text-white">Execution boundary</strong><p className="mt-1">{report.disclaimer}</p><p className="mt-2">Mode: {titleCase(report.executionMode)} · Evidence as of {formatDate(report.evidenceAsOf)}</p></div></Card>;
}
