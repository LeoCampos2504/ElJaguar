import test from 'node:test'
import assert from 'node:assert/strict'
import { canPassengerCancel, demoReducer, getCurrentDriver, quoteTrip } from '../src/demo/dispatch.ts'
import { clientRouteByTripStatus, findDemoLocation, getClientRouteForTripState, getClientRouteGuard } from '../src/client-flow.ts'

const apply = (state, type) => demoReducer(state, { type })
const initialState = () => ({
  passenger: { id: 'passenger-demo', name: 'Pasajero demo', phone: '000', homeAddress: 'Av. Libertad 450' },
  drivers: [
    { id: 'driver-a', name: 'Chofer A', vehicleId: 'vehicle-a', color: '#1769e8', availability: 'AVAILABLE', distanceMeters: 450, locationLabel: 'Centro' },
    { id: 'driver-b', name: 'Chofer B', vehicleId: 'vehicle-b', color: '#805ad5', availability: 'AVAILABLE', distanceMeters: 900, locationLabel: 'Terminal' },
  ],
  vehicles: [
    { id: 'vehicle-a', make: 'Toyota', model: 'Etios', plate: 'AA111AA', color: 'Blanco', mobile: '01' },
    { id: 'vehicle-b', make: 'Fiat', model: 'Cronos', plate: 'BB222BB', color: 'Gris', mobile: '02' },
  ],
  zones: [{ id: 'centro', name: 'Centro' }, { id: 'terminal', name: 'Terminal' }, { id: 'unju', name: 'UNJu' }],
  fares: [{ id: 'centro-terminal', originZoneId: 'centro', destinationZoneId: 'terminal', price: '$2.500' }],
  selectedOrigin: { zoneId: 'centro', label: 'Av. Libertad 450' }, selectedDestination: null,
  activeTrip: null, currentOffer: null, offers: [],
  dispatch: { status: 'IDLE', candidateDriverIds: [], attemptedDriverIds: [], currentOfferId: null },
  tripHistory: [], nextTripNumber: 1, nextOfferNumber: 1,
})

test('demo destinations map to shared zonal quotes; missing fare cannot create a trip', () => {
  let state = initialState()
  const terminal = findDemoLocation('Terminal de Ómnibus')
  assert.ok(terminal)
  state = demoReducer(state, { type: 'SET_DESTINATION', location: terminal })
  assert.equal(quoteTrip(state).status, 'AVAILABLE')
  assert.equal(quoteTrip(state).fare.price, '$2.500')
  state = demoReducer(state, { type: 'SET_DESTINATION', location: findDemoLocation('UNJu - Sede Libertador') })
  assert.equal(quoteTrip(state).status, 'NO_FARE')
  state = apply(state, 'REQUEST_TRIP')
  assert.equal(state.activeTrip, null)
})

test('the same active trip maps through searching, assignment, en route, arrival and in progress', () => {
  let state = initialState()
  state = demoReducer(state, { type: 'SET_DESTINATION', location: findDemoLocation('Terminal de Ómnibus') })
  state = apply(state, 'REQUEST_TRIP')
  assert.equal(state.activeTrip.status, 'REQUESTED')
  assert.equal(getClientRouteForTripState(state.activeTrip), clientRouteByTripStatus.REQUESTED)
  assert.equal(getCurrentDriver(state), null)
  state = apply(state, 'ACCEPT_CURRENT_OFFER')
  assert.equal(state.activeTrip.status, 'ASSIGNED')
  assert.equal(getClientRouteForTripState(state.activeTrip), '/cliente/asignado')
  assert.ok(getCurrentDriver(state))
  state = apply(state, 'MARK_DRIVER_EN_ROUTE')
  assert.equal(getClientRouteForTripState(state.activeTrip), '/cliente/en-camino')
  state = apply(state, 'MARK_DRIVER_ARRIVED')
  assert.equal(getClientRouteForTripState(state.activeTrip), '/cliente/llego')
  state = apply(state, 'START_TRIP')
  assert.equal(getClientRouteForTripState(state.activeTrip), '/cliente/en-viaje')
  assert.equal(canPassengerCancel(state), false)
  state = apply(state, 'CANCEL_TRIP')
  assert.equal(state.activeTrip.status, 'IN_PROGRESS')
})

test('completion adds the same trip to runtime history once; reset restores initial state', () => {
  let state = initialState()
  state = demoReducer(state, { type: 'SET_DESTINATION', location: findDemoLocation('Terminal de Ómnibus') })
  state = apply(state, 'REQUEST_TRIP')
  state = apply(state, 'ACCEPT_CURRENT_OFFER')
  state = apply(state, 'MARK_DRIVER_EN_ROUTE')
  state = apply(state, 'MARK_DRIVER_ARRIVED')
  state = apply(state, 'START_TRIP')
  const tripId = state.activeTrip.id
  state = apply(state, 'COMPLETE_TRIP')
  assert.equal(state.activeTrip.status, 'COMPLETED')
  assert.equal(state.tripHistory.filter((trip) => trip.id === tripId).length, 1)
  assert.equal(getClientRouteForTripState(state.activeTrip), '/cliente/finalizado')
  state = demoReducer(state, { type: 'RESET_DEMO', initialState: initialState() })
  assert.equal(state.activeTrip, null)
  assert.equal(state.selectedDestination, null)
  assert.equal(state.dispatch.status, 'IDLE')
})

test('no-candidate dispatch reveals no driver, and retry uses current availability on the same trip', () => {
  let state = initialState()
  state = demoReducer(state, { type: 'SET_DESTINATION', location: findDemoLocation('Terminal de Ómnibus') })
  state = state.drivers.reduce((current, driver) => demoReducer(current, { type: 'SET_DRIVER_AVAILABILITY', driverId: driver.id, availability: 'UNAVAILABLE' }), state)
  state = apply(state, 'REQUEST_TRIP')
  assert.equal(state.dispatch.status, 'NO_CANDIDATES')
  assert.equal(state.activeTrip.status, 'REQUESTED')
  assert.equal(state.activeTrip.driverId, null)
  assert.equal(getCurrentDriver(state), null)
  const id = state.activeTrip.id
  state = demoReducer(state, { type: 'SET_DRIVER_AVAILABILITY', driverId: 'driver-b', availability: 'AVAILABLE' })
  state = apply(state, 'RETRY_DISPATCH')
  assert.equal(state.activeTrip.id, id)
  assert.equal(state.currentOffer.driverId, 'driver-b')
})

test('incompatible direct routes redirect to the route for current trip state', () => {
  let state = initialState()
  assert.equal(getClientRouteGuard('/cliente/finalizado', state), '/cliente')
  state = demoReducer(state, { type: 'SET_DESTINATION', location: findDemoLocation('Terminal de Ómnibus') })
  state = apply(state, 'REQUEST_TRIP')
  assert.equal(getClientRouteGuard('/cliente/en-viaje', state), '/cliente/buscando')
  assert.equal(getClientRouteGuard('/cliente/viaje', state), '/cliente/buscando')
  assert.equal(getClientRouteGuard('/cliente/buscando', state), null)
})

test('cancellation is recorded before arrival and blocked once the trip starts', () => {
  let state = initialState()
  state = demoReducer(state, { type: 'SET_DESTINATION', location: findDemoLocation('Terminal de Ómnibus') })
  state = apply(state, 'REQUEST_TRIP')
  assert.equal(canPassengerCancel(state), true)
  state = apply(state, 'CANCEL_TRIP')
  assert.equal(state.activeTrip.status, 'CANCELLED')
  assert.equal(state.tripHistory[0].id, state.activeTrip.id)
  assert.equal(getClientRouteForTripState(state.activeTrip), '/cliente/cancelado')
})
