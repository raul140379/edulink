'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Users, DollarSign, AlertCircle, CheckCircle, BookOpen, Phone, MessageCircle, Bell } from 'lucide-react'

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

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : ''

  useEffect(() => {
    const fetchCourse = async () => {
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

  if (loading) return <div className="center"><div className="spinner"/></div>
  if (error)   return <div className="center"><p className="err-msg">{error}</p></div>
  if (!course) return null

  const allTutors = new Map<number, Parent>()
  course.assignments.forEach(a => {
    a.student.parents.forEach(ps => {
      if (ps.isTutor && !allTutors.has(ps.parent.id)) {
        allTutors.set(ps.parent.id, ps.parent)
      }
    })
  })

  const tutors   = Array.from(allTutors.values())
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
      <div className="course-header">
        <div className="course-avatar">{GRADE_LABELS[course.grade]}{course.parallel}</div>
        <div className="course-info">
          <h1>{LEVEL_LABELS[course.level]} — {GRADE_LABELS[course.grade]} {course.parallel}</h1>
          <div className="course-meta">
            <span className="meta-pill">{SHIFT_LABELS[course.shift]}</span>
            {course.educationType === 'BTH' && <span className="meta-pill bth">BTH</span>}
             {course.tutor && (
    <span className="meta-pill" style={{background:'#E8F0FB',color:'#1A3A7C'}}>
      👨‍🏫 Tutor: {course.tutor.teacher.lastName} {course.tutor.teacher.firstName}
    </span>
  )}
            {course.delegate && (
              <span className="meta-pill delegate">
                Delegado: {course.delegate.lastName} {course.delegate.firstName}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Resumen */}
      <div className="summary-grid">
        <div className="sum-card">
          <div className="sum-icon blue"><Users size={20}/></div>
          <div><div className="sum-label">Total estudiantes</div><div className="sum-value">{course.assignments.length}</div></div>
        </div>
        <div className="sum-card">
          <div className="sum-icon blue"><Users size={20}/></div>
          <div><div className="sum-label">Varones / Mujeres</div><div className="sum-value">{varones} / {mujeres}</div></div>
        </div>
        <div className="sum-card">
          <div className="sum-icon red"><AlertCircle size={20}/></div>
          <div><div className="sum-label">Con deuda</div><div className="sum-value">{withDebt}</div></div>
        </div>
        <div className="sum-card">
          <div className="sum-icon green"><CheckCircle size={20}/></div>
          <div><div className="sum-label">Recaudado</div><div className="sum-value">{fmt(totalPaid)}</div></div>
        </div>
      </div>

      {/* Acciones rápidas */}
      <div className="quick-actions">
        <button className="action-btn blue" onClick={() => router.push('/dashboard/plantel-docente/tesoreria')}>
          <DollarSign size={18}/> Estado de cuentas
        </button>
        <button className="action-btn orange" onClick={() => router.push('/dashboard/plantel-docente/reuniones')}>
          <Users size={18}/> Convocar reunión
        </button>
        <button className="action-btn green" onClick={() => router.push('/dashboard/plantel-docente/notificaciones')}>
          <Bell size={18}/> Notificaciones
        </button>
      </div>

      <div className="two-cols">
        {/* Lista de estudiantes */}
        <div className="section-card">
          <div className="section-title"><BookOpen size={15}/> Estudiantes ({course.assignments.length})</div>
          <div className="students-list">
            {course.assignments.map((a, i) => {
              const tutor = a.student.parents.find(ps => ps.isTutor)
              const pendiente = tutor
                ? tutor.parent.charges.reduce((s, c) => s + (c.amount - c.paidAmount), 0)
                : 0
              return (
                <div key={a.id} className="student-item">
                  <div className="student-num">{i + 1}</div>
                  <div className="student-info">
                    <div className="student-name">{a.student.lastName} {a.student.firstName}</div>
                    <div className="student-meta">
                      <span>{a.student.gender === 'MASCULINO' ? '👦' : '👧'}</span>
                      {a.student.ci && <span>CI: {a.student.ci}</span>}
                      {tutor && (
                        <span className="tutor-ref">
                          Tutor: {tutor.parent.lastName} {tutor.parent.firstName}
                          {tutor.parent.phone && (
                            <button className="wa-btn"
                              onClick={() => openWhatsApp(tutor.parent.phone!, `${tutor.parent.lastName} ${tutor.parent.firstName}`)}>
                              <MessageCircle size={11}/> WhatsApp
                            </button>
                          )}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className={`debt-badge ${pendiente > 0 ? 'red' : 'green'}`}>
                    {pendiente > 0 ? fmt(pendiente) : '✅'}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Últimas reuniones */}
        <div className="section-card">
          <div className="section-title"><Users size={15}/> Últimas reuniones</div>
          {course.meetings.length === 0 ? (
            <div className="no-data">No hay reuniones registradas</div>
          ) : (
            <div className="meetings-list">
              {course.meetings.map(m => {
                const pres = m.attendances.filter(a => a.present).length
                const aus  = m.attendances.length - pres
                return (
                  <div key={m.id} className="meeting-item">
                    <div className="meeting-name">{m.title}</div>
                    <div className="meeting-date">{fmtDate(m.date)}</div>
                    <div className="meeting-stats">
                      <span className="stat green">✅ {pres}</span>
                      <span className="stat red">❌ {aus}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      <style>{`
        .center{display:flex;justify-content:center;align-items:center;padding:48px;color:#6B8BB0}
        .err-msg{color:#C0392B;font-size:14px}
        .course-header{display:flex;align-items:center;gap:16px;margin-bottom:24px;background:#fff;border:1px solid #CBE0F0;border-radius:14px;padding:20px}
        .course-avatar{width:64px;height:64px;border-radius:14px;background:#0F6E56;color:#fff;display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:800;flex-shrink:0}
        .course-info h1{font-size:20px;font-weight:800;color:#1A3A7C;margin-bottom:8px}
        .course-meta{display:flex;gap:8px;flex-wrap:wrap}
        .meta-pill{background:#F0F6FC;color:#0F6E56;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:500}
        .meta-pill.bth{background:#FFF3CC;color:#7A6000}
        .meta-pill.delegate{background:#E1F5EE;color:#0F6E56}
        .summary-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;margin-bottom:16px}
        .sum-card{background:#fff;border:1px solid #CBE0F0;border-radius:12px;padding:16px;display:flex;align-items:center;gap:12px}
        .sum-icon{padding:10px;border-radius:10px;display:flex}
        .sum-icon.blue{background:#E0ECF8;color:#1A3A7C}
        .sum-icon.green{background:#E1F5EE;color:#0F6E56}
        .sum-icon.red{background:#FFF0F0;color:#C0392B}
        .sum-label{font-size:11px;color:#6B8BB0;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px}
        .sum-value{font-size:18px;font-weight:700;color:#1A3A7C}
        .quick-actions{display:flex;gap:10px;margin-bottom:16px;flex-wrap:wrap}
        .action-btn{display:flex;align-items:center;gap:8px;padding:10px 18px;border:none;border-radius:10px;font-size:13px;font-weight:600;cursor:pointer}
        .action-btn.blue{background:#1A3A7C;color:#fff}
        .action-btn.blue:hover{background:#4A9FD4}
        .action-btn.orange{background:#0F6E56;color:#fff}
        .action-btn.orange:hover{background:#0A5240}
        .action-btn.green{background:#4A9FD4;color:#fff}
        .action-btn.green:hover{background:#1A3A7C}
        .two-cols{display:grid;grid-template-columns:1fr 1fr;gap:16px}
        .section-card{background:#fff;border:1px solid #CBE0F0;border-radius:12px;overflow:hidden}
        .section-title{display:flex;align-items:center;gap:8px;padding:14px 18px;border-bottom:1px solid #F0F6FC;font-size:13px;font-weight:700;color:#1A3A7C}
        .students-list{display:flex;flex-direction:column;max-height:400px;overflow-y:auto}
        .student-item{display:flex;align-items:flex-start;gap:10px;padding:10px 16px;border-bottom:1px solid #F0F6FC}
        .student-item:last-child{border-bottom:none}
        .student-num{font-size:11px;color:#6B8BB0;min-width:20px;padding-top:2px}
        .student-info{flex:1}
        .student-name{font-size:13px;font-weight:500;color:#1A3A7C;margin-bottom:3px}
        .student-meta{display:flex;align-items:center;gap:8px;font-size:11px;color:#6B8BB0;flex-wrap:wrap}
        .tutor-ref{display:flex;align-items:center;gap:5px;color:#4A9FD4}
        .wa-btn{display:flex;align-items:center;gap:3px;background:#25D366;color:#fff;border:none;border-radius:10px;padding:2px 7px;font-size:10px;cursor:pointer}
        .wa-btn:hover{background:#1DA851}
        .debt-badge{font-size:11px;font-weight:600;padding:3px 8px;border-radius:10px;white-space:nowrap}
        .debt-badge.red{background:#FFF0F0;color:#C0392B}
        .debt-badge.green{background:#E1F5EE;color:#0F6E56}
        .no-data{padding:20px;font-size:13px;color:#6B8BB0;font-style:italic}
        .meetings-list{display:flex;flex-direction:column}
        .meeting-item{padding:12px 16px;border-bottom:1px solid #F0F6FC;display:flex;flex-direction:column;gap:4px}
        .meeting-item:last-child{border-bottom:none}
        .meeting-name{font-size:13px;font-weight:500;color:#1A3A7C}
        .meeting-date{font-size:11px;color:#6B8BB0}
        .meeting-stats{display:flex;gap:8px}
        .stat{font-size:12px;font-weight:500}
        .stat.green{color:#0F6E56}
        .stat.red{color:#C0392B}
        .spinner{width:24px;height:24px;border:2px solid rgba(15,110,86,.2);border-top-color:#0F6E56;border-radius:50%;animation:spin .7s linear infinite}
        @keyframes spin{to{transform:rotate(360deg)}}
        @media(max-width:768px){.two-cols{grid-template-columns:1fr}.summary-grid{grid-template-columns:1fr 1fr}}
      `}</style>
    </div>
  )
}