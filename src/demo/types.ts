export type DemoTripStatus =
  | 'REQUESTED'
  | 'ASSIGNED'
  | 'DRIVER_EN_ROUTE'
  | 'ARRIVED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED'

export type DemoDriverAvailability = 'OFFLINE' | 'AVAILABLE' | 'UNAVAILABLE' | 'BUSY'
export type DemoOfferStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED' | 'CANCELLED'
export type DemoDispatchStatus =
  | 'IDLE'
  | 'SEARCHING'
  | 'WAITING_FOR_RESPONSE'
  | 'ASSIGNED'
  | 'NO_CANDIDATES'
  | 'STOPPED'

export type DemoZone = {
  id: string
  name: string
}

export type DemoLocation = {
  zoneId: string
  label: string
}

export type DemoPassenger = {
  id: string
  name: string
  phone: string
  homeAddress: string
}

export type DemoVehicle = {
  id: string
  make: string
  model: string
  plate: string
  color: string
  mobile: string
}

export type DemoDriver = {
  id: string
  name: string
  vehicleId: string
  color: string
  availability: DemoDriverAvailability
  distanceMeters: number
  locationLabel: string
}

export type DemoFare = {
  id: string
  originZoneId: string
  destinationZoneId: string
  price: string
}

export type DemoTripOffer = {
  id: string
  tripId: string
  driverId: string
  vehicleId: string
  status: DemoOfferStatus
}

export type DemoTrip = {
  id: string
  sequence: number
  passengerId: string
  origin: DemoLocation
  destination: DemoLocation
  fareId: string | null
  price: string
  status: DemoTripStatus
  driverId: string | null
  vehicleId: string | null
}

export type DemoDispatchState = {
  status: DemoDispatchStatus
  candidateDriverIds: string[]
  attemptedDriverIds: string[]
  currentOfferId: string | null
}

export type DemoState = {
  passenger: DemoPassenger
  drivers: DemoDriver[]
  vehicles: DemoVehicle[]
  zones: DemoZone[]
  fares: DemoFare[]
  selectedOrigin: DemoLocation | null
  selectedDestination: DemoLocation | null
  activeTrip: DemoTrip | null
  currentOffer: DemoTripOffer | null
  offers: DemoTripOffer[]
  dispatch: DemoDispatchState
  tripHistory: DemoTrip[]
  nextTripNumber: number
  nextOfferNumber: number
}

export type DemoAction =
  | { type: 'RESET_DEMO'; initialState: DemoState }
  | { type: 'SET_ORIGIN'; location: DemoLocation | null }
  | { type: 'SET_DESTINATION'; location: DemoLocation | null }
  | { type: 'REQUEST_TRIP' }
  | { type: 'START_DISPATCH' }
  | { type: 'RETRY_DISPATCH' }
  | { type: 'ACCEPT_CURRENT_OFFER' }
  | { type: 'REJECT_CURRENT_OFFER' }
  | { type: 'ACCEPT_CURRENT_OFFER_AS_DRIVER'; driverId: string }
  | { type: 'REJECT_CURRENT_OFFER_AS_DRIVER'; driverId: string }
  | { type: 'EXPIRE_CURRENT_OFFER' }
  | { type: 'MARK_DRIVER_EN_ROUTE' }
  | { type: 'MARK_DRIVER_EN_ROUTE_AS_DRIVER'; driverId: string }
  | { type: 'MARK_DRIVER_ARRIVED' }
  | { type: 'MARK_DRIVER_ARRIVED_AS_DRIVER'; driverId: string }
  | { type: 'START_TRIP' }
  | { type: 'START_TRIP_AS_DRIVER'; driverId: string }
  | { type: 'COMPLETE_TRIP' }
  | { type: 'COMPLETE_TRIP_AS_DRIVER'; driverId: string }
  | { type: 'CANCEL_TRIP' }
  | { type: 'SET_DRIVER_AVAILABILITY'; driverId: string; availability: DemoDriverAvailability }
  | { type: 'SET_DRIVER_AVAILABILITY_AS_DRIVER'; driverId: string; availability: Exclude<DemoDriverAvailability, 'BUSY'> }
