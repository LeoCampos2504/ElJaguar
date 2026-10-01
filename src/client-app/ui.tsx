import { useId, useState, type InputHTMLAttributes, type ReactNode } from 'react'
import { ArrowLeft, CarFront, Eye, EyeOff, MapPin, Navigation, Pencil } from 'lucide-react'
import type { TripPlace } from './domain/places'

export function BrandMark({ size = 'small' }: { size?: 'small' | 'large' }) {
  return <div className={`cl-brand cl-brand-${size}`}>
    <span className="cl-brand-icon" aria-hidden="true"><CarFront size={size === 'large' ? 30 : 20} /></span>
    <span className="cl-brand-name">EL JAGUAR</span>
  </div>
}

export function TopBar({ title, onBack, trailing }: { title?: string; onBack?: () => void; trailing?: ReactNode }) {
  return <header className="cl-topbar">
    {onBack
      ? <button type="button" className="cl-icon-button" onClick={onBack} aria-label="Volver"><ArrowLeft size={24} /></button>
      : !title && <BrandMark />}
    {title && <h1 className="cl-topbar-title">{title}</h1>}
    <div className="cl-topbar-trailing">{trailing}</div>
  </header>
}

export function Screen({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`cl-screen ${className}`}>{children}</div>
}

export function Button({ children, onClick, variant = 'primary', type = 'button', disabled = false }: {
  children: ReactNode
  onClick?: () => void
  variant?: 'primary' | 'secondary' | 'danger' | 'text'
  type?: 'button' | 'submit'
  disabled?: boolean
}) {
  return <button type={type} className={`cl-button cl-button-${variant}`} onClick={onClick} disabled={disabled}>{children}</button>
}

export function Field({ label, error, type = 'text', ...inputProps }: { label: string; error?: string } & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId()
  const [visible, setVisible] = useState(false)
  const isPassword = type === 'password'
  return <div className={`cl-field ${error ? 'has-error' : ''}`}>
    <label htmlFor={id}>{label}</label>
    <div className="cl-input-wrap">
      <input id={id} type={isPassword && visible ? 'text' : type} aria-invalid={error ? true : undefined} aria-describedby={error ? `${id}-error` : undefined} {...inputProps} />
      {isPassword && <button type="button" className="cl-input-toggle" onClick={() => setVisible(!visible)} aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}>{visible ? <EyeOff size={22} /> : <Eye size={22} />}</button>}
    </div>
    {error && <p className="cl-field-error" id={`${id}-error`} role="alert">{error}</p>}
  </div>
}

export function PlaceRow({ kind, place, placeholder, onClick }: { kind: 'pickup' | 'destination'; place: TripPlace | null; placeholder: string; onClick?: () => void }) {
  const caption = kind === 'pickup' ? 'Te buscamos en' : 'Vas a'
  const content = <>
    <span className={`cl-place-dot cl-place-dot-${kind}`} aria-hidden="true">{kind === 'pickup' ? <Navigation size={18} /> : <MapPin size={18} />}</span>
    <span className="cl-place-text">
      <small>{caption}</small>
      <strong className={place ? '' : 'is-placeholder'}>{place?.label ?? placeholder}</strong>
      {place && <span>{place.detail}</span>}
    </span>
    {onClick && <Pencil size={18} className="cl-place-edit" aria-hidden="true" />}
  </>
  return onClick
    ? <button type="button" className="cl-place-row" onClick={onClick} aria-label={`${caption}: ${place?.label ?? placeholder}. Cambiar`}>{content}</button>
    : <div className="cl-place-row">{content}</div>
}
