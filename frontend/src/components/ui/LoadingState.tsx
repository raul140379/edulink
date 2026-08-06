interface LoadingStateProps {
  label?: string
  className?: string
}

// Extracción 1:1 del bloque "Cargando..." repetido en cada página — sin
// cambio visual.
export default function LoadingState({ label = 'Cargando...', className = '' }: LoadingStateProps) {
  return (
    <div className={`flex justify-center py-16 ${className}`}>
      <p className="text-sm text-neutral-500">{label}</p>
    </div>
  )
}
