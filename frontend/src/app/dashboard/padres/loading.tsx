import { Loader2 } from 'lucide-react'

export default function AdminLoading() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-24 text-neutral-500">
      <Loader2 size={28} className="animate-spin text-brand-700" />
      <span className="text-sm">Cargando...</span>
    </div>
  )
}
