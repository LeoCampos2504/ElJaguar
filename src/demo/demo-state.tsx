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
    acceptCurrentOffer: () => dispatch({ type: 'ACCEPT_CURRENT_OFFER' }),
    rejectCurrentOffer: () => dispatch({ type: 'REJECT_CURRENT_OFFER' }),
    expireCurrentOffer: () => dispatch({ type: 'EXPIRE_CURRENT_OFFER' }),
    markDriverEnRoute: () => dispatch({ type: 'MARK_DRIVER_EN_ROUTE' }),
    markDriverArrived: () => dispatch({ type: 'MARK_DRIVER_ARRIVED' }),
    startTrip: () => dispatch({ type: 'START_TRIP' }),
    completeTrip: () => dispatch({ type: 'COMPLETE_TRIP' }),
    cancelTrip: () => dispatch({ type: 'CANCEL_TRIP' }),
    setDriverAvailability: (driverId, availability) => dispatch({ type: 'SET_DRIVER_AVAILABILITY', driverId, availability }),
  }

  return <DemoContext.Provider value={value}>{children}</DemoContext.Provider>
}
