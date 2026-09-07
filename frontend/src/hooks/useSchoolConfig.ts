'use client'

import { useEffect, useState } from 'react'
import API_URL from '@/lib/api'

export interface SchoolConfig {
  name: string | null
}

const FALLBACK: SchoolConfig = { name: null }

// Cache a nivel de módulo, mismo patrón que useDistrictConfig — el colegio
// del usuario logueado no cambia durante la sesión. A diferencia del
// distrito (portal público, sin auth), esto requiere token: se pide una
// sola vez por sesión de pestaña, no por cada componente que lo usa.
let cached: SchoolConfig | null = null
let inFlight: Promise<SchoolConfig> | null = null

async function fetchSchoolConfig(): Promise<SchoolConfig> {
  if (cached) return cached
  if (!inFlight) {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
    inFlight = fetch(`${API_URL}/api/auth/me`, { headers: { Authorization: `Bearer ${token || ''}` } })
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        cached = data?.school?.name ? { name: data.school.name } : FALLBACK
        return cached
      })
      .catch(() => FALLBACK)
  }
  return inFlight
}

// El caché es por identidad de usuario, no por pestaña — si no se limpia al
// cerrar sesión, una cuenta sin colegio (SUPER_ADMIN, distrital) deja el
// caché en FALLBACK para siempre en esa pestaña, y la siguiente cuenta que
// inicie sesión ahí (aunque sí tenga colegio) sigue viendo el valor viejo,
// porque login/logout navegan client-side (router.push, sin recargar la
// página) y nunca reinician el estado de este módulo. Confirmado con
// reproducción real (7-sep-2026): login sin colegio → Salir → login con
// colegio real, misma pestaña → el PDF seguía mostrando "sin colegio".
export function resetSchoolConfigCache() {
  cached = null
  inFlight = null
}

/** Nombre del colegio del usuario logueado (School.name vía /api/auth/me) —
 * para encabezados de PDF/reportes que necesitan el colegio, no el distrito. */
export function useSchoolConfig(): SchoolConfig {
  const [config, setConfig] = useState<SchoolConfig>(cached || FALLBACK)

  useEffect(() => {
    let mounted = true
    fetchSchoolConfig().then(c => { if (mounted) setConfig(c) })
    return () => { mounted = false }
  }, [])

  return config
}
