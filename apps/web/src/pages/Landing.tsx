import { Link } from "react-router-dom";
import {
  ArrowRight,
  Bot,
  BrainCircuit,
  Check,
  ChevronRight,
  Fingerprint,
  Landmark,
  LockKeyhole,
  ShieldCheck,
  Sparkles,
  Vault,
  WalletCards,
} from "lucide-react";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import {
  HeroItem,
  HeroReveal,
  StaggerGrid,
  StaggerItem,
} from "@/components/motion/primitives";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/ui/logo";
import { useLocale } from "@/i18n/use-locale";
import { useUserStore } from "@/stores/userStore";

const upworkProfileUrl = import.meta.env.VITE_UPWORK_PROFILE_URL?.trim();
const portfolioUrl = import.meta.env.VITE_PORTFOLIO_URL?.trim() || "https://github.com/waqasraza123";

const capabilities = [
  {
    icon: Landmark,
    title: "Financial services",
    titleAr: "الخدمات المالية",
    description:
      "Manage accounts and wallets, track transfers, and follow lending, yield, and vault activity. Balances are backed by a double-entry ledger, with settlement and reconciliation workflows behind each operation.",
    descriptionAr:
      "أدر الحسابات والمحافظ، وتتبّع التحويلات وأنشطة الإقراض والعائد والخزائن. تستند الأرصدة إلى سجل محاسبي مزدوج القيد، مع مسارات للتسوية والمطابقة خلف العمليات المالية.",
    modules: ["Accounts, wallets & transfers", "Lending & collateral workflows", "Staking, yield & retirement vaults", "Ledger, settlement & reconciliation"],
    modulesAr: ["الحسابات والمحافظ والتحويلات", "مسارات الإقراض والضمانات", "التحصيص والعائد وخزائن التقاعد", "السجل المحاسبي والتسوية والمطابقة"],
    accent: "emerald",
  },
  {
    icon: BrainCircuit,
    title: "AI research & intelligence",
    titleAr: "البحث والتحليل بالذكاء الاصطناعي",
    description:
      "Ask Copilot about account activity, investigate documents, and stress-test portfolios. Combine research tools into workflows with review checkpoints, saved context, and evidence you can inspect.",
    descriptionAr:
      "اسأل المساعد عن نشاط الحساب، وحلّل المستندات، واختبر المحافظ تحت الضغط. اجمع أدوات البحث في مسارات عمل تتضمن نقاط مراجعة وسياقاً محفوظاً وأدلة يمكنك فحصها.",
    modules: ["Copilot, Wealth Brief & customer memory", "Document analysis & research plans", "Risk Lab & Investment Committee", "Scheduled research & human review"],
    modulesAr: ["المساعد وموجز الثروة وذاكرة العميل", "تحليل المستندات وخطط البحث", "مختبر المخاطر ولجنة الاستثمار", "البحث المجدول والمراجعة البشرية"],
    accent: "blue",
  },
  {
    icon: ShieldCheck,
    title: "Operations & governance",
    titleAr: "العمليات والحوكمة",
    description:
      "Give operators dedicated tools to review withdrawals, manage restrictions, reconcile balances, and investigate incidents. Follow execution status, audit history, and reserve evidence across the system.",
    descriptionAr:
      "وفّر لفرق العمليات أدوات لمراجعة السحوبات وإدارة القيود ومطابقة الأرصدة والتحقيق في الحوادث. تتبّع حالة التنفيذ وسجل التدقيق وأدلة الاحتياطيات عبر النظام.",
    modules: ["Operator console & review queues", "Treasury, restrictions & incident handling", "Audit trails, alerts & execution workers", "Reserve proofs & on-chain report anchoring"],
    modulesAr: ["لوحة العمليات وقوائم المراجعة", "الخزينة والقيود ومعالجة الحوادث", "سجلات التدقيق والتنبيهات وعمال التنفيذ", "إثباتات الاحتياطيات وتثبيت التقارير على السلسلة"],
    accent: "violet",
  },
];

const copy = {
  en: {
    navPlatform: "Platform",
    navIntelligence: "Product tour",
    navSecurity: "Controls",
    signIn: "Demo sign in",
    signUp: "Try the demo",
    dashboard: "Open demo workspace",
    eyebrow: "AI-powered financial platform · Product demo",
    titleOne: "Financial services.",
    titleTwo: "AI intelligence.",
    titleThree: "Human control.",
    description:
      "Manage accounts, transfers, lending, yield, and protected vaults. Research portfolios with AI. Give operators the tools to review activity, reconcile balances, and follow execution across the platform.",
    attribution:
      "A working engineering demo, designed and built end to end by Waqas Raza: customer web and mobile apps, an operator console, backend services, and Ethereum smart contracts.",
    primaryCta: "Explore the live demo",
    secondaryCta: "See the platform",
    trustOne: "Ledger-backed balances",
    trustTwo: "Evidence-linked research",
    trustThree: "Policy-controlled execution",
    visualLabel: "Demo workspace · sample data",
    visualGreeting: "Good morning, Amina",
    visualBalanceLabel: "Sample portfolio balance",
    visualTrend: "Portfolio view",
    visualAvailable: "Available",
    visualProtected: "Protected",
    visualAgent: "AI portfolio research",
    visualAgentText: "Read-only · sources attached",
    visualStatus: "Withdrawal under review",
    visualLedger: "Activity trail",
    visualLedgerText: "Financial execution follows its own policy and review workflow.",
    visualControlLabel: "Financial operations",
    visualControlText: "Policy-controlled execution",
    visualReasoningLabel: "AI intelligence",
    visualReasoningText: "Research with evidence",
    visualSurfaces: ["Customer web", "Mobile app", "Operator console"],
    sectionEyebrow: "Three connected pillars",
    sectionTitle: "The platform behind the experience.",
    sectionDescription:
      "Financial services, AI research, and operational governance work together across customer apps and internal tools. Each layer has a clear role and an inspectable workflow.",
    availabilityNote:
      "The demo labels sample data, unavailable sources, and deterministic fallbacks. Live AI and network features depend on the services available in the environment.",
    trustEyebrow: "Clear authority. Inspectable evidence.",
    trustTitle: "Research has sources. Execution has controls.",
    trustDescription:
      "Check the sources behind research, the state of a financial operation, and the evidence behind reserve reports. Identity checks, permissions, review policies, and audit events make those boundaries part of the product.",
    trustLink: "Explore reserve evidence",
    trustBadge: "Traceable",
    trustCardOne: "AI with bounded authority",
    trustCardOneText:
      "Financial research tools are read-only. They can inspect data and produce cited analysis. They cannot transfer funds, sign transactions, or approve withdrawals. Research workflows can pause for human review.",
    trustCardTwo: "Governed financial execution",
    trustCardTwoText:
      "Money movement runs through dedicated financial services, with policy checks, operator review where required, execution workers, and settlement tracking. Vault releases follow their configured rules.",
    journeyEyebrow: "Explore the product",
    journeyTitle: "See how the pieces work together.",
    journeyDescription:
      "Start with the customer experience, explore the intelligence tools, then inspect the evidence that supports financial operations.",
    steps: [
      ["01", "Manage financial activity", "Explore balances, transfers, loans, yield, and retirement vaults in the customer workspace. The platform also includes a dedicated mobile app.", "Open customer workspace", "/dashboard"],
      ["02", "Investigate with AI", "Ask Copilot a question, review cited documents, model portfolio scenarios, or build a research workflow with human review checkpoints.", "Explore AI Copilot", "/copilot"],
      ["03", "Inspect the evidence", "Review reserve reports, liability inclusion proofs, and on-chain report references. Operator tools extend this with review queues, reconciliation, and incident handling.", "View reserve evidence", "/trust/solvency"],
    ],
    ctaEyebrow: "Work with Waqas Raza",
    ctaTitle: "Building a financial or AI product?",
    ctaDescription:
      "This platform shows how I connect customer experiences, backend workflows, AI research, and operational controls in one system. I help clients design and build complete products, from the first workflow to the services and tools behind it.",
    ctaButton: "Get in touch on Upwork",
    ctaWork: "See more of my work",
    footerTagline: "AI-powered financial platform · Engineering demo by Waqas Raza.",
    footerSecurity: "Reserve evidence",
    footerSignIn: "Demo sign in",
    footerCopyright: "Waqas Raza · Stealth Trails demo.",
  },
  ar: {
    navPlatform: "المنصة",
    navIntelligence: "جولة المنتج",
    navSecurity: "الضوابط",
    signIn: "دخول التجربة",
    signUp: "جرّب النظام",
    dashboard: "فتح مساحة التجربة",
    eyebrow: "منصة مالية مدعومة بالذكاء الاصطناعي · عرض تجريبي",
    titleOne: "خدمات مالية.",
    titleTwo: "تحليل ذكي.",
    titleThree: "تحكم بشري.",
    description:
      "أدر الحسابات والتحويلات والإقراض والعائد والخزائن المحمية. ابحث في المحافظ بالذكاء الاصطناعي. ووفّر لفرق العمليات أدوات لمراجعة النشاط ومطابقة الأرصدة ومتابعة التنفيذ عبر المنصة.",
    attribution:
      "عرض هندسي عملي صممه وبناه وقاص رضا من البداية إلى النهاية: تطبيقات ويب وجوال للعملاء، ولوحة عمليات، وخدمات خلفية، وعقود إيثيريوم ذكية.",
    primaryCta: "استكشف العرض المباشر",
    secondaryCta: "شاهد المنصة",
    trustOne: "أرصدة يدعمها سجل محاسبي",
    trustTwo: "بحث مرتبط بالأدلة",
    trustThree: "تنفيذ تحكمه السياسات",
    visualLabel: "مساحة تجريبية · بيانات نموذجية",
    visualGreeting: "صباح الخير، أمينة",
    visualBalanceLabel: "رصيد محفظة نموذجي",
    visualTrend: "عرض المحفظة",
    visualAvailable: "متاح",
    visualProtected: "محمي",
    visualAgent: "بحث ذكي في المحفظة",
    visualAgentText: "للقراءة فقط · المصادر مرفقة",
    visualStatus: "السحب قيد المراجعة",
    visualLedger: "سجل النشاط",
    visualLedgerText: "يتبع التنفيذ المالي مساراً مستقلاً للسياسات والمراجعة.",
    visualControlLabel: "العمليات المالية",
    visualControlText: "تنفيذ تحكمه السياسات",
    visualReasoningLabel: "التحليل الذكي",
    visualReasoningText: "بحث يستند إلى الأدلة",
    visualSurfaces: ["ويب العملاء", "تطبيق الجوال", "لوحة العمليات"],
    sectionEyebrow: "ثلاث ركائز مترابطة",
    sectionTitle: "المنصة خلف التجربة.",
    sectionDescription:
      "تتكامل الخدمات المالية والبحث بالذكاء الاصطناعي وحوكمة العمليات عبر تطبيقات العملاء والأدوات الداخلية. لكل طبقة دور واضح ومسار عمل يمكن فحصه.",
    availabilityNote:
      "يميّز العرض البيانات النموذجية والمصادر غير المتاحة والنتائج الحتمية البديلة. تعتمد ميزات الذكاء الاصطناعي والشبكات المباشرة على الخدمات المتاحة في البيئة.",
    trustEyebrow: "صلاحيات واضحة وأدلة قابلة للفحص",
    trustTitle: "للبحث مصادر. وللتنفيذ ضوابط.",
    trustDescription:
      "افحص مصادر البحث وحالة العملية المالية والأدلة وراء تقارير الاحتياطيات. تجعل فحوص الهوية والصلاحيات وسياسات المراجعة وأحداث التدقيق هذه الحدود جزءاً من المنتج.",
    trustLink: "استكشف أدلة الاحتياطيات",
    trustBadge: "قابل للتتبع",
    trustCardOne: "ذكاء اصطناعي بصلاحيات محددة",
    trustCardOneText:
      "أدوات البحث المالي للقراءة فقط. تفحص البيانات وتنتج تحليلاً موثّقاً، ولا تستطيع تحويل الأموال أو توقيع المعاملات أو الموافقة على السحوبات. ويمكن إيقاف مسارات البحث للمراجعة البشرية.",
    trustCardTwo: "تنفيذ مالي تحكمه الضوابط",
    trustCardTwoText:
      "تعمل حركة الأموال عبر خدمات مالية مخصصة، مع فحص السياسات ومراجعة المشغّلين عند الحاجة وعمال التنفيذ وتتبّع التسوية. وتتبع عمليات الإفراج من الخزائن قواعدها المحددة.",
    journeyEyebrow: "استكشف المنتج",
    journeyTitle: "شاهد كيف تتكامل الأجزاء.",
    journeyDescription:
      "ابدأ بتجربة العميل، واستكشف أدوات التحليل الذكي، ثم افحص الأدلة التي تدعم العمليات المالية.",
    steps: [
      ["01", "أدر النشاط المالي", "استكشف الأرصدة والتحويلات والقروض والعائد وخزائن التقاعد في مساحة العميل. تتضمن المنصة أيضاً تطبيقاً مخصصاً للجوال.", "افتح مساحة العميل", "/dashboard"],
      ["02", "ابحث بالذكاء الاصطناعي", "اسأل المساعد، وراجع المستندات الموثّقة، وحلّل سيناريوهات المحافظ، أو أنشئ مسار بحث بنقاط مراجعة بشرية.", "استكشف المساعد الذكي", "/copilot"],
      ["03", "افحص الأدلة", "راجع تقارير الاحتياطيات وإثباتات إدراج الالتزامات ومراجع التقارير على السلسلة. تضيف أدوات العمليات قوائم المراجعة والمطابقة ومعالجة الحوادث.", "شاهد أدلة الاحتياطيات", "/trust/solvency"],
    ],
    ctaEyebrow: "اعمل مع وقاص رضا",
    ctaTitle: "هل تبني منتجاً مالياً أو منتج ذكاء اصطناعي؟",
    ctaDescription:
      "توضح هذه المنصة كيف أربط تجارب العملاء ومسارات العمل الخلفية والبحث الذكي وضوابط العمليات في نظام واحد. أساعد العملاء على تصميم وبناء منتجات متكاملة، من أول مسار عمل إلى الخدمات والأدوات التي تدعمه.",
    ctaButton: "تواصل معي على Upwork",
    ctaWork: "شاهد المزيد من أعمالي",
    footerTagline: "منصة مالية مدعومة بالذكاء الاصطناعي · عرض هندسي من وقاص رضا.",
    footerSecurity: "أدلة الاحتياطيات",
    footerSignIn: "دخول التجربة",
    footerCopyright: "وقاص رضا · عرض Stealth Trails التجريبي.",
  },
};

export default function Landing() {
  const { locale } = useLocale();
  const user = useUserStore((state) => state.user);
  const content = copy[locale];

  return (
    <div className="landing-page min-h-screen overflow-hidden bg-[#07111f] text-white">
      <header className="landing-nav fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-[#07111f]/78 backdrop-blur-2xl">
        <div className="mx-auto flex h-[76px] w-full max-w-[1440px] items-center justify-between px-5 sm:px-8 lg:px-12">
          <Link to="/" aria-label={locale === "ar" ? "عرض Stealth Trails التجريبي" : "Stealth Trails demo home"}>
            <Logo size="sm" tone="light" className="[&>span]:hidden sm:[&>span]:inline" />
          </Link>

          <nav className="hidden items-center gap-8 lg:flex" aria-label="Primary navigation">
            <a className="landing-nav-link" href="#platform">
              {content.navPlatform}
            </a>
            <a className="landing-nav-link" href="#walkthrough">
              {content.navIntelligence}
            </a>
            <a className="landing-nav-link" href="#security">
              {content.navSecurity}
            </a>
          </nav>

          <div className="flex items-center gap-2 sm:gap-3">
            <div className="hidden sm:block">
              <LanguageSwitcher tone="light" />
            </div>
            {user ? (
              <Button asChild className="landing-nav-primary">
                <Link to="/dashboard">
                  {content.dashboard}
                  <ArrowRight className="h-4 w-4 rtl:rotate-180" />
                </Link>
              </Button>
            ) : (
              <>
                <Button asChild variant="ghost" className="landing-nav-secondary !text-slate-200 hover:!text-white">
                  <Link to="/auth/sign-in">{content.signIn}</Link>
                </Button>
                <Button asChild className="landing-nav-primary">
                  <Link to="/auth/sign-up">
                    <span>{content.signUp}</span>
                    <ArrowRight className="hidden h-4 w-4 sm:block rtl:rotate-180" />
                  </Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      <main>
        <section className="landing-hero relative isolate min-h-[900px] overflow-hidden pt-[76px]">
          <div className="landing-grid absolute inset-0 opacity-50" aria-hidden="true" />
          <div className="landing-glow landing-glow--one" aria-hidden="true" />
          <div className="landing-glow landing-glow--two" aria-hidden="true" />

          <div className="relative mx-auto grid w-full max-w-[1440px] gap-16 px-5 pb-24 pt-20 sm:px-8 sm:pt-28 lg:grid-cols-[minmax(0,0.86fr)_minmax(520px,1.14fr)] lg:items-center lg:gap-10 lg:px-12 lg:pb-32 lg:pt-32">
            <HeroReveal className="relative z-10">
              <HeroItem>
                <div className="landing-kicker">
                  <Sparkles className="h-3.5 w-3.5" />
                  {content.eyebrow}
                </div>
              </HeroItem>
              <HeroItem>
                <h1
                  aria-label={`${content.titleOne} ${content.titleTwo} ${content.titleThree}`}
                  className="landing-display mt-7 max-w-3xl text-[2.8rem] font-semibold leading-[1.08] tracking-[-0.055em] text-white sm:text-[4.2rem] lg:text-[3.7rem] xl:text-[4.3rem]"
                >
                  <span className="block">{content.titleOne}</span>
                  <span className="landing-title-accent block">{content.titleTwo}</span>
                  <span className="block pb-2">{content.titleThree}</span>
                </h1>
              </HeroItem>
              <HeroItem>
                <p className="mt-7 max-w-xl text-base leading-8 text-slate-300 sm:text-lg sm:leading-9">
                  {content.description}
                </p>
                <p className="mt-4 max-w-xl text-sm leading-7 text-slate-300">
                  {content.attribution}
                </p>
              </HeroItem>
              <HeroItem>
                <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                  <Button asChild className="landing-hero-primary h-14 px-7 text-[0.95rem]">
                    <Link to={user ? "/dashboard" : "/auth/sign-up"}>
                      {user ? content.dashboard : content.primaryCta}
                      <ArrowRight className="h-4 w-4 rtl:rotate-180" />
                    </Link>
                  </Button>
                  <Button asChild variant="outline" className="landing-hero-secondary h-14 px-7 text-[0.95rem] !text-white hover:!text-white">
                    <a href="#platform">
                      {content.secondaryCta}
                      <ChevronRight className="h-4 w-4 rtl:rotate-180" />
                    </a>
                  </Button>
                </div>
              </HeroItem>
              <HeroItem>
                <div className="mt-10 flex flex-wrap gap-x-6 gap-y-3 text-xs font-medium text-slate-400 sm:text-sm">
                  {[content.trustOne, content.trustTwo, content.trustThree].map((item) => (
                    <span className="inline-flex items-center gap-2" key={item}>
                      <Check className="h-3.5 w-3.5 text-emerald-300" />
                      {item}
                    </span>
                  ))}
                </div>
              </HeroItem>
            </HeroReveal>

            <HeroReveal className="relative z-10 lg:ps-8">
              <HeroItem>
                <ProductVisual content={content} />
              </HeroItem>
            </HeroReveal>
          </div>

          <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-b from-transparent to-[#f5f2ea]" aria-hidden="true" />
        </section>

        <section id="platform" className="scroll-mt-24 bg-[#f5f2ea] px-5 py-24 text-slate-950 sm:px-8 sm:py-32 lg:px-12">
          <div className="mx-auto max-w-[1344px]">
            <div className="grid gap-8 lg:grid-cols-[0.72fr_1.28fr] lg:items-end">
              <div>
                <p className="landing-section-kicker">{content.sectionEyebrow}</p>
                <h2 className="landing-display mt-5 max-w-xl text-4xl font-semibold leading-[1.04] tracking-[-0.055em] sm:text-5xl lg:text-[4rem]">
                  {content.sectionTitle}
                </h2>
              </div>
              <p className="max-w-2xl text-base leading-8 text-slate-600 lg:justify-self-end lg:text-lg">
                {content.sectionDescription}
              </p>
            </div>

            <StaggerGrid className="mt-14 grid gap-4 lg:grid-cols-3" delay={0.08}>
              {capabilities.map((item, index) => (
                <StaggerItem key={item.title}>
                  <article className="landing-capability-card group h-full min-h-[310px] p-6 sm:p-7">
                    <div className={`landing-capability-icon landing-capability-icon--${item.accent}`}>
                      <item.icon className="h-5 w-5" />
                    </div>
                    <div className="mt-10">
                      <p className="font-mono text-xs text-slate-400">0{index + 1}</p>
                      <h3 className="landing-display mt-4 text-2xl font-semibold tracking-[-0.04em] text-slate-950">
                        {locale === "ar" ? item.titleAr : item.title}
                      </h3>
                      <p className="mt-3 text-sm leading-7 text-slate-600">
                        {locale === "ar" ? item.descriptionAr : item.description}
                      </p>
                      <ul className="mt-6 space-y-3 border-t border-slate-200 pt-6 text-sm leading-6 text-slate-700">
                        {(locale === "ar" ? item.modulesAr : item.modules).map((module) => (
                          <li key={module} className="flex items-start gap-2">
                            <Check className="mt-1 h-3.5 w-3.5 shrink-0 text-emerald-700" aria-hidden="true" />
                            <span>{module}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </article>
                </StaggerItem>
              ))}
            </StaggerGrid>
            <p className="mt-8 max-w-3xl text-sm leading-7 text-slate-500">{content.availabilityNote}</p>
          </div>
        </section>

        <section id="security" className="scroll-mt-20 bg-[#e9eee9] px-5 py-24 text-slate-950 sm:px-8 sm:py-32 lg:px-12">
          <div className="mx-auto grid max-w-[1344px] gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:gap-24">
            <div>
              <p className="landing-section-kicker">{content.trustEyebrow}</p>
              <h2 className="landing-display mt-5 max-w-xl text-4xl font-semibold leading-[1.04] tracking-[-0.055em] sm:text-5xl lg:text-[4rem]">
                {content.trustTitle}
              </h2>
              <p className="mt-7 max-w-xl text-base leading-8 text-slate-600 sm:text-lg">
                {content.trustDescription}
              </p>
              <Link className="landing-text-link mt-8" to="/trust/solvency">
                {content.trustLink}
                <ArrowRight className="h-4 w-4 rtl:rotate-180" />
              </Link>
            </div>

            <div className="landing-security-panel relative overflow-hidden p-6 sm:p-8">
              <div className="landing-security-grid absolute inset-0" aria-hidden="true" />
              <div className="relative z-10 grid gap-4 sm:grid-cols-2">
                <div className="landing-security-card">
                  <div className="flex items-center justify-between">
                    <Fingerprint className="h-7 w-7 text-emerald-300" />
                    <span className="landing-status-dot"><span /></span>
                  </div>
                  <h3 className="landing-display mt-16 text-xl font-semibold text-white">
                    {content.trustCardOne}
                  </h3>
                  <p className="mt-3 text-sm leading-7 text-slate-300">
                    {content.trustCardOneText}
                  </p>
                </div>
                <div className="landing-security-card sm:translate-y-8">
                  <div className="flex items-center justify-between">
                    <ShieldCheck className="h-7 w-7 text-sky-300" />
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-slate-400">
                      {content.trustBadge}
                    </span>
                  </div>
                  <h3 className="landing-display mt-16 text-xl font-semibold text-white">
                    {content.trustCardTwo}
                  </h3>
                  <p className="mt-3 text-sm leading-7 text-slate-300">
                    {content.trustCardTwoText}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="walkthrough" className="scroll-mt-24 bg-[#f5f2ea] px-5 py-24 text-slate-950 sm:px-8 sm:py-32 lg:px-12">
          <div className="mx-auto max-w-[1344px]">
            <div className="mx-auto max-w-3xl text-center">
              <p className="landing-section-kicker justify-center">{content.journeyEyebrow}</p>
              <h2 className="landing-display mt-5 text-4xl font-semibold leading-[1.04] tracking-[-0.055em] sm:text-5xl lg:text-[4rem]">
                {content.journeyTitle}
              </h2>
              <p className="mx-auto mt-7 max-w-2xl text-base leading-8 text-slate-600 sm:text-lg">
                {content.journeyDescription}
              </p>
            </div>

            <div className="relative mt-16 grid gap-4 lg:grid-cols-3">
              <div className="absolute left-[16.6%] right-[16.6%] top-[2rem] hidden h-px bg-slate-300 lg:block" aria-hidden="true" />
              {content.steps.map(([number, title, description, linkLabel, href]) => (
                <article className="relative flex flex-col items-start rounded-[1.75rem] border border-slate-200/80 bg-white/65 p-7 backdrop-blur" key={number}>
                  <div className="relative z-10 flex h-16 w-16 items-center justify-center rounded-2xl border border-slate-200 bg-[#f5f2ea] font-mono text-xs font-semibold text-emerald-800 shadow-sm">
                    {number}
                  </div>
                  <h3 className="landing-display mt-8 text-2xl font-semibold tracking-[-0.04em]">{title}</h3>
                  <p className="mt-3 text-sm leading-7 text-slate-600">{description}</p>
                  <Link className="landing-text-link mt-auto pt-6" to={href}>
                    {linkLabel}
                    <ArrowRight className="h-4 w-4 rtl:rotate-180" />
                  </Link>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-[#f5f2ea] px-5 pb-8 sm:px-8 sm:pb-10 lg:px-12">
          <div className="landing-cta relative mx-auto max-w-[1344px] overflow-hidden rounded-[2.5rem] px-6 py-16 sm:px-12 sm:py-20 lg:px-20 lg:py-24">
            <div className="landing-grid absolute inset-0 opacity-30" aria-hidden="true" />
            <div className="landing-cta-orb" aria-hidden="true" />
            <div className="relative z-10 max-w-3xl">
              <p className="landing-kicker">{content.ctaEyebrow}</p>
              <h2 className="landing-display mt-6 text-4xl font-semibold leading-[1.02] tracking-[-0.06em] text-white sm:text-5xl lg:text-[4.4rem]">
                {content.ctaTitle}
              </h2>
              <p className="mt-6 max-w-2xl text-base leading-8 text-slate-300 sm:text-lg">
                {content.ctaDescription}
              </p>
              <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                {upworkProfileUrl && (
                  <Button asChild className="landing-hero-primary h-14 px-7">
                    <a href={upworkProfileUrl} target="_blank" rel="noopener noreferrer">
                      {content.ctaButton}
                      <ArrowRight className="h-4 w-4 rtl:rotate-180" />
                    </a>
                  </Button>
                )}
                <Button asChild className={upworkProfileUrl ? "landing-hero-secondary h-14 px-7 !text-white hover:!text-white" : "landing-hero-primary h-14 px-7"} variant={upworkProfileUrl ? "outline" : "default"}>
                  <a href={portfolioUrl} target="_blank" rel="noopener noreferrer">
                    {content.ctaWork}
                    <ArrowRight className="h-4 w-4 rtl:rotate-180" />
                  </a>
                </Button>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-[#f5f2ea] px-5 pb-10 pt-4 text-slate-950 sm:px-8 lg:px-12">
        <div className="mx-auto flex max-w-[1344px] flex-col gap-8 border-t border-slate-300/70 pt-8 md:flex-row md:items-center md:justify-between">
          <div>
            <Logo size="sm" tone="dark" />
            <p className="mt-3 text-sm text-slate-500">{content.footerTagline}</p>
          </div>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3 text-sm font-medium text-slate-600">
            <Link className="hover:text-slate-950" to="/trust/solvency">{content.footerSecurity}</Link>
            <Link className="hover:text-slate-950" to="/auth/sign-in">{content.footerSignIn}</Link>
            <span className="text-slate-400">© {new Date().getFullYear()} {content.footerCopyright}</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

type LandingCopy = (typeof copy)["en"];

function ProductVisual({ content }: { content: LandingCopy }) {
  return (
    <div className="landing-product-wrap relative mx-auto max-w-[720px]">
      <div className="landing-product-halo" aria-hidden="true" />
      <div className="landing-product-window relative overflow-hidden rounded-[2rem] p-3 sm:p-4" aria-label={content.visualLabel}>
        <div className="flex items-center justify-between px-2 pb-3 pt-1 sm:px-3">
          <div className="flex items-center gap-1.5" aria-hidden="true">
            <span className="h-2.5 w-2.5 rounded-full bg-white/20" />
            <span className="h-2.5 w-2.5 rounded-full bg-white/12" />
            <span className="h-2.5 w-2.5 rounded-full bg-white/8" />
          </div>
          <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-white/35 sm:text-[10px]">
            {content.visualLabel}
          </p>
          <LockKeyhole className="h-3.5 w-3.5 text-emerald-300/70" />
        </div>

        <div className="grid gap-3 rounded-[1.55rem] border border-white/10 bg-[#0a1625]/92 p-3 shadow-2xl sm:p-4">
          <div className="grid gap-3 sm:grid-cols-[1.35fr_0.65fr]">
            <div className="landing-visual-card landing-visual-card--main p-5 sm:p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-medium text-slate-400">{content.visualGreeting}</p>
                  <p className="mt-5 text-[11px] uppercase tracking-[0.16em] text-slate-500">{content.visualBalanceLabel}</p>
                  <p className="landing-display mt-2 text-3xl font-semibold tracking-[-0.05em] text-white sm:text-4xl">$124,860<span className="text-emerald-300">.40</span></p>
                </div>
                <div className="rounded-xl border border-emerald-300/15 bg-emerald-300/10 p-2.5">
                  <Landmark className="h-4 w-4 text-emerald-300" />
                </div>
              </div>

              <div className="mt-8">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase tracking-[0.16em] text-slate-500">{content.visualTrend}</span>
                  <span className="font-mono text-[10px] text-emerald-300">+4.8%</span>
                </div>
                <svg className="mt-2 h-20 w-full" viewBox="0 0 420 90" fill="none" preserveAspectRatio="none" aria-hidden="true">
                  <defs>
                    <linearGradient id="landingChartFill" x1="0" y1="0" x2="0" y2="1">
                      <stop stopColor="#6ee7c7" stopOpacity="0.22" />
                      <stop offset="1" stopColor="#6ee7c7" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <path d="M0 75C34 72 38 62 68 64C101 66 100 45 132 50C163 55 174 31 205 37C238 43 245 55 277 37C307 20 323 31 347 20C371 9 388 18 420 5V90H0V75Z" fill="url(#landingChartFill)" />
                  <path d="M0 75C34 72 38 62 68 64C101 66 100 45 132 50C163 55 174 31 205 37C238 43 245 55 277 37C307 20 323 31 347 20C371 9 388 18 420 5" stroke="#6ee7c7" strokeWidth="2.2" strokeLinecap="round" />
                  <circle cx="420" cy="5" r="4" fill="#07111f" stroke="#6ee7c7" strokeWidth="2" />
                </svg>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-1">
              <div className="landing-visual-card p-4">
                <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.13em] text-slate-500">
                  <WalletCards className="h-3.5 w-3.5 text-sky-300" />
                  {content.visualAvailable}
                </div>
                <p className="landing-display mt-4 text-xl font-semibold text-white">$82.4k</p>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/5">
                  <div className="h-full w-[68%] rounded-full bg-sky-300" />
                </div>
              </div>
              <div className="landing-visual-card p-4">
                <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.13em] text-slate-500">
                  <Vault className="h-3.5 w-3.5 text-violet-300" />
                  {content.visualProtected}
                </div>
                <p className="landing-display mt-4 text-xl font-semibold text-white">$42.4k</p>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/5">
                  <div className="h-full w-[34%] rounded-full bg-violet-300" />
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="landing-visual-card flex items-center gap-4 p-4">
              <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-300 text-[#07111f]">
                <Bot className="h-5 w-5" />
                <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-[#101d2c] bg-emerald-300" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-white">{content.visualAgent}</p>
                <p className="mt-1 truncate text-[11px] text-slate-400">{content.visualAgentText}</p>
              </div>
              <ArrowRight className="ms-auto h-4 w-4 shrink-0 text-slate-500 rtl:rotate-180" />
            </div>
            <div className="landing-visual-card p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-300 opacity-50" />
                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-300" />
                  </span>
                  <span className="text-xs font-semibold text-white">{content.visualStatus}</span>
                </div>
                <ShieldCheck className="h-4 w-4 text-emerald-300" />
              </div>
              <p className="mt-3 text-[10px] leading-5 text-slate-500">{content.visualLedgerText}</p>
            </div>
          </div>
          <div className="flex flex-wrap justify-center gap-2 border-t border-white/10 pt-3 text-[10px] font-medium text-slate-300">
            {content.visualSurfaces.map((surface) => (
              <span key={surface} className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5">{surface}</span>
            ))}
          </div>
        </div>
      </div>

      <div className="landing-floating-chip landing-floating-chip--top hidden sm:flex">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-300/15">
          <ShieldCheck className="h-4 w-4 text-emerald-300" />
        </span>
        <div>
          <p className="text-[10px] uppercase tracking-[0.14em] text-slate-500">{content.visualControlLabel}</p>
          <p className="mt-0.5 text-xs font-semibold text-white">{content.visualControlText}</p>
        </div>
      </div>
      <div className="landing-floating-chip landing-floating-chip--bottom hidden sm:flex">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-300/15">
          <Sparkles className="h-4 w-4 text-sky-300" />
        </span>
        <div>
          <p className="text-[10px] uppercase tracking-[0.14em] text-slate-500">{content.visualReasoningLabel}</p>
          <p className="mt-0.5 text-xs font-semibold text-white">{content.visualReasoningText}</p>
        </div>
      </div>
    </div>
  );
}
