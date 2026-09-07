'use client'

import { useEffect, useState } from 'react'

// Copia del mismo hook en frontend/src/hooks/useDistrictConfig.ts — mismo
// endpoint público (sin auth), mismo patrón de caché a nivel de módulo. No
// hay forma de importar entre frontend y maestro-app (2 proyectos Next.js
// separados, sin monorepo), así que se duplica tal cual.
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

export interface DistrictConfig {
  name:     string
  location: string | null
  logoUrl:  string | null
}

const FALLBACK: DistrictConfig = { name: 'EduLink', location: null, logoUrl: null }

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
 * que usa el portal público y el panel web, para el encabezado del PDF de
 * asistencia. */
export function useDistrictConfig(): DistrictConfig {
  const [config, setConfig] = useState<DistrictConfig>(cached || FALLBACK)

  useEffect(() => {
    let mounted = true
    fetchDistrictConfig().then(c => { if (mounted) setConfig(c) })
    return () => { mounted = false }
  }, [])

  return config
}
