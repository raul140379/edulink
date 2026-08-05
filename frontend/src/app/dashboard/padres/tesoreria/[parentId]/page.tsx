'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Plus, DollarSign, CheckCircle, AlertCircle, Clock, CreditCard, Pencil } from 'lucide-react'
import Card from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import { Input, Select } from '@/components/ui/Input'
import { useToast } from '@/components/ui/ToastProvider'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

interface Payment {
  id:        number
  amount:    number
  method:    string
  reference?: string
  note?:     string
  date:      string
}

interface Charge {
  id:          number
  title:       string
  description?: string
  amount:      number
  paidAmount:  number
  type:        string
  target:      string
  status:      string
  dueDate?:    string
  tolerance:   boolean
  toleranceNote?: string
  createdAt:   string
  student?:    { id: number; firstName: string; lastName: string }
  academicYear: { year: number }
  payments:    Payment[]
}

interface Account {
  parent: {
    id: number; firstName: string; lastName: string; ci?: string; phone?: string
    students: { relationType: string; student: { id: number; firstName: string; lastName: string } }[]
  }
  charges: Charge[]
  summary: { totalDebt: number; totalPaid: number; totalPending: number }
}

const TYPE_LABELS: Record<string, string> = {
  CUOTA_INICIAL:    'Cuota Inicial',
  DEUDA_ANTERIOR:   'Deuda Anterior',
  MULTA_ASAMBLEA:   'Multa Asamblea',
  MINGA:            'Minga',
  MULTA_REUNION:    'Multa Reunión',
  ACTIVIDAD:        'Actividad',
  MATERIAL_ESCOLAR: 'Material Escolar',
  OTRO:             'Otro',
}

const METHOD_LABELS: Record<string, string> = {
  EFECTIVO:         'Efectivo',
  DEPOSITO_BANCARIO:'Depósito Bancario',
  QR:               'QR',
  TRANSFERENCIA:    'Transferencia',
  OTRO:             'Otro',
}

const STATUS_TONE: Record<string, 'danger' | 'warning' | 'success' | 'neutral'> = {
  PENDIENTE: 'danger',
  PARCIAL:   'warning',
  PAGADO:    'success',
  ANULADO:   'neutral',
}

const STATUS_LABEL: Record<string, string> = {
  PENDIENTE: 'Pendiente',
  PARCIAL:   'Parcial',
  PAGADO:    'Pagado',
  ANULADO:   'Anulado',
}

const fmt     = (n: number) => `Bs. ${n.toFixed(2)}`
const fmtDate = (d: string) => new Date(d).toLocaleDateString('es-BO', { day: '2-digit', month: 'short', year: 'numeric' })

export default function TutorAccountPage() {
  const params = useParams()
  const router = useRouter()
  const toast  = useToast()
  const parentId = params.parentId as string
  const userRole = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('user') || '{}').role : ''
  const canEdit  = userRole === 'SUPER_ADMIN' || userRole === 'JUNTA_ESCOLAR'
  const [account,      setAccount]      = useState<Account | null>(null)
  const [loading,      setLoading]      = useState(true)
  const [showPayModal, setShowPayModal] = useState(false)
  const [selectedCharge, setSelectedCharge] = useState<Charge | null>(null)
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null)
  const [saving,       setSaving]       = useState(false)
  const [payForm,      setPayForm]      = useState({ amount: '', method: 'EFECTIVO', reference: '', note: '' })

  const fetchAccount = async () => {
    const token = localStorage.getItem('token')
    setLoading(true)
    try {
      const res  = await fetch(`${API_URL}/api/treasury/parents/${parentId}/account`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await res.json()
      if (res.ok) setAccount(data)
      else toast('Error al cargar estado de cuenta', 'error')
    } catch { toast('Error de conexión', 'error') }
    finally  { setLoading(false) }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchAccount() }, [parentId])

  const openPayModal = (charge: Charge) => {
    setSelectedCharge(charge)
    setEditingPayment(null)
    setPayForm({ amount: (charge.amount - charge.paidAmount).toFixed(2), method: 'EFECTIVO', reference: '', note: '' })
    setShowPayModal(true)
  }

  const openEditPayment = (charge: Charge, payment: Payment) => {
    setSelectedCharge(charge)
    setEditingPayment(payment)
    setPayForm({
      amount: payment.amount.toFixed(2), method: payment.method,
      reference: payment.reference || '', note: payment.note || '',
    })
    setShowPayModal(true)
  }

  const handleSubmitPayment = async () => {
    if (!selectedCharge) return
    const token = localStorage.getItem('token')
    setSaving(true)
    try {
      const url    = editingPayment
        ? `${API_URL}/api/treasury/payments/${editingPayment.id}`
        : `${API_URL}/api/treasury/${selectedCharge.id}/payments`
      const method = editingPayment ? 'PUT' : 'POST'
      const res  = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payForm),
      })
      const data = await res.json()
      if (!res.ok) { toast(data.message, 'error'); return }
      toast(data.message, 'success')
      setShowPayModal(false)
      setEditingPayment(null)
      fetchAccount()
    } catch { toast('Error de conexión', 'error') }
    finally  { setSaving(false) }
  }

  if (loading) return <div className="flex justify-center py-16"><p className="text-sm text-neutral-500">Cargando...</p></div>
  if (!account) return <div className="flex justify-center py-16"><p className="text-sm text-neutral-500">No se encontró el estado de cuenta</p></div>

  const { parent, charges, summary } = account
  const pending = charges.filter(c => c.status === 'PENDIENTE' || c.status === 'PARCIAL')
  const paid    = charges.filter(c => c.status === 'PAGADO')

  return (
    <div>
      <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
        <button onClick={() => router.back()} className="flex items-center gap-1.5 text-neutral-500 hover:text-brand-700 text-[13px]">
          <ArrowLeft size={16}/> Volver
        </button>
        <div className="flex items-center gap-3.5 flex-1">
          <div className="w-13 h-13 rounded-full bg-brand-700 text-white flex items-center justify-center text-lg font-bold shrink-0" style={{ width: 52, height: 52 }}>
            {parent.firstName[0]}{parent.lastName[0]}
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-brand-700 mb-1">{parent.lastName} {parent.firstName}</h1>
            <div className="flex gap-3 text-xs text-neutral-500 mb-1.5">
              {parent.ci    && <span>CI: {parent.ci}</span>}
              {parent.phone && <span>📱 {parent.phone}</span>}
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {parent.students.map(ps => (
                <span key={ps.student.id} className="text-[11px] bg-brand-100 text-brand-700 px-2 py-0.5 rounded-full">
                  {ps.student.lastName} {ps.student.firstName}
                </span>
              ))}
            </div>
          </div>
        </div>
        {canEdit && (
          <Button onClick={() => router.push(`/dashboard/padres/cargos/nuevo?parentId=${parentId}`)}>
            <Plus size={16}/> Nuevo cargo
          </Button>
        )}
      </div>

      <div className="grid grid-cols-3 gap-3 mb-5">
        <Card className="flex items-center gap-3">
          <DollarSign size={20} className="text-brand-700"/>
          <div><div className="text-[11px] text-neutral-500 uppercase tracking-wide mb-0.5">Total cargado</div><div className="text-lg font-bold text-brand-700">{fmt(summary.totalDebt)}</div></div>
        </Card>
        <Card className="flex items-center gap-3">
          <CheckCircle size={20} className="text-success-700"/>
          <div><div className="text-[11px] text-neutral-500 uppercase tracking-wide mb-0.5">Total pagado</div><div className="text-lg font-bold text-brand-700">{fmt(summary.totalPaid)}</div></div>
        </Card>
        <Card className={summary.totalPending > 0 ? '!border-danger-500/40' : '!border-success-500/40'}>
          <div className="flex items-center gap-3">
            <AlertCircle size={20} className={summary.totalPending > 0 ? 'text-danger-600' : 'text-success-700'}/>
            <div><div className="text-[11px] text-neutral-500 uppercase tracking-wide mb-0.5">Saldo pendiente</div><div className="text-lg font-bold text-brand-700">{fmt(summary.totalPending)}</div></div>
          </div>
        </Card>
      </div>

      {pending.length > 0 && (
        <Card padded={false} className="overflow-hidden mb-4">
          <div className="flex items-center gap-2 px-4.5 py-3.5 border-b border-neutral-100 text-[13px] font-bold text-brand-700">
            <AlertCircle size={15} className="text-danger-600"/> Cargos pendientes
          </div>
          <div className="flex flex-col">
            {pending.map(c => (
              <div key={c.id} className="flex justify-between items-start gap-4 px-4.5 py-4 border-b border-neutral-100 last:border-b-0">
                <div className="flex-1 flex flex-col gap-1.5">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Badge tone="brand">{TYPE_LABELS[c.type] || c.type}</Badge>
                    <Badge tone={STATUS_TONE[c.status]}>{STATUS_LABEL[c.status]}</Badge>
                    {c.tolerance && <Badge tone="warning">⚠️ Tolerancia</Badge>}
                  </div>
                  <div className="text-sm font-semibold text-brand-700">{c.title}</div>
                  {c.student && <div className="text-xs text-info-500">Estudiante: {c.student.lastName} {c.student.firstName}</div>}
                  {c.description && <div className="text-xs text-neutral-500">{c.description}</div>}
                  {c.toleranceNote && <div className="text-[11px] text-[#7A6000] bg-warning-100 rounded-md px-2 py-1">{c.toleranceNote}</div>}
                  <div className="flex items-center gap-2.5 text-[11px] text-neutral-500">
                    <span>{c.academicYear.year}</span>
                    {c.dueDate && <span className="flex items-center gap-1"><Clock size={11}/> Vence: {fmtDate(c.dueDate)}</span>}
                  </div>
                  {c.payments.length > 0 && (
                    <div className="flex flex-col gap-1 mt-1">
                      {c.payments.map(p => (
                        <div key={p.id} className="flex items-center gap-2 bg-neutral-100 rounded-md px-2.5 py-1.5 text-[11px]">
                          <span className="bg-brand-100 text-brand-700 px-1.5 py-0.5 rounded-[10px] font-medium">{METHOD_LABELS[p.method] || p.method}</span>
                          <span className="font-semibold text-success-700">{fmt(p.amount)}</span>
                          <span className="text-neutral-500">{fmtDate(p.date)}</span>
                          {p.reference && <span className="text-neutral-500 italic">Ref: {p.reference}</span>}
                          {canEdit && (
                            <button onClick={() => openEditPayment(c, p)} className="ml-auto text-brand-600 hover:text-brand-700 flex items-center gap-0.5">
                              <Pencil size={11}/> Editar
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex flex-col items-end gap-2 min-w-[140px]">
                  <div className="flex flex-col items-end gap-0.5">
                    <div className="text-base font-bold text-brand-700">{fmt(c.amount)}</div>
                    <div className="text-[11px] text-success-700">Pagado: {fmt(c.paidAmount)}</div>
                    <div className="text-xs font-semibold text-danger-600">Pendiente: {fmt(c.amount - c.paidAmount)}</div>
                  </div>
                  {canEdit && (
                    <Button size="sm" onClick={() => openPayModal(c)}>
                      <CreditCard size={13}/> Registrar pago
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {paid.length > 0 && (
        <Card padded={false} className="overflow-hidden mb-4">
          <div className="flex items-center gap-2 px-4.5 py-3.5 border-b border-neutral-100 text-[13px] font-bold text-brand-700">
            <CheckCircle size={15} className="text-success-700"/> Cargos pagados
          </div>
          <div className="flex flex-col">
            {paid.map(c => (
              <div key={c.id} className="flex justify-between items-start gap-4 px-4.5 py-4 border-b border-neutral-100 last:border-b-0 bg-neutral-100/30">
                <div className="flex-1 flex flex-col gap-1.5">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Badge tone="brand">{TYPE_LABELS[c.type] || c.type}</Badge>
                    <Badge tone="success">Pagado</Badge>
                  </div>
                  <div className="text-sm font-semibold text-brand-700">{c.title}</div>
                  {c.student && <div className="text-xs text-info-500">Estudiante: {c.student.lastName} {c.student.firstName}</div>}
                  <div className="text-[11px] text-neutral-500">{c.academicYear.year}</div>
                  {c.payments.length > 0 && (
                    <div className="flex flex-col gap-1 mt-1">
                      {c.payments.map(p => (
                        <div key={p.id} className="flex items-center gap-2 bg-neutral-100 rounded-md px-2.5 py-1.5 text-[11px]">
                          <span className="bg-brand-100 text-brand-700 px-1.5 py-0.5 rounded-[10px] font-medium">{METHOD_LABELS[p.method] || p.method}</span>
                          <span className="font-semibold text-success-700">{fmt(p.amount)}</span>
                          <span className="text-neutral-500">{fmtDate(p.date)}</span>
                          {p.reference && <span className="text-neutral-500 italic">Ref: {p.reference}</span>}
                          {canEdit && (
                            <button onClick={() => openEditPayment(c, p)} className="ml-auto text-brand-600 hover:text-brand-700 flex items-center gap-0.5">
                              <Pencil size={11}/> Editar
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="text-base font-bold text-success-700">{fmt(c.amount)}</div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {charges.length === 0 && (
        <Card className="flex flex-col items-center gap-3 py-12 text-neutral-500">
          <DollarSign size={40} className="text-neutral-300"/>
          <p className="text-[13px]">No hay cargos registrados para este tutor</p>
          <Button onClick={() => router.push(`/dashboard/padres/cargos/nuevo?parentId=${parentId}`)}>
            <Plus size={14}/> Crear primer cargo
          </Button>
        </Card>
      )}

      {/* Modal registrar/editar pago */}
      <Modal
        open={showPayModal && !!selectedCharge} onClose={() => { setShowPayModal(false); setEditingPayment(null) }}
        title={editingPayment ? 'Editar Pago' : 'Registrar Pago'}
        footer={
          <>
            <Button variant="secondary" onClick={() => { setShowPayModal(false); setEditingPayment(null) }}>Cancelar</Button>
            <Button onClick={handleSubmitPayment} loading={saving}>
              {!saving && <CreditCard size={14}/>}
              {saving ? 'Guardando...' : editingPayment ? 'Guardar cambios' : 'Registrar pago'}
            </Button>
          </>
        }
      >
        {selectedCharge && (
          <div className="flex flex-col gap-4">
            <div className="bg-neutral-100 border border-neutral-300 rounded-lg p-3 text-[13px] text-neutral-500 leading-relaxed">
              <strong className="text-brand-700">{selectedCharge.title}</strong><br/>
              Saldo pendiente: <strong className="text-danger-600">
                {fmt(selectedCharge.amount - selectedCharge.paidAmount + (editingPayment?.amount || 0))}
              </strong>
            </div>
            <Input
              label="Monto (Bs.)" required type="number" step="0.01" min="0.01"
              max={selectedCharge.amount - selectedCharge.paidAmount + (editingPayment?.amount || 0)}
              value={payForm.amount} onChange={e => setPayForm({ ...payForm, amount: e.target.value })}
            />
            <Select label="Método de pago" required value={payForm.method} onChange={e => setPayForm({ ...payForm, method: e.target.value })}>
              <option value="EFECTIVO">Efectivo</option>
              <option value="DEPOSITO_BANCARIO">Depósito Bancario</option>
              <option value="QR">QR</option>
              <option value="TRANSFERENCIA">Transferencia</option>
              <option value="OTRO">Otro</option>
            </Select>
            <Input
              label="N° de comprobante / referencia" placeholder="Opcional"
              value={payForm.reference} onChange={e => setPayForm({ ...payForm, reference: e.target.value })}
            />
            <Input
              label="Nota adicional" placeholder="Opcional"
              value={payForm.note} onChange={e => setPayForm({ ...payForm, note: e.target.value })}
            />
          </div>
        )}
      </Modal>
    </div>
  )
}
