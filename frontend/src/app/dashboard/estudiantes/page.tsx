'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  BookOpen, ClipboardList, Bell, TrendingUp, AlertCircle, ChevronRight, Clock,
  Flame, Star, Award, CalendarCheck, Lock, Trophy, CalendarDays, Megaphone, CheckCircle2,
} from 'lucide-react'
import Link from 'next/link'
import Card from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import GobiernoDistritoHome from './_GobiernoDistritoHome'
import GobiernoNucleoHome from './_GobiernoNucleoHome'
import { pickMotivo, PerformanceCategoria } from './_gamification/motivationalMessages'
import { useGamification } from './_gamification/GamificationContext'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

interface StudentInfo {
  firstName:    string
  lastName:     string
  kardex:       string | null
  course?:      { id: number; grade: string; parallel: string; level: string; shift: string }
  academicYear?: { year: number }
}
interface SchedulePeriod {
  id: number; dayOfWeek: number; period: number
  startTime: string; endTime: string
  teacherSubjectCourse: {
    teacher: { firstName: string; lastName: string }
    subject: { name: string }
  }
}
type ComunicadoType = 'COMUNICADO' | 'CONVOCATORIA' | 'AVISO'
interface Comunicado {
  id: number; title: string; type: ComunicadoType; publishedAt: string
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
interface Trimestre {
  id:        number
  number:    number
  isClosed:  boolean
  startDate: string
  endDate:   string
}
interface Achievement {
  code:        string
  name:        string
  description: string
  icon:        string
  unlocked:    boolean
  unlockedAt:  string | null
}

const ACHIEVEMENT_ICONS: Record<string, typeof Flame> = {
  Flame, Star, Award, CalendarCheck,
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
const COMUNICADO_LABEL: Record<ComunicadoType, string> = { COMUNICADO: 'Comunicado', CONVOCATORIA: 'Convocatoria', AVISO: 'Aviso' }
const COMUNICADO_TONE: Record<ComunicadoType, 'brand' | 'warning' | 'danger'> = { COMUNICADO: 'brand', CONVOCATORIA: 'warning', AVISO: 'danger' }
const DAYS = ['', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']

// Saludo + mensaje de aliento — con los mismos datos que esta pantalla ya
// calcula (aprobadas/reprobadas/pendientes), sin pegarle a ningún endpoint nuevo.
function getGreeting(): { emoji: string; text: string } {
  const h = new Date().getHours()
  if (h < 12) return { emoji: '👋', text: '¡Qué tal!' }
  if (h < 19) return { emoji: '🔥', text: '¡Dale con todo!' }
  return { emoji: '🌙', text: '¡Todo bien!' }
}

export default function EstudiantesDashboard() {
  const { state: gam } = useGamification()
  const [role,          setRole]          = useState<string | null>(null)
  const [student,       setStudent]       = useState<StudentInfo | null>(null)
  const [tasks,         setTasks]         = useState<Task[]>([])
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [grades,        setGrades]        = useState<GradeSummary[]>([])
  const [trimestres,    setTrimestres]    = useState<Trimestre[]>([])
  const [achievements,  setAchievements]  = useState<Achievement[]>([])
  const [schedule,      setSchedule]      = useState<SchedulePeriod[]>([])
  const [comunicados,   setComunicados]   = useState<Comunicado[]>([])
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
      fetch(`${API_URL}/api/students/my-achievements`,  { headers: h }).then(r => r.json()),
      fetch(`${API_URL}/api/comunicados`,                { headers: h }).then(r => r.ok ? r.json() : []),
    ]).then(([s, t, n, g, a, c]) => {
      if (s.status === 'fulfilled' && s.value?.firstName) setStudent(s.value)
      else setError('No se pudo cargar el perfil')
      if (t.status === 'fulfilled') setTasks(Array.isArray(t.value) ? t.value : [])
      if (n.status === 'fulfilled') setNotifications(Array.isArray(n.value) ? n.value : [])
      if (g.status === 'fulfilled') {
        setGrades(Array.isArray(g.value?.notas) ? g.value.notas : [])
        setTrimestres(Array.isArray(g.value?.trimestres) ? g.value.trimestres : [])
      }
      if (a.status === 'fulfilled') setAchievements(Array.isArray(a.value) ? a.value : [])
      if (c.status === 'fulfilled') setComunicados(Array.isArray(c.value) ? c.value : [])
      setLoading(false)
    })
  }, [role])

  // Horario de hoy — mismo endpoint que ya usa Mi Horario, se pide recién
  // cuando se conoce el curso del estudiante.
  useEffect(() => {
    if (!student?.course?.id) return
    const token = localStorage.getItem('token')
    if (!token) return
    fetch(`${API_URL}/api/schedules/course/${student.course.id}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(data => setSchedule(data?.schedule?.flatMap((d: any) => d.periods) || []))
      .catch(() => {})
  }, [student?.course?.id])

  const pendingTasks = tasks.filter(t => t.status === 'PENDIENTE').length
  const unreadNotifs = notifications.filter(n => !n.isRead).length
  const notasConProm = grades.filter(g => g.avg !== null)
  const avgGradeNum  = notasConProm.length
    ? notasConProm.reduce((s, g) => s + (g.avg ?? 0), 0) / notasConProm.length
    : null
  const avgGrade   = avgGradeNum !== null ? avgGradeNum.toFixed(1) : '—'
  const aprobadas  = notasConProm.filter(g => (g.avg ?? 0) >= 51).length
  const reprobadas = notasConProm.filter(g => (g.avg ?? 0) < 51).length
  const greeting   = getGreeting()

  const categoria: PerformanceCategoria = avgGradeNum === null ? 'sinNotas'
    : avgGradeNum >= 75 ? 'alto' : avgGradeNum >= 51 ? 'medio' : 'bajo'

  const primerTrimestre  = trimestres.find(t => t.number === 1)
  const trimestreAbierto = trimestres.find(t => !t.isClosed)

  // Clases de hoy — mismo criterio que Mi Horario. El estado de cada período
  // se deriva de la hora actual (Ahora/Pendiente) y, para las que ya pasaron,
  // de la asistencia del día (ya viene en el weekCalendar de gamificación) —
  // no hay asistencia por período en el sistema, solo por día.
  const now         = new Date()
  const todayDay    = now.getDay() === 0 ? 7 : now.getDay()
  const todayKey    = now.toISOString().split('T')[0]
  const todayStatus = gam.weekCalendar.find(d => d.date === todayKey)?.status ?? null

  const clasesHoy = schedule
    .filter(s => s.dayOfWeek === todayDay)
    .sort((a, b) => a.period - b.period)
    .map(item => {
      const [sh, sm] = item.startTime.split(':').map(Number)
      const [eh, em] = item.endTime.split(':').map(Number)
      const start = new Date(now); start.setHours(sh, sm, 0, 0)
      const end   = new Date(now); end.setHours(eh, em, 0, 0)
      let estado: 'pendiente' | 'ahora' | 'asisti' | 'falte' | 'sinregistro' = 'pendiente'
      if (now >= start && now <= end) estado = 'ahora'
      else if (now > end) {
        estado = todayStatus === 'PRESENTE' || todayStatus === 'RETRASO' ? 'asisti'
          : todayStatus === 'AUSENTE' || todayStatus === 'LICENCIA' ? 'falte' : 'sinregistro'
      }
      return { ...item, estado }
    })

  // useMemo con `categoria` como dependencia: se elige una variante al azar
  // una sola vez por carga de página, no en cada render.
  const motivo = useMemo(() => pickMotivo(categoria, {
    academicYearStart: primerTrimestre ? new Date(primerTrimestre.startDate) : null,
    trimesterEnd:      trimestreAbierto ? new Date(trimestreAbierto.endDate) : null,
  }), [categoria, primerTrimestre?.startDate, trimestreAbierto?.endDate])

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
      <div
        className="rounded-2xl px-7 py-6 mb-5 text-white flex items-center justify-between flex-wrap gap-4 shadow-lg"
        style={{ background: 'linear-gradient(90deg, #3B5BDB, #5B7CF0)' }}
      >
        <div className="flex flex-col gap-2">
          <div className="text-[13px] opacity-80">{greeting.emoji} {greeting.text}</div>
          <div className="text-2xl font-extrabold tracking-tight">{student ? `${student.firstName}` : '—'} 💪</div>
          <div className="text-[12.5px] font-semibold opacity-95">{motivo.emoji} {motivo.text}</div>
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
        <div className="bg-accent-500 rounded-xl px-5.5 py-3.5 text-center" style={{ color: '#3A2F00' }}>
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
          <AlertCircle size={28} style={{ color: 'var(--color-estudiante-alerta)' }} />
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wide mb-1 bg-accent-500 inline-block px-2 py-0.5 rounded-full" style={{ color: '#3A2F00' }}>Materias Reprobadas</div>
            <div className="text-xl font-bold" style={{ color: 'var(--color-estudiante-alerta)' }}>{reprobadas}</div>
          </div>
        </Card>
        <Card className="flex items-center gap-3">
          <ClipboardList size={28} className="text-[#BA7517]" />
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wide mb-1 bg-accent-500 inline-block px-2 py-0.5 rounded-full" style={{ color: '#3A2F00' }}>Tareas Pendientes</div>
            <div className="text-xl font-bold text-[#BA7517]">{pendingTasks}</div>
          </div>
        </Card>
        <Card className="flex items-center gap-3">
          <Bell size={28} className="text-info-500" />
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wide mb-1 bg-accent-500 inline-block px-2 py-0.5 rounded-full" style={{ color: '#3A2F00' }}>Sin Leer</div>
            <div className="text-xl font-bold text-info-500">{unreadNotifs}</div>
          </div>
        </Card>
      </div>

      {/* Clases de hoy y Comunicados */}
      <div className="grid gap-4 mb-5" style={{ gridTemplateColumns: '1.3fr 1fr' }}>
        <Card padded={false} className="overflow-hidden">
          <div className="flex items-center justify-between px-4.5 py-3.5 bg-neutral-100 border-b border-neutral-100">
            <div className="flex items-center gap-2 text-sm font-bold text-brand-700"><CalendarDays size={16} className="text-info-500" /> Clases de Hoy</div>
            <div className="flex items-center gap-3">
              {gam.enabled && gam.attendancePct !== null && (
                <span className="flex items-center gap-1 text-[11px] font-bold bg-accent-500 px-2 py-1 rounded-full" style={{ color: '#3A2F00' }}>
                  <CheckCircle2 size={12} /> {gam.attendancePct}% asistencia del trimestre
                </span>
              )}
              <Link href="/dashboard/estudiantes/horario" className="flex items-center gap-0.5 text-xs text-info-500 font-medium hover:underline">
                Ver horario <ChevronRight size={13} />
              </Link>
            </div>
          </div>
          {schedule.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-neutral-500 text-sm">
              <CalendarDays size={32} className="opacity-30" />
              <p>{student?.course ? 'No tenés clases hoy — day libre 🎉' : 'Todavía no tenés curso asignado'}</p>
            </div>
          ) : clasesHoy.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-neutral-500 text-sm">
              <CalendarDays size={32} className="opacity-30" />
              <p>No tenés clases hoy — {DAYS[todayDay] === 'Sábado' || DAYS[todayDay] === 'Domingo' ? 'a descansar 😌' : 'aprovechá para ponerte al día 📚'}</p>
            </div>
          ) : (
            clasesHoy.map(item => (
              <div key={item.id} className="flex items-center gap-3 px-4.5 py-2.5 border-t border-neutral-100">
                <div className="text-xs font-semibold text-neutral-500 w-12 shrink-0">{item.startTime}</div>
                <div className="w-1.5 h-1.5 rounded-full bg-brand-700 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-bold text-brand-700 truncate">{item.teacherSubjectCourse.subject.name}</div>
                  <div className="text-[11px] text-neutral-500 truncate">Prof. {item.teacherSubjectCourse.teacher.firstName} {item.teacherSubjectCourse.teacher.lastName}</div>
                </div>
                <Badge tone={
                  item.estado === 'asisti' ? 'success' : item.estado === 'ahora' ? 'warning' : item.estado === 'falte' ? 'danger' : 'neutral'
                }>
                  {item.estado === 'asisti' ? 'Asistí' : item.estado === 'ahora' ? 'Ahora' : item.estado === 'falte' ? 'Faltaste' : item.estado === 'sinregistro' ? 'Sin registrar' : 'Pendiente'}
                </Badge>
              </div>
            ))
          )}
        </Card>

        <Card padded={false} className="overflow-hidden">
          <div className="flex items-center justify-between px-4.5 py-3.5 bg-neutral-100 border-b border-neutral-100">
            <div className="flex items-center gap-2 text-sm font-bold text-brand-700"><Megaphone size={16} className="text-info-500" /> Comunicados</div>
          </div>
          {comunicados.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-neutral-500 text-sm">
              <Megaphone size={32} className="opacity-30" />
              <p>Todavía no hay comunicados por acá 📣</p>
            </div>
          ) : (
            comunicados.slice(0, 4).map(c => (
              <div key={c.id} className="px-4.5 py-2.5 border-t border-neutral-100">
                <div className="flex items-center gap-2 mb-1">
                  <Badge tone={COMUNICADO_TONE[c.type]}>{COMUNICADO_LABEL[c.type]}</Badge>
                  <span className="text-[10.5px] text-neutral-500 ml-auto shrink-0">{formatDate(c.publishedAt)}</span>
                </div>
                <div className="text-[13px] font-medium text-brand-700 leading-snug">{c.title}</div>
              </div>
            ))
          )}
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
              <p>Nada pendiente por acá, estás al día ✅</p>
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
                  ) : task.status === 'ENTREGADO' ? (
                    <Badge tone="brand">Entregado</Badge>
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
              <p>Todo tranqui, nada nuevo por acá 😌</p>
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

      {/* Insignias */}
      {achievements.length > 0 && (
        <Card padded={false} className="overflow-hidden mt-5">
          <div className="flex items-center justify-between px-4.5 py-3.5 bg-neutral-100 border-b border-neutral-100">
            <div className="flex items-center gap-2 text-sm font-bold text-brand-700"><Trophy size={16} className="text-info-500" /> Mis Insignias</div>
          </div>
          <div className="grid gap-3 p-4.5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))' }}>
            {achievements.map(a => {
              const Icon = ACHIEVEMENT_ICONS[a.icon] || Award
              return (
                <div
                  key={a.code}
                  className={`flex flex-col items-center text-center gap-1.5 px-3 py-4 rounded-xl border ${a.unlocked ? 'border-transparent' : 'border-neutral-300 bg-neutral-100/50'}`}
                  style={a.unlocked ? { background: 'var(--color-estudiante-logro)', color: '#1a2e05' } : undefined}
                >
                  {a.unlocked ? <Icon size={26} /> : <Lock size={22} className="text-neutral-500" />}
                  <div className={`text-[12.5px] font-bold ${a.unlocked ? '' : 'text-neutral-500'}`}>{a.name}</div>
                  <div className={`text-[10.5px] leading-snug ${a.unlocked ? 'opacity-80' : 'text-neutral-500'}`}>{a.description}</div>
                </div>
              )
            })}
          </div>
        </Card>
      )}
    </div>
  )
}
