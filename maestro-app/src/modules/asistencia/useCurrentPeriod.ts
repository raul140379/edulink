'use client'

import { useEffect, useState, useCallback } from 'react'
import { asistenciaApi, ScheduleDay, SchedulePeriod } from './api'

function parseMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

// Se calcula con la hora del propio celular (no del servidor) — a
// diferencia del backend, un navegador/celular en Bolivia ya está en hora de
// Bolivia, así que comparar contra new Date() acá es seguro sin ninguna
// conversión de huso horario.
function resolvePeriods(days: ScheduleDay[]): { current: SchedulePeriod | null; next: SchedulePeriod | null; todayCourseIds: Set<number> } {
  const now = new Date()
  const jsDay = now.getDay() // 0=domingo..6=sábado
  const dow = jsDay === 0 ? 7 : jsDay // el horario usa 1=lunes..6=sábado
  const nowMin = now.getHours() * 60 + now.getMinutes()

  const today = days.find(d => d.day === dow)
  if (!today) return { current: null, next: null, todayCourseIds: new Set() }

  const sorted = [...today.periods].sort((a, b) => parseMinutes(a.startTime) - parseMinutes(b.startTime))

  const current = sorted.find(p => nowMin >= parseMinutes(p.startTime) && nowMin < parseMinutes(p.endTime)) || null
  const next = sorted.find(p => parseMinutes(p.startTime) > nowMin) || null
  const todayCourseIds = new Set(today.periods.map(p => p.course.id))

  return { current, next, todayCourseIds }
}

export function useCurrentPeriod() {
  const [days,    setDays]    = useState<ScheduleDay[]>([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')

  const load = useCallback(async () => {
    try {
      const data = await asistenciaApi.getMySchedule()
      setDays(data)
    } catch {
      setError('No se pudo cargar tu horario')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    const interval = setInterval(load, 5 * 60 * 1000) // refresca cada 5 min por si cambia el periodo mientras está abierta
    return () => clearInterval(interval)
  }, [load])

  const { current, next, todayCourseIds } = resolvePeriods(days)

  return { current, next, todayCourseIds, allDays: days, loading, error, reload: load }
}
