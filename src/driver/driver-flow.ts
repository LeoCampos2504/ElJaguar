import type { DemoState, DemoTrip, DemoTripOffer } from '../demo/types'

const liveTripStatuses = new Set(['ASSIGNED', 'DRIVER_EN_ROUTE', 'ARRIVED', 'IN_PROGRESS'])
const driverTripRouteStatuses = new Set(['ASSIGNED', 'DRIVER_EN_ROUTE', 'ARRIVED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'])

export function getOfferForDriver(state: DemoState, driverId: string | null): DemoTripOffer | null {
  const offer = state.currentOffer
  return driverId && offer?.status === 'PENDING' && offer.driverId === driverId ? offer : null
}

export function getTripForDriver(state: DemoState, driverId: string | null): DemoTrip | null {
  const trip = state.activeTrip
  return driverId && trip?.driverId === driverId && driverTripRouteStatuses.has(trip.status) ? trip : null
}

export function getDriverHistory(state: DemoState, driverId: string | null): DemoTrip[] {
  return driverId ? state.tripHistory.filter((trip) => trip.driverId === driverId) : []
}

export function getDriverLandingRoute(state: DemoState, driverId: string | null): string {
  if (!driverId) return '/chofer/ingreso'
  if (getOfferForDriver(state, driverId)) return '/chofer/oferta'
  if (state.activeTrip?.driverId === driverId && liveTripStatuses.has(state.activeTrip.status)) return '/chofer/viaje'
  return '/chofer/inicio'
}

export function getDriverRouteGuard(path: string, driverId: string | null, state: DemoState): string | null {
  if (!driverId) return path === '/chofer/ingreso' ? null : '/chofer/ingreso'
  if (path === '/chofer/ingreso') return null
  if (path === '/chofer' || path === '/chofer/') return getDriverLandingRoute(state, driverId)
  if (path === '/chofer/oferta') return getOfferForDriver(state, driverId) ? null : '/chofer/inicio'
  if (path === '/chofer/viaje') return getTripForDriver(state, driverId) ? null : '/chofer/inicio'
  if (path === '/chofer/inicio') return getDriverLandingRoute(state, driverId) === '/chofer/oferta'
    || getDriverLandingRoute(state, driverId) === '/chofer/viaje'
    ? getDriverLandingRoute(state, driverId)
    : null
  if (path === '/chofer/viajes' || path === '/chofer/perfil') return null
  return '/chofer/inicio'
}
