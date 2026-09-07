'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ChevronLeft, Bell, Check, CheckCircle2, Lock, FileDown } from 'lucide-react'
import { asistenciaApi, AttendanceStudent, AttendanceStatus, AttendanceByCourse, AttendanceWindow, Course, TutorInfo } from '@/modules/asistencia/api'
import NotifySheet from '@/modules/notificaciones/NotifySheet'
import Button from '@/components/Button'
import { apiFetch, ApiError } from '@/lib/api'
import { useDistrictConfig } from '@/hooks/useDistrictConfig'
import { exportAttendancePdf } from '@/lib/attendancePdf'

// Datos de identidad para el encabezado/firma del PDF — no vienen en
// GET /api/student-attendance/course/:id (esa respuesta solo trae lo
// necesario para tomar asistencia), así que se piden aparte una sola vez
// al entrar a la pantalla, mismo patrón simple que ya usa load() (decisión
// confirmada con Raul: fetch extra puntual, sin Context todavía).
interface Me {
  teacher?: { firstName: string; lastName: string } | null
  teacherTutor?: { firstName: string; lastName: string } | null
  school?: { id: number; name: string } | null
}

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
  // Última versión de status realmente guardada en la base — se usa para
  // detectar cambios sin guardar (comparada contra `status` en cada render).
  // Se actualiza en load() (lo que vino del backend) y otra vez al terminar
  // un guardado exitoso (lo que se acaba de mandar, ya persistido).
  const [savedStatus, setSavedStatus] = useState<Record<number, AttendanceStatus>>({})
  const [date,     setDate]     = useState<string | null>(null)
  const [loading,  setLoading]  = useState(true)
  const [saving,   setSaving]   = useState(false)
  const [exporting, setExporting] = useState(false)
  const [banner,   setBanner]   = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [notifyFor, setNotifyFor] = useState<{ studentId: number; studentName: string; tutor: TutorInfo } | null>(null)
  const [me, setMe] = useState<Me | null>(null)
  const district = useDistrictConfig()

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
      setDate(attendance.date)
      setTutors(tutorMap)
      const initial: Record<number, AttendanceStatus> = {}
      attendance.students.forEach(s => { initial[s.studentId] = s.status })
      setStatus(initial)
      setSavedStatus(initial)
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

  // Nombre de colegio + nombre completo del maestro, para el encabezado y la
  // firma del PDF — no cambia durante la sesión, se pide una sola vez.
  useEffect(() => {
    apiFetch<Me>('/api/auth/me').then(setMe).catch(() => {})
  }, [])

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
      // Lo que se acaba de mandar ya quedó persistido tal cual — se vuelve
      // la nueva base de comparación para "hay cambios sin guardar".
      setSavedStatus(status)
      router.refresh()
    } catch (e) {
      setBanner({ type: 'error', text: e instanceof ApiError ? e.message : 'Error de conexión' })
    } finally {
      setSaving(false)
    }
  }

  // El PDF exporta SOLO lo que ya está en la base — nunca lo que se ve en
  // pantalla si difiere de lo guardado (decisión confirmada con Raul:
  // preferible pedir que guarde primero antes que arriesgar un PDF que
  // diverja de lo realmente registrado).
  const isDirty = students.some(s => status[s.studentId] !== savedStatus[s.studentId])

  const handleExport = async () => {
    // Defensa adicional a la del botón (ya oculto/deshabilitado en ambos
    // casos) — exportar solo tiene sentido una vez que la ventana de este
    // bloque cerró (nadie puede seguir corrigiendo) y con algo ya guardado.
    if (window_ && window_.open) {
      setBanner({ type: 'error', text: 'Todavía podés corregir la asistencia — esperá a que termine el período para exportar.' })
      return
    }
    if (isDirty) {
      setBanner({ type: 'error', text: 'Tenés cambios sin guardar — guardá la asistencia antes de exportar.' })
      return
    }
    if (!summary?.registrado || !date) {
      setBanner({ type: 'error', text: 'Todavía no se guardó ninguna asistencia para este curso.' })
      return
    }
    setExporting(true)
    setBanner(null)
    try {
      const teacherPerson = me?.teacher || me?.teacherTutor
      await exportAttendancePdf({
        districtName: district.name,
        districtLocation: district.location,
        schoolName: me?.school?.name ?? null,
        courseLevel: course?.level || '',
        courseLabel: course ? courseLabel(course) : '',
        date,
        teacherName: teacherPerson ? `${teacherPerson.firstName} ${teacherPerson.lastName}` : null,
        students: students.map(s => ({ firstName: s.firstName, lastName: s.lastName, status: savedStatus[s.studentId] || null })),
      })
    } catch {
      setBanner({ type: 'error', text: 'No se pudo generar el PDF.' })
    } finally {
      setExporting(false)
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

      {window_ && window_.open && (
        <p className="text-[12px] text-text-secondary bg-bg-soft rounded-lg px-3 py-2.5">Podrás exportar cuando termine el período.</p>
      )}

      {window_ && !window_.open && summary?.registrado && (
        <div className="flex flex-col gap-1">
          <Button variant="secondary" onClick={handleExport} loading={exporting} disabled={isDirty}>
            <FileDown size={16} /> Exportar / Imprimir
          </Button>
          {isDirty && (
            <p className="text-[12px] text-warning-600 px-1">Guardá los cambios antes de exportar — el PDF solo refleja lo guardado.</p>
          )}
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
