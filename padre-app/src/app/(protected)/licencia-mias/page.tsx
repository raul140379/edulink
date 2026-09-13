'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { licenciasApi, LicenseRequest, LicenseRequestStatus } from '@/modules/licencias/api'

const STATUS_STYLE: Record<LicenseRequestStatus, { label: string; className: string }> = {
  PENDIENTE: { label: 'Pendiente', className: 'bg-warning-100 text-warning-600' },
  APROBADA:  { label: 'Aprobada',  className: 'bg-success-100 text-success-700' },
  RECHAZADA: { label: 'Rechazada', className: 'bg-danger-100 text-danger-600' },
}

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
function formatDate(iso: string): string {
  const d = new Date(iso)
  return `${d.getUTCDate()} de ${MESES[d.getUTCMonth()]} de ${d.getUTCFullYear()}`
}

export default function MisLicenciasPage() {
  const router = useRouter()
  const [requests, setRequests] = useState<LicenseRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    licenciasApi.getMine()
      .then(setRequests)
      .catch(() => setError('No se pudo cargar tus solicitudes'))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="flex flex-col max-w-lg mx-auto">
      <div className="px-4 pt-4 flex items-center gap-2">
        <button onClick={() => router.push('/')} className="p-1 -ml-1 text-brand-700 active:opacity-60">
          <ArrowLeft size={22} />
        </button>
        <h1 className="text-[17px] font-bold text-brand-700">Mis Solicitudes</h1>
      </div>

      <div className="px-4 py-4 flex flex-col gap-2.5">
        {error ? (
          <p className="text-sm text-danger-600 bg-danger-100 rounded-lg px-3 py-2.5">{error}</p>
        ) : loading ? (
          <p className="text-sm text-text-secondary text-center py-8">Cargando...</p>
        ) : requests.length === 0 ? (
          <p className="text-sm text-text-secondary text-center py-8">Todavía no enviaste ninguna solicitud de licencia.</p>
        ) : (
          requests.map(r => (
            <div key={r.id} className="bg-white rounded-xl border border-border px-4 py-3.5 flex flex-col gap-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[14px] font-semibold text-brand-900">{r.student.lastName} {r.student.firstName}</span>
                <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full shrink-0 ${STATUS_STYLE[r.status].className}`}>
                  {STATUS_STYLE[r.status].label}
                </span>
              </div>
              <div className="text-[13px] text-text-secondary">
                Del {formatDate(r.startDate)} al {formatDate(r.endDate)}
              </div>
              <div className="text-[13px] text-text-secondary">{r.reason}</div>
              {r.status !== 'PENDIENTE' && r.reviewNote && (
                <div className="text-[13px] text-brand-900 bg-bg-soft rounded-lg px-3 py-2 mt-1">
                  {r.status === 'RECHAZADA' ? 'Motivo del rechazo: ' : 'Nota de Dirección: '}{r.reviewNote}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
