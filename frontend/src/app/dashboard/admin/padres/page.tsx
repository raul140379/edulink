'use client'

import { useEffect, useState } from 'react'
import { Plus, Search, Edit, Eye, UserCheck, UserX, Trash2, KeyRound, Copy, Check, Link as LinkIcon, Upload } from 'lucide-react'
import { useRouter } from 'next/navigation'
import Button from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Input'
import Badge from '@/components/ui/Badge'
import Modal from '@/components/ui/Modal'
import Table, { Column } from '@/components/ui/Table'
import { useToast } from '@/components/ui/ToastProvider'
import { useConfirm } from '@/components/ui/ConfirmProvider'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

interface Student {
  id: number; firstName: string; lastName: string; ci?: string; rude?: string; kardex?: string
}

interface ParentStudent {
  relationType: string
  isTutor:      boolean
  student:      Student
}

interface Parent {
  id:        number
  firstName: string
  lastName:  string
  ci?:       string
  phone?:    string
  email?:    string
  address?:  string
  user?:     { id: number; email: string; isActive: boolean }
  students:  ParentStudent[]
  _count:    { students: number }
}

interface Credentials {
  accessEmail: string; defaultPassword: string; name: string
}

const RELATION_TYPES = [
  { value: 'PADRE',       label: 'Padre' },
  { value: 'MADRE',       label: 'Madre' },
  { value: 'TUTOR_LEGAL', label: 'Tutor Legal' },
  { value: 'OTRO',        label: 'Otro' },
]

const relLabel = (v: string, isTutor?: boolean) => {
  if (isTutor) {
    if (v === 'PADRE')  return 'Padre · Tutor Legal'
    if (v === 'MADRE')  return 'Madre · Tutora Legal'
    return 'Tutor Legal'
  }
  return RELATION_TYPES.find(r => r.value === v)?.label || v
}
const relTone: Record<string, 'brand' | 'success' | 'danger' | 'neutral'> = {
  PADRE: 'brand', MADRE: 'success', TUTOR_LEGAL: 'danger', OTRO: 'neutral'
}

const emptyForm = {
  firstName: '', lastName: '', ci: '', phone: '', email: '', address: '',
  relationType: 'PADRE', studentIds: [] as number[],
}

export default function PadresPage() {
  const router = useRouter()
  const toast = useToast()
  const confirm = useConfirm()
  const [parents,    setParents]    = useState<Parent[]>([])
  const [students,   setStudents]   = useState<Student[]>([])
  const [loading,    setLoading]    = useState(true)
  const [search,     setSearch]     = useState('')
  const [showModal,           setShowModal]           = useState(false)
  const [showLinkModal,       setShowLinkModal]       = useState(false)
  const [showCredentials,     setShowCredentials]     = useState(false)
  const [showChangeRelModal,  setShowChangeRelModal]  = useState(false)
  const [editMode,   setEditMode]   = useState(false)
  const [editId,     setEditId]     = useState<number | null>(null)
  const [linkId,     setLinkId]     = useState<number | null>(null)
  const [saving,     setSaving]     = useState(false)
  const [formError,  setFormError]  = useState('')
  const [linkError,  setLinkError]  = useState('')
  const [relError,   setRelError]   = useState('')
  const [form,       setForm]       = useState(emptyForm)
  const [creds,      setCreds]      = useState<Credentials | null>(null)
  const [copied,     setCopied]     = useState(false)
  const [linkStudentIds,  setLinkStudentIds]  = useState<number[]>([])
  const [linkRelType,     setLinkRelType]     = useState('PADRE')
  const [changeRelParentId,  setChangeRelParentId]  = useState<number | null>(null)
  const [changeRelStudentId, setChangeRelStudentId] = useState<number | null>(null)
  const [changeRelType,      setChangeRelType]      = useState('PADRE')
  const [currentRelType,     setCurrentRelType]     = useState('')
  const [showImportModal, setShowImportModal] = useState(false)
  const [importing,       setImporting]       = useState(false)
  const [importResult,    setImportResult]    = useState<any>(null)
  const [linkSearch, setLinkSearch] = useState('')
  const [changeIsTutor, setChangeIsTutor] = useState(false)
  const [filterTutor, setFilterTutor] = useState('')
  const [orderBy, setOrderBy] = useState('alfabetico')

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : ''

  const sortParents = (list: Parent[], by: string) => [...list].sort((a: any, b: any) => {
    if (by === 'kardex') {
      const kardexA = a.students.find((s: any) => s.isTutor)?.student?.kardex || '9999'
      const kardexB = b.students.find((s: any) => s.isTutor)?.student?.kardex || '9999'
      return kardexA.toString().localeCompare(kardexB.toString(), undefined, { numeric: true })
    }
    return `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`)
  })

  const fetchParents = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      if (filterTutor === 'TUTOR')        params.set('isTutor', 'true')
      if (filterTutor === 'SIN_VINCULAR') params.set('isTutor', 'SIN_VINCULAR')
      if (filterTutor === 'NO_TUTOR')     params.set('isTutor', 'NO_TUTOR')
      const res  = await fetch(`${API_URL}/api/parents?${params}`, { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      if (res.ok) setParents(sortParents(data, orderBy))
      else toast('Error al cargar padres', 'error')
    } catch { toast('Error de conexión', 'error') }
    finally  { setLoading(false) }
  }

  const fetchStudents = async () => {
    try {
      const res  = await fetch(`${API_URL}/api/students`, { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      if (res.ok) setStudents(data)
    } catch { console.error('Error') }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchParents(); fetchStudents() }, [])

  const openCreate = () => { setEditMode(false); setEditId(null); setForm(emptyForm); setFormError(''); setShowModal(true) }

  const openEdit = (p: Parent) => {
    setEditMode(true); setEditId(p.id)
    setForm({ firstName: p.firstName, lastName: p.lastName, ci: p.ci || '', phone: p.phone || '', email: p.email || '', address: p.address || '', relationType: 'PADRE', studentIds: [] })
    setFormError(''); setShowModal(true)
  }

  const openLink = (id: number) => { setLinkId(id); setLinkStudentIds([]); setLinkRelType('PADRE'); setLinkError(''); setShowLinkModal(true) }

  const openChangeRel = (parentId: number, studentId: number, currentRel: string, isTutor: boolean) => {
    setChangeRelParentId(parentId)
    setChangeRelStudentId(studentId)
    setCurrentRelType(currentRel)
    setChangeRelType(currentRel)
    setChangeIsTutor(isTutor)
    setRelError('')
    setShowChangeRelModal(true)
  }

  const handleSave = async () => {
    setFormError(''); setSaving(true)
    try {
      const url    = editMode ? `${API_URL}/api/parents/${editId}` : `${API_URL}/api/parents`
      const method = editMode ? 'PUT' : 'POST'
      const res    = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) { setFormError(data.message); return }
      setShowModal(false); fetchParents()
      if (!editMode && data.accessEmail) {
        setCreds({ accessEmail: data.accessEmail, defaultPassword: data.defaultPassword, name: `${form.firstName} ${form.lastName}` })
        setShowCredentials(true)
      } else { toast(editMode ? 'Actualizado correctamente' : 'Registrado correctamente', 'success') }
    } catch { setFormError('Error de conexión') }
    finally  { setSaving(false) }
  }

  const handleLink = async () => {
    if (linkStudentIds.length === 0) { setLinkError('Selecciona al menos un estudiante'); return }
    setLinkError(''); setSaving(true)
    try {
      const res  = await fetch(`${API_URL}/api/parents/${linkId}/link-students`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ studentIds: linkStudentIds, relationType: linkRelType }),
      })
      const data = await res.json()
      if (!res.ok) { setLinkError(data.message); return }
      toast(data.message, 'success'); setShowLinkModal(false); fetchParents()
    } catch { setLinkError('Error de conexión') }
    finally  { setSaving(false) }
  }

  const handleChangeRel = async () => {
    if (!changeRelParentId || !changeRelStudentId) return
    setRelError(''); setSaving(true)
    try {
      const res  = await fetch(`${API_URL}/api/parents/${changeRelParentId}/change-relation/${changeRelStudentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ relationType: changeRelType, isTutor: changeIsTutor }),
      })
      const data = await res.json()
      if (!res.ok) { setRelError(data.message); return }
      setShowChangeRelModal(false)
      fetchParents()
      if (data.accessEmail) {
        setCreds({ accessEmail: data.accessEmail, defaultPassword: data.defaultPassword, name: '' })
        setShowCredentials(true)
      } else {
        toast(data.message, 'success')
      }
    } catch { setRelError('Error de conexión') }
    finally  { setSaving(false) }
  }

  const handleUnlink = async (parentId: number, studentId: number) => {
    const ok = await confirm('¿Desvincular este estudiante?', { danger: true, confirmLabel: 'Desvincular' })
    if (!ok) return
    try {
      const res  = await fetch(`${API_URL}/api/parents/${parentId}/unlink/${studentId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      if (res.ok) { toast(data.message, 'success'); fetchParents() }
      else toast(data.message, 'error')
    } catch { toast('Error al desvincular', 'error') }
  }

  const handleToggle = async (id: number) => {
    try {
      const res  = await fetch(`${API_URL}/api/parents/${id}/toggle`, { method: 'PATCH', headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      if (res.ok) { toast(data.message, 'success'); fetchParents() }
      else toast(data.message, 'error')
    } catch { toast('Error al cambiar estado', 'error') }
  }

  const handleDelete = async (id: number, name: string) => {
    const ok = await confirm(`¿Eliminar a ${name}?`, { danger: true, confirmLabel: 'Eliminar' })
    if (!ok) return
    try {
      const res  = await fetch(`${API_URL}/api/parents/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      if (res.ok) { toast(data.message, 'success'); fetchParents() }
      else toast(data.message, 'error')
    } catch { toast('Error al eliminar', 'error') }
  }

  const handleGenerateCreds = async (id: number, name: string) => {
    try {
      const res  = await fetch(`${API_URL}/api/parents/${id}/generate-credentials`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      if (!res.ok) { toast(data.message, 'error'); return }
      setCreds({ accessEmail: data.accessEmail, defaultPassword: data.defaultPassword, name })
      setShowCredentials(true); fetchParents()
    } catch { toast('Error al generar credenciales', 'error') }
  }

  const copyCreds = () => {
    if (!creds) return
    navigator.clipboard.writeText(`Nombre: ${creds.name}\nEmail: ${creds.accessEmail}\nContraseña: ${creds.defaultPassword}`)
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }

  const handleImportParents = async (file: File) => {
    setImporting(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res  = await fetch(`${API_URL}/api/parents/import`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      })
      const data = await res.json()
      setImportResult(data)
      if (res.ok) fetchParents()
    } catch { toast('Error al importar', 'error') }
    finally  { setImporting(false) }
  }

  const toggleLink = (id: number) => setLinkStudentIds(p => p.includes(id) ? p.filter(s => s !== id) : [...p, id])
  const toggleForm = (id: number) => setForm(p => ({ ...p, studentIds: p.studentIds.includes(id) ? p.studentIds.filter(s => s !== id) : [...p.studentIds, id] }))

  const isTutorLegalSinAcceso = (p: Parent) => !p.user && p.students.some(s => s.relationType === 'TUTOR_LEGAL')

  const columns: Column<Parent>[] = [
    { key: 'idx', header: '#', render: (p) => <span className="text-neutral-500">{parents.indexOf(p) + 1}</span> },
    {
      key: 'name', header: 'Nombre completo', render: (p) => (
        <div>
          <div className="font-medium text-brand-700">{p.lastName} {p.firstName}</div>
          {p.user && <div className="text-[11px] text-neutral-500 mt-0.5">{p.user.email}</div>}
        </div>
      ),
    },
    { key: 'ci', header: 'CI', render: (p) => <span className="text-neutral-500 text-xs">{p.ci || '—'}</span> },
    { key: 'phone', header: 'Teléfono', render: (p) => <span className="text-neutral-500 text-xs">{p.phone || '—'}</span> },
    {
      key: 'students', header: 'Hijos vinculados', render: (p) => p.students.length === 0
        ? <span className="text-[11px] text-neutral-500 italic">Sin vincular</span>
        : (
          <div className="flex flex-col gap-1">
            {p.students.map(ps => (
              <div key={ps.student.id} className="flex items-center gap-1.5 text-xs">
                <button
                  title="Click para cambiar tipo de relación"
                  onClick={() => openChangeRel(p.id, ps.student.id, ps.relationType, ps.isTutor)}
                >
                  <Badge tone={relTone[ps.relationType]}>{relLabel(ps.relationType, ps.isTutor)} ✏️</Badge>
                </button>
                <span className="text-brand-700">{ps.student.lastName} {ps.student.firstName}</span>
                {ps.student.kardex && <span className="text-[11px] text-neutral-500">K:{ps.student.kardex}</span>}
                <button onClick={() => handleUnlink(p.id, ps.student.id)} title="Desvincular" className="text-danger-600 hover:opacity-75 text-base leading-none px-0.5">×</button>
              </div>
            ))}
          </div>
        ),
    },
    {
      key: 'access', header: 'Acceso', render: (p) => p.user
        ? <Badge tone={p.user.isActive ? 'success' : 'danger'}>{p.user.isActive ? 'Activo' : 'Inactivo'}</Badge>
        : isTutorLegalSinAcceso(p)
          ? (
            <button
              onClick={() => handleGenerateCreds(p.id, `${p.firstName} ${p.lastName}`)}
              className="inline-flex items-center gap-1 border border-dashed border-accent-500 text-[#7A6000] rounded-md px-2 py-0.5 text-[11px] hover:bg-warning-100"
            >
              <KeyRound size={11} /> Generar acceso
            </button>
          )
          : <span className="text-[11px] text-neutral-500 italic">Sin acceso</span>,
    },
    {
      key: 'actions', header: 'Acciones', render: (p) => (
        <div className="flex gap-1.5">
          <button title="Ver detalle" onClick={() => router.push(`/dashboard/admin/padres/${p.id}`)} className="w-7 h-7 rounded-md bg-info-500/15 text-info-500 flex items-center justify-center hover:opacity-75">
            <Eye size={13} />
          </button>
          <button title="Editar" onClick={() => openEdit(p)} className="w-7 h-7 rounded-md bg-accent-500/15 text-accent-600 flex items-center justify-center hover:opacity-75">
            <Edit size={13} />
          </button>
          <button title="Vincular estudiante" onClick={() => openLink(p.id)} className="w-7 h-7 rounded-md bg-success-100 text-success-700 flex items-center justify-center hover:opacity-75">
            <LinkIcon size={13} />
          </button>
          {p.user && (
            <button title={p.user.isActive ? 'Desactivar' : 'Activar'} onClick={() => handleToggle(p.id)}
              className={`w-7 h-7 rounded-md flex items-center justify-center hover:opacity-75 ${p.user.isActive ? 'bg-danger-100 text-danger-600' : 'bg-success-100 text-success-700'}`}>
              {p.user.isActive ? <UserX size={13} /> : <UserCheck size={13} />}
            </button>
          )}
          <button title="Eliminar" onClick={() => handleDelete(p.id, `${p.firstName} ${p.lastName}`)} className="w-7 h-7 rounded-md bg-danger-100 text-danger-600 flex items-center justify-center hover:opacity-75">
            <Trash2 size={13} />
          </button>
        </div>
      ),
    },
  ]

  return (
    <div>
      <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-brand-700 mb-1">Padres y Tutores</h1>
          <p className="text-[13px] text-neutral-500">Registro y vinculación con estudiantes</p>
        </div>
        <div className="flex gap-2.5">
          <Button variant="secondary" onClick={() => { setShowImportModal(true); setImportResult(null) }}>
            <Upload size={16} /> Importar Excel
          </Button>
          <Button onClick={openCreate}><Plus size={16} /> Nuevo padre/tutor</Button>
        </div>
      </div>

      <div className="flex gap-2.5 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-info-500 pointer-events-none" />
          <input
            placeholder="Buscar por nombre, CI o teléfono..." value={search}
            onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && fetchParents()}
            className="w-full h-10 pl-9 pr-3 rounded-lg border border-neutral-300 text-sm outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/15"
          />
        </div>
        <Select value={filterTutor} onChange={e => setFilterTutor(e.target.value)} className="w-auto min-w-[170px]">
          <option value="">Todos</option>
          <option value="TUTOR">Solo tutores legales</option>
          <option value="SIN_VINCULAR">Sin vincular</option>
          <option value="NO_TUTOR">Vinculados no tutores</option>
        </Select>
        <Select
          value={orderBy}
          onChange={e => { setOrderBy(e.target.value); setParents(prev => sortParents(prev, e.target.value)) }}
          className="w-auto min-w-[170px]"
        >
          <option value="alfabetico">Ordenar: Alfabético</option>
          <option value="kardex">Ordenar: Por Kardex</option>
        </Select>
        <Button variant="secondary" onClick={fetchParents}>Buscar</Button>
      </div>

      <Table columns={columns} rows={parents} rowKey={(p) => p.id} loading={loading} emptyLabel="No se encontraron padres/tutores" />
      <div className="px-3.5 py-2.5 text-xs text-neutral-500">Total: <strong>{parents.length}</strong> padres/tutores</div>

      {/* Modal crear/editar */}
      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title={editMode ? 'Editar Padre/Tutor' : 'Nuevo Padre/Tutor'}
        maxWidth={620}
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowModal(false)}>Cancelar</Button>
            <Button onClick={handleSave} loading={saving}>{editMode ? 'Actualizar' : 'Registrar'}</Button>
          </>
        }
      >
        <div className="flex flex-col gap-3.5">
          {formError && <p className="text-[13px] text-danger-600 bg-danger-100 rounded-lg px-3 py-2">{formError}</p>}
          {!editMode && (
            <p className="bg-neutral-100 border border-neutral-300 rounded-lg px-3 py-2.5 text-xs text-neutral-500 leading-relaxed">
              🔑 Solo el <strong>Tutor Legal</strong> recibirá acceso al sistema. Padres y madres son registrados sin acceso.
            </p>
          )}
          <div className="text-xs font-bold text-brand-700 uppercase tracking-wide pb-1 border-b border-neutral-300/60">Datos personales</div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Nombres" required placeholder="Ej: Carlos Alberto" value={form.firstName} onChange={e => setForm({ ...form, firstName: e.target.value })} />
            <Input label="Apellidos" required placeholder="Ej: García López" value={form.lastName} onChange={e => setForm({ ...form, lastName: e.target.value })} />
            <Input label="CI" placeholder="Ej: 12345678" value={form.ci} onChange={e => setForm({ ...form, ci: e.target.value })} />
            <Input label="Teléfono" placeholder="Ej: 70012345" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
            <Input label="Correo personal" type="email" placeholder="Ej: padre@gmail.com" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
            <Input label="Dirección" placeholder="Ej: Av. Principal 123" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} />
          </div>
          {!editMode && (
            <>
              <div className="text-xs font-bold text-brand-700 uppercase tracking-wide pb-1 border-b border-neutral-300/60">Tipo de relación</div>
              <div className="grid grid-cols-4 gap-2">
                {RELATION_TYPES.map(r => (
                  <button
                    key={r.value} type="button"
                    onClick={() => setForm({ ...form, relationType: r.value })}
                    className={`px-1 py-2 rounded-lg text-xs text-center border transition-colors ${
                      form.relationType === r.value ? 'border-brand-700 bg-brand-700 text-white' : 'border-neutral-300 text-brand-700 hover:border-info-500 hover:bg-neutral-100'
                    }`}
                  >
                    {r.value === 'TUTOR_LEGAL' ? '🔑 ' : ''}{r.label}
                  </button>
                ))}
              </div>
              {form.relationType === 'TUTOR_LEGAL' && (
                <p className="bg-warning-100 border border-accent-500 rounded-lg px-3 py-2.5 text-xs text-[#7A6000] leading-relaxed">
                  ⚠️ Se generará usuario y contraseña de acceso para este tutor legal.
                </p>
              )}
              <div className="text-xs font-bold text-brand-700 uppercase tracking-wide pb-1 border-b border-neutral-300/60">Vincular estudiantes</div>
              <div className="flex flex-col gap-1.5 max-h-[200px] overflow-y-auto border border-neutral-300 rounded-lg p-2">
                {students.length === 0
                  ? <p className="text-xs text-neutral-500 p-2">No hay estudiantes registrados</p>
                  : students.map(s => (
                    <label key={s.id} className={`flex items-center gap-2 p-2 rounded-md cursor-pointer text-[13px] text-brand-700 ${form.studentIds.includes(s.id) ? 'bg-brand-100' : 'hover:bg-neutral-100'}`}>
                      <input type="checkbox" checked={form.studentIds.includes(s.id)} onChange={() => toggleForm(s.id)} className="accent-brand-700" />
                      <span>{s.lastName} {s.firstName}</span>
                      {s.ci && <span className="text-[11px] text-neutral-500">CI: {s.ci}</span>}
                    </label>
                  ))
                }
              </div>
            </>
          )}
        </div>
      </Modal>

      {/* Modal cambiar relación */}
      <Modal
        open={showChangeRelModal}
        onClose={() => setShowChangeRelModal(false)}
        title="Cambiar tipo de relación"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowChangeRelModal(false)}>Cancelar</Button>
            <Button onClick={handleChangeRel} loading={saving}>Confirmar cambio</Button>
          </>
        }
      >
        <div className="flex flex-col gap-3.5">
          {relError && <p className="text-[13px] text-danger-600 bg-danger-100 rounded-lg px-3 py-2">{relError}</p>}
          <p className="bg-neutral-100 border border-neutral-300 rounded-lg px-3 py-2.5 text-xs text-neutral-500">
            Relación actual: <strong className={
              relTone[currentRelType] === 'brand' ? 'text-brand-700' :
              relTone[currentRelType] === 'success' ? 'text-success-700' :
              relTone[currentRelType] === 'danger' ? 'text-danger-600' : 'text-neutral-700'
            }>{relLabel(currentRelType)}</strong>
          </p>
          <div className="text-xs font-bold text-brand-700 uppercase tracking-wide pb-1 border-b border-neutral-300/60">Nuevo tipo de relación</div>
          <div className="grid grid-cols-4 gap-2">
            {RELATION_TYPES.filter(r => r.value !== currentRelType).map(r => (
              <button
                key={r.value} type="button"
                onClick={() => setChangeRelType(r.value)}
                className={`px-1 py-2 rounded-lg text-xs text-center border transition-colors ${
                  changeRelType === r.value ? 'border-brand-700 bg-brand-700 text-white' : 'border-neutral-300 text-brand-700 hover:border-info-500 hover:bg-neutral-100'
                }`}
              >
                {r.value === 'TUTOR_LEGAL' ? '🔑 ' : ''}{r.label}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2 text-[13px] text-brand-700">
            <input type="checkbox" checked={changeIsTutor} onChange={e => setChangeIsTutor(e.target.checked)} className="accent-brand-700" />
            <span>🔑 Designar como Tutor Legal</span>
          </label>
          {changeRelType === 'TUTOR_LEGAL' && (
            <p className="bg-warning-100 border border-accent-500 rounded-lg px-3 py-2.5 text-xs text-[#7A6000] leading-relaxed">
              ⚠️ Al asignar como <strong>Tutor Legal</strong>:<br />
              • Se le generará acceso al sistema si no tiene<br />
              • Los otros tutores legales serán cambiados a &quot;Otro&quot;
            </p>
          )}
        </div>
      </Modal>

      {/* Modal vincular estudiantes */}
      <Modal
        open={showLinkModal}
        onClose={() => setShowLinkModal(false)}
        title="Vincular Estudiantes"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowLinkModal(false)}>Cancelar</Button>
            <Button onClick={handleLink} loading={saving}><LinkIcon size={14} /> Vincular</Button>
          </>
        }
      >
        <div className="flex flex-col gap-3.5">
          {linkError && <p className="text-[13px] text-danger-600 bg-danger-100 rounded-lg px-3 py-2">{linkError}</p>}
          <Select label="Tipo de relación" required value={linkRelType} onChange={e => setLinkRelType(e.target.value)}>
            {RELATION_TYPES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
          </Select>
          <div>
            <span className="text-[13px] font-semibold text-neutral-700 block mb-1.5">Estudiantes<span className="text-danger-500"> *</span></span>
            <input
              type="text" placeholder="Buscar por nombre, CI o RUDE..."
              value={linkSearch} onChange={e => setLinkSearch(e.target.value)}
              className="w-full h-9 px-3 rounded-lg border border-neutral-300 text-sm outline-none focus:border-brand-600 mb-2"
            />
            <div className="flex flex-col gap-1.5 max-h-[200px] overflow-y-auto border border-neutral-300 rounded-lg p-2">
              {students.filter(s =>
                linkSearch === '' ||
                `${s.firstName} ${s.lastName}`.toLowerCase().includes(linkSearch.toLowerCase()) ||
                (s.ci   && s.ci.includes(linkSearch)) ||
                (s.rude && s.rude.includes(linkSearch))
              ).map(s => (
                <label key={s.id} className={`flex items-center gap-2 p-2 rounded-md cursor-pointer text-[13px] text-brand-700 ${linkStudentIds.includes(s.id) ? 'bg-brand-100' : 'hover:bg-neutral-100'}`}>
                  <input type="checkbox" checked={linkStudentIds.includes(s.id)} onChange={() => toggleLink(s.id)} className="accent-brand-700" />
                  <span>{s.lastName} {s.firstName}</span>
                  {s.ci && <span className="text-[11px] text-neutral-500">CI: {s.ci}</span>}
                </label>
              ))}
            </div>
          </div>
        </div>
      </Modal>

      {/* Modal credenciales */}
      <Modal
        open={showCredentials && !!creds}
        onClose={() => setShowCredentials(false)}
        title="✅ Acceso generado"
        footer={
          <>
            <Button variant="secondary" onClick={copyCreds}>{copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'Copiado' : 'Copiar'}</Button>
            <Button onClick={() => setShowCredentials(false)}>Entendido</Button>
          </>
        }
      >
        {creds && (
          <div className="bg-neutral-100 border border-neutral-300 rounded-xl p-4 flex flex-col gap-2.5">
            {creds.name && (
              <>
                <p className="text-[13px] text-neutral-500">Credenciales para:</p>
                <p className="text-base font-bold text-brand-700">{creds.name}</p>
              </>
            )}
            <div className="flex items-center gap-2.5 bg-white border border-neutral-300 rounded-lg px-3.5 py-2.5">
              <span className="text-[12px] font-semibold text-neutral-500 uppercase tracking-wide min-w-[80px]">Email:</span>
              <span className="text-sm font-semibold text-brand-700 font-mono">{creds.accessEmail}</span>
            </div>
            <div className="flex items-center gap-2.5 bg-white border border-neutral-300 rounded-lg px-3.5 py-2.5">
              <span className="text-[12px] font-semibold text-neutral-500 uppercase tracking-wide min-w-[80px]">Contraseña:</span>
              <span className="text-sm font-semibold text-brand-700 font-mono">{creds.defaultPassword}</span>
            </div>
            <p className="text-[12px] text-[#8A6116] bg-warning-100 rounded-lg px-3 py-2.5">⚠️ Anota estas credenciales. No se podrán ver de nuevo.</p>
          </div>
        )}
      </Modal>

      {/* Modal importar Excel padres */}
      <Modal
        open={showImportModal}
        onClose={() => setShowImportModal(false)}
        title="📥 Importar Padres desde Excel"
        maxWidth={620}
        footer={<Button onClick={() => setShowImportModal(false)}>Cerrar</Button>}
      >
        {!importResult ? (
          <div className="flex flex-col gap-3.5">
            <p className="bg-neutral-100 border border-neutral-300 rounded-lg px-3 py-2.5 text-xs text-neutral-500 leading-relaxed">
              El archivo Excel debe tener estas columnas:<br />
              <strong>NROKARDEX · NOMBREPADRE · APELLIDOPADRE · NROCIPADRE · TELEFONOPADRE · NOMBRESMADRE · APELLIDOSMADRE · NROCIMADRE · TELEFONOMADRE</strong>
            </p>
            <label className="flex flex-col gap-1.5">
              <span className="text-[13px] font-semibold text-neutral-700">Seleccionar archivo Excel<span className="text-danger-500"> *</span></span>
              <input
                type="file" accept=".xlsx,.xls"
                onChange={e => { const file = e.target.files?.[0]; if (file) handleImportParents(file) }}
                className="text-sm file:mr-3 file:py-2 file:px-3.5 file:rounded-lg file:border-0 file:bg-brand-700 file:text-white file:text-sm file:font-semibold file:cursor-pointer hover:file:bg-brand-600"
              />
            </label>
            {importing && <p className="text-center text-sm text-neutral-500 py-4">Importando padres... esto puede tomar varios minutos</p>}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-[13px] text-success-700 bg-success-100 rounded-lg px-3 py-2.5">{importResult.message}</p>
            {importResult.created?.length > 0 && (
              <div>
                <div className="text-xs font-bold text-brand-700 uppercase tracking-wide pb-1 border-b border-neutral-300/60">✅ Creados ({importResult.created.length})</div>
                <div className="max-h-[200px] overflow-y-auto mt-2">
                  {importResult.created.map((p: any, i: number) => (
                    <div key={i} className="py-1.5 border-b border-neutral-100 text-xs"><strong>{p.name}</strong> ({p.type}) — {p.email} / {p.password}</div>
                  ))}
                </div>
              </div>
            )}
            {importResult.skipped?.length > 0 && (
              <div>
                <div className="text-xs font-bold text-brand-700 uppercase tracking-wide pb-1 border-b border-neutral-300/60">⚠️ Omitidos ({importResult.skipped.length})</div>
                {importResult.skipped.map((s: any, i: number) => (
                  <div key={i} className="text-xs text-[#7A6000] py-1">Kardex {s.kardex} — {s.reason}</div>
                ))}
              </div>
            )}
            {importResult.errors?.length > 0 && (
              <div>
                <div className="text-xs font-bold text-brand-700 uppercase tracking-wide pb-1 border-b border-neutral-300/60">❌ Errores ({importResult.errors.length})</div>
                {importResult.errors.map((e: any, i: number) => (
                  <div key={i} className="text-xs text-danger-600 py-1">Kardex {e.kardex} — {e.reason}</div>
                ))}
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}
