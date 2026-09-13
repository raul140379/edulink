'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import Button from '@/components/Button'
import { hijosApi, MyChild } from '@/modules/hijos/api'
import { licenciasApi } from '@/modules/licencias/api'
import { ApiError } from '@/lib/api'

const GRADES: Record<string, string> = { PRIMERO: '1°', SEGUNDO: '2°', TERCERO: '3°', CUARTO: '4°', QUINTO: '5°', SEXTO: '6°' }
const courseLabel = (c: MyChild['course']) => (c ? `${GRADES[c.grade] || c.grade} "${c.parallel}"` : '')

export default function SolicitarLicenciaPage() {
  const router = useRouter()
  const [children, setChildren] = useState<MyChild[]>([])
  const [studentId, setStudentId] = useState<number | ''>('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    hijosApi.getMyChildren()
      .then(list => { setChildren(list); if (list.length > 0) setStudentId(list[0].id) })
      .catch(() => setError('No se pudo cargar la lista de hijos'))
  }, [])

  const submit = async () => {
    if (!studentId) { setError('Seleccioná un hijo/a'); return }
    if (!startDate || !endDate) { setError('Completá las dos fechas'); return }
    if (!reason.trim()) { setError('El motivo es requerido'); return }
    setError('')
    setSaving(true)
    try {
      await licenciasApi.create({ studentId, startDate, endDate, reason: reason.trim() })
      setDone(true)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error de conexión')
    } finally {
      setSaving(false)
    }
  }

  if (done) {
    return (
      <div className="flex flex-col max-w-lg mx-auto px-4 pt-4">
        <div className="flex items-center gap-2 mb-6">
          <button onClick={() => router.push('/')} className="p-1 -ml-1 text-brand-700 active:opacity-60">
            <ArrowLeft size={22} />
          </button>
          <h1 className="text-[17px] font-bold text-brand-700">Solicitar Licencia</h1>
        </div>
        <div className="bg-success-100 text-success-700 rounded-xl px-4 py-4 text-[14px] leading-relaxed">
          Tu solicitud fue enviada. Te avisamos apenas Dirección la resuelva.
        </div>
        <Button className="mt-4" onClick={() => router.push('/licencia-mias')}>Ver mis solicitudes</Button>
        <Button variant="ghost" className="mt-2" onClick={() => router.push('/')}>Volver al inicio</Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col max-w-lg mx-auto">
      <div className="px-4 pt-4 flex items-center gap-2">
        <button onClick={() => router.push('/')} className="p-1 -ml-1 text-brand-700 active:opacity-60">
          <ArrowLeft size={22} />
        </button>
        <h1 className="text-[17px] font-bold text-brand-700">Solicitar Licencia</h1>
      </div>

      <div className="px-4 pt-4 flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-[13px] font-semibold text-brand-700">Hijo/a</label>
          <select
            value={studentId} onChange={e => setStudentId(Number(e.target.value))}
            className="rounded-xl border border-border bg-white px-3.5 py-3 text-[15px] text-brand-900"
          >
            {children.length === 0 && <option value="">Sin hijos registrados</option>}
            {children.map(c => (
              <option key={c.id} value={c.id}>{c.lastName} {c.firstName}{c.course ? ` — ${courseLabel(c.course)}` : ''}</option>
            ))}
          </select>
        </div>

        <div className="flex gap-3">
          <div className="flex flex-col gap-1.5 flex-1">
            <label className="text-[13px] font-semibold text-brand-700">Desde</label>
            <input
              type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
              className="rounded-xl border border-border bg-white px-3.5 py-3 text-[15px] text-brand-900"
            />
          </div>
          <div className="flex flex-col gap-1.5 flex-1">
            <label className="text-[13px] font-semibold text-brand-700">Hasta</label>
            <input
              type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
              className="rounded-xl border border-border bg-white px-3.5 py-3 text-[15px] text-brand-900"
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[13px] font-semibold text-brand-700">Motivo</label>
          <textarea
            value={reason} onChange={e => setReason(e.target.value)} rows={4}
            placeholder="Contale a Dirección por qué necesitás la licencia"
            className="rounded-xl border border-border bg-white px-3.5 py-3 text-[15px] text-brand-900 resize-none"
          />
        </div>

        {error && <p className="text-sm text-danger-600 bg-danger-100 rounded-lg px-3 py-2.5">{error}</p>}

        <Button onClick={submit} loading={saving} disabled={children.length === 0}>Enviar solicitud</Button>
      </div>
    </div>
  )
}
