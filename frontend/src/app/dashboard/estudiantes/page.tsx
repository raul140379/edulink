'use client'

import { useEffect, useState } from 'react'
import { BookOpen, ClipboardList, Bell, TrendingUp, AlertCircle, ChevronRight, Clock } from 'lucide-react'
import Link from 'next/link'
import Card from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import GobiernoDistritoHome from './_GobiernoDistritoHome'
import GobiernoNucleoHome from './_GobiernoNucleoHome'

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
const TYPE_TONE: Record<string, 'danger' | 'brand' | 'success' | 'warning'> = {
  EVALUACION:'danger', TRABAJO:'brand', SER:'success', DECIDIR:'warning',
}
const TYPE_LABEL: Record<string, string> = {
  EVALUACION:'Evaluación', TRABAJO:'Trabajo', SER:'Ser', DECIDIR:'Decidir',
}

export default function EstudiantesDashboard() {
  const [role,          setRole]          = useState<string | null>(null)
  const [student,       setStudent]       = useState<StudentInfo | null>(null)
  const [tasks,         setTasks]         = useState<Task[]>([])
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [grades,        setGrades]        = useState<GradeSummary[]>([])
  const [loading,       setLoading]       = useState(true)
  const [error,         setError]         = useState('')

  useEffect(() => {
    const raw = localStorage.getItem('user')
    if (raw) setRole(JSON.parse(raw).role)
  }, [])

  useEffect(() => {
    if (role === null) return // esperar a saber el rol antes de decidir qué cargar
    if (role === 'GOBIERNO_DISTRITO' || role === 'GOBIERNO_NUCLEO') { setLoading(false); return }
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
  }, [role])

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

  if (role === 'GOBIERNO_DISTRITO') return <GobiernoDistritoHome/>
  if (role === 'GOBIERNO_NUCLEO')   return <GobiernoNucleoHome/>

  if (loading) return <div className="flex justify-center py-16"><p className="text-sm text-neutral-500">Cargando...</p></div>
  if (error)   return <div className="flex justify-center py-16"><p className="text-sm text-danger-600">{error}</p></div>

  return (
    <div>
      {/* Banner */}
      <div className="bg-gradient-to-br from-brand-500 via-brand-600 to-brand-700 rounded-2xl px-7 py-6 mb-5 text-white flex items-center justify-between flex-wrap gap-4 shadow-lg">
        <div className="flex flex-col gap-2">
          <div className="text-[13px] opacity-80">🎓 Bienvenido/a de vuelta</div>
          <div className="text-2xl font-extrabold tracking-tight">{student ? `${student.lastName} ${student.firstName}` : '—'}</div>
          {student?.course && (
            <div className="flex items-center gap-2 text-[13px] opacity-85 flex-wrap">
              <span className="bg-white/20 rounded-full px-2.5 py-0.5 font-bold">
                {GRADE_LABEL[student.course.grade] || student.course.grade} &quot;{student.course.parallel}&quot;
              </span>
              <span>{student.course.level}</span>
              <span>·</span>
              <span>Turno {SHIFT_LABEL[student.course.shift] || student.course.shift}</span>
              {student.academicYear && <span>· Gestión {student.academicYear.year}</span>}
            </div>
          )}
        </div>
        <div className="bg-white/15 rounded-xl px-5.5 py-3.5 text-center backdrop-blur-sm">
          <div className="text-3xl font-extrabold">{avgGrade}</div>
          <div className="text-[11px] opacity-80 mt-0.5">Promedio General</div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-3 mb-5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
        <Card className="flex items-center gap-3 !bg-brand-700 !border-brand-700">
          <TrendingUp size={28} className="text-white" />
          <div>
            <div className="text-[11px] text-white/75 uppercase tracking-wide mb-0.5">Materias Aprobadas</div>
            <div className="text-xl font-bold text-white">{aprobadas}</div>
          </div>
        </Card>
        <Card className="flex items-center gap-3">
          <AlertCircle size={28} className="text-danger-600" />
          <div>
            <div className="text-[11px] text-neutral-500 uppercase tracking-wide mb-0.5">Materias Reprobadas</div>
            <div className="text-xl font-bold text-danger-600">{reprobadas}</div>
          </div>
        </Card>
        <Card className="flex items-center gap-3">
          <ClipboardList size={28} className="text-[#BA7517]" />
          <div>
            <div className="text-[11px] text-neutral-500 uppercase tracking-wide mb-0.5">Tareas Pendientes</div>
            <div className="text-xl font-bold text-[#BA7517]">{pendingTasks}</div>
          </div>
        </Card>
        <Card className="flex items-center gap-3">
          <Bell size={28} className="text-info-500" />
          <div>
            <div className="text-[11px] text-neutral-500 uppercase tracking-wide mb-0.5">Sin Leer</div>
            <div className="text-xl font-bold text-info-500">{unreadNotifs}</div>
          </div>
        </Card>
      </div>

      {/* Tareas y Notificaciones */}
      <div className="grid gap-4" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <Card padded={false} className="overflow-hidden">
          <div className="flex items-center justify-between px-4.5 py-3.5 bg-neutral-100 border-b border-neutral-100">
            <div className="flex items-center gap-2 text-sm font-bold text-brand-700"><ClipboardList size={16} className="text-info-500" /> Tareas Recientes</div>
            <Link href="/dashboard/estudiantes/tareas" className="flex items-center gap-0.5 text-xs text-info-500 font-medium hover:underline">
              Ver todas <ChevronRight size={13} />
            </Link>
          </div>
          {tasks.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-neutral-500 text-sm">
              <ClipboardList size={32} className="opacity-30" />
              <p>Sin tareas registradas</p>
            </div>
          ) : (
            tasks.slice(0, 5).map(task => (
              <div key={task.id} className="flex items-center justify-between gap-2 px-4.5 py-2.5 border-t border-neutral-100 hover:bg-neutral-100/60">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <Badge tone={TYPE_TONE[task.type] || 'neutral'}>{TYPE_LABEL[task.type] || task.type}</Badge>
                    {task.dueDate && <span className="text-[10px] text-[#BA7517] flex items-center gap-0.5"><Clock size={9} /> {formatDate(task.dueDate)}</span>}
                  </div>
                  <div className="text-[13px] font-medium text-brand-700 truncate">{task.title}</div>
                  <div className="text-[11px] text-neutral-500">{task.subject?.name}</div>
                </div>
                <div className="shrink-0 ml-3 text-center">
                  {task.score !== null ? (
                    <span className={`text-lg font-extrabold ${task.score >= 51 ? 'text-success-700' : 'text-danger-600'}`}>{task.score}</span>
                  ) : (
                    <Badge tone="warning">Pendiente</Badge>
                  )}
                </div>
              </div>
            ))
          )}
        </Card>

        <Card padded={false} className="overflow-hidden">
          <div className="flex items-center justify-between px-4.5 py-3.5 bg-neutral-100 border-b border-neutral-100">
            <div className="flex items-center gap-2 text-sm font-bold text-brand-700">
              <Bell size={16} className="text-info-500" /> Notificaciones
              {unreadNotifs > 0 && <span className="bg-info-500 text-white text-[10px] font-extrabold px-1.5 py-0.5 rounded-full">{unreadNotifs}</span>}
            </div>
            <Link href="/dashboard/estudiantes/notificaciones" className="flex items-center gap-0.5 text-xs text-info-500 font-medium hover:underline">
              Ver todas <ChevronRight size={13} />
            </Link>
          </div>
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-neutral-500 text-sm">
              <Bell size={32} className="opacity-30" />
              <p>Sin notificaciones</p>
            </div>
          ) : (
            notifications.slice(0, 5).map(n => (
              <div key={n.id} className={`flex items-center justify-between gap-2 px-4.5 py-2.5 border-t border-neutral-100 ${n.isRead ? '' : 'bg-info-500/5 border-l-2 border-l-info-500'}`}>
                <span className={`text-[13px] text-brand-700 truncate ${n.isRead ? 'font-normal' : 'font-semibold'}`}>{n.title}</span>
                <span className="text-[11px] text-neutral-500 whitespace-nowrap shrink-0">{formatDate(n.createdAt)}</span>
              </div>
            ))
          )}
        </Card>
      </div>

      {/* Calificaciones por materia */}
      {grades.length > 0 && (
        <Card padded={false} className="overflow-hidden mt-5">
          <div className="flex items-center justify-between px-4.5 py-3.5 bg-neutral-100 border-b border-neutral-100">
            <div className="flex items-center gap-2 text-sm font-bold text-brand-700"><BookOpen size={16} className="text-info-500" /> Resumen de Calificaciones</div>
            <Link href="/dashboard/estudiantes/calificaciones" className="flex items-center gap-0.5 text-xs text-info-500 font-medium hover:underline">
              Ver detalle <ChevronRight size={13} />
            </Link>
          </div>
          <div className="grid gap-px bg-neutral-100" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))' }}>
            {grades.map(g => (
              <div key={g.subjectName} className="bg-white px-4 py-3 flex items-center justify-between hover:bg-neutral-100/40">
                <span className="text-[13px] font-medium text-brand-700 truncate mr-2">{g.subjectName}</span>
                <span className={`text-base font-extrabold shrink-0 ${g.avg === null ? 'text-neutral-500' : g.avg >= 51 ? 'text-success-700' : 'text-danger-600'}`}>
                  {g.avg?.toFixed(1) ?? '—'}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}
