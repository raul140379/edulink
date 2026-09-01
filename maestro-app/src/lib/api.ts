import { getToken, logout } from './auth'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

// Fetch autenticado — agrega el JWT, y si el backend responde 401 (token
// vencido/invalido) limpia la sesión y manda a /login, en vez de dejar la
// pantalla en un estado roto silencioso.
export async function apiFetch<T = unknown>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken()
  const res = await fetch(`${API_URL}${path}`, {
    cache: 'no-store', // sin esto, el navegador del celular puede servir una respuesta GET vieja (ej. asistencia ya guardada) desde caché en vez de pedirla de nuevo
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  })

  if (res.status === 401) {
    logout()
    if (typeof window !== 'undefined') window.location.href = '/login'
    throw new ApiError(401, 'Sesión expirada')
  }

  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new ApiError(res.status, (data as any).message || 'Error de conexión')
  return data as T
}
