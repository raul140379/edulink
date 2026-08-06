import { LucideIcon } from 'lucide-react'

interface PageHeaderProps {
  icon?: LucideIcon
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
}

// Encabezado de página estándar — mismo bloque que hoy está copiado a mano
// en cada page.tsx (h1 + p + acción principal a la derecha). Título/
// descripción/acción son lo único que cambia por módulo.
export default function PageHeader({ icon: Icon, title, description, action, className = '' }: PageHeaderProps) {
  return (
    <div className={`flex items-start justify-between gap-4 mb-6 flex-wrap ${className}`}>
      <div>
        <h1 className="text-xl font-bold text-brand-700 mb-1 flex items-center gap-2">
          {Icon && <Icon size={20} />} {title}
        </h1>
        {description && <p className="text-[13px] text-neutral-500">{description}</p>}
      </div>
      {action && <div className="flex gap-2.5">{action}</div>}
    </div>
  )
}
