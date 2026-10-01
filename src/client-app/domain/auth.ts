import type { ClientSession } from './client-state'

// Phase 1A mock authentication. No credential is checked or stored anywhere:
// the password is only validated for format and then discarded.
// Public registration always produces a CLIENT session; there is no role input.

export const MIN_PASSWORD_LENGTH = 6
export const MIN_PHONE_DIGITS = 8

export type LoginInput = { identifier: string; password: string }
export type RegistrationInput = { fullName: string; phone: string; password: string; passwordConfirmation: string }

export type AuthResult =
  | { ok: true; session: ClientSession }
  | { ok: false; errors: Record<string, string> }

function digits(value: string): string {
  return value.replace(/\D/g, '')
}

function looksLikePhone(value: string): boolean {
  return /^[\d\s()+-]+$/.test(value.trim())
}

export function signInWithMock(input: LoginInput): AuthResult {
  const errors: Record<string, string> = {}
  const identifier = input.identifier.trim()
  if (!identifier) errors.identifier = 'Ingresá tu teléfono o usuario.'
  else if (looksLikePhone(identifier) && digits(identifier).length < MIN_PHONE_DIGITS) errors.identifier = 'Revisá el número de teléfono.'
  else if (!looksLikePhone(identifier) && identifier.length < 3) errors.identifier = 'El usuario es demasiado corto.'
  if (!input.password) errors.password = 'Ingresá tu contraseña.'
  else if (input.password.length < MIN_PASSWORD_LENGTH) errors.password = `La contraseña tiene al menos ${MIN_PASSWORD_LENGTH} caracteres.`
  if (Object.keys(errors).length) return { ok: false, errors }
  return {
    ok: true,
    session: {
      role: 'CLIENT',
      displayName: null,
      phone: looksLikePhone(identifier) ? digits(identifier) : null,
      identifier,
    },
  }
}

export function registerClientWithMock(input: RegistrationInput): AuthResult {
  const errors: Record<string, string> = {}
  const fullName = input.fullName.trim().replace(/\s+/g, ' ')
  const phone = digits(input.phone)
  if (fullName.length < 2) errors.fullName = 'Ingresá tu nombre.'
  if (phone.length < MIN_PHONE_DIGITS) errors.phone = 'Ingresá un teléfono válido.'
  if (input.password.length < MIN_PASSWORD_LENGTH) errors.password = `Usá al menos ${MIN_PASSWORD_LENGTH} caracteres.`
  if (input.passwordConfirmation !== input.password) errors.passwordConfirmation = 'Las contraseñas no coinciden.'
  if (Object.keys(errors).length) return { ok: false, errors }
  return { ok: true, session: { role: 'CLIENT', displayName: fullName, phone, identifier: phone } }
}
