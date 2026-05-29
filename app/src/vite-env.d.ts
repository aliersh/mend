/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_PRIVY_APP_ID: string
  readonly VITE_PIMLICO_SPONSORSHIP_POLICY_ID?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
