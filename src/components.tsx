import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft, ArrowRight, BriefcaseBusiness, BusFront, CarFront, Check, ChevronRight, CircleHelp,
  Clock3, Home, MapPin, Menu, Navigation, Phone, Search, Star, UserRound, X,
} from 'lucide-react'
import type { Driver, TripStatus } from './types'
import { customer, driver as defaultDriver, tripMock } from './mock-data'

const iconMap = { home: Home, briefcase: BriefcaseBusiness, bus: BusFront, 'map-pin': MapPin }

export function AppHeader({ back, title, onBack, menu = true }: { back?: boolean; title?: string; onBack?: () => void; menu?: boolean }) {
  const navigate = useNavigate()
  return (
    <header className="app-header">
      <div className="header-leading">
        {back ? <button className="icon-button" onClick={onBack ?? (() => navigate(-1))} aria-label="Volver"><ArrowLeft size={20} /></button> : <div className="brand-mark"><CarFront size={18} /></div>}
        <div className="brand-copy"><span>{title ?? 'Remis Norte'}</span>{!title && <small>PROTOTIPO</small>}</div>
      </div>
      {menu && !back && <button className="icon-button" aria-label="Menú"><Menu size={21} /></button>}
    </header>
  )
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

export function AppMap({ mode = 'home' }: { mode?: 'home' | 'preview' | 'searching' | 'assigned' | 'arrived' | 'in-progress' }) {
  const withRoute = mode !== 'home' && mode !== 'searching'
  return <div className={`app-map map-${mode}`} aria-label="Mapa simulado de Libertador General San Martín">
    <div className="map-topographic one" /><div className="map-topographic two" />
    <div className="map-label label-river">Río San Francisco</div><div className="map-label label-town">Libertador G. S. M.</div>
    <div className="map-label label-calilegua">Calilegua</div><div className="map-label label-terminal">Terminal</div>
    <div className="map-label label-hospital">Hospital O. Orías</div><div className="map-label label-unju">UNJu</div>
    <div className="road road-a" /><div className="road road-b" /><div className="road road-c" /><div className="road road-d" />
    {withRoute && <svg className="route-line" viewBox="0 0 100 100" preserveAspectRatio="none"><path d="M20,76 C33,64 34,59 46,53 S64,44 74,24" /></svg>}
    <MapMarker variant="current" className="map-current" />
    {withRoute && <><MapMarker variant="destination" className="map-destination" />{mode !== 'preview' && <div className="map-car"><CarFront size={17} /></div>}</>}
    {mode === 'searching' && <div className="map-search-pulse" />}
    {mode === 'home' && <div className="map-location-caption"><Navigation size={13} fill="currentColor" /> Ubicación aproximada</div>}
  </div>
}

export function MapMarker({ variant = 'current', className = '' }: { variant?: 'current' | 'destination'; className?: string }) {
  return <div className={`map-marker marker-${variant} ${className}`}><span /></div>
}

export function BottomSheet({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`bottom-sheet ${className}`}><div className="sheet-handle" />{children}</section>
}

export function LocationRow({ destination = false, title, address, onClick }: { destination?: boolean; title: string; address?: string; onClick?: () => void }) {
  return <button className="location-row" onClick={onClick}><span className={`row-icon ${destination ? 'destination' : ''}`}>{destination ? <MapPin size={18} /> : <Navigation size={18} />}</span><span className="row-text"><strong>{title}</strong>{address && <small>{address}</small>}</span><ChevronRight size={18} className="muted-icon" /></button>
}

export function QuickDestination({ label, address, icon, onClick }: { label: string; address: string; icon: keyof typeof iconMap; onClick: () => void }) {
  const Icon = iconMap[icon]
  return <button className="quick-destination" onClick={onClick}><span className="quick-icon"><Icon size={17} /></span><span><strong>{label}</strong><small>{address}</small></span></button>
}

export function FareCard({ compact = false }: { compact?: boolean }) {
  return <div className={`fare-card ${compact ? 'compact' : ''}`}><div className="fare-card-top"><span className="eyebrow">Tarifa por zona</span><span className="fare-chip">{tripMock.zoneLabel}</span></div><div className="fare-price">{tripMock.price}</div><p>Precio vigente según cuadro tarifario actual</p>{!compact && <div className="fare-details"><span><Clock3 size={16} /> Móvil en 3-5 min</span><span><CarFront size={16} /> Remis estándar</span><span><Navigation size={16} /> Pago: Efectivo o Mercado Pago</span></div>}</div>
}

export function DriverCard({ compact = false }: { compact?: boolean }) {
  return <div className={`driver-card ${compact ? 'compact' : ''}`}><div className="driver-avatar">CP</div><div className="driver-copy"><strong>{defaultDriver.name}</strong><span>{defaultDriver.vehicle.model}</span>{!compact && <span>{defaultDriver.vehicle.plate} · Móvil {defaultDriver.vehicle.mobile}</span>}</div>{!compact && <button className="round-action" aria-label="Llamar"><Phone size={17} /></button>}</div>
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

export function DemoPanel({ nextLabel, onNext }: { nextLabel: string; onNext: () => void }) {
  const isDemo = new URLSearchParams(window.location.search).get('demo') === '1'
  if (!isDemo) return null
  return <div className="demo-panel"><span><span className="demo-dot" /> Modo demo</span><button onClick={onNext}>{nextLabel} <ArrowRight size={14} /></button></div>
}

export function SearchField({ value, onChange, autoFocus = false, onFocus }: { value: string; onChange: (value: string) => void; autoFocus?: boolean; onFocus?: () => void }) {
  return <label className="search-field"><Search size={19} /><input autoFocus={autoFocus} value={value} onFocus={onFocus} onChange={(event) => onChange(event.target.value)} placeholder="¿A dónde vas?" /></label>
}

export function ScreenTitle({ eyebrow, title, subtitle }: { eyebrow?: string; title: string; subtitle?: string }) {
  return <div className="screen-title">{eyebrow && <span className="eyebrow">{eyebrow}</span>}<h1>{title}</h1>{subtitle && <p>{subtitle}</p>}</div>
}

export function TripSummary({ showPayment = true, destination = tripMock.destination }: { showPayment?: boolean; destination?: string }) {
  return <div className="trip-summary"><div><span>Origen</span><strong>{tripMock.origin}</strong></div><div><span>Destino</span><strong>{destination}</strong></div>{showPayment && <div><span>Pago</span><strong>{tripMock.payment}</strong></div>}</div>
}

export function DriverInfo({ status }: { status: 'assigned' | 'arrived' | 'in-progress' }) {
  return <div className="driver-info-block"><DriverCard /><div className="info-lines"><div><span>Punto de recogida</span><strong>{tripMock.origin}</strong></div><div><span>Destino</span><strong>{tripMock.destination}</strong></div><div><span>Precio del viaje</span><strong>{tripMock.price}</strong></div></div><TripProgress status={status} /></div>
}

export { ArrowLeft, ArrowRight, Check, ChevronRight, CircleHelp, Home, MapPin, Phone, Search, Star, UserRound }
