import { Building2, Landmark, ShieldCheck } from "lucide-react";
import { ReactNode } from "react";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import {
  HeroItem,
  HeroReveal,
  MotionSurface,
  ScreenTransition,
  StaggerGrid,
  StaggerItem
} from "@/components/motion/primitives";
import { Logo } from "@/components/ui/logo";
import { cn } from "@/lib/utils";
import { useT } from "@/i18n/use-t";

type AuthShellProps = {
  formEyebrow: string;
  formTitle: string;
  formDescription: string;
  brandEyebrow: string;
  brandTitle: string;
  brandDescription: string;
  chips: string[];
  children: ReactNode;
  footer: ReactNode;
  className?: string;
};

const chipIcons = [ShieldCheck, Landmark, Building2];

function AuthBrandArt() {
  return (
    <div
      aria-hidden="true"
      className="auth-hero-art relative h-52 overflow-hidden rounded-[1.75rem] border border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.06)] p-5 shadow-[0_24px_80px_rgba(4,10,20,0.32)] sm:h-60 lg:h-[clamp(13rem,28vh,18rem)]"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(114,233,212,0.18),transparent_36%),radial-gradient(circle_at_bottom_right,rgba(70,142,255,0.16),transparent_32%)]" />
      <div className="absolute inset-0 auth-ledger-grid opacity-40" />
      <img
        src="/brand-hero.png"
        alt=""
        className="relative z-10 h-full w-full rounded-[1.25rem] object-cover shadow-[0_24px_36px_rgba(0,0,0,0.28)]"
      />
    </div>
  );
}

export function AuthShell({
  formEyebrow,
  formTitle,
  formDescription,
  brandEyebrow,
  brandTitle,
  brandDescription,
  chips,
  children,
  footer,
  className
}: AuthShellProps) {
  const t = useT();

  return (
    <div className="auth-shell-bg min-h-screen">
      <div className="mx-auto grid min-h-screen max-w-[1360px] lg:grid-cols-[minmax(0,1fr)_minmax(420px,500px)]">
        <section className="relative overflow-hidden px-5 pb-7 pt-5 sm:px-8 lg:px-6 lg:py-6">
          <div className="absolute inset-0 auth-ledger-grid opacity-20" />
          <div className="stb-ambient-orb stb-ambient-orb--emerald absolute left-[-5rem] top-[6rem] h-44 w-44" />
          <div className="stb-ambient-orb stb-ambient-orb--indigo absolute right-[4rem] top-[12rem] h-40 w-40" />
          <div className="stb-ambient-orb stb-ambient-orb--gold absolute bottom-[4rem] left-[10rem] h-36 w-36" />

          <HeroReveal className="relative z-10 flex h-full flex-col rounded-[1.75rem] border border-white/10 bg-[linear-gradient(180deg,rgba(15,24,38,0.9),rgba(11,18,29,0.94))] px-6 py-6 shadow-[0_40px_120px_rgba(4,10,20,0.45)] sm:px-7 sm:py-7 lg:px-8 lg:py-8">
            <HeroItem>
              <div className="flex flex-wrap items-center justify-between gap-4">
                <Logo size="lg" tone="light" className="shrink-0" />
                <div className="flex items-center gap-3">
                  <div className="hidden rounded-full border border-[rgba(255,255,255,0.12)] bg-white/5 px-3.5 py-1.5 text-[0.65rem] font-medium uppercase tracking-[0.22em] text-[rgba(255,255,255,0.64)] sm:block">
                    {t("auth.managedRails")}
                  </div>
                  <LanguageSwitcher tone="light" />
                </div>
              </div>
            </HeroItem>

            <HeroItem className="mt-8 max-w-xl space-y-4 lg:mt-10">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-auth-accent">
                {brandEyebrow}
              </p>
              <h1 className="auth-display text-3xl font-semibold leading-[1.04] tracking-[-0.04em] text-auth-foreground sm:text-4xl lg:text-[3.1rem]">
                {brandTitle}
              </h1>
              <p className="max-w-lg text-sm leading-6 text-auth-muted sm:text-[0.95rem]">
                {brandDescription}
              </p>
            </HeroItem>

            <HeroItem className="mt-7 lg:mt-8">
              <MotionSurface className="stb-pressable-shell">
                <AuthBrandArt />
              </MotionSurface>
            </HeroItem>

            <StaggerGrid className="mt-6 flex flex-wrap gap-2.5">
              {chips.map((chip, index) => {
                const Icon = chipIcons[index] ?? ShieldCheck;

                return (
                  <StaggerItem key={chip}>
                    <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-[rgba(255,255,255,0.06)] px-3 py-1.5 text-xs font-medium text-[rgba(242,239,230,0.88)] backdrop-blur">
                      <Icon className="h-3.5 w-3.5 text-auth-accent" />
                      <span>{chip}</span>
                    </div>
                  </StaggerItem>
                );
              })}
            </StaggerGrid>
          </HeroReveal>
        </section>

        <section className="relative flex items-center px-5 pb-7 pt-2 sm:px-8 lg:px-6 lg:py-6">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(114,233,212,0.08),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(70,142,255,0.08),transparent_24%)]" />
          <div className="stb-ambient-orb stb-ambient-orb--indigo absolute bottom-[5rem] right-[2rem] h-36 w-36 opacity-60" />

          <ScreenTransition
            className={cn(
              "relative z-10 mx-auto w-full max-w-[28rem] rounded-[1.75rem] border border-[rgba(10,18,30,0.06)] bg-[linear-gradient(180deg,rgba(253,251,246,0.96),rgba(248,245,238,0.93))] p-5 shadow-[0_30px_90px_rgba(10,18,30,0.14)] backdrop-blur sm:p-7",
              className
            )}
          >
            <div className="mb-6">
              <p className="text-xs font-semibold uppercase tracking-[0.26em] text-auth-form-accent">
                {formEyebrow}
              </p>
              <h2 className="auth-display mt-3 text-2xl font-semibold tracking-[-0.04em] text-auth-form-foreground sm:text-[2rem]">
                {formTitle}
              </h2>
              <p className="mt-2.5 text-sm leading-6 text-auth-form-muted">
                {formDescription}
              </p>
            </div>

            {children}

            <div className="mt-6 border-t border-[rgba(10,18,30,0.08)] pt-4 text-sm text-auth-form-muted">
              {footer}
            </div>
          </ScreenTransition>
        </section>
      </div>
    </div>
  );
}
