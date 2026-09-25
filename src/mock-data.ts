import type { Customer, Driver, Fare, FareVersion, Trip } from './types'

export const customer: Customer = {
  name: 'Leonardo',
  phone: '+54 388 555 0142',
  address: 'Av. Libertad 450, Libertador G. S. M.',
}

export const driver: Driver = {
  name: 'Carlos Pérez',
  vehicle: { model: 'Toyota Etios', plate: 'AB123CD', mobile: '07' },
}

export const tripMock = {
  origin: 'Av. Libertad 450',
  originFull: 'Av. Libertad 450, Libertador G. S. M.',
  destination: 'Terminal de Ómnibus',
  price: '$2.500',
  payment: 'Efectivo o Mercado Pago',
  arrival: '3 min',
  duration: '12 min',
  zoneLabel: 'Centro → Terminal',
}

export const fareVersion: FareVersion = {
  version: '2026.09',
  effectiveFrom: '25/09/2026',
  notice: 'Desde el 25/09/2026 se encuentra vigente un nuevo cuadro tarifario.',
}

export const fares: Fare[] = [
  { id: 'centro-terminal', originZone: 'Centro', destinationZone: 'Terminal', price: '$2.500' },
  { id: 'centro-hospital', originZone: 'Centro', destinationZone: 'Hospital O. Orías', price: '$1.800' },
  { id: 'ledesma-calilegua', originZone: 'Barrio Ledesma', destinationZone: 'Calilegua', price: '$3.200' },
  { id: 'libertador-calilegua', originZone: 'Libertador', destinationZone: 'Calilegua', price: '$4.000' },
]

export const quickDestinations = [
  { label: 'Casa', address: 'Av. Libertad 450', icon: 'home' as const },
  { label: 'Trabajo', address: 'UNJu - Sede Libertador', icon: 'briefcase' as const },
  { label: 'Terminal', address: 'Terminal de Ómnibus', icon: 'bus' as const },
  { label: 'Calilegua', address: 'Calilegua', icon: 'map-pin' as const },
]

export const recentDestinations = [
  'Terminal de Ómnibus',
  'Hospital O. Orías',
  'Calilegua',
  'UNJu - Sede Libertador',
  'Centro',
]

export const tripHistory: Trip[] = [
  {
    id: 'trip-01', date: '25 sep 2026', time: '09:42', origin: 'Av. Libertad 450', destination: 'Terminal de Ómnibus',
    driver: 'Carlos Pérez', vehicle: 'Toyota Etios', plate: 'AB123CD', mobile: '07', price: '$2.500', payment: 'Efectivo', status: 'completed', duration: '12 min',
  },
  {
    id: 'trip-02', date: '22 sep 2026', time: '18:10', origin: 'UNJu - Sede Libertador', destination: 'Av. Libertad 450',
    driver: 'María Ríos', vehicle: 'Fiat Cronos', plate: 'AC456EF', mobile: '03', price: '$2.200', payment: 'Efectivo', status: 'completed', duration: '14 min',
  },
  {
    id: 'trip-03', date: '18 sep 2026', time: '12:26', origin: 'Av. Libertad 450', destination: 'Hospital O. Orías',
    driver: 'Carlos Pérez', vehicle: 'Toyota Etios', plate: 'AB123CD', mobile: '07', price: '$1.800', payment: 'Mercado Pago', status: 'completed', duration: '9 min',
  },
  {
    id: 'trip-04', date: '12 sep 2026', time: '21:05', origin: 'Centro', destination: 'Calilegua',
    driver: '—', vehicle: '—', plate: '—', mobile: '—', price: '$3.200', payment: '—', status: 'cancelled',
  },
  {
    id: 'trip-05', date: '07 sep 2026', time: '08:15', origin: 'Av. Libertad 450', destination: 'UNJu - Sede Libertador',
    driver: 'Jorge Cruz', vehicle: 'Renault Logan', plate: 'AE789GH', mobile: '11', price: '$1.500', payment: 'Efectivo', status: 'completed', duration: '8 min',
  },
]
