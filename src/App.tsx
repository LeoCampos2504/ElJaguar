import { useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Bell, BriefcaseBusiness, CheckCircle2, ChevronRight, CircleHelp, Clock3, CreditCard, HeartPulse, HelpCircle, Home, MapPin, MessageCircle, Phone, Search, ShieldAlert, Star, UserRound, WalletCards, X } from 'lucide-react'
import { AppHeader, AppMap, BottomSheet, DemoPanel, DriverCard, DriverInfo, FareCard, FareUpdateDialog, LocationRow, PageContainer, PrimaryButton, QuickDestination, ScreenTitle, SearchField, SecondaryButton, StatusBadge, TripCard, TripProgress, TripSummary } from './components'
import { customer, driver, fareVersion, fares, quickDestinations, recentDestinations, tripHistory, tripMock } from './mock-data'
import { DemoProvider } from './demo/demo-state'

function HomePage() {
  const navigate = useNavigate()
  const [showFareDialog, setShowFareDialog] = useState(true)
  const goToTrip = (destination: string) => navigate(`/cliente/viaje?destino=${encodeURIComponent(destination)}`)
  return <PageContainer className="home-page">
    <AppHeader />
    <div className="home-intro"><span className="eyebrow">Buen día, {customer.name}</span><h1>¿A dónde querés ir?</h1></div>
    <div className="home-map-wrap"><AppMap /><BottomSheet className="home-sheet"><LocationRow title="Tu ubicación" address={customer.address} onClick={() => navigate('/cliente/buscar')} /><SearchField value="" onChange={() => undefined} onFocus={() => navigate('/cliente/buscar')} /><div className="section-heading"><h2>Destinos rápidos</h2></div><div className="quick-grid">{quickDestinations.map((destination) => <QuickDestination key={destination.label} {...destination} onClick={() => goToTrip(destination.address)} />)}</div><p className="soft-hint">Completá tu destino y automáticamente te mostraremos los detalles del viaje.</p></BottomSheet></div>
    {showFareDialog && <FareUpdateDialog onClose={() => setShowFareDialog(false)} onView={() => navigate('/cliente/tarifas')} />}
  </PageContainer>
}

function SearchPage() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const choices = query ? [...recentDestinations.filter((item) => item.toLowerCase().includes(query.toLowerCase())), 'Hospital O. Orías'].filter((item, index, all) => all.indexOf(item) === index) : recentDestinations
  return <PageContainer noNav className="search-page"><AppHeader back title="Elegí tu destino" onBack={() => navigate('/cliente')} /><div className="search-content"><SearchField value={query} onChange={setQuery} autoFocus /><div className="search-section"><span className="eyebrow">Destinos recientes</span>{choices.map((destination, index) => <button className="search-result" key={destination} onClick={() => navigate(`/cliente/viaje?destino=${encodeURIComponent(destination)}`)}><span className="recent-icon">{index === 0 ? <Clock3 size={17} /> : <MapPin size={17} />}</span><span><strong>{destination}</strong><small>{index === 0 ? 'Usado recientemente' : 'Libertador General San Martín'}</small></span><ChevronRight size={17} /></button>)}</div><div className="search-section"><span className="eyebrow">Destinos rápidos</span><div className="search-quick-grid">{quickDestinations.map((destination) => <QuickDestination key={destination.label} {...destination} onClick={() => navigate(`/cliente/viaje?destino=${encodeURIComponent(destination.address)}`)} />)}</div></div></div></PageContainer>
}

function TripPreviewPage() {
  const navigate = useNavigate()
  const destination = new URLSearchParams(window.location.search).get('destino') || tripMock.destination
  return <PageContainer noNav className="map-flow-page"><div className="flow-map"><AppHeader back title="Detalle del viaje" onBack={() => navigate('/cliente')} /><AppMap mode="preview" /></div><BottomSheet className="flow-sheet"><ScreenTitle title="Ver viaje" /><TripSummary destination={destination} /><FareCard /><button className="text-link" onClick={() => navigate('/cliente/tarifas')}>Ver cuadro de tarifas <ArrowRight size={15} /></button><PrimaryButton onClick={() => navigate('/cliente/buscando')}>SOLICITAR REMIS</PrimaryButton><button className="under-button" onClick={() => navigate('/cliente/buscar')}>Cambiar destino</button><div className="destination-note">Destino seleccionado: <strong>{destination}</strong></div></BottomSheet></PageContainer>
}

function SearchingPage() {
  const navigate = useNavigate()
  return <PageContainer noNav className="map-flow-page state-page"><div className="flow-map"><AppHeader back title="Buscando móvil" onBack={() => navigate('/cliente/viaje')} /><AppMap mode="searching" /></div><BottomSheet className="flow-sheet"><div className="state-icon searching-icon"><span><span /><span /><span /></span></div><ScreenTitle title="Buscando móvil..." subtitle="Estamos avisando a los choferes cercanos" /><TripSummary showPayment={false} /><div className="confirmed-price"><strong>{tripMock.price}</strong><span>Tarifa por zona confirmada</span></div><div className="info-card">La central también puede asignar tu viaje si realizaste el pedido por teléfono.</div><SecondaryButton onClick={() => navigate('/cliente')}>Cancelar viaje</SecondaryButton><DemoPanel nextLabel="Simular móvil asignado" onNext={() => navigate('/cliente/en-camino')} /></BottomSheet></PageContainer>
}

function AssignedPage() {
  const navigate = useNavigate()
  return <PageContainer noNav className="map-flow-page state-page"><div className="flow-map"><AppHeader back title="Tu viaje" onBack={() => navigate('/cliente')} /><AppMap mode="assigned" /></div><BottomSheet className="flow-sheet"><TripProgress status="assigned" /><ScreenTitle title="Tu móvil está en camino" subtitle="Llega en 3 min" /><DriverCard /><div className="contact-actions"><button className="round-action"><Phone size={17} /><span>Llamar</span></button><button className="round-action muted"><X size={17} /><span>Cancelar</span></button></div><TripSummary showPayment={false} /><DemoPanel nextLabel="Simular móvil llegado" onNext={() => navigate('/cliente/llego')} /></BottomSheet></PageContainer>
}

function ArrivedPage() {
  const navigate = useNavigate()
  return <PageContainer noNav className="map-flow-page state-page"><div className="flow-map"><AppHeader back title="Tu viaje" onBack={() => navigate('/cliente')} /><AppMap mode="arrived" /></div><BottomSheet className="flow-sheet"><TripProgress status="arrived" /><div className="arrived-banner"><CheckCircle2 size={18} /><span>Tu remis ya está en el punto de recogida.</span></div><ScreenTitle title="Tu móvil llegó" subtitle="Carlos Pérez · Toyota Etios · Móvil 07" /><div className="vehicle-line"><strong>AB123CD</strong><span>Patente del vehículo</span></div><div className="contact-actions"><button className="round-action"><Phone size={17} /><span>Llamar al chofer</span></button><button className="round-action muted"><X size={17} /><span>Cancelar</span></button></div><DemoPanel nextLabel="Iniciar viaje" onNext={() => navigate('/cliente/en-viaje')} /></BottomSheet></PageContainer>
}

function InProgressPage() {
  const navigate = useNavigate()
  return <PageContainer noNav className="map-flow-page state-page"><div className="flow-map"><AppHeader back title="Tu viaje" onBack={() => navigate('/cliente')} /><AppMap mode="in-progress" /></div><BottomSheet className="flow-sheet"><TripProgress status="in-progress" /><ScreenTitle title="Viaje en curso" subtitle="Llegando a destino" /><DriverCard compact /><div className="in-progress-detail"><div><span>Destino</span><strong>{tripMock.destination}</strong></div><div><span>Precio</span><strong>{tripMock.price}</strong></div></div><DemoPanel nextLabel="Finalizar viaje" onNext={() => navigate('/cliente/finalizado')} /></BottomSheet></PageContainer>
}

function CompletedPage() {
  const navigate = useNavigate()
  const [rating, setRating] = useState(5)
  return <PageContainer noNav className="simple-page completed-page"><AppHeader title="Viaje finalizado" menu={false} /><div className="completed-content"><div className="success-icon"><CheckCircle2 size={30} /></div><ScreenTitle title="¡Llegaste a destino!" subtitle="Gracias por viajar con Remis Norte" /><div className="completed-card"><DriverCard compact /><div className="completed-route">{tripMock.origin}<ArrowRight size={15} />{tripMock.destination}</div><div className="completed-grid"><div><span>Tarifa</span><strong>{tripMock.price}</strong></div><div><span>Método de pago</span><strong>Efectivo</strong></div><div><span>Duración</span><strong>{tripMock.duration}</strong></div></div></div><div className="rating-block"><h2>¿Cómo estuvo tu viaje?</h2><div className="stars">{[1, 2, 3, 4, 5].map((star) => <button key={star} className={star <= rating ? 'selected' : ''} onClick={() => setRating(star)} aria-label={`${star} estrellas`}><Star size={26} fill="currentColor" /></button>)}</div></div><PrimaryButton onClick={() => navigate('/cliente')}>VOLVER AL INICIO</PrimaryButton></div></PageContainer>
}

function HistoryPage() {
  const navigate = useNavigate()
  const [filter, setFilter] = useState<'Todos' | 'Completados' | 'Cancelados'>('Todos')
  const filtered = tripHistory.filter((trip) => filter === 'Todos' || (filter === 'Completados' && trip.status === 'completed') || (filter === 'Cancelados' && trip.status === 'cancelled'))
  return <PageContainer className="simple-page"><AppHeader title="Mis viajes" /><div className="simple-content"><ScreenTitle title="Mis viajes" subtitle="Tu actividad reciente" /><div className="filter-row">{(['Todos', 'Completados', 'Cancelados'] as const).map((item) => <button key={item} className={filter === item ? 'selected' : ''} onClick={() => setFilter(item)}>{item}</button>)}</div><div className="trip-list">{filtered.map((trip) => <TripCard key={trip.id} trip={trip} onClick={() => navigate(`/cliente/viajes/${trip.id}`)} />)}</div></div></PageContainer>
}

function TripDetailPage() {
  const navigate = useNavigate()
  const { id } = useParams()
  const trip = tripHistory.find((item) => item.id === id) ?? tripHistory[0]
  return <PageContainer noNav className="simple-page"><AppHeader back title="Detalle del viaje" onBack={() => navigate('/cliente/viajes')} /><div className="simple-content"><div className="detail-heading"><span className="eyebrow">{trip.date} · {trip.time}</span><StatusBadge status={trip.status} /></div><h1>{trip.destination}</h1><div className="mini-route"><div className="mini-map-route" /><span>{trip.origin}</span><span>{trip.destination}</span></div><div className="detail-list"><DetailRow label="Chofer" value={trip.driver} /><DetailRow label="Vehículo" value={trip.vehicle} /><DetailRow label="Patente" value={trip.plate} /><DetailRow label="Móvil" value={trip.mobile} /><DetailRow label="Precio" value={trip.price} /><DetailRow label="Forma de pago" value={trip.payment} /><DetailRow label="Duración" value={trip.duration ?? '—'} /></div></div></PageContainer>
}

function DetailRow({ label, value }: { label: string; value: string }) { return <div className="detail-row"><span>{label}</span><strong>{value}</strong></div> }

function HelpPage() {
  const helpItems = [{ label: 'Contactar a la central', icon: Phone }, { label: 'Problema con un viaje', icon: MessageCircle }, { label: 'Objeto olvidado', icon: Search }, { label: 'Preguntas frecuentes', icon: HelpCircle }, { label: 'Emergencia', icon: ShieldAlert }]
  return <PageContainer className="simple-page"><AppHeader title="Ayuda" /><div className="simple-content"><ScreenTitle title="¿En qué podemos ayudarte?" subtitle="Estamos para acompañarte en cada viaje." /><div className="help-list">{helpItems.map(({ label, icon: Icon }) => <button className="help-card" key={label}><span className="help-icon"><Icon size={19} /></span><span>{label}</span><ChevronRight size={17} /></button>)}</div><div className="info-card help-note"><CircleHelp size={18} /> Para una urgencia, comunicate directamente con la central.</div></div></PageContainer>
}

function ProfilePage() {
  const navigate = useNavigate()
  const items = [{ label: 'Teléfono', value: customer.phone, icon: Phone }, { label: 'Nombre', value: customer.name, icon: UserRound }, { label: 'Destinos guardados', value: 'Casa · Trabajo', icon: HeartPulse }, { label: 'Métodos de pago', value: 'Efectivo · Mercado Pago', icon: WalletCards }, { label: 'Notificaciones', value: 'Activadas', icon: Bell }]
  return <PageContainer className="simple-page"><AppHeader title="Perfil" /><div className="simple-content"><div className="profile-hero"><div className="profile-avatar">L</div><div><h1>{customer.name}</h1><p>Cliente de Remis Norte</p></div></div><div className="profile-section"><span className="eyebrow">Mi cuenta</span>{items.map(({ label, value, icon: Icon }) => <div className="profile-row" key={label}><span className="profile-row-icon"><Icon size={17} /></span><span><small>{label}</small><strong>{value}</strong></span><ChevronRight size={17} /></div>)}</div><div className="profile-section"><span className="eyebrow">Ubicaciones guardadas</span><div className="saved-location"><span className="saved-icon"><Home size={17} /></span><span><strong>Casa</strong><small>{customer.address}</small></span></div><div className="saved-location"><span className="saved-icon"><BriefcaseBusiness size={17} /></span><span><strong>Trabajo</strong><small>UNJu - Sede Libertador</small></span></div></div><button className="logout-button" onClick={() => navigate('/cliente')}>Cerrar sesión</button></div></PageContainer>
}

function FaresPage() {
  const navigate = useNavigate()
  return <PageContainer noNav className="simple-page"><AppHeader back title="Cuadro tarifario" onBack={() => navigate('/cliente')} /><div className="simple-content"><ScreenTitle title="Tarifas vigentes" subtitle={`Vigentes desde ${fareVersion.effectiveFrom}`} /><div className="fare-list">{fares.map((fare) => <div className="fare-row" key={fare.id}><div><strong>{fare.originZone} <ArrowRight size={14} /> {fare.destinationZone}</strong><span>Tarifa por zona</span></div><b>{fare.price}</b></div>)}</div><div className="info-card fare-note"><CreditCard size={17} /> Las tarifas son definidas por la agencia según el cuadro tarifario vigente.</div></div></PageContainer>
}

function AppRoutes() {
  return <Routes><Route path="/" element={<Navigate to="/cliente" replace />} /><Route path="/cliente" element={<HomePage />} /><Route path="/cliente/buscar" element={<SearchPage />} /><Route path="/cliente/viaje" element={<TripPreviewPage />} /><Route path="/cliente/buscando" element={<SearchingPage />} /><Route path="/cliente/en-camino" element={<AssignedPage />} /><Route path="/cliente/llego" element={<ArrivedPage />} /><Route path="/cliente/en-viaje" element={<InProgressPage />} /><Route path="/cliente/finalizado" element={<CompletedPage />} /><Route path="/cliente/viajes" element={<HistoryPage />} /><Route path="/cliente/viajes/:id" element={<TripDetailPage />} /><Route path="/cliente/ayuda" element={<HelpPage />} /><Route path="/cliente/perfil" element={<ProfilePage />} /><Route path="/cliente/tarifas" element={<FaresPage />} /><Route path="*" element={<Navigate to="/cliente" replace />} /></Routes>
}

export default function App() { return <DemoProvider><BrowserRouter><AppRoutes /></BrowserRouter></DemoProvider> }
