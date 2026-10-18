import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
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
  Activity,
  Bot,
  Database,
  FlaskConical,
  Gauge,
  History,
  Radar,
  Scale,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Layout } from "@/components/Layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { LoadingPanel } from "@/components/ui/loading-panel";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import {
  usePortfolioRiskAnalysis,
  type PortfolioRiskInput,
  type PortfolioRiskSnapshot,
} from "@/hooks/ai/usePortfolioRiskLab";
import {
  useResearchPlan,
  useResearchPlanStudio,
} from "@/hooks/ai/useResearchPlanStudio";
import { readApiErrorMessage } from "@/lib/api";
import { cn } from "@/lib/utils";

const COLORS = ["#10b981", "#4f46e5", "#f59e0b", "#0ea5e9", "#f43f5e", "#8b5cf6"];
const money = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
const signedMoney = (value: number) => `${value > 0 ? "+" : ""}${money(value)}`;
const signed = (value: number, suffix = "") => `${value > 0 ? "+" : ""}${value}${suffix}`;
const titleCase = (value: string) =>
  value.replace(/_/gu, " ").replace(/\b\w/gu, (letter) => letter.toUpperCase());
const dateTime = (value: string) =>
  new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));

function redistribute(
  allocations: PortfolioRiskInput["allocations"],
  changedIndex: number,
  requestedPercent: number,
) {
  if (allocations.length === 1) return [{ ...allocations[0], percent: 100 }];
  const minimum = 0.01;
  const target = Math.max(
    minimum,
    Math.min(100 - minimum * (allocations.length - 1), requestedPercent),
  );
  const otherTotal = allocations.reduce(
    (sum, item, index) => sum + (index === changedIndex ? 0 : item.percent),
    0,
  );
  const remaining = 100 - target;
  const distributable = remaining - minimum * (allocations.length - 1);
  let lastOtherIndex = allocations.length - 1;
  if (lastOtherIndex === changedIndex) lastOtherIndex -= 1;
  let allocated = target;
  return allocations.map((item, index) => {
    if (index === changedIndex) return { ...item, percent: Number(target.toFixed(2)) };
    const isLastOther = lastOtherIndex === index;
    const percent = isLastOther
      ? Number((100 - allocated).toFixed(2))
      : Number(
          (
            minimum +
            (otherTotal > 0
              ? (item.percent / otherTotal) * distributable
              : distributable / (allocations.length - 1))
          ).toFixed(2),
        );
    allocated += percent;
    return { ...item, percent };
  });
}

function MetricCard({
  icon: Icon,
  label,
  value,
  detail,
  tone = "emerald",
}: {
  icon: typeof Gauge;
  label: string;
  value: string;
  detail: string;
  tone?: "emerald" | "indigo" | "amber" | "rose";
}) {
  const tones = {
    emerald: "bg-emerald-100 text-emerald-800",
    indigo: "bg-indigo-100 text-indigo-800",
    amber: "bg-amber-100 text-amber-800",
    rose: "bg-rose-100 text-rose-800",
  };
  return (
    <Card className="p-5">
      <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl", tones[tone])}>
        <Icon className="h-5 w-5" />
      </div>
      <p className="mt-4 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-950">{value}</p>
      <p className="mt-2 text-xs leading-5 text-slate-500">{detail}</p>
    </Card>
  );
}

function GuardianList({
  title,
  items,
}: {
  title: string;
  items: Array<{ severity?: "info" | "warning" | "high"; finding: string }>;
}) {
  return (
    <div>
      <h4 className="text-sm font-semibold text-slate-950">{title}</h4>
      <div className="mt-3 space-y-2">
        {items.map((item, index) => (
          <div
            key={`${item.finding}:${index}`}
            className={cn(
              "rounded-xl border p-3 text-sm leading-6",
              item.severity === "high"
                ? "border-rose-200 bg-rose-50 text-rose-900"
                : item.severity === "warning"
                  ? "border-amber-200 bg-amber-50 text-amber-900"
                  : "border-slate-200 bg-slate-50 text-slate-700",
            )}
          >
            {item.finding}
          </div>
        ))}
      </div>
    </div>
  );
}

function AllocationTable({ snapshot }: { snapshot: PortfolioRiskSnapshot }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200">
      <table className="min-w-full text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-3">Asset</th>
            <th className="px-4 py-3">Exposure</th>
            <th className="px-4 py-3">Risk</th>
            <th className="px-4 py-3">7d volatility</th>
            <th className="px-4 py-3">7d drawdown</th>
            <th className="px-4 py-3">Halal screen</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">
          {snapshot.allocations.map((allocation) => (
            <tr key={allocation.opportunityId}>
              <td className="px-4 py-3">
                <span className="font-semibold text-slate-950">{allocation.name}</span>
                <span className="ml-2 text-xs text-slate-500">{allocation.symbol}</span>
              </td>
              <td className="px-4 py-3 text-slate-700">{allocation.percent}% · {money(allocation.valueUsd)}</td>
              <td className="px-4 py-3"><Badge variant="outline">{titleCase(allocation.riskLevel)}</Badge></td>
              <td className="px-4 py-3 text-slate-700">{allocation.volatility7dAnnualizedPercent === null ? "Unavailable" : `${allocation.volatility7dAnnualizedPercent}%`}</td>
              <td className="px-4 py-3 text-slate-700">{allocation.historicalDrawdown7dPercent === null ? "Unavailable" : `${allocation.historicalDrawdown7dPercent}%`}</td>
              <td className="px-4 py-3"><Badge variant={allocation.halalStatus === "eligible" ? "default" : "outline"}>{titleCase(allocation.halalStatus)}</Badge></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function PortfolioRiskLab() {
  const studio = useResearchPlanStudio();
  const [planId, setPlanId] = useState<string | null>(null);
  const plan = useResearchPlan(planId);
  const analysis = usePortfolioRiskAnalysis();
  const [current, setCurrent] = useState<PortfolioRiskInput | null>(null);
  const [hypothetical, setHypothetical] = useState<PortfolioRiskInput | null>(null);

  useEffect(() => {
    if (!planId && studio.data?.plans[0]) setPlanId(studio.data.plans[0].id);
  }, [planId, studio.data?.plans]);

  useEffect(() => {
    if (!plan.data) return;
    const portfolioValueUsd =
      plan.data.goal.initialAmountUsd +
      plan.data.goal.monthlyContributionUsd * plan.data.goal.horizonMonths;
    const input = {
      portfolioValueUsd,
      allocations: plan.data.allocations.map((allocation) => ({
        opportunityId: allocation.opportunityId,
        percent: allocation.percent,
      })),
    };
    setCurrent(input);
    setHypothetical(input);
  }, [plan.data]);

  useEffect(() => {
    if (!current || !hypothetical) return;
    const timer = window.setTimeout(() => {
      analysis.mutate({ ...current, hypothetical });
    }, 250);
    return () => window.clearTimeout(timer);
    // The mutation function is stable; inputs intentionally drive recalculation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, hypothetical]);

  const selectedPlan = studio.data?.plans.find((item) => item.id === planId);
  const result = analysis.data;
  const snapshot = result?.hypothetical ?? result?.current;
  const stressComparison = useMemo(
    () =>
      result?.current.stressTests.map((scenario) => ({
        name: scenario.label,
        current: scenario.changeUsd,
        hypothetical:
          result.hypothetical?.stressTests.find((item) => item.id === scenario.id)
            ?.changeUsd ?? scenario.changeUsd,
      })) ?? [],
    [result],
  );

  if (studio.isLoading) {
    return (
      <Layout>
        <LoadingPanel title="Opening Portfolio Risk Lab" description="Loading saved research plans and deterministic risk controls." />
      </Layout>
    );
  }

  if (studio.isError || !studio.data) {
    return (
      <Layout>
        <Card className="p-6">
          <h2 className="text-xl font-semibold text-slate-950">Risk Lab unavailable</h2>
          <p className="mt-2 text-sm text-slate-600">{readApiErrorMessage(studio.error, "The research-plan workspace could not be loaded.")}</p>
        </Card>
      </Layout>
    );
  }

  if (studio.data.plans.length === 0) {
    return (
      <Layout>
        <Card className="overflow-hidden border-slate-800 bg-slate-950 p-8 text-white">
          <div className="relative max-w-2xl">
            <Badge className="bg-emerald-400 text-slate-950">Portfolio Risk Lab</Badge>
            <h2 className="mt-4 text-3xl font-semibold">Start with a saved research plan.</h2>
            <p className="mt-3 text-sm leading-7 text-white/70">The lab reuses Plan Studio allocations and calculations, then adds deterministic exposure, stress, historical, and halal-risk analysis.</p>
            <Button asChild className="mt-6 bg-emerald-400 text-slate-950 hover:bg-emerald-300">
              <Link to="/research-plans">Open Plan Studio</Link>
            </Button>
          </div>
        </Card>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-5">
        <Card className="overflow-hidden border-slate-800 bg-slate-950 p-6 text-white">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(52,211,153,0.20),transparent_36%),radial-gradient(circle_at_bottom_left,rgba(99,102,241,0.16),transparent_32%)]" />
          <div className="relative grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
            <div className="max-w-3xl">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300"><Radar className="h-4 w-4" /> AI Portfolio Risk Lab</div>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight">See how the portfolio breaks before the market tests it.</h2>
              <p className="mt-3 text-sm leading-7 text-white/70">Deterministic risk diagnostics, evidence-bound monitoring, and clearly hypothetical stress scenarios. No trades, automatic rebalancing, or guaranteed forecasts.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge className="bg-emerald-400 text-slate-950 hover:bg-emerald-400"><ShieldCheck className="mr-1 h-3.5 w-3.5" /> Read-only</Badge>
              <Badge variant="outline" className="border-white/20 text-white"><Database className="mr-1 h-3.5 w-3.5" /> {result?.dataQuality.reliability ?? "Loading evidence"}</Badge>
              <Badge variant="outline" className="border-white/20 text-white">External AI off</Badge>
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <label htmlFor="risk-plan" className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">Saved research plan</label>
              <select id="risk-plan" value={planId ?? ""} onChange={(event) => setPlanId(event.target.value)} className="stb-premium-input mt-2 min-w-[280px]">
                {studio.data.plans.map((item) => <option key={item.id} value={item.id}>{item.title} · revision {item.revision}</option>)}
              </select>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <Badge variant="outline">{selectedPlan?.allocationCount ?? 0} assets</Badge>
              <Badge variant="outline">Evidence {selectedPlan ? dateTime(selectedPlan.evidenceAsOf) : "loading"}</Badge>
              <Badge variant="outline">{selectedPlan ? titleCase(selectedPlan.datasetKind) : ""}</Badge>
            </div>
          </div>
        </Card>

        {plan.isLoading || (!result && analysis.isPending) ? (
          <LoadingPanel title="Calculating portfolio health" description="Applying shared risk math and fixed stress rules to this plan." />
        ) : analysis.isError ? (
          <Card className="border-rose-200 bg-rose-50 p-5 text-sm text-rose-800">{readApiErrorMessage(analysis.error, "The portfolio analysis could not be calculated.")}</Card>
        ) : snapshot && result && hypothetical ? (
          <>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard icon={Gauge} label="Health score" value={`${snapshot.guardian.healthScore}/100`} detail={`${titleCase(snapshot.guardian.healthLabel)} under fixed methodology`} />
              <MetricCard icon={ShieldAlert} label="Weighted risk" value={`${snapshot.metrics.weightedRiskScore}/3`} detail={`${titleCase(snapshot.metrics.riskLabel)} weighted allocation risk`} tone={snapshot.metrics.riskLabel === "higher" ? "rose" : "amber"} />
              <MetricCard icon={Scale} label="Diversification" value={`${snapshot.metrics.diversificationScore}/100`} detail={`${snapshot.metrics.effectiveAssetCount} effective assets`} tone="indigo" />
              <MetricCard icon={Activity} label="Verified volatility" value={snapshot.metrics.weightedVolatilityPercent === null ? "Unavailable" : `${snapshot.metrics.weightedVolatilityPercent}%`} detail={`${snapshot.metrics.historicalCoveragePercent}% allocation coverage`} tone="amber" />
            </div>

            <div className="grid gap-5 xl:grid-cols-[380px_minmax(0,1fr)]">
              <Card className="p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">What-if simulator</p>
                    <h3 className="mt-1 text-xl font-semibold text-slate-950">Hypothetical allocation</h3>
                  </div>
                  {analysis.isPending ? <Badge variant="outline">Recalculating…</Badge> : <Badge variant="outline">Auto compare</Badge>}
                </div>
                <label htmlFor="portfolio-value" className="mt-5 block text-xs font-semibold text-slate-600">Modeled portfolio value (USD)</label>
                <Input id="portfolio-value" className="mt-2" type="number" min={0} value={hypothetical.portfolioValueUsd} onChange={(event) => setHypothetical({ ...hypothetical, portfolioValueUsd: Number.isFinite(event.target.valueAsNumber) ? Math.max(0, event.target.valueAsNumber) : 0 })} />
                <div className="mt-5 space-y-5">
                  {hypothetical.allocations.map((allocation, index) => {
                    const asset = result.current.allocations.find((item) => item.opportunityId === allocation.opportunityId);
                    return (
                      <div key={allocation.opportunityId}>
                        <div className="mb-2 flex items-center justify-between text-sm"><span className="font-semibold text-slate-800">{asset?.name ?? allocation.opportunityId}</span><span className="font-mono text-slate-600">{allocation.percent}%</span></div>
                        <Slider min={0.01} max={99.99} step={0.01} value={[allocation.percent]} onValueChange={([value]) => setHypothetical({ ...hypothetical, allocations: redistribute(hypothetical.allocations, index, value) })} />
                      </div>
                    );
                  })}
                </div>
                <div className="mt-6 rounded-xl bg-slate-950 p-4 text-white">
                  <p className="text-xs uppercase tracking-[0.14em] text-white/55">Change from saved plan</p>
                  <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                    <div><span className="text-white/55">Health</span><strong className="mt-1 block">{result.comparison ? signed(result.comparison.healthScoreDelta) : "0"}</strong></div>
                    <div><span className="text-white/55">Diversification</span><strong className="mt-1 block">{result.comparison ? signed(result.comparison.diversificationDelta) : "0"}</strong></div>
                    <div><span className="text-white/55">Max weight</span><strong className="mt-1 block">{result.comparison ? signed(result.comparison.maximumWeightDelta, "%") : "0%"}</strong></div>
                    <div><span className="text-white/55">Crash impact</span><strong className="mt-1 block">{result.comparison ? signedMoney(result.comparison.crashOutcomeDeltaUsd) : "$0"}</strong></div>
                  </div>
                </div>
              </Card>

              <div className="grid gap-5 lg:grid-cols-2">
                <Card className="p-5">
                  <h3 className="text-lg font-semibold text-slate-950">Asset exposure</h3>
                  <p className="mt-1 text-xs text-slate-500">Hypothetical allocation after your changes</p>
                  <div className="mt-3 h-[270px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart><Pie data={snapshot.exposures.byAsset} dataKey="percent" nameKey="label" innerRadius={58} outerRadius={92} paddingAngle={3}>{snapshot.exposures.byAsset.map((item, index) => <Cell key={item.label} fill={COLORS[index % COLORS.length]} />)}</Pie><Tooltip formatter={(value: number) => `${value}%`} /><Legend /></PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="mt-3 border-t border-slate-200 pt-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">Category · network · risk</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {[...snapshot.exposures.byCategory, ...snapshot.exposures.byNetwork, ...snapshot.exposures.byRisk].map((item, index) => (
                        <Badge key={`${item.label}:${index}`} variant="outline">{titleCase(item.label)} {item.percent}%</Badge>
                      ))}
                    </div>
                  </div>
                </Card>
                <Card className="p-5">
                  <h3 className="text-lg font-semibold text-slate-950">Stress comparison</h3>
                  <p className="mt-1 text-xs text-slate-500">USD change · every scenario is hypothetical</p>
                  <div className="mt-3 h-[270px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={stressComparison} margin={{ left: 8, right: 8 }}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} /><YAxis tickFormatter={(value) => `$${Math.round(value / 1000)}k`} tick={{ fontSize: 10 }} /><Tooltip formatter={(value: number) => money(value)} /><Legend /><Bar dataKey="current" name="Saved plan" fill="#94a3b8" radius={[5, 5, 0, 0]} /><Bar dataKey="hypothetical" name="What-if" fill="#10b981" radius={[5, 5, 0, 0]} /></BarChart>
                    </ResponsiveContainer>
                  </div>
                </Card>
                <Card className="p-5 lg:col-span-2">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div><h3 className="text-lg font-semibold text-slate-950">Scenario ledger</h3><p className="mt-1 text-xs text-slate-500">Fixed shocks, no forecast claim and no automatic action</p></div>
                    <Badge variant="outline"><FlaskConical className="mr-1 h-3.5 w-3.5" /> Hypothetical only</Badge>
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {snapshot.stressTests.map((scenario) => (
                      <div key={scenario.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <div className="flex items-start justify-between gap-3"><div><p className="font-semibold text-slate-950">{scenario.label}</p><p className="mt-1 text-xs leading-5 text-slate-500">{scenario.description}</p></div><span className={cn("font-mono text-sm font-semibold", scenario.changeUsd < 0 ? "text-rose-700" : "text-emerald-700")}>{signedMoney(scenario.changeUsd)}</span></div>
                        <div className="mt-3 flex items-center justify-between text-xs"><span className="text-slate-500">Portfolio return {signed(scenario.portfolioReturnPercent, "%")}</span><strong className="text-slate-800">Ends at {money(scenario.projectedValueUsd)}</strong></div>
                      </div>
                    ))}
                  </div>
                </Card>
              </div>
            </div>

            <Card className="p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-indigo-700">Historical analysis</p><h3 className="mt-1 text-xl font-semibold text-slate-950">Exposure diagnostics</h3></div>
                <Badge variant="outline"><History className="mr-1 h-3.5 w-3.5" /> {titleCase(result.dataQuality.historicalWindow)}</Badge>
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-600">{result.dataQuality.note}</p>
              <div className="mt-4"><AllocationTable snapshot={snapshot} /></div>
            </Card>

            <div className="grid gap-5 lg:grid-cols-2">
              <Card className="p-5">
                <div className="flex items-center justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">AI Risk Guardian</p><h3 className="mt-1 text-xl font-semibold text-slate-950">Evidence-bound watchlist</h3></div><div className="w-28"><Progress value={snapshot.guardian.healthScore} /><p className="mt-1 text-right text-[10px] text-slate-500">{snapshot.guardian.healthScore}/100</p></div></div>
                <div className="mt-5 space-y-5"><GuardianList title="Portfolio weaknesses" items={snapshot.guardian.weaknesses} /><GuardianList title="Emerging risks" items={snapshot.guardian.emergingRisks} /><GuardianList title="Monitoring opportunities" items={snapshot.guardian.monitoringOpportunities} /></div>
                <p className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs leading-5 text-slate-500">{snapshot.guardian.boundaryNote}</p>
              </Card>
              <Card className="p-5">
                <div className="flex items-center justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-700">Halal exposure</p><h3 className="mt-1 text-xl font-semibold text-slate-950">Preliminary screen mix</h3></div><Badge variant={snapshot.halal.overallStatus === "eligible" ? "default" : "outline"}>{titleCase(snapshot.halal.overallStatus)}</Badge></div>
                <div className="mt-5 space-y-3">
                  {Object.entries(snapshot.halal.statusWeights).map(([status, percent]) => <div key={status}><div className="mb-1 flex items-center justify-between text-xs"><span className="font-medium text-slate-700">{titleCase(status)}</span><span>{percent}%</span></div><Progress value={percent} /></div>)}
                </div>
                <div className="mt-5 space-y-2">
                  {snapshot.halal.flaggedAllocations.map((item) => <div key={item.opportunityId} className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"><strong>{item.name}</strong> · {item.percent}% · {titleCase(item.status)}</div>)}
                  {snapshot.halal.flaggedAllocations.length === 0 ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">No non-eligible allocation is present in this preliminary screen.</div> : null}
                </div>
                <p className="mt-5 text-xs leading-5 text-slate-500">{snapshot.halal.disclaimer}</p>
              </Card>
            </div>

            <Card className="p-5">
              <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
                <div><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700"><Sparkles className="h-4 w-4" /> Copilot integration</div><h3 className="mt-2 text-xl font-semibold text-slate-950">Explore this simulation conversationally.</h3><p className="mt-2 text-sm leading-6 text-slate-600">Copilot will recompute these allocations on the server and cite the Risk Lab snapshot. Client-authored metric values are never trusted.</p></div>
                <Button asChild>
                  <Link to="/copilot" state={{ portfolioRiskContext: hypothetical, suggestedPrompt: "Explain my portfolio risk, concentration, halal exposure, and the worst stress-test result." }}><Bot className="mr-2 h-4 w-4" /> Ask Copilot about this lab</Link>
                </Button>
              </div>
            </Card>

            <Card className="p-5">
              <details>
                <summary className="cursor-pointer font-semibold text-slate-950">Evidence and deterministic methodology</summary>
                <div className="mt-4 grid gap-5 lg:grid-cols-2">
                  <div><h4 className="text-sm font-semibold text-slate-800">Evidence registry</h4><div className="mt-3 max-h-64 space-y-2 overflow-auto">{result.evidence.map((item) => <div key={item.id} className="rounded-xl border border-slate-200 p-3 text-xs"><div className="flex items-start justify-between gap-3"><strong className="text-slate-800">{item.label}</strong><Badge variant="outline">{item.synthetic ? "Synthetic" : "Verified"}</Badge></div><p className="mt-1 text-slate-500">{titleCase(item.sourceType)} · {dateTime(item.observedAt)}</p></div>)}</div></div>
                  <div><h4 className="text-sm font-semibold text-slate-800">Methodology {result.methodology.version}</h4><ul className="mt-3 space-y-2 text-sm leading-6 text-slate-600">{result.methodology.notes.map((note) => <li key={note} className="rounded-xl bg-slate-50 p-3">{note}</li>)}</ul><p className="mt-4 text-xs leading-5 text-slate-500">{result.disclaimer}</p></div>
                </div>
              </details>
            </Card>
          </>
        ) : null}
      </div>
    </Layout>
  );
}
