'use client'

import { useEffect, useState } from 'react'
import { Search, UserPlus, RefreshCw, Users, BookOpen, X, UserCheck } from 'lucide-react'
import Button from '@/components/ui/Button'
import { Select } from '@/components/ui/Input'
import Card from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import Modal from '@/components/ui/Modal'
import Table, { Column } from '@/components/ui/Table'
import { useToast } from '@/components/ui/ToastProvider'
import { useConfirm } from '@/components/ui/ConfirmProvider'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

interface Parent {
  id:        number
  firstName: string
  lastName:  string
  phone?:    string
  ci?:       string
}

interface Student {
  id:        number
  firstName: string
  lastName:  string
  ci?:       string
  rude?:     string
  gender?:   string
  isActive:  boolean
  parents:   { isTutor: boolean; relationType: string; parent: Parent }[]
  assignments: {
    id:      number
    year:    number
    course:  { id: number; grade: string; parallel: string; level: string; shift: string }
    academicYear: { isActive: boolean; year: number }
  }[]
}

interface Course {
  id:            number
  grade:         string
  parallel:      string
  level:         string
  shift:         string
  educationType: string
  _count:        { assignments: number }
}

const GRADES: Record<string, string> = {
  PRIMERO: '1°', SEGUNDO: '2°', TERCERO: '3°',
  CUARTO: '4°', QUINTO: '5°', SEXTO: '6°',
}
const SHIFTS: Record<string, string> = {
  MORNING: 'Mañana', AFTERNOON: 'Tarde', NIGHT: 'Noche',
}
const LEVELS: Record<string, string> = {
  INICIAL: 'Inicial', PRIMARIA: 'Primaria', SECUNDARIA: 'Secundaria',
}

export default function InscripcionesPage() {
  const toast = useToast()
  const confirm = useConfirm()
  const [tab,            setTab]            = useState<'sin' | 'inscritos'>('sin')
  const [students,       setStudents]       = useState<Student[]>([])
  const [courses,        setCourses]        = useState<Course[]>([])
  const [loading,        setLoading]        = useState(true)
  const [search,         setSearch]         = useState('')
  const [filterCourse,   setFilterCourse]   = useState('')

  // Modal inscripción/cambio
  const [showEnrollModal, setShowEnrollModal] = useState(false)
  const [enrollStudent,   setEnrollStudent]   = useState<Student | null>(null)
  const [enrollMode,      setEnrollMode]      = useState<'enroll' | 'change'>('enroll')
  const [selectedCourse,  setSelectedCourse]  = useState('')
  const [enrollFilterLvl, setEnrollFilterLvl] = useState('')
  const [saving,          setSaving]          = useState(false)
  const [canceling,       setCanceling]       = useState<number | null>(null)
  const [enrollError,     setEnrollError]     = useState('')

  // Modal tutor
  const [showTutorModal,  setShowTutorModal]  = useState(false)
  const [tutorStudent,    setTutorStudent]    = useState<Student | null>(null)
  const [tutorMode,       setTutorMode]       = useState<'assign' | 'change'>('assign')
  const [parents,         setParents]         = useState<Parent[]>([])
  const [searchParent,    setSearchParent]    = useState('')
  const [loadingParents,  setLoadingParents]  = useState(false)
  const [selectedParent,  setSelectedParent]  = useState<number | null>(null)
  const [savingTutor,     setSavingTutor]     = useState(false)
  const [tutorError,      setTutorError]      = useState('')

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : ''

  const fetchData = async () => {
    setLoading(true)
    try {
      const [sRes, cRes] = await Promise.all([
        fetch(`${API_URL}/api/students?isActive=true`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_URL}/api/courses`,  { headers: { Authorization: `Bearer ${token}` } }),
      ])
      const [sData, cData] = await Promise.all([sRes.json(), cRes.json()])
      if (sRes.ok) setStudents(sData)
      if (cRes.ok) setCourses(cData)
    } catch { toast('Error de conexión', 'error') }
    finally  { setLoading(false) }
  }

  const fetchParents = async (search: string) => {
    setLoadingParents(true)
    try {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      const res  = await fetch(`${API_URL}/api/parents?${params}`, { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      if (res.ok) setParents(data)
    } catch { console.error('Error cargando padres') }
    finally  { setLoadingParents(false) }
  }

  useEffect(() => { fetchData() }, [])

  const openEnroll = (student: Student) => {
    setEnrollStudent(student); setEnrollMode('enroll')
    setSelectedCourse(''); setEnrollFilterLvl(''); setEnrollError(''); setShowEnrollModal(true)
  }

  const openChange = (student: Student) => {
    setEnrollStudent(student); setEnrollMode('change')
    setSelectedCourse(''); setEnrollFilterLvl(''); setEnrollError(''); setShowEnrollModal(true)
  }

  const handleEnroll = async () => {
    if (!selectedCourse || !enrollStudent) return
    setSaving(true); setEnrollError('')
    try {
      const method = enrollMode === 'change' ? 'PUT' : 'POST'
      const res    = await fetch(`${API_URL}/api/students/${enrollStudent.id}/enroll`, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ courseId: parseInt(selectedCourse) }),
      })
      const data = await res.json()
      if (!res.ok) { setEnrollError(data.message); return }
      toast(data.message, 'success')
      setShowEnrollModal(false)
      fetchData()
    } catch { setEnrollError('Error de conexión') }
    finally  { setSaving(false) }
  }

  const handleCancel = async (student: Student) => {
    const ok = await confirm(`¿Anular la inscripción de ${student.lastName} ${student.firstName}? El estudiante quedará sin curso.`, { danger: true, confirmLabel: 'Anular' })
    if (!ok) return
    setCanceling(student.id)
    try {
      const res  = await fetch(`${API_URL}/api/students/${student.id}/enroll`, {
        method:  'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (!res.ok) { toast(data.message, 'error'); return }
      toast(data.message, 'success')
      fetchData()
    } catch { toast('Error de conexión', 'error') }
    finally  { setCanceling(null) }
  }

  const openAssignTutor = (student: Student) => {
    setTutorStudent(student); setTutorMode('assign')
    setSelectedParent(null); setSearchParent(''); setParents([]); setTutorError(''); setShowTutorModal(true)
  }

  const openChangeTutor = (student: Student) => {
    setTutorStudent(student); setTutorMode('change')
    setSelectedParent(null); setSearchParent(''); setParents([]); setTutorError(''); setShowTutorModal(true)
  }

  const handleSearchParent = async () => {
    if (!searchParent.trim()) return
    await fetchParents(searchParent)
  }

  const handleSaveTutor = async () => {
    if (!selectedParent || !tutorStudent) return
    setSavingTutor(true); setTutorError('')
    try {
      if (tutorMode === 'assign') {
        await fetch(`${API_URL}/api/parents/${selectedParent}/link-students`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body:    JSON.stringify({ studentIds: [tutorStudent.id], relationType: 'TUTOR_LEGAL' }),
        })
      }
      const res  = await fetch(`${API_URL}/api/parents/student/${tutorStudent.id}/change-tutor`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ newTutorId: selectedParent }),
      })
      const data = await res.json()
      if (!res.ok) { setTutorError(data.message); return }
      toast(data.message, 'success')
      setShowTutorModal(false)
      fetchData()
    } catch { setTutorError('Error de conexión') }
    finally  { setSavingTutor(false) }
  }

  const sinInscripcion = students.filter(s => !s.assignments?.some(a => a.academicYear?.isActive))
  const inscritos      = students.filter(s =>  s.assignments?.some(a => a.academicYear?.isActive))

  const filterStudents = (list: Student[]) => {
    let result = list
    const q = search.toLowerCase()
    if (q) {
      result = result.filter(s =>
        s.firstName.toLowerCase().includes(q) ||
        s.lastName.toLowerCase().includes(q)  ||
        (s.ci   || '').toLowerCase().includes(q) ||
        (s.rude || '').toLowerCase().includes(q)
      )
    }
    if (filterCourse && tab === 'inscritos') {
      result = result.filter(s =>
        s.assignments?.some(a => a.academicYear?.isActive && a.course.id === parseInt(filterCourse))
      )
    }
    return result
  }

  const filteredEnrollCourses = enrollFilterLvl ? courses.filter(c => c.level === enrollFilterLvl) : courses
  const currentList   = filterStudents(tab === 'sin' ? sinInscripcion : inscritos)
  const getTutor      = (s: Student) => s.parents?.find(p => p.isTutor)
  const getAssignment = (s: Student) => s.assignments?.find(a => a.academicYear?.isActive)

  const baseColumns: Column<Student>[] = [
    { key: 'idx', header: '#', render: (s) => <span className="text-neutral-500">{currentList.indexOf(s) + 1}</span> },
    {
      key: 'student', header: 'Estudiante', render: (s) => (
        <div>
          <div className="font-medium text-brand-700">{s.lastName} {s.firstName}</div>
          <div className="text-[11px] text-neutral-500">{s.gender === 'MASCULINO' ? '👦' : s.gender === 'FEMENINO' ? '👧' : ''}</div>
        </div>
      ),
    },
    {
      key: 'ci', header: 'CI / RUDE', render: (s) => (
        <div className="text-neutral-500 text-xs">
          {s.ci && <div>CI: {s.ci}</div>}
          {s.rude && <div>RUDE: {s.rude}</div>}
          {!s.ci && !s.rude && '—'}
        </div>
      ),
    },
    {
      key: 'tutor', header: 'Tutor legal', render: (s) => {
        const tutor = getTutor(s)
        return tutor ? (
          <div>
            <div className="font-medium text-brand-700 text-sm">{tutor.parent.lastName} {tutor.parent.firstName}</div>
            <div className="text-[11px] text-neutral-500">{tutor.relationType}</div>
          </div>
        ) : <span className="text-[11px] text-danger-600 italic">Sin tutor</span>
      },
    },
    { key: 'phone', header: 'Teléfono', render: (s) => <span className="text-neutral-500 text-xs">{getTutor(s)?.parent.phone || '—'}</span> },
  ]

  const courseColumn: Column<Student> = {
    key: 'course', header: 'Curso', render: (s) => {
      const a = getAssignment(s)
      return a ? <Badge tone="success">{GRADES[a.course.grade]} &quot;{a.course.parallel}&quot; {SHIFTS[a.course.shift]}</Badge> : '—'
    },
  }

  const actionsColumn: Column<Student> = {
    key: 'actions', header: 'Acciones', render: (s) => {
      const tutor = getTutor(s)
      return (
        <div className="flex gap-1.5 flex-wrap">
          {tab === 'sin' ? (
            <Button size="sm" onClick={() => openEnroll(s)}><UserPlus size={13} /> Inscribir</Button>
          ) : (
            <>
              <Button size="sm" variant="secondary" onClick={() => openChange(s)}><RefreshCw size={13} /> Cambiar</Button>
              <Button size="sm" variant="danger" loading={canceling === s.id} onClick={() => handleCancel(s)}><X size={13} /> Anular</Button>
            </>
          )}
          {tutor ? (
            <Button size="sm" className="!bg-warning-100 !text-[#8A6116] hover:!bg-accent-500/25" onClick={() => openChangeTutor(s)}><UserCheck size={13} /> Tutor</Button>
          ) : (
            <Button size="sm" className="!bg-success-100 !text-success-700 hover:!bg-success-100/70" onClick={() => openAssignTutor(s)}><UserCheck size={13} /> Tutor</Button>
          )}
        </div>
      )
    },
  }

  const columns = tab === 'inscritos' ? [...baseColumns, courseColumn, actionsColumn] : [...baseColumns, actionsColumn]

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-brand-700 mb-1">Inscripciones</h1>
        <p className="text-[13px] text-neutral-500">Gestión de inscripciones del año activo</p>
      </div>

      <div className="grid gap-3 mb-5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
        <Card className="flex items-center gap-3 !bg-brand-700 !border-brand-700">
          <Users size={24} className="text-white" />
          <div>
            <div className="text-[11px] text-white/70 uppercase tracking-wide mb-0.5">Total estudiantes</div>
            <div className="text-xl font-bold text-white">{students.length}</div>
          </div>
        </Card>
        <Card className="flex items-center gap-3">
          <BookOpen size={24} className="text-success-700" />
          <div>
            <div className="text-[11px] text-neutral-500 uppercase tracking-wide mb-0.5">Inscritos</div>
            <div className="text-xl font-bold text-success-700">{inscritos.length}</div>
          </div>
        </Card>
        <Card className="flex items-center gap-3">
          <Users size={24} className="text-danger-600" />
          <div>
            <div className="text-[11px] text-neutral-500 uppercase tracking-wide mb-0.5">Sin inscripción</div>
            <div className="text-xl font-bold text-danger-600">{sinInscripcion.length}</div>
          </div>
        </Card>
      </div>

      <div className="flex bg-white border border-neutral-300 rounded-[10px] overflow-hidden mb-4">
        <button
          onClick={() => setTab('sin')}
          className={`flex-1 py-3 text-[13px] font-medium transition-colors ${tab === 'sin' ? 'bg-brand-700 text-white font-semibold' : 'text-neutral-500 hover:bg-neutral-100'}`}
        >
          Sin inscripción ({sinInscripcion.length})
        </button>
        <button
          onClick={() => setTab('inscritos')}
          className={`flex-1 py-3 text-[13px] font-medium transition-colors ${tab === 'inscritos' ? 'bg-brand-700 text-white font-semibold' : 'text-neutral-500 hover:bg-neutral-100'}`}
        >
          Inscritos ({inscritos.length})
        </button>
      </div>

      <div className="flex gap-2.5 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-info-500 pointer-events-none" />
          <input
            type="text" placeholder="Buscar por nombre, CI o RUDE..." value={search} onChange={e => setSearch(e.target.value)}
            className="w-full h-10 pl-9 pr-3 rounded-lg border border-neutral-300 text-sm outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/15"
          />
        </div>
        {tab === 'inscritos' && (
          <Select value={filterCourse} onChange={e => setFilterCourse(e.target.value)} className="w-auto min-w-[200px]">
            <option value="">Todos los cursos</option>
            {courses.map(c => <option key={c.id} value={c.id}>{GRADES[c.grade]} &quot;{c.parallel}&quot; {SHIFTS[c.shift]}</option>)}
          </Select>
        )}
      </div>

      <Table
        columns={columns}
        rows={currentList}
        rowKey={(s) => s.id}
        loading={loading}
        emptyLabel={tab === 'sin' ? '🎉 Todos los estudiantes están inscritos' : 'No hay estudiantes en este filtro'}
      />

      {/* ── Modal inscripción ── */}
      <Modal
        open={showEnrollModal && !!enrollStudent}
        onClose={() => setShowEnrollModal(false)}
        title={enrollMode === 'enroll' ? 'Inscribir estudiante' : 'Cambiar inscripción'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowEnrollModal(false)}>Cancelar</Button>
            <Button onClick={handleEnroll} loading={saving} disabled={!selectedCourse}>
              {enrollMode === 'enroll' ? 'Inscribir' : 'Cambiar curso'}
            </Button>
          </>
        }
      >
        {enrollStudent && (
          <div className="flex flex-col gap-3.5">
            <p className="text-xs text-neutral-500 -mt-2">{enrollStudent.lastName} {enrollStudent.firstName}</p>
            {enrollError && <p className="text-[13px] text-danger-600 bg-danger-100 rounded-lg px-3 py-2">{enrollError}</p>}
            {enrollMode === 'change' && (
              <div className="flex items-center gap-2.5 bg-neutral-100 border border-neutral-300 rounded-lg px-3.5 py-2.5 text-[13px]">
                <span className="text-neutral-500 font-medium whitespace-nowrap">Curso actual:</span>
                {(() => {
                  const a = getAssignment(enrollStudent)
                  return a ? <Badge tone="success">{GRADES[a.course.grade]} &quot;{a.course.parallel}&quot; {SHIFTS[a.course.shift]}</Badge> : <span className="text-neutral-500">Sin curso</span>
                })()}
              </div>
            )}
            <Select label="Filtrar por nivel" value={enrollFilterLvl} onChange={e => setEnrollFilterLvl(e.target.value)}>
              <option value="">Todos los niveles</option>
              <option value="INICIAL">Inicial</option>
              <option value="PRIMARIA">Primaria</option>
              <option value="SECUNDARIA">Secundaria</option>
            </Select>
            <Select label="Curso" required value={selectedCourse} onChange={e => setSelectedCourse(e.target.value)}>
              <option value="">— Seleccionar curso —</option>
              {filteredEnrollCourses.map(c => (
                <option key={c.id} value={c.id}>
                  {LEVELS[c.level]} — {GRADES[c.grade]} &quot;{c.parallel}&quot; {SHIFTS[c.shift]}
                  {c.educationType === 'BTH' ? ' · BTH' : ''} ({c._count.assignments} estudiantes)
                </option>
              ))}
            </Select>
            {(() => {
              const tutor = getTutor(enrollStudent)
              return tutor ? (
                <div className="bg-success-100 border border-success-500/30 rounded-lg p-3">
                  <div className="text-[11px] font-semibold text-success-700 uppercase tracking-wide mb-1">Tutor legal:</div>
                  <div className="text-[13px] font-semibold text-brand-700">{tutor.parent.lastName} {tutor.parent.firstName}</div>
                  {tutor.parent.phone && <div className="text-xs text-neutral-500 mt-0.5">📱 {tutor.parent.phone}</div>}
                </div>
              ) : (
                <p className="bg-warning-100 border border-accent-500 rounded-lg px-3.5 py-2.5 text-[13px] text-[#7A6000]">
                  ⚠️ Este estudiante no tiene tutor legal asignado.
                </p>
              )
            })()}
          </div>
        )}
      </Modal>

      {/* ── Modal tutor ── */}
      <Modal
        open={showTutorModal && !!tutorStudent}
        onClose={() => setShowTutorModal(false)}
        title={tutorMode === 'assign' ? 'Asignar tutor legal' : 'Cambiar tutor legal'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowTutorModal(false)}>Cancelar</Button>
            <Button onClick={handleSaveTutor} loading={savingTutor} disabled={!selectedParent}>
              {tutorMode === 'assign' ? 'Asignar tutor' : 'Cambiar tutor'}
            </Button>
          </>
        }
      >
        {tutorStudent && (
          <div className="flex flex-col gap-3.5">
            <p className="text-xs text-neutral-500 -mt-2">{tutorStudent.lastName} {tutorStudent.firstName}</p>
            {tutorError && <p className="text-[13px] text-danger-600 bg-danger-100 rounded-lg px-3 py-2">{tutorError}</p>}
            {tutorMode === 'change' && (
              <div className="flex items-center gap-2.5 bg-neutral-100 border border-neutral-300 rounded-lg px-3.5 py-2.5 text-[13px]">
                <span className="text-neutral-500 font-medium whitespace-nowrap">Tutor actual:</span>
                {(() => {
                  const t = getTutor(tutorStudent)
                  return t ? <span className="text-brand-700 font-medium">{t.parent.lastName} {t.parent.firstName}</span> : <span className="text-neutral-500">Sin tutor</span>
                })()}
              </div>
            )}
            <div className="flex gap-2.5">
              <div className="relative flex-1">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-info-500 pointer-events-none" />
                <input
                  type="text" placeholder="Buscar padre por nombre o CI..."
                  value={searchParent} onChange={e => setSearchParent(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSearchParent()}
                  className="w-full h-10 pl-9 pr-3 rounded-lg border border-neutral-300 text-sm outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/15"
                />
              </div>
              <Button onClick={handleSearchParent} loading={loadingParents}><Search size={14} /> Buscar</Button>
            </div>
            {loadingParents ? (
              <p className="text-center text-sm text-neutral-500 py-6">Cargando...</p>
            ) : parents.length === 0 && searchParent ? (
              <p className="text-sm text-neutral-500 italic py-2">No se encontraron padres</p>
            ) : parents.length === 0 ? (
              <p className="text-sm text-neutral-500 italic py-2">Busca un padre para asignar como tutor</p>
            ) : (
              <div className="flex flex-col gap-2 max-h-[250px] overflow-y-auto">
                {parents.map(p => (
                  <label key={p.id} className={`flex items-start gap-2.5 p-2.5 border rounded-lg cursor-pointer ${selectedParent === p.id ? 'border-brand-700 bg-brand-100' : 'border-neutral-300 hover:bg-neutral-100'}`}>
                    <input type="radio" name="parent" checked={selectedParent === p.id} onChange={() => setSelectedParent(p.id)} className="accent-brand-700 mt-0.5 shrink-0" />
                    <div className="flex flex-col gap-0.5">
                      <div className="text-[13px] font-semibold text-brand-700">{p.lastName} {p.firstName}</div>
                      <div className="flex gap-2.5 text-[11px] text-neutral-500 flex-wrap">
                        {p.ci && <span>CI: {p.ci}</span>}
                        {p.phone && <span>📱 {p.phone}</span>}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}
