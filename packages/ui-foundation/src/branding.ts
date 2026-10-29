export const brandingStorageKey = "stealth-trails-bank.branding";

export type BrandTypography = "modern" | "editorial" | "technical";

export type BrandingConfig = {
  productName: string;
  tagline: string;
  logoUrl: string;
  colors: {
    primary: string;
    accent: string;
    canvas: string;
    surface: string;
    ink: string;
  };
  typography: BrandTypography;
};

export type BrandingPreset = {
  id: string;
  name: string;
  description: string;
  config: BrandingConfig;
};

export const brandTypographyStacks: Record<
  BrandTypography,
  { sans: string; display: string }
> = {
  modern: {
    sans: '"Plus Jakarta Sans", ui-sans-serif, system-ui, sans-serif',
    display: '"Space Grotesk", "Plus Jakarta Sans", ui-sans-serif, system-ui, sans-serif'
  },
  editorial: {
    sans: '"Plus Jakarta Sans", ui-sans-serif, system-ui, sans-serif',
    display: 'Georgia, "Times New Roman", serif'
  },
  technical: {
    sans: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    display: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace'
  }
};

export const defaultBranding: BrandingConfig = {
  productName: "Stealth Trails",
  tagline: "AI-native banking, shaped around your brand.",
  logoUrl: "/brand-mark.png",
  colors: {
    primary: "#0F766E",
    accent: "#2DD4BF",
    canvas: "#F3F8F7",
    surface: "#FFFFFF",
    ink: "#102A2A"
  },
  typography: "modern"
};

export const brandingPresets: BrandingPreset[] = [
  {
    id: "lagoon",
    name: "Lagoon",
    description: "Balanced teal, cool white, and crisp maritime ink.",
    config: defaultBranding
  },
  {
    id: "deep-current",
    name: "Deep current",
    description: "Oceanic cyan with a slightly cooler technical canvas.",
    config: {
      ...defaultBranding,
      colors: {
        primary: "#0E7490",
        accent: "#67E8F9",
        canvas: "#F2F7F9",
        surface: "#FFFFFF",
        ink: "#17242B"
      }
    }
  },
  {
    id: "mineral",
    name: "Mineral",
    description: "Deep green-teal paired with a warm, quiet canvas.",
    config: {
      ...defaultBranding,
      colors: {
        primary: "#115E59",
        accent: "#5EEAD4",
        canvas: "#F7F7F2",
        surface: "#FFFFFF",
        ink: "#24312F"
      }
    }
  }
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeText(value: unknown, fallback: string, maxLength: number) {
  return typeof value === "string" && value.trim()
    ? value.trim().slice(0, maxLength)
    : fallback;
}

function normalizeOptionalText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function normalizeHex(value: unknown, fallback: string) {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value)
    ? value.toUpperCase()
    : fallback;
}

function normalizeTypography(value: unknown): BrandTypography {
  return value === "editorial" || value === "technical" ? value : "modern";
}

export function normalizeBrandingConfig(input?: unknown): BrandingConfig {
  const source = isRecord(input) ? input : {};
  const colors = isRecord(source.colors) ? source.colors : {};

  return {
    productName: normalizeText(source.productName, defaultBranding.productName, 64),
    tagline: normalizeText(source.tagline, defaultBranding.tagline, 140),
    logoUrl: normalizeOptionalText(source.logoUrl, 500),
    colors: {
      primary: normalizeHex(colors.primary, defaultBranding.colors.primary),
      accent: normalizeHex(colors.accent, defaultBranding.colors.accent),
      canvas: normalizeHex(colors.canvas, defaultBranding.colors.canvas),
      surface: normalizeHex(colors.surface, defaultBranding.colors.surface),
      ink: normalizeHex(colors.ink, defaultBranding.colors.ink)
    },
    typography: normalizeTypography(source.typography)
  };
}

function mergeBrandingSources(base: unknown, override: unknown) {
  const baseRecord = isRecord(base) ? base : {};
  const overrideRecord = isRecord(override) ? override : {};
  const baseColors = isRecord(baseRecord.colors) ? baseRecord.colors : {};
  const overrideColors = isRecord(overrideRecord.colors) ? overrideRecord.colors : {};

  return {
    ...baseRecord,
    ...overrideRecord,
    colors: { ...baseColors, ...overrideColors }
  };
}

function readRuntimeBranding() {
  return (globalThis as typeof globalThis & { __STB_BRANDING__?: unknown })
    .__STB_BRANDING__;
}

export function loadBrandingConfig(): BrandingConfig {
  let stored: unknown = null;

  if (typeof window !== "undefined") {
    try {
      const value = window.localStorage.getItem(brandingStorageKey);
      stored = value ? JSON.parse(value) : null;
    } catch {
      stored = null;
    }
  }

  return normalizeBrandingConfig(
    mergeBrandingSources(
      mergeBrandingSources(defaultBranding, readRuntimeBranding()),
      stored
    )
  );
}

export function saveBrandingConfig(config: BrandingConfig) {
  const normalized = normalizeBrandingConfig(config);

  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(brandingStorageKey, JSON.stringify(normalized));
    } catch {
      // Theme previews still work when browser storage is unavailable.
    }
  }

  return normalized;
}

function parseHex(hex: string) {
  return {
    red: Number.parseInt(hex.slice(1, 3), 16),
    green: Number.parseInt(hex.slice(3, 5), 16),
    blue: Number.parseInt(hex.slice(5, 7), 16)
  };
}

function toHex(value: number) {
  return Math.round(Math.max(0, Math.min(255, value)))
    .toString(16)
    .padStart(2, "0");
}

export function mixBrandColors(foreground: string, background: string, weight: number) {
  const from = parseHex(foreground);
  const to = parseHex(background);
  const amount = Math.max(0, Math.min(1, weight));

  return `#${toHex(from.red * amount + to.red * (1 - amount))}${toHex(
    from.green * amount + to.green * (1 - amount)
  )}${toHex(from.blue * amount + to.blue * (1 - amount))}`.toUpperCase();
}

export function brandColorWithAlpha(hex: string, alpha: number) {
  const color = parseHex(hex);
  return `rgba(${color.red}, ${color.green}, ${color.blue}, ${alpha})`;
}

function channelLuminance(value: number) {
  const channel = value / 255;
  return channel <= 0.03928
    ? channel / 12.92
    : ((channel + 0.055) / 1.055) ** 2.4;
}

export function getBrandContrastColor(hex: string) {
  const color = parseHex(hex);
  const luminance =
    0.2126 * channelLuminance(color.red) +
    0.7152 * channelLuminance(color.green) +
    0.0722 * channelLuminance(color.blue);

  return luminance > 0.42 ? "#102A2A" : "#FFFFFF";
}

export function brandHexToHsl(hex: string) {
  const { red, green, blue } = parseHex(hex);
  const r = red / 255;
  const g = green / 255;
  const b = blue / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const lightness = (max + min) / 2;
  const delta = max - min;
  let hue = 0;
  let saturation = 0;

  if (delta !== 0) {
    saturation = delta / (1 - Math.abs(2 * lightness - 1));

    if (max === r) {
      hue = 60 * (((g - b) / delta) % 6);
    } else if (max === g) {
      hue = 60 * ((b - r) / delta + 2);
    } else {
      hue = 60 * ((r - g) / delta + 4);
    }
  }

  if (hue < 0) {
    hue += 360;
  }

  return `${Math.round(hue)} ${Math.round(saturation * 100)}% ${Math.round(
    lightness * 100
  )}%`;
}

export function getBrandingCssVariables(config: BrandingConfig): Record<string, string> {
  const branding = normalizeBrandingConfig(config);
  const { colors } = branding;
  const fonts = brandTypographyStacks[branding.typography];
  const primaryForeground = getBrandContrastColor(colors.primary);
  const primarySoft = mixBrandColors(colors.primary, colors.surface, 0.09);
  const accentSoft = mixBrandColors(colors.accent, colors.surface, 0.14);
  const muted = mixBrandColors(colors.ink, colors.canvas, 0.62);
  const line = brandColorWithAlpha(colors.ink, 0.1);
  const lineStrong = brandColorWithAlpha(colors.ink, 0.16);

  return {
    "--brand-primary": colors.primary,
    "--brand-primary-foreground": primaryForeground,
    "--brand-primary-soft": primarySoft,
    "--brand-accent": colors.accent,
    "--brand-accent-soft": accentSoft,
    "--brand-canvas": colors.canvas,
    "--brand-surface": colors.surface,
    "--brand-ink": colors.ink,
    "--brand-muted": muted,
    "--brand-line": line,
    "--brand-line-strong": lineStrong,
    "--brand-font-sans": fonts.sans,
    "--brand-font-display": fonts.display,
    "--background": brandHexToHsl(colors.canvas),
    "--foreground": brandHexToHsl(colors.ink),
    "--card": brandHexToHsl(colors.surface),
    "--card-foreground": brandHexToHsl(colors.ink),
    "--popover": brandHexToHsl(colors.surface),
    "--popover-foreground": brandHexToHsl(colors.ink),
    "--primary": brandHexToHsl(colors.primary),
    "--primary-foreground": brandHexToHsl(primaryForeground),
    "--ring": brandHexToHsl(colors.primary),
    "--auth-form-accent": brandHexToHsl(colors.primary),
    "--stb-panel": colors.surface,
    "--stb-panel-soft": mixBrandColors(colors.surface, colors.canvas, 0.82),
    "--stb-panel-strong": colors.surface,
    "--stb-ink": colors.ink,
    "--stb-ink-soft": muted,
    "--stb-line": line,
    "--stb-line-strong": lineStrong,
    "--stb-emerald": colors.primary,
    "--stb-emerald-soft": primarySoft,
    "--stb-indigo-soft": accentSoft,
    "--admin-accent": colors.primary,
    "--admin-bg": colors.canvas,
    "--admin-panel-strong": colors.surface,
    "--admin-ink": colors.ink,
    "--admin-muted": muted,
    "--admin-line": line,
    "--admin-line-strong": lineStrong
  };
}

export function applyBrandingToDocument(config: BrandingConfig) {
  const normalized = normalizeBrandingConfig(config);

  if (typeof document !== "undefined") {
    const root = document.documentElement;
    const variables = getBrandingCssVariables(normalized);

    Object.entries(variables).forEach(([name, value]) => {
      root.style.setProperty(name, value);
    });
    root.dataset.brandTypography = normalized.typography;
  }

  return normalized;
}
