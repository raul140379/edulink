'use client'

import { useEffect, useState } from 'react'
import { Plus, X, Calendar, BookOpen, CheckCircle, XCircle, ChevronDown, ChevronUp, Trash2 } from 'lucide-react'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

interface AcademicYear {
  id:        number
  year:      number
  startDate: string
  endDate:   string
  isActive:  boolean
  _count:    { trimesters: number; assignments: number; holidays: number }
}

interface Trimester {
  id:        number
  number:    number
  name:      string
  startDate: string
  endDate:   string
}

interface Holiday {
  id:          number
  date:        string
  description: string
}

export default function GestionPage() {
  const [years, setYears]           = useState<AcademicYear[]>([])
  const [loading, setLoading]       = useState(true)
  const [expanded, setExpanded]     = useState<number | null>(null)
  const [trimesters, setTrimesters] = useState<Record<number, Trimester[]>>({})
  const [holidays, setHolidays]     = useState<Record<number, Holiday[]>>({})
  const [success, setSuccess]       = useState('')
  const [error, setError]           = useState('')

  const [showYearModal, setShowYearModal] = useState(false)
  const [showTrimModal, setShowTrimModal] = useState(false)
  const [showHolModal,  setShowHolModal]  = useState(false)
  const [selectedYear,  setSelectedYear]  = useState<number | null>(null)
  const [saving,        setSaving]        = useState(false)

  const [yearForm, setYearForm] = useState({ year: new Date().getFullYear().toString(), startDate: '', endDate: '' })
  const [trimForm, setTrimForm] = useState({ number: '1', name: '', startDate: '', endDate: '' })
  const [holForm,  setHolForm]  = useState({ date: '', description: '' })

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : ''

  const notify = (msg: string, type: 'success' | 'error' = 'success') => {
    if (type === 'success') setSuccess(msg)
    else setError(msg)
    setTimeout(() => { setSuccess(''); setError('') }, 3000)
  }

  const fetchYears = async () => {
    setLoading(true)
    try {
      const res  = await fetch(`${API_URL}/api/academic`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await res.json()
      if (res.ok) setYears(data)
    } catch { notify('Error al cargar gestiones', 'error') }
    finally  { setLoading(false) }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchYears() }, [])

  const handleExpand = async (yearId: number) => {
    if (expanded === yearId) { setExpanded(null); return }
    setExpanded(yearId)
    if (!trimesters[yearId]) {
      const [tRes, hRes] = await Promise.all([
        fetch(`${API_URL}/api/academic/${yearId}/trimesters`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_URL}/api/academic/${yearId}/holidays`,   { headers: { Authorization: `Bearer ${token}` } }),
      ])
      const [tData, hData] = await Promise.all([tRes.json(), hRes.json()])
      if (tRes.ok) setTrimesters(p => ({ ...p, [yearId]: tData }))
      if (hRes.ok) setHolidays(p  => ({ ...p, [yearId]: hData }))
    }
  }

  const handleCreateYear = async () => {
    setError(''); setSaving(true)
    try {
      const res  = await fetch(`${API_URL}/api/academic`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(yearForm),
      })
      const data = await res.json()
      if (!res.ok) { notify(data.message, 'error'); return }
      notify('Gestión creada correctamente')
      setShowYearModal(false)
      setYearForm({ year: (new Date().getFullYear() + 1).toString(), startDate: '', endDate: '' })
      fetchYears()
    } catch { notify('Error de conexión', 'error') }
    finally  { setSaving(false) }
  }

  const handleToggleYear = async (id: number) => {
    try {
      const res  = await fetch(`${API_URL}/api/academic/${id}/toggle`, {
        method: 'PATCH', headers: { Authorization: `Bearer ${token}` }
      })
      const data = await res.json()
      if (res.ok) { notify(data.message); fetchYears() }
    } catch { notify('Error al cambiar estado', 'error') }
  }

  const handleCreateTrim = async () => {
    if (!selectedYear) return
    setError(''); setSaving(true)
    try {
      const res  = await fetch(`${API_URL}/api/academic/${selectedYear}/trimesters`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(trimForm),
      })
      const data = await res.json()
      if (!res.ok) { notify(data.message, 'error'); return }
      notify('Trimestre creado')
      setShowTrimModal(false)
      setTrimForm({ number: '1', name: '', startDate: '', endDate: '' })
      const tRes  = await fetch(`${API_URL}/api/academic/${selectedYear}/trimesters`, { headers: { Authorization: `Bearer ${token}` } })
      const tData = await tRes.json()
      if (tRes.ok) setTrimesters(p => ({ ...p, [selectedYear]: tData }))
    } catch { notify('Error de conexión', 'error') }
    finally  { setSaving(false) }
  }

  const handleCreateHol = async () => {
    if (!selectedYear) return
    setError(''); setSaving(true)
    try {
      const res  = await fetch(`${API_URL}/api/academic/${selectedYear}/holidays`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(holForm),
      })
      const data = await res.json()
      if (!res.ok) { notify(data.message, 'error'); return }
      notify('Feriado registrado')
      setShowHolModal(false)
      setHolForm({ date: '', description: '' })
      const hRes  = await fetch(`${API_URL}/api/academic/${selectedYear}/holidays`, { headers: { Authorization: `Bearer ${token}` } })
      const hData = await hRes.json()
      if (hRes.ok) setHolidays(p => ({ ...p, [selectedYear]: hData }))
    } catch { notify('Error de conexión', 'error') }
    finally  { setSaving(false) }
  }

  const handleDeleteHol = async (yearId: number, holId: number) => {
    try {
      const res = await fetch(`${API_URL}/api/academic/${yearId}/holidays/${holId}`, {
        method: 'DELETE', headers: { Authorization: `Bearer ${token}` }
      })
      if (res.ok) {
        notify('Feriado eliminado')
        setHolidays(p => ({ ...p, [yearId]: p[yearId].filter(h => h.id !== holId) }))
      }
    } catch { notify('Error al eliminar', 'error') }
  }

  const fmt = (d: string) => new Date(d).toLocaleDateString('es-BO', { day:'2-digit', month:'short', year:'numeric' })

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Gestión Académica</h1>
          <p>Administra los años escolares, trimestres y días feriados</p>
        </div>
        <button className="btn-primary" onClick={() => setShowYearModal(true)}>
          <Plus size={16}/> Nueva gestión
        </button>
      </div>

      {success && <div className="alert suc">{success}</div>}
      {error   && <div className="alert err">{error}</div>}

      {loading ? (
        <div className="center"><div className="spinner"/></div>
      ) : years.length === 0 ? (
        <div className="empty-card">
          <Calendar size={40} color="#CBE0F0"/>
          <p>No hay gestiones registradas</p>
          <button className="btn-primary" onClick={() => setShowYearModal(true)}>
            <Plus size={14}/> Crear primera gestión
          </button>
        </div>
      ) : (
        <div className="years-list">
          {years.map(y => (
            <div key={y.id} className={`year-card ${y.isActive ? 'active-card' : ''}`}>
              <div className="year-header">
                <div className="year-left">
                  <div className={`year-badge ${y.isActive ? 'ybadge-active' : 'ybadge-inactive'}`}>
                    {y.year}
                  </div>
                  <div className="year-info">
                    <div className="year-dates">{fmt(y.startDate)} — {fmt(y.endDate)}</div>
                    <div className="year-counts">
                      <span>📚 {y._count.trimesters} trimestres</span>
                      <span>🎓 {y._count.assignments} inscripciones</span>
                      <span>📅 {y._count.holidays} feriados</span>
                    </div>
                  </div>
                </div>
                <div className="year-actions">
                  {y.isActive
                    ? <span className="active-pill"><CheckCircle size={12}/> Activa</span>
                    : <span className="inactive-pill"><XCircle size={12}/> Inactiva</span>
                  }
                  <button className={`toggle-btn ${y.isActive ? 'tbtn-off' : 'tbtn-on'}`} onClick={() => handleToggleYear(y.id)}>
                    {y.isActive ? 'Desactivar' : 'Activar'}
                  </button>
                  <button className="expand-btn" onClick={() => handleExpand(y.id)}>
                    {expanded === y.id ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
                  </button>
                </div>
              </div>

              {expanded === y.id && (
                <div className="year-detail">
                  <div className="detail-section">
                    <div className="detail-header">
                      <span><BookOpen size={14}/> Trimestres</span>
                      <button className="btn-sm" onClick={() => { setSelectedYear(y.id); setShowTrimModal(true) }}>
                        <Plus size={12}/> Agregar
                      </button>
                    </div>
                    {!trimesters[y.id] || trimesters[y.id].length === 0 ? (
                      <p className="no-data">Sin trimestres registrados</p>
                    ) : (
                      <div className="trim-grid">
                        {trimesters[y.id].map(t => (
                          <div key={t.id} className="trim-card">
                            <div className="trim-num">{t.number}°</div>
                            <div>
                              <div className="trim-name">{t.name}</div>
                              <div className="trim-dates">{fmt(t.startDate)} — {fmt(t.endDate)}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="detail-section">
                    <div className="detail-header">
                      <span><Calendar size={14}/> Días feriados</span>
                      <button className="btn-sm" onClick={() => { setSelectedYear(y.id); setShowHolModal(true) }}>
                        <Plus size={12}/> Agregar
                      </button>
                    </div>
                    {!holidays[y.id] || holidays[y.id].length === 0 ? (
                      <p className="no-data">Sin feriados registrados</p>
                    ) : (
                      <div className="hol-list">
                        {holidays[y.id].map(h => (
                          <div key={h.id} className="hol-item">
                            <span className="hol-date">{fmt(h.date)}</span>
                            <span className="hol-desc">{h.description}</span>
                            <button className="del-btn" onClick={() => handleDeleteHol(y.id, h.id)}><Trash2 size={13}/></button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showYearModal && (
        <div className="overlay" onClick={() => setShowYearModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="mhead"><h2>Nueva Gestión Académica</h2>
              <button onClick={() => setShowYearModal(false)}><X size={18}/></button>
            </div>
            <div className="mbody">
              <div className="fg"><label>Año *</label>
                <input type="number" min="2020" max="2100" value={yearForm.year}
                  onChange={e => setYearForm({...yearForm, year: e.target.value})}/></div>
              <div className="fg"><label>Fecha de inicio *</label>
                <input type="date" value={yearForm.startDate}
                  onChange={e => setYearForm({...yearForm, startDate: e.target.value})}/></div>
              <div className="fg"><label>Fecha de fin *</label>
                <input type="date" value={yearForm.endDate}
                  onChange={e => setYearForm({...yearForm, endDate: e.target.value})}/></div>
            </div>
            <div className="mfoot">
              <button className="btn-outline" onClick={() => setShowYearModal(false)}>Cancelar</button>
              <button className="btn-primary" onClick={handleCreateYear} disabled={saving}>
                {saving ? <span className="spinsm"/> : <Plus size={14}/>}
                {saving ? 'Guardando...' : 'Crear gestión'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showTrimModal && (
        <div className="overlay" onClick={() => setShowTrimModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="mhead"><h2>Agregar Trimestre</h2>
              <button onClick={() => setShowTrimModal(false)}><X size={18}/></button>
            </div>
            <div className="mbody">
              <div className="fg"><label>Número *</label>
                <select value={trimForm.number} onChange={e => setTrimForm({...trimForm, number: e.target.value})}>
                  <option value="1">1° Trimestre</option>
                  <option value="2">2° Trimestre</option>
                  <option value="3">3° Trimestre</option>
                </select></div>
              <div className="fg"><label>Nombre (opcional)</label>
                <input type="text" placeholder="Ej: Primer Trimestre" value={trimForm.name}
                  onChange={e => setTrimForm({...trimForm, name: e.target.value})}/></div>
              <div className="fg"><label>Fecha inicio *</label>
                <input type="date" value={trimForm.startDate}
                  onChange={e => setTrimForm({...trimForm, startDate: e.target.value})}/></div>
              <div className="fg"><label>Fecha fin *</label>
                <input type="date" value={trimForm.endDate}
                  onChange={e => setTrimForm({...trimForm, endDate: e.target.value})}/></div>
            </div>
            <div className="mfoot">
              <button className="btn-outline" onClick={() => setShowTrimModal(false)}>Cancelar</button>
              <button className="btn-primary" onClick={handleCreateTrim} disabled={saving}>
                {saving ? <span className="spinsm"/> : <Plus size={14}/>}
                {saving ? 'Guardando...' : 'Agregar trimestre'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showHolModal && (
        <div className="overlay" onClick={() => setShowHolModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="mhead"><h2>Registrar Día Feriado</h2>
              <button onClick={() => setShowHolModal(false)}><X size={18}/></button>
            </div>
            <div className="mbody">
              <div className="fg"><label>Fecha *</label>
                <input type="date" value={holForm.date}
                  onChange={e => setHolForm({...holForm, date: e.target.value})}/></div>
              <div className="fg"><label>Descripción *</label>
                <input type="text" placeholder="Ej: Día de la Independencia" value={holForm.description}
                  onChange={e => setHolForm({...holForm, description: e.target.value})}/></div>
            </div>
            <div className="mfoot">
              <button className="btn-outline" onClick={() => setShowHolModal(false)}>Cancelar</button>
              <button className="btn-primary" onClick={handleCreateHol} disabled={saving}>
                {saving ? <span className="spinsm"/> : <Plus size={14}/>}
                {saving ? 'Guardando...' : 'Registrar feriado'}
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
        .center{display:flex;justify-content:center;padding:48px}
        .empty-card{background:#fff;border:1px solid #CBE0F0;border-radius:12px;padding:48px;display:flex;flex-direction:column;align-items:center;gap:12px;color:#6B8BB0;font-size:13px}
        .years-list{display:flex;flex-direction:column;gap:12px}
        .year-card{background:#fff;border:1px solid #CBE0F0;border-radius:12px;overflow:hidden}
        .active-card{border-color:#4A9FD4;box-shadow:0 0 0 2px rgba(74,159,212,.15)}
        .year-header{display:flex;align-items:center;justify-content:space-between;padding:16px 20px;gap:16px;flex-wrap:wrap}
        .year-left{display:flex;align-items:center;gap:14px}
        .year-badge{font-size:22px;font-weight:800;padding:8px 14px;border-radius:10px;min-width:80px;text-align:center}
        .ybadge-active{background:#1A3A7C;color:#fff}
        .ybadge-inactive{background:#F0F6FC;color:#6B8BB0}
        .year-info{display:flex;flex-direction:column;gap:4px}
        .year-dates{font-size:13px;font-weight:500;color:#1A3A7C}
        .year-counts{display:flex;gap:12px;font-size:12px;color:#6B8BB0;flex-wrap:wrap}
        .year-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
        .active-pill{display:flex;align-items:center;gap:4px;font-size:11px;font-weight:500;color:#0F6E56;background:#E1F5EE;padding:4px 10px;border-radius:20px}
        .inactive-pill{display:flex;align-items:center;gap:4px;font-size:11px;font-weight:500;color:#6B8BB0;background:#F0F6FC;padding:4px 10px;border-radius:20px}
        .toggle-btn{padding:6px 12px;border:none;border-radius:8px;font-size:12px;font-weight:500;cursor:pointer}
        .tbtn-on{background:#E1F5EE;color:#0F6E56}
        .tbtn-off{background:#FFF0F0;color:#C0392B}
        .expand-btn{background:#F0F6FC;border:none;border-radius:8px;width:32px;height:32px;display:flex;align-items:center;justify-content:center;cursor:pointer;color:#1A3A7C}
        .year-detail{border-top:1px solid #F0F6FC;padding:20px;display:flex;flex-direction:column;gap:20px;background:#FAFCFF}
        .detail-section{display:flex;flex-direction:column;gap:10px}
        .detail-header{display:flex;align-items:center;justify-content:space-between;font-size:13px;font-weight:600;color:#1A3A7C}
        .detail-header span{display:flex;align-items:center;gap:6px}
        .btn-sm{display:flex;align-items:center;gap:4px;padding:5px 10px;background:#1A3A7C;color:#fff;border:none;border-radius:6px;font-size:12px;cursor:pointer}
        .btn-sm:hover{background:#4A9FD4}
        .no-data{font-size:12px;color:#6B8BB0;font-style:italic;padding:8px 0}
        .trim-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px}
        .trim-card{background:#fff;border:1px solid #CBE0F0;border-radius:8px;padding:12px;display:flex;align-items:center;gap:10px}
        .trim-num{font-size:20px;font-weight:800;color:#4A9FD4;min-width:32px;text-align:center}
        .trim-name{font-size:13px;font-weight:500;color:#1A3A7C}
        .trim-dates{font-size:11px;color:#6B8BB0;margin-top:2px}
        .hol-list{display:flex;flex-direction:column;gap:6px}
        .hol-item{display:flex;align-items:center;gap:10px;background:#fff;border:1px solid #CBE0F0;border-radius:8px;padding:10px 12px}
        .hol-date{font-size:12px;font-weight:600;color:#1A3A7C;white-space:nowrap;min-width:110px}
        .hol-desc{flex:1;font-size:13px;color:#1A3A7C}
        .del-btn{background:none;border:none;cursor:pointer;color:#C0392B;display:flex;align-items:center;padding:4px;border-radius:4px}
        .del-btn:hover{background:#FFF0F0}
        .btn-primary{display:flex;align-items:center;gap:6px;padding:9px 16px;background:#1A3A7C;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:500;cursor:pointer;white-space:nowrap}
        .btn-primary:hover:not(:disabled){background:#4A9FD4}
        .btn-primary:disabled{opacity:.6;cursor:not-allowed}
        .btn-outline{display:flex;align-items:center;gap:6px;padding:9px 14px;background:#fff;color:#1A3A7C;border:1.5px solid #CBE0F0;border-radius:8px;font-size:13px;cursor:pointer}
        .btn-outline:hover{background:#F0F6FC}
        .overlay{position:fixed;inset:0;background:rgba(0,0,0,0.4);z-index:500;display:flex;align-items:center;justify-content:center;padding:16px}
        .modal{background:#fff;border-radius:14px;width:100%;max-width:420px;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,0.15)}
        .mhead{display:flex;align-items:center;justify-content:space-between;padding:18px 20px;border-bottom:1px solid #CBE0F0}
        .mhead h2{font-size:16px;font-weight:600;color:#1A3A7C}
        .mhead button{background:none;border:none;cursor:pointer;color:#6B8BB0;display:flex;padding:4px;border-radius:6px}
        .mhead button:hover{background:#F0F6FC;color:#1A3A7C}
        .mbody{padding:20px;display:flex;flex-direction:column;gap:14px}
        .mfoot{display:flex;justify-content:flex-end;gap:10px;padding:16px 20px;border-top:1px solid #CBE0F0}
        .fg{display:flex;flex-direction:column;gap:6px}
        .fg label{font-size:11px;font-weight:700;color:#1A3A7C;text-transform:uppercase;letter-spacing:.6px}
        .fg input,.fg select{padding:10px 12px;border:1.5px solid #CBE0F0;border-radius:8px;font-size:13px;color:#1A3A7C;outline:none}
        .fg input:focus,.fg select:focus{border-color:#4A9FD4;box-shadow:0 0 0 3px rgba(74,159,212,.12)}
        .spinner{width:24px;height:24px;border:2px solid rgba(26,58,124,.2);border-top-color:#1A3A7C;border-radius:50%;animation:spin .7s linear infinite}
        .spinsm{width:14px;height:14px;border:2px solid rgba(255,255,255,.3);border-top-color:#fff;border-radius:50%;animation:spin .7s linear infinite;display:inline-block}
        @keyframes spin{to{transform:rotate(360deg)}}
      `}</style>
    </div>
  )
}