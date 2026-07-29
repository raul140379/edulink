'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { BookOpen, Users, Clock, GraduationCap, ChevronRight, CalendarDays, ClipboardCheck } from 'lucide-react'
import Card from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

interface ScheduleItem {
  id: number; dayOfWeek: number; period: number
  startTime: string; endTime: string
  course: { id: number; grade: string; parallel: string }
  teacherSubjectCourse: { subject: { name: string } }
}

interface PendingByTask {
  taskId: number; title: string
  subject: { id: number; name: string }
  course:  { id: number; grade: string; parallel: string }
  count: number
}

interface PendingGrading { total: number; byTask: PendingByTask[] }

const SUBJECT_EMOJI: Record<string,string> = {
  'Matemática':                                  '🔢',
  'Lenguas Castellana y Originaria':             '📖',
  'Lengua Extranjera':                           '🌍',
  'Ciencias Sociales':                           '🏛️',
  'Ciencias Naturales: Biología':                '🧬',
  'Física':                                      '⚛️',
  'Química':                                     '🧪',
  'Educación Física y Deportes':                 '⚽',
  'Educación Musical':                           '🎵',
  'Artes Plásticas y Visuales':                  '🎨',
  'Cosmovisiones y Filosofía':                   '🌌',
  'Valores, Espiritualidad y Religiones':        '☮️',
  'Psicología':                                  '🧠',
  'Técnica Tecnológica General':                 '⚙️',
  'Técnica Tecnológica General y Especializada': '🔧',
}

// Saludo + frase corta según hora del día — tono profesional-cálido (no la
// jerga juvenil del panel Estudiante, no aplica a un docente). Se elige una
// variante al azar una sola vez por carga de página.
const GREETING_LINES: Record<'morning'|'afternoon'|'evening', { emoji: string; texts: string[] }> = {
  morning: {
    emoji: '🌅',
    texts: [
      'Que tenga un excelente día de clases.',
      'Gracias por el trabajo de cada día con sus estudiantes.',
      'Un día más formando a los chicos de El Torno.',
      'Éxitos en sus clases de hoy.',
    ],
  },
  afternoon: {
    emoji: '☀️',
    texts: [
      'Espero que su jornada esté yendo bien.',
      'Cada clase que prepara hace la diferencia.',
      'Gracias por su dedicación con los estudiantes.',
      'Sigamos adelante con la jornada.',
    ],
  },
  evening: {
    emoji: '🌙',
    texts: [
      'Gracias por su trabajo de hoy.',
      'Que descanse, mañana sigue la labor educativa.',
      'Un día más aportando a la educación de El Torno.',
      'Buen trabajo hoy con sus estudiantes.',
    ],
  },
}

function getGreeting() {
  const h = new Date().getHours()
  const bucket = h < 12 ? 'morning' : h < 19 ? 'afternoon' : 'evening'
  const label  = h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches'
  const { emoji, texts } = GREETING_LINES[bucket]
  return { emoji, label, text: texts[Math.floor(Math.random() * texts.length)] }
}

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
  periodosAsignados: number
}

interface HorarioResumen {
  horarioId:     number
  nombre:        string
  turno:         string
  isWinter:      boolean
  minPeriodo:    number
  totalPeriodos: number
  horasSemana:   number
  horasMes:      number
}

interface Workload {
  totalHoursPerWeek:  number
  horasContratadaMes: number
  totalesPorHorario:  HorarioResumen[]
  assignments:        Assignment[]
}

const CAMPO_TONE: Record<string, 'success' | 'brand' | 'info' | 'warning'> = {
  VIDA_TIERRA_TERRITORIO:        'success',
  COMUNIDAD_SOCIEDAD:            'brand',
  COSMOS_PENSAMIENTO:            'info',
  CIENCIA_TECNOLOGIA_PRODUCCION: 'warning',
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
  const [data,     setData]     = useState<Workload | null>(null)
  const [schedule, setSchedule] = useState<ScheduleItem[]>([])
  const [pending,  setPending]  = useState<PendingGrading>({ total: 0, byTask: [] })
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState('')

  const email = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('user') || '{}')?.email : ''

  useEffect(() => {
    const fetch_ = async () => {
      const token = localStorage.getItem('token')
      const headers = { Authorization: `Bearer ${token}` }
      setLoading(true)
      try {
        const [wRes, sRes, pRes] = await Promise.allSettled([
          fetch(`${API_URL}/api/teachers/my-workload`, { headers }).then(r => r.json()),
          fetch(`${API_URL}/api/schedules/my-schedule`, { headers }).then(r => r.json()),
          fetch(`${API_URL}/api/tasks/my-pending-review`, { headers }).then(r => r.json()),
        ])
        if (wRes.status === 'fulfilled' && wRes.value && !wRes.value.message) setData(wRes.value)
        else setError('Error al cargar datos')
        if (sRes.status === 'fulfilled' && Array.isArray(sRes.value)) {
          setSchedule(sRes.value.flatMap((d: any) => d.periods || []))
        }
        if (pRes.status === 'fulfilled' && pRes.value?.total !== undefined) setPending(pRes.value)
      } catch { setError('Error de conexión') }
      finally  { setLoading(false) }
    }
    fetch_()
  }, [])

  const greeting = useMemo(() => getGreeting(), [])

  const now      = new Date()
  const todayDay = now.getDay() === 0 ? 7 : now.getDay()
  const clasesHoy = schedule
    .filter(s => s.dayOfWeek === todayDay)
    .sort((a, b) => a.period - b.period)
    .map(item => {
      const [sh, sm] = item.startTime.split(':').map(Number)
      const [eh, em] = item.endTime.split(':').map(Number)
      const start = new Date(now); start.setHours(sh, sm, 0, 0)
      const end   = new Date(now); end.setHours(eh, em, 0, 0)
      const estado: 'proxima' | 'ahora' | 'finalizada' =
        now >= start && now <= end ? 'ahora' : now > end ? 'finalizada' : 'proxima'
      return { ...item, estado }
    })

  // Cursos que le tocan mañana (día 7 = domingo, no hay clases).
  const tomorrow    = new Date(now); tomorrow.setDate(now.getDate() + 1)
  const tomorrowDay = tomorrow.getDay() === 0 ? 7 : tomorrow.getDay()
  const tomorrowPeriodByCourse: Record<number, { grade: string; parallel: string; period: number }> = {}
  schedule
    .filter(s => s.dayOfWeek === tomorrowDay)
    .forEach(s => {
      const prev = tomorrowPeriodByCourse[s.course.id]
      if (!prev || s.period < prev.period) {
        tomorrowPeriodByCourse[s.course.id] = { grade: s.course.grade, parallel: s.course.parallel, period: s.period }
      }
    })
  const tomorrowCourses = Object.entries(tomorrowPeriodByCourse)
    .map(([courseId, v]) => ({ courseId: +courseId, ...v }))
    .sort((a, b) => a.period - b.period)

  if (loading) return <div className="flex justify-center py-16"><p className="text-sm text-neutral-500">Cargando...</p></div>
  if (error)   return <div className="flex justify-center py-16"><p className="text-sm text-danger-600">{error}</p></div>
  if (!data)   return null

  const byCourse = data.assignments.reduce<Record<number, {
    label: string; grade: string; parallel: string
    shift: string; educationType: string; items: Assignment[]
  }>>((acc, a) => {
    if (!acc[a.courseId]) acc[a.courseId] = {
      label: a.courseLabel, grade: a.grade,
      parallel: a.parallel, shift: a.shift,
      educationType: a.educationType, items: []
    }
    acc[a.courseId].items.push(a)
    return acc
  }, {})

  const courses = Object.entries(byCourse)

  const bySubject = data.assignments.reduce<Record<string, number>>((acc, a) => {
    acc[a.subjectName] = (acc[a.subjectName] || 0) + 1
    return acc
  }, {})

  return (
    <div>
      {/* Saludo */}
      <div className="rounded-2xl px-6 py-5 mb-5 text-white" style={{ background: 'linear-gradient(90deg, #1F3B34, #2F6F5E)' }}>
        <div className="text-[13px] opacity-80">{greeting.emoji} {greeting.label}{email ? `, ${email.split('@')[0]}` : ''}</div>
        <div className="text-[15px] font-semibold mt-1 opacity-95">{greeting.text}</div>
      </div>

      {/* Clases de Hoy + Trabajos pendientes */}
      <div className="grid gap-4 mb-5" style={{ gridTemplateColumns: '1.3fr 1fr' }}>
        <Card padded={false} className="overflow-hidden">
          <div className="flex items-center justify-between px-4.5 py-3.5 bg-neutral-100 border-b border-neutral-100">
            <div className="flex items-center gap-2 text-sm font-bold text-brand-700"><CalendarDays size={16} className="text-info-500" /> Clases de Hoy</div>
            <Link href="/dashboard/plantel-docente/horario" className="flex items-center gap-0.5 text-xs text-info-500 font-medium hover:underline">
              Ver horario <ChevronRight size={13} />
            </Link>
          </div>
          {clasesHoy.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-neutral-500 text-sm">
              <CalendarDays size={32} className="opacity-30" />
              <p>No tenés clases hoy</p>
            </div>
          ) : (
            clasesHoy.map(item => (
              <div key={item.id} className="flex items-center gap-3 px-4.5 py-2.5 border-t border-neutral-100 first:border-t-0">
                <span className="text-lg shrink-0">{SUBJECT_EMOJI[item.teacherSubjectCourse.subject.name] || '📚'}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-bold text-brand-700 truncate">{item.teacherSubjectCourse.subject.name}</div>
                  <div className="text-[11px] text-neutral-500 truncate">
                    P{item.period} · {item.startTime}–{item.endTime} · {GRADES[item.course.grade]} &quot;{item.course.parallel}&quot;
                  </div>
                </div>
                <Badge tone={item.estado === 'ahora' ? 'warning' : item.estado === 'finalizada' ? 'neutral' : 'brand'}>
                  {item.estado === 'ahora' ? 'Ahora' : item.estado === 'finalizada' ? 'Finalizada' : 'Próxima'}
                </Badge>
              </div>
            ))
          )}
        </Card>

        <Card padded={false} className="overflow-hidden">
          <div className="flex items-center justify-between px-4.5 py-3.5 bg-neutral-100 border-b border-neutral-100">
            <div className="flex items-center gap-2 text-sm font-bold text-brand-700"><ClipboardCheck size={16} className="text-info-500" /> Trabajos pendientes</div>
            {pending.total > 0 && <Badge tone="warning">{pending.total}</Badge>}
          </div>
          {pending.byTask.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-neutral-500 text-sm text-center px-4">
              <ClipboardCheck size={32} className="opacity-30" />
              <p>Estás al día, no tenés nada pendiente de calificar 🎉</p>
            </div>
          ) : (
            pending.byTask.slice(0, 5).map(t => (
              <Link
                key={t.taskId}
                href="/dashboard/plantel-docente/tareas"
                className="flex items-center gap-3 px-4.5 py-2.5 border-t border-neutral-100 first:border-t-0 hover:bg-neutral-100/40"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-bold text-brand-700 truncate">{t.subject.name}</div>
                  <div className="text-[11px] text-neutral-500 truncate">{GRADES[t.course.grade]} &quot;{t.course.parallel}&quot; · {t.title}</div>
                </div>
                <Badge tone="warning">{t.count}</Badge>
              </Link>
            ))
          )}
        </Card>
      </div>

      {/* Preview de mañana */}
      <div className="bg-brand-100 rounded-xl p-3.5 mb-5 text-xs text-brand-700 flex items-center gap-2 flex-wrap">
        <span className="font-bold shrink-0">📆 Mañana:</span>
        {tomorrowDay === 7 ? (
          <span className="text-brand-700/70">No hay clases — es domingo</span>
        ) : tomorrowCourses.length === 0 ? (
          <span className="text-brand-700/70">No tenés clases</span>
        ) : (
          tomorrowCourses.map(c => (
            <span key={c.courseId} className="bg-white rounded-full px-2.5 py-0.5 font-semibold border border-neutral-300">
              📚 {GRADES[c.grade]} &quot;{c.parallel}&quot; · P{c.period}
            </span>
          ))
        )}
      </div>

      {/* Resumen superior */}
      <div className="grid gap-3 mb-6" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
        <Card className="!bg-brand-700 !border-brand-700 flex items-center gap-3">
          <div className="p-2.5 rounded-[10px] bg-white/15 text-white"><Clock size={20} /></div>
          <div>
            <div className="text-[11px] text-white/70 uppercase tracking-wide mb-0.5">Carga contratada</div>
            <div className="text-lg font-bold text-white">{data.horasContratadaMes} hrs/mes</div>
          </div>
        </Card>
        <Card className="flex items-center gap-3">
          <div className="p-2.5 rounded-[10px] bg-brand-100 text-brand-700"><GraduationCap size={20} /></div>
          <div><div className="text-[11px] text-neutral-500 uppercase tracking-wide mb-0.5">Cursos asignados</div><div className="text-lg font-bold text-brand-700">{courses.length}</div></div>
        </Card>
        <Card className="flex items-center gap-3">
          <div className="p-2.5 rounded-[10px] bg-brand-100 text-brand-700"><BookOpen size={20} /></div>
          <div><div className="text-[11px] text-neutral-500 uppercase tracking-wide mb-0.5">Materias distintas</div><div className="text-lg font-bold text-brand-700">{Object.keys(bySubject).length}</div></div>
        </Card>
        <Card className="flex items-center gap-3">
          <div className="p-2.5 rounded-[10px] bg-brand-100 text-brand-700"><Users size={20} /></div>
          <div><div className="text-[11px] text-neutral-500 uppercase tracking-wide mb-0.5">Asignaciones</div><div className="text-lg font-bold text-brand-700">{data.assignments.length}</div></div>
        </Card>
      </div>

      {/* Horas asignadas por tipo de horario */}
      {data.totalesPorHorario && data.totalesPorHorario.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center gap-2 text-sm font-bold text-brand-700 uppercase tracking-wide mb-3">
            <Clock size={16}/> Horas asignadas en horario
          </div>
          <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
            {data.totalesPorHorario.map(h => {
              const porcentaje = data.horasContratadaMes > 0
                ? Math.min(Math.round((h.horasMes / data.horasContratadaMes) * 100), 100)
                : 0
              const tone = porcentaje >= 90 ? 'success' : porcentaje >= 75 ? 'warning' : 'danger'
              const barColor = porcentaje >= 90 ? 'var(--color-success-500)' : porcentaje >= 75 ? 'var(--color-warning-500)' : 'var(--color-danger-500)'
              return (
                <Card key={h.horarioId}>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div>
                      <div className="text-[13px] font-bold text-brand-700">
                        {h.isWinter ? '❄️' : '☀️'} {h.nombre}
                      </div>
                      <div className="text-[11px] text-neutral-500 mt-0.5">
                        {h.minPeriodo} min/periodo · {h.totalPeriodos} periodos/semana
                      </div>
                    </div>
                    <Badge tone={tone}>{porcentaje}%</Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mb-2.5">
                    <div className="bg-neutral-100 rounded-lg py-2 px-2.5 text-center">
                      <div className="text-lg font-extrabold text-brand-700">{h.horasSemana}</div>
                      <div className="text-[10px] text-neutral-500 font-semibold">hrs/semana</div>
                    </div>
                    <div className="bg-neutral-100 rounded-lg py-2 px-2.5 text-center">
                      <div className="text-lg font-extrabold text-brand-700">{h.horasMes}</div>
                      <div className="text-[10px] text-neutral-500 font-semibold">hrs/mes</div>
                    </div>
                  </div>
                  <div className="bg-neutral-100 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-[width] duration-300"
                      style={{ width: `${porcentaje}%`, background: barColor }}
                    />
                  </div>
                  <div className="flex justify-between mt-1">
                    <span className="text-[10px] text-neutral-500">0</span>
                    <span className="text-[10px] text-neutral-500">Meta: {data.horasContratadaMes} hrs/mes</span>
                  </div>
                </Card>
              )
            })}
          </div>
        </div>
      )}

      {/* Sin asignaciones */}
      {courses.length === 0 && (
        <Card className="text-center py-12 border-dashed flex flex-col items-center gap-2 mb-5">
          <BookOpen size={40} className="opacity-30"/>
          <p className="text-[15px] font-medium text-brand-700">No tienes cursos asignados aún.</p>
          <span className="text-[13px] text-neutral-500">El administrador debe asignarte materias y cursos.</span>
        </Card>
      )}

      {/* Cursos */}
      <div className="flex items-center gap-2 text-sm font-bold text-brand-700 uppercase tracking-wide mb-3">
        <GraduationCap size={16}/> Mis cursos y materias
      </div>

      <div className="flex flex-col gap-3.5">
        {courses.map(([courseId, course]) => (
          <Card key={courseId} padded={false} className="overflow-hidden">
            <div className="flex items-center gap-3.5 px-4.5 py-3.5 bg-neutral-100/60 border-b border-neutral-300/60">
              <div className="rounded-xl bg-brand-700 text-white flex items-center justify-center text-[15px] font-extrabold shrink-0" style={{ width: 52, height: 52 }}>
                {GRADES[course.grade]}{course.parallel}
              </div>
              <div className="flex-1">
                <div className="text-base font-bold text-brand-700 mb-1.5">
                  {GRADES[course.grade]} &quot;{course.parallel}&quot;
                </div>
                <div className="flex gap-1.5 flex-wrap">
                  <Badge tone="brand">{SHIFTS[course.shift]}</Badge>
                  {course.educationType === 'BTH' && <Badge tone="warning">BTH</Badge>}
                  <Badge tone="success">{course.items.reduce((s, i) => s + i.hoursPerWeek, 0)} hrs/sem</Badge>
                  <Badge tone="info">{course.items.reduce((s, i) => s + (i.periodosAsignados || 0), 0)} periodos</Badge>
                </div>
              </div>
              <button
                className="flex items-center gap-1 px-3 py-1.5 bg-brand-700 text-white rounded-lg text-xs font-medium whitespace-nowrap shrink-0 hover:bg-brand-500 transition-colors"
                onClick={() => router.push(`/dashboard/plantel-docente/curso/${courseId}`)}
              >
                Ver estudiantes <ChevronRight size={14}/>
              </button>
            </div>

            <div className="flex flex-col">
              {course.items.map((a, i) => (
                <div key={i} className="flex items-center gap-2.5 px-4.5 py-2.5 border-t border-neutral-100 first:border-t-0 hover:bg-neutral-100/40">
                  <Badge tone={CAMPO_TONE[a.campo || ''] || 'neutral'}>{CAMPO_LABELS[a.campo || ''] || 'Sin campo'}</Badge>
                  <span className="flex-1 text-[13px] text-brand-700 font-medium">{a.subjectName}</span>
                  <Badge tone="brand">{a.hoursPerWeek} hrs/sem</Badge>
                  {a.periodosAsignados > 0 && <Badge tone="info">{a.periodosAsignados} per.</Badge>}
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}
