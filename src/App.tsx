import { useEffect, useRef, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowRight, Bell, BriefcaseBusiness, CheckCircle2, ChevronRight, CircleHelp, Clock3, CreditCard, HeartPulse, HelpCircle, Home, MapPin, MessageCircle, Phone, Search, ShieldAlert, Star, UserRound, WalletCards } from 'lucide-react'
import { AppHeader, AppMap, BottomSheet, DemoPanel, DemoRoleSwitcher, DriverCard, FareCard, FareUpdateDialog, LocationRow, PageContainer, PrimaryButton, QuickDestination, ScreenTitle, SearchField, SecondaryButton, StatusBadge, TripCard, TripProgress, TripSummary } from './components'
import { customer, fareVersion, fares, quickDestinations, recentDestinations, tripHistory as legacyHistory } from './mock-data'
import { DemoProvider } from './demo/demo-state'
import { DriverRoutes } from './driver/DriverRoutes'
import { DriverSessionProvider } from './driver/driver-session'
import { CentralRoutes } from './central/CentralRoutes'
import { useDemo } from './demo/use-demo'
import { canPassengerCancel, getCurrentDriver, getCurrentVehicle } from './demo/dispatch'
import type { DemoTrip, DemoTripStatus } from './demo/types'
import type { Trip, TripStatus } from './types'
import { findDemoLocation, getClientRouteForTripState, getClientRouteGuard } from './client-flow'
import { DemoLanding } from './presentation/DemoLanding'
import { getDemoRouteGeometry, getDriverApproachGeometry } from './demo/map-routes'
import { getDestinationFromSearch } from './demo/presentation-utils'

function HomePage() {
  const navigate = useNavigate()
  const { state, resetDemo, setDestination } = useDemo()
  const [showFareDialog, setShowFareDialog] = useState(true)
  const active = state.activeTrip && !['COMPLETED', 'CANCELLED'].includes(state.activeTrip.status) ? state.activeTrip : null
  const goToTrip = (destination: string) => {
    const location = findDemoLocation(destination)
    setDestination(location)
    navigate(location ? '/cliente/viaje' : `/cliente/viaje?destino=${encodeURIComponent(destination)}`)
  }
  return <PageContainer className="home-page">
    <AppHeader />
    <div className="home-intro"><span className="eyebrow">Buen día, {state.passenger.name}</span><h1>¿A dónde querés ir?</h1></div>
    <div className="home-map-wrap"><AppMap origin={state.selectedOrigin} originLabel={state.selectedOrigin?.label} /><BottomSheet className="home-sheet"><LocationRow title="Origen demo" address={state.selectedOrigin?.label ?? 'Origen no seleccionado'} disabled /><SearchField value="" onChange={() => undefined} onFocus={() => navigate('/cliente/buscar')} /><div className="section-heading"><h2>Destinos rápidos</h2></div><div className="quick-grid">{quickDestinations.map((destination) => <QuickDestination key={destination.label} {...destination} onClick={() => goToTrip(destination.address)} />)}</div>
      {active ? <div className="info-card active-trip-card"><span>Tenés un viaje activo: {active.origin.label} → {active.destination.label}</span><PrimaryButton onClick={() => navigate(getClientRouteForTripState(active))}>CONTINUAR VIAJE</PrimaryButton></div> : <p className="soft-hint">Completá tu destino y te mostraremos los detalles del viaje.</p>}
      <DemoRoleSwitcher current="CLIENT" />
      <DemoPanel actions={[{ label: 'RESET DEMO', onClick: () => { resetDemo(); navigate('/cliente') } }]} />
    </BottomSheet></div>
    {showFareDialog && <FareUpdateDialog onClose={() => setShowFareDialog(false)} onView={() => navigate('/cliente/tarifas')} />}
  </PageContainer>
}

function SearchPage() {
  const navigate = useNavigate()
  const { setDestination } = useDemo()
  const [query, setQuery] = useState('')
  const choices = query ? [...recentDestinations.filter((item) => item.toLowerCase().includes(query.toLowerCase())), 'Hospital O. Orías'].filter((item, index, all) => all.indexOf(item) === index) : recentDestinations
  const choose = (destination: string) => {
    setDestination(findDemoLocation(destination))
    navigate(`/cliente/viaje?destino=${encodeURIComponent(destination)}`)
  }
  return <PageContainer noNav className="search-page"><AppHeader back title="Elegí tu destino" onBack={() => navigate('/cliente')} /><div className="search-content"><SearchField value={query} onChange={setQuery} autoFocus /><div className="search-section"><span className="eyebrow">Destinos recientes</span>{choices.map((destination, index) => <button className="search-result" key={destination} onClick={() => choose(destination)}><span className="recent-icon">{index === 0 ? <Clock3 size={17} /> : <MapPin size={17} />}</span><span><strong>{destination}</strong><small>{findDemoLocation(destination) ? 'Destino demo local' : 'Sin coincidencia demo reconocida'}</small></span><ChevronRight size={17} /></button>)}</div><div className="search-section"><span className="eyebrow">Destinos rápidos</span><div className="search-quick-grid">{quickDestinations.map((destination) => <QuickDestination key={destination.label} {...destination} onClick={() => choose(destination.address)} />)}</div></div></div></PageContainer>
}

function TripPreviewPage() {
  const navigate = useNavigate()
  const { state, setDestination, quoteTrip, requestTrip } = useDemo()
  const [submitting, setSubmitting] = useState(false)
  const submitLock = useRef(false)
  const [searchParams] = useSearchParams()
  const queryDestination = getDestinationFromSearch(searchParams.toString())
  const debugQuery = searchParams.get('debug') === '1' ? '?debug=1' : ''
  const queryLocation = queryDestination ? findDemoLocation(queryDestination) : null
  useEffect(() => {
    if (queryLocation && state.selectedDestination?.label !== queryLocation.label) setDestination(queryLocation)
  }, [queryLocation?.label, state.selectedDestination?.label])
  if (state.activeTrip && !['COMPLETED', 'CANCELLED'].includes(state.activeTrip.status)) return <Navigate to={getClientRouteForTripState(state.activeTrip)} replace />
  const quote = quoteTrip()
  const fare = quote.status === 'AVAILABLE' ? quote.fare : null
  const destination = state.selectedDestination?.label ?? queryDestination ?? 'Destino no seleccionado'
  const origin = state.selectedOrigin?.label ?? 'Origen no seleccionado'
  const routeLabel = state.selectedOrigin && state.selectedDestination
    ? `${state.zones.find((zone) => zone.id === state.selectedOrigin?.zoneId)?.name ?? ''} → ${state.zones.find((zone) => zone.id === state.selectedDestination?.zoneId)?.name ?? ''}` : undefined
  const submit = () => {
    if (submitLock.current || quote.status !== 'AVAILABLE' || state.activeTrip && !['COMPLETED', 'CANCELLED'].includes(state.activeTrip.status)) return
    submitLock.current = true
    setSubmitting(true)
    requestTrip()
    navigate(`/cliente/buscando${debugQuery}`)
  }
  return <PageContainer noNav className="map-flow-page"><div className="flow-map"><AppHeader back title="Detalle del viaje" onBack={() => navigate('/cliente')} /><AppMap mode="preview" origin={state.selectedOrigin} destination={state.selectedDestination} originLabel={origin} destinationLabel={destination} routeGeometry={getDemoRouteGeometry(state.selectedOrigin?.zoneId, state.selectedDestination?.zoneId)} /></div><BottomSheet className="flow-sheet"><ScreenTitle title="Ver viaje" /><TripSummary origin={origin} destination={destination} /><FareCard fare={fare} routeLabel={routeLabel} />{quote.status === 'NO_FARE' && <div className="info-card no-fare" role="status">Tarifa no disponible para este recorrido. Elegí otro destino.</div>}{quote.status === 'MISSING_LOCATION' && <div className="info-card no-fare" role="status">Seleccioná un destino demo reconocido para cotizar.</div>}<button className="text-link" onClick={() => navigate('/cliente/tarifas')}>Ver cuadro de tarifas <ArrowRight size={15} /></button><PrimaryButton disabled={quote.status !== 'AVAILABLE' || submitting} onClick={submit}>{submitting ? 'PROCESANDO…' : 'SOLICITAR REMIS'}</PrimaryButton><button className="under-button" onClick={() => navigate('/cliente/buscar')}>Cambiar destino</button><div className="destination-note">Origen: <strong>{origin}</strong> · Destino: <strong>{destination}</strong></div><DemoRoleSwitcher current="CLIENT" /></BottomSheet></PageContainer>
}

function SearchingPage() {
  const navigate = useNavigate()
  const { state, cancelTrip, retryDispatch, acceptCurrentOffer, rejectCurrentOffer, expireCurrentOffer, resetDemo } = useDemo()
  const trip = state.activeTrip!
  const canRetry = state.dispatch.status === 'NO_CANDIDATES'
  const cancel = () => { cancelTrip(); navigate('/cliente/cancelado') }
  const retry = () => { retryDispatch() }
  const reset = () => { resetDemo(); navigate('/cliente') }
  const statusCopy = state.dispatch.status === 'NO_CANDIDATES'
    ? 'No encontramos un chofer disponible por el momento.'
    : state.dispatch.status === 'WAITING_FOR_RESPONSE' ? 'Estamos esperando respuesta de un móvil cercano.' : 'Estamos avisando a los choferes cercanos.'
  return <PageContainer noNav className="map-flow-page state-page"><div className="flow-map"><AppHeader back title="Buscando móvil" onBack={() => navigate('/cliente')} /><AppMap mode="searching" origin={trip.origin} destination={trip.destination} originLabel={trip.origin.label} destinationLabel={trip.destination.label} routeGeometry={getDemoRouteGeometry(trip.origin.zoneId, trip.destination.zoneId)} /></div><BottomSheet className="flow-sheet"><div className="state-icon searching-icon"><span><span /><span /><span /></span></div><ScreenTitle title={canRetry ? 'Sin móviles disponibles' : 'Buscando móvil…'} subtitle={statusCopy} /><TripSummary showPayment={false} origin={trip.origin.label} destination={trip.destination.label} /><div className="confirmed-price"><strong>{trip.price}</strong><span>Tarifa zonal confirmada</span></div>{state.currentOffer?.status === 'PENDING' && <div className="info-card">Solicitud enviada a un móvil. La identidad se muestra sólo después de aceptar.</div>}
    {canRetry ? <><PrimaryButton onClick={retry}>REINTENTAR</PrimaryButton><SecondaryButton onClick={cancel}>Cancelar solicitud</SecondaryButton><button className="under-button" onClick={() => navigate('/cliente')}>Volver al inicio</button></> : <SecondaryButton onClick={cancel}>Cancelar viaje</SecondaryButton>}
    <DemoPanel actions={[...(state.currentOffer ? [{ label: 'DEBUG ACCEPT OFFER', onClick: acceptCurrentOffer }, { label: 'DEBUG REJECT OFFER', onClick: rejectCurrentOffer }, { label: 'DEBUG TIMEOUT', onClick: expireCurrentOffer }] : []), { label: 'RESET DEMO', onClick: reset }]} /><DemoRoleSwitcher current="CLIENT" />
  </BottomSheet></PageContainer>
}

function AssignedPage() {
  const navigate = useNavigate()
  const { state, markDriverEnRoute, markDriverArrived, cancelTrip, resetDemo } = useDemo()
  const trip = state.activeTrip!
  const driver = getCurrentDriver(state)!
  const vehicle = getCurrentVehicle(state)
  const cancel = () => { cancelTrip(); navigate('/cliente/cancelado') }
  const reset = () => { resetDemo(); navigate('/cliente') }
  const assigned = trip.status === 'ASSIGNED'
  return <PageContainer noNav className="map-flow-page state-page"><div className="flow-map"><AppHeader back title="Tu viaje" onBack={() => navigate('/cliente')} /><AppMap mode="assigned" origin={trip.origin} destination={trip.destination} driver={driver} originLabel={trip.origin.label} destinationLabel={trip.destination.label} driverLabel={driver.locationLabel} routeGeometry={getDemoRouteGeometry(trip.origin.zoneId, trip.destination.zoneId)} driverRouteGeometry={trip.status === 'DRIVER_EN_ROUTE' ? getDriverApproachGeometry(driver.id, trip.origin.zoneId) : null} /></div><BottomSheet className="flow-sheet"><TripProgress status="assigned" /><ScreenTitle title={assigned ? 'Tu móvil fue asignado' : 'Tu móvil está en camino'} subtitle={assigned ? 'El chofer confirmó tu viaje.' : `Aproximadamente ${Math.max(1, Math.ceil(driver.distanceMeters / 500))} min (estimación demo)`} /><DriverCard demoDriver={driver} demoVehicle={vehicle} />{canPassengerCancel(state) && <div className="contact-actions"><button className="round-action muted" onClick={cancel}>Cancelar</button></div>}<TripSummary showPayment={false} origin={trip.origin.label} destination={trip.destination.label} /><div className="confirmed-price"><strong>{trip.price}</strong><span>Tarifa confirmada</span></div><DemoPanel actions={[...(assigned ? [{ label: 'DEBUG DRIVER EN ROUTE', onClick: markDriverEnRoute }] : [{ label: 'DEBUG ARRIVED', onClick: markDriverArrived }]), { label: 'RESET DEMO', onClick: reset }]} /><DemoRoleSwitcher current="CLIENT" /></BottomSheet></PageContainer>
}

function ArrivedPage() {
  const navigate = useNavigate()
  const { state, startTrip, cancelTrip, resetDemo } = useDemo()
  const trip = state.activeTrip!
  const driver = getCurrentDriver(state)!
  const vehicle = getCurrentVehicle(state)
  const cancel = () => { cancelTrip(); navigate('/cliente/cancelado') }
  const reset = () => { resetDemo(); navigate('/cliente') }
  return <PageContainer noNav className="map-flow-page state-page"><div className="flow-map"><AppHeader back title="Tu viaje" onBack={() => navigate('/cliente')} /><AppMap mode="arrived" origin={trip.origin} destination={trip.destination} driver={driver} originLabel={trip.origin.label} destinationLabel={trip.destination.label} driverLabel={driver.locationLabel} routeGeometry={getDemoRouteGeometry(trip.origin.zoneId, trip.destination.zoneId)} /></div><BottomSheet className="flow-sheet"><TripProgress status="arrived" /><div className="arrived-banner"><CheckCircle2 size={18} /><span>Tu remis ya está en el punto de recogida.</span></div><ScreenTitle title="Tu móvil llegó" subtitle={`${driver.name} · ${vehicle?.make ?? ''} ${vehicle?.model ?? ''} · Móvil ${vehicle?.mobile ?? '—'}`} /><DriverCard demoDriver={driver} demoVehicle={vehicle} />{canPassengerCancel(state) && <div className="contact-actions"><button className="round-action muted" onClick={cancel}>Cancelar</button></div>}<TripSummary showPayment={false} origin={trip.origin.label} destination={trip.destination.label} /><DemoPanel actions={[{ label: 'DEBUG START TRIP', onClick: () => { startTrip(); navigate('/cliente/en-viaje') } }, { label: 'RESET DEMO', onClick: reset }]} /><DemoRoleSwitcher current="CLIENT" /></BottomSheet></PageContainer>
}

function InProgressPage() {
  const navigate = useNavigate()
  const { state, completeTrip, resetDemo } = useDemo()
  const trip = state.activeTrip!
  const driver = getCurrentDriver(state)!
  const vehicle = getCurrentVehicle(state)
  const reset = () => { resetDemo(); navigate('/cliente') }
  return <PageContainer noNav className="map-flow-page state-page"><div className="flow-map"><AppHeader back title="Tu viaje" onBack={() => navigate('/cliente')} /><AppMap mode="in-progress" origin={trip.origin} destination={trip.destination} driver={driver} originLabel={trip.origin.label} destinationLabel={trip.destination.label} driverLabel={driver.locationLabel} routeGeometry={getDemoRouteGeometry(trip.origin.zoneId, trip.destination.zoneId)} /></div><BottomSheet className="flow-sheet"><TripProgress status="in-progress" /><ScreenTitle title="Viaje en curso" subtitle="Recorrido demo sobre calles de la zona." /><DriverCard compact demoDriver={driver} demoVehicle={vehicle} /><div className="in-progress-detail"><div><span>Origen</span><strong>{trip.origin.label}</strong></div><div><span>Destino</span><strong>{trip.destination.label}</strong></div><div><span>Precio</span><strong>{trip.price}</strong></div></div><DemoPanel actions={[{ label: 'DEBUG COMPLETE TRIP', onClick: () => { completeTrip(); navigate('/cliente/finalizado') } }, { label: 'RESET DEMO', onClick: reset }]} /><DemoRoleSwitcher current="CLIENT" /></BottomSheet></PageContainer>
}

function CompletedPage() {
  const navigate = useNavigate()
  const { state, resetDemo } = useDemo()
  const trip = state.activeTrip!
  const driver = getCurrentDriver(state)
  const vehicle = getCurrentVehicle(state)
  const [rating, setRating] = useState(5)
  return <PageContainer noNav className="simple-page completed-page"><AppHeader title="Viaje finalizado" /><div className="completed-content"><div className="success-icon"><CheckCircle2 size={30} /></div><ScreenTitle title="¡Llegaste a destino!" subtitle="Gracias por viajar con Remis Norte" /><div className="completed-card">{driver && <DriverCard compact demoDriver={driver} demoVehicle={vehicle} />}<div className="completed-route"><span>{trip.origin.label}</span><ArrowRight size={15} /><span>{trip.destination.label}</span></div><div className="completed-grid"><div><span>Tarifa</span><strong>{trip.price}</strong></div><div><span>Chofer</span><strong>{driver?.name ?? '—'}</strong></div><div><span>Vehículo</span><strong>{vehicle ? `${vehicle.make} ${vehicle.model}` : '—'}</strong></div></div></div><div className="rating-block"><h2>¿Cómo estuvo tu viaje?</h2><div className="stars">{[1, 2, 3, 4, 5].map((star) => <button key={star} className={star <= rating ? 'selected' : ''} onClick={() => setRating(star)} aria-label={`${star} estrellas`}><Star size={26} fill="currentColor" /></button>)}</div></div><PrimaryButton onClick={() => navigate('/cliente/viajes')}>VER HISTORIAL</PrimaryButton><button className="under-button" onClick={() => { resetDemo(); navigate('/cliente') }}>REINICIAR DEMO</button></div></PageContainer>
}

const statusToLegacy: Record<DemoTripStatus, TripStatus> = { REQUESTED: 'searching', ASSIGNED: 'assigned', DRIVER_EN_ROUTE: 'assigned', ARRIVED: 'arrived', IN_PROGRESS: 'in-progress', COMPLETED: 'completed', CANCELLED: 'cancelled' }
function toLegacyTrip(trip: DemoTrip, state: ReturnType<typeof useDemo>['state']): Trip {
  const driver = state.drivers.find((item) => item.id === trip.driverId)
  const vehicle = state.vehicles.find((item) => item.id === trip.vehicleId)
  const old = legacyHistory.find((item) => item.id === trip.id)
  return { id: trip.id, date: old?.date ?? 'Demo actual', time: old?.time ?? '—', origin: trip.origin.label, destination: trip.destination.label, driver: driver?.name ?? '—', vehicle: vehicle ? `${vehicle.make} ${vehicle.model}` : '—', plate: vehicle?.plate ?? '—', mobile: vehicle?.mobile ?? '—', price: trip.price, payment: old?.payment ?? '—', status: statusToLegacy[trip.status], ...(old?.duration ? { duration: old.duration } : {}) }
}

function HistoryPage() {
  const navigate = useNavigate()
  const { state } = useDemo()
  const [filter, setFilter] = useState<'Todos' | 'Completados' | 'Cancelados'>('Todos')
  const trips = state.tripHistory.map((trip) => toLegacyTrip(trip, state))
  const filtered = trips.filter((trip) => filter === 'Todos' || (filter === 'Completados' && trip.status === 'completed') || (filter === 'Cancelados' && trip.status === 'cancelled'))
  return <PageContainer className="simple-page"><AppHeader title="Mis viajes" /><div className="simple-content"><ScreenTitle title="Mis viajes" subtitle="Tu actividad reciente" /><div className="filter-row">{(['Todos', 'Completados', 'Cancelados'] as const).map((item) => <button key={item} className={filter === item ? 'selected' : ''} onClick={() => setFilter(item)}>{item}</button>)}</div><div className="trip-list">{filtered.map((trip) => <TripCard key={trip.id} trip={trip} onClick={() => navigate(`/cliente/viajes/${trip.id}`)} />)}</div></div></PageContainer>
}

function TripDetailPage() {
  const navigate = useNavigate()
  const { id } = useParams()
  const { state } = useDemo()
  const trip = state.tripHistory.map((item) => toLegacyTrip(item, state)).find((item) => item.id === id)
  if (!trip) return <Navigate to="/cliente/viajes" replace />
  return <PageContainer noNav className="simple-page"><AppHeader back title="Detalle del viaje" onBack={() => navigate('/cliente/viajes')} /><div className="simple-content"><div className="detail-heading"><span className="eyebrow">{trip.date} · {trip.time}</span><StatusBadge status={trip.status} /></div><h1>{trip.destination}</h1><div className="mini-route"><div className="mini-map-route" /><span>{trip.origin}</span><span>{trip.destination}</span></div><div className="detail-list"><DetailRow label="Chofer" value={trip.driver} /><DetailRow label="Vehículo" value={trip.vehicle} /><DetailRow label="Patente" value={trip.plate} /><DetailRow label="Móvil" value={trip.mobile} /><DetailRow label="Precio" value={trip.price} /><DetailRow label="Forma de pago" value={trip.payment} /><DetailRow label="Duración" value={trip.duration ?? '—'} /></div></div></PageContainer>
}

function DetailRow({ label, value }: { label: string; value: string }) { return <div className="detail-row"><span>{label}</span><strong>{value}</strong></div> }

function CancelledPage() {
  const { state, resetDemo } = useDemo()
  const navigate = useNavigate()
  const trip = state.activeTrip!
  return <PageContainer noNav className="simple-page"><AppHeader title="Solicitud cancelada" /><div className="simple-content"><ScreenTitle title="Viaje cancelado" subtitle="La solicitud quedó registrada en el historial demo." /><TripSummary origin={trip.origin.label} destination={trip.destination.label} showPayment={false} /><PrimaryButton onClick={() => navigate('/cliente')}>VOLVER AL INICIO</PrimaryButton><DemoPanel actions={[{ label: 'RESET DEMO', onClick: () => { resetDemo(); navigate('/cliente') } }]} /></div></PageContainer>
}

function HelpPage() {
  const helpItems = [{ label: 'Contactar a la central', icon: Phone }, { label: 'Problema con un viaje', icon: MessageCircle }, { label: 'Objeto olvidado', icon: Search }, { label: 'Preguntas frecuentes', icon: HelpCircle }, { label: 'Emergencia', icon: ShieldAlert }]
  return <PageContainer className="simple-page"><AppHeader title="Ayuda" /><div className="simple-content"><ScreenTitle title="¿En qué podemos ayudarte?" subtitle="Estamos para acompañarte en cada viaje." /><div className="help-list">{helpItems.map(({ label, icon: Icon }) => <div className="help-card" key={label}><span className="help-icon"><Icon size={19} /></span><span>{label}</span><small>Atención no conectada en esta demo</small></div>)}</div><div className="info-card help-note"><CircleHelp size={18} /> Para una urgencia, comunicate directamente con la central.</div></div></PageContainer>
}

function ProfilePage() {
  const navigate = useNavigate()
  const { state } = useDemo()
  const items = [{ label: 'Teléfono', value: state.passenger.phone, icon: Phone }, { label: 'Nombre', value: state.passenger.name, icon: UserRound }, { label: 'Destinos guardados', value: 'Casa · Trabajo', icon: HeartPulse }, { label: 'Métodos de pago', value: 'Efectivo · Mercado Pago', icon: WalletCards }, { label: 'Notificaciones', value: 'Activadas', icon: Bell }]
  return <PageContainer className="simple-page"><AppHeader title="Perfil" /><div className="simple-content"><div className="profile-hero"><div className="profile-avatar">{state.passenger.name[0]}</div><div><h1>{state.passenger.name}</h1><p>Cliente de Remis Norte</p></div></div><div className="profile-section"><span className="eyebrow">Mi cuenta</span>{items.map(({ label, value, icon: Icon }) => <div className="profile-row" key={label}><span className="profile-row-icon"><Icon size={17} /></span><span><small>{label}</small><strong>{value}</strong></span><ChevronRight size={17} /></div>)}</div><div className="profile-section"><span className="eyebrow">Ubicaciones guardadas</span><div className="saved-location"><span className="saved-icon"><Home size={17} /></span><span><strong>Casa</strong><small>{state.passenger.homeAddress}</small></span></div><div className="saved-location"><span className="saved-icon"><BriefcaseBusiness size={17} /></span><span><strong>Trabajo</strong><small>UNJu - Sede Libertador</small></span></div></div><button className="logout-button" onClick={() => navigate('/cliente')}>Volver al inicio</button></div></PageContainer>
}

function FaresPage() {
  const navigate = useNavigate()
  return <PageContainer noNav className="simple-page"><AppHeader back title="Cuadro tarifario" onBack={() => navigate('/cliente')} /><div className="simple-content"><ScreenTitle title="Tarifas vigentes" subtitle={`Vigentes desde ${fareVersion.effectiveFrom}`} /><div className="fare-list">{fares.map((fare) => <div className="fare-row" key={fare.id}><div><strong>{fare.originZone} <ArrowRight size={14} /> {fare.destinationZone}</strong><span>Tarifa por zona</span></div><b>{fare.price}</b></div>)}</div><div className="info-card fare-note"><CreditCard size={17} /> Las tarifas son definidas por la agencia según el cuadro tarifario vigente.</div></div></PageContainer>
}

function GuardedClientRoute({ children }: { children: React.ReactNode }) {
  const location = useLocation()
  const { state } = useDemo()
  const redirect = getClientRouteGuard(location.pathname, state)
  return redirect ? <Navigate to={redirect} replace /> : <>{children}</>
}

function AppRoutes() {
  return <Routes><Route path="/" element={<Navigate to="/demo" replace />} /><Route path="/demo" element={<DemoLanding />} /><Route path="/cliente" element={<HomePage />} /><Route path="/cliente/buscar" element={<SearchPage />} /><Route path="/cliente/viaje" element={<TripPreviewPage />} />
    <Route path="/cliente/buscando" element={<GuardedClientRoute><SearchingPage /></GuardedClientRoute>} /><Route path="/cliente/asignado" element={<GuardedClientRoute><AssignedPage /></GuardedClientRoute>} /><Route path="/cliente/en-camino" element={<GuardedClientRoute><AssignedPage /></GuardedClientRoute>} /><Route path="/cliente/llego" element={<GuardedClientRoute><ArrivedPage /></GuardedClientRoute>} /><Route path="/cliente/en-viaje" element={<GuardedClientRoute><InProgressPage /></GuardedClientRoute>} /><Route path="/cliente/finalizado" element={<GuardedClientRoute><CompletedPage /></GuardedClientRoute>} /><Route path="/cliente/cancelado" element={<GuardedClientRoute><CancelledPage /></GuardedClientRoute>} />
    <Route path="/cliente/viajes" element={<HistoryPage />} /><Route path="/cliente/viajes/:id" element={<TripDetailPage />} /><Route path="/cliente/ayuda" element={<HelpPage />} /><Route path="/cliente/perfil" element={<ProfilePage />} /><Route path="/cliente/tarifas" element={<FaresPage />} /><Route path="/chofer/*" element={<DriverRoutes />} /><Route path="/central/*" element={<CentralRoutes />} /><Route path="*" element={<Navigate to="/cliente" replace />} /></Routes>
}

export default function App() { return <DemoProvider><DriverSessionProvider><BrowserRouter><AppRoutes /></BrowserRouter></DriverSessionProvider></DemoProvider> }
