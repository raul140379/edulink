'use client'

import { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes, forwardRef } from 'react'

const FIELD_BASE = `
  w-full h-10 px-3 rounded-lg border border-neutral-300 bg-white text-sm text-neutral-900
  placeholder:text-neutral-500 transition-colors
  focus:outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/15
  disabled:bg-neutral-100 disabled:text-neutral-500 disabled:cursor-not-allowed
`

interface FieldWrapperProps {
  label?: string
  error?: string
  hint?: string
  required?: boolean
}

function FieldChrome({ label, error, hint, required, children }: FieldWrapperProps & { children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      {label && (
        <span className="text-[13px] font-semibold text-neutral-700">
          {label}{required && <span className="text-danger-500"> *</span>}
        </span>
      )}
      {children}
      {error && <span className="text-[12px] text-danger-600">{error}</span>}
      {!error && hint && <span className="text-[12px] text-neutral-500">{hint}</span>}
    </label>
  )
}

interface InputProps extends InputHTMLAttributes<HTMLInputElement>, FieldWrapperProps {}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, hint, required, className = '', ...rest },
  ref,
) {
  return (
    <FieldChrome label={label} error={error} hint={hint} required={required}>
      <input
        ref={ref}
        className={`${FIELD_BASE} ${error ? 'border-danger-500 focus:border-danger-500 focus:ring-danger-500/15' : ''} ${className}`}
        {...rest}
      />
    </FieldChrome>
  )
})

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement>, FieldWrapperProps {}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, error, hint, required, className = '', children, ...rest },
  ref,
) {
  return (
    <FieldChrome label={label} error={error} hint={hint} required={required}>
      <select
        ref={ref}
        className={`${FIELD_BASE} ${error ? 'border-danger-500' : ''} ${className}`}
        {...rest}
      >
        {children}
      </select>
    </FieldChrome>
  )
})

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement>, FieldWrapperProps {}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, error, hint, required, className = '', ...rest },
  ref,
) {
  return (
    <FieldChrome label={label} error={error} hint={hint} required={required}>
      <textarea
        ref={ref}
        className={`${FIELD_BASE} h-auto min-h-[90px] py-2.5 resize-y ${error ? 'border-danger-500' : ''} ${className}`}
        {...rest}
      />
    </FieldChrome>
  )
})

export default Input
