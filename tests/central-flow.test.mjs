import test from 'node:test'
import assert from 'node:assert/strict'
import { demoReducer, quoteTrip } from '../src/demo/dispatch.ts'
import {
  getActiveRequests,
  getAvailableDrivers,
  getBusyDrivers,
  getCentralKpis,
  getCentralTripRows,
  getDispatchTargetDriver,
  getDriverAvailabilityLockReason,
  getEligibleManualOverrideDrivers,
  getTripPassengerLabel,
} from '../src/central/central-flow.ts'

const apply = (state, type, payload = {}) => demoReducer(state, { type, ...payload })
const origin = { zoneId: 'centro', label: 'Av. Libertad 450 · Centro' }
const destination = { zoneId: 'terminal', label: 'Terminal de Ómnibus' }
const createInitialDemoState = () => ({
  passenger: { id: 'passenger-demo', name: 'Cliente Demo', phone: '3884000000', homeAddress: origin.label },
  drivers: [
    { id: 'driver-a', name: 'Chofer A', vehicleId: 'vehicle-a', color: '#1769e8', availability: 'AVAILABLE', distanceMeters: 450, locationLabel: 'Centro' },
    { id: 'driver-b', name: 'Chofer B', vehicleId: 'vehicle-b', color: '#805ad5', availability: 'AVAILABLE', distanceMeters: 900, locationLabel: 'Terminal' },
    { id: 'driver-c', name: 'Chofer C', vehicleId: 'vehicle-c', color: '#16a36a', availability: 'UNAVAILABLE', distanceMeters: 300, locationLabel: 'UNJu' },
    { id: 'driver-d', name: 'Chofer D', vehicleId: 'vehicle-d', color: '#e88720', availability: 'AVAILABLE', distanceMeters: 1400, locationLabel: 'Calilegua' },
  ],
  vehicles: [
    { id: 'vehicle-a', make: 'Toyota', model: 'Etios', plate: 'AA111AA', color: 'Blanco', mobile: '01' },
    { id: 'vehicle-b', make: 'Fiat', model: 'Cronos', plate: 'BB222BB', color: 'Gris', mobile: '02' },
    { id: 'vehicle-c', make: 'Renault', model: 'Logan', plate: 'CC333CC', color: 'Negro', mobile: '03' },
    { id: 'vehicle-d', make: 'Chevrolet', model: 'Onix', plate: 'DD444DD', color: 'Azul', mobile: '04' },
  ],
  zones: ['centro', 'terminal', 'hospital', 'barrio-ledesma', 'libertador', 'calilegua', 'unju'].map((id) => ({ id, name: id })),
  fares: [{ id: 'centro-terminal', originZoneId: 'centro', destinationZoneId: 'terminal', price: '$2.500' }],
  selectedOrigin: origin, selectedDestination: null, activeTrip: null, currentOffer: null, offers: [],
  dispatch: { status: 'IDLE', candidateDriverIds: [], attemptedDriverIds: [], currentOfferId: null },
  tripHistory: [], nextTripNumber: 1, nextOfferNumber: 1,
})
const manualRequest = (state, values = {}) => apply(state, 'CREATE_MANUAL_TRIP', {
  passengerDisplayName: 'Ana Demo', contactPhone: '3884000000', origin, destination, source: 'PHONE', ...values,
})

test('Central manual request creates a sourced REQUESTED trip and starts shared dispatch', () => {
  const state = manualRequest(createInitialDemoState())
  assert.equal(state.activeTrip.status, 'REQUESTED')
  assert.equal(state.activeTrip.source, 'PHONE')
  assert.equal(state.activeTrip.passengerDisplayName, 'Ana Demo')
  assert.equal(state.activeTrip.contactPhone, '3884000000')
  assert.equal(state.activeTrip.driverId, null)
  assert.equal(state.dispatch.status, 'WAITING_FOR_RESPONSE')
  assert.equal(state.currentOffer.driverId, 'driver-a')
  assert.equal(state.offers.filter((offer) => offer.status === 'PENDING').length, 1)
})

test('manual requests support dispatcher source without making APP selectable', () => {
  const state = manualRequest(createInitialDemoState(), { source: 'DISPATCHER' })
  assert.equal(state.activeTrip.source, 'DISPATCHER')
  assert.equal(state.activeTrip.status, 'REQUESTED')
})

test('manual request without a zonal fare does not create a trip', () => {
  const initial = createInitialDemoState()
  const state = manualRequest(initial, { origin: { zoneId: 'centro', label: 'Centro' }, destination: { zoneId: 'calilegua', label: 'Calilegua' } })
  assert.equal(state, initial)
  assert.equal(state.activeTrip, null)
})

test('manual request is blocked while the single active demo trip is non-terminal', () => {
  const active = manualRequest(createInitialDemoState())
  const second = manualRequest(active, { passengerDisplayName: 'Segundo pedido' })
  assert.equal(second, active)
  assert.equal(second.nextTripNumber, 2)
})

test('manual request enters the same exclusive sequential dispatch queue', () => {
  let state = manualRequest(createInitialDemoState())
  assert.equal(state.currentOffer.driverId, 'driver-a')
  state = apply(state, 'REJECT_CURRENT_OFFER_AS_DRIVER', { driverId: 'driver-a' })
  assert.equal(state.currentOffer.driverId, 'driver-b')
  assert.equal(state.offers.filter((offer) => offer.status === 'PENDING').length, 1)
})

test('dispatcher override cancels the old pending offer before opening exactly one new offer', () => {
  const initial = manualRequest(createInitialDemoState())
  const oldOfferId = initial.currentOffer.id
  const state = apply(initial, 'DISPATCH_TO_DRIVER_AS_DISPATCHER', { driverId: 'driver-b' })
  assert.equal(state.offers.find((offer) => offer.id === oldOfferId).status, 'CANCELLED')
  assert.equal(state.currentOffer.driverId, 'driver-b')
  assert.equal(state.currentOffer.status, 'PENDING')
  assert.equal(state.offers.filter((offer) => offer.status === 'PENDING').length, 1)
  assert.equal(state.dispatch.currentOfferId, state.currentOffer.id)
  assert.equal(state.dispatch.status, 'WAITING_FOR_RESPONSE')
})

test('manual override retains REQUESTED and null assignment until the chosen driver accepts', () => {
  let state = apply(manualRequest(createInitialDemoState()), 'DISPATCH_TO_DRIVER_AS_DISPATCHER', { driverId: 'driver-b' })
  assert.equal(state.activeTrip.status, 'REQUESTED')
  assert.equal(state.activeTrip.driverId, null)
  assert.equal(state.activeTrip.vehicleId, null)
  assert.equal(state.dispatch.status, 'WAITING_FOR_RESPONSE')
  assert.equal(apply(state, 'ACCEPT_CURRENT_OFFER_AS_DRIVER', { driverId: 'driver-a' }), state)
  state = apply(state, 'ACCEPT_CURRENT_OFFER_AS_DRIVER', { driverId: 'driver-b' })
  assert.equal(state.activeTrip.status, 'ASSIGNED')
  assert.equal(state.activeTrip.driverId, 'driver-b')
})

test('dispatcher cannot override to UNAVAILABLE or BUSY driver', () => {
  const pending = manualRequest(createInitialDemoState())
  const unavailable = apply(pending, 'SET_DRIVER_AVAILABILITY', { driverId: 'driver-b', availability: 'UNAVAILABLE' })
  assert.equal(apply(unavailable, 'DISPATCH_TO_DRIVER_AS_DISPATCHER', { driverId: 'driver-b' }), unavailable)
  const busy = { ...pending, drivers: pending.drivers.map((driver) => driver.id === 'driver-b' ? { ...driver, availability: 'BUSY' } : driver) }
  assert.equal(apply(busy, 'DISPATCH_TO_DRIVER_AS_DISPATCHER', { driverId: 'driver-b' }), busy)
})

test('dispatcher can intervene after NO_CANDIDATES when a driver becomes available', () => {
  let state = createInitialDemoState()
  state = state.drivers.reduce((current, driver) => apply(current, 'SET_DRIVER_AVAILABILITY', { driverId: driver.id, availability: 'UNAVAILABLE' }), state)
  state = manualRequest(state)
  assert.equal(state.dispatch.status, 'NO_CANDIDATES')
  state = apply(state, 'SET_DRIVER_AVAILABILITY', { driverId: 'driver-b', availability: 'AVAILABLE' })
  state = apply(state, 'DISPATCH_TO_DRIVER_AS_DISPATCHER', { driverId: 'driver-b' })
  assert.equal(state.currentOffer.driverId, 'driver-b')
  assert.equal(state.activeTrip.driverId, null)
  assert.equal(state.dispatch.status, 'WAITING_FOR_RESPONSE')
})

test('fare edits validate integer ARS input and affect future quote only', () => {
  let state = createInitialDemoState()
  state = apply(state, 'SET_DESTINATION', { location: destination })
  state = apply(state, 'REQUEST_TRIP')
  const tripPrice = state.activeTrip.price
  const fareId = state.activeTrip.fareId
  state = apply(state, 'UPDATE_DEMO_FARE', { fareId, amount: '32000' })
  assert.equal(state.activeTrip.price, tripPrice)
  assert.equal(state.fares.find((fare) => fare.id === fareId).price, '$32.000')
  assert.equal(quoteTrip(state).fare.price, '$32.000')
})

test('invalid fare amounts and unknown fare ids are controlled no-ops', () => {
  const initial = createInitialDemoState()
  for (const amount of ['0', '-50', 'NaN', '12.50', '$900']) {
    assert.equal(apply(initial, 'UPDATE_DEMO_FARE', { fareId: initial.fares[0].id, amount }), initial)
  }
  assert.equal(apply(initial, 'UPDATE_DEMO_FARE', { fareId: 'missing', amount: '2500' }), initial)
})

test('reset restores the original fixture fares', () => {
  const initial = createInitialDemoState()
  const changed = apply(initial, 'UPDATE_DEMO_FARE', { fareId: initial.fares[0].id, amount: '99000' })
  const reset = apply(changed, 'RESET_DEMO', { initialState: createInitialDemoState() })
  assert.deepEqual(reset.fares, initial.fares)
})

test('Central availability uses existing protection for offers and assigned BUSY drivers', () => {
  const pending = manualRequest(createInitialDemoState())
  assert.equal(getDriverAvailabilityLockReason(pending, 'driver-a'), 'Estado bloqueado por oferta pendiente.')
  assert.equal(apply(pending, 'SET_DRIVER_AVAILABILITY', { driverId: 'driver-a', availability: 'UNAVAILABLE' }), pending)
  let assigned = apply(pending, 'REJECT_CURRENT_OFFER_AS_DRIVER', { driverId: 'driver-a' })
  assigned = apply(assigned, 'ACCEPT_CURRENT_OFFER_AS_DRIVER', { driverId: 'driver-b' })
  assert.equal(getDriverAvailabilityLockReason(assigned, 'driver-b'), 'Estado bloqueado por viaje activo.')
  assert.equal(apply(assigned, 'SET_DRIVER_AVAILABILITY', { driverId: 'driver-b', availability: 'UNAVAILABLE' }), assigned)
  const free = apply(createInitialDemoState(), 'SET_DRIVER_AVAILABILITY', { driverId: 'driver-b', availability: 'UNAVAILABLE' })
  assert.equal(free.drivers.find((driver) => driver.id === 'driver-b').availability, 'UNAVAILABLE')
})

test('Central selectors derive KPIs, rows, targets, eligible overrides and passenger labels from shared state', () => {
  const state = manualRequest(createInitialDemoState())
  assert.equal(getActiveRequests(state)[0], state.activeTrip)
  assert.equal(getDispatchTargetDriver(state).id, 'driver-a')
  assert.deepEqual(getEligibleManualOverrideDrivers(state).map((driver) => driver.id), ['driver-b', 'driver-d'])
  assert.equal(getTripPassengerLabel(state.activeTrip, state), 'Ana Demo')
  assert.equal(getCentralTripRows(state, 'ACTIVE')[0], state.activeTrip)
  assert.equal(getAvailableDrivers(state).length, 3)
  assert.equal(getBusyDrivers(state).length, 0)
  assert.deepEqual(getCentralKpis(state), { activeRequests: 1, availableDrivers: 3, busyDrivers: 0, completedTrips: 0 })
})

test('role/view selectors do not mutate the shared demo state', () => {
  const state = manualRequest(createInitialDemoState())
  const before = structuredClone(state)
  getCentralKpis(state)
  getCentralTripRows(state)
  getEligibleManualOverrideDrivers(state)
  assert.deepEqual(state, before)
})
