'use client'

import { useEffect, useRef } from 'react'

interface PopoverProps {
  open: boolean
  onClose: () => void
  children: React.ReactNode
  align?: 'left' | 'right'
  className?: string
}

// Panel flotante anclado a un trigger — el mismo patrón que ya usaba el
// dropdown de navegación (wrapper `relative` + panel `absolute`), no un
// portal como Modal. El que lo usa debe envolver su botón disparador y este
// componente en un contenedor con `className="relative"`.
export default function Popover({ open, onClose, children, align = 'left', className = '' }: PopoverProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose() }
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onEsc)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onEsc)
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      ref={ref}
      role="dialog"
      className={`absolute top-full ${align === 'right' ? 'right-0' : 'left-0'} mt-2 z-[300] bg-white rounded-xl border border-neutral-300/60 shadow-lg p-4 min-w-[260px] ${className}`}
    >
      {children}
    </div>
  )
}
