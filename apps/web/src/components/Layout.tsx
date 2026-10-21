import type { ReactNode } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import {
  Activity,
  ArrowLeftRight,
  ArrowUpRight,
  Bot,
  BrainCircuit,
  CircleHelp,
  FileText,
  Fingerprint,
  Landmark,
  LayoutDashboard,
  LineChart,
  ListChecks,
  LockKeyhole,
  Search,
  Scale,
  ShieldCheck,
  TrendingUp,
  UserRound,
  Wallet,
  Workflow
} from "lucide-react";
import { useBranding } from "@/branding/BrandingProvider";
import { CustomerNotificationBell } from "@/components/notifications/CustomerNotificationBell";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { Logo } from "@/components/ui/logo";
import { useLocale } from "@/i18n/use-locale";
import { useT } from "@/i18n/use-t";
import { formatShortAddress } from "@/lib/customer-finance";
import { useUserStore } from "@/stores/userStore";

type LayoutProps = {
  children: ReactNode;
};

export const Layout = ({ children }: LayoutProps) => {
  const location = useLocation();
  const { locale } = useLocale();
  const { branding } = useBranding();
  const t = useT();
  const user = useUserStore((state) => state.user);

  const navGroups = [
    {
      label: locale === "ar" ? "الخدمات اليومية" : "Everyday banking",
      items: [
        { label: t("navigation.dashboard"), path: "/dashboard", icon: LayoutDashboard },
        { label: t("navigation.wallet"), path: "/wallet", icon: Wallet },
        {
          label: t("navigation.transactions"),
          path: "/transactions",
          icon: ArrowLeftRight
        }
      ]
    },
    {
      label: locale === "ar" ? "النمو والحماية" : "Grow & protect",
      items: [
        {
          label: locale === "ar" ? "قبو التقاعد" : "Retirement Vault",
          path: "/vault",
          icon: LockKeyhole
        },
        {
          label: locale === "ar" ? "العائد" : "Yield",
          path: "/yield",
          icon: TrendingUp
        },
        { label: t("navigation.loans"), path: "/loans", icon: Landmark }
      ]
    },
    {
      label: locale === "ar" ? "الذكاء المالي" : "AI intelligence",
      items: [
        {
          label: locale === "ar" ? "موجز الثروة" : "Wealth Brief",
          path: "/wealth-brief",
          icon: FileText
        },
        {
          label: locale === "ar" ? "فرص البحث" : "Opportunities",
          path: "/opportunities",
          icon: Search
        },
        {
          label: locale === "ar" ? "حارس الثروة" : "Wealth Guardian",
          path: "/wealth-guardian",
          icon: ShieldCheck
        },
        {
          label: locale === "ar" ? "المساعد المالي" : "AI Copilot",
          path: "/copilot",
          icon: Bot
        },
        {
          label: locale === "ar" ? "ذاكرة الذكاء المالي" : "AI Memory",
          path: "/ai-memory",
          icon: BrainCircuit
        },
        {
          label: locale === "ar" ? "ذكاء المستندات" : "Documents",
          path: "/documents",
          icon: FileText
        },
        {
          label: locale === "ar" ? "خطط البحث" : "Plan Studio",
          path: "/research-plans",
          icon: ListChecks
        },
        {
          label: locale === "ar" ? "مختبر المخاطر" : "Risk Lab",
          path: "/portfolio-risk",
          icon: LineChart
        },
        {
          label: locale === "ar" ? "لجنة الاستثمار" : "Investment Committee",
          path: "/investment-committee",
          icon: Scale
        },
        {
          label: locale === "ar" ? "تدفقات الوكلاء" : "Workflow Studio",
          path: "/ai-workflows",
          icon: Workflow
        },
        {
          label: locale === "ar" ? "مرصد الوكلاء" : "AI Observatory",
          path: "/ai-observatory",
          icon: Activity
        }
      ]
    },
    {
      label: locale === "ar" ? "الحساب" : "Account",
      items: [
        { label: t("navigation.profile"), path: "/profile", icon: UserRound },
        {
          label: locale === "ar" ? "إثباتي" : "My proof",
          path: "/proofs/me",
          icon: Fingerprint
        }
      ]
    }
  ];

  const navItems = navGroups.flatMap((group) => group.items);
  const currentSection =
    navItems.find((item) => item.path === location.pathname)?.label ??
    (locale === "ar" ? "منصة العميل" : "Customer workspace");
  const currentGroup =
    navGroups.find((group) =>
      group.items.some((item) => item.path === location.pathname)
    )?.label ?? (locale === "ar" ? "مساحة آمنة" : "Secure workspace");
  const accountInitial = (user?.firstName || user?.email || "C").charAt(0).toUpperCase();

  return (
    <div className="stb-app-shell">
      <aside className="stb-app-sidebar">
        <div className="stb-app-brand">
          <Link to="/dashboard" aria-label={`${branding.productName} dashboard`}>
            <Logo size="md" />
          </Link>
          <p>{branding.tagline}</p>
        </div>

        <nav className="stb-app-nav" aria-label={locale === "ar" ? "التنقل الرئيسي" : "Main navigation"}>
          {navGroups.map((group) => (
            <section className="stb-app-nav-group" key={group.label}>
              <h2>{group.label}</h2>
              <div className="stb-app-nav-items">
                {group.items.map((item) => (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    className={({ isActive }) =>
                      isActive ? "stb-app-nav-link active" : "stb-app-nav-link"
                    }
                  >
                    <item.icon aria-hidden="true" />
                    <span>{item.label}</span>
                  </NavLink>
                ))}
              </div>
            </section>
          ))}
        </nav>

        <div className="stb-app-sidebar-footer">
          <Link className="stb-app-trust-link" to="/trust/solvency">
            <ShieldCheck aria-hidden="true" />
            <span>{locale === "ar" ? "مركز الثقة" : "Trust center"}</span>
            <ArrowUpRight aria-hidden="true" />
          </Link>
          <Link className="stb-app-account" to="/profile">
            <span className="stb-app-avatar" aria-hidden="true">{accountInitial}</span>
            <span className="stb-app-account-copy">
              <strong>{user?.firstName || (locale === "ar" ? "حسابك" : "Your account")}</strong>
              <bdi>{formatShortAddress(user?.ethereumAddress, t("layout.noWallet"))}</bdi>
            </span>
            <ArrowUpRight aria-hidden="true" />
          </Link>
        </div>
      </aside>

      <div className="stb-app-workspace">
        <header className="stb-app-topbar">
          <div className="stb-app-page-context">
            <p>{currentGroup}</p>
            <strong>{currentSection}</strong>
          </div>
          <div className="stb-app-top-actions">
            <Link className="stb-app-help" to="/trust/solvency">
              <CircleHelp aria-hidden="true" />
              <span>{locale === "ar" ? "المساعدة والأمان" : "Help & safety"}</span>
            </Link>
            <CustomerNotificationBell />
            <LanguageSwitcher />
            <Link className="stb-app-mobile-avatar" to="/profile" aria-label={t("navigation.profile")}>
              {accountInitial}
            </Link>
          </div>
        </header>

        <main className="stb-app-content">{children}</main>
      </div>
    </div>
  );
};
