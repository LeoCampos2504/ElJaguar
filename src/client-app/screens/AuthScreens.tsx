import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useClient } from '../ClientProvider'
import { registerClientWithMock, signInWithMock } from '../domain/auth'
import { CLIENT_PATHS } from '../domain/client-routes'
import { BrandMark, Button, Field, Screen, TopBar } from '../ui'

export function LoginScreen() {
  const navigate = useNavigate()
  const { dispatch } = useClient()
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const result = signInWithMock({ identifier, password })
    if (!result.ok) return setErrors(result.errors)
    dispatch({ type: 'SIGN_IN', session: result.session })
    navigate(CLIENT_PATHS.home, { replace: true })
  }

  return <Screen className="cl-auth">
    <div className="cl-auth-hero">
      <BrandMark size="large" />
      <p>Tu remis en Libertador General San Martín y Calilegua.</p>
    </div>
    <form className="cl-auth-card" onSubmit={submit} noValidate>
      <h1>Iniciar sesión</h1>
      <Field label="Teléfono o usuario" value={identifier} onChange={(event) => setIdentifier(event.target.value)} autoComplete="username" inputMode="text" error={errors.identifier} />
      <Field label="Contraseña" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" error={errors.password} />
      <Button type="submit">Iniciar sesión</Button>
      <div className="cl-auth-switch">
        <span>¿No tenés cuenta?</span>
        <Button variant="secondary" onClick={() => navigate(CLIENT_PATHS.register)}>Registrarme</Button>
      </div>
    </form>
  </Screen>
}

export function RegisterScreen() {
  const navigate = useNavigate()
  const { dispatch } = useClient()
  const [form, setForm] = useState({ fullName: '', phone: '', password: '', passwordConfirmation: '' })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const update = (key: keyof typeof form) => (event: { target: { value: string } }) => setForm({ ...form, [key]: event.target.value })

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const result = registerClientWithMock(form)
    if (!result.ok) return setErrors(result.errors)
    dispatch({ type: 'SIGN_IN', session: result.session })
    navigate(CLIENT_PATHS.home, { replace: true })
  }

  return <Screen className="cl-auth">
    <TopBar title="Crear cuenta" onBack={() => navigate(CLIENT_PATHS.login, { replace: true })} />
    <form className="cl-auth-card cl-auth-card-flat" onSubmit={submit} noValidate>
      <p className="cl-lead">Completá tus datos para pedir viajes.</p>
      <Field label="Nombre y apellido" value={form.fullName} onChange={update('fullName')} autoComplete="name" error={errors.fullName} />
      <Field label="Teléfono" type="tel" value={form.phone} onChange={update('phone')} autoComplete="tel" inputMode="tel" error={errors.phone} />
      <Field label="Contraseña" type="password" value={form.password} onChange={update('password')} autoComplete="new-password" error={errors.password} />
      <Field label="Repetir contraseña" type="password" value={form.passwordConfirmation} onChange={update('passwordConfirmation')} autoComplete="new-password" error={errors.passwordConfirmation} />
      <Button type="submit">Crear cuenta</Button>
    </form>
  </Screen>
}
