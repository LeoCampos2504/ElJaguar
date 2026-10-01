import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, MapPin, Search } from 'lucide-react'
import { useClient } from '../ClientProvider'
import { CLIENT_PATHS } from '../domain/client-routes'
import { filterReferencePoints, isSamePlace, placeFromMapPoint, REFERENCE_POINTS, type TripPlace } from '../domain/places'
import { MapView } from '../MapView'
import { Button, Screen, TopBar } from '../ui'

export function PlacePickerScreen({ kind }: { kind: 'pickup' | 'destination' }) {
  const navigate = useNavigate()
  const { state, dispatch } = useClient()
  const { pickup, destination } = state.draft
  const [query, setQuery] = useState('')
  const [candidate, setCandidate] = useState<TripPlace | null>(null)
  const [error, setError] = useState<string | null>(null)
  const isPickup = kind === 'pickup'
  const other = isPickup ? destination : pickup

  const choose = (place: TripPlace) => {
    if (isSamePlace(place, other)) {
      setCandidate(null)
      return setError(isPickup ? 'El punto de partida tiene que ser distinto del destino.' : 'El destino tiene que ser distinto del punto de partida.')
    }
    setError(null)
    if (isPickup) {
      dispatch({ type: 'SET_PICKUP', place })
      navigate(destination ? CLIENT_PATHS.confirm : CLIENT_PATHS.destination, { replace: true })
    } else {
      dispatch({ type: 'SET_DESTINATION', place })
      navigate(CLIENT_PATHS.confirm, { replace: true })
    }
  }

  const tapMap = (lat: number, lng: number) => {
    const result = placeFromMapPoint(lat, lng)
    if (!result.ok) {
      setCandidate(null)
      return setError('Ese punto está fuera de la zona de servicio.')
    }
    setError(null)
    setCandidate(result.place)
  }

  const results = filterReferencePoints(query)

  return <Screen className="cl-picker">
    <TopBar title={isPickup ? '¿Dónde te buscamos?' : '¿A dónde vas?'} onBack={() => navigate(isPickup ? CLIENT_PATHS.home : CLIENT_PATHS.pickup, { replace: true })} />
    <p className="cl-step">Paso {isPickup ? 1 : 2} de 2 · {isPickup ? 'Punto de partida' : 'Destino'}</p>
    <MapView className="cl-picker-map"
      pickup={isPickup ? null : pickup}
      destination={isPickup ? destination : null}
      candidate={candidate}
      candidateKind={kind}
      referencePoints={REFERENCE_POINTS}
      onReferencePointSelect={(place) => { setError(null); setCandidate(place) }}
      onMapTap={tapMap} />
    <section className="cl-sheet cl-picker-sheet">
      {error && <p className="cl-inline-error" role="alert">{error}</p>}
      {candidate
        ? <div className="cl-candidate">
          <span className={`cl-place-dot cl-place-dot-${kind}`} aria-hidden="true"><MapPin size={18} /></span>
          <div><strong>{candidate.label}</strong><span>{candidate.detail}</span></div>
          <Button onClick={() => choose(candidate)}>{isPickup ? 'Confirmar punto de partida' : 'Confirmar destino'}</Button>
          <Button variant="text" onClick={() => setCandidate(null)}>Elegir otro lugar</Button>
        </div>
        : <>
          <p className="cl-hint">Tocá el mapa para marcar el punto o elegí un lugar de la lista.</p>
          <label className="cl-search">
            <Search size={22} aria-hidden="true" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar un lugar" aria-label="Buscar un lugar" />
          </label>
          <ul className="cl-results">
            {results.map((place) => <li key={place.id}>
              <button type="button" className="cl-result" onClick={() => choose(place)}>
                <MapPin size={22} aria-hidden="true" />
                <span><strong>{place.label}</strong><small>{place.detail}</small></span>
                <ChevronRight size={22} aria-hidden="true" />
              </button>
            </li>)}
            {!results.length && <li className="cl-empty">No encontramos ese lugar. Marcalo en el mapa.</li>}
          </ul>
        </>}
    </section>
  </Screen>
}
