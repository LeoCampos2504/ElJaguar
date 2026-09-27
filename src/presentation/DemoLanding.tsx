import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Activity, CarFront, MapPin, RotateCcw, UserRound } from 'lucide-react'
import { useDemo } from '../demo/use-demo'
import { useDriverSession } from '../driver/driver-session'

const roles = [
  { id: 'client', title: 'CLIENTE', description: 'Pedí y seguí tu viaje', route: '/cliente', icon: UserRound, tone: 'client' },
  { id: 'driver', title: 'CHOFER', description: 'Recibí y gestioná solicitudes', route: '/chofer', icon: CarFront, tone: 'driver' },
  { id: 'central', title: 'CENTRAL', description: 'Supervisá la operación', route: '/central', icon: Activity, tone: 'central' },
]

export function DemoLanding() {
  const navigate = useNavigate()
  const { resetDemo } = useDemo()
  const { closeDriverSession } = useDriverSession()
  const [resetNotice, setResetNotice] = useState(false)
  const resetScenario = () => {
    resetDemo()
    closeDriverSession()
    setResetNotice(true)
  }
  return <main className="presentation-landing">
    <div className="presentation-glow presentation-glow-one" />
    <div className="presentation-glow presentation-glow-two" />
    <div className="presentation-inner">
      <header className="presentation-header"><span className="presentation-brand-mark"><CarFront size={24} /></span><div><strong>EL JAGUAR</strong><small>PROTOTIPO OPERATIVO</small></div><span className="presentation-demo-pill">Presentación demo</span></header>
      <section className="presentation-intro"><span className="presentation-eyebrow"><i /> EXPERIENCIA LOCAL</span><h1>Una forma más simple<br />de moverte.</h1><p>Elegí una vista para recorrer la experiencia de EL JAGUAR.</p><div className="presentation-locality"><MapPin size={16} /><span>Libertador General San Martín <i>·</i> Calilegua <i>·</i> Jujuy</span></div></section>
      <section className="presentation-role-grid" aria-label="Elegir vista demo">{roles.map(({ id, title, description, route, icon: Icon, tone }) => <article className={`presentation-role-card role-${tone}`} key={id}>
        <span className="presentation-role-icon"><Icon size={22} /></span><span className="presentation-role-kicker">VISTA {title}</span><h2>{title}</h2><p>{description}</p><button onClick={() => navigate(route)}>INGRESAR <span aria-hidden="true">→</span></button>
      </article>)}</section>
      <div className="presentation-reset-row"><button className="presentation-reset" onClick={resetScenario}><RotateCcw size={15} /> REINICIAR ESCENARIO</button>{resetNotice && <span className="presentation-reset-notice" role="status">Escenario reiniciado</span>}<small>Datos de demostración · no se sincronizan entre dispositivos</small></div>
      <footer className="presentation-footer"><span>EL JAGUAR</span><span>Libertador General San Martín · Jujuy</span></footer>
    </div>
  </main>
}
