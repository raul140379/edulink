'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.message || 'Credenciales incorrectas')
        return
      }

      localStorage.setItem('token', data.token)
      localStorage.setItem('user', JSON.stringify(data.user))

      switch (data.user.role) {
        case 'SUPER_ADMIN':
        case 'DIRECTOR':
          router.push('/dashboard/admin')
          break
        case 'TEACHER':
          router.push('/dashboard/teacher')
          break
        case 'JUNTA_ESCOLAR':
          router.push('/dashboard/junta')
          break
        case 'PARENT':
          router.push('/dashboard/parent')
          break
        case 'STUDENT':
          router.push('/dashboard/student')
          break
        default:
          router.push('/dashboard')
      }
    } catch {
      setError('Error de conexión con el servidor')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-container">

      {/* PANEL IZQUIERDO */}
      <div className="login-left">
        <div className="left-inner">
          <div className="brand">
            <div className="brand-logo">
              <Image
                src="/logo-nnuu.jpeg"
                alt="Logo U.E. Naciones Unidas"
                width={56}
                height={56}
                style={{ objectFit: 'contain' }}
              />
            </div>
            <div className="brand-text">
              <span className="brand-name">U.E. Naciones Unidas</span>
              <span className="brand-sub">El Torno · Santa Cruz · Bolivia</span>
            </div>
          </div>

          <div className="hero-content">
            <div className="hero-badge">SGJE · 2026</div>
            <h1>Educando el<br /><span className="highlight">futuro</span><br />de Bolivia</h1>
            <p>Plataforma integral para la gestión de estudiantes, padres de familia, maestros y administración de la Unidad Educativa.</p>
          </div>

          <div className="info-pills">
            <div className="pill"><span className="pill-icon">🎓</span><span>Inicial · Primaria · Secundaria</span></div>
            <div className="pill"><span className="pill-icon">🌐</span><span>Regular · BTH</span></div>
            <div className="pill"><span className="pill-icon">🕐</span><span>Mañana · Tarde · Noche</span></div>
          </div>
        </div>

        <div className="bg-deco">
          <div className="deco-ring r1" /><div className="deco-ring r2" /><div className="deco-ring r3" />
        </div>
      </div>

      {/* PANEL DERECHO */}
      <div className="login-right">
        <div className="login-card">
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
              <label htmlFor="email">Correo electrónico</label>
              <div className="input-wrapper">
                <svg className="input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                  <polyline points="22,6 12,13 2,6"/>
                </svg>
                <input id="email" type="email" placeholder="usuario@sgje.com" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email"/>
              </div>
            </div>

            <div className="field-group">
              <label htmlFor="password">Contraseña</label>
              <div className="input-wrapper">
                <svg className="input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
                <input id="password" type={showPassword ? 'text' : 'password'} placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required autoComplete="current-password"/>
                <button type="button" className="toggle-password" onClick={() => setShowPassword(!showPassword)} tabIndex={-1}>
                  {showPassword
                    ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                    : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  }
                </button>
              </div>
            </div>

            {error && (
              <div className="error-message">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                {error}
              </div>
            )}

            <button type="submit" className="btn-login" disabled={loading}>
              {loading ? <span className="spinner" /> : 'Ingresar al sistema'}
            </button>
          </form>

          <div className="card-footer">
            <p>¿Problemas para acceder? Contacta al administrador del sistema.</p>
          </div>
        </div>
      </div>

      <style>{`
        *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
        :root {
          --azul: #1A3A7C;
          --celeste: #4A9FD4;
          --celeste-light: #7BBFE8;
          --blanco: #FFFFFF;
          --amarillo: #F5C518;
          --gris-claro: #F0F6FC;
          --gris-borde: #CBE0F0;
          --texto-suave: #6B8BB0;
        }
        .login-container { display: flex; min-height: 100vh; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
        .login-left { flex: 1; background: linear-gradient(145deg, var(--azul) 0%, #0D2352 60%, #1A3A7C 100%); position: relative; overflow: hidden; display: flex; align-items: center; justify-content: center; }
        .left-inner { position: relative; z-index: 2; padding: 48px; display: flex; flex-direction: column; gap: 40px; max-width: 500px; width: 100%; }
        .brand { display: flex; align-items: center; gap: 14px; }
        .brand-logo { width: 56px; height: 56px; flex-shrink: 0; background: #fff; border-radius: 50%; padding: 4px; display: flex; align-items: center; justify-content: center; overflow: hidden; }
        .brand-text { display: flex; flex-direction: column; gap: 2px; }
        .brand-name { font-size: 15px; font-weight: 700; color: var(--blanco); }
        .brand-sub { font-size: 11px; color: var(--celeste-light); letter-spacing: 0.5px; }
        .hero-content { display: flex; flex-direction: column; gap: 16px; }
        .hero-badge { display: inline-block; background: rgba(245,197,24,0.15); border: 1px solid rgba(245,197,24,0.4); color: var(--amarillo); font-size: 11px; font-weight: 600; letter-spacing: 1.5px; padding: 5px 12px; border-radius: 20px; width: fit-content; }
        .hero-content h1 { font-size: 48px; font-weight: 800; color: var(--blanco); line-height: 1.1; letter-spacing: -0.5px; }
        .highlight { color: var(--amarillo); }
        .hero-content p { font-size: 14px; color: var(--celeste-light); line-height: 1.7; max-width: 360px; }
        .info-pills { display: flex; flex-direction: column; gap: 10px; }
        .pill { display: flex; align-items: center; gap: 10px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 10px 14px; font-size: 13px; color: var(--celeste-light); }
        .pill-icon { font-size: 15px; }
        .bg-deco { position: absolute; inset: 0; z-index: 1; pointer-events: none; }
        .deco-ring { position: absolute; border-radius: 50%; border: 1px solid rgba(74,159,212,0.12); }
        .r1 { width: 500px; height: 500px; top: -200px; right: -200px; }
        .r2 { width: 350px; height: 350px; top: -125px; right: -125px; border-color: rgba(245,197,24,0.08); }
        .r3 { width: 180px; height: 180px; top: -40px; right: -40px; background: rgba(245,197,24,0.04); }
        .login-right { width: 460px; background: var(--gris-claro); display: flex; align-items: center; justify-content: center; padding: 40px 32px; }
        .login-card { width: 100%; max-width: 380px; display: flex; flex-direction: column; gap: 32px; }
        .card-top { display: flex; flex-direction: column; gap: 8px; }
        .card-icon { width: 44px; height: 44px; background: var(--azul); border-radius: 12px; display: flex; align-items: center; justify-content: center; margin-bottom: 4px; }
        .card-icon svg { width: 22px; height: 22px; stroke: var(--amarillo); }
        .card-top h2 { font-size: 26px; font-weight: 700; color: var(--azul); letter-spacing: -0.3px; }
        .card-top p { font-size: 14px; color: var(--texto-suave); }
        .login-form { display: flex; flex-direction: column; gap: 18px; }
        .field-group { display: flex; flex-direction: column; gap: 6px; }
        .field-group label { font-size: 11px; font-weight: 700; color: var(--azul); text-transform: uppercase; letter-spacing: 0.8px; }
        .input-wrapper { position: relative; display: flex; align-items: center; }
        .input-icon { position: absolute; left: 13px; width: 15px; height: 15px; color: var(--celeste); pointer-events: none; }
        .input-wrapper input { width: 100%; padding: 12px 42px 12px 40px; border: 1.5px solid var(--gris-borde); border-radius: 10px; font-size: 14px; background: var(--blanco); color: var(--azul); transition: border-color 0.2s, box-shadow 0.2s; outline: none; }
        .input-wrapper input:focus { border-color: var(--celeste); box-shadow: 0 0 0 3px rgba(74,159,212,0.15); }
        .input-wrapper input::placeholder { color: #b0c8e0; }
        .toggle-password { position: absolute; right: 13px; background: none; border: none; cursor: pointer; color: var(--texto-suave); display: flex; align-items: center; padding: 0; transition: color 0.2s; }
        .toggle-password:hover { color: var(--azul); }
        .toggle-password svg { width: 15px; height: 15px; }
        .error-message { display: flex; align-items: center; gap: 8px; background: #FFF0F0; border: 1px solid #FFBBBB; border-radius: 8px; padding: 10px 13px; font-size: 13px; color: #C0392B; }
        .error-message svg { width: 15px; height: 15px; flex-shrink: 0; }
        .btn-login { width: 100%; padding: 13px; background: var(--azul); color: var(--blanco); border: none; border-radius: 10px; font-size: 14px; font-weight: 600; letter-spacing: 0.3px; cursor: pointer; transition: background 0.2s, transform 0.1s, box-shadow 0.2s; display: flex; align-items: center; justify-content: center; margin-top: 4px; box-shadow: 0 4px 14px rgba(26,58,124,0.25); }
        .btn-login:hover:not(:disabled) { background: var(--celeste); box-shadow: 0 4px 18px rgba(74,159,212,0.4); }
        .btn-login:active:not(:disabled) { transform: scale(0.99); }
        .btn-login:disabled { opacity: 0.65; cursor: not-allowed; }
        .spinner { width: 18px; height: 18px; border: 2px solid rgba(255,255,255,0.35); border-top-color: #fff; border-radius: 50%; animation: spin 0.7s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .card-footer { border-top: 1px solid var(--gris-borde); padding-top: 20px; }
        .card-footer p { font-size: 12px; color: var(--texto-suave); text-align: center; line-height: 1.5; }
        @media (max-width: 820px) {
          .login-container { flex-direction: column; }
          .login-left { min-height: 260px; }
          .left-inner { padding: 32px 24px; gap: 24px; }
          .hero-content h1 { font-size: 34px; }
          .info-pills { flex-direction: row; flex-wrap: wrap; }
          .pill { flex: 1; min-width: 140px; }
          .login-right { width: 100%; padding: 32px 24px; }
        }
      `}</style>
    </div>
  )
}