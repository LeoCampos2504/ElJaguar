export type DemoMapLocation = {
  id: string
  zoneId: string
  label: string
  lat: number
  lng: number
  sourceNote?: string
}

export type MapPoint = [lat: number, lng: number]

// Coordinates were checked against OpenStreetMap/Nominatim on 2026-09-27.
// For the UNJu demo destination, the mapped reference is Escuela Técnica
// Herminio Arrieta (Mariano Moreno 1368), the address published by UNJu for
// its Libertador classroom extension; it is explicitly a demo reference.
export const DEMO_MAP_LOCATIONS: DemoMapLocation[] = [
  { id: 'centro', zoneId: 'centro', label: 'Centro / Av. Libertad', lat: -23.8179733, lng: -64.7926023 },
  { id: 'terminal', zoneId: 'terminal', label: 'Terminal de Ómnibus', lat: -23.8101792, lng: -64.7878292 },
  { id: 'hospital', zoneId: 'hospital', label: 'Hospital O. Orías', lat: -23.8341777, lng: -64.7909103 },
  { id: 'barrio-ledesma', zoneId: 'barrio-ledesma', label: 'Barrio Ledesma', lat: -23.8306711, lng: -64.7911543 },
  { id: 'libertador', zoneId: 'libertador', label: 'Libertador General San Martín', lat: -23.8093358, lng: -64.7921741 },
  { id: 'calilegua', zoneId: 'calilegua', label: 'Calilegua', lat: -23.774232, lng: -64.7701918 },
  { id: 'unju', zoneId: 'unju', label: 'UNJu - Sede Libertador', lat: -23.8097158, lng: -64.7922565, sourceNote: 'Punto demo en ETHA, Mariano Moreno 1368' },
]

export const DEMO_DRIVER_LOCATIONS: Record<string, DemoMapLocation> = {
  'driver-a': { id: 'driver-a-location', zoneId: 'centro', label: 'Av. Libertad y Belgrano · punto demo', lat: -23.8130749, lng: -64.7895974 },
  'driver-b': { id: 'driver-b-location', zoneId: 'terminal', label: 'Terminal de Ómnibus', lat: -23.8101792, lng: -64.7878292 },
  'driver-c': { id: 'driver-c-location', zoneId: 'unju', label: 'UNJu · punto demo', lat: -23.8097158, lng: -64.7922565 },
  'driver-d': { id: 'driver-d-location', zoneId: 'calilegua', label: 'Acceso a Calilegua · punto demo', lat: -23.774232, lng: -64.7701918 },
}

export function getMapLocationForZone(zoneId: string | null | undefined): DemoMapLocation | null {
  return DEMO_MAP_LOCATIONS.find((location) => location.zoneId === zoneId) ?? null
}

export function getMapLocationForLabel(label: string | null | undefined): DemoMapLocation | null {
  if (!label) return null
  const normalized = label.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es')
  return DEMO_MAP_LOCATIONS.find((location) => {
    const candidate = location.label.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es')
    return normalized.includes(candidate) || candidate.includes(normalized)
  }) ?? null
}
