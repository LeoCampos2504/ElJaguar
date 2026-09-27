import { createContext } from 'react'
import type { DemoDriverAvailability, DemoLocation, DemoState } from './types'
import type { DemoFareQuote } from './dispatch'

export type DemoContextValue = {
  state: DemoState
  resetDemo: () => void
  setOrigin: (location: DemoLocation | null) => void
  setDestination: (location: DemoLocation | null) => void
  quoteTrip: () => DemoFareQuote
  requestTrip: () => void
  startDispatch: () => void
  acceptCurrentOffer: () => void
  rejectCurrentOffer: () => void
  expireCurrentOffer: () => void
  markDriverEnRoute: () => void
  markDriverArrived: () => void
  startTrip: () => void
  completeTrip: () => void
  cancelTrip: () => void
  setDriverAvailability: (driverId: string, availability: DemoDriverAvailability) => void
}

export const DemoContext = createContext<DemoContextValue | null>(null)
