import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Bot,
  Download,
  FlaskConical,
  GitCompareArrows,
  History,
  Plus,
  Save,
  Scale,
  ShieldCheck,
  Target,
} from "lucide-react";
import { Layout } from "@/components/Layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { LoadingPanel } from "@/components/ui/loading-panel";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import {
  exportResearchPlan,
  useCompareResearchPlans,
  useResearchPlan,
  useResearchPlanStudio,
  useSaveResearchPlan,
  type InvestmentResearchPlan,
  type ResearchPlanInput,
  type ResearchRiskTolerance,
} from "@/hooks/ai/useResearchPlanStudio";
import { readApiErrorMessage } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useUserStore } from "@/stores/userStore";

const colors = ["#10b981", "#4f46e5", "#f59e0b", "#0ea5e9", "#f43f5e", "#8b5cf6"];
const money = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
const dateTime = (value: string) =>
  new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
const titleCase = (value: string) => value.replace(/_/gu, " ").replace(/\b\w/gu, (letter) => letter.toUpperCase());

type FormState = {
  title: string;
  objective: string;
  initialAmountUsd: string;
  monthlyContributionUsd: string;
  targetAmountUsd: string;
  horizonMonths: string;
  riskTolerance: ResearchRiskTolerance;
  ethicalPreferences: string;
  allocations: Array<{ opportunityId: string; percent: number }>;
  externalAiOptIn: boolean;
};

const emptyForm = (): FormState => ({
  title: "My evidence-backed research plan",
  objective: "Study a diversified set of opportunities without executing any investment.",
  initialAmountUsd: "10000",
  monthlyContributionUsd: "250",
  targetAmountUsd: "",
  horizonMonths: "24",
  riskTolerance: "balanced",
  ethicalPreferences: "Avoid interest-based activities, require transparent halal evidence",
  allocations: [],
  externalAiOptIn: false,
});

function evenAllocations(ids: string[]) {
  if (ids.length === 0) return [];
  const base = Math.floor((10000 / ids.length)) / 100;
  return ids.map((opportunityId, index) => ({
    opportunityId,
    percent: index === ids.length - 1
      ? Number((100 - base * (ids.length - 1)).toFixed(2))
      : base,
  }));
}

function planToForm(plan: InvestmentResearchPlan): FormState {
  return {
    title: plan.title,
    objective: plan.goal.objective,
    initialAmountUsd: String(plan.goal.initialAmountUsd),
    monthlyContributionUsd: String(plan.goal.monthlyContributionUsd),
    targetAmountUsd: plan.goal.targetAmountUsd === null ? "" : String(plan.goal.targetAmountUsd),
    horizonMonths: String(plan.goal.horizonMonths),
    riskTolerance: plan.goal.riskTolerance,
    ethicalPreferences: plan.goal.ethicalPreferences.join(", "),
    allocations: plan.allocations.map((allocation) => ({
      opportunityId: allocation.opportunityId,
      percent: allocation.percent,
    })),
    externalAiOptIn: false,
  };
}

function PlanDashboard({ plan }: { plan: InvestmentResearchPlan }) {
  const scenarioData = plan.scenarios.map((scenario) => ({
    name: titleCase(scenario.kind),
    projected: scenario.projectedValueUsd,
    contributed: scenario.contributedAmountUsd,
  }));
  const allocationData = plan.allocations.map((allocation) => ({
    name: allocation.symbol,
    value: allocation.percent,
  }));
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap gap-2">
            <Badge>Revision {plan.revision}</Badge>
            <Badge variant="outline">{plan.datasetKind === "live_market" ? "Verified live evidence" : "Synthetic research"}</Badge>
            <Badge variant="outline">{plan.strategy.externalAiUsed ? "AI prioritized evidence" : "Deterministic"}</Badge>
          </div>
          <h2 className="mt-3 text-2xl font-semibold text-slate-950">{plan.title}</h2>
          <p className="mt-2 text-sm text-slate-600">{plan.goal.objective}</p>
        </div>
        <div className="text-right text-xs leading-5 text-slate-500">
          <p>Evidence {dateTime(plan.evidenceAsOf)}</p>
          <p>Updated {dateTime(plan.updatedAt)}</p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="border-slate-200 p-4 shadow-none">
          <p className="text-xs uppercase tracking-wider text-slate-500">Risk exposure</p>
          <p className="mt-2 text-2xl font-semibold">{plan.portfolioAnalysis.weightedRiskScore}/3</p>
          <p className="mt-1 text-xs text-slate-600">{titleCase(plan.portfolioAnalysis.riskLabel)} · {plan.portfolioAnalysis.riskToleranceAlignment}</p>
          {plan.portfolioAnalysis.concentrationWarning ? <p className="mt-2 text-xs font-semibold text-rose-700">{plan.portfolioAnalysis.concentrationWarning}</p> : null}
        </Card>
        <Card className="border-slate-200 p-4 shadow-none">
          <p className="text-xs uppercase tracking-wider text-slate-500">Diversification</p>
          <p className="mt-2 text-2xl font-semibold">{plan.portfolioAnalysis.diversificationScore}/100</p>
          <Progress value={plan.portfolioAnalysis.diversificationScore} className="mt-3" />
        </Card>
        <Card className="border-slate-200 p-4 shadow-none">
          <p className="text-xs uppercase tracking-wider text-slate-500">Preliminary halal screen</p>
          <p className="mt-2 text-2xl font-semibold">{titleCase(plan.halalAnalysis.overallStatus)}</p>
          <p className="mt-1 text-xs text-slate-600">Not religious certification</p>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="border-slate-200 p-5 shadow-none">
          <h3 className="font-semibold text-slate-950">Hypothetical allocation</h3>
          <p className="mt-1 text-xs text-slate-500">Simulation only—no assets are purchased or rebalanced.</p>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={allocationData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} label={({ name, value }) => `${name} ${value}%`}>
                  {allocationData.map((entry, index) => <Cell key={entry.name} fill={colors[index % colors.length]} />)}
                </Pie>
                <Tooltip formatter={(value) => `${value}%`} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card className="border-slate-200 p-5 shadow-none">
          <h3 className="font-semibold text-slate-950">Scenario comparison</h3>
          <p className="mt-1 text-xs text-slate-500">Deterministic educational outputs—not forecasts.</p>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={scenarioData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" />
                <YAxis tickFormatter={(value) => `$${Math.round(Number(value) / 1000)}k`} />
                <Tooltip formatter={(value) => money(Number(value))} />
                <Legend />
                <Bar dataKey="contributed" fill="#94a3b8" radius={[6, 6, 0, 0]} />
                <Bar dataKey="projected" fill="#10b981" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        {plan.scenarios.map((scenario) => (
          <Card key={scenario.kind} className={cn("border p-4 shadow-none", scenario.kind === "pessimistic" ? "border-rose-200 bg-rose-50/40" : scenario.kind === "optimistic" ? "border-emerald-200 bg-emerald-50/40" : "border-indigo-200 bg-indigo-50/40")}>
            <p className="text-xs font-semibold uppercase tracking-wider">{titleCase(scenario.kind)}</p>
            <p className="mt-2 text-2xl font-semibold">{money(scenario.projectedValueUsd)}</p>
            <p className="mt-1 text-xs">Return model {scenario.modeledReturnPercent}% · range {scenario.weightedReturnRangePercent[0]}% to {scenario.weightedReturnRangePercent[1]}%</p>
            {scenario.targetMet !== null ? <p className="mt-2 text-xs font-semibold">{scenario.targetMet ? "Modeled target reached" : `${money(Math.max(0, scenario.targetGapUsd ?? 0))} below target`}</p> : null}
            <ul className="mt-3 space-y-1 text-[11px] leading-5 opacity-75">{scenario.assumptions.slice(0, 2).map((assumption) => <li key={assumption}>• {assumption}</li>)}</ul>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border-amber-200 bg-amber-50/40 p-5 shadow-none">
          <div className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-amber-700" /><h3 className="font-semibold">Halal evidence and uncertainty</h3></div>
          <div className="mt-3 flex flex-wrap gap-2">
            {Object.entries(plan.halalAnalysis.statusWeights).map(([status, percent]) => <Badge key={status} variant="outline">{titleCase(status)} {percent}%</Badge>)}
          </div>
          <ul className="mt-4 space-y-2 text-sm leading-6 text-slate-700">
            {(plan.halalAnalysis.uncertaintyWarnings.length > 0 ? plan.halalAnalysis.uncertaintyWarnings : ["No evidence gap was recorded in the current preliminary screen."]).map((warning) => <li key={warning}>• {warning}</li>)}
          </ul>
          <div className="mt-4 space-y-2 border-t border-amber-200 pt-3">
            {plan.halalAnalysis.evidence.slice(0, 6).map((evidence) => <p key={`${evidence.opportunityId}-${evidence.evidenceId}`} className="text-xs leading-5 text-slate-600"><strong>{evidence.sourceLabel}</strong> · {dateTime(evidence.observedAt)} · {evidence.synthetic ? "Synthetic example" : `Evidence ${evidence.evidenceId}`}</p>)}
          </div>
          <p className="mt-4 text-xs leading-5 text-slate-500">{plan.halalAnalysis.disclaimer}</p>
        </Card>
        <Card className="border-slate-200 p-5 shadow-none">
          <div className="flex items-center gap-2"><Bot className="h-5 w-5 text-indigo-700" /><h3 className="font-semibold">Strategy analyst</h3></div>
          <p className="mt-2 text-xs leading-5 text-slate-500">{plan.strategy.boundaryNote}</p>
          <h4 className="mt-4 text-sm font-semibold">Rationale</h4>
          <ul className="mt-2 space-y-2 text-sm leading-6 text-slate-700">{plan.strategy.rationale.slice(0, 6).map((item) => <li key={item}>• {item}</li>)}</ul>
          <h4 className="mt-4 text-sm font-semibold">Key assumptions</h4>
          <ul className="mt-2 space-y-2 text-xs leading-5 text-slate-600">{plan.strategy.assumptions.slice(0, 5).map((item) => <li key={item}>• {item}</li>)}</ul>
          <h4 className="mt-4 text-sm font-semibold">Research steps</h4>
          <ul className="mt-2 space-y-2 text-xs leading-5 text-slate-600">{plan.strategy.researchSteps.slice(0, 5).map((item) => <li key={item}>• {item}</li>)}</ul>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {[
          ["Risks", plan.strategy.risks],
          ["Monitoring signals", plan.strategy.monitoringSignals],
          ["Reassessment conditions", plan.strategy.reassessmentConditions],
        ].map(([heading, items]) => (
          <Card key={heading as string} className="border-slate-200 p-5 shadow-none">
            <h3 className="font-semibold">{heading as string}</h3>
            <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-600">{(items as string[]).slice(0, 6).map((item) => <li key={item}>• {item}</li>)}</ul>
          </Card>
        ))}
      </div>
      <p className="rounded-xl bg-slate-100 p-3 text-xs leading-5 text-slate-600">{plan.disclaimer}</p>
    </div>
  );
}

export default function ResearchPlanStudio() {
  const token = useUserStore((state) => state.token);
  const [searchParams] = useSearchParams();
  const sourceConversationId = searchParams.get("conversationId") ?? undefined;
  const studio = useResearchPlanStudio();
  const savePlan = useSaveResearchPlan();
  const comparePlans = useCompareResearchPlans();
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const selectedPlan = useResearchPlan(selectedPlanId);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (selectedPlan.data) setForm(planToForm(selectedPlan.data));
  }, [selectedPlan.data]);
  useEffect(() => {
    if (!selectedPlanId && form.allocations.length === 0 && studio.data?.opportunities[0]) {
      setForm((current) => ({ ...current, allocations: [{ opportunityId: studio.data!.opportunities[0].id, percent: 100 }] }));
    }
  }, [form.allocations.length, selectedPlanId, studio.data]);

  const allocationTotal = useMemo(() => form.allocations.reduce((sum, allocation) => sum + allocation.percent, 0), [form.allocations]);
  const toggleOpportunity = (id: string) => {
    const ids = form.allocations.some((item) => item.opportunityId === id)
      ? form.allocations.filter((item) => item.opportunityId !== id).map((item) => item.opportunityId)
      : [...form.allocations.map((item) => item.opportunityId), id];
    setForm((current) => ({ ...current, allocations: evenAllocations(ids) }));
  };
  const reset = () => {
    setSelectedPlanId(null);
    setForm({ ...emptyForm(), allocations: studio.data?.opportunities[0] ? [{ opportunityId: studio.data.opportunities[0].id, percent: 100 }] : [] });
    setError(null);
  };
  const submit = async () => {
    setError(null);
    const input: ResearchPlanInput = {
      title: form.title,
      sourceConversationId:
        sourceConversationId ?? selectedPlan.data?.sourceConversationId ?? undefined,
      externalAiOptIn: form.externalAiOptIn,
      goal: {
        objective: form.objective,
        initialAmountUsd: Number(form.initialAmountUsd),
        monthlyContributionUsd: Number(form.monthlyContributionUsd),
        targetAmountUsd: form.targetAmountUsd.trim() ? Number(form.targetAmountUsd) : null,
        horizonMonths: Number(form.horizonMonths),
        riskTolerance: form.riskTolerance,
        ethicalPreferences: form.ethicalPreferences.split(",").map((item) => item.trim()).filter(Boolean),
      },
      allocations: form.allocations,
    };
    try {
      const plan = await savePlan.mutateAsync({ input, planId: selectedPlanId ?? undefined });
      setSelectedPlanId(plan.id);
    } catch (requestError) {
      setError(readApiErrorMessage(requestError, "The research plan could not be saved."));
    }
  };
  const download = async () => {
    if (!token || !selectedPlanId) return;
    try {
      const plan = await exportResearchPlan(token, selectedPlanId);
      const url = URL.createObjectURL(new Blob([JSON.stringify(plan, null, 2)], { type: "application/json" }));
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${plan.title.replace(/[^a-z0-9]+/giu, "-").toLowerCase()}-r${plan.revision}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (requestError) {
      setError(readApiErrorMessage(requestError, "The plan export could not be prepared."));
    }
  };

  if (studio.isLoading) return <Layout><LoadingPanel title="Opening Plan Studio" description="Loading saved plans and current opportunity evidence." /></Layout>;
  if (studio.isError || !studio.data) return <Layout><Card className="p-6"><h2 className="text-xl font-semibold">Plan Studio unavailable</h2><p className="mt-2 text-sm text-slate-600">{readApiErrorMessage(studio.error)}</p></Card></Layout>;

  return (
    <Layout>
      <div className="space-y-5">
        <Card className="border-slate-800 bg-slate-950 p-6 text-white">
          <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300"><FlaskConical className="h-4 w-4" /> Investment Research Plan Studio</div><h2 className="mt-3 text-3xl font-semibold">Model the research. Keep execution out.</h2><p className="mt-3 max-w-3xl text-sm leading-7 text-white/70">Create customer-isolated educational plans with deterministic scenarios, allocation exposure, transparent halal evidence, and explicit monitoring conditions.</p></div>
            <div className="flex flex-wrap gap-2"><Badge className="bg-emerald-400 text-slate-950">Deterministic calculations</Badge><Badge variant="outline" className="border-white/20 text-white">No transactions</Badge></div>
          </div>
        </Card>

        {sourceConversationId ? <Card className="border-indigo-200 bg-indigo-50/60 p-4 shadow-none"><p className="text-sm text-indigo-900"><Bot className="mr-2 inline h-4 w-4" />This plan will retain an ownership-checked link to Copilot conversation <span className="font-mono text-xs">{sourceConversationId}</span>.</p></Card> : null}

        <div className="grid gap-5 xl:grid-cols-[380px_minmax(0,1fr)]">
          <div className="space-y-5">
            <Card className="p-5">
              <div className="flex items-center justify-between"><h3 className="font-semibold">Plan generator</h3><Button variant="outline" size="sm" onClick={reset}><Plus className="mr-1 h-4 w-4" />New</Button></div>
              <div className="mt-4 space-y-4">
                <label className="block text-xs font-semibold text-slate-600">Plan title<Input className="mt-1" value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} /></label>
                <label className="block text-xs font-semibold text-slate-600">Wealth goal<Textarea className="mt-1" value={form.objective} onChange={(event) => setForm((current) => ({ ...current, objective: event.target.value }))} /></label>
                <div className="grid grid-cols-2 gap-3">
                  <label className="text-xs font-semibold text-slate-600">Initial USD<Input type="number" min="0" className="mt-1" value={form.initialAmountUsd} onChange={(event) => setForm((current) => ({ ...current, initialAmountUsd: event.target.value }))} /></label>
                  <label className="text-xs font-semibold text-slate-600">Monthly USD<Input type="number" min="0" className="mt-1" value={form.monthlyContributionUsd} onChange={(event) => setForm((current) => ({ ...current, monthlyContributionUsd: event.target.value }))} /></label>
                  <label className="text-xs font-semibold text-slate-600">Target USD<Input type="number" min="0" className="mt-1" placeholder="Optional" value={form.targetAmountUsd} onChange={(event) => setForm((current) => ({ ...current, targetAmountUsd: event.target.value }))} /></label>
                  <label className="text-xs font-semibold text-slate-600">Horizon months<Input type="number" min="1" max="600" className="mt-1" value={form.horizonMonths} onChange={(event) => setForm((current) => ({ ...current, horizonMonths: event.target.value }))} /></label>
                </div>
                <label className="block text-xs font-semibold text-slate-600">Risk tolerance<select className="mt-1 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm" value={form.riskTolerance} onChange={(event) => setForm((current) => ({ ...current, riskTolerance: event.target.value as ResearchRiskTolerance }))}><option value="conservative">Conservative</option><option value="balanced">Balanced</option><option value="growth">Growth</option></select></label>
                <label className="block text-xs font-semibold text-slate-600">Ethical preferences<Input className="mt-1" value={form.ethicalPreferences} onChange={(event) => setForm((current) => ({ ...current, ethicalPreferences: event.target.value }))} /><span className="mt-1 block font-normal text-slate-500">Comma-separated monitoring preferences</span></label>
              </div>

              <div className="mt-5 border-t border-slate-200 pt-4"><div className="flex items-center justify-between"><h4 className="text-sm font-semibold">Hypothetical allocations</h4><Badge variant={Math.abs(allocationTotal - 100) <= 0.01 ? "default" : "destructive"}>{allocationTotal.toFixed(2)}%</Badge></div><div className="mt-3 space-y-2">{studio.data.opportunities.map((opportunity) => { const allocation = form.allocations.find((item) => item.opportunityId === opportunity.id); return <div key={opportunity.id} className="rounded-xl border border-slate-200 p-3"><div className="flex items-center gap-2"><Checkbox checked={Boolean(allocation)} onCheckedChange={() => toggleOpportunity(opportunity.id)} /><div className="min-w-0 flex-1"><p className="text-sm font-semibold">{opportunity.name} ({opportunity.symbol})</p><p className="text-[11px] text-slate-500">Score {opportunity.score} · {titleCase(opportunity.riskLevel)} risk · {titleCase(opportunity.halalStatus)}</p></div>{allocation ? <Input type="number" min="0.01" max="100" className="w-20" value={allocation.percent} onChange={(event) => setForm((current) => ({ ...current, allocations: current.allocations.map((item) => item.opportunityId === opportunity.id ? { ...item, percent: Number(event.target.value) } : item) }))} /> : null}</div></div>; })}</div></div>

              <label className={cn("mt-4 flex items-start gap-2 text-xs leading-5", !studio.data.capabilities.externalAiAvailable && "opacity-50")}><Checkbox checked={form.externalAiOptIn} disabled={!studio.data.capabilities.externalAiAvailable} onCheckedChange={(checked) => setForm((current) => ({ ...current, externalAiOptIn: checked === true }))} /><span>Allow the existing AI analyst to prioritize verified evidence IDs. Calculations remain deterministic{!studio.data.capabilities.externalAiAvailable ? " (unavailable here)" : ""}.</span></label>
              {error ? <p className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p> : null}
              <Button className="mt-4 w-full" disabled={savePlan.isPending || selectedPlan.isLoading || Math.abs(allocationTotal - 100) > 0.01 || form.allocations.length === 0} onClick={() => void submit()}><Save className="mr-2 h-4 w-4" />{savePlan.isPending ? "Calculating…" : selectedPlanId ? "Save revision" : "Generate and save plan"}</Button>
            </Card>

            <Card className="p-5"><div className="flex items-center gap-2"><History className="h-5 w-5 text-indigo-700" /><h3 className="font-semibold">Saved plans</h3></div><div className="mt-3 space-y-2">{studio.data.plans.map((plan) => <div key={plan.id} className={cn("rounded-xl border p-3", selectedPlanId === plan.id ? "border-emerald-300 bg-emerald-50" : "border-slate-200")}><div className="flex items-start gap-2"><Checkbox checked={compareIds.includes(plan.id)} onCheckedChange={() => setCompareIds((current) => current.includes(plan.id) ? current.filter((id) => id !== plan.id) : current.length < 4 ? [...current, plan.id] : current)} /><button type="button" className="min-w-0 flex-1 text-left" onClick={() => setSelectedPlanId(plan.id)}><p className="text-sm font-semibold">{plan.title}</p><p className="mt-1 text-[11px] text-slate-500">Revision {plan.revision} · {titleCase(plan.riskLabel)} risk · {titleCase(plan.halalStatus)}</p></button></div></div>)}{studio.data.plans.length === 0 ? <p className="text-sm text-slate-500">{studio.data.historyNote}</p> : null}</div><Button variant="outline" className="mt-4 w-full" disabled={compareIds.length < 2 || comparePlans.isPending} onClick={() => comparePlans.mutate(compareIds)}><GitCompareArrows className="mr-2 h-4 w-4" />Compare selected</Button></Card>
          </div>

          <div className="space-y-5">
            {selectedPlan.isLoading ? <LoadingPanel title="Loading saved plan" description="Retrieving the latest customer-owned revision." /> : selectedPlan.data ? <Card className="p-5"><div className="mb-4 flex flex-wrap justify-end gap-2"><Button asChild variant="outline"><Link to="/portfolio-risk"><ShieldCheck className="mr-2 h-4 w-4" />Open Risk Lab</Link></Button><Button variant="outline" onClick={() => void download()}><Download className="mr-2 h-4 w-4" />Export JSON</Button></div><PlanDashboard plan={selectedPlan.data} /></Card> : <Card className="p-8 text-center"><Target className="mx-auto h-10 w-10 text-emerald-700" /><h3 className="mt-4 text-xl font-semibold">Create or select a research plan</h3><p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-600">The studio will compare allocations, deterministic scenarios, risk exposure, goal gaps, halal uncertainty, and monitoring rules without executing an investment.</p></Card>}

            {comparePlans.isError ? <Card className="border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 shadow-none">{readApiErrorMessage(comparePlans.error, "The selected plans could not be compared.")}</Card> : null}
            {comparePlans.data ? <Card className="p-5"><div className="flex items-center gap-2"><Scale className="h-5 w-5 text-indigo-700" /><h3 className="font-semibold">Plan comparison</h3></div><div className="mt-4 overflow-x-auto"><table className="w-full min-w-[650px] text-left text-sm"><thead className="text-xs uppercase text-slate-500"><tr><th className="pb-3">Plan</th><th>Baseline</th><th>Pessimistic</th><th>Optimistic</th><th>Risk</th><th>Diversification</th><th>Halal screen</th></tr></thead><tbody>{comparePlans.data.metrics.map((metric) => <tr key={metric.planId} className="border-t border-slate-200"><td className="py-3 font-semibold">{metric.title}</td><td>{money(metric.baselineProjectedValueUsd)}</td><td>{money(metric.pessimisticProjectedValueUsd)}</td><td>{money(metric.optimisticProjectedValueUsd)}</td><td>{metric.weightedRiskScore}/3</td><td>{metric.diversificationScore}/100</td><td>{titleCase(metric.halalStatus)}</td></tr>)}</tbody></table></div><p className="mt-4 text-xs leading-5 text-slate-500">{comparePlans.data.note}</p></Card> : null}
          </div>
        </div>
      </div>
    </Layout>
  );
}
