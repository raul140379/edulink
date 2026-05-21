'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, X, Users, CheckCircle, AlertCircle, DollarSign, Trash2 } from 'lucide-react'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

interface Parent {
  id:        number
  firstName: string
  lastName:  string
  ci?:       string
  phone?:    string
}

interface Attendance {
  id:       number
  parentId: number
  present:  boolean
  note?:    string
  parent:   Parent
}

interface Meeting {
  id:          number
  title:       string
  date:        string
  attendances: Attendance[]
}

interface AcademicYear {
  id: number; year: number; isActive: boolean
}

export default function AsistenciaPage() {
  const router = useRouter()
  const [meetings,      setMeetings]      = useState<Meeting[]>([])
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([])
  const [loading,       setLoading]       = useState(true)
  const [success,       setSuccess]       = useState('')
  const [error,         setError]         = useState('')
  const [saving,        setSaving]        = useState(false)

  // Modal nueva reunión
  const [showNewModal,  setShowNewModal]  = useState(false)
  const [newForm,       setNewForm]       = useState({ title: '', date: '' })

  // Reunión activa para tomar asistencia
  const [activeMeeting,   setActiveMeeting]   = useState<Meeting | null>(null)
  const [attendanceState, setAttendanceState] = useState<Record<number, boolean>>({})

  // Modal multar ausentes
  const [showChargeModal, setShowChargeModal] = useState(false)
  const [chargeForm,      setChargeForm]      = useState({ amount: '20', academicYearId: '' })

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : ''

  const notify = (msg: string, type: 'success' | 'error' = 'success') => {
    if (type === 'success') { setSuccess(msg); setTimeout(() => setSuccess(''), 3000) }
    else                    { setError(msg);   setTimeout(() => setError(''),   4000) }
  }

  const fetchData = async () => {
    setLoading(true)
    try {
      const [mRes, yRes] = await Promise.all([
        fetch(`${API_URL}/api/meetings`,  { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_URL}/api/academic`,  { headers: { Authorization: `Bearer ${token}` } }),
      ])
      const [mData, yData] = await Promise.all([mRes.json(), yRes.json()])
      if (mRes.ok) setMeetings(mData)
      if (yRes.ok) {
        setAcademicYears(yData)
        const active = yData.find((y: AcademicYear) => y.isActive)
        if (active) setChargeForm(f => ({ ...f, academicYearId: String(active.id) }))
      }
    } catch { notify('Error de conexión', 'error') }
    finally  { setLoading(false) }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchData() }, [])

  const handleCreateMeeting = async () => {
    if (!newForm.title || !newForm.date) { notify('Título y fecha son requeridos', 'error'); return }
    setSaving(true)
    try {
      const res  = await fetch(`${API_URL}/api/meetings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(newForm),
      })
      const data = await res.json()
      if (!res.ok) { notify(data.message, 'error'); return }
      notify(data.message)
      setShowNewModal(false)
      setNewForm({ title: '', date: '' })
      fetchData()
    } catch { notify('Error de conexión', 'error') }
    finally  { setSaving(false) }
  }

  const openMeeting = (meeting: Meeting) => {
    setActiveMeeting(meeting)
    const state: Record<number, boolean> = {}
    meeting.attendances.forEach(a => { state[a.parentId] = a.present })
    setAttendanceState(state)
  }

  const handleSaveAttendance = async () => {
    if (!activeMeeting) return
    setSaving(true)
    try {
      const attendances = activeMeeting.attendances.map(a => ({
        parentId: a.parentId,
        present:  attendanceState[a.parentId] ?? false,
      }))
      const res  = await fetch(`${API_URL}/api/meetings/${activeMeeting.id}/attendance`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ attendances }),
      })
      const data = await res.json()
      if (!res.ok) { notify(data.message, 'error'); return }
      notify(data.message)
      fetchData()
      setActiveMeeting(null)
    } catch { notify('Error de conexión', 'error') }
    finally  { setSaving(false) }
  }

  const handleChargeAbsences = async () => {
    if (!activeMeeting) return
    if (!chargeForm.amount || !chargeForm.academicYearId) {
      notify('Monto y gestión son requeridos', 'error'); return
    }
    setSaving(true)
    try {
      const res  = await fetch(`${API_URL}/api/meetings/${activeMeeting.id}/charge-absences`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(chargeForm),
      })
      const data = await res.json()
      if (!res.ok) { notify(data.message, 'error'); return }
      notify(data.message)
      setShowChargeModal(false)
    } catch { notify('Error de conexión', 'error') }
    finally  { setSaving(false) }
  }

  const handleDeleteMeeting = async (id: number) => {
    if (!confirm('¿Eliminar esta reunión?')) return
    try {
      const res  = await fetch(`${API_URL}/api/meetings/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await res.json()
      if (res.ok) { notify(data.message); fetchData() }
      else notify(data.message, 'error')
    } catch { notify('Error de conexión', 'error') }
  }

  const fmtDate = (d: string) => new Date(d).toLocaleDateString('es-BO', { day: '2-digit', month: 'long', year: 'numeric' })

  const presentes = activeMeeting
    ? activeMeeting.attendances.filter(a => attendanceState[a.parentId]).length
    : 0
  const ausentes  = activeMeeting
    ? activeMeeting.attendances.length - presentes
    : 0

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Registro de Asistencia</h1>
          <p>Reuniones y asistencia de tutores</p>
        </div>
        <button className="btn-primary" onClick={() => setShowNewModal(true)}>
          <Plus size={16}/> Nueva reunión
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
          <button className="btn-primary" onClick={() => setShowNewModal(true)}>
            <Plus size={14}/> Crear primera reunión
          </button>
        </div>
      ) : (
        <div className="meetings-list">
          {meetings.map(m => {
            const pres = m.attendances.filter(a => a.present).length
            const aus  = m.attendances.length - pres
            return (
              <div key={m.id} className="meeting-card">
                <div className="meeting-header">
                  <div>
                    <div className="meeting-title">{m.title}</div>
                    <div className="meeting-date">{fmtDate(m.date)}</div>
                  </div>
                  <div className="meeting-stats">
                    <span className="stat-pill green"><CheckCircle size={12}/> {pres} presentes</span>
                    <span className="stat-pill red"><AlertCircle size={12}/> {aus} ausentes</span>
                  </div>
                </div>
               <div className="meeting-actions">
  {(() => {
    const diffHours = (new Date().getTime() - new Date(m.date).getTime()) / (1000 * 60 * 60)
    const blocked   = diffHours > 24
    return (
      <button className={`btn-outline ${blocked ? 'blocked' : ''}`}
        onClick={() => !blocked && openMeeting(m)}
        title={blocked ? 'Asistencia bloqueada — más de 24 horas' : 'Tomar asistencia'}
        disabled={blocked}>
        <Users size={13}/> {blocked ? '🔒 Bloqueado' : 'Tomar asistencia'}
      </button>
    )
  })()}
  <button className="btn-danger" onClick={() => handleDeleteMeeting(m.id)}>
    <Trash2 size={13}/>
  </button>
</div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal nueva reunión */}
      {showNewModal && (
        <div className="overlay" onClick={() => setShowNewModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="mhead">
              <h2>Nueva Reunión</h2>
              <button onClick={() => setShowNewModal(false)}><X size={18}/></button>
            </div>
            <div className="mbody">
              <div className="fg"><label>Título *</label>
                <input type="text" placeholder="Ej: Reunión 1er trimestre, Reunión de padres..."
                  value={newForm.title} onChange={e => setNewForm({...newForm, title: e.target.value})}/></div>
              <div className="fg"><label>Fecha *</label>
                <input type="datetime-local" value={newForm.date}
                  onChange={e => setNewForm({...newForm, date: e.target.value})}/></div>
            </div>
            <div className="mfoot">
              <button className="btn-outline" onClick={() => setShowNewModal(false)}>Cancelar</button>
              <button className="btn-primary" onClick={handleCreateMeeting} disabled={saving}>
                {saving ? <span className="spinsm"/> : <Plus size={14}/>}
                {saving ? 'Creando...' : 'Crear reunión'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal tomar asistencia */}
      {activeMeeting && (
        <div className="overlay">
          <div className="modal modal-lg">
            <div className="mhead">
              <div>
                <h2>{activeMeeting.title}</h2>
                <div style={{fontSize:'12px',color:'#6B8BB0'}}>{fmtDate(activeMeeting.date)}</div>
              </div>
              <button onClick={() => setActiveMeeting(null)}><X size={18}/></button>
            </div>
            <div className="mbody">
              <div className="attendance-stats">
                <span className="stat-pill green"><CheckCircle size={12}/> {presentes} presentes</span>
                <span className="stat-pill red"><AlertCircle size={12}/> {ausentes} ausentes</span>
              </div>
              <div className="attendance-list">
                {activeMeeting.attendances.map(a => (
                  <label key={a.parentId} className={`attendance-item ${attendanceState[a.parentId] ? 'present' : 'absent'}`}>
                    <div className="parent-info">
                      <div className="parent-name">{a.parent.lastName} {a.parent.firstName}</div>
                      {a.parent.ci && <div className="parent-ci">CI: {a.parent.ci}</div>}
                    </div>
                    <div className="attendance-toggle">
                      <span className={`toggle-label ${attendanceState[a.parentId] ? 'green' : 'red'}`}>
                        {attendanceState[a.parentId] ? '✅ Presente' : '❌ Ausente'}
                      </span>
                      <input type="checkbox"
                        checked={attendanceState[a.parentId] ?? false}
                        onChange={e => setAttendanceState(prev => ({ ...prev, [a.parentId]: e.target.checked }))}/>
                    </div>
                  </label>
                ))}
              </div>
            </div>
            <div className="mfoot">
              <button className="btn-charge" onClick={() => setShowChargeModal(true)}>
                <DollarSign size={14}/> Multar ausentes ({ausentes})
              </button>
              <button className="btn-outline" onClick={() => setActiveMeeting(null)}>Cancelar</button>
              <button className="btn-primary" onClick={handleSaveAttendance} disabled={saving}>
                {saving ? <span className="spinsm"/> : <CheckCircle size={14}/>}
                {saving ? 'Guardando...' : 'Guardar asistencia'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal multar ausentes */}
      {showChargeModal && activeMeeting && (
        <div className="overlay" style={{zIndex:600}}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="mhead">
              <h2>Multar Ausentes</h2>
              <button onClick={() => setShowChargeModal(false)}><X size={18}/></button>
            </div>
            <div className="mbody">
              <div className="info-box">
                Se creará una multa de <strong>Multa Reunión</strong> para los <strong>{ausentes} ausentes</strong> de la reunión <strong>{activeMeeting.title}</strong>.
              </div>
              <div className="fg"><label>Monto de la multa (Bs.) *</label>
                <input type="number" step="0.01" min="0" value={chargeForm.amount}
                  onChange={e => setChargeForm({...chargeForm, amount: e.target.value})}/></div>
              <div className="fg"><label>Gestión *</label>
                <select value={chargeForm.academicYearId}
                  onChange={e => setChargeForm({...chargeForm, academicYearId: e.target.value})}>
                  <option value="">Selecciona gestión</option>
                  {academicYears.map(y => (
                    <option key={y.id} value={y.id}>{y.year}{y.isActive ? ' (Activa)' : ''}</option>
                  ))}
                </select></div>
            </div>
            <div className="mfoot">
              <button className="btn-outline" onClick={() => setShowChargeModal(false)}>Cancelar</button>
              <button className="btn-primary" onClick={handleChargeAbsences} disabled={saving}>
                {saving ? <span className="spinsm"/> : <DollarSign size={14}/>}
                {saving ? 'Multando...' : `Multar ${ausentes} ausentes`}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .page-header{display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:24px;gap:16px}
        .page-header h1{font-size:20px;font-weight:700;color:#1A3A7C;margin-bottom:4px}
        .page-header p{font-size:13px;color:#6B8BB0}
        .alert{padding:10px 14px;border-radius:8px;font-size:13px;margin-bottom:16px}
        .alert.suc{background:#E1F5EE;border:1px solid #9FE1CB;color:#0F6E56}
        .alert.err{background:#FFF0F0;border:1px solid #FFBBBB;color:#C0392B}
        .center{display:flex;justify-content:center;align-items:center;padding:48px;color:#6B8BB0}
        .empty-card{background:#fff;border:1px solid #CBE0F0;border-radius:12px;padding:48px;display:flex;flex-direction:column;align-items:center;gap:12px;color:#6B8BB0;font-size:13px}
        .meetings-list{display:flex;flex-direction:column;gap:12px}
        .meeting-card{background:#fff;border:1px solid #CBE0F0;border-radius:12px;padding:16px}
        .meeting-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;flex-wrap:wrap;gap:8px}
        .meeting-title{font-size:15px;font-weight:700;color:#1A3A7C;margin-bottom:4px}
        .meeting-date{font-size:12px;color:#6B8BB0}
        .meeting-stats{display:flex;gap:8px;flex-wrap:wrap}
        .stat-pill{display:flex;align-items:center;gap:4px;padding:4px 10px;border-radius:20px;font-size:12px;font-weight:500}
        .stat-pill.green{background:#E1F5EE;color:#0F6E56}
        .stat-pill.red{background:#FFF0F0;color:#C0392B}
        .meeting-actions{display:flex;gap:8px}
        .attendance-stats{display:flex;gap:8px;margin-bottom:12px}
        .attendance-list{display:flex;flex-direction:column;gap:6px;max-height:400px;overflow-y:auto}
        .attendance-item{display:flex;align-items:center;justify-content:space-between;padding:12px;border-radius:8px;border:1.5px solid #CBE0F0;cursor:pointer;transition:all .15s}
        .attendance-item.present{background:#E1F5EE;border-color:#9FE1CB}
        .attendance-item.absent{background:#FFF8F8;border-color:#FFBBBB}
        .parent-info{flex:1}
        .parent-name{font-size:13px;font-weight:500;color:#1A3A7C}
        .parent-ci{font-size:11px;color:#6B8BB0}
        .attendance-toggle{display:flex;align-items:center;gap:10px}
        .toggle-label{font-size:12px;font-weight:500}
        .toggle-label.green{color:#0F6E56}
        .toggle-label.red{color:#C0392B}
        .attendance-toggle input{width:18px;height:18px;accent-color:#0F6E56;cursor:pointer}
        .overlay{position:fixed;inset:0;background:rgba(0,0,0,0.4);z-index:500;display:flex;align-items:center;justify-content:center;padding:16px}
        .modal{background:#fff;border-radius:14px;width:100%;max-width:440px;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,0.15);max-height:90vh;display:flex;flex-direction:column}
        .modal-lg{max-width:560px}
        .mhead{display:flex;align-items:flex-start;justify-content:space-between;padding:18px 20px;border-bottom:1px solid #CBE0F0;flex-shrink:0}
        .mhead h2{font-size:16px;font-weight:600;color:#1A3A7C}
        .mhead button{background:none;border:none;cursor:pointer;color:#6B8BB0;display:flex;padding:4px;border-radius:6px;flex-shrink:0}
        .mhead button:hover{background:#F0F6FC;color:#1A3A7C}
        .mbody{padding:20px;display:flex;flex-direction:column;gap:14px;overflow-y:auto;flex:1}
        .mfoot{display:flex;justify-content:flex-end;gap:10px;padding:16px 20px;border-top:1px solid #CBE0F0;flex-shrink:0;flex-wrap:wrap}
        .fg{display:flex;flex-direction:column;gap:6px}
        .fg label{font-size:11px;font-weight:700;color:#1A3A7C;text-transform:uppercase;letter-spacing:.6px}
        .fg input,.fg select{padding:10px 12px;border:1.5px solid #CBE0F0;border-radius:8px;font-size:13px;color:#1A3A7C;outline:none}
        .fg input:focus,.fg select:focus{border-color:#4A9FD4;box-shadow:0 0 0 3px rgba(74,159,212,.12)}
        .info-box{background:#F0F6FC;border:1px solid #CBE0F0;border-radius:8px;padding:12px;font-size:13px;color:#6B8BB0;line-height:1.6}
        .btn-primary{display:flex;align-items:center;gap:6px;padding:9px 16px;background:#1A3A7C;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:500;cursor:pointer;white-space:nowrap}
        .btn-primary:hover:not(:disabled){background:#4A9FD4}
        .btn-primary:disabled{opacity:.6;cursor:not-allowed}
        .btn-outline{display:flex;align-items:center;gap:6px;padding:9px 14px;background:#fff;color:#1A3A7C;border:1.5px solid #CBE0F0;border-radius:8px;font-size:13px;cursor:pointer;white-space:nowrap}
        .btn-outline:hover{background:#F0F6FC}
        .btn-charge{display:flex;align-items:center;gap:6px;padding:9px 14px;background:#FFF0F0;color:#C0392B;border:1.5px solid #FFBBBB;border-radius:8px;font-size:13px;cursor:pointer;white-space:nowrap}
        .btn-charge:hover{background:#FFE0E0}
        .btn-danger{display:flex;align-items:center;gap:5px;padding:8px 10px;background:#FFF0F0;color:#C0392B;border:1px solid #FFBBBB;border-radius:7px;font-size:12px;cursor:pointer}
        .btn-danger:hover{background:#FFE0E0}
        .spinner{width:24px;height:24px;border:2px solid rgba(26,58,124,.2);border-top-color:#1A3A7C;border-radius:50%;animation:spin .7s linear infinite}
        .spinsm{width:14px;height:14px;border:2px solid rgba(255,255,255,.3);border-top-color:#fff;border-radius:50%;animation:spin .7s linear infinite;display:inline-block}
        @keyframes spin{to{transform:rotate(360deg)}}
        .btn-outline.blocked{opacity:.5;cursor:not-allowed;background:#F0F6FC}
      `}</style>
    </div>
  )
}