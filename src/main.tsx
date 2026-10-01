import { StrictMode, type ComponentType } from 'react'
import { createRoot } from 'react-dom/client'

// VITE_APP_TARGET is fixed at build time from the Vite mode (see vite.config.ts),
// so only the selected root is bundled.
const loadRoot: () => Promise<{ default: ComponentType }> = import.meta.env.VITE_APP_TARGET === 'client'
  ? () => import('./client-app/ClientApp')
  : () => import('./prototype-root')

void loadRoot().then(({ default: Root }) => {
  createRoot(document.getElementById('root')!).render(<StrictMode><Root /></StrictMode>)
})
