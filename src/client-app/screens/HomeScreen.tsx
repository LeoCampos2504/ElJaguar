import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { LogOut, Search, UserRound, X } from 'lucide-react'
import { useClient } from '../ClientProvider'
import { CLIENT_PATHS } from '../domain/client-routes'
import { MapView } from '../MapView'
import { Button, PlaceRow, Screen, TopBar } from '../ui'

export function HomeScreen() {
  const navigate = useNavigate()
  const { state, dispatch } = useClient()
  const [accountOpen, setAccountOpen] = useState(false)
  const { pickup, destination } = state.draft
  const firstName = state.session?.displayName?.split(' ')[0]
  const nextStep = !pickup ? CLIENT_PATHS.pickup : !destination ? CLIENT_PATHS.destination : CLIENT_PATHS.confirm

  return <Screen className="cl-home">
    <TopBar trailing={<button type="button" className="cl-icon-button" onClick={() => setAccountOpen(true)} aria-label="Mi cuenta"><UserRound size={24} /></button>} />
    <MapView className="cl-home-map" pickup={pickup} destination={destination} />
    <section className="cl-sheet">
      <p className="cl-greeting">{firstName ? `Hola, ${firstName}` : 'Hola'}</p>
      <button type="button" className="cl-where-button" onClick={() => navigate(nextStep)}>
        <Search size={24} aria-hidden="true" />
        <span>¿A dónde vas?</span>
      </button>
      <div className="cl-place-list">
        <PlaceRow kind="pickup" place={pickup} placeholder="Elegí dónde te buscamos" onClick={() => navigate(CLIENT_PATHS.pickup)} />
        <PlaceRow kind="destination" place={destination} placeholder="Elegí tu destino" onClick={() => navigate(pickup ? CLIENT_PATHS.destination : CLIENT_PATHS.pickup)} />
      </div>
      {pickup && destination && <Button onClick={() => navigate(CLIENT_PATHS.confirm)}>Ver tarifa</Button>}
    </section>

    {accountOpen && <div className="cl-dialog-backdrop" role="presentation" onClick={() => setAccountOpen(false)}>
      <div className="cl-dialog" role="dialog" aria-modal="true" aria-labelledby="cl-account-title" onClick={(event) => event.stopPropagation()}>
        <button type="button" className="cl-icon-button cl-dialog-close" onClick={() => setAccountOpen(false)} aria-label="Cerrar"><X size={22} /></button>
        <h2 id="cl-account-title">Mi cuenta</h2>
        <p className="cl-account-name">{state.session?.displayName ?? state.session?.identifier}</p>
        {state.session?.phone && <p className="cl-account-phone">Teléfono {state.session.phone}</p>}
        <Button variant="secondary" onClick={() => { dispatch({ type: 'SIGN_OUT' }); navigate(CLIENT_PATHS.login, { replace: true }) }}><LogOut size={20} /> Cerrar sesión</Button>
      </div>
    </div>}
  </Screen>
}
