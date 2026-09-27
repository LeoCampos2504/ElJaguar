import { lazy, Suspense, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, ArrowRight, BriefcaseBusiness, BusFront, CarFront, Check, ChevronRight, CircleHelp,
  Clock3, Home, MapPin, Menu, Navigation, Phone, Search, Star, UserRound, X,
} from 'lucide-react'
import type { Driver, TripStatus } from './types'
import { driver as defaultDriver, tripMock } from './mock-data'
import type { DemoDriver, DemoFare, DemoLocation, DemoVehicle } from './demo/types'
import type { MapPoint } from './demo/map-locations'
import { getClientRouteForTripState } from './client-flow'
import { useDemo } from './demo/use-demo'
import { isDemoDebugEnabled } from './demo/presentation-utils'

const iconMap = { home: Home, briefcase: BriefcaseBusiness, bus: BusFront, 'map-pin': MapPin }
const RealMap = lazy(() => import('./map/RealMap').then((module) => ({ default: module.RealMap })))

export function AppHeader({ back, title, onBack, menu = false }: { back?: boolean; title?: string; onBack?: () => void; menu?: boolean }) {
  const navigate = useNavigate()
  return (
    <header className="app-header">
      <div className="header-leading">
        {back ? <button className="icon-button" onClick={onBack ?? (() => navigate(-1))} aria-label="Volver"><ArrowLeft size={20} /></button> : <div className="brand-mark"><CarFront size={18} /></div>}
        <div className="brand-copy"><span>{title ?? 'EL JAGUAR'}</span>{!title && <small>PROTOTIPO</small>}</div>
      </div>
      {menu && !back && <button className="icon-button" aria-label="Menú"><Menu size={21} /></button>}
    </header>
  )
}

export function DemoRoleSwitcher({ current }: { current: 'CLIENT' | 'DRIVER' | 'CENTRAL' }) {
  const navigate = useNavigate()
  const { state } = useDemo()
  const roles = [
    { id: 'CLIENT' as const, label: 'Cliente', route: '/cliente' },
    { id: 'DRIVER' as const, label: 'Chofer', route: '/chofer' },
    { id: 'CENTRAL' as const, label: 'Central', route: '/central' },
  ]
  return <nav className="demo-role-switcher" aria-label="Cambiar rol demo"><span>Vista demo</span>{roles.map((role) => <button key={role.id} aria-current={current === role.id ? 'page' : undefined} className={current === role.id ? 'active' : ''} onClick={() => navigate(role.id === 'CLIENT' && state.activeTrip ? getClientRouteForTripState(state.activeTrip) : role.route)}>{role.label}</button>)}</nav>
}

export function CustomerBottomNav() {
  const navigate = useNavigate()
  const path = window.location.pathname
  const items = [
    { label: 'Inicio', icon: Home, route: '/cliente' },
    { label: 'Viajes', icon: Clock3, route: '/cliente/viajes' },
    { label: 'Ayuda', icon: CircleHelp, route: '/cliente/ayuda' },
    { label: 'Perfil', icon: UserRound, route: '/cliente/perfil' },
  ]
  return <nav className="bottom-nav">{items.map(({ label, icon: Icon, route }) => <button key={route} className={path.startsWith(route) && (route !== '/cliente' || path === '/cliente') ? 'active' : ''} onClick={() => navigate(route)}><Icon size={20} /><span>{label}</span></button>)}</nav>
}

export function PageContainer({ children, noNav = false, className = '' }: { children: ReactNode; noNav?: boolean; className?: string }) {
  return <div className={`app-shell ${className}`}><main className="page-container">{children}</main>{!noNav && <CustomerBottomNav />}</div>
}

export function PrimaryButton({ children, onClick, type = 'button', disabled = false }: { children: ReactNode; onClick?: () => void; type?: 'button' | 'submit'; disabled?: boolean }) {
  return <button className="primary-button" type={type} onClick={onClick} disabled={disabled}>{children}</button>
}

export function SecondaryButton({ children, onClick }: { children: ReactNode; onClick?: () => void }) {
  return <button className="secondary-button" onClick={onClick}>{children}</button>
}

export function AppMap({ mode = 'home', originLabel, destinationLabel, driverLabel, origin, destination, driver, drivers, showDrivers, routeGeometry, driverRouteGeometry }: {
  mode?: 'home' | 'preview' | 'searching' | 'assigned' | 'arrived' | 'in-progress'
  originLabel?: string
  destinationLabel?: string
  driverLabel?: string
  origin?: DemoLocation | null
  destination?: DemoLocation | null
  driver?: DemoDriver | null
  drivers?: DemoDriver[]
  showDrivers?: boolean
  routeGeometry?: MapPoint[] | null
  driverRouteGeometry?: MapPoint[] | null
}) {
  return <div className={`app-map map-${mode}`}>
    <Suspense fallback={<div className="real-map-fallback" role="status">Cargando mapa local…</div>}><RealMap origin={origin} destination={destination} driver={driver} drivers={drivers} showDrivers={showDrivers} routeGeometry={routeGeometry} driverRouteGeometry={driverRouteGeometry} originLabel={originLabel} destinationLabel={destinationLabel} driverLabel={driverLabel} /></Suspense>
    {(originLabel || destinationLabel || driverLabel) && <div className="map-demo-labels">{originLabel && <span>Origen: {originLabel}</span>}{destinationLabel && <span>Destino: {destinationLabel}</span>}{driverLabel && <span>Móvil demo: {driverLabel}</span>}</div>}
    {mode === 'home' && <div className="map-location-caption"><Navigation size={13} fill="currentColor" /> Libertador General San Martín · Jujuy</div>}
  </div>
}

export function MapMarker({ variant = 'current', className = '' }: { variant?: 'current' | 'destination'; className?: string }) {
  return <div className={`map-marker marker-${variant} ${className}`}><span /></div>
}

export function BottomSheet({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`bottom-sheet ${className}`}><div className="sheet-handle" />{children}</section>
}

export function LocationRow({ destination = false, title, address, onClick, disabled = false }: { destination?: boolean; title: string; address?: string; onClick?: () => void; disabled?: boolean }) {
  return <button className="location-row" onClick={onClick} disabled={disabled}><span className={`row-icon ${destination ? 'destination' : ''}`}>{destination ? <MapPin size={18} /> : <Navigation size={18} />}</span><span className="row-text"><strong>{title}</strong>{address && <small>{address}</small>}</span>{!disabled && <ChevronRight size={18} className="muted-icon" />}</button>
}

export function QuickDestination({ label, address, icon, onClick }: { label: string; address: string; icon: keyof typeof iconMap; onClick: () => void }) {
  const Icon = iconMap[icon]
  return <button className="quick-destination" onClick={onClick}><span className="quick-icon"><Icon size={17} /></span><span><strong>{label}</strong><small>{address}</small></span></button>
}

export function FareCard({ compact = false, fare, routeLabel }: { compact?: boolean; fare?: DemoFare | null; routeLabel?: string }) {
  if (fare === null) return null
  return <div className={`fare-card ${compact ? 'compact' : ''}`}><div className="fare-card-top"><span className="eyebrow">Tarifa por zona</span><span className="fare-chip">{routeLabel ?? tripMock.zoneLabel}</span></div><div className="fare-price">{fare?.price ?? tripMock.price}</div><p>Precio vigente según cuadro tarifario actual</p>{!compact && <div className="fare-details"><span><Clock3 size={16} /> Móvil en 3-5 min (estimación demo)</span><span><CarFront size={16} /> Remis estándar</span><span><Navigation size={16} /> Pago: Efectivo o Mercado Pago</span></div>}</div>
}

export function DriverCard({ compact = false, demoDriver, demoVehicle }: { compact?: boolean; demoDriver?: DemoDriver; demoVehicle?: DemoVehicle | null }) {
  const name = demoDriver?.name ?? defaultDriver.name
  const vehicleName = demoVehicle ? `${demoVehicle.make} ${demoVehicle.model}` : defaultDriver.vehicle.model
  const plate = demoVehicle?.plate ?? defaultDriver.vehicle.plate
  const mobile = demoVehicle?.mobile ?? defaultDriver.vehicle.mobile
  const initials = name.split(' ').map((part) => part[0]).slice(0, 2).join('').toUpperCase()
  return <div className={`driver-card ${compact ? 'compact' : ''}`}><div className="driver-avatar" style={demoDriver ? { backgroundColor: `${demoDriver.color}22`, color: demoDriver.color } : undefined}>{initials}</div><div className="driver-copy"><strong>{name}</strong><span>{vehicleName}</span>{!compact && <span>{plate} · Móvil {mobile}{demoVehicle ? ` · ${demoVehicle.color}` : ''}</span>}</div>{!compact && <button className="round-action" aria-label="Llamar al chofer (no disponible en demo)" disabled title="Llamada no disponible en esta demo"><Phone size={17} /></button>}</div>
}

export function TripProgress({ status }: { status: TripStatus }) {
  const steps: { key: TripStatus; label: string }[] = [{ key: 'assigned', label: 'Asignado' }, { key: 'arrived', label: 'Llegó' }, { key: 'in-progress', label: 'En viaje' }]
  const activeIndex = status === 'assigned' ? 0 : status === 'arrived' ? 1 : status === 'in-progress' || status === 'completed' ? 2 : -1
  return <div className="trip-progress">{steps.map((step, index) => <div className={`progress-step ${index < activeIndex ? 'done' : ''} ${index === activeIndex ? 'active' : ''}`} key={step.key}><span className="progress-dot">{index < activeIndex ? <Check size={13} /> : index + 1}</span><span>{step.label}</span>{index < steps.length - 1 && <i />}</div>)}</div>
}

export function StatusBadge({ status }: { status: TripStatus }) {
  const labels: Record<TripStatus, string> = { searching: 'Buscando', assigned: 'En curso', arrived: 'En curso', 'in-progress': 'En curso', completed: 'Completado', cancelled: 'Cancelado' }
  return <span className={`status-badge status-${status}`}>{labels[status]}</span>
}

export function TripCard({ trip, onClick }: { trip: import('./types').Trip; onClick: () => void }) {
  return <button className="trip-card" onClick={onClick}><div className="trip-card-head"><span>{trip.date} · {trip.time}</span><StatusBadge status={trip.status} /></div><div className="trip-route"><span>{trip.origin}</span><i /><span>{trip.destination}</span></div><div className="trip-card-foot"><span>{trip.driver !== '—' ? `${trip.driver} · Móvil ${trip.mobile}` : 'Viaje cancelado'}</span><strong>{trip.price}</strong></div></button>
}

export function FareUpdateDialog({ onClose, onView }: { onClose: () => void; onView: () => void }) {
  return <div className="dialog-backdrop"><div className="fare-dialog"><button className="dialog-close" onClick={onClose} aria-label="Cerrar"><X size={18} /></button><div className="dialog-icon"><Navigation size={21} /></div><span className="eyebrow">Información importante</span><h2>Actualización de tarifas</h2><p>Desde el 25/09/2026 se encuentra vigente un nuevo cuadro tarifario.</p><div className="dialog-actions"><SecondaryButton onClick={onView}>Ver tarifas</SecondaryButton><PrimaryButton onClick={onClose}>Entendido</PrimaryButton></div></div></div>
}

export function DemoPanel({ nextLabel, onNext, actions = [] }: { nextLabel?: string; onNext?: () => void; actions?: { label: string; onClick: () => void }[] }) {
  const location = useLocation()
  if (!isDemoDebugEnabled(location.search)) return null
  return <section className="demo-panel" aria-label="Controles de simulación"><span><span className="demo-dot" /> DEMO · DEBUG · SIMULACIÓN</span><div className="demo-actions">{actions.map((action) => <button key={action.label} onClick={action.onClick}>{action.label} <ArrowRight size={14} /></button>)}{nextLabel && onNext && <button onClick={onNext}>{nextLabel} <ArrowRight size={14} /></button>}</div></section>
}

export function SearchField({ value, onChange, autoFocus = false, onFocus }: { value: string; onChange: (value: string) => void; autoFocus?: boolean; onFocus?: () => void }) {
  return <label className="search-field"><Search size={19} /><input autoFocus={autoFocus} value={value} onFocus={onFocus} onChange={(event) => onChange(event.target.value)} placeholder="¿A dónde vas?" /></label>
}

export function ScreenTitle({ eyebrow, title, subtitle }: { eyebrow?: string; title: string; subtitle?: string }) {
  return <div className="screen-title">{eyebrow && <span className="eyebrow">{eyebrow}</span>}<h1>{title}</h1>{subtitle && <p>{subtitle}</p>}</div>
}

export function TripSummary({ showPayment = true, origin = tripMock.origin, destination = tripMock.destination }: { showPayment?: boolean; origin?: string; destination?: string }) {
  return <div className="trip-summary"><div><span>Origen</span><strong>{origin}</strong></div><div><span>Destino</span><strong>{destination}</strong></div>{showPayment && <div><span>Pago</span><strong>{tripMock.payment}</strong></div>}</div>
}

export function DriverInfo({ status }: { status: 'assigned' | 'arrived' | 'in-progress' }) {
  return <div className="driver-info-block"><DriverCard /><div className="info-lines"><div><span>Punto de recogida</span><strong>{tripMock.origin}</strong></div><div><span>Destino</span><strong>{tripMock.destination}</strong></div><div><span>Precio del viaje</span><strong>{tripMock.price}</strong></div></div><TripProgress status={status} /></div>
}

export { ArrowLeft, ArrowRight, Check, ChevronRight, CircleHelp, Home, MapPin, Phone, Search, Star, UserRound }
