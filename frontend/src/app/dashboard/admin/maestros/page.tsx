'use client'

import { useEffect, useState } from 'react'
import { Plus, Search, X, Edit, Eye, UserCheck, UserX, Trash2, Copy, Check, BookOpen, Clock } from 'lucide-react'
import { useRouter } from 'next/navigation'
import Button from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Input'
import Badge from '@/components/ui/Badge'
import Modal from '@/components/ui/Modal'
import Table, { Column } from '@/components/ui/Table'
import { useToast } from '@/components/ui/ToastProvider'
import { useConfirm } from '@/components/ui/ConfirmProvider'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

interface Specialty {
  id: number
  subject: { id: number; name: string; campo?: string }
}

interface Teacher {
  id:         number
  firstName:  string
  lastName:   string
  ci?:        string
  phone?:     string
  email?:     string
  specialty?: string
  birthDate?: string
  hoursLoad?: number
  gender?:    string
  isActive:   boolean
  user?:      { id: number; email: string; role: string; isActive: boolean }
  _count:     { assignments: number }
  specialties?: Specialty[]
}

interface Subject {
  id: number; name: string; campo?: string; level: string
}

interface Credentials {
  accessEmail: string; defaultPassword: string; hint: string; name: string
}

const emptyForm = {
  firstName: '', lastName: '', ci: '', phone: '', email: '', specialty: '',
  birthDate: '', hoursLoad: '', gender: '',
  subjectIds: [] as number[],
}

const CAMPOS = [
  { value: 'VIDA_TIERRA_TERRITORIO',        label: '🌿 Vida, Tierra y Territorio' },
  { value: 'COMUNIDAD_SOCIEDAD',            label: '🌐 Comunidad y Sociedad' },
  { value: 'COSMOS_PENSAMIENTO',            label: '✨ Cosmos y Pensamiento' },
  { value: 'CIENCIA_TECNOLOGIA_PRODUCCION', label: '⚙️ Ciencia, Tecnología y Producción' },
]

const CAMPO_LABELS: Record<string, string> = {
  VIDA_TIERRA_TERRITORIO:        'Vida Tierra y Territorio',
  COMUNIDAD_SOCIEDAD:            'Comunidad y Sociedad',
  COSMOS_PENSAMIENTO:            'Cosmos y Pensamiento',
  CIENCIA_TECNOLOGIA_PRODUCCION: 'Ciencia Tecnología y Producción',
}

const CAMPO_BADGE_TONE: Record<string, 'success' | 'info' | 'warning' | 'neutral'> = {
  VIDA_TIERRA_TERRITORIO:        'success',
  COMUNIDAD_SOCIEDAD:            'info',
  COSMOS_PENSAMIENTO:            'warning',
  CIENCIA_TECNOLOGIA_PRODUCCION: 'neutral',
}

export default function MaestrosPage() {
  const router = useRouter()
  const toast = useToast()
  const confirm = useConfirm()

  const [teachers,     setTeachers]     = useState<Teacher[]>([])
  const [loading,      setLoading]      = useState(true)
  const [search,       setSearch]       = useState('')
  const [filterActive, setFilterActive] = useState('')
  const [showModal,       setShowModal]       = useState(false)
  const [showCredentials, setShowCredentials] = useState(false)
  const [editMode,     setEditMode]     = useState(false)
  const [editId,       setEditId]       = useState<number | null>(null)
  const [saving,       setSaving]       = useState(false)
  const [loadingEdit,  setLoadingEdit]  = useState(false)
  const [formError,    setFormError]    = useState('')
  const [form,         setForm]         = useState(emptyForm)
  const [creds,        setCreds]        = useState<Credentials | null>(null)
  const [copied,       setCopied]       = useState(false)
  const [subjectsByCampo, setSubjectsByCampo] = useState<Record<string, Subject[]>>({})

  const [showSpecialties,    setShowSpecialties]    = useState(false)
  const [specTeacher,        setSpecTeacher]        = useState<Teacher | null>(null)
  const [specialties,        setSpecialties]        = useState<Specialty[]>([])
  const [selectedSubjectId,  setSelectedSubjectId]  = useState('')
  const [specSearch,         setSpecSearch]         = useState('')
  const [addingSpec,         setAddingSpec]         = useState(false)
  const [loadingSpec,        setLoadingSpec]        = useState(false)
  const [allSubjectsForSpec, setAllSubjectsForSpec] = useState<Subject[]>([])

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : ''

  const fetchTeachers = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (search)       params.set('search',   search)
      if (filterActive) params.set('isActive', filterActive)
      const res  = await fetch(`${API_URL}/api/teachers?${params}`, { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      if (res.ok) setTeachers(data)
      else toast('Error al cargar maestros', 'error')
    } catch { toast('Error de conexión', 'error') }
    finally  { setLoading(false) }
  }

  const fetchSpecialties = async (teacherId: number) => {
    setLoadingSpec(true)
    try {
      const res  = await fetch(`${API_URL}/api/teachers/${teacherId}/specialties`, { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      if (res.ok) setSpecialties(data)
    } catch { toast('Error al cargar especialidades', 'error') }
    finally  { setLoadingSpec(false) }
  }

  useEffect(() => { fetchTeachers() }, [])

  const loadAllSubjects = async () => {
    try {
      const res  = await fetch(`${API_URL}/api/subjects?level=SECUNDARIA`, { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      if (res.ok && Array.isArray(data)) {
        const grouped: Record<string, Subject[]> = {}
        for (const s of data) {
          const c = s.campo || 'SIN_CAMPO'
          if (!grouped[c]) grouped[c] = []
          grouped[c].push(s)
        }
        setSubjectsByCampo(grouped)
      }
    } catch (e) { console.error('Error cargando materias', e) }
  }

  const loadSubjectsForSpec = async () => {
    try {
      const res  = await fetch(`${API_URL}/api/subjects`, { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      if (res.ok) setAllSubjectsForSpec(Array.isArray(data) ? data : [])
    } catch { console.error('Error al cargar materias') }
  }

  const toggleSubject = (subjectId: number) => {
    setForm(prev => ({
      ...prev,
      subjectIds: prev.subjectIds.includes(subjectId)
        ? prev.subjectIds.filter(id => id !== subjectId)
        : [...prev.subjectIds, subjectId]
    }))
  }

  const openSpecialties = async (teacher: Teacher) => {
    setSpecTeacher(teacher); setSelectedSubjectId(''); setSpecSearch(''); setShowSpecialties(true)
    await Promise.all([fetchSpecialties(teacher.id), loadSubjectsForSpec()])
  }

  const handleAddSpecialty = async () => {
    if (!selectedSubjectId || !specTeacher) return
    setAddingSpec(true)
    try {
      const res  = await fetch(`${API_URL}/api/teachers/${specTeacher.id}/specialties`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ subjectId: parseInt(selectedSubjectId) }),
      })
      const data = await res.json()
      if (res.ok) { setSelectedSubjectId(''); await fetchSpecialties(specTeacher.id); fetchTeachers() }
      else toast(data.message, 'error')
    } catch { toast('Error de conexión', 'error') }
    finally  { setAddingSpec(false) }
  }

  const handleRemoveSpecialty = async (specialtyId: number) => {
    if (!specTeacher) return
    try {
      const res  = await fetch(`${API_URL}/api/teachers/${specTeacher.id}/specialties/${specialtyId}`,
        { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      if (res.ok) { await fetchSpecialties(specTeacher.id); fetchTeachers() }
      else toast(data.message, 'error')
    } catch { toast('Error al quitar especialidad', 'error') }
  }

  const openCreate = () => {
    setEditMode(false); setEditId(null); setForm(emptyForm); setFormError('')
    loadAllSubjects(); setShowModal(true)
  }

  const openEdit = async (t: Teacher) => {
    setEditMode(true); setEditId(t.id); setFormError(''); setLoadingEdit(true)
    loadAllSubjects(); setShowModal(true)
    try {
      const res   = await fetch(`${API_URL}/api/teachers/${t.id}/specialties`, { headers: { Authorization: `Bearer ${token}` } })
      const specs: Specialty[] = await res.json()
      setForm({
        firstName: t.firstName, lastName: t.lastName, ci: t.ci || '', phone: t.phone || '',
        email: t.email || '', specialty: t.specialty || '',
        birthDate: t.birthDate ? t.birthDate.substring(0, 10) : '',
        hoursLoad: t.hoursLoad ? String(t.hoursLoad) : '', gender: t.gender || '',
        subjectIds: specs.map(s => s.subject.id),
      })
    } catch {
      setForm({
        firstName: t.firstName, lastName: t.lastName, ci: t.ci || '', phone: t.phone || '',
        email: t.email || '', specialty: t.specialty || '',
        birthDate: t.birthDate ? t.birthDate.substring(0, 10) : '',
        hoursLoad: t.hoursLoad ? String(t.hoursLoad) : '', gender: t.gender || '', subjectIds: [],
      })
    } finally { setLoadingEdit(false) }
  }

  const handleSave = async () => {
    setFormError(''); setSaving(true)
    try {
      const url    = editMode ? `${API_URL}/api/teachers/${editId}` : `${API_URL}/api/teachers`
      const method = editMode ? 'PUT' : 'POST'
      const res    = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          firstName: form.firstName, lastName: form.lastName, ci: form.ci,
          phone: form.phone, email: form.email, specialty: form.specialty,
          birthDate: form.birthDate || null, hoursLoad: form.hoursLoad || null, gender: form.gender || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setFormError(data.message); return }

      const teacherIdToUse = editMode ? editId! : data.teacher?.id
      if (teacherIdToUse) {
        if (editMode) {
          const currentSpecs: Specialty[] = await fetch(
            `${API_URL}/api/teachers/${teacherIdToUse}/specialties`, { headers: { Authorization: `Bearer ${token}` } }
          ).then(r => r.json())
          await Promise.all(currentSpecs.filter(s => !form.subjectIds.includes(s.subject.id)).map(s =>
            fetch(`${API_URL}/api/teachers/${teacherIdToUse}/specialties/${s.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
          ))
          const currentIds = currentSpecs.map(s => s.subject.id)
          await Promise.all(form.subjectIds.filter(id => !currentIds.includes(id)).map(subjectId =>
            fetch(`${API_URL}/api/teachers/${teacherIdToUse}/specialties`, {
              method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
              body: JSON.stringify({ subjectId }),
            })
          ))
        } else if (form.subjectIds.length > 0) {
          await Promise.all(form.subjectIds.map(subjectId =>
            fetch(`${API_URL}/api/teachers/${teacherIdToUse}/specialties`, {
              method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
              body: JSON.stringify({ subjectId }),
            })
          ))
        }
      }

      setShowModal(false); fetchTeachers()
      if (!editMode && data.accessEmail) {
        setCreds({ accessEmail: data.accessEmail, defaultPassword: data.defaultPassword, hint: data.passwordHint, name: `${form.firstName} ${form.lastName}` })
        setShowCredentials(true)
      } else {
        toast(editMode ? 'Maestro actualizado correctamente' : 'Maestro registrado correctamente', 'success')
      }
    } catch { setFormError('Error de conexión') }
    finally  { setSaving(false) }
  }

  const handleToggle = async (id: number) => {
    try {
      const res  = await fetch(`${API_URL}/api/teachers/${id}/toggle`, { method: 'PATCH', headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      if (res.ok) { toast(data.message, 'success'); fetchTeachers() }
      else toast(data.message, 'error')
    } catch { toast('Error al cambiar estado', 'error') }
  }

  const handleDelete = async (id: number, name: string) => {
    const ok = await confirm(`¿Eliminar al maestro ${name}?`, { danger: true, confirmLabel: 'Eliminar' })
    if (!ok) return
    try {
      const res  = await fetch(`${API_URL}/api/teachers/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      if (res.ok) { toast(data.message, 'success'); fetchTeachers() }
      else toast(data.message, 'error')
    } catch { toast('Error al eliminar', 'error') }
  }

  const copyCreds = () => {
    if (!creds) return
    navigator.clipboard.writeText(`Maestro: ${creds.name}\nEmail: ${creds.accessEmail}\nContraseña: ${creds.defaultPassword}`)
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }

  const calcAge = (birthDate?: string) => {
    if (!birthDate) return null
    return Math.floor((Date.now() - new Date(birthDate).getTime()) / (1000 * 60 * 60 * 24 * 365.25))
  }

  const availableSubjects = allSubjectsForSpec.filter(s =>
    !specialties.some(sp => sp.subject.id === s.id) &&
    (specSearch === '' || s.name.toLowerCase().includes(specSearch.toLowerCase()))
  )

  const specialtiesByCampo = specialties.reduce((acc: Record<string, Specialty[]>, sp) => {
    const campo = sp.subject.campo || 'SIN_CAMPO'
    if (!acc[campo]) acc[campo] = []
    acc[campo].push(sp)
    return acc
  }, {})

  const columns: Column<Teacher>[] = [
    { key: 'idx', header: '#', render: (t) => <span className="text-neutral-500">{teachers.indexOf(t) + 1}</span> },
    {
      key: 'name', header: 'Nombre completo', render: (t) => (
        <div>
          <div className="font-medium text-brand-700">{t.lastName} {t.firstName}</div>
          {t.user && <div className="text-[11px] text-neutral-500 mt-0.5">{t.user.email}</div>}
          {t.specialty && <div className="text-[11px] text-[#633806] italic mt-0.5">{t.specialty}</div>}
        </div>
      ),
    },
    { key: 'ci', header: 'CI', render: (t) => <span className="text-neutral-500 text-xs">{t.ci || '—'}</span> },
    { key: 'age', header: 'Edad', render: (t) => <span className="text-neutral-500 text-xs">{calcAge(t.birthDate) ? `${calcAge(t.birthDate)} años` : '—'}</span> },
    {
      key: 'gender', header: 'Género', render: (t) => t.gender
        ? <Badge tone={t.gender === 'MASCULINO' ? 'info' : 'danger'}>{t.gender === 'MASCULINO' ? '♂ Masculino' : '♀ Femenino'}</Badge>
        : <span className="text-neutral-500 text-xs">—</span>,
    },
    { key: 'hours', header: 'Carga hrs/mes', render: (t) => t.hoursLoad ? <Badge tone="warning">{t.hoursLoad} hrs</Badge> : <span className="text-neutral-500 text-xs">—</span> },
    {
      key: 'subjects', header: 'Materias asignadas', render: (t) => {
        const specs = t.specialties || []
        if (specs.length === 0) {
          return (
            <button onClick={() => openSpecialties(t)} className="inline-flex items-center gap-1 bg-neutral-100 text-neutral-500 border border-dashed border-neutral-300 px-2.5 py-1 rounded-full text-[11px] hover:bg-info-500/10 hover:text-brand-700 hover:border-info-500">
              <Plus size={10} /> Asignar
            </button>
          )
        }
        return (
          <div className="flex flex-wrap gap-1 items-center">
            {specs.slice(0, 2).map(sp => (
              <Badge key={sp.id} tone={CAMPO_BADGE_TONE[sp.subject.campo || ''] || 'neutral'}>{sp.subject.name}</Badge>
            ))}
            {specs.length > 2 && (
              <button onClick={() => openSpecialties(t)} className="bg-neutral-100 text-brand-700 border border-neutral-300 px-2 py-0.5 rounded-full text-[11px] hover:bg-info-500/10">
                +{specs.length - 2} más
              </button>
            )}
            <button onClick={() => openSpecialties(t)} className="text-neutral-500 hover:text-brand-700"><Edit size={10} /></button>
          </div>
        )
      },
    },
    { key: 'status', header: 'Estado', render: (t) => <Badge tone={t.isActive ? 'success' : 'danger'}>{t.isActive ? 'Activo' : 'Inactivo'}</Badge> },
    {
      key: 'actions', header: 'Acciones', render: (t) => (
        <div className="flex gap-1.5">
          <button title="Ver detalle" onClick={() => router.push(`/dashboard/admin/maestros/${t.id}`)} className="w-7 h-7 rounded-md bg-info-500/15 text-info-500 flex items-center justify-center hover:opacity-75">
            <Eye size={13} />
          </button>
          <button title="Editar" onClick={() => openEdit(t)} className="w-7 h-7 rounded-md bg-accent-500/15 text-accent-600 flex items-center justify-center hover:opacity-75">
            <Edit size={13} />
          </button>
          <button title="Gestionar materias" onClick={() => openSpecialties(t)} className="w-7 h-7 rounded-md bg-brand-100 text-brand-700 flex items-center justify-center hover:opacity-75">
            <BookOpen size={13} />
          </button>
          <button title={t.isActive ? 'Desactivar' : 'Activar'} onClick={() => handleToggle(t.id)}
            className={`w-7 h-7 rounded-md flex items-center justify-center hover:opacity-75 ${t.isActive ? 'bg-danger-100 text-danger-600' : 'bg-success-100 text-success-700'}`}>
            {t.isActive ? <UserX size={13} /> : <UserCheck size={13} />}
          </button>
          <button title="Eliminar" onClick={() => handleDelete(t.id, `${t.firstName} ${t.lastName}`)} className="w-7 h-7 rounded-md bg-danger-100 text-danger-600 flex items-center justify-center hover:opacity-75">
            <Trash2 size={13} />
          </button>
          <button title="Ver carga horaria" onClick={() => router.push(`/dashboard/admin/maestros/${t.id}/workload`)} className="w-7 h-7 rounded-md bg-success-100 text-success-700 flex items-center justify-center hover:opacity-75">
            <Clock size={13} />
          </button>
        </div>
      ),
    },
  ]

  return (
    <div>
      <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-brand-700 mb-1">Gestión de Maestros</h1>
          <p className="text-[13px] text-neutral-500">Registro y administración del personal docente</p>
        </div>
        <Button onClick={openCreate}><Plus size={16} /> Nuevo maestro</Button>
      </div>

      <div className="flex gap-2.5 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-info-500 pointer-events-none" />
          <input
            placeholder="Buscar por nombre, CI o especialidad..." value={search}
            onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && fetchTeachers()}
            className="w-full h-10 pl-9 pr-3 rounded-lg border border-neutral-300 text-sm outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/15"
          />
        </div>
        <Select value={filterActive} onChange={e => setFilterActive(e.target.value)} className="w-auto min-w-[120px]">
          <option value="">Todos</option>
          <option value="true">Activos</option>
          <option value="false">Inactivos</option>
        </Select>
        <Button variant="secondary" onClick={fetchTeachers}>Buscar</Button>
      </div>

      <Table columns={columns} rows={teachers} rowKey={(t) => t.id} loading={loading} emptyLabel="No se encontraron maestros" />

      <div className="px-3.5 py-2.5 flex gap-4 text-xs text-neutral-500">
        <span>Total: <strong>{teachers.length}</strong> maestros</span>
        <span>Masculino: <strong>{teachers.filter(t => t.gender === 'MASCULINO').length}</strong></span>
        <span>Femenino: <strong>{teachers.filter(t => t.gender === 'FEMENINO').length}</strong></span>
      </div>

      {/* ── Modal crear/editar ── */}
      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title={editMode ? 'Editar Maestro' : 'Nuevo Maestro'}
        maxWidth={620}
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowModal(false)}>Cancelar</Button>
            <Button onClick={handleSave} loading={saving} disabled={loadingEdit}>{editMode ? 'Actualizar' : 'Registrar maestro'}</Button>
          </>
        }
      >
        {formError && <p className="text-[13px] text-danger-600 bg-danger-100 rounded-lg px-3 py-2 mb-3.5">{formError}</p>}
        {loadingEdit ? (
          <p className="text-sm text-neutral-500 text-center py-8">Cargando datos...</p>
        ) : (
          <div className="flex flex-col gap-3.5">
            {!editMode && (
              <p className="bg-neutral-100 border border-neutral-300 rounded-lg px-3 py-2.5 text-xs text-neutral-500 leading-relaxed">
                🔑 El sistema generará automáticamente un email y contraseña de acceso.
              </p>
            )}
            <div className="text-xs font-bold text-brand-700 uppercase tracking-wide pb-1 border-b border-neutral-300/60">Datos personales</div>
            <div className="grid grid-cols-2 gap-3">
              <Input label="Nombres" required placeholder="Ej: Juan Carlos" value={form.firstName} onChange={e => setForm({ ...form, firstName: e.target.value })} />
              <Input label="Apellidos" required placeholder="Ej: García López" value={form.lastName} onChange={e => setForm({ ...form, lastName: e.target.value })} />
              <Input label="CI" placeholder="Ej: 12345678" value={form.ci} onChange={e => setForm({ ...form, ci: e.target.value })} />
              <Input label="Teléfono" placeholder="Ej: 70012345" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
              <Input label="Correo electrónico" type="email" placeholder="Ej: maestro@gmail.com (opcional)" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
              <Input label="Especialidad (título)" placeholder="Ej: Lic. en Matemáticas..." value={form.specialty} onChange={e => setForm({ ...form, specialty: e.target.value })} />
              <Input label="Fecha de nacimiento" type="date" value={form.birthDate} onChange={e => setForm({ ...form, birthDate: e.target.value })} />
              <Input label="Carga horaria (hrs/mes)" type="number" min={1} max={320} placeholder="Ej: 128" value={form.hoursLoad} onChange={e => setForm({ ...form, hoursLoad: e.target.value })} />
              <Select label="Género" value={form.gender} onChange={e => setForm({ ...form, gender: e.target.value })}>
                <option value="">— Seleccionar —</option>
                <option value="MASCULINO">Masculino</option>
                <option value="FEMENINO">Femenino</option>
              </Select>
            </div>
            <div className="text-xs font-bold text-brand-700 uppercase tracking-wide pb-1 border-b border-neutral-300/60">Campos de Saberes y Materias</div>
            {CAMPOS.map(campo => {
              const materias = subjectsByCampo[campo.value] || []
              const selCount = materias.filter(s => form.subjectIds.includes(s.id)).length
              return (
                <div key={campo.value} className="border border-neutral-300 rounded-[10px] overflow-hidden">
                  <div className="bg-neutral-100 px-3.5 py-2.5 font-bold text-[12px] text-brand-700 flex items-center justify-between">
                    <span>{campo.label}</span>
                    {selCount > 0 && <Badge tone="brand">{selCount} seleccionada{selCount > 1 ? 's' : ''}</Badge>}
                  </div>
                  <div className="flex flex-wrap gap-2 px-3.5 py-2.5">
                    {materias.map(s => (
                      <label
                        key={s.id}
                        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs cursor-pointer select-none border transition-colors ${
                          form.subjectIds.includes(s.id) ? 'border-brand-700 bg-brand-100 font-medium' : 'border-neutral-300 hover:border-info-500 hover:bg-neutral-100'
                        }`}
                      >
                        <input type="checkbox" checked={form.subjectIds.includes(s.id)} onChange={() => toggleSubject(s.id)} className="accent-brand-700 w-3.5 h-3.5 shrink-0" />
                        <span>{s.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Modal>

      {/* ── Modal especialidades ── */}
      <Modal
        open={showSpecialties && !!specTeacher}
        onClose={() => setShowSpecialties(false)}
        title="Materias que puede enseñar"
        maxWidth={460}
        footer={
          <div className="flex items-center justify-between w-full">
            <span className="text-xs text-neutral-500">{specialties.length} materia{specialties.length !== 1 ? 's' : ''} asignada{specialties.length !== 1 ? 's' : ''}</span>
            <Button onClick={() => setShowSpecialties(false)}>Listo</Button>
          </div>
        }
      >
        {specTeacher && (
          <div className="flex flex-col gap-3.5">
            <p className="text-xs text-neutral-500 -mt-2">{specTeacher.lastName} {specTeacher.firstName}</p>
            <div>
              <span className="text-[13px] font-semibold text-neutral-700 block mb-1.5">Agregar materia</span>
              <div className="relative mb-2">
                <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-info-500 pointer-events-none" />
                <input
                  type="text" placeholder="Buscar materia..." value={specSearch}
                  onChange={e => { setSpecSearch(e.target.value); setSelectedSubjectId('') }}
                  className="w-full h-9 pl-8 pr-3 rounded-lg border border-neutral-300 text-sm outline-none focus:border-brand-600"
                />
              </div>
              <div className="border border-neutral-300 rounded-lg max-h-[150px] overflow-y-auto mb-2.5">
                {availableSubjects.length === 0 ? (
                  <p className="p-3 text-center text-xs text-neutral-500 italic">{specSearch ? 'No se encontraron materias' : 'Todas las materias ya están asignadas'}</p>
                ) : availableSubjects.map(s => {
                  const sel = selectedSubjectId === String(s.id)
                  return (
                    <label key={s.id} className={`flex items-center gap-2 px-2.5 py-1.5 cursor-pointer border-b border-neutral-100 last:border-b-0 hover:bg-neutral-100 ${sel ? 'bg-brand-100 border-l-2 border-l-brand-700' : ''}`}>
                      <input type="radio" name="spec-subj" value={s.id} checked={sel} onChange={() => setSelectedSubjectId(String(s.id))} className="accent-brand-700 w-3.5 h-3.5 shrink-0" />
                      <div className="flex flex-col">
                        <span className="text-xs font-medium text-brand-700">{s.name}</span>
                        {s.campo && <span className="text-[10px] text-neutral-500">{CAMPO_LABELS[s.campo] || s.campo}</span>}
                      </div>
                    </label>
                  )
                })}
              </div>
              <Button className="w-full justify-center" onClick={handleAddSpecialty} loading={addingSpec} disabled={!selectedSubjectId}>
                <Plus size={14} /> Agregar materia seleccionada
              </Button>
            </div>
            {loadingSpec ? (
              <p className="text-center text-sm text-neutral-500 py-4">Cargando...</p>
            ) : specialties.length === 0 ? (
              <div className="text-center py-5 flex flex-col items-center gap-2 text-neutral-500">
                <BookOpen size={28} className="opacity-30" />
                <p className="text-sm">Sin materias asignadas aún.</p>
              </div>
            ) : (
              <div>
                <span className="text-[13px] font-semibold text-neutral-700 block mb-1.5">Materias asignadas ({specialties.length})</span>
                <div className="flex flex-col gap-1.5">
                  {Object.entries(specialtiesByCampo).map(([campo, items]) => (
                    <div key={campo} className="border border-neutral-300/60 rounded-lg overflow-hidden">
                      <div className={`px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide ${
                        CAMPO_BADGE_TONE[campo] === 'success' ? 'bg-success-100 text-success-700' :
                        CAMPO_BADGE_TONE[campo] === 'info' ? 'bg-info-500/15 text-info-500' :
                        CAMPO_BADGE_TONE[campo] === 'warning' ? 'bg-warning-100 text-[#8A6116]' : 'bg-neutral-100 text-neutral-700'
                      }`}>
                        {CAMPO_LABELS[campo] || campo}
                      </div>
                      {items.map(sp => (
                        <div key={sp.id} className="flex items-center justify-between px-3 py-2 border-t border-neutral-100 hover:bg-neutral-100/60">
                          <span className="text-xs font-medium text-brand-700">{sp.subject.name}</span>
                          <button onClick={() => handleRemoveSpecialty(sp.id)} className="w-5.5 h-5.5 rounded-md bg-danger-100 text-danger-600 flex items-center justify-center hover:opacity-75">
                            <X size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* ── Modal credenciales ── */}
      <Modal
        open={showCredentials && !!creds}
        onClose={() => setShowCredentials(false)}
        title="✅ Maestro registrado"
        footer={
          <>
            <Button variant="secondary" onClick={copyCreds}>{copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'Copiado' : 'Copiar credenciales'}</Button>
            <Button onClick={() => setShowCredentials(false)}>Entendido</Button>
          </>
        }
      >
        {creds && (
          <div className="bg-neutral-100 border border-neutral-300 rounded-xl p-4 flex flex-col gap-2.5">
            <p className="text-[13px] text-neutral-500">Credenciales de acceso para:</p>
            <p className="text-base font-bold text-brand-700">{creds.name}</p>
            <div className="flex items-center gap-2.5 bg-white border border-neutral-300 rounded-lg px-3.5 py-2.5">
              <span className="text-[12px] font-semibold text-neutral-500 uppercase tracking-wide min-w-[80px]">Email:</span>
              <span className="text-sm font-semibold text-brand-700 font-mono">{creds.accessEmail}</span>
            </div>
            <div className="flex items-center gap-2.5 bg-white border border-neutral-300 rounded-lg px-3.5 py-2.5">
              <span className="text-[12px] font-semibold text-neutral-500 uppercase tracking-wide min-w-[80px]">Contraseña:</span>
              <span className="text-sm font-semibold text-brand-700 font-mono">{creds.defaultPassword}</span>
            </div>
            <p className="text-[12px] text-success-700 bg-success-100 rounded-lg px-3 py-2.5">💡 {creds.hint}</p>
            <p className="text-[12px] text-[#8A6116] bg-warning-100 rounded-lg px-3 py-2.5">⚠️ Anota estas credenciales. La contraseña no se podrá ver de nuevo.</p>
          </div>
        )}
      </Modal>
    </div>
  )
}
