// FARE_SOURCE=MOCK_LOCAL
// Simulated zonal fare for validating the client experience only. It is not
// the real fare administration: no kilometre, dynamic, surge or traffic
// pricing, and no external pricing service.

export const FARE_SOURCE = 'MOCK_LOCAL' as const

const SAME_ZONE_PESOS = 1500
const URBAN_PESOS = 2200
const CALILEGUA_PESOS = 4000

// Pairs taken from the prototype's zonal fare table; other pairs use the rules below.
const EXPLICIT_PAIRS: Record<string, number> = {
  'centro:terminal': 2500,
  'centro:hospital': 1800,
  'barrio-ledesma:calilegua': 3200,
}

export type MockFareQuote = {
  source: typeof FARE_SOURCE
  amount: number
  formatted: string
}

export function formatPesos(amount: number): string {
  return `$${Math.round(amount).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`
}

export function quoteMockFare(pickupZoneId: string, destinationZoneId: string): MockFareQuote {
  const key = [pickupZoneId, destinationZoneId].sort().join(':')
  let amount: number
  if (pickupZoneId === destinationZoneId) amount = SAME_ZONE_PESOS
  else if (EXPLICIT_PAIRS[key] !== undefined) amount = EXPLICIT_PAIRS[key]
  else if (pickupZoneId === 'calilegua' || destinationZoneId === 'calilegua') amount = CALILEGUA_PESOS
  else amount = URBAN_PESOS
  return { source: FARE_SOURCE, amount, formatted: formatPesos(amount) }
}
