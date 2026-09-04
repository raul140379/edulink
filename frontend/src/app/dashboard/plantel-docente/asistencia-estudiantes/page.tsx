'use client'

import { useEffect, useState } from 'react'
import Card from '@/components/ui/Card'
import { useConfirm } from '@/components/ui/ConfirmProvider'
import { useToast } from '@/components/ui/ToastProvider'
import { useDistrictConfig } from '@/hooks/useDistrictConfig'
import { useSchoolConfig } from '@/hooks/useSchoolConfig'
import { exportAttendancePdf } from '@/lib/attendancePdf'
import { todayLocalStr } from '@/lib/localDate'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

interface Course {
  id: number; grade: string; parallel: string; level: string; shift: string
}

interface ScheduleItem {
  dayOfWeek: number; period: number
  course: { id: number }
  teacherSubjectCourse: { subject: { name: string } }
}

interface StudentAtt {
  studentId: number; firstName: string; lastName: string; gender: string
  status: 'PRESENTE' | 'AUSENTE' | 'RETRASO' | 'LICENCIA' | null
  note: string
  attendance: any
}

interface Summary {
  total: number; presentes: number; ausentes: number
  retrasos: number; licencias: number; registrado: boolean
}

const GRADES: Record<string,string> = { PRIMERO:'1°', SEGUNDO:'2°', TERCERO:'3°', CUARTO:'4°', QUINTO:'5°', SEXTO:'6°' }

const STATUS_CONFIG = {
  PRESENTE: { label:'Presente', emoji:'✅', bg:'#E1F5EE', color:'#0F6E56', border:'#9FE1CB' },
  AUSENTE:  { label:'Ausente',  emoji:'❌', bg:'#FFF0F0', color:'#C0392B', border:'#FFBBBB' },
  RETRASO:  { label:'Retraso',  emoji:'⏰', bg:'#FFFBEA', color:'#BA7517', border:'#F5C518' },
  LICENCIA: { label:'Licencia', emoji:'📋', bg:'#F0F0FF', color:'#6B21A8', border:'#C4B5FD' },
}

type StatusKey = keyof typeof STATUS_CONFIG

export default function AsistenciaEstudiantesPage() {
  const confirm  = useConfirm()
  const toast    = useToast()
  const district = useDistrictConfig()
  const school   = useSchoolConfig()
  const [courses,     setCourses]     = useState<Course[]>([])
  const [mySchedule,  setMySchedule]  = useState<ScheduleItem[]>([])
  const [selCourse,   setSelCourse]   = useState<Course | null>(null)
  const [students,  setStudents]  = useState<StudentAtt[]>([])
  const [summary,   setSummary]   = useState<Summary | null>(null)
  const [teacherName, setTeacherName] = useState<string | null>(null)
  const [date,      setDate]      = useState(() => todayLocalStr())
  const [loading,   setLoading]   = useState(false)
  const [saving,    setSaving]    = useState<number | null>(null)
  const [closing,   setClosing]   = useState(false)
  const [exporting, setExporting] = useState(false)

  const auth = () => ({ Authorization: `Bearer ${localStorage.getItem('token') || ''}` })

  const updateSummary = (list: StudentAtt[]) => {
    setSummary({
      total:      list.length,
      presentes:  list.filter(s => s.status === 'PRESENTE').length,
      ausentes:   list.filter(s => s.status === 'AUSENTE').length,
      retrasos:   list.filter(s => s.status === 'RETRASO').length,
      licencias:  list.filter(s => s.status === 'LICENCIA').length,
      registrado: list.some(s => s.status !== null),
    })
  }

  useEffect(() => {
    fetch(`${API}/api/student-attendance/my-courses`, { headers: auth() })
      .then(r => r.json())
      .then(d => {
        if (Array.isArray(d)) {
          setCourses(d)
          if (d.length === 1) setSelCourse(d[0])
        }
      })
      .catch(() => {})

    fetch(`${API}/api/schedules/my-schedule`, { headers: auth() })
      .then(r => r.json())
      .then(d => {
        if (Array.isArray(d)) setMySchedule(d.flatMap((day: any) => day.periods || []))
      })
      .catch(() => {})
  }, [])

  const now       = new Date()
  const todayDay  = now.getDay() === 0 ? 7 : now.getDay()

  // Periodo más temprano de hoy para cada curso — solo interesa mostrar en
  // Asistencia los cursos que el docente dicta HOY, no todos los que tiene.
  const todayPeriodByCourse: Record<number, number> = {}
  mySchedule
    .filter(s => s.dayOfWeek === todayDay)
    .forEach(s => {
      const prev = todayPeriodByCourse[s.course.id]
      if (prev === undefined || s.period < prev) todayPeriodByCourse[s.course.id] = s.period
    })

  const todayCourses = courses
    .filter(c => todayPeriodByCourse[c.id] !== undefined)
    .sort((a, b) => todayPeriodByCourse[a.id] - todayPeriodByCourse[b.id])

  // Auto-selecciona si hoy solo dicta un curso, para no obligar a tocarlo.
  useEffect(() => {
    if (selCourse || mySchedule.length === 0) return
    if (todayCourses.length === 1) setSelCourse(todayCourses[0])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mySchedule])

  // Materias y periodos de HOY del curso seleccionado — para el banner.
  const selCourseSchedule = selCourse ? mySchedule.filter(s => s.course.id === selCourse.id) : []
  const selCourseSubjects = [...new Set(selCourseSchedule.map(s => s.teacherSubjectCourse.subject.name))]
  const selCourseTodayPeriods = selCourseSchedule
    .filter(s => s.dayOfWeek === todayDay)
    .map(s => s.period)
    .sort((a, b) => a - b)

  useEffect(() => {
    if (!selCourse) return
    setLoading(true)
    fetch(`${API}/api/student-attendance/course/${selCourse.id}?date=${date}`, { headers: auth() })
      .then(r => r.json())
      .then(d => {
        if (d.students) {
          const mapped = d.students.map((s: any) => ({
            ...s,
            status: s.attendance ? s.attendance.status : null,
          }))
          setStudents(mapped)
          updateSummary(mapped)
          setTeacherName(d.teacherName ?? null)
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [selCourse, date])

  // Mitigación urgente contra pisado silencioso (4-sep-2026): un curso
  // compartido por varios maestros solo tiene un registro por estudiante/
  // día — si el backend detecta que ya lo guardó un maestro distinto,
  // responde 409 con el nombre de quién lo hizo. Acá se pide confirmación
  // explícita antes de reemplazar (nunca en silencio); si el usuario
  // cancela, se reenvía con force:true. null = canceló, no se guardó nada.
  const postAttendanceWithConfirm = async (
    attendances: { studentId: number; status: StatusKey; note?: string }[]
  ): Promise<{ ok: boolean; data: any } | null> => {
    const send = (force?: boolean) => fetch(`${API}/api/student-attendance/course/${selCourse!.id}`, {
      method:  'POST',
      headers: { ...auth(), 'Content-Type': 'application/json' },
      body:    JSON.stringify({ date, attendances, ...(force ? { force: true } : {}) }),
    })

    let res  = await send()
    let data = await res.json()

    if (res.status === 409) {
      if (!await confirm(data.message, { danger: true })) return null
      res  = await send(true)
      data = await res.json()
    }
    return { ok: res.ok, data }
  }

  const setStatus = async (studentId: number, status: StatusKey) => {
    if (!selCourse) return

    const current      = students.find(s => s.studentId === studentId)
    const prevStudents = students
    const newStatus: StatusKey | null = current?.status === status ? null : status

    const updated = students.map(s => s.studentId === studentId ? { ...s, status: newStatus } : s)
    setStudents(updated)
    updateSummary(updated)

    if (!newStatus) return

    setSaving(studentId)
    try {
      const result = await postAttendanceWithConfirm([{ studentId, status: newStatus, note: current?.note || '' }])
      if (!result) { setStudents(prevStudents); updateSummary(prevStudents); return }
      if (!result.ok) { toast(result.data.message, 'error'); setStudents(prevStudents); updateSummary(prevStudents) }
      else if (result.data.notifications > 0) {
        toast(`${STATUS_CONFIG[newStatus].emoji} Guardado · ${result.data.notifications} notif. enviada`, 'success')
      }
    } catch { toast('Error al guardar', 'error'); setStudents(prevStudents); updateSummary(prevStudents) }
    finally { setSaving(null) }
  }

  const markAll = async (status: StatusKey) => {
    if (!selCourse || students.length === 0) return
    const prevStudents = students
    const updated = students.map(s => ({ ...s, status }))
    setStudents(updated)
    updateSummary(updated)

    try {
      const result = await postAttendanceWithConfirm(updated.map(s => ({ studentId: s.studentId, status, note: s.note || '' })))
      if (!result) { setStudents(prevStudents); updateSummary(prevStudents); return }
      if (result.ok) toast(result.data.message, 'success')
      else { toast(result.data.message, 'error'); setStudents(prevStudents); updateSummary(prevStudents) }
    } catch { toast('Error al guardar', 'error'); setStudents(prevStudents); updateSummary(prevStudents) }
  }

  const handleClose = async () => {
    if (!selCourse) return
    const sinRegistro = students.filter(s => s.status === null).length
    if (sinRegistro === 0) {
      toast('Todos los estudiantes ya tienen asistencia registrada', 'success')
      return
    }
    if (!await confirm(`¿Cerrar asistencia? ${sinRegistro} estudiante(s) sin registrar serán marcados como AUSENTE automáticamente y se notificará a sus padres.`, { danger: true })) return

    setClosing(true)
    try {
      const res  = await fetch(`${API}/api/student-attendance/course/${selCourse.id}/close`, {
        method:  'POST',
        headers: { ...auth(), 'Content-Type': 'application/json' },
        body:    JSON.stringify({ date })
      })
      const data = await res.json()
      if (!res.ok) { toast(data.message, 'error'); return }
      toast(data.message, 'success')
      const updated = students.map(s => s.status === null ? { ...s, status: 'AUSENTE' as const } : s)
      setStudents(updated)
      updateSummary(updated)
    } catch { toast('Error de conexión', 'error') }
    finally { setClosing(false) }
  }

  const handleExportPdf = async () => {
    if (!selCourse) return
    setExporting(true)
    try {
      await exportAttendancePdf({
        districtName: district.name,
        districtLocation: district.location,
        schoolName: school.name,
        courseLevel: selCourse.level,
        courseLabel: `${GRADES[selCourse.grade] || selCourse.grade} "${selCourse.parallel}"`,
        date,
        teacherName,
        students,
      })
    } catch { toast('No se pudo generar el PDF', 'error') }
    finally { setExporting(false) }
  }

  const registrados   = students.filter(s => s.status !== null).length
  const sinRegistrar  = students.filter(s => s.status === null).length
  const today         = todayLocalStr()

  return (
    <div className="pb-[70px]">
      <div className="mb-4 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-brand-700 mb-1">Asistencia de Estudiantes</h1>
          <p className="text-[13px] text-neutral-500">Toca el estado para registrar — se guarda automáticamente</p>
        </div>
        <div className="shrink-0 flex items-end gap-2">
          <div>
            <label className="text-[11px] font-bold text-brand-700 uppercase tracking-wide block mb-1.5">Fecha</label>
            <input
              type="date" value={date} onChange={e => setDate(e.target.value)} max={today}
              className="px-3 py-2 border border-neutral-300 rounded-lg text-sm text-brand-700 outline-none focus:border-info-500"
            />
          </div>
          {selCourse && students.length > 0 && (
            <button
              onClick={handleExportPdf} disabled={exporting}
              className="px-3 py-2 rounded-lg text-sm font-semibold border border-neutral-300 text-brand-700 bg-white hover:bg-brand-100 whitespace-nowrap disabled:opacity-60"
              title="Exportar PDF con espacio de firma"
            >
              {exporting ? '⏳ Generando...' : '📄 Exportar PDF'}
            </button>
          )}
        </div>
      </div>

      {courses.length > 0 && (
        <div className="bg-neutral-100 rounded-xl p-3.5 mb-3 flex flex-col md:flex-row gap-4">
          <div className="flex-1 min-w-0">
            <label className="text-[11px] font-bold text-brand-700 uppercase tracking-wide block mb-2">Curso de Hoy</label>
            {todayCourses.length === 0 ? (
              <p className="text-[13px] text-neutral-500">No tenés clases programadas hoy</p>
            ) : (
              <div className="flex gap-2 flex-wrap">
                {todayCourses.map(c => {
                  const period = todayPeriodByCourse[c.id]
                  const isSel  = selCourse?.id === c.id
                  return (
                    <button
                      key={c.id} onClick={() => setSelCourse(c)}
                      className={`flex items-center gap-2 pl-1.5 pr-3.5 py-1.5 rounded-full text-[13px] font-bold transition-colors ${isSel ? 'bg-brand-700 text-white' : 'bg-white border border-neutral-300 text-brand-700 hover:bg-brand-100'}`}
                    >
                      <span className="w-8 h-8 rounded-full bg-[#173B2E] text-white flex items-center justify-center text-[10px] font-extrabold shrink-0">
                        {GRADES[c.grade]}{c.parallel}
                      </span>
                      <span
                        className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                        style={{ background: isSel ? 'rgba(255,255,255,.25)' : 'var(--color-accent-500)', color: isSel ? '#fff' : '#3A2F00' }}
                      >
                        Hoy P{period}
                      </span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {selCourse && (
            <div className="md:w-[280px] md:shrink-0 bg-white rounded-xl border border-neutral-200 p-3">
              <label className="text-[10px] font-bold text-brand-700 uppercase tracking-wide block mb-1.5">Detalle de curso</label>
              <div className="flex items-center gap-1.5 flex-wrap">
                <div className="w-7 h-7 rounded-lg bg-brand-700 text-white flex items-center justify-center text-[9px] font-extrabold shrink-0">
                  {GRADES[selCourse.grade]}{selCourse.parallel}
                </div>
                {selCourseSubjects.map(name => (
                  <span key={name} className="bg-success-100 text-success-700 rounded-full px-2 py-0.5 text-[11px] font-semibold">{name}</span>
                ))}
                {selCourseTodayPeriods.length > 0 && (
                  <span className="bg-neutral-100 text-brand-700 rounded-full px-2 py-0.5 text-[11px] font-semibold">
                    Hoy: P{selCourseTodayPeriods.join(', P')}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      <hr className="border-neutral-300 mb-4" />

      {summary && summary.registrado && (
        <div className="grid grid-cols-4 gap-2 mb-4">
          {([
            { ...STATUS_CONFIG.PRESENTE, label: 'Presentes', value: summary.presentes },
            { ...STATUS_CONFIG.AUSENTE,  label: 'Ausentes',  value: summary.ausentes },
            { ...STATUS_CONFIG.RETRASO,  label: 'Retrasos',  value: summary.retrasos },
            { ...STATUS_CONFIG.LICENCIA, label: 'Licencias', value: summary.licencias },
          ]).map(s => (
            <div key={s.label} className="rounded-lg p-2 text-center border" style={{ background: s.bg, borderColor: s.border }}>
              <div className="text-xl font-extrabold" style={{ color: s.color }}>{s.value}</div>
              <div className="text-[10px] font-semibold" style={{ color: s.color }}>{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {summary && summary.registrado && teacherName && (
        <p className="text-[12px] text-neutral-500 mb-3.5 -mt-2">
          📝 Registrado por: <span className="font-semibold text-brand-700">{teacherName}</span>
          {' '}— un curso puede tener varios maestros, cualquiera puede tomar la asistencia del día.
        </p>
      )}

      {students.length > 0 && (
        <div className="flex gap-2 mb-3.5 flex-wrap items-center">
          <span className="text-[11px] font-bold text-neutral-500 uppercase">Marcar todos:</span>
          {(Object.keys(STATUS_CONFIG) as StatusKey[]).map(s => (
            <button
              key={s} onClick={() => markAll(s)}
              className="px-3 py-1.5 rounded-full text-xs font-semibold border"
              style={{ borderColor: STATUS_CONFIG[s].border, background: STATUS_CONFIG[s].bg, color: STATUS_CONFIG[s].color }}
            >
              {STATUS_CONFIG[s].emoji} {STATUS_CONFIG[s].label}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12"><p className="text-sm text-neutral-500">Cargando...</p></div>
      ) : !selCourse ? (
        <Card className="text-center py-12 text-neutral-500">
          <div className="text-4xl mb-3">📚</div>
          <p>Selecciona un curso para registrar asistencia</p>
        </Card>
      ) : students.length === 0 ? (
        <Card className="text-center py-12 text-neutral-500">
          <div className="text-4xl mb-3">👥</div>
          <p>No hay estudiantes inscritos en este curso</p>
        </Card>
      ) : (
        <div className="flex flex-col gap-2">
          {students.map((s, i) => {
            const cfg      = s.status ? STATUS_CONFIG[s.status] : null
            const isSaving = saving === s.studentId
            return (
              <div
                key={s.studentId}
                className="bg-white rounded-xl px-3 py-2.5 flex items-center gap-2.5 border-[1.5px] transition-colors"
                style={{ borderColor: cfg ? cfg.border : 'var(--color-neutral-300)', opacity: isSaving ? 0.7 : 1 }}
              >
                <div className="text-xs text-neutral-500 min-w-[22px] text-center font-semibold">{i + 1}</div>

                <div className={`w-[34px] h-[34px] rounded-full shrink-0 flex items-center justify-center text-lg ${s.gender === 'FEMENINO' ? 'bg-[#FFE0EC]' : 'bg-brand-100'}`}>
                  {s.gender === 'FEMENINO' ? '👧' : '👦'}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-semibold text-brand-700 overflow-hidden text-ellipsis whitespace-nowrap">
                    {s.lastName} {s.firstName}
                  </div>
                  <div className="text-[11px] font-semibold mt-0.5" style={{ color: cfg ? cfg.color : '#CBD5E1' }}>
                    {isSaving ? '⏳ Guardando...' : cfg ? `${cfg.emoji} ${cfg.label}` : '— Sin registrar'}
                  </div>
                </div>

                <div className="flex gap-1 shrink-0">
                  {(Object.keys(STATUS_CONFIG) as StatusKey[]).map(st => {
                    const isActive = s.status === st
                    return (
                      <button
                        key={st} onClick={() => setStatus(s.studentId, st)} disabled={isSaving}
                        className="w-[34px] h-[34px] rounded-lg text-lg flex items-center justify-center transition-transform"
                        style={{
                          cursor: isSaving ? 'not-allowed' : 'pointer',
                          background: isActive ? STATUS_CONFIG[st].bg : 'var(--color-neutral-100)',
                          outline: isActive ? `2px solid ${STATUS_CONFIG[st].border}` : 'none',
                          transform: isActive ? 'scale(1.15)' : 'scale(1)',
                        }}
                      >
                        {STATUS_CONFIG[st].emoji}
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {students.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-neutral-300 px-4 py-2.5 z-[100] flex items-center gap-3">
          <div className="flex-1">
            <div className={`text-xs font-semibold ${registrados > 0 ? 'text-success-700' : 'text-neutral-500'}`}>
              {registrados > 0 ? `✅ ${registrados} de ${students.length} registrados` : '⬜ Ningún estudiante registrado aún'}
            </div>
            {summary && registrados > 0 && (
              <div className="text-[11px] text-neutral-500 mt-0.5">
                {summary.presentes}P · {summary.ausentes}A · {summary.retrasos}R · {summary.licencias}L
                {sinRegistrar > 0 && <span className="text-danger-600"> · {sinRegistrar} sin registrar</span>}
              </div>
            )}
          </div>

          {sinRegistrar > 0 && (
            <button
              onClick={handleClose} disabled={closing}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-white text-xs font-bold whitespace-nowrap ${closing ? 'bg-neutral-500 opacity-60' : 'bg-danger-500 hover:bg-danger-600'}`}
            >
              {closing ? '⏳ Cerrando...' : `🔒 Cerrar (${sinRegistrar} ausentes)`}
            </button>
          )}

          {sinRegistrar === 0 && registrados > 0 && (
            <div className="px-3 py-1.5 rounded-lg bg-success-100 text-success-700 text-xs font-bold">
              🔒 Asistencia completa
            </div>
          )}
        </div>
      )}
    </div>
  )
}
