'use client'

import { useEffect, useState } from 'react'
import { Plus, X, Save, RefreshCw, Shield, Eye, EyeOff } from 'lucide-react'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

interface PorteroUser {
  id:        number
  email:     string
  role:      string
  isActive:  boolean
  createdAt: string
  staff?:    { id: number; firstName: string; lastName: string; staffRole: string }
}

export default function PorteroAdminPage() {
  const [users,       setUsers]       = useState<PorteroUser[]>([])
  const [loading,     setLoading]     = useState(true)
  const [showModal,   setShowModal]   = useState(false)
  const [saving,      setSaving]      = useState(false)
  const [success,     setSuccess]     = useState('')
  const [error,       setError]       = useState('')
  const [showPass,    setShowPass]    = useState(false)
  const [resetResult, setResetResult] = useState<{email:string; password:string} | null>(null)

  const [form, setForm] = useState({
    firstName: '', lastName: '', ci: '', phone: '',
    email: '', password: '', shift: 'MORNING',
  })

  const token = () => localStorage.getItem('token') || ''
  const auth  = () => ({ Authorization: `Bearer ${token()}` })

  const notify = (msg: string, type: 'ok'|'err' = 'ok') => {
    if (type === 'ok') { setSuccess(msg); setTimeout(() => setSuccess(''), 4000) }
    else               { setError(msg);   setTimeout(() => setError(''),   4000) }
  }

  const normalize = (str: string) =>
    str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '').replace(/[^a-z0-9]/g, '')

  const getAutoEmail = () => {
    if (!form.firstName || !form.lastName) return ''
    const first = normalize(form.firstName.split(' ')[0])
    const last  = normalize(form.lastName.split(' ')[0])
    return `${first}.${last}@nnuu.edu.bo`
  }

  const getAutoPassword = () => {
    if (form.ci && form.ci.trim()) return `port${form.ci.trim()}`
    return 'port123'
  }

  const loadUsers = async () => {
    setLoading(true)
    try {
      const res  = await fetch(`${API}/api/users?role=PORTERO`, { headers: auth() })
      const data = await res.json()
      if (res.ok) setUsers(Array.isArray(data) ? data : [])
    } catch { notify('Error de conexión', 'err') }
    finally { setLoading(false) }
  }

  useEffect(() => { loadUsers() }, [])

  const handleCreate = async () => {
    if (!form.firstName || !form.lastName) {
      notify('Nombre y apellido son requeridos', 'err'); return
    }

    const finalEmail    = form.email.trim()    || getAutoEmail()
    const finalPassword = form.password.trim() || getAutoPassword()

    if (!finalEmail) { notify('No se pudo generar el email', 'err'); return }
    if (finalPassword.length < 6) { notify('La contraseña debe tener al menos 6 caracteres', 'err'); return }

    setSaving(true)
    try {
      const resU  = await fetch(`${API}/api/users`, {
        method: 'POST',
        headers: { ...auth(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: finalEmail, password: finalPassword, role: 'PORTERO' })
      })
      const dataU = await resU.json()
      if (!resU.ok) { notify(dataU.message, 'err'); return }

      await fetch(`${API}/api/users/${dataU.user.id}/staff`, {
        method: 'POST',
        headers: { ...auth(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: form.firstName,
          lastName:  form.lastName,
          ci:        form.ci    || null,
          phone:     form.phone || null,
          staffRole: 'PORTERO',
          shift:     form.shift,
        })
      }).catch(() => null)

      notify(`✅ Portero creado — Email: ${finalEmail} · Contraseña: ${finalPassword}`)
      setShowModal(false)
      setForm({ firstName:'', lastName:'', ci:'', phone:'', email:'', password:'', shift:'MORNING' })
      loadUsers()
    } catch { notify('Error de conexión', 'err') }
    finally { setSaving(false) }
  }

  const handleToggle = async (user: PorteroUser) => {
    try {
      const res  = await fetch(`${API}/api/users/${user.id}/toggle`, {
        method: 'PATCH', headers: auth()
      })
      const data = await res.json()
      if (!res.ok) { notify(data.message, 'err'); return }
      notify(data.message)
      loadUsers()
    } catch { notify('Error de conexión', 'err') }
  }

  const handleResetPassword = async (user: PorteroUser) => {
    if (!confirm(`¿Restablecer contraseña de ${user.email}?`)) return
    try {
      const res  = await fetch(`${API}/api/users/${user.id}/reset-password`, {
        method: 'POST', headers: auth()
      })
      const data = await res.json()
      if (!res.ok) { notify(data.message, 'err'); return }
      setResetResult({ email: data.userEmail, password: data.newPassword })
    } catch { notify('Error de conexión', 'err') }
  }

  const autoEmail    = getAutoEmail()
  const autoPassword = getAutoPassword()

  return (
    <div>
      {/* Header */}
      <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:24,gap:16,flexWrap:'wrap'}}>
        <div>
          <h1 style={{fontSize:20,fontWeight:700,color:'#1A3A7C',marginBottom:4}}>Usuarios Portero</h1>
          <p style={{fontSize:13,color:'#6B8BB0'}}>Gestiona el acceso al módulo de control de entrada</p>
        </div>
        <div style={{display:'flex',gap:10}}>
          <a href="/dashboard/admin/portero/codigoQR" style={{
            display:'flex',alignItems:'center',gap:8,padding:'10px 18px',
            background:'#0F6E56',color:'#fff',borderRadius:8,
            fontSize:13,fontWeight:600,cursor:'pointer',textDecoration:'none'
          }}>
            🔲 Códigos QR
          </a>
          <button onClick={()=>setShowModal(true)} style={{
            display:'flex',alignItems:'center',gap:8,padding:'10px 18px',
            background:'#1A3A7C',color:'#fff',border:'none',borderRadius:8,
            fontSize:13,fontWeight:600,cursor:'pointer'
          }}>
            <Plus size={15}/> Nuevo Portero
          </button>
        </div>
      </div>

      {success && <div style={{padding:'10px 14px',borderRadius:8,fontSize:13,marginBottom:14,background:'#E1F5EE',border:'1px solid #9FE1CB',color:'#0F6E56'}}>{success}</div>}
      {error   && <div style={{padding:'10px 14px',borderRadius:8,fontSize:13,marginBottom:14,background:'#FFF0F0',border:'1px solid #FFBBBB',color:'#C0392B'}}>{error}</div>}

      {/* Resultado reset contraseña */}
      {resetResult && (
        <div style={{background:'#FFFBEA',border:'1px solid #F5C518',borderRadius:10,padding:'14px 18px',marginBottom:16}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
            <span style={{fontSize:13,fontWeight:700,color:'#7A6000'}}>🔑 Nueva contraseña generada</span>
            <button onClick={()=>setResetResult(null)} style={{background:'none',border:'none',cursor:'pointer',color:'#94A3B8'}}>
              <X size={16}/>
            </button>
          </div>
          <div style={{fontSize:13,color:'#1A3A7C'}}><strong>Email:</strong> {resetResult.email}</div>
          <div style={{fontSize:18,fontWeight:800,color:'#1A3A7C',letterSpacing:2,marginTop:4,fontFamily:'monospace'}}>
            {resetResult.password}
          </div>
          <div style={{fontSize:11,color:'#6B8BB0',marginTop:4}}>Comparte esta contraseña con el portero.</div>
        </div>
      )}

      {/* Lista */}
      <div style={{background:'#fff',border:'1px solid #CBE0F0',borderRadius:12,overflow:'hidden'}}>
        {loading ? (
          <div style={{display:'flex',justifyContent:'center',padding:48}}>
            <div className="spinner"/>
          </div>
        ) : users.length === 0 ? (
          <div style={{padding:48,textAlign:'center',color:'#6B8BB0'}}>
            <div style={{fontSize:40,marginBottom:12}}>🚪</div>
            <p>No hay usuarios portero registrados.</p>
            <button onClick={()=>setShowModal(true)} style={{marginTop:12,padding:'8px 16px',background:'#1A3A7C',color:'#fff',border:'none',borderRadius:8,cursor:'pointer',fontSize:13}}>
              Crear primer portero
            </button>
          </div>
        ) : (
          <table style={{width:'100%',borderCollapse:'collapse'}}>
            <thead>
              <tr style={{background:'#F0F6FC'}}>
                <th style={th}>Portero</th>
                <th style={th}>Email</th>
                <th style={th}>Rol</th>
                <th style={th}>Estado</th>
                <th style={th}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u, i) => (
                <tr key={u.id} style={{borderTop:'1px solid #F0F6FC'}}>
                  <td style={td}>
                    <div style={{display:'flex',alignItems:'center',gap:10}}>
                      <div style={{width:36,height:36,borderRadius:8,background:'#E0ECF8',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18}}>
                        🚪
                      </div>
                      <div>
                        <div style={{fontSize:13,fontWeight:600,color:'#1A3A7C'}}>
                          {u.staff ? `${u.staff.lastName} ${u.staff.firstName}` : `Portero #${i+1}`}
                        </div>
                        <div style={{fontSize:11,color:'#6B8BB0'}}>{u.email}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{...td,fontSize:13,color:'#1A3A7C'}}>{u.email}</td>
                  <td style={td}>
                    <span style={{fontSize:12,color:'#6B8BB0'}}>
                      {u.staff?.staffRole || 'PORTERO'}
                    </span>
                  </td>
                  <td style={td}>
                    <span style={{
                      padding:'3px 10px',borderRadius:20,fontSize:11,fontWeight:600,
                      background:u.isActive?'#E1F5EE':'#FFF0F0',
                      color:u.isActive?'#0F6E56':'#C0392B',
                    }}>
                      {u.isActive ? '✅ Activo' : '❌ Inactivo'}
                    </span>
                  </td>
                  <td style={td}>
                    <div style={{display:'flex',gap:6}}>
                      <button onClick={()=>handleToggle(u)} style={{
                        padding:'5px 10px',borderRadius:6,border:'none',cursor:'pointer',fontSize:11,fontWeight:500,
                        background:u.isActive?'#FFF0F0':'#E1F5EE',
                        color:u.isActive?'#C0392B':'#0F6E56',
                      }}>
                        {u.isActive ? 'Desactivar' : 'Activar'}
                      </button>
                      <button onClick={()=>handleResetPassword(u)} style={{
                        display:'flex',alignItems:'center',gap:4,
                        padding:'5px 10px',borderRadius:6,border:'1px solid #CBE0F0',
                        cursor:'pointer',fontSize:11,background:'#fff',color:'#1A3A7C',
                      }}>
                        <RefreshCw size={11}/> Reset pass
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Info acceso */}
      <div style={{background:'#E0ECF8',border:'1px solid #CBE0F0',borderRadius:10,padding:'12px 16px',marginTop:16,fontSize:12,color:'#1A3A7C'}}>
        <div style={{fontWeight:700,marginBottom:4}}>🔗 Acceso al módulo de portero</div>
        <div style={{color:'#6B8BB0'}}>
          El portero accede en:{' '}
          <strong>{typeof window !== 'undefined' ? window.location.origin : ''}/dashboard/portero</strong>
        </div>
      </div>

      {/* Modal crear portero */}
      {showModal && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.4)',zIndex:500,display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
          <div style={{background:'#fff',borderRadius:14,width:'100%',maxWidth:480,maxHeight:'90vh',overflow:'auto',boxShadow:'0 20px 60px rgba(0,0,0,.15)'}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'18px 20px',borderBottom:'1px solid #CBE0F0'}}>
              <div>
                <h2 style={{fontSize:16,fontWeight:700,color:'#1A3A7C',margin:0}}>Nuevo Portero</h2>
                <p style={{fontSize:12,color:'#6B8BB0',margin:'2px 0 0'}}>Crear acceso al módulo de control de entrada</p>
              </div>
              <button onClick={()=>setShowModal(false)} style={{background:'none',border:'none',cursor:'pointer',color:'#6B8BB0'}}>
                <X size={18}/>
              </button>
            </div>
            <div style={{padding:20,display:'flex',flexDirection:'column',gap:14}}>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                <div style={{display:'flex',flexDirection:'column',gap:5}}>
                  <label style={lbl}>Nombre *</label>
                  <input value={form.firstName} onChange={e=>setForm(p=>({...p,firstName:e.target.value}))}
                    placeholder="Nombre" style={inp}/>
                </div>
                <div style={{display:'flex',flexDirection:'column',gap:5}}>
                  <label style={lbl}>Apellido *</label>
                  <input value={form.lastName} onChange={e=>setForm(p=>({...p,lastName:e.target.value}))}
                    placeholder="Apellido" style={inp}/>
                </div>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                <div style={{display:'flex',flexDirection:'column',gap:5}}>
                  <label style={lbl}>CI</label>
                  <input value={form.ci} onChange={e=>setForm(p=>({...p,ci:e.target.value}))}
                    placeholder="Cédula de identidad" style={inp}/>
                </div>
                <div style={{display:'flex',flexDirection:'column',gap:5}}>
                  <label style={lbl}>Teléfono</label>
                  <input value={form.phone} onChange={e=>setForm(p=>({...p,phone:e.target.value}))}
                    placeholder="Celular" style={inp}/>
                </div>
              </div>
              <div style={{display:'flex',flexDirection:'column',gap:5}}>
                <label style={lbl}>Turno</label>
                <select value={form.shift} onChange={e=>setForm(p=>({...p,shift:e.target.value}))} style={inp}>
                  <option value="MORNING">Mañana</option>
                  <option value="AFTERNOON">Tarde</option>
                </select>
              </div>
              <div style={{borderTop:'1px solid #F0F6FC',paddingTop:14}}>
                <div style={{fontSize:11,fontWeight:700,color:'#1A3A7C',textTransform:'uppercase',letterSpacing:'.5px',marginBottom:10,display:'flex',alignItems:'center',gap:6}}>
                  <Shield size={13}/> Credenciales de acceso
                </div>
                <div style={{display:'flex',flexDirection:'column',gap:12}}>
                  <div style={{display:'flex',flexDirection:'column',gap:5}}>
                    <label style={lbl}>Email (opcional)</label>
                    <input value={form.email} onChange={e=>setForm(p=>({...p,email:e.target.value}))}
                      placeholder="Se generará automáticamente si está vacío"
                      type="email" style={inp}/>
                    {!form.email && autoEmail && (
                      <div style={{fontSize:11,color:'#0F6E56',background:'#E1F5EE',padding:'5px 10px',borderRadius:6,display:'flex',alignItems:'center',gap:4}}>
                        📧 Se usará: <strong>{autoEmail}</strong>
                      </div>
                    )}
                  </div>
                  <div style={{display:'flex',flexDirection:'column',gap:5}}>
                    <label style={lbl}>Contraseña (opcional)</label>
                    <div style={{position:'relative'}}>
                      <input value={form.password} onChange={e=>setForm(p=>({...p,password:e.target.value}))}
                        placeholder="Se generará automáticamente si está vacío"
                        type={showPass?'text':'password'}
                        style={{...inp,paddingRight:40}}/>
                      <button onClick={()=>setShowPass(!showPass)} style={{
                        position:'absolute',right:10,top:'50%',transform:'translateY(-50%)',
                        background:'none',border:'none',cursor:'pointer',color:'#6B8BB0'
                      }}>
                        {showPass ? <EyeOff size={16}/> : <Eye size={16}/>}
                      </button>
                    </div>
                    {!form.password && (
                      <div style={{fontSize:11,color:'#633806',background:'#FDF0E6',padding:'5px 10px',borderRadius:6,display:'flex',alignItems:'center',gap:4}}>
                        🔑 Se usará: <strong>{autoPassword}</strong>
                        {form.ci ? ` (port + CI: ${form.ci})` : ' (port123 — sin CI)'}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
            <div style={{display:'flex',justifyContent:'flex-end',gap:10,padding:'14px 20px',borderTop:'1px solid #CBE0F0'}}>
              <button onClick={()=>setShowModal(false)} style={{padding:'9px 16px',background:'#fff',border:'1.5px solid #CBE0F0',borderRadius:8,fontSize:13,cursor:'pointer',color:'#1A3A7C'}}>
                Cancelar
              </button>
              <button onClick={handleCreate} disabled={saving} style={{
                display:'flex',alignItems:'center',gap:6,padding:'9px 18px',
                background:'#1A3A7C',color:'#fff',border:'none',borderRadius:8,
                fontSize:13,fontWeight:600,cursor:'pointer',opacity:saving?0.6:1
              }}>
                {saving ? <span className="spinsm"/> : <Save size={14}/>}
                {saving ? 'Creando...' : 'Crear Portero'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .spinner{width:24px;height:24px;border:2px solid rgba(26,58,124,.2);border-top-color:#1A3A7C;border-radius:50%;animation:spin .7s linear infinite}
        .spinsm{width:14px;height:14px;border:2px solid rgba(255,255,255,.3);border-top-color:#fff;border-radius:50%;animation:spin .7s linear infinite;display:inline-block}
        @keyframes spin{to{transform:rotate(360deg)}}
      `}</style>
    </div>
  )
}

const th: React.CSSProperties = {
  padding:'10px 14px',textAlign:'left',fontSize:11,fontWeight:600,
  color:'#1A3A7C',textTransform:'uppercase',letterSpacing:'.5px'
}
const td: React.CSSProperties = {
  padding:'10px 14px',fontSize:13,color:'#1A3A7C',verticalAlign:'middle'
}
const lbl: React.CSSProperties = {
  fontSize:11,fontWeight:600,color:'#1A3A7C',textTransform:'uppercase',letterSpacing:'.5px'
}
const inp: React.CSSProperties = {
  padding:'10px 12px',border:'1.5px solid #CBE0F0',borderRadius:8,
  fontSize:13,color:'#1A3A7C',outline:'none',width:'100%'
}