'use client'

import { useState, useEffect, useRef } from 'react'
import { LogIn, LogOut, CheckCircle, AlertCircle, Clock } from 'lucide-react'
import Link from 'next/link'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

interface Result {
  type:    'ok' | 'err'
  message: string
  teacher?: string
  time?:   string
}

export default function AsistenciaPublicaPage() {
  const [code,    setCode]    = useState('')
  const [loading, setLoading] = useState(false)
  const [result,  setResult]  = useState<Result | null>(null)
  const [time,    setTime]    = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  // Reloj en tiempo real
  useEffect(() => {
    const update = () => setTime(new Date().toLocaleTimeString('es-BO', { hour:'2-digit', minute:'2-digit', second:'2-digit' }))
    update()
    const interval = setInterval(update, 1000)
    return () => clearInterval(interval)
  }, [])

  // Auto-limpiar resultado después de 5 segundos
  useEffect(() => {
    if (result) {
      const t = setTimeout(() => {
        setResult(null)
        setCode('')
        inputRef.current?.focus()
      }, 5000)
      return () => clearTimeout(t)
    }
  }, [result])

  const handleAction = async (action: 'check-in' | 'check-out') => {
    if (!code.trim()) { inputRef.current?.focus(); return }
    setLoading(true)
    try {
      const res  = await fetch(`${API}/api/teacher-attendance/public/${action}`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ code: code.trim().toUpperCase() })
      })
      const data = await res.json()
      setResult({
        type:    res.ok ? 'ok' : 'err',
        message: data.message,
        teacher: data.teacher ? `${data.teacher.lastName} ${data.teacher.firstName}` : undefined,
      })
    } catch {
      setResult({ type:'err', message:'Error de conexión. Intenta nuevamente.' })
    } finally { setLoading(false) }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleAction('check-in')
  }

  const dateStr = new Date().toLocaleDateString('es-BO', {
    weekday:'long', day:'2-digit', month:'long', year:'numeric'
  })

  return (
    <div className="root">
      {/* Header */}
      <div className="header">
        <div className="logo-area">
          <div className="logo-circle">🏫</div>
          <div>
            <div className="school-name">U.E. Naciones Unidas</div>
            <div className="school-sub">El Torno, Santa Cruz — Bolivia</div>
          </div>
        </div>
        <Link href="/login" className="back-link">← Ir al sistema</Link>
      </div>

      {/* Main */}
      <div className="main">
        {/* Reloj */}
        <div className="clock-card">
          <div className="clock-time">{time}</div>
          <div className="clock-date" style={{textTransform:'capitalize'}}>{dateStr}</div>
        </div>

        {/* Resultado */}
        {result && (
          <div className={`result-card ${result.type}`}>
            <div className="result-icon">
              {result.type==='ok' ? <CheckCircle size={40}/> : <AlertCircle size={40}/>}
            </div>
            <div className="result-message">{result.message}</div>
            <div className="result-hint">Esta pantalla se limpiará automáticamente en 5 segundos...</div>
          </div>
        )}

        {/* Formulario */}
        {!result && (
          <div className="form-card">
            <div className="form-title">
              <Clock size={20} color="#633806"/>
              Control de Asistencia — Maestros
            </div>

            <div className="form-group">
              <label className="form-label">Código de Asistencia</label>
              <input
                ref={inputRef}
                type="text"
                value={code}
                onChange={e => setCode(e.target.value.toUpperCase())}
                onKeyDown={handleKeyDown}
                placeholder="Ingresa tu código"
                className="code-input"
                autoFocus
                autoComplete="off"
                maxLength={10}
              />
              <p className="form-hint">Ingresa el código asignado por la dirección</p>
            </div>

            <div className="action-btns">
              <button
                className="btn-checkin"
                onClick={()=>handleAction('check-in')}
                disabled={loading || !code.trim()}>
                <LogIn size={20}/>
                {loading ? 'Registrando...' : 'Marcar Entrada'}
              </button>
              <button
                className="btn-checkout"
                onClick={()=>handleAction('check-out')}
                disabled={loading || !code.trim()}>
                <LogOut size={20}/>
                {loading ? 'Registrando...' : 'Marcar Salida'}
              </button>
            </div>
          </div>
        )}
      </div>

      <style>{`
        * { margin:0; padding:0; box-sizing:border-box; }
        .root { min-height:100vh; background:linear-gradient(135deg,#1A3A7C 0%,#633806 100%); display:flex; flex-direction:column; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; }
        .header { display:flex; align-items:center; justify-content:space-between; padding:16px 32px; background:rgba(0,0,0,.2); }
        .logo-area { display:flex; align-items:center; gap:12px; }
        .logo-circle { width:44px; height:44px; background:#fff; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:22px; flex-shrink:0; }
        .school-name { font-size:15px; font-weight:700; color:#fff; }
        .school-sub { font-size:11px; color:rgba(255,255,255,.7); }
        .back-link { font-size:13px; color:rgba(255,255,255,.8); text-decoration:none; padding:6px 14px; border:1px solid rgba(255,255,255,.3); border-radius:8px; }
        .back-link:hover { background:rgba(255,255,255,.1); }
        .main { flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; padding:32px 16px; gap:24px; }
        .clock-card { text-align:center; }
        .clock-time { font-size:64px; font-weight:800; color:#fff; font-variant-numeric:tabular-nums; line-height:1; letter-spacing:-2px; }
        .clock-date { font-size:16px; color:rgba(255,255,255,.8); margin-top:8px; }
        .result-card { background:#fff; border-radius:20px; padding:40px; text-align:center; max-width:480px; width:100%; box-shadow:0 20px 60px rgba(0,0,0,.3); }
        .result-card.ok .result-icon { color:#0F6E56; }
        .result-card.err .result-icon { color:#C0392B; }
        .result-icon { display:flex; justify-content:center; margin-bottom:16px; }
        .result-message { font-size:18px; font-weight:700; color:#1A3A7C; margin-bottom:12px; line-height:1.4; }
        .result-hint { font-size:12px; color:#6B8BB0; }
        .form-card { background:#fff; border-radius:20px; padding:36px; max-width:480px; width:100%; box-shadow:0 20px 60px rgba(0,0,0,.3); }
        .form-title { display:flex; align-items:center; gap:10px; font-size:16px; font-weight:700; color:#633806; margin-bottom:28px; justify-content:center; }
        .form-group { margin-bottom:24px; }
        .form-label { display:block; font-size:12px; font-weight:700; color:#1A3A7C; text-transform:uppercase; letter-spacing:.6px; margin-bottom:8px; }
        .code-input { width:100%; padding:16px; border:2px solid #CBE0F0; border-radius:12px; font-size:24px; font-weight:800; text-align:center; letter-spacing:4px; color:#1A3A7C; outline:none; transition:border .2s; }
        .code-input:focus { border-color:#633806; box-shadow:0 0 0 4px rgba(99,56,6,.1); }
        .form-hint { font-size:12px; color:#6B8BB0; text-align:center; margin-top:8px; }
        .action-btns { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
        .btn-checkin { display:flex; align-items:center; justify-content:center; gap:8px; padding:14px; background:#0F6E56; color:#fff; border:none; border-radius:12px; font-size:15px; font-weight:700; cursor:pointer; transition:all .2s; }
        .btn-checkin:hover:not(:disabled) { background:#0A5A45; transform:translateY(-1px); }
        .btn-checkin:disabled { opacity:.4; cursor:not-allowed; }
        .btn-checkout { display:flex; align-items:center; justify-content:center; gap:8px; padding:14px; background:#C0392B; color:#fff; border:none; border-radius:12px; font-size:15px; font-weight:700; cursor:pointer; transition:all .2s; }
        .btn-checkout:hover:not(:disabled) { background:#A93226; transform:translateY(-1px); }
        .btn-checkout:disabled { opacity:.4; cursor:not-allowed; }
        @media(max-width:500px) { .clock-time{font-size:48px} .action-btns{grid-template-columns:1fr} .form-card{padding:24px} }
      `}</style>
    </div>
  )
}