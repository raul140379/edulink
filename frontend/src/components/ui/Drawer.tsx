'use client'

import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

interface DrawerProps {
  open: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
  footer?: React.ReactNode
  side?: 'right' | 'bottom'
}

// Panel deslizante — mismo patrón de portal/Escape/backdrop-click que Modal,
// pero anclado a un borde en vez de centrado. `side="bottom"` es el "bottom
// sheet" que usa Toolbar para filtros en mobile; `side="right"` para paneles
// laterales en desktop/tablet.
export default function Drawer({ open, onClose, title, children, footer, side = 'right' }: DrawerProps) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open || typeof document === 'undefined') return null

  const panelPosition = side === 'bottom'
    ? 'inset-x-0 bottom-0 rounded-t-xl max-h-[85vh]'
    : 'inset-y-0 right-0 h-full w-full max-w-[360px]'

  return createPortal(
    <div
      className="fixed inset-0 z-[1000] bg-black/45"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className={`absolute ${panelPosition} bg-white shadow-xl flex flex-col`}
        role="dialog"
        aria-modal="true"
      >
        {title && (
          <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-neutral-300/60 shrink-0">
            <h2 className="text-[15px] font-bold text-brand-700">{title}</h2>
            <button onClick={onClose} className="text-neutral-500 hover:text-neutral-900 rounded-md p-1 -m-1" aria-label="Cerrar">
              <X size={18} />
            </button>
          </div>
        )}
        <div className="px-5 py-4 overflow-y-auto flex-1">{children}</div>
        {footer && <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-neutral-300/60 shrink-0">{footer}</div>}
      </div>
    </div>,
    document.body,
  )
}
