import { useMemo, useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  BadgeCheck,
  BookOpenCheck,
  Bot,
  ChevronRight,
  CircleAlert,
  Clock3,
  Database,
  Filter,
  FlaskConical,
  Gauge,
  Minus,
  Search,
  ShieldAlert,
  Sparkles,
  Target,
} from "lucide-react";
import { Layout } from "@/components/Layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { LoadingPanel } from "@/components/ui/loading-panel";
import { Progress } from "@/components/ui/progress";
import {
  useAnalyzeOpportunities,
  useOpportunityHunter,
  type HalalScreeningStatus,
  type Opportunity,
  type OpportunityCategory,
  type OpportunityRiskLevel,
} from "@/hooks/ai/useOpportunityHunter";
import { readApiErrorMessage } from "@/lib/api";
import { cn } from "@/lib/utils";

type SortKey = "score_desc" | "score_asc" | "risk_asc" | "updated_desc";
type FilterValue<T extends string> = T | "all";

const selectClassName =
  "h-11 rounded-2xl border border-slate-200 bg-white/90 px-3 text-sm font-medium text-slate-700 shadow-[0_12px_30px_rgba(10,18,28,0.05)] outline-none focus:ring-2 focus:ring-emerald-600/25";

const titleCase = (value: string) =>
  value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const halalTone: Record<HalalScreeningStatus, string> = {
  eligible: "border-emerald-200 bg-emerald-50 text-emerald-800",
  questionable: "border-amber-200 bg-amber-50 text-amber-800",
  excluded: "border-rose-200 bg-rose-50 text-rose-800",
  insufficient_evidence: "border-slate-200 bg-slate-100 text-slate-700",
};

const halalStatuses: HalalScreeningStatus[] = [
  "eligible",
  "questionable",
  "excluded",
  "insufficient_evidence",
];

const riskTone: Record<OpportunityRiskLevel, string> = {
  lower: "bg-emerald-500",
  moderate: "bg-amber-500",
  higher: "bg-rose-500",
};

const riskRank: Record<OpportunityRiskLevel, number> = {
  lower: 1,
  moderate: 2,
  higher: 3,
};

const screeningOutcomeTone: Record<
  Opportunity["halalScreening"]["ruleResults"][number]["outcome"],
  string
> = {
  passed: "border-emerald-200 bg-emerald-50 text-emerald-800",
  failed: "border-rose-200 bg-rose-50 text-rose-800",
  review_required: "border-amber-200 bg-amber-50 text-amber-800",
  not_assessed: "border-slate-200 bg-slate-100 text-slate-700",
};

const formatMoney = (value: number | null) =>
  value === null
    ? "Unavailable"
    : new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        notation: value >= 1_000_000 ? "compact" : "standard",
        maximumFractionDigits: value >= 1_000 ? 1 : 4,
      }).format(value);

const formatPercent = (value: number | null) =>
  value === null
    ? "Unavailable"
    : `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;

const formatFreshness = (value: string) =>
  new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));

function ScoreDial({
  score,
  compact = false,
}: {
  score: number;
  compact?: boolean;
}) {
  return (
    <div
      aria-label={`Opportunity score ${score} out of 100`}
      className={cn(
        "relative grid shrink-0 place-items-center rounded-full",
        compact ? "h-16 w-16" : "h-24 w-24",
      )}
      style={{
        background: `conic-gradient(#10b981 ${score * 3.6}deg, rgba(148,163,184,0.2) 0deg)`,
      }}
    >
      <div
        className={cn(
          "grid place-items-center rounded-full bg-white",
          compact ? "h-12 w-12" : "h-[4.6rem] w-[4.6rem]",
        )}
      >
        <strong
          className={cn("text-slate-950", compact ? "text-xl" : "text-2xl")}
        >
          {score}
        </strong>
        {!compact ? (
          <span className="-mt-2 text-[10px] uppercase tracking-widest text-slate-500">
            score
          </span>
        ) : null}
      </div>
    </div>
  );
}

function ScenarioCard({
  scenario,
}: {
  scenario: Opportunity["scenarios"][number];
}) {
  const icon =
    scenario.kind === "upside"
      ? ArrowUpRight
      : scenario.kind === "downside"
        ? ArrowDownRight
        : Minus;
  const Icon = icon;
  const tone =
    scenario.kind === "upside"
      ? "border-emerald-200 bg-emerald-50/70 text-emerald-800"
      : scenario.kind === "downside"
        ? "border-rose-200 bg-rose-50/70 text-rose-800"
        : "border-indigo-200 bg-indigo-50/70 text-indigo-800";

  return (
    <div className={cn("rounded-[1.25rem] border p-4", tone)}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Icon className="h-4 w-4" />
          {titleCase(scenario.kind)}
        </div>
        <strong className="text-lg">
          {scenario.returnRangePercent[0]}% to {scenario.returnRangePercent[1]}%
        </strong>
      </div>
      <p className="mt-2 text-sm font-medium">{scenario.label}</p>
      <p className="mt-1 text-xs opacity-75">
        {scenario.timeHorizonMonths}-month illustrative horizon
      </p>
      <ul className="mt-3 space-y-1 text-xs leading-5 opacity-80">
        {scenario.assumptions.map((assumption) => (
          <li key={assumption}>• {assumption}</li>
        ))}
      </ul>
    </div>
  );
}

function OpportunityDetail({ opportunity }: { opportunity: Opportunity }) {
  return (
    <div className="space-y-7 pb-4">
      <section className="grid gap-4 md:grid-cols-[auto_1fr] md:items-center">
        <ScoreDial score={opportunity.score} />
        <div>
          <div className="flex flex-wrap gap-2">
            <Badge
              variant="outline"
              className={halalTone[opportunity.halalScreening.status]}
            >
              Halal screen: {titleCase(opportunity.halalScreening.status)}
            </Badge>
            <Badge variant="outline">
              {titleCase(opportunity.riskLevel)} risk
            </Badge>
          </div>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            {opportunity.thesis}
          </p>
        </div>
      </section>

      {opportunity.marketData ? (
        <section className="rounded-[1.4rem] border border-emerald-200 bg-emerald-50/55 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Database className="h-5 w-5 text-emerald-700" />
              <h3 className="font-semibold text-slate-950">
                Verified market snapshot
              </h3>
            </div>
            <span className="flex items-center gap-2 text-xs text-slate-500">
              <Clock3 className="h-3.5 w-3.5" />
              {formatFreshness(opportunity.marketData.observedAt)}
            </span>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {[
              ["Price", formatMoney(opportunity.marketData.priceUsd)],
              ["Market cap", formatMoney(opportunity.marketData.marketCapUsd)],
              ["24h volume", formatMoney(opportunity.marketData.volume24hUsd)],
              [
                "24h",
                formatPercent(opportunity.marketData.performance24hPercent),
              ],
              [
                "7d",
                formatPercent(opportunity.marketData.performance7dPercent),
              ],
              [
                "30d",
                formatPercent(opportunity.marketData.performance30dPercent),
              ],
              [
                "7d volatility",
                formatPercent(
                  opportunity.marketData.realizedVolatility7dPercent,
                ),
              ],
              ["Trend", titleCase(opportunity.marketData.trend)],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl bg-white/85 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  {label}
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-900">
                  {value}
                </p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section>
        <div className="mb-3 flex items-center gap-2">
          <Gauge className="h-4 w-4 text-emerald-700" />
          <h3 className="font-semibold text-slate-950">
            Why it scored {opportunity.score}
          </h3>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {opportunity.scoreBreakdown.map((component) => (
            <div
              key={component.key}
              className="rounded-[1.2rem] border border-slate-200 bg-slate-50/80 p-4"
            >
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="font-semibold text-slate-800">
                  {component.label}
                </span>
                <strong>
                  {component.points}/{component.maximum}
                </strong>
              </div>
              <Progress
                className="mt-3 h-2 bg-slate-200 [&>div]:bg-emerald-600"
                value={(component.points / component.maximum) * 100}
              />
              <p className="mt-2 text-xs leading-5 text-slate-500">
                {component.explanation}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-indigo-700" />
            <h3 className="font-semibold text-slate-950">Scenario range</h3>
          </div>
          <p className="text-xs text-slate-500">
            Illustrative stress scenarios—not forecasts or guaranteed returns
          </p>
        </div>
        <div className="grid gap-3 lg:grid-cols-3">
          {opportunity.scenarios.map((scenario) => (
            <ScenarioCard key={scenario.kind} scenario={scenario} />
          ))}
        </div>
      </section>

      <section className="rounded-[1.4rem] border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <BadgeCheck className="h-5 w-5 text-emerald-700" />
            <h3 className="font-semibold text-slate-950">
              Evidence-bound halal screening
            </h3>
          </div>
          <span className="text-xs text-slate-500">
            Assessed {formatFreshness(opportunity.halalScreening.assessedAt)} ·{" "}
            {opportunity.halalScreening.methodologyVersion}
          </span>
        </div>
        <div className="mt-4 grid gap-3">
          {opportunity.halalScreening.ruleResults.map((result) => (
            <article
              key={result.ruleId}
              className="rounded-[1.1rem] border border-slate-200 bg-slate-50/75 p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                    {titleCase(result.category)} · {result.ruleId}
                  </p>
                  <h4 className="mt-1 text-sm font-semibold text-slate-950">
                    {result.label}
                  </h4>
                </div>
                <Badge
                  variant="outline"
                  className={screeningOutcomeTone[result.outcome]}
                >
                  {titleCase(result.outcome)}
                </Badge>
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                {result.explanation}
              </p>
              {result.evidence.length > 0 ? (
                <ul className="mt-3 space-y-2 border-t border-slate-200 pt-3 text-xs leading-5 text-slate-500">
                  {result.evidence.map((item) => (
                    <li key={item.evidenceId}>
                      Evidence {item.evidenceId} · {item.sourceLabel} ·{" "}
                      {formatFreshness(item.observedAt)} ·{" "}
                      {item.synthetic ? "synthetic example" : "verified source"}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-xs font-medium text-amber-800">
                  No evidence supports a decision for this rule.
                </p>
              )}
            </article>
          ))}
        </div>
        {opportunity.halalScreening.evidenceGaps.length > 0 ? (
          <div className="mt-4 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">
            <strong>Evidence still needed:</strong>{" "}
            {opportunity.halalScreening.evidenceGaps.join("; ")}.
          </div>
        ) : null}
        <div className="mt-5 border-t border-slate-200 pt-5">
          <h4 className="text-sm font-semibold text-slate-950">
            Screening history
          </h4>
          {opportunity.halalScreening.history.length > 0 ? (
            <ol className="mt-3 space-y-3">
              {opportunity.halalScreening.history.map((entry) => (
                <li
                  key={`${entry.assessedAt}-${entry.status}`}
                  className="rounded-xl bg-slate-50 p-3"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      variant="outline"
                      className={halalTone[entry.status]}
                    >
                      {titleCase(entry.status)}
                    </Badge>
                    <span className="text-xs text-slate-500">
                      {formatFreshness(entry.assessedAt)} ·{" "}
                      {entry.synthetic ? "synthetic record" : "recorded assessment"}
                    </span>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-slate-600">
                    {entry.reason}
                  </p>
                  {entry.evidenceIds.length > 0 ? (
                    <p className="mt-2 text-[11px] text-slate-500">
                      Evidence IDs: {entry.evidenceIds.join(", ")}
                    </p>
                  ) : null}
                </li>
              ))}
            </ol>
          ) : null}
          <p className="mt-3 text-xs leading-5 text-slate-500">
            {opportunity.halalScreening.historyNote}
          </p>
        </div>
        <p className="mt-4 text-xs leading-5 text-slate-500">
          {opportunity.halalScreening.disclaimer}
        </p>
      </section>

      <section>
        <div className="mb-3 flex items-center gap-2">
          <FlaskConical className="h-4 w-4 text-indigo-700" />
          <h3 className="font-semibold text-slate-950">
            Supporting{" "}
            {opportunity.synthetic ? "synthetic" : "verified market"} evidence
          </h3>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {opportunity.evidence.map((item) => (
            <article
              key={item.id}
              className="rounded-[1.2rem] border border-slate-200 bg-slate-50/75 p-4"
            >
              <div className="flex items-center justify-between gap-3">
                <h4 className="text-sm font-semibold text-slate-900">
                  {item.title}
                </h4>
                <Badge variant="outline" className="text-[10px]">
                  {item.synthetic ? "Synthetic" : "Live"}
                </Badge>
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                {item.finding}
              </p>
              <p className="mt-3 text-xs text-slate-500">
                Source: {item.sourceLabel} · Observed{" "}
                {formatFreshness(item.observedAt)} · Evidence ID {item.id}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-[1.4rem] bg-slate-950 p-5 text-white sm:p-6">
        <div className="flex items-center gap-2">
          <BookOpenCheck className="h-5 w-5 text-emerald-300" />
          <h3 className="font-semibold">Educational research plan</h3>
        </div>
        <p className="mt-3 text-sm leading-6 text-white/70">
          {opportunity.researchPlan.objective}
        </p>
        <div className="mt-5 grid gap-5 md:grid-cols-2">
          {[
            ["Assumptions", opportunity.researchPlan.assumptions],
            ["Risk considerations", opportunity.researchPlan.riskConsiderations],
            [
              "Ethical considerations",
              opportunity.researchPlan.ethicalConsiderations,
            ],
            ["Research steps", opportunity.researchPlan.researchSteps],
            ["Signals to monitor", opportunity.researchPlan.monitoringSignals],
            ["Exit conditions", opportunity.researchPlan.exitConditions],
          ].map(([label, items]) => (
            <div key={label as string}>
              <h4 className="text-xs font-semibold uppercase tracking-[0.15em] text-emerald-300">
                {label}
              </h4>
              <ul className="mt-3 space-y-2 text-sm leading-6 text-white/72">
                {(items as string[]).map((item) => (
                  <li key={item} className="flex gap-2">
                    <span className="text-emerald-300">—</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

export default function OpportunityHunter() {
  const query = useOpportunityHunter();
  const analysisMutation = useAnalyzeOpportunities();
  const research = analysisMutation.data ?? query.data;
  const [externalAiOptIn, setExternalAiOptIn] = useState(false);
  const [search, setSearch] = useState("");
  const [category, setCategory] =
    useState<FilterValue<OpportunityCategory>>("all");
  const [risk, setRisk] = useState<FilterValue<OpportunityRiskLevel>>("all");
  const [halal, setHalal] = useState<FilterValue<HalalScreeningStatus>>("all");
  const [sort, setSort] = useState<SortKey>("score_desc");
  const [selected, setSelected] = useState<Opportunity | null>(null);

  const filtered = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return [...(research?.opportunities ?? [])]
      .filter(
        (opportunity) =>
          (!normalizedSearch ||
            `${opportunity.name} ${opportunity.symbol} ${opportunity.summary} ${opportunity.network}`
              .toLowerCase()
              .includes(normalizedSearch)) &&
          (category === "all" || opportunity.category === category) &&
          (risk === "all" || opportunity.riskLevel === risk) &&
          (halal === "all" || opportunity.halalScreening.status === halal),
      )
      .sort((a, b) => {
        if (sort === "score_asc") return a.score - b.score;
        if (sort === "risk_asc")
          return (
            riskRank[a.riskLevel] - riskRank[b.riskLevel] || b.score - a.score
          );
        if (sort === "updated_desc")
          return b.updatedAt.localeCompare(a.updatedAt);
        return b.score - a.score;
      });
  }, [category, halal, research?.opportunities, risk, search, sort]);

  const halalStatusCounts = useMemo(
    () =>
      halalStatuses.reduce<Record<HalalScreeningStatus, number>>(
        (counts, status) => {
          counts[status] =
            research?.opportunities.filter(
              (opportunity) => opportunity.halalScreening.status === status,
            ).length ?? 0;
          return counts;
        },
        {
          eligible: 0,
          questionable: 0,
          excluded: 0,
          insufficient_evidence: 0,
        },
      ),
    [research?.opportunities],
  );

  const clearFilters = () => {
    setSearch("");
    setCategory("all");
    setRisk("all");
    setHalal("all");
    setSort("score_desc");
  };

  return (
    <Layout>
      <div className="stb-page-stack">
        <Card className="stb-inverse-surface relative overflow-hidden rounded-[2rem] border-0 p-6 text-white sm:p-8">
          <div
            className="stb-grid-lines absolute inset-0 opacity-20"
            aria-hidden="true"
          />
          <div
            className="absolute -right-12 -top-12 h-52 w-52 rounded-full bg-emerald-300/10 blur-3xl"
            aria-hidden="true"
          />
          <div className="relative z-10 grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
            <div className="max-w-3xl">
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <Badge className="border-white/15 bg-white/10 text-emerald-200 shadow-none">
                  AI research workspace
                </Badge>
                <Badge
                  className={cn(
                    "shadow-none",
                    research?.dataset.kind === "live_market"
                      ? "border-emerald-300/25 bg-emerald-300/10 text-emerald-200"
                      : "border-amber-300/25 bg-amber-300/10 text-amber-200",
                  )}
                >
                  {research?.dataset.kind === "live_market"
                    ? `${titleCase(research.dataset.reliability)} market data`
                    : "Synthetic fallback data"}
                </Badge>
              </div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-300">
                Opportunity hunter
              </p>
              <h2 className="stb-page-title mt-3 text-3xl font-semibold sm:text-4xl">
                Explore ideas. Inspect the reasoning.
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-white/70 sm:text-base">
                Compare verified market signals with deterministic scores,
                evidence-bound AI insights, preliminary halal screens, and
                research-first exit conditions.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:w-[25rem]">
              {[
                [research?.opportunities.length ?? "—", "ideas"],
                ["5", "score signals"],
                ["0", "trade actions"],
              ].map(([value, label]) => (
                <div
                  key={label}
                  className="rounded-[1.2rem] border border-white/10 bg-white/5 p-4 backdrop-blur-sm"
                >
                  <strong className="text-2xl text-white">{value}</strong>
                  <p className="mt-1 text-xs uppercase tracking-wider text-white/50">
                    {label}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </Card>

        {query.isLoading ? (
          <LoadingPanel
            title="Refreshing opportunity intelligence"
            description="Loading verified market signals or the clearly labeled fallback."
          />
        ) : null}
        {query.isError ? (
          <Card className="stb-surface rounded-[1.6rem] border-0 p-5 text-sm text-rose-700">
            {readApiErrorMessage(
              query.error,
              "Opportunity research could not be loaded.",
            )}
          </Card>
        ) : null}

        {research ? (
          <>
            <div className="grid gap-4 lg:grid-cols-2">
              <Card
                className={cn(
                  "rounded-[1.6rem] border p-5 shadow-none",
                  research.dataset.kind === "live_market"
                    ? "border-emerald-200 bg-emerald-50/80"
                    : "border-amber-200 bg-amber-50/80",
                )}
              >
                <div className="flex gap-3">
                  {research.dataset.kind === "live_market" ? (
                    <Database className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />
                  ) : (
                    <FlaskConical className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
                  )}
                  <div>
                    <h3 className="font-semibold text-slate-950">
                      {research.dataset.kind === "live_market"
                        ? `${titleCase(research.dataset.reliability)} market research · ${research.dataset.provider}`
                        : "Synthetic research fallback — not live market data"}
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-slate-700">
                      {research.dataset.disclaimer}
                    </p>
                    <p className="mt-2 flex items-center gap-2 text-xs text-slate-500">
                      <Clock3 className="h-3.5 w-3.5" />
                      Data as of {formatFreshness(research.dataset.asOf)}
                    </p>
                    {research.dataset.failureReason ? (
                      <p className="mt-2 text-xs font-medium text-amber-800">
                        {research.dataset.failureReason}
                      </p>
                    ) : null}
                  </div>
                </div>
              </Card>
              <Card className="rounded-[1.6rem] border border-indigo-200 bg-indigo-50/75 p-5 shadow-none">
                <div className="flex gap-3">
                  <Bot className="mt-0.5 h-5 w-5 shrink-0 text-indigo-700" />
                  <div>
                    <h3 className="font-semibold text-indigo-950">
                      {research.ai.analysisMode === "ai_ranked"
                        ? "AI halal research analyst · verified evidence only"
                        : "Halal research analyst · deterministic mode"}
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-indigo-900/70">
                      {research.ai.boundaryNote}
                    </p>
                  </div>
                </div>
              </Card>
            </div>

            <Card className="stb-surface rounded-[1.8rem] border-0 p-5 sm:p-6">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">
                    Compliance dashboard
                  </p>
                  <h3 className="mt-2 text-xl font-semibold text-slate-950">
                    Preliminary halal screening distribution
                  </h3>
                </div>
                <p className="max-w-xl text-xs leading-5 text-slate-500">
                  Select a status to filter the research list. Eligibility is a
                  rules-based research result, not religious certification.
                </p>
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {halalStatuses.map((status) => (
                  <button
                    key={status}
                    type="button"
                    onClick={() => setHalal(status)}
                    className={cn(
                      "rounded-[1.2rem] border p-4 text-left transition-transform hover:-translate-y-0.5",
                      halalTone[status],
                      halal === status && "ring-2 ring-slate-900/15",
                    )}
                  >
                    <strong className="text-2xl">{halalStatusCounts[status]}</strong>
                    <p className="mt-1 text-sm font-semibold">
                      {titleCase(status)}
                    </p>
                    <p className="mt-2 text-xs leading-5 opacity-75">
                      {research.halalScreeningMethodology.statusDefinitions[status]}
                    </p>
                  </button>
                ))}
              </div>
            </Card>

            {research.ai.analystEnabled &&
            research.dataset.kind === "live_market" ? (
              <Card className="stb-surface rounded-[1.8rem] border-0 p-5 sm:p-6">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex items-start gap-3">
                    <Checkbox
                      aria-label="Allow external AI opportunity analysis"
                      checked={externalAiOptIn}
                      id="opportunity-ai-consent"
                      onCheckedChange={(checked) =>
                        setExternalAiOptIn(checked === true)
                      }
                    />
                    <div>
                      <label
                        htmlFor="opportunity-ai-consent"
                        className="font-semibold text-slate-950"
                      >
                        Allow evidence-bound AI analysis for this request
                      </label>
                      <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                        The configured model receives only asset labels,
                        deterministic scores, risk labels, verified evidence,
                        and server-calculated screening outcomes. It cannot
                        alter scores or screens, make a religious ruling, or
                        supply new facts.
                      </p>
                    </div>
                  </div>
                  <Button
                    disabled={!externalAiOptIn || analysisMutation.isPending}
                    onClick={() => analysisMutation.mutate(true)}
                    className="shrink-0 rounded-[1rem]"
                  >
                    <Bot className="h-4 w-4" />
                    {analysisMutation.isPending
                      ? "Analyzing evidence"
                      : "Run AI analyst"}
                  </Button>
                </div>
                {analysisMutation.isError ? (
                  <p className="mt-4 text-sm text-rose-700">
                    {readApiErrorMessage(
                      analysisMutation.error,
                      "AI analysis could not be completed.",
                    )}
                  </p>
                ) : null}
              </Card>
            ) : null}

            {research.ai.insights.length > 0 ? (
              <Card className="rounded-[1.8rem] border border-indigo-200 bg-indigo-50/70 p-5 shadow-none sm:p-6">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-indigo-700" />
                  <h3 className="font-semibold text-indigo-950">
                    AI halal research analyst priorities
                  </h3>
                </div>
                <div className="mt-4 grid gap-3 lg:grid-cols-2">
                  {research.ai.insights.map((insight) => (
                    <article
                      key={insight.opportunityId}
                      className="rounded-[1.2rem] border border-indigo-100 bg-white/80 p-4"
                    >
                      <h4 className="text-sm font-semibold text-slate-950">
                        {insight.headline}
                      </h4>
                      <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
                        {insight.reasoning.map((reason) => (
                          <li key={reason}>• {reason}</li>
                        ))}
                      </ul>
                      <p className="mt-3 text-xs text-slate-500">
                        Evidence IDs: {insight.evidenceIds.join(", ")}
                      </p>
                      <div className="mt-3 rounded-xl bg-indigo-50 p-3">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-indigo-700">
                          Preliminary halal explanation
                        </p>
                        <ul className="mt-2 space-y-1 text-xs leading-5 text-indigo-950/75">
                          {insight.halalExplanation.map((explanation) => (
                            <li key={explanation}>• {explanation}</li>
                          ))}
                        </ul>
                        <p className="mt-2 text-[11px] text-indigo-700/70">
                          Rule IDs: {insight.screeningRuleIds.join(", ")}
                        </p>
                      </div>
                      <p className="mt-2 text-xs leading-5 text-rose-700">
                        Risk checks: {insight.risks.join("; ")}
                      </p>
                    </article>
                  ))}
                </div>
              </Card>
            ) : null}

            <Card className="stb-surface rounded-[1.8rem] border-0 p-5 sm:p-6">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-end">
                <div className="min-w-0 flex-1">
                  <label
                    htmlFor="opportunity-search"
                    className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500"
                  >
                    Search research
                  </label>
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <Input
                      id="opportunity-search"
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Search ideas, symbols, networks…"
                      className="pl-11"
                    />
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <select
                    aria-label="Filter by category"
                    className={selectClassName}
                    value={category}
                    onChange={(event) =>
                      setCategory(
                        event.target.value as FilterValue<OpportunityCategory>,
                      )
                    }
                  >
                    <option value="all">All categories</option>
                    <option value="infrastructure">Infrastructure</option>
                    <option value="income">Income</option>
                    <option value="payments">Payments</option>
                    <option value="privacy">Privacy</option>
                    <option value="security">Security</option>
                  </select>
                  <select
                    aria-label="Filter by risk"
                    className={selectClassName}
                    value={risk}
                    onChange={(event) =>
                      setRisk(
                        event.target.value as FilterValue<OpportunityRiskLevel>,
                      )
                    }
                  >
                    <option value="all">All risk levels</option>
                    <option value="lower">Lower risk</option>
                    <option value="moderate">Moderate risk</option>
                    <option value="higher">Higher risk</option>
                  </select>
                  <select
                    aria-label="Filter by halal status"
                    className={selectClassName}
                    value={halal}
                    onChange={(event) =>
                      setHalal(
                        event.target.value as FilterValue<HalalScreeningStatus>,
                      )
                    }
                  >
                    <option value="all">All halal screens</option>
                    <option value="eligible">Eligible</option>
                    <option value="questionable">Questionable</option>
                    <option value="excluded">Excluded</option>
                    <option value="insufficient_evidence">
                      Insufficient evidence
                    </option>
                  </select>
                  <select
                    aria-label="Sort opportunities"
                    className={selectClassName}
                    value={sort}
                    onChange={(event) => setSort(event.target.value as SortKey)}
                  >
                    <option value="score_desc">Score: high to low</option>
                    <option value="score_asc">Score: low to high</option>
                    <option value="risk_asc">Risk: lower first</option>
                    <option value="updated_desc">Most recently updated</option>
                  </select>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-500">
                <span className="flex items-center gap-2">
                  <Filter className="h-4 w-4" />
                  Showing {filtered.length} of {research.opportunities.length}{" "}
                  {research.dataset.kind === "live_market"
                    ? "live research assets"
                    : "synthetic fallback ideas"}
                </span>
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  Clear filters
                </Button>
              </div>
            </Card>

            <div className="grid gap-5 lg:grid-cols-2 xl:grid-cols-3">
              {filtered.map((opportunity) => (
                <Card
                  key={opportunity.id}
                  className="stb-surface group flex h-full flex-col rounded-[1.8rem] border-0 p-5 transition-transform duration-200 hover:-translate-y-1 sm:p-6"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className="text-[10px]">
                          {opportunity.symbol}
                        </Badge>
                        <span className="text-xs font-medium text-slate-500">
                          {opportunity.network}
                        </span>
                      </div>
                      <h3 className="mt-3 text-xl font-semibold text-slate-950">
                        {opportunity.name}
                      </h3>
                    </div>
                    <ScoreDial compact score={opportunity.score} />
                  </div>
                  <p className="mt-4 text-sm leading-6 text-slate-600">
                    {opportunity.summary}
                  </p>
                  {opportunity.marketData ? (
                    <div className="mt-4 grid grid-cols-3 gap-2 rounded-[1.1rem] bg-emerald-50/65 p-3">
                      <div>
                        <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-500">Price</p>
                        <p className="mt-1 text-sm font-semibold text-slate-900">
                          {formatMoney(opportunity.marketData.priceUsd)}
                        </p>
                      </div>
                      <div>
                        <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-500">7d</p>
                        <p className="mt-1 text-sm font-semibold text-slate-900">
                          {formatPercent(
                            opportunity.marketData.performance7dPercent,
                          )}
                        </p>
                      </div>
                      <div>
                        <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-500">Trend</p>
                        <p className="mt-1 text-sm font-semibold text-slate-900">
                          {titleCase(opportunity.marketData.trend)}
                        </p>
                      </div>
                    </div>
                  ) : null}
                  <div className="mt-5 flex flex-wrap gap-2">
                    <Badge
                      variant="outline"
                      className={halalTone[opportunity.halalScreening.status]}
                    >
                      {titleCase(opportunity.halalScreening.status)}
                    </Badge>
                    <Badge variant="outline" className="gap-2">
                      <span
                        className={cn(
                          "h-2 w-2 rounded-full",
                          riskTone[opportunity.riskLevel],
                        )}
                      />
                      {titleCase(opportunity.riskLevel)} risk
                    </Badge>
                  </div>
                  <div className="mt-5 grid grid-cols-3 gap-2">
                    {opportunity.scenarios.map((scenario) => (
                      <div
                        key={scenario.kind}
                        className="rounded-xl bg-slate-50 p-3 text-center"
                      >
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                          {scenario.kind}
                        </p>
                        <p
                          className={cn(
                            "mt-1 text-sm font-semibold",
                            scenario.kind === "upside"
                              ? "text-emerald-700"
                              : scenario.kind === "downside"
                                ? "text-rose-700"
                                : "text-indigo-700",
                          )}
                        >
                          {scenario.returnRangePercent[0]}–
                          {scenario.returnRangePercent[1]}%
                        </p>
                      </div>
                    ))}
                  </div>
                  <div className="mt-auto pt-5">
                    <Button
                      className="w-full rounded-[1rem]"
                      variant="outline"
                      onClick={() => setSelected(opportunity)}
                    >
                      Inspect research <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </Card>
              ))}
            </div>

            {filtered.length === 0 ? (
              <Card className="stb-surface rounded-[1.8rem] border-0 p-10 text-center">
                <CircleAlert className="mx-auto h-8 w-8 text-slate-400" />
                <h3 className="mt-4 font-semibold text-slate-950">
                  No opportunities match
                </h3>
                <p className="mt-2 text-sm text-slate-500">
                  Try broadening the filters or clearing the search.
                </p>
                <Button
                  variant="outline"
                  className="mt-5"
                  onClick={clearFilters}
                >
                  Clear filters
                </Button>
              </Card>
            ) : null}

            <Card className="stb-surface rounded-[1.8rem] border-0 p-6">
              <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.65fr)]">
                <div>
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-emerald-700" />
                    <h3 className="font-semibold text-slate-950">
                      How the score works
                    </h3>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-600">
                    {research.scoringMethodology.summary}
                  </p>
                  <p className="mt-3 rounded-xl bg-slate-50 p-4 text-sm font-medium text-slate-700">
                    {research.scoringMethodology.formula}
                  </p>
                  <div className="mt-5 border-t border-slate-200 pt-5">
                    <div className="flex items-center gap-2">
                      <BadgeCheck className="h-5 w-5 text-emerald-700" />
                      <h3 className="font-semibold text-slate-950">
                        How the halal screen works
                      </h3>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-slate-600">
                      Version {research.halalScreeningMethodology.version} checks
                      interest-based activity, prohibited industries, financial
                      ratios, and other ethical concerns. Missing evidence
                      produces “insufficient evidence.”
                    </p>
                    <p className="mt-3 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-950">
                      Configured preliminary limits: interest-bearing debt ≤{" "}
                      {
                        research.halalScreeningMethodology
                          .interestBearingDebtMaximumPercent
                      }
                      %; non-permissible income ≤{" "}
                      {
                        research.halalScreeningMethodology
                          .nonPermissibleIncomeMaximumPercent
                      }
                      %.
                    </p>
                    <div className="mt-3 grid gap-2">
                      {research.halalScreeningMethodology.rules.map((rule) => (
                        <div
                          key={rule.id}
                          className="rounded-xl border border-slate-200 p-3"
                        >
                          <p className="text-sm font-semibold text-slate-900">
                            {rule.label}
                          </p>
                          <p className="mt-1 text-xs leading-5 text-slate-500">
                            {rule.description}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="rounded-[1.3rem] bg-slate-950 p-5 text-white">
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <ShieldAlert className="h-4 w-4 text-amber-300" />
                    Research guardrails
                  </div>
                  <ul className="mt-3 space-y-2 text-sm leading-6 text-white/65">
                    <li>• No real-money execution</li>
                    <li>• No automatic investing</li>
                    <li>• No guaranteed returns</li>
                    <li>• No religious certification</li>
                    <li>• AI requires explicit consent</li>
                    <li>• AI is hard-disabled in production</li>
                  </ul>
                </div>
              </div>
            </Card>
          </>
        ) : null}

        <Dialog
          open={Boolean(selected)}
          onOpenChange={(open) => {
            if (!open) setSelected(null);
          }}
        >
          <DialogContent className="max-h-[92vh] max-w-5xl overflow-y-auto rounded-[1.8rem] border-0 p-5 sm:p-7">
            {selected ? (
              <>
                <DialogHeader className="pr-8 text-left">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge>
                      {selected.synthetic
                        ? "Synthetic fallback"
                        : "Live market research"}
                    </Badge>
                    <span className="text-xs text-slate-500">
                      {selected.symbol} · {selected.network}
                    </span>
                  </div>
                  <DialogTitle className="pt-2 text-2xl text-slate-950 sm:text-3xl">
                    {selected.name}
                  </DialogTitle>
                  <DialogDescription>{selected.summary}</DialogDescription>
                </DialogHeader>
                <OpportunityDetail opportunity={selected} />
              </>
            ) : null}
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
