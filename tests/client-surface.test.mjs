import test from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { CLIENT_PATHS, isClientPath, resolveClientRedirect } from '../src/client-app/domain/client-routes.ts'
import {
  canClientCancel, CLIENT_TRIP_STATUS_TEXT, clientReducer, getMockDelayMs, initialClientState, MOCK_STATUS_DURATION_MS,
} from '../src/client-app/domain/client-state.ts'
import { filterReferencePoints, findReferencePoint, PILOT_ZONES, placeFromMapPoint, REFERENCE_POINTS } from '../src/client-app/domain/places.ts'
import { FARE_SOURCE, formatPesos, quoteMockFare } from '../src/client-app/domain/fare.ts'
import { registerClientWithMock, signInWithMock } from '../src/client-app/domain/auth.ts'
import { CLIENT_STORAGE_KEY, loadClientState, parseClientState, persistClientState, serializeClientState } from '../src/client-app/domain/client-storage.ts'

const root = fileURLToPath(new URL('..', import.meta.url))
const read = (path) => readFileSync(join(root, path), 'utf8')

function clientSourceFiles(dir = join(root, 'src/client-app')) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    return statSync(path).isDirectory() ? clientSourceFiles(path) : /\.(ts|tsx|css)$/.test(name) ? [path] : []
  })
}

// Source code without comments: the scope rules apply to what the app does and shows.
const clientSources = clientSourceFiles().map((path) => ({
  path,
  code: readFileSync(path, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, ''),
}))

const anonymous = { authenticated: false, tripStatus: null, hasPickup: false, hasDestination: false }
const signedIn = { ...anonymous, authenticated: true }
const session = { role: 'CLIENT', displayName: 'Ana Gómez', phone: '3884123456', identifier: '3884123456' }
const terminal = findReferencePoint('ref-terminal')
const centro = findReferencePoint('ref-centro')

function signedInState() {
  return clientReducer(initialClientState, { type: 'SIGN_IN', session })
}

function requestedState(now = 1000) {
  let state = signedInState()
  state = clientReducer(state, { type: 'SET_PICKUP', place: centro })
  state = clientReducer(state, { type: 'SET_DESTINATION', place: terminal })
  const fare = quoteMockFare(centro.zoneId, terminal.zoneId)
  return clientReducer(state, { type: 'REQUEST_TRIP', fareAmount: fare.amount, fareFormatted: fare.formatted, now })
}

function advance(state, now) {
  return clientReducer(state, { type: 'ADVANCE_MOCK_TRIP', now })
}

test('CLIENT_TARGET_STARTS_IN_CLIENT: client mode builds and syncs the client root only', () => {
  const pkg = JSON.parse(read('package.json'))
  const main = read('src/main.tsx')
  const viteConfig = read('vite.config.ts')
  assert.match(pkg.scripts['build:client'], /vite build --mode client/)
  assert.match(pkg.scripts['android:sync:client'], /npm run build:client && cap sync android/)
  for (const [name, script] of Object.entries(pkg.scripts)) {
    if (/\bcap (sync|copy)\b/.test(script)) assert.match(script, /build:client/, `${name} must package the client target`)
  }
  assert.match(viteConfig, /mode === 'client' \? 'client' : 'prototype'/)
  assert.match(main, /VITE_APP_TARGET === 'client'\s*\?\s*\(\) => import\('\.\/client-app\/ClientApp'\)/)
  assert.equal(resolveClientRedirect('/', anonymous), CLIENT_PATHS.login)
  assert.equal(resolveClientRedirect('/', signedIn), CLIENT_PATHS.home)
})

test('DRIVER_ROUTE_ACCESSIBLE=NO and CENTRAL_ROUTE_ACCESSIBLE=NO: prototype routes resolve to the client entry', () => {
  const foreign = ['/demo', '/chofer', '/chofer/', '/chofer/viaje', '/chofer/solicitud', '/central', '/central/viajes', '/central/flota', '/cliente', '/cliente/viajes']
  for (const path of foreign) {
    assert.equal(isClientPath(path), false, path)
    assert.equal(resolveClientRedirect(path, anonymous), '/', path)
    assert.equal(resolveClientRedirect(path, signedIn), '/', path)
  }
})

test('DEMO_VISIBLE=NO and ROLE_SELECTOR_VISIBLE=NO: client code never touches prototype modules or demo controls', () => {
  const forbiddenImports = /from '\.\.?\/(\.\.\/)*(App|components|mock-data|client-flow|demo|driver|central|presentation|prototype-root)[/']/
  const forbiddenUi = /DemoRoleSwitcher|DemoPanel|DemoLanding|useDemo|Vista demo|Cambiar rol|RESET|debug|Modo demo|PROTOTIPO|Prototipo/
  for (const { path, code } of clientSources) {
    assert.doesNotMatch(code, forbiddenImports, path)
    assert.doesNotMatch(code, forbiddenUi, path)
    assert.doesNotMatch(code, /\bDRIVER\b|['"]CENTRAL['"]|['"]ADMIN['"]/, `${path} must not reference other roles`)
  }
})

test('public registration has no role input and always yields a CLIENT session', () => {
  const result = registerClientWithMock({ fullName: '  Ana   Gómez ', phone: '388 412-3456', password: 'secreto1', passwordConfirmation: 'secreto1', role: 'DRIVER' })
  assert.equal(result.ok, true)
  assert.deepEqual(result.session, { role: 'CLIENT', displayName: 'Ana Gómez', phone: '3884123456', identifier: '3884123456' })
  const state = clientReducer(initialClientState, { type: 'SIGN_IN', session: { ...session, role: 'DRIVER' } })
  assert.equal(state.session.role, 'CLIENT')
  const register = read('src/client-app/screens/AuthScreens.tsx')
  assert.doesNotMatch(register, /chofer|conductor|\brol\b|tipo de cuenta/i)
})

test('mock login and registration validate input and never keep the password', () => {
  assert.equal(signInWithMock({ identifier: '', password: '' }).ok, false)
  assert.ok(signInWithMock({ identifier: '388 41', password: 'secreto1' }).errors.identifier)
  assert.ok(signInWithMock({ identifier: 'ana', password: '123' }).errors.password)
  const login = signInWithMock({ identifier: '388 412 3456', password: 'secreto1' })
  assert.equal(login.ok, true)
  assert.equal(login.session.role, 'CLIENT')
  assert.equal(login.session.phone, '3884123456')
  const failed = registerClientWithMock({ fullName: 'A', phone: '12', password: '123', passwordConfirmation: '456' })
  assert.deepEqual(Object.keys(failed.errors).sort(), ['fullName', 'password', 'passwordConfirmation', 'phone'])
  const serialized = serializeClientState(requestedState())
  assert.doesNotMatch(serialized, /password|secreto/i)
})

test('SAVED_LOCATIONS, FAVORITES and RECENT_DESTINATIONS are not part of the client surface', () => {
  const outOfScope = /\bCasa\b|\bTrabajo\b|favorit|guardad|reciente|frecuente|historial|quickDestinations|recentDestinations|tripHistory|savedPlaces/i
  for (const { path, code } of clientSources) assert.doesNotMatch(code, outOfScope, path)
  for (const place of REFERENCE_POINTS) assert.doesNotMatch(place.label, /casa|trabajo/i)
  const stored = JSON.parse(serializeClientState(requestedState()))
  assert.deepEqual(Object.keys(stored).sort(), ['draft', 'session', 'trip', 'version'])
})

test('CLIENT_CAN_SET_PICKUP and CLIENT_CAN_SET_DESTINATION from the list or by tapping the map', () => {
  let state = signedInState()
  state = clientReducer(state, { type: 'SET_PICKUP', place: centro })
  assert.equal(state.draft.pickup.id, 'ref-centro')
  const tapped = placeFromMapPoint(-23.8105, -64.7880)
  assert.equal(tapped.ok, true)
  assert.equal(tapped.place.source, 'MAP_POINT')
  assert.equal(tapped.place.zoneId, 'terminal')
  state = clientReducer(state, { type: 'SET_DESTINATION', place: tapped.place })
  assert.equal(state.draft.destination.zoneId, 'terminal')
  assert.deepEqual(placeFromMapPoint(-24.2, -65.3), { ok: false, reason: 'OUTSIDE_SERVICE_AREA' })
  assert.deepEqual(filterReferencePoints('omnibus').map((place) => place.id), ['ref-terminal'])
  assert.equal(filterReferencePoints('').length, REFERENCE_POINTS.length)
  assert.equal(clientReducer(initialClientState, { type: 'SET_PICKUP', place: centro }).draft.pickup, null)
})

test('CLIENT_CAN_SEE_MOCK_FARE: every zone pair has a local mock fare', () => {
  for (const from of PILOT_ZONES) for (const to of PILOT_ZONES) {
    const quote = quoteMockFare(from.id, to.id)
    assert.equal(quote.source, FARE_SOURCE)
    assert.ok(quote.amount > 0)
    assert.equal(quote.formatted, formatPesos(quote.amount))
    assert.equal(quoteMockFare(to.id, from.id).amount, quote.amount)
  }
  assert.equal(quoteMockFare('centro', 'terminal').formatted, '$2.500')
  assert.equal(formatPesos(12500), '$12.500')
})

test('CLIENT_CAN_REQUEST_MOCK_RIDE and CLIENT_CAN_SEE_SEARCHING_STATE', () => {
  const state = requestedState(1000)
  assert.equal(state.trip.status, 'REQUESTED')
  assert.equal(state.trip.fareFormatted, '$2.500')
  assert.equal(state.trip.driver, null)
  assert.equal(CLIENT_TRIP_STATUS_TEXT.REQUESTED.title, 'Buscando un chofer disponible…')
  assert.equal(getMockDelayMs(state.trip, 1000), MOCK_STATUS_DURATION_MS.REQUESTED)
  assert.equal(resolveClientRedirect(CLIENT_PATHS.home, { ...signedIn, tripStatus: 'REQUESTED', hasPickup: true, hasDestination: true }), CLIENT_PATHS.trip)
  const again = clientReducer(state, { type: 'REQUEST_TRIP', fareAmount: 1, fareFormatted: '$1', now: 2000 })
  assert.equal(again.trip.id, state.trip.id)
  let incomplete = clientReducer(signedInState(), { type: 'SET_PICKUP', place: centro })
  incomplete = clientReducer(incomplete, { type: 'REQUEST_TRIP', fareAmount: 2500, fareFormatted: '$2.500', now: 1 })
  assert.equal(incomplete.trip, null)
})

test('accepted state and the basic mock trip states up to completion', () => {
  let state = requestedState(0)
  state = advance(state, 5000)
  assert.equal(state.trip.status, 'ASSIGNED')
  assert.equal(CLIENT_TRIP_STATUS_TEXT.ASSIGNED.title, 'Tu viaje fue aceptado')
  assert.ok(state.trip.driver.name && state.trip.driver.plate && state.trip.driver.mobile)
  const seen = ['REQUESTED', 'ASSIGNED']
  for (let now = 6000; state.trip.status !== 'COMPLETED'; now += 1000) {
    state = advance(state, now)
    seen.push(state.trip.status)
  }
  assert.deepEqual(seen, ['REQUESTED', 'ASSIGNED', 'DRIVER_EN_ROUTE', 'ARRIVED', 'IN_PROGRESS', 'COMPLETED'])
  assert.equal(getMockDelayMs(state.trip, 99999), null)
  assert.equal(advance(state, 100000).trip.status, 'COMPLETED')
  state = clientReducer(state, { type: 'FINISH_TRIP' })
  assert.equal(state.trip, null)
  assert.deepEqual(state.draft, { pickup: null, destination: null })
})

test('client may cancel through ARRIVED but not once IN_PROGRESS', () => {
  assert.deepEqual(['REQUESTED', 'ASSIGNED', 'DRIVER_EN_ROUTE', 'ARRIVED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'].map(canClientCancel), [true, true, true, true, false, false, false])
  let state = requestedState(0)
  for (const expected of ['ASSIGNED', 'DRIVER_EN_ROUTE', 'ARRIVED']) {
    state = advance(state, 1)
    assert.equal(state.trip.status, expected)
    assert.equal(clientReducer(state, { type: 'CANCEL_TRIP', now: 2 }).trip.status, 'CANCELLED')
  }
  state = advance(state, 3)
  assert.equal(state.trip.status, 'IN_PROGRESS')
  assert.equal(clientReducer(state, { type: 'CANCEL_TRIP', now: 4 }).trip.status, 'IN_PROGRESS')
  assert.equal(clientReducer(state, { type: 'FINISH_TRIP' }).trip.status, 'IN_PROGRESS')
})

test('trip states are shown in natural Spanish, never as technical names', () => {
  for (const [status, text] of Object.entries(CLIENT_TRIP_STATUS_TEXT)) {
    for (const value of [text.label, text.title]) {
      assert.ok(value.length > 0)
      assert.doesNotMatch(value, /[A-Z]{2,}_|_[A-Z]{2,}/)
      assert.notEqual(value, status)
    }
  }
  assert.equal(CLIENT_TRIP_STATUS_TEXT.DRIVER_EN_ROUTE.title, 'Tu chofer está en camino')
  assert.equal(CLIENT_TRIP_STATUS_TEXT.CANCELLED.title, 'Viaje cancelado')
})

test('client route guard keeps the flow in order', () => {
  assert.equal(resolveClientRedirect(CLIENT_PATHS.home, anonymous), CLIENT_PATHS.login)
  assert.equal(resolveClientRedirect(CLIENT_PATHS.login, anonymous), null)
  assert.equal(resolveClientRedirect(CLIENT_PATHS.register, signedIn), CLIENT_PATHS.home)
  assert.equal(resolveClientRedirect(CLIENT_PATHS.destination, signedIn), CLIENT_PATHS.pickup)
  assert.equal(resolveClientRedirect(CLIENT_PATHS.confirm, { ...signedIn, hasPickup: true }), CLIENT_PATHS.destination)
  assert.equal(resolveClientRedirect(CLIENT_PATHS.confirm, { ...signedIn, hasPickup: true, hasDestination: true }), null)
  assert.equal(resolveClientRedirect(CLIENT_PATHS.trip, signedIn), CLIENT_PATHS.home)
  assert.equal(resolveClientRedirect('/', { ...signedIn, tripStatus: 'COMPLETED' }), CLIENT_PATHS.trip)
})

test('client session and current trip persist locally without passwords; invalid data is ignored', () => {
  const memory = new Map()
  const storage = { getItem: (key) => memory.get(key) ?? null, setItem: (key, value) => memory.set(key, value), removeItem: (key) => memory.delete(key) }
  const state = requestedState(1234)
  persistClientState(state, storage)
  assert.deepEqual(loadClientState(initialClientState, storage), state)
  persistClientState(initialClientState, storage)
  assert.equal(memory.has(CLIENT_STORAGE_KEY), false)
  assert.equal(parseClientState('{bad json', initialClientState), initialClientState)
  assert.equal(parseClientState(JSON.stringify({ version: 1, session: { ...session, role: 'DRIVER' } }), initialClientState), initialClientState)
})
