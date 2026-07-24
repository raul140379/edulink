'use client'

import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from 'lucide-react'

type ToastTone = 'success' | 'error' | 'warning' | 'info'

interface Toast {
  id: number
  message: string
  tone: ToastTone
}

type ToastFn = (message: string, tone?: ToastTone) => void

const ToastContext = createContext<ToastFn | null>(null)

/** Reemplazo de `window.alert` — muestra un toast que se cierra solo. Uso: `toast('Guardado correctamente')`. */
export function useToast(): ToastFn {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast debe usarse dentro de <ToastProvider>')
  return ctx
}

const TONE_STYLES: Record<ToastTone, { icon: React.ReactNode; className: string }> = {
  success: { icon: <CheckCircle2 size={18} />, className: 'bg-success-500 text-white' },
  error:   { icon: <XCircle size={18} />,       className: 'bg-danger-500 text-white' },
  warning: { icon: <AlertTriangle size={18} />, className: 'bg-warning-500 text-white' },
  info:    { icon: <Info size={18} />,          className: 'bg-brand-700 text-white' },
}

let nextId = 1

export default function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const toast = useCallback<ToastFn>((message, tone = 'info') => {
    const id = nextId++
    setToasts((prev) => [...prev, { id, message, tone }])
    setTimeout(() => dismiss(id), 4500)
  }, [dismiss])

  return (
    <ToastContext.Provider value={toast}>
      {children}
      {mounted && createPortal(
        <div className="fixed top-4 right-4 z-[1100] flex flex-col gap-2 w-[min(360px,calc(100vw-2rem))]">
          {toasts.map((t) => (
            <div
              key={t.id}
              className={`flex items-start gap-2.5 rounded-lg px-4 py-3 text-[13.5px] font-medium shadow-lg ${TONE_STYLES[t.tone].className}`}
            >
              <span className="mt-0.5 shrink-0">{TONE_STYLES[t.tone].icon}</span>
              <span className="flex-1">{t.message}</span>
              <button onClick={() => dismiss(t.id)} className="shrink-0 opacity-80 hover:opacity-100" aria-label="Cerrar">
                <X size={16} />
              </button>
            </div>
          ))}
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  )
}
