'use client'

import { useEffect, useState } from 'react'
import { Plus, Search, RefreshCw, UserCheck, UserX, EyeOff, Eye, X, KeyRound, Copy, Check } from 'lucide-react'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

interface User {
  id:        number
  email:     string
  role:      string
  isActive:  boolean
  createdAt: string
  parent?:   { firstName: string; lastName: string }
  teacher?:  { firstName: string; lastName: string }
  student?:  { firstName: string; lastName: string }
  staff?:    { firstName: string; lastName: string; staffRole: string }
}

const roleLabels: Record<string, string> = {
  SUPER_ADMIN: 'Super Admin', DIRECTOR: 'Director', REGENTE: 'Regente',
  SECRETARY: 'Secretaria', TEACHER: 'Maestro', DELEGATE: 'Delegado',
  JUNTA_ESCOLAR: 'Junta Escolar', TEACHER_TUTOR: 'Maestro Tutor',
  PARENT: 'Padre / Tutor', STUDENT: 'Estudiante', STUDENT_GOV: 'Gob. Estudiantil', STAFF: 'Personal',
}

const roleColors: Record<string, string> = {
  SUPER_ADMIN: '#1A3A7C', DIRECTOR: '#0F6E56', REGENTE: '#3C3489',
  SECRETARY: '#712B13', TEACHER: '#633806', TEACHER_TUTOR: '#0F6E56', DELEGATE: '#444441',
  JUNTA_ESCOLAR: '#0F6E56',
  PARENT: '#27500A', STUDENT: '#791F1F', STUDENT_GOV: '#185FA5', STAFF: '#4A4A4A',
}

const getUserName = (u: User): string => {
  if (u.parent)  return `${u.parent.firstName} ${u.parent.lastName}`
  if (u.teacher) return `${u.teacher.firstName} ${u.teacher.lastName}`
  if (u.student) return `${u.student.firstName} ${u.student.lastName}`
  if (u.staff)   return `${u.staff.firstName} ${u.staff.lastName}`
  return u.email.split('@')[0]
}

const generatePassword = (email: string, role: string): string => {
  const year      = new Date().getFullYear()
  const localPart = email.split('@')[0] || ''
  const last4     = localPart.slice(-4).toLowerCase()

  const prefixes: Record<string, string> = {
    PARENT:        'padre',
    TEACHER:       'maestro',
    TEACHER_TUTOR: 'maestro',
    SECRETARY:     'secretaria',
    STAFF:         'portero',
    DIRECTOR:      'director',
    REGENTE:       'regente',
    STUDENT:       'estudiante',
    DELEGATE:      'delegado',
    JUNTA_ESCOLAR: 'junta',
    SUPER_ADMIN:   'admin',
  }

  const prefix = prefixes[role] || 'usuario'
  return `${prefix}${last4}${year}`
}

export default function UsuariosPage() {
  const [users,          setUsers]          = useState<User[]>([])
  const [loading,        setLoading]        = useState(true)
  const [search,         setSearch]         = useState('')
  const [roleFilter,     setRoleFilter]     = useState('')
  const [showModal,      setShowModal]      = useState(false)
  const [saving,         setSaving]         = useState(false)
  const [error,          setError]          = useState('')
  const [success,        setSuccess]        = useState('')
  const [showPass,       setShowPass]       = useState(false)
  const [duplicateEmail, setDuplicateEmail] = useState<string | null>(null)
  const [form,           setForm]           = useState({ email: '', password: '', role: 'PARENT' })

  const [showResetModal,   setShowResetModal]   = useState(false)
  const [resetCredentials, setResetCredentials] = useState<{ email: string; password: string } | null>(null)
  const [copied,           setCopied]           = useState(false)
  const [showNewCreds,     setShowNewCreds]     = useState(false)
  const [newCredentials,   setNewCredentials]   = useState<{ email: string; password: string } | null>(null)
  const [copiedNew,        setCopiedNew]        = useState(false)

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : ''

  const notify = (msg: string, type: 'success' | 'error' = 'success') => {
    if (type === 'success') { setSuccess(msg); setTimeout(() => setSuccess(''), 3000) }
    else                    { setError(msg);   setTimeout(() => setError(''),   4000) }
  }

  const fetchUsers = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (search)     params.set('search', search)
      if (roleFilter) params.set('role', roleFilter)
      const res  = await fetch(`${API_URL}/api/users?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (res.ok) setUsers(data)
    } catch { setError('Error al cargar usuarios') }
    finally  { setLoading(false) }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchUsers() }, [])

  const openCreate = () => {
    setForm({ email: '', password: '', role: 'PARENT' })
    setShowPass(false)
    setError('')
    setDuplicateEmail(null)
    setShowModal(true)
  }

  const handleCreate = async () => {
    if (!form.email || !form.password) {
      notify('El correo y la contraseña son requeridos', 'error'); return
    }
    setError(''); setSaving(true)
    try {
      const res  = await fetch(`${API_URL}/api/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) {
        notify(data.message, 'error')
        if (res.status === 409) setDuplicateEmail(form.email)
        return
      }
      setShowModal(false)
      setNewCredentials({ email: form.email, password: form.password })
      setShowNewCreds(true)
      setForm({ email: '', password: '', role: 'PARENT' })
      fetchUsers()
    } catch { notify('Error de conexión', 'error') }
    finally  { setSaving(false) }
  }

  const handleResetByEmail = async () => {
    if (!duplicateEmail || !form.password) {
      notify('Ingresa una contraseña', 'error'); return
    }
    try {
      const res  = await fetch(`${API_URL}/api/users/reset-by-email`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ email: duplicateEmail, password: form.password }),
      })
      const data = await res.json()
      if (!res.ok) { notify(data.message, 'error'); return }
      setShowModal(false)
      setDuplicateEmail(null)
      setNewCredentials({ email: duplicateEmail, password: form.password })
      setShowNewCreds(true)
    } catch { notify('Error de conexión', 'error') }
  }

  const handleToggle = async (id: number) => {
    try {
      const res  = await fetch(`${API_URL}/api/users/${id}/toggle`, {
        method: 'PATCH', headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (res.ok) { notify(data.message); fetchUsers() }
    } catch { notify('Error al cambiar estado', 'error') }
  }

  const handleResetPassword = async (id: number) => {
    try {
      const res  = await fetch(`${API_URL}/api/users/${id}/reset-password`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (!res.ok) { notify(data.message, 'error'); return }
      setResetCredentials({ email: data.userEmail, password: data.newPassword })
      setShowResetModal(true)
    } catch { notify('Error al restablecer contraseña', 'error') }
  }

  const copyReset = () => {
    if (!resetCredentials) return
    navigator.clipboard.writeText(`Email: ${resetCredentials.email}\nContraseña: ${resetCredentials.password}`)
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }

  const copyNew = () => {
    if (!newCredentials) return
    navigator.clipboard.writeText(`Email: ${newCredentials.email}\nContraseña: ${newCredentials.password}`)
    setCopiedNew(true); setTimeout(() => setCopiedNew(false), 2000)
  }

  const filtered = users.filter(u => {
    const name = getUserName(u).toLowerCase()
    const q    = search.toLowerCase()
    return name.includes(q) || u.email.toLowerCase().includes(q)
  })

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Gestión de Usuarios</h1>
          <p>Administra los usuarios y roles del sistema</p>
        </div>
        <button className="btn-primary" onClick={openCreate}>
          <Plus size={16}/> Nuevo usuario
        </button>
      </div>

      {success && <div className="alert suc">{success}</div>}
      {error && !showModal && !showResetModal && <div className="alert err">{error}</div>}

      <div className="filters-bar">
        <div className="search-wrap">
          <Search size={15} className="sicon"/>
          <input placeholder="Buscar por nombre o correo..." value={search}
            onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && fetchUsers()}/>
        </div>
        <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)}>
          <option value="">Todos los roles</option>
          {Object.entries(roleLabels).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <button className="btn-outline" onClick={fetchUsers}><RefreshCw size={15}/> Buscar</button>
      </div>

      <div className="table-card">
        {loading ? (
          <div className="center-state"><div className="spinner"/><p>Cargando...</p></div>
        ) : filtered.length === 0 ? (
          <div className="center-state"><p>No se encontraron usuarios</p></div>
        ) : (
          <table>
            <thead>
              <tr><th>#</th><th>Nombre</th><th>Correo</th><th>Rol</th><th>Estado</th><th>Fecha</th><th>Acciones</th></tr>
            </thead>
            <tbody>
              {filtered.map((u, i) => (
                <tr key={u.id}>
                  <td className="muted">{i+1}</td>
                  <td><strong>{getUserName(u)}</strong></td>
                  <td className="muted">{u.email}</td>
                  <td>
                    <span className="rbadge" style={{ background: roleColors[u.role]+'18', color: roleColors[u.role] }}>
                      {roleLabels[u.role] || u.role}
                    </span>
                  </td>
                  <td><span className={`sbadge ${u.isActive ? 'act' : 'ina'}`}>{u.isActive ? 'Activo' : 'Inactivo'}</span></td>
                  <td className="muted">{new Date(u.createdAt).toLocaleDateString('es-BO')}</td>
                  <td>
                    <div className="actions">
                      <button className="abtn btn-reset" title="Restablecer contraseña" onClick={() => handleResetPassword(u.id)}>
                        <KeyRound size={14}/>
                      </button>
                      <button className={`abtn ${u.isActive ? 'dng' : 'suc'}`} title={u.isActive ? 'Desactivar' : 'Activar'} onClick={() => handleToggle(u.id)}>
                        {u.isActive ? <UserX size={14}/> : <UserCheck size={14}/>}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <div className="tfooter">Total: <strong>{filtered.length}</strong> usuarios</div>

      {/* ── Modal nuevo usuario ── */}
      {showModal && (
        <div className="overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="mhead">
              <h2>Nuevo Usuario</h2>
              <button onClick={() => setShowModal(false)}><X size={18}/></button>
            </div>
            <div className="mbody">
              {error && <div className="alert err">{error}</div>}

              <div className="fg">
                <label>Correo electrónico *</label>
                <input type="email" placeholder="usuario@nnuu.edu.bo" value={form.email}
                  onChange={e => { setForm({...form, email: e.target.value}); setDuplicateEmail(null) }}/>
              </div>

              <div className="fg">
                <label>Rol *</label>
                <select value={form.role} onChange={e => setForm({...form, role: e.target.value})}>
                  {Object.entries(roleLabels).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>

              <div className="fg">
                <label>Contraseña *</label>
                <div className="pwrap">
                  <input
                    type={showPass ? 'text' : 'password'}
                    placeholder="Escribe o genera automáticamente"
                    value={form.password}
                    onChange={e => setForm({...form, password: e.target.value})}
                  />
                  <button type="button" title="Mostrar/ocultar" onClick={() => setShowPass(!showPass)}>
                    {showPass ? <EyeOff size={14}/> : <Eye size={14}/>}
                  </button>
                </div>
                <button type="button" className="gen-pwd-btn" onClick={() => {
                  if (!form.email) { notify('Ingresa el correo primero', 'error'); return }
                  const pwd = generatePassword(form.email, form.role)
                  setForm({...form, password: pwd})
                  setShowPass(true)
                }}>
                  <RefreshCw size={12}/> Generar contraseña automática
                </button>
                {form.password && (
                  <div className="pwd-strength">
                    <span className={`strength-bar ${form.password.length >= 8 ? 'good' : 'weak'}`}/>
                    <span className="strength-label">
                      {form.password.length < 6 ? 'Muy corta' : form.password.length < 8 ? 'Aceptable' : 'Segura'}
                    </span>
                  </div>
                )}
              </div>

              {/* Aviso de email duplicado */}
              {duplicateEmail && (
                <div className="warn-box">
                  ⚠️ Este correo ya está registrado. ¿Deseas resetear su contraseña con la que ingresaste?
                  <button className="link-btn" onClick={handleResetByEmail}>
                    Sí, resetear contraseña →
                  </button>
                </div>
              )}

              <div className="infobox">
                💡 Después de crear el usuario podrás vincularle el perfil correspondiente desde el módulo respectivo.
              </div>
            </div>
            <div className="mfoot">
              <button className="btn-outline" onClick={() => setShowModal(false)}>Cancelar</button>
              <button className="btn-primary" onClick={handleCreate} disabled={saving || !form.email || !form.password}>
                {saving ? <span className="spinsm"/> : <Plus size={14}/>}
                {saving ? 'Guardando...' : 'Crear usuario'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal credenciales nuevo usuario ── */}
      {showNewCreds && newCredentials && (
        <div className="overlay">
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="mhead"><h2>✅ Credenciales del usuario</h2></div>
            <div className="mbody">
              <div className="cred-box">
                <div className="cred-note green">✅ Operación realizada correctamente. Anota estas credenciales.</div>
                <div className="cred-row">
                  <span className="cred-label">Email:</span>
                  <span className="cred-value">{newCredentials.email}</span>
                </div>
                <div className="cred-row">
                  <span className="cred-label">Contraseña:</span>
                  <span className="cred-value">{newCredentials.password}</span>
                </div>
                <div className="cred-note">⚠️ Esta es la única vez que verás la contraseña. Cópiala antes de cerrar.</div>
              </div>
            </div>
            <div className="mfoot">
              <button className="btn-outline" onClick={copyNew}>
                {copiedNew ? <Check size={14}/> : <Copy size={14}/>}
                {copiedNew ? 'Copiado' : 'Copiar'}
              </button>
              <button className="btn-primary" onClick={() => setShowNewCreds(false)}>Entendido</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal resetear contraseña ── */}
      {showResetModal && resetCredentials && (
        <div className="overlay">
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="mhead"><h2>🔑 Nueva contraseña generada</h2></div>
            <div className="mbody">
              <div className="cred-box">
                <div className="cred-row">
                  <span className="cred-label">Email:</span>
                  <span className="cred-value">{resetCredentials.email}</span>
                </div>
                <div className="cred-row">
                  <span className="cred-label">Contraseña:</span>
                  <span className="cred-value">{resetCredentials.password}</span>
                </div>
                <div className="cred-note">⚠️ Comunica esta contraseña al usuario. No se podrá ver de nuevo.</div>
              </div>
            </div>
            <div className="mfoot">
              <button className="btn-outline" onClick={copyReset}>
                {copied ? <Check size={14}/> : <Copy size={14}/>}
                {copied ? 'Copiado' : 'Copiar'}
              </button>
              <button className="btn-primary" onClick={() => setShowResetModal(false)}>Entendido</button>
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
        .filters-bar{display:flex;gap:10px;margin-bottom:16px;flex-wrap:wrap}
        .search-wrap{position:relative;flex:1;min-width:200px}
        .sicon{position:absolute;left:11px;top:50%;transform:translateY(-50%);color:#4A9FD4;pointer-events:none}
        .search-wrap input{width:100%;padding:9px 12px 9px 34px;border:1.5px solid #CBE0F0;border-radius:8px;font-size:13px;outline:none;color:#1A3A7C}
        .search-wrap input:focus{border-color:#4A9FD4}
        .filters-bar select{padding:9px 12px;border:1.5px solid #CBE0F0;border-radius:8px;font-size:13px;outline:none;color:#1A3A7C;cursor:pointer}
        .btn-primary{display:flex;align-items:center;gap:6px;padding:9px 16px;background:#1A3A7C;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:500;cursor:pointer;white-space:nowrap}
        .btn-primary:hover:not(:disabled){background:#4A9FD4}
        .btn-primary:disabled{opacity:.6;cursor:not-allowed}
        .btn-outline{display:flex;align-items:center;gap:6px;padding:9px 14px;background:#fff;color:#1A3A7C;border:1.5px solid #CBE0F0;border-radius:8px;font-size:13px;cursor:pointer;white-space:nowrap}
        .btn-outline:hover{background:#F0F6FC}
        .table-card{background:#fff;border:1px solid #CBE0F0;border-radius:12px;overflow:hidden}
        table{width:100%;border-collapse:collapse}
        thead tr{background:#F0F6FC}
        th{padding:11px 14px;text-align:left;font-size:11px;font-weight:600;color:#1A3A7C;text-transform:uppercase;letter-spacing:.5px;white-space:nowrap}
        td{padding:12px 14px;font-size:13px;color:#1A3A7C;border-top:1px solid #F0F6FC}
        tr:hover td{background:#FAFCFF}
        .muted{color:#6B8BB0}
        .rbadge{padding:3px 9px;border-radius:20px;font-size:11px;font-weight:500;white-space:nowrap}
        .sbadge{padding:3px 9px;border-radius:20px;font-size:11px;font-weight:500}
        .sbadge.act{background:#E1F5EE;color:#0F6E56}
        .sbadge.ina{background:#FFF0F0;color:#C0392B}
        .actions{display:flex;gap:6px}
        .abtn{width:30px;height:30px;border:none;border-radius:6px;cursor:pointer;display:flex;align-items:center;justify-content:center}
        .abtn.dng{background:#FFF0F0;color:#C0392B}
        .abtn.suc{background:#E1F5EE;color:#0F6E56}
        .abtn.btn-reset{background:#EEEDFE;color:#3C3489}
        .abtn:hover{opacity:.75}
        .tfooter{padding:10px 14px;font-size:12px;color:#6B8BB0}
        .center-state{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:48px;gap:12px;color:#6B8BB0;font-size:13px}
        .overlay{position:fixed;inset:0;background:rgba(0,0,0,0.4);z-index:500;display:flex;align-items:center;justify-content:center;padding:16px}
        .modal{background:#fff;border-radius:14px;width:100%;max-width:440px;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,0.15);max-height:90vh;display:flex;flex-direction:column}
        .mhead{display:flex;align-items:center;justify-content:space-between;padding:18px 20px;border-bottom:1px solid #CBE0F0;flex-shrink:0}
        .mhead h2{font-size:16px;font-weight:600;color:#1A3A7C}
        .mhead button{background:none;border:none;cursor:pointer;color:#6B8BB0;display:flex;padding:4px;border-radius:6px}
        .mhead button:hover{background:#F0F6FC;color:#1A3A7C}
        .mbody{padding:20px;display:flex;flex-direction:column;gap:16px;overflow-y:auto}
        .mfoot{display:flex;justify-content:flex-end;gap:10px;padding:16px 20px;border-top:1px solid #CBE0F0;flex-shrink:0}
        .fg{display:flex;flex-direction:column;gap:6px}
        .fg label{font-size:11px;font-weight:700;color:#1A3A7C;text-transform:uppercase;letter-spacing:.6px}
        .fg input,.fg select{padding:10px 12px;border:1.5px solid #CBE0F0;border-radius:8px;font-size:13px;color:#1A3A7C;outline:none;width:100%}
        .fg input:focus,.fg select:focus{border-color:#4A9FD4;box-shadow:0 0 0 3px rgba(74,159,212,.12)}
        .pwrap{position:relative;display:flex;align-items:center}
        .pwrap input{flex:1;padding-right:40px}
        .pwrap button{position:absolute;right:10px;background:none;border:none;cursor:pointer;color:#6B8BB0;display:flex}
        .pwrap button:hover{color:#1A3A7C}
        .gen-pwd-btn{display:flex;align-items:center;gap:5px;background:none;border:1px dashed #CBE0F0;color:#4A9FD4;border-radius:6px;padding:6px 10px;font-size:11px;cursor:pointer;width:fit-content;transition:all .15s}
        .gen-pwd-btn:hover{background:#F0F6FC;border-color:#4A9FD4}
        .pwd-strength{display:flex;align-items:center;gap:8px;margin-top:2px}
        .strength-bar{height:4px;width:60px;border-radius:4px}
        .strength-bar.weak{background:#F5C518}
        .strength-bar.good{background:#0F6E56}
        .strength-label{font-size:11px;color:#6B8BB0}
        .warn-box{background:#FFFBEA;border:1px solid #F5C518;border-radius:8px;padding:12px 14px;font-size:13px;color:#BA7517;line-height:1.6;display:flex;flex-direction:column;gap:8px}
        .link-btn{background:#1A3A7C;color:#fff;border:none;border-radius:6px;padding:6px 12px;font-size:12px;font-weight:500;cursor:pointer;width:fit-content}
        .link-btn:hover{background:#4A9FD4}
        .infobox{background:#F0F6FC;border:1px solid #CBE0F0;border-radius:8px;padding:12px;font-size:12px;color:#6B8BB0;line-height:1.5}
        .cred-box{display:flex;flex-direction:column;gap:10px}
        .cred-row{display:flex;align-items:center;gap:10px;background:#F0F6FC;border:1px solid #CBE0F0;border-radius:8px;padding:10px 14px}
        .cred-label{font-size:12px;font-weight:600;color:#6B8BB0;min-width:80px;text-transform:uppercase;letter-spacing:.5px}
        .cred-value{font-size:14px;font-weight:600;color:#1A3A7C;font-family:monospace;word-break:break-all}
        .cred-note{font-size:12px;color:#BA7517;background:#FFFBEA;border:1px solid #F5C518;border-radius:8px;padding:10px;line-height:1.5}
        .cred-note.green{background:#E1F5EE;border-color:#9FE1CB;color:#0F6E56}
        .spinner{width:20px;height:20px;border:2px solid rgba(26,58,124,.2);border-top-color:#1A3A7C;border-radius:50%;animation:spin .7s linear infinite}
        .spinsm{width:14px;height:14px;border:2px solid rgba(255,255,255,.3);border-top-color:#fff;border-radius:50%;animation:spin .7s linear infinite;display:inline-block}
        @keyframes spin{to{transform:rotate(360deg)}}
        @media(max-width:600px){.page-header{flex-direction:column}th:nth-child(6),td:nth-child(6){display:none}}
      `}</style>
    </div>
  )
}