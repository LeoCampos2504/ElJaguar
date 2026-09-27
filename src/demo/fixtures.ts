import { customer, driver as originalDriver, fares as originalFares, tripHistory as originalTripHistory } from '../mock-data'
import type { DemoDriver, DemoFare, DemoLocation, DemoState, DemoTrip, DemoVehicle, DemoZone } from './types'

export const demoPassenger = {
  id: 'passenger-leonardo',
  name: customer.name,
  phone: customer.phone,
  homeAddress: customer.address,
} as const

export const demoZones: DemoZone[] = [
  { id: 'centro', name: 'Centro / Av. Libertad' },
  { id: 'terminal', name: 'Terminal de Ómnibus' },
  { id: 'hospital', name: 'Hospital O. Orías' },
  { id: 'barrio-ledesma', name: 'Barrio Ledesma' },
  { id: 'libertador', name: 'Libertador General San Martín' },
  { id: 'calilegua', name: 'Calilegua' },
  { id: 'unju', name: 'UNJu - Sede Libertador' },
]

export const demoVehicles: DemoVehicle[] = [
  { id: 'vehicle-07', make: 'Toyota', model: 'Etios', plate: originalDriver.vehicle.plate, color: 'Blanco', mobile: '07' },
  { id: 'vehicle-03', make: 'Fiat', model: 'Cronos', plate: 'AC456EF', color: 'Gris', mobile: '03' },
  { id: 'vehicle-11', make: 'Renault', model: 'Logan', plate: 'AE789GH', color: 'Negro', mobile: '11' },
  { id: 'vehicle-09', make: 'Chevrolet', model: 'Onix', plate: 'AF234JK', color: 'Azul', mobile: '09' },
]

export const demoDrivers: DemoDriver[] = [
  { id: 'driver-a', name: originalDriver.name, vehicleId: 'vehicle-07', color: '#1769e8', availability: 'AVAILABLE', distanceMeters: 450, locationLabel: 'Av. Libertad y Belgrano' },
  { id: 'driver-b', name: 'María Ríos', vehicleId: 'vehicle-03', color: '#805ad5', availability: 'AVAILABLE', distanceMeters: 900, locationLabel: 'Terminal de Ómnibus' },
  { id: 'driver-c', name: 'Jorge Cruz', vehicleId: 'vehicle-11', color: '#16a36a', availability: 'UNAVAILABLE', distanceMeters: 300, locationLabel: 'UNJu - Sede Libertador' },
  { id: 'driver-d', name: 'Lucía López', vehicleId: 'vehicle-09', color: '#e88720', availability: 'AVAILABLE', distanceMeters: 1400, locationLabel: 'Acceso a Calilegua' },
]

const zoneIdsByLegacyName: Record<string, string> = {
  Centro: 'centro',
  Terminal: 'terminal',
  'Hospital O. Orías': 'hospital',
  'Barrio Ledesma': 'barrio-ledesma',
  Libertador: 'libertador',
  Calilegua: 'calilegua',
  UNJu: 'unju',
}

export const demoFares: DemoFare[] = originalFares.map((fare) => ({
  id: fare.id,
  originZoneId: zoneIdsByLegacyName[fare.originZone],
  destinationZoneId: zoneIdsByLegacyName[fare.destinationZone],
  price: fare.price,
}))

const locationForLegacyAddress = (address: string): DemoLocation => {
  const lower = address.toLowerCase()
  if (lower.includes('terminal')) return { zoneId: 'terminal', label: address }
  if (lower.includes('hospital')) return { zoneId: 'hospital', label: address }
  if (lower.includes('calilegua')) return { zoneId: 'calilegua', label: address }
  if (lower.includes('unju')) return { zoneId: 'unju', label: address }
  if (lower.includes('ledesma')) return { zoneId: 'barrio-ledesma', label: address }
  if (lower.includes('libertador')) return { zoneId: 'libertador', label: address }
  return { zoneId: 'centro', label: address }
}

const legacyStatus = (status: string): DemoTrip['status'] => {
  if (status === 'completed') return 'COMPLETED'
  if (status === 'cancelled') return 'CANCELLED'
  if (status === 'assigned') return 'ASSIGNED'
  if (status === 'arrived') return 'ARRIVED'
  if (status === 'in-progress') return 'IN_PROGRESS'
  return 'REQUESTED'
}

const legacyHistory: DemoTrip[] = originalTripHistory.map((trip, index) => {
  const driverMatch = demoDrivers.find((item) => item.name === trip.driver)
  const vehicleMatch = demoVehicles.find((item) => item.id === driverMatch?.vehicleId)
  return {
    id: trip.id,
    sequence: index + 1,
    passengerId: demoPassenger.id,
    passengerDisplayName: demoPassenger.name,
    contactPhone: demoPassenger.phone,
    source: 'APP',
    origin: locationForLegacyAddress(trip.origin),
    destination: locationForLegacyAddress(trip.destination),
    fareId: demoFares.find((fare) =>
      fare.originZoneId === locationForLegacyAddress(trip.origin).zoneId
      && fare.destinationZoneId === locationForLegacyAddress(trip.destination).zoneId,
    )?.id ?? null,
    price: trip.price,
    status: legacyStatus(trip.status),
    driverId: driverMatch?.id ?? null,
    vehicleId: vehicleMatch?.id ?? null,
  }
})

export function createInitialDemoState(): DemoState {
  const vehicles = demoVehicles.map((vehicle) => ({ ...vehicle }))
  const drivers = demoDrivers.map((item) => ({ ...item }))
  const fares = demoFares.map((fare) => ({ ...fare }))
  return {
    passenger: { ...demoPassenger },
    drivers,
    vehicles,
    zones: demoZones.map((zone) => ({ ...zone })),
    fares,
    selectedOrigin: { zoneId: 'centro', label: customer.address },
    selectedDestination: null,
    activeTrip: null,
    currentOffer: null,
    offers: [],
    dispatch: { status: 'IDLE', candidateDriverIds: [], attemptedDriverIds: [], currentOfferId: null },
    tripHistory: legacyHistory.map((trip) => ({ ...trip, origin: { ...trip.origin }, destination: { ...trip.destination } })),
    nextTripNumber: 1,
    nextOfferNumber: 1,
  }
}
