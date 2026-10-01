import { lazy, Suspense } from 'react'
import type { ClientMapProps } from './ClientMap'

const ClientMap = lazy(() => import('./ClientMap'))

export function MapView({ className = '', ...props }: ClientMapProps & { className?: string }) {
  return <div className={`cl-map-frame ${className}`}>
    <Suspense fallback={<div className="cl-map-fallback" role="status">Cargando mapa…</div>}>
      <ClientMap {...props} />
    </Suspense>
  </div>
}
