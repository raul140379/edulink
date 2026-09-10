'use client'

import { useEffect } from 'react'

// Service worker mínimo — necesario para que Chrome/Android reconozca la
// app como instalable de verdad, mismo criterio que maestro-app.
export default function RegisterServiceWorker() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {})
    }
  }, [])

  return null
}
