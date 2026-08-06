'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Clock, RefreshCw } from 'lucide-react'
import Card from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
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
  parent: { id: number; firstName: string; lastName: string; ci?: string }
  charge: { id: number; title: string; type: string }
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

  const search = filters.search.trim().toLowerCase()
  const filtered = useMemo(() => !search ? payments : payments.filter(p =>
    `${p.parent.firstName} ${p.parent.lastName} ${p.parent.ci || ''} ${p.charge.title}`.toLowerCase().includes(search),
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
    { key: 'cargo', header: 'Cargo', render: p => <span className="text-[12.5px]">{p.charge.title}</span> },
    { key: 'monto', header: 'Monto', render: p => <span className="font-semibold text-success-700">{fmt(p.amount)}</span> },
    { key: 'metodo', header: 'Método', render: p => <Badge tone="brand">{METHOD_LABELS[p.method] || p.method}</Badge> },
    { key: 'comprobante', header: 'Comprobante', render: p => p.reference
      ? <span className="text-[12px] font-mono text-neutral-700">{p.reference}</span>
      : <span className="text-[11px] text-neutral-400 italic">—</span>
    },
    { key: 'accion', header: 'Acción', render: p => (
      <Button size="sm" variant="secondary" onClick={() => router.push(`/dashboard/padres/tesoreria/${p.parent.id}`)}>Ver cuenta</Button>
    ) },
  ]

  return (
    <div>
      <PageHeader title="Historial de pagos" description="Todos los pagos registrados, del más reciente al más antiguo" />

      <Toolbar
        className="mb-4"
        search={{ value: filters.search, onChange: v => { update({ search: v }); setPage(1) }, placeholder: 'Buscar tutor o cargo...' }}
        actions={[{ key: 'refresh', label: 'Actualizar', icon: RefreshCw, onClick: fetchPayments }]}
      />

      <Card padded={false} className="overflow-hidden">
        {loading ? (
          <LoadingState />
        ) : filtered.length === 0 ? (
          <EmptyState icon={Clock} message="Todavía no hay pagos registrados" />
        ) : (
          <div className="p-4">
            <Table columns={columns} rows={pageRows} rowKey={p => p.id} />
            <Pagination page={page} pageCount={pageCount} onPageChange={setPage} />
          </div>
        )}
      </Card>
    </div>
  )
}
