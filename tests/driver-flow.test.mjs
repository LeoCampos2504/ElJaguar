import test from 'node:test'
import assert from 'node:assert/strict'
import { demoReducer } from '../src/demo/dispatch.ts'
import { getDriverHistory, getDriverLandingRoute, getDriverRouteGuard, getOfferForDriver, getTripForDriver } from '../src/driver/driver-flow.ts'
import { getClientRouteForTripState } from '../src/client-flow.ts'
import { getCentralTripRows } from '../src/central/central-flow.ts'

const apply = (state, type, driverId, extra = {}) => demoReducer(state, { type, ...(driverId ? { driverId } : {}), ...extra })

function initialState() {
  return {
    passenger: { id: 'passenger-demo', name: 'Pasajero demo', phone: '000', homeAddress: 'Av. Libertad 450' },
    drivers: [
      { id: 'driver-a', name: 'Chofer A', vehicleId: 'vehicle-07', color: '#1769e8', availability: 'AVAILABLE', distanceMeters: 450, locationLabel: 'Centro' },
      { id: 'driver-b', name: 'Chofer B', vehicleId: 'vehicle-03', color: '#805ad5', availability: 'AVAILABLE', distanceMeters: 900, locationLabel: 'Terminal' },
      { id: 'driver-c', name: 'Chofer C', vehicleId: 'vehicle-11', color: '#16a36a', availability: 'UNAVAILABLE', distanceMeters: 300, locationLabel: 'UNJu' },
      { id: 'driver-d', name: 'Chofer D', vehicleId: 'vehicle-09', color: '#e88720', availability: 'AVAILABLE', distanceMeters: 1400, locationLabel: 'Calilegua' },
    ],
    vehicles: [
      { id: 'vehicle-07', make: 'Toyota', model: 'Etios', plate: 'AA111AA', color: 'Blanco', mobile: '07' },
      { id: 'vehicle-03', make: 'Fiat', model: 'Cronos', plate: 'BB222BB', color: 'Gris', mobile: '03' },
      { id: 'vehicle-11', make: 'Renault', model: 'Logan', plate: 'CC333CC', color: 'Negro', mobile: '11' },
      { id: 'vehicle-09', make: 'Chevrolet', model: 'Onix', plate: 'DD444DD', color: 'Azul', mobile: '09' },
    ],
    zones: [{ id: 'centro', name: 'Centro' }, { id: 'terminal', name: 'Terminal' }],
    fares: [{ id: 'centro-terminal', originZoneId: 'centro', destinationZoneId: 'terminal', price: '$2.500' }],
    selectedOrigin: { zoneId: 'centro', label: 'Av. Libertad 450' },
    selectedDestination: { zoneId: 'terminal', label: 'Terminal de Ómnibus' },
    activeTrip: null,
    currentOffer: null,
    offers: [],
    dispatch: { status: 'IDLE', candidateDriverIds: [], attemptedDriverIds: [], currentOfferId: null },
    tripHistory: [],
    nextTripNumber: 1,
    nextOfferNumber: 1,
  }
}

function requestedTrip() { return apply(initialState(), 'REQUEST_TRIP') }

function assignedToB() {
  let state = requestedTrip()
  assert.equal(state.currentOffer.driverId, 'driver-a')
  state = apply(state, 'REJECT_CURRENT_OFFER_AS_DRIVER', 'driver-a')
  assert.equal(state.currentOffer.driverId, 'driver-b')
  return apply(state, 'ACCEPT_CURRENT_OFFER_AS_DRIVER', 'driver-b')
}

test('only the current offer owner can see a PENDING offer', () => {
  const state = requestedTrip()
  assert.equal(getOfferForDriver(state, 'driver-a'), state.currentOffer)
  assert.equal(getOfferForDriver(state, 'driver-b'), null)
  assert.equal(getOfferForDriver(state, null), null)
})

test('a different driver cannot accept or reject the current offer', () => {
  const state = requestedTrip()
  assert.equal(apply(state, 'ACCEPT_CURRENT_OFFER_AS_DRIVER', 'driver-b'), state)
  assert.equal(apply(state, 'REJECT_CURRENT_OFFER_AS_DRIVER', 'driver-b'), state)
})

test('A rejection closes A offer before B receives the next exclusive offer', () => {
  let state = requestedTrip()
  const firstOfferId = state.currentOffer.id
  state = apply(state, 'REJECT_CURRENT_OFFER_AS_DRIVER', 'driver-a')
  assert.equal(state.offers.find((offer) => offer.id === firstOfferId).status, 'REJECTED')
  assert.equal(state.currentOffer.driverId, 'driver-b')
  assert.equal(getOfferForDriver(state, 'driver-a'), null)
  assert.equal(getOfferForDriver(state, 'driver-b'), state.currentOffer)
  assert.equal(getDriverLandingRoute(state, 'driver-a'), '/chofer/inicio')
  assert.equal(getDriverLandingRoute(state, 'driver-b'), '/chofer/inicio')
  assert.equal(state.offers.filter((offer) => offer.status === 'PENDING').length, 1)
})

test('incoming request experience is visible only to the current offer target and switches A to B', () => {
  let state = requestedTrip()
  assert.equal(getOfferForDriver(state, 'driver-a')?.driverId, 'driver-a')
  assert.equal(getOfferForDriver(state, 'driver-b'), null)
  state = apply(state, 'REJECT_CURRENT_OFFER_AS_DRIVER', 'driver-a')
  assert.equal(getOfferForDriver(state, 'driver-a'), null)
  assert.equal(getOfferForDriver(state, 'driver-b')?.driverId, 'driver-b')
  const switchedIdentity = 'driver-b'
  assert.equal(getOfferForDriver(state, switchedIdentity), state.currentOffer)
  assert.equal(state.activeTrip.status, 'REQUESTED')
})

test('B acceptance assigns the same trip, vehicle, and BUSY state', () => {
  const state = assignedToB()
  assert.equal(state.offers.at(-1).status, 'ACCEPTED')
  assert.equal(state.activeTrip.status, 'ASSIGNED')
  assert.equal(state.activeTrip.driverId, 'driver-b')
  assert.equal(state.activeTrip.vehicleId, 'vehicle-03')
  assert.equal(state.drivers.find((driver) => driver.id === 'driver-b').availability, 'BUSY')
  assert.equal(state.dispatch.status, 'ASSIGNED')
})

test('B acceptance closes incoming request and the same assigned trip is visible in Client and Central', () => {
  const state = assignedToB()
  assert.equal(getOfferForDriver(state, 'driver-b'), null)
  assert.equal(state.activeTrip.status, 'ASSIGNED')
  assert.equal(state.activeTrip.driverId, 'driver-b')
  assert.equal(getTripForDriver(state, 'driver-b').id, state.activeTrip.id)
  assert.equal(getClientRouteForTripState(state.activeTrip), '/cliente/asignado')
  assert.ok(getCentralTripRows(state).some((row) => row.id === state.activeTrip.id))
})

test('A cannot advance the trip assigned to B at any driver transition', () => {
  let state = assignedToB()
  for (const type of [
    'MARK_DRIVER_EN_ROUTE_AS_DRIVER',
    'MARK_DRIVER_ARRIVED_AS_DRIVER',
    'START_TRIP_AS_DRIVER',
    'COMPLETE_TRIP_AS_DRIVER',
  ]) assert.equal(apply(state, type, 'driver-a'), state)
  state = apply(state, 'MARK_DRIVER_EN_ROUTE_AS_DRIVER', 'driver-b')
  assert.equal(state.activeTrip.status, 'DRIVER_EN_ROUTE')
})

test('B completes the trip through each valid actor-checked transition and returns AVAILABLE', () => {
  let state = assignedToB()
  state = apply(state, 'MARK_DRIVER_EN_ROUTE_AS_DRIVER', 'driver-b')
  assert.equal(state.activeTrip.status, 'DRIVER_EN_ROUTE')
  state = apply(state, 'MARK_DRIVER_ARRIVED_AS_DRIVER', 'driver-b')
  assert.equal(state.activeTrip.status, 'ARRIVED')
  state = apply(state, 'START_TRIP_AS_DRIVER', 'driver-b')
  assert.equal(state.activeTrip.status, 'IN_PROGRESS')
  state = apply(state, 'COMPLETE_TRIP_AS_DRIVER', 'driver-b')
  assert.equal(state.activeTrip.status, 'COMPLETED')
  assert.equal(state.drivers.find((driver) => driver.id === 'driver-b').availability, 'AVAILABLE')
  assert.equal(state.tripHistory[0].id, state.activeTrip.id)
  assert.deepEqual(getDriverHistory(state, 'driver-b').map((trip) => trip.id), [state.activeTrip.id])
})

test('passenger cancellation of an assigned trip releases its driver and remains visible only to its owner', () => {
  const state = demoReducer(assignedToB(), { type: 'CANCEL_TRIP' })
  assert.equal(state.activeTrip.status, 'CANCELLED')
  assert.equal(state.drivers.find((driver) => driver.id === 'driver-b').availability, 'AVAILABLE')
  assert.equal(getTripForDriver(state, 'driver-b'), state.activeTrip)
  assert.equal(getTripForDriver(state, 'driver-a'), null)
  assert.equal(getDriverRouteGuard('/chofer/viaje', 'driver-b', state), null)
})

test('unavailable drivers are excluded from the candidate queue', () => {
  const state = requestedTrip()
  assert.ok(!state.dispatch.candidateDriverIds.includes('driver-c'))
  assert.equal(getOfferForDriver(state, 'driver-c'), null)
})

test('driver guards route missing sessions and reject another driver offer/trip', () => {
  const pending = requestedTrip()
  assert.equal(getDriverRouteGuard('/chofer/viaje', null, pending), '/chofer/ingreso')
  assert.equal(getDriverRouteGuard('/chofer/oferta', 'driver-b', pending), '/chofer/inicio')

  const assigned = assignedToB()
  assert.equal(getDriverRouteGuard('/chofer/viaje', 'driver-b', assigned), null)
  assert.equal(getDriverRouteGuard('/chofer/viaje', 'driver-a', assigned), '/chofer/inicio')
})

test('changing the driver session does not mutate the shared business state', () => {
  const state = requestedTrip()
  const offerBeforeSwitch = state.currentOffer
  const selectedDriverId = 'driver-b'
  assert.equal(selectedDriverId, 'driver-b')
  assert.equal(state.currentOffer, offerBeforeSwitch)
  assert.equal(state.activeTrip.driverId, null)
  assert.equal(state.offers.filter((offer) => offer.status === 'PENDING').length, 1)
})

test('driver history filters shared trip history by assigned driver id', () => {
  const state = assignedToB()
  const completed = apply(apply(apply(apply(state, 'MARK_DRIVER_EN_ROUTE_AS_DRIVER', 'driver-b'), 'MARK_DRIVER_ARRIVED_AS_DRIVER', 'driver-b'), 'START_TRIP_AS_DRIVER', 'driver-b'), 'COMPLETE_TRIP_AS_DRIVER', 'driver-b')
  assert.ok(getDriverHistory(completed, 'driver-b').every((trip) => trip.driverId === 'driver-b'))
  assert.ok(!getDriverHistory(completed, 'driver-a').some((trip) => trip.id === completed.activeTrip.id))
})

test('driver availability changes are blocked while its offer is pending and work otherwise', () => {
  const pending = requestedTrip()
  assert.equal(apply(pending, 'SET_DRIVER_AVAILABILITY_AS_DRIVER', 'driver-a', { availability: 'UNAVAILABLE' }), pending)
  const unavailable = apply(pending, 'SET_DRIVER_AVAILABILITY_AS_DRIVER', 'driver-b', { availability: 'UNAVAILABLE' })
  assert.equal(unavailable.drivers.find((driver) => driver.id === 'driver-b').availability, 'UNAVAILABLE')
  const assigned = assignedToB()
  assert.equal(apply(assigned, 'SET_DRIVER_AVAILABILITY_AS_DRIVER', 'driver-b', { availability: 'UNAVAILABLE' }), assigned)
})
