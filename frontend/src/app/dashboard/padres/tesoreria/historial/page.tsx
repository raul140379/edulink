'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Clock, RefreshCw, Trash2 } from 'lucide-react'
import Card from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import { Textarea } from '@/components/ui/Input'
import Table, { Column } from '@/components/ui/Table'
import PageHeader from '@/components/ui/PageHeader'
import Toolbar from '@/components/ui/Toolbar'
import EmptyState from '@/components/ui/EmptyState'
import LoadingState from '@/components/ui/LoadingState'
import Pagination from '@/components/ui/Pagination'
import { useToast } from '@/components/ui/ToastProvider'
import { useModuleFilters } from '@/hooks/useModuleFilters'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'
const PAGE_SIZE = 20

const METHOD_LABELS: Record<string, string> = {
  EFECTIVO: 'Efectivo', DEPOSITO_BANCARIO: 'Depósito Bancario', QR: 'QR', TRANSFERENCIA: 'Transferencia', OTRO: 'Otro',
}

interface Payment {
  id: number; amount: number; method: string; reference?: string; date: string
  parent: {
    id: number; firstName: string; lastName: string; ci?: string
    students: { student: { firstName: string; lastName: string } }[]
  }
  charge: {
    id: number; title: string; type: string; target: string
    academicYear: { year: number }
    student: { firstName: string; lastName: string } | null
    refunds: { amount: number; reason: string; date: string }[]
  }
}

const studentNames = (p: Payment) => {
  if (p.charge.student) return `${p.charge.student.lastName} ${p.charge.student.firstName}`
  if (p.parent.students.length > 0) return p.parent.students.map(s => `${s.student.lastName} ${s.student.firstName}`).join(', ')
  return '—'
}

const fmt     = (n: number) => `Bs. ${n.toFixed(2)}`
const fmtDate = (d: string) => new Date(d).toLocaleDateString('es-BO', { day: '2-digit', month: 'short', year: 'numeric' })

// Historial plano de pagos individuales — a diferencia de "Cobros" (que lista
// CARGOS), acá cada fila es un PAGO puntual, del más reciente al más antiguo.
// Comparte moduleKey 'tesoreria' con Cobros/Deudas/Kardex (useModuleFilters).
export default function HistorialPage() {
  const router = useRouter()
  const toast  = useToast()
  const { filters, update } = useModuleFilters('tesoreria', { academicYearId: '', courseId: '', search: '' })
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading, setLoading]   = useState(true)
  const [page, setPage] = useState(1)
  const userRole = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('user') || '{}').role : ''
  const canVoid  = userRole === 'SUPER_ADMIN' || userRole === 'JUNTA_ESCOLAR'
  const [paymentToVoid, setPaymentToVoid] = useState<Payment | null>(null)
  const [voidReason,    setVoidReason]    = useState('')
  const [voiding,       setVoiding]       = useState(false)

  const fetchPayments = () => {
    setLoading(true)
    const token = localStorage.getItem('token')
    fetch(`${API_URL}/api/treasury/payments`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : [])
      .then(setPayments)
      .catch(() => toast('Error de conexión', 'error'))
      .finally(() => setLoading(false))
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(fetchPayments, [])

  const handleConfirmVoidPayment = async () => {
    if (!paymentToVoid || !voidReason.trim()) return
    const token = localStorage.getItem('token')
    setVoiding(true)
    try {
      const res  = await fetch(`${API_URL}/api/treasury/payments/${paymentToVoid.id}/void`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ reason: voidReason.trim() }),
      })
      const data = await res.json()
      if (!res.ok) { toast(data.message, 'error'); return }
      toast(data.message, 'success')
      setPaymentToVoid(null)
      setVoidReason('')
      fetchPayments()
    } catch { toast('Error de conexión', 'error') }
    finally  { setVoiding(false) }
  }

  const search = filters.search.trim().toLowerCase()
  const filtered = useMemo(() => !search ? payments : payments.filter(p =>
    `${p.parent.firstName} ${p.parent.lastName} ${p.parent.ci || ''} ${p.charge.title} ${p.reference || ''} ${studentNames(p)}`
      .toLowerCase().includes(search),
  ), [payments, search])

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const pageRows  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const columns: Column<Payment>[] = [
    { key: 'fecha', header: 'Fecha', render: p => <span className="text-[12.5px] text-neutral-500">{fmtDate(p.date)}</span> },
    { key: 'tutor', header: 'Tutor', render: p => (
      <div>
        <div className="font-medium text-brand-700">{p.parent.lastName} {p.parent.firstName}</div>
        {p.parent.ci && <div className="text-[11px] text-neutral-500">CI {p.parent.ci}</div>}
      </div>
    ) },
    { key: 'estudiante', header: 'Estudiante(s)', render: p => <span className="text-[12.5px] text-neutral-600">{studentNames(p)}</span> },
    { key: 'cargo', header: 'Cargo', render: p => <span className="text-[12.5px]">{p.charge.title}</span> },
    { key: 'gestion', header: 'Gestión', render: p => <span className="text-[12px] text-neutral-500">{p.charge.academicYear.year}</span> },
    { key: 'monto', header: 'Monto', render: p => <span className="font-semibold text-success-700">{fmt(p.amount)}</span> },
    { key: 'metodo', header: 'Método', render: p => <Badge tone="brand">{METHOD_LABELS[p.method] || p.method}</Badge> },
    { key: 'comprobante', header: 'Comprobante', render: p => (
      <div className="flex flex-col gap-0.5">
        {p.reference
          ? <span className="text-[12px] font-mono text-neutral-700">{p.reference}</span>
          : <span className="text-[11px] text-neutral-400 italic">—</span>
        }
        {p.charge.refunds.length > 0 && (
          <span
            className="text-[10.5px] text-warning-500"
            title={p.charge.refunds.map(r => `${fmt(r.amount)} — ${r.reason}`).join('; ')}
          >
            🔙 Devuelto
          </span>
        )}
      </div>
    ) },
    { key: 'accion', header: 'Acción', render: p => (
      <div className="flex items-center gap-2">
        <Button size="sm" variant="secondary" onClick={() => router.push(`/dashboard/padres/tesoreria/${p.parent.id}`)}>Ver cuenta</Button>
        {canVoid && (
          <button
            onClick={() => { setPaymentToVoid(p); setVoidReason('') }}
            className="text-[11px] text-danger-600 hover:text-danger-700 flex items-center gap-1"
            title="Anular pago -- error de carga"
          >
            <Trash2 size={12}/> Anular
          </button>
        )}
      </div>
    ) },
  ]

  return (
    <div>
      <PageHeader title="Historial de pagos" description="Todos los pagos registrados, del más reciente al más antiguo" />

      <Toolbar
        className="mb-4"
        search={{ value: filters.search, onChange: v => { update({ search: v }); setPage(1) }, placeholder: 'Buscar por N° de recibo, tutor, estudiante o cargo...' }}
        actions={[{ key: 'refresh', label: 'Actualizar', icon: RefreshCw, onClick: fetchPayments }]}
      />

      <Card padded={false} className="overflow-hidden">
        {loading ? (
          <LoadingState />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Clock}
            message={search ? `No se encontró ningún pago que coincida con "${filters.search.trim()}"` : 'Todavía no hay pagos registrados'}
          />
        ) : (
          <div className="p-4">
            <Table columns={columns} rows={pageRows} rowKey={p => p.id} />
            <Pagination page={page} pageCount={pageCount} onPageChange={setPage} />
          </div>
        )}
      </Card>

      {/* Modal anular pago -- error de carga puro, NO una devolución real de
          dinero (eso es "Registrar devolución" en Verificación por Curso,
          que queda intacto). El pago se borra físicamente (AuditLog, sin
          pantalla propia) -- mismo criterio que la Cuenta del tutor. */}
      <Modal
        open={!!paymentToVoid} onClose={() => { setPaymentToVoid(null); setVoidReason('') }}
        title="Anular pago"
        footer={
          <>
            <Button variant="secondary" onClick={() => { setPaymentToVoid(null); setVoidReason('') }}>Volver</Button>
            <Button variant="danger" onClick={handleConfirmVoidPayment} loading={voiding} disabled={!voidReason.trim()}>
              {!voiding && <Trash2 size={14}/>}
              {voiding ? 'Anulando...' : 'Confirmar anulación'}
            </Button>
          </>
        }
      >
        {paymentToVoid && (
          <div className="flex flex-col gap-4">
            <div className="bg-neutral-100 border border-neutral-300 rounded-lg p-3 text-[13px] text-neutral-500 leading-relaxed">
              <strong className="text-brand-700">{paymentToVoid.parent.lastName} {paymentToVoid.parent.firstName}</strong> —{' '}
              <strong className="text-brand-700">{fmt(paymentToVoid.amount)}</strong> · {paymentToVoid.charge.title}
              {paymentToVoid.reference && <> · Ref: {paymentToVoid.reference}</>}<br/>
              Usá esto solo para un <strong>error de carga</strong> (monto mal tipeado, pago cargado al tutor equivocado) —
              el pago se borra por completo y el cargo recalcula su saldo. Si el tutor sí pagó de más y hay que devolverle
              dinero real, usá &quot;Registrar devolución&quot; en su lugar. Esta acción no se puede deshacer desde acá.
            </div>
            <Textarea
              label="Motivo de la anulación" required
              placeholder="Ej: monto mal tipeado (se cargó Bs. 500 en vez de Bs. 50), pago cargado al tutor equivocado..."
              value={voidReason} onChange={e => setVoidReason(e.target.value)}
            />
          </div>
        )}
      </Modal>
    </div>
  )
}
