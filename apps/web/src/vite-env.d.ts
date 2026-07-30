/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/react" />
/// <reference lib="webworker"/>




interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_VAPID_PUBLIC_KEY: string;
  readonly VITE_ENV: string;
  // Add more custom env variables here...
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}