'use client'

import { useEffect, useState } from 'react'
import { Bell, Send, MessageCircle, X, CheckCircle } from 'lucide-react'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

interface Parent {
  id:        number
  firstName: string
  lastName:  string
  phone?:    string
  ci?:       string
}

interface Student {
  id:        number
  firstName: string
  lastName:  string
  parents:   { isTutor: boolean; parent: Parent }[]
}

interface SentNotification {
  id:        number
  title:     string
  message:   string
  type:      string
  isRead:    boolean
  createdAt: string
  parent:    { firstName: string; lastName: string; phone?: string }
}

const TYPE_OPTIONS = [
  { value: 'REUNION',   label: '📅 Convocatoria a Reunión' },
  { value: 'ACTIVIDAD', label: '🎯 Actividad Programada'   },
  { value: 'DEUDA',     label: '💰 Recordatorio de Pago'   },
  { value: 'ACADEMICA', label: '📚 Notificación Académica' },
  { value: 'GENERAL',   label: '📢 Comunicado General'     },
]

const fmtDate = (d: string) => new Date(d).toLocaleDateString('es-BO', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })

export default function TeacherNotificacionesPage() {
  const [students,  setStudents]  = useState<Student[]>([])
  const [sent,      setSent]      = useState<SentNotification[]>([])
  const [loading,   setLoading]   = useState(true)
  const [saving,    setSaving]    = useState(false)
  const [success,   setSuccess]   = useState('')
  const [error,     setError]     = useState('')
  const [whatsapp,  setWhatsapp]  = useState<string | null>(null)
  const [form,      setForm]      = useState({
    parentId: '', title: '', message: '', type: 'ACADEMICA'
  })

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : ''

  const notify = (msg: string, type: 'success' | 'error' = 'success') => {
    if (type === 'success') { setSuccess(msg); setTimeout(() => setSuccess(''), 4000) }
    else                    { setError(msg);   setTimeout(() => setError(''),   4000) }
  }

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      try {
        const [cRes, sRes] = await Promise.all([
          fetch(`${API_URL}/api/teachers/my-course`,    { headers: { Authorization: `Bearer ${token}` } }),
          fetch(`${API_URL}/api/notifications/sent`,    { headers: { Authorization: `Bearer ${token}` } }),
        ])
        const [cData, sData] = await Promise.all([cRes.json(), sRes.json()])
        if (cRes.ok) setStudents(cData.assignments?.map((a: any) => a.student) || [])
        if (sRes.ok) setSent(sData)
      } catch { notify('Error de conexión', 'error') }
      finally  { setLoading(false) }
    }
    fetchData()
  }, [])

  const handleSend = async () => {
    if (!form.parentId || !form.title || !form.message) {
      notify('Todos los campos son requeridos', 'error'); return
    }
    setSaving(true); setError('')
    try {
      const res  = await fetch(`${API_URL}/api/notifications/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) { notify(data.message, 'error'); return }
      notify(data.message)
      if (data.whatsapp) setWhatsapp(data.whatsapp)
      setForm({ parentId: '', title: '', message: '', type: 'ACADEMICA' })
      // Recargar enviados
      const sRes = await fetch(`${API_URL}/api/notifications/sent`, { headers: { Authorization: `Bearer ${token}` } })
      const sData = await sRes.json()
      if (sRes.ok) setSent(sData)
    } catch { notify('Error de conexión', 'error') }
    finally  { setSaving(false) }
  }

  // Obtener tutores únicos del curso
  const tutors = new Map<number, Parent>()
  students.forEach(s => {
    s.parents.forEach(ps => {
      if (ps.isTutor && !tutors.has(ps.parent.id)) {
        tutors.set(ps.parent.id, ps.parent)
      }
    })
  })
  const tutorList = Array.from(tutors.values())

  // Encontrar estudiante del tutor seleccionado
  const selectedTutor = tutors.get(parseInt(form.parentId))

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Notificaciones</h1>
          <p>Envía avisos a los tutores de tu curso</p>
        </div>
      </div>

      {success && <div className="alert suc">{success}</div>}
      {error   && <div className="alert err">{error}</div>}

      {/* Modal WhatsApp */}
      {whatsapp && (
        <div className="wa-banner">
          <MessageCircle size={16} color="#25D366"/>
          <span>Notificación enviada. ¿También enviar por WhatsApp?</span>
          <a href={whatsapp} target="_blank" rel="noreferrer" className="wa-btn">
            Abrir WhatsApp
          </a>
          <button className="wa-close" onClick={() => setWhatsapp(null)}><X size={14}/></button>
        </div>
      )}

      <div className="two-cols">
        {/* Formulario */}
        <div className="form-card">
          <div className="section-lbl"><Bell size={14}/> Nueva notificación</div>

          <div className="fg">
            <label>Tutor *</label>
            <select value={form.parentId} onChange={e => setForm({...form, parentId: e.target.value})}>
              <option value="">Selecciona un tutor</option>
              {tutorList.map(p => (
                <option key={p.id} value={p.id}>
                  {p.lastName} {p.firstName}{p.ci ? ` — CI: ${p.ci}` : ''}
                </option>
              ))}
            </select>
            {selectedTutor?.phone && (
              <span className="field-hint">📱 {selectedTutor.phone}</span>
            )}
          </div>

          <div className="fg">
            <label>Tipo *</label>
            <select value={form.type} onChange={e => setForm({...form, type: e.target.value})}>
              {TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          <div className="fg">
            <label>Título *</label>
            <input type="text" placeholder="Ej: Reunión de padres, Tarea pendiente..."
              value={form.title} onChange={e => setForm({...form, title: e.target.value})}/>
          </div>

          <div className="fg">
            <label>Mensaje *</label>
            <textarea rows={4} placeholder="Escribe el mensaje para el tutor..."
              value={form.message} onChange={e => setForm({...form, message: e.target.value})}/>
          </div>

          <button className="btn-primary" onClick={handleSend} disabled={saving}>
            {saving ? <span className="spinsm"/> : <Send size={14}/>}
            {saving ? 'Enviando...' : 'Enviar notificación'}
          </button>
        </div>

        {/* Notificaciones enviadas */}
        <div className="sent-card">
          <div className="section-lbl"><CheckCircle size={14}/> Enviadas ({sent.length})</div>
          {loading ? (
            <div className="center"><div className="spinner"/></div>
          ) : sent.length === 0 ? (
            <div className="no-data">No has enviado notificaciones</div>
          ) : (
            <div className="notif-list">
              {sent.map(n => (
                <div key={n.id} className="notif-item">
                  <div className="notif-header">
                    <span className="notif-type">{TYPE_OPTIONS.find(t => t.value === n.type)?.label || n.type}</span>
                    <span className="notif-date">{fmtDate(n.createdAt)}</span>
                  </div>
                  <div className="notif-title">{n.title}</div>
                  <div className="notif-msg">{n.message}</div>
                  <div className="notif-to">
                    Para: {n.parent.lastName} {n.parent.firstName}
                    {n.parent.phone && (
                      <a href={`https://wa.me/591${n.parent.phone.replace(/\D/g,'')}?text=${encodeURIComponent(`*${n.title}*\n\n${n.message}`)}`}
                        target="_blank" rel="noreferrer" className="wa-mini">
                        <MessageCircle size={11}/> WhatsApp
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <style>{`
        .page-header{display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:24px;gap:16px}
        .page-header h1{font-size:20px;font-weight:700;color:#1565C0;margin-bottom:4px}
        .page-header p{font-size:13px;color:#6B8BB0}
        .alert{padding:10px 14px;border-radius:8px;font-size:13px;margin-bottom:16px}
        .alert.suc{background:#E1F5EE;border:1px solid #9FE1CB;color:#0F6E56}
        .alert.err{background:#FFF0F0;border:1px solid #FFBBBB;color:#C0392B}
        .wa-banner{display:flex;align-items:center;gap:10px;padding:12px 16px;background:#E8FFF0;border:1px solid #25D366;border-radius:10px;margin-bottom:16px;font-size:13px;color:#1A3A7C;flex-wrap:wrap}
        .wa-btn{background:#25D366;color:#fff;padding:5px 12px;border-radius:6px;font-size:12px;text-decoration:none;font-weight:500}
        .wa-btn:hover{background:#1DA851}
        .wa-close{background:none;border:none;cursor:pointer;color:#6B8BB0;margin-left:auto}
        .two-cols{display:grid;grid-template-columns:1fr 1fr;gap:16px}
        .form-card{background:#fff;border:1px solid #CBE0F0;border-radius:12px;padding:20px;display:flex;flex-direction:column;gap:14px}
        .sent-card{background:#fff;border:1px solid #CBE0F0;border-radius:12px;padding:20px;display:flex;flex-direction:column;gap:14px}
        .section-lbl{display:flex;align-items:center;gap:6px;font-size:12px;font-weight:700;color:#1A3A7C;text-transform:uppercase;letter-spacing:.6px;padding-bottom:8px;border-bottom:1px solid #F0F6FC}
        .fg{display:flex;flex-direction:column;gap:6px}
        .fg label{font-size:11px;font-weight:700;color:#1A3A7C;text-transform:uppercase;letter-spacing:.6px}
        .fg input,.fg select,.fg textarea{padding:10px 12px;border:1.5px solid #CBE0F0;border-radius:8px;font-size:13px;color:#1A3A7C;outline:none;font-family:inherit}
        .fg input:focus,.fg select:focus,.fg textarea:focus{border-color:#4A9FD4;box-shadow:0 0 0 3px rgba(74,159,212,.12)}
        .fg textarea{resize:vertical;min-height:80px}
        .field-hint{font-size:11px;color:#6B8BB0}
        .btn-primary{display:flex;align-items:center;justify-content:center;gap:6px;padding:10px 20px;background:#1565C0;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:500;cursor:pointer}
        .btn-primary:hover:not(:disabled){background:#7A4A0A}
        .btn-primary:disabled{opacity:.6;cursor:not-allowed}
        .center{display:flex;justify-content:center;padding:24px}
        .no-data{font-size:13px;color:#6B8BB0;font-style:italic;padding:8px 0}
        .notif-list{display:flex;flex-direction:column;gap:10px;max-height:500px;overflow-y:auto}
        .notif-item{background:#F8FBFF;border:1px solid #CBE0F0;border-radius:8px;padding:12px;display:flex;flex-direction:column;gap:4px}
        .notif-header{display:flex;align-items:center;justify-content:space-between;gap:8px}
        .notif-type{font-size:11px;font-weight:500;background:#E3F2FD;color:#1565C0;padding:2px 8px;border-radius:10px}
        .notif-date{font-size:11px;color:#6B8BB0}
        .notif-title{font-size:13px;font-weight:600;color:#1A3A7C}
        .notif-msg{font-size:12px;color:#6B8BB0;line-height:1.5}
        .notif-to{font-size:11px;color:#4A9FD4;display:flex;align-items:center;gap:8px;flex-wrap:wrap}
        .wa-mini{display:flex;align-items:center;gap:3px;background:#25D366;color:#fff;padding:2px 7px;border-radius:10px;font-size:10px;text-decoration:none}
        .wa-mini:hover{background:#1DA851}
        .spinner{width:20px;height:20px;border:2px solid rgba(99,56,6,.2);border-top-color:#1565C0;border-radius:50%;animation:spin .7s linear infinite}
        .spinsm{width:14px;height:14px;border:2px solid rgba(255,255,255,.3);border-top-color:#fff;border-radius:50%;animation:spin .7s linear infinite;display:inline-block}
        @keyframes spin{to{transform:rotate(360deg)}}
        @media(max-width:768px){.two-cols{grid-template-columns:1fr}}
      `}</style>
    </div>
  )
}