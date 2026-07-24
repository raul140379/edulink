'use client'

import { useEffect } from 'react'
import { AlertTriangle } from 'lucide-react'
import Button from '@/components/ui/Button'

export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center gap-3 py-24 text-center px-4">
      <div className="w-14 h-14 rounded-full bg-danger-100 flex items-center justify-center text-danger-500">
        <AlertTriangle size={26} />
      </div>
      <h2 className="text-base font-bold text-neutral-900">Ocurrió un problema al cargar esta página</h2>
      <p className="text-sm text-neutral-500 max-w-md">
        Puede ser un problema temporal de conexión. Intentá de nuevo — si el problema persiste, avisá al soporte técnico.
      </p>
      <Button onClick={reset} className="mt-2">Reintentar</Button>
    </div>
  )
}
