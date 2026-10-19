import { useBranding } from "@/branding/BrandingProvider";
import { cn } from "@/lib/utils";

type LogoProps = {
  className?: string;
  size?: "sm" | "md" | "lg";
  tone?: "default" | "light" | "dark";
  showWordmark?: boolean;
};

const sizeClasses = {
  sm: {
    icon: "h-9 w-9",
    image: "h-9 max-w-40",
    wordmark: "text-base"
  },
  md: {
    icon: "h-11 w-11",
    image: "h-11 max-w-48",
    wordmark: "text-xl"
  },
  lg: {
    icon: "h-14 w-14",
    image: "h-14 max-w-56",
    wordmark: "text-[1.7rem]"
  }
};

export const Logo = ({
  className,
  size = "md",
  tone = "default",
  showWordmark = true
}: LogoProps) => {
  const { branding } = useBranding();
  const sizing = sizeClasses[size];
  const isLight = tone === "light";
  const markBase = isLight ? "rgba(255,255,255,0.12)" : branding.colors.ink;
  const wordmarkColor = isLight ? "#F4FAF9" : branding.colors.ink;

  return (
    <div className={cn("inline-flex items-center gap-3", className)}>
      {branding.logoUrl ? (
        <img
          src={branding.logoUrl}
          alt=""
          className={cn("w-auto shrink-0 object-contain", sizing.image)}
        />
      ) : (
        <svg
          viewBox="0 0 48 48"
          className={cn("shrink-0", sizing.icon)}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <rect x="3" y="3" width="42" height="42" rx="14" fill={markBase} />
          <rect
            x="8.5"
            y="8.5"
            width="31"
            height="31"
            rx="10.5"
            stroke={isLight ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.14)"}
          />
          <path
            d="M13 28.5C16.8 21.4 20.2 18 24.3 18C28.1 18 30.9 20.2 35 15.5"
            stroke={branding.colors.accent}
            strokeWidth="2.6"
            strokeLinecap="round"
          />
          <path
            d="M13 34C18.4 28.4 22.3 26.4 26.2 27.1C29.2 27.6 31.6 29.1 35 27"
            stroke={branding.colors.accent}
            strokeOpacity="0.62"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
          <circle cx="33.5" cy="14.5" r="2.5" fill={branding.colors.accent} />
        </svg>
      )}
      {showWordmark ? (
        <span
          className={cn("auth-display font-semibold tracking-[-0.04em]", sizing.wordmark)}
          style={{ color: wordmarkColor }}
        >
          {branding.productName}
        </span>
      ) : null}
    </div>
  );
};
