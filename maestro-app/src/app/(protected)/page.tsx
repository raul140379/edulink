'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ClipboardCheck, Clock, ChevronRight, Dot, CalendarOff } from 'lucide-react'
import { useCurrentPeriod } from '@/modules/asistencia/useCurrentPeriod'
import { asistenciaApi, Course, TodayStatus } from '@/modules/asistencia/api'
import Button from '@/components/Button'

const GRADES: Record<string, string> = { PRIMERO: '1°', SEGUNDO: '2°', TERCERO: '3°', CUARTO: '4°', QUINTO: '5°', SEXTO: '6°' }
const courseLabel = (c: Course) => `${GRADES[c.grade] || c.grade} "${c.parallel}"`

export default function HomePage() {
  const router = useRouter()
  const { current, next, todayCourseIds, loading, error } = useCurrentPeriod()
  const [courses, setCourses] = useState<Course[]>([])
  const [todayStatus, setTodayStatus] = useState<TodayStatus | null>(null)

  useEffect(() => {
    asistenciaApi.getMyCourses().then(setCourses).catch(() => {})
    asistenciaApi.getTodayStatus().then(setTodayStatus).catch(() => {})
  }, [])

  const goToCourse = (courseId: number) => router.push(`/curso/${courseId}`)

  return (
    <div className="px-4 py-5 flex flex-col gap-5 max-w-lg mx-auto">
      {loading ? (
        <p className="text-sm text-text-secondary text-center py-8">Cargando tu horario...</p>
      ) : error ? (
        <p className="text-sm text-danger-600 bg-danger-100 rounded-lg px-3 py-2.5">{error}</p>
      ) : todayStatus?.isHoliday ? (
        // Prioridad sobre "te toca ahora"/"no tenés más clases hoy" — esos
        // mensajes son de horario, sin relación con el feriado, y podían
        // confundir al maestro (ver corrección 1-sep-2026).
        <div className="bg-warning-100 border border-warning-500 rounded-2xl p-5 flex items-center gap-3">
          <CalendarOff size={22} className="text-warning-600 shrink-0" />
          <p className="text-sm font-medium text-warning-600">{todayStatus.message}</p>
        </div>
      ) : current ? (
        <div className="bg-white rounded-2xl border border-border p-5 flex flex-col gap-3">
          <div className="flex items-center gap-1.5 text-[12px] font-semibold text-success-700 uppercase tracking-wide">
            <Clock size={13} /> Te toca ahora
          </div>
          <div>
            <div className="text-xl font-bold text-brand-700">{courseLabel(current.course)}</div>
            <div className="text-sm text-text-secondary">{current.teacherSubjectCourse.subject.name} · {current.startTime}–{current.endTime}</div>
          </div>
          <Button onClick={() => goToCourse(current.course.id)}>
            <ClipboardCheck size={17} /> Tomar asistencia
          </Button>
        </div>
      ) : next ? (
        <div className="bg-white rounded-2xl border border-border p-5 flex flex-col gap-3">
          <div className="flex items-center gap-1.5 text-[12px] font-semibold text-text-secondary uppercase tracking-wide">
            <Clock size={13} /> Tu próxima clase hoy
          </div>
          <div>
            <div className="text-xl font-bold text-brand-700">{courseLabel(next.course)}</div>
            <div className="text-sm text-text-secondary">{next.teacherSubjectCourse.subject.name} · desde las {next.startTime}</div>
          </div>
          <Button variant="secondary" onClick={() => goToCourse(next.course.id)}>Ver de todas formas</Button>
        </div>
      ) : (
        <div className="bg-bg-soft rounded-2xl border border-border p-5 text-center">
          <p className="text-sm text-text-secondary">No tenés más clases hoy</p>
        </div>
      )}

      {courses.length > 0 && (
        <div>
          <div className="text-[12px] font-semibold text-text-secondary uppercase tracking-wide mb-2 px-1">Elegir otro curso</div>
          <div className="flex flex-col gap-2">
            {courses.map(c => {
              const isCurrent = current?.course.id === c.id
              const isToday = todayCourseIds.has(c.id)
              return (
                <button
                  key={c.id} onClick={() => goToCourse(c.id)}
                  className={`flex items-center justify-between rounded-xl border px-4 py-3 active:bg-bg-soft ${
                    isCurrent ? 'bg-success-100 border-success-500' : isToday ? 'bg-brand-100 border-brand-500' : 'bg-white border-border'
                  }`}
                >
                  <span className="flex items-center gap-1 text-[15px] font-medium text-brand-700">
                    {isCurrent && <Dot size={28} className="text-success-700 -ml-2.5 shrink-0" strokeWidth={6} />}
                    {!isCurrent && isToday && <Dot size={28} className="text-brand-600 -ml-2.5 shrink-0" strokeWidth={6} />}
                    {courseLabel(c)}
                    {isCurrent && <span className="text-[11px] font-semibold text-success-700 ml-1">· ahora</span>}
                    {!isCurrent && isToday && <span className="text-[11px] font-semibold text-brand-600 ml-1">· hoy</span>}
                  </span>
                  <ChevronRight size={18} className="text-text-secondary" />
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
