import type { ClientState, ClientTripStatus } from './client-state'

// Device-local persistence so the mock session and current trip survive an
// Android app restart. No password is ever part of ClientState.
// The draft and trip are the current trip only; nothing is kept as saved,
// favorite or recent locations.

export const CLIENT_STORAGE_KEY = 'el-jaguar-client-v1'

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

const STATUSES: readonly ClientTripStatus[] = ['REQUESTED', 'ASSIGNED', 'DRIVER_EN_ROUTE', 'ARRIVED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']

function isPlace(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false
  const place = value as Record<string, unknown>
  return typeof place.id === 'string' && typeof place.label === 'string' && typeof place.zoneId === 'string'
    && typeof place.lat === 'number' && typeof place.lng === 'number'
}

export function serializeClientState(state: ClientState): string {
  return JSON.stringify({ version: 1, session: state.session, draft: state.draft, trip: state.trip })
}

export function parseClientState(raw: string | null, fallback: ClientState): ClientState {
  if (!raw) return fallback
  try {
    const data = JSON.parse(raw) as Record<string, unknown>
    if (data.version !== 1) return fallback
    const session = data.session as ClientState['session']
    if (!session || session.role !== 'CLIENT' || typeof session.identifier !== 'string') return fallback
    const draft = (data.draft ?? {}) as Record<string, unknown>
    const trip = data.trip as ClientState['trip']
    const validTrip = trip && STATUSES.includes(trip.status) && isPlace(trip.pickup) && isPlace(trip.destination)
      && typeof trip.updatedAt === 'number' && typeof trip.fareAmount === 'number' ? trip : null
    return {
      session: { role: 'CLIENT', displayName: session.displayName ?? null, phone: session.phone ?? null, identifier: session.identifier },
      draft: {
        pickup: isPlace(draft.pickup) ? draft.pickup as ClientState['draft']['pickup'] : null,
        destination: isPlace(draft.destination) ? draft.destination as ClientState['draft']['destination'] : null,
      },
      trip: validTrip,
    }
  } catch {
    return fallback
  }
}

function getStorage(): StorageLike | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage
  } catch {
    return null
  }
}

export function loadClientState(fallback: ClientState, storage: StorageLike | null = getStorage()): ClientState {
  try {
    return parseClientState(storage?.getItem(CLIENT_STORAGE_KEY) ?? null, fallback)
  } catch {
    return fallback
  }
}

export function persistClientState(state: ClientState, storage: StorageLike | null = getStorage()): void {
  try {
    if (!state.session) storage?.removeItem(CLIENT_STORAGE_KEY)
    else storage?.setItem(CLIENT_STORAGE_KEY, serializeClientState(state))
  } catch {
    // Storage can be unavailable; the app keeps working in memory.
  }
}
