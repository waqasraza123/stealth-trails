/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SERVER_URL: string;
  readonly VITE_UPWORK_PROFILE_URL?: string;
  readonly VITE_PORTFOLIO_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
