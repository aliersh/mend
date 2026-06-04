/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_PRIVY_APP_ID: string
  readonly VITE_PIMLICO_SPONSORSHIP_POLICY_ID?: string
  readonly VITE_RPC_URL?: string
  readonly VITE_SUBGRAPH_URL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
