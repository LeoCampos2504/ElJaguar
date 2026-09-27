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
  retryDispatch: () => void
  acceptCurrentOffer: () => void
  rejectCurrentOffer: () => void
  acceptCurrentOfferAsDriver: (driverId: string) => void
  rejectCurrentOfferAsDriver: (driverId: string) => void
  expireCurrentOffer: () => void
  markDriverEnRoute: () => void
  markDriverEnRouteAsDriver: (driverId: string) => void
  markDriverArrived: () => void
  markDriverArrivedAsDriver: (driverId: string) => void
  startTrip: () => void
  startTripAsDriver: (driverId: string) => void
  completeTrip: () => void
  completeTripAsDriver: (driverId: string) => void
  cancelTrip: () => void
  setDriverAvailability: (driverId: string, availability: DemoDriverAvailability) => void
  setDriverAvailabilityAsDriver: (driverId: string, availability: Exclude<DemoDriverAvailability, 'BUSY'>) => void
}

export const DemoContext = createContext<DemoContextValue | null>(null)
