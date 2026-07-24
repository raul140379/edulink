'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, DollarSign, AlertCircle, CheckCircle, CreditCard, Users } from 'lucide-react'
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
  createdAt:   string
  student?:    { firstName: string; lastName: string }
  academicYear: { year: number }
  payments:    Payment[]
}

interface Parent {
  id:        number
  firstName: string
  lastName:  string
  ci?:       string
  phone?:    string
  charges:   Charge[]
  summary:   { totalDebt: number; totalPaid: number; totalPending: number }
}

interface Course {
  id:          number
  level:       string
  grade:       string
  parallel:    string
  shift:       string
  assignments: {
    student: {
      parents: {
        isTutor:     boolean
        relationType: string
        parent:      Parent
      }[]
    }
  }[]
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
  EFECTIVO:          'Efectivo',
  DEPOSITO_BANCARIO: 'Depósito',
  QR:                'QR',
  TRANSFERENCIA:     'Transferencia',
  OTRO:              'Otro',
}

const GRADE_LABELS: Record<string, string> = { PRIMERO: '1°', SEGUNDO: '2°', TERCERO: '3°', CUARTO: '4°', QUINTO: '5°', SEXTO: '6°' }
const LEVEL_LABELS: Record<string, string> = { INICIAL: 'Inicial', PRIMARIA: 'Primaria', SECUNDARIA: 'Secundaria' }

const fmt     = (n: number) => `Bs. ${n.toFixed(2)}`
const fmtDate = (d: string) => new Date(d).toLocaleDateString('es-BO', { day: '2-digit', month: 'short', year: 'numeric' })

export default function DelegateTesoreriaPage() {
  const router = useRouter()
  const toast  = useToast()
  const [course,         setCourse]         = useState<Course | null>(null)
  const [parents,        setParents]        = useState<Parent[]>([])
  const [loading,        setLoading]        = useState(true)
  const [error,          setError]          = useState('')
  const [showPayModal,   setShowPayModal]   = useState(false)
  const [selectedCharge, setSelectedCharge] = useState<Charge | null>(null)
  const [selectedParent, setSelectedParent] = useState<Parent | null>(null)
  const [saving,         setSaving]         = useState(false)
  const [payForm,        setPayForm]        = useState({ amount: '', method: 'EFECTIVO', reference: '', note: '' })
  const [search,         setSearch]         = useState('')

  useEffect(() => {
    const fetchData = async () => {
      const token = localStorage.getItem('token')
      setLoading(true)
      try {
        const res  = await fetch(`${API_URL}/api/delegates/my-course`, {
          headers: { Authorization: `Bearer ${token}` }
        })
        const data = await res.json()
        if (!res.ok) { setError(data.message); return }
        setCourse(data)

        const parentMap = new Map<number, any>()
        for (const a of data.assignments) {
          for (const ps of a.student.parents) {
            if (ps.isTutor && !parentMap.has(ps.parent.id)) {
              parentMap.set(ps.parent.id, ps.parent)
            }
          }
        }

        const tutorIds = Array.from(parentMap.keys())
        const parentsWithAccount = await Promise.all(
          tutorIds.map(async (parentId) => {
            const r = await fetch(`${API_URL}/api/treasury/parents/${parentId}/account`, {
              headers: { Authorization: `Bearer ${token}` }
            })
            const d = await r.json()
            if (r.ok) return d
            return null
          })
        )

        setParents(parentsWithAccount.filter(Boolean).map((p: any) => ({
          ...p.parent,
          charges: p.charges,
          summary: p.summary,
        })))

      } catch { setError('Error de conexión') }
      finally  { setLoading(false) }
    }
    fetchData()
  }, [])

  const openPayModal = (charge: Charge, parent: Parent) => {
    setSelectedCharge(charge)
    setSelectedParent(parent)
    setPayForm({ amount: (charge.amount - charge.paidAmount).toFixed(2), method: 'EFECTIVO', reference: '', note: '' })
    setShowPayModal(true)
  }

  const handlePay = async () => {
    if (!selectedCharge) return
    const token = localStorage.getItem('token')
    setSaving(true)
    try {
      const res  = await fetch(`${API_URL}/api/treasury/${selectedCharge.id}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payForm),
      })
      const data = await res.json()
      if (!res.ok) { toast(data.message, 'error'); return }
      toast(data.message, 'success')
      setShowPayModal(false)
      window.location.reload()
    } catch { toast('Error de conexión', 'error') }
    finally  { setSaving(false) }
  }

  const filtered = search
    ? parents.filter(p =>
        `${p.firstName} ${p.lastName}`.toLowerCase().includes(search.toLowerCase()) ||
        (p.ci && p.ci.includes(search))
      )
    : parents

  const totalDebt    = parents.reduce((sum, p) => sum + p.summary.totalDebt, 0)
  const totalPaid    = parents.reduce((sum, p) => sum + p.summary.totalPaid, 0)
  const totalPending = parents.reduce((sum, p) => sum + p.summary.totalPending, 0)
  const withDebt     = parents.filter(p => p.summary.totalPending > 0).length

  if (loading) return <div className="flex justify-center py-16"><p className="text-sm text-neutral-500">Cargando...</p></div>
  if (error)   return <div className="flex justify-center py-16"><p className="text-sm text-danger-600">{error}</p></div>

  return (
    <div>
      <div className="flex items-center gap-4 mb-6 flex-wrap">
        <button onClick={() => router.back()} className="flex items-center gap-1.5 text-neutral-500 hover:text-brand-700 text-[13px]">
          <ArrowLeft size={16}/> Volver
        </button>
        <div>
          <h1 className="text-xl font-bold text-brand-700 mb-1">Estado de Cuentas</h1>
          {course && <p className="text-[13px] text-neutral-500">{LEVEL_LABELS[course.level]} — {GRADE_LABELS[course.grade]} {course.parallel}</p>}
        </div>
      </div>

      <div className="grid gap-3 mb-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
        <Card className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-brand-100 text-brand-700"><DollarSign size={18}/></div>
          <div><div className="text-[10px] text-neutral-500 uppercase tracking-wide mb-0.5">Total cargado</div><div className="text-base font-bold text-brand-700">{fmt(totalDebt)}</div></div>
        </Card>
        <Card className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-success-100 text-success-700"><CheckCircle size={18}/></div>
          <div><div className="text-[10px] text-neutral-500 uppercase tracking-wide mb-0.5">Recaudado</div><div className="text-base font-bold text-brand-700">{fmt(totalPaid)}</div></div>
        </Card>
        <Card className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-danger-100 text-danger-600"><AlertCircle size={18}/></div>
          <div><div className="text-[10px] text-neutral-500 uppercase tracking-wide mb-0.5">Pendiente</div><div className="text-base font-bold text-brand-700">{fmt(totalPending)}</div></div>
        </Card>
        <Card className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-neutral-100 text-neutral-500"><Users size={18}/></div>
          <div><div className="text-[10px] text-neutral-500 uppercase tracking-wide mb-0.5">Con deuda</div><div className="text-base font-bold text-brand-700">{withDebt} de {parents.length}</div></div>
        </Card>
      </div>

      <div className="mb-4">
        <Input placeholder="Buscar tutor por nombre o CI..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {filtered.map(parent => (
        <Card key={parent.id} padded={false} className="overflow-hidden mb-3">
          <div className="flex items-center justify-between gap-2 px-4.5 py-3.5 border-b border-neutral-100 flex-wrap">
            <div>
              <div className="text-[15px] font-bold text-brand-700 mb-1">{parent.lastName} {parent.firstName}</div>
              <div className="flex gap-3 text-xs text-neutral-500">
                {parent.ci    && <span>CI: {parent.ci}</span>}
                {parent.phone && <span>📱 {parent.phone}</span>}
              </div>
            </div>
            <Badge tone={parent.summary.totalPending > 0 ? 'danger' : 'success'}>
              {parent.summary.totalPending > 0 ? `Debe: ${fmt(parent.summary.totalPending)}` : '✅ Al día'}
            </Badge>
          </div>

          {parent.charges.filter(c => c.status !== 'ANULADO').length > 0 && (
            <div className="flex flex-col">
              {parent.charges.filter(c => c.status !== 'ANULADO').map(c => (
                <div key={c.id} className="flex items-start justify-between gap-3 px-4.5 py-3 border-t border-neutral-100">
                  <div className="flex-1 flex flex-col gap-1">
                    <Badge tone="brand">{TYPE_LABELS[c.type] || c.type}</Badge>
                    <span className="text-[13px] font-medium text-brand-700">{c.title}</span>
                    {c.student && <span className="text-[11px] text-info-500">Estudiante: {c.student.lastName} {c.student.firstName}</span>}
                    {c.payments.length > 0 && (
                      <div className="flex flex-col gap-1 mt-1">
                        {c.payments.map(p => (
                          <span key={p.id} className="text-[11px] text-success-700 bg-success-100 px-2 py-0.5 rounded-[10px] w-fit">
                            {METHOD_LABELS[p.method]} {fmt(p.amount)} — {fmtDate(p.date)}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1 min-w-[120px]">
                    <div className="text-sm font-bold text-brand-700">{fmt(c.amount)}</div>
                    <div className="text-[11px] text-success-700">Pagado: {fmt(c.paidAmount)}</div>
                    {(c.status === 'PENDIENTE' || c.status === 'PARCIAL') && (
                      <>
                        <div className="text-xs font-semibold text-danger-600">Pendiente: {fmt(c.amount - c.paidAmount)}</div>
                        <Button size="sm" onClick={() => openPayModal(c, parent)} className="mt-1">
                          <CreditCard size={12}/> Pago
                        </Button>
                      </>
                    )}
                    {c.status === 'PAGADO' && <span className="text-[11px] text-success-700">✅ Pagado</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      ))}

      {filtered.length === 0 && (
        <div className="flex justify-center py-12"><p className="text-sm text-neutral-500">No se encontraron tutores</p></div>
      )}

      {/* Modal pago */}
      <Modal
        open={showPayModal && !!selectedCharge} onClose={() => setShowPayModal(false)} title="Registrar Pago"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowPayModal(false)}>Cancelar</Button>
            <Button onClick={handlePay} loading={saving}>
              {!saving && <CreditCard size={14}/>}
              {saving ? 'Registrando...' : 'Registrar pago'}
            </Button>
          </>
        }
      >
        {selectedCharge && (
          <div className="flex flex-col gap-4">
            <div className="bg-neutral-100 border border-neutral-300 rounded-lg p-3 text-[13px] text-neutral-500 leading-relaxed">
              <strong className="text-brand-700">{selectedCharge.title}</strong><br/>
              Tutor: {selectedParent?.lastName} {selectedParent?.firstName}<br/>
              Pendiente: <strong className="text-danger-600">{fmt(selectedCharge.amount - selectedCharge.paidAmount)}</strong>
            </div>
            <Input
              label="Monto (Bs.)" required type="number" step="0.01" min="0.01"
              max={selectedCharge.amount - selectedCharge.paidAmount}
              value={payForm.amount} onChange={e => setPayForm({ ...payForm, amount: e.target.value })}
            />
            <Select label="Método" required value={payForm.method} onChange={e => setPayForm({ ...payForm, method: e.target.value })}>
              <option value="EFECTIVO">Efectivo</option>
              <option value="DEPOSITO_BANCARIO">Depósito Bancario</option>
              <option value="QR">QR</option>
              <option value="TRANSFERENCIA">Transferencia</option>
              <option value="OTRO">Otro</option>
            </Select>
            <Input
              label="Referencia" placeholder="Opcional"
              value={payForm.reference} onChange={e => setPayForm({ ...payForm, reference: e.target.value })}
            />
            <Input
              label="Nota" placeholder="Opcional"
              value={payForm.note} onChange={e => setPayForm({ ...payForm, note: e.target.value })}
            />
          </div>
        )}
      </Modal>
    </div>
  )
}
