import type {
  DemoAction,
  DemoDriver,
  DemoDriverAvailability,
  DemoFare,
  DemoLocation,
  DemoState,
  DemoTrip,
  DemoTripOffer,
} from './types'

export type DemoFareQuote =
  | { status: 'AVAILABLE'; fare: DemoFare }
  | { status: 'NO_FARE'; fare: null }
  | { status: 'MISSING_LOCATION'; fare: null }

const activeTripStatuses = new Set(['REQUESTED', 'ASSIGNED', 'DRIVER_EN_ROUTE', 'ARRIVED', 'IN_PROGRESS'])
const passengerCancellableStatuses = new Set(['REQUESTED', 'ASSIGNED', 'DRIVER_EN_ROUTE', 'ARRIVED'])

export function getDemoFare(fares: readonly DemoFare[], originZoneId: string, destinationZoneId: string): DemoFare | null {
  return fares.find((fare) =>
    fare.originZoneId === originZoneId && fare.destinationZoneId === destinationZoneId,
  ) ?? null
}

export function getTripFare(state: DemoState): DemoFare | null {
  const origin = state.selectedOrigin
  const destination = state.selectedDestination
  if (!origin || !destination) return null
  return getDemoFare(state.fares, origin.zoneId, destination.zoneId)
}

export function quoteTrip(state: DemoState): DemoFareQuote {
  if (!state.selectedOrigin || !state.selectedDestination) return { status: 'MISSING_LOCATION', fare: null }
  const fare = getTripFare(state)
  return fare ? { status: 'AVAILABLE', fare } : { status: 'NO_FARE', fare: null }
}

export function getEligibleDrivers(state: DemoState): DemoDriver[] {
  const assignedDriverId = state.activeTrip && activeTripStatuses.has(state.activeTrip.status)
    ? state.activeTrip.driverId
    : null
  return state.drivers.filter((driver) =>
    driver.availability === 'AVAILABLE' && driver.id !== assignedDriverId,
  )
}

export function getSortedCandidates(state: DemoState): DemoDriver[] {
  const attempted = new Set(state.dispatch.attemptedDriverIds)
  const initialCandidates = new Set(state.dispatch.candidateDriverIds)
  return getEligibleDrivers(state)
    .filter((driver) => !attempted.has(driver.id)
      && (initialCandidates.size === 0 || initialCandidates.has(driver.id)))
    .sort((a, b) => a.distanceMeters - b.distanceMeters || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
}

export function getPendingOffer(state: DemoState): DemoTripOffer | null {
  return state.currentOffer?.status === 'PENDING' ? state.currentOffer : null
}

export function getCurrentDriver(state: DemoState): DemoDriver | null {
  const driverId = state.activeTrip?.driverId
  return driverId ? state.drivers.find((driver) => driver.id === driverId) ?? null : null
}

export function getCurrentVehicle(state: DemoState) {
  const vehicleId = state.activeTrip?.vehicleId
  return vehicleId ? state.vehicles.find((vehicle) => vehicle.id === vehicleId) ?? null : null
}

export function canPassengerCancel(state: DemoState): boolean {
  return !!state.activeTrip && passengerCancellableStatuses.has(state.activeTrip.status)
}

export function canDriverAccept(state: DemoState): boolean {
  return !!getPendingOffer(state) && state.activeTrip?.status === 'REQUESTED'
}

export function canDriverReject(state: DemoState): boolean {
  return canDriverAccept(state)
}

function withResolvedOffer(state: DemoState, status: 'ACCEPTED' | 'REJECTED' | 'EXPIRED' | 'CANCELLED') {
  const offer = getPendingOffer(state)
  if (!offer) return null
  return {
    offer,
    offers: state.offers.map((item) => item.id === offer.id ? { ...item, status } : item),
  }
}

function openNextOffer(state: DemoState): DemoState {
  if (!state.activeTrip || state.activeTrip.status !== 'REQUESTED') return state
  const candidates = getSortedCandidates(state)
  const candidateDriverIds = state.dispatch.candidateDriverIds.length > 0
    ? state.dispatch.candidateDriverIds
    : candidates.map((driver) => driver.id)
  const next = candidates[0]
  if (!next) {
    return {
      ...state,
      currentOffer: null,
      dispatch: { ...state.dispatch, status: 'NO_CANDIDATES', candidateDriverIds, currentOfferId: null },
    }
  }

  const offer: DemoTripOffer = {
    id: `demo-offer-${String(state.nextOfferNumber).padStart(3, '0')}`,
    tripId: state.activeTrip.id,
    driverId: next.id,
    vehicleId: next.vehicleId,
    status: 'PENDING',
  }
  return {
    ...state,
    currentOffer: offer,
    offers: [...state.offers, offer],
    nextOfferNumber: state.nextOfferNumber + 1,
    dispatch: {
      status: 'WAITING_FOR_RESPONSE',
      candidateDriverIds,
      attemptedDriverIds: [...state.dispatch.attemptedDriverIds, next.id],
      currentOfferId: offer.id,
    },
  }
}

function startDispatch(state: DemoState): DemoState {
  if (!state.activeTrip || state.activeTrip.status !== 'REQUESTED') return state
  if (getPendingOffer(state)) return state
  if (state.dispatch.status === 'ASSIGNED' || state.dispatch.status === 'STOPPED') return state
  const candidateDriverIds = state.dispatch.candidateDriverIds.length > 0
    ? state.dispatch.candidateDriverIds
    : getSortedCandidates(state).map((driver) => driver.id)
  return openNextOffer({
    ...state,
    dispatch: { ...state.dispatch, status: 'SEARCHING', candidateDriverIds, currentOfferId: null },
  })
}

function appendHistory(state: DemoState, trip: DemoTrip): DemoTrip[] {
  return state.tripHistory.some((item) => item.id === trip.id)
    ? state.tripHistory
    : [trip, ...state.tripHistory]
}

function isValidLocation(state: DemoState, location: DemoLocation | null): boolean {
  return location === null || state.zones.some((zone) => zone.id === location.zoneId)
}

function reduceDemoState(state: DemoState, action: DemoAction): DemoState {
  switch (action.type) {
    case 'RESET_DEMO':
      return action.initialState
    case 'SET_ORIGIN':
      return isValidLocation(state, action.location) ? { ...state, selectedOrigin: action.location } : state
    case 'SET_DESTINATION':
      return isValidLocation(state, action.location) ? { ...state, selectedDestination: action.location } : state
    case 'REQUEST_TRIP': {
      if (state.activeTrip && activeTripStatuses.has(state.activeTrip.status)) return state
      const quote = quoteTrip(state)
      if (quote.status !== 'AVAILABLE' || !state.selectedOrigin || !state.selectedDestination) return state
      const trip: DemoTrip = {
        id: `demo-trip-${String(state.nextTripNumber).padStart(3, '0')}`,
        sequence: state.nextTripNumber,
        passengerId: state.passenger.id,
        origin: { ...state.selectedOrigin },
        destination: { ...state.selectedDestination },
        fareId: quote.fare.id,
        price: quote.fare.price,
        status: 'REQUESTED',
        driverId: null,
        vehicleId: null,
      }
      const requested: DemoState = {
        ...state,
        activeTrip: trip,
        currentOffer: null,
        nextTripNumber: state.nextTripNumber + 1,
        dispatch: { status: 'SEARCHING', candidateDriverIds: [], attemptedDriverIds: [], currentOfferId: null },
      }
      return startDispatch(requested)
    }
    case 'START_DISPATCH':
      return startDispatch(state)
    case 'ACCEPT_CURRENT_OFFER': {
      if (!canDriverAccept(state) || !state.activeTrip) return state
      const resolved = withResolvedOffer(state, 'ACCEPTED')
      if (!resolved) return state
      const offer = resolved.offer
      return {
        ...state,
        offers: resolved.offers,
        currentOffer: null,
        activeTrip: { ...state.activeTrip, status: 'ASSIGNED', driverId: offer.driverId, vehicleId: offer.vehicleId },
        drivers: state.drivers.map((driver) => driver.id === offer.driverId
          ? { ...driver, availability: 'BUSY' }
          : driver),
        dispatch: { ...state.dispatch, status: 'ASSIGNED', currentOfferId: null },
      }
    }
    case 'REJECT_CURRENT_OFFER':
    case 'EXPIRE_CURRENT_OFFER': {
      if (!canDriverReject(state)) return state
      const resolved = withResolvedOffer(state, action.type === 'REJECT_CURRENT_OFFER' ? 'REJECTED' : 'EXPIRED')
      if (!resolved) return state
      return openNextOffer({
        ...state,
        currentOffer: null,
        offers: resolved.offers,
        dispatch: { ...state.dispatch, status: 'SEARCHING', currentOfferId: null },
      })
    }
    case 'MARK_DRIVER_EN_ROUTE':
      return state.activeTrip?.status === 'ASSIGNED'
        ? { ...state, activeTrip: { ...state.activeTrip, status: 'DRIVER_EN_ROUTE' } }
        : state
    case 'MARK_DRIVER_ARRIVED':
      return state.activeTrip?.status === 'DRIVER_EN_ROUTE'
        ? { ...state, activeTrip: { ...state.activeTrip, status: 'ARRIVED' } }
        : state
    case 'START_TRIP':
      return state.activeTrip?.status === 'ARRIVED'
        ? { ...state, activeTrip: { ...state.activeTrip, status: 'IN_PROGRESS' } }
        : state
    case 'COMPLETE_TRIP': {
      if (state.activeTrip?.status !== 'IN_PROGRESS') return state
      const trip = { ...state.activeTrip, status: 'COMPLETED' as const }
      return {
        ...state,
        activeTrip: trip,
        tripHistory: appendHistory(state, trip),
        drivers: state.drivers.map((driver) => driver.id === trip.driverId
          ? { ...driver, availability: 'AVAILABLE' }
          : driver),
        dispatch: { ...state.dispatch, status: 'STOPPED', currentOfferId: null },
      }
    }
    case 'CANCEL_TRIP': {
      if (!canPassengerCancel(state) || !state.activeTrip) return state
      const resolved = withResolvedOffer(state, 'CANCELLED')
      const trip = { ...state.activeTrip, status: 'CANCELLED' as const }
      return {
        ...state,
        activeTrip: trip,
        currentOffer: null,
        offers: resolved?.offers ?? state.offers,
        tripHistory: appendHistory(state, trip),
        drivers: state.drivers.map((driver) => driver.id === trip.driverId
          ? { ...driver, availability: 'AVAILABLE' }
          : driver),
        dispatch: { ...state.dispatch, status: 'STOPPED', currentOfferId: null },
      }
    }
    case 'SET_DRIVER_AVAILABILITY': {
      const hasPendingOffer = getPendingOffer(state)?.driverId === action.driverId
      const assignedToActiveTrip = state.activeTrip?.driverId === action.driverId
        && !!state.activeTrip
        && activeTripStatuses.has(state.activeTrip.status)
      if (hasPendingOffer || assignedToActiveTrip || action.availability === 'BUSY') return state
      return {
        ...state,
        drivers: state.drivers.map((driver) => driver.id === action.driverId
          ? { ...driver, availability: action.availability as DemoDriverAvailability }
          : driver),
      }
    }
  }
}

export function assertDemoStateInvariants(state: DemoState): void {
  const pendingOffers = state.offers.filter((offer) => offer.status === 'PENDING')
  if (pendingOffers.length > 1) throw new Error('Demo dispatch invariant: more than one pending offer')
  if (state.currentOffer && state.currentOffer.status !== 'PENDING') {
    throw new Error('Demo dispatch invariant: currentOffer must be pending')
  }
  if (pendingOffers.length === 1) {
    const pending = pendingOffers[0]
    if (state.currentOffer?.id !== pending.id
      || state.dispatch.currentOfferId !== pending.id
      || state.dispatch.status !== 'WAITING_FOR_RESPONSE'
      || state.activeTrip?.id !== pending.tripId
      || state.activeTrip.status !== 'REQUESTED') {
      throw new Error('Demo dispatch invariant: pending offer is not the exclusive current offer')
    }
  } else if (state.currentOffer || state.dispatch.currentOfferId !== null || state.dispatch.status === 'WAITING_FOR_RESPONSE') {
    throw new Error('Demo dispatch invariant: current offer pointer has no pending offer')
  }
}

export function demoReducer(state: DemoState, action: DemoAction): DemoState {
  const next = reduceDemoState(state, action)
  assertDemoStateInvariants(next)
  return next
}
