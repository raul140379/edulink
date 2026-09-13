'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react'
import { hijosApi, MyChild } from '@/modules/hijos/api'
import { asistenciaApi, AttendanceDay, AttendanceStatus } from '@/modules/asistencia/api'

const GRADES: Record<string, string> = { PRIMERO: '1°', SEGUNDO: '2°', TERCERO: '3°', CUARTO: '4°', QUINTO: '5°', SEXTO: '6°' }
const courseLabel = (c: MyChild['course']) => (c ? `${GRADES[c.grade] || c.grade} "${c.parallel}"` : '')

const STATUS_STYLE: Record<AttendanceStatus, { label: string; className: string }> = {
  PRESENTE: { label: 'Presente', className: 'bg-success-100 text-success-700' },
  AUSENTE:  { label: 'Ausente',  className: 'bg-danger-100 text-danger-600' },
  RETRASO:  { label: 'Retraso',  className: 'bg-warning-100 text-warning-600' },
  LICENCIA: { label: 'Licencia', className: 'bg-info-100 text-info-500' },
}

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  const dias = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']
  return `${dias[date.getUTCDay()]} ${d} de ${MESES[m - 1]}`
}

export default function AsistenciaPage() {
  const router = useRouter()
  const [children, setChildren] = useState<MyChild[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [monthOffset, setMonthOffset] = useState(0) // 0 = mes actual, -1 = anterior, etc.
  const [days, setDays] = useState<AttendanceDay[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    hijosApi.getMyChildren()
      .then(list => { setChildren(list); if (list.length > 0) setSelectedId(list[0].id) })
      .catch(() => setError('No se pudo cargar la lista de hijos'))
  }, [])

  const monthDate = new Date()
  monthDate.setUTCDate(1)
  monthDate.setUTCMonth(monthDate.getUTCMonth() + monthOffset)
  const monthParam = `${monthDate.getUTCFullYear()}-${String(monthDate.getUTCMonth() + 1).padStart(2, '0')}`
  const monthLabel = `${MESES[monthDate.getUTCMonth()]} ${monthDate.getUTCFullYear()}`

  useEffect(() => {
    if (!selectedId) return
    setLoading(true)
    setError('')
    asistenciaApi.getHistory(selectedId, monthParam)
      .then(res => setDays(res.days))
      .catch(() => setError('No se pudo cargar la asistencia'))
      .finally(() => setLoading(false))
  }, [selectedId, monthParam])

  return (
    <div className="flex flex-col max-w-lg mx-auto">
      <div className="px-4 pt-4 flex items-center gap-2">
        <button onClick={() => router.push('/')} className="p-1 -ml-1 text-brand-700 active:opacity-60">
          <ArrowLeft size={22} />
        </button>
        <h1 className="text-[17px] font-bold text-brand-700">Asistencia</h1>
      </div>

      {children.length > 1 && (
        <div className="px-4 pt-3 flex gap-2 overflow-x-auto">
          {children.map(c => (
            <button
              key={c.id}
              onClick={() => setSelectedId(c.id)}
              className={`shrink-0 rounded-xl px-4 py-2.5 text-[14px] font-semibold border ${
                selectedId === c.id ? 'bg-brand-700 text-white border-brand-700' : 'bg-white text-brand-700 border-border'
              }`}
            >
              {c.firstName.split(' ')[0]}
            </button>
          ))}
        </div>
      )}

      {children.length === 1 && (
        <div className="px-4 pt-3">
          <div className="text-[15px] font-semibold text-brand-700">{children[0].firstName} {children[0].lastName}</div>
          {children[0].course && <div className="text-[13px] text-text-secondary">{courseLabel(children[0].course)}</div>}
        </div>
      )}

      <div className="px-4 py-4 flex items-center justify-between">
        <button onClick={() => setMonthOffset(o => o - 1)} className="p-2 rounded-lg active:bg-bg-soft text-brand-700">
          <ChevronLeft size={20} />
        </button>
        <span className="text-[14px] font-semibold text-brand-700 capitalize">{monthLabel}</span>
        <button
          onClick={() => setMonthOffset(o => Math.min(0, o + 1))}
          disabled={monthOffset === 0}
          className="p-2 rounded-lg active:bg-bg-soft text-brand-700 disabled:opacity-30"
        >
          <ChevronRight size={20} />
        </button>
      </div>

      <div className="px-4 pb-8 flex flex-col gap-2">
        {error ? (
          <p className="text-sm text-danger-600 bg-danger-100 rounded-lg px-3 py-2.5">{error}</p>
        ) : loading ? (
          <p className="text-sm text-text-secondary text-center py-8">Cargando...</p>
        ) : children.length === 0 ? (
          <p className="text-sm text-text-secondary text-center py-8">No hay hijos registrados en tu cuenta.</p>
        ) : days.length === 0 ? (
          <p className="text-sm text-text-secondary text-center py-8">Sin registros de asistencia este mes.</p>
        ) : (
          days.map(d => (
            <div key={d.date} className="flex items-center justify-between bg-white rounded-xl border border-border px-4 py-3">
              <div>
                <div className="text-[14px] font-medium text-brand-900 capitalize">{formatDate(d.date)}</div>
                {d.onLicense && d.note && <div className="text-[12px] text-text-secondary">{d.note}</div>}
              </div>
              <span className={`text-[12px] font-semibold px-2.5 py-1 rounded-full shrink-0 ${STATUS_STYLE[d.status].className}`}>
                {STATUS_STYLE[d.status].label}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
