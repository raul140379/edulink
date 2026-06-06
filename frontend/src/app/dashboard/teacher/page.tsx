'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { BookOpen, Users, Clock, GraduationCap, ChevronRight } from 'lucide-react'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

interface Assignment {
  subjectId:    number
  subjectName:  string
  campo:        string | null
  courseId:     number
  courseLabel:  string
  grade:        string
  parallel:     string
  shift:        string
  educationType: string
  hoursPerWeek: number
}

interface Workload {
  totalHoursPerWeek: number
  assignments:       Assignment[]
}

const CAMPO_COLORS: Record<string, string> = {
  VIDA_TIERRA_TERRITORIO:        '#E1F5EE',
  COMUNIDAD_SOCIEDAD:            '#E0ECF8',
  COSMOS_PENSAMIENTO:            '#F3E8FF',
  CIENCIA_TECNOLOGIA_PRODUCCION: '#FFF3E0',
}
const CAMPO_TEXT: Record<string, string> = {
  VIDA_TIERRA_TERRITORIO:        '#0F6E56',
  COMUNIDAD_SOCIEDAD:            '#1A3A7C',
  COSMOS_PENSAMIENTO:            '#6B21A8',
  CIENCIA_TECNOLOGIA_PRODUCCION: '#633806',
}
const CAMPO_LABELS: Record<string, string> = {
  VIDA_TIERRA_TERRITORIO:        'Vida, Tierra y Territorio',
  COMUNIDAD_SOCIEDAD:            'Comunidad y Sociedad',
  COSMOS_PENSAMIENTO:            'Cosmos y Pensamiento',
  CIENCIA_TECNOLOGIA_PRODUCCION: 'Ciencia, Tecnología y Producción',
}
const GRADES: Record<string, string> = {
  PRIMERO: '1°', SEGUNDO: '2°', TERCERO: '3°',
  CUARTO: '4°', QUINTO: '5°', SEXTO: '6°',
}
const SHIFTS: Record<string, string> = {
  MORNING: 'Mañana', AFTERNOON: 'Tarde', NIGHT: 'Noche',
}

export default function TeacherDashboard() {
  const router  = useRouter()
  const [data,    setData]    = useState<Workload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : ''

  useEffect(() => {
    const fetch_ = async () => {
      setLoading(true)
      try {
        const res  = await fetch(`${API_URL}/api/teachers/my-workload`, {
          headers: { Authorization: `Bearer ${token}` }
        })
        const d = await res.json()
        if (res.ok) setData(d)
        else setError(d.message || 'Error al cargar datos')
      } catch { setError('Error de conexión') }
      finally  { setLoading(false) }
    }
    fetch_()
  }, [])

  if (loading) return <div className="center"><div className="spinner"/></div>
  if (error)   return <div className="center"><p className="err-msg">{error}</p></div>
  if (!data)   return null

  // Agrupar asignaciones por curso
  const byCourse = data.assignments.reduce<Record<number, { label: string; grade: string; parallel: string; shift: string; educationType: string; items: Assignment[] }>>((acc, a) => {
    if (!acc[a.courseId]) acc[a.courseId] = {
      label: a.courseLabel, grade: a.grade,
      parallel: a.parallel, shift: a.shift,
      educationType: a.educationType, items: []
    }
    acc[a.courseId].items.push(a)
    return acc
  }, {})

  const courses = Object.entries(byCourse)

  // Agrupar por materia para el resumen
  const bySubject = data.assignments.reduce<Record<string, number>>((acc, a) => {
    acc[a.subjectName] = (acc[a.subjectName] || 0) + 1
    return acc
  }, {})

  return (
    <div>
      {/* Resumen */}
      <div className="summary-grid">
        <div className="sum-card accent">
          <Clock size={28} color="#fff"/>
          <div>
            <div className="sum-label">Horas / semana</div>
            <div className="sum-value">{data.totalHoursPerWeek}</div>
          </div>
        </div>
        <div className="sum-card">
          <GraduationCap size={28} color="#1A3A7C"/>
          <div>
            <div className="sum-label">Cursos asignados</div>
            <div className="sum-value">{courses.length}</div>
          </div>
        </div>
        <div className="sum-card">
          <BookOpen size={28} color="#1A3A7C"/>
          <div>
            <div className="sum-label">Materias distintas</div>
            <div className="sum-value">{Object.keys(bySubject).length}</div>
          </div>
        </div>
        <div className="sum-card">
          <Users size={28} color="#1A3A7C"/>
          <div>
            <div className="sum-label">Asignaciones</div>
            <div className="sum-value">{data.assignments.length}</div>
          </div>
        </div>
      </div>

      {/* Sin asignaciones */}
      {courses.length === 0 && (
        <div className="empty-state">
          <BookOpen size={40} style={{opacity:.3}}/>
          <p>No tienes cursos asignados aún.</p>
          <span>El administrador debe asignarte materias y cursos.</span>
        </div>
      )}

      {/* Cursos */}
      <div className="section-title"><GraduationCap size={16}/> Mis cursos y materias</div>

      <div className="courses-list">
        {courses.map(([courseId, course]) => (
          <div key={courseId} className="course-card">
            {/* Header del curso */}
            <div className="course-header">
              <div className="course-avatar">
                {GRADES[course.grade]}{course.parallel}
              </div>
              <div className="course-info">
                <div className="course-name">
                  {GRADES[course.grade]} &quot;{course.parallel}&quot;
                </div>
                <div className="course-meta">
                  <span className="meta-pill">{SHIFTS[course.shift]}</span>
                  {course.educationType === 'BTH' && (
                    <span className="meta-pill bth">BTH</span>
                  )}
                  <span className="meta-pill hrs">
                    {course.items.reduce((s, i) => s + i.hoursPerWeek, 0)} hrs/sem
                  </span>
                </div>
              </div>
              <button
                className="btn-ver"
                onClick={() => router.push(`/dashboard/teacher/curso/${courseId}`)}
              >
                Ver estudiantes <ChevronRight size={14}/>
              </button>
            </div>

            {/* Materias del curso */}
            <div className="subjects-list">
              {course.items.map((a, i) => (
                <div key={i} className="subject-row">
                  <span
                    className="campo-tag"
                    style={{
                      background: CAMPO_COLORS[a.campo || ''] || '#F0F0F0',
                      color:      CAMPO_TEXT[a.campo  || ''] || '#444',
                    }}
                  >
                    {CAMPO_LABELS[a.campo || ''] || 'Sin campo'}
                  </span>
                  <span className="subject-name">{a.subjectName}</span>
                  <span className="hrs-badge">{a.hoursPerWeek} hrs/sem</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <style>{`
        .center{display:flex;justify-content:center;align-items:center;padding:48px;color:#6B8BB0;flex-direction:column;gap:8px}
        .err-msg{color:#C0392B;font-size:14px}
        .summary-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin-bottom:24px}
        .sum-card{background:#fff;border:1px solid #CBE0F0;border-radius:12px;padding:16px;display:flex;align-items:center;gap:12px}
        .sum-card.accent{background:#1A3A7C;border-color:#1A3A7C}
        .sum-card.accent .sum-label{color:rgba(255,255,255,0.7)}
        .sum-card.accent .sum-value{color:#fff}
        .sum-label{font-size:11px;color:#6B8BB0;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px}
        .sum-value{font-size:22px;font-weight:700;color:#1A3A7C}
        .section-title{display:flex;align-items:center;gap:8px;font-size:14px;font-weight:700;color:#1A3A7C;margin-bottom:12px;text-transform:uppercase;letter-spacing:.5px}
        .empty-state{text-align:center;padding:48px;color:#6B8BB0;display:flex;flex-direction:column;align-items:center;gap:8px;background:#fff;border:1px dashed #CBE0F0;border-radius:12px;margin-bottom:20px}
        .empty-state p{font-size:15px;font-weight:500;color:#1A3A7C}
        .empty-state span{font-size:13px}
        .courses-list{display:flex;flex-direction:column;gap:14px}
        .course-card{background:#fff;border:1px solid #CBE0F0;border-radius:12px;overflow:hidden}
        .course-header{display:flex;align-items:center;gap:14px;padding:14px 18px;background:#F8FBFF;border-bottom:1px solid #CBE0F0}
        .course-avatar{width:52px;height:52px;border-radius:12px;background:#1A3A7C;color:#fff;display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:800;flex-shrink:0}
        .course-info{flex:1}
        .course-name{font-size:16px;font-weight:700;color:#1A3A7C;margin-bottom:6px}
        .course-meta{display:flex;gap:6px;flex-wrap:wrap}
        .meta-pill{padding:2px 8px;border-radius:20px;font-size:11px;font-weight:500;background:#E0ECF8;color:#1A3A7C}
        .meta-pill.bth{background:#FFFBEA;color:#BA7517}
        .meta-pill.hrs{background:#E1F5EE;color:#0F6E56}
        .btn-ver{display:flex;align-items:center;gap:4px;padding:7px 12px;background:#1A3A7C;color:#fff;border:none;border-radius:8px;font-size:12px;font-weight:500;cursor:pointer;white-space:nowrap;flex-shrink:0}
        .btn-ver:hover{background:#4A9FD4}
        .subjects-list{display:flex;flex-direction:column}
        .subject-row{display:flex;align-items:center;gap:10px;padding:10px 18px;border-top:1px solid #F0F6FC}
        .subject-row:hover{background:#FAFCFF}
        .campo-tag{padding:2px 8px;border-radius:20px;font-size:11px;font-weight:500;white-space:nowrap}
        .subject-name{flex:1;font-size:13px;color:#1A3A7C;font-weight:500}
        .hrs-badge{background:#E0ECF8;color:#1A3A7C;border-radius:20px;padding:2px 10px;font-size:11px;font-weight:600;white-space:nowrap}
        .spinner{width:24px;height:24px;border:2px solid rgba(26,58,124,.2);border-top-color:#1A3A7C;border-radius:50%;animation:spin .7s linear infinite}
        @keyframes spin{to{transform:rotate(360deg)}}
        @media(max-width:768px){.summary-grid{grid-template-columns:1fr 1fr}.course-header{flex-wrap:wrap}.btn-ver{width:100%}}
      `}</style>
    </div>
  )
}