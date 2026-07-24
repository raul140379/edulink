'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  ArrowLeft, BookOpen, Plus, Trash2, Clock,
  User, Save, GraduationCap, CheckCircle2, Search
} from 'lucide-react'
import Card from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { useConfirm } from '@/components/ui/ConfirmProvider'
import { useToast } from '@/components/ui/ToastProvider'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

interface Teacher {
  id: number; firstName: string; lastName: string
  ci?: string; phone?: string; email?: string
  specialty?: string; hoursLoad?: number; gender?: string; isActive: boolean
  attendanceCode?: string
  entryTime?: string
  exitTime?: string
  toleranceMin?: number
  user?: { email: string; role: string }
  assignments: Assignment[]
}

interface Assignment {
  id: number; subjectId: number; courseId: number
  subject: { id: number; name: string; code?: string; campo?: string }
  course:  { id: number; grade: string; parallel: string; level: string; shift: string; educationType: string }
}

interface Course {
  id: number; grade: string; parallel: string; level: string; shift: string; educationType: string
}

interface Specialty {
  id: number
  subject: { id: number; name: string; campo?: string }
}

interface OccupiedCourse {
  courseId: number
  teacher: { id: number; firstName: string; lastName: string }
}

const GRADE_ORDER: Record<string, number> = { PRIMERO:1, SEGUNDO:2, TERCERO:3, CUARTO:4, QUINTO:5, SEXTO:6 }
const GRADES:  Record<string,string> = { PRIMERO:'1°', SEGUNDO:'2°', TERCERO:'3°', CUARTO:'4°', QUINTO:'5°', SEXTO:'6°' }
const SHIFTS:  Record<string,string> = { MORNING:'Mañana', AFTERNOON:'Tarde', NIGHT:'Noche' }
const LEVELS:  Record<string,string> = { INICIAL:'Inicial', PRIMARIA:'Primaria', SECUNDARIA:'Secundaria' }
const CAMPO_LABELS: Record<string,string> = {
  VIDA_TIERRA_TERRITORIO:'Vida, Tierra y Territorio',
  COMUNIDAD_SOCIEDAD:'Comunidad y Sociedad',
  COSMOS_PENSAMIENTO:'Cosmos y Pensamiento',
  CIENCIA_TECNOLOGIA_PRODUCCION:'Ciencia, Tecnología y Producción',
}
const CAMPO_TONE: Record<string, 'success' | 'brand' | 'info' | 'warning' | 'neutral'> = {
  VIDA_TIERRA_TERRITORIO:        'success',
  COMUNIDAD_SOCIEDAD:            'brand',
  COSMOS_PENSAMIENTO:            'info',
  CIENCIA_TECNOLOGIA_PRODUCCION: 'warning',
}
const CAMPO_ICONS: Record<string,string> = {
  VIDA_TIERRA_TERRITORIO:'🌿', COMUNIDAD_SOCIEDAD:'🌐',
  COSMOS_PENSAMIENTO:'✨', CIENCIA_TECNOLOGIA_PRODUCCION:'⚙️',
}

export default function TeacherDetailPage() {
  const params  = useParams()
  const router  = useRouter()
  const confirm = useConfirm()
  const toast   = useToast()
  const id      = params.id as string

  const [teacher,         setTeacher]         = useState<Teacher | null>(null)
  const [specialties,     setSpecialties]     = useState<Specialty[]>([])
  const [courses,         setCourses]         = useState<Course[]>([])
  const [occupied,        setOccupied]        = useState<OccupiedCourse[]>([])
  const [loading,         setLoading]         = useState(true)
  const [showModal,       setShowModal]       = useState(false)
  const [selectedCourses, setSelectedCourses] = useState<number[]>([])
  const [selectedSubject, setSelectedSubject] = useState('')
  const [subjectSearch,   setSubjectSearch]   = useState('')
  const [courseSearch,    setCourseSearch]    = useState('')
  const [saving,          setSaving]          = useState(false)
  const [removing,        setRemoving]        = useState<number | null>(null)
  const [attCode,         setAttCode]         = useState('')
  const [savingCode,      setSavingCode]      = useState(false)
  const [entryTime,       setEntryTime]       = useState('')
  const [exitTime,        setExitTime]        = useState('')
  const [toleranceMin,    setToleranceMin]    = useState('10')
  const [savingSchedule,  setSavingSchedule]  = useState(false)

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : ''

  const fetchTeacher = async () => {
    setLoading(true)
    try {
      const res  = await fetch(`${API_URL}/api/teachers/${id}`, { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      if (res.ok) {
        setTeacher(data)
        setAttCode(data.attendanceCode || '')
        setEntryTime(data.entryTime || '')
        setExitTime(data.exitTime || '')
        setToleranceMin(data.toleranceMin != null ? String(data.toleranceMin) : '10')
      }
      else toast('Error al cargar maestro', 'error')
    } catch { toast('Error de conexión', 'error') }
    finally  { setLoading(false) }
  }

  const fetchSpecialties = async () => {
    try {
      const res  = await fetch(`${API_URL}/api/teachers/${id}/specialties`, { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      if (res.ok) setSpecialties(data)
    } catch { console.error('Error cargando especialidades') }
  }

  const fetchCourses = async () => {
    try {
      const res  = await fetch(`${API_URL}/api/courses`, { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      if (res.ok) setCourses(data)
    } catch { console.error('Error cargando cursos') }
  }

  const fetchOccupied = async (subjectId: string) => {
    if (!subjectId) { setOccupied([]); return }
    try {
      const res  = await fetch(`${API_URL}/api/subjects/${subjectId}/occupied-courses`, { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      if (res.ok) setOccupied(data)
    } catch { console.error('Error cargando cursos ocupados') }
  }

  useEffect(() => { fetchTeacher() }, [id])

  const openModal = async () => {
    setSelectedCourses([]); setSelectedSubject('')
    setSubjectSearch(''); setCourseSearch(''); setOccupied([])
    setShowModal(true)
    await Promise.all([fetchSpecialties(), fetchCourses()])
  }

  const handleSelectSubject = (subjectId: string) => {
    setSelectedSubject(subjectId)
    setSelectedCourses([])
    fetchOccupied(subjectId)
  }

  const toggleCourse = (courseId: number, isOccupiedByOther: boolean) => {
    if (isOccupiedByOther) return
    setSelectedCourses(prev =>
      prev.includes(courseId) ? prev.filter(c => c !== courseId) : [...prev, courseId]
    )
  }

  const handleGenerateCode = async () => {
    setSavingCode(true)
    try {
      const res  = await fetch(`${API_URL}/api/teachers/${id}/generate-attendance-code`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}` }
      })
      const data = await res.json()
      if (!res.ok) { toast(data.message, 'error'); return }
      setAttCode(data.teacher.attendanceCode)
      setTeacher(prev => prev ? {...prev, attendanceCode: data.teacher.attendanceCode} : prev)
      toast('Código generado correctamente', 'success')
    } catch { toast('Error de conexión', 'error') }
    finally { setSavingCode(false) }
  }

  const handleSaveCode = async () => {
    if (!attCode.trim()) { toast('Ingresa un código', 'error'); return }
    setSavingCode(true)
    try {
      const res  = await fetch(`${API_URL}/api/teachers/${id}/attendance-code`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ code: attCode.trim() })
      })
      const data = await res.json()
      if (!res.ok) { toast(data.message, 'error'); return }
      toast('Código asignado correctamente', 'success')
      setAttCode(data.teacher.attendanceCode)
    } catch { toast('Error de conexión', 'error') }
    finally  { setSavingCode(false) }
  }

  const handleSaveSchedule = async () => {
    setSavingSchedule(true)
    try {
      const res  = await fetch(`${API_URL}/api/teachers/${id}/schedule`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ entryTime, exitTime, toleranceMin: parseInt(toleranceMin) })
      })
      const data = await res.json()
      if (!res.ok) { toast(data.message, 'error'); return }
      toast('Horario guardado correctamente', 'success')
    } catch { toast('Error de conexión', 'error') }
    finally  { setSavingSchedule(false) }
  }

  const handleAssign = async () => {
    if (selectedCourses.length === 0 || !selectedSubject) {
      toast('Selecciona una materia y al menos un curso', 'error'); return
    }
    setSaving(true)
    try {
      const res  = await fetch(`${API_URL}/api/subjects/assign-bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          subjectId: parseInt(selectedSubject),
          teacherId: parseInt(id),
          courseIds: selectedCourses,
        }),
      })
      const data = await res.json()
      if (!res.ok) { toast(data.message, 'error'); return }
      toast(data.message, 'success')
      setShowModal(false)
      fetchTeacher()
    } catch { toast('Error de conexión', 'error') }
    finally  { setSaving(false) }
  }

  const handleRemove = async (assignmentId: number) => {
    if (!await confirm('¿Quitar esta asignación?', { danger: true })) return
    setRemoving(assignmentId)
    try {
      const res  = await fetch(`${API_URL}/api/subjects/assign/${assignmentId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      if (res.ok) { toast(data.message, 'success'); fetchTeacher() }
      else toast(data.message, 'error')
    } catch { toast('Error al quitar asignación', 'error') }
    finally  { setRemoving(null) }
  }

  const groupByCourse = (assignments: Assignment[]) => {
    const map: Record<number, { course: Assignment['course']; items: Assignment[] }> = {}
    for (const a of assignments) {
      if (!map[a.courseId]) map[a.courseId] = { course: a.course, items: [] }
      map[a.courseId].items.push(a)
    }
    return Object.values(map).sort((a, b) => {
      const gradeDiff = (GRADE_ORDER[a.course.grade] || 99) - (GRADE_ORDER[b.course.grade] || 99)
      if (gradeDiff !== 0) return gradeDiff
      return a.course.parallel.localeCompare(b.course.parallel)
    })
  }

  if (loading) return <div className="flex justify-center py-16"><p className="text-sm text-neutral-500">Cargando...</p></div>
  if (!teacher) return <div className="flex justify-center py-16"><p className="text-sm text-neutral-500">Maestro no encontrado</p></div>

  const grouped       = groupByCourse(teacher.assignments)
  const totalMaterias = teacher.assignments.length

  const previewSubject = specialties.find(s => s.subject.id === parseInt(selectedSubject))
  const previewCourses = courses.filter(c => selectedCourses.includes(c.id))

  const filteredSpecialties = specialties.filter(sp =>
    subjectSearch === '' || sp.subject.name.toLowerCase().includes(subjectSearch.toLowerCase())
  )
  const filteredCourses = courses
    .filter(c => {
      const label = `${GRADES[c.grade]} ${c.parallel} ${SHIFTS[c.shift]} ${LEVELS[c.level]}`.toLowerCase()
      return courseSearch === '' || label.includes(courseSearch.toLowerCase())
    })
    .sort((a, b) => {
      const gradeDiff = (GRADE_ORDER[a.grade] || 99) - (GRADE_ORDER[b.grade] || 99)
      if (gradeDiff !== 0) return gradeDiff
      return a.parallel.localeCompare(b.parallel)
    })

  const getOccupiedBy = (courseId: number) => occupied.find(o => o.courseId === courseId)

  return (
    <div>
      <div className="flex items-start gap-4 mb-5 flex-wrap">
        <button onClick={() => router.back()} className="flex items-center gap-1.5 text-neutral-500 hover:text-brand-700 text-[13px] py-1.5 shrink-0">
          <ArrowLeft size={16}/> Volver
        </button>
        <div className="flex-1 min-w-[200px]">
          <h1 className="text-xl font-bold text-brand-700 mb-1">{teacher.lastName} {teacher.firstName}</h1>
          <p className="text-[13px] text-neutral-500">{teacher.specialty || 'Sin especialidad registrada'}</p>
        </div>
        <Button onClick={openModal}><Plus size={15}/> Agregar asignación</Button>
      </div>

      {/* Info */}
      <Card className="flex flex-wrap gap-x-6 gap-y-2.5 mb-5">
        <div className="flex items-center gap-1.5 text-[13px]"><User size={15} className="text-info-500"/><span className="text-neutral-500 font-medium">CI:</span><span className="text-brand-700">{teacher.ci || '—'}</span></div>
        <div className="flex items-center gap-1.5 text-[13px]"><span className="text-neutral-500 font-medium">Teléfono:</span><span className="text-brand-700">{teacher.phone || '—'}</span></div>
        <div className="flex items-center gap-1.5 text-[13px]"><span className="text-neutral-500 font-medium">Email:</span><span className="text-brand-700">{teacher.user?.email || teacher.email || '—'}</span></div>
        <div className="flex items-center gap-1.5 text-[13px]">
          <Clock size={15} className="text-info-500"/>
          <span className="text-neutral-500 font-medium">Carga hrs/mes:</span>
          <span className="text-brand-700">{teacher.hoursLoad ? <Badge tone="warning">{teacher.hoursLoad} hrs</Badge> : '—'}</span>
        </div>
        <div className="flex items-center gap-1.5 text-[13px]">
          <GraduationCap size={15} className="text-info-500"/>
          <span className="text-neutral-500 font-medium">Asignaciones:</span>
          <span className="text-brand-700"><strong>{grouped.length}</strong> cursos · <strong>{totalMaterias}</strong> materias</span>
        </div>

        {/* Código de asistencia */}
        <div className="flex items-center gap-1.5 text-[13px] w-full mt-2 pt-2 border-t border-neutral-100">
          <span className="text-neutral-500 font-medium">Código de Asistencia:</span>
          <div className="flex items-center gap-2 flex-1 flex-wrap">
            <input
              type="text"
              value={attCode}
              onChange={e=>setAttCode(e.target.value.toUpperCase())}
              placeholder="Ej: ZF4706"
              maxLength={10}
              className="px-2.5 py-1.5 border border-neutral-300 rounded-md text-[13px] text-brand-700 outline-none w-[120px] font-bold tracking-[2px] text-center"
            />
            <Button variant="secondary" size="sm" onClick={handleGenerateCode} disabled={savingCode}>🔄 Generar</Button>
            <Button size="sm" onClick={handleSaveCode} disabled={savingCode} loading={savingCode}>
              {!savingCode && <Save size={12}/>} {savingCode ? 'Guardando...' : 'Guardar'}
            </Button>
            {teacher.attendanceCode && <Badge tone="success">✅ Activo: {teacher.attendanceCode}</Badge>}
          </div>
        </div>

        {/* Horario personal */}
        <div className="flex items-center gap-1.5 text-[13px] w-full mt-2 pt-2 border-t border-neutral-100">
          <span className="text-neutral-500 font-medium">Horario personal:</span>
          <div className="flex items-center gap-3 flex-1 flex-wrap">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-neutral-500 font-semibold">Entrada:</span>
              <input type="time" value={entryTime} onChange={e=>setEntryTime(e.target.value)}
                className="px-2 py-1 border border-neutral-300 rounded-md text-[13px] text-brand-700 outline-none"/>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-neutral-500 font-semibold">Salida:</span>
              <input type="time" value={exitTime} onChange={e=>setExitTime(e.target.value)}
                className="px-2 py-1 border border-neutral-300 rounded-md text-[13px] text-brand-700 outline-none"/>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-neutral-500 font-semibold">Tolerancia:</span>
              <input type="number" min={0} max={30} value={toleranceMin} onChange={e=>setToleranceMin(e.target.value)}
                className="px-2 py-1 border border-neutral-300 rounded-md text-[13px] text-brand-700 outline-none w-[60px]"/>
              <span className="text-[11px] text-neutral-500">min</span>
            </div>
            <Button size="sm" onClick={handleSaveSchedule} disabled={savingSchedule} loading={savingSchedule} className="!bg-warning-500 !border-warning-500">
              {!savingSchedule && <Save size={12}/>} {savingSchedule ? 'Guardando...' : 'Guardar horario'}
            </Button>
            {teacher.entryTime && (
              <Badge tone="warning">🕐 {teacher.entryTime} — {teacher.exitTime||'—'} · {teacher.toleranceMin??10}min tolerancia</Badge>
            )}
          </div>
        </div>
      </Card>

      <div className="flex items-center gap-2 text-sm font-bold text-brand-700 mb-3 uppercase tracking-wide">
        <BookOpen size={16}/> Cursos y materias asignadas
      </div>

      {grouped.length === 0 ? (
        <div className="text-center py-12 text-neutral-500 flex flex-col items-center gap-3 bg-white border border-dashed border-neutral-300 rounded-xl">
          <BookOpen size={32} className="opacity-30"/>
          <p>Este maestro no tiene asignaciones aún.</p>
          <Button onClick={openModal}><Plus size={14}/> Agregar primera asignación</Button>
        </div>
      ) : (
        grouped.map(({ course, items }) => (
          <Card key={course.id} padded={false} className="overflow-hidden mb-3">
            <div className="flex items-center justify-between px-4 py-3 bg-neutral-100 border-b border-neutral-300/60 flex-wrap gap-2">
              <div className="flex items-center gap-2 font-bold text-brand-700 text-sm flex-wrap">
                <GraduationCap size={16}/>
                <span>{GRADES[course.grade]} &quot;{course.parallel}&quot;</span>
                <Badge tone="brand">{SHIFTS[course.shift]}</Badge>
                <Badge tone="success">{LEVELS[course.level]}</Badge>
                {course.educationType === 'BTH' && <Badge tone="warning">BTH</Badge>}
              </div>
              <span className="text-xs text-neutral-500">{items.length} materia{items.length !== 1 ? 's' : ''}</span>
            </div>
            <div className="flex flex-col">
              {items.map(a => (
                <div key={a.id} className="flex items-center justify-between px-4 py-2.5 border-t border-neutral-100 hover:bg-neutral-100/40">
                  <div className="flex items-center gap-2.5">
                    <Badge tone={CAMPO_TONE[a.subject.campo||''] || 'neutral'}>{CAMPO_LABELS[a.subject.campo||'']||'Sin campo'}</Badge>
                    <span className="text-[13px] font-medium text-brand-700">{a.subject.name}</span>
                  </div>
                  <button
                    onClick={() => handleRemove(a.id)} disabled={removing === a.id} title="Quitar asignación"
                    className="w-7 h-7 rounded-md bg-danger-100 text-danger-600 flex items-center justify-center shrink-0 hover:opacity-75 disabled:opacity-40 transition-opacity"
                  >
                    <Trash2 size={13}/>
                  </button>
                </div>
              ))}
            </div>
          </Card>
        ))
      )}

      <Modal
        open={showModal} onClose={() => setShowModal(false)} title="Agregar asignación"
        maxWidth={480}
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowModal(false)}>Cancelar</Button>
            <Button onClick={handleAssign} disabled={saving || selectedCourses.length === 0 || !selectedSubject} loading={saving}>
              {!saving && <Save size={14}/>} {saving ? 'Guardando...' : `Asignar (${selectedCourses.length})`}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3.5">
          <p className="text-xs text-neutral-500 -mt-1">{teacher.lastName} {teacher.firstName}</p>

          <div>
            <label className="text-[11px] font-semibold text-brand-700 uppercase tracking-wide block mb-1.5">Materia *</label>
            {specialties.length === 0 ? (
              <div className="bg-warning-100 border border-warning-500 rounded-lg px-3.5 py-2.5 text-[13px] text-[#7A6000] leading-relaxed">
                ⚠️ Este maestro no tiene materias como especialidad. Agrégalas primero.
              </div>
            ) : (
              <>
                <div className="relative mb-1.5">
                  <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-info-500 pointer-events-none"/>
                  <input
                    type="text" placeholder="Buscar materia..." value={subjectSearch}
                    onChange={e => setSubjectSearch(e.target.value)}
                    className="w-full pl-8 pr-2.5 py-2 border border-neutral-300 rounded-lg text-[13px] text-brand-700 outline-none"
                  />
                </div>
                <div className="border border-neutral-300 rounded-lg max-h-[200px] overflow-y-auto">
                  {filteredSpecialties.length === 0 ? (
                    <div className="p-3 text-center text-xs text-neutral-500 italic">No se encontraron materias</div>
                  ) : (
                    filteredSpecialties.map(sp => {
                      const campo = sp.subject.campo
                      const sel   = selectedSubject === String(sp.subject.id)
                      return (
                        <label
                          key={sp.subject.id}
                          className={`flex items-center gap-2 px-2.5 py-1.5 cursor-pointer border-b border-neutral-100 last:border-b-0 transition-colors ${sel ? 'bg-brand-100 border-l-2 border-l-brand-700' : 'hover:bg-neutral-100/60'}`}
                        >
                          <input type="radio" name="subject" value={sp.subject.id}
                            checked={sel} onChange={() => handleSelectSubject(String(sp.subject.id))}
                            className="shrink-0 w-3.5 h-3.5 accent-[var(--color-brand-700)]"/>
                          <div className="flex-1 flex flex-col gap-0.5">
                            <span className="text-xs font-medium text-brand-700">{sp.subject.name}</span>
                            {campo && <Badge tone={CAMPO_TONE[campo] || 'neutral'}>{CAMPO_ICONS[campo]||'📌'} {CAMPO_LABELS[campo]||campo}</Badge>}
                          </div>
                        </label>
                      )
                    })
                  )}
                </div>
              </>
            )}
          </div>

          <div>
            <label className="text-[11px] font-semibold text-brand-700 uppercase tracking-wide block mb-1.5">
              Cursos * {selectedCourses.length > 0 && <span className="text-success-700 font-bold">({selectedCourses.length} seleccionados)</span>}
            </label>
            <div className="relative mb-1.5">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-info-500 pointer-events-none"/>
              <input
                type="text" placeholder="Buscar curso..." value={courseSearch}
                onChange={e => setCourseSearch(e.target.value)} disabled={!selectedSubject}
                className="w-full pl-8 pr-2.5 py-2 border border-neutral-300 rounded-lg text-[13px] text-brand-700 outline-none disabled:opacity-50 disabled:bg-neutral-100"
              />
            </div>
            <div className={`border border-neutral-300 rounded-lg max-h-[200px] overflow-y-auto ${!selectedSubject ? 'opacity-50 pointer-events-none' : ''}`}>
              {!selectedSubject ? (
                <div className="p-3 text-center text-xs text-neutral-500 italic">Selecciona primero una materia</div>
              ) : filteredCourses.length === 0 ? (
                <div className="p-3 text-center text-xs text-neutral-500 italic">No se encontraron cursos</div>
              ) : (
                filteredCourses.map(c => {
                  const sel        = selectedCourses.includes(c.id)
                  const occupiedBy = getOccupiedBy(c.id)
                  const blocked    = !!occupiedBy
                  return (
                    <label
                      key={c.id}
                      className={`flex items-center gap-2 px-2.5 py-1.5 border-b border-neutral-100 last:border-b-0 transition-colors ${
                        blocked ? 'cursor-not-allowed opacity-55 bg-danger-100/40' :
                        sel     ? 'cursor-pointer bg-brand-100 border-l-2 border-l-brand-700' :
                                  'cursor-pointer hover:bg-neutral-100/60'
                      }`}
                    >
                      <input type="checkbox" value={c.id}
                        checked={sel} disabled={blocked}
                        onChange={() => toggleCourse(c.id, blocked)}
                        className="shrink-0 w-3.5 h-3.5 accent-[var(--color-brand-700)]"/>
                      <div className="flex-1 flex flex-col gap-0.5">
                        <span className="text-xs font-medium text-brand-700">{GRADES[c.grade]} &quot;{c.parallel}&quot; · {SHIFTS[c.shift]}</span>
                        <span className="text-[11px] text-neutral-500">
                          {LEVELS[c.level]}{c.educationType === 'BTH' ? ' · BTH' : ''}
                          {blocked && <span className="text-danger-600 font-semibold"> · Ya asignado a {occupiedBy!.teacher.lastName} {occupiedBy!.teacher.firstName}</span>}
                        </span>
                      </div>
                    </label>
                  )
                })
              )}
            </div>
          </div>

          {previewCourses.length > 0 && previewSubject && (
            <div className="flex items-start gap-2 bg-success-100 border border-success-500/40 rounded-lg px-3.5 py-2.5 text-[13px] text-success-700 leading-relaxed">
              <CheckCircle2 size={14} className="mt-0.5 shrink-0"/>
              <span>
                <strong>{teacher.firstName}</strong> enseñará <strong>{previewSubject.subject.name}</strong> en{' '}
                {previewCourses.map((c, i) => (
                  <strong key={c.id}>
                    {GRADES[c.grade]} &quot;{c.parallel}&quot; {SHIFTS[c.shift]}{i < previewCourses.length - 1 ? ', ' : ''}
                  </strong>
                ))}
              </span>
            </div>
          )}
        </div>
      </Modal>
    </div>
  )
}
