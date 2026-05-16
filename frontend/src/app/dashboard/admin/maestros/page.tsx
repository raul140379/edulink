'use client'

import { useEffect, useState } from 'react'
import { Plus, Search, X, Edit, Eye, UserCheck, UserX, Trash2, Copy, Check } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface Teacher {
  id:        number
  firstName: string
  lastName:  string
  ci?:       string
  phone?:    string
  email?:    string
  specialty?: string
  isActive:  boolean
  user?:     { id: number; email: string; role: string; isActive: boolean }
  _count:    { assignments: number }
}

interface Credentials {
  accessEmail: string; defaultPassword: string; hint: string; name: string
}

const emptyForm = {
  firstName: '', lastName: '', ci: '', phone: '', email: '', specialty: '',
}

export default function MaestrosPage() {
  const router = useRouter()
  const [teachers,     setTeachers]     = useState<Teacher[]>([])
  const [loading,      setLoading]      = useState(true)
  const [search,       setSearch]       = useState('')
  const [filterActive, setFilterActive] = useState('')
  const [showModal,       setShowModal]       = useState(false)
  const [showCredentials, setShowCredentials] = useState(false)
  const [editMode,     setEditMode]     = useState(false)
  const [editId,       setEditId]       = useState<number | null>(null)
  const [saving,       setSaving]       = useState(false)
  const [success,      setSuccess]      = useState('')
  const [error,        setError]        = useState('')
  const [form,         setForm]         = useState(emptyForm)
  const [creds,        setCreds]        = useState<Credentials | null>(null)
  const [copied,       setCopied]       = useState(false)

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : ''

  const notify = (msg: string, type: 'success' | 'error' = 'success') => {
    if (type === 'success') { setSuccess(msg); setTimeout(() => setSuccess(''), 3000) }
    else                    { setError(msg);   setTimeout(() => setError(''),   4000) }
  }

  const fetchTeachers = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (search)       params.set('search', search)
      if (filterActive) params.set('isActive', filterActive)
      const res  = await fetch(`http://localhost:4000/api/teachers?${params}`, { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      if (res.ok) setTeachers(data)
      else notify('Error al cargar maestros', 'error')
    } catch { notify('Error de conexión', 'error') }
    finally  { setLoading(false) }
  }

  useEffect(() => { fetchTeachers() }, [])

  const openCreate = () => { setEditMode(false); setEditId(null); setForm(emptyForm); setError(''); setShowModal(true) }

  const openEdit = (t: Teacher) => {
    setEditMode(true); setEditId(t.id)
    setForm({
      firstName: t.firstName, lastName: t.lastName,
      ci: t.ci || '', phone: t.phone || '',
      email: t.email || '', specialty: t.specialty || '',
    })
    setError(''); setShowModal(true)
  }

  const handleSave = async () => {
    setError(''); setSaving(true)
    try {
      const url    = editMode ? `http://localhost:4000/api/teachers/${editId}` : 'http://localhost:4000/api/teachers'
      const method = editMode ? 'PUT' : 'POST'
      const res    = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) { notify(data.message, 'error'); return }
      setShowModal(false); fetchTeachers()
      if (!editMode && data.accessEmail) {
        setCreds({
          accessEmail:     data.accessEmail,
          defaultPassword: data.defaultPassword,
          hint:            data.passwordHint,
          name:            `${form.firstName} ${form.lastName}`,
        })
        setShowCredentials(true)
      } else {
        notify('Maestro actualizado correctamente')
      }
    } catch { notify('Error de conexión', 'error') }
    finally  { setSaving(false) }
  }

  const handleToggle = async (id: number) => {
    try {
      const res  = await fetch(`http://localhost:4000/api/teachers/${id}/toggle`, { method: 'PATCH', headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      if (res.ok) { notify(data.message); fetchTeachers() }
      else notify(data.message, 'error')
    } catch { notify('Error al cambiar estado', 'error') }
  }

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`¿Eliminar al maestro ${name}?`)) return
    try {
      const res  = await fetch(`http://localhost:4000/api/teachers/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      if (res.ok) { notify(data.message); fetchTeachers() }
      else notify(data.message, 'error')
    } catch { notify('Error al eliminar', 'error') }
  }

  const copyCreds = () => {
    if (!creds) return
    navigator.clipboard.writeText(`Maestro: ${creds.name}\nEmail: ${creds.accessEmail}\nContraseña: ${creds.defaultPassword}`)
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Gestión de Maestros</h1>
          <p>Registro y administración del personal docente</p>
        </div>
        <button className="btn-primary" onClick={openCreate}><Plus size={16}/> Nuevo maestro</button>
      </div>

      {success && <div className="alert suc">{success}</div>}
      {error && !showModal && <div className="alert err">{error}</div>}

      {/* Filtros */}
      <div className="filters-bar">
        <div className="search-wrap">
          <Search size={14} className="sicon"/>
          <input placeholder="Buscar por nombre, CI o especialidad..." value={search}
            onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && fetchTeachers()}/>
        </div>
        <select value={filterActive} onChange={e => setFilterActive(e.target.value)}>
          <option value="">Todos</option>
          <option value="true">Activos</option>
          <option value="false">Inactivos</option>
        </select>
        <button className="btn-outline" onClick={fetchTeachers}>Buscar</button>
      </div>

      {/* Tabla */}
      <div className="table-card">
        {loading ? (
          <div className="center-state"><div className="spinner"/><p>Cargando...</p></div>
        ) : teachers.length === 0 ? (
          <div className="center-state"><p>No se encontraron maestros</p></div>
        ) : (
          <table>
            <thead>
              <tr><th>#</th><th>Nombre completo</th><th>CI</th><th>Especialidad</th><th>Teléfono</th><th>Materias</th><th>Estado</th><th>Acciones</th></tr>
            </thead>
            <tbody>
              {teachers.map((t, i) => (
                <tr key={t.id}>
                  <td className="muted">{i + 1}</td>
                  <td>
                    <div className="tname">{t.lastName} {t.firstName}</div>
                    {t.user && <div className="tuser">{t.user.email}</div>}
                  </td>
                  <td className="muted">{t.ci || '—'}</td>
                  <td className="muted">{t.specialty || '—'}</td>
                  <td className="muted">{t.phone || '—'}</td>
                  <td>
                    <span className="count-badge">{t._count.assignments} asig.</span>
                  </td>
                  <td>
                    <span className={`sbadge ${t.isActive ? 'act' : 'ina'}`}>
                      {t.isActive ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td>
                    <div className="actions">
                      <button className="icon-btn view" title="Ver detalle" onClick={() => router.push(`/dashboard/admin/maestros/${t.id}`)}><Eye size={13}/></button>
                      <button className="icon-btn edit" title="Editar" onClick={() => openEdit(t)}><Edit size={13}/></button>
                      <button className={`icon-btn ${t.isActive ? 'deact' : 'act2'}`} title={t.isActive ? 'Desactivar' : 'Activar'} onClick={() => handleToggle(t.id)}>
                        {t.isActive ? <UserX size={13}/> : <UserCheck size={13}/>}
                      </button>
                      <button className="icon-btn del" title="Eliminar" onClick={() => handleDelete(t.id, `${t.firstName} ${t.lastName}`)}><Trash2 size={13}/></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <div className="tfooter">Total: <strong>{teachers.length}</strong> maestros</div>

      {/* Modal crear/editar */}
      {showModal && (
        <div className="overlay" onClick={() => setShowModal(false)}>
          <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
            <div className="mhead">
              <h2>{editMode ? 'Editar Maestro' : 'Nuevo Maestro'}</h2>
              <button onClick={() => setShowModal(false)}><X size={18}/></button>
            </div>
            <div className="mbody">
              {error && <div className="alert err">{error}</div>}
              {!editMode && (
                <div className="info-box">
                  🔑 El sistema generará automáticamente un email y contraseña de acceso.<br/>
                  Si el maestro tiene correo propio, úsalo y el sistema solo generará la contraseña.
                </div>
              )}
              <div className="section-lbl">Datos personales</div>
              <div className="form-grid">
                <div className="fg"><label>Nombres *</label>
                  <input type="text" placeholder="Ej: Juan Carlos" value={form.firstName} onChange={e => setForm({...form, firstName: e.target.value})}/></div>
                <div className="fg"><label>Apellidos *</label>
                  <input type="text" placeholder="Ej: García López" value={form.lastName} onChange={e => setForm({...form, lastName: e.target.value})}/></div>
                <div className="fg"><label>CI</label>
                  <input type="text" placeholder="Ej: 12345678" value={form.ci} onChange={e => setForm({...form, ci: e.target.value})}/></div>
                <div className="fg"><label>Teléfono</label>
                  <input type="text" placeholder="Ej: 70012345" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})}/></div>
                <div className="fg"><label>Correo electrónico</label>
                  <input type="email" placeholder="Ej: maestro@gmail.com (opcional)" value={form.email} onChange={e => setForm({...form, email: e.target.value})}/></div>
                <div className="fg"><label>Especialidad</label>
                  <input type="text" placeholder="Ej: Matemáticas, Lenguaje..." value={form.specialty} onChange={e => setForm({...form, specialty: e.target.value})}/></div>
              </div>
            </div>
            <div className="mfoot">
              <button className="btn-outline" onClick={() => setShowModal(false)}>Cancelar</button>
              <button className="btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? <span className="spinsm"/> : editMode ? <Edit size={14}/> : <Plus size={14}/>}
                {saving ? 'Guardando...' : editMode ? 'Actualizar' : 'Registrar maestro'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal credenciales */}
      {showCredentials && creds && (
        <div className="overlay">
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="mhead"><h2>✅ Maestro registrado</h2></div>
            <div className="mbody">
              <div className="cred-box">
                <p className="cred-title">Credenciales de acceso para:</p>
                <p className="cred-name">{creds.name}</p>
                <div className="cred-row"><span className="cred-label">Email:</span><span className="cred-value">{creds.accessEmail}</span></div>
                <div className="cred-row"><span className="cred-label">Contraseña:</span><span className="cred-value">{creds.defaultPassword}</span></div>
                <div className="cred-hint">💡 {creds.hint}</div>
                <div className="cred-note">⚠️ Anota estas credenciales. La contraseña no se podrá ver de nuevo.</div>
              </div>
            </div>
            <div className="mfoot">
              <button className="btn-outline" onClick={copyCreds}>
                {copied ? <Check size={14}/> : <Copy size={14}/>}
                {copied ? 'Copiado' : 'Copiar credenciales'}
              </button>
              <button className="btn-primary" onClick={() => setShowCredentials(false)}>Entendido</button>
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
        td{padding:11px 14px;font-size:13px;color:#1A3A7C;border-top:1px solid #F0F6FC}
        tr:hover td{background:#FAFCFF}
        .muted{color:#6B8BB0;font-size:12px}
        .tname{font-weight:500;color:#1A3A7C}
        .tuser{font-size:11px;color:#6B8BB0;margin-top:2px}
        .count-badge{background:#E0ECF8;color:#1A3A7C;padding:2px 8px;border-radius:20px;font-size:11px;font-weight:500}
        .sbadge{padding:3px 9px;border-radius:20px;font-size:11px;font-weight:500}
        .sbadge.act{background:#E1F5EE;color:#0F6E56}
        .sbadge.ina{background:#FFF0F0;color:#C0392B}
        .actions{display:flex;gap:5px}
        .icon-btn{width:28px;height:28px;border:none;border-radius:6px;cursor:pointer;display:flex;align-items:center;justify-content:center}
        .icon-btn.view{background:#E0ECF8;color:#1A3A7C}
        .icon-btn.edit{background:#FAEEDA;color:#633806}
        .icon-btn.deact{background:#FFF0F0;color:#C0392B}
        .icon-btn.act2{background:#E1F5EE;color:#0F6E56}
        .icon-btn.del{background:#FFF0F0;color:#C0392B}
        .icon-btn:hover{opacity:.75}
        .tfooter{padding:10px 14px;font-size:12px;color:#6B8BB0}
        .center-state{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:48px;gap:12px;color:#6B8BB0;font-size:13px}
        .overlay{position:fixed;inset:0;background:rgba(0,0,0,0.4);z-index:500;display:flex;align-items:center;justify-content:center;padding:16px}
        .modal{background:#fff;border-radius:14px;width:100%;max-width:440px;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,0.15);max-height:90vh;display:flex;flex-direction:column}
        .modal-lg{max-width:620px}
        .mhead{display:flex;align-items:center;justify-content:space-between;padding:18px 20px;border-bottom:1px solid #CBE0F0;flex-shrink:0}
        .mhead h2{font-size:16px;font-weight:600;color:#1A3A7C}
        .mhead button{background:none;border:none;cursor:pointer;color:#6B8BB0;display:flex;padding:4px;border-radius:6px}
        .mhead button:hover{background:#F0F6FC;color:#1A3A7C}
        .mbody{padding:20px;display:flex;flex-direction:column;gap:14px;overflow-y:auto}
        .mfoot{display:flex;justify-content:flex-end;gap:10px;padding:16px 20px;border-top:1px solid #CBE0F0;flex-shrink:0}
        .section-lbl{font-size:12px;font-weight:700;color:#1A3A7C;text-transform:uppercase;letter-spacing:.6px;padding-bottom:4px;border-bottom:1px solid #F0F6FC}
        .form-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
        .fg{display:flex;flex-direction:column;gap:5px}
        .fg label{font-size:11px;font-weight:600;color:#1A3A7C;text-transform:uppercase;letter-spacing:.5px}
        .fg input{padding:9px 12px;border:1.5px solid #CBE0F0;border-radius:8px;font-size:13px;color:#1A3A7C;outline:none}
        .fg input:focus{border-color:#4A9FD4;box-shadow:0 0 0 3px rgba(74,159,212,.12)}
        .info-box{background:#F0F6FC;border:1px solid #CBE0F0;border-radius:8px;padding:12px;font-size:12px;color:#6B8BB0;line-height:1.6}
        .cred-box{display:flex;flex-direction:column;gap:10px}
        .cred-title{font-size:13px;color:#6B8BB0}
        .cred-name{font-size:16px;font-weight:700;color:#1A3A7C}
        .cred-row{display:flex;align-items:center;gap:10px;background:#F0F6FC;border:1px solid #CBE0F0;border-radius:8px;padding:10px 14px}
        .cred-label{font-size:12px;font-weight:600;color:#6B8BB0;min-width:80px;text-transform:uppercase;letter-spacing:.5px}
        .cred-value{font-size:14px;font-weight:600;color:#1A3A7C;font-family:monospace;word-break:break-all}
        .cred-hint{font-size:12px;color:#0F6E56;background:#E1F5EE;border:1px solid #9FE1CB;border-radius:8px;padding:10px}
        .cred-note{font-size:12px;color:#BA7517;background:#FFFBEA;border:1px solid #F5C518;border-radius:8px;padding:10px;line-height:1.5}
        .spinner{width:20px;height:20px;border:2px solid rgba(26,58,124,.2);border-top-color:#1A3A7C;border-radius:50%;animation:spin .7s linear infinite}
        .spinsm{width:14px;height:14px;border:2px solid rgba(255,255,255,.3);border-top-color:#fff;border-radius:50%;animation:spin .7s linear infinite;display:inline-block}
        @keyframes spin{to{transform:rotate(360deg)}}
        @media(max-width:600px){.page-header{flex-direction:column}.form-grid{grid-template-columns:1fr}}
      `}</style>
    </div>
  )
}