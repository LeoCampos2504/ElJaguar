import { useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Activity, ArrowDownRight, ArrowRight, CarFront, Check, Clock3, MapPin, Phone, Plus, Route, Users, WalletCards } from 'lucide-react'
import { AppMap, DemoRoleSwitcher, PrimaryButton, ScreenTitle, SecondaryButton } from '../components'
import { formatDemoFareAmount, getDemoFare, getPendingOffer } from '../demo/dispatch'
import type { DemoDriver, DemoDriverAvailability, DemoLocation, DemoTrip, DemoTripStatus } from '../demo/types'
import { useDemo } from '../demo/use-demo'
import { getDemoRouteGeometry, getDriverApproachGeometry } from '../demo/map-routes'
import {
  getActiveRequests,
  getAvailableDrivers,
  getBusyDrivers,
  getCentralKpis,
  getCentralTripRows,
  getDispatchTargetDriver,
  getDriverAvailabilityLockReason,
  getEligibleManualOverrideDrivers,
  getTripDriver,
  getTripPassengerLabel,
  getTripVehicle,
  type CentralTripFilter,
} from './central-flow'

const centralLinks = [
  { label: 'Inicio', path: '/central/inicio', icon: Activity },
  { label: 'Viajes', path: '/central/viajes', icon: Route },
  { label: 'Choferes', path: '/central/choferes', icon: Users },
  { label: 'Tarifas', path: '/central/tarifas', icon: WalletCards },
  { label: 'Historial', path: '/central/historial', icon: Clock3 },
]

const statusLabels: Record<DemoTripStatus, string> = {
  REQUESTED: 'Solicitado', ASSIGNED: 'Asignado', DRIVER_EN_ROUTE: 'En camino', ARRIVED: 'Llegó',
  IN_PROGRESS: 'En curso', COMPLETED: 'Finalizado', CANCELLED: 'Cancelado',
}

const availabilityLabels: Record<DemoDriverAvailability, string> = {
  AVAILABLE: 'Disponible', UNAVAILABLE: 'No disponible', BUSY: 'Ocupado', OFFLINE: 'Desconectado',
}

const sourceLabels = { APP: 'APLICACIÓN', PHONE: 'TELÉFONO', DISPATCHER: 'CENTRAL' } as const

const dispatchStatusLabels = {
  IDLE: 'Sin solicitudes', SEARCHING: 'Buscando móvil', WAITING_FOR_RESPONSE: 'Esperando respuesta',
  ASSIGNED: 'Móvil asignado', NO_CANDIDATES: 'Sin móviles disponibles', STOPPED: 'Búsqueda detenida',
} as const

const demoLocations: DemoLocation[] = [
  { zoneId: 'centro', label: 'Av. Libertad 450 · Centro' },
  { zoneId: 'terminal', label: 'Terminal de Ómnibus' },
  { zoneId: 'hospital', label: 'Hospital O. Orías' },
  { zoneId: 'barrio-ledesma', label: 'Barrio Ledesma' },
  { zoneId: 'libertador', label: 'Libertador General San Martín' },
  { zoneId: 'calilegua', label: 'Calilegua' },
  { zoneId: 'unju', label: 'UNJu - Sede Libertador' },
]

function CentralLayout({ children, title }: { children: ReactNode; title: string }) {
  const path = useLocation().pathname
  const navigate = useNavigate()
  return <div className="central-shell">
    <aside className="central-sidebar">
      <div className="central-brand"><span className="central-brand-mark"><CarFront size={20} /></span><span><strong>Remis Norte</strong><small>Central operativa</small></span></div>
      <div className="central-demo-tag"><span />Central · Modo demo</div>
      <nav className="central-sidebar-nav" aria-label="Navegación Central">{centralLinks.map(({ label, path: route, icon: Icon }) => <button key={route} className={path === route || route !== '/central/inicio' && path.startsWith(route) ? 'active' : ''} onClick={() => navigate(route)}><Icon size={18} /><span>{label}</span>{path === route && <i />}</button>)}</nav>
      <div className="central-sidebar-foot"><strong>Datos de demostración</strong><span>No persisten al recargar ni se sincronizan entre pestañas.</span></div>
    </aside>
    <main className="central-main">
      <header className="central-topbar"><div><span className="central-breadcrumb">OPERACIONES / DEMO</span><h1>{title}</h1></div><DemoRoleSwitcher current="CENTRAL" /></header>
      <div className="central-content">{children}</div>
    </main>
  </div>
}

function KpiCard({ label, value, tone, caption }: { label: string; value: number; tone: string; caption: string }) {
  return <article className="central-kpi-card"><span className={`central-kpi-icon ${tone}`}><Activity size={18} /></span><span className="central-kpi-label">{label}</span><strong>{value}</strong><small>{caption}</small></article>
}

function TripTimeline({ status }: { status: DemoTripStatus }) {
  const steps: DemoTripStatus[] = ['REQUESTED', 'ASSIGNED', 'DRIVER_EN_ROUTE', 'ARRIVED', 'IN_PROGRESS', 'COMPLETED']
  if (status === 'CANCELLED') return <div className="central-timeline"><span className="central-timeline-cancelled"><i />Solicitud cancelada</span></div>
  const activeIndex = steps.indexOf(status)
  return <div className="central-timeline">{steps.map((step, index) => <div key={step} className={`central-timeline-step ${index < activeIndex ? 'done' : ''} ${index === activeIndex ? 'current' : ''}`}><span>{index < activeIndex ? <Check size={12} /> : index + 1}</span><small>{statusLabels[step]}</small>{index < steps.length - 1 && <i />}</div>)}</div>
}

function TripFacts({ trip }: { trip: DemoTrip }) {
  const { state } = useDemo()
  const driver = getTripDriver(trip, state)
  const vehicle = getTripVehicle(trip, state)
  return <div className="central-trip-facts">
    <div><span>ID demo</span><strong>{trip.id}</strong></div>
    <div><span>Fuente</span><strong><em className={`source-badge source-${trip.source.toLowerCase()}`}>{sourceLabels[trip.source]}</em></strong></div>
    <div><span>Pasajero</span><strong>{getTripPassengerLabel(trip, state)}</strong></div>
    {trip.contactPhone && <div><span>Teléfono</span><strong>{trip.contactPhone}</strong></div>}
    <div><span>Origen</span><strong>{trip.origin.label}</strong></div>
    <div><span>Destino</span><strong>{trip.destination.label}</strong></div>
    <div><span>Tarifa confirmada</span><strong>{trip.price}</strong></div>
    <div><span>Chofer</span><strong>{driver?.name ?? 'Aún sin asignar'}</strong></div>
    {vehicle && <div><span>Vehículo</span><strong>{vehicle.make} {vehicle.model} · {vehicle.plate}</strong></div>}
  </div>
}

function CentralMap({ trip }: { trip: DemoTrip | null }) {
  const { state } = useDemo()
  const target = getDispatchTargetDriver(state)
  const driver = trip ? getTripDriver(trip, state) ?? target : target
  const mode = trip && trip.status !== 'REQUESTED' ? 'assigned' : 'searching'
  const approach = driver && trip?.status === 'REQUESTED' ? getDriverApproachGeometry(driver.id, trip.origin.zoneId) : null
  return <section className="central-card central-map-card"><div className="central-card-heading"><div><span className="central-section-kicker">VISTA LOCAL</span><h2>Zona de operación</h2></div><span className="central-illustrative-tag"><MapPin size={13} /> OpenStreetMap · sin GPS</span></div>
    <div className="central-map-frame"><AppMap mode={mode} origin={trip?.origin} destination={trip?.destination} driver={driver} drivers={state.drivers} showDrivers originLabel={trip?.origin.label} destinationLabel={trip?.destination.label} driverLabel={driver?.locationLabel} routeGeometry={getDemoRouteGeometry(trip?.origin.zoneId, trip?.destination.zoneId)} driverRouteGeometry={approach} /></div>
    <div className="central-map-driver-list">{state.drivers.map((item) => <div key={item.id}><i style={{ backgroundColor: item.color }} /><span>{item.name}</span><small>{item.locationLabel}</small><b className={`availability-pill availability-${item.availability.toLowerCase()}`}>{availabilityLabels[item.availability]}</b></div>)}</div>
  </section>
}

function DispatchSupervision({ trip }: { trip: DemoTrip }) {
  const { state, dispatchToDriverAsDispatcher } = useDemo()
  const [confirmDriver, setConfirmDriver] = useState<DemoDriver | null>(null)
  const target = getDispatchTargetDriver(state)
  const eligible = getEligibleManualOverrideDrivers(state)
  const canOverride = trip.status === 'REQUESTED' && (state.dispatch.status === 'WAITING_FOR_RESPONSE' || state.dispatch.status === 'NO_CANDIDATES')
  const tripOffers = state.offers.filter((offer) => offer.tripId === trip.id)
  const confirm = () => {
    if (!confirmDriver) return
    dispatchToDriverAsDispatcher(confirmDriver.id)
    setConfirmDriver(null)
  }
  return <section className="central-card central-dispatch-card"><div className="central-card-heading"><div><span className="central-section-kicker">SUPERVISIÓN</span><h2>Asignación de móviles</h2></div><span className={`dispatch-status-pill dispatch-${state.dispatch.status.toLowerCase()}`}>{dispatchStatusLabels[state.dispatch.status]}</span></div>
    {trip.status === 'REQUESTED' && target ? <div className="central-dispatch-target"><span className="central-target-icon"><Phone size={16} /></span><div><strong>Esperando respuesta de {target.name}</strong><small>Solicitud exclusiva para este móvil</small></div></div> : trip.status === 'REQUESTED' && state.dispatch.status === 'NO_CANDIDATES' ? <div className="central-empty-dispatch">No hay móviles disponibles automáticamente. Podés intervenir con un móvil disponible.</div> : <div className="central-empty-dispatch">{trip.status === 'REQUESTED' ? 'La solicitud está en proceso de asignación.' : `Estado actual: ${statusLabels[trip.status]}.`}</div>}
    {canOverride && <div className="central-override"><strong>Enviar solicitud a otro chofer</strong>{eligible.length === 0 ? <p>No hay choferes disponibles para intervención manual.</p> : <div className="central-override-options">{eligible.map((driver) => <button key={driver.id} onClick={() => setConfirmDriver(driver)}><span>{driver.name}</span><small>Móvil {state.vehicles.find((vehicle) => vehicle.id === driver.vehicleId)?.mobile ?? '—'} · {driver.distanceMeters} m</small><ArrowRight size={15} /></button>)}</div>}{confirmDriver && <div className="central-override-confirm" role="group" aria-label="Confirmar intervención"><p>Se cancelará la oferta actual y la solicitud se enviará exclusivamente a <strong>{confirmDriver.name}</strong>.</p><div><SecondaryButton onClick={() => setConfirmDriver(null)}>Volver</SecondaryButton><PrimaryButton onClick={confirm}>CONFIRMAR ENVÍO</PrimaryButton></div></div>}</div>}
    {tripOffers.length > 0 && <details className="central-offer-history"><summary>Historial de ofertas ({tripOffers.length})</summary>{tripOffers.map((offer) => <div key={offer.id}><span>{state.drivers.find((driver) => driver.id === offer.driverId)?.name ?? offer.driverId}</span><b className={`offer-${offer.status.toLowerCase()}`}>{offer.status}</b></div>)}</details>}
  </section>
}

function CentralDashboard() {
  const { state } = useDemo()
  const kpis = getCentralKpis(state)
  const trip = state.activeTrip
  const target = getDispatchTargetDriver(state)
  const [requested] = getActiveRequests(state)
  return <CentralLayout title="Inicio">
    <div className="central-page-intro"><div><span className="central-section-kicker">RESUMEN OPERATIVO</span><h2>Estado de la operación</h2><p>Indicadores del escenario demo compartido por Cliente, Chofer y Central.</p></div><Link className="central-primary-link" to="/central/viajes/nuevo"><Plus size={16} /> Nuevo pedido telefónico</Link></div>
    <div className="central-kpi-grid"><KpiCard label="Solicitudes activas" value={kpis.activeRequests} tone="blue" caption={target ? `Oferta activa · ${target.name}` : 'Viajes no terminales'} /><KpiCard label="Choferes disponibles" value={kpis.availableDrivers} tone="green" caption="Móviles habilitados" /><KpiCard label="Choferes ocupados" value={kpis.busyDrivers} tone="orange" caption="Con viaje asignado" /><KpiCard label="Viajes finalizados demo" value={kpis.completedTrips} tone="purple" caption="En historial compartido" /></div>
    <div className="central-dashboard-grid"><CentralMap trip={trip} />
      <div className="central-dashboard-side"><section className="central-card central-active-card"><div className="central-card-heading"><div><span className="central-section-kicker">VIAJE ACTIVO</span><h2>{trip ? trip.id : 'Sin viaje activo'}</h2></div>{trip && <span className={`central-trip-status status-${trip.status.toLowerCase()}`}>{statusLabels[trip.status]}</span>}</div>
        {!trip ? <div className="central-no-trip"><CarFront size={24} /><p>No hay una solicitud activa en esta demo.</p><Link to="/central/viajes/nuevo">Crear pedido telefónico</Link></div> : <><TripFacts trip={trip} /><TripTimeline status={trip.status} />{trip.status === 'REQUESTED' && target && <p className="central-waiting-note">Esperando respuesta de <strong>{target.name}</strong>. La solicitud continúa sin asignar.</p>}</>}
      </section>
      {requested && <DispatchSupervision trip={requested} />}
    </div>
    </div>
    <section className="central-card central-live-drivers"><div className="central-card-heading"><div><span className="central-section-kicker">FLOTA DEMO</span><h2>Choferes y disponibilidad</h2></div><Link to="/central/choferes">Ver todos <ArrowRight size={14} /></Link></div><div className="central-mini-driver-grid">{state.drivers.map((driver) => <DriverMiniCard key={driver.id} driver={driver} />)}</div></section>
  </CentralLayout>
}

function DriverMiniCard({ driver }: { driver: DemoDriver }) {
  const { state } = useDemo()
  const vehicle = state.vehicles.find((item) => item.id === driver.vehicleId)
  return <article className="central-mini-driver"><span className="central-mini-avatar" style={{ backgroundColor: `${driver.color}18`, color: driver.color }}><CarFront size={17} /></span><div><strong>{driver.name}</strong><small>Móvil {vehicle?.mobile ?? '—'} · {vehicle?.make ?? ''} {vehicle?.model ?? ''}</small></div><b className={`availability-pill availability-${driver.availability.toLowerCase()}`}>{availabilityLabels[driver.availability]}</b></article>
}

function tripSourceAndStatus(trip: DemoTrip) {
  return <div className="central-row-badges"><em className={`source-badge source-${trip.source.toLowerCase()}`}>{sourceLabels[trip.source]}</em><b className={`central-trip-status status-${trip.status.toLowerCase()}`}>{statusLabels[trip.status]}</b></div>
}

function CentralTripRow({ trip }: { trip: DemoTrip }) {
  const { state } = useDemo()
  const driver = getTripDriver(trip, state)
  return <article className="central-trip-row"><div className="central-trip-row-route"><strong>{trip.origin.label}</strong><ArrowRight size={14} /><strong>{trip.destination.label}</strong></div>{tripSourceAndStatus(trip)}<span>{getTripPassengerLabel(trip, state)}</span><span>{driver?.name ?? 'Sin asignar'}</span><strong className="central-trip-price">{trip.price}</strong></article>
}

function CentralTripsPage() {
  const { state } = useDemo()
  const [filter, setFilter] = useState<CentralTripFilter>('ALL')
  const trips = getCentralTripRows(state, filter)
  const filters: { id: CentralTripFilter; label: string }[] = [{ id: 'ALL', label: 'Todos' }, { id: 'ACTIVE', label: 'Activos' }, { id: 'COMPLETED', label: 'Finalizados' }, { id: 'CANCELLED', label: 'Cancelados' }]
  return <CentralLayout title="Viajes"><div className="central-page-intro"><div><span className="central-section-kicker">OPERACIÓN</span><h2>Solicitudes y viajes</h2><p>Viaje activo e historial del mismo estado demo.</p></div><Link className="central-primary-link" to="/central/viajes/nuevo"><Plus size={16} /> Nuevo pedido</Link></div><div className="central-filter-row">{filters.map((item) => <button key={item.id} className={filter === item.id ? 'active' : ''} onClick={() => setFilter(item.id)}>{item.label}</button>)}</div><section className="central-card central-trips-list"><div className="central-trip-row central-trip-row-head"><span>RECORRIDO</span><span>FUENTE / ESTADO</span><span>PASAJERO</span><span>CHOFER</span><span>TARIFA</span></div>{trips.length ? trips.map((trip) => <CentralTripRow key={trip.id} trip={trip} />) : <div className="central-empty-list">No hay viajes en este filtro.</div>}</section></CentralLayout>
}

function CentralManualRequestPage() {
  const { state, createManualTrip } = useDemo()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [originId, setOriginId] = useState('centro')
  const [destinationId, setDestinationId] = useState('terminal')
  const [error, setError] = useState('')
  const activeRequest = getActiveRequests(state).length > 0
  const origin = demoLocations.find((item) => item.zoneId === originId)!
  const destination = demoLocations.find((item) => item.zoneId === destinationId)!
  const fare = getDemoFare(state.fares, origin.zoneId, destination.zoneId)
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (activeRequest) return setError('Hay un viaje activo en esta demo. Finalizalo o cancelalo antes de crear otro.')
    if (!fare) return setError('No existe una tarifa demo para ese par de zonas. Elegí otro recorrido.')
    if (!name.trim() || !phone.trim()) return setError('Completá el nombre y el teléfono del pasajero.')
    createManualTrip({ passengerDisplayName: name, contactPhone: phone, origin, destination, source: 'PHONE' })
    navigate('/central/viajes')
  }
  return <CentralLayout title="Nuevo pedido"><div className="central-page-intro"><div><span className="central-section-kicker">CARGA MANUAL</span><h2>Pedido telefónico</h2><p>La solicitud usa tarifa zonal y la asignación secuencial vigente.</p></div></div><div className="central-form-layout"><form className="central-card central-manual-form" onSubmit={submit}><label>Nombre del pasajero<input required value={name} onChange={(event) => setName(event.target.value)} placeholder="Nombre y apellido" /></label><label>Teléfono de contacto<input required type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="Teléfono informado" /></label><label>Origen<select value={originId} onChange={(event) => setOriginId(event.target.value)}>{state.zones.map((zone) => <option key={zone.id} value={zone.id}>{zone.name}</option>)}</select></label><label>Destino<select value={destinationId} onChange={(event) => setDestinationId(event.target.value)}>{state.zones.map((zone) => <option key={zone.id} value={zone.id}>{zone.name}</option>)}</select></label><div className="central-manual-source"><Phone size={15} /> Fuente registrada: <strong>TELÉFONO</strong></div>{activeRequest && <div className="central-form-alert" role="alert">Hay un viaje activo en esta demo. Finalizalo o cancelalo antes de crear otro.</div>}{error && <div className="central-form-alert" role="alert">{error}</div>}<PrimaryButton type="submit" disabled={activeRequest || !fare}>CREAR SOLICITUD Y DESPACHAR</PrimaryButton></form><aside className="central-card central-quote-card"><span className="central-section-kicker">COTIZACIÓN PREVIA</span><h2>Tarifa zonal</h2><div><span>{origin.label}</span><ArrowDownRight size={16} /><span>{destination.label}</span></div>{fare ? <strong>{fare.price}</strong> : <strong className="no-fare-price">Sin tarifa</strong>}<p>{fare ? 'El importe quedará congelado en este viaje.' : 'No hay tarifa para este recorrido; no se puede crear la solicitud.'}</p></aside></div></CentralLayout>
}

function CentralDriversPage() {
  const { state, setDriverAvailability } = useDemo()
  const availabilityAction = (driver: DemoDriver) => setDriverAvailability(driver.id, driver.availability === 'AVAILABLE' ? 'UNAVAILABLE' : 'AVAILABLE')
  return <CentralLayout title="Choferes"><div className="central-page-intro"><div><span className="central-section-kicker">FLOTA DEMO</span><h2>Choferes y móviles</h2><p>Ubicaciones y distancias son ilustrativas; no se usa GPS.</p></div></div><div className="central-driver-grid">{state.drivers.map((driver) => { const vehicle = state.vehicles.find((item) => item.id === driver.vehicleId); const lockReason = getDriverAvailabilityLockReason(state, driver.id); return <article className="central-card central-driver-card" key={driver.id}><div className="central-driver-card-head"><span className="central-driver-avatar" style={{ backgroundColor: `${driver.color}18`, color: driver.color }}><CarFront size={21} /></span><div><h3>{driver.name}</h3><span className={`availability-pill availability-${driver.availability.toLowerCase()}`}>{availabilityLabels[driver.availability]}</span></div></div><dl><div><dt>Móvil</dt><dd>{vehicle?.mobile ?? '—'}</dd></div><div><dt>Vehículo</dt><dd>{vehicle ? `${vehicle.make} ${vehicle.model}` : '—'}</dd></div><div><dt>Patente</dt><dd>{vehicle?.plate ?? '—'}</dd></div><div><dt>Ubicación demo</dt><dd>{driver.locationLabel}</dd></div><div><dt>Distancia demo</dt><dd>{driver.distanceMeters} m</dd></div></dl><button className="central-availability-button" disabled={!!lockReason} onClick={() => availabilityAction(driver)}>{driver.availability === 'AVAILABLE' ? 'Marcar no disponible' : 'Marcar disponible'}</button>{lockReason && <small className="central-lock-reason">{lockReason}</small>}</article> })}</div></CentralLayout>
}

function CentralFaresPage() {
  const { state, updateDemoFare } = useDemo()
  const [amounts, setAmounts] = useState<Record<string, string>>({})
  const [feedback, setFeedback] = useState('')
  const [error, setError] = useState('')
  const fares = useMemo(() => state.fares, [state.fares])
  const save = (fareId: string, currentPrice: string) => {
    const raw = amounts[fareId] ?? currentPrice.replace(/\D/g, '')
    if (!formatDemoFareAmount(raw)) { setError('Ingresá un importe entero positivo en pesos.'); setFeedback(''); return }
    updateDemoFare(fareId, raw)
    setError('')
    setFeedback('Tarifa demo actualizada. El cambio sólo afecta nuevos viajes.')
  }
  return <CentralLayout title="Tarifas"><div className="central-page-intro"><div><span className="central-section-kicker">CUADRO ZONAL</span><h2>Tarifas demo</h2><p>Los cambios viven en memoria y sólo aplican a nuevas solicitudes.</p></div></div>{feedback && <div className="central-success-banner" role="status"><Check size={16} />{feedback}</div>}{error && <div className="central-form-alert" role="alert">{error}</div>}<div className="central-fare-list">{fares.map((fare) => { const origin = state.zones.find((zone) => zone.id === fare.originZoneId); const destination = state.zones.find((zone) => zone.id === fare.destinationZoneId); return <article className="central-card central-fare-row" key={fare.id}><div className="central-fare-route"><span>{origin?.name ?? fare.originZoneId}</span><ArrowRight size={15} /><span>{destination?.name ?? fare.destinationZoneId}</span></div><strong className="central-fare-current">{fare.price}</strong><label className="central-fare-input-label">Nuevo importe (ARS)<input inputMode="numeric" value={amounts[fare.id] ?? fare.price.replace(/\D/g, '')} onChange={(event) => setAmounts((values) => ({ ...values, [fare.id]: event.target.value }))} aria-label={`Nuevo importe para ${origin?.name} a ${destination?.name}`} /></label><button className="central-save-fare" onClick={() => save(fare.id, fare.price)}>Guardar tarifa</button></article> })}</div></CentralLayout>
}

function CentralHistoryPage() {
  const { state } = useDemo()
  const trips = state.tripHistory
  return <CentralLayout title="Historial"><div className="central-page-intro"><div><span className="central-section-kicker">REGISTRO DEMO</span><h2>Historial de viajes</h2><p>Actividad compartida; no incluye caja, ingresos, comisiones ni liquidaciones.</p></div></div><section className="central-card central-trips-list"><div className="central-trip-row central-trip-row-head"><span>RECORRIDO</span><span>FUENTE / ESTADO</span><span>PASAJERO</span><span>CHOFER / VEHÍCULO</span><span>TARIFA</span></div>{trips.length ? trips.map((trip) => { const driver = getTripDriver(trip, state); const vehicle = getTripVehicle(trip, state); return <article className="central-trip-row" key={trip.id}><div className="central-trip-row-route"><strong>{trip.origin.label}</strong><ArrowRight size={14} /><strong>{trip.destination.label}</strong></div>{tripSourceAndStatus(trip)}<span>{getTripPassengerLabel(trip, state)}</span><span>{driver ? `${driver.name} · ${vehicle ? `${vehicle.make} ${vehicle.model}` : ''}` : '—'}</span><strong className="central-trip-price">{trip.price}</strong></article> }) : <div className="central-empty-list">Todavía no hay viajes en el historial.</div>}</section></CentralLayout>
}

export function CentralRoutes() {
  const path = useLocation().pathname
  if (path === '/central' || path === '/central/') return <Navigate to="/central/inicio" replace />
  if (path === '/central/inicio') return <CentralDashboard />
  if (path === '/central/viajes/nuevo') return <CentralManualRequestPage />
  if (path === '/central/viajes') return <CentralTripsPage />
  if (path === '/central/choferes') return <CentralDriversPage />
  if (path === '/central/tarifas') return <CentralFaresPage />
  if (path === '/central/historial') return <CentralHistoryPage />
  return <CentralDashboard />
}
