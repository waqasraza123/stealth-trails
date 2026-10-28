import { Link } from "react-router-dom";
import {
  ArrowRight,
  Bot,
  BrainCircuit,
  Check,
  ChevronRight,
  Fingerprint,
  Landmark,
  LineChart,
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
    icon: BrainCircuit,
    title: "Conversational banking",
    titleAr: "خدمات مالية بالمحادثة",
    description:
      'Ask “where did my money go this month?” and get a sourced answer from real account data, not a generic chart.',
    descriptionAr:
      "اسأل «أين ذهبت أموالي هذا الشهر؟» واحصل على إجابة موثّقة من بيانات الحساب الفعلية، لا مجرد رسم بياني عام.",
    accent: "emerald",
  },
  {
    icon: ShieldCheck,
    title: "Approval-gated actions",
    titleAr: "إجراءات تتطلب موافقتك",
    description:
      "The agent proposes, you approve. No transfer, trade, or release executes without your explicit confirmation.",
    descriptionAr:
      "يقترح الوكيل وتوافق أنت. لا يُنفَّذ أي تحويل أو تداول أو إفراج عن الأموال دون تأكيدك الصريح.",
    accent: "blue",
  },
  {
    icon: LineChart,
    title: "Risk intelligence",
    titleAr: "ذكاء المخاطر",
    description:
      "Stress-test a portfolio and get clear next steps, with the reasoning trail preserved so you can check every conclusion.",
    descriptionAr:
      "اختبر محفظة تحت سيناريوهات الضغط واحصل على خطوات واضحة، مع حفظ مسار الاستدلال لتتمكن من مراجعة كل استنتاج.",
    accent: "violet",
  },
  {
    icon: Vault,
    title: "Protected vaults",
    titleAr: "خزائن محمية",
    description:
      "Long-term funds stay separated from daily money, with release rules you set and can inspect at any time.",
    descriptionAr:
      "تبقى الأموال طويلة الأجل منفصلة عن الأموال اليومية، بقواعد إفراج تحددها وتستطيع فحصها في أي وقت.",
    accent: "amber",
  },
];

const copy = {
  en: {
    navPlatform: "Capabilities",
    navIntelligence: "Walkthrough",
    navSecurity: "Controls",
    signIn: "Demo sign in",
    signUp: "Try the demo",
    dashboard: "Open demo workspace",
    eyebrow: "AI banking agent — live product demo",
    titleOne: "Your money,",
    titleTwo: "explained in plain English.",
    description:
      "Ask questions, move funds, and review your portfolio through one secure conversation. Every sensitive action requires your explicit approval, and every decision comes with its reasoning attached.",
    attribution:
      "This is a working demonstration of an AI-native banking system, designed and built end to end by Waqas Raza.",
    primaryCta: "Try the live demo",
    secondaryCta: "See what it does",
    trustOne: "Approve sensitive actions",
    trustTwo: "Review the reasoning",
    trustThree: "Trace every transaction",
    visualLabel: "Demo workspace · sample data",
    visualGreeting: "Good morning, Amina",
    visualBalanceLabel: "Sample portfolio balance",
    visualTrend: "Portfolio view",
    visualAvailable: "Available",
    visualProtected: "Protected",
    visualAgent: "Wealth Guardian",
    visualAgentText: "Your portfolio review is ready",
    visualStatus: "Approval required",
    visualLedger: "Activity trail",
    visualLedgerText: "Every instruction remains visible and reviewable.",
    visualControlLabel: "Action controls",
    visualControlText: "Explicit approval",
    visualReasoningLabel: "Reasoning",
    visualReasoningText: "Ready for review",
    sectionEyebrow: "Explore the demo",
    sectionTitle: "What the system does",
    sectionDescription:
      "Ask about account activity, review a proposed action, stress-test a portfolio, and inspect the rules protecting long-term funds.",
    trustEyebrow: "Inspect the controls",
    trustTitle: "Built the way financial software should be built.",
    trustDescription:
      "Sensitive actions pass through explicit controls. Transactions carry references. System state is inspectable. Security here is not a promise in a footer — it is visible in the product.",
    trustLink: "Inspect system evidence",
    trustCardOne: "Protected access",
    trustCardOneText:
      "Layered sign-in controls and session safeguards protect access to the demo workspace.",
    trustCardTwo: "Proof and traceability",
    trustCardTwoText:
      "Inspect transaction references, verification reports, and system state in the working demo.",
    journeyEyebrow: "Try the workflow",
    journeyTitle: "Ask. Review. Approve.",
    journeyDescription:
      "Explore how an account-aware agent turns a question into a proposal you can inspect before anything executes.",
    steps: [
      ["01", "Ask a question", "Ask about balances, recent activity, or portfolio risk in plain English."],
      ["02", "Review the proposal", "Inspect the source data, reasoning, and action details before deciding."],
      ["03", "Approve the action", "Confirm a sensitive action explicitly, then follow its status and transaction reference."],
    ],
    ctaEyebrow: "Work with Waqas Raza",
    ctaTitle: "Want a system like this for your business?",
    ctaDescription:
      "I design and build AI agents, approval-gated workflows, and full-stack AI products for clients. See more of my work or get in touch through my Upwork profile.",
    ctaButton: "Get in touch on Upwork",
    ctaWork: "See more of my work",
    footerTagline: "AI financial workspace · Engineering demo by Waqas Raza.",
    footerSecurity: "System evidence",
    footerSignIn: "Demo sign in",
    footerCopyright: "Waqas Raza · Stealth Trails demo.",
  },
  ar: {
    navPlatform: "الإمكانات",
    navIntelligence: "خطوات التجربة",
    navSecurity: "الضوابط",
    signIn: "دخول التجربة",
    signUp: "جرّب النظام",
    dashboard: "فتح مساحة التجربة",
    eyebrow: "وكيل مالي ذكي — عرض تجريبي مباشر",
    titleOne: "أموالك،",
    titleTwo: "بشرح واضح وبسيط.",
    description:
      "اطرح الأسئلة وحرّك الأموال وراجع محفظتك عبر محادثة آمنة واحدة. يتطلب كل إجراء حساس موافقتك الصريحة، ويأتي كل قرار مع توضيح أسبابه.",
    attribution:
      "هذا عرض عملي لنظام خدمات مالية قائم على الذكاء الاصطناعي، صممه وبناه وقاص رضا من البداية إلى النهاية.",
    primaryCta: "جرّب العرض المباشر",
    secondaryCta: "استكشف ما يفعله",
    trustOne: "وافق على الإجراءات الحساسة",
    trustTwo: "راجع الاستدلال",
    trustThree: "تتبّع كل معاملة",
    visualLabel: "مساحة تجريبية · بيانات نموذجية",
    visualGreeting: "صباح الخير، أمينة",
    visualBalanceLabel: "رصيد محفظة نموذجي",
    visualTrend: "عرض المحفظة",
    visualAvailable: "متاح",
    visualProtected: "محمي",
    visualAgent: "حارس الثروة",
    visualAgentText: "مراجعة محفظتك جاهزة",
    visualStatus: "الموافقة مطلوبة",
    visualLedger: "سجل النشاط",
    visualLedgerText: "تبقى كل تعليماتك مرئية وقابلة للمراجعة.",
    visualControlLabel: "ضوابط الإجراءات",
    visualControlText: "موافقة صريحة",
    visualReasoningLabel: "الاستدلال",
    visualReasoningText: "جاهز للمراجعة",
    sectionEyebrow: "استكشف التجربة",
    sectionTitle: "ما الذي يفعله النظام؟",
    sectionDescription:
      "اسأل عن نشاط الحساب، وراجع إجراءً مقترحاً، واختبر محفظة تحت الضغط، وافحص القواعد التي تحمي الأموال طويلة الأجل.",
    trustEyebrow: "افحص الضوابط",
    trustTitle: "مبني كما ينبغي أن تُبنى البرمجيات المالية.",
    trustDescription:
      "تمر الإجراءات الحساسة عبر ضوابط صريحة. تحمل المعاملات مراجع واضحة. ويمكن فحص حالة النظام. الأمان هنا ليس وعداً في تذييل الصفحة، بل هو ظاهر في المنتج.",
    trustLink: "افحص أدلة النظام",
    trustCardOne: "وصول محمي",
    trustCardOneText:
      "تحمي طبقات تسجيل الدخول وضمانات الجلسة الوصول إلى مساحة التجربة.",
    trustCardTwo: "الإثبات وقابلية التتبع",
    trustCardTwoText:
      "افحص مراجع المعاملات وتقارير التحقق وحالة النظام في العرض العملي.",
    journeyEyebrow: "جرّب سير العمل",
    journeyTitle: "اسأل. راجع. وافق.",
    journeyDescription:
      "استكشف كيف يحوّل وكيل مطّلع على الحساب سؤالك إلى مقترح يمكنك فحصه قبل تنفيذ أي شيء.",
    steps: [
      ["01", "اطرح سؤالاً", "اسأل عن الأرصدة أو النشاط الأخير أو مخاطر المحفظة بلغة بسيطة."],
      ["02", "راجع المقترح", "افحص البيانات المصدرية والاستدلال وتفاصيل الإجراء قبل اتخاذ قرارك."],
      ["03", "وافق على الإجراء", "أكّد الإجراء الحساس صراحةً، ثم تتبّع حالته ومرجع المعاملة."],
    ],
    ctaEyebrow: "اعمل مع وقاص رضا",
    ctaTitle: "هل تريد نظاماً كهذا لعملك؟",
    ctaDescription:
      "أصمم وأبني وكلاء ذكاء اصطناعي ومسارات عمل تتطلب الموافقة ومنتجات ذكاء اصطناعي متكاملة للعملاء. شاهد المزيد من أعمالي أو تواصل معي عبر ملفي على Upwork.",
    ctaButton: "تواصل معي على Upwork",
    ctaWork: "شاهد المزيد من أعمالي",
    footerTagline: "مساحة مالية ذكية · عرض هندسي من وقاص رضا.",
    footerSecurity: "أدلة النظام",
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
                  aria-label={`${content.titleOne} ${content.titleTwo}`}
                  className="landing-display mt-7 max-w-3xl text-[3.1rem] font-semibold leading-[1.04] tracking-[-0.055em] text-white sm:text-[4.2rem] lg:text-[4.5rem] xl:text-[5rem]"
                >
                  <span className="block">{content.titleOne}</span>
                  <span className="landing-title-accent block pb-2">{content.titleTwo}</span>
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

            <StaggerGrid className="mt-14 grid gap-4 md:grid-cols-2 xl:grid-cols-4" delay={0.08}>
              {capabilities.map((item, index) => (
                <StaggerItem key={item.title}>
                  <article className="landing-capability-card group h-full min-h-[310px] p-6 sm:p-7">
                    <div className={`landing-capability-icon landing-capability-icon--${item.accent}`}>
                      <item.icon className="h-5 w-5" />
                    </div>
                    <div className="mt-20">
                      <p className="font-mono text-xs text-slate-400">0{index + 1}</p>
                      <h3 className="landing-display mt-4 text-2xl font-semibold tracking-[-0.04em] text-slate-950">
                        {locale === "ar" ? item.titleAr : item.title}
                      </h3>
                      <p className="mt-3 text-sm leading-7 text-slate-600">
                        {locale === "ar" ? item.descriptionAr : item.description}
                      </p>
                    </div>
                  </article>
                </StaggerItem>
              ))}
            </StaggerGrid>
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
                      Verified
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
              {content.steps.map(([number, title, description]) => (
                <article className="relative rounded-[1.75rem] border border-slate-200/80 bg-white/65 p-7 backdrop-blur" key={number}>
                  <div className="relative z-10 flex h-16 w-16 items-center justify-center rounded-2xl border border-slate-200 bg-[#f5f2ea] font-mono text-xs font-semibold text-emerald-800 shadow-sm">
                    {number}
                  </div>
                  <h3 className="landing-display mt-8 text-2xl font-semibold tracking-[-0.04em]">{title}</h3>
                  <p className="mt-3 text-sm leading-7 text-slate-600">{description}</p>
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
