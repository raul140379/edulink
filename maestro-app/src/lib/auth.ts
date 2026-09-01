const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'
const TOKEN_KEY = 'maestro_token'
const USER_KEY = 'maestro_user'

export interface AuthUser {
  id: number
  email: string
  role: string
  permissions: string[]
}

const ALLOWED_ROLES = ['TEACHER', 'TEACHER_TUTOR']

export function getToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(TOKEN_KEY)
}

export function getUser(): AuthUser | null {
  if (typeof window === 'undefined') return null
  const raw = localStorage.getItem(USER_KEY)
  return raw ? JSON.parse(raw) : null
}

export function logout() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
}

export async function login(email: string, password: string): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const res = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    const data = await res.json()
    if (!res.ok) return { ok: false, message: data.message || 'No se pudo iniciar sesión' }

    if (!ALLOWED_ROLES.includes(data.user.role)) {
      return { ok: false, message: 'Esta app es solo para maestros. Usá el panel web con tu cuenta.' }
    }

    localStorage.setItem(TOKEN_KEY, data.token)
    localStorage.setItem(USER_KEY, JSON.stringify(data.user))
    return { ok: true }
  } catch {
    return { ok: false, message: 'Error de conexión' }
  }
}
