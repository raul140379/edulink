import { LucideIcon } from 'lucide-react'
import Card from './Card'

type Tone = 'brand' | 'success' | 'danger' | 'warning' | 'neutral' | 'info'

const TONE_CLASSES: Record<Tone, { box: string; value: string; border: string }> = {
  brand:   { box: 'bg-brand-100 text-brand-700',     value: 'text-brand-700',   border: '' },
  success: { box: 'bg-success-100 text-success-700', value: 'text-success-700', border: '!border-success-500/40' },
  danger:  { box: 'bg-danger-100 text-danger-600',   value: 'text-danger-600',  border: '!border-danger-500/40' },
  warning: { box: 'bg-warning-100 text-warning-500', value: 'text-warning-500', border: '!border-warning-500/40' },
  info:    { box: 'bg-info-500/15 text-info-500',    value: 'text-info-500',    border: '' },
  neutral: { box: 'bg-neutral-100 text-neutral-700', value: 'text-brand-700',   border: '' },
}

interface StatCardProps {
  label: string
  value: string | number
  icon?: LucideIcon
  tone?: Tone
  className?: string
}

// Extracción 1:1 de la tarjeta KPI ya usada en Tesorería (admin y Junta
// Escolar) — ícono opcional en caja de color + label + valor, sobre Card.
export default function StatCard({ label, value, icon: Icon, tone = 'neutral', className = '' }: StatCardProps) {
  const t = TONE_CLASSES[tone]
  return (
    <Card className={`${t.border} ${className}`}>
      <div className="flex items-center gap-3">
        {Icon && (
          <div className={`flex items-center justify-center w-9 h-9 rounded-lg shrink-0 ${t.box}`}>
            <Icon size={17} />
          </div>
        )}
        <div>
          <div className="text-[11px] text-neutral-500 uppercase tracking-wide mb-1">{label}</div>
          <div className={`text-lg font-bold ${t.value}`}>{value}</div>
        </div>
      </div>
    </Card>
  )
}
