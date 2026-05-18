'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  ArrowLeft, User, BookOpen, Users, GraduationCap,
  Phone, Mail, MapPin, CreditCard, Calendar, KeyRound
} from 'lucide-react'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

interface Student {
  id:        number
  firstName: string
  lastName:  string
  ci?:       string
  rude?:     string
  birthDate?: string
  phone?:    string
  email?:    string
  address?:  string
  isActive:  boolean
  user?:     { id: number; email: string; role: string; isActive: boolean }
  parents:   {
    relationType: string
    isTutor:      boolean
    parent: {
      id:        number
      firstName: string
      lastName:  string
      ci?:       string
      phone?:    string
      email?:    string
      address?:  string
    }
  }[]
  assignments: {
    id:            number
    year:          number
    educationType: string
    course: {
      level:         string
      grade:         string
      parallel:      string
      shift:         string
      educationType: string
    }
    academicYear: { year: number; isActive: boolean }
  }[]
}

const GRADE_LABELS: Record<string, string> = {
  PRIMERO: '1°', SEGUNDO: '2°', TERCERO: '3°',
  CUARTO: '4°', QUINTO: '5°', SEXTO: '6°'
}
const SHIFT_LABELS: Record<string, string> = {
  MORNING: 'Mañana', AFTERNOON: 'Tarde', NIGHT: 'Noche'
}
const LEVEL_LABELS: Record<string, string> = {
  INICIAL: 'Inicial', PRIMARIA: 'Primaria', SECUNDARIA: 'Secundaria'
}
const REL_LABELS: Record<string, string> = {
  PADRE: 'Padre', MADRE: 'Madre', TUTOR_LEGAL: 'Tutor Legal', OTRO: 'Otro'
}
const REL_COLORS: Record<string, string> = {
  PADRE: '#1A3A7C', MADRE: '#0F6E56', TUTOR_LEGAL: '#712B13', OTRO: '#444441'
}

const formatDate = (d?: string) => {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('es-BO', { day: '2-digit', month: 'long', year: 'numeric' })
}

const calcAge = (d?: string) => {
  if (!d) return ''
  const diff = Date.now() - new Date(d).getTime()
  return `${Math.floor(diff / (1000 * 60 * 60 * 24 * 365))} años`
}

export default function StudentDetailPage() {
  const params  = useParams()
  const router  = useRouter()
  const id      = params.id as string

  const [student, setStudent] = useState<Student | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : ''

  useEffect(() => {
    const fetchStudent = async () => {
      setLoading(true)
      try {
        const res  = await fetch(`${API_URL}/api/students/${id}`, {
          headers: { Authorization: `Bearer ${token}` }
        })
        const data = await res.json()
        if (res.ok) setStudent(data)
        else setError('Estudiante no encontrado')
      } catch { setError('Error de conexión') }
      finally  { setLoading(false) }
    }
    fetchStudent()
  }, [id])

  if (loading) return <div className="center"><div className="spinner"/></div>
  if (error)   return <div className="center"><p className="err-msg">{error}</p></div>
  if (!student) return null

  const activeCourse = student.assignments.find(a => a.academicYear.isActive)

  return (
    <div>
      <div className="page-header">
        <button className="back-btn" onClick={() => router.back()}>
          <ArrowLeft size={16}/> Volver
        </button>
        <div className="student-header">
          <div className="avatar">{student.firstName[0]}{student.lastName[0]}</div>
          <div>
            <h1>{student.lastName} {student.firstName}</h1>
            <div className="header-meta">
              <span className={`status-badge ${student.isActive ? 'act' : 'ina'}`}>
                {student.isActive ? 'Activo' : 'Inactivo'}
              </span>
              {activeCourse && (
                <span className="course-pill">
                  {LEVEL_LABELS[activeCourse.course.level]} {GRADE_LABELS[activeCourse.course.grade]} {activeCourse.course.parallel} · {SHIFT_LABELS[activeCourse.course.shift]}
                </span>
              )}
              {student.user && (
                <span className="access-pill">
                  <KeyRound size={11}/> Tiene acceso al sistema
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="grid-layout">
        <div className="card">
          <div className="card-title"><User size={15}/> Datos personales</div>
          <div className="data-grid">
            <div className="data-item">
              <span className="data-label"><CreditCard size={12}/> CI</span>
              <span className="data-value">{student.ci || '—'}</span>
            </div>
            <div className="data-item">
              <span className="data-label"><CreditCard size={12}/> RUDE</span>
              <span className="data-value">{student.rude || '—'}</span>
            </div>
            <div className="data-item">
              <span className="data-label"><Calendar size={12}/> Nacimiento</span>
              <span className="data-value">{formatDate(student.birthDate)} {calcAge(student.birthDate) && `(${calcAge(student.birthDate)})`}</span>
            </div>
            <div className="data-item">
              <span className="data-label"><Phone size={12}/> Teléfono</span>
              <span className="data-value">{student.phone || '—'}</span>
            </div>
            <div className="data-item">
              <span className="data-label"><Mail size={12}/> Correo personal</span>
              <span className="data-value">{student.email || '—'}</span>
            </div>
            <div className="data-item">
              <span className="data-label"><MapPin size={12}/> Dirección</span>
              <span className="data-value">{student.address || '—'}</span>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-title"><KeyRound size={15}/> Acceso al sistema</div>
          {student.user ? (
            <div className="access-box">
              <div className="access-row">
                <span className="data-label">Email de acceso</span>
                <span className="access-email">{student.user.email}</span>
              </div>
              <div className="access-row">
                <span className="data-label">Estado</span>
                <span className={`sbadge ${student.user.isActive ? 'act' : 'ina'}`}>
                  {student.user.isActive ? 'Activo' : 'Inactivo'}
                </span>
              </div>
              <div className="access-hint">
                💡 Contraseña = RUDE del estudiante{student.rude ? ` (${student.rude})` : ' o primeras 4 letras del apellido + año'}
              </div>
            </div>
          ) : (
            <div className="no-access">
              <KeyRound size={24} color="#CBE0F0"/>
              <p>El estudiante no tiene acceso al sistema</p>
            </div>
          )}
        </div>

        <div className="card">
          <div className="card-title"><GraduationCap size={15}/> Gestión actual</div>
          {activeCourse ? (
            <div className="course-box">
              <div className="course-big">
                {GRADE_LABELS[activeCourse.course.grade]} {activeCourse.course.parallel}
              </div>
              <div className="course-details">
                <span>{LEVEL_LABELS[activeCourse.course.level]}</span>
                <span>Turno {SHIFT_LABELS[activeCourse.course.shift]}</span>
                <span>{activeCourse.course.educationType}</span>
                <span>Gestión {activeCourse.year}</span>
              </div>
            </div>
          ) : (
            <div className="no-data">No inscrito en la gestión actual</div>
          )}
        </div>

        <div className="card card-full">
          <div className="card-title"><Users size={15}/> Padres y Tutores</div>
          {student.parents.length === 0 ? (
            <div className="no-data">No hay padres/tutores registrados</div>
          ) : (
            <div className="parents-grid">
              {student.parents.map((ps, i) => (
                <div key={i} className={`parent-card ${ps.relationType === 'TUTOR_LEGAL' ? 'tutor' : ''}`}>
                  <div className="parent-top">
                    <span className="rel-badge" style={{ background: REL_COLORS[ps.relationType]+'18', color: REL_COLORS[ps.relationType] }}>
                      {REL_LABELS[ps.relationType]}
                    </span>
                    {ps.relationType === 'TUTOR_LEGAL' && <span className="tutor-icon">🔑 Tutor Legal</span>}
                  </div>
                  <div className="parent-name">{ps.parent.lastName} {ps.parent.firstName}</div>
                  <div className="parent-info">
                    {ps.parent.ci    && <span><CreditCard size={11}/> {ps.parent.ci}</span>}
                    {ps.parent.phone && <span><Phone size={11}/> {ps.parent.phone}</span>}
                    {ps.parent.email && <span><Mail size={11}/> {ps.parent.email}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card card-full">
          <div className="card-title"><BookOpen size={15}/> Historial académico</div>
          {student.assignments.length === 0 ? (
            <div className="no-data">Sin historial de inscripciones</div>
          ) : (
            <table>
              <thead>
                <tr><th>Gestión</th><th>Nivel</th><th>Curso</th><th>Turno</th><th>Tipo</th><th>Estado</th></tr>
              </thead>
              <tbody>
                {student.assignments.map(a => (
                  <tr key={a.id}>
                    <td><strong>{a.year}</strong></td>
                    <td className="muted">{LEVEL_LABELS[a.course.level]}</td>
                    <td><strong>{GRADE_LABELS[a.course.grade]} {a.course.parallel}</strong></td>
                    <td className="muted">{SHIFT_LABELS[a.course.shift]}</td>
                    <td className="muted">{a.educationType}</td>
                    <td>
                      {a.academicYear.isActive
                        ? <span className="sbadge act">Activa</span>
                        : <span className="sbadge ina">Anterior</span>
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <style>{`
        .center{display:flex;justify-content:center;align-items:center;padding:48px}
        .err-msg{color:#C0392B;font-size:14px}
        .page-header{margin-bottom:24px;display:flex;flex-direction:column;gap:12px}
        .back-btn{display:flex;align-items:center;gap:6px;background:none;border:none;cursor:pointer;color:#6B8BB0;font-size:13px;padding:0;width:fit-content}
        .back-btn:hover{color:#1A3A7C}
        .student-header{display:flex;align-items:center;gap:16px}
        .avatar{width:56px;height:56px;border-radius:50%;background:#1A3A7C;color:#fff;display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:700;flex-shrink:0}
        .student-header h1{font-size:22px;font-weight:800;color:#1A3A7C;margin-bottom:6px}
        .header-meta{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
        .status-badge{padding:3px 10px;border-radius:20px;font-size:11px;font-weight:600}
        .status-badge.act{background:#E1F5EE;color:#0F6E56}
        .status-badge.ina{background:#FFF0F0;color:#C0392B}
        .course-pill{background:#E0ECF8;color:#1A3A7C;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:500}
        .access-pill{background:#E1F5EE;color:#0F6E56;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:500;display:flex;align-items:center;gap:4px}
        .grid-layout{display:grid;grid-template-columns:1fr 1fr;gap:16px}
        .card{background:#fff;border:1px solid #CBE0F0;border-radius:12px;padding:18px;display:flex;flex-direction:column;gap:14px}
        .card-full{grid-column:1/-1}
        .card-title{display:flex;align-items:center;gap:8px;font-size:13px;font-weight:700;color:#1A3A7C;padding-bottom:10px;border-bottom:1px solid #F0F6FC}
        .data-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
        .data-item{display:flex;flex-direction:column;gap:3px}
        .data-label{display:flex;align-items:center;gap:4px;font-size:10px;font-weight:600;color:#6B8BB0;text-transform:uppercase;letter-spacing:.5px}
        .data-value{font-size:13px;color:#1A3A7C;font-weight:500}
        .access-box{display:flex;flex-direction:column;gap:10px}
        .access-row{display:flex;flex-direction:column;gap:3px}
        .access-email{font-size:13px;font-weight:600;color:#1A3A7C;font-family:monospace;word-break:break-all}
        .access-hint{font-size:11px;color:#0F6E56;background:#E1F5EE;border:1px solid #9FE1CB;border-radius:8px;padding:8px;line-height:1.5}
        .no-access{display:flex;flex-direction:column;align-items:center;gap:8px;padding:20px;color:#6B8BB0;font-size:12px;text-align:center}
        .course-box{display:flex;flex-direction:column;gap:8px}
        .course-big{font-size:36px;font-weight:800;color:#1A3A7C}
        .course-details{display:flex;flex-wrap:wrap;gap:8px}
        .course-details span{background:#F0F6FC;color:#1A3A7C;padding:3px 10px;border-radius:20px;font-size:12px}
        .no-data{color:#6B8BB0;font-size:13px;padding:12px 0;font-style:italic}
        .parents-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px}
        .parent-card{background:#F8FBFF;border:1px solid #CBE0F0;border-radius:10px;padding:14px;display:flex;flex-direction:column;gap:8px}
        .parent-card.tutor{border-color:#F5C518;background:#FFFDF0}
        .parent-top{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:6px}
        .rel-badge{padding:2px 8px;border-radius:20px;font-size:10px;font-weight:600}
        .tutor-icon{font-size:11px;color:#7A6000}
        .parent-name{font-size:14px;font-weight:700;color:#1A3A7C}
        .parent-info{display:flex;flex-direction:column;gap:4px}
        .parent-info span{display:flex;align-items:center;gap:5px;font-size:11px;color:#6B8BB0}
        table{width:100%;border-collapse:collapse}
        thead tr{background:#F0F6FC}
        th{padding:10px 14px;text-align:left;font-size:11px;font-weight:600;color:#1A3A7C;text-transform:uppercase;letter-spacing:.5px}
        td{padding:11px 14px;font-size:13px;color:#1A3A7C;border-top:1px solid #F0F6FC}
        tr:hover td{background:#FAFCFF}
        .muted{color:#6B8BB0}
        .sbadge{padding:3px 9px;border-radius:20px;font-size:11px;font-weight:500}
        .sbadge.act{background:#E1F5EE;color:#0F6E56}
        .sbadge.ina{background:#F0F6FC;color:#6B8BB0}
        .spinner{width:24px;height:24px;border:2px solid rgba(26,58,124,.2);border-top-color:#1A3A7C;border-radius:50%;animation:spin .7s linear infinite}
        @keyframes spin{to{transform:rotate(360deg)}}
        @media(max-width:700px){.grid-layout{grid-template-columns:1fr}.data-grid{grid-template-columns:1fr}}
      `}</style>
    </div>
  )
}