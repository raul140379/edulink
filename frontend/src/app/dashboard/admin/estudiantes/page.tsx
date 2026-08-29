'use client'

import { useEffect, useState } from 'react'
import { Plus, Search, Edit, Eye, UserCheck, UserX, BookOpen, Copy, Check, Trash2, KeyRound, Upload } from 'lucide-react'
import { useRouter } from 'next/navigation'
import Button from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Input'
import Badge from '@/components/ui/Badge'
import Modal from '@/components/ui/Modal'
import Table, { Column } from '@/components/ui/Table'
import Pagination from '@/components/ui/Pagination'
import { useToast } from '@/components/ui/ToastProvider'
import { useConfirm } from '@/components/ui/ConfirmProvider'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'
const PAGE_SIZE = 30

interface Student {
  id:        number
  firstName: string
  lastName:  string
  gender:    string
  ci?:       string
  rude?:     string
  birthDate?: string
  phone?:    string
  email?:    string
  address?:  string
  isActive:  boolean
  user?:     { id: number; email: string; role: string }
  parents:   { relationType: string; parent: { firstName: string; lastName: string; phone?: string } }[]
  assignments: {
    year: number
    educationType: string
    course: { level: string; grade: string; parallel: string; shift: string }
    academicYear: { isActive: boolean }
  }[]
}

interface Course {
  id: number; level: string; grade: string; parallel: string; shift: string; educationType: string
}

interface CreatedCredentials {
  accessEmail:     string
  defaultPassword: string
  studentName:     string
}

const GRADE_LABELS: Record<string, string> = { PRIMERO: '1°', SEGUNDO: '2°', TERCERO: '3°', CUARTO: '4°', QUINTO: '5°', SEXTO: '6°' }
const SHIFT_LABELS: Record<string, string> = { MORNING: 'Mañana', AFTERNOON: 'Tarde', NIGHT: 'Noche' }
const LEVEL_LABELS: Record<string, string> = { INICIAL: 'Inicial', PRIMARIA: 'Primaria', SECUNDARIA: 'Secundaria' }

const emptyForm = { firstName: '', lastName: '', ci: '', rude: '', birthDate: '', phone: '', email: '', address: '', gender: '' }

const getToken = () => localStorage.getItem('token') || ''

export default function EstudiantesPage() {
  const router = useRouter()
  const toast = useToast()
  const confirm = useConfirm()
  const [students,     setStudents]     = useState<Student[]>([])
  const [courses,      setCourses]      = useState<Course[]>([])
  const [loading,      setLoading]      = useState(true)
  const [search,       setSearch]       = useState('')
  const [filterActive, setFilterActive] = useState('')
  const [filterGender, setFilterGender] = useState('')
  const [filterCourse, setFilterCourse] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [showModal,        setShowModal]        = useState(false)
  const [showEnrollModal,  setShowEnrollModal]  = useState(false)
  const [showCredentials,  setShowCredentials]  = useState(false)
  const [editMode,     setEditMode]     = useState(false)
  const [editId,       setEditId]       = useState<number | null>(null)
  const [enrollId,     setEnrollId]     = useState<number | null>(null)
  const [saving,       setSaving]       = useState(false)
  const [formError,    setFormError]    = useState('')
  const [enrollError,  setEnrollError]  = useState('')
  const [form,         setForm]         = useState(emptyForm)
  const [enrollCourseId, setEnrollCourseId] = useState('')
  const [credentials,  setCredentials]  = useState<CreatedCredentials | null>(null)
  const [copied,       setCopied]       = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [importing,       setImporting]       = useState(false)
  const [importResult,    setImportResult]    = useState<any>(null)
  const [importType, setImportType] = useState<'students' | 'tutors'>('students')

  const fetchStudents = async (targetPage = page) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(targetPage), pageSize: String(PAGE_SIZE) })
      if (search)       params.set('search', search)
      if (filterActive) params.set('isActive', filterActive)
      if (filterGender) params.set('gender', filterGender)
      if (filterCourse) params.set('courseId', filterCourse)
      const res  = await fetch(`${API_URL}/api/students?${params}`, { headers: { Authorization: `Bearer ${getToken()}` } })
      const data = await res.json()
      if (res.ok) { setStudents(data.data); setTotal(data.total); setPage(targetPage) }
      else toast('Error al cargar estudiantes', 'error')
    } catch { toast('Error de conexión', 'error') }
    finally  { setLoading(false) }
  }

  const handleFilterChange = () => fetchStudents(1)

  const fetchCourses = async () => {
    try {
      const res  = await fetch(`${API_URL}/api/courses`, { headers: { Authorization: `Bearer ${getToken()}` } })
      const data = await res.json()
      if (res.ok) setCourses(data)
    } catch { console.error('Error cargando cursos') }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchStudents(1); fetchCourses() }, [])

  const openCreate = () => { setEditMode(false); setEditId(null); setForm(emptyForm); setFormError(''); setShowModal(true) }

  const openEdit = (s: Student) => {
    setEditMode(true); setEditId(s.id)
    setForm({
      firstName: s.firstName, lastName: s.lastName,
      ci: s.ci || '', rude: s.rude || '',
      birthDate: s.birthDate ? s.birthDate.split('T')[0] : '',
      phone: s.phone || '', email: s.email || '', address: s.address || '', gender: s.gender || '',
    })
    setFormError(''); setShowModal(true)
  }

  const openEnroll = (id: number) => { setEnrollId(id); setEnrollCourseId(''); setEnrollError(''); setShowEnrollModal(true) }

  const handleSave = async () => {
    setFormError(''); setSaving(true)
    if (!form.gender) { setFormError('El género es requerido'); setSaving(false); return }
    try {
      const url    = editMode ? `${API_URL}/api/students/${editId}` : `${API_URL}/api/students`
      const method = editMode ? 'PUT' : 'POST'
      const res    = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) { setFormError(data.message); return }
      setShowModal(false)
      fetchStudents()
      if (!editMode && data.accessEmail) {
        setCredentials({ accessEmail: data.accessEmail, defaultPassword: data.defaultPassword, studentName: `${form.firstName} ${form.lastName}` })
        setShowCredentials(true)
      } else {
        toast('Estudiante actualizado correctamente', 'success')
      }
    } catch { setFormError('Error de conexión') }
    finally  { setSaving(false) }
  }

  const handleEnroll = async () => {
    if (!enrollCourseId) { setEnrollError('Selecciona un curso'); return }
    setEnrollError(''); setSaving(true)
    try {
      const res  = await fetch(`${API_URL}/api/students/${enrollId}/enroll`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ courseId: parseInt(enrollCourseId) }),
      })
      const data = await res.json()
      if (!res.ok) { setEnrollError(data.message); return }
      toast(data.message, 'success'); setShowEnrollModal(false); fetchStudents()
    } catch { setEnrollError('Error de conexión') }
    finally  { setSaving(false) }
  }

  const handleToggle = async (id: number) => {
    try {
      const res  = await fetch(`${API_URL}/api/students/${id}/toggle`, { method: 'PATCH', headers: { Authorization: `Bearer ${getToken()}` } })
      const data = await res.json()
      if (res.ok) { toast(data.message, 'success'); fetchStudents() }
      else toast(data.message, 'error')
    } catch { toast('Error al cambiar estado', 'error') }
  }

  const handleDelete = async (id: number, name: string) => {
    const ok = await confirm(`¿Eliminar a ${name}? Esta acción no se puede deshacer.`, { danger: true, confirmLabel: 'Eliminar' })
    if (!ok) return
    try {
      const res  = await fetch(`${API_URL}/api/students/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${getToken()}` } })
      const data = await res.json()
      if (res.ok) { toast(data.message, 'success'); fetchStudents() }
      else toast(data.message, 'error')
    } catch { toast('Error al eliminar', 'error') }
  }

  const handleGenerateCredentials = async (id: number, name: string) => {
    try {
      const res  = await fetch(`${API_URL}/api/students/${id}/generate-credentials`, { method: 'POST', headers: { Authorization: `Bearer ${getToken()}` } })
      const data = await res.json()
      if (!res.ok) { toast(data.message, 'error'); return }
      setCredentials({ accessEmail: data.accessEmail, defaultPassword: data.defaultPassword, studentName: name })
      setShowCredentials(true)
      fetchStudents()
    } catch { toast('Error al generar credenciales', 'error') }
  }

  const copyCredentials = () => {
    if (!credentials) return
    navigator.clipboard.writeText(`Estudiante: ${credentials.studentName}\nEmail: ${credentials.accessEmail}\nContraseña: ${credentials.defaultPassword}`)
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }

  const getCurrentCourse = (s: Student) => {
    const active = s.assignments.find(a => a.academicYear.isActive)
    if (!active) return '—'
    const c = active.course
    return `${LEVEL_LABELS[c.level]} ${GRADE_LABELS[c.grade]} ${c.parallel} · ${SHIFT_LABELS[c.shift]}`
  }

  const formatDate = (d?: string) => {
    if (!d) return '—'
    return new Date(d).toLocaleDateString('es-BO', { day:'2-digit', month:'2-digit', year:'numeric' })
  }


  const handleImport = async (file: File) => {
    setImporting(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res  = await fetch(`${API_URL}/api/students/import`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken()}` },
        body: formData,
      })
      const data = await res.json()
      setImportResult(data)
      if (res.ok) fetchStudents()
    } catch { toast('Error al importar', 'error') }
    finally  { setImporting(false) }
  }

  const handleImportTutors = async (file: File) => {
    setImporting(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res  = await fetch(`${API_URL}/api/students/import-tutors`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken()}` },
        body: formData,
      })
      const data = await res.json()
      setImportResult(data)
      if (res.ok) fetchStudents()
    } catch { toast('Error al importar tutores', 'error') }
    finally  { setImporting(false) }
  }

  const columns: Column<Student>[] = [
    { key: 'idx', header: '#', render: (s) => <span className="text-neutral-500">{(page - 1) * PAGE_SIZE + students.indexOf(s) + 1}</span> },
    {
      key: 'name', header: 'Nombre completo', render: (s) => (
        <div>
          <div className="font-medium text-brand-700">{s.lastName} {s.firstName}</div>
          {s.user
            ? <div className="text-[11px] text-neutral-500 mt-0.5">{s.user.email}</div>
            : (
              <button
                onClick={() => handleGenerateCredentials(s.id, `${s.firstName} ${s.lastName}`)}
                className="inline-flex items-center gap-1 border border-dashed border-info-500 text-info-500 rounded-md px-2 py-0.5 text-[11px] mt-0.5 hover:bg-info-500/10"
              >
                <KeyRound size={11} /> Generar acceso
              </button>
            )}
        </div>
      ),
    },
    { key: 'ci',   header: 'CI',   render: (s) => <span className="text-neutral-500 text-xs">{s.ci || '—'}</span> },
    { key: 'rude', header: 'RUDE', render: (s) => <span className="text-neutral-500 text-xs">{s.rude || '—'}</span> },
    {
      key: 'birth', header: 'Fecha Nac.', render: (s) => (
        <div className="text-neutral-500 text-xs">
          <div>{formatDate(s.birthDate)}</div>
          {s.birthDate && (
            <div className="text-info-500">{Math.floor((Date.now() - new Date(s.birthDate).getTime()) / (365.25 * 24 * 60 * 60 * 1000))} años</div>
          )}
        </div>
      ),
    },
    { key: 'gender', header: 'Género', render: (s) => <Badge tone={s.gender === 'MASCULINO' ? 'info' : 'danger'}>{s.gender === 'MASCULINO' ? '♂ M' : '♀ F'}</Badge> },
    { key: 'course', header: 'Curso actual', render: (s) => <span className="text-neutral-500 text-xs">{getCurrentCourse(s)}</span> },
    { key: 'status', header: 'Estado', render: (s) => <Badge tone={s.isActive ? 'success' : 'danger'}>{s.isActive ? 'Activo' : 'Inactivo'}</Badge> },
    {
      key: 'actions', header: 'Acciones', render: (s) => (
        <div className="flex gap-1.5">
          <button title="Ver detalle" onClick={() => router.push(`/dashboard/admin/estudiantes/${s.id}`)} className="w-7 h-7 rounded-md bg-info-500/15 text-info-500 flex items-center justify-center hover:opacity-75">
            <Eye size={13} />
          </button>
          <button title="Editar" onClick={() => openEdit(s)} className="w-7 h-7 rounded-md bg-accent-500/15 text-accent-600 flex items-center justify-center hover:opacity-75">
            <Edit size={13} />
          </button>
          <button title="Inscribir en curso" onClick={() => openEnroll(s.id)} className="w-7 h-7 rounded-md bg-success-100 text-success-700 flex items-center justify-center hover:opacity-75">
            <BookOpen size={13} />
          </button>
          <button title={s.isActive ? 'Desactivar' : 'Activar'} onClick={() => handleToggle(s.id)}
            className={`w-7 h-7 rounded-md flex items-center justify-center hover:opacity-75 ${s.isActive ? 'bg-danger-100 text-danger-600' : 'bg-success-100 text-success-700'}`}>
            {s.isActive ? <UserX size={13} /> : <UserCheck size={13} />}
          </button>
          <button title="Eliminar" onClick={() => handleDelete(s.id, `${s.firstName} ${s.lastName}`)} className="w-7 h-7 rounded-md bg-danger-100 text-danger-600 flex items-center justify-center hover:opacity-75">
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
          <h1 className="text-xl font-bold text-brand-700 mb-1">Gestión de Estudiantes</h1>
          <p className="text-[13px] text-neutral-500">Registro, edición e inscripción de estudiantes</p>
        </div>
        <div className="flex gap-2.5">
          <Button variant="secondary" onClick={() => { setShowImportModal(true); setImportResult(null) }}>
            <Upload size={16} /> Importar Excel
          </Button>
          <Button onClick={openCreate}><Plus size={16} /> Nuevo estudiante</Button>
        </div>
      </div>

      <div className="flex gap-2.5 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-info-500 pointer-events-none" />
          <input
            placeholder="Buscar por nombre, CI o RUDE..." value={search}
            onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleFilterChange()}
            className="w-full h-10 pl-9 pr-3 rounded-lg border border-neutral-300 text-sm outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/15"
          />
        </div>
        <Select value={filterActive} onChange={e => setFilterActive(e.target.value)} className="w-auto min-w-[120px]">
          <option value="">Todos</option>
          <option value="true">Activos</option>
          <option value="false">Inactivos</option>
        </Select>
        <Select value={filterGender} onChange={e => setFilterGender(e.target.value)} className="w-auto min-w-[120px]">
          <option value="">Género</option>
          <option value="MASCULINO">Masculino</option>
          <option value="FEMENINO">Femenino</option>
        </Select>
        <Select value={filterCourse} onChange={e => setFilterCourse(e.target.value)} className="w-auto min-w-[150px]">
          <option value="">Curso</option>
          {courses
            .filter(c => c.shift === 'MORNING' && c.educationType === 'REGULAR')
            .sort((a, b) => {
              const order = ['PRIMERO','SEGUNDO','TERCERO','CUARTO','QUINTO','SEXTO']
              return order.indexOf(a.grade) - order.indexOf(b.grade) || a.parallel.localeCompare(b.parallel)
            })
            .map(c => (
              <option key={c.id} value={c.id}>{GRADE_LABELS[c.grade]}{c.parallel} · {LEVEL_LABELS[c.level]}</option>
            ))
          }
        </Select>
        <Button variant="secondary" onClick={handleFilterChange}>Buscar</Button>
      </div>

      <Table columns={columns} rows={students} rowKey={(s) => s.id} loading={loading} emptyLabel="No se encontraron estudiantes" />
      <Pagination page={page} pageCount={Math.ceil(total / PAGE_SIZE)} onPageChange={fetchStudents} />

      <div className="px-3.5 py-2.5 flex items-center justify-between flex-wrap gap-2 text-xs text-neutral-500">
        <span>Mostrando <strong>{students.length}</strong> de <strong>{total}</strong> estudiantes (página {page})</span>
      </div>

      {/* Modal crear/editar */}
      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title={editMode ? 'Editar Estudiante' : 'Nuevo Estudiante'}
        maxWidth={620}
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowModal(false)}>Cancelar</Button>
            <Button onClick={handleSave} loading={saving}>{editMode ? 'Actualizar' : 'Registrar estudiante'}</Button>
          </>
        }
      >
        <div className="flex flex-col gap-3.5">
          {formError && <p className="text-[13px] text-danger-600 bg-danger-100 rounded-lg px-3 py-2">{formError}</p>}
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
            <Input label="RUDE" placeholder="Ej: 00123456789" value={form.rude} onChange={e => setForm({ ...form, rude: e.target.value })} />
            <Input label="Fecha de nacimiento" type="date" value={form.birthDate} onChange={e => setForm({ ...form, birthDate: e.target.value })} />
            <Select label="Género" required value={form.gender} onChange={e => setForm({ ...form, gender: e.target.value })}>
              <option value="">-- Selecciona género --</option>
              <option value="MASCULINO">Masculino</option>
              <option value="FEMENINO">Femenino</option>
            </Select>
            <Input label="Teléfono" placeholder="Ej: 70012345" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
            <Input label="Correo personal" type="email" placeholder="Ej: estudiante@gmail.com" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
            <Input label="Dirección" placeholder="Ej: Av. Principal 123" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} className="col-span-2" />
          </div>
        </div>
      </Modal>

      {/* Modal credenciales */}
      <Modal
        open={showCredentials && !!credentials}
        onClose={() => setShowCredentials(false)}
        title="✅ Credenciales generadas"
        footer={
          <>
            <Button variant="secondary" onClick={copyCredentials}>{copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'Copiado' : 'Copiar credenciales'}</Button>
            <Button onClick={() => setShowCredentials(false)}>Entendido</Button>
          </>
        }
      >
        {credentials && (
          <div className="bg-neutral-100 border border-neutral-300 rounded-xl p-4 flex flex-col gap-2.5">
            <p className="text-[13px] text-neutral-500">Credenciales de acceso para:</p>
            <p className="text-base font-bold text-brand-700">{credentials.studentName}</p>
            <div className="flex items-center gap-2.5 bg-white border border-neutral-300 rounded-lg px-3.5 py-2.5">
              <span className="text-[12px] font-semibold text-neutral-500 uppercase tracking-wide min-w-[80px]">Email:</span>
              <span className="text-sm font-semibold text-brand-700 font-mono">{credentials.accessEmail}</span>
            </div>
            <div className="flex items-center gap-2.5 bg-white border border-neutral-300 rounded-lg px-3.5 py-2.5">
              <span className="text-[12px] font-semibold text-neutral-500 uppercase tracking-wide min-w-[80px]">Contraseña:</span>
              <span className="text-sm font-semibold text-brand-700 font-mono">{credentials.defaultPassword}</span>
            </div>
            <p className="text-[12px] text-[#8A6116] bg-warning-100 rounded-lg px-3 py-2.5">⚠️ Anota estas credenciales. La contraseña no se podrá ver de nuevo.</p>
          </div>
        )}
      </Modal>

      {/* Modal inscribir */}
      <Modal
        open={showEnrollModal}
        onClose={() => setShowEnrollModal(false)}
        title="Inscribir en Curso"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowEnrollModal(false)}>Cancelar</Button>
            <Button onClick={handleEnroll} loading={saving}><BookOpen size={14} /> Inscribir</Button>
          </>
        }
      >
        <div className="flex flex-col gap-3.5">
          {enrollError && <p className="text-[13px] text-danger-600 bg-danger-100 rounded-lg px-3 py-2">{enrollError}</p>}
          <p className="bg-neutral-100 border border-neutral-300 rounded-lg px-3 py-2.5 text-xs text-neutral-500 leading-relaxed">
            Se inscribirá en la <strong>gestión activa</strong>.
          </p>
          <Select label="Seleccionar curso" required value={enrollCourseId} onChange={e => setEnrollCourseId(e.target.value)}>
            <option value="">-- Selecciona un curso --</option>
            {['INICIAL','PRIMARIA','SECUNDARIA'].map(level => (
              <optgroup key={level} label={LEVEL_LABELS[level]}>
                {courses.filter(c => c.level === level).map(c => (
                  <option key={c.id} value={c.id}>{GRADE_LABELS[c.grade]} {c.parallel} · {SHIFT_LABELS[c.shift]} · {c.educationType}</option>
                ))}
              </optgroup>
            ))}
          </Select>
        </div>
      </Modal>

      {/* Modal importar Excel */}
      <Modal
        open={showImportModal}
        onClose={() => setShowImportModal(false)}
        title="📥 Importar desde Excel"
        maxWidth={620}
        footer={<Button onClick={() => { setShowImportModal(false); setImportResult(null) }}>Cerrar</Button>}
      >
        {!importResult ? (
          <div className="flex flex-col gap-3.5">
            <div className="flex bg-neutral-100 rounded-[10px] p-1 gap-1">
              <button
                onClick={() => setImportType('students')}
                className={`flex-1 py-2 rounded-lg text-[13px] transition-colors ${importType === 'students' ? 'bg-white text-brand-700 font-semibold shadow-sm' : 'text-neutral-500'}`}
              >
                Estudiantes
              </button>
              <button
                onClick={() => setImportType('tutors')}
                className={`flex-1 py-2 rounded-lg text-[13px] transition-colors ${importType === 'tutors' ? 'bg-white text-brand-700 font-semibold shadow-sm' : 'text-neutral-500'}`}
              >
                Tutores Legales
              </button>
            </div>
            <p className="bg-neutral-100 border border-neutral-300 rounded-lg px-3 py-2.5 text-xs text-neutral-500 leading-relaxed">
              {importType === 'students' ? (
                <>Columnas requeridas:<br /><strong>RUDE · NROKARDEX · NOMBRESCOMPLETO · APELLIDOS · GENERO</strong><br />Género: <strong>M</strong> o <strong>F</strong></>
              ) : (
                <>Columnas requeridas:<br /><strong>RUDE · NROKARDEX · TUTORLEGAL</strong><br />Si no tiene tutor escribe: <strong>SIN REGISTRO</strong></>
              )}
            </p>
            <label className="flex flex-col gap-1.5">
              <span className="text-[13px] font-semibold text-neutral-700">Seleccionar archivo Excel<span className="text-danger-500"> *</span></span>
              <input
                type="file" accept=".xlsx,.xls"
                onChange={e => {
                  const file = e.target.files?.[0]
                  if (file) importType === 'students' ? handleImport(file) : handleImportTutors(file)
                }}
                className="text-sm file:mr-3 file:py-2 file:px-3.5 file:rounded-lg file:border-0 file:bg-brand-700 file:text-white file:text-sm file:font-semibold file:cursor-pointer hover:file:bg-brand-600"
              />
            </label>
            {importing && (
              <p className="text-center text-sm text-neutral-500 py-4">Importando... esto puede tomar varios minutos</p>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-[13px] text-success-700 bg-success-100 rounded-lg px-3 py-2.5">{importResult.message}</p>
            {importResult.created?.length > 0 && (
              <div>
                <div className="text-xs font-bold text-brand-700 uppercase tracking-wide pb-1 border-b border-neutral-300/60">✅ Creados ({importResult.created.length})</div>
                <div className="max-h-[200px] overflow-y-auto mt-2">
                  {importResult.created.map((s: any, i: number) => (
                    <div key={i} className="py-1.5 border-b border-neutral-100 text-xs"><strong>{s.name}</strong> — {s.email} / {s.password}</div>
                  ))}
                </div>
              </div>
            )}
            {importResult.assigned?.length > 0 && (
              <div>
                <div className="text-xs font-bold text-brand-700 uppercase tracking-wide pb-1 border-b border-neutral-300/60">✅ Tutores asignados ({importResult.assigned.length})</div>
                <div className="max-h-[200px] overflow-y-auto mt-2">
                  {importResult.assigned.map((s: any, i: number) => (
                    <div key={i} className="py-1.5 border-b border-neutral-100 text-xs"><strong>{s.student}</strong> → Tutor: {s.tutor}</div>
                  ))}
                </div>
              </div>
            )}
            {importResult.skipped?.length > 0 && (
              <div>
                <div className="text-xs font-bold text-brand-700 uppercase tracking-wide pb-1 border-b border-neutral-300/60">⚠️ Omitidos ({importResult.skipped.length})</div>
                <div className="max-h-[150px] overflow-y-auto mt-1">
                  {importResult.skipped.map((s: any, i: number) => (
                    <div key={i} className="text-xs text-[#7A6000] py-1">{s.name || `Kardex ${s.kardex}`} — {s.reason}</div>
                  ))}
                </div>
              </div>
            )}
            {importResult.errors?.length > 0 && (
              <div>
                <div className="text-xs font-bold text-brand-700 uppercase tracking-wide pb-1 border-b border-neutral-300/60">❌ Errores ({importResult.errors.length})</div>
                <div className="max-h-[150px] overflow-y-auto mt-1">
                  {importResult.errors.map((e: any, i: number) => (
                    <div key={i} className="text-xs text-danger-600 py-1">{e.name || e.tutorNombre || `Kardex ${e.kardex}`} — {e.reason}</div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}
