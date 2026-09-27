import { useReducer, type ReactNode } from 'react'
import { demoReducer, quoteTrip } from './dispatch'
import { createInitialDemoState } from './fixtures'
import { DemoContext, type DemoContextValue } from './demo-context'

export function DemoProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(demoReducer, undefined, createInitialDemoState)

  const value: DemoContextValue = {
    state,
    resetDemo: () => dispatch({ type: 'RESET_DEMO', initialState: createInitialDemoState() }),
    setOrigin: (location) => dispatch({ type: 'SET_ORIGIN', location }),
    setDestination: (location) => dispatch({ type: 'SET_DESTINATION', location }),
    quoteTrip: () => quoteTrip(state),
    requestTrip: () => dispatch({ type: 'REQUEST_TRIP' }),
    startDispatch: () => dispatch({ type: 'START_DISPATCH' }),
    retryDispatch: () => dispatch({ type: 'RETRY_DISPATCH' }),
    acceptCurrentOffer: () => dispatch({ type: 'ACCEPT_CURRENT_OFFER' }),
    rejectCurrentOffer: () => dispatch({ type: 'REJECT_CURRENT_OFFER' }),
    acceptCurrentOfferAsDriver: (driverId) => dispatch({ type: 'ACCEPT_CURRENT_OFFER_AS_DRIVER', driverId }),
    rejectCurrentOfferAsDriver: (driverId) => dispatch({ type: 'REJECT_CURRENT_OFFER_AS_DRIVER', driverId }),
    expireCurrentOffer: () => dispatch({ type: 'EXPIRE_CURRENT_OFFER' }),
    markDriverEnRoute: () => dispatch({ type: 'MARK_DRIVER_EN_ROUTE' }),
    markDriverEnRouteAsDriver: (driverId) => dispatch({ type: 'MARK_DRIVER_EN_ROUTE_AS_DRIVER', driverId }),
    markDriverArrived: () => dispatch({ type: 'MARK_DRIVER_ARRIVED' }),
    markDriverArrivedAsDriver: (driverId) => dispatch({ type: 'MARK_DRIVER_ARRIVED_AS_DRIVER', driverId }),
    startTrip: () => dispatch({ type: 'START_TRIP' }),
    startTripAsDriver: (driverId) => dispatch({ type: 'START_TRIP_AS_DRIVER', driverId }),
    completeTrip: () => dispatch({ type: 'COMPLETE_TRIP' }),
    completeTripAsDriver: (driverId) => dispatch({ type: 'COMPLETE_TRIP_AS_DRIVER', driverId }),
    cancelTrip: () => dispatch({ type: 'CANCEL_TRIP' }),
    setDriverAvailability: (driverId, availability) => dispatch({ type: 'SET_DRIVER_AVAILABILITY', driverId, availability }),
    setDriverAvailabilityAsDriver: (driverId, availability) => dispatch({ type: 'SET_DRIVER_AVAILABILITY_AS_DRIVER', driverId, availability }),
  }

  return <DemoContext.Provider value={value}>{children}</DemoContext.Provider>
}
