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
    wordmark: "text-base"
  },
  md: {
    icon: "h-11 w-11",
    wordmark: "text-xl"
  },
  lg: {
    icon: "h-14 w-14",
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
  const wordmarkColor = isLight ? "#F4FAF9" : branding.colors.ink;
  const logoUrl = branding.logoUrl || "/brand-mark.png";

  return (
    <div className={cn("inline-flex items-center gap-3", className)}>
      <img
        src={logoUrl}
        alt=""
        className={cn("shrink-0 object-contain drop-shadow-[0_6px_14px_rgba(8,18,31,0.24)]", sizing.icon)}
      />
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
