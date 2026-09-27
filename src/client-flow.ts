import type { DemoState, DemoTrip, DemoTripStatus } from './demo/types'

export const clientRouteByTripStatus: Record<DemoTripStatus, string> = {
  REQUESTED: '/cliente/buscando',
  ASSIGNED: '/cliente/asignado',
  DRIVER_EN_ROUTE: '/cliente/en-camino',
  ARRIVED: '/cliente/llego',
  IN_PROGRESS: '/cliente/en-viaje',
  COMPLETED: '/cliente/finalizado',
  CANCELLED: '/cliente/cancelado',
}

export function getClientRouteForTripState(trip: DemoTrip | null): string {
  return trip ? clientRouteByTripStatus[trip.status] : '/cliente'
}

export function getClientRouteGuard(path: string, state: DemoState): string | null {
  if (path === '/cliente/viaje' && state.activeTrip && !['COMPLETED', 'CANCELLED'].includes(state.activeTrip.status)) {
    return getClientRouteForTripState(state.activeTrip)
  }
  const guardedRoutes = new Set(Object.values(clientRouteByTripStatus))
  if (!guardedRoutes.has(path)) return null
  const expected = getClientRouteForTripState(state.activeTrip)
  return path === expected ? null : expected
}

export const demoLocations = [
  { zoneId: 'centro', label: 'Av. Libertad 450' },
  { zoneId: 'unju', label: 'UNJu - Sede Libertador' },
  { zoneId: 'terminal', label: 'Terminal de Ómnibus' },
  { zoneId: 'calilegua', label: 'Calilegua' },
  { zoneId: 'hospital', label: 'Hospital O. Orías' },
  { zoneId: 'libertador', label: 'Libertador General San Martín' },
  { zoneId: 'barrio-ledesma', label: 'Barrio Ledesma' },
] as const

export function findDemoLocation(label: string) {
  const normalized = label.trim().toLocaleLowerCase('es')
  if (normalized === 'casa' || normalized === 'centro') return demoLocations[0]
  return demoLocations.find((location) => location.label.toLocaleLowerCase('es') === normalized)
    ?? demoLocations.find((location) => location.zoneId === normalized)
    ?? null
}

export function getDemoTripDriverName(state: DemoState, trip: DemoTrip): string {
  return state.drivers.find((driver) => driver.id === trip.driverId)?.name ?? '—'
}
