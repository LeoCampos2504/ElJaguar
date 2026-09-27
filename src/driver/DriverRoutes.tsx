import { useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { ArrowRight, Bell, CarFront, CheckCircle2, Clock3, Home, MapPin, UserRound } from 'lucide-react'
import { AppHeader, AppMap, DemoRoleSwitcher, PageContainer, PrimaryButton, ScreenTitle, SecondaryButton } from '../components'
import { useDemo } from '../demo/use-demo'
import type { DemoDriver, DemoDriverAvailability, DemoTrip } from '../demo/types'
import { getClientRouteForTripState } from '../client-flow'
import { getOfferForDriver, getDriverHistory, getDriverLandingRoute, getDriverRouteGuard, getTripForDriver } from './driver-flow'
import { useDriverSession } from './driver-session'
import { getDemoRouteGeometry, getDriverApproachGeometry } from '../demo/map-routes'

const availabilityLabel: Record<DemoDriverAvailability, string> = {
  AVAILABLE: 'Disponible',
  UNAVAILABLE: 'No disponible',
  OFFLINE: 'Fuera de línea',
  BUSY: 'En viaje',
}

const tripStatusLabel: Record<DemoTrip['status'], string> = {
  REQUESTED: 'Buscando chofer',
  ASSIGNED: 'Asignado',
  DRIVER_EN_ROUTE: 'En camino al pasajero',
  ARRIVED: 'Llegó al pasajero',
  IN_PROGRESS: 'En curso',
  COMPLETED: 'Completado',
  CANCELLED: 'Cancelado',
}

function getDriver(state: ReturnType<typeof useDemo>['state'], driverId: string | null): DemoDriver | null {
  return driverId ? state.drivers.find((driver) => driver.id === driverId) ?? null : null
}

function IncomingTripRequest({ driverId }: { driverId: string }) {
  const navigate = useNavigate()
  const { state, acceptCurrentOfferAsDriver, rejectCurrentOfferAsDriver } = useDemo()
  const offer = getOfferForDriver(state, driverId)
  const trip = state.activeTrip
  const driver = getDriver(state, driverId)
  if (!offer || !trip || !driver || trip.id !== offer.tripId) return null
  const approach = getDriverApproachGeometry(driver.id, trip.origin.zoneId)
  return <div className="incoming-request-backdrop" role="presentation">
    <section className="incoming-request-sheet" role="dialog" aria-modal="true" aria-labelledby="incoming-request-title" key={`${driver.id}:${offer.id}`}>
      <div className="incoming-request-grabber" />
      <div className="incoming-request-heading"><span className="incoming-request-bell"><Bell size={23} /><i /></span><div><span className="incoming-request-badge">VIAJE DISPONIBLE</span><h2 id="incoming-request-title">Nueva solicitud</h2><p>Nueva solicitud recibida para tu móvil.</p></div></div>
      <div className="incoming-request-map"><AppMap mode="preview" origin={trip.origin} destination={trip.destination} driver={driver} originLabel={trip.origin.label} destinationLabel={trip.destination.label} driverLabel={driver.locationLabel} routeGeometry={getDemoRouteGeometry(trip.origin.zoneId, trip.destination.zoneId)} driverRouteGeometry={approach} /></div>
      <div className="incoming-request-route"><div><span className="route-dot pickup" /><span><small>ORIGEN</small><strong>{trip.origin.label}</strong></span></div><div><span className="route-dot destination" /><span><small>DESTINO</small><strong>{trip.destination.label}</strong></span></div></div>
      <div className="incoming-request-facts"><div><span>Tarifa</span><strong>{trip.price}</strong></div><div><span>Distancia demo al pasajero</span><strong>{(driver.distanceMeters / 1000).toFixed(1)} km</strong></div></div>
      <div className="incoming-request-actions">
        <button className="incoming-reject-button" onClick={() => { rejectCurrentOfferAsDriver(driver.id); navigate('/chofer/inicio', { replace: true }) }}>RECHAZAR</button>
        <button className="incoming-accept-button" onClick={() => { acceptCurrentOfferAsDriver(driver.id); navigate('/chofer/viaje', { replace: true }) }}>ACEPTAR</button>
      </div>
      <span className="incoming-request-exclusivity">Solicitud exclusiva para este móvil</span>
    </section>
  </div>
}

function DriverGuard({ children }: { children: React.ReactNode }) {
  const location = useLocation()
  const { state } = useDemo()
  const { selectedDriverId } = useDriverSession()
  const redirect = getDriverRouteGuard(location.pathname, selectedDriverId, state)
  return redirect ? <Navigate to={redirect} replace /> : <>{children}</>
}

function DriverEntry() {
  const { state } = useDemo()
  const { selectedDriverId } = useDriverSession()
  return <Navigate to={getDriverLandingRoute(state, selectedDriverId)} replace />
}

function DriverLoginPage() {
  const navigate = useNavigate()
  const { state } = useDemo()
  const { selectedDriverId, selectDriver } = useDriverSession()
  return <PageContainer noNav className="driver-page driver-login-page">
    <AppHeader title="Modo Chofer" />
    <div className="driver-role-switcher-wrap"><DemoRoleSwitcher current="DRIVER" /></div>
    <div className="driver-content">
      <ScreenTitle eyebrow="ACCESO DEMO" title="Ingresá a tu móvil" subtitle="Elegí uno de los perfiles de prueba. No requiere contraseña ni representa autenticación real." />
      <div className="driver-login-list">{state.drivers.map((driver) => {
        const vehicle = state.vehicles.find((item) => item.id === driver.vehicleId)
        return <article className={`driver-login-card${driver.id === selectedDriverId ? ' selected' : ''}`} key={driver.id}>
          <div className="driver-login-avatar" style={{ background: `${driver.color}18`, color: driver.color }}><UserRound size={22} /></div>
          <div className="driver-login-copy"><strong>{driver.name}</strong><span>Móvil {vehicle?.mobile ?? '—'} · {vehicle ? `${vehicle.make} ${vehicle.model}` : 'Vehículo demo'}</span><span>{vehicle?.plate ?? '—'} · {vehicle?.color ?? '—'}</span><small className={`driver-status-text status-${driver.availability.toLowerCase()}`}>{availabilityLabel[driver.availability]}</small></div>
          <button className="driver-select-button" onClick={() => { selectDriver(driver.id); navigate('/chofer/inicio') }}>INGRESAR <ArrowRight size={15} /></button>
        </article>
      })}</div>
      <div className="driver-demo-notice"><strong>Acceso demo</strong><span>La identidad se mantiene sólo durante esta navegación y se pierde al recargar la página.</span></div>
    </div>
  </PageContainer>
}

function DriverBottomNav() {
  const navigate = useNavigate()
  const path = useLocation().pathname
  const items = [
    { label: 'Inicio', icon: Home, route: '/chofer/inicio' },
    { label: 'Viajes', icon: Clock3, route: '/chofer/viajes' },
    { label: 'Perfil', icon: UserRound, route: '/chofer/perfil' },
  ]
  return <nav className="driver-bottom-nav" aria-label="Navegación Chofer">{items.map(({ label, icon: Icon, route }) => <button key={route} className={path === route ? 'active' : ''} onClick={() => navigate(route)}><Icon size={20} /><span>{label}</span></button>)}</nav>
}

function DriverPage({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <PageContainer noNav className={`driver-page ${className}`}>{children}<div className="driver-role-switcher-wrap"><DemoRoleSwitcher current="DRIVER" /></div><DriverBottomNav /></PageContainer>
}

function DriverHomePage() {
  const navigate = useNavigate()
  const { state, setDriverAvailabilityAsDriver } = useDemo()
  const { selectedDriverId } = useDriverSession()
  const driver = getDriver(state, selectedDriverId)!
  const vehicle = state.vehicles.find((item) => item.id === driver.vehicleId)
  const offer = getOfferForDriver(state, selectedDriverId)
  const trip = getTripForDriver(state, selectedDriverId)
  const busy = !!trip && ['ASSIGNED', 'DRIVER_EN_ROUTE', 'ARRIVED', 'IN_PROGRESS'].includes(trip.status)
  const availabilityLocked = !!offer || busy || driver.availability === 'BUSY'
  const cancelled = trip?.status === 'CANCELLED'
  const availability = driver.availability
  const toggleAvailability = () => setDriverAvailabilityAsDriver(
    driver.id,
    availability === 'AVAILABLE' ? 'UNAVAILABLE' : 'AVAILABLE',
  )
  let statusTitle = 'Estás disponible'
  let statusDescription = 'Esperando solicitudes. Te avisaremos cuando llegue una nueva oferta.'
  if (availability === 'UNAVAILABLE') {
    statusTitle = 'No estás recibiendo viajes'
    statusDescription = 'Activá tu disponibilidad cuando quieras volver a recibir solicitudes.'
  } else if (availability === 'OFFLINE') {
    statusTitle = 'Fuera de línea'
    statusDescription = 'Conectate para recibir solicitudes demo.'
  } else if (availability === 'BUSY' || busy) {
    statusTitle = 'Tenés un viaje en curso'
    statusDescription = trip ? `${trip.origin.label} → ${trip.destination.label}` : 'Tu móvil está ocupado.'
  }
  return <DriverPage className="driver-home-page">
    <AppHeader title="Modo Chofer" />
    <div className="driver-content">
      <div className="driver-welcome"><span className="eyebrow">BUEN DÍA</span><h1>Hola, {driver.name.split(' ')[0]}</h1><p>Móvil {vehicle?.mobile ?? '—'} · {vehicle ? `${vehicle.make} ${vehicle.model}` : 'Vehículo demo'}</p></div>
      <section className={`driver-availability-card availability-${availability.toLowerCase()}`}>
        <div className="availability-indicator"><span />{availabilityLabel[availability]}</div>
        <h2>{statusTitle}</h2><p>{statusDescription}</p>
        {busy && trip && <PrimaryButton onClick={() => navigate('/chofer/viaje')}>VER VIAJE ACTUAL</PrimaryButton>}
        <button className={`availability-toggle${availability === 'AVAILABLE' ? ' on' : ''}`} disabled={availabilityLocked} onClick={toggleAvailability} aria-pressed={availability === 'AVAILABLE'}><span className="toggle-track"><span /></span><span>{availability === 'AVAILABLE' ? 'DISPONIBLE' : 'NO DISPONIBLE'}</span></button>
        {availabilityLocked && <small className="availability-lock-note">No podés cambiar disponibilidad con una oferta o un viaje activo.</small>}
      </section>
      {cancelled && <div className="driver-cancellation-notice" role="status"><strong>El pasajero canceló el viaje.</strong><span>Volviste a estar disponible para nuevas solicitudes.</span></div>}
      <section className="driver-location-card"><span className="driver-section-icon"><MapPin size={18} /></span><div><span className="eyebrow">UBICACIÓN DEMO</span><strong>{driver.locationLabel}</strong><small>Ubicación ilustrativa · sin GPS</small></div></section>
      <button className="driver-change-profile" onClick={() => navigate('/chofer/ingreso')}>CAMBIAR MÓVIL DEMO <ArrowRight size={14} /></button>
      {offer && <IncomingTripRequest key={`${driver.id}:${offer.id}`} driverId={driver.id} />}
    </div>
  </DriverPage>
}

function DriverOfferPage() {
  const { selectedDriverId } = useDriverSession()
  return <DriverPage className="driver-offer-page">{selectedDriverId && <IncomingTripRequest key={`${selectedDriverId}:offer-route`} driverId={selectedDriverId} />}</DriverPage>
}

function DriverTripPage() {
  const navigate = useNavigate()
  const { state, markDriverEnRouteAsDriver, markDriverArrivedAsDriver, startTripAsDriver, completeTripAsDriver } = useDemo()
  const { selectedDriverId } = useDriverSession()
  const trip = getTripForDriver(state, selectedDriverId)!
  const driver = getDriver(state, selectedDriverId)!
  const vehicle = state.vehicles.find((item) => item.id === trip.vehicleId)
  const approach = trip.status === 'DRIVER_EN_ROUTE' ? getDriverApproachGeometry(driver.id, trip.origin.zoneId) : null
  const [confirmComplete, setConfirmComplete] = useState(false)
  const routePoints = <section className="driver-offer-route"><div className="driver-route-point"><span className="route-dot pickup" /><div><small>ORIGEN</small><strong>{trip.origin.label}</strong></div></div><div className="driver-route-point"><span className="route-dot destination" /><div><small>DESTINO</small><strong>{trip.destination.label}</strong></div></div></section>
  const details = <section className="driver-trip-facts"><div><span>Pasajero</span><strong>{trip.passengerDisplayName ?? state.passenger.name}</strong></div>{trip.contactPhone && <div><span>Teléfono</span><strong>{trip.contactPhone}</strong></div>}<div><span>Tarifa</span><strong>{trip.price}</strong></div><div><span>Vehículo</span><strong>{vehicle ? `${vehicle.make} ${vehicle.model} · ${vehicle.plate}` : '—'}</strong></div></section>
  const finish = () => { completeTripAsDriver(driver.id); navigate('/chofer/viaje', { replace: true }) }
  let title = 'Viaje en curso'
  let subtitle = 'Seguí las indicaciones del recorrido demo.'
  let action: React.ReactNode = null
  if (trip.status === 'ASSIGNED') {
    title = 'Viaje asignado'
    subtitle = 'La tarifa y el recorrido ya están confirmados.'
    action = <PrimaryButton onClick={() => markDriverEnRouteAsDriver(driver.id)}>IR A BUSCAR AL PASAJERO</PrimaryButton>
  } else if (trip.status === 'DRIVER_EN_ROUTE') {
    title = 'En camino al pasajero'
    subtitle = `Ubicación demo: ${driver.locationLabel}. No se usa GPS real.`
    action = <PrimaryButton onClick={() => markDriverArrivedAsDriver(driver.id)}>LLEGUÉ</PrimaryButton>
  } else if (trip.status === 'ARRIVED') {
    title = 'Llegaste al punto de recogida'
    subtitle = `Pasajero: ${trip.passengerDisplayName ?? state.passenger.name}`
    action = <PrimaryButton onClick={() => startTripAsDriver(driver.id)}>INICIAR VIAJE</PrimaryButton>
  } else if (trip.status === 'IN_PROGRESS') {
    title = 'Viaje en curso'
    action = confirmComplete
      ? <div className="driver-confirm-card" role="group" aria-label="Confirmar finalización"><strong>¿Finalizar viaje?</strong><span>El viaje pasará al historial y volverás a estar disponible.</span><PrimaryButton onClick={finish}>CONFIRMAR FINALIZACIÓN</PrimaryButton><button className="under-button" onClick={() => setConfirmComplete(false)}>SEGUIR EN VIAJE</button></div>
      : <PrimaryButton onClick={() => setConfirmComplete(true)}>FINALIZAR VIAJE</PrimaryButton>
  } else if (trip.status === 'COMPLETED') {
    title = 'Viaje finalizado'
    subtitle = 'El recorrido quedó registrado en tu historial.'
  } else if (trip.status === 'CANCELLED') {
    title = 'Viaje cancelado'
    subtitle = 'El pasajero canceló el viaje.'
  }
  return <DriverPage className="driver-trip-page">
    <AppHeader title="Mi viaje" />
    <div className="driver-content">
      <div className={`driver-trip-status status-${trip.status.toLowerCase()}`}><span><CarFront size={18} /></span><div><small>ESTADO DEL VIAJE</small><strong>{tripStatusLabel[trip.status]}</strong></div></div>
      <ScreenTitle eyebrow="MODO CHOFER" title={title} subtitle={subtitle} />
      {trip.status === 'CANCELLED' && <div className="driver-cancellation-notice" role="status"><strong>El pasajero canceló el viaje.</strong><span>El viaje ya no está activo y no se puede continuar.</span></div>}
      {trip.status === 'COMPLETED' && <div className="driver-completed-notice" role="status"><CheckCircle2 size={20} /><strong>Ya estás disponible</strong><span>El viaje quedó registrado en tu historial.</span></div>}
      {trip.status !== 'COMPLETED' && trip.status !== 'CANCELLED' && <div className="driver-trip-map"><AppMap mode="assigned" origin={trip.origin} destination={trip.destination} driver={driver} originLabel={trip.origin.label} destinationLabel={trip.destination.label} driverLabel={driver.locationLabel} routeGeometry={getDemoRouteGeometry(trip.origin.zoneId, trip.destination.zoneId)} driverRouteGeometry={approach} /></div>}
      {routePoints}{details}
      {action}
      {trip.status !== 'COMPLETED' && trip.status !== 'CANCELLED' && <button className="driver-mode-link" onClick={() => navigate(getClientRouteForTripState(trip))}>VER ESTADO EN MODO CLIENTE <ArrowRight size={14} /></button>}
      {trip.status === 'COMPLETED' && <SecondaryButton onClick={() => navigate('/cliente/finalizado')}>VER VIAJE COMO PASAJERO</SecondaryButton>}
      {(trip.status === 'COMPLETED' || trip.status === 'CANCELLED') && <SecondaryButton onClick={() => navigate('/chofer/inicio')}>VOLVER AL INICIO</SecondaryButton>}
    </div>
  </DriverPage>
}

function DriverHistoryPage() {
  const { state } = useDemo()
  const { selectedDriverId } = useDriverSession()
  const history = getDriverHistory(state, selectedDriverId)
  return <DriverPage className="driver-history-page"><AppHeader title="Mis viajes" /><div className="driver-content"><ScreenTitle eyebrow="MODO CHOFER" title="Historial" subtitle="Viajes asociados a tu perfil demo. La tarifa no representa ganancia neta." />{history.length === 0 ? <div className="driver-empty-state"><Clock3 size={23} /><strong>Todavía no tenés viajes</strong><span>Los viajes que completes aparecerán acá.</span></div> : <div className="driver-history-list">{history.map((trip) => <article className="driver-history-card" key={trip.id}><div className="driver-history-heading"><strong>{trip.destination.label}</strong><span className={`trip-status-pill trip-${trip.status.toLowerCase()}`}>{tripStatusLabel[trip.status]}</span></div><div className="driver-history-route"><span>{trip.origin.label}</span><ArrowRight size={14} /><span>{trip.destination.label}</span></div><div className="driver-history-footer"><span>Tarifa del pasajero</span><strong>{trip.price}</strong></div></article>)}</div>}</div></DriverPage>
}

function DriverProfilePage() {
  const navigate = useNavigate()
  const { state } = useDemo()
  const { selectedDriverId, closeDriverSession } = useDriverSession()
  const driver = getDriver(state, selectedDriverId)!
  const vehicle = state.vehicles.find((item) => item.id === driver.vehicleId)
  const signOut = () => { closeDriverSession(); navigate('/chofer/ingreso', { replace: true }) }
  return <DriverPage className="driver-profile-page"><AppHeader title="Perfil" /><div className="driver-content"><div className="driver-profile-hero"><div className="driver-profile-avatar" style={{ background: `${driver.color}18`, color: driver.color }}><UserRound size={26} /></div><div><h1>{driver.name}</h1><p>Perfil de acceso demo</p></div></div><section className="driver-profile-section"><span className="eyebrow">MI MÓVIL</span><div><span>Móvil</span><strong>{vehicle?.mobile ?? '—'}</strong></div><div><span>Vehículo</span><strong>{vehicle ? `${vehicle.make} ${vehicle.model}` : '—'}</strong></div><div><span>Patente</span><strong>{vehicle?.plate ?? '—'}</strong></div><div><span>Color</span><strong>{vehicle?.color ?? '—'}</strong></div><div><span>Estado</span><strong>{availabilityLabel[driver.availability]}</strong></div></section><div className="driver-profile-actions"><SecondaryButton onClick={() => navigate('/chofer/ingreso')}>CAMBIAR CHOFER DEMO</SecondaryButton><button className="driver-logout-button" onClick={signOut}>CERRAR SESIÓN DEMO</button></div></div></DriverPage>
}

export function DriverRoutes() {
  const path = useLocation().pathname
  if (path === '/chofer') return <DriverEntry />
  if (path === '/chofer/ingreso') return <DriverLoginPage />
  if (path === '/chofer/inicio') return <DriverGuard><DriverHomePage /></DriverGuard>
  if (path === '/chofer/oferta') return <DriverGuard><DriverOfferPage /></DriverGuard>
  if (path === '/chofer/viaje') return <DriverGuard><DriverTripPage /></DriverGuard>
  if (path === '/chofer/viajes') return <DriverGuard><DriverHistoryPage /></DriverGuard>
  if (path === '/chofer/perfil') return <DriverGuard><DriverProfilePage /></DriverGuard>
  return <Navigate to="/chofer" replace />
}
