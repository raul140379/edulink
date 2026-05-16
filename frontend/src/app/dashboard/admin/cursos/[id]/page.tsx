'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Users, BookOpen, Clock, GraduationCap } from 'lucide-react'

interface Course {
  id:            number
  level:         string
  grade:         string
  parallel:      string
  educationType: string
  shift:         string
  _count:        { assignments: number }
  teacherSubjects: {
    teacher: { firstName: string; lastName: string }
    subject: { name: string; code: string }
  }[]
}

interface Assignment {
  id:      number
  year:    number
  student: {
    id:        number
    firstName: string
    lastName:  string
    ci?:       string
    rude?:     string
  }
}

const LEVELS    = [{ value: 'INICIAL', label: 'Inicial' }, { value: 'PRIMARIA', label: 'Primaria' }, { value: 'SECUNDARIA', label: 'Secundaria' }]
const GRADES    = [{ value: 'PRIMERO', label: '1°' }, { value: 'SEGUNDO', label: '2°' }, { value: 'TERCERO', label: '3°' }, { value: 'CUARTO', label: '4°' }, { value: 'QUINTO', label: '5°' }, { value: 'SEXTO', label: '6°' }]
const SHIFTS    = [{ value: 'MORNING', label: 'Mañana' }, { value: 'AFTERNOON', label: 'Tarde' }, { value: 'NIGHT', label: 'Noche' }]

const levelLabel = (v: string) => LEVELS.find(l => l.value === v)?.label || v
const gradeLabel = (v: string) => GRADES.find(g => g.value === v)?.label || v
const shiftLabel = (v: string) => SHIFTS.find(s => s.value === v)?.label || v

const shiftColor: Record<string, string> = { MORNING: '#1A3A7C', AFTERNOON: '#633806', NIGHT: '#3C3489' }
const levelColor: Record<string, string> = { INICIAL: '#0F6E56', PRIMARIA: '#1A3A7C', SECUNDARIA: '#712B13' }

export default function CourseDetailPage() {
  const params  = useParams()
  const router  = useRouter()
  const id      = params.id as string

  const [course,      setCourse]      = useState<Course | null>(null)
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [loading,     setLoading]     = useState(true)

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : ''

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      try {
        const [cRes, aRes] = await Promise.all([
          fetch(`http://localhost:4000/api/courses/${id}`,          { headers: { Authorization: `Bearer ${token}` } }),
          fetch(`http://localhost:4000/api/courses/${id}/students`, { headers: { Authorization: `Bearer ${token}` } }),
        ])
        const [cData, aData] = await Promise.all([cRes.json(), aRes.json()])
        if (cRes.ok) setCourse(cData)
        if (aRes.ok) setAssignments(aData)
      } catch (e) {
        console.error(e)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [id])

  if (loading) return <div className="center"><div className="spinner"/></div>
  if (!course)  return <div className="center"><p>Curso no encontrado</p></div>

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <button className="back-btn" onClick={() => router.back()}>
          <ArrowLeft size={16}/> Volver
        </button>
        <div className="course-title">
          <span className="level-pill" style={{ background: levelColor[course.level]+'18', color: levelColor[course.level] }}>
            {levelLabel(course.level)}
          </span>
          <h1>{gradeLabel(course.grade)} {course.parallel}</h1>
          <div className="course-meta">
            <span className="meta-badge" style={{ background: shiftColor[course.shift]+'18', color: shiftColor[course.shift] }}>
              <Clock size={12}/> {shiftLabel(course.shift)}
            </span>
            {course.educationType === 'BTH' && (
              <span className="meta-badge bth"><GraduationCap size={12}/> BTH</span>
            )}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="stats-row">
        <div className="stat-card">
          <Users size={20} color="#1A3A7C"/>
          <div>
            <div className="stat-num">{course._count.assignments}</div>
            <div className="stat-lbl">Estudiantes inscritos</div>
          </div>
        </div>
        <div className="stat-card">
          <BookOpen size={20} color="#4A9FD4"/>
          <div>
            <div className="stat-num">{course.teacherSubjects.length}</div>
            <div className="stat-lbl">Materias asignadas</div>
          </div>
        </div>
      </div>

      {/* Materias y maestros */}
      {course.teacherSubjects.length > 0 && (
        <div className="section-card">
          <div className="section-title"><BookOpen size={15}/> Materias y Maestros</div>
          <table>
            <thead>
              <tr><th>Materia</th><th>Código</th><th>Maestro</th></tr>
            </thead>
            <tbody>
              {course.teacherSubjects.map((ts, i) => (
                <tr key={i}>
                  <td>{ts.subject.name}</td>
                  <td className="muted">{ts.subject.code || '—'}</td>
                  <td>{ts.teacher.firstName} {ts.teacher.lastName}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Lista de estudiantes */}
      <div className="section-card">
        <div className="section-title"><Users size={15}/> Estudiantes inscritos</div>
        {assignments.length === 0 ? (
          <div className="empty-state">
            <Users size={32} color="#CBE0F0"/>
            <p>No hay estudiantes inscritos en este curso</p>
          </div>
        ) : (
          <table>
            <thead>
              <tr><th>#</th><th>Nombre completo</th><th>CI</th><th>RUDE</th></tr>
            </thead>
            <tbody>
              {assignments.map((a, i) => (
                <tr key={a.id}>
                  <td className="muted">{i + 1}</td>
                  <td><strong>{a.student.lastName} {a.student.firstName}</strong></td>
                  <td className="muted">{a.student.ci || '—'}</td>
                  <td className="muted">{a.student.rude || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <style>{`
        .center{display:flex;justify-content:center;align-items:center;padding:48px;flex-direction:column;gap:12px;color:#6B8BB0}
        .page-header{display:flex;flex-direction:column;gap:12px;margin-bottom:24px}
        .back-btn{display:flex;align-items:center;gap:6px;background:none;border:none;cursor:pointer;color:#6B8BB0;font-size:13px;padding:0;width:fit-content}
        .back-btn:hover{color:#1A3A7C}
        .course-title{display:flex;align-items:center;gap:12px;flex-wrap:wrap}
        .course-title h1{font-size:28px;font-weight:800;color:#1A3A7C;margin:0}
        .level-pill{padding:4px 12px;border-radius:20px;font-size:12px;font-weight:600}
        .course-meta{display:flex;gap:8px}
        .meta-badge{display:flex;align-items:center;gap:4px;padding:4px 10px;border-radius:20px;font-size:12px;font-weight:500}
        .meta-badge.bth{background:#FFF3CC;color:#7A6000}
        .stats-row{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;margin-bottom:20px}
        .stat-card{background:#fff;border:1px solid #CBE0F0;border-radius:10px;padding:16px;display:flex;align-items:center;gap:12px}
        .stat-num{font-size:22px;font-weight:700;color:#1A3A7C}
        .stat-lbl{font-size:12px;color:#6B8BB0}
        .section-card{background:#fff;border:1px solid #CBE0F0;border-radius:12px;overflow:hidden;margin-bottom:16px}
        .section-title{display:flex;align-items:center;gap:8px;padding:14px 18px;border-bottom:1px solid #F0F6FC;font-size:13px;font-weight:600;color:#1A3A7C}
        table{width:100%;border-collapse:collapse}
        th{padding:10px 16px;text-align:left;font-size:11px;font-weight:600;color:#1A3A7C;text-transform:uppercase;letter-spacing:.5px;background:#F8FBFF}
        td{padding:12px 16px;font-size:13px;color:#1A3A7C;border-top:1px solid #F0F6FC}
        tr:hover td{background:#FAFCFF}
        .muted{color:#6B8BB0}
        .empty-state{display:flex;flex-direction:column;align-items:center;padding:40px;gap:10px;color:#6B8BB0;font-size:13px}
        .spinner{width:24px;height:24px;border:2px solid rgba(26,58,124,.2);border-top-color:#1A3A7C;border-radius:50%;animation:spin .7s linear infinite}
        @keyframes spin{to{transform:rotate(360deg)}}
      `}</style>
    </div>
  )
}