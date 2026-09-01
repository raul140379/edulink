'use client'

import { useEffect } from 'react'

// Registra el Service Worker mínimo (public/sw.js) — sin esto, Chrome/
// Android no cumple el criterio de instalación real y "Instalar" cae a otro
// comportamiento en vez de agregar el ícono a la pantalla de inicio.
export default function RegisterServiceWorker() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {})
    }
  }, [])

  return null
}
