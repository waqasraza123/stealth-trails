import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  BellRing,
  Bot,
  CalendarClock,
  CircleAlert,
  History,
  Radar,
  ShieldCheck,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { Layout } from "@/components/Layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { LoadingPanel } from "@/components/ui/loading-panel";
import { Switch } from "@/components/ui/switch";
import {
  useGenerateWealthGuardianReport,
  useUpdateWealthGuardianPreferences,
  useWealthGuardian,
  type WealthGuardianPreferences,
  type WealthGuardianReport,
} from "@/hooks/ai/useWealthGuardian";
import type {
  HalalScreeningStatus,
  OpportunityCategory,
} from "@/hooks/ai/useOpportunityHunter";
import { readApiErrorMessage } from "@/lib/api";
import { cn } from "@/lib/utils";

const categories: OpportunityCategory[] = [
  "infrastructure",
  "income",
  "payments",
  "privacy",
  "security",
];
const halalStatuses: HalalScreeningStatus[] = [
  "eligible",
  "questionable",
  "excluded",
  "insufficient_evidence",
];

const titleCase = (value: string) =>
  value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const formatDate = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat("en-US", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(value))
    : "Not yet";

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
  value === null ? "No comparison" : `${value >= 0 ? "+" : ""}${value}%`;

function toggleValue<T extends string>(values: T[], value: T): T[] {
  return values.includes(value)
    ? values.filter((candidate) => candidate !== value)
    : [...values, value];
}

function Briefing({ report }: { report: WealthGuardianReport }) {
  const plansById = useMemo(
    () => new Map(report.researchPlans.map((plan) => [plan.opportunityId, plan])),
    [report.researchPlans],
  );

  return (
    <div className="space-y-5">
      <Card className="rounded-[1.6rem] border border-emerald-200 bg-emerald-50/70 p-5 shadow-none">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge>{titleCase(report.trigger)} briefing</Badge>
              <Badge variant="outline">
                {report.datasetKind === "live_market"
                  ? "Verified live data"
                  : "Synthetic fallback"}
              </Badge>
              <Badge variant="outline">
                {report.ai.externalAiUsed ? "AI prioritized" : "Deterministic"}
              </Badge>
            </div>
            <h3 className="mt-3 text-xl font-semibold text-slate-950">
              Morning intelligence report
            </h3>
            <p className="mt-2 text-sm leading-6 text-slate-700">
              {report.summary}
            </p>
          </div>
          <div className="text-right text-xs leading-5 text-slate-500">
            <p>Generated {formatDate(report.generatedAt)}</p>
            <p>Evidence as of {formatDate(report.evidenceAsOf)}</p>
          </div>
        </div>
        <p className="mt-4 rounded-xl bg-white/75 p-3 text-xs leading-5 text-slate-600">
          {report.comparison.reason}
        </p>
      </Card>

      <section>
        <div className="mb-3 flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-emerald-700" />
          <h3 className="font-semibold text-slate-950">
            Monitored market movements
          </h3>
        </div>
        {report.marketMovements.length > 0 ? (
          <div className="grid gap-3 lg:grid-cols-3">
            {report.marketMovements.map((movement) => (
              <Card
                key={movement.opportunityId}
                className="rounded-[1.3rem] border border-slate-200 p-4 shadow-none"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <Badge variant="outline">{movement.symbol}</Badge>
                    <h4 className="mt-2 font-semibold text-slate-950">
                      {movement.name}
                    </h4>
                  </div>
                  <strong className="text-xl text-emerald-700">
                    {movement.score}
                  </strong>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-xl bg-slate-50 p-3">
                    <p className="text-slate-500">Price</p>
                    <p className="mt-1 font-semibold">
                      {formatMoney(movement.priceUsd)}
                    </p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3">
                    <p className="text-slate-500">24h</p>
                    <p className="mt-1 font-semibold">
                      {formatPercent(movement.performance24hPercent)}
                    </p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3">
                    <p className="text-slate-500">Since prior report</p>
                    <p className="mt-1 font-semibold">
                      {formatPercent(movement.priceChangeSincePreviousReportPercent)}
                    </p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3">
                    <p className="text-slate-500">Volatility</p>
                    <p className="mt-1 font-semibold">
                      {formatPercent(movement.volatility7dPercent)}
                    </p>
                  </div>
                </div>
                <p className="mt-3 text-xs text-slate-600">
                  Risk: {titleCase(movement.riskLevel)}
                  {movement.previousRiskLevel &&
                  movement.previousRiskLevel !== movement.riskLevel
                    ? ` (was ${titleCase(movement.previousRiskLevel)})`
                    : ""}
                  {movement.scoreChange !== null
                    ? ` · score ${movement.scoreChange >= 0 ? "+" : ""}${movement.scoreChange} since prior report`
                    : ""}
                </p>
                <p className="mt-3 text-[11px] text-slate-500">
                  {movement.synthetic ? "Synthetic example" : "Verified observation"} ·{" "}
                  {formatDate(movement.evidenceAsOf)}
                </p>
              </Card>
            ))}
          </div>
        ) : (
          <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
            No opportunities matched the saved monitoring preferences.
          </p>
        )}
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="rounded-[1.5rem] border border-rose-200 bg-rose-50/60 p-5 shadow-none">
          <div className="flex items-center gap-2">
            <CircleAlert className="h-5 w-5 text-rose-700" />
            <h3 className="font-semibold text-rose-950">Risk watch</h3>
          </div>
          {report.risks.length > 0 ? (
            <ul className="mt-4 space-y-3 text-sm leading-6 text-rose-950/75">
              {report.risks.map((risk, index) => (
                <li key={`${risk.opportunityId}-${index}`}>
                  <strong>{titleCase(risk.severity)}:</strong> {risk.finding}
                  <span className="block text-xs opacity-65">
                    {risk.synthetic ? "Synthetic" : "Verified"} ·{" "}
                    {formatDate(risk.evidenceAsOf)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-sm text-rose-950/65">
              No configured risk threshold was triggered.
            </p>
          )}
        </Card>
        <Card className="rounded-[1.5rem] border border-amber-200 bg-amber-50/65 p-5 shadow-none">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-amber-700" />
            <h3 className="font-semibold text-amber-950">Halal monitoring</h3>
          </div>
          {report.halalAlerts.length > 0 ? (
            <ul className="mt-4 space-y-3 text-sm leading-6 text-amber-950/75">
              {report.halalAlerts.map((alert) => (
                <li key={alert.opportunityId}>
                  <div className="flex flex-wrap items-center gap-2">
                    <strong>{alert.name}</strong>
                    <Badge variant="outline">
                      {titleCase(alert.currentStatus)}
                    </Badge>
                    {alert.changed ? <Badge>Changed</Badge> : null}
                  </div>
                  <p className="mt-1">{alert.reason}</p>
                  <span className="text-xs opacity-65">
                    {alert.synthetic ? "Synthetic example" : "Verified evidence"} ·{" "}
                    {formatDate(alert.evidenceAsOf)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-sm text-amber-950/65">
              No questionable, excluded, or verifiably changed screen was found.
            </p>
          )}
        </Card>
      </div>

      <section>
        <div className="mb-3 flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-indigo-700" />
          <h3 className="font-semibold text-slate-950">
            Notable opportunities and research plans
          </h3>
        </div>
        <div className="grid gap-3 lg:grid-cols-2">
          {report.notableOpportunities.map((opportunity) => {
            const plan = plansById.get(opportunity.opportunityId);
            return (
              <Card
                key={opportunity.opportunityId}
                className="rounded-[1.4rem] border border-indigo-100 p-5 shadow-none"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Badge>{opportunity.score}/100</Badge>
                  <Badge variant="outline">{titleCase(opportunity.riskLevel)} risk</Badge>
                  <Badge variant="outline">{titleCase(opportunity.halalStatus)}</Badge>
                </div>
                <h4 className="mt-3 font-semibold text-slate-950">
                  {opportunity.name}
                </h4>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {opportunity.reason}
                </p>
                {plan ? (
                  <div className="mt-4 space-y-3 text-xs leading-5 text-slate-600">
                    <p><strong>Objective:</strong> {plan.objective}</p>
                    <p><strong>Monitor:</strong> {plan.monitoringConditions.join("; ")}</p>
                    <p><strong>Ethics:</strong> {plan.ethicalConsiderations.join("; ")}</p>
                    <p><strong>Stop conditions:</strong> {plan.exitConditions.join("; ")}</p>
                  </div>
                ) : null}
                <p className="mt-3 text-[11px] text-slate-500">
                  {opportunity.synthetic ? "Synthetic example—not a real finding" : "Verified market research"}
                </p>
              </Card>
            );
          })}
        </div>
      </section>

      <Card className="rounded-[1.4rem] border border-indigo-200 bg-indigo-50/65 p-5 shadow-none">
        <div className="flex items-center gap-2">
          <Bot className="h-5 w-5 text-indigo-700" />
          <h3 className="font-semibold text-indigo-950">AI orchestration boundary</h3>
        </div>
        <p className="mt-3 text-sm leading-6 text-indigo-950/70">
          {report.ai.boundaryNote}
        </p>
        <p className="mt-2 text-xs text-indigo-800/70">
          External AI requested: {report.ai.requested ? "yes" : "no"} · Used:{" "}
          {report.ai.externalAiUsed ? "yes" : "no"}
        </p>
        {report.ai.insights.length > 0 ? (
          <ul className="mt-4 space-y-2 text-sm leading-6 text-indigo-950/75">
            {report.ai.insights.map((insight) => (
              <li key={insight.opportunityId}>
                <strong>{insight.headline}</strong>
                <span className="block text-xs">
                  Evidence: {insight.evidenceIds.join(", ")} · Screening rules:{" "}
                  {insight.screeningRuleIds.join(", ")}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </Card>

      <p className="text-xs leading-5 text-slate-500">{report.disclaimer}</p>
    </div>
  );
}

export default function WealthGuardian() {
  const query = useWealthGuardian();
  const updateMutation = useUpdateWealthGuardianPreferences();
  const reportMutation = useGenerateWealthGuardianReport();
  const dashboard = query.data;
  const [draft, setDraft] = useState<WealthGuardianPreferences | null>(null);
  const [assetIds, setAssetIds] = useState("");
  const [manualAiOptIn, setManualAiOptIn] = useState(false);

  useEffect(() => {
    if (!dashboard?.preferences) return;
    setDraft(dashboard.preferences);
    setAssetIds(dashboard.preferences.monitoredAssetIds.join(", "));
  }, [dashboard?.preferences]);

  const savePreferences = () => {
    if (!draft) return;
    updateMutation.mutate({
      enabled: draft.enabled,
      externalAiConsent: draft.externalAiConsent,
      notificationsEnabled: draft.notificationsEnabled,
      morningReportHourUtc: draft.morningReportHourUtc,
      minimumOpportunityScore: draft.minimumOpportunityScore,
      volatilityAlertPercent: draft.volatilityAlertPercent,
      categories: draft.categories,
      halalStatuses: draft.halalStatuses,
      monitoredAssetIds: assetIds
        .split(",")
        .map((value) => value.trim().toLowerCase())
        .filter(Boolean),
    });
  };

  return (
    <Layout>
      <div className="stb-page-stack">
        <Card className="stb-inverse-surface relative overflow-hidden rounded-[2rem] border-0 p-6 text-white sm:p-8">
          <div className="stb-grid-lines absolute inset-0 opacity-20" aria-hidden="true" />
          <div className="relative z-10 grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
            <div className="max-w-3xl">
              <Badge className="border-white/15 bg-white/10 text-emerald-200 shadow-none">
                Autonomous research · no trading authority
              </Badge>
              <p className="mt-5 text-xs font-semibold uppercase tracking-[0.22em] text-emerald-300">
                Wealth Guardian
              </p>
              <h2 className="mt-3 text-3xl font-semibold sm:text-4xl">
                Wake up to evidence, not hype.
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-white/70">
                Monitor verified market signals, risk, halal-screening evidence,
                and research conditions overnight—with explicit consent and no
                ability to move money.
              </p>
            </div>
            <Radar className="h-24 w-24 text-emerald-300/70" />
          </div>
        </Card>

        {query.isLoading ? (
          <LoadingPanel title="Loading Wealth Guardian" description="Retrieving your isolated preferences and persisted research history." />
        ) : null}
        {query.isError ? (
          <Card className="rounded-[1.5rem] border-rose-200 p-5 text-sm text-rose-700">
            {readApiErrorMessage(query.error, "Wealth Guardian could not be loaded.")}
          </Card>
        ) : null}

        {dashboard && draft ? (
          <>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {[
                [Activity, titleCase(dashboard.agent.status), "Agent status"],
                [CalendarClock, formatDate(dashboard.agent.nextScheduledAt), "Next UTC check"],
                [History, `${dashboard.reportHistory.length}`, "Recent reports"],
                [Bot, dashboard.agent.productionAiDisabled ? "Production disabled" : dashboard.agent.externalAiAvailable ? "Available with consent" : "Not configured", "External AI"],
              ].map(([Icon, value, label]) => {
                const StatusIcon = Icon as typeof Activity;
                return (
                  <Card key={label as string} className="stb-surface rounded-[1.5rem] border-0 p-5">
                    <StatusIcon className="h-5 w-5 text-emerald-700" />
                    <strong className="mt-3 block text-lg text-slate-950">{value as string}</strong>
                    <p className="mt-1 text-xs uppercase tracking-wider text-slate-500">{label as string}</p>
                  </Card>
                );
              })}
            </div>

            <Card className="stb-surface rounded-[1.8rem] border-0 p-5 sm:p-6">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-emerald-700" />
                <h3 className="text-xl font-semibold text-slate-950">Agent controls</h3>
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-600">{dashboard.agent.scheduleNote}</p>
              <div className="mt-5 grid gap-5 lg:grid-cols-3">
                {[
                  ["Enable overnight monitoring", "Allows the worker to prepare one due daily report.", draft.enabled, (checked: boolean) => setDraft({ ...draft, enabled: checked })],
                  ["Guardian notifications", "Send relevant briefings and alerts to the existing notification feed.", draft.notificationsEnabled, (checked: boolean) => setDraft({ ...draft, notificationsEnabled: checked })],
                  ["Ongoing external-AI consent", "Allows scheduled reports to request evidence-only prioritization outside production.", draft.externalAiConsent, (checked: boolean) => setDraft({ ...draft, externalAiConsent: checked })],
                ].map(([label, description, checked, onChange]) => (
                  <label key={label as string} className="flex items-start justify-between gap-4 rounded-[1.2rem] border border-slate-200 p-4">
                    <span>
                      <strong className="text-sm text-slate-950">{label as string}</strong>
                      <span className="mt-1 block text-xs leading-5 text-slate-500">{description as string}</span>
                    </span>
                    <Switch
                      checked={checked as boolean}
                      disabled={label === "Ongoing external-AI consent" && (!dashboard.agent.externalAiAvailable || dashboard.agent.productionAiDisabled)}
                      onCheckedChange={onChange as (checked: boolean) => void}
                    />
                  </label>
                ))}
              </div>

              <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <label className="text-xs font-semibold text-slate-600">
                  Morning hour (UTC)
                  <Input className="mt-2" type="number" min={0} max={23} value={draft.morningReportHourUtc} onChange={(event) => setDraft({ ...draft, morningReportHourUtc: Number(event.target.value) })} />
                </label>
                <label className="text-xs font-semibold text-slate-600">
                  Minimum score
                  <Input className="mt-2" type="number" min={0} max={100} value={draft.minimumOpportunityScore} onChange={(event) => setDraft({ ...draft, minimumOpportunityScore: Number(event.target.value) })} />
                </label>
                <label className="text-xs font-semibold text-slate-600">
                  Volatility alert (%)
                  <Input className="mt-2" type="number" min={1} max={500} value={draft.volatilityAlertPercent} onChange={(event) => setDraft({ ...draft, volatilityAlertPercent: Number(event.target.value) })} />
                </label>
                <label className="text-xs font-semibold text-slate-600">
                  CoinGecko asset IDs
                  <Input className="mt-2" value={assetIds} placeholder="Blank means all configured" onChange={(event) => setAssetIds(event.target.value)} />
                </label>
              </div>

              <div className="mt-5 grid gap-5 lg:grid-cols-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Categories</p>
                  <div className="mt-3 flex flex-wrap gap-3">
                    {categories.map((category) => (
                      <label key={category} className="flex items-center gap-2 text-sm text-slate-700">
                        <Checkbox checked={draft.categories.includes(category)} onCheckedChange={() => setDraft({ ...draft, categories: toggleValue(draft.categories, category) })} />
                        {titleCase(category)}
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Halal-screen statuses</p>
                  <div className="mt-3 flex flex-wrap gap-3">
                    {halalStatuses.map((status) => (
                      <label key={status} className="flex items-center gap-2 text-sm text-slate-700">
                        <Checkbox checked={draft.halalStatuses.includes(status)} onCheckedChange={() => setDraft({ ...draft, halalStatuses: toggleValue(draft.halalStatuses, status) })} />
                        {titleCase(status)}
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-5">
                <p className="text-xs text-slate-500">Saved preferences are customer-isolated and append-only audited.</p>
                <Button onClick={savePreferences} disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? "Saving" : "Save guardian controls"}
                </Button>
              </div>
              {updateMutation.isError ? <p className="mt-3 text-sm text-rose-700">{readApiErrorMessage(updateMutation.error, "Preferences could not be saved.")}</p> : null}
            </Card>

            <Card className="rounded-[1.7rem] border border-indigo-200 bg-indigo-50/70 p-5 shadow-none sm:p-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <BellRing className="h-5 w-5 text-indigo-700" />
                    <h3 className="font-semibold text-indigo-950">Request a report now</h3>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-indigo-950/70">Manual reports never trade or transact. External AI additionally requires the saved consent above and this per-request checkbox.</p>
                  <label className="mt-3 flex items-center gap-2 text-sm text-indigo-950/80">
                    <Checkbox checked={manualAiOptIn} disabled={!draft.externalAiConsent || !dashboard.agent.externalAiAvailable || dashboard.agent.productionAiDisabled} onCheckedChange={(checked) => setManualAiOptIn(checked === true)} />
                    Use consent-gated AI prioritization for this report
                  </label>
                </div>
                <Button onClick={() => reportMutation.mutate(manualAiOptIn)} disabled={reportMutation.isPending}>
                  {reportMutation.isPending ? "Researching" : "Generate morning briefing"}
                </Button>
              </div>
              {reportMutation.isError ? <p className="mt-3 text-sm text-rose-700">{readApiErrorMessage(reportMutation.error, "The report could not be generated.")}</p> : null}
            </Card>

            {dashboard.latestReport ? (
              <Card className="stb-surface rounded-[1.8rem] border-0 p-5 sm:p-6">
                <Briefing report={dashboard.latestReport} />
              </Card>
            ) : (
              <Card className="stb-surface rounded-[1.8rem] border-0 p-10 text-center">
                <Radar className="mx-auto h-9 w-9 text-slate-400" />
                <h3 className="mt-4 font-semibold text-slate-950">No briefing yet</h3>
                <p className="mt-2 text-sm text-slate-500">Enable the schedule or request a manual report. Historical comparisons will remain unavailable until a compatible prior live report exists.</p>
              </Card>
            )}

            <Card className="stb-surface rounded-[1.8rem] border-0 p-5 sm:p-6">
              <div className="flex items-center gap-2">
                <History className="h-5 w-5 text-emerald-700" />
                <h3 className="font-semibold text-slate-950">Research history</h3>
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-600">{dashboard.historyNote}</p>
              <div className="mt-4 grid gap-3 lg:grid-cols-2">
                {dashboard.reportHistory.map((report) => (
                  <article key={report.id} className={cn("rounded-[1.2rem] border p-4", report.id === dashboard.latestReport?.id ? "border-emerald-200 bg-emerald-50/50" : "border-slate-200")}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Badge variant="outline">{titleCase(report.trigger)}</Badge>
                      <span className="text-xs text-slate-500">{formatDate(report.generatedAt)}</span>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-slate-700">{report.summary}</p>
                    <p className="mt-2 text-xs text-slate-500">
                      {report.marketMovements.length} monitored · {report.risks.length} risks · {report.halalAlerts.length} screening alerts
                    </p>
                    <p className="mt-1 text-xs text-slate-500">{report.comparison.available ? "Verified comparison available" : "No verified comparison"} · {report.datasetKind === "live_market" ? "live data" : "synthetic fallback"}</p>
                  </article>
                ))}
              </div>
            </Card>
          </>
        ) : null}
      </div>
    </Layout>
  );
}
