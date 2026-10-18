import { useState } from "react";
import {
  AlertTriangle,
  BrainCircuit,
  CheckCircle2,
  Clock3,
  Database,
  HelpCircle,
  ShieldCheck,
  Sparkles
} from "lucide-react";
import { Layout } from "@/components/Layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { LoadingPanel } from "@/components/ui/loading-panel";
import {
  useGenerateWealthBrief,
  useWealthBriefCapabilities,
  type WealthBriefResult
} from "@/hooks/ai/useWealthBrief";
import { useLocale } from "@/i18n/use-locale";
import { readApiErrorMessage } from "@/lib/api";

function formatDate(value: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function freshnessLabel(value: string | null, locale: string): string {
  return value
    ? formatDate(value, locale)
    : locale === "ar"
      ? "حداثة البيانات غير معروفة"
      : "Record freshness unknown";
}

function sourceStatusLabel(
  status: WealthBriefResult["sources"][number]["status"],
  locale: string
): string {
  const labels = {
    available: locale === "ar" ? "متاح" : "Available",
    available_empty: locale === "ar" ? "متاح دون سجلات" : "Available empty",
    partial: locale === "ar" ? "متاح جزئياً" : "Partial",
    unavailable: locale === "ar" ? "غير متاح" : "Unavailable"
  } as const;
  return labels[status];
}

function formatAmount(value: string): string {
  return value;
}

function SourcePills({ sourceIds }: { sourceIds: string[] }) {
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {sourceIds.map((sourceId) => (
        <Badge key={sourceId} variant="outline" className="bg-white/70 text-[11px]">
          {sourceId.split("_").join(" ")}
        </Badge>
      ))}
    </div>
  );
}

function PositionOverview({ brief, locale }: { brief: WealthBriefResult; locale: string }) {
  const position = brief.financialPosition;
  const metrics = [
    [locale === "ar" ? "الأصول" : "Assets", position.balances.length],
    [locale === "ar" ? "النشاط الأخير" : "Recent activity", position.recentTransactions.length],
    [locale === "ar" ? "مراكز العائد" : "Yield positions", position.stakingPositions.length],
    [locale === "ar" ? "القروض القائمة" : "Outstanding loans", position.outstandingLoans.length],
    [locale === "ar" ? "خزائن التقاعد" : "Retirement vaults", position.retirementVaults.length]
  ] as const;

  return (
    <Card className="stb-surface rounded-[1.8rem] border-0 p-6">
      <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
        <Database className="h-4 w-4 text-emerald-700" />
        {locale === "ar" ? "نظرة عامة على المركز المالي" : "Financial position overview"}
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {metrics.map(([label, value]) => (
          <div key={label} className="rounded-[1.2rem] border border-slate-200 bg-white/75 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</p>
            <p className="mt-2 text-2xl font-semibold text-slate-950">{value}</p>
          </div>
        ))}
      </div>
      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {position.balances.map((balance) => (
          <div key={`${balance.chainId}:${balance.assetSymbol}`} className="rounded-[1.2rem] bg-slate-950 p-4 text-white">
            <p className="text-sm text-white/65">{balance.assetName}</p>
            <p className="mt-2 text-xl font-semibold">
              {formatAmount(balance.availableBalance)} {balance.assetSymbol}
            </p>
            <p className="mt-1 text-xs text-white/60">
              {locale === "ar" ? "قيد الانتظار" : "Pending"}: {formatAmount(balance.pendingBalance)}
            </p>
          </div>
        ))}
        {position.balances.length === 0 ? (
          <div className="rounded-[1.2rem] border border-dashed border-slate-200 p-4 text-sm text-slate-500">
            {locale === "ar" ? "لا توجد سجلات أرصدة متاحة." : "No balance records are available."}
          </div>
        ) : null}
      </div>
    </Card>
  );
}

export default function WealthBrief() {
  const { locale } = useLocale();
  const [externalAiOptIn, setExternalAiOptIn] = useState(false);
  const capabilitiesQuery = useWealthBriefCapabilities();
  const briefMutation = useGenerateWealthBrief();
  const capabilities = capabilitiesQuery.data;
  const brief = briefMutation.data;

  return (
    <Layout>
      <div className="stb-page-stack">
        <Card className="stb-inverse-surface relative overflow-hidden rounded-[2rem] border-0 p-6 text-white sm:p-8">
          <div className="stb-grid-lines absolute inset-0 opacity-20" aria-hidden="true" />
          <div className="relative z-10 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-300">
                {locale === "ar" ? "ذكاء الثروة" : "Wealth intelligence"}
              </p>
              <h2 className="stb-page-title text-3xl font-semibold sm:text-4xl">
                {locale === "ar" ? "موجز الثروة بالذكاء الاصطناعي" : "AI Wealth Brief"}
              </h2>
              <p className="text-sm leading-7 text-white/70">
                {locale === "ar"
                  ? "ملخص للبيانات المالية المتاحة فقط. لا يمكن للموجز نقل الأموال أو الموافقة على المعاملات."
                  : "A read-only briefing built only from available financial records. It cannot move funds or approve transactions."}
              </p>
            </div>
            <Button
              className="rounded-[1rem] bg-emerald-300 text-slate-950 hover:bg-emerald-200"
              disabled={briefMutation.isPending || capabilitiesQuery.isLoading}
              onClick={() => briefMutation.mutate(externalAiOptIn)}
              type="button"
            >
              <Sparkles className="h-4 w-4" />
              {briefMutation.isPending
                ? locale === "ar" ? "جارٍ الإنشاء" : "Generating"
                : locale === "ar" ? "إنشاء الموجز" : "Generate Brief"}
            </Button>
          </div>
        </Card>

        {capabilitiesQuery.isError ? (
          <Card className="stb-surface rounded-[1.6rem] border-0 p-5 text-sm text-red-700">
            {readApiErrorMessage(capabilitiesQuery.error, "AI capability information could not be loaded.")}
          </Card>
        ) : null}

        {capabilities?.externalAiAvailable ? (
          <Card className="stb-surface rounded-[1.8rem] border-0 p-6">
            <div className="flex items-start gap-4">
              <Checkbox
                aria-label="Allow external AI generation"
                checked={externalAiOptIn}
                id="external-ai-opt-in"
                onCheckedChange={(checked) => setExternalAiOptIn(checked === true)}
              />
              <div className="space-y-3">
                <label htmlFor="external-ai-opt-in" className="font-semibold text-slate-950">
                  {locale === "ar" ? "السماح بالإنشاء الخارجي لهذه المرة" : "Allow external AI generation for this request"}
                </label>
                <p className="text-sm leading-6 text-slate-600">
                  {locale === "ar"
                    ? "عند التحديد فقط، سيتم إرسال البيانات المصغرة الموضحة أدناه إلى مزود النموذج المُعد."
                    : "Only when selected, the minimized fields below will be sent to the configured model provider. No names, emails, wallet addresses, account IDs, credentials, or signing material are included."}
                </p>
                <ul className="grid gap-2 text-sm text-slate-600 md:grid-cols-2">
                  {capabilities.disclosure.map((item) => (
                    <li key={item} className="flex gap-2">
                      <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </Card>
        ) : (
          <Card className="stb-surface rounded-[1.6rem] border-0 p-5 text-sm text-slate-600">
            <div className="flex items-center gap-3">
              <BrainCircuit className="h-5 w-5 text-indigo-700" />
              {locale === "ar"
                ? "مزود الذكاء الاصطناعي الخارجي غير مُعد. سيتم إنشاء معاينة حتمية واضحة التسمية."
                : "No external AI provider is configured. Generate Brief will create an explicitly labeled deterministic preview."}
            </div>
          </Card>
        )}

        {briefMutation.isPending ? (
          <LoadingPanel
            compact
            title={locale === "ar" ? "جارٍ إعداد موجزك" : "Preparing your wealth brief"}
            description={locale === "ar" ? "نجمع بيانات القراءة فقط المتاحة." : "Collecting the available read-only financial snapshot."}
          />
        ) : null}

        {briefMutation.isError ? (
          <Card className="stb-surface rounded-[1.6rem] border-0 p-5 text-sm text-red-700">
            {readApiErrorMessage(briefMutation.error, "Your wealth brief could not be generated.")}
          </Card>
        ) : null}

        {!brief && !briefMutation.isPending && !briefMutation.isError ? (
          <Card className="stb-surface rounded-[1.8rem] border-0 p-8 text-center">
            <BrainCircuit className="mx-auto h-9 w-9 text-indigo-700" />
            <h3 className="mt-4 text-lg font-semibold text-slate-950">
              {locale === "ar" ? "جاهز عند الطلب" : "Ready when you are"}
            </h3>
            <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              {locale === "ar" ? "لن يتم إنشاء أو مشاركة أي بيانات حتى تطلب الموجز." : "No brief is generated and no data is shared until you request it."}
            </p>
          </Card>
        ) : null}

        {brief ? (
          <>
            <Card className="stb-surface rounded-[1.8rem] border-0 p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-5 w-5 text-emerald-700" />
                  <Badge className={brief.mode === "ai_generated" ? "bg-indigo-700" : "bg-slate-700"}>
                    {brief.mode === "ai_generated" ? "AI-generated" : "Deterministic preview"}
                  </Badge>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <Clock3 className="h-4 w-4" />
                  {locale === "ar" ? "البيانات حتى" : "Data as of"} {freshnessLabel(brief.dataAsOf, locale)}
                </div>
              </div>
              {brief.fallbackReason ? (
                <div className="mt-4 rounded-[1rem] border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                  External generation was unavailable or invalid, so no model text is shown. This is the deterministic preview.
                </div>
              ) : null}
              <h3 className="mt-6 text-xl font-semibold text-slate-950">Intelligence summary</h3>
              <p className="mt-3 max-w-4xl text-sm leading-7 text-slate-700">{brief.summary}</p>
            </Card>

            <PositionOverview brief={brief} locale={locale} />

            <div className="grid gap-6 xl:grid-cols-2">
              <Card className="stb-surface rounded-[1.8rem] border-0 p-6">
                <h3 className="flex items-center gap-2 font-semibold text-slate-950">
                  <Sparkles className="h-4 w-4 text-indigo-700" /> Important observations
                </h3>
                <div className="mt-4 space-y-3">
                  {brief.observations.map((observation, index) => (
                    <div key={`${observation.text}:${index}`} className="rounded-[1.2rem] border border-slate-200 bg-white/70 p-4 text-sm leading-6 text-slate-700">
                      {observation.text}
                      <SourcePills sourceIds={observation.sourceIds} />
                    </div>
                  ))}
                  {brief.observations.length === 0 ? <p className="text-sm text-slate-500">No observations were available.</p> : null}
                </div>
              </Card>

              <Card className="stb-surface rounded-[1.8rem] border-0 p-6">
                <h3 className="flex items-center gap-2 font-semibold text-slate-950">
                  <AlertTriangle className="h-4 w-4 text-amber-700" /> Risk flags
                </h3>
                <div className="mt-4 space-y-3">
                  {brief.riskFlags.map((risk, index) => (
                    <div key={`${risk.title}:${index}`} className={`rounded-[1.2rem] border p-4 ${risk.severity === "critical" ? "border-red-200 bg-red-50" : risk.severity === "warning" ? "border-amber-200 bg-amber-50" : "border-slate-200 bg-white/70"}`}>
                      <p className="text-sm font-semibold text-slate-950">{risk.title}</p>
                      <p className="mt-2 text-sm leading-6 text-slate-700">{risk.detail}</p>
                      <SourcePills sourceIds={risk.sourceIds} />
                    </div>
                  ))}
                  {brief.riskFlags.length === 0 ? <p className="text-sm text-slate-500">No risk flags were identified from the available records.</p> : null}
                </div>
              </Card>
            </div>

            <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
              <Card className="stb-surface rounded-[1.8rem] border-0 p-6">
                <h3 className="flex items-center gap-2 font-semibold text-slate-950">
                  <HelpCircle className="h-4 w-4 text-indigo-700" /> Research questions
                </h3>
                <ol className="mt-4 space-y-3">
                  {brief.researchQuestions.map((question, index) => (
                    <li key={question} className="flex gap-3 text-sm leading-6 text-slate-700">
                      <span className="font-semibold text-indigo-700">{index + 1}.</span>{question}
                    </li>
                  ))}
                </ol>
              </Card>

              <Card className="stb-surface rounded-[1.8rem] border-0 p-6">
                <h3 className="flex items-center gap-2 font-semibold text-slate-950">
                  <Database className="h-4 w-4 text-emerald-700" /> Sources and freshness
                </h3>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  {brief.sources.map((source) => (
                    <div key={source.id} className="rounded-[1.2rem] border border-slate-200 bg-white/70 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-slate-950">{source.label}</p>
                        <Badge
                          variant="outline"
                          className={
                            source.status === "available"
                              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                              : source.status === "available_empty"
                                ? "border-slate-200 bg-slate-50 text-slate-600"
                                : "border-amber-200 bg-amber-50 text-amber-700"
                          }
                        >
                          {sourceStatusLabel(source.status, locale)}
                        </Badge>
                      </div>
                      <p className="mt-2 text-xs text-slate-500">
                        {source.recordCount} record(s) · {freshnessLabel(source.asOf, locale)}
                      </p>
                      {source.note ? <p className="mt-2 text-xs leading-5 text-slate-600">{source.note}</p> : null}
                    </div>
                  ))}
                </div>
              </Card>
            </div>

            <Card className="rounded-[1.6rem] border border-slate-200 bg-slate-50 p-5 text-xs leading-6 text-slate-600">
              {brief.disclaimer}
            </Card>
          </>
        ) : null}
      </div>
    </Layout>
  );
}
