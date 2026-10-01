// Pickup/destination selection for the CURRENT trip only.
// Pilot scope: no saved, favorite or recent locations. A TripPlace lives inside
// the trip draft and is discarded when the trip ends.
//
// Every place carries its `source`, so real device geolocation can later produce
// a TripPlace with source 'DEVICE_LOCATION' without redesigning the flow.

export type TripPlaceSource = 'REFERENCE_POINT' | 'MAP_POINT'

export type TripPlace = {
  id: string
  label: string
  detail: string
  zoneId: string
  lat: number
  lng: number
  source: TripPlaceSource
}

export type PilotZone = {
  id: string
  name: string
  lat: number
  lng: number
}

// Mock service zones. Coordinates were checked against OpenStreetMap/Nominatim
// on 2026-09-27 (same reference points as the presentation prototype map).
export const PILOT_ZONES: readonly PilotZone[] = [
  { id: 'centro', name: 'Centro', lat: -23.8179733, lng: -64.7926023 },
  { id: 'terminal', name: 'Terminal', lat: -23.8101792, lng: -64.7878292 },
  { id: 'unju', name: 'Zona UNJu', lat: -23.8097158, lng: -64.7922565 },
  { id: 'hospital', name: 'Zona Hospital', lat: -23.8341777, lng: -64.7909103 },
  { id: 'barrio-ledesma', name: 'Barrio Ledesma', lat: -23.8306711, lng: -64.7911543 },
  { id: 'calilegua', name: 'Calilegua', lat: -23.774232, lng: -64.7701918 },
]

// Fixed public reference points offered as a list. They are the same for every
// user and are not personalized in any way.
export const REFERENCE_POINTS: readonly TripPlace[] = [
  { id: 'ref-centro', label: 'Centro · Av. Libertad', detail: 'Libertador General San Martín', zoneId: 'centro', lat: -23.8179733, lng: -64.7926023, source: 'REFERENCE_POINT' },
  { id: 'ref-terminal', label: 'Terminal de Ómnibus', detail: 'Libertador General San Martín', zoneId: 'terminal', lat: -23.8101792, lng: -64.7878292, source: 'REFERENCE_POINT' },
  { id: 'ref-unju', label: 'UNJu · Sede Libertador', detail: 'Mariano Moreno 1368', zoneId: 'unju', lat: -23.8097158, lng: -64.7922565, source: 'REFERENCE_POINT' },
  { id: 'ref-hospital', label: 'Hospital O. Orías', detail: 'Libertador General San Martín', zoneId: 'hospital', lat: -23.8341777, lng: -64.7909103, source: 'REFERENCE_POINT' },
  { id: 'ref-barrio-ledesma', label: 'Barrio Ledesma', detail: 'Libertador General San Martín', zoneId: 'barrio-ledesma', lat: -23.8306711, lng: -64.7911543, source: 'REFERENCE_POINT' },
  { id: 'ref-calilegua', label: 'Calilegua', detail: 'Centro de Calilegua', zoneId: 'calilegua', lat: -23.774232, lng: -64.7701918, source: 'REFERENCE_POINT' },
]

export const SERVICE_AREA_CENTER: readonly [number, number] = [-23.8095, -64.7855]

// A map point is accepted only if it is within this distance of a zone center.
export const MAX_DISTANCE_TO_ZONE_METERS = 2500

export function distanceMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const toRad = (value: number) => value * Math.PI / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * 6371000 * Math.asin(Math.sqrt(h))
}

export function getZone(zoneId: string): PilotZone | null {
  return PILOT_ZONES.find((zone) => zone.id === zoneId) ?? null
}

export function findReferencePoint(id: string): TripPlace | null {
  return REFERENCE_POINTS.find((place) => place.id === id) ?? null
}

function normalize(value: string): string {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLocaleLowerCase('es').trim()
}

export function filterReferencePoints(query: string): TripPlace[] {
  const needle = normalize(query)
  if (!needle) return [...REFERENCE_POINTS]
  return REFERENCE_POINTS.filter((place) => normalize(`${place.label} ${place.detail}`).includes(needle))
}

export type MapPointResult =
  | { ok: true; place: TripPlace }
  | { ok: false; reason: 'OUTSIDE_SERVICE_AREA' }

export function placeFromMapPoint(lat: number, lng: number): MapPointResult {
  let nearest: PilotZone | null = null
  let nearestDistance = Number.POSITIVE_INFINITY
  for (const zone of PILOT_ZONES) {
    const distance = distanceMeters({ lat, lng }, zone)
    if (distance < nearestDistance) {
      nearest = zone
      nearestDistance = distance
    }
  }
  if (!nearest || nearestDistance > MAX_DISTANCE_TO_ZONE_METERS) return { ok: false, reason: 'OUTSIDE_SERVICE_AREA' }
  return {
    ok: true,
    place: {
      id: `map-${lat.toFixed(5)},${lng.toFixed(5)}`,
      label: 'Punto marcado en el mapa',
      detail: `Cerca de ${nearest.name}`,
      zoneId: nearest.id,
      lat: Number(lat.toFixed(6)),
      lng: Number(lng.toFixed(6)),
      source: 'MAP_POINT',
    },
  }
}

export function isSamePlace(a: TripPlace | null, b: TripPlace | null): boolean {
  if (!a || !b) return false
  return a.id === b.id || distanceMeters(a, b) < 30
}
