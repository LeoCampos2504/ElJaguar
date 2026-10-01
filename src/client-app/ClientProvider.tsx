import { createContext, useContext, useEffect, useReducer, type Dispatch, type ReactNode } from 'react'
import { clientReducer, getMockDelayMs, initialClientState, type ClientAction, type ClientState } from './domain/client-state'
import { loadClientState, persistClientState } from './domain/client-storage'

type ClientContextValue = { state: ClientState; dispatch: Dispatch<ClientAction> }

const ClientContext = createContext<ClientContextValue | null>(null)

export function ClientProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(clientReducer, initialClientState, (initial) => loadClientState(initial))

  useEffect(() => { persistClientState(state) }, [state])

  // Mock progression of the trip (no real driver communication in Phase 1A).
  const trip = state.trip
  useEffect(() => {
    if (!trip) return
    const delay = getMockDelayMs(trip, Date.now())
    if (delay === null) return
    const timer = window.setTimeout(() => dispatch({ type: 'ADVANCE_MOCK_TRIP', now: Date.now() }), delay)
    return () => window.clearTimeout(timer)
  }, [trip?.id, trip?.status, trip?.updatedAt])

  return <ClientContext.Provider value={{ state, dispatch }}>{children}</ClientContext.Provider>
}

export function useClient(): ClientContextValue {
  const value = useContext(ClientContext)
  if (!value) throw new Error('useClient must be used inside ClientProvider')
  return value
}
