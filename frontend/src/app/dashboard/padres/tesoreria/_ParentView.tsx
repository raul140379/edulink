'use client'

import { useEffect, useState } from 'react'
import { DollarSign, CheckCircle, AlertCircle, Clock, ChevronDown, ChevronUp } from 'lucide-react'
import Card from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

interface Payment {
  id: number; amount: number; method: string; reference?: string; note?: string; date: string
}

interface Charge {
  id:          number
  title:       string
  description?: string
  amount:      number
  paidAmount:  number
  status:      string
  type:        string
  dueDate?:    string
  tolerance:   boolean
  academicYear?: { year: number }
  student?:    { firstName: string; lastName: string }
  payments:    Payment[]
}

interface Summary {
  totalDebt:    number
  totalPaid:    number
  totalPending: number
}

const TYPE_LABELS: Record<string,string> = {
  CUOTA_INICIAL:    'Cuota Inicial',
  DEUDA_ANTERIOR:   'Deuda Anterior',
  MULTA_ASAMBLEA:   'Multa Asamblea',
  MINGA:            'Minga',
  MULTA_REUNION:    'Multa Reunión',
  ACTIVIDAD:        'Actividad',
  MATERIAL_ESCOLAR: 'Material Escolar',
  OTRO:             'Otro',
}

const METHOD_LABELS: Record<string,string> = {
  EFECTIVO:     'Efectivo',
  TRANSFERENCIA:'Transferencia',
  QR:           'QR',
  OTRO:         'Otro',
}

const STATUS_TONE: Record<string, 'danger' | 'warning' | 'success' | 'neutral'> = {
  PENDIENTE: 'danger',
  PARCIAL:   'warning',
  PAGADO:    'success',
  ANULADO:   'neutral',
}
const STATUS_LABELS: Record<string,string> = {
  PENDIENTE: 'Pendiente', PARCIAL: 'Parcial', PAGADO: 'Pagado', ANULADO: 'Anulado',
}

const fmt     = (n: number) => `Bs. ${n.toFixed(2)}`
const fmtDate = (d: string) => new Date(d).toLocaleDateString('es-BO', { day:'2-digit', month:'short', year:'numeric' })

export default function ParentTesoreriaPage() {
  const [charges,    setCharges]    = useState<Charge[]>([])
  const [summary,    setSummary]    = useState<Summary | null>(null)
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState('')
  const [expanded,   setExpanded]   = useState<number | null>(null)
  const [filterStatus, setFilterStatus] = useState<string>('all')

  useEffect(() => {
    const init = async () => {
      const token = localStorage.getItem('token')
      if (!token) { setError('No autenticado'); setLoading(false); return }
      setLoading(true)
      try {
        const meRes  = await fetch(`${API_URL}/api/parents/me`, { headers: { Authorization: `Bearer ${token}` } })
        const meData = await meRes.json()
        if (!meRes.ok) { setError(meData.message || 'Error al cargar perfil'); return }

        const aRes  = await fetch(`${API_URL}/api/treasury/parents/${meData.id}/account`, {
          headers: { Authorization: `Bearer ${token}` }
        })
        const aData = await aRes.json()
        if (aRes.ok) {
          setCharges(aData.charges || [])
          setSummary(aData.summary || null)
        } else {
          setError(aData.message || 'Error al cargar estado de cuenta')
        }
      } catch { setError('Error de conexión') }
      finally  { setLoading(false) }
    }
    init()
  }, [])

  const filtered = charges.filter(c => {
    if (filterStatus === 'all') return c.status !== 'ANULADO'
    return c.status === filterStatus
  })

  const pendingCount = charges.filter(c => c.status === 'PENDIENTE' || c.status === 'PARCIAL').length

  if (loading) return <div className="flex justify-center py-16"><p className="text-sm text-neutral-500">Cargando...</p></div>
  if (error)   return <div className="flex justify-center py-16"><p className="text-sm text-danger-600">{error}</p></div>

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-brand-700 mb-1">Estado de Cuenta</h1>
        <p className="text-[13px] text-neutral-500">Historial de cargos y pagos</p>
      </div>

      {summary && (
        <div className="grid gap-3 mb-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
          <Card className="flex items-center gap-3">
            <div className="p-2.5 rounded-[10px] bg-brand-100 text-brand-700"><DollarSign size={20}/></div>
            <div><div className="text-[11px] text-neutral-500 uppercase tracking-wide mb-0.5">Total asignado</div><div className="text-lg font-bold text-brand-700">{fmt(summary.totalDebt)}</div></div>
          </Card>
          <Card className="flex items-center gap-3">
            <div className="p-2.5 rounded-[10px] bg-success-100 text-success-700"><CheckCircle size={20}/></div>
            <div><div className="text-[11px] text-neutral-500 uppercase tracking-wide mb-0.5">Total pagado</div><div className="text-lg font-bold text-success-700">{fmt(summary.totalPaid)}</div></div>
          </Card>
          <Card className="flex items-center gap-3">
            <div className={`p-2.5 rounded-[10px] ${summary.totalPending > 0 ? 'bg-danger-100 text-danger-600' : 'bg-success-100 text-success-700'}`}><AlertCircle size={20}/></div>
            <div><div className="text-[11px] text-neutral-500 uppercase tracking-wide mb-0.5">Saldo pendiente</div><div className={`text-lg font-bold ${summary.totalPending > 0 ? 'text-danger-600' : 'text-success-700'}`}>{fmt(summary.totalPending)}</div></div>
          </Card>
          <Card className="flex items-center gap-3">
            <div className={`p-2.5 rounded-[10px] ${pendingCount > 0 ? 'bg-warning-100 text-[#BA7517]' : 'bg-success-100 text-success-700'}`}><Clock size={20}/></div>
            <div><div className="text-[11px] text-neutral-500 uppercase tracking-wide mb-0.5">Cargos pendientes</div><div className={`text-lg font-bold ${pendingCount > 0 ? 'text-[#BA7517]' : 'text-success-700'}`}>{pendingCount}</div></div>
          </Card>
        </div>
      )}

      {summary && summary.totalPending === 0 && charges.length > 0 ? (
        <div className="flex items-center gap-2 px-3.5 py-2.5 bg-success-100 border border-success-500/40 rounded-lg text-[13px] text-success-700 mb-4"><CheckCircle size={14}/> ¡Estás al día con todos los pagos! ✓</div>
      ) : summary && summary.totalPending > 0 ? (
        <div className="flex items-center gap-2 px-3.5 py-2.5 bg-danger-100 border border-danger-500/40 rounded-lg text-[13px] text-danger-600 mb-4"><AlertCircle size={14}/> Tienes {fmt(summary.totalPending)} pendiente de pago</div>
      ) : null}

      <div className="flex gap-2 flex-wrap mb-4">
        {[
          { value: 'all',       label: `Activos (${charges.filter(c => c.status !== 'ANULADO').length})` },
          { value: 'PENDIENTE', label: `Pendientes (${charges.filter(c => c.status === 'PENDIENTE').length})` },
          { value: 'PARCIAL',   label: `Parciales (${charges.filter(c => c.status === 'PARCIAL').length})` },
          { value: 'PAGADO',    label: `Pagados (${charges.filter(c => c.status === 'PAGADO').length})` },
        ].map(opt => (
          <button
            key={opt.value} onClick={() => setFilterStatus(opt.value)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-medium border transition-colors ${filterStatus === opt.value ? 'bg-brand-700 text-white border-brand-700' : 'bg-white text-neutral-500 border-neutral-300 hover:border-brand-500 hover:text-brand-700'}`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 py-14 text-neutral-500">
          <DollarSign size={40} className="text-neutral-300"/>
          <p className="text-[13px]">No hay cargos en esta categoría</p>
        </Card>
      ) : (
        <div className="flex flex-col gap-2.5">
          {filtered.map(c => {
            const exp = expanded === c.id
            const pending = c.amount - c.paidAmount
            const overdue = c.dueDate && new Date(c.dueDate) < new Date() && c.status !== 'PAGADO'
            return (
              <Card key={c.id} padded={false} className="overflow-hidden">
                <div className="flex items-start justify-between gap-4 p-4 cursor-pointer hover:bg-neutral-100/40" onClick={() => setExpanded(exp ? null : c.id)}>
                  <div className="flex-1 flex flex-col gap-1">
                    <Badge tone="brand">{TYPE_LABELS[c.type] || c.type}</Badge>
                    <div className="text-sm font-semibold text-brand-700 mt-0.5">{c.title}</div>
                    {c.description && <div className="text-xs text-neutral-500">{c.description}</div>}
                    {c.student && <div className="text-xs text-neutral-500">👤 {c.student.lastName} {c.student.firstName}</div>}
                    <div className="flex gap-2 flex-wrap mt-1">
                      {c.dueDate && <span className={`text-[11px] ${overdue ? 'text-danger-600 font-semibold' : 'text-neutral-500'}`}>📅 Vence: {fmtDate(c.dueDate)}</span>}
                      {c.academicYear && <span className="text-[11px] text-neutral-500 bg-neutral-100 px-2 py-0.5 rounded-full">Gestión {c.academicYear.year}</span>}
                      {c.tolerance && <span className="text-[11px] text-[#BA7517] bg-warning-100 px-2 py-0.5 rounded-full">⏱ Con tolerancia</span>}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <Badge tone={STATUS_TONE[c.status] || 'neutral'}>{STATUS_LABELS[c.status] || c.status}</Badge>
                    <div className="text-base font-bold text-brand-700">{fmt(c.amount)}</div>
                    {c.paidAmount > 0 && <div className="text-[11px] text-success-700">Pagado: {fmt(c.paidAmount)}</div>}
                    {pending > 0 && c.status !== 'ANULADO' && <div className="text-xs font-semibold text-danger-600">Pendiente: {fmt(pending)}</div>}
                    {c.payments.length > 0 && (
                      <button className="flex items-center gap-1 text-[11px] text-neutral-500 hover:text-brand-700">
                        {exp ? <ChevronUp size={13}/> : <ChevronDown size={13}/>}
                        {c.payments.length} pago{c.payments.length > 1 ? 's' : ''}
                      </button>
                    )}
                  </div>
                </div>

                {exp && c.payments.length > 0 && (
                  <div className="border-t border-neutral-100 bg-neutral-100/40">
                    <div className="px-4 py-2 text-[11px] font-bold text-brand-700 uppercase tracking-wide">Historial de pagos</div>
                    {c.payments.map(p => (
                      <div key={p.id} className="flex items-center justify-between gap-3 px-4 py-2.5 border-t border-neutral-100">
                        <div className="flex items-center gap-2">
                          <CheckCircle size={13} className="text-success-700"/>
                          <div>
                            <div className="text-[13px] font-medium text-brand-700">{METHOD_LABELS[p.method] || p.method}</div>
                            {p.reference && <div className="text-[11px] text-neutral-500">Ref: {p.reference}</div>}
                            {p.note && <div className="text-[11px] text-neutral-500">{p.note}</div>}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-[13px] font-bold text-success-700">{fmt(p.amount)}</div>
                          <div className="text-[11px] text-neutral-500">{fmtDate(p.date)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
