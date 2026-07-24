'use client'

import { useEffect, useState } from 'react'
import { Plus, Trash2, Users, Filter, Edit, Eye, UserPlus, Search } from 'lucide-react'
import { useRouter } from 'next/navigation'
import Button from '@/components/ui/Button'
import { Select } from '@/components/ui/Input'
import Card from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import Modal from '@/components/ui/Modal'
import { useToast } from '@/components/ui/ToastProvider'
import { useConfirm } from '@/components/ui/ConfirmProvider'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

interface Course {
  id:            number
  level:         string
  grade:         string
  parallel:      string
  educationType: string
  shift:         string
  _count:        { assignments: number; schedules: number }
  tutor?: {
    teacher: { firstName: string; lastName: string }
  }
}

interface Student {
  id:        number
  firstName: string
  lastName:  string
  ci?:       string
  rude?:     string
  isActive:  boolean
  assignments: {
    course: { grade: string; parallel: string; level: string }
    academicYear: { isActive: boolean }
  }[]
}

const LEVELS    = [{ value: 'INICIAL', label: 'Inicial' }, { value: 'PRIMARIA', label: 'Primaria' }, { value: 'SECUNDARIA', label: 'Secundaria' }]
const GRADES    = [{ value: 'PRIMERO', label: '1°' }, { value: 'SEGUNDO', label: '2°' }, { value: 'TERCERO', label: '3°' }, { value: 'CUARTO', label: '4°' }, { value: 'QUINTO', label: '5°' }, { value: 'SEXTO', label: '6°' }]
const PARALLELS = [{ value: 'A', label: 'A' }, { value: 'B', label: 'B' }, { value: 'C', label: 'C' }]
const SHIFTS    = [{ value: 'MORNING', label: 'Mañana' }, { value: 'AFTERNOON', label: 'Tarde' }, { value: 'NIGHT', label: 'Noche' }]
const EDU_TYPES = [{ value: 'REGULAR', label: 'Regular' }, { value: 'BTH', label: 'BTH' }]

const levelLabel = (v: string) => LEVELS.find(l => l.value === v)?.label || v
const gradeLabel = (v: string) => GRADES.find(g => g.value === v)?.label || v
const shiftLabel = (v: string) => SHIFTS.find(s => s.value === v)?.label || v

const shiftTone: Record<string, 'brand' | 'warning' | 'neutral'> = { MORNING: 'brand', AFTERNOON: 'warning', NIGHT: 'neutral' }
const levelBorder: Record<string, string> = { INICIAL: 'border-l-success-500', PRIMARIA: 'border-l-brand-700', SECUNDARIA: 'border-l-danger-600' }
const levelText: Record<string, string> = { INICIAL: 'text-success-700', PRIMARIA: 'text-brand-700', SECUNDARIA: 'text-danger-600' }

const emptyForm = { level: 'PRIMARIA', grade: 'PRIMERO', parallel: 'A', educationType: 'REGULAR', shift: 'MORNING' }

export default function CursosPage() {
  const router = useRouter()
  const toast = useToast()
  const confirm = useConfirm()
  const [courses,     setCourses]     = useState<Course[]>([])
  const [loading,     setLoading]     = useState(true)
  const [showModal,   setShowModal]   = useState(false)
  const [editMode,    setEditMode]    = useState(false)
  const [editId,      setEditId]      = useState<number | null>(null)
  const [saving,      setSaving]      = useState(false)
  const [formError,   setFormError]   = useState('')
  const [filterLevel, setFilterLevel] = useState('')
  const [filterShift, setFilterShift] = useState('')
  const [filterType,  setFilterType]  = useState('')
  const [form,        setForm]        = useState(emptyForm)
  const [warning,     setWarning]     = useState('')

  // Inscripción
  const [showEnroll,      setShowEnroll]      = useState(false)
  const [enrollCourse,    setEnrollCourse]    = useState<Course | null>(null)
  const [students,        setStudents]        = useState<Student[]>([])
  const [loadingStudents, setLoadingStudents] = useState(false)
  const [searchStudent,   setSearchStudent]   = useState('')
  const [selectedStudent, setSelectedStudent] = useState<number | null>(null)
  const [enrolling,       setEnrolling]       = useState(false)
  const [enrollError,     setEnrollError]     = useState('')

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : ''

  const checkWarning = (level: string, shift: string) => {
    if (level === 'INICIAL' && shift !== 'MORNING') {
      setWarning('⚠️ El nivel Inicial normalmente funciona en turno Mañana.')
    } else {
      setWarning('')
    }
  }

  const fetchCourses = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filterLevel) params.set('level', filterLevel)
      if (filterShift) params.set('shift', filterShift)
      if (filterType)  params.set('educationType', filterType)
      const res  = await fetch(`${API_URL}/api/courses?${params}`, { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      if (res.ok) setCourses(data)
      else toast('Error al cargar cursos', 'error')
    } catch { toast('Error de conexión', 'error') }
    finally  { setLoading(false) }
  }

  const fetchStudents = async (search: string) => {
    setLoadingStudents(true)
    try {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      const res  = await fetch(`${API_URL}/api/students?${params}`, { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      if (res.ok) setStudents(data)
    } catch { console.error('Error cargando estudiantes') }
    finally  { setLoadingStudents(false) }
  }

  useEffect(() => { fetchCourses() }, [])

  const openEnroll = (course: Course) => {
    setEnrollCourse(course)
    setSelectedStudent(null)
    setSearchStudent('')
    setStudents([])
    setEnrollError('')
    setShowEnroll(true)
  }

  const handleSearchStudent = async () => {
    if (!searchStudent.trim()) return
    await fetchStudents(searchStudent)
  }

  const handleEnroll = async () => {
    if (!selectedStudent || !enrollCourse) return
    setEnrolling(true)
    try {
      const res  = await fetch(`${API_URL}/api/students/${selectedStudent}/enroll`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ courseId: enrollCourse.id }),
      })
      const data = await res.json()
      if (!res.ok) { setEnrollError(data.message); return }
      toast(data.message, 'success')
      setShowEnroll(false)
      fetchCourses()
    } catch { setEnrollError('Error de conexión') }
    finally  { setEnrolling(false) }
  }

  const openCreate = () => {
    setEditMode(false); setEditId(null)
    setForm(emptyForm); setFormError('')
    checkWarning(emptyForm.level, emptyForm.shift)
    setShowModal(true)
  }

  const openEdit = (c: Course) => {
    setEditMode(true); setEditId(c.id)
    setForm({ level: c.level, grade: c.grade, parallel: c.parallel, educationType: c.educationType, shift: c.shift })
    setFormError('')
    checkWarning(c.level, c.shift)
    setShowModal(true)
  }

  const handleSave = async () => {
    setFormError(''); setSaving(true)
    try {
      const url    = editMode ? `${API_URL}/api/courses/${editId}` : `${API_URL}/api/courses`
      const method = editMode ? 'PUT' : 'POST'
      const res    = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) { setFormError(data.message); return }
      toast(editMode ? 'Curso actualizado correctamente' : 'Curso creado correctamente', 'success')
      setShowModal(false)
      fetchCourses()
    } catch { setFormError('Error de conexión') }
    finally  { setSaving(false) }
  }

  const handleDelete = async (id: number, name: string) => {
    const ok = await confirm(`¿Eliminar el curso ${name}?`, { danger: true, confirmLabel: 'Eliminar' })
    if (!ok) return
    try {
      const res  = await fetch(`${API_URL}/api/courses/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      if (res.ok) { toast(data.message, 'success'); fetchCourses() }
      else toast(data.message, 'error')
    } catch { toast('Error al eliminar', 'error') }
  }

  const grouped = courses.reduce((acc, c) => {
    if (!acc[c.level]) acc[c.level] = []
    acc[c.level].push(c)
    return acc
  }, {} as Record<string, Course[]>)

  const courseName = (c: Course) => `${gradeLabel(c.grade)} ${c.parallel}`

  const filteredStudents = students.filter(s => {
    const q = searchStudent.toLowerCase()
    return (
      s.firstName.toLowerCase().includes(q) ||
      s.lastName.toLowerCase().includes(q)  ||
      (s.ci   || '').toLowerCase().includes(q) ||
      (s.rude || '').toLowerCase().includes(q)
    )
  })

  const isEnrolled = (s: Student) => s.assignments?.some(a => a.academicYear?.isActive)

  return (
    <div>
      <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-brand-700 mb-1">Gestión de Cursos</h1>
          <p className="text-[13px] text-neutral-500">Administra los cursos por nivel, grado, paralelo y turno</p>
        </div>
        <Button onClick={openCreate}><Plus size={16} /> Nuevo curso</Button>
      </div>

      <div className="flex items-center gap-2.5 mb-5 flex-wrap bg-white border border-neutral-300 rounded-[10px] px-4 py-3">
        <Filter size={15} className="text-neutral-500" />
        <Select value={filterLevel} onChange={e => setFilterLevel(e.target.value)} className="w-auto h-9 min-w-[140px]">
          <option value="">Todos los niveles</option>
          {LEVELS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
        </Select>
        <Select value={filterShift} onChange={e => setFilterShift(e.target.value)} className="w-auto h-9 min-w-[140px]">
          <option value="">Todos los turnos</option>
          {SHIFTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </Select>
        <Select value={filterType} onChange={e => setFilterType(e.target.value)} className="w-auto h-9 min-w-[140px]">
          <option value="">Todos los tipos</option>
          {EDU_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </Select>
        <Button variant="secondary" size="sm" onClick={fetchCourses}>Filtrar</Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><p className="text-sm text-neutral-500">Cargando...</p></div>
      ) : courses.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 py-12 text-neutral-500 text-sm">
          <p>No se encontraron cursos</p>
          <Button onClick={openCreate}><Plus size={14} /> Crear primer curso</Button>
        </Card>
      ) : (
        <div className="flex flex-col gap-5">
          {Object.entries(grouped).map(([level, list]) => (
            <Card key={level} padded={false} className="overflow-hidden">
              <div className={`flex items-center justify-between px-5 py-3.5 border-b border-neutral-100 border-l-4 ${levelBorder[level] || 'border-l-brand-700'}`}>
                <span className={`text-[15px] font-bold ${levelText[level] || 'text-brand-700'}`}>{levelLabel(level)}</span>
                <span className="text-xs text-neutral-500">{list.length} cursos</span>
              </div>
              <div className="grid gap-3 p-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))' }}>
                {list.map(c => (
                  <div key={c.id} className="bg-neutral-100/60 border border-neutral-300 rounded-[10px] p-3.5 flex flex-col gap-2.5 hover:shadow-md transition-shadow">
                    <div className="flex flex-col gap-1.5">
                      <div className="text-xl font-extrabold text-brand-700">{courseName(c)}</div>
                      <div className="flex gap-1.5 flex-wrap">
                        <Badge tone={shiftTone[c.shift]}>{shiftLabel(c.shift)}</Badge>
                        {c.educationType === 'BTH' && <Badge tone="warning">BTH</Badge>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-neutral-500"><Users size={12} />{c._count.assignments} estudiantes</div>
                    {c.tutor && (
                      <div className="text-xs text-neutral-500">🎓 {c.tutor.teacher.lastName} {c.tutor.teacher.firstName}</div>
                    )}
                    <div className="flex gap-1.5 justify-end mt-1">
                      <button title="Ver detalle" onClick={() => router.push(`/dashboard/admin/cursos/${c.id}`)} className="w-7 h-7 rounded-md bg-info-500/15 text-info-500 flex items-center justify-center hover:opacity-75">
                        <Eye size={13} />
                      </button>
                      <button title="Editar" onClick={() => openEdit(c)} className="w-7 h-7 rounded-md bg-accent-500/15 text-accent-600 flex items-center justify-center hover:opacity-75">
                        <Edit size={13} />
                      </button>
                      <button title="Inscribir estudiante" onClick={() => openEnroll(c)} className="w-7 h-7 rounded-md bg-success-100 text-success-700 flex items-center justify-center hover:opacity-75">
                        <UserPlus size={13} />
                      </button>
                      <button title="Eliminar" onClick={() => handleDelete(c.id, courseName(c))} className="w-7 h-7 rounded-md bg-danger-100 text-danger-600 flex items-center justify-center hover:opacity-75">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}

      {courses.length > 0 && <div className="px-1 py-3 text-xs text-neutral-500">Total: <strong>{courses.length}</strong> cursos registrados</div>}

      {/* ── Modal inscribir estudiante ── */}
      <Modal
        open={showEnroll && !!enrollCourse}
        onClose={() => setShowEnroll(false)}
        title="Inscribir estudiante"
        maxWidth={700}
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowEnroll(false)}>Cancelar</Button>
            <Button onClick={handleEnroll} loading={enrolling} disabled={!selectedStudent}>
              <UserPlus size={14} /> Inscribir estudiante
            </Button>
          </>
        }
      >
        {enrollCourse && (
          <div className="flex flex-col gap-3.5">
            <p className="text-xs text-neutral-500 -mt-2">
              {levelLabel(enrollCourse.level)} — {courseName(enrollCourse)} · {shiftLabel(enrollCourse.shift)}
            </p>
            {enrollError && <p className="text-[13px] text-danger-600 bg-danger-100 rounded-lg px-3 py-2">{enrollError}</p>}

            <div className="flex gap-2.5">
              <div className="relative flex-1">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-info-500 pointer-events-none" />
                <input
                  type="text" placeholder="Buscar por nombre, CI o RUDE..."
                  value={searchStudent} onChange={e => setSearchStudent(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSearchStudent()}
                  className="w-full h-10 pl-9 pr-3 rounded-lg border border-neutral-300 text-sm outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/15"
                />
              </div>
              <Button onClick={handleSearchStudent} loading={loadingStudents}><Search size={14} /> Buscar</Button>
            </div>

            {loadingStudents ? (
              <p className="text-center text-sm text-neutral-500 py-6">Cargando...</p>
            ) : filteredStudents.length === 0 && searchStudent ? (
              <p className="text-sm text-neutral-500 italic py-2">No se encontraron estudiantes</p>
            ) : filteredStudents.length === 0 ? (
              <p className="text-sm text-neutral-500 italic py-2">Busca un estudiante para inscribir</p>
            ) : (
              <div className="flex flex-col gap-2 max-h-[300px] overflow-y-auto">
                {filteredStudents.map(s => {
                  const enrolled = isEnrolled(s)
                  const activeAssignment = s.assignments?.find(a => a.academicYear?.isActive)
                  return (
                    <label
                      key={s.id}
                      className={`flex items-start gap-2.5 p-3 border rounded-lg cursor-pointer ${
                        selectedStudent === s.id ? 'border-brand-700 bg-brand-100' : enrolled ? 'border-accent-500 bg-warning-100' : 'border-neutral-300 hover:bg-neutral-100'
                      }`}
                    >
                      <input type="radio" name="student" checked={selectedStudent === s.id} onChange={() => setSelectedStudent(s.id)} className="accent-brand-700 mt-0.5 shrink-0" />
                      <div className="flex flex-col gap-0.5">
                        <div className="text-[13px] font-semibold text-brand-700">{s.lastName} {s.firstName}</div>
                        <div className="flex gap-2.5 flex-wrap text-[11px] text-neutral-500">
                          {s.ci && <span>CI: {s.ci}</span>}
                          {s.rude && <span>RUDE: {s.rude}</span>}
                          {enrolled && activeAssignment && (
                            <span className="text-[#8A6116] font-medium">⚠️ Ya inscrito en {gradeLabel(activeAssignment.course.grade)} {activeAssignment.course.parallel}</span>
                          )}
                        </div>
                      </div>
                    </label>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* ── Modal crear/editar curso ── */}
      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title={editMode ? 'Editar Curso' : 'Nuevo Curso'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowModal(false)}>Cancelar</Button>
            <Button onClick={handleSave} loading={saving}>{editMode ? 'Actualizar' : 'Crear curso'}</Button>
          </>
        }
      >
        <div className="flex flex-col gap-3.5">
          {formError && <p className="text-[13px] text-danger-600 bg-danger-100 rounded-lg px-3 py-2">{formError}</p>}
          {warning && <p className="text-[13px] text-[#7A6000] bg-warning-100 rounded-lg px-3 py-2">{warning}</p>}
          <div className="grid grid-cols-2 gap-3">
            <Select label="Nivel" required value={form.level} onChange={e => { setForm({ ...form, level: e.target.value }); checkWarning(e.target.value, form.shift) }}>
              {LEVELS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
            </Select>
            <Select label="Grado" required value={form.grade} onChange={e => setForm({ ...form, grade: e.target.value })}>
              {GRADES.map(g => <option key={g.value} value={g.value}>{g.label} Grado</option>)}
            </Select>
            <Select label="Paralelo" required value={form.parallel} onChange={e => setForm({ ...form, parallel: e.target.value })}>
              {PARALLELS.map(p => <option key={p.value} value={p.value}>Paralelo {p.label}</option>)}
            </Select>
            <Select label="Turno" required value={form.shift} onChange={e => { setForm({ ...form, shift: e.target.value }); checkWarning(form.level, e.target.value) }}>
              {SHIFTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </Select>
            <Select label="Tipo de educación" required value={form.educationType} onChange={e => setForm({ ...form, educationType: e.target.value })} className="col-span-2">
              {EDU_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </Select>
          </div>
          <div className="bg-neutral-100 border border-neutral-300 rounded-lg px-3.5 py-3 text-[13px] text-neutral-500 flex flex-col gap-1">
            <span>Vista previa:</span>
            <strong className="text-brand-700">{levelLabel(form.level)} — {gradeLabel(form.grade)} {form.parallel} · {shiftLabel(form.shift)} · {form.educationType}</strong>
          </div>
        </div>
      </Modal>
    </div>
  )
}
