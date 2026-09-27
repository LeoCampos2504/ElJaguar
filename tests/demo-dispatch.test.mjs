import test from 'node:test'
import assert from 'node:assert/strict'
import {
  canPassengerCancel,
  assertDemoStateInvariants,
  demoReducer,
  getDemoFare,
  getPendingOffer,
  getSortedCandidates,
  quoteTrip,
} from '../src/demo/dispatch.ts'

function initialState() {
  return {
    passenger: { id: 'passenger-1', name: 'Pasajero demo', phone: '000', homeAddress: 'Av. Libertad 450' },
    drivers: [
      { id: 'A', name: 'Chofer A', vehicleId: 'VA', color: '#1769e8', availability: 'AVAILABLE', distanceMeters: 450, locationLabel: 'Centro' },
      { id: 'B', name: 'Chofer B', vehicleId: 'VB', color: '#805ad5', availability: 'AVAILABLE', distanceMeters: 900, locationLabel: 'Terminal' },
      { id: 'C', name: 'Chofer C', vehicleId: 'VC', color: '#16a36a', availability: 'UNAVAILABLE', distanceMeters: 300, locationLabel: 'UNJu' },
      { id: 'D', name: 'Chofer D', vehicleId: 'VD', color: '#e88720', availability: 'AVAILABLE', distanceMeters: 1400, locationLabel: 'Calilegua' },
    ],
    vehicles: [
      { id: 'VA', make: 'Toyota', model: 'Etios', plate: 'AA111AA', color: 'Blanco', mobile: '01' },
      { id: 'VB', make: 'Fiat', model: 'Cronos', plate: 'BB222BB', color: 'Gris', mobile: '02' },
      { id: 'VC', make: 'Renault', model: 'Logan', plate: 'CC333CC', color: 'Negro', mobile: '03' },
      { id: 'VD', make: 'Chevrolet', model: 'Onix', plate: 'DD444DD', color: 'Azul', mobile: '04' },
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

const request = (state) => demoReducer(state, { type: 'REQUEST_TRIP' })
const reject = (state) => demoReducer(state, { type: 'REJECT_CURRENT_OFFER' })
const expire = (state) => demoReducer(state, { type: 'EXPIRE_CURRENT_OFFER' })
const accept = (state) => demoReducer(state, { type: 'ACCEPT_CURRENT_OFFER' })

test('offers the nearest AVAILABLE driver and excludes the nearer UNAVAILABLE driver', () => {
  const initial = initialState()
  assert.deepEqual(getSortedCandidates(initial).map((driver) => driver.id), ['A', 'B', 'D'])
  const state = request(initial)
  assert.equal(state.activeTrip.status, 'REQUESTED')
  assert.equal(state.activeTrip.driverId, null)
  assert.equal(getPendingOffer(state).driverId, 'A')
})

test('keeps exactly one pending offer, addressed only to the current driver', () => {
  const state = request(initialState())
  assert.equal(state.offers.filter((offer) => offer.status === 'PENDING').length, 1)
  assert.deepEqual(state.offers.filter((offer) => offer.status === 'PENDING').map((offer) => offer.driverId), ['A'])
  assert.equal(state.offers.some((offer) => ['B', 'D'].includes(offer.driverId)), false)
})

test('runtime invariant rejects a state containing simultaneous pending offers', () => {
  const state = request(initialState())
  const secondPending = { ...state.currentOffer, id: 'demo-offer-invalid', driverId: 'B' }
  assert.throws(() => assertDemoStateInvariants({
    ...state,
    offers: [...state.offers, secondPending],
  }), /more than one pending offer/)
})

test('REJECT closes A offer before creating the next PENDING offer for B', () => {
  const state = reject(request(initialState()))
  assert.equal(state.offers[0].status, 'REJECTED')
  assert.equal(state.offers.filter((offer) => offer.status === 'PENDING').length, 1)
  assert.equal(getPendingOffer(state).driverId, 'B')
})

test('TIMEOUT closes B offer before creating the next PENDING offer for D', () => {
  const afterA = reject(request(initialState()))
  const afterB = expire(afterA)
  assert.equal(afterB.offers[1].status, 'EXPIRED')
  assert.equal(afterB.offers.filter((offer) => offer.status === 'PENDING').length, 1)
  assert.equal(getPendingOffer(afterB).driverId, 'D')
})

test('accept assigns D and stops dispatch without offering to another driver', () => {
  const afterD = expire(reject(request(initialState())))
  const assigned = accept(afterD)
  assert.equal(assigned.offers.at(-1).status, 'ACCEPTED')
  assert.equal(assigned.activeTrip.status, 'ASSIGNED')
  assert.equal(assigned.activeTrip.driverId, 'D')
  assert.equal(assigned.activeTrip.vehicleId, 'VD')
  assert.equal(assigned.drivers.find((driver) => driver.id === 'D').availability, 'BUSY')
  assert.equal(assigned.dispatch.status, 'ASSIGNED')
  assert.equal(assigned.offers.filter((offer) => offer.status === 'PENDING').length, 0)
})

test('reports NO_CANDIDATES and leaves the requested trip unassigned after all eligible drivers pass', () => {
  let state = request(initialState())
  state = reject(state)
  state = reject(state)
  state = reject(state)
  assert.equal(state.dispatch.status, 'NO_CANDIDATES')
  assert.equal(state.activeTrip.status, 'REQUESTED')
  assert.equal(state.activeTrip.driverId, null)
  assert.equal(state.currentOffer, null)
})

test('allows cancellation before IN_PROGRESS, cancels a pending offer and releases an assigned driver', () => {
  const requested = request(initialState())
  assert.equal(canPassengerCancel(requested), true)
  const cancelledRequest = demoReducer(requested, { type: 'CANCEL_TRIP' })
  assert.equal(cancelledRequest.activeTrip.status, 'CANCELLED')
  assert.equal(cancelledRequest.offers[0].status, 'CANCELLED')
  assert.equal(cancelledRequest.dispatch.status, 'STOPPED')

  const assigned = accept(reject(request(initialState())))
  const cancelledAssigned = demoReducer(assigned, { type: 'CANCEL_TRIP' })
  assert.equal(cancelledAssigned.activeTrip.status, 'CANCELLED')
  assert.equal(cancelledAssigned.drivers.find((driver) => driver.id === 'B').availability, 'AVAILABLE')
})

test('rejects passenger cancellation during IN_PROGRESS as a controlled no-op', () => {
  let state = accept(request(initialState()))
  state = demoReducer(state, { type: 'MARK_DRIVER_EN_ROUTE' })
  state = demoReducer(state, { type: 'MARK_DRIVER_ARRIVED' })
  state = demoReducer(state, { type: 'START_TRIP' })
  assert.equal(state.activeTrip.status, 'IN_PROGRESS')
  assert.equal(canPassengerCancel(state), false)
  assert.equal(demoReducer(state, { type: 'CANCEL_TRIP' }), state)
})

test('rejects REQUESTED -> COMPLETED as a controlled no-op', () => {
  const state = request(initialState())
  assert.equal(demoReducer(state, { type: 'COMPLETE_TRIP' }), state)
})

test('valid trip progression is centralized and releases the driver on completion', () => {
  let state = accept(request(initialState()))
  state = demoReducer(state, { type: 'MARK_DRIVER_EN_ROUTE' })
  assert.equal(state.activeTrip.status, 'DRIVER_EN_ROUTE')
  state = demoReducer(state, { type: 'MARK_DRIVER_ARRIVED' })
  assert.equal(state.activeTrip.status, 'ARRIVED')
  state = demoReducer(state, { type: 'START_TRIP' })
  assert.equal(state.activeTrip.status, 'IN_PROGRESS')
  state = demoReducer(state, { type: 'COMPLETE_TRIP' })
  assert.equal(state.activeTrip.status, 'COMPLETED')
  assert.equal(state.drivers.find((driver) => driver.id === 'A').availability, 'AVAILABLE')
  assert.equal(state.tripHistory[0].id, state.activeTrip.id)
  assert.equal(state.dispatch.status, 'STOPPED')
})

test('duplicate REQUEST_TRIP actions do not create multiple active trips', () => {
  const state = request(initialState())
  assert.equal(demoReducer(state, { type: 'REQUEST_TRIP' }), state)
  assert.equal(state.nextTripNumber, 2)
  assert.equal(state.offers.filter((offer) => offer.status === 'PENDING').length, 1)
})

test('resetDemo reducer action restores the exact supplied initial scenario', () => {
  const initial = initialState()
  const changed = reject(request(initial))
  const reset = demoReducer(changed, { type: 'RESET_DEMO', initialState: initialState() })
  assert.deepEqual(reset, initial)
})

test('returns an explicit no-fare quote and refuses to create a trip for an unsupported zone pair', () => {
  const state = initialState()
  assert.equal(getDemoFare(state.fares, 'centro', 'terminal'), state.fares[0])
  assert.equal(getDemoFare(state.fares, 'centro', 'calilegua'), null)
  state.selectedDestination = { zoneId: 'unsupported', label: 'Zona sin tarifa' }
  assert.deepEqual(quoteTrip(state), { status: 'NO_FARE', fare: null })
  assert.equal(demoReducer(state, { type: 'REQUEST_TRIP' }), state)
})
