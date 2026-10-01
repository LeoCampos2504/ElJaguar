import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CarFront, Check, CheckCircle2, Loader2, MapPinned, XCircle } from 'lucide-react'
import { useClient } from '../ClientProvider'
import { CLIENT_PATHS } from '../domain/client-routes'
import { canClientCancel, CLIENT_TRIP_PROGRESS, CLIENT_TRIP_STATUS_TEXT, isTerminalStatus, type ClientTrip } from '../domain/client-state'
import { MapView } from '../MapView'
import { Button, PlaceRow, Screen, TopBar } from '../ui'

function statusDescription(trip: ClientTrip): string {
  switch (trip.status) {
    case 'REQUESTED': return 'Le ofrecemos tu viaje a los choferes cercanos, de a uno por vez.'
    case 'ASSIGNED': return 'Un chofer aceptó tu viaje y en un momento sale a buscarte.'
    case 'DRIVER_EN_ROUTE': return `Esperalo en ${trip.pickup.label}.`
    case 'ARRIVED': return `Te espera en ${trip.pickup.label}.`
    case 'IN_PROGRESS': return `Vas a ${trip.destination.label}.`
    case 'COMPLETED': return 'Gracias por viajar con EL JAGUAR.'
    case 'CANCELLED': return 'El pedido fue cancelado.'
  }
}

function StatusIcon({ trip }: { trip: ClientTrip }) {
  if (trip.status === 'REQUESTED') return <Loader2 size={40} className="cl-spin" />
  if (trip.status === 'COMPLETED') return <CheckCircle2 size={40} />
  if (trip.status === 'CANCELLED') return <XCircle size={40} />
  if (trip.status === 'ARRIVED') return <MapPinned size={40} />
  return <CarFront size={40} />
}

function Progress({ trip }: { trip: ClientTrip }) {
  const current = CLIENT_TRIP_PROGRESS.indexOf(trip.status)
  return <ol className="cl-progress" aria-label="Estado del viaje">
    {CLIENT_TRIP_PROGRESS.map((status, index) => <li key={status} className={index < current ? 'done' : index === current ? 'current' : ''} aria-current={index === current ? 'step' : undefined}>
      <span className="cl-progress-dot">{index < current ? <Check size={14} /> : null}</span>
      <span>{CLIENT_TRIP_STATUS_TEXT[status].label}</span>
    </li>)}
  </ol>
}

export function TripStatusScreen() {
  const navigate = useNavigate()
  const { state, dispatch } = useClient()
  const [confirmingCancel, setConfirmingCancel] = useState(false)
  const trip = state.trip
  if (!trip) return null
  const text = CLIENT_TRIP_STATUS_TEXT[trip.status]
  const terminal = isTerminalStatus(trip.status)
  const cancellable = canClientCancel(trip.status)

  return <Screen className="cl-trip">
    <TopBar title="Tu viaje" />
    {!terminal && <MapView className="cl-trip-map" pickup={trip.pickup} destination={trip.destination} />}
    <section className={`cl-sheet cl-trip-sheet status-${trip.status.toLowerCase()}`}>
      <div className="cl-status" role="status" aria-live="polite">
        <span className="cl-status-icon"><StatusIcon trip={trip} /></span>
        <h2>{text.title}</h2>
        <p>{statusDescription(trip)}</p>
      </div>

      {trip.status !== 'CANCELLED' && <Progress trip={trip} />}

      {trip.driver && trip.status !== 'CANCELLED' && <div className="cl-driver">
        <span className="cl-driver-avatar" aria-hidden="true">{trip.driver.name.split(' ').map((part) => part[0]).join('').slice(0, 2)}</span>
        <div>
          <strong>{trip.driver.name}</strong>
          <span>{trip.driver.vehicle} · {trip.driver.color}</span>
          <span>Patente {trip.driver.plate} · Móvil {trip.driver.mobile}</span>
        </div>
      </div>}

      <div className="cl-place-list">
        <PlaceRow kind="pickup" place={trip.pickup} placeholder="" />
        <PlaceRow kind="destination" place={trip.destination} placeholder="" />
      </div>
      <div className="cl-fare cl-fare-compact"><span>Tarifa</span><strong>{trip.fareFormatted}</strong></div>

      {cancellable && !confirmingCancel && <Button variant="danger" onClick={() => setConfirmingCancel(true)}>Cancelar viaje</Button>}
      {cancellable && confirmingCancel && <div className="cl-confirm-cancel" role="alertdialog" aria-labelledby="cl-cancel-question">
        <p id="cl-cancel-question">¿Seguro que querés cancelar el viaje?</p>
        <Button variant="danger" onClick={() => { dispatch({ type: 'CANCEL_TRIP', now: Date.now() }); setConfirmingCancel(false) }}>Sí, cancelar</Button>
        <Button variant="secondary" onClick={() => setConfirmingCancel(false)}>No, seguir con el viaje</Button>
      </div>}
      {trip.status === 'IN_PROGRESS' && <p className="cl-hint">El viaje ya comenzó y no se puede cancelar.</p>}
      {terminal && <Button onClick={() => { dispatch({ type: 'FINISH_TRIP' }); navigate(CLIENT_PATHS.home, { replace: true }) }}>Volver al inicio</Button>}
    </section>
  </Screen>
}
