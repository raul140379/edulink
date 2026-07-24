'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Users, BookOpen, Clock, GraduationCap, CheckCircle2, AlertCircle, Trash2, Plus, RefreshCw, Copy, Check, X, Search } from 'lucide-react'
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
  tutorUserId?: number
  tutorUser?:   { email: string; isActive: boolean }
}

interface Course {
  id: number; level: string; grade: string; parallel: string
  educationType: string; shift: string
  _count: { assignments: number }
  tutor?: { teacher: Teacher }
}

interface PlanItem {
  gradeConfigId: number
  subjectId:     number
  subject:       { id: number; name: string; code: string; campo: string | null }
  hoursPerWeek:  number
  teacher:       { id: number; firstName: string; lastName: string } | null
  assignmentId:  number | null
}

interface CoursePlan {
  course:        { id: number; grade: string; parallel: string; level: string; educationType: string }
  totalHours:    number
  totalSubjects: number
  assignedCount: number
  pendingCount:  number
  grouped:       Record<string, PlanItem[]>
  campoOrder:    string[]
}

interface Assignment {
  id: number; year: number
  student: { id: number; firstName: string; lastName: string; ci?: string; rude?: string }
}

interface Credentials {
  accessEmail:     string
  defaultPassword: string
  name:            string
}

interface Subject {
  id: number; name: string; code?: string; campo?: string
}

const LEVELS = { INICIAL:'Inicial', PRIMARIA:'Primaria', SECUNDARIA:'Secundaria' } as Record<string,string>
const GRADES = { PRIMERO:'1°', SEGUNDO:'2°', TERCERO:'3°', CUARTO:'4°', QUINTO:'5°', SEXTO:'6°' } as Record<string,string>
const SHIFTS = { MORNING:'Mañana', AFTERNOON:'Tarde', NIGHT:'Noche' } as Record<string,string>

const CAMPO_LABELS: Record<string,string> = {
  VIDA_TIERRA_TERRITORIO:        'Vida, Tierra y Territorio',
  COMUNIDAD_SOCIEDAD:            'Comunidad y Sociedad',
  COSMOS_PENSAMIENTO:            'Cosmos y Pensamiento',
  CIENCIA_TECNOLOGIA_PRODUCCION: 'Ciencia, Tecnología y Producción',
  SIN_CAMPO:                     'Sin campo asignado',
}
const CAMPO_TONE: Record<string, 'success' | 'brand' | 'info' | 'warning' | 'neutral'> = {
  VIDA_TIERRA_TERRITORIO:        'success',
  COMUNIDAD_SOCIEDAD:            'brand',
  COSMOS_PENSAMIENTO:            'info',
  CIENCIA_TECNOLOGIA_PRODUCCION: 'warning',
  SIN_CAMPO:                     'neutral',
}
const CAMPO_ICONS: Record<string,string> = {
  VIDA_TIERRA_TERRITORIO:        '🌿',
  COMUNIDAD_SOCIEDAD:            '🌐',
  COSMOS_PENSAMIENTO:            '✨',
  CIENCIA_TECNOLOGIA_PRODUCCION: '⚙️',
  SIN_CAMPO:                     '📌',
}
const LEVEL_TONE: Record<string, 'success' | 'brand' | 'warning'> = { INICIAL:'success', PRIMARIA:'brand', SECUNDARIA:'warning' }
const SHIFT_TONE: Record<string, 'brand' | 'warning' | 'info'> = { MORNING:'brand', AFTERNOON:'warning', NIGHT:'info' }

export default function CourseDetailPage() {
  const params  = useParams()
  const router  = useRouter()
  const confirm = useConfirm()
  const toast   = useToast()
  const id      = params.id as string

  const [course,         setCourse]         = useState<Course | null>(null)
  const [plan,           setPlan]           = useState<CoursePlan | null>(null)
  const [assignments,    setAssignments]    = useState<Assignment[]>([])
  const [periodsSummary, setPeriodsSummary] = useState<Record<number,number>>({})
  const [schoolSch,      setSchoolSch]      = useState<any>(null)
  const [loading,        setLoading]        = useState(true)
  const [removing,       setRemoving]       = useState<number | null>(null)
  const [removingPlan,   setRemovingPlan]   = useState<number | null>(null)
  const [working,        setWorking]        = useState(false)
  const [creds,          setCreds]          = useState<Credentials | null>(null)
  const [copied,         setCopied]         = useState(false)

  const [showAddSubject,  setShowAddSubject]  = useState(false)
  const [allSubjects,     setAllSubjects]     = useState<Subject[]>([])
  const [subjectSearch,   setSubjectSearch]   = useState('')
  const [selectedSubject, setSelectedSubject] = useState<number | null>(null)
  const [hoursPerWeek,    setHoursPerWeek]    = useState('4')
  const [addingSubject,   setAddingSubject]   = useState(false)

  const userRole = typeof window !== 'undefined'
    ? JSON.parse(localStorage.getItem('user') || '{}').role
    : ''
  const isDirector = userRole === 'DIRECTOR' || userRole === 'SUPER_ADMIN'

  const auth = () => ({ Authorization: `Bearer ${localStorage.getItem('token') || ''}` })

  const fetchData = async () => {
    setLoading(true)
    try {
      const [cRes, aRes, pRes] = await Promise.all([
        fetch(`${API_URL}/api/courses/${id}`,          { headers: auth() }),
        fetch(`${API_URL}/api/courses/${id}/students`, { headers: auth() }),
        fetch(`${API_URL}/api/subjects/plan/${id}`,    { headers: auth() }),
      ])
      const [cData, aData, pData] = await Promise.all([cRes.json(), aRes.json(), pRes.json()])
      if (cRes.ok) {
        setCourse(cData)
        fetchSchoolSchedule(cData.shift)
        fetchPeriodsSummary()
      }
      if (aRes.ok) setAssignments(aData)
      if (pRes.ok) setPlan(pData)
    } catch (e) { console.error(e) }
    finally     { setLoading(false) }
  }

  const fetchPeriodsSummary = async () => {
    try {
      const res  = await fetch(`${API_URL}/api/schedules/course/${id}/periods-summary`, { headers: auth() })
      const data = await res.json()
      if (res.ok) setPeriodsSummary(data.summary || {})
    } catch { console.error('Error al obtener resumen de periodos') }
  }

  const fetchSchoolSchedule = async (shift: string) => {
    try {
      const res  = await fetch(`${API_URL}/api/schedules/school-schedules`, { headers: auth() })
      const data = await res.json()
      if (res.ok) {
        const active = data.find((s: any) => s.isActive && s.shift === shift)
        setSchoolSch(active || null)
      }
    } catch { console.error('Error al obtener horario institucional') }
  }

  const fetchAllSubjects = async () => {
    try {
      const res  = await fetch(`${API_URL}/api/subjects`, { headers: auth() })
      const data = await res.json()
      if (res.ok) setAllSubjects(data)
    } catch { console.error('Error al cargar materias') }
  }

  useEffect(() => { fetchData() }, [id])

  const handleRemoveAssignment = async (assignmentId: number) => {
    if (!await confirm('¿Quitar este maestro de la materia?', { danger: true })) return
    setRemoving(assignmentId)
    try {
      const res = await fetch(`${API_URL}/api/subjects/assign/${assignmentId}`, { method: 'DELETE', headers: auth() })
      if (res.ok) { toast('Maestro quitado correctamente', 'success'); fetchData() }
    } catch { console.error('Error al quitar asignación') }
    finally  { setRemoving(null) }
  }

  const handleRemoveFromPlan = async (gradeConfigId: number, subjectName: string) => {
    if (!await confirm(`¿Eliminar "${subjectName}" del plan de estudios? Esto también quitará al maestro asignado.`, { danger: true })) return
    setRemovingPlan(gradeConfigId)
    try {
      const res  = await fetch(`${API_URL}/api/subjects/grade-config/${gradeConfigId}`, { method: 'DELETE', headers: auth() })
      const data = await res.json()
      if (res.ok) { toast(data.message, 'success'); fetchData() }
      else toast(data.message, 'error')
    } catch { toast('Error de conexión', 'error') }
    finally  { setRemovingPlan(null) }
  }

  const handleAddSubjectToPlan = async () => {
    if (!selectedSubject || !plan) return
    setAddingSubject(true)
    try {
      const res  = await fetch(`${API_URL}/api/subjects/grade-config`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', ...auth() },
        body:    JSON.stringify({
          subjectId:     selectedSubject,
          grade:         plan.course.grade,
          educationType: plan.course.educationType,
          hoursPerWeek:  parseInt(hoursPerWeek) || 4,
        }),
      })
      const data = await res.json()
      if (!res.ok) { toast(data.message, 'error'); return }
      toast(data.message, 'success')
      setShowAddSubject(false)
      setSelectedSubject(null)
      setHoursPerWeek('4')
      fetchData()
    } catch { toast('Error de conexión', 'error') }
    finally  { setAddingSubject(false) }
  }

  const handleCreateTutorUser = async () => {
    setWorking(true)
    try {
      const res  = await fetch(`${API_URL}/api/courses/${id}/tutor-user`, { method: 'POST', headers: auth() })
      const data = await res.json()
      if (!res.ok) { toast(data.message, 'error'); return }
      setCreds({ accessEmail: data.accessEmail, defaultPassword: data.defaultPassword, name: data.tutorName })
      fetchData()
    } catch { toast('Error de conexión', 'error') }
    finally  { setWorking(false) }
  }

  const handleResetTutorPassword = async () => {
    if (!await confirm('¿Resetear la contraseña del maestro tutor?')) return
    setWorking(true)
    try {
      const res  = await fetch(`${API_URL}/api/courses/${id}/tutor-user/reset`, { method: 'POST', headers: auth() })
      const data = await res.json()
      if (!res.ok) { toast(data.message, 'error'); return }
      setCreds({
        accessEmail:     course?.tutor?.teacher.tutorUser?.email || '',
        defaultPassword: data.defaultPassword,
        name:            data.tutorName,
      })
    } catch { toast('Error de conexión', 'error') }
    finally  { setWorking(false) }
  }

  const copyCreds = () => {
    if (!creds) return
    navigator.clipboard.writeText(`Nombre: ${creds.name}\nEmail: ${creds.accessEmail}\nContraseña: ${creds.defaultPassword}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const calcPeriodosPlan = (hoursPerMonth: number) => {
    if (!schoolSch || !hoursPerMonth) return null
    return Math.round(hoursPerMonth / 4)
  }

  const totalPeriodosAsignados = Object.values(periodsSummary).reduce((a, b) => a + b, 0)
  const totalPeriodosPlan      = plan && schoolSch ? Math.round(plan.totalHours / 4) : 0

  if (loading) return <div className="flex justify-center py-16"><p className="text-sm text-neutral-500">Cargando...</p></div>
  if (!course)  return <div className="flex justify-center py-16"><p className="text-sm text-neutral-500">Curso no encontrado</p></div>

  const camposOrden = plan
    ? [...plan.campoOrder, 'SIN_CAMPO'].filter(c => plan.grouped[c]?.length > 0)
    : []

  const hasTutor     = !!course.tutor
  const hasTutorUser = !!course.tutor?.teacher.tutorUserId
  const hayHorario   = Object.keys(periodsSummary).length > 0

  const planSubjectIds = plan
    ? Object.values(plan.grouped).flat().map(i => i.subjectId)
    : []

  const availableSubjects = allSubjects.filter(s =>
    !planSubjectIds.includes(s.id) &&
    (subjectSearch === '' || s.name.toLowerCase().includes(subjectSearch.toLowerCase()))
  )

  return (
    <div>
      <div className="flex flex-col gap-3 mb-6">
        <button onClick={() => router.back()} className="flex items-center gap-1.5 text-neutral-500 hover:text-brand-700 text-[13px] w-fit">
          <ArrowLeft size={16}/> Volver
        </button>
        <div className="flex items-center gap-3 flex-wrap">
          <Badge tone={LEVEL_TONE[course.level]}>{LEVELS[course.level]}</Badge>
          <h1 className="text-[28px] font-extrabold text-brand-700">{GRADES[course.grade]} {course.parallel}</h1>
          <div className="flex gap-2">
            <Badge tone={SHIFT_TONE[course.shift]}><Clock size={12}/> {SHIFTS[course.shift]}</Badge>
            {course.educationType === 'BTH' && <Badge tone="warning"><GraduationCap size={12}/> BTH</Badge>}
          </div>
        </div>
      </div>

      <div className="grid gap-3 mb-5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
        <Card className="flex items-center gap-3">
          <Users size={20} className="text-brand-700"/>
          <div><div className="text-xl font-bold text-brand-700">{course._count.assignments}</div><div className="text-xs text-neutral-500">Estudiantes inscritos</div></div>
        </Card>
        {plan && (
          <>
            <Card className="flex items-center gap-3">
              <BookOpen size={20} className="text-info-500"/>
              <div><div className="text-xl font-bold text-brand-700">{plan.totalSubjects}</div><div className="text-xs text-neutral-500">Materias del grado</div></div>
            </Card>
            <Card className="flex items-center gap-3">
              <Clock size={20} className="text-success-700"/>
              <div><div className="text-xl font-bold text-brand-700">{plan.totalHours}</div><div className="text-xs text-neutral-500">Horas / Mes (plan)</div></div>
            </Card>
            <Card className="flex items-center gap-3">
              <CheckCircle2 size={20} className={plan.pendingCount === 0 ? 'text-success-700' : 'text-[#BA7517]'}/>
              <div>
                <div className={`text-xl font-bold ${plan.pendingCount === 0 ? 'text-success-700' : 'text-[#BA7517]'}`}>{plan.assignedCount}/{plan.totalSubjects}</div>
                <div className="text-xs text-neutral-500">Con maestro asignado</div>
              </div>
            </Card>
            {hayHorario && schoolSch && (
              <Card className="flex items-center gap-3">
                <Clock size={20} className={totalPeriodosAsignados >= totalPeriodosPlan ? 'text-success-700' : 'text-[#BA7517]'}/>
                <div>
                  <div className={`text-xl font-bold ${totalPeriodosAsignados >= totalPeriodosPlan ? 'text-success-700' : 'text-[#BA7517]'}`}>{totalPeriodosAsignados} / {totalPeriodosPlan}</div>
                  <div className="text-xs text-neutral-500">Periodos ejecutados / plan</div>
                </div>
              </Card>
            )}
          </>
        )}
      </div>

      {/* Maestro Tutor */}
      <Card padded={false} className="overflow-hidden mb-4">
        <div className="flex items-center gap-2 px-4.5 py-3.5 border-b border-neutral-100 text-[13px] font-semibold text-brand-700">
          <GraduationCap size={15}/> Maestro Tutor
        </div>
        <div className="p-4.5">
          {hasTutor ? (
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <div className="font-semibold text-brand-700 text-sm">{course.tutor!.teacher.lastName} {course.tutor!.teacher.firstName}</div>
                {hasTutorUser ? (
                  <div className="mt-1">
                    <span className="text-[11px] text-success-700">✅ Usuario tutor activo</span>
                    <div className="text-[11px] text-neutral-500 font-mono">{course.tutor!.teacher.tutorUser?.email}</div>
                  </div>
                ) : (
                  <span className="text-[11px] text-danger-600">❌ Sin usuario tutor</span>
                )}
              </div>
              <div className="flex gap-2 flex-wrap">
                <Button variant="secondary" size="sm" onClick={() => router.push(`/dashboard/admin/cursos/${id}/asignar-tutor`)}>Cambiar tutor</Button>
                {isDirector && !hasTutorUser && (
                  <Button size="sm" onClick={handleCreateTutorUser} loading={working}>
                    {!working && <Plus size={12}/>} Crear usuario
                  </Button>
                )}
                {isDirector && hasTutorUser && (
                  <Button variant="secondary" size="sm" onClick={handleResetTutorPassword} loading={working}>
                    {!working && <RefreshCw size={12}/>} Resetear password
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <span className="text-[13px] text-neutral-500 italic">Sin maestro tutor asignado</span>
              <Button size="sm" onClick={() => router.push(`/dashboard/admin/cursos/${id}/asignar-tutor`)}>+ Asignar tutor</Button>
            </div>
          )}
        </div>
      </Card>

      {/* Plan de Estudios */}
      <Card padded={false} className="overflow-hidden mb-4">
        <div className="flex items-center justify-between px-4.5 py-3.5 border-b border-neutral-100 flex-wrap gap-2">
          <span className="flex items-center gap-2 text-[13px] font-semibold text-brand-700">
            <BookOpen size={15}/> Plan de Estudios · {GRADES[course.grade]} {course.parallel}
            {plan && <span className="text-xs font-normal text-neutral-500">{plan.totalHours} hrs/mes</span>}
          </span>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={() => { setShowAddSubject(true); fetchAllSubjects(); setSubjectSearch(''); setSelectedSubject(null); setHoursPerWeek('4') }}>
              <Plus size={12}/> Agregar materia
            </Button>
            <Button size="sm" onClick={() => router.push(`/dashboard/admin/cursos/${id}/asignar-materia`)}>
              + Asignar maestro
            </Button>
          </div>
        </div>

        {!plan ? (
          <p className="p-8 text-center text-[13px] text-neutral-500">No hay plan de estudios configurado para este grado</p>
        ) : (
          <div className="p-4 flex flex-col gap-4">
            {plan.pendingCount > 0 ? (
              <div className="flex items-center gap-2 px-3.5 py-2.5 bg-warning-100 border border-warning-500 rounded-lg text-[13px] text-[#7A6000]"><AlertCircle size={14}/>{plan.pendingCount} {plan.pendingCount === 1 ? 'materia sin' : 'materias sin'} maestro asignado</div>
            ) : (
              <div className="flex items-center gap-2 px-3.5 py-2.5 bg-success-100 border border-success-500/40 rounded-lg text-[13px] text-success-700"><CheckCircle2 size={14}/>Todas las materias tienen maestro asignado ✓</div>
            )}

            {!hayHorario && (
              <div className="flex items-center gap-2 px-3 py-2 bg-warning-100 border border-warning-500 rounded-lg text-xs text-[#7A6000]">
                ⚠️ Este curso aún no tiene horario publicado — los periodos asignados aparecerán una vez publicado.
              </div>
            )}

            {camposOrden.map(campo => {
              const items      = plan.grouped[campo] || []
              const icon       = CAMPO_ICONS[campo]  || '📌'
              const label      = CAMPO_LABELS[campo] || campo
              const horasCampo = items.reduce((s, i) => s + i.hoursPerWeek, 0)

              return (
                <div key={campo}>
                  <div className="flex items-center gap-2 mb-1">
                    <Badge tone={CAMPO_TONE[campo] || 'neutral'}>{icon} {label}</Badge>
                    <span className="ml-auto text-xs text-neutral-500 font-medium">{horasCampo} hrs/mes · {items.length} {items.length === 1 ? 'materia' : 'materias'}</span>
                  </div>
                  <div className="overflow-x-auto rounded-lg border border-neutral-300/60">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="bg-neutral-100">
                          <th className="px-3.5 py-2 text-left text-[11px] font-semibold text-brand-700 uppercase tracking-wide">Materia</th>
                          <th className="px-3.5 py-2 text-left text-[11px] font-semibold text-brand-700 uppercase tracking-wide">Código</th>
                          <th className="px-3.5 py-2 text-center text-[11px] font-semibold text-brand-700 uppercase tracking-wide">Hrs/Mes</th>
                          <th className="px-3.5 py-2 text-center text-[11px] font-semibold text-brand-700 uppercase tracking-wide">Per. Plan</th>
                          <th className="px-3.5 py-2 text-center text-[11px] font-semibold text-brand-700 uppercase tracking-wide">Per. Asignados</th>
                          <th className="px-3.5 py-2 text-left text-[11px] font-semibold text-brand-700 uppercase tracking-wide">Maestro</th>
                          <th className="px-3.5 py-2 text-center text-[11px] font-semibold text-brand-700 uppercase tracking-wide w-20">Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map(item => {
                          const periodosPlan      = calcPeriodosPlan(item.hoursPerWeek)
                          const periodosAsignados = periodsSummary[item.subjectId] || 0
                          const cumplido          = periodosPlan !== null && periodosAsignados >= periodosPlan
                          const parcial           = periodosPlan !== null && periodosAsignados > 0 && periodosAsignados < periodosPlan

                          return (
                            <tr key={item.subjectId} className="border-t border-neutral-100">
                              <td className="px-3.5 py-2.5 text-[13px] font-medium text-brand-700">{item.subject.name}</td>
                              <td className="px-3.5 py-2.5 text-xs text-neutral-500">{item.subject.code || '—'}</td>
                              <td className="px-3.5 py-2.5 text-center"><Badge tone="brand">{item.hoursPerWeek}</Badge></td>
                              <td className="px-3.5 py-2.5 text-center">
                                {periodosPlan !== null ? <Badge tone="brand">{periodosPlan}P</Badge> : <span className="text-neutral-500">—</span>}
                              </td>
                              <td className="px-3.5 py-2.5 text-center">
                                {hayHorario ? (
                                  <Badge tone={cumplido ? 'success' : parcial ? 'warning' : 'danger'}>{periodosAsignados}P {cumplido?'✅':parcial?'⚠️':'❌'}</Badge>
                                ) : <span className="text-neutral-500">—</span>}
                              </td>
                              <td className="px-3.5 py-2.5">
                                {item.teacher ? (
                                  <span className="flex items-center gap-1.5">
                                    <CheckCircle2 size={13} className="text-success-700"/>
                                    <span className="text-brand-700 text-[13px]">{item.teacher.lastName} {item.teacher.firstName}</span>
                                  </span>
                                ) : (
                                  <span className="flex items-center gap-1.5 text-[#BA7517]">
                                    <AlertCircle size={13}/>
                                    <span className="text-xs italic">Sin maestro</span>
                                  </span>
                                )}
                              </td>
                              <td className="px-3.5 py-2.5 text-center">
                                <div className="flex gap-1.5 justify-center">
                                  {item.assignmentId && (
                                    <button
                                      title="Quitar maestro" disabled={removing === item.assignmentId}
                                      onClick={() => handleRemoveAssignment(item.assignmentId!)}
                                      className="w-6 h-6 rounded-md bg-warning-100 text-[#BA7517] border border-warning-500 flex items-center justify-center hover:opacity-75 disabled:opacity-40 transition-opacity"
                                    >
                                      <Trash2 size={11}/>
                                    </button>
                                  )}
                                  <button
                                    title="Eliminar materia del plan" disabled={removingPlan === item.gradeConfigId}
                                    onClick={() => handleRemoveFromPlan(item.gradeConfigId, item.subject.name)}
                                    className="w-6 h-6 rounded-md bg-danger-100 text-danger-600 border border-danger-500/40 flex items-center justify-center hover:opacity-75 disabled:opacity-40 transition-opacity"
                                  >
                                    <X size={11}/>
                                  </button>
                                </div>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Card>

      {/* Estudiantes inscritos */}
      <Card padded={false} className="overflow-hidden">
        <div className="flex items-center gap-2 px-4.5 py-3.5 border-b border-neutral-100 text-[13px] font-semibold text-brand-700">
          <Users size={15}/> Estudiantes inscritos ({assignments.length})
        </div>
        {assignments.length === 0 ? (
          <div className="flex flex-col items-center gap-2.5 p-10 text-neutral-500 text-[13px]">
            <Users size={32} className="text-neutral-300"/>
            <p>No hay estudiantes inscritos en este curso</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-neutral-100">
                  <th className="px-3.5 py-2 text-left text-[11px] font-semibold text-brand-700 uppercase tracking-wide">#</th>
                  <th className="px-3.5 py-2 text-left text-[11px] font-semibold text-brand-700 uppercase tracking-wide">Nombre completo</th>
                  <th className="px-3.5 py-2 text-left text-[11px] font-semibold text-brand-700 uppercase tracking-wide">CI</th>
                  <th className="px-3.5 py-2 text-left text-[11px] font-semibold text-brand-700 uppercase tracking-wide">RUDE</th>
                </tr>
              </thead>
              <tbody>
                {assignments.map((a, i) => (
                  <tr key={a.id} className="border-t border-neutral-100">
                    <td className="px-3.5 py-2.5 text-xs text-neutral-500">{i + 1}</td>
                    <td className="px-3.5 py-2.5 text-[13px] font-semibold text-brand-700">{a.student.lastName} {a.student.firstName}</td>
                    <td className="px-3.5 py-2.5 text-xs text-neutral-500">{a.student.ci || '—'}</td>
                    <td className="px-3.5 py-2.5 text-xs text-neutral-500">{a.student.rude || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Modal agregar materia al plan */}
      <Modal
        open={showAddSubject} onClose={() => setShowAddSubject(false)} title="Agregar materia al plan"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowAddSubject(false)}>Cancelar</Button>
            <Button onClick={handleAddSubjectToPlan} disabled={!selectedSubject} loading={addingSubject}>
              {!addingSubject && <Plus size={13}/>}
              {addingSubject ? 'Agregando...' : 'Agregar al plan'}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3.5">
          <p className="text-xs text-neutral-500 -mt-1">{GRADES[course.grade]} {course.parallel} · {LEVELS[course.level]}</p>
          <div className="bg-neutral-100 border border-neutral-300 rounded-lg p-3 text-xs text-neutral-500 leading-relaxed">
            📋 La materia se agregará al plan del grado <strong className="text-brand-700">{GRADES[course.grade]}</strong> y estará disponible en todos los cursos de ese grado.
          </div>
          <div className="relative">
            <Search size={13} className="absolute left-3 top-[38px] text-info-500 pointer-events-none"/>
            <Input
              label="Buscar materia" placeholder="Buscar por nombre..."
              value={subjectSearch} onChange={e => setSubjectSearch(e.target.value)} className="pl-9"
            />
          </div>
          <div>
            <label className="text-[13px] font-semibold text-neutral-700 block mb-1.5">Seleccionar materia *</label>
            <div className="border border-neutral-300 rounded-lg max-h-[180px] overflow-y-auto">
              {availableSubjects.length === 0 ? (
                <div className="p-4 text-center text-[13px] text-neutral-500 italic">
                  {subjectSearch ? 'No se encontraron materias' : 'Todas las materias ya están en el plan'}
                </div>
              ) : (
                availableSubjects.map(s => (
                  <label
                    key={s.id}
                    className={`flex items-center gap-2 px-2.5 py-1.5 cursor-pointer border-b border-neutral-100 last:border-b-0 transition-colors ${selectedSubject === s.id ? 'bg-brand-100 border-l-2 border-l-brand-700' : 'hover:bg-neutral-100/60'}`}
                  >
                    <input
                      type="radio" name="subject" value={s.id}
                      checked={selectedSubject === s.id} onChange={() => setSelectedSubject(s.id)}
                      className="shrink-0 w-3.5 h-3.5 accent-[var(--color-brand-700)]"
                    />
                    <div className="flex-1">
                      <div className="text-[13px] font-medium text-brand-700">{s.name}</div>
                      {s.campo && <div className="text-[11px] text-neutral-500 mt-0.5">{CAMPO_LABELS[s.campo] || s.campo}</div>}
                    </div>
                  </label>
                ))
              )}
            </div>
          </div>
          <Input
            label="Horas por mes" required type="number" min={1} max={200} placeholder="Ej: 16"
            value={hoursPerWeek} onChange={e => setHoursPerWeek(e.target.value)}
          />
        </div>
      </Modal>

      {/* Modal credenciales tutor */}
      <Modal
        open={!!creds} onClose={() => setCreds(null)} title="✅ Credenciales de acceso"
        footer={
          <>
            <Button variant="secondary" onClick={copyCreds}>
              {copied ? <Check size={14}/> : <Copy size={14}/>} {copied ? 'Copiado' : 'Copiar'}
            </Button>
            <Button onClick={() => setCreds(null)}>Entendido</Button>
          </>
        }
      >
        {creds && (
          <div className="flex flex-col gap-3">
            <div className="bg-neutral-100 border border-neutral-300 rounded-lg p-3 text-sm text-brand-700"><strong>{creds.name}</strong></div>
            <div className="flex items-center gap-2.5 bg-neutral-100 border border-neutral-300 rounded-lg px-3.5 py-2.5">
              <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wide min-w-[80px]">Email:</span>
              <span className="text-[13px] font-semibold text-brand-700 font-mono break-all">{creds.accessEmail}</span>
            </div>
            <div className="flex items-center gap-2.5 bg-neutral-100 border border-neutral-300 rounded-lg px-3.5 py-2.5">
              <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wide min-w-[80px]">Contraseña:</span>
              <span className="text-[13px] font-semibold text-brand-700 font-mono break-all">{creds.defaultPassword}</span>
            </div>
            <div className="text-xs text-[#BA7517] bg-warning-100 border border-warning-500 rounded-lg p-2.5 leading-relaxed">
              ⚠️ Anota estas credenciales. El maestro puede cambiar su contraseña desde su perfil.
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
