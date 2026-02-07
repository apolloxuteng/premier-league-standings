/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_FOOTBALL_DATA_API_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
