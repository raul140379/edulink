'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { DollarSign, Users, AlertCircle, CheckCircle, Plus, TrendingUp, FileText, Upload, RefreshCw } from 'lucide-react'
import Card, { CardHeader, CardTitle } from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Table, { Column } from '@/components/ui/Table'
import { Input, Textarea } from '@/components/ui/Input'
import PageHeader from '@/components/ui/PageHeader'
import Toolbar from '@/components/ui/Toolbar'
import StatCard from '@/components/ui/StatCard'
import EmptyState from '@/components/ui/EmptyState'
import LoadingState from '@/components/ui/LoadingState'
import { useToast } from '@/components/ui/ToastProvider'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

interface ParentBalance {
  id:        number
  firstName: string
  lastName:  string
  ci?:       string
  phone?:    string
  kardex?:   string | null
  students:  { student: { id: number; firstName: string; lastName: string } }[]
  summary: {
    totalDebt:    number
    totalPaid:    number
    totalPending: number
    hasDebt:      boolean
    chargesCount: number
  }
}

interface SummaryBreakdown {
  totalCharged:   number
  totalCollected: number
  totalPending:   number
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
  gestionActual:   SummaryBreakdown
  deudaTrasladada: SummaryBreakdown
}

const GRADE_LABELS: Record<string, string> = {
  PRIMERO: '1°', SEGUNDO: '2°', TERCERO: '3°', CUARTO: '4°', QUINTO: '5°', SEXTO: '6°',
}
const SHIFT_LABELS: Record<string, string> = { MORNING: 'Mañana', AFTERNOON: 'Tarde', NIGHT: 'Noche' }

interface CourseGroup {
  course: { id: number; level: string; grade: string; parallel: string; shift: string }
  tutores: {
    id: number; firstName: string; lastName: string; ci: string | null; phone: string | null
    kardex: string | null
    studentName: string
    summary: { totalDebt: number; totalPaid: number; totalPending: number; hasDebt: boolean; hasSharedCharge: boolean; chargesCount: number }
  }[]
}

export default function TesoreriaPage() {
  const router = useRouter()
  const toast  = useToast()
  const [parents,  setParents]  = useState<ParentBalance[]>([])
  const [summary,  setSummary]  = useState<Summary | null>(null)
  const [loading,  setLoading]  = useState(true)
  const [search,   setSearch]   = useState('')
  const [filter,   setFilter]   = useState('')
  const userRole = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('user') || '{}').role : ''
  const canEdit  = userRole === 'SUPER_ADMIN' || userRole === 'JUNTA_ESCOLAR'

  // Vista alternativa agrupada por curso — mismo dato de fondo (padres
  // tutores + sus cargos), reorganizado por curso en vez de listado plano.
  const [viewMode, setViewMode] = useState<'tutor' | 'curso'>('curso')
  const [byCourse, setByCourse] = useState<CourseGroup[]>([])
  const [loadingByCourse, setLoadingByCourse] = useState(false)
  const [searchCurso, setSearchCurso] = useState('')
  const [filterCurso, setFilterCurso] = useState('')

  // Filtro 100% client-side — /api/treasury/by-course ya trae todo el dataset
  // de una sola vez, mismo criterio que ya aplica el backend para "Por tutor".
  const byCourseFiltered = byCourse.map(group => ({
    ...group,
    tutores: group.tutores.filter(t => {
      const q = searchCurso.trim().toLowerCase()
      const matchSearch = !q
        || `${t.firstName} ${t.lastName}`.toLowerCase().includes(q)
        || (t.ci || '').toLowerCase().includes(q)
      const matchFilter = !filterCurso
        || (filterCurso === 'CON_DEUDA' && t.summary.hasDebt)
        || (filterCurso === 'AL_DIA' && !t.summary.hasDebt)
      return matchSearch && matchFilter
    }),
  }))

  const fetchByCourse = async () => {
    const token = localStorage.getItem('token')
    setLoadingByCourse(true)
    try {
      const res  = await fetch(`${API_URL}/api/treasury/by-course`, { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      if (res.ok) setByCourse(data)
    } catch { toast('Error de conexión', 'error') }
    finally  { setLoadingByCourse(false) }
  }

  useEffect(() => {
    if (viewMode === 'curso' && byCourse.length === 0) fetchByCourse()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode])

  const fetchData = async () => {
    const token = localStorage.getItem('token')
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
    } catch { toast('Error de conexión', 'error') }
    finally  { setLoading(false) }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchData() }, [])

  const fmt = (n: number) => `Bs. ${n.toFixed(2)}`

  const deudores  = parents.filter(p => p.summary.hasDebt).length
  const alDia     = parents.filter(p => !p.summary.hasDebt && p.summary.chargesCount > 0).length
  const sinCargos = parents.filter(p => p.summary.chargesCount === 0).length

  const columns: Column<ParentBalance>[] = [
    { key: 'num', header: '#', render: (p) => <span className="text-xs text-neutral-500">{parents.indexOf(p) + 1}</span> },
    {
      key: 'tutor', header: 'Tutor legal', render: p => (
        <div>
          <div className="font-medium text-brand-700">{p.lastName} {p.firstName}</div>
          {p.ci && <div className="text-[11px] text-neutral-500 mt-0.5">CI: {p.ci}</div>}
          {p.phone && <div className="text-[11px] text-neutral-500">{p.phone}</div>}
          {p.kardex
            ? <div className="text-[11px] text-neutral-500">Kardex: {p.kardex}</div>
            : <div className="text-[11px] text-neutral-400 italic">Sin kardex</div>}
        </div>
      )
    },
    {
      key: 'estudiantes', header: 'Estudiantes', render: p => (
        <div className="flex flex-col gap-1">
          {p.students.length === 0
            ? <span className="text-[11px] text-neutral-500 italic">Sin estudiantes</span>
            : p.students.map(ps => (
                <span key={ps.student.id} className="text-[11px] bg-brand-100 text-brand-700 px-2 py-0.5 rounded-full w-fit">
                  {ps.student.lastName} {ps.student.firstName}
                </span>
              ))
          }
        </div>
      )
    },
    { key: 'cargado', header: 'Total cargado', render: p => <span className="font-semibold text-[13px] text-brand-700 whitespace-nowrap">{fmt(p.summary.totalDebt)}</span> },
    { key: 'pagado', header: 'Pagado', render: p => <span className="font-semibold text-[13px] text-success-700 whitespace-nowrap">{fmt(p.summary.totalPaid)}</span> },
    { key: 'pendiente', header: 'Pendiente', render: p => <span className={`font-semibold text-[13px] whitespace-nowrap ${p.summary.totalPending > 0 ? 'text-danger-600' : 'text-success-700'}`}>{fmt(p.summary.totalPending)}</span> },
    {
      key: 'estado', header: 'Estado', render: p => p.summary.chargesCount === 0
        ? <Badge tone="neutral">Sin cargos</Badge>
        : p.summary.hasDebt ? <Badge tone="danger">Con deuda</Badge> : <Badge tone="success">Al día</Badge>
    },
    {
      key: 'accion', header: 'Acción', render: p => (
        <Button size="sm" onClick={() => router.push(`/dashboard/padres/tesoreria/${p.id}`)}>Ver cuenta</Button>
      )
    },
  ]

  return (
    <div>
      <PageHeader
        title="Tesorería" description="Gestión económica de padres y tutores legales"
        action={canEdit && (
          <Button onClick={() => router.push('/dashboard/padres/cargos/nuevo')}>
            <Plus size={16}/> Nuevo cargo
          </Button>
        )}
      />

      {summary && (
        <div className="grid gap-3 mb-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
          <StatCard label="Total cobrado" value={fmt(summary.totalCharged)} icon={DollarSign} tone="brand" />
          <StatCard label="Total recaudado" value={fmt(summary.totalCollected)} icon={CheckCircle} tone="success" />
          <StatCard label="Total pendiente" value={fmt(summary.totalPending)} icon={AlertCircle} tone="danger" />
          <StatCard label="Tutores con deuda" value={`${deudores} de ${parents.length}`} icon={Users} tone="neutral" />
        </div>
      )}

      {summary && (
        <div className="flex gap-2 flex-wrap mb-4">
          <Badge tone="danger"><AlertCircle size={13}/> {summary.byStatus.PENDIENTE} pendientes</Badge>
          <Badge tone="warning"><TrendingUp size={13}/> {summary.byStatus.PARCIAL} parciales</Badge>
          <Badge tone="success"><CheckCircle size={13}/> {summary.byStatus.PAGADO} pagados</Badge>
          <Badge tone="neutral"><Users size={13}/> {sinCargos} sin cargos</Badge>
        </div>
      )}

      {summary && (
        <Card className="mb-4">
          <div className="text-[13px] font-bold text-brand-700 mb-3">Desglose por origen de la deuda — gestión activa</div>
          <div className="overflow-x-auto">
            <table className="w-full text-[12.5px]">
              <thead>
                <tr className="text-left text-neutral-500">
                  <th className="pb-2 font-medium"></th>
                  <th className="pb-2 font-medium">Gestión actual</th>
                  <th className="pb-2 font-medium">Deuda trasladada</th>
                  <th className="pb-2 font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-neutral-100">
                  <td className="py-2 font-medium text-brand-700">Cargado</td>
                  <td className="py-2">{fmt(summary.gestionActual.totalCharged)}</td>
                  <td className="py-2">{fmt(summary.deudaTrasladada.totalCharged)}</td>
                  <td className="py-2 font-semibold">{fmt(summary.totalCharged)}</td>
                </tr>
                <tr className="border-t border-neutral-100">
                  <td className="py-2 font-medium text-brand-700">Recaudado</td>
                  <td className="py-2 text-success-700">{fmt(summary.gestionActual.totalCollected)}</td>
                  <td className="py-2 text-success-700">{fmt(summary.deudaTrasladada.totalCollected)}</td>
                  <td className="py-2 font-semibold text-success-700">{fmt(summary.totalCollected)}</td>
                </tr>
                <tr className="border-t border-neutral-100">
                  <td className="py-2 font-medium text-brand-700">Pendiente</td>
                  <td className="py-2 text-danger-600">{fmt(summary.gestionActual.totalPending)}</td>
                  <td className="py-2 text-danger-600">{fmt(summary.deudaTrasladada.totalPending)}</td>
                  <td className="py-2 font-semibold text-danger-600">{fmt(summary.totalPending)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Toolbar
        className="mb-4"
        views={{ items: [{ key: 'tutor', label: 'Por tutor' }, { key: 'curso', label: 'Por curso' }], active: viewMode, onChange: k => setViewMode(k as 'tutor' | 'curso') }}
        search={viewMode === 'tutor'
          ? { value: search, onChange: setSearch, onSubmit: fetchData, placeholder: 'Buscar tutor por nombre o CI...' }
          : { value: searchCurso, onChange: setSearchCurso, placeholder: 'Buscar tutor por nombre o CI...' }
        }
        filters={[{
          key: 'estado', label: 'Estado',
          value: viewMode === 'tutor' ? filter : filterCurso,
          onChange: v => viewMode === 'tutor' ? setFilter(v) : setFilterCurso(v),
          placeholder: 'Todos los tutores',
          options: [{ value: 'CON_DEUDA', label: 'Con deuda' }, { value: 'AL_DIA', label: 'Al día' }],
        }]}
        actions={[{ key: 'refresh', label: 'Actualizar', icon: RefreshCw, onClick: viewMode === 'tutor' ? fetchData : fetchByCourse }]}
      />

      {viewMode === 'tutor' ? (
        <>
          <Card padded={false} className="overflow-hidden">
            {loading ? (
              <LoadingState />
            ) : parents.length === 0 ? (
              <EmptyState icon={Users} message="No se encontraron tutores" />
            ) : (
              <div className="p-4">
                <Table columns={columns} rows={parents} rowKey={p => p.id} />
              </div>
            )}
          </Card>

          <div className="px-3.5 py-2.5 text-xs text-neutral-500">
            Total: <strong>{parents.length}</strong> tutores · <strong>{deudores}</strong> con deuda · <strong>{alDia}</strong> al día
          </div>
        </>
      ) : (
        <div className="flex flex-col gap-4">
          {loadingByCourse ? (
            <Card><LoadingState /></Card>
          ) : byCourse.length === 0 ? (
            <Card className="text-center py-12 text-neutral-500">No hay gestión académica activa o no hay cursos con tutores.</Card>
          ) : byCourseFiltered.every(g => g.tutores.length === 0) ? (
            <Card className="text-center py-12 text-neutral-500">Ningún tutor coincide con la búsqueda/filtro.</Card>
          ) : byCourseFiltered
              .filter(g => g.tutores.length > 0 || (!searchCurso && !filterCurso))
              .map(({ course, tutores }) => (
            <Card key={course.id} padded={false} className="overflow-hidden">
              <div className="flex items-center justify-between px-4.5 py-3 border-b border-neutral-100">
                <span className="text-[13.5px] font-bold text-brand-700">
                  {GRADE_LABELS[course.grade] || course.grade} &quot;{course.parallel}&quot; · {SHIFT_LABELS[course.shift] || course.shift}
                </span>
                <span className="text-[11px] text-neutral-500">{tutores.length} tutor(es)</span>
              </div>
              {tutores.length === 0 ? (
                <p className="text-[13px] text-neutral-500 italic px-4.5 py-4">Sin tutores registrados en este curso</p>
              ) : (
                <div className="p-4">
                  <Table
                    columns={[
                      { key: 'tutor', header: 'Tutor', render: (t: CourseGroup['tutores'][number]) => (
                        <div>
                          <div className="font-medium text-brand-700">{t.lastName} {t.firstName}</div>
                          <div className="text-[11px] text-neutral-500">{t.studentName}</div>
                          {t.kardex
                            ? <div className="text-[11px] text-neutral-500">Kardex: {t.kardex}</div>
                            : <div className="text-[11px] text-neutral-400 italic">Sin kardex</div>}
                        </div>
                      ) },
                      { key: 'cargado', header: 'Cargado', render: (t: CourseGroup['tutores'][number]) => <span className="font-semibold text-[13px] text-brand-700">{fmt(t.summary.totalDebt)}</span> },
                      { key: 'pagado', header: 'Pagado', render: (t: CourseGroup['tutores'][number]) => <span className="font-semibold text-[13px] text-success-700">{fmt(t.summary.totalPaid)}</span> },
                      { key: 'pendiente', header: 'Pendiente', render: (t: CourseGroup['tutores'][number]) => (
                        <span className={`font-semibold text-[13px] ${t.summary.totalPending > 0 ? 'text-danger-600' : 'text-success-700'}`}>
                          {fmt(t.summary.totalPending)}
                          {t.summary.hasSharedCharge && <Badge tone="neutral" className="ml-1.5">Compartido entre cursos</Badge>}
                        </span>
                      ) },
                      {
                        key: 'estado', header: 'Estado', render: (t: CourseGroup['tutores'][number]) => t.summary.chargesCount === 0
                          ? <Badge tone="neutral">Sin cargos</Badge>
                          : t.summary.hasDebt ? <Badge tone="danger">Con deuda</Badge> : <Badge tone="success">Al día</Badge>
                      },
                      {
                        key: 'accion', header: 'Acción', render: (t: CourseGroup['tutores'][number]) => (
                          <Button size="sm" onClick={() => router.push(`/dashboard/padres/tesoreria/${t.id}`)}>Ver cuenta</Button>
                        )
                      },
                    ]}
                    rows={tutores}
                    rowKey={t => t.id}
                  />
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {userRole === 'JUNTA_ESCOLAR' && <PoaActaSection/>}
    </div>
  )
}

interface PoaActa {
  id: number
  academicYear: number
  actaFileUrl: string
  assemblyDate: string
  montoGlobal: number
  montoIndividual: number | null
  items: string
}

// Acta de aprobación del POA — sustento legal exigido por el Director Distrital
// para que la Junta Escolar pueda cobrar a los padres. Puramente informativo:
// se guarda como respaldo, no bloquea la creación de cobros de arriba.
function PoaActaSection() {
  const toast = useToast()
  const currentYear = new Date().getFullYear()
  const [acta, setActa] = useState<PoaActa | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [form, setForm] = useState({
    assemblyDate: '', montoGlobal: '', montoIndividual: '', items: '',
  })

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : ''

  const fetchActa = async () => {
    setLoading(true)
    try {
      const res  = await fetch(`${API_URL}/api/poa-acta`, { headers: { Authorization: `Bearer ${token}` } })
      const data: PoaActa[] = await res.json()
      const mine = Array.isArray(data) ? data.find(a => a.academicYear === currentYear) : null
      setActa(mine || null)
      if (mine) {
        setForm({
          assemblyDate: mine.assemblyDate.slice(0, 10),
          montoGlobal: String(mine.montoGlobal),
          montoIndividual: mine.montoIndividual != null ? String(mine.montoIndividual) : '',
          items: mine.items,
        })
      }
    } catch { /* silencioso — sección informativa */ }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchActa() }, [])

  const handleSubmit = async () => {
    if (!form.assemblyDate || !form.montoGlobal || !form.items) {
      setError('Completa fecha de asamblea, monto global e ítems del POA'); return
    }
    if (!acta && !file) { setError('Adjunta el archivo escaneado del acta'); return }
    setError(''); setSaving(true)
    try {
      const body = new FormData()
      body.append('academicYear', String(currentYear))
      body.append('assemblyDate', form.assemblyDate)
      body.append('montoGlobal', form.montoGlobal)
      if (form.montoIndividual) body.append('montoIndividual', form.montoIndividual)
      body.append('items', form.items)
      if (file) body.append('file', file)

      const res  = await fetch(`${API_URL}/api/poa-acta`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}` }, body,
      })
      const data = await res.json()
      if (!res.ok) { setError(data.message || 'Error al guardar'); return }
      toast('Acta de POA guardada correctamente', 'success')
      setEditing(false); setFile(null)
      fetchActa()
    } catch { setError('Error de conexión') }
    finally  { setSaving(false) }
  }

  if (loading) return null

  return (
    <Card className="mt-4">
      <CardHeader><CardTitle className="flex items-center gap-2"><FileText size={16}/> Acta de aprobación del POA — Gestión {currentYear}</CardTitle></CardHeader>

      {!editing && acta && (
        <div className="flex flex-col gap-2">
          <p className="text-[12px] text-neutral-500">Sustento legal de la recaudación, aprobado en asamblea. Solo informativo.</p>
          <div className="flex flex-wrap gap-2 text-[13px]">
            <Badge tone="brand">Asamblea: {new Date(acta.assemblyDate).toLocaleDateString('es-BO')}</Badge>
            <Badge tone="neutral">Monto global: Bs. {acta.montoGlobal.toFixed(2)}</Badge>
            {acta.montoIndividual != null && <Badge tone="neutral">Monto individual: Bs. {acta.montoIndividual.toFixed(2)}</Badge>}
          </div>
          <p className="text-[12.5px] text-neutral-700 whitespace-pre-wrap">{acta.items}</p>
          <div className="flex items-center gap-3 mt-1">
            <a href={acta.actaFileUrl} target="_blank" rel="noreferrer" className="text-[12.5px] font-semibold text-brand-600 hover:text-brand-700">Ver archivo del acta →</a>
            <button onClick={() => setEditing(true)} className="text-[12.5px] font-semibold text-info-500 hover:underline">Actualizar</button>
          </div>
        </div>
      )}

      {!editing && !acta && (
        <div className="flex flex-col items-start gap-2">
          <p className="text-[13px] text-neutral-500">Todavía no cargaste el acta de aprobación del POA de esta gestión.</p>
          <Button size="sm" onClick={() => setEditing(true)}><Plus size={14}/> Cargar acta de POA</Button>
        </div>
      )}

      {editing && (
        <div className="flex flex-col gap-3">
          {error && <p className="text-[13px] text-danger-600 bg-danger-100 rounded-lg px-3 py-2">{error}</p>}
          <div className="grid grid-cols-2 gap-3">
            <Input label="Fecha de la asamblea" required type="date" value={form.assemblyDate}
              onChange={e => setForm({ ...form, assemblyDate: e.target.value })} />
            <Input label="Monto global aprobado (Bs.)" required type="number" value={form.montoGlobal}
              onChange={e => setForm({ ...form, montoGlobal: e.target.value })} />
          </div>
          <Input label="Monto individual por familia (Bs.)" type="number" value={form.montoIndividual}
            onChange={e => setForm({ ...form, montoIndividual: e.target.value })} />
          <Textarea label="Ítems del POA" required rows={4} placeholder="Detalle de los ítems aprobados"
            value={form.items} onChange={e => setForm({ ...form, items: e.target.value })} />
          <div className="flex flex-col gap-1.5">
            <span className="text-[13px] font-semibold text-neutral-700">Archivo escaneado del acta{!acta && <span className="text-danger-500"> *</span>}</span>
            <label className="flex items-center gap-2 border border-dashed border-neutral-300 rounded-lg px-3 py-2.5 text-[12.5px] text-neutral-500 cursor-pointer hover:border-info-500 w-fit">
              <Upload size={14}/> {file ? file.name : 'Seleccionar archivo (PDF o imagen)'}
              <input type="file" accept="application/pdf,image/*" className="hidden" onChange={e => setFile(e.target.files?.[0] || null)} />
            </label>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleSubmit} loading={saving}>Guardar</Button>
            <Button variant="secondary" onClick={() => { setEditing(false); setFile(null); setError('') }}>Cancelar</Button>
          </div>
        </div>
      )}
    </Card>
  )
}
