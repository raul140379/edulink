import { HTMLAttributes } from 'react'

type Tone = 'brand' | 'success' | 'danger' | 'warning' | 'neutral' | 'info'

const TONE_CLASSES: Record<Tone, string> = {
  brand:   'bg-brand-100 text-brand-700',
  success: 'bg-success-100 text-success-700',
  danger:  'bg-danger-100 text-danger-600',
  warning: 'bg-warning-100 text-warning-500',
  neutral: 'bg-neutral-100 text-neutral-700',
  info:    'bg-info-500/15 text-info-500',
}

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone
}

export default function Badge({ tone = 'neutral', className = '', children, ...rest }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11.5px] font-semibold ${TONE_CLASSES[tone]} ${className}`}
      {...rest}
    >
      {children}
    </span>
  )
}
