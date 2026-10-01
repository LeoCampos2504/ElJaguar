import type { ClientTripStatus } from './client-state'

// Client Android target routing. Only these paths exist; anything else,
// including the prototype's /demo, /cliente/*, /chofer/* and /central/*,
// resolves to the client entry.

export const CLIENT_PATHS = {
  entry: '/',
  login: '/ingresar',
  register: '/registrarme',
  home: '/inicio',
  pickup: '/pedir/origen',
  destination: '/pedir/destino',
  confirm: '/pedir/confirmar',
  trip: '/viaje',
} as const

export type ClientPath = typeof CLIENT_PATHS[keyof typeof CLIENT_PATHS]

export type ClientRouteContext = {
  authenticated: boolean
  tripStatus: ClientTripStatus | null
  hasPickup: boolean
  hasDestination: boolean
}

const PUBLIC_PATHS: readonly string[] = [CLIENT_PATHS.login, CLIENT_PATHS.register]
const KNOWN_PATHS: readonly string[] = Object.values(CLIENT_PATHS)

export function normalizePath(pathname: string): string {
  const trimmed = pathname.replace(/\/+$/, '')
  return trimmed === '' ? '/' : trimmed
}

export function isClientPath(pathname: string): boolean {
  return KNOWN_PATHS.includes(normalizePath(pathname))
}

export function getClientEntryPath(context: ClientRouteContext): ClientPath {
  if (!context.authenticated) return CLIENT_PATHS.login
  if (context.tripStatus) return CLIENT_PATHS.trip
  return CLIENT_PATHS.home
}

// Returns the path to redirect to, or null when the current path may render.
export function resolveClientRedirect(pathname: string, context: ClientRouteContext): string | null {
  const path = normalizePath(pathname)
  if (!KNOWN_PATHS.includes(path)) return CLIENT_PATHS.entry
  if (path === CLIENT_PATHS.entry) return getClientEntryPath(context)
  if (PUBLIC_PATHS.includes(path)) return context.authenticated ? getClientEntryPath(context) : null
  if (!context.authenticated) return CLIENT_PATHS.login
  if (context.tripStatus) return path === CLIENT_PATHS.trip ? null : CLIENT_PATHS.trip
  if (path === CLIENT_PATHS.trip) return CLIENT_PATHS.home
  if (path === CLIENT_PATHS.destination && !context.hasPickup) return CLIENT_PATHS.pickup
  if (path === CLIENT_PATHS.confirm) {
    if (!context.hasPickup) return CLIENT_PATHS.pickup
    if (!context.hasDestination) return CLIENT_PATHS.destination
  }
  return null
}
