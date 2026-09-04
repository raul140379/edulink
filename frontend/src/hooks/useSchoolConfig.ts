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
