import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useClient } from '../ClientProvider'
import { CLIENT_PATHS } from '../domain/client-routes'
import { quoteMockFare } from '../domain/fare'
import { MapView } from '../MapView'
import { Button, PlaceRow, Screen, TopBar } from '../ui'

export function ConfirmTripScreen() {
  const navigate = useNavigate()
  const { state, dispatch } = useClient()
  const { pickup, destination } = state.draft
  const [submitting, setSubmitting] = useState(false)
  const lock = useRef(false)
  if (!pickup || !destination) return null
  const fare = quoteMockFare(pickup.zoneId, destination.zoneId)

  const request = () => {
    if (lock.current) return
    lock.current = true
    setSubmitting(true)
    dispatch({ type: 'REQUEST_TRIP', fareAmount: fare.amount, fareFormatted: fare.formatted, now: Date.now() })
    navigate(CLIENT_PATHS.trip, { replace: true })
  }

  return <Screen className="cl-confirm">
    <TopBar title="Tu viaje" onBack={() => navigate(CLIENT_PATHS.destination, { replace: true })} />
    <MapView className="cl-confirm-map" pickup={pickup} destination={destination} />
    <section className="cl-sheet">
      <div className="cl-place-list">
        <PlaceRow kind="pickup" place={pickup} placeholder="" onClick={() => navigate(CLIENT_PATHS.pickup)} />
        <PlaceRow kind="destination" place={destination} placeholder="" onClick={() => navigate(CLIENT_PATHS.destination)} />
      </div>
      <div className="cl-fare" aria-live="polite">
        <span>Tarifa</span>
        <strong>{fare.formatted}</strong>
        <small>Precio fijo por zona</small>
      </div>
      <Button onClick={request} disabled={submitting}>{submitting ? 'Pidiendo…' : 'PEDIR REMIS'}</Button>
    </section>
  </Screen>
}
