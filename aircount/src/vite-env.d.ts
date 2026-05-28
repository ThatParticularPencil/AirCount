/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ANTHROPIC_API_KEY: string
  readonly VITE_GROQ_API_KEY?: string
  readonly VITE_LLM_PROVIDER?: 'anthropic' | 'groq'
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
