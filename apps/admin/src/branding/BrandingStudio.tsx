import {
  applyBrandingToDocument,
  brandingPresets,
  defaultBranding,
  normalizeBrandingConfig,
  type BrandTypography,
  type BrandingConfig
} from "@stealth-trails-bank/ui-foundation";
import { AlertTriangle, Check, Monitor, RotateCcw, Save, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState, type CSSProperties, type FormEvent } from "react";
import { useBranding } from "./BrandingProvider";

type BrandingStudioProps = {
  authorized: boolean;
  verifying: boolean;
};

const colorFields: Array<{
  key: keyof BrandingConfig["colors"];
  label: string;
  description: string;
}> = [
  { key: "primary", label: "Primary", description: "Actions, focus, and active states" },
  { key: "accent", label: "Accent", description: "Highlights and visual signals" },
  { key: "canvas", label: "Canvas", description: "Application background" },
  { key: "surface", label: "Surface", description: "Cards and raised panels" },
  { key: "ink", label: "Ink", description: "Primary text and inverse surfaces" }
];

const typographyOptions: Array<{
  value: BrandTypography;
  label: string;
  description: string;
}> = [
  { value: "modern", label: "Modern", description: "Clear geometric sans-serif" },
  { value: "editorial", label: "Editorial", description: "Serif display with a calm sans body" },
  { value: "technical", label: "Technical", description: "Precise system and mono-inspired display" }
];

function cloneBranding(config: BrandingConfig): BrandingConfig {
  return { ...config, colors: { ...config.colors } };
}

export function BrandingStudio({ authorized, verifying }: BrandingStudioProps) {
  const { branding, setBranding, resetBranding } = useBranding();
  const [draft, setDraft] = useState<BrandingConfig>(() => cloneBranding(branding));
  const [savedNotice, setSavedNotice] = useState(false);
  const normalizedDraft = useMemo(() => normalizeBrandingConfig(draft), [draft]);
  const dirty = JSON.stringify(normalizedDraft) !== JSON.stringify(branding);

  useEffect(() => {
    if (!authorized) return;

    applyBrandingToDocument(normalizedDraft);
    return () => {
      applyBrandingToDocument(branding);
    };
  }, [authorized, branding, normalizedDraft]);

  useEffect(() => {
    if (!dirty) return;

    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    const warnBeforeNavigation = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target.closest("a[href]") : null;

      if (target && !window.confirm("Leave Branding Studio and discard unsaved changes?")) {
        event.preventDefault();
        event.stopPropagation();
      }
    };

    window.addEventListener("beforeunload", warnBeforeUnload);
    document.addEventListener("click", warnBeforeNavigation, true);
    return () => {
      window.removeEventListener("beforeunload", warnBeforeUnload);
      document.removeEventListener("click", warnBeforeNavigation, true);
    };
  }, [dirty]);

  if (verifying) {
    return (
      <div className="admin-empty-state">
        <h3>Verifying operator session</h3>
        <p className="admin-copy">Brand controls unlock after the current operator session is validated.</p>
      </div>
    );
  }

  if (!authorized) {
    return (
      <div className="admin-empty-state">
        <h3>Authorized operator session required</h3>
        <p className="admin-copy">
          Save valid operator credentials in the console sidebar to view or edit product branding.
        </p>
      </div>
    );
  }

  function updateDraft(patch: Partial<BrandingConfig>) {
    setSavedNotice(false);
    setDraft((current) => ({ ...current, ...patch }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBranding(normalizedDraft);
    setDraft(cloneBranding(normalizedDraft));
    setSavedNotice(true);
  }

  function handleReset() {
    if (dirty && !window.confirm("Discard unsaved branding changes and restore the default preset?")) {
      return;
    }

    resetBranding();
    setDraft(cloneBranding(defaultBranding));
    setSavedNotice(false);
  }

  function applyPreset(config: BrandingConfig) {
    if (dirty && !window.confirm("Replace the current unsaved changes with this preset?")) {
      return;
    }

    setDraft(cloneBranding(config));
    setSavedNotice(false);
  }

  const previewStyle = {
    "--preview-primary": normalizedDraft.colors.primary,
    "--preview-accent": normalizedDraft.colors.accent,
    "--preview-canvas": normalizedDraft.colors.canvas,
    "--preview-surface": normalizedDraft.colors.surface,
    "--preview-ink": normalizedDraft.colors.ink
  } as CSSProperties;

  return (
    <form className="admin-branding-layout" onSubmit={handleSubmit}>
      <div className="admin-branding-controls">
        <section className="admin-panel">
          <div className="admin-panel-header">
            <div>
              <p className="admin-kicker">Brand system</p>
              <h2>Product identity</h2>
              <p className="admin-copy">
                Shape the product name, voice, and logo used by this operator preview.
              </p>
            </div>
            <span className="admin-branding-dirty" data-dirty={dirty}>
              {dirty ? "Unsaved changes" : "Saved locally"}
            </span>
          </div>

          <div className="admin-branding-field-grid">
            <label className="admin-field">
              <span>Product name</span>
              <input
                maxLength={64}
                required
                value={draft.productName}
                onChange={(event) => updateDraft({ productName: event.target.value })}
              />
            </label>
            <label className="admin-field">
              <span>Tagline</span>
              <input
                maxLength={140}
                required
                value={draft.tagline}
                onChange={(event) => updateDraft({ tagline: event.target.value })}
              />
            </label>
            <label className="admin-field admin-branding-field-wide">
              <span>Logo URL</span>
              <input
                inputMode="url"
                placeholder="https://cdn.example.com/brand/logo.svg"
                value={draft.logoUrl}
                onChange={(event) => updateDraft({ logoUrl: event.target.value })}
              />
              <small className="admin-field-help">Use a secure, publicly readable image URL. Leave blank for the default Stealth Trails mark.</small>
            </label>
          </div>
        </section>

        <section className="admin-panel">
          <div className="admin-panel-header">
            <div>
              <p className="admin-kicker">Visual language</p>
              <h2>Colors and typography</h2>
            </div>
          </div>

          <div className="admin-branding-colors">
            {colorFields.map((field) => (
              <label className="admin-branding-color" key={field.key}>
                <input
                  aria-label={`${field.label} color`}
                  type="color"
                  value={draft.colors[field.key]}
                  onChange={(event) => {
                    setSavedNotice(false);
                    setDraft((current) => ({
                      ...current,
                      colors: { ...current.colors, [field.key]: event.target.value.toUpperCase() }
                    }));
                  }}
                />
                <span>
                  <strong>{field.label}</strong>
                  <small>{field.description}</small>
                  <code>{draft.colors[field.key]}</code>
                </span>
              </label>
            ))}
          </div>

          <fieldset className="admin-branding-type">
            <legend>Typography</legend>
            {typographyOptions.map((option) => (
              <label key={option.value} data-selected={draft.typography === option.value}>
                <input
                  checked={draft.typography === option.value}
                  name="typography"
                  type="radio"
                  value={option.value}
                  onChange={() => updateDraft({ typography: option.value })}
                />
                <span>
                  <strong>{option.label}</strong>
                  <small>{option.description}</small>
                </span>
              </label>
            ))}
          </fieldset>
        </section>

        <section className="admin-panel">
          <div className="admin-panel-header">
            <div>
              <p className="admin-kicker">Starting points</p>
              <h2>Presets</h2>
            </div>
          </div>
          <div className="admin-branding-presets">
            {brandingPresets.map((preset) => (
              <button key={preset.id} type="button" onClick={() => applyPreset(preset.config)}>
                <span className="admin-branding-swatches" aria-hidden="true">
                  <i style={{ background: preset.config.colors.primary }} />
                  <i style={{ background: preset.config.colors.accent }} />
                  <i style={{ background: preset.config.colors.canvas }} />
                </span>
                <strong>{preset.name}</strong>
                <small>{preset.description}</small>
              </button>
            ))}
          </div>
        </section>

        <div className="admin-branding-actions">
          <button className="admin-primary-button" type="submit" disabled={!dirty}>
            <Save aria-hidden="true" /> Save branding
          </button>
          <button className="admin-secondary-button" type="button" onClick={handleReset}>
            <RotateCcw aria-hidden="true" /> Reset to default
          </button>
          {savedNotice ? (
            <span className="admin-branding-saved" role="status"><Check aria-hidden="true" /> Branding saved on this origin</span>
          ) : null}
        </div>
      </div>

      <aside className="admin-branding-preview-column">
        <section className="admin-branding-preview" style={previewStyle}>
          <div className="admin-branding-preview-topbar">
            <div className="admin-branding-preview-logo">
              <img alt="" src={normalizedDraft.logoUrl || "/brand-mark.png"} />
              <div><strong>{normalizedDraft.productName}</strong><small>{normalizedDraft.tagline}</small></div>
            </div>
            <span className="admin-branding-preview-pill"><Sparkles aria-hidden="true" /> AI native</span>
          </div>
          <div className="admin-branding-preview-body">
            <p>Customer workspace</p>
            <h3>Money that moves with intelligence.</h3>
            <div className="admin-branding-preview-balance">
              <small>Available balance</small>
              <strong>$24,860.40</strong>
              <span>Ready across 4 managed assets</span>
            </div>
            <div className="admin-branding-preview-grid">
              <span><small>Protected</small><strong>$8,420</strong></span>
              <span><small>In progress</small><strong>2</strong></span>
            </div>
            <button type="button">Open financial copilot</button>
          </div>
        </section>

        <div className="admin-inline-notice" data-tone="warning">
          <AlertTriangle aria-hidden="true" />
          <div>
            <strong>Local preview only</strong>
            <p>
              No authorized shared branding endpoint exists in the current backend. Browser storage is origin-scoped, so this admin preview cannot synchronize automatically with a customer app on another origin.
            </p>
          </div>
        </div>
        <div className="admin-inline-notice" data-tone="positive">
          <Monitor aria-hidden="true" />
          <div>
            <strong>Runtime branding supported</strong>
            <p>The shared brand schema can still be supplied independently to each frontend through its runtime branding object.</p>
          </div>
        </div>
      </aside>
    </form>
  );
}
