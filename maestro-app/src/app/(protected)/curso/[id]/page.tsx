'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ChevronLeft, Bell, Check, CheckCircle2, Lock } from 'lucide-react'
import { asistenciaApi, AttendanceStudent, AttendanceStatus, AttendanceByCourse, AttendanceWindow, Course, TutorInfo } from '@/modules/asistencia/api'
import NotifySheet from '@/modules/notificaciones/NotifySheet'
import Button from '@/components/Button'
import { ApiError } from '@/lib/api'

const GRADES: Record<string, string> = { PRIMERO: '1°', SEGUNDO: '2°', TERCERO: '3°', CUARTO: '4°', QUINTO: '5°', SEXTO: '6°' }
const courseLabel = (c: Course) => `${GRADES[c.grade] || c.grade} "${c.parallel}"`

const STATUS_OPTS: { value: AttendanceStatus; label: string; on: string }[] = [
  { value: 'PRESENTE', label: 'Presente', on: 'bg-success-700 text-white' },
  { value: 'AUSENTE',  label: 'Ausente',  on: 'bg-danger-600 text-white' },
  { value: 'RETRASO',  label: 'Retraso',  on: 'bg-warning-600 text-white' },
  { value: 'LICENCIA', label: 'Licencia', on: 'bg-info-500 text-white' },
]

export default function CursoPage() {
  const params = useParams()
  const router = useRouter()
  const courseId = Number(params.id)

  const [course,   setCourse]   = useState<Course | null>(null)
  const [students, setStudents] = useState<AttendanceStudent[]>([])
  const [summary,  setSummary]  = useState<AttendanceByCourse['summary'] | null>(null)
  const [window_,  setWindow]   = useState<AttendanceWindow | null>(null)
  const [tutors,   setTutors]   = useState<Record<number, TutorInfo | undefined>>({})
  const [status,   setStatus]   = useState<Record<number, AttendanceStatus>>({})
  const [loading,  setLoading]  = useState(true)
  const [saving,   setSaving]   = useState(false)
  const [banner,   setBanner]   = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [notifyFor, setNotifyFor] = useState<{ studentId: number; studentName: string; tutor: TutorInfo } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [courses, attendance, tutorMap] = await Promise.all([
        asistenciaApi.getMyCourses(),
        asistenciaApi.getCourseAttendance(courseId),
        asistenciaApi.getTutorsByStudent(courseId),
      ])
      setCourse(courses.find(c => c.id === courseId) || null)
      setStudents(attendance.students)
      setSummary(attendance.summary)
      setWindow(attendance.window)
      setTutors(tutorMap)
      const initial: Record<number, AttendanceStatus> = {}
      attendance.students.forEach(s => { initial[s.studentId] = s.status })
      setStatus(initial)
    } catch {
      setBanner({ type: 'error', text: 'No se pudo cargar el curso' })
    } finally {
      setLoading(false)
    }
  }, [courseId])

  // Pide siempre datos frescos al entrar — nunca confiar en una pantalla ya
  // visitada. Cubre 2 escenarios reales encontrados en el celular: (1) el
  // caché de navegación de Next puede reusar esta pantalla sin re-pedir los
  // datos al volver del curso anterior — router.refresh() lo invalida; (2)
  // volver a esta pestaña después de minutos en otra app — visibilitychange
  // fuerza un refetch en vez de mostrar lo que había en memoria.
  useEffect(() => {
    load()
    router.refresh()
    const onVisible = () => { if (document.visibilityState === 'visible') load() }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [load, router])

  const setAll = (value: AttendanceStatus) => {
    const next: Record<number, AttendanceStatus> = {}
    students.forEach(s => { next[s.studentId] = value })
    setStatus(next)
  }

  const handleSave = async () => {
    setSaving(true)
    setBanner(null)
    try {
      const attendances = students.map(s => ({ studentId: s.studentId, status: status[s.studentId] || 'PRESENTE' }))
      const result = await asistenciaApi.saveAttendance(courseId, attendances)
      setBanner({ type: 'success', text: result.message })
      setSummary(prev => prev ? { ...prev, registrado: true } : prev)
      router.refresh()
    } catch (e) {
      setBanner({ type: 'error', text: e instanceof ApiError ? e.message : 'Error de conexión' })
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <p className="text-sm text-text-secondary text-center py-12">Cargando...</p>

  return (
    <div className="px-4 py-4 flex flex-col gap-4 max-w-lg mx-auto pb-28">
      <button onClick={() => { router.refresh(); router.push('/') }} className="flex items-center gap-1 text-[13px] text-text-secondary self-start">
        <ChevronLeft size={16} /> Volver
      </button>

      <div>
        <h1 className="text-lg font-bold text-brand-700">{course ? courseLabel(course) : `Curso`}</h1>
        <p className="text-[13px] text-text-secondary">{students.length} estudiante{students.length !== 1 ? 's' : ''}</p>
      </div>

      {banner && (
        <p className={`text-[13px] rounded-lg px-3 py-2.5 ${banner.type === 'success' ? 'text-success-700 bg-success-100' : 'text-danger-600 bg-danger-100'}`}>
          {banner.text}
        </p>
      )}

      {summary?.registrado && (
        <div className="flex items-center gap-2 text-[13px] font-medium text-success-700 bg-success-100 rounded-lg px-3 py-2.5">
          <CheckCircle2 size={16} className="shrink-0" />
          Ya se tomó asistencia hoy — podés corregirla y volver a guardar.
        </div>
      )}

      {window_ && !window_.open && (
        <div className="flex items-center gap-2 text-[13px] font-medium text-warning-600 bg-warning-100 rounded-lg px-3 py-2.5">
          <Lock size={16} className="shrink-0" />
          {window_.message || 'La asistencia no está disponible en este momento.'}
        </div>
      )}

      <button
        onClick={() => setAll('PRESENTE')}
        disabled={!!window_ && !window_.open}
        className="self-start flex items-center gap-1.5 text-[13px] font-semibold text-brand-600 px-3 py-1.5 rounded-lg bg-brand-100 disabled:opacity-40"
      >
        <Check size={14} /> Marcar todos Presente
      </button>

      <div className="flex flex-col gap-2">
        {students.map(s => {
          const tutor = tutors[s.studentId]
          return (
            <div key={s.studentId} className="bg-white rounded-xl border border-border p-3 flex flex-col gap-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[15px] font-semibold text-brand-700 truncate">{s.lastName} {s.firstName}</span>
                <button
                  onClick={() => tutor && setNotifyFor({ studentId: s.studentId, studentName: `${s.firstName} ${s.lastName}`, tutor })}
                  disabled={!tutor}
                  className="shrink-0 p-2 rounded-lg bg-bg-soft text-brand-700 disabled:opacity-30"
                  aria-label="Notificar al tutor"
                >
                  <Bell size={17} />
                </button>
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                {STATUS_OPTS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setStatus(prev => ({ ...prev, [s.studentId]: opt.value }))}
                    disabled={!!window_ && !window_.open}
                    className={`py-2 rounded-lg text-[11px] font-semibold transition-colors disabled:opacity-40 ${status[s.studentId] === opt.value ? opt.on : 'bg-bg-soft text-text-secondary'}`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-border p-3.5">
        <div className="max-w-lg mx-auto">
          <Button onClick={handleSave} loading={saving} disabled={!!window_ && !window_.open}>
            {window_ && !window_.open ? 'Asistencia bloqueada' : 'Guardar asistencia'}
          </Button>
        </div>
      </div>

      {notifyFor && (
        <NotifySheet
          studentName={notifyFor.studentName}
          tutor={notifyFor.tutor}
          onClose={() => setNotifyFor(null)}
          onSent={() => { setNotifyFor(null); setBanner({ type: 'success', text: 'Notificación enviada' }) }}
        />
      )}
    </div>
  )
}
