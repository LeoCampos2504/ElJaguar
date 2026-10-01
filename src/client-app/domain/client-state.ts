import type { TripPlace } from './places'

// Local client state for Phase 1A. Everything here is mock/local development
// state: no backend, no real dispatch, no real driver communication.

export type ClientSession = {
  role: 'CLIENT'
  displayName: string | null
  phone: string | null
  identifier: string
}

export type ClientTripStatus =
  | 'REQUESTED'
  | 'ASSIGNED'
  | 'DRIVER_EN_ROUTE'
  | 'ARRIVED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED'

export type MockDriver = {
  name: string
  vehicle: string
  color: string
  plate: string
  mobile: string
}

export type ClientTrip = {
  id: string
  status: ClientTripStatus
  pickup: TripPlace
  destination: TripPlace
  fareAmount: number
  fareFormatted: string
  driver: MockDriver | null
  requestedAt: number
  updatedAt: number
}

export type TripDraft = {
  pickup: TripPlace | null
  destination: TripPlace | null
}

export type ClientState = {
  session: ClientSession | null
  draft: TripDraft
  trip: ClientTrip | null
}

export type ClientAction =
  | { type: 'SIGN_IN'; session: ClientSession }
  | { type: 'SIGN_OUT' }
  | { type: 'SET_PICKUP'; place: TripPlace }
  | { type: 'SET_DESTINATION'; place: TripPlace }
  | { type: 'REQUEST_TRIP'; fareAmount: number; fareFormatted: string; now: number }
  | { type: 'ADVANCE_MOCK_TRIP'; now: number }
  | { type: 'CANCEL_TRIP'; now: number }
  | { type: 'FINISH_TRIP' }

export const TERMINAL_STATUSES: readonly ClientTripStatus[] = ['COMPLETED', 'CANCELLED']

// Canonical rule: the client may cancel through ARRIVED, never once IN_PROGRESS.
export const CLIENT_CANCELLABLE_STATUSES: readonly ClientTripStatus[] = ['REQUESTED', 'ASSIGNED', 'DRIVER_EN_ROUTE', 'ARRIVED']

// Controlled mock progression so every state can be previewed on a device.
export const MOCK_STATUS_DURATION_MS: Partial<Record<ClientTripStatus, number>> = {
  REQUESTED: 5000,
  ASSIGNED: 5000,
  DRIVER_EN_ROUTE: 9000,
  ARRIVED: 9000,
  IN_PROGRESS: 12000,
}

const MOCK_NEXT_STATUS: Partial<Record<ClientTripStatus, ClientTripStatus>> = {
  REQUESTED: 'ASSIGNED',
  ASSIGNED: 'DRIVER_EN_ROUTE',
  DRIVER_EN_ROUTE: 'ARRIVED',
  ARRIVED: 'IN_PROGRESS',
  IN_PROGRESS: 'COMPLETED',
}

export const MOCK_ACCEPTING_DRIVER: MockDriver = {
  name: 'Carlos Pérez',
  vehicle: 'Toyota Etios',
  color: 'Blanco',
  plate: 'AB 123 CD',
  mobile: '07',
}

// Natural Spanish copy. Technical status names are never shown to the client.
export const CLIENT_TRIP_STATUS_TEXT: Record<ClientTripStatus, { label: string; title: string }> = {
  REQUESTED: { label: 'Buscando chofer', title: 'Buscando un chofer disponible…' },
  ASSIGNED: { label: 'Chofer confirmado', title: 'Tu viaje fue aceptado' },
  DRIVER_EN_ROUTE: { label: 'En camino', title: 'Tu chofer está en camino' },
  ARRIVED: { label: 'Llegó', title: 'Tu chofer llegó' },
  IN_PROGRESS: { label: 'En viaje', title: 'Viaje en curso' },
  COMPLETED: { label: 'Finalizado', title: 'Viaje finalizado' },
  CANCELLED: { label: 'Cancelado', title: 'Viaje cancelado' },
}

export const CLIENT_TRIP_PROGRESS: readonly ClientTripStatus[] = ['REQUESTED', 'ASSIGNED', 'DRIVER_EN_ROUTE', 'ARRIVED', 'IN_PROGRESS', 'COMPLETED']

export const initialClientState: ClientState = {
  session: null,
  draft: { pickup: null, destination: null },
  trip: null,
}

export function isTerminalStatus(status: ClientTripStatus): boolean {
  return TERMINAL_STATUSES.includes(status)
}

export function canClientCancel(status: ClientTripStatus): boolean {
  return CLIENT_CANCELLABLE_STATUSES.includes(status)
}

export function getNextMockStatus(status: ClientTripStatus): ClientTripStatus | null {
  return MOCK_NEXT_STATUS[status] ?? null
}

export function getMockDelayMs(trip: ClientTrip, now: number): number | null {
  const duration = MOCK_STATUS_DURATION_MS[trip.status]
  if (duration === undefined) return null
  return Math.max(0, trip.updatedAt + duration - now)
}

function hasOpenTrip(state: ClientState): boolean {
  return state.trip !== null && !isTerminalStatus(state.trip.status)
}

export function clientReducer(state: ClientState, action: ClientAction): ClientState {
  switch (action.type) {
    case 'SIGN_IN':
      return { ...initialClientState, session: { ...action.session, role: 'CLIENT' } }
    case 'SIGN_OUT':
      return initialClientState
    case 'SET_PICKUP':
      if (!state.session || state.trip) return state
      return { ...state, draft: { ...state.draft, pickup: action.place } }
    case 'SET_DESTINATION':
      if (!state.session || state.trip) return state
      return { ...state, draft: { ...state.draft, destination: action.place } }
    case 'REQUEST_TRIP': {
      const { pickup, destination } = state.draft
      if (!state.session || state.trip || !pickup || !destination || action.fareAmount <= 0) return state
      return {
        ...state,
        trip: {
          id: `trip-${action.now}`,
          status: 'REQUESTED',
          pickup,
          destination,
          fareAmount: action.fareAmount,
          fareFormatted: action.fareFormatted,
          driver: null,
          requestedAt: action.now,
          updatedAt: action.now,
        },
      }
    }
    case 'ADVANCE_MOCK_TRIP': {
      if (!state.trip) return state
      const next = getNextMockStatus(state.trip.status)
      if (!next) return state
      return {
        ...state,
        trip: {
          ...state.trip,
          status: next,
          driver: next === 'ASSIGNED' ? { ...MOCK_ACCEPTING_DRIVER } : state.trip.driver,
          updatedAt: action.now,
        },
      }
    }
    case 'CANCEL_TRIP':
      if (!state.trip || !canClientCancel(state.trip.status)) return state
      return { ...state, trip: { ...state.trip, status: 'CANCELLED', updatedAt: action.now } }
    case 'FINISH_TRIP':
      // Leaving a finished trip clears the draft: places are never reused.
      if (hasOpenTrip(state)) return state
      return { ...state, draft: { pickup: null, destination: null }, trip: null }
    default:
      return state
  }
}
