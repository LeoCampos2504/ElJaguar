import type { DemoState } from './types'

export const DEMO_STORAGE_KEY = 'remis-norte-demo-state-v1'
const STORAGE_VERSION = 1

export type DemoStorage = Pick<Storage, 'getItem' | 'setItem'>

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isLocation(value: unknown): boolean {
  return value === null || isRecord(value) && typeof value.zoneId === 'string' && typeof value.label === 'string'
}

export function isPersistedDemoState(value: unknown): value is DemoState {
  if (!isRecord(value)) return false
  return isRecord(value.passenger)
    && Array.isArray(value.drivers)
    && Array.isArray(value.vehicles)
    && Array.isArray(value.zones)
    && Array.isArray(value.fares)
    && isLocation(value.selectedOrigin)
    && isLocation(value.selectedDestination)
    && (value.activeTrip === null || isRecord(value.activeTrip))
    && (value.currentOffer === null || isRecord(value.currentOffer))
    && Array.isArray(value.offers)
    && isRecord(value.dispatch)
    && Array.isArray(value.dispatch.candidateDriverIds)
    && Array.isArray(value.dispatch.attemptedDriverIds)
    && (typeof value.dispatch.currentOfferId === 'string' || value.dispatch.currentOfferId === null)
    && Array.isArray(value.tripHistory)
    && Number.isInteger(value.nextTripNumber)
    && Number.isInteger(value.nextOfferNumber)
}

function getBrowserStorage(): DemoStorage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage
  } catch {
    return null
  }
}

export function loadDemoState(createFallback: () => DemoState, storage: DemoStorage | null = getBrowserStorage()): DemoState {
  try {
    const saved = storage?.getItem(DEMO_STORAGE_KEY)
    if (!saved) return createFallback()
    const parsed: unknown = JSON.parse(saved)
    if (!isRecord(parsed) || parsed.version !== STORAGE_VERSION || !isPersistedDemoState(parsed.state)) {
      return createFallback()
    }
    return parsed.state
  } catch {
    return createFallback()
  }
}

export function persistDemoState(state: DemoState, storage: DemoStorage | null = getBrowserStorage()): void {
  try {
    storage?.setItem(DEMO_STORAGE_KEY, JSON.stringify({ version: STORAGE_VERSION, state }))
  } catch {
    // Storage is optional for the demo; a blocked quota/private mode is non-fatal.
  }
}
