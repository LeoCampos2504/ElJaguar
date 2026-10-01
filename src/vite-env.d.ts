/// <reference types="vite/client" />

interface ImportMetaEnv {
  // Build target, set from the Vite mode in vite.config.ts.
  readonly VITE_APP_TARGET: 'client' | 'prototype'
}
