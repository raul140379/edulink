'use client'

import { useCallback, useEffect, useState } from 'react'
import { CalendarClock, Check, X, Clock3 } from 'lucide-react'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import { Textarea } from '@/components/ui/Input'
import { useToast } from '@/components/ui/ToastProvider'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

interface LicenseRequest {
  id:              number
  status:          'PENDIENTE' | 'APROBADA' | 'RECHAZADA'
  startDate:       string
  endDate:         string
  reason:          string
  createdAt:       string
  student:         { id: number; firstName: string; lastName: string }
  requestedBy:     { id: number; firstName: string; lastName: string; phone?: string }
  reviewedAt:      string | null
  reviewNote:      string | null
  reviewedByName:  string | null
}

// timeZone: 'UTC' es obligatorio acá — startDate/endDate son fechas de
// calendario puras ancladas a medianoche UTC (mismo dayRange TZ-safe del
// backend), nunca un instante real. Sin esto, toLocaleDateString aplica la
// zona horaria local del navegador y corre la fecha un día hacia atrás.
const fmtDate = (d: string) => new Date(d).toLocaleDateString('es-BO', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'UTC' })
const fmtDateTime = (d: string) => new Date(d).toLocaleDateString('es-BO', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })

export default function AdminLicenciasPage() {
  const toast = useToast()
  const [requests, setRequests] = useState<LicenseRequest[]>([])
  const [loading, setLoading] = useState(true)

  const [rejectTarget, setRejectTarget] = useState<LicenseRequest | null>(null)
  const [rejectNote, setRejectNote] = useState('')
  const [approveTarget, setApproveTarget] = useState<LicenseRequest | null>(null)
  const [approveNote, setApproveNote] = useState('')
  const [saving, setSaving] = useState(false)

  const fetchRequests = useCallback(async () => {
    const token = localStorage.getItem('token')
    setLoading(true)
    try {
      const res  = await fetch(`${API_URL}/api/student-license-requests`, { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      if (res.ok) setRequests(data)
    } catch { toast('Error de conexión', 'error') }
    finally { setLoading(false) }
  }, [toast])

  useEffect(() => { fetchRequests() }, [fetchRequests])

  const submitApprove = async () => {
    if (!approveTarget) return
    setSaving(true)
    const token = localStorage.getItem('token')
    try {
      const res  = await fetch(`${API_URL}/api/student-license-requests/${approveTarget.id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ note: approveNote || undefined }),
      })
      const data = await res.json()
      if (!res.ok) { toast(data.message || 'No se pudo aprobar la solicitud', 'error'); return }
      toast('Solicitud aprobada — la licencia ya está activa.', 'success')
      setApproveTarget(null); setApproveNote('')
      fetchRequests()
    } catch { toast('Error de conexión', 'error') }
    finally { setSaving(false) }
  }

  const submitReject = async () => {
    if (!rejectTarget || !rejectNote.trim()) return
    setSaving(true)
    const token = localStorage.getItem('token')
    try {
      const res  = await fetch(`${API_URL}/api/student-license-requests/${rejectTarget.id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ note: rejectNote }),
      })
      const data = await res.json()
      if (!res.ok) { toast(data.message || 'No se pudo rechazar la solicitud', 'error'); return }
      toast('Solicitud rechazada.', 'success')
      setRejectTarget(null); setRejectNote('')
      fetchRequests()
    } catch { toast('Error de conexión', 'error') }
    finally { setSaving(false) }
  }

  const pending  = requests.filter(r => r.status === 'PENDIENTE')
  const resolved = requests.filter(r => r.status !== 'PENDIENTE')

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-brand-700 mb-1">Solicitudes de Licencia</h1>
        <p className="text-[13px] text-neutral-500">Pedidos de licencia enviados por los padres desde su app — solo Dirección puede aprobar o rechazar</p>
      </div>

      <Card className="flex flex-col gap-3.5 mb-5">
        <div className="flex items-center gap-1.5 text-xs font-bold text-brand-700 uppercase tracking-wide pb-2 border-b border-neutral-100">
          <Clock3 size={14}/> Pendientes ({loading ? '…' : pending.length})
        </div>
        {loading ? (
          <div className="flex justify-center py-6"><p className="text-sm text-neutral-500">Cargando...</p></div>
        ) : pending.length === 0 ? (
          <p className="text-[13px] text-neutral-500 italic py-2">No hay solicitudes pendientes</p>
        ) : (
          <div className="flex flex-col gap-2.5">
            {pending.map(r => (
              <div key={r.id} className="bg-neutral-100/60 border border-neutral-300 rounded-lg p-3 flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-[13px] font-semibold text-brand-700">{r.student.lastName} {r.student.firstName}</span>
                  <span className="text-[11px] text-neutral-500">{fmtDateTime(r.createdAt)}</span>
                </div>
                <div className="text-xs text-neutral-500">
                  Del <strong>{fmtDate(r.startDate)}</strong> al <strong>{fmtDate(r.endDate)}</strong>
                </div>
                <div className="text-xs text-neutral-500">
                  Solicitado por <strong>{r.requestedBy.lastName} {r.requestedBy.firstName}</strong>{r.requestedBy.phone ? ` · 📱 ${r.requestedBy.phone}` : ''}
                </div>
                <div className="text-xs text-neutral-700 bg-white border border-neutral-200 rounded-md p-2">
                  {r.reason}
                </div>
                <div className="flex items-center gap-2 justify-end">
                  <Button variant="secondary" size="sm" onClick={() => { setRejectTarget(r); setRejectNote('') }}>
                    <X size={13}/> Rechazar
                  </Button>
                  <Button size="sm" onClick={() => { setApproveTarget(r); setApproveNote('') }}>
                    <Check size={13}/> Aprobar
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="flex flex-col gap-3.5">
        <div className="flex items-center gap-1.5 text-xs font-bold text-brand-700 uppercase tracking-wide pb-2 border-b border-neutral-100">
          <CalendarClock size={14}/> Resueltas ({loading ? '…' : resolved.length})
        </div>
        {loading ? null : resolved.length === 0 ? (
          <p className="text-[13px] text-neutral-500 italic py-2">Todavía no se resolvió ninguna solicitud</p>
        ) : (
          <div className="flex flex-col gap-2.5 max-h-[500px] overflow-y-auto">
            {resolved.map(r => (
              <div key={r.id} className="bg-neutral-100/60 border border-neutral-300 rounded-lg p-3 flex flex-col gap-1">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-[13px] font-semibold text-brand-700">{r.student.lastName} {r.student.firstName}</span>
                  <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${r.status === 'APROBADA' ? 'bg-[#E1F5EE] text-[#0F6E56]' : 'bg-[#FFF0F0] text-[#C0392B]'}`}>
                    {r.status === 'APROBADA' ? 'Aprobada' : 'Rechazada'}
                  </span>
                </div>
                <div className="text-xs text-neutral-500">
                  Del {fmtDate(r.startDate)} al {fmtDate(r.endDate)} · Solicitado por {r.requestedBy.lastName} {r.requestedBy.firstName}
                </div>
                <div className="text-xs text-neutral-500">{r.reason}</div>
                {r.reviewNote && (
                  <div className="text-xs text-neutral-700 bg-white border border-neutral-200 rounded-md p-2">
                    {r.status === 'RECHAZADA' ? 'Motivo del rechazo: ' : 'Nota: '}{r.reviewNote}
                  </div>
                )}
                <div className="text-[11px] text-neutral-500">
                  Resuelto por {r.reviewedByName} · {r.reviewedAt && fmtDateTime(r.reviewedAt)}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {approveTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => !saving && setApproveTarget(null)}>
          <div className="bg-white rounded-2xl p-5 w-full max-w-md flex flex-col gap-3.5" onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-bold text-brand-700">Aprobar solicitud</h3>
            <p className="text-[13px] text-neutral-600">
              {approveTarget.student.lastName} {approveTarget.student.firstName} — del {fmtDate(approveTarget.startDate)} al {fmtDate(approveTarget.endDate)}
            </p>
            <Textarea label="Nota para el padre (opcional)" rows={3} value={approveNote} onChange={e => setApproveNote(e.target.value)} />
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setApproveTarget(null)} disabled={saving}>Cancelar</Button>
              <Button onClick={submitApprove} loading={saving}>{saving ? 'Guardando…' : 'Confirmar aprobación'}</Button>
            </div>
          </div>
        </div>
      )}

      {rejectTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => !saving && setRejectTarget(null)}>
          <div className="bg-white rounded-2xl p-5 w-full max-w-md flex flex-col gap-3.5" onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-bold text-brand-700">Rechazar solicitud</h3>
            <p className="text-[13px] text-neutral-600">
              {rejectTarget.student.lastName} {rejectTarget.student.firstName} — del {fmtDate(rejectTarget.startDate)} al {fmtDate(rejectTarget.endDate)}
            </p>
            <Textarea label="Motivo del rechazo" required rows={3} value={rejectNote} onChange={e => setRejectNote(e.target.value)} placeholder="El padre va a ver este motivo" />
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setRejectTarget(null)} disabled={saving}>Cancelar</Button>
              <Button variant="danger" onClick={submitReject} loading={saving} disabled={!rejectNote.trim()}>{saving ? 'Guardando…' : 'Confirmar rechazo'}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
