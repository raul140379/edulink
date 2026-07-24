'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { LogIn, LogOut, CheckCircle, AlertCircle } from 'lucide-react'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

export default function LoginPage() {
  const router = useRouter()

  // ── Login ──────────────────────────────────
  const [email,      setEmail]      = useState('')
  const [password,   setPassword]   = useState('')
  const [loginError, setLoginError] = useState('')
  const [loginLoad,  setLoginLoad]  = useState(false)
  const [showPass,   setShowPass]   = useState(false)

  // ── Asistencia ─────────────────────────────
  const [code,      setCode]      = useState('')
  const [attLoad,   setAttLoad]   = useState(false)
  const [attResult, setAttResult] = useState<{type:'ok'|'err'; text:string} | null>(null)
  const [clock,     setClock]     = useState('')
  const codeRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const update = () => setClock(new Date().toLocaleTimeString('es-BO', { hour:'2-digit', minute:'2-digit', second:'2-digit' }))
    update()
    const iv = setInterval(update, 1000)
    return () => clearInterval(iv)
  }, [])

  useEffect(() => {
    if (attResult) {
      const t = setTimeout(() => { setAttResult(null); setCode(''); codeRef.current?.focus() }, 5000)
      return () => clearTimeout(t)
    }
  }, [attResult])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoginError(''); setLoginLoad(true)
    try {
      const res  = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()
      if (!res.ok) { setLoginError(data.message || 'Credenciales incorrectas'); return }
      localStorage.setItem('token', data.token)
      localStorage.setItem('user', JSON.stringify(data.user))
      switch (data.user.role) {
        case 'SUPER_ADMIN': case 'DIRECTOR_DISTRITAL': case 'DIRECTOR': case 'REGENTE': case 'SECRETARY':
          router.push('/dashboard/admin'); break
        case 'TEACHER': case 'TEACHER_TUTOR':
          router.push('/dashboard/plantel-docente'); break
        case 'JUNTA_ESCOLAR': case 'PARENT': case 'DELEGATE':
          router.push('/dashboard/padres'); break
        case 'STUDENT': case 'STUDENT_GOV':
          router.push('/dashboard/estudiantes'); break
        case 'PORTERO':       router.push('/dashboard/portero'); break
        default:              router.push('/dashboard')
      }
    } catch { setLoginError('Error de conexión con el servidor') }
    finally  { setLoginLoad(false) }
  }

  const handleAttendance = async (action: 'check-in' | 'check-out') => {
    if (!code.trim()) { codeRef.current?.focus(); return }
    setAttLoad(true)
    try {
      const res  = await fetch(`${API_URL}/api/teacher-attendance/public/${action}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.trim().toUpperCase() })
      })
      const data = await res.json()
      setAttResult({ type: res.ok ? 'ok' : 'err', text: data.message })
    } catch { setAttResult({ type: 'err', text: 'Error de conexión' }) }
    finally  { setAttLoad(false) }
  }

  const dateStr = new Date().toLocaleDateString('es-BO', { weekday:'long', day:'2-digit', month:'long' })

  return (
    <div className="login-container">

      {/* ── PANEL IZQUIERDO — igual que antes ── */}
      <div className="login-left">
        <div className="left-inner">
          <div className="brand">
            <div className="brand-logo">
              <Image src="/logo-nnuu.jpeg" alt="Logo U.E. Naciones Unidas" width={56} height={56} style={{objectFit:'contain'}}/>
            </div>
            <div className="brand-text">
              <span className="brand-name">U.E. Naciones Unidas</span>
              <span className="brand-sub">El Torno · Santa Cruz · Bolivia</span>
            </div>
          </div>
          <div className="hero-content">
            <div className="hero-badge">EduLink · 2026</div>
            <h1>Educando el<br/><span className="highlight">futuro</span><br/>de Bolivia</h1>
            <p>Plataforma integral para la gestión de estudiantes, padres de familia, maestros y administración de la Unidad Educativa.</p>
          </div>
          <div className="info-pills">
            <div className="pill"><span className="pill-icon">🎓</span><span>Inicial · Primaria · Secundaria</span></div>
            <div className="pill"><span className="pill-icon">🌐</span><span>Regular · BTH</span></div>
            <div className="pill"><span className="pill-icon">🕐</span><span>Mañana · Tarde · Noche</span></div>
          </div>
        </div>
        <div className="bg-deco">
          <div className="deco-ring r1"/><div className="deco-ring r2"/><div className="deco-ring r3"/>
        </div>
      </div>

      {/* ── PANEL DERECHO — dos filas ── */}
      <div className="login-right">

        {/* FILA SUPERIOR — Login */}
        <div className="right-top">
          <div className="card-top">
            <div className="card-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                <circle cx="12" cy="7" r="4"/>
              </svg>
            </div>
            <h2>Iniciar Sesión</h2>
            <p>Ingresa tus credenciales para acceder al sistema</p>
          </div>

          <form onSubmit={handleLogin} className="login-form">
            <div className="field-group">
              <label>Correo electrónico</label>
              <div className="input-wrapper">
                <svg className="input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                  <polyline points="22,6 12,13 2,6"/>
                </svg>
                <input type="email" placeholder="usuario@edulink.com" value={email}
                  onChange={e=>setEmail(e.target.value)} required autoComplete="email"/>
              </div>
            </div>
            <div className="field-group">
              <label>Contraseña</label>
              <div className="input-wrapper">
                <svg className="input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
                <input type={showPass?'text':'password'} placeholder="••••••••" value={password}
                  onChange={e=>setPassword(e.target.value)} required autoComplete="current-password"/>
                <button type="button" className="toggle-pass" onClick={()=>setShowPass(!showPass)} tabIndex={-1}>
                  {showPass
                    ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                    : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>}
                </button>
              </div>
            </div>
            {loginError && (
              <div className="error-msg">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="15" height="15">
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                {loginError}
              </div>
            )}
            <button type="submit" className="btn-login" disabled={loginLoad}>
              {loginLoad ? <span className="spinner"/> : 'Ingresar al sistema'}
            </button>
          </form>
        </div>

        {/* Divisor */}
        <div className="right-divider">
          <div className="div-line"/>
          <span className="div-label">Control de Asistencia · Maestros</span>
          <div className="div-line"/>
        </div>

        {/* FILA INFERIOR — Asistencia */}
        <div className="right-bot">
          {/* Reloj */}
          <div className="clock-area">
            <div className="clock-time">{clock}</div>
            <div className="clock-date" style={{textTransform:'capitalize'}}>{dateStr}</div>
          </div>

          {/* Resultado */}
          {attResult && (
            <div className={`att-result ${attResult.type}`}>
              {attResult.type==='ok' ? <CheckCircle size={22}/> : <AlertCircle size={22}/>}
              <p>{attResult.text}</p>
              <span className="att-hint">Se limpiará en 5 segundos...</span>
            </div>
          )}

          {/* Formulario */}
          {!attResult && (
            <div className="att-form">
              <input
                ref={codeRef}
                type="text"
                value={code}
                onChange={e=>setCode(e.target.value.toUpperCase())}
                onKeyDown={e=>e.key==='Enter'&&handleAttendance('check-in')}
                placeholder="CÓDIGO DE ASISTENCIA"
                className="code-input"
                maxLength={10}
                autoComplete="off"
              />
              <div className="att-btns">
                <button className="btn-in" onClick={()=>handleAttendance('check-in')} disabled={attLoad||!code.trim()}>
                  <LogIn size={15}/> Marcar Entrada
                </button>
                <button className="btn-out" onClick={()=>handleAttendance('check-out')} disabled={attLoad||!code.trim()}>
                  <LogOut size={15}/> Marcar Salida
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`
        *, *::before, *::after { margin:0; padding:0; box-sizing:border-box; }
        .login-container { display:flex; min-height:100vh; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; }

        /* ── Panel izquierdo ── */
        .login-left { flex:1; background:linear-gradient(145deg,#1A3A7C 0%,#0D2352 60%,#1A3A7C 100%); position:relative; overflow:hidden; display:flex; align-items:center; justify-content:center; }
        .left-inner { position:relative; z-index:2; padding:48px; display:flex; flex-direction:column; gap:40px; max-width:500px; width:100%; }
        .brand { display:flex; align-items:center; gap:14px; }
        .brand-logo { width:56px; height:56px; flex-shrink:0; background:#fff; border-radius:50%; padding:4px; display:flex; align-items:center; justify-content:center; overflow:hidden; }
        .brand-text { display:flex; flex-direction:column; gap:2px; }
        .brand-name { font-size:15px; font-weight:700; color:#fff; }
        .brand-sub { font-size:11px; color:rgba(255,255,255,.6); letter-spacing:.5px; }
        .hero-content { display:flex; flex-direction:column; gap:16px; }
        .hero-badge { display:inline-block; background:rgba(245,197,24,.15); border:1px solid rgba(245,197,24,.4); color:#F5C518; font-size:11px; font-weight:600; letter-spacing:1.5px; padding:5px 12px; border-radius:20px; width:fit-content; }
        .hero-content h1 { font-size:48px; font-weight:800; color:#fff; line-height:1.1; letter-spacing:-.5px; }
        .highlight { color:#F5C518; }
        .hero-content p { font-size:14px; color:rgba(255,255,255,.7); line-height:1.7; max-width:360px; }
        .info-pills { display:flex; flex-direction:column; gap:10px; }
        .pill { display:flex; align-items:center; gap:10px; background:rgba(255,255,255,.06); border:1px solid rgba(255,255,255,.1); border-radius:8px; padding:10px 14px; font-size:13px; color:rgba(255,255,255,.7); }
        .pill-icon { font-size:15px; }
        .bg-deco { position:absolute; inset:0; z-index:1; pointer-events:none; }
        .deco-ring { position:absolute; border-radius:50%; border:1px solid rgba(74,159,212,.12); }
        .r1 { width:500px; height:500px; top:-200px; right:-200px; }
        .r2 { width:350px; height:350px; top:-125px; right:-125px; border-color:rgba(245,197,24,.08); }
        .r3 { width:180px; height:180px; top:-40px; right:-40px; background:rgba(245,197,24,.04); }

        /* ── Panel derecho ── */
        .login-right { width:460px; background:#F0F6FC; display:flex; flex-direction:column; }

        /* Fila superior — Login */
        .right-top { flex:1; display:flex; flex-direction:column; justify-content:center; padding:36px 40px; gap:24px; }
        .card-top { display:flex; flex-direction:column; gap:8px; }
        .card-icon { width:44px; height:44px; background:#1A3A7C; border-radius:12px; display:flex; align-items:center; justify-content:center; margin-bottom:4px; }
        .card-icon svg { width:22px; height:22px; stroke:#F5C518; }
        .card-top h2 { font-size:24px; font-weight:700; color:#1A3A7C; }
        .card-top p { font-size:13px; color:#6B8BB0; }
        .login-form { display:flex; flex-direction:column; gap:16px; }
        .field-group { display:flex; flex-direction:column; gap:6px; }
        .field-group label { font-size:11px; font-weight:700; color:#1A3A7C; text-transform:uppercase; letter-spacing:.8px; }
        .input-wrapper { position:relative; display:flex; align-items:center; }
        .input-icon { position:absolute; left:13px; width:15px; height:15px; color:#4A9FD4; pointer-events:none; }
        .input-wrapper input { width:100%; padding:12px 42px 12px 40px; border:1.5px solid #CBE0F0; border-radius:10px; font-size:14px; background:#fff; color:#1A3A7C; outline:none; transition:border-color .2s,box-shadow .2s; }
        .input-wrapper input:focus { border-color:#4A9FD4; box-shadow:0 0 0 3px rgba(74,159,212,.15); }
        .input-wrapper input::placeholder { color:#b0c8e0; }
        .toggle-pass { position:absolute; right:13px; background:none; border:none; cursor:pointer; color:#6B8BB0; display:flex; align-items:center; padding:0; }
        .toggle-pass svg { width:15px; height:15px; }
        .error-msg { display:flex; align-items:center; gap:8px; background:#FFF0F0; border:1px solid #FFBBBB; border-radius:8px; padding:10px 13px; font-size:13px; color:#C0392B; }
        .btn-login { width:100%; padding:13px; background:#1A3A7C; color:#fff; border:none; border-radius:10px; font-size:14px; font-weight:600; cursor:pointer; transition:background .2s,box-shadow .2s; display:flex; align-items:center; justify-content:center; box-shadow:0 4px 14px rgba(26,58,124,.25); }
        .btn-login:hover:not(:disabled) { background:#4A9FD4; }
        .btn-login:disabled { opacity:.65; cursor:not-allowed; }
        .spinner { width:18px; height:18px; border:2px solid rgba(255,255,255,.35); border-top-color:#fff; border-radius:50%; animation:spin .7s linear infinite; }
        @keyframes spin { to { transform:rotate(360deg); } }

        /* Divisor */
        .right-divider { display:flex; align-items:center; gap:10px; padding:0 40px; background:#E8F0F8; height:32px; flex-shrink:0; }
        .div-line { flex:1; height:1px; background:#CBE0F0; }
        .div-label { font-size:10px; font-weight:700; color:#633806; text-transform:uppercase; letter-spacing:.8px; white-space:nowrap; }

        /* Fila inferior — Asistencia */
        .right-bot { flex:1; background:linear-gradient(135deg,#2C3E50 0%,#1A252F 100%);flex-direction:column; align-items:center; justify-content:center; padding:28px 40px; gap:16px; }
        .clock-area { text-align:center; }
        .clock-time { font-size:42px; font-weight:800; color:#fff; font-variant-numeric:tabular-nums; line-height:1; letter-spacing:-1px; }
        .clock-date { font-size:12px; color:rgba(255,255,255,.7); margin-top:4px; }
        .att-result { background:rgba(255,255,255,.12); border:1px solid rgba(255,255,255,.2); border-radius:12px; padding:16px 20px; text-align:center; display:flex; flex-direction:column; align-items:center; gap:8px; width:100%; }
        .att-result.ok { color:#7EE8B8; }
        .att-result.err { color:#FFB3B3; }
        .att-result p { font-size:13px; font-weight:600; line-height:1.4; }
        .att-hint { font-size:10px; opacity:.7; }
        .att-form { display:flex; flex-direction:column; gap:10px; width:100%; }
        .code-input { width:100%; padding:12px; border:2px solid rgba(255,255,255,.3); border-radius:10px; font-size:18px; font-weight:800; text-align:center; letter-spacing:4px; color:#fff; background:rgba(255,255,255,.1); outline:none; transition:border .2s; }
        .code-input::placeholder { color:rgba(255,255,255,.3); font-size:12px; letter-spacing:1px; font-weight:400; }
        .code-input:focus { border-color:#F5C518; box-shadow:0 0 0 3px rgba(245,197,24,.2); }
        .att-btns { display:grid; grid-template-columns:1fr 1fr; gap:8px; }
        .btn-in { display:flex; align-items:center; justify-content:center; gap:6px; padding:11px; background:#0F6E56; color:#fff; border:none; border-radius:9px; font-size:13px; font-weight:700; cursor:pointer; transition:all .2s; }
        .btn-in:hover:not(:disabled) { background:#0A5A45; }
        .btn-in:disabled { opacity:.4; cursor:not-allowed; }
        .btn-out { display:flex; align-items:center; justify-content:center; gap:6px; padding:11px; background:#C0392B; color:#fff; border:none; border-radius:9px; font-size:13px; font-weight:700; cursor:pointer; transition:all .2s; }
        .btn-out:hover:not(:disabled) { background:#A93226; }
        .btn-out:disabled { opacity:.4; cursor:not-allowed; }

        @media(max-width:820px) {
          .login-container { flex-direction:column; }
          .login-left { min-height:220px; }
          .left-inner { padding:28px 24px; gap:20px; }
          .hero-content h1 { font-size:32px; }
          .login-right { width:100%; }
          .right-top { padding:24px; }
          .right-bot { padding:24px; }
          .att-btns { grid-template-columns:1fr; }
        }
      `}</style>
    </div>
  )
}