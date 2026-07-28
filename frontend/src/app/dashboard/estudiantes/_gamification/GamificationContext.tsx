'use client'

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

const STUDENT_ONLY_ROLES = ['STUDENT', 'STUDENT_GOV']

export interface WeekDay { date: string; label: string; status: string | null }

interface GamificationState {
  enabled:        boolean
  loading:        boolean
  xp:             number
  level:          number
  xpIntoLevel:    number
  xpForNextLevel: number
  progressPct:    number
  currentStreak:  number
  longestStreak:  number
  weekCalendar:   WeekDay[]
  attendancePct:  number | null
}

interface GamificationUpdate {
  xp: number; level: number; xpIntoLevel: number; xpForNextLevel: number; progressPct: number
}

const DEFAULT_STATE: GamificationState = {
  enabled: false, loading: true, xp: 0, level: 1, xpIntoLevel: 0, xpForNextLevel: 500, progressPct: 0,
  currentStreak: 0, longestStreak: 0, weekCalendar: [], attendancePct: null,
}

const GamificationContext = createContext<{
  state: GamificationState
  refetch: () => void
  applyServerUpdate: (partial: GamificationUpdate) => void
}>({ state: DEFAULT_STATE, refetch: () => {}, applyServerUpdate: () => {} })

// Envuelve estudiantes/layout.tsx — si el rol no es STUDENT/STUDENT_GOV (ej.
// Gobierno de Núcleo/Distrito, que no cursan materias) queda enabled:false y
// GamificationTopBar no se renderiza, sin pegarle al backend.
export function GamificationProvider({ role, children }: { role: string | null; children: ReactNode }) {
  const [state, setState] = useState<GamificationState>(DEFAULT_STATE)

  const fetchGamification = useCallback(() => {
    if (!role) return
    if (!STUDENT_ONLY_ROLES.includes(role)) {
      setState({ ...DEFAULT_STATE, loading: false })
      return
    }
    const token = localStorage.getItem('token')
    if (!token) return
    fetch(`${API_URL}/api/students/my-gamification`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setState({ ...d, loading: false }) })
      .catch(() => setState(s => ({ ...s, loading: false })))
  }, [role])

  useEffect(() => { fetchGamification() }, [fetchGamification])

  // Mergea directo la respuesta del PATCH de entrega de tarea — sin volver a
  // pedir el endpoint completo, así el XP sube en tiempo real sin recargar.
  const applyServerUpdate = useCallback((partial: GamificationUpdate) => {
    setState(s => ({ ...s, ...partial }))
  }, [])

  return (
    <GamificationContext.Provider value={{ state, refetch: fetchGamification, applyServerUpdate }}>
      {children}
    </GamificationContext.Provider>
  )
}

export function useGamification() {
  return useContext(GamificationContext)
}
