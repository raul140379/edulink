'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { DollarSign, Users, AlertCircle, CheckCircle, Search, Plus, TrendingUp, Filter } from 'lucide-react'
import Button from '@/components/ui/Button'
import { Select } from '@/components/ui/Input'
import Card from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import Table, { Column } from '@/components/ui/Table'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

interface ParentBalance {
  id:        number
  firstName: string
  lastName:  string
  ci?:       string
  phone?:    string
  students:  { student: { id: number; firstName: string; lastName: string } }[]
  summary: {
    totalDebt:    number
    totalPaid:    number
    totalPending: number
    hasDebt:      boolean
    chargesCount: number
  }
}

interface Summary {
  totalCharged:   number
  totalCollected: number
  totalPending:   number
  byStatus: {
    PENDIENTE: number
    PARCIAL:   number
    PAGADO:    number
  }
}

export default function TesoreriaPage() {
  const router = useRouter()
  const [parents,  setParents]  = useState<ParentBalance[]>([])
  const [summary,  setSummary]  = useState<Summary | null>(null)
  const [loading,  setLoading]  = useState(true)
  const [search,   setSearch]   = useState('')
  const [filter,   setFilter]   = useState('')
  const [error,    setError]    = useState('')
  const userRole = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('user') || '{}').role : ''
  const canEdit  = userRole === 'SUPER_ADMIN' || userRole === 'JUNTA_ESCOLAR'
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : ''

  const fetchData = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      if (filter) params.set('status', filter)

      const [pRes, sRes] = await Promise.all([
        fetch(`${API_URL}/api/treasury/parents?${params}`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_URL}/api/treasury/summary`,           { headers: { Authorization: `Bearer ${token}` } }),
      ])
      const [pData, sData] = await Promise.all([pRes.json(), sRes.json()])
      if (pRes.ok) setParents(pData)
      if (sRes.ok) setSummary(sData)
    } catch { setError('Error de conexión') }
    finally  { setLoading(false) }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchData() }, [])

  const fmt = (n: number) => `Bs. ${n.toFixed(2)}`

  const deudores  = parents.filter(p => p.summary.hasDebt).length
  const alDia     = parents.filter(p => !p.summary.hasDebt && p.summary.chargesCount > 0).length
  const sinCargos = parents.filter(p => p.summary.chargesCount === 0).length

  const summaryCards = summary ? [
    { label: 'Total cobrado',      value: fmt(summary.totalCharged),   icon: DollarSign,  bg: 'bg-brand-100',   fg: 'text-brand-700' },
    { label: 'Total recaudado',    value: fmt(summary.totalCollected), icon: CheckCircle, bg: 'bg-success-100', fg: 'text-success-700' },
    { label: 'Total pendiente',    value: fmt(summary.totalPending),   icon: AlertCircle, bg: 'bg-danger-100',  fg: 'text-danger-600' },
    { label: 'Tutores con deuda',  value: `${deudores} de ${parents.length}`, icon: Users, bg: 'bg-neutral-100', fg: 'text-neutral-700' },
  ] : []

  const columns: Column<ParentBalance>[] = [
    { key: 'idx', header: '#', render: (p) => <span className="text-neutral-500">{parents.indexOf(p) + 1}</span> },
    {
      key: 'name', header: 'Tutor legal', render: (p) => (
        <div>
          <div className="font-medium text-brand-700">{p.lastName} {p.firstName}</div>
          {p.ci && <div className="text-[11px] text-neutral-500 mt-0.5">CI: {p.ci}</div>}
          {p.phone && <div className="text-[11px] text-neutral-500">{p.phone}</div>}
        </div>
      ),
    },
    {
      key: 'students', header: 'Estudiantes', render: (p) => p.students.length === 0
        ? <span className="text-[11px] text-neutral-500 italic">Sin estudiantes</span>
        : (
          <div className="flex flex-col gap-1">
            {p.students.map(ps => <Badge key={ps.student.id} tone="info">{ps.student.lastName} {ps.student.firstName}</Badge>)}
          </div>
        ),
    },
    { key: 'debt', header: 'Total cargado', render: (p) => <span className="font-semibold text-sm whitespace-nowrap">{fmt(p.summary.totalDebt)}</span> },
    { key: 'paid', header: 'Pagado', render: (p) => <span className="font-semibold text-sm whitespace-nowrap text-success-700">{fmt(p.summary.totalPaid)}</span> },
    { key: 'pending', header: 'Pendiente', render: (p) => <span className={`font-semibold text-sm whitespace-nowrap ${p.summary.totalPending > 0 ? 'text-danger-600' : 'text-success-700'}`}>{fmt(p.summary.totalPending)}</span> },
    {
      key: 'status', header: 'Estado', render: (p) => p.summary.chargesCount === 0
        ? <Badge tone="neutral">Sin cargos</Badge>
        : p.summary.hasDebt ? <Badge tone="danger">Con deuda</Badge> : <Badge tone="success">Al día</Badge>,
    },
    {
      key: 'action', header: 'Acción', render: (p) => (
        <Button size="sm" onClick={() => router.push(`/dashboard/admin/tesoreria/${p.id}`)}>Ver cuenta</Button>
      ),
    },
  ]

  return (
    <div>
      <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-brand-700 mb-1">Tesorería</h1>
          <p className="text-[13px] text-neutral-500">Gestión económica de padres y tutores legales</p>
        </div>
        {canEdit && (
          <Button onClick={() => router.push('/dashboard/admin/tesoreria/nuevo-cargo')}><Plus size={16} /> Nuevo cargo</Button>
        )}
      </div>

      {error && <p className="text-[13px] text-danger-600 bg-danger-100 rounded-lg px-3 py-2 mb-4">{error}</p>}

      {summary && (
        <div className="grid gap-3 mb-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
          {summaryCards.map((s) => {
            const Icon = s.icon
            return (
              <Card key={s.label} className="flex items-center gap-3">
                <div className={`p-2.5 rounded-[10px] ${s.bg} ${s.fg}`}><Icon size={20} /></div>
                <div>
                  <div className="text-[11px] text-neutral-500 uppercase tracking-wide mb-1">{s.label}</div>
                  <div className="text-lg font-bold text-brand-700">{s.value}</div>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {summary && (
        <div className="flex gap-2 flex-wrap mb-4">
          <Badge tone="danger"><AlertCircle size={13} /> {summary.byStatus.PENDIENTE} pendientes</Badge>
          <Badge tone="warning"><TrendingUp size={13} /> {summary.byStatus.PARCIAL} parciales</Badge>
          <Badge tone="success"><CheckCircle size={13} /> {summary.byStatus.PAGADO} pagados</Badge>
          <Badge tone="neutral"><Users size={13} /> {sinCargos} sin cargos</Badge>
        </div>
      )}

      <div className="flex gap-2.5 mb-4 flex-wrap items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-info-500 pointer-events-none" />
          <input
            placeholder="Buscar tutor por nombre o CI..." value={search}
            onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && fetchData()}
            className="w-full h-10 pl-9 pr-3 rounded-lg border border-neutral-300 text-sm outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/15"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter size={14} className="text-neutral-500" />
          <Select value={filter} onChange={e => setFilter(e.target.value)} className="w-auto min-w-[150px]">
            <option value="">Todos los tutores</option>
            <option value="CON_DEUDA">Con deuda</option>
            <option value="AL_DIA">Al día</option>
          </Select>
        </div>
        <Button variant="secondary" onClick={fetchData}>Buscar</Button>
      </div>

      <Table columns={columns} rows={parents} rowKey={(p) => p.id} loading={loading} emptyLabel="No se encontraron tutores" />

      <div className="px-3.5 py-2.5 text-xs text-neutral-500">
        Total: <strong>{parents.length}</strong> tutores · <strong>{deudores}</strong> con deuda · <strong>{alDia}</strong> al día
      </div>
    </div>
  )
}
