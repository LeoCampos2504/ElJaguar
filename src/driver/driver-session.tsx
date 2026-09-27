import { createContext, useContext, useState, type ReactNode } from 'react'

type DriverSessionValue = {
  selectedDriverId: string | null
  selectDriver: (driverId: string) => void
  closeDriverSession: () => void
}

const DriverSessionContext = createContext<DriverSessionValue | null>(null)

export function DriverSessionProvider({ children }: { children: ReactNode }) {
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null)
  const value: DriverSessionValue = {
    selectedDriverId,
    selectDriver: setSelectedDriverId,
    closeDriverSession: () => setSelectedDriverId(null),
  }
  return <DriverSessionContext.Provider value={value}>{children}</DriverSessionContext.Provider>
}

export function useDriverSession(): DriverSessionValue {
  const context = useContext(DriverSessionContext)
  if (!context) throw new Error('useDriverSession must be used within DriverSessionProvider')
  return context
}
