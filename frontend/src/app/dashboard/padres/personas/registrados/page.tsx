'use client'

import { useEffect, useState } from 'react'
import { UserCheck } from 'lucide-react'
import Card from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import Table, { Column } from '@/components/ui/Table'
import Toolbar from '@/components/ui/Toolbar'
import Pagination from '@/components/ui/Pagination'
import { useToast } from '@/components/ui/ToastProvider'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'
const PAGE_SIZE = 30

const RELATION_LABELS: Record<string, string> = { PADRE: 'Padre', MADRE: 'Madre', TUTOR_LEGAL: 'Tutor legal', OTRO: 'Otro' }

interface ParentStatus {
  id: number; firstName: string; lastName: string; ci?: string; phone?: string
  user: { id: number; email: string; isActive: boolean } | null
  students: { relationType: string; isTutor: boolean; student: { id: number; firstName: string; lastName: string } }[]
  active: boolean
}

// Activo = tiene al menos un hijo matriculado (StudentAcademicAssignment) en
// la gestión activa; Inactivo = sin hijos vinculados o ninguno matriculado
// este año (egresados/retirados/pendientes) — ver plan piped-weaving-wadler.
export default function PadresRegistradosPage() {
  const toast = useToast()
  const [parents, setParents] = useState<ParentStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter]   = useState<'todos' | 'activo' | 'inactivo'>('todos')
  const [search, setSearch]   = useState('')
  const [page,   setPage]     = useState(1)
  const [total,  setTotal]    = useState(0)
  const [summary, setSummary] = useState({ total: 0, activos: 0, inactivos: 0 })

  // search/filter viajan como parámetros explícitos (no se leen del closure)
  // para evitar el mismo bug de stale-closure ya encontrado en admin/padres:
  // llamar fetchParents justo después de un setState no ve el valor nuevo
  // todavía dentro de la misma función.
  const fetchParents = async (targetPage = page, targetSearch = search, targetFilter = filter) => {
    setLoading(true)
    const token = localStorage.getItem('token')
    const params = new URLSearchParams({ page: String(targetPage), pageSize: String(PAGE_SIZE) })
    if (targetSearch.trim()) params.set('search', targetSearch.trim())
    if (targetFilter !== 'todos') params.set('active', targetFilter === 'activo' ? 'true' : 'false')

    try {
      const r = await fetch(`${API_URL}/api/parents/registered-status?${params}`, { headers: { Authorization: `Bearer ${token}` } })
      const data = await r.json()
      if (!r.ok) { toast(data.message, 'error'); return }
      setParents(data.data)
      setTotal(data.total)
      setPage(targetPage)
      if (data.summary) setSummary(data.summary)
    } catch { toast('Error de conexión', 'error') }
    finally { setLoading(false) }
  }

  useEffect(() => {
    fetchParents(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSearch = () => fetchParents(1)
  const handleFilterChange = (f: typeof filter) => { setFilter(f); fetchParents(1, search, f) }

  const columns: Column<ParentStatus>[] = [
    { key: 'padre', header: 'Padre/Madre/Tutor', render: p => (
      <div>
        <div className="font-medium text-brand-700">{p.lastName} {p.firstName}</div>
        {p.ci && <div className="text-[11px] text-neutral-500">CI {p.ci}</div>}
      </div>
    ) },
    { key: 'hijos', header: 'Hijos vinculados', render: p => p.students.length === 0
      ? <span className="text-[11px] text-neutral-400 italic">Sin hijos vinculados</span>
      : (
        <div className="flex flex-col gap-0.5">
          {p.students.map((s, i) => (
            <span key={i} className="text-[12px] text-neutral-600">
              {s.student.lastName} {s.student.firstName}
              <span className="text-neutral-400"> · {RELATION_LABELS[s.relationType] || s.relationType}{s.isTutor ? ' (tutor)' : ''}</span>
            </span>
          ))}
        </div>
      )
    },
    { key: 'contacto', header: 'Teléfono', render: p => <span className="text-[12.5px] text-neutral-500">{p.phone || '—'}</span> },
    { key: 'estado', header: 'Estado', render: p => <Badge tone={p.active ? 'success' : 'danger'}>{p.active ? 'Activo' : 'Inactivo'}</Badge> },
  ]

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-brand-700 mb-1">Padres registrados</h1>
        <p className="text-[13px] text-neutral-500">Activo: tiene al menos un hijo matriculado en la gestión activa</p>
      </div>

      <div className="grid gap-3 mb-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
        <Card><div className="text-[11px] text-neutral-500 uppercase tracking-wide mb-1.5">Total padres</div><div className="text-lg font-bold text-brand-700">{summary.total}</div></Card>
        <Card className="!border-success-500/40"><div className="text-[11px] text-neutral-500 uppercase tracking-wide mb-1.5">Activos</div><div className="text-lg font-bold text-success-700">{summary.activos}</div></Card>
        <Card className="!border-danger-500/40"><div className="text-[11px] text-neutral-500 uppercase tracking-wide mb-1.5">Inactivos</div><div className="text-lg font-bold text-danger-600">{summary.inactivos}</div></Card>
      </div>

      <Toolbar
        className="mb-4"
        search={{ value: search, onChange: setSearch, placeholder: 'Buscar por nombre o CI...', onSubmit: handleSearch }}
        actions={[{ key: 'buscar', label: 'Buscar', onClick: handleSearch, variant: 'secondary' }]}
      />

      <div className="flex gap-2 mb-4">
        {(['todos', 'activo', 'inactivo'] as const).map(f => (
          <button key={f} onClick={() => handleFilterChange(f)}
            className={`px-3.5 py-2 rounded-lg text-[12.5px] font-medium transition-colors ${filter === f ? 'bg-brand-600 text-white' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'}`}>
            {f === 'todos' ? 'Todos' : f === 'activo' ? 'Activos' : 'Inactivos'}
          </button>
        ))}
      </div>

      <Card padded={false} className="overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16"><p className="text-sm text-neutral-500">Cargando...</p></div>
        ) : parents.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-neutral-500">
            <UserCheck size={40} className="text-neutral-300"/>
            <p className="text-[13px]">No hay padres para este filtro</p>
          </div>
        ) : (
          <div className="p-4">
            <Table columns={columns} rows={parents} rowKey={p => p.id} />
            <Pagination page={page} pageCount={Math.ceil(total / PAGE_SIZE)} onPageChange={fetchParents} className="mt-3" />
          </div>
        )}
      </Card>
    </div>
  )
}
