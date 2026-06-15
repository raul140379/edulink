'use client'

import { useEffect, useState } from 'react'
import { LogIn, LogOut, CheckCircle, AlertCircle, Clock, Calendar, ChevronLeft, ChevronRight } from 'lucide-react'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

interface Attendance {
  id:       number
  date:     string
  checkIn:  string | null
  checkOut: string | null
  status:   string
  note:     string | null
}

interface Summary {
  presente: number
  tardanza: number
  ausente:  number
  licencia: number
  total:    number
}

const STATUS_CONFIG: Record<string, {label:string; bg:string; color:string}> = {
  PRESENTE: { label:'Presente',  bg:'#E1F5EE', color:'#0F6E56' },
  TARDANZA: { label:'Tardanza',  bg:'#FFFBEA', color:'#BA7517' },
  AUSENTE:  { label:'Ausente',   bg:'#FFF0F0', color:'#C0392B' },
  LICENCIA: { label:'Licencia',  bg:'#E0ECF8', color:'#1A3A7C' },
}

const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

const fmtTime = (d: string | null) => {
  if (!d) return '—'
  return new Date(d).toLocaleTimeString('es-BO', { hour:'2-digit', minute:'2-digit' })
}
const fmtDate = (d: string) => new Date(d).toLocaleDateString('es-BO', { weekday:'short', day:'2-digit', month:'short' })

export default function AsistenciaPage() {
  const [today,     setToday]     = useState<Attendance | null>(null)
  const [records,   setRecords]   = useState<Attendance[]>([])
  const [summary,   setSummary]   = useState<Summary | null>(null)
  const [loading,   setLoading]   = useState(true)
  const [checking,  setChecking]  = useState(false)
  const [toast,     setToast]     = useState<{type:'ok'|'err'; text:string} | null>(null)
  const [month,     setMonth]     = useState(new Date().getMonth() + 1)
  const [year,      setYear]      = useState(new Date().getFullYear())

  const token = () => localStorage.getItem('token') || ''
  const auth  = () => ({ Authorization: `Bearer ${token()}` })

  const showToast = (type: 'ok'|'err', text: string) => {
    setToast({type, text}); setTimeout(()=>setToast(null), 4000)
  }

  const loadToday = async () => {
    const res  = await fetch(`${API}/api/teacher-attendance/my-today`, { headers: auth() })
    const data = await res.json()
    setToday(data)
  }

  const loadHistory = async () => {
    const res  = await fetch(`${API}/api/teacher-attendance/my-history?month=${month}&year=${year}`, { headers: auth() })
    const data = await res.json()
    setRecords(data.records || [])
    setSummary(data.summary || null)
  }

  useEffect(() => {
    const init = async () => {
      setLoading(true)
      await Promise.all([loadToday(), loadHistory()])
      setLoading(false)
    }
    init()
  }, [])

  useEffect(() => {
    loadHistory()
  }, [month, year])

  const handleCheckIn = async () => {
    setChecking(true)
    try {
      const res  = await fetch(`${API}/api/teacher-attendance/check-in`, { method:'POST', headers: auth() })
      const data = await res.json()
      if (!res.ok) { showToast('err', data.message); return }
      showToast('ok', data.message)
      await loadToday()
      await loadHistory()
    } catch { showToast('err', 'Error de conexión') }
    finally { setChecking(false) }
  }

  const handleCheckOut = async () => {
    setChecking(true)
    try {
      const res  = await fetch(`${API}/api/teacher-attendance/check-out`, { method:'POST', headers: auth() })
      const data = await res.json()
      if (!res.ok) { showToast('err', data.message); return }
      showToast('ok', data.message)
      await loadToday()
      await loadHistory()
    } catch { showToast('err', 'Error de conexión') }
    finally { setChecking(false) }
  }

  const prevMonth = () => {
    if (month === 1) { setMonth(12); setYear(y => y - 1) }
    else setMonth(m => m - 1)
  }
  const nextMonth = () => {
    if (month === 12) { setMonth(1); setYear(y => y + 1) }
    else setMonth(m => m + 1)
  }

  const now = new Date()
  const timeStr = now.toLocaleTimeString('es-BO', { hour:'2-digit', minute:'2-digit' })
  const dateStr = now.toLocaleDateString('es-BO', { weekday:'long', day:'2-digit', month:'long', year:'numeric' })

  const canCheckIn  = !today?.checkIn
  const canCheckOut = !!today?.checkIn && !today?.checkOut

  if (loading) return <div className="center"><div className="spinner"/></div>

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1>Mi Asistencia</h1>
          <p>Registro de entrada y salida · {dateStr}</p>
        </div>
        <div className="time-display">{timeStr}</div>
      </div>

      {/* Toast */}
      {toast && (
        <div className={`alert ${toast.type==='ok'?'suc':'err'}`}>
          {toast.type==='ok'?<CheckCircle size={14}/>:<AlertCircle size={14}/>} {toast.text}
        </div>
      )}

      {/* Estado de hoy */}
      <div className="today-card">
        <div className="today-header">
          <Calendar size={16} color="#633806"/>
          <span>Hoy</span>
          {today && (
            <span className="status-badge" style={{
              background: STATUS_CONFIG[today.status]?.bg,
              color:      STATUS_CONFIG[today.status]?.color,
              marginLeft: 'auto'
            }}>
              {STATUS_CONFIG[today.status]?.label}
            </span>
          )}
        </div>

        <div className="today-times">
          <div className="time-block">
            <div className="time-label"><LogIn size={14} color="#0F6E56"/> Entrada</div>
            <div className="time-value" style={{color: today?.checkIn ? '#0F6E56' : '#6B8BB0'}}>
              {fmtTime(today?.checkIn || null)}
            </div>
          </div>
          <div className="time-divider">→</div>
          <div className="time-block">
            <div className="time-label"><LogOut size={14} color="#C0392B"/> Salida</div>
            <div className="time-value" style={{color: today?.checkOut ? '#C0392B' : '#6B8BB0'}}>
              {fmtTime(today?.checkOut || null)}
            </div>
          </div>
        </div>

        {/* Botones */}
        <div className="action-btns">
          <button
            className="btn-checkin"
            onClick={handleCheckIn}
            disabled={!canCheckIn || checking}>
            <LogIn size={18}/>
            {checking && canCheckIn ? 'Registrando...' : 'Marcar Entrada'}
          </button>
          <button
            className="btn-checkout"
            onClick={handleCheckOut}
            disabled={!canCheckOut || checking}>
            <LogOut size={18}/>
            {checking && canCheckOut ? 'Registrando...' : 'Marcar Salida'}
          </button>
        </div>

        {!today && (
          <p className="hint">No has marcado entrada hoy. Presiona <strong>Marcar Entrada</strong> al llegar.</p>
        )}
        {today?.checkIn && !today?.checkOut && (
          <p className="hint">✅ Entrada registrada. Recuerda marcar tu <strong>salida</strong> al terminar.</p>
        )}
        {today?.checkOut && (
          <p className="hint">✅ Jornada completa registrada. ¡Hasta mañana!</p>
        )}
      </div>

      {/* Resumen del mes */}
      {summary && (
        <div className="stats-grid">
          <div className="stat-card"><div className="stat-num" style={{color:'#0F6E56'}}>{summary.presente}</div><div className="stat-lbl">Presente</div></div>
          <div className="stat-card"><div className="stat-num" style={{color:'#BA7517'}}>{summary.tardanza}</div><div className="stat-lbl">Tardanza</div></div>
          <div className="stat-card"><div className="stat-num" style={{color:'#C0392B'}}>{summary.ausente}</div><div className="stat-lbl">Ausente</div></div>
          <div className="stat-card"><div className="stat-num" style={{color:'#1A3A7C'}}>{summary.licencia}</div><div className="stat-lbl">Licencia</div></div>
          <div className="stat-card"><div className="stat-num" style={{color:'#633806'}}>{summary.total}</div><div className="stat-lbl">Total días</div></div>
        </div>
      )}

      {/* Historial */}
      <div className="history-card">
        <div className="history-header">
          <button className="nav-btn" onClick={prevMonth}><ChevronLeft size={16}/></button>
          <span className="month-label">{MONTHS[month-1]} {year}</span>
          <button className="nav-btn" onClick={nextMonth}><ChevronRight size={16}/></button>
        </div>

        {records.length === 0 ? (
          <div className="empty"><Clock size={32} color="#CBE0F0"/><p>Sin registros en {MONTHS[month-1]}</p></div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th style={{textAlign:'center'}}>Estado</th>
                <th style={{textAlign:'center'}}>Entrada</th>
                <th style={{textAlign:'center'}}>Salida</th>
                <th>Observación</th>
              </tr>
            </thead>
            <tbody>
              {records.map(r => {
                const st = STATUS_CONFIG[r.status] || STATUS_CONFIG['AUSENTE']
                return (
                  <tr key={r.id}>
                    <td>{fmtDate(r.date)}</td>
                    <td style={{textAlign:'center'}}>
                      <span className="status-badge" style={{background:st.bg, color:st.color}}>{st.label}</span>
                    </td>
                    <td style={{textAlign:'center', color:'#0F6E56', fontWeight:600}}>{fmtTime(r.checkIn)}</td>
                    <td style={{textAlign:'center', color:'#C0392B', fontWeight:600}}>{fmtTime(r.checkOut)}</td>
                    <td className="muted">{r.note || '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      <style>{`
        .page-header{display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:24px;flex-wrap:wrap;gap:12px}
        .page-header h1{font-size:20px;font-weight:700;color:#633806;margin-bottom:4px}
        .page-header p{font-size:12px;color:#6B8BB0;text-transform:capitalize}
        .time-display{font-size:32px;font-weight:800;color:#633806;font-variant-numeric:tabular-nums}
        .alert{display:flex;align-items:center;gap:8px;padding:10px 14px;border-radius:8px;font-size:13px;margin-bottom:16px}
        .alert.suc{background:#E1F5EE;border:1px solid #9FE1CB;color:#0F6E56}
        .alert.err{background:#FFF0F0;border:1px solid #FFBBBB;color:#C0392B}
        .today-card{background:#fff;border:1px solid #CBE0F0;border-radius:14px;padding:24px;margin-bottom:20px}
        .today-header{display:flex;align-items:center;gap:8px;font-size:14px;font-weight:700;color:#633806;margin-bottom:20px}
        .today-times{display:flex;align-items:center;gap:24px;margin-bottom:24px;justify-content:center}
        .time-block{text-align:center}
        .time-label{display:flex;align-items:center;justify-content:center;gap:4px;font-size:12px;color:#6B8BB0;margin-bottom:6px}
        .time-value{font-size:28px;font-weight:800;font-variant-numeric:tabular-nums}
        .time-divider{font-size:20px;color:#CBE0F0;margin-top:12px}
        .action-btns{display:flex;gap:12px;justify-content:center;margin-bottom:16px}
        .btn-checkin{display:flex;align-items:center;gap:8px;padding:12px 28px;background:#0F6E56;color:#fff;border:none;border-radius:10px;font-size:15px;font-weight:600;cursor:pointer;transition:all .2s}
        .btn-checkin:hover:not(:disabled){background:#0A5A45}
        .btn-checkin:disabled{opacity:.4;cursor:not-allowed}
        .btn-checkout{display:flex;align-items:center;gap:8px;padding:12px 28px;background:#C0392B;color:#fff;border:none;border-radius:10px;font-size:15px;font-weight:600;cursor:pointer;transition:all .2s}
        .btn-checkout:hover:not(:disabled){background:#A93226}
        .btn-checkout:disabled{opacity:.4;cursor:not-allowed}
        .hint{font-size:12px;color:#6B8BB0;text-align:center}
        .status-badge{padding:3px 10px;border-radius:20px;font-size:11px;font-weight:600;display:inline-block}
        .stats-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:10px;margin-bottom:20px}
        .stat-card{background:#fff;border:1px solid #CBE0F0;border-radius:10px;padding:14px;text-align:center}
        .stat-num{font-size:26px;font-weight:800}
        .stat-lbl{font-size:11px;color:#6B8BB0;margin-top:3px}
        .history-card{background:#fff;border:1px solid #CBE0F0;border-radius:12px;overflow:hidden}
        .history-header{display:flex;align-items:center;justify-content:space-between;padding:14px 18px;border-bottom:1px solid #F0F6FC}
        .nav-btn{background:#F0F6FC;border:none;border-radius:8px;width:32px;height:32px;display:flex;align-items:center;justify-content:center;cursor:pointer;color:#1A3A7C}
        .nav-btn:hover{background:#CBE0F0}
        .month-label{font-size:15px;font-weight:700;color:#633806}
        .empty{display:flex;flex-direction:column;align-items:center;gap:10px;padding:40px;color:#6B8BB0;font-size:13px}
        table{width:100%;border-collapse:collapse}
        thead tr{background:#F0F6FC}
        th{padding:10px 14px;text-align:left;font-size:11px;font-weight:600;color:#1A3A7C;text-transform:uppercase;letter-spacing:.5px}
        td{padding:11px 14px;font-size:13px;color:#1A3A7C;border-top:1px solid #F0F6FC}
        tr:hover td{background:#FAFCFF}
        .muted{color:#6B8BB0;font-size:12px}
        .center{display:flex;justify-content:center;padding:48px}
        .spinner{width:24px;height:24px;border:2px solid rgba(99,56,6,.2);border-top-color:#633806;border-radius:50%;animation:spin .7s linear infinite}
        @keyframes spin{to{transform:rotate(360deg)}}
        @media(max-width:600px){.stats-grid{grid-template-columns:repeat(3,1fr)}.action-btns{flex-direction:column}.today-times{gap:16px}}
      `}</style>
    </div>
  )
}