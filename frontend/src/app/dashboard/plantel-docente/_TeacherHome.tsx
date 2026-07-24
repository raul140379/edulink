'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { BookOpen, Users, Clock, GraduationCap, ChevronRight } from 'lucide-react'
import Card from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'

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
  const [data,    setData]    = useState<Workload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')

  useEffect(() => {
    const fetch_ = async () => {
      const token = localStorage.getItem('token')
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
