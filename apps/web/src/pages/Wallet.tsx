import { useEffect } from "react";
import { Layout } from "@/components/Layout";
import { MotionSurface, ScreenTransition } from "@/components/motion/primitives";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { InlineLoader } from "@/components/ui/loading-panel";
import { Link, useLocation } from "react-router-dom";
import { useT } from "@/i18n/use-t";
import { useLocale } from "@/i18n/use-locale";
import { useMyBalances } from "@/hooks/balances/useMyBalances";
import { useMyRetirementVaults } from "@/hooks/retirement-vault/useMyRetirementVaults";
import { useSupportedAssets } from "@/hooks/assets/useSupportedAssets";
import DepositCard from "./wallet/DepositCard";
import InternalTransferCard from "./wallet/InternalTransferCard";
import WithdrawCard from "./wallet/WithdrawCard";
import { useUserStore } from "@/stores/userStore";
import { formatDateLabel, formatTokenAmount } from "@/lib/customer-finance";
import { formatRelativeTimeLabel, isTimestampOlderThan } from "@stealth-trails-bank/ui-foundation";
import { LockKeyhole, ShieldCheck } from "lucide-react";

const Wallet = () => {
  const t = useT();
  const { locale } = useLocale();
  const location = useLocation();
  const user = useUserStore((state) => state.user);
  const supportedAssetsQuery = useSupportedAssets();
  const balancesQuery = useMyBalances();
  const retirementVaultsQuery = useMyRetirementVaults();
  const balances = balancesQuery.data?.balances ?? [];
  const vaults = retirementVaultsQuery.data?.vaults ?? [];
  const latestBalanceUpdate = balances
    .map((balance) => balance.updatedAt)
    .sort((left, right) => Date.parse(right) - Date.parse(left))[0];
  const staleBalanceData = isTimestampOlderThan(latestBalanceUpdate, 24);
  const totalLockedBalance = vaults.reduce(
    (sum, vault) => sum + Number.parseFloat(vault.lockedBalance || "0"),
    0
  );
  const nextVaultUnlock = vaults
    .map((vault) => vault.unlockAt)
    .sort((left, right) => Date.parse(left) - Date.parse(right))[0];

  useEffect(() => {
    if (!location.hash) {
      return;
    }

    const target = document.getElementById(location.hash.slice(1));
    target?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [location.hash]);

  return (
    <Layout>
      <ScreenTransition className="stb-page-stack">
        <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <MotionSurface className="stb-pressable-shell">
            <Card className="stb-surface stb-wallet-overview stb-reveal rounded-[2rem] border-0 p-6">
            <div className="space-y-4">
              <div>
                <p className="stb-section-kicker">
                  {locale === "ar" ? "المحفظة" : "Wallet"}
                </p>
                <h1 className="stb-page-title mt-2 text-3xl font-semibold text-slate-950">
                  {t("wallet.title")}
                </h1>
                <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
                  {t("wallet.description")}{" "}
                  <Link className="font-semibold text-slate-950 underline" to="/transactions">
                    {t("wallet.historyLink")}
                  </Link>
                </p>
              </div>

              <div className="stb-financial-grid">
                <div className="stb-financial-card">
                  <p className="stb-financial-label">
                    {locale === "ar" ? "الأصول المدعومة" : "Supported assets"}
                  </p>
                  <strong className="stb-financial-value">
                    {supportedAssetsQuery.isLoading ? (
                      <InlineLoader label={locale === "ar" ? "جارٍ التحميل" : "Loading"} />
                    ) : (
                      supportedAssetsQuery.data?.assets.length ?? 0
                    )}
                  </strong>
                  <span className="stb-financial-detail">
                    {locale === "ar" ? "متاحة للإيداع والتحويل" : "Available for deposit and transfer"}
                  </span>
                </div>
                <div className="stb-financial-card">
                  <p className="stb-financial-label">
                    {locale === "ar" ? "أصول ممولة" : "Funded assets"}
                  </p>
                  <strong className="stb-financial-value">
                    {balances.filter((balance) => Number(balance.availableBalance) > 0).length}
                  </strong>
                  <span className="stb-financial-detail">
                    {locale === "ar" ? "برصيد متاح حالياً" : "With spendable balance now"}
                  </span>
                </div>
                <div className="stb-financial-card stb-financial-card--primary stb-inverse-metric">
                  <p className="stb-financial-label">
                    {locale === "ar" ? "مرجع المحفظة" : "Wallet reference"}
                  </p>
                  <p className="stb-ref mt-4 break-all text-sm font-medium leading-6">
                    <bdi>{user?.ethereumAddress ?? t("layout.noWallet")}</bdi>
                  </p>
                  <span className="stb-financial-detail">
                    {locale === "ar" ? "مرجع مُدار قابل للتتبع" : "Traceable managed reference"}
                  </span>
                </div>
              </div>

              {latestBalanceUpdate ? (
                <div
                  className={`stb-trust-note text-sm ${
                    staleBalanceData
                      ? "text-amber-900"
                      : "text-slate-700"
                  }`}
                  data-tone={staleBalanceData ? "warning" : "positive"}
                  role="status"
                >
                  {staleBalanceData
                    ? locale === "ar"
                      ? `تأخر آخر تحديث للأرصدة. آخر مزامنة كانت ${formatDateLabel(
                          latestBalanceUpdate,
                          locale
                        )} (${formatRelativeTimeLabel(latestBalanceUpdate, locale)}).`
                      : `Balance data is older than expected. Last synced ${formatDateLabel(
                          latestBalanceUpdate,
                          locale
                        )} (${formatRelativeTimeLabel(latestBalanceUpdate, locale)}).`
                    : locale === "ar"
                      ? `آخر مزامنة للأرصدة ${formatDateLabel(
                          latestBalanceUpdate,
                          locale
                        )} (${formatRelativeTimeLabel(latestBalanceUpdate, locale)}).`
                      : `Balances last synced ${formatDateLabel(
                          latestBalanceUpdate,
                          locale
                        )} (${formatRelativeTimeLabel(latestBalanceUpdate, locale)}).`}
                </div>
              ) : null}

              {balancesQuery.isError ? (
                <div
                  className="stb-trust-note text-sm text-red-700"
                  data-tone="critical"
                  role="alert"
                >
                  {balancesQuery.error instanceof Error
                    ? balancesQuery.error.message
                    : t("wallet.balancesError")}
                </div>
              ) : balances.length > 0 ? (
                <div className="grid gap-3 md:grid-cols-2">
                  {balances.map((balance) => (
                    <div
                      key={balance.asset.id}
                      className="stb-section-frame stb-asset-card p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <span className="stb-asset-mark" aria-hidden="true">
                            {balance.asset.symbol.slice(0, 3)}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-slate-950">
                              {balance.asset.displayName}
                            </p>
                            <p className="mt-1 text-xs uppercase tracking-[0.12em] text-slate-500">
                              {balance.asset.symbol}
                            </p>
                          </div>
                        </div>
                        <p className="stb-page-title text-2xl font-semibold text-slate-950">
                          {formatTokenAmount(balance.availableBalance, locale)}
                        </p>
                      </div>
                      <div className="mt-4 grid gap-2 rounded-[1rem] bg-white/60 p-3 text-sm text-slate-600">
                        <div className="flex justify-between gap-3">
                          <span>{locale === "ar" ? "متاح" : "Available"}</span>
                          <span className="font-semibold text-slate-950">
                            {formatTokenAmount(balance.availableBalance, locale)} {balance.asset.symbol}
                          </span>
                        </div>
                        <div className="flex justify-between gap-3">
                          <span>{locale === "ar" ? "معلّق" : "Pending"}</span>
                          <span className="font-semibold text-slate-950">
                            {formatTokenAmount(balance.pendingBalance, locale)} {balance.asset.symbol}
                          </span>
                        </div>
                      </div>
                      <p className="mt-3 text-xs uppercase tracking-[0.12em] text-slate-500">
                        {formatDateLabel(balance.updatedAt, locale)} ·{" "}
                        {formatRelativeTimeLabel(balance.updatedAt, locale)}
                      </p>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
            </Card>
          </MotionSurface>

          <MotionSurface className="stb-pressable-shell">
            <Card className="stb-surface stb-reveal rounded-[2rem] border-0 p-6" data-delay="1">
            <h2 className="text-xl font-semibold text-slate-950">
              {locale === "ar" ? "ما الذي سيحدث بعد ذلك" : "What happens next"}
            </h2>
            <div className="mt-5 space-y-4 text-sm leading-7 text-slate-600">
              <p>{t("wallet.noteOne")}</p>
              <p>{t("wallet.noteTwo")}</p>
              <p>{t("wallet.noteThree")}</p>
            </div>
            </Card>
          </MotionSurface>
        </section>

        <MotionSurface className="stb-pressable-shell">
          <Card className="stb-surface stb-reveal rounded-[2rem] border-0 p-6" data-delay="2">
            <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px] xl:items-center">
              <div className="space-y-4">
                <div>
                  <p className="stb-section-kicker">
                    {locale === "ar" ? "قبو التقاعد" : "Retirement Vault"}
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold text-slate-950">
                    {locale === "ar"
                      ? "الرصيد المقفل خارج السحب العادي"
                      : "Locked balance outside normal withdrawals"}
                  </h2>
                  <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
                    {locale === "ar"
                      ? "يمكنك الآن عرض الرصيد المقفل بوضوح وتمويله من هذا المنتج دون خلطه مع الرصيد المتاح أو المعلّق."
                      : "You can now view locked balance clearly and fund it from this product without mixing it into available or pending balance."}
                  </p>
                </div>

                <div className="grid gap-3 md:grid-cols-3">
                  <div className="stb-section-frame p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                      {locale === "ar" ? "إجمالي المقفل" : "Total locked"}
                    </p>
                    <p className="mt-3 text-3xl font-semibold text-slate-950">
                      {retirementVaultsQuery.isLoading ? (
                        <InlineLoader label={locale === "ar" ? "جارٍ التحميل" : "Loading"} />
                      ) : (
                        formatTokenAmount(String(totalLockedBalance), locale)
                      )}
                    </p>
                  </div>
                  <div className="stb-section-frame p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                      {locale === "ar" ? "عدد الأقبية" : "Vault count"}
                    </p>
                    <p className="mt-3 text-3xl font-semibold text-slate-950">
                      {vaults.length}
                    </p>
                  </div>
                  <div className="stb-section-frame p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                      {locale === "ar" ? "أقرب إفراج" : "Next release"}
                    </p>
                    <p className="mt-3 text-sm font-semibold text-slate-950">
                      {nextVaultUnlock
                        ? formatDateLabel(nextVaultUnlock, locale)
                        : locale === "ar"
                          ? "لا يوجد بعد"
                          : "Not scheduled yet"}
                    </p>
                  </div>
                </div>

                {vaults.length > 0 ? (
                  <div className="grid gap-3 md:grid-cols-2">
                    {vaults.slice(0, 2).map((vault) => (
                      <div key={vault.id} className="rounded-[1.25rem] border border-slate-200/70 bg-white/75 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-slate-900">
                              {vault.asset.displayName}
                            </p>
                            <p className="mt-2 text-xl font-semibold text-slate-950">
                              {formatTokenAmount(vault.lockedBalance, locale)} {vault.asset.symbol}
                            </p>
                          </div>
                          <div className="rounded-full bg-slate-950 px-3 py-1 text-xs font-semibold text-white">
                            {vault.strictMode
                              ? locale === "ar"
                                ? "صارم"
                                : "Strict"
                              : locale === "ar"
                                ? "نشط"
                                : "Active"}
                          </div>
                        </div>
                        <p className="mt-3 text-sm text-slate-600">
                          {locale === "ar" ? "الإفراج:" : "Release:"}{" "}
                          {formatDateLabel(vault.unlockAt, locale)}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>

              <div className="rounded-[1.6rem] bg-slate-950 p-5 text-white">
                <div className="flex items-center gap-2 text-sm font-medium text-white/84">
                  <LockKeyhole className="h-4 w-4 text-emerald-300" />
                  {locale === "ar" ? "حماية السحب" : "Withdrawal protection"}
                </div>
                <p className="mt-3 text-sm leading-7 text-white/72">
                  {locale === "ar"
                    ? "أموال القبو لا تظهر كرصد متاح للسحب. أنشئ القبو أو موّله من صفحة القبو المخصصة."
                    : "Vault funds do not appear as spendable withdrawal balance. Create or fund the vault from the dedicated vault page."}
                </p>
                <div className="mt-5 space-y-3">
                  <Button asChild className="w-full rounded-[1rem] bg-white text-slate-950 hover:bg-white/92">
                    <Link to="/vault">
                      {locale === "ar" ? "فتح قبو التقاعد" : "Open Retirement Vault"}
                    </Link>
                  </Button>
                  <div className="flex items-center gap-2 text-sm text-white/65">
                    <ShieldCheck className="h-4 w-4 text-emerald-300" />
                    {locale === "ar"
                      ? "تمويل القبو ينقل المال من الرصيد السائل إلى الرصيد المقفل."
                      : "Funding the vault moves money from liquid balance into locked balance."}
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </MotionSurface>

        <section aria-labelledby="wallet-transfer-heading">
          <div className="stb-transfer-header">
            <div>
              <p className="stb-section-kicker">
                {locale === "ar" ? "حركة الأموال" : "Money movement"}
              </p>
              <h2 className="stb-page-title mt-2 text-2xl font-semibold text-slate-950" id="wallet-transfer-heading">
                {locale === "ar" ? "إيداع وسحب وتحويل بثقة" : "Deposit, withdraw, and transfer with confidence"}
              </h2>
              <p>
                {locale === "ar"
                  ? "كل مسار يحتفظ بالتحقق، والمعاينة، والمرجع، والخط الزمني نفسها—مع تقديم أوضح للخطوة التالية."
                  : "Each rail keeps the same verification, preview, reference, and timeline behavior—presented with a clearer next step."}
              </p>
            </div>
          </div>
          <div className="stb-transfer-grid mt-5">
            <div className="stb-transfer-slot" id="deposit">
              <DepositCard
                walletAddress={user?.ethereumAddress ?? null}
                assets={supportedAssetsQuery.data?.assets ?? []}
                isAssetsLoading={supportedAssetsQuery.isLoading}
                assetsErrorMessage={
                  supportedAssetsQuery.isError
                    ? supportedAssetsQuery.error instanceof Error
                      ? supportedAssetsQuery.error.message
                      : t("wallet.supportedAssetsError")
                    : null
                }
              />
            </div>
            <div className="stb-transfer-slot" id="withdraw">
              <WithdrawCard
                walletAddress={user?.ethereumAddress ?? null}
                assets={supportedAssetsQuery.data?.assets ?? []}
                balances={balances}
                isAssetsLoading={supportedAssetsQuery.isLoading}
                isBalancesLoading={balancesQuery.isLoading}
                assetsErrorMessage={
                  supportedAssetsQuery.isError
                    ? supportedAssetsQuery.error instanceof Error
                      ? supportedAssetsQuery.error.message
                      : t("wallet.supportedAssetsError")
                    : null
                }
                balancesErrorMessage={
                  balancesQuery.isError
                    ? balancesQuery.error instanceof Error
                      ? balancesQuery.error.message
                      : t("wallet.balancesError")
                    : null
                }
              />
            </div>
            <div className="stb-transfer-slot" id="transfer">
              <InternalTransferCard
                assets={supportedAssetsQuery.data?.assets ?? []}
                balances={balances}
                isAssetsLoading={supportedAssetsQuery.isLoading}
                isBalancesLoading={balancesQuery.isLoading}
                assetsErrorMessage={
                  supportedAssetsQuery.isError
                    ? supportedAssetsQuery.error instanceof Error
                      ? supportedAssetsQuery.error.message
                      : t("wallet.supportedAssetsError")
                    : null
                }
                balancesErrorMessage={
                  balancesQuery.isError
                    ? balancesQuery.error instanceof Error
                      ? balancesQuery.error.message
                      : t("wallet.balancesError")
                    : null
                }
              />
            </div>
          </div>
        </section>
      </ScreenTransition>
    </Layout>
  );
};

export default Wallet;
