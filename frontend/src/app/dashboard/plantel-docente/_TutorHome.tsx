'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Users, DollarSign, AlertCircle, CheckCircle, BookOpen, MessageCircle, Bell } from 'lucide-react'
import Card from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

interface Parent {
  id:        number
  firstName: string
  lastName:  string
  phone?:    string
  ci?:       string
  charges:   { amount: number; paidAmount: number; status: string }[]
}

interface Student {
  id:        number
  firstName: string
  lastName:  string
  ci?:       string
  rude?:     string
  gender:    string
  isActive:  boolean
  parents:   { relationType: string; isTutor: boolean; parent: Parent }[]
}

interface Assignment {
  id:      number
  student: Student
}

interface Delegate {
  id:        number
  firstName: string
  lastName:  string
  phone?:    string
  ci?:       string
}

interface Meeting {
  id:          number
  title:       string
  date:        string
  attendances: { present: boolean; parent: { firstName: string; lastName: string } }[]
}
interface CourseTutor {
  teacher: { firstName: string; lastName: string }
}
interface Course {
  id:            number
  level:         string
  grade:         string
  parallel:      string
  educationType: string
  shift:         string
  assignments:   Assignment[]
  delegate?:     Delegate
  meetings:      Meeting[]
  tutor?:        CourseTutor
}

const GRADE_LABELS: Record<string, string> = { PRIMERO: '1°', SEGUNDO: '2°', TERCERO: '3°', CUARTO: '4°', QUINTO: '5°', SEXTO: '6°' }
const LEVEL_LABELS: Record<string, string> = { INICIAL: 'Inicial', PRIMARIA: 'Primaria', SECUNDARIA: 'Secundaria' }
const SHIFT_LABELS: Record<string, string> = { MORNING: 'Mañana', AFTERNOON: 'Tarde', NIGHT: 'Noche' }

const fmt     = (n: number) => `Bs. ${n.toFixed(2)}`
const fmtDate = (d: string) => new Date(d).toLocaleDateString('es-BO', { day: '2-digit', month: 'short', year: 'numeric' })

export default function TeacherTutorDashboard() {
  const router  = useRouter()
  const [course,  setCourse]  = useState<Course | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')

  useEffect(() => {
    const fetchCourse = async () => {
      const token = localStorage.getItem('token')
      setLoading(true)
      try {
        const res  = await fetch(`${API_URL}/api/teachers/my-course`, {
          headers: { Authorization: `Bearer ${token}` }
        })
        const data = await res.json()
        if (res.ok) setCourse(data)
        else setError(data.message)
      } catch { setError('Error de conexión') }
      finally  { setLoading(false) }
    }
    fetchCourse()
  }, [])

  if (loading) return <div className="flex justify-center py-16"><p className="text-sm text-neutral-500">Cargando...</p></div>
  if (error)   return <div className="flex justify-center py-16"><p className="text-sm text-danger-600">{error}</p></div>
  if (!course) return null

  const allTutors = new Map<number, Parent>()
  course.assignments.forEach(a => {
    a.student.parents.forEach(ps => {
      if (ps.isTutor && !allTutors.has(ps.parent.id)) {
        allTutors.set(ps.parent.id, ps.parent)
      }
    })
  })

  const tutors    = Array.from(allTutors.values())
  const totalPaid = tutors.reduce((s, p) => s + p.charges.reduce((x, c) => x + c.paidAmount, 0), 0)
  const withDebt  = tutors.filter(p => p.charges.some(c => c.status === 'PENDIENTE' || c.status === 'PARCIAL')).length
  const varones   = course.assignments.filter(a => a.student.gender === 'MASCULINO').length
  const mujeres   = course.assignments.filter(a => a.student.gender === 'FEMENINO').length

  const openWhatsApp = (phone: string, name: string) => {
    const msg = encodeURIComponent(`Estimado/a ${name}, le contactamos desde la U.E. Naciones Unidas.`)
    window.open(`https://wa.me/591${phone.replace(/\D/g,'')}?text=${msg}`, '_blank')
  }

  return (
    <div>
      {/* Header del curso */}
      <Card className="flex items-center gap-4 mb-6">
        <div className="w-16 h-16 rounded-2xl bg-brand-700 text-white flex items-center justify-center text-lg font-extrabold shrink-0">
          {GRADE_LABELS[course.grade]}{course.parallel}
        </div>
        <div>
          <h1 className="text-xl font-extrabold text-brand-700 mb-2">
            {LEVEL_LABELS[course.level]} — {GRADE_LABELS[course.grade]} {course.parallel}
          </h1>
          <div className="flex gap-2 flex-wrap">
            <Badge tone="brand">{SHIFT_LABELS[course.shift]}</Badge>
            {course.educationType === 'BTH' && <Badge tone="warning">BTH</Badge>}
            {course.tutor && <Badge tone="brand">👨‍🏫 Tutor: {course.tutor.teacher.lastName} {course.tutor.teacher.firstName}</Badge>}
            {course.delegate && <Badge tone="success">Delegado: {course.delegate.lastName} {course.delegate.firstName}</Badge>}
          </div>
        </div>
      </Card>

      {/* Resumen */}
      <div className="grid gap-3 mb-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
        <Card className="flex items-center gap-3">
          <div className="p-2.5 rounded-[10px] bg-brand-100 text-brand-700"><Users size={20} /></div>
          <div><div className="text-[11px] text-neutral-500 uppercase tracking-wide mb-0.5">Total estudiantes</div><div className="text-lg font-bold text-brand-700">{course.assignments.length}</div></div>
        </Card>
        <Card className="flex items-center gap-3">
          <div className="p-2.5 rounded-[10px] bg-brand-100 text-brand-700"><Users size={20} /></div>
          <div><div className="text-[11px] text-neutral-500 uppercase tracking-wide mb-0.5">Varones / Mujeres</div><div className="text-lg font-bold text-brand-700">{varones} / {mujeres}</div></div>
        </Card>
        <Card className="flex items-center gap-3">
          <div className="p-2.5 rounded-[10px] bg-danger-100 text-danger-600"><AlertCircle size={20} /></div>
          <div><div className="text-[11px] text-neutral-500 uppercase tracking-wide mb-0.5">Con deuda</div><div className="text-lg font-bold text-brand-700">{withDebt}</div></div>
        </Card>
        <Card className="flex items-center gap-3">
          <div className="p-2.5 rounded-[10px] bg-success-100 text-success-700"><CheckCircle size={20} /></div>
          <div><div className="text-[11px] text-neutral-500 uppercase tracking-wide mb-0.5">Recaudado</div><div className="text-lg font-bold text-brand-700">{fmt(totalPaid)}</div></div>
        </Card>
      </div>

      {/* Acciones rápidas */}
      <div className="flex gap-2.5 mb-4 flex-wrap">
        <button
          className="flex items-center gap-2 px-4.5 py-2.5 bg-brand-700 text-white rounded-[10px] text-[13px] font-semibold hover:bg-brand-500 transition-colors"
          onClick={() => router.push('/dashboard/plantel-docente/tesoreria')}
        >
          <DollarSign size={18}/> Estado de cuentas
        </button>
        <button
          className="flex items-center gap-2 px-4.5 py-2.5 bg-success-500 text-white rounded-[10px] text-[13px] font-semibold hover:bg-success-700 transition-colors"
          onClick={() => router.push('/dashboard/plantel-docente/reuniones')}
        >
          <Users size={18}/> Convocar reunión
        </button>
        <button
          className="flex items-center gap-2 px-4.5 py-2.5 bg-info-500 text-white rounded-[10px] text-[13px] font-semibold hover:bg-brand-700 transition-colors"
          onClick={() => router.push('/dashboard/plantel-docente/notificaciones')}
        >
          <Bell size={18}/> Notificaciones
        </button>
      </div>

      <div className="grid gap-4" style={{ gridTemplateColumns: '1fr 1fr' }}>
        {/* Lista de estudiantes */}
        <Card padded={false} className="overflow-hidden">
          <div className="flex items-center gap-2 px-4.5 py-3.5 border-b border-neutral-100 text-[13px] font-bold text-brand-700">
            <BookOpen size={15}/> Estudiantes ({course.assignments.length})
          </div>
          <div className="flex flex-col max-h-[400px] overflow-y-auto">
            {course.assignments.map((a, i) => {
              const tutor = a.student.parents.find(ps => ps.isTutor)
              const pendiente = tutor
                ? tutor.parent.charges.reduce((s, c) => s + (c.amount - c.paidAmount), 0)
                : 0
              return (
                <div key={a.id} className="flex items-start gap-2.5 px-4 py-2.5 border-t border-neutral-100 first:border-t-0">
                  <div className="text-[11px] text-neutral-500 min-w-[20px] pt-0.5">{i + 1}</div>
                  <div className="flex-1">
                    <div className="text-[13px] font-medium text-brand-700 mb-0.5">{a.student.lastName} {a.student.firstName}</div>
                    <div className="flex items-center gap-2 text-[11px] text-neutral-500 flex-wrap">
                      <span>{a.student.gender === 'MASCULINO' ? '👦' : '👧'}</span>
                      {a.student.ci && <span>CI: {a.student.ci}</span>}
                      {tutor && (
                        <span className="flex items-center gap-1.5 text-info-500">
                          Tutor: {tutor.parent.lastName} {tutor.parent.firstName}
                          {tutor.parent.phone && (
                            <button
                              className="flex items-center gap-1 bg-[#25D366] text-white rounded-[10px] px-1.5 py-0.5 text-[10px] hover:bg-[#1DA851] transition-colors"
                              onClick={() => openWhatsApp(tutor.parent.phone!, `${tutor.parent.lastName} ${tutor.parent.firstName}`)}
                            >
                              <MessageCircle size={11}/> WhatsApp
                            </button>
                          )}
                        </span>
                      )}
                    </div>
                  </div>
                  <Badge tone={pendiente > 0 ? 'danger' : 'success'}>{pendiente > 0 ? fmt(pendiente) : '✅'}</Badge>
                </div>
              )
            })}
          </div>
        </Card>

        {/* Últimas reuniones */}
        <Card padded={false} className="overflow-hidden">
          <div className="flex items-center gap-2 px-4.5 py-3.5 border-b border-neutral-100 text-[13px] font-bold text-brand-700">
            <Users size={15}/> Últimas reuniones
          </div>
          {course.meetings.length === 0 ? (
            <p className="px-4.5 py-5 text-[13px] text-neutral-500 italic">No hay reuniones registradas</p>
          ) : (
            <div className="flex flex-col">
              {course.meetings.map(m => {
                const pres = m.attendances.filter(a => a.present).length
                const aus  = m.attendances.length - pres
                return (
                  <div key={m.id} className="flex flex-col gap-1 px-4 py-3 border-t border-neutral-100 first:border-t-0">
                    <div className="text-[13px] font-medium text-brand-700">{m.title}</div>
                    <div className="text-[11px] text-neutral-500">{fmtDate(m.date)}</div>
                    <div className="flex gap-2">
                      <span className="text-xs font-medium text-success-700">✅ {pres}</span>
                      <span className="text-xs font-medium text-danger-600">❌ {aus}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
