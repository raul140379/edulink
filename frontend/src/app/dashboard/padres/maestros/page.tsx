'use client'

import { useEffect, useState } from 'react'
import { BookOpen, Clock, CheckCircle, AlertCircle, MessageCircle } from 'lucide-react'
import Card from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

interface Student {
  id: number; firstName: string; lastName: string; gender?: string
  assignments: {
    course: { id: number; grade: string; parallel: string; level: string; shift: string }
    academicYear: { isActive: boolean; year: number }
  }[]
}

interface PlanItem {
  subjectId:    number
  subject:      { id: number; name: string; campo?: string }
  hoursPerWeek: number
  teacher:      { id: number; firstName: string; lastName: string; phone?: string } | null
}

interface CoursePlan {
  course:     { id: number; grade: string; parallel: string; level: string }
  totalHours: number
  grouped:    Record<string, PlanItem[]>
  campoOrder: string[]
}

interface ParentData {
  id: number; firstName: string; lastName: string
  students: { isTutor: boolean; student: Student }[]
}

const GRADES: Record<string,string> = { PRIMERO:'1°', SEGUNDO:'2°', TERCERO:'3°', CUARTO:'4°', QUINTO:'5°', SEXTO:'6°' }
const SHIFTS: Record<string,string> = { MORNING:'Mañana', AFTERNOON:'Tarde', NIGHT:'Noche' }
const LEVELS: Record<string,string> = { INICIAL:'Inicial', PRIMARIA:'Primaria', SECUNDARIA:'Secundaria' }

const CAMPO_TONE: Record<string, 'success' | 'brand' | 'warning' | 'info' | 'neutral'> = {
  VIDA_TIERRA_TERRITORIO:        'success',
  COMUNIDAD_SOCIEDAD:            'brand',
  COSMOS_PENSAMIENTO:            'info',
  CIENCIA_TECNOLOGIA_PRODUCCION: 'warning',
  SIN_CAMPO:                     'neutral',
}
const CAMPO_LABELS: Record<string,string> = {
  VIDA_TIERRA_TERRITORIO:        '🌿 Vida, Tierra y Territorio',
  COMUNIDAD_SOCIEDAD:            '🌐 Comunidad y Sociedad',
  COSMOS_PENSAMIENTO:            '✨ Cosmos y Pensamiento',
  CIENCIA_TECNOLOGIA_PRODUCCION: '⚙️ Ciencia, Tecnología y Producción',
  SIN_CAMPO:                     '📌 Sin campo asignado',
}

const buildWaUrl = (phone: string, msg: string) => {
  const clean = phone.replace(/\D/g, '')
  const num   = clean.startsWith('591') ? clean : `591${clean}`
  return `https://wa.me/${num}?text=${encodeURIComponent(msg)}`
}

export default function ParentMaestrosPage() {
  const [parent,      setParent]      = useState<ParentData | null>(null)
  const [selStudentId,setSelStudentId]= useState<number | null>(null)
  const [plan,        setPlan]        = useState<CoursePlan | null>(null)
  const [loading,     setLoading]     = useState(true)
  const [loadingPlan, setLoadingPlan] = useState(false)
  const [error,       setError]       = useState('')
  const [parentName,  setParentName]  = useState('')

  useEffect(() => {
    const init = async () => {
      const token = localStorage.getItem('token')
      if (!token) { setError('No autenticado'); setLoading(false); return }
      setLoading(true)
      try {
        const res  = await fetch(`${API_URL}/api/parents/me`, { headers: { Authorization: `Bearer ${token}` } })
        const data = await res.json()
        if (res.ok) {
          setParent(data)
          setParentName(`${data.lastName} ${data.firstName}`)
          const students = data.students.filter((ps: any) => ps.isTutor).map((ps: any) => ps.student)
          if (students[0]) setSelStudentId(students[0].id)
        } else { setError(data.message || 'Error al cargar datos') }
      } catch { setError('Error de conexión') }
      finally  { setLoading(false) }
    }
    init()
  }, [])

  useEffect(() => {
    if (!selStudentId || !parent) return
    const student    = parent.students.find(ps => ps.student.id === selStudentId)?.student
    const assignment = student?.assignments?.find(a => a.academicYear?.isActive)
    if (!assignment) return

    const loadPlan = async () => {
      const token = localStorage.getItem('token')
      if (!token) return
      setLoadingPlan(true); setPlan(null)
      try {
        const res  = await fetch(`${API_URL}/api/subjects/plan/${assignment.course.id}`, {
          headers: { Authorization: `Bearer ${token}` }
        })
        const data = await res.json()
        if (res.ok) setPlan(data)
      } catch { console.error('Error al cargar plan') }
      finally  { setLoadingPlan(false) }
    }
    loadPlan()
  }, [selStudentId, parent])

  if (loading) return <div className="flex justify-center py-16"><p className="text-sm text-neutral-500">Cargando...</p></div>
  if (error)   return <div className="flex justify-center py-16"><p className="text-sm text-danger-600">{error}</p></div>
  if (!parent) return null

  const myStudents       = parent.students.filter(ps => ps.isTutor).map(ps => ps.student)
  const selStudent       = myStudents.find(s => s.id === selStudentId)
  const activeAssignment = selStudent?.assignments?.find(a => a.academicYear?.isActive)
  const camposOrden      = plan ? [...plan.campoOrder, 'SIN_CAMPO'].filter(c => plan.grouped[c]?.length > 0) : []
  const allItems         = plan ? Object.values(plan.grouped).flat() : []
  const withTeacher      = allItems.filter(i => i.teacher).length
  const withoutTeacher   = allItems.filter(i => !i.teacher).length

  const studentName = selStudent ? `${selStudent.lastName} ${selStudent.firstName}` : ''

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-brand-700 mb-1">Maestros y Horario</h1>
        <p className="text-[13px] text-neutral-500">Plan de estudios, maestros asignados y contacto</p>
      </div>

      {myStudents.length > 1 && (
        <div className="flex gap-2 flex-wrap mb-4">
          {myStudents.map(s => (
            <button
              key={s.id} onClick={() => setSelStudentId(s.id)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-[13px] font-medium border transition-colors ${selStudentId === s.id ? 'bg-brand-700 text-white border-brand-700' : 'bg-white text-brand-700 border-neutral-300 hover:border-brand-500'}`}
            >
              {s.gender === 'MASCULINO' ? '👦' : '👧'} {s.lastName} {s.firstName}
            </button>
          ))}
        </div>
      )}

      {selStudent && (
        <>
          <Card className="flex items-center gap-3.5 mb-4">
            <div className="text-4xl shrink-0">{selStudent.gender === 'MASCULINO' ? '👦' : '👧'}</div>
            <div>
              <div className="text-base font-bold text-brand-700 mb-1">{selStudent.lastName} {selStudent.firstName}</div>
              {activeAssignment ? (
                <div className="text-xs text-neutral-500">
                  📚 {LEVELS[activeAssignment.course.level]} —{' '}
                  {GRADES[activeAssignment.course.grade]} &quot;{activeAssignment.course.parallel}&quot; ·{' '}
                  {SHIFTS[activeAssignment.course.shift]}
                </div>
              ) : <div className="text-xs text-danger-600 italic">Sin curso inscrito en la gestión activa</div>}
            </div>
          </Card>

          {!activeAssignment ? null : loadingPlan ? (
            <div className="flex justify-center py-16"><p className="text-sm text-neutral-500">Cargando...</p></div>
          ) : !plan ? (
            <Card className="flex flex-col items-center gap-3 py-14 text-neutral-500">
              <BookOpen size={40} className="text-neutral-300"/>
              <p className="text-[13px]">No hay plan de estudios configurado</p>
            </Card>
          ) : (
            <>
              <div className="grid grid-cols-4 gap-3 mb-4">
                <Card className="flex items-center gap-2.5">
                  <div className="p-2 rounded-lg bg-brand-100 text-brand-700"><BookOpen size={18}/></div>
                  <div><div className="text-[22px] font-extrabold text-brand-700">{allItems.length}</div><div className="text-[11px] text-neutral-500">Materias</div></div>
                </Card>
                <Card className="flex items-center gap-2.5">
                  <div className="p-2 rounded-lg bg-success-100 text-success-700"><CheckCircle size={18}/></div>
                  <div><div className="text-[22px] font-extrabold text-success-700">{withTeacher}</div><div className="text-[11px] text-neutral-500">Con maestro</div></div>
                </Card>
                <Card className="flex items-center gap-2.5">
                  <div className="p-2 rounded-lg bg-warning-100 text-[#BA7517]"><Clock size={18}/></div>
                  <div><div className="text-[22px] font-extrabold text-brand-700">{plan.totalHours}</div><div className="text-[11px] text-neutral-500">Hrs/Mes</div></div>
                </Card>
                <Card className="flex items-center gap-2.5">
                  <div className={`p-2 rounded-lg ${withoutTeacher > 0 ? 'bg-danger-100 text-danger-600' : 'bg-success-100 text-success-700'}`}><AlertCircle size={18}/></div>
                  <div>
                    <div className={`text-[22px] font-extrabold ${withoutTeacher > 0 ? 'text-danger-600' : 'text-success-700'}`}>{withoutTeacher}</div>
                    <div className="text-[11px] text-neutral-500">Sin maestro</div>
                  </div>
                </Card>
              </div>

              <Card className="!bg-warning-100 !border-warning-500 flex items-center gap-3.5 mb-4">
                <div className="text-3xl">🗓</div>
                <div>
                  <div className="text-sm font-semibold text-[#7A6000] mb-0.5">Horario de clases</div>
                  <div className="text-xs text-[#BA7517]">El módulo de horarios estará disponible próximamente.</div>
                </div>
                <span className="ml-auto bg-accent-500 text-[#3A2F00] px-3 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap">Próximamente</span>
              </Card>

              {camposOrden.map(campo => {
                const items = plan.grouped[campo] || []
                const hrs   = items.reduce((s, i) => s + i.hoursPerWeek, 0)
                return (
                  <Card key={campo} padded={false} className="overflow-hidden mb-3">
                    <div className="flex items-center gap-2.5 px-4 py-2.5 border-b border-neutral-100">
                      <Badge tone={CAMPO_TONE[campo] || 'neutral'}>{CAMPO_LABELS[campo] || campo}</Badge>
                      <span className="ml-auto text-xs text-neutral-500 font-medium">{hrs} hrs/mes · {items.length} {items.length === 1 ? 'materia' : 'materias'}</span>
                    </div>
                    <div className="flex flex-col">
                      {items.map(item => {
                        const waMsg = item.teacher
                          ? `Hola ${item.teacher.firstName}, soy ${parentName}, padre/madre de ${studentName}. Le contacto por la materia de ${item.subject.name}.`
                          : ''
                        return (
                          <div key={item.subjectId} className="flex items-center justify-between gap-4 px-4 py-3 border-t border-neutral-100 first:border-t-0 hover:bg-neutral-100/40">
                            <div className="flex-1">
                              <div className="text-[13px] font-medium text-brand-700 mb-0.5">{item.subject.name}</div>
                              <div className="text-[11px] text-neutral-500">{item.hoursPerWeek} hrs/mes</div>
                            </div>
                            <div className="shrink-0">
                              {item.teacher ? (
                                <div className="flex items-center gap-2.5">
                                  <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-full bg-brand-700 text-white flex items-center justify-center text-[13px] font-bold shrink-0">
                                      {item.teacher.lastName.charAt(0)}
                                    </div>
                                    <div>
                                      <div className="text-[13px] font-medium text-brand-700">{item.teacher.lastName} {item.teacher.firstName}</div>
                                      <div className="text-[11px] mt-0.5">
                                        {item.teacher.phone
                                          ? <span className="text-[#25D366] font-medium">📱 {item.teacher.phone}</span>
                                          : <span className="text-neutral-500 italic">Sin teléfono</span>}
                                      </div>
                                    </div>
                                  </div>
                                  {item.teacher.phone && (
                                    <a
                                      href={buildWaUrl(item.teacher.phone, waMsg)} target="_blank" rel="noopener noreferrer"
                                      className="flex items-center gap-1 px-2.5 py-1 bg-[#25D366] text-white rounded-lg text-[11px] font-semibold whitespace-nowrap shrink-0 hover:bg-[#1DA851] transition-colors"
                                      title="Enviar WhatsApp al maestro"
                                    >
                                      <MessageCircle size={13}/> WhatsApp
                                    </a>
                                  )}
                                </div>
                              ) : (
                                <span className="flex items-center gap-1 text-xs text-[#BA7517] italic"><AlertCircle size={12}/> Sin maestro</span>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </Card>
                )
              })}
            </>
          )}
        </>
      )}
    </div>
  )
}
