'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Users, DollarSign, AlertCircle, CheckCircle, BookOpen, Phone, CreditCard, UserCircle } from 'lucide-react'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

interface Parent {
  id:        number
  firstName: string
  lastName:  string
  phone?:    string
  charges:   { amount: number; paidAmount: number; status: string }[]
}

interface Student {
  id:        number
  firstName: string
  lastName:  string
  ci?:       string
  rude?:     string
  isActive:  boolean
  parents:   { relationType: string; isTutor: boolean; parent: Parent }[]
}

interface Assignment {
  id:      number
  year:    number
  student: Student
}

interface CourseTutor {
  teacher: { firstName: string; lastName: string }
}

interface Delegate {
  id:        number
  firstName: string
  lastName:  string
  phone?:    string | null
  ci?:       string | null
}

interface Course {
  id:            number
  level:         string
  grade:         string
  parallel:      string
  educationType: string
  shift:         string
  assignments:   Assignment[]
  tutor?:        CourseTutor
  delegate?:     Delegate
}

const GRADE_LABELS: Record<string, string> = { PRIMERO: '1°', SEGUNDO: '2°', TERCERO: '3°', CUARTO: '4°', QUINTO: '5°', SEXTO: '6°' }
const LEVEL_LABELS: Record<string, string> = { INICIAL: 'Inicial', PRIMARIA: 'Primaria', SECUNDARIA: 'Secundaria' }
const SHIFT_LABELS: Record<string, string> = { MORNING: 'Mañana', AFTERNOON: 'Tarde', NIGHT: 'Noche' }

const fmt = (n: number) => `Bs. ${n.toFixed(2)}`

export default function DelegateDashboard() {
  const router  = useRouter()
  const [course,  setCourse]  = useState<Course | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : ''

  useEffect(() => {
    const fetchCourse = async () => {
      setLoading(true)
      try {
        const res  = await fetch(`${API_URL}/api/delegates/my-course`, {
          headers: { Authorization: `Bearer ${token}` }
        })
        const data = await res.json()
       if (res.ok) {
  setCourse(data) 
}
          
        else setError(data.message)
      } catch { setError('Error de conexión') }
      finally  { setLoading(false) }
    }
    fetchCourse()
  }, [])

  if (loading) return <div className="center"><div className="spinner"/></div>
  if (error)   return <div className="center"><p className="err">{error}</p></div>
  if (!course) return null

  const allParents = new Map<number, Parent>()
  course.assignments.forEach(a => {
    a.student.parents.forEach(ps => {
      if (ps.isTutor && !allParents.has(ps.parent.id)) {
        allParents.set(ps.parent.id, ps.parent)
      }
    })
  })

  const parents      = Array.from(allParents.values())
  const totalDebt    = parents.reduce((sum, p) => sum + p.charges.reduce((s, c) => s + c.amount, 0), 0)
  const totalPaid    = parents.reduce((sum, p) => sum + p.charges.reduce((s, c) => s + c.paidAmount, 0), 0)
  const totalPending = totalDebt - totalPaid
  const withDebt     = parents.filter(p => p.charges.some(c => c.status === 'PENDIENTE' || c.status === 'PARCIAL')).length

  return (
    <div>
      {/* Header del curso */}
      <div className="course-header">
        <div className="course-avatar">
          {GRADE_LABELS[course.grade]}{course.parallel}
        </div>
        <div style={{ flex:1 }}>
          <h1>{LEVEL_LABELS[course.level]} — {GRADE_LABELS[course.grade]} "{course.parallel}"</h1>
          <div className="course-meta">
            <span className="meta-pill">{SHIFT_LABELS[course.shift]}</span>
            {course.educationType === 'BTH' && <span className="meta-pill bth">BTH</span>}
            {course.tutor && (
              <span className="meta-pill tutor">
                Tutor: {course.tutor.teacher.lastName} {course.tutor.teacher.firstName}
              </span>
            )}
          </div>
          {/* Delegado */}
          {course.delegate && (
            <div className="delegate-info">
              <UserCircle size={14} color="#00838F"/>
              <span>Delegado/a:</span>
              <strong>{course.delegate.lastName} {course.delegate.firstName}</strong>
              {course.delegate.phone && (
                <span style={{ display:'flex', alignItems:'center', gap:3 }}>
                  <Phone size={11}/> {course.delegate.phone}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Resumen */}
      <div className="summary-grid">
        <div className="sum-card">
          <div className="sum-icon blue"><Users size={20}/></div>
          <div>
            <div className="sum-label">Estudiantes</div>
            <div className="sum-value">{course.assignments.length}</div>
          </div>
        </div>
        <div className="sum-card">
          <div className="sum-icon red"><AlertCircle size={20}/></div>
          <div>
            <div className="sum-label">Con deuda</div>
            <div className="sum-value">{withDebt}</div>
          </div>
        </div>
        <div className="sum-card">
          <div className="sum-icon green"><CheckCircle size={20}/></div>
          <div>
            <div className="sum-label">Recaudado</div>
            <div className="sum-value">{fmt(totalPaid)}</div>
          </div>
        </div>
        <div className="sum-card">
          <div className="sum-icon red"><DollarSign size={20}/></div>
          <div>
            <div className="sum-label">Pendiente</div>
            <div className="sum-value">{fmt(totalPending)}</div>
          </div>
        </div>
      </div>

      {/* Acciones rápidas */}
      <div className="quick-actions">
        <button className="action-btn blue" onClick={() => router.push('/dashboard/padres/tesoreria')}>
          <DollarSign size={18}/> Ver estado de cuentas
        </button>
        <button className="action-btn green" onClick={() => router.push('/dashboard/padres/cargos/nuevo')}>
          <CreditCard size={18}/> Nuevo cargo
        </button>
        <button className="action-btn purple" onClick={() => router.push('/dashboard/padres/asistencia')}>
          <Users size={18}/> Registrar asistencia
        </button>
      </div>

      {/* Lista de estudiantes */}
      <div className="section-card">
        <div className="section-title"><BookOpen size={15}/> Estudiantes del curso</div>
        {course.assignments.length === 0 ? (
          <div className="no-data">No hay estudiantes inscritos</div>
        ) : (
          <table>
            <thead>
              <tr><th>#</th><th>Estudiante</th><th>CI</th><th>Tutor Legal</th><th>Teléfono</th><th>Estado</th></tr>
            </thead>
            <tbody>
              {course.assignments.map((a, i) => {
                const tutor = a.student.parents.find(ps => ps.isTutor)
                const totalPendiente = tutor
                  ? tutor.parent.charges.reduce((sum, c) => sum + (c.amount - c.paidAmount), 0)
                  : 0
                return (
                  <tr key={a.id}>
                    <td className="muted">{i + 1}</td>
                    <td>
                      <div className="sname">{a.student.lastName} {a.student.firstName}</div>
                      {a.student.rude && <div className="ssub">RUDE: {a.student.rude}</div>}
                    </td>
                    <td className="muted">{a.student.ci || '—'}</td>
                    <td>
                      {tutor ? (
                        <div>
                          <div className="sname">{tutor.parent.lastName} {tutor.parent.firstName}</div>
                          <div className="ssub">{tutor.relationType}</div>
                        </div>
                      ) : <span className="no-data-sm">Sin tutor</span>}
                    </td>
                    <td className="muted">
                      {tutor?.parent.phone
                        ? <span style={{ display:'flex', alignItems:'center', gap:3 }}><Phone size={11}/> {tutor.parent.phone}</span>
                        : '—'}
                    </td>
                    <td>
                      {totalPendiente > 0
                        ? <span className="sbadge red">{fmt(totalPendiente)}</span>
                        : <span className="sbadge green">Al día</span>
                      }
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      <style>{`
        .center{display:flex;justify-content:center;align-items:center;padding:48px;color:#6B8BB0}
        .err{color:#C0392B;font-size:14px}
        .course-header{display:flex;align-items:flex-start;gap:16px;margin-bottom:24px;background:#fff;border:1px solid #CBE0F0;border-radius:14px;padding:20px}
        .course-avatar{width:64px;height:64px;border-radius:14px;background:#00838F;color:#fff;display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:800;flex-shrink:0}
        .course-header h1{font-size:20px;font-weight:800;color:#1A3A7C;margin-bottom:8px}
        .course-meta{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px}
        .meta-pill{background:#F0F6FC;color:#00838F;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:500}
        .meta-pill.bth{background:#FFF3CC;color:#7A6000}
        .meta-pill.tutor{background:#E1F5EE;color:#0F6E56}
        .delegate-info{display:flex;align-items:center;gap:6px;font-size:12px;color:#00838F;background:#F5F5F4;border-radius:8px;padding:6px 10px;width:fit-content;flex-wrap:wrap}
        .delegate-info strong{font-weight:700;color:#1A3A7C}
        .summary-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;margin-bottom:16px}
        .sum-card{background:#fff;border:1px solid #CBE0F0;border-radius:12px;padding:16px;display:flex;align-items:center;gap:12px}
        .sum-icon{padding:10px;border-radius:10px;display:flex;align-items:center;justify-content:center}
        .sum-icon.blue{background:#E0ECF8;color:#1A3A7C}
        .sum-icon.green{background:#E1F5EE;color:#0F6E56}
        .sum-icon.red{background:#FFF0F0;color:#C0392B}
        .sum-label{font-size:11px;color:#6B8BB0;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px}
        .sum-value{font-size:18px;font-weight:700;color:#1A3A7C}
        .quick-actions{display:flex;gap:10px;margin-bottom:16px;flex-wrap:wrap}
        .action-btn{display:flex;align-items:center;gap:8px;padding:10px 18px;border:none;border-radius:10px;font-size:13px;font-weight:600;cursor:pointer}
        .action-btn.blue{background:#1A3A7C;color:#fff}
        .action-btn.blue:hover{background:#4A9FD4}
        .action-btn.green{background:#0F6E56;color:#fff}
        .action-btn.green:hover{background:#0A5040}
        .action-btn.purple{background:#3C3489;color:#fff}
        .action-btn.purple:hover{background:#2D2768}
        .section-card{background:#fff;border:1px solid #CBE0F0;border-radius:12px;overflow:hidden}
        .section-title{display:flex;align-items:center;gap:8px;padding:14px 18px;border-bottom:1px solid #F0F6FC;font-size:13px;font-weight:700;color:#1A3A7C}
        table{width:100%;border-collapse:collapse}
        thead tr{background:#F0F6FC}
        th{padding:10px 14px;text-align:left;font-size:11px;font-weight:600;color:#1A3A7C;text-transform:uppercase;letter-spacing:.5px}
        td{padding:11px 14px;font-size:13px;color:#1A3A7C;border-top:1px solid #F0F6FC;vertical-align:top}
        tr:hover td{background:#FAFCFF}
        .muted{color:#6B8BB0;font-size:12px}
        .sname{font-weight:500;color:#1A3A7C}
        .ssub{font-size:11px;color:#6B8BB0;margin-top:2px}
        .no-data{padding:20px;font-size:13px;color:#6B8BB0;font-style:italic}
        .no-data-sm{font-size:11px;color:#6B8BB0;font-style:italic}
        .sbadge{padding:3px 9px;border-radius:20px;font-size:11px;font-weight:500}
        .sbadge.green{background:#E1F5EE;color:#0F6E56}
        .sbadge.red{background:#FFF0F0;color:#C0392B}
        .spinner{width:24px;height:24px;border:2px solid rgba(26,58,124,.2);border-top-color:#1A3A7C;border-radius:50%;animation:spin .7s linear infinite}
        @keyframes spin{to{transform:rotate(360deg)}}
        @media(max-width:600px){.quick-actions{flex-direction:column}.summary-grid{grid-template-columns:1fr 1fr}}
      `}</style>
    </div>
  )
}