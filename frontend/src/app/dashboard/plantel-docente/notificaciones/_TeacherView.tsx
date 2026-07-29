'use client'

import { useEffect, useState } from 'react'
import { Bell, Send, BookOpen, ChevronDown, ChevronUp, Check, MessageCircle } from 'lucide-react'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import { Input, Textarea } from '@/components/ui/Input'
import { useToast } from '@/components/ui/ToastProvider'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

interface Course {
  id: number; grade: string; parallel: string; shift: string; educationType: string
}

interface ScheduleItem {
  dayOfWeek: number
  course: { id: number }
}

interface TutorInfo {
  id: number; firstName: string; lastName: string; phone?: string
}

interface Student {
  id: number; firstName: string; lastName: string; ci?: string
  parents: { isTutor: boolean; parent: TutorInfo }[]
}

interface CourseInfo {
  tutor?:    { teacher: { id: number; firstName: string; lastName: string } }
  delegate?: { id: number; firstName: string; lastName: string }
}

interface SentNotification {
  id: number; title: string; message: string; type: string; createdAt: string
  parent: { firstName: string; lastName: string }
}

interface WaResult {
  tutorName:    string
  studentName:  string
  phone:        string
  waUrl:        string
}

const GRADES: Record<string, string> = { PRIMERO:'1°', SEGUNDO:'2°', TERCERO:'3°', CUARTO:'4°', QUINTO:'5°', SEXTO:'6°' }
const SHIFTS: Record<string, string> = { MORNING:'Mañana', AFTERNOON:'Tarde', NIGHT:'Noche' }

const TIPOS = [
  { value: 'ACADEMICA', label: '📚 Académica',     desc: 'Notas, tareas, exámenes' },
  { value: 'REUNION',   label: '🚫 Inasistencia',  desc: 'Falta a clase o actividad' },
  { value: 'GENERAL',   label: '⚠️ Conducta',      desc: 'Comportamiento del estudiante' },
  { value: 'ACTIVIDAD', label: '📋 Trabajo/Examen',desc: 'Trabajo no presentado o examen' },
  { value: 'DEUDA',     label: '📢 General',        desc: 'Cualquier comunicado' },
]

const fmtDate = (d: string) => new Date(d).toLocaleDateString('es-BO', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' })

const buildWaUrl = (phone: string, msg: string) => {
  const clean = phone.replace(/\D/g, '')
  const num   = clean.startsWith('591') ? clean : `591${clean}`
  return `https://wa.me/${num}?text=${encodeURIComponent(msg)}`
}

export default function TeacherNotificacionesPage() {
  const toast = useToast()
  const [courses,      setCourses]      = useState<Course[]>([])
  const [mySchedule,   setMySchedule]   = useState<ScheduleItem[]>([])
  const [selCourseId,  setSelCourseId]  = useState<number | null>(null)
  const [courseInfo,   setCourseInfo]   = useState<CourseInfo | null>(null)
  const [students,     setStudents]     = useState<Student[]>([])
  const [sentList,     setSentList]     = useState<SentNotification[]>([])
  const [loading,      setLoading]      = useState(false)
  const [sending,      setSending]      = useState(false)
  const [selStudents,  setSelStudents]  = useState<number[]>([])
  const [sendToTutor,  setSendToTutor]  = useState(true)
  const [notifType,    setNotifType]    = useState('ACADEMICA')
  const [title,        setTitle]        = useState('')
  const [message,      setMessage]      = useState('')
  const [showSent,     setShowSent]     = useState(false)
  const [waResults,    setWaResults]    = useState<WaResult[]>([])
  const [showWa,       setShowWa]       = useState(false)

  const auth = () => ({ Authorization: `Bearer ${localStorage.getItem('token') || ''}` })

  useEffect(() => {
    const init = async () => {
      try {
        const res  = await fetch(`${API_URL}/api/teachers/my-workload`, { headers: auth() })
        const data = await res.json()
        if (res.ok) {
          const courseMap = new Map<number, Course>()
          data.assignments?.forEach((a: any) => {
            if (!courseMap.has(a.courseId)) courseMap.set(a.courseId, {
              id: a.courseId, grade: a.grade, parallel: a.parallel, shift: a.shift, educationType: a.educationType
            })
          })
          const list = Array.from(courseMap.values())
          setCourses(list)
          if (list.length === 1) setSelCourseId(list[0].id)
        }
      } catch { toast('Error al cargar cursos', 'error') }
    }
    init()

    fetch(`${API_URL}/api/schedules/my-schedule`, { headers: auth() })
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setMySchedule(d.flatMap((day: any) => day.periods || [])) })
      .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!selCourseId) return
    setSelStudents([]); setStudents([]); setCourseInfo(null); setWaResults([]); setShowWa(false)
    loadCourseData(); loadSentNotifications()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selCourseId])

  const loadCourseData = async () => {
    if (!selCourseId) return
    setLoading(true)
    try {
      const [cRes, sRes] = await Promise.all([
        fetch(`${API_URL}/api/courses/${selCourseId}`,              { headers: auth() }),
        fetch(`${API_URL}/api/students/by-course/${selCourseId}`,   { headers: auth() }),
      ])
      const [cData, sData] = await Promise.all([cRes.json(), sRes.json()])
      if (cRes.ok) setCourseInfo(cData)
      if (sRes.ok && Array.isArray(sData)) setStudents(sData.map((a: any) => a.student))
    } catch { toast('Error al cargar datos del curso', 'error') }
    finally  { setLoading(false) }
  }

  const loadSentNotifications = async () => {
    try {
      const res  = await fetch(`${API_URL}/api/notifications/sent`, { headers: auth() })
      const data = await res.json()
      if (res.ok) setSentList(Array.isArray(data) ? data : [])
    } catch { console.error('Error al cargar notificaciones') }
  }

  const toggleStudent = (parentId: number) => {
    setSelStudents(prev => prev.includes(parentId) ? prev.filter(id => id !== parentId) : [...prev, parentId])
  }

  const selectAll = () => {
    setSelStudents(students.flatMap(s => s.parents.filter(p => p.isTutor).map(p => p.parent.id)))
  }

  const handleSend = async () => {
    if (!title || !message)          { toast('Título y mensaje son requeridos', 'error'); return }
    if (selStudents.length === 0)    { toast('Selecciona al menos un tutor', 'error'); return }

    const parentIds = new Set<number>(selStudents)
    setSending(true)
    try {
      const fullMessage = sendToTutor && courseInfo?.tutor
        ? `${message}\n\n[Copia al Maestro Tutor: ${courseInfo.tutor.teacher.lastName} ${courseInfo.tutor.teacher.firstName}]`
        : message

      const res  = await fetch(`${API_URL}/api/notifications/send-bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...auth() },
        body: JSON.stringify({
          parentIds: Array.from(parentIds),
          title:   `[Maestro] ${title}`,
          message: fullMessage,
          type:    notifType,
        }),
      })
      const data = await res.json()
      if (!res.ok) { toast(data.message, 'error'); return }

      const waMsg = `*[Maestro - U.E. Naciones Unidas]*\n*${title}*\n\n${message}`
      const waList: WaResult[] = []

      students.forEach(s => {
        const tutor = s.parents.find(p => p.isTutor)
        if (!tutor || !selStudents.includes(tutor.parent.id)) return
        if (tutor.parent.phone) {
          waList.push({
            tutorName:   `${tutor.parent.lastName} ${tutor.parent.firstName}`,
            studentName: `${s.lastName} ${s.firstName}`,
            phone:       tutor.parent.phone,
            waUrl:       buildWaUrl(tutor.parent.phone, waMsg),
          })
        }
      })

      setWaResults(waList)
      setShowWa(true)
      toast(`Notificación interna enviada a ${parentIds.size} tutor(es)`, 'success')
      loadSentNotifications()
    } catch { toast('Error de conexión', 'error') }
    finally  { setSending(false) }
  }

  const selCourse = courses.find(c => c.id === selCourseId)

  const todayDay = new Date().getDay() === 0 ? 7 : new Date().getDay()
  const todayCourseIds = new Set(
    mySchedule.filter(s => s.dayOfWeek === todayDay).map(s => s.course.id)
  )

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-brand-700 mb-1">Notificaciones</h1>
        <p className="text-[13px] text-neutral-500">Envía comunicados a padres tutores por sistema y WhatsApp</p>
      </div>

      {courses.length > 1 && (
        <Card className="mb-4">
          <div className="text-[11px] font-bold text-neutral-500 uppercase tracking-wide mb-2.5">Selecciona el curso:</div>
          <div className="flex gap-2 flex-wrap">
            {courses.map(c => {
              const isSel   = selCourseId === c.id
              const isToday = todayCourseIds.has(c.id)
              return (
                <button
                  key={c.id} onClick={() => setSelCourseId(c.id)}
                  className={`flex items-center justify-center rounded-full border-2 transition-colors ${isSel ? 'border-accent-500 bg-accent-500' : 'border-neutral-300 bg-white hover:bg-brand-100'}`}
                  style={{ padding: 3 }}
                >
                  <span
                    className={`w-9 h-9 rounded-full bg-[#173B2E] text-white flex items-center justify-center text-[10px] font-extrabold shrink-0 ${isToday && !isSel ? 'ring-2 ring-offset-1' : ''}`}
                    style={isToday && !isSel ? { ['--tw-ring-color' as any]: '#C0392B' } : undefined}
                  >
                    {GRADES[c.grade]}{c.parallel}
                  </span>
                </button>
              )
            })}
          </div>
        </Card>
      )}

      {!selCourseId ? (
        <Card className="flex flex-col items-center gap-3 py-14 text-neutral-500">
          <Bell size={40} className="text-neutral-300"/>
          <p>Selecciona un curso para enviar notificaciones</p>
        </Card>
      ) : loading ? (
        <div className="flex justify-center py-12"><p className="text-sm text-neutral-500">Cargando...</p></div>
      ) : (
        <>
          {showWa && waResults.length > 0 && (
            <Card className="!border-2 !border-[#25D366] mb-4" padded={false}>
              <div className="flex items-center gap-2 px-4 py-3 bg-[#E8F5EE] text-[13px] font-semibold text-[#1A5C2A]">
                <MessageCircle size={16} className="text-[#25D366]"/>
                <span>Enviar también por WhatsApp ({waResults.length} tutor{waResults.length > 1 ? 'es' : ''} con teléfono)</span>
                <button onClick={() => setShowWa(false)} className="ml-auto text-neutral-500 hover:text-brand-700 px-1.5">✕</button>
              </div>
              <div className="flex flex-col">
                {waResults.map((w, i) => (
                  <div key={i} className="flex items-center justify-between gap-3 px-4 py-2.5 border-t border-neutral-100">
                    <div className="flex-1 flex flex-col gap-0.5">
                      <span className="text-[13px] font-medium text-brand-700">{w.studentName}</span>
                      <span className="text-[11px] text-neutral-500">Tutor: {w.tutorName} · {w.phone}</span>
                    </div>
                    <a href={w.waUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#25D366] text-white rounded-lg text-xs font-medium whitespace-nowrap hover:bg-[#1DA851] transition-colors">
                      <MessageCircle size={13}/> WhatsApp
                    </a>
                  </div>
                ))}
              </div>
              {waResults.length < selStudents.length && (
                <div className="px-4 py-2.5 text-xs text-[#BA7517] bg-warning-100 border-t border-warning-500">
                  ⚠️ {selStudents.length - waResults.length} tutor(es) no tienen teléfono registrado.
                </div>
              )}
            </Card>
          )}

          <div className="grid gap-4 items-start" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <Card className="flex flex-col gap-3.5">
              <div className="flex items-center gap-2 text-[13px] font-semibold text-brand-700 pb-2 border-b border-neutral-100">
                <Bell size={14}/> Nueva notificación
              </div>

              {selCourse && (
                <div className="bg-neutral-100/60 border border-neutral-300 rounded-lg p-3">
                  <div className="text-[13px] font-bold text-brand-700 mb-1.5">📚 {GRADES[selCourse.grade]} &quot;{selCourse.parallel}&quot; · {SHIFTS[selCourse.shift]}</div>
                  {courseInfo?.tutor && (
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[11px] font-semibold text-neutral-500 min-w-[90px]">Maestro Tutor:</span>
                      <span className="text-xs font-medium text-brand-700">👨‍🏫 {courseInfo.tutor.teacher.lastName} {courseInfo.tutor.teacher.firstName}</span>
                    </div>
                  )}
                  {(courseInfo as any)?.delegate && (
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[11px] font-semibold text-neutral-500 min-w-[90px]">Delegado:</span>
                      <span className="text-xs font-medium text-brand-700">👤 {(courseInfo as any).delegate.lastName} {(courseInfo as any).delegate.firstName}</span>
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="text-[11px] font-bold text-brand-700 uppercase tracking-wide block mb-1.5">Tipo *</label>
                <div className="grid grid-cols-2 gap-1.5">
                  {TIPOS.map(t => (
                    <button
                      key={t.value} onClick={() => setNotifType(t.value)}
                      className={`flex flex-col items-start gap-0.5 px-2.5 py-1.5 rounded-lg border text-left transition-colors ${notifType === t.value ? 'bg-brand-700 border-brand-700 text-white' : 'bg-white border-neutral-300 hover:border-brand-500'}`}
                    >
                      <span className="text-xs font-semibold">{t.label}</span>
                      <span className={`text-[10px] ${notifType === t.value ? 'text-white/70' : 'text-neutral-500'}`}>{t.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              <Input
                label="Título" required placeholder="Ej: Inasistencia a clase del 10/06/2026..."
                value={title} onChange={e => setTitle(e.target.value)}
              />

              <Textarea
                label="Mensaje" required rows={3} placeholder="Describe el motivo de la notificación..."
                value={message} onChange={e => setMessage(e.target.value)}
              />

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[11px] font-bold text-brand-700 uppercase tracking-wide">Tutores *</label>
                  <div className="flex gap-1.5">
                    <button onClick={selectAll} className="px-2.5 py-1 border border-neutral-300 rounded-md text-[11px] font-medium text-brand-700 hover:bg-neutral-100">Todos</button>
                    <button onClick={() => setSelStudents([])} className="px-2.5 py-1 border border-danger-500/40 rounded-md text-[11px] font-medium text-danger-600 hover:bg-danger-100">Ninguno</button>
                  </div>
                </div>
                <div className="border border-neutral-300 rounded-lg max-h-[180px] overflow-y-auto">
                  {students.map(s => {
                    const tutor = s.parents.find(p => p.isTutor)
                    if (!tutor) return null
                    const selected = selStudents.includes(tutor.parent.id)
                    return (
                      <label
                        key={s.id}
                        className={`flex items-center gap-2 px-2.5 py-1.5 cursor-pointer border-b border-neutral-100 last:border-b-0 transition-colors ${selected ? 'bg-success-100' : 'hover:bg-neutral-100/60'}`}
                      >
                        <input type="checkbox" checked={selected} onChange={() => toggleStudent(tutor.parent.id)} className="shrink-0 w-3.5 h-3.5 accent-[var(--color-brand-700)]"/>
                        <div className="flex-1 flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-medium text-brand-700">{s.lastName} {s.firstName}</span>
                          <span className="text-[11px] text-neutral-500">
                            {tutor.parent.lastName} {tutor.parent.firstName}
                            {tutor.parent.phone && <span className="text-[#25D366] font-semibold"> · 📱 WhatsApp</span>}
                          </span>
                        </div>
                        {selected && <Check size={12} className="text-success-700"/>}
                      </label>
                    )
                  })}
                </div>
                <div className="text-[11px] text-neutral-500 mt-1">
                  {selStudents.length} seleccionado(s) · {waResults.length > 0 ? `${waResults.length} con WhatsApp` : ''}
                </div>
              </div>

              {courseInfo?.tutor && (
                <div className="bg-brand-100 border border-warning-500 rounded-lg p-3">
                  <label className="flex items-center gap-2 text-[13px] text-brand-700 font-medium cursor-pointer">
                    <input type="checkbox" checked={sendToTutor} onChange={e => setSendToTutor(e.target.checked)} className="w-4 h-4 accent-[var(--color-brand-700)] cursor-pointer"/>
                    <span>👨‍🏫 Incluir nota al Maestro Tutor en el mensaje</span>
                  </label>
                </div>
              )}

              <Button
                onClick={handleSend} loading={sending}
                disabled={!title || !message || selStudents.length === 0}
                className="justify-center"
              >
                {!sending && <Send size={14}/>}
                {sending ? 'Enviando...' : `Enviar a ${selStudents.length} tutor(es)`}
              </Button>
            </Card>

            <Card padded={false} className="overflow-hidden">
              <div className="flex items-center gap-2 px-4.5 py-3.5 text-[13px] font-semibold text-brand-700 cursor-pointer" onClick={() => setShowSent(!showSent)}>
                <BookOpen size={14}/> Enviadas ({sentList.length})
                <span className="ml-auto">{showSent ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}</span>
              </div>
              {showSent && (
                <div className="border-t border-neutral-100">
                  {sentList.length === 0 ? (
                    <p className="p-5 text-[13px] text-neutral-500 italic text-center">No hay notificaciones enviadas aún</p>
                  ) : (
                    sentList.slice(0, 20).map(n => (
                      <div key={n.id} className="px-4 py-3 border-b border-neutral-100 last:border-b-0">
                        <div className="text-[13px] font-semibold text-brand-700 mb-0.5">{n.title}</div>
                        <div className="text-xs text-neutral-500 leading-snug mb-1 whitespace-pre-line">{n.message}</div>
                        <div className="flex justify-between text-[11px] text-neutral-500">
                          <span>Para: {n.parent.lastName} {n.parent.firstName}</span>
                          <span>{fmtDate(n.createdAt)}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  )
}
