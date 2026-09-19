'use client'

import { useEffect, useState } from 'react'
import { UserCheck, ArrowLeftRight, UserPlus, Power, Search, Pencil, Trash2, RefreshCw } from 'lucide-react'
import Card from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import { Input, Select } from '@/components/ui/Input'
import Table, { Column } from '@/components/ui/Table'
import Toolbar from '@/components/ui/Toolbar'
import Pagination from '@/components/ui/Pagination'
import { useConfirm } from '@/components/ui/ConfirmProvider'
import { useToast } from '@/components/ui/ToastProvider'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'
const PAGE_SIZE = 30

const RELATION_LABELS: Record<string, string> = { PADRE: 'Padre', MADRE: 'Madre', TUTOR_LEGAL: 'Tutor legal', OTRO: 'Otro' }

// TUTOR_LEGAL queda fuera del Select del modal "Vincular hijo" a propósito —
// mismo criterio que familias/nueva/page.tsx: "es tutor legal" es un
// checkbox aparte (isTutor), no un valor de relationType.
const LINK_RELATION_OPTIONS: Record<string, string> = { PADRE: 'Padre', MADRE: 'Madre', OTRO: 'Otro (tercero)' }

interface StudentHit { id: number; firstName: string; lastName: string }

interface ParentStatus {
  id: number; firstName: string; lastName: string; ci?: string; phone?: string
  user: { id: number; email: string; isActive: boolean } | null
  students: { relationType: string; isTutor: boolean; student: { id: number; firstName: string; lastName: string } }[]
  active: boolean
}

interface TutorCandidate {
  id: number; firstName: string; lastName: string; ci: string | null
  relationType: string; isTutor: boolean
}

// ---- Pestaña "Padres por curso" — movida tal cual desde familias/page.tsx
// (antes vivía ahí junto a "Tutores por curso"/"Todos los tutores"; ahora es
// exclusiva de esta pantalla, Delegado no tiene acceso). Mismos tipos,
// mismo fetch a /api/parents/by-course, mismo modal Editar y botón Eliminar.
const GRADE_LABELS: Record<string, string> = {
  PRIMERO: '1°', SEGUNDO: '2°', TERCERO: '3°', CUARTO: '4°', QUINTO: '5°', SEXTO: '6°',
}
const SHIFT_LABELS: Record<string, string> = { MORNING: 'Mañana', AFTERNOON: 'Tarde', NIGHT: 'Noche' }

interface CourseOption { id: number; level: string; grade: string; parallel: string; shift: string }

function courseLabel(c: CourseOption) {
  return `${GRADE_LABELS[c.grade] || c.grade} "${c.parallel}" · ${SHIFT_LABELS[c.shift] || c.shift}`
}

interface ParentInfo {
  id: number; firstName: string; lastName: string
  ci: string | null; phone: string | null; email: string | null; address: string | null
  kardex: string | null; attendanceCode: string | null
  relationType: string; isTutor: boolean
  user: { id: number; email: string; isActive: boolean } | null
}

// "Padres por curso" se agrupa por ESTUDIANTE (no por padre) — un estudiante
// con padre y madre queda en una sola fila con ambos, en vez de una fila por
// cada uno repitiendo el nombre del estudiante.
interface StudentGroup {
  studentId: number
  studentName: string
  parents: ParentInfo[]
}

interface CourseGroup {
  course: CourseOption
  padres: StudentGroup[]
  tutores: unknown[]
}

const emptyEditForm = { firstName: '', lastName: '', ci: '', phone: '', email: '', address: '', kardex: '' }

// Activo = tiene al menos un hijo matriculado (StudentAcademicAssignment) en
// la gestión activa; Inactivo = sin hijos vinculados o ninguno matriculado
// este año (egresados/retirados/pendientes) — ver plan piped-weaving-wadler.
export default function PadresRegistradosPage() {
  const toast = useToast()
  const confirm = useConfirm()
  const [viewMode, setViewMode] = useState<'registrados' | 'padres-curso'>('registrados')
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

  // "Gestionar tutor legal" — carga bajo demanda (solo al abrir el modal) los
  // padres/tutores vinculados a ESE estudiante puntual. La pantalla está
  // agrupada por padre, no por estudiante, así que no tiene de entrada quién
  // más está vinculado al mismo hijo (a diferencia de familias/page.tsx, que
  // sí lo trae de una porque ya está agrupada por curso/estudiante).
  const [changingTutorFor, setChangingTutorFor] = useState<{ studentId: number; label: string } | null>(null)
  const [candidates,       setCandidates]       = useState<TutorCandidate[]>([])
  const [loadingCandidates, setLoadingCandidates] = useState(false)
  const [changingTutorId,  setChangingTutorId]  = useState<number | null>(null)

  const openChangeTutor = async (studentId: number, label: string) => {
    setChangingTutorFor({ studentId, label })
    setCandidates([])
    setLoadingCandidates(true)
    try {
      const res  = await fetch(`${API_URL}/api/parents/by-student/${studentId}`, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } })
      const data = await res.json()
      if (!res.ok) { toast(data.message || 'Error al cargar los padres del estudiante', 'error'); setChangingTutorFor(null); return }
      setCandidates(data)
    } catch { toast('Error de conexión', 'error'); setChangingTutorFor(null) }
    finally { setLoadingCandidates(false) }
  }

  // Siempre usa change-tutor: ya limpia cualquier tutor previo (o es no-op si
  // no había ninguno), así que el mismo endpoint cubre "cambiar de uno a
  // otro" y "asignar donde no había" sin distinguir casos acá.
  const handleChangeTutor = async (newTutorId: number) => {
    if (!changingTutorFor) return
    setChangingTutorId(newTutorId)
    try {
      const res  = await fetch(`${API_URL}/api/parents/student/${changingTutorFor.studentId}/change-tutor`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
        body: JSON.stringify({ newTutorId }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { toast(data.message || 'No se pudo cambiar el tutor', 'error'); return }
      toast(data.message || 'Tutor legal actualizado', 'success')
      setChangingTutorFor(null)
      fetchParents(page, search, filter)
    } catch { toast('Error de conexión', 'error') }
    finally { setChangingTutorId(null) }
  }

  const currentTutor = candidates.find(c => c.isTutor) || null
  const otherCandidates = candidates.filter(c => !c.isTutor)

  // "Vincular hijo" / "Vincular otro hijo" — mismo patrón de búsqueda +
  // selección múltiple que familias/nueva/page.tsx, reusado acá para un padre
  // ya registrado (con o sin hijos previos).
  const [linkingFor, setLinkingFor] = useState<ParentStatus | null>(null)
  const [linkSearch, setLinkSearch] = useState('')
  const [linkResults, setLinkResults] = useState<StudentHit[]>([])
  const [linkSearching, setLinkSearching] = useState(false)
  const [linkSelected, setLinkSelected] = useState<StudentHit[]>([])
  const [linkRelationType, setLinkRelationType] = useState('PADRE')
  const [linkIsTutor, setLinkIsTutor] = useState(false)
  const [linkSaving, setLinkSaving] = useState(false)
  const [linkError, setLinkError] = useState('')

  const openLinkModal = (p: ParentStatus) => {
    setLinkingFor(p)
    setLinkSearch(''); setLinkResults([]); setLinkSelected([])
    setLinkRelationType('PADRE'); setLinkIsTutor(false); setLinkError('')
  }

  const handleLinkSearch = async () => {
    if (!linkSearch.trim()) return
    setLinkSearching(true)
    try {
      const res  = await fetch(`${API_URL}/api/students?search=${encodeURIComponent(linkSearch)}&isActive=true`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      })
      const data = await res.json()
      setLinkResults(res.ok ? data : [])
    } catch { setLinkResults([]) }
    finally { setLinkSearching(false) }
  }

  const toggleLinkStudent = (s: StudentHit) => {
    setLinkSelected(prev => prev.some(x => x.id === s.id) ? prev.filter(x => x.id !== s.id) : [...prev, s])
  }

  const handleLinkSubmit = async () => {
    if (!linkingFor) return
    if (linkSelected.length === 0) { setLinkError('Selecciona al menos un estudiante'); return }
    setLinkError(''); setLinkSaving(true)
    try {
      const res  = await fetch(`${API_URL}/api/parents/${linkingFor.id}/link-students`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
        body: JSON.stringify({ studentIds: linkSelected.map(s => s.id), relationType: linkRelationType, isTutor: linkIsTutor }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setLinkError(data.message || 'No se pudo vincular'); return }
      toast('Estudiante(s) vinculado(s) correctamente', 'success')
      setLinkingFor(null)
      fetchParents(page, search, filter)
    } catch { setLinkError('Error de conexión') }
    finally { setLinkSaving(false) }
  }

  // Toggle Activo/Inactivo — bloquea/desbloquea el ACCESO del padre al
  // sistema (User.isActive), independiente del badge "Estado" (que es solo
  // informativo, calculado por matrícula vigente de sus hijos).
  const [togglingId, setTogglingId] = useState<number | null>(null)
  const handleToggleAccess = async (p: ParentStatus) => {
    if (!p.user) return
    const activar = !p.user.isActive
    if (!await confirm(`¿${activar ? 'Habilitar' : 'Bloquear'} el acceso al sistema de ${p.firstName} ${p.lastName}?`, { danger: !activar })) return
    setTogglingId(p.id)
    try {
      const res  = await fetch(`${API_URL}/api/parents/${p.id}/toggle`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { toast(data.message || 'No se pudo actualizar el acceso', 'error'); return }
      toast(data.message || 'Acceso actualizado', 'success')
      fetchParents(page, search, filter)
    } catch { toast('Error de conexión', 'error') }
    finally { setTogglingId(null) }
  }

  // ---- Pestaña "Padres por curso" (movida de familias/page.tsx, tal cual) ----
  const [byCourse, setByCourse] = useState<CourseGroup[]>([])
  const [loadingByCourse, setLoadingByCourse] = useState(true)
  const [pcSearch, setPcSearch] = useState('')

  const [editingRow, setEditingRow] = useState<ParentInfo | null>(null)
  const [editForm, setEditForm] = useState(emptyEditForm)
  const [pcSaving, setPcSaving] = useState(false)
  const [pcError, setPcError] = useState('')

  const token = () => (typeof window !== 'undefined' ? localStorage.getItem('token') : '') || ''
  const auth  = () => ({ Authorization: `Bearer ${token()}` })

  const fetchByCourse = () => {
    setLoadingByCourse(true)
    fetch(`${API_URL}/api/parents/by-course`, { headers: auth() })
      .then(r => r.ok ? r.json() : [])
      .then(setByCourse)
      .catch(() => {})
      .finally(() => setLoadingByCourse(false))
  }

  useEffect(fetchByCourse, [])

  const pcQ = pcSearch.trim().toLowerCase()
  const matchesPcSearch = (m: ParentInfo) =>
    !pcQ || `${m.firstName} ${m.lastName}`.toLowerCase().includes(pcQ) || (m.ci || '').toLowerCase().includes(pcQ)

  const byCourseFiltered = byCourse.map(g => ({
    ...g,
    padres: g.padres
      .map(sg => ({ ...sg, parents: sg.parents.filter(matchesPcSearch) }))
      .filter(sg => sg.parents.length > 0),
  }))

  const openEdit = (row: ParentInfo) => {
    setEditingRow(row)
    setEditForm({
      firstName: row.firstName, lastName: row.lastName, ci: row.ci || '',
      // Correo personal (Parent.email) — distinto y editable, separado del
      // correo de acceso (User.email, se muestra aparte y no se edita acá).
      phone: row.phone || '', email: row.email || '', address: row.address || '', kardex: row.kardex || '',
    })
    setPcError('')
  }

  const [pcDeletingId, setPcDeletingId] = useState<number | null>(null)
  const [pcRegenerating, setPcRegenerating] = useState(false)

  const handleRegenerateEmail = async () => {
    if (!editingRow) return
    if (!await confirm(`¿Regenerar el correo de acceso institucional de ${editingRow.firstName} ${editingRow.lastName}? El correo con el que inicia sesión hoy dejará de funcionar.`, { danger: true })) return
    setPcRegenerating(true)
    try {
      const res  = await fetch(`${API_URL}/api/parents/${editingRow.id}/regenerate-email`, { method: 'POST', headers: auth() })
      const data = await res.json()
      if (!res.ok) { toast(data.message, 'error'); return }
      toast(`Nuevo correo de acceso: ${data.email}`, 'success')
      setEditingRow(r => r && r.user ? { ...r, user: { ...r.user, email: data.email } } : r)
      fetchByCourse()
    } catch { toast('Error de conexión', 'error') }
    finally { setPcRegenerating(false) }
  }

  // Solo para el caso de un duplicado creado por error (ej. registro manual
  // repetido) — borra el Parent por completo (relaciones, cuenta de acceso si
  // tiene, y el registro). El backend ya bloquea el borrado si dejaría a un
  // estudiante sin ningún tutor legal.
  const handleDelete = async (row: ParentInfo) => {
    if (!await confirm(
      `¿Eliminar definitivamente a ${row.lastName} ${row.firstName}? Usá esto solo si es un registro duplicado por error — se borra su cuenta de acceso (si tiene) y todos sus vínculos. No se puede deshacer.`,
      { danger: true }
    )) return
    setPcDeletingId(row.id)
    try {
      const res  = await fetch(`${API_URL}/api/parents/${row.id}`, { method: 'DELETE', headers: auth() })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { toast(data.message || 'No se pudo eliminar', 'error'); return }
      toast('Registro eliminado', 'success')
      fetchByCourse()
    } catch { toast('Error de conexión', 'error') }
    finally { setPcDeletingId(null) }
  }

  const handleSaveEdit = async () => {
    if (!editingRow) return
    if (!editForm.firstName || !editForm.lastName) { setPcError('Nombre y apellido son requeridos'); return }
    setPcError(''); setPcSaving(true)
    try {
      const res = await fetch(`${API_URL}/api/parents/${editingRow.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...auth() },
        body: JSON.stringify(editForm),
      })
      const data = await res.json()
      if (!res.ok) { setPcError(data.message || 'Error al guardar'); return }
      toast('Tutor/padre actualizado correctamente', 'success')
      setEditingRow(null)
      fetchByCourse()
    } catch { setPcError('Error de conexión') }
    finally { setPcSaving(false) }
  }

  // "Padres por curso": una fila por ESTUDIANTE, con todos sus padres/tutores
  // agrupados en una sola columna — cada uno con su relación (Padre/Madre/...),
  // badge "Tutor" si corresponde, estado de acceso, y su propia acción Editar.
  const studentGroupColumns: Column<StudentGroup>[] = [
    { key: 'student', header: 'Estudiante', render: g => (
      <span className="font-semibold text-brand-700 text-[12.5px]">{g.studentName}</span>
    ) },
    { key: 'parents', header: 'Padres / Tutores', render: g => (
      <div className="flex flex-col gap-1">
        {g.parents.map((p, i) => (
          <div
            key={p.id}
            className={`flex items-center justify-between gap-4 flex-wrap py-1.5 ${i > 0 ? 'border-t border-neutral-100' : ''}`}
          >
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-brand-700 text-[12.5px]">{p.lastName} {p.firstName}</span>
              {p.ci && <span className="text-[11px] text-neutral-500">CI {p.ci}</span>}
              <Badge tone="neutral">{RELATION_LABELS[p.relationType] || p.relationType}</Badge>
              {p.isTutor && <Badge tone="success">Tutor</Badge>}
            </div>
            <div className="flex items-center gap-2.5 shrink-0">
              {p.user
                ? <Badge tone={p.user.isActive ? 'success' : 'danger'}>{p.user.isActive ? 'Activo' : 'Inactivo'}</Badge>
                : <span className="text-[11px] text-neutral-400 italic">Sin cuenta</span>}
              <Button size="sm" variant="secondary" onClick={() => openEdit(p)}><Pencil size={11}/> Editar</Button>
              <Button size="sm" variant="secondary" className="text-danger-600" onClick={() => handleDelete(p)} loading={pcDeletingId === p.id}>
                <Trash2 size={11}/> Eliminar
              </Button>
            </div>
          </div>
        ))}
      </div>
    ) },
  ]

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
        <div className="flex flex-col gap-1">
          {p.students.map((s, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <span className="text-[12px] text-neutral-600">
                {s.student.lastName} {s.student.firstName}
                <span className="text-neutral-400"> · {RELATION_LABELS[s.relationType] || s.relationType}{s.isTutor ? ' (tutor)' : ''}</span>
              </span>
              <button
                title="Gestionar tutor legal"
                onClick={() => openChangeTutor(s.student.id, `${s.student.lastName} ${s.student.firstName}`)}
                className="text-neutral-400 hover:text-brand-700 shrink-0"
              >
                <ArrowLeftRight size={11} />
              </button>
            </div>
          ))}
        </div>
      )
    },
    { key: 'contacto', header: 'Teléfono', render: p => <span className="text-[12.5px] text-neutral-500">{p.phone || '—'}</span> },
    { key: 'estado', header: 'Matrícula', render: p => <Badge tone={p.active ? 'success' : 'danger'}>{p.active ? 'Activo' : 'Inactivo'}</Badge> },
    { key: 'acciones', header: 'Acciones', render: p => (
      <div className="flex flex-col gap-1.5 items-start">
        <Button size="sm" variant="secondary" onClick={() => openLinkModal(p)}>
          <UserPlus size={12}/> {p.students.length === 0 ? 'Vincular hijo' : 'Vincular otro hijo'}
        </Button>
        <Button
          size="sm"
          variant={p.user?.isActive ? 'danger' : 'secondary'}
          disabled={!p.user}
          title={!p.user ? 'Este padre no tiene cuenta de acceso al sistema' : undefined}
          onClick={() => handleToggleAccess(p)}
          loading={togglingId === p.id}
        >
          <Power size={12}/> {!p.user ? 'Sin acceso' : p.user.isActive ? 'Bloquear acceso' : 'Habilitar acceso'}
        </Button>
      </div>
    ) },
  ]

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-brand-700 mb-1">Padres registrados</h1>
        <p className="text-[13px] text-neutral-500">Activo: tiene al menos un hijo matriculado en la gestión activa</p>
      </div>

      <div className="flex gap-1 bg-neutral-100 rounded-lg p-1 mb-4 w-fit">
        <button
          onClick={() => setViewMode('registrados')}
          className={`px-3 py-1.5 rounded-md text-[12.5px] font-semibold transition-colors ${viewMode === 'registrados' ? 'bg-white text-brand-700 shadow-sm' : 'text-neutral-500'}`}
        >
          Padres registrados
        </button>
        <button
          onClick={() => setViewMode('padres-curso')}
          className={`px-3 py-1.5 rounded-md text-[12.5px] font-semibold transition-colors ${viewMode === 'padres-curso' ? 'bg-white text-brand-700 shadow-sm' : 'text-neutral-500'}`}
        >
          Padres por curso
        </button>
      </div>

      {viewMode === 'registrados' && (
        <>
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
        </>
      )}

      {viewMode === 'padres-curso' && (
        <div className="flex flex-col gap-3">
          <div className="relative max-w-md">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-info-500 pointer-events-none"/>
            <Input label="" placeholder="Buscar por nombre o CI" value={pcSearch} onChange={e => setPcSearch(e.target.value)} className="pl-9" />
          </div>

          {loadingByCourse ? (
            <Card className="text-center py-12 text-neutral-500">Cargando...</Card>
          ) : byCourseFiltered.every(g => g.padres.length === 0) ? (
            <Card className="text-center py-12 text-neutral-500">
              {pcSearch ? 'Nadie coincide con la búsqueda.' : 'No hay familias registradas todavía.'}
            </Card>
          ) : byCourseFiltered
              .filter(g => g.padres.length > 0 || !pcSearch)
              .map(g => {
                const parentsCount = g.padres.reduce((sum, sg) => sum + sg.parents.length, 0)
                const isEmpty = g.padres.length === 0
                return (
                  <Card key={g.course.id} padded={false} className="overflow-hidden">
                    <div className="flex items-center justify-between px-4.5 py-3 border-b border-neutral-100">
                      <span className="text-[13.5px] font-bold text-brand-700">{courseLabel(g.course)}</span>
                      <span className="text-[11px] text-neutral-500">{g.padres.length} estudiante(s) · {parentsCount} padre(s)</span>
                    </div>
                    {isEmpty ? (
                      <p className="text-[13px] text-neutral-500 italic px-4.5 py-4">
                        Sin padres registrados en este curso
                      </p>
                    ) : (
                      <div className="p-4">
                        <Table columns={studentGroupColumns} rows={g.padres} rowKey={sg => sg.studentId} />
                      </div>
                    )}
                  </Card>
                )
              })
          }
        </div>
      )}

      <Modal
        open={!!changingTutorFor} onClose={() => setChangingTutorFor(null)}
        title={changingTutorFor ? `Gestionar tutor legal — ${changingTutorFor.label}` : 'Gestionar tutor legal'}
      >
        {loadingCandidates ? (
          <p className="text-[13px] text-neutral-500 text-center py-6">Cargando...</p>
        ) : (
          <div className="flex flex-col gap-2">
            {currentTutor ? (
              <p className="text-[12.5px] text-neutral-500 mb-1">
                Tutor legal actual: <span className="font-semibold text-brand-700">{currentTutor.lastName} {currentTutor.firstName}</span>. Elegí a quién promover — el actual deja de serlo, pero sigue vinculado como antes.
              </p>
            ) : (
              <p className="text-[12.5px] text-neutral-500 mb-1">
                Este estudiante no tiene tutor legal asignado. Elegí a quién asignar.
              </p>
            )}
            {otherCandidates.length === 0 ? (
              <p className="text-[13px] text-neutral-500 italic py-3 text-center">
                No hay otro padre/madre/tutor vinculado a este estudiante — no hay a quién asignar.
              </p>
            ) : otherCandidates.map(c => (
              <div key={c.id} className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-neutral-200">
                <div>
                  <div className="text-[13px] font-medium text-brand-700">{c.lastName} {c.firstName}</div>
                  <div className="text-[11px] text-neutral-500">
                    {RELATION_LABELS[c.relationType] || c.relationType}{c.ci ? ` · CI ${c.ci}` : ''}
                  </div>
                </div>
                <Button size="sm" onClick={() => handleChangeTutor(c.id)} loading={changingTutorId === c.id}>
                  Hacer tutor legal
                </Button>
              </div>
            ))}
          </div>
        )}
      </Modal>

      <Modal
        open={!!linkingFor} onClose={() => setLinkingFor(null)}
        title={linkingFor ? `Vincular hijo — ${linkingFor.lastName} ${linkingFor.firstName}` : 'Vincular hijo'}
        footer={<Button onClick={handleLinkSubmit} loading={linkSaving}>Vincular</Button>}
      >
        <div className="flex flex-col gap-3">
          {linkError && <p className="text-[13px] text-danger-600 bg-danger-100 rounded-lg px-3 py-2">{linkError}</p>}

          <Select label="Relación con el/los estudiante(s)" required value={linkRelationType} onChange={e => setLinkRelationType(e.target.value)}>
            {Object.entries(LINK_RELATION_OPTIONS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Select>
          <label className="flex items-center gap-2 text-[13px] text-brand-700 cursor-pointer select-none">
            <input type="checkbox" checked={linkIsTutor} onChange={e => setLinkIsTutor(e.target.checked)} className="accent-brand-700 w-3.5 h-3.5" />
            Marcar como tutor legal
          </label>
          {linkIsTutor && (
            <p className="text-[12px] text-info-500 bg-info-500/10 rounded-lg px-3 py-2">
              Si el estudiante ya tiene un tutor legal, se va a rechazar — usá &quot;Gestionar tutor legal&quot; en su lugar.
            </p>
          )}

          <div>
            <div className="text-[13px] font-semibold text-brand-700 mb-1.5">Estudiante(s)</div>
            <div className="flex gap-2 mb-2">
              <Input
                label="" value={linkSearch} placeholder="Buscar estudiante por nombre"
                onChange={e => setLinkSearch(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleLinkSearch() } }}
              />
              <Button variant="secondary" onClick={handleLinkSearch} loading={linkSearching}><Search size={14}/></Button>
            </div>
            <div className="flex flex-col gap-1.5 max-h-52 overflow-y-auto">
              {linkResults.map(s => {
                const checked = linkSelected.some(x => x.id === s.id)
                return (
                  <label key={s.id} className={`flex items-center gap-2.5 px-3 py-2 rounded-lg cursor-pointer text-[13px] ${checked ? 'bg-success-100' : 'bg-neutral-100/60 hover:bg-neutral-100'}`}>
                    <input type="checkbox" checked={checked} onChange={() => toggleLinkStudent(s)} className="accent-brand-700" />
                    <span className="font-medium text-brand-700">{s.lastName} {s.firstName}</span>
                  </label>
                )
              })}
              {linkResults.length === 0 && (
                <p className="text-[12px] text-neutral-500 italic">Buscá un estudiante para vincularlo</p>
              )}
            </div>
          </div>
        </div>
      </Modal>

      <Modal
        open={!!editingRow} onClose={() => setEditingRow(null)} title="Editar Padre/Tutor"
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditingRow(null)}>Cancelar</Button>
            <Button onClick={handleSaveEdit} loading={pcSaving}>Guardar</Button>
          </>
        }
      >
        <div className="flex flex-col gap-3.5">
          {pcError && <p className="text-[13px] text-danger-600 bg-danger-100 rounded-lg px-3 py-2">{pcError}</p>}
          <div className="grid grid-cols-2 gap-3">
            <Input label="Nombres" required value={editForm.firstName} onChange={e => setEditForm({ ...editForm, firstName: e.target.value })} />
            <Input label="Apellidos" required value={editForm.lastName} onChange={e => setEditForm({ ...editForm, lastName: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="CI" value={editForm.ci} onChange={e => setEditForm({ ...editForm, ci: e.target.value })} />
            <Input label="Teléfono" value={editForm.phone} onChange={e => setEditForm({ ...editForm, phone: e.target.value })} />
          </div>
          <Input label="Correo personal (opcional)" type="email" value={editForm.email} onChange={e => setEditForm({ ...editForm, email: e.target.value })} />
          <Input label="Dirección" value={editForm.address} onChange={e => setEditForm({ ...editForm, address: e.target.value })} />
          <Input label="N° Kardex" value={editForm.kardex} onChange={e => setEditForm({ ...editForm, kardex: e.target.value })} />

          <div className="border-t border-neutral-100 pt-3 flex flex-col gap-2">
            <span className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wide">Correo de acceso al sistema</span>
            {editingRow?.user ? (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[13px] font-mono text-brand-700 bg-neutral-100 border border-neutral-300 rounded-lg px-3 py-2 break-all">{editingRow.user.email}</span>
                <Button size="sm" variant="secondary" onClick={handleRegenerateEmail} loading={pcRegenerating}>
                  <RefreshCw size={12}/> Regenerar correo institucional
                </Button>
              </div>
            ) : (
              <span className="text-[12px] text-neutral-500 italic">Sin cuenta de acceso</span>
            )}
          </div>
        </div>
      </Modal>
    </div>
  )
}
