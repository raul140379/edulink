'use client'

import { useEffect, useState } from 'react'
import API_URL from '@/lib/api'

export interface DistrictConfig {
  name:     string
  location: string | null
  logoUrl:  string | null
}

const FALLBACK: DistrictConfig = { name: 'EduLink', location: null, logoUrl: null }

// Cache a nivel de módulo: el branding del distrito es el mismo para toda la
// sesión (un solo distrito activo por despliegue), no hace falta re-pedirlo
// en cada layout que se monta.
let cached: DistrictConfig | null = null
let inFlight: Promise<DistrictConfig> | null = null

async function fetchDistrictConfig(): Promise<DistrictConfig> {
  if (cached) return cached
  if (!inFlight) {
    inFlight = fetch(`${API_URL}/api/public/district`)
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        cached = data ? { name: data.name, location: data.location, logoUrl: data.logoUrl } : FALLBACK
        return cached
      })
      .catch(() => FALLBACK)
  }
  return inFlight
}

/** Datos de marca del distrito activo (nombre, ubicación, logo) — mismo dato
 * para el portal público y para todos los dashboards autenticados. */
export function useDistrictConfig(): DistrictConfig {
  const [config, setConfig] = useState<DistrictConfig>(cached || FALLBACK)

  useEffect(() => {
    let mounted = true
    fetchDistrictConfig().then(c => { if (mounted) setConfig(c) })
    return () => { mounted = false }
  }, [])

  return config
}
