import {
  applyBrandingToDocument,
  brandingStorageKey,
  defaultBranding,
  loadBrandingConfig,
  saveBrandingConfig,
  type BrandingConfig
} from "@stealth-trails-bank/ui-foundation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from "react";

type BrandingContextValue = {
  branding: BrandingConfig;
  setBranding: (config: BrandingConfig) => void;
  resetBranding: () => void;
};

const BrandingContext = createContext<BrandingContextValue>({
  branding: defaultBranding,
  setBranding: () => undefined,
  resetBranding: () => undefined
});

export function BrandingProvider({ children }: { children: ReactNode }) {
  const [branding, setBrandingState] = useState<BrandingConfig>(loadBrandingConfig);

  useEffect(() => {
    applyBrandingToDocument(branding);
    document.title = `${branding.productName} · Operator Console`;
  }, [branding]);

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key === brandingStorageKey) {
        setBrandingState(loadBrandingConfig());
      }
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const setBranding = useCallback((config: BrandingConfig) => {
    setBrandingState(saveBrandingConfig(config));
  }, []);

  const resetBranding = useCallback(() => {
    setBrandingState(saveBrandingConfig(defaultBranding));
  }, []);

  const value = useMemo(
    () => ({ branding, setBranding, resetBranding }),
    [branding, resetBranding, setBranding]
  );

  return <BrandingContext.Provider value={value}>{children}</BrandingContext.Provider>;
}

export function useBranding() {
  return useContext(BrandingContext);
}
