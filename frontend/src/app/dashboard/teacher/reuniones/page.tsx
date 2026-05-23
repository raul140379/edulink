'use client'

import { useEffect, useState } from 'react'
import { Plus, X, Users, Bell, Send } from 'lucide-react'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

interface Parent {
  id: number; firstName: string; lastName: string; phone?: string
}

interface Attendance {
  present: boolean
  parent:  { firstName: string; lastName: string }
}

interface Meeting {
  id:          number
  title:       string
  date:        string
  attendances: Attendance[]
}

const fmtDate = (d: string) => new Date(d).toLocaleDateString('es-BO', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })

export default function TeacherReunionesPage() {
  const [meetings,  setMeetings]  = useState<Meeting[]>([])
  const [tutors,    setTutors]    = useState<Parent[]>([])
  const [loading,   setLoading]   = useState(true)
  const [saving,    setSaving]    = useState(false)
  const [success,   setSuccess]   = useState('')
  const [error,     setError]     = useState('')
  const [showModal, setShowModal] = useState(false)
  const [form,      setForm]      = useState({ title: '', date: '' })
  const [notifyAll, setNotifyAll] = useState(false)

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : ''

  const notify = (msg: string, type: 'success' | 'error' = 'success') => {
    if (type === 'success') { setSuccess(msg); setTimeout(() => setSuccess(''), 3000) }
    else                    { setError(msg);   setTimeout(() => setError(''),   4000) }
  }

  const fetchData = async () => {
    setLoading(true)
    try {
      const [cRes, mRes] = await Promise.all([
        fetch(`${API_URL}/api/teachers/my-course`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_URL}/api/meetings`,            { headers: { Authorization: `Bearer ${token}` } }),
      ])
      const [cData, mData] = await Promise.all([cRes.json(), mRes.json()])

      if (cRes.ok) {
        // Extraer tutores únicos
        const tutorMap = new Map<number, Parent>()
        cData.assignments?.forEach((a: any) => {
          a.student.parents?.forEach((ps: any) => {
            if (ps.isTutor && !tutorMap.has(ps.parent.id)) {
              tutorMap.set(ps.parent.id, ps.parent)
            }
          })
        })
        setTutors(Array.from(tutorMap.values()))
      }
      if (mRes.ok) setMeetings(mData)
    } catch { notify('Error de conexión', 'error') }
    finally  { setLoading(false) }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchData() }, [])

  const handleCreate = async () => {
    if (!form.title || !form.date) { notify('Título y fecha son requeridos', 'error'); return }
    setSaving(true)
    try {
      // Crear reunión
      const res  = await fetch(`${API_URL}/api/meetings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) { notify(data.message, 'error'); return }

      // Si notifyAll, enviar notificación a todos los tutores
      if (notifyAll && tutors.length > 0) {
        await fetch(`${API_URL}/api/notifications/send-bulk`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            parentIds: tutors.map(t => t.id),
            title:     `Convocatoria: ${form.title}`,
            message:   `Estimado tutor, se le convoca a la reunión "${form.title}" programada para el ${new Date(form.date).toLocaleDateString('es-BO')}.`,
            type:      'REUNION',
          }),
        })
        notify(`Reunión creada y notificación enviada a ${tutors.length} tutores`)
      } else {
        notify(data.message)
      }

      setShowModal(false)
      setForm({ title: '', date: '' })
      setNotifyAll(false)
      fetchData()
    } catch { notify('Error de conexión', 'error') }
    finally  { setSaving(false) }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Reuniones</h1>
          <p>Convoca y gestiona reuniones de tu curso</p>
        </div>
        <button className="btn-primary" onClick={() => setShowModal(true)}>
          <Plus size={16}/> Convocar reunión
        </button>
      </div>

      {success && <div className="alert suc">{success}</div>}
      {error   && <div className="alert err">{error}</div>}

      {loading ? (
        <div className="center"><div className="spinner"/></div>
      ) : meetings.length === 0 ? (
        <div className="empty-card">
          <Users size={40} color="#CBE0F0"/>
          <p>No hay reuniones registradas</p>
          <button className="btn-primary" onClick={() => setShowModal(true)}>
            <Plus size={14}/> Convocar primera reunión
          </button>
        </div>
      ) : (
        <div className="meetings-list">
          {meetings.map(m => {
            const pres = m.attendances.filter(a => a.present).length
            const aus  = m.attendances.length - pres
            return (
              <div key={m.id} className="meeting-card">
                <div className="meeting-left">
                  <div className="meeting-title">{m.title}</div>
                  <div className="meeting-date">{fmtDate(m.date)}</div>
                </div>
                <div className="meeting-stats">
                  {m.attendances.length > 0 && (
                    <>
                      <span className="stat-pill green">✅ {pres} presentes</span>
                      <span className="stat-pill red">❌ {aus} ausentes</span>
                    </>
                  )}
                  {m.attendances.length === 0 && (
                    <span className="stat-pill gray">Sin asistencia registrada</span>
                  )}
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
              <div className="fg">
                <label>Título *</label>
                <input type="text" placeholder="Ej: Reunión de padres 1er trimestre..."
                  value={form.title} onChange={e => setForm({...form, title: e.target.value})}/>
              </div>
              <div className="fg">
                <label>Fecha y hora *</label>
                <input type="datetime-local" value={form.date}
                  onChange={e => setForm({...form, date: e.target.value})}/>
              </div>
              <div className="notify-box">
                <label className="checkbox-label">
                  <input type="checkbox" checked={notifyAll}
                    onChange={e => setNotifyAll(e.target.checked)}/>
                  <span>
                    <Bell size={13}/> Notificar a los {tutors.length} tutores del curso
                  </span>
                </label>
                {notifyAll && (
                  <div className="notify-hint">
                    Se enviará una notificación interna a cada tutor y podrás contactarlos por WhatsApp.
                  </div>
                )}
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

      <style>{`
        .page-header{display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:24px;gap:16px}
        .page-header h1{font-size:20px;font-weight:700;color:#633806;margin-bottom:4px}
        .page-header p{font-size:13px;color:#6B8BB0}
        .alert{padding:10px 14px;border-radius:8px;font-size:13px;margin-bottom:16px}
        .alert.suc{background:#E1F5EE;border:1px solid #9FE1CB;color:#0F6E56}
        .alert.err{background:#FFF0F0;border:1px solid #FFBBBB;color:#C0392B}
        .center{display:flex;justify-content:center;padding:48px;color:#6B8BB0}
        .empty-card{background:#fff;border:1px solid #CBE0F0;border-radius:12px;padding:48px;display:flex;flex-direction:column;align-items:center;gap:12px;color:#6B8BB0;font-size:13px}
        .meetings-list{display:flex;flex-direction:column;gap:12px}
        .meeting-card{background:#fff;border:1px solid #CBE0F0;border-radius:12px;padding:16px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px}
        .meeting-title{font-size:15px;font-weight:700;color:#1A3A7C;margin-bottom:4px}
        .meeting-date{font-size:12px;color:#6B8BB0}
        .meeting-stats{display:flex;gap:8px;flex-wrap:wrap}
        .stat-pill{display:flex;align-items:center;gap:4px;padding:4px 10px;border-radius:20px;font-size:12px;font-weight:500}
        .stat-pill.green{background:#E1F5EE;color:#0F6E56}
        .stat-pill.red{background:#FFF0F0;color:#C0392B}
        .stat-pill.gray{background:#F0F6FC;color:#6B8BB0}
        .overlay{position:fixed;inset:0;background:rgba(0,0,0,0.4);z-index:500;display:flex;align-items:center;justify-content:center;padding:16px}
        .modal{background:#fff;border-radius:14px;width:100%;max-width:440px;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,0.15)}
        .mhead{display:flex;align-items:center;justify-content:space-between;padding:18px 20px;border-bottom:1px solid #CBE0F0}
        .mhead h2{font-size:16px;font-weight:600;color:#1A3A7C}
        .mhead button{background:none;border:none;cursor:pointer;color:#6B8BB0;display:flex;padding:4px;border-radius:6px}
        .mhead button:hover{background:#F0F6FC;color:#1A3A7C}
        .mbody{padding:20px;display:flex;flex-direction:column;gap:14px}
        .mfoot{display:flex;justify-content:flex-end;gap:10px;padding:16px 20px;border-top:1px solid #CBE0F0}
        .fg{display:flex;flex-direction:column;gap:6px}
        .fg label{font-size:11px;font-weight:700;color:#1A3A7C;text-transform:uppercase;letter-spacing:.6px}
        .fg input{padding:10px 12px;border:1.5px solid #CBE0F0;border-radius:8px;font-size:13px;color:#1A3A7C;outline:none}
        .fg input:focus{border-color:#4A9FD4;box-shadow:0 0 0 3px rgba(74,159,212,.12)}
        .notify-box{background:#FDF0E6;border:1px solid #F5C518;border-radius:8px;padding:12px;display:flex;flex-direction:column;gap:6px}
        .checkbox-label{display:flex;align-items:center;gap:8px;font-size:13px;color:#633806;cursor:pointer;font-weight:500}
        .checkbox-label input{accent-color:#633806;width:16px;height:16px;cursor:pointer}
        .notify-hint{font-size:11px;color:#7A6000;line-height:1.5}
        .btn-primary{display:flex;align-items:center;gap:6px;padding:9px 16px;background:#633806;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:500;cursor:pointer}
        .btn-primary:hover:not(:disabled){background:#7A4A0A}
        .btn-primary:disabled{opacity:.6;cursor:not-allowed}
        .btn-outline{display:flex;align-items:center;gap:6px;padding:9px 14px;background:#fff;color:#1A3A7C;border:1.5px solid #CBE0F0;border-radius:8px;font-size:13px;cursor:pointer}
        .btn-outline:hover{background:#F0F6FC}
        .spinner{width:24px;height:24px;border:2px solid rgba(99,56,6,.2);border-top-color:#633806;border-radius:50%;animation:spin .7s linear infinite}
        .spinsm{width:14px;height:14px;border:2px solid rgba(255,255,255,.3);border-top-color:#fff;border-radius:50%;animation:spin .7s linear infinite;display:inline-block}
        @keyframes spin{to{transform:rotate(360deg)}}
      `}</style>
    </div>
  )
}