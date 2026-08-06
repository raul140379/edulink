'use client'

import { useEffect, useState } from 'react'

const STORAGE_PREFIX = 'edulink:filters:'

// Persiste el estado de filtros de un módulo (ej. "tesoreria") en
// sessionStorage — todas las páginas de ese módulo que usen la misma
// moduleKey comparten el mismo estado: los filtros elegidos en Cobros siguen
// aplicados al navegar a Deudas/Kardex/Reportes, y solo cambian cuando el
// usuario los modifica o los limpia. Se pierden al cerrar la pestaña (no es
// un dato a persistir en base, solo una comodidad de sesión).
export function useModuleFilters<T extends Record<string, any>>(moduleKey: string, defaults: T) {
  const storageKey = `${STORAGE_PREFIX}${moduleKey}`

  const [filters, setFilters] = useState<T>(defaults)

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(storageKey)
      if (raw) setFilters({ ...defaults, ...JSON.parse(raw) })
    } catch {}
    // Solo se lee una vez al montar cada página del módulo — sincronizarse
    // en cada cambio de `defaults` reintroduciría el problema que el hook
    // resuelve (perder el filtro elegido al navegar entre páginas).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey])

  const update = (patch: Partial<T>) => {
    setFilters(prev => {
      const next = { ...prev, ...patch }
      try { sessionStorage.setItem(storageKey, JSON.stringify(next)) } catch {}
      return next
    })
  }

  const clear = () => {
    setFilters(defaults)
    try { sessionStorage.removeItem(storageKey) } catch {}
  }

  return { filters, update, clear }
}
