'use client'

import { useEffect, useState } from 'react'
import { Plus, X, Users, Bell, Send, ClipboardList, Check, UserCheck, UserX, Lock, Edit, Trash2 } from 'lucide-react'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

interface Course {
  id: number; grade: string; parallel: string; shift: string; educationType: string
}

interface Parent {
  id: number; firstName: string; lastName: string; phone?: string; ci?: string
}

interface Attendance {
  present:   boolean
  parentId?: number
  parent:    { id?: number; firstName: string; lastName: string; ci?: string }
}

interface Meeting {
  id:          number
  title:       string
  date:        string
  courseId:    number
  attendances: Attendance[]
}

const GRADES: Record<string, string> = { PRIMERO:'1°', SEGUNDO:'2°', TERCERO:'3°', CUARTO:'4°', QUINTO:'5°', SEXTO:'6°' }
const SHIFTS: Record<string, string> = { MORNING:'Mañana', AFTERNOON:'Tarde', NIGHT:'Noche' }

const fmtDate = (d: string) => new Date(d).toLocaleDateString('es-BO', {
  day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
})

const getDefaultDate = () => {
  const now = new Date()
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset())
  return now.toISOString().slice(0, 16)
}

const toInputDate = (d: string) => {
  const dt = new Date(d)
  dt.setMinutes(dt.getMinutes() - dt.getTimezoneOffset())
  return dt.toISOString().slice(0, 16)
}

const isAttendanceClosed = (m: Meeting) => m.attendances.some(a => a.present === true)

export default function TeacherReunionesPage() {
  const [courses,      setCourses]      = useState<Course[]>([])
  const [selCourseId,  setSelCourseId]  = useState<number | null>(null)
  const [meetings,     setMeetings]     = useState<Meeting[]>([])
  const [tutors,       setTutors]       = useState<Parent[]>([])
  const [loading,      setLoading]      = useState(false)
  const [saving,       setSaving]       = useState(false)
  const [savingAtt,    setSavingAtt]    = useState(false)
  const [success,      setSuccess]      = useState('')
  const [error,        setError]        = useState('')
  const [showModal,    setShowModal]    = useState(false)
  const [showAttModal, setShowAttModal] = useState(false)
  const [showEditModal,setShowEditModal]= useState(false)
  const [selMeeting,   setSelMeeting]   = useState<Meeting | null>(null)
  const [attendance,   setAttendance]   = useState<Record<number, boolean>>({})
  const [form,         setForm]         = useState({ title: '', date: getDefaultDate() })
  const [editForm,     setEditForm]     = useState({ title: '', date: '' })
  const [notifyAll,    setNotifyAll]    = useState(false)

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : ''

  const notify = (msg: string, type: 'success' | 'error' = 'success') => {
    if (type === 'success') { setSuccess(msg); setTimeout(() => setSuccess(''), 4000) }
    else                    { setError(msg);   setTimeout(() => setError(''),   4000) }
  }

  // Cargar cursos del maestro
  useEffect(() => {
    const init = async () => {
      try {
        const res  = await fetch(`${API_URL}/api/teachers/my-workload`, { headers: { Authorization: `Bearer ${token}` } })
        const data = await res.json()
        if (res.ok) {
          // Obtener cursos únicos
          const courseMap = new Map<number, Course>()
          data.assignments?.forEach((a: any) => {
            if (!courseMap.has(a.courseId)) {
              courseMap.set(a.courseId, {
                id: a.courseId, grade: a.grade, parallel: a.parallel,
                shift: a.shift, educationType: a.educationType
              })
            }
          })
          const courseList = Array.from(courseMap.values())
          setCourses(courseList)
          if (courseList.length === 1) setSelCourseId(courseList[0].id)
        }
      } catch { notify('Error al cargar cursos', 'error') }
    }
    init()
  }, [])

  // Cargar reuniones y tutores cuando cambia el curso
  useEffect(() => {
    if (!selCourseId) return
    fetchMeetings()
    fetchTutors()
  }, [selCourseId])

  const fetchMeetings = async () => {
    if (!selCourseId) return
    setLoading(true)
    try {
     const res  = await fetch(`${API_URL}/api/meetings/by-course?courseId=${selCourseId}`, {
        headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      if (res.ok) setMeetings(Array.isArray(data) ? data : [])
    } catch { notify('Error al cargar reuniones', 'error') }
    finally  { setLoading(false) }
  }

  const fetchTutors = async () => {
    if (!selCourseId) return
    try {
      const res  = await fetch(`${API_URL}/api/students/by-course/${selCourseId}`, {
        headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      if (res.ok) {
        const tutorMap = new Map<number, Parent>()
        data.forEach((a: any) => {
          a.student?.parents?.forEach((ps: any) => {
            if (ps.isTutor && !tutorMap.has(ps.parent.id)) tutorMap.set(ps.parent.id, ps.parent)
          })
        })
        setTutors(Array.from(tutorMap.values()))
      }
    } catch { console.error('Error al cargar tutores') }
  }

  const openModal = () => {
    setForm({ title: '', date: getDefaultDate() })
    setNotifyAll(false); setShowModal(true)
  }

  const openEdit = (m: Meeting) => {
    setSelMeeting(m); setEditForm({ title: m.title, date: toInputDate(m.date) }); setShowEditModal(true)
  }

  const openAttendance = (m: Meeting) => {
    setSelMeeting(m)
    const map: Record<number, boolean> = {}
    m.attendances.forEach(a => {
      const pid = a.parent?.id ?? (a as any).parentId
      if (pid !== undefined) map[pid] = a.present
    })
    setAttendance(map); setShowAttModal(true)
  }

  const handleCreate = async () => {
    if (!form.title || !form.date || !selCourseId) { notify('Completa todos los campos', 'error'); return }
    setSaving(true)
    try {
      const res  = await fetch(`${API_URL}/api/meetings/by-teacher`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...form, courseId: selCourseId }),
      })
      const data = await res.json()
      if (!res.ok) { notify(data.message, 'error'); return }
      if (notifyAll && tutors.length > 0) {
        await fetch(`${API_URL}/api/notifications/send-bulk`, {
          method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            parentIds: tutors.map(t => t.id),
            title:   `[Maestro] Convocatoria: ${form.title}`,
            message: `El maestro le convoca a la reunión "${form.title}" programada para el ${new Date(form.date).toLocaleDateString('es-BO', { day:'2-digit', month:'long', year:'numeric', hour:'2-digit', minute:'2-digit' })}.`,
            type: 'REUNION',
          }),
        })
        notify(`Reunión creada y notificación enviada a ${tutors.length} tutores`)
      } else { notify(data.message) }
      setShowModal(false); fetchMeetings()
    } catch { notify('Error de conexión', 'error') }
    finally  { setSaving(false) }
  }

  const handleEdit = async () => {
    if (!selMeeting || !editForm.title || !editForm.date) { notify('Completa todos los campos', 'error'); return }
    setSaving(true)
    try {
      const res  = await fetch(`${API_URL}/api/meetings/${selMeeting.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ title: editForm.title, date: editForm.date }),
      })
      const data = await res.json()
      if (!res.ok) { notify(data.message, 'error'); return }
      if (tutors.length > 0) {
        await fetch(`${API_URL}/api/notifications/send-bulk`, {
          method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            parentIds: tutors.map(t => t.id),
            title:   `[Maestro] Reunión reprogramada: ${editForm.title}`,
            message: `La reunión "${editForm.title}" ha sido reprogramada para el ${new Date(editForm.date).toLocaleDateString('es-BO', { day:'2-digit', month:'long', year:'numeric', hour:'2-digit', minute:'2-digit' })}.`,
            type: 'REUNION',
          }),
        })
      }
      notify('Reunión actualizada y tutores notificados')
      setShowEditModal(false); fetchMeetings()
    } catch { notify('Error de conexión', 'error') }
    finally  { setSaving(false) }
  }

  const handleDelete = async (m: Meeting) => {
    if (!confirm(`¿Cancelar la reunión "${m.title}"?`)) return
    try {
      const res  = await fetch(`${API_URL}/api/meetings/${m.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      if (!res.ok) { notify(data.message, 'error'); return }
      if (tutors.length > 0) {
        await fetch(`${API_URL}/api/notifications/send-bulk`, {
          method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            parentIds: tutors.map(t => t.id),
            title:   `[Maestro] Reunión cancelada: ${m.title}`,
            message: `La reunión "${m.title}" programada para el ${fmtDate(m.date)} ha sido cancelada.`,
            type: 'REUNION',
          }),
        })
      }
      notify('Reunión cancelada y tutores notificados'); fetchMeetings()
    } catch { notify('Error de conexión', 'error') }
  }

  const handleSaveAttendance = async () => {
    if (!selMeeting) return
    setSavingAtt(true)
    try {
      const attendances = Object.entries(attendance).map(([parentId, present]) => ({ parentId: parseInt(parentId), present }))
      const res  = await fetch(`${API_URL}/api/meetings/${selMeeting.id}/attendance`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ attendances }),
      })
      const data = await res.json()
      if (!res.ok) { notify(data.message, 'error'); return }

      const ausentes = selMeeting.attendances
        .map(a => ({ ...a, pid: a.parent?.id ?? (a as any).parentId }))
        .filter(a => !attendance[a.pid])

      if (ausentes.length > 0) {
        const jRes  = await fetch(`${API_URL}/api/users/junta-parents`, { headers: { Authorization: `Bearer ${token}` } })
        const jData = await jRes.json()
        if (jRes.ok && jData.length > 0) {
          const ausentesNombres = ausentes.map(a => `• ${a.parent.lastName} ${a.parent.firstName}`).join(', ')
          await fetch(`${API_URL}/api/notifications/send-bulk`, {
            method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({
              parentIds: jData.map((p: any) => p.id),
              title:   `[Maestro] Ausentes en reunión: ${selMeeting.title}`,
              message: `Se registraron ${ausentes.length} ausente(s) en la reunión "${selMeeting.title}" del ${fmtDate(selMeeting.date)}. Tutores ausentes: ${ausentesNombres}. Por favor determine si corresponde aplicar multa.`,
              type: 'REUNION',
            }),
          })
          notify(`Asistencia guardada — Junta notificada con ${ausentes.length} ausente(s)`)
        } else { notify('Asistencia guardada correctamente') }
      } else { notify('Asistencia guardada — todos presentes ✅') }

      setShowAttModal(false); fetchMeetings()
    } catch { notify('Error de conexión', 'error') }
    finally  { setSavingAtt(false) }
  }

  const toggleAll = (present: boolean) => {
    const map: Record<number, boolean> = {}
    selMeeting?.attendances.forEach(a => {
      const pid = a.parent?.id ?? (a as any).parentId
      if (pid !== undefined) map[pid] = present
    })
    setAttendance(map)
  }

  const presentCount = Object.values(attendance).filter(Boolean).length
  const absentCount  = Object.values(attendance).filter(v => !v).length

  const selCourse = courses.find(c => c.id === selCourseId)

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Reuniones</h1>
          <p>Convoca y gestiona reuniones por curso</p>
        </div>
        {selCourseId && (
          <button className="btn-primary" onClick={openModal}><Plus size={16}/> Convocar reunión</button>
        )}
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
        <div className="empty-state"><Users size={40} color="#CBE0F0"/><p>Selecciona un curso para ver sus reuniones</p></div>
      ) : loading ? (
        <div className="center"><div className="spinner"/></div>
      ) : meetings.length === 0 ? (
        <div className="empty-card">
          <Users size={40} color="#CBE0F0"/>
          <p>No hay reuniones para {selCourse ? `${GRADES[selCourse.grade]} "${selCourse.parallel}"` : 'este curso'}</p>
          <button className="btn-primary" onClick={openModal}><Plus size={14}/> Convocar primera reunión</button>
        </div>
      ) : (
        <div className="meetings-list">
          {meetings.map(m => {
            const pres   = m.attendances.filter(a => a.present).length
            const aus    = m.attendances.length - pres
            const closed = isAttendanceClosed(m)
            return (
              <div key={m.id} className="meeting-card">
                <div className="meeting-left">
                  <div className="meeting-title">{m.title}</div>
                  <div className="meeting-date">{fmtDate(m.date)}</div>
                </div>
                <div className="meeting-right">
                  <div className="meeting-stats">
                    {m.attendances.length > 0 ? (
                      <><span className="stat-pill green">✅ {pres} presentes</span><span className="stat-pill red">❌ {aus} ausentes</span></>
                    ) : <span className="stat-pill gray">Sin asistencia</span>}
                  </div>
                  <div className="meeting-actions">
                    {!closed && (
                      <>
                        <button className="btn-icon edit" title="Modificar" onClick={() => openEdit(m)}><Edit size={13}/></button>
                        <button className="btn-icon del" title="Cancelar" onClick={() => handleDelete(m)}><Trash2 size={13}/></button>
                      </>
                    )}
                    {closed ? (
                      <div className="btn-closed"><Lock size={13}/> Asistencia cerrada</div>
                    ) : (
                      <button className="btn-att" onClick={() => openAttendance(m)}><ClipboardList size={14}/> Marcar asistencia</button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal nueva reunión */}
      {showModal && (
        <div className="overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="mhead">
              <h2>Convocar Reunión</h2>
              <button onClick={() => setShowModal(false)}><X size={18}/></button>
            </div>
            <div className="mbody">
              {selCourse && (
                <div className="info-box">
                  📚 Curso: <strong>{GRADES[selCourse.grade]} &quot;{selCourse.parallel}&quot; · {SHIFTS[selCourse.shift]}</strong>
                </div>
              )}
              <div className="fg"><label>Título *</label>
                <input type="text" placeholder="Ej: Reunión de padres 1er trimestre..."
                  value={form.title} onChange={e => setForm({...form, title: e.target.value})}/></div>
              <div className="fg"><label>Fecha y hora *</label>
                <input type="datetime-local" value={form.date} onChange={e => setForm({...form, date: e.target.value})}/>
                <span style={{fontSize:'11px',color:'#6B8BB0'}}>Pre-rellena con la fecha y hora actual</span>
              </div>
              <div className="notify-box">
                <label className="checkbox-label">
                  <input type="checkbox" checked={notifyAll} onChange={e => setNotifyAll(e.target.checked)}/>
                  <span><Bell size={13}/> Notificar a los {tutors.length} tutores del curso</span>
                </label>
                {notifyAll && <div className="notify-hint">La notificación llegará como <strong>[Maestro]</strong>.</div>}
              </div>
            </div>
            <div className="mfoot">
              <button className="btn-outline" onClick={() => setShowModal(false)}>Cancelar</button>
              <button className="btn-primary" onClick={handleCreate} disabled={saving}>
                {saving ? <span className="spinsm"/> : notifyAll ? <Send size={14}/> : <Plus size={14}/>}
                {saving ? 'Creando...' : notifyAll ? 'Crear y notificar' : 'Crear reunión'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal editar */}
      {showEditModal && selMeeting && (
        <div className="overlay" onClick={() => setShowEditModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="mhead"><h2>Modificar Reunión</h2><button onClick={() => setShowEditModal(false)}><X size={18}/></button></div>
            <div className="mbody">
              <div className="fg"><label>Título *</label><input type="text" value={editForm.title} onChange={e => setEditForm({...editForm, title: e.target.value})}/></div>
              <div className="fg"><label>Fecha y hora *</label><input type="datetime-local" value={editForm.date} onChange={e => setEditForm({...editForm, date: e.target.value})}/></div>
              <div className="info-box"><Bell size={13}/> Se notificará a los tutores sobre la reprogramación.</div>
            </div>
            <div className="mfoot">
              <button className="btn-outline" onClick={() => setShowEditModal(false)}>Cancelar</button>
              <button className="btn-primary" onClick={handleEdit} disabled={saving}>
                {saving ? <span className="spinsm"/> : <Check size={14}/>}
                {saving ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal asistencia */}
      {showAttModal && selMeeting && (
        <div className="overlay" onClick={() => setShowAttModal(false)}>
          <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
            <div className="mhead">
              <div><h2>Registro de Asistencia</h2><p style={{fontSize:'12px',color:'#6B8BB0',margin:'2px 0 0'}}>{selMeeting.title} · {fmtDate(selMeeting.date)}</p></div>
              <button onClick={() => setShowAttModal(false)}><X size={18}/></button>
            </div>
            <div className="mbody">
              <div style={{display:'flex',gap:'8px',justifyContent:'flex-end'}}>
                <button className="btn-sm-green" onClick={() => toggleAll(true)}><UserCheck size={13}/> Todos presentes</button>
                <button className="btn-sm-red"   onClick={() => toggleAll(false)}><UserX size={13}/> Todos ausentes</button>
              </div>
              <div style={{display:'flex',gap:'10px',flexWrap:'wrap'}}>
                <div className="att-stat green"><strong>{presentCount}</strong> presentes</div>
                <div className="att-stat red"><strong>{absentCount}</strong> ausentes</div>
                <div className="att-stat gray"><strong>{selMeeting.attendances.length}</strong> total</div>
              </div>
              <div className="att-list">
                {selMeeting.attendances.map((a, i) => {
                  const pid     = a.parent?.id ?? (a as any).parentId
                  const present = attendance[pid] ?? a.present
                  return (
                    <div key={i} className={`att-row ${present ? 'present' : 'absent'}`}
                      onClick={() => setAttendance(prev => ({ ...prev, [pid]: !present }))}>
                      <div className="att-num">{i + 1}</div>
                      <div className="att-name">
                        <span>{a.parent.lastName} {a.parent.firstName}</span>
                        {(a.parent as any).ci && <span className="att-ci">CI: {(a.parent as any).ci}</span>}
                      </div>
                      <div className={`att-badge ${present ? 'p' : 'a'}`}>
                        {present ? <><Check size={11}/> Presente</> : <>✕ Ausente</>}
                      </div>
                    </div>
                  )
                })}
              </div>
              {absentCount > 0 && <div className="info-box"><Bell size={13}/> Al guardar se notificará a la <strong>Junta Escolar</strong> con la lista de ausentes.</div>}
              <div className="lock-notice"><Lock size={12}/> Una vez guardada la asistencia quedará cerrada. Solo la Junta puede modificarla.</div>
            </div>
            <div className="mfoot">
              <span style={{fontSize:'12px',color:'#6B8BB0'}}>{presentCount} de {selMeeting.attendances.length} presentes</span>
              <div style={{display:'flex',gap:'8px'}}>
                <button className="btn-outline" onClick={() => setShowAttModal(false)}>Cancelar</button>
                <button className="btn-primary" onClick={handleSaveAttendance} disabled={savingAtt}>
                  {savingAtt ? <span className="spinsm"/> : <Check size={14}/>}
                  {savingAtt ? 'Guardando...' : 'Guardar y cerrar asistencia'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .page-header{display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:24px;gap:16px}
        .page-header h1{font-size:20px;font-weight:700;color:#1565C0;margin-bottom:4px}
        .page-header p{font-size:13px;color:#6B8BB0}
        .alert{padding:10px 14px;border-radius:8px;font-size:13px;margin-bottom:16px}
        .alert.suc{background:#E1F5EE;border:1px solid #9FE1CB;color:#0F6E56}
        .alert.err{background:#FFF0F0;border:1px solid #FFBBBB;color:#C0392B}
        .center{display:flex;justify-content:center;padding:48px;color:#6B8BB0}
        .course-selector{background:#fff;border:1px solid #CBE0F0;border-radius:12px;padding:16px;margin-bottom:16px}
        .selector-label{font-size:11px;font-weight:700;color:#6B8BB0;text-transform:uppercase;letter-spacing:.6px;margin-bottom:10px}
        .course-btns{display:flex;gap:8px;flex-wrap:wrap}
        .course-btn{display:flex;align-items:center;gap:6px;padding:8px 16px;border:1.5px solid #CBE0F0;border-radius:8px;background:#fff;color:#1A3A7C;font-size:13px;font-weight:500;cursor:pointer;transition:all .15s}
        .course-btn:hover{border-color:#1565C0;background:#E3F2FD}
        .course-btn.active{background:#1565C0;color:#fff;border-color:#1565C0}
        .bth{background:rgba(255,255,255,0.2);padding:1px 6px;border-radius:10px;font-size:10px;margin-left:4px}
        .empty-state{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:60px;gap:12px;color:#6B8BB0;font-size:13px;background:#fff;border:1px solid #CBE0F0;border-radius:12px}
        .empty-card{background:#fff;border:1px solid #CBE0F0;border-radius:12px;padding:48px;display:flex;flex-direction:column;align-items:center;gap:12px;color:#6B8BB0;font-size:13px}
        .meetings-list{display:flex;flex-direction:column;gap:12px}
        .meeting-card{background:#fff;border:1px solid #CBE0F0;border-radius:12px;padding:16px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px}
        .meeting-left{flex:1}
        .meeting-title{font-size:15px;font-weight:700;color:#1A3A7C;margin-bottom:4px}
        .meeting-date{font-size:12px;color:#6B8BB0}
        .meeting-right{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
        .meeting-stats{display:flex;gap:8px;flex-wrap:wrap}
        .meeting-actions{display:flex;align-items:center;gap:8px}
        .stat-pill{display:flex;align-items:center;gap:4px;padding:4px 10px;border-radius:20px;font-size:12px;font-weight:500}
        .stat-pill.green{background:#E1F5EE;color:#0F6E56}
        .stat-pill.red{background:#FFF0F0;color:#C0392B}
        .stat-pill.gray{background:#F0F6FC;color:#6B8BB0}
        .btn-att{display:flex;align-items:center;gap:5px;padding:7px 14px;background:#1A3A7C;color:#fff;border:none;border-radius:8px;font-size:12px;font-weight:500;cursor:pointer;white-space:nowrap}
        .btn-att:hover{background:#4A9FD4}
        .btn-closed{display:flex;align-items:center;gap:5px;padding:7px 14px;background:#F0F6FC;color:#6B8BB0;border:1px solid #CBE0F0;border-radius:8px;font-size:12px;font-weight:500;white-space:nowrap}
        .btn-icon{width:30px;height:30px;border:none;border-radius:6px;cursor:pointer;display:flex;align-items:center;justify-content:center}
        .btn-icon.edit{background:#FAEEDA;color:#1565C0}
        .btn-icon.edit:hover{background:#1565C0;color:#fff}
        .btn-icon.del{background:#FFF0F0;color:#C0392B}
        .btn-icon.del:hover{background:#C0392B;color:#fff}
        .overlay{position:fixed;inset:0;background:rgba(0,0,0,0.4);z-index:500;display:flex;align-items:center;justify-content:center;padding:16px}
        .modal{background:#fff;border-radius:14px;width:100%;max-width:440px;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,0.15);max-height:90vh;display:flex;flex-direction:column}
        .modal-lg{max-width:520px}
        .mhead{display:flex;align-items:flex-start;justify-content:space-between;padding:18px 20px;border-bottom:1px solid #CBE0F0;flex-shrink:0;gap:12px}
        .mhead h2{font-size:16px;font-weight:600;color:#1A3A7C;margin:0}
        .mhead button{background:none;border:none;cursor:pointer;color:#6B8BB0;display:flex;padding:4px;border-radius:6px;flex-shrink:0}
        .mhead button:hover{background:#F0F6FC;color:#1A3A7C}
        .mbody{padding:20px;display:flex;flex-direction:column;gap:14px;overflow-y:auto;flex:1}
        .mfoot{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:16px 20px;border-top:1px solid #CBE0F0;flex-shrink:0}
        .fg{display:flex;flex-direction:column;gap:6px}
        .fg label{font-size:11px;font-weight:700;color:#1A3A7C;text-transform:uppercase;letter-spacing:.6px}
        .fg input{padding:10px 12px;border:1.5px solid #CBE0F0;border-radius:8px;font-size:13px;color:#1A3A7C;outline:none;width:100%}
        .fg input:focus{border-color:#4A9FD4;box-shadow:0 0 0 3px rgba(74,159,212,.12)}
        .notify-box{background:#E3F2FD;border:1px solid #F5C518;border-radius:8px;padding:12px;display:flex;flex-direction:column;gap:6px}
        .checkbox-label{display:flex;align-items:center;gap:8px;font-size:13px;color:#1565C0;cursor:pointer;font-weight:500}
        .checkbox-label input{accent-color:#1565C0;width:16px;height:16px;cursor:pointer}
        .notify-hint{font-size:11px;color:#7A4A0A;line-height:1.6}
        .info-box{background:#FFF8E1;border:1px solid #F5C518;border-radius:8px;padding:12px;font-size:12px;color:#7A6000;line-height:1.6;display:flex;align-items:flex-start;gap:8px}
        .lock-notice{background:#F0F6FC;border:1px solid #CBE0F0;border-radius:8px;padding:10px 12px;font-size:11px;color:#6B8BB0;display:flex;align-items:center;gap:6px}
        .btn-sm-green{display:flex;align-items:center;gap:5px;padding:6px 12px;background:#E1F5EE;color:#0F6E56;border:1px solid #9FE1CB;border-radius:6px;font-size:12px;cursor:pointer;font-weight:500}
        .btn-sm-green:hover{background:#0F6E56;color:#fff}
        .btn-sm-red{display:flex;align-items:center;gap:5px;padding:6px 12px;background:#FFF0F0;color:#C0392B;border:1px solid #FFBBBB;border-radius:6px;font-size:12px;cursor:pointer;font-weight:500}
        .btn-sm-red:hover{background:#C0392B;color:#fff}
        .att-stat{display:flex;align-items:center;gap:6px;padding:8px 14px;border-radius:8px;font-size:12px}
        .att-stat.green{background:#E1F5EE;color:#0F6E56}
        .att-stat.red{background:#FFF0F0;color:#C0392B}
        .att-stat.gray{background:#F0F6FC;color:#6B8BB0}
        .att-list{display:flex;flex-direction:column;gap:2px}
        .att-row{display:flex;align-items:center;gap:12px;padding:10px 12px;border-radius:8px;cursor:pointer;transition:all .15s;border:1.5px solid transparent}
        .att-row.present{background:#E1F5EE;border-color:#9FE1CB}
        .att-row.absent{background:#FFF8F8;border-color:#FFD5D5}
        .att-row:hover{opacity:.85}
        .att-num{font-size:11px;color:#6B8BB0;min-width:22px}
        .att-name{flex:1;display:flex;flex-direction:column;gap:2px}
        .att-name span:first-child{font-size:13px;font-weight:500;color:#1A3A7C}
        .att-ci{font-size:11px;color:#6B8BB0}
        .att-badge{display:flex;align-items:center;gap:4px;padding:4px 10px;border-radius:20px;font-size:11px;font-weight:600;white-space:nowrap}
        .att-badge.p{background:#1565C0;color:#fff}
        .att-badge.a{background:#C0392B;color:#fff}
        .btn-primary{display:flex;align-items:center;gap:6px;padding:9px 16px;background:#1565C0;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:500;cursor:pointer;white-space:nowrap}
        .btn-primary:hover:not(:disabled){background:#7A4A0A}
        .btn-primary:disabled{opacity:.6;cursor:not-allowed}
        .btn-outline{display:flex;align-items:center;gap:6px;padding:9px 14px;background:#fff;color:#1A3A7C;border:1.5px solid #CBE0F0;border-radius:8px;font-size:13px;cursor:pointer;white-space:nowrap}
        .btn-outline:hover{background:#F0F6FC}
        .spinner{width:24px;height:24px;border:2px solid rgba(99,56,6,.2);border-top-color:#1565C0;border-radius:50%;animation:spin .7s linear infinite}
        .spinsm{width:14px;height:14px;border:2px solid rgba(255,255,255,.3);border-top-color:#fff;border-radius:50%;animation:spin .7s linear infinite;display:inline-block}
        @keyframes spin{to{transform:rotate(360deg)}}
      `}</style>
    </div>
  )
}