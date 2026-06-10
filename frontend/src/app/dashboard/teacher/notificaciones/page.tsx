'use client'

import { useEffect, useState } from 'react'
import { Bell, Send, Users, BookOpen, ChevronDown, ChevronUp, Check, MessageCircle } from 'lucide-react'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

interface Course {
  id: number; grade: string; parallel: string; shift: string; educationType: string
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
  const [courses,      setCourses]      = useState<Course[]>([])
  const [selCourseId,  setSelCourseId]  = useState<number | null>(null)
  const [courseInfo,   setCourseInfo]   = useState<CourseInfo | null>(null)
  const [students,     setStudents]     = useState<Student[]>([])
  const [sentList,     setSentList]     = useState<SentNotification[]>([])
  const [loading,      setLoading]      = useState(false)
  const [sending,      setSending]      = useState(false)
  const [success,      setSuccess]      = useState('')
  const [error,        setError]        = useState('')
  const [selStudents,  setSelStudents]  = useState<number[]>([])
  const [sendToTutor,  setSendToTutor]  = useState(true)
  const [notifType,    setNotifType]    = useState('ACADEMICA')
  const [title,        setTitle]        = useState('')
  const [message,      setMessage]      = useState('')
  const [showSent,     setShowSent]     = useState(false)
  const [waResults,    setWaResults]    = useState<WaResult[]>([])
  const [showWa,       setShowWa]       = useState(false)

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : ''

  const notify = (msg: string, type: 'success' | 'error' = 'success') => {
    if (type === 'success') { setSuccess(msg); setTimeout(() => setSuccess(''), 4000) }
    else                    { setError(msg);   setTimeout(() => setError(''),   4000) }
  }

  useEffect(() => {
    const init = async () => {
      try {
        const res  = await fetch(`${API_URL}/api/teachers/my-workload`, { headers: { Authorization: `Bearer ${token}` } })
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
      } catch { notify('Error al cargar cursos', 'error') }
    }
    init()
  }, [])

  useEffect(() => {
    if (!selCourseId) return
    setSelStudents([]); setStudents([]); setCourseInfo(null); setWaResults([]); setShowWa(false)
    loadCourseData(); loadSentNotifications()
  }, [selCourseId])

  const loadCourseData = async () => {
    if (!selCourseId) return
    setLoading(true)
    try {
      const [cRes, sRes] = await Promise.all([
        fetch(`${API_URL}/api/courses/${selCourseId}`,              { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_URL}/api/students/by-course/${selCourseId}`,   { headers: { Authorization: `Bearer ${token}` } }),
      ])
      const [cData, sData] = await Promise.all([cRes.json(), sRes.json()])
      if (cRes.ok) setCourseInfo(cData)
      if (sRes.ok && Array.isArray(sData)) setStudents(sData.map((a: any) => a.student))
    } catch { notify('Error al cargar datos del curso', 'error') }
    finally  { setLoading(false) }
  }

  const loadSentNotifications = async () => {
    try {
      const res  = await fetch(`${API_URL}/api/notifications/sent`, { headers: { Authorization: `Bearer ${token}` } })
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
    if (!title || !message)          { notify('Título y mensaje son requeridos', 'error'); return }
    if (selStudents.length === 0)    { notify('Selecciona al menos un tutor', 'error'); return }

    const parentIds = new Set<number>(selStudents)
    setSending(true)
    try {
      const fullMessage = sendToTutor && courseInfo?.tutor
        ? `${message}\n\n[Copia al Maestro Tutor: ${courseInfo.tutor.teacher.lastName} ${courseInfo.tutor.teacher.firstName}]`
        : message

      const res  = await fetch(`${API_URL}/api/notifications/send-bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          parentIds: Array.from(parentIds),
          title:   `[Maestro] ${title}`,
          message: fullMessage,
          type:    notifType,
        }),
      })
      const data = await res.json()
      if (!res.ok) { notify(data.message, 'error'); return }

      // Preparar links de WhatsApp para tutores con teléfono
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
      notify(`Notificación interna enviada a ${parentIds.size} tutor(es)`)
      loadSentNotifications()
    } catch { notify('Error de conexión', 'error') }
    finally  { setSending(false) }
  }

  const selCourse = courses.find(c => c.id === selCourseId)

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Notificaciones</h1>
          <p>Envía comunicados a padres tutores por sistema y WhatsApp</p>
        </div>
      </div>

      {success && <div className="alert suc">{success}</div>}
      {error   && <div className="alert err">{error}</div>}

      {/* Selector de curso */}
      {courses.length > 1 && (
        <div className="course-selector">
          <div className="selector-label">Selecciona el curso:</div>
          <div className="course-btns">
            {courses.map(c => (
              <button key={c.id} className={`course-btn ${selCourseId === c.id ? 'active' : ''}`}
                onClick={() => setSelCourseId(c.id)}>
                {GRADES[c.grade]} &quot;{c.parallel}&quot; · {SHIFTS[c.shift]}
                {c.educationType === 'BTH' && <span className="bth">BTH</span>}
              </button>
            ))}
          </div>
        </div>
      )}

      {!selCourseId ? (
        <div className="empty-state"><Bell size={40} color="#CBE0F0"/><p>Selecciona un curso para enviar notificaciones</p></div>
      ) : loading ? (
        <div className="center"><div className="spinner"/></div>
      ) : (
        <>
          {/* Panel WhatsApp post-envío */}
          {showWa && waResults.length > 0 && (
            <div className="wa-panel">
              <div className="wa-panel-header">
                <MessageCircle size={16} color="#25D366"/>
                <span>Enviar también por WhatsApp ({waResults.length} tutor{waResults.length > 1 ? 'es' : ''} con teléfono)</span>
                <button className="wa-close" onClick={() => setShowWa(false)}>✕</button>
              </div>
              <div className="wa-list">
                {waResults.map((w, i) => (
                  <div key={i} className="wa-item">
                    <div className="wa-info">
                      <span className="wa-student">{w.studentName}</span>
                      <span className="wa-tutor">Tutor: {w.tutorName} · {w.phone}</span>
                    </div>
                    <a href={w.waUrl} target="_blank" rel="noopener noreferrer" className="wa-btn">
                      <MessageCircle size={13}/> WhatsApp
                    </a>
                  </div>
                ))}
              </div>
              {waResults.length < selStudents.length && (
                <div className="wa-note">
                  ⚠️ {selStudents.length - waResults.length} tutor(es) no tienen teléfono registrado.
                </div>
              )}
            </div>
          )}

          <div className="two-cols">
            {/* Panel izquierdo — Formulario */}
            <div className="panel">
              <div className="panel-header"><Bell size={14}/> Nueva notificación</div>
              <div className="panel-body">

                {/* Info del curso */}
                {selCourse && (
                  <div className="course-info-box">
                    <div className="cib-title">📚 {GRADES[selCourse.grade]} &quot;{selCourse.parallel}&quot; · {SHIFTS[selCourse.shift]}</div>
                    {courseInfo?.tutor && (
                      <div className="cib-row">
                        <span className="cib-label">Maestro Tutor:</span>
                        <span className="cib-value">👨‍🏫 {courseInfo.tutor.teacher.lastName} {courseInfo.tutor.teacher.firstName}</span>
                      </div>
                    )}
                    {(courseInfo as any)?.delegate && (
                      <div className="cib-row">
                        <span className="cib-label">Delegado:</span>
                        <span className="cib-value">👤 {(courseInfo as any).delegate.lastName} {(courseInfo as any).delegate.firstName}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Tipo */}
                <div className="fg">
                  <label>Tipo *</label>
                  <div className="tipo-grid">
                    {TIPOS.map(t => (
                      <button key={t.value} className={`tipo-btn ${notifType === t.value ? 'active' : ''}`}
                        onClick={() => setNotifType(t.value)}>
                        <span>{t.label}</span>
                        <span className="tipo-desc">{t.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Título */}
                <div className="fg">
                  <label>Título *</label>
                  <input type="text" placeholder="Ej: Inasistencia a clase del 10/06/2026..."
                    value={title} onChange={e => setTitle(e.target.value)}/>
                </div>

                {/* Mensaje */}
                <div className="fg">
                  <label>Mensaje *</label>
                  <textarea placeholder="Describe el motivo de la notificación..."
                    value={message} onChange={e => setMessage(e.target.value)} rows={3}/>
                </div>

                {/* Destinatarios */}
                <div className="fg">
                  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'6px'}}>
                    <label style={{margin:0}}>Tutores *</label>
                    <div style={{display:'flex',gap:'6px'}}>
                      <button className="btn-xs" onClick={selectAll}>Todos</button>
                      <button className="btn-xs outline" onClick={() => setSelStudents([])}>Ninguno</button>
                    </div>
                  </div>
                  <div className="students-list">
                    {students.map(s => {
                      const tutor = s.parents.find(p => p.isTutor)
                      if (!tutor) return null
                      const selected = selStudents.includes(tutor.parent.id)
                      return (
                        <label key={s.id} className={`student-item ${selected ? 'selected' : ''}`}>
                          <input type="checkbox" checked={selected} onChange={() => toggleStudent(tutor.parent.id)}/>
                          <div className="student-item-info">
                            <span className="student-name">{s.lastName} {s.firstName}</span>
                            <span className="tutor-name">
                              {tutor.parent.lastName} {tutor.parent.firstName}
                              {tutor.parent.phone && <span className="has-wa"> · 📱 WhatsApp</span>}
                            </span>
                          </div>
                          {selected && <Check size={12} color="#0F6E56"/>}
                        </label>
                      )
                    })}
                  </div>
                  <div style={{fontSize:'11px',color:'#6B8BB0',marginTop:'4px'}}>
                    {selStudents.length} seleccionado(s) · {waResults.length > 0 ? `${waResults.length} con WhatsApp` : ''}
                  </div>
                </div>

                {/* Copiar al maestro tutor */}
                {courseInfo?.tutor && (
                  <div className="notify-box">
                    <label className="checkbox-label">
                      <input type="checkbox" checked={sendToTutor} onChange={e => setSendToTutor(e.target.checked)}/>
                      <span>👨‍🏫 Incluir nota al Maestro Tutor en el mensaje</span>
                    </label>
                  </div>
                )}

                <button className="btn-primary" onClick={handleSend}
                  disabled={sending || !title || !message || selStudents.length === 0}>
                  {sending ? <span className="spinsm"/> : <Send size={14}/>}
                  {sending ? 'Enviando...' : `Enviar a ${selStudents.length} tutor(es)`}
                </button>
              </div>
            </div>

            {/* Panel derecho — Historial */}
            <div className="panel">
              <div className="panel-header" style={{cursor:'pointer'}} onClick={() => setShowSent(!showSent)}>
                <BookOpen size={14}/> Enviadas ({sentList.length})
                {showSent ? <ChevronUp size={14} style={{marginLeft:'auto'}}/> : <ChevronDown size={14} style={{marginLeft:'auto'}}/>}
              </div>
              {showSent && (
                <div className="panel-body" style={{padding:0}}>
                  {sentList.length === 0 ? (
                    <div className="no-data">No hay notificaciones enviadas aún</div>
                  ) : (
                    sentList.slice(0, 20).map(n => (
                      <div key={n.id} className="notif-item">
                        <div className="notif-title">{n.title}</div>
                        <div className="notif-msg">{n.message}</div>
                        <div className="notif-meta">
                          <span>Para: {n.parent.lastName} {n.parent.firstName}</span>
                          <span>{fmtDate(n.createdAt)}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      <style>{`
        .page-header{margin-bottom:24px}
        .page-header h1{font-size:20px;font-weight:700;color:#633806;margin-bottom:4px}
        .page-header p{font-size:13px;color:#6B8BB0}
        .alert{padding:10px 14px;border-radius:8px;font-size:13px;margin-bottom:16px}
        .alert.suc{background:#E1F5EE;border:1px solid #9FE1CB;color:#0F6E56}
        .alert.err{background:#FFF0F0;border:1px solid #FFBBBB;color:#C0392B}
        .center{display:flex;justify-content:center;padding:48px;color:#6B8BB0}
        .course-selector{background:#fff;border:1px solid #CBE0F0;border-radius:12px;padding:16px;margin-bottom:16px}
        .selector-label{font-size:11px;font-weight:700;color:#6B8BB0;text-transform:uppercase;letter-spacing:.6px;margin-bottom:10px}
        .course-btns{display:flex;gap:8px;flex-wrap:wrap}
        .course-btn{display:flex;align-items:center;gap:6px;padding:8px 16px;border:1.5px solid #CBE0F0;border-radius:8px;background:#fff;color:#1A3A7C;font-size:13px;font-weight:500;cursor:pointer}
        .course-btn:hover{border-color:#633806;background:#FDF0E6}
        .course-btn.active{background:#633806;color:#fff;border-color:#633806}
        .bth{background:rgba(255,255,255,0.2);padding:1px 6px;border-radius:10px;font-size:10px;margin-left:4px}
        .empty-state{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:60px;gap:12px;color:#6B8BB0;font-size:13px;background:#fff;border:1px solid #CBE0F0;border-radius:12px}
        .wa-panel{background:#fff;border:2px solid #25D366;border-radius:12px;margin-bottom:16px;overflow:hidden}
        .wa-panel-header{display:flex;align-items:center;gap:8px;padding:12px 16px;background:#E8F5EE;font-size:13px;font-weight:600;color:#1A5C2A}
        .wa-close{margin-left:auto;background:none;border:none;cursor:pointer;color:#6B8BB0;font-size:14px;padding:2px 6px}
        .wa-list{display:flex;flex-direction:column}
        .wa-item{display:flex;align-items:center;justify-content:space-between;padding:10px 16px;border-top:1px solid #F0F6FC;gap:12px}
        .wa-info{flex:1;display:flex;flex-direction:column;gap:2px}
        .wa-student{font-size:13px;font-weight:500;color:#1A3A7C}
        .wa-tutor{font-size:11px;color:#6B8BB0}
        .wa-btn{display:flex;align-items:center;gap:5px;padding:6px 14px;background:#25D366;color:#fff;border:none;border-radius:8px;font-size:12px;font-weight:500;cursor:pointer;text-decoration:none;white-space:nowrap}
        .wa-btn:hover{background:#1DA851}
        .wa-note{padding:10px 16px;font-size:12px;color:#BA7517;background:#FFFBEA;border-top:1px solid #F5C518}
        .two-cols{display:grid;grid-template-columns:1fr 1fr;gap:16px;align-items:start}
        .panel{background:#fff;border:1px solid #CBE0F0;border-radius:12px;overflow:hidden}
        .panel-header{display:flex;align-items:center;gap:8px;padding:14px 18px;border-bottom:1px solid #F0F6FC;font-size:13px;font-weight:600;color:#1A3A7C}
        .panel-body{padding:16px;display:flex;flex-direction:column;gap:14px}
        .course-info-box{background:#F8FBFF;border:1px solid #CBE0F0;border-radius:8px;padding:12px}
        .cib-title{font-size:13px;font-weight:700;color:#1A3A7C;margin-bottom:6px}
        .cib-row{display:flex;align-items:center;gap:8px;margin-top:4px}
        .cib-label{font-size:11px;color:#6B8BB0;font-weight:600;min-width:90px}
        .cib-value{font-size:12px;color:#1A3A7C;font-weight:500}
        .fg{display:flex;flex-direction:column;gap:6px}
        .fg label{font-size:11px;font-weight:700;color:#1A3A7C;text-transform:uppercase;letter-spacing:.6px}
        .fg input,.fg textarea{padding:9px 12px;border:1.5px solid #CBE0F0;border-radius:8px;font-size:13px;color:#1A3A7C;outline:none;width:100%;resize:vertical;font-family:inherit}
        .fg input:focus,.fg textarea:focus{border-color:#4A9FD4;box-shadow:0 0 0 3px rgba(74,159,212,.12)}
        .tipo-grid{display:grid;grid-template-columns:1fr 1fr;gap:6px}
        .tipo-btn{display:flex;flex-direction:column;align-items:flex-start;gap:2px;padding:7px 10px;border:1.5px solid #CBE0F0;border-radius:8px;background:#fff;cursor:pointer;text-align:left}
        .tipo-btn:hover{border-color:#633806;background:#FDF0E6}
        .tipo-btn.active{border-color:#633806;background:#633806;color:#fff}
        .tipo-btn.active .tipo-desc{color:rgba(255,255,255,0.7)}
        .tipo-btn span:first-child{font-size:12px;font-weight:600}
        .tipo-desc{font-size:10px;color:#6B8BB0}
        .students-list{border:1.5px solid #CBE0F0;border-radius:8px;max-height:180px;overflow-y:auto}
        .student-item{display:flex;align-items:center;gap:8px;padding:7px 10px;cursor:pointer;border-bottom:1px solid #F0F6FC;transition:background .15s}
        .student-item:last-child{border-bottom:none}
        .student-item:hover{background:#F8FBFF}
        .student-item.selected{background:#E1F5EE}
        .student-item input{accent-color:#633806;cursor:pointer;flex-shrink:0;width:14px;height:14px}
        .student-item-info{flex:1;display:flex;flex-direction:row;align-items:center;gap:6px;flex-wrap:wrap}
        .student-name{font-size:12px;font-weight:500;color:#1A3A7C}
        .tutor-name{font-size:11px;color:#6B8BB0}
        .has-wa{color:#25D366;font-weight:600}
        .notify-box{background:#FDF0E6;border:1px solid #F5C518;border-radius:8px;padding:12px}
        .checkbox-label{display:flex;align-items:center;gap:8px;font-size:13px;color:#633806;cursor:pointer;font-weight:500}
        .checkbox-label input{accent-color:#633806;width:16px;height:16px;cursor:pointer}
        .btn-xs{padding:3px 10px;border:1.5px solid #CBE0F0;border-radius:6px;background:#fff;color:#1A3A7C;font-size:11px;cursor:pointer;font-weight:500}
        .btn-xs:hover{background:#F0F6FC}
        .btn-xs.outline{border-color:#FFBBBB;color:#C0392B}
        .btn-xs.outline:hover{background:#FFF0F0}
        .btn-primary{display:flex;align-items:center;justify-content:center;gap:6px;padding:10px 16px;background:#633806;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:500;cursor:pointer;width:100%}
        .btn-primary:hover:not(:disabled){background:#7A4A0A}
        .btn-primary:disabled{opacity:.6;cursor:not-allowed}
        .no-data{padding:20px;font-size:13px;color:#6B8BB0;font-style:italic;text-align:center}
        .notif-item{padding:12px 16px;border-bottom:1px solid #F0F6FC}
        .notif-item:last-child{border-bottom:none}
        .notif-title{font-size:13px;font-weight:600;color:#1A3A7C;margin-bottom:3px}
        .notif-msg{font-size:12px;color:#6B8BB0;line-height:1.4;margin-bottom:4px;white-space:pre-line}
        .notif-meta{display:flex;justify-content:space-between;font-size:11px;color:#6B8BB0}
        .spinner{width:24px;height:24px;border:2px solid rgba(99,56,6,.2);border-top-color:#633806;border-radius:50%;animation:spin .7s linear infinite}
        .spinsm{width:14px;height:14px;border:2px solid rgba(255,255,255,.3);border-top-color:#fff;border-radius:50%;animation:spin .7s linear infinite;display:inline-block}
        @keyframes spin{to{transform:rotate(360deg)}}
        @media(max-width:768px){.two-cols{grid-template-columns:1fr}.tipo-grid{grid-template-columns:1fr}}
      `}</style>
    </div>
  )
}