'use client'

import { useEffect, useState } from 'react'
import { User, Phone, Mail, CreditCard, Lock, Save, Eye, EyeOff } from 'lucide-react'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

interface ParentData {
  id:        number
  firstName: string
  lastName:  string
  ci?:       string
  phone?:    string
  email?:    string
  address?:  string
  user?:     { email: string; isActive: boolean }
}

export default function ParentPerfilPage() {
  const [parent,   setParent]   = useState<ParentData | null>(null)
  const [loading,  setLoading]  = useState(true)
  const [saving,   setSaving]   = useState(false)
  const [success,  setSuccess]  = useState('')
  const [error,    setError]    = useState('')
  const [form,     setForm]     = useState({ phone: '', email: '', address: '' })
  const [pwForm,   setPwForm]   = useState({ current: '', newPw: '', confirm: '' })
  const [showCurr, setShowCurr] = useState(false)
  const [showNew,  setShowNew]  = useState(false)
  const [savingPw, setSavingPw] = useState(false)
  const [pwSuccess,setPwSuccess]= useState('')
  const [pwError,  setPwError]  = useState('')

  const notify = (msg: string, type: 'ok'|'err' = 'ok') => {
    if (type === 'ok') { setSuccess(msg); setTimeout(() => setSuccess(''), 3000) }
    else               { setError(msg);   setTimeout(() => setError(''),   4000) }
  }
  const notifyPw = (msg: string, type: 'ok'|'err' = 'ok') => {
    if (type === 'ok') { setPwSuccess(msg); setTimeout(() => setPwSuccess(''), 3000) }
    else               { setPwError(msg);   setTimeout(() => setPwError(''),   4000) }
  }

  useEffect(() => {
    const init = async () => {
      const token = localStorage.getItem('token')
      if (!token) { setLoading(false); return }
      setLoading(true)
      try {
        const res  = await fetch(`${API_URL}/api/parents/me`, { headers: { Authorization: `Bearer ${token}` } })
        const data = await res.json()
        if (res.ok) {
          setParent(data)
          setForm({
  phone:   data.phone   || '',
  email:   '',
  address: data.address || '',
})
        }
      } catch { notify('Error de conexión', 'err') }
      finally  { setLoading(false) }
    }
    init()
  }, [])

  const handleSave = async () => {
    const token = localStorage.getItem('token')
    if (!token || !parent) return
    setSaving(true)
    try {
      const res = await fetch(`${API_URL}/api/parents/me`, {  
        method:  'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ phone: form.phone, email: form.email || null, address: form.address }),
      })
      const data = await res.json()
      if (res.ok) { 
  notify('Datos actualizados correctamente')
  setParent(data.parent)
  setForm(prev => ({ ...prev, email: form.email }))
}
      else notify(data.message, 'err')
    } catch { notify('Error de conexión', 'err') }
    finally  { setSaving(false) }
  }

  const handleChangePassword = async () => {
    if (!pwForm.current)         { notifyPw('Ingresa tu contraseña actual', 'err'); return }
    if (!pwForm.newPw)           { notifyPw('Ingresa la nueva contraseña', 'err'); return }
    if (pwForm.newPw.length < 6) { notifyPw('Mínimo 6 caracteres', 'err'); return }
    if (pwForm.newPw !== pwForm.confirm) { notifyPw('Las contraseñas no coinciden', 'err'); return }
    const token = localStorage.getItem('token')
    if (!token) return
    setSavingPw(true)
    try {
      const res  = await fetch(`${API_URL}/api/auth/change-password`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ currentPassword: pwForm.current, newPassword: pwForm.newPw }),
      })
      const data = await res.json()
      if (res.ok) { notifyPw('Contraseña cambiada correctamente'); setPwForm({ current: '', newPw: '', confirm: '' }) }
      else notifyPw(data.message, 'err')
    } catch { notifyPw('Error de conexión', 'err') }
    finally  { setSavingPw(false) }
  }

  if (loading) return <div className="center"><div className="spinner"/></div>
  if (!parent) return null

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Mi Perfil</h1>
          <p>Información personal y seguridad</p>
        </div>
      </div>

      {success && <div className="alert suc">{success}</div>}
      {error   && <div className="alert err">{error}</div>}

      <div className="two-cols">
        {/* Datos personales */}
        <div className="card">
          <div className="card-header"><User size={15}/> Datos personales</div>
          <div className="card-body">

            {/* Solo lectura */}
            <div className="field-readonly">
              <div className="field-label"><CreditCard size={13}/> Nombre completo</div>
              <div className="field-value">{parent.lastName} {parent.firstName}</div>
            </div>
            {parent.ci && (
              <div className="field-readonly">
                <div className="field-label"><CreditCard size={13}/> Cédula de identidad</div>
                <div className="field-value">{parent.ci}</div>
              </div>
            )}
            <div className="field-readonly">
              <div className="field-label"><Mail size={13}/> Email del sistema</div>
              <div className="field-value sys-email">{parent.user?.email || '—'}</div>
            </div>

            <div className="divider"/>
            <div className="section-lbl">Datos actualizables</div>

            <div className="fg">
              <label><Phone size={12}/> Teléfono</label>
              <input type="text" placeholder="Ej: 70012345"
                value={form.phone} onChange={e => setForm({...form, phone: e.target.value})}/>
            </div>
            <div className="fg">
              <label><Mail size={12}/> Email personal</label>
              <input type="email" placeholder="Ej: mi.correo@gmail.com"
                value={form.email} onChange={e => setForm({...form, email: e.target.value})}/>
              <span className="field-hint">Correo personal diferente al del sistema</span>
            </div>
            <div className="fg">
              <label>Dirección</label>
              <input type="text" placeholder="Ej: Barrio Las Palmas..."
                value={form.address} onChange={e => setForm({...form, address: e.target.value})}/>
            </div>

            <button className="btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? <span className="spinsm"/> : <Save size={14}/>}
              {saving ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </div>
        </div>

        {/* Cambiar contraseña */}
        <div className="card">
          <div className="card-header"><Lock size={15}/> Cambiar contraseña</div>
          <div className="card-body">
            {pwSuccess && <div className="alert suc">{pwSuccess}</div>}
            {pwError   && <div className="alert err">{pwError}</div>}

            <div className="fg">
              <label>Contraseña actual *</label>
              <div className="pw-wrap">
                <input type={showCurr ? 'text' : 'password'} placeholder="Tu contraseña actual"
                  value={pwForm.current} onChange={e => setPwForm({...pwForm, current: e.target.value})}/>
                <button className="pw-eye" onClick={() => setShowCurr(!showCurr)}>
                  {showCurr ? <EyeOff size={14}/> : <Eye size={14}/>}
                </button>
              </div>
            </div>
            <div className="fg">
              <label>Nueva contraseña *</label>
              <div className="pw-wrap">
                <input type={showNew ? 'text' : 'password'} placeholder="Mínimo 6 caracteres"
                  value={pwForm.newPw} onChange={e => setPwForm({...pwForm, newPw: e.target.value})}/>
                <button className="pw-eye" onClick={() => setShowNew(!showNew)}>
                  {showNew ? <EyeOff size={14}/> : <Eye size={14}/>}
                </button>
              </div>
            </div>
            <div className="fg">
              <label>Confirmar nueva contraseña *</label>
              <input type="password" placeholder="Repite la nueva contraseña"
                value={pwForm.confirm} onChange={e => setPwForm({...pwForm, confirm: e.target.value})}/>
              {pwForm.confirm && pwForm.newPw !== pwForm.confirm && (
                <span className="pw-hint err">Las contraseñas no coinciden</span>
              )}
              {pwForm.confirm && pwForm.newPw === pwForm.confirm && pwForm.newPw && (
                <span className="pw-hint ok">✓ Las contraseñas coinciden</span>
              )}
            </div>

            <div className="info-box">
              💡 Usa una contraseña segura con letras y números. Mínimo 6 caracteres.
            </div>

            <button className="btn-primary" onClick={handleChangePassword} disabled={savingPw}>
              {savingPw ? <span className="spinsm"/> : <Lock size={14}/>}
              {savingPw ? 'Cambiando...' : 'Cambiar contraseña'}
            </button>
          </div>
        </div>
      </div>

      <style>{`
        .page-header{margin-bottom:24px}
        .page-header h1{font-size:20px;font-weight:700;color:#00838F;margin-bottom:4px}
        .page-header p{font-size:13px;color:#6B8BB0}
        .center{display:flex;justify-content:center;padding:48px}
        .alert{padding:10px 14px;border-radius:8px;font-size:13px;margin-bottom:16px}
        .alert.suc{background:#E1F5EE;border:1px solid #9FE1CB;color:#0F6E56}
        .alert.err{background:#FFF0F0;border:1px solid #FFBBBB;color:#C0392B}
        .two-cols{display:grid;grid-template-columns:1fr 1fr;gap:16px;align-items:start}
        .card{background:#fff;border:1px solid #CBE0F0;border-radius:12px;overflow:hidden}
        .card-header{display:flex;align-items:center;gap:8px;padding:14px 18px;border-bottom:1px solid #F0F6FC;font-size:13px;font-weight:600;color:#1A3A7C}
        .card-body{padding:20px;display:flex;flex-direction:column;gap:14px}
        .field-readonly{display:flex;flex-direction:column;gap:3px}
        .field-label{display:flex;align-items:center;gap:5px;font-size:11px;font-weight:600;color:#6B8BB0;text-transform:uppercase;letter-spacing:.5px}
        .field-value{font-size:14px;font-weight:500;color:#1A3A7C}
        .sys-email{font-size:13px;color:#6B8BB0;font-family:monospace;background:#F8FBFF;padding:6px 10px;border-radius:6px;border:1px solid #F0F6FC}
        .divider{border:none;border-top:1px dashed #CBE0F0;margin:2px 0}
        .section-lbl{font-size:11px;font-weight:700;color:#1A3A7C;text-transform:uppercase;letter-spacing:.6px}
        .fg{display:flex;flex-direction:column;gap:6px}
        .fg label{display:flex;align-items:center;gap:5px;font-size:11px;font-weight:700;color:#1A3A7C;text-transform:uppercase;letter-spacing:.5px}
        .fg input{padding:9px 12px;border:1.5px solid #CBE0F0;border-radius:8px;font-size:13px;color:#1A3A7C;outline:none;width:100%}
        .fg input:focus{border-color:#00838F;box-shadow:0 0 0 3px rgba(0,131,143,.1)}
        .field-hint{font-size:11px;color:#6B8BB0}
        .pw-wrap{position:relative}
        .pw-wrap input{padding-right:40px;width:100%}
        .pw-eye{position:absolute;right:10px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;color:#6B8BB0;display:flex}
        .pw-eye:hover{color:#1A3A7C}
        .pw-hint{font-size:11px;margin-top:2px}
        .pw-hint.err{color:#C0392B}
        .pw-hint.ok{color:#0F6E56}
        .info-box{background:#F0F6FC;border:1px solid #CBE0F0;border-radius:8px;padding:10px 12px;font-size:12px;color:#6B8BB0;line-height:1.5}
        .btn-primary{display:flex;align-items:center;justify-content:center;gap:6px;padding:10px 16px;background:#00838F;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:500;cursor:pointer;width:100%}
        .btn-primary:hover:not(:disabled){background:#006D75}
        .btn-primary:disabled{opacity:.6;cursor:not-allowed}
        .spinner{width:24px;height:24px;border:2px solid rgba(0,131,143,.2);border-top-color:#00838F;border-radius:50%;animation:spin .7s linear infinite}
        .spinsm{width:14px;height:14px;border:2px solid rgba(255,255,255,.3);border-top-color:#fff;border-radius:50%;animation:spin .7s linear infinite;display:inline-block}
        @keyframes spin{to{transform:rotate(360deg)}}
        @media(max-width:768px){.two-cols{grid-template-columns:1fr}}
      `}</style>
    </div>
  )
}