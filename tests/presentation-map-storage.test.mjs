import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { quickDestinations } from '../src/mock-data.ts'
import { getDestinationFromSearch, isDemoDebugEnabled } from '../src/demo/presentation-utils.ts'
import { findDemoLocation } from '../src/client-flow.ts'
import { demoReducer } from '../src/demo/dispatch.ts'
import { DEMO_DRIVER_LOCATIONS, DEMO_MAP_LOCATIONS, getMapLocationForZone } from '../src/demo/map-locations.ts'
import { DEMO_ROUTE_FIXTURES, getDemoRouteGeometry, getDriverApproachGeometry } from '../src/demo/map-routes.ts'
import { DEMO_STORAGE_KEY, loadDemoState, persistDemoState } from '../src/demo/demo-storage.ts'

test('presentation landing and document metadata use the canonical El Jaguar brand', () => {
  const landing = readFileSync(new URL('../src/presentation/DemoLanding.tsx', import.meta.url), 'utf8')
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8')
  const temporaryBrand = ['Remis', 'Norte'].join(' ')

  assert.match(landing, /EL JAGUAR/)
  assert.doesNotMatch(landing, new RegExp(temporaryBrand, 'i'))
  assert.match(html, /<title>EL JAGUAR · Prototipo<\/title>/)
  assert.match(html, /Prototipo operativo de EL JAGUAR/)
  assert.doesNotMatch(html, new RegExp(temporaryBrand, 'i'))
})

function initialState() {
  return {
    passenger: { id: 'p', name: 'Pasajero demo', phone: '000', homeAddress: 'Av. Libertad 450' },
    drivers: [{ id: 'driver-a', name: 'Chofer A', vehicleId: 'vehicle-a', color: '#1769e8', availability: 'AVAILABLE', distanceMeters: 450, locationLabel: 'Centro' }],
    vehicles: [{ id: 'vehicle-a', make: 'Toyota', model: 'Etios', plate: 'AA111AA', color: 'Blanco', mobile: '01' }],
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

function memoryStorage(value = null) {
  let stored = value
  return {
    getItem(key) { return key === DEMO_STORAGE_KEY ? stored : null },
    setItem(key, next) { if (key === DEMO_STORAGE_KEY) stored = next },
    read() { return stored },
  }
}

test('all quick destinations resolve to one valid local coordinate source', () => {
  for (const destination of quickDestinations) {
    const location = findDemoLocation(destination.address)
    assert.ok(location, `missing demo zone for ${destination.address}`)
    const mapLocation = getMapLocationForZone(location.zoneId)
    assert.ok(mapLocation, `missing map coordinates for ${destination.address}`)
    assert.ok(mapLocation.lat >= -24 && mapLocation.lat <= -23)
    assert.ok(mapLocation.lng >= -65 && mapLocation.lng <= -64)
  }
  assert.equal(new Set(DEMO_MAP_LOCATIONS.map(({ zoneId }) => zoneId)).size, DEMO_MAP_LOCATIONS.length)
  for (const driverLocation of Object.values(DEMO_DRIVER_LOCATIONS)) {
    assert.ok(Number.isFinite(driverLocation.lat) && Number.isFinite(driverLocation.lng))
  }
})

test('precomputed Centro to Terminal route follows multiple road points', () => {
  const route = getDemoRouteGeometry('centro', 'terminal')
  assert.ok(route && route.length > 2)
  assert.ok(route.every(([lat, lng]) => Number.isFinite(lat) && Number.isFinite(lng)))
  assert.equal(route[0][0], -23.817973)
  assert.ok(DEMO_ROUTE_FIXTURES['centro:terminal'])
})

test('precomputed route fixtures include the presentation destinations and driver approach routes', () => {
  for (const destination of ['terminal', 'hospital', 'unju', 'calilegua']) {
    assert.ok(getDemoRouteGeometry('centro', destination), `missing Centro → ${destination}`)
  }
  assert.ok(getDriverApproachGeometry('driver-b', 'centro'))
  assert.equal(getDemoRouteGeometry('unknown', 'terminal'), null)
  assert.equal(getDriverApproachGeometry('driver-b', 'unju'), null)
})

test('missing geometry is represented safely without a runtime routing call', () => {
  assert.equal(getDemoRouteGeometry('hospital', 'terminal'), null)
  assert.equal(getDemoRouteGeometry(null, 'terminal'), null)
})

test('debug panel is hidden unless debug=1 and destination query parses alongside it', () => {
  assert.equal(isDemoDebugEnabled(''), false)
  assert.equal(isDemoDebugEnabled('?debug=0'), false)
  assert.equal(isDemoDebugEnabled('?destino=Terminal'), false)
  assert.equal(isDemoDebugEnabled('?destino=Terminal&debug=1'), true)
  assert.equal(getDestinationFromSearch('?destino=Terminal&debug=1'), 'Terminal')
})

test('valid versioned demo state rehydrates from local storage', () => {
  const state = demoReducer(initialState(), { type: 'REQUEST_TRIP' })
  const storage = memoryStorage()
  persistDemoState(state, storage)
  assert.deepEqual(loadDemoState(initialState, storage), state)
})

test('corrupt or structurally invalid storage falls back to initial fixtures', () => {
  const initial = initialState()
  assert.deepEqual(loadDemoState(initialState, memoryStorage('{broken')), initial)
  assert.deepEqual(loadDemoState(initialState, memoryStorage(JSON.stringify({ version: 2, state: initial }))), initial)
  assert.deepEqual(loadDemoState(initialState, memoryStorage(JSON.stringify({ version: 1, state: { ...initial, drivers: 'invalid' } }))), initial)
})

test('reset returns persisted scenario to fixtures and driver identity is never persisted', () => {
  const storage = memoryStorage()
  const initial = initialState()
  const changed = demoReducer(initial, { type: 'REQUEST_TRIP' })
  const reset = demoReducer(changed, { type: 'RESET_DEMO', initialState: initial })
  persistDemoState(reset, storage)
  assert.deepEqual(loadDemoState(initialState, storage), initial)
  const saved = JSON.parse(storage.read())
  assert.equal(saved.version, 1)
  assert.equal('selectedDriverId' in saved.state, false)
})
