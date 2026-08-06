import { LucideIcon } from 'lucide-react'

interface EmptyStateProps {
  icon: LucideIcon
  message: string
  className?: string
}

// Extracción 1:1 del bloque "sin resultados" repetido en casi cada página de
// listado (mismo ícono gris + mensaje, mismo spacing) — sin cambio visual.
export default function EmptyState({ icon: Icon, message, className = '' }: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center gap-3 py-16 text-neutral-500 ${className}`}>
      <Icon size={40} className="text-neutral-300" />
      <p className="text-[13px]">{message}</p>
    </div>
  )
}
