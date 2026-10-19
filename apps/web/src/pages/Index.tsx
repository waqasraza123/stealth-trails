import { Link } from "react-router-dom";
import {
  Activity,
  ArrowDownToLine,
  ArrowRight,
  ArrowUpFromLine,
  Bot,
  Clock3,
  Landmark,
  LockKeyhole,
  Send,
  ShieldCheck,
  Sparkles,
  Wallet
} from "lucide-react";
import { Layout } from "@/components/Layout";
import { MotionSurface, ScreenTransition } from "@/components/motion/primitives";
import { StatusBadge } from "@/components/customer/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { InlineLoader } from "@/components/ui/loading-panel";
import { useLocale } from "@/i18n/use-locale";
import { useT } from "@/i18n/use-t";
import { useMyBalances } from "@/hooks/balances/useMyBalances";
import { useFinancialCopilot } from "@/hooks/ai/useFinancialCopilot";
import { useMyRetirementVaults } from "@/hooks/retirement-vault/useMyRetirementVaults";
import { useMyTransactionHistory } from "@/hooks/transactions/useMyTransactionHistory";
import {
  formatRelativeTimeLabel,
  getTransactionConfidenceTone,
  isTimestampOlderThan
} from "@stealth-trails-bank/ui-foundation";
import {
  formatDateLabel,
  formatIntentAmount,
  formatIntentStatusLabel,
  formatShortAddress,
  formatTokenAmount,
  getIntentConfidenceStatus,
  normalizeIntentTypeLabel,
  resolveIntentAddress
} from "@/lib/customer-finance";
import { useUserStore } from "@/stores/userStore";

function hasPendingBalance(value: string): boolean {
  return Number(value) > 0;
}

const Index = () => {
  const t = useT();
  const { locale } = useLocale();
  const user = useUserStore((state) => state.user);
  const balancesQuery = useMyBalances();
  const retirementVaultsQuery = useMyRetirementVaults();
  const historyQuery = useMyTransactionHistory(5);
  const copilotQuery = useFinancialCopilot();

  const balances = balancesQuery.data?.balances ?? [];
  const vaults = retirementVaultsQuery.data?.vaults ?? [];
  const intents = historyQuery.data?.intents ?? [];
  const featuredBalance =
    balances.find((balance) => Number(balance.availableBalance) > 0) ?? balances[0];
  const pendingAssetCount = balances.filter((balance) =>
    hasPendingBalance(balance.pendingBalance)
  ).length;
  const activeIntentCount = intents.filter(
    (intent) =>
      !["settled", "failed", "cancelled", "manually_resolved"].includes(intent.status)
  ).length;
  const latestBalanceUpdate = balances
    .map((balance) => balance.updatedAt)
    .sort((left, right) => Date.parse(right) - Date.parse(left))[0];
  const latestIntentUpdate = intents
    .map((intent) => intent.updatedAt)
    .sort((left, right) => Date.parse(right) - Date.parse(left))[0];
  const staleOperationalData =
    isTimestampOlderThan(latestBalanceUpdate, 24) ||
    isTimestampOlderThan(latestIntentUpdate, 24);
  const lockedVaultBalance = vaults.reduce(
    (sum, vault) => sum + Number.parseFloat(vault.lockedBalance || "0"),
    0
  );
  const nextVaultUnlock = vaults
    .map((vault) => vault.unlockAt)
    .sort((left, right) => Date.parse(left) - Date.parse(right))[0];
  const suggestedCopilotQuestion = copilotQuery.data?.suggestedQuestions[0];
  const aiInsight = staleOperationalData
    ? locale === "ar"
      ? "لقطة الحساب أقدم من المتوقع. راجع آخر حركة قبل اتخاذ قرار مالي جديد."
      : "Your account snapshot is older than expected. Review the latest movement before making a new financial decision."
    : pendingAssetCount > 0
      ? locale === "ar"
        ? `لديك ${pendingAssetCount} من الأصول بحالة معلقة. افتح السجل لمتابعة الخطوة التالية بوضوح.`
        : `${pendingAssetCount} asset${pendingAssetCount === 1 ? " has" : "s have"} pending movement. Open the ledger to track the next step clearly.`
      : activeIntentCount > 0
        ? locale === "ar"
          ? `هناك ${activeIntentCount} من طلبات حركة الأموال قيد المتابعة. يمكن للمساعد تلخيص الحالة قبل المتابعة.`
          : `${activeIntentCount} money-movement request${activeIntentCount === 1 ? " is" : "s are"} in progress. The copilot can summarize status before you proceed.`
        : lockedVaultBalance > 0
          ? locale === "ar"
            ? "أموالك المحمية منفصلة عن الرصيد اليومي. استخدم المساعد لمراجعة التوازن بين السيولة والحماية."
            : "Your protected funds are separate from daily spending. Use the copilot to review the balance between liquidity and protection."
          : locale === "ar"
            ? "أرصدتك محدثة ولا توجد إجراءات عاجلة. حوّل السياق الحالي إلى موجز مالي واضح عند الحاجة."
            : "Your balances are current and there are no urgent actions. Turn the current context into a plain-language financial brief when needed.";

  return (
    <Layout>
      <ScreenTransition className="stb-page-stack">
        <section className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(360px,0.75fr)]">
          <MotionSurface className="stb-pressable-shell">
            <Card className="stb-surface stb-reveal overflow-hidden rounded-[2rem] border-0">
            <div className="grid gap-6 p-6 lg:grid-cols-[minmax(0,1fr)_320px]">
              <div className="space-y-5">
                <div className="space-y-3">
                  <p className="stb-section-kicker">
                    {locale === "ar" ? "نظرة عامة" : "Overview"}
                  </p>
                  <h2 className="stb-page-title text-3xl font-semibold text-slate-950">
                    {t("dashboard.title")}
                  </h2>
                  <p className="max-w-2xl text-sm leading-7 text-slate-600">
                    {user?.firstName
                      ? t("dashboard.descriptionWithName", { name: user.firstName })
                      : t("dashboard.description")}
                  </p>
                </div>

                <div className="stb-financial-grid">
                  <div className="stb-financial-card stb-financial-card--primary">
                    <p className="stb-financial-label">
                      <Wallet aria-hidden="true" />
                      {locale === "ar" ? "الرصيد الرئيسي" : "Primary balance"}
                    </p>
                    <strong className="stb-financial-value">
                      {balancesQuery.isLoading ? (
                        <InlineLoader label={locale === "ar" ? "جارٍ التحميل" : "Loading"} />
                      ) : featuredBalance ? (
                        <>
                          {formatTokenAmount(featuredBalance.availableBalance, locale)}{" "}
                          <span className="text-[0.45em] font-semibold tracking-normal">
                            {featuredBalance.asset.symbol}
                          </span>
                        </>
                      ) : (
                        balances.length
                      )}
                    </strong>
                    <span className="stb-financial-detail">
                      {featuredBalance
                        ? featuredBalance.asset.displayName
                        : locale === "ar"
                          ? "لا توجد أصول ممولة بعد"
                          : "No funded assets yet"}
                    </span>
                  </div>
                  <div className="stb-financial-card">
                    <p className="stb-financial-label">
                      <ShieldCheck aria-hidden="true" />
                      {locale === "ar" ? "الأصول المتاحة" : "Available assets"}
                    </p>
                    <strong className="stb-financial-value">
                      {balancesQuery.isLoading ? (
                        <InlineLoader label={locale === "ar" ? "جارٍ التحميل" : "Loading"} />
                      ) : (
                        balances.length
                      )}
                    </strong>
                    <span className="stb-financial-detail">
                      {locale === "ar"
                        ? "أصول مُدارة ضمن مساحة واحدة"
                        : "Managed assets in one workspace"}
                    </span>
                  </div>
                  <div className="stb-financial-card">
                    <p className="stb-financial-label">
                      <Activity aria-hidden="true" />
                      {locale === "ar" ? "حركة قيد المتابعة" : "Movement to watch"}
                    </p>
                    <strong className="stb-financial-value">
                      {historyQuery.isLoading || balancesQuery.isLoading ? (
                        <InlineLoader label={locale === "ar" ? "جارٍ التحميل" : "Loading"} />
                      ) : (
                        activeIntentCount + pendingAssetCount
                      )}
                    </strong>
                    <span className="stb-financial-detail">
                      {locale === "ar"
                        ? `${activeIntentCount} طلبات و${pendingAssetCount} أصول معلقة`
                        : `${activeIntentCount} requests and ${pendingAssetCount} pending assets`}
                    </span>
                  </div>
                </div>

                {(latestBalanceUpdate || latestIntentUpdate) ? (
                  <div
                    className={`stb-trust-note text-sm ${
                      staleOperationalData
                        ? "text-amber-900"
                        : "text-slate-700"
                    }`}
                    data-tone={staleOperationalData ? "warning" : "positive"}
                    role="status"
                  >
                    {staleOperationalData
                      ? locale === "ar"
                        ? "تظهر آخر لقطة تشغيلية أقدم من المتوقع. راجع الإيداعات المعلقة أو أعد التحميل إذا استمر التأخير."
                        : "The latest operational snapshot is older than expected. Review pending money movement or refresh if the delay continues."
                      : locale === "ar"
                        ? `آخر تحديث للأرصدة ${latestBalanceUpdate ? formatRelativeTimeLabel(latestBalanceUpdate, locale) : "غير متاح"} وآخر تحديث للمعاملات ${latestIntentUpdate ? formatRelativeTimeLabel(latestIntentUpdate, locale) : "غير متاح"}.`
                        : `Balances refreshed ${latestBalanceUpdate ? formatRelativeTimeLabel(latestBalanceUpdate, locale) : "not available"} and transaction state refreshed ${latestIntentUpdate ? formatRelativeTimeLabel(latestIntentUpdate, locale) : "not available"}.`}
                  </div>
                ) : null}

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="stb-section-frame p-4">
                    <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                      <Wallet className="h-4 w-4 text-emerald-700" />
                      {locale === "ar" ? "عنوان المحفظة المُدار" : "Managed wallet address"}
                    </div>
                    <p className="stb-ref mt-3 break-all text-sm font-semibold text-slate-950">
                      <bdi>{user?.ethereumAddress ?? t("layout.noWallet")}</bdi>
                    </p>
                    <p className="mt-2 text-sm text-slate-500">
                      {locale === "ar"
                        ? "يبقى هذا المرجع قابلاً للتتبع خلال الإيداع والسحب والمراجعة."
                        : "This reference stays traceable across deposit, withdrawal, and review."}
                    </p>
                  </div>
                  <div className="stb-section-frame p-4">
                    <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                      <ShieldCheck className="h-4 w-4 text-emerald-700" />
                      {locale === "ar" ? "طبقة الثقة" : "Trust layer"}
                    </div>
                    <div className="mt-3 space-y-2 text-sm text-slate-600">
                      <p>
                        {locale === "ar"
                          ? "يتم تتبع الطلبات برقم مرجعي واضح."
                          : "Requests remain traceable by clear reference IDs."}
                      </p>
                      <p>
                        {locale === "ar"
                          ? "تظهر الحالات كخطوات واضحة بدلاً من انتظار غامض."
                          : "Statuses appear as clear steps instead of ambiguous waiting."}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-4 rounded-[1.6rem] bg-slate-950 p-5 text-white">
                <div className="flex items-center gap-2 text-sm font-medium text-white/84">
                  <Clock3 className="h-4 w-4 text-amber-300" />
                  {locale === "ar" ? "نشاط يحتاج متابعة" : "Activity that needs watching"}
                </div>
                {intents.length > 0 ? (
                  intents.slice(0, 3).map((intent) => {
                    const confidence = getIntentConfidenceStatus(intent.status);

                    return (
                      <div
                        key={intent.id}
                        className="rounded-[1.25rem] border border-white/10 bg-white/6 p-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-white">
                              {normalizeIntentTypeLabel(
                                intent.intentType,
                                locale,
                                intent.transferDirection
                              )}
                            </p>
                            <p className="mt-1 text-sm text-white/68">
                              {formatIntentAmount(
                                intent.settledAmount ?? intent.requestedAmount,
                                intent.asset.symbol,
                                intent.intentType,
                                locale,
                                intent.transferDirection
                              )}
                            </p>
                          </div>
                          <StatusBadge
                            label={formatIntentStatusLabel(intent.status, locale)}
                            tone={getTransactionConfidenceTone(confidence)}
                            className="!bg-white/10 !text-white before:!bg-white/80"
                          />
                        </div>
                        <p className="mt-3 text-xs uppercase tracking-[0.12em] text-white/45">
                          {formatDateLabel(intent.createdAt, locale)}
                        </p>
                      </div>
                    );
                  })
                ) : (
                  <div className="rounded-[1.25rem] border border-dashed border-white/18 bg-white/5 p-4 text-sm text-white/68">
                    {t("dashboard.emptyHistory")}
                  </div>
                )}
                <Button
                  asChild
                  className="w-full rounded-[1rem] bg-white text-slate-950 hover:bg-white/90"
                >
                  <Link to="/transactions">
                    <Activity className="h-4 w-4" />
                    <span>{t("dashboard.viewHistory")}</span>
                  </Link>
                </Button>
              </div>
            </div>
            </Card>
          </MotionSurface>

          <MotionSurface className="stb-pressable-shell">
            <Card className="stb-surface stb-reveal rounded-[2rem] border-0 p-6" data-delay="1">
            <div className="space-y-5">
              <div>
                <p className="stb-section-kicker">
                  {locale === "ar" ? "قبو التقاعد" : "Retirement Vault"}
                </p>
                <h3 className="stb-page-title mt-2 text-2xl font-semibold text-slate-950">
                  {locale === "ar" ? "الأموال المحمية" : "Protected funds"}
                </h3>
              </div>
              <div className="rounded-[1.5rem] bg-white/85 p-5">
                <div className="flex items-center gap-2">
                  <LockKeyhole className="h-4 w-4 text-emerald-700" />
                  <p className="text-sm font-semibold text-slate-900">
                    {locale === "ar" ? "رصيد مقفل منفصل" : "Separated locked balance"}
                  </p>
                </div>
                {retirementVaultsQuery.isError ? (
                  <div
                    className="stb-trust-note mt-4 text-sm text-red-700"
                    data-tone="critical"
                    role="alert"
                  >
                    {retirementVaultsQuery.error instanceof Error
                      ? retirementVaultsQuery.error.message
                      : locale === "ar"
                        ? "تعذر تحميل حالة قبو التقاعد."
                        : "Retirement Vault status is unavailable."}
                  </div>
                ) : null}
                <p className="mt-3 text-sm leading-7 text-slate-600">
                  {locale === "ar"
                    ? "قبو التقاعد يعزل جزءاً من أموالك عن مسار السحب اليومي ويعيد عرضه كالتزام مقفل منفصل."
                    : "Retirement Vault isolates part of your money from the daily withdrawal rail and presents it as a separate locked liability."}
                </p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-[1.15rem] border border-slate-200/80 bg-white px-4 py-4">
                    <p className="text-xs uppercase tracking-[0.14em] text-slate-500">
                      {locale === "ar" ? "إجمالي المقفل" : "Total locked"}
                    </p>
                    <div className="mt-2 text-2xl font-semibold text-slate-950">
                      {retirementVaultsQuery.isLoading ? (
                        <InlineLoader label={t("common.loading")} />
                      ) : (
                        formatTokenAmount(String(lockedVaultBalance), locale)
                      )}
                    </div>
                  </div>
                  <div className="rounded-[1.15rem] border border-slate-200/80 bg-white px-4 py-4">
                    <p className="text-xs uppercase tracking-[0.14em] text-slate-500">
                      {locale === "ar" ? "أقرب إفراج" : "Next release"}
                    </p>
                    <p className="mt-2 text-sm font-semibold text-slate-950">
                      {nextVaultUnlock
                        ? formatDateLabel(nextVaultUnlock, locale)
                        : locale === "ar"
                          ? "لا يوجد بعد"
                          : "Not scheduled yet"}
                    </p>
                  </div>
                </div>
              </div>
              <div className="rounded-[1.5rem] bg-slate-950 p-5 text-white shadow-[0_30px_80px_rgba(10,18,28,0.24)]">
                <p className="text-sm font-semibold text-white">
                  {locale === "ar" ? "حماية طويلة الأجل" : "Long-term protection"}
                </p>
                <p className="mt-3 text-sm leading-7 text-white/70">
                  {locale === "ar"
                    ? "أنشئ القبو، ثبّت تاريخ الإفراج، ثم انقل المال من الرصيد المتاح إلى الرصيد المقفل."
                    : "Create the vault, set the release date, then move money from available balance into locked balance."}
                </p>
                <Button
                  asChild
                  variant="outline"
                  className="mt-5 rounded-full border-white/20 bg-white/8 text-white hover:bg-white/12"
                >
                  <Link to="/vault">
                    {locale === "ar" ? "فتح القبو" : "Open Retirement Vault"}
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
              <div className="rounded-[1.5rem] border border-slate-200/80 bg-white/85 p-5">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-indigo-700" />
                  <p className="text-sm font-semibold text-slate-900">
                    {locale === "ar" ? "العائد ما زال متاحاً" : "Yield remains available"}
                  </p>
                </div>
                <p className="mt-3 text-sm leading-7 text-slate-600">
                  {locale === "ar"
                    ? "يبقى العائد مساراً منفصلاً. قبو التقاعد لا يستبدله، بل يضيف طبقة حماية أعلى للأموال التي تريد حبسها."
                    : "Yield remains a separate rail. Retirement Vault does not replace it; it adds a heavier protection layer for money you want locked away."}
                </p>
              </div>
            </div>
            </Card>
          </MotionSurface>
        </section>

        <section className="stb-quick-actions" aria-label={locale === "ar" ? "إجراءات سريعة" : "Quick actions"}>
          <Link className="stb-quick-action" to="/wallet#deposit">
            <span className="stb-quick-action-icon">
              <ArrowDownToLine aria-hidden="true" />
            </span>
            <span>
              <strong>{locale === "ar" ? "إضافة أموال" : "Add money"}</strong>
              <span>
                {locale === "ar"
                  ? "افتح عنوان الإيداع وسجّل التوقع قبل وصول الأموال."
                  : "Open the deposit address and record the expectation before funds arrive."}
              </span>
            </span>
          </Link>
          <Link className="stb-quick-action" to="/wallet#withdraw">
            <span className="stb-quick-action-icon">
              <ArrowUpFromLine aria-hidden="true" />
            </span>
            <span>
              <strong>{locale === "ar" ? "سحب" : "Withdraw"}</strong>
              <span>
                {locale === "ar"
                  ? "ابدأ طلب سحب محمي بخطوة تحقق واضحة."
                  : "Start a protected withdrawal with a clear verification step."}
              </span>
            </span>
          </Link>
          <Link className="stb-quick-action" to="/wallet#transfer">
            <span className="stb-quick-action-icon">
              <Send aria-hidden="true" />
            </span>
            <span>
              <strong>{locale === "ar" ? "تحويل داخلي" : "Send internally"}</strong>
              <span>
                {locale === "ar"
                  ? "انقل الرصيد إلى عميل آخر بعد معاينة المستلم."
                  : "Move balance to another customer after previewing the recipient."}
              </span>
            </span>
          </Link>
          <Link
            className="stb-quick-action"
            state={suggestedCopilotQuestion ? { suggestedPrompt: suggestedCopilotQuestion } : undefined}
            to="/copilot"
          >
            <span className="stb-quick-action-icon">
              <Bot aria-hidden="true" />
            </span>
            <span>
              <strong>{locale === "ar" ? "اسأل المساعد" : "Ask AI"}</strong>
              <span>
                {suggestedCopilotQuestion ??
                  (locale === "ar"
                    ? "حوّل سياق حسابك إلى إجابة مفهومة."
                    : "Turn your account context into an understandable answer.")}
              </span>
            </span>
          </Link>
        </section>

        <MotionSurface className="stb-pressable-shell">
          <Card className="stb-surface stb-ai-panel stb-reveal rounded-[1.8rem] border-0 p-6" data-delay="1">
            <div className="stb-ai-header">
              <div className="flex items-start gap-4">
                <span className="stb-ai-icon">
                  <Sparkles aria-hidden="true" />
                </span>
                <div>
                  <p className="stb-section-kicker">
                    {locale === "ar" ? "رؤى الذكاء الاصطناعي" : "AI insights"}
                  </p>
                  <h2 className="stb-page-title mt-2 text-2xl font-semibold text-slate-950">
                    {locale === "ar" ? "الخطوة التالية الأكثر وضوحاً" : "Your clearest next step"}
                  </h2>
                </div>
              </div>
              <span className="stb-ai-status">
                {copilotQuery.isLoading
                  ? locale === "ar"
                    ? "جارٍ المزامنة"
                    : "Syncing"
                  : copilotQuery.data?.capabilities.externalAiAvailable
                    ? locale === "ar"
                      ? "ذكاء مباشر متاح"
                      : "Live AI available"
                    : locale === "ar"
                      ? "معاينة موجهة"
                      : "Guided preview"}
              </span>
            </div>
            <p className="stb-ai-copy">{aiInsight}</p>
            <div className="stb-ai-insight-list">
              <div className="stb-ai-insight">
                <strong>{locale === "ar" ? "حركة الأموال" : "Money movement"}</strong>
                <span>
                  {locale === "ar"
                    ? `${activeIntentCount} طلبات نشطة و${pendingAssetCount} أصول معلقة.`
                    : `${activeIntentCount} active requests and ${pendingAssetCount} pending assets.`}
                </span>
              </div>
              <div className="stb-ai-insight">
                <strong>{locale === "ar" ? "الأموال المحمية" : "Protected funds"}</strong>
                <span>
                  {locale === "ar"
                    ? `${formatTokenAmount(String(lockedVaultBalance), locale)} مقفلة خارج السيولة اليومية.`
                    : `${formatTokenAmount(String(lockedVaultBalance), locale)} locked outside daily liquidity.`}
                </span>
              </div>
              <div className="stb-ai-insight">
                <strong>{locale === "ar" ? "جاهزية المساعد" : "Copilot readiness"}</strong>
                <span>
                  {copilotQuery.data?.capabilities.providerName ??
                    copilotQuery.data?.capabilities.model ??
                    (locale === "ar"
                      ? "يعمل ضمن حدود الحساب المعتمدة."
                      : "Operating within approved account boundaries.")}
                </span>
              </div>
            </div>
            <div className="stb-ai-actions">
              <Button asChild className="rounded-full">
                <Link
                  state={suggestedCopilotQuestion ? { suggestedPrompt: suggestedCopilotQuestion } : undefined}
                  to="/copilot"
                >
                  {locale === "ar" ? "فتح المساعد المالي" : "Open Financial Copilot"}
                  <ArrowRight className="h-4 w-4 rtl:rotate-180" />
                </Link>
              </Button>
              <Button asChild className="rounded-full" variant="outline">
                <Link to="/wealth-brief">
                  {locale === "ar" ? "إنشاء موجز الثروة" : "Create wealth brief"}
                </Link>
              </Button>
              <Button asChild className="rounded-full" variant="ghost">
                <Link to="/transactions">
                  {locale === "ar" ? "مراجعة السجل" : "Review ledger"}
                </Link>
              </Button>
            </div>
          </Card>
        </MotionSurface>

        {balancesQuery.isError ? (
          <Card className="stb-trust-note rounded-[1.6rem] border-0 p-5 text-sm text-red-700" data-tone="critical">
            {balancesQuery.error instanceof Error
              ? balancesQuery.error.message
              : t("dashboard.loadBalancesError")}
          </Card>
        ) : balances.length > 0 ? (
          <section className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
            {balances.map((balance) => (
              <Card key={balance.asset.id} className="stb-surface stb-asset-card stb-reveal rounded-[1.7rem] border-0 p-5" data-delay="2">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="stb-asset-mark" aria-hidden="true">
                      {balance.asset.symbol.slice(0, 3)}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900">
                        {balance.asset.displayName}
                      </p>
                      <p className="stb-page-title mt-2 text-3xl font-semibold text-slate-950">
                        {formatTokenAmount(balance.availableBalance, locale)}{" "}
                        <span className="text-base font-sans text-slate-500">{balance.asset.symbol}</span>
                      </p>
                    </div>
                  </div>
                  <StatusBadge
                    label={
                      hasPendingBalance(balance.pendingBalance)
                        ? locale === "ar"
                          ? "معلّق"
                          : "Pending"
                        : locale === "ar"
                          ? "متاح"
                          : "Available"
                    }
                    tone={hasPendingBalance(balance.pendingBalance) ? "warning" : "positive"}
                  />
                </div>
                <div className="mt-5 grid gap-3 rounded-[1.25rem] border border-slate-200/70 bg-white/75 p-4 text-sm text-slate-600">
                  <div className="flex items-center justify-between gap-3">
                    <span>{locale === "ar" ? "متاح" : "Available"}</span>
                    <span className="font-semibold text-slate-950">
                      {formatTokenAmount(balance.availableBalance, locale)} {balance.asset.symbol}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span>{locale === "ar" ? "معلّق" : "Pending"}</span>
                    <span className="font-semibold text-slate-950">
                      {formatTokenAmount(balance.pendingBalance, locale)} {balance.asset.symbol}
                    </span>
                  </div>
                </div>
                <p className="mt-4 text-xs uppercase tracking-[0.12em] text-slate-500">
                  {t("dashboard.updatedPrefix", {
                    date: formatDateLabel(balance.updatedAt, locale)
                  })}
                </p>
              </Card>
            ))}
          </section>
        ) : (
          <Card className="stb-surface rounded-[1.7rem] border-0 p-6">
            <h2 className="text-lg font-semibold text-slate-950">
              {t("dashboard.noBalancesTitle")}
            </h2>
            <p className="stb-empty-panel mt-3">
              {t("dashboard.noBalancesDescription")}
            </p>
          </Card>
        )}

        <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <Card className="stb-surface stb-reveal rounded-[1.8rem] border-0 p-6" data-delay="2">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="stb-section-kicker">{t("dashboard.recentTransactions")}</p>
                <h2 className="mt-2 text-2xl font-semibold text-slate-950">
                  {locale === "ar" ? "النشاط الحديث" : "Recent activity"}
                </h2>
              </div>
              <Button asChild variant="outline" className="rounded-full">
                <Link to="/transactions">{t("dashboard.viewAll")}</Link>
              </Button>
            </div>

            <div className="mt-5 space-y-3">
              {historyQuery.isError ? (
                <div className="stb-trust-note text-sm text-red-700" data-tone="critical">
                  {historyQuery.error instanceof Error
                    ? historyQuery.error.message
                    : t("dashboard.historyError")}
                </div>
              ) : intents.length > 0 ? (
                intents.map((intent) => {
                  const confidence = getIntentConfidenceStatus(intent.status);

                  return (
                    <div
                      key={intent.id}
                      className="rounded-[1.4rem] border border-slate-200 bg-white/80 p-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-950">
                            {normalizeIntentTypeLabel(
                              intent.intentType,
                              locale,
                              intent.transferDirection
                            )}
                          </p>
                          <p className="mt-1 text-sm text-slate-600">
                            {formatIntentAmount(
                              intent.settledAmount ?? intent.requestedAmount,
                              intent.asset.symbol,
                              intent.intentType,
                              locale,
                              intent.transferDirection
                            )}
                          </p>
                        </div>
                        <StatusBadge
                          label={formatIntentStatusLabel(intent.status, locale)}
                          tone={getTransactionConfidenceTone(confidence)}
                        />
                      </div>
                      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-500">
                        <span>{formatDateLabel(intent.createdAt, locale)}</span>
                        <span className="stb-ref">
                          <bdi>
                            {formatShortAddress(
                              resolveIntentAddress(intent),
                              t("shared.notAvailable")
                            )}
                          </bdi>
                        </span>
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="stb-empty-panel">
                  {t("dashboard.emptyHistory")}
                </p>
              )}
            </div>
          </Card>

          <Card className="stb-surface stb-reveal rounded-[1.8rem] border-0 p-6" data-delay="3">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <Landmark className="h-4 w-4 text-emerald-700" />
              {locale === "ar" ? "الثقة والسلامة" : "Trust & safety"}
            </div>
            <div className="mt-5 space-y-4 text-sm leading-7 text-slate-600">
              <p>
                {locale === "ar"
                  ? "تعرض عمليات الإيداع والسحب الحالة الحالية والخطوة التالية والتأخير المتوقع."
                  : "Deposit and withdrawal flows expose the current state, next step, and expected delay."}
              </p>
              <p>
                {locale === "ar"
                  ? "تبقى معرفات المراجع والطوابع الزمنية مرئية عندما تهم الثقة."
                  : "Reference IDs and timestamps stay visible wherever traceability matters."}
              </p>
              <p>
                {locale === "ar"
                  ? "يتم شرح التأخير الطبيعي على السلسلة باعتباره وقت تسوية، لا خطأ."
                  : "Normal blockchain delay is explained as settlement time, not generic failure."}
              </p>
            </div>
          </Card>
        </section>
      </ScreenTransition>
    </Layout>
  );
};

export default Index;
