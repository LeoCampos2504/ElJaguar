export type TripStatus = 'searching' | 'assigned' | 'arrived' | 'in-progress' | 'completed' | 'cancelled'

export type Zone = {
  id: string
  name: string
}

export type Fare = {
  id: string
  originZone: string
  destinationZone: string
  price: string
}

export type FareVersion = {
  version: string
  effectiveFrom: string
  notice: string
}

export type Customer = {
  name: string
  phone: string
  address: string
}

export type Vehicle = {
  model: string
  plate: string
  mobile: string
}

export type Driver = {
  name: string
  vehicle: Vehicle
}

export type Trip = {
  id: string
  date: string
  time: string
  origin: string
  destination: string
  driver: string
  vehicle: string
  plate: string
  mobile: string
  price: string
  payment: string
  status: TripStatus
  duration?: string
}
