import { getToken, logout } from './auth'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

// Fetch autenticado — mismo patrón que maestro-app: agrega el JWT, limpia
// la sesión en 401, y sin caché (un celular puede servir una respuesta GET
// vieja si no se lo prohíbe explícitamente).
export async function apiFetch<T = unknown>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken()
  const res = await fetch(`${API_URL}${path}`, {
    cache: 'no-store',
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

export default API_URL
