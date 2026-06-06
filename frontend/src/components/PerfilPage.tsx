'use client'

import { useState } from 'react'
import { KeyRound, Eye, EyeOff, Check, UserCircle } from 'lucide-react'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

interface PerfilPageProps {
  rolLabel:  string
  roleColor: string
}

export function PerfilPage({ rolLabel, roleColor }: PerfilPageProps) {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword,     setNewPassword]     = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showCurrent,     setShowCurrent]     = useState(false)
  const [showNew,         setShowNew]         = useState(false)
  const [showConfirm,     setShowConfirm]     = useState(false)
  const [saving,          setSaving]          = useState(false)
  const [success,         setSuccess]         = useState('')
  const [error,           setError]           = useState('')

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : ''
  const user  = typeof window !== 'undefined'
    ? JSON.parse(localStorage.getItem('user') || '{}')
    : {}

  const notify = (msg: string, type: 'ok' | 'err' = 'ok') => {
    if (type === 'ok') { setSuccess(msg); setTimeout(() => setSuccess(''), 4000) }
    else               { setError(msg);   setTimeout(() => setError(''),   4000) }
  }

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      notify('Todos los campos son requeridos', 'err'); return
    }
    if (newPassword.length < 6) {
      notify('La nueva contraseña debe tener al menos 6 caracteres', 'err'); return
    }
    if (newPassword !== confirmPassword) {
      notify('Las contraseñas no coinciden', 'err'); return
    }
    setSaving(true)
    try {
      const res  = await fetch(`${API_URL}/api/auth/change-password`, {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ currentPassword, newPassword }),
      })
      const data = await res.json()
      if (!res.ok) { notify(data.message, 'err'); return }
      notify('Contraseña actualizada correctamente')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch { notify('Error de conexión', 'err') }
    finally  { setSaving(false) }
  }

  return (
    <div style={{ maxWidth: '500px' }}>
      <div className="page-header">
        <h1>Mi Perfil</h1>
        <p>Gestiona tu información de acceso</p>
      </div>

      {success && <div className="alert ok">{success}</div>}
      {error   && <div className="alert err">{error}</div>}

      <div className="info-card">
        <div className="info-avatar" style={{ background: `${roleColor}20` }}>
          <UserCircle size={40} color={roleColor}/>
        </div>
        <div className="info-data">
          <div className="info-email">{user.email}</div>
          <span className="info-role" style={{ background: `${roleColor}20`, color: roleColor }}>
            {rolLabel}
          </span>
        </div>
      </div>

      <div className="section-card">
        <div className="section-title" style={{ color: roleColor }}>
          <KeyRound size={16}/> Cambiar contraseña
        </div>
        <div className="section-body">
          <div className="fg">
            <label>Contraseña actual *</label>
            <div className="input-wrap">
              <input type={showCurrent ? 'text' : 'password'} placeholder="Ingresa tu contraseña actual"
                value={currentPassword} onChange={e => setCurrentPassword(e.target.value)}/>
              <button className="eye-btn" onClick={() => setShowCurrent(!showCurrent)}>
                {showCurrent ? <EyeOff size={15}/> : <Eye size={15}/>}
              </button>
            </div>
          </div>
          <div className="fg">
            <label>Nueva contraseña *</label>
            <div className="input-wrap">
              <input type={showNew ? 'text' : 'password'} placeholder="Mínimo 6 caracteres"
                value={newPassword} onChange={e => setNewPassword(e.target.value)}/>
              <button className="eye-btn" onClick={() => setShowNew(!showNew)}>
                {showNew ? <EyeOff size={15}/> : <Eye size={15}/>}
              </button>
            </div>
          </div>
          <div className="fg">
            <label>Confirmar nueva contraseña *</label>
            <div className="input-wrap">
              <input type={showConfirm ? 'text' : 'password'} placeholder="Repite la nueva contraseña"
                value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}/>
              <button className="eye-btn" onClick={() => setShowConfirm(!showConfirm)}>
                {showConfirm ? <EyeOff size={15}/> : <Eye size={15}/>}
              </button>
            </div>
            {newPassword && confirmPassword && newPassword !== confirmPassword && (
              <span className="field-err">Las contraseñas no coinciden</span>
            )}
            {newPassword && confirmPassword && newPassword === confirmPassword && (
              <span className="field-ok"><Check size={12}/> Contraseñas coinciden</span>
            )}
          </div>
          <button className="btn-save" style={{ background: roleColor }}
            onClick={handleChangePassword}
            disabled={saving || !currentPassword || !newPassword || !confirmPassword || newPassword !== confirmPassword}>
            {saving ? <span className="spinsm"/> : <KeyRound size={14}/>}
            {saving ? 'Guardando...' : 'Actualizar contraseña'}
          </button>
        </div>
      </div>

      <style>{`
        .page-header{margin-bottom:24px}
        .page-header h1{font-size:20px;font-weight:700;color:#1A3A7C;margin-bottom:4px}
        .page-header p{font-size:13px;color:#6B8BB0}
        .alert{padding:10px 14px;border-radius:8px;font-size:13px;margin-bottom:14px}
        .alert.ok{background:#E1F5EE;border:1px solid #9FE1CB;color:#0F6E56}
        .alert.err{background:#FFF0F0;border:1px solid #FFBBBB;color:#C0392B}
        .info-card{background:#fff;border:1px solid #CBE0F0;border-radius:12px;padding:16px 20px;margin-bottom:20px;display:flex;align-items:center;gap:14px}
        .info-avatar{width:56px;height:56px;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0}
        .info-data{display:flex;flex-direction:column;gap:6px}
        .info-email{font-size:14px;font-weight:600;color:#1A3A7C}
        .info-role{font-size:11px;font-weight:600;padding:2px 10px;border-radius:20px;width:fit-content}
        .section-card{background:#fff;border:1px solid #CBE0F0;border-radius:12px;overflow:hidden}
        .section-title{display:flex;align-items:center;gap:8px;padding:14px 20px;border-bottom:1px solid #F0F6FC;font-size:13px;font-weight:700}
        .section-body{padding:20px;display:flex;flex-direction:column;gap:14px}
        .fg{display:flex;flex-direction:column;gap:5px}
        .fg label{font-size:11px;font-weight:600;color:#1A3A7C;text-transform:uppercase;letter-spacing:.5px}
        .input-wrap{position:relative;display:flex;align-items:center}
        .input-wrap input{width:100%;padding:10px 40px 10px 12px;border:1.5px solid #CBE0F0;border-radius:8px;font-size:13px;color:#1A3A7C;outline:none}
        .input-wrap input:focus{border-color:#4A9FD4;box-shadow:0 0 0 3px rgba(74,159,212,.12)}
        .eye-btn{position:absolute;right:10px;background:none;border:none;cursor:pointer;color:#6B8BB0;display:flex;align-items:center}
        .eye-btn:hover{color:#1A3A7C}
        .field-err{font-size:11px;color:#C0392B}
        .field-ok{font-size:11px;color:#0F6E56;display:flex;align-items:center;gap:4px}
        .btn-save{display:flex;align-items:center;gap:6px;padding:10px 18px;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:500;cursor:pointer}
        .btn-save:hover:not(:disabled){opacity:.85}
        .btn-save:disabled{opacity:.5;cursor:not-allowed}
        .spinsm{width:14px;height:14px;border:2px solid rgba(255,255,255,.3);border-top-color:#fff;border-radius:50%;animation:spin .7s linear infinite;display:inline-block}
        @keyframes spin{to{transform:rotate(360deg)}}
      `}</style>
    </div>
  )
}