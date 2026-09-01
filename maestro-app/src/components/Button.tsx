'use client'

import { ButtonHTMLAttributes } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost'
  loading?: boolean
}

const VARIANTS: Record<string, string> = {
  primary:   'bg-brand-700 text-white active:bg-brand-900 disabled:opacity-50',
  secondary: 'bg-white text-brand-700 border border-border active:bg-bg-soft disabled:opacity-50',
  ghost:     'bg-transparent text-brand-700 active:bg-bg-soft disabled:opacity-50',
}

export default function Button({ variant = 'primary', loading, disabled, className = '', children, ...rest }: ButtonProps) {
  return (
    <button
      disabled={disabled || loading}
      className={`flex items-center justify-center gap-2 rounded-xl px-4 py-3.5 text-[15px] font-semibold transition-colors ${VARIANTS[variant]} ${className}`}
      {...rest}
    >
      {loading ? 'Espera...' : children}
    </button>
  )
}
