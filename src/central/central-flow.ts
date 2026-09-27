import type { DemoDriver, DemoState, DemoTrip, DemoTripStatus } from '../demo/types'

const activeStatuses = new Set<DemoTripStatus>(['REQUESTED', 'ASSIGNED', 'DRIVER_EN_ROUTE', 'ARRIVED', 'IN_PROGRESS'])

export type CentralTripFilter = 'ALL' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED'

export function getActiveRequests(state: DemoState): DemoTrip[] {
  return state.activeTrip && activeStatuses.has(state.activeTrip.status) ? [state.activeTrip] : []
}

export function getAvailableDrivers(state: DemoState): DemoDriver[] {
  return state.drivers.filter((driver) => driver.availability === 'AVAILABLE')
}

export function getBusyDrivers(state: DemoState): DemoDriver[] {
  return state.drivers.filter((driver) => driver.availability === 'BUSY')
}

export function getTripPassengerLabel(trip: DemoTrip, state: DemoState): string {
  return trip.passengerDisplayName?.trim() || state.passenger.name
}

export function getTripDriver(trip: DemoTrip, state: DemoState): DemoDriver | null {
  return trip.driverId ? state.drivers.find((driver) => driver.id === trip.driverId) ?? null : null
}

export function getTripVehicle(trip: DemoTrip, state: DemoState) {
  return trip.vehicleId ? state.vehicles.find((vehicle) => vehicle.id === trip.vehicleId) ?? null : null
}

export function getDispatchTargetDriver(state: DemoState): DemoDriver | null {
  const offer = state.currentOffer?.status === 'PENDING' ? state.currentOffer : null
  return offer ? state.drivers.find((driver) => driver.id === offer.driverId) ?? null : null
}

export function getEligibleManualOverrideDrivers(state: DemoState): DemoDriver[] {
  const trip = state.activeTrip
  if (!trip || trip.status !== 'REQUESTED' || trip.driverId !== null) return []
  const targetId = state.currentOffer?.status === 'PENDING' ? state.currentOffer.driverId : null
  return state.drivers.filter((driver) => driver.availability === 'AVAILABLE'
    && driver.id !== state.activeTrip?.driverId)
    .filter((driver) => driver.id !== targetId)
    .sort((a, b) => a.distanceMeters - b.distanceMeters || a.id.localeCompare(b.id))
}

export function getCentralTripRows(state: DemoState, filter: CentralTripFilter = 'ALL'): DemoTrip[] {
  const byId = new Map<string, DemoTrip>()
  if (state.activeTrip) byId.set(state.activeTrip.id, state.activeTrip)
  for (const trip of state.tripHistory) byId.set(trip.id, trip)
  return [...byId.values()]
    .filter((trip) => {
      if (filter === 'ACTIVE') return activeStatuses.has(trip.status)
      if (filter === 'COMPLETED') return trip.status === 'COMPLETED'
      if (filter === 'CANCELLED') return trip.status === 'CANCELLED'
      return true
    })
    .sort((a, b) => b.sequence - a.sequence)
}

export function getCentralKpis(state: DemoState) {
  return {
    activeRequests: getActiveRequests(state).length,
    availableDrivers: getAvailableDrivers(state).length,
    busyDrivers: getBusyDrivers(state).length,
    completedTrips: state.tripHistory.filter((trip) => trip.status === 'COMPLETED').length,
  }
}

export function getDriverAvailabilityLockReason(state: DemoState, driverId: string): string | null {
  if (state.currentOffer?.status === 'PENDING' && state.currentOffer.driverId === driverId) return 'Estado bloqueado por oferta pendiente.'
  if (state.activeTrip && activeStatuses.has(state.activeTrip.status) && state.activeTrip.driverId === driverId) {
    return 'Estado bloqueado por viaje activo.'
  }
  if (state.drivers.find((driver) => driver.id === driverId)?.availability === 'BUSY') {
    return 'Estado bloqueado por viaje activo.'
  }
  return null
}
