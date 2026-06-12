'use client'

import { useEffect, useState } from 'react'
import { BookOpen, ClipboardList, Bell, TrendingUp, CheckCircle, AlertCircle, ChevronRight, Clock } from 'lucide-react'
import Link from 'next/link'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

interface StudentInfo {
  firstName:    string
  lastName:     string
  kardex:       string | null
  course?:      { grade: string; parallel: string; level: string; shift: string }
  academicYear?: { year: number }
}
interface Task {
  id:       number
  title:    string
  type:     string
  subject?: { name: string }
  dueDate?: string | null
  score:    number | null
  status:   string
}
interface Notification {
  id:        number
  title:     string
  createdAt: string
  isRead:    boolean
  type:      string
}
interface GradeSummary {
  subjectName: string
  avg:         number | null
}

const GRADE_LABEL: Record<string, string> = {
  PRIMERO:'1°', SEGUNDO:'2°', TERCERO:'3°', CUARTO:'4°', QUINTO:'5°', SEXTO:'6°',
}
const SHIFT_LABEL: Record<string, string> = {
  MORNING:'Mañana', AFTERNOON:'Tarde', NIGHT:'Noche',
}
const TYPE_COLOR: Record<string, string> = {
  EVALUACION:'#c0392b', TRABAJO:'#1A3A7C', SER:'#0F6E56', DECIDIR:'#633806',
}
const TYPE_LABEL: Record<string, string> = {
  EVALUACION:'Evaluación', TRABAJO:'Trabajo', SER:'Ser', DECIDIR:'Decidir',
}

export default function EstudiantesDashboard() {
  const [student,       setStudent]       = useState<StudentInfo | null>(null)
  const [tasks,         setTasks]         = useState<Task[]>([])
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [grades,        setGrades]        = useState<GradeSummary[]>([])
  const [loading,       setLoading]       = useState(true)
  const [error,         setError]         = useState('')

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) return
    const h = { Authorization: `Bearer ${token}` }
    Promise.allSettled([
      fetch(`${API_URL}/api/students/me`,              { headers: h }).then(r => r.json()),
      fetch(`${API_URL}/api/students/my-tasks`,         { headers: h }).then(r => r.json()),
      fetch(`${API_URL}/api/students/my-notifications`, { headers: h }).then(r => r.json()),
      fetch(`${API_URL}/api/students/my-grades`,        { headers: h }).then(r => r.json()),
    ]).then(([s, t, n, g]) => {
      if (s.status === 'fulfilled' && s.value?.firstName) setStudent(s.value)
      else setError('No se pudo cargar el perfil')
      if (t.status === 'fulfilled') setTasks(Array.isArray(t.value) ? t.value : [])
      if (n.status === 'fulfilled') setNotifications(Array.isArray(n.value) ? n.value : [])
      if (g.status === 'fulfilled') setGrades(Array.isArray(g.value?.notas) ? g.value.notas : [])
      setLoading(false)
    })
  }, [])

  const pendingTasks = tasks.filter(t => t.status === 'PENDIENTE').length
  const unreadNotifs = notifications.filter(n => !n.isRead).length
  const notasConProm = grades.filter(g => g.avg !== null)
  const avgGrade     = notasConProm.length
    ? (notasConProm.reduce((s, g) => s + (g.avg ?? 0), 0) / notasConProm.length).toFixed(1)
    : '—'
  const aprobadas  = notasConProm.filter(g => (g.avg ?? 0) >= 51).length
  const reprobadas = notasConProm.filter(g => (g.avg ?? 0) < 51).length

  const formatDate = (d?: string | null) => {
    if (!d) return ''
    const date = new Date(d)
    const now  = new Date()
    const diff = Math.floor((now.getTime() - date.getTime()) / 86400000)
    if (diff === 0) return 'Hoy'
    if (diff === 1) return 'Ayer'
    return date.toLocaleDateString('es-BO', { day:'2-digit', month:'short' })
  }

  if (loading) return <div className="center"><div className="spinner"/></div>
  if (error)   return <div className="center"><p className="err-msg">{error}</p></div>

  return (
    <div>
      {/* Banner */}
      <div className="banner">
        <div className="banner-left">
          <div className="banner-greeting">🎓 Bienvenido/a de vuelta</div>
          <div className="banner-name">
            {student ? `${student.lastName} ${student.firstName}` : '—'}
          </div>
          {student?.course && (
            <div className="banner-meta">
              <span className="banner-pill">
                {GRADE_LABEL[student.course.grade] || student.course.grade} &quot;{student.course.parallel}&quot;
              </span>
              <span>{student.course.level}</span>
              <span>·</span>
              <span>Turno {SHIFT_LABEL[student.course.shift] || student.course.shift}</span>
              {student.academicYear && <span>· Gestión {student.academicYear.year}</span>}
            </div>
          )}
        </div>
        <div className="banner-avg">
          <div className="avg-value">{avgGrade}</div>
          <div className="avg-label">Promedio General</div>
        </div>
      </div>

      {/* Stats */}
      <div className="summary-grid">
        <div className="sum-card accent">
          <TrendingUp size={28} color="#fff"/>
          <div>
            <div className="sum-label">Materias Aprobadas</div>
            <div className="sum-value">{aprobadas}</div>
          </div>
        </div>
        <div className="sum-card">
          <AlertCircle size={28} color="#c0392b"/>
          <div>
            <div className="sum-label">Materias Reprobadas</div>
            <div className="sum-value" style={{ color:'#c0392b' }}>{reprobadas}</div>
          </div>
        </div>
        <div className="sum-card">
          <ClipboardList size={28} color="#BA7517"/>
          <div>
            <div className="sum-label">Tareas Pendientes</div>
            <div className="sum-value" style={{ color:'#BA7517' }}>{pendingTasks}</div>
          </div>
        </div>
        <div className="sum-card">
          <Bell size={28} color="#1A7DB8"/>
          <div>
            <div className="sum-label">Sin Leer</div>
            <div className="sum-value" style={{ color:'#1A7DB8' }}>{unreadNotifs}</div>
          </div>
        </div>
      </div>

      {/* Tareas y Notificaciones */}
      <div className="two-cols">

        {/* Tareas recientes */}
        <div className="card">
          <div className="card-header">
            <div className="card-title"><ClipboardList size={16} color="#1A7DB8"/> Tareas Recientes</div>
            <Link href="/dashboard/estudiantes/tareas" className="ver-todas">
              Ver todas <ChevronRight size={13}/>
            </Link>
          </div>
          {tasks.length === 0 ? (
            <div className="empty-state">
              <ClipboardList size={32} style={{ opacity:.3 }}/>
              <p>Sin tareas registradas</p>
            </div>
          ) : (
            tasks.slice(0, 5).map(task => (
              <div key={task.id} className="list-row">
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:3 }}>
                    <span className="type-badge" style={{ backgroundColor: TYPE_COLOR[task.type] || '#6B8BB0' }}>
                      {TYPE_LABEL[task.type] || task.type}
                    </span>
                    {task.dueDate && (
                      <span className="due-date"><Clock size={9}/> {formatDate(task.dueDate)}</span>
                    )}
                  </div>
                  <div className="row-title">{task.title}</div>
                  <div className="row-sub">{task.subject?.name}</div>
                </div>
                <div style={{ flexShrink:0, marginLeft:12, textAlign:'center' }}>
                  {task.score !== null ? (
                    <span className="score" style={{ color: task.score >= 51 ? '#0F6E56' : '#c0392b' }}>
                      {task.score}
                    </span>
                  ) : (
                    <span className="pending-badge">Pendiente</span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Notificaciones recientes */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">
              <Bell size={16} color="#1A7DB8"/> Notificaciones
              {unreadNotifs > 0 && <span className="notif-count">{unreadNotifs}</span>}
            </div>
            <Link href="/dashboard/estudiantes/notificaciones" className="ver-todas">
              Ver todas <ChevronRight size={13}/>
            </Link>
          </div>
          {notifications.length === 0 ? (
            <div className="empty-state">
              <Bell size={32} style={{ opacity:.3 }}/>
              <p>Sin notificaciones</p>
            </div>
          ) : (
            notifications.slice(0, 5).map(n => (
              <div key={n.id} className="list-row"
                style={{
                  backgroundColor: n.isRead ? '#fff' : '#F5FBFF',
                  borderLeft: n.isRead ? '3px solid transparent' : '3px solid #1A7DB8',
                }}>
                <span className="row-title" style={{ fontWeight: n.isRead ? 400 : 600 }}>{n.title}</span>
                <span className="row-date">{formatDate(n.createdAt)}</span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Calificaciones por materia */}
      {grades.length > 0 && (
        <div className="card" style={{ marginTop:20 }}>
          <div className="card-header">
            <div className="card-title"><BookOpen size={16} color="#1A7DB8"/> Resumen de Calificaciones</div>
            <Link href="/dashboard/estudiantes/calificaciones" className="ver-todas">
              Ver detalle <ChevronRight size={13}/>
            </Link>
          </div>
          <div className="grades-grid">
            {grades.map(g => (
              <div key={g.subjectName} className="grade-item">
                <span className="grade-subject">{g.subjectName}</span>
                <span className="grade-avg" style={{
                  color: g.avg === null ? '#6B8BB0' : g.avg >= 51 ? '#0F6E56' : '#c0392b'
                }}>
                  {g.avg?.toFixed(1) ?? '—'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <style>{`
        .center{display:flex;justify-content:center;align-items:center;padding:48px;color:#6B8BB0;flex-direction:column;gap:8px}
        .err-msg{color:#C0392B;font-size:14px}
        .banner{background:linear-gradient(135deg,#1A7DB8 0%,#1565A0 60%,#1A3A7C 100%);border-radius:14px;padding:24px 28px;margin-bottom:20px;color:#fff;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:16px;box-shadow:0 4px 16px rgba(74,159,212,.3)}
        .banner-left{display:flex;flex-direction:column;gap:8px}
        .banner-greeting{font-size:13px;opacity:.8}
        .banner-name{font-size:24px;font-weight:800;letter-spacing:-.3px}
        .banner-meta{display:flex;align-items:center;gap:8px;font-size:13px;opacity:.85;flex-wrap:wrap}
        .banner-pill{background:rgba(255,255,255,.2);border-radius:20px;padding:2px 10px;font-weight:700}
        .banner-avg{background:rgba(255,255,255,.15);border-radius:12px;padding:14px 22px;text-align:center;backdrop-filter:blur(4px)}
        .avg-value{font-size:30px;font-weight:800}
        .avg-label{font-size:11px;opacity:.8;margin-top:2px}
        .summary-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin-bottom:20px}
        .sum-card{background:#fff;border:1px solid #CBE0F0;border-radius:12px;padding:16px;display:flex;align-items:center;gap:12px}
        .sum-card.accent{background:#1A7DB8;border-color:#1A7DB8}
        .sum-card.accent .sum-label{color:rgba(255,255,255,.75)}
        .sum-card.accent .sum-value{color:#fff}
        .sum-label{font-size:11px;color:#6B8BB0;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px}
        .sum-value{font-size:22px;font-weight:700;color:#1A3A7C}
        .two-cols{display:grid;grid-template-columns:1fr 1fr;gap:16px}
        .card{background:#fff;border:1px solid #CBE0F0;border-radius:12px;overflow:hidden}
        .card-header{display:flex;align-items:center;justify-content:space-between;padding:13px 18px;background:#F8FBFF;border-bottom:1px solid #CBE0F0}
        .card-title{display:flex;align-items:center;gap:8px;font-size:14px;font-weight:700;color:#1A3A7C}
        .ver-todas{display:flex;align-items:center;gap:2px;font-size:12px;color:#1A7DB8;text-decoration:none;font-weight:500}
        .ver-todas:hover{text-decoration:underline}
        .notif-count{background:#1A7DB8;color:#fff;font-size:10px;font-weight:800;padding:1px 7px;border-radius:20px}
        .list-row{display:flex;align-items:center;justify-content:space-between;padding:11px 18px;border-top:1px solid #F0F6FC;gap:8px}
        .list-row:hover{background:#FAFCFF}
        .type-badge{font-size:9px;font-weight:700;padding:1px 7px;border-radius:20px;color:#fff}
        .due-date{font-size:10px;color:#BA7517;display:flex;align-items:center;gap:2px}
        .row-title{font-size:13px;font-weight:500;color:#1A3A7C;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .row-sub{font-size:11px;color:#6B8BB0}
        .row-date{font-size:11px;color:#6B8BB0;white-space:nowrap;flex-shrink:0}
        .score{font-size:18px;font-weight:800}
        .pending-badge{font-size:10px;color:#BA7517;background:#FFFBEA;padding:2px 8px;border-radius:20px;font-weight:600}
        .empty-state{display:flex;flex-direction:column;align-items:center;gap:8px;padding:32px;color:#6B8BB0;font-size:13px}
        .grades-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:1px;background:#F0F6FC}
        .grade-item{background:#fff;padding:13px 16px;display:flex;align-items:center;justify-content:space-between}
        .grade-item:hover{background:#FAFCFF}
        .grade-subject{font-size:13px;color:#1A3A7C;font-weight:500;flex:1;margin-right:8px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .grade-avg{font-size:16px;font-weight:800;flex-shrink:0}
        .spinner{width:28px;height:28px;border:3px solid rgba(74,159,212,.2);border-top-color:#1A7DB8;border-radius:50%;animation:spin .7s linear infinite}
        @keyframes spin{to{transform:rotate(360deg)}}
        @media(max-width:900px){.summary-grid{grid-template-columns:1fr 1fr}}
        @media(max-width:768px){.two-cols{grid-template-columns:1fr}}
      `}</style>
    </div>
  )
}