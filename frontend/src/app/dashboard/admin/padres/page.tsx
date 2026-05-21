'use client'

import { useEffect, useState } from 'react'
import { Plus, Search, X, Edit, Eye, UserCheck, UserX, Trash2, KeyRound, Copy, Check, Link } from 'lucide-react'
import { useRouter } from 'next/navigation'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

interface Student {
  id: number; firstName: string; lastName: string; ci?: string; rude?: string; kardex?: string
}

interface ParentStudent {
  relationType: string
  isTutor:      boolean
  student:      Student
}

interface Parent {  
  id:        number
  firstName: string
  lastName:  string
  ci?:       string
  phone?:    string
  email?:    string
  address?:  string
  user?:     { id: number; email: string; isActive: boolean }
  students:  ParentStudent[]
  _count:    { students: number }
}

interface Credentials {
  accessEmail: string; defaultPassword: string; name: string
}

const RELATION_TYPES = [
  { value: 'PADRE',       label: 'Padre' },
  { value: 'MADRE',       label: 'Madre' },
  { value: 'TUTOR_LEGAL', label: 'Tutor Legal' },
  { value: 'OTRO',        label: 'Otro' },
]

const relLabel = (v: string, isTutor?: boolean) => {
  if (isTutor) {
    if (v === 'PADRE')  return 'Padre · Tutor Legal'
    if (v === 'MADRE')  return 'Madre · Tutora Legal'
    return 'Tutor Legal'
  }
  return RELATION_TYPES.find(r => r.value === v)?.label || v
}
const relColor: Record<string, string> = {
  PADRE: '#1A3A7C', MADRE: '#0F6E56', TUTOR_LEGAL: '#712B13', OTRO: '#444441'
}

const emptyForm = {
  firstName: '', lastName: '', ci: '', phone: '', email: '', address: '',
  relationType: 'PADRE', studentIds: [] as number[],
}

export default function PadresPage() {
  const router = useRouter()
  const [parents,    setParents]    = useState<Parent[]>([])
  const [students,   setStudents]   = useState<Student[]>([])
  const [loading,    setLoading]    = useState(true)
  const [search,     setSearch]     = useState('')
  const [showModal,           setShowModal]           = useState(false)
  const [showLinkModal,       setShowLinkModal]       = useState(false)
  const [showCredentials,     setShowCredentials]     = useState(false)
  const [showChangeRelModal,  setShowChangeRelModal]  = useState(false)
  const [editMode,   setEditMode]   = useState(false)
  const [editId,     setEditId]     = useState<number | null>(null)
  const [linkId,     setLinkId]     = useState<number | null>(null)
  const [saving,     setSaving]     = useState(false)
  const [success,    setSuccess]    = useState('')
  const [error,      setError]      = useState('')
  const [form,       setForm]       = useState(emptyForm)
  const [creds,      setCreds]      = useState<Credentials | null>(null)
  const [copied,     setCopied]     = useState(false)
  const [linkStudentIds,  setLinkStudentIds]  = useState<number[]>([])
  const [linkRelType,     setLinkRelType]     = useState('PADRE')
  const [changeRelParentId,  setChangeRelParentId]  = useState<number | null>(null)
  const [changeRelStudentId, setChangeRelStudentId] = useState<number | null>(null)
  const [changeRelType,      setChangeRelType]      = useState('PADRE')
  const [currentRelType,     setCurrentRelType]     = useState('')
  const [showImportModal, setShowImportModal] = useState(false)
  const [importing,       setImporting]       = useState(false)
  const [importResult,    setImportResult]    = useState<any>(null)
  const [linkSearch, setLinkSearch] = useState('')
  const [changeIsTutor, setChangeIsTutor] = useState(false)
  const [filterTutor, setFilterTutor] = useState('')
  const [orderBy, setOrderBy] = useState('alfabetico')

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : ''

  const notify = (msg: string, type: 'success' | 'error' = 'success') => {
    if (type === 'success') { setSuccess(msg); setTimeout(() => setSuccess(''), 3000) }
    else                    { setError(msg);   setTimeout(() => setError(''),   4000) }
  }

  const fetchParents = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      if (filterTutor === 'TUTOR') params.set('isTutor', 'true')
      const res  = await fetch(`${API_URL}/api/parents?${params}`, { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      if (res.ok) {
        const sorted = data.sort((a: any, b: any) => {
       if (orderBy === 'kardex') {
          const kardexA = a.students.find((s: any) => s.isTutor)?.student?.kardex || '9999'
          const kardexB = b.students.find((s: any) => s.isTutor)?.student?.kardex || '9999'
          return kardexA.toString().localeCompare(kardexB.toString(), undefined, { numeric: true })
        }
      return `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`)
  })
  setParents(sorted)
}
      else notify('Error al cargar padres', 'error')
    } catch { notify('Error de conexión', 'error') }
    finally  { setLoading(false) }
  }

  const fetchStudents = async () => {
    try {
      const res  = await fetch(`${API_URL}/api/students`, { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      if (res.ok) setStudents(data)
    } catch { console.error('Error') }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchParents(); fetchStudents() }, [])

  const openCreate = () => { setEditMode(false); setEditId(null); setForm(emptyForm); setError(''); setShowModal(true) }

  const openEdit = (p: Parent) => {
    setEditMode(true); setEditId(p.id)
    setForm({ firstName: p.firstName, lastName: p.lastName, ci: p.ci || '', phone: p.phone || '', email: p.email || '', address: p.address || '', relationType: 'PADRE', studentIds: [] })
    setError(''); setShowModal(true)
  }

  const openLink = (id: number) => { setLinkId(id); setLinkStudentIds([]); setLinkRelType('PADRE'); setError(''); setShowLinkModal(true) }

  const openChangeRel = (parentId: number, studentId: number, currentRel: string, isTutor: boolean) => {
  setChangeRelParentId(parentId)
  setChangeRelStudentId(studentId)
  setCurrentRelType(currentRel)
  setChangeRelType(currentRel)
  setChangeIsTutor(isTutor)
  setError('')
  setShowChangeRelModal(true)
}

  const handleSave = async () => {
    setError(''); setSaving(true)
    try {
      const url    = editMode ? `${API_URL}/api/parents/${editId}` : `${API_URL}/api/parents`
      const method = editMode ? 'PUT' : 'POST'
      const res    = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) { notify(data.message, 'error'); return }
      setShowModal(false); fetchParents()
      if (!editMode && data.accessEmail) {
        setCreds({ accessEmail: data.accessEmail, defaultPassword: data.defaultPassword, name: `${form.firstName} ${form.lastName}` })
        setShowCredentials(true)
      } else { notify(editMode ? 'Actualizado correctamente' : 'Registrado correctamente') }
    } catch { notify('Error de conexión', 'error') }
    finally  { setSaving(false) }
  }

  const handleLink = async () => {
    if (linkStudentIds.length === 0) { notify('Selecciona al menos un estudiante', 'error'); return }
    setError(''); setSaving(true)
    try {
      const res  = await fetch(`${API_URL}/api/parents/${linkId}/link-students`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ studentIds: linkStudentIds, relationType: linkRelType }),
      })
      const data = await res.json()
      if (!res.ok) { notify(data.message, 'error'); return }
      notify(data.message); setShowLinkModal(false); fetchParents()
    } catch { notify('Error de conexión', 'error') }
    finally  { setSaving(false) }
  }

  const handleChangeRel = async () => {
  if (!changeRelParentId || !changeRelStudentId) return
  setError(''); setSaving(true)
  try {
    const res  = await fetch(`${API_URL}/api/parents/${changeRelParentId}/change-relation/${changeRelStudentId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ relationType: changeRelType, isTutor: changeIsTutor }),
    })
    const data = await res.json()
    if (!res.ok) { notify(data.message, 'error'); return }
    setShowChangeRelModal(false)
    fetchParents()
    if (data.accessEmail) {
      setCreds({ accessEmail: data.accessEmail, defaultPassword: data.defaultPassword, name: '' })
      setShowCredentials(true)
    } else {
      notify(data.message)
    }
  } catch { notify('Error de conexión', 'error') }
  finally  { setSaving(false) }
}

  const handleUnlink = async (parentId: number, studentId: number) => {
    if (!confirm('¿Desvincular este estudiante?')) return
    try {
      const res  = await fetch(`${API_URL}/api/parents/${parentId}/unlink/${studentId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      if (res.ok) { notify(data.message); fetchParents() }
      else notify(data.message, 'error')
    } catch { notify('Error al desvincular', 'error') }
  }

  const handleToggle = async (id: number) => {
    try {
      const res  = await fetch(`${API_URL}/api/parents/${id}/toggle`, { method: 'PATCH', headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      if (res.ok) { notify(data.message); fetchParents() }
      else notify(data.message, 'error')
    } catch { notify('Error al cambiar estado', 'error') }
  }

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`¿Eliminar a ${name}?`)) return
    try {
      const res  = await fetch(`${API_URL}/api/parents/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      if (res.ok) { notify(data.message); fetchParents() }
      else notify(data.message, 'error')
    } catch { notify('Error al eliminar', 'error') }
  }

  const handleGenerateCreds = async (id: number, name: string) => {
    try {
      const res  = await fetch(`${API_URL}/api/parents/${id}/generate-credentials`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      if (!res.ok) { notify(data.message, 'error'); return }
      setCreds({ accessEmail: data.accessEmail, defaultPassword: data.defaultPassword, name })
      setShowCredentials(true); fetchParents()
    } catch { notify('Error al generar credenciales', 'error') }
  }

  const copyCreds = () => {
    if (!creds) return
    navigator.clipboard.writeText(`Nombre: ${creds.name}\nEmail: ${creds.accessEmail}\nContraseña: ${creds.defaultPassword}`)
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }
  const handleImportParents = async (file: File) => {
  setImporting(true)
  try {
    const formData = new FormData()
    formData.append('file', file)
    const res  = await fetch(`${API_URL}/api/parents/import`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    })
    const data = await res.json()
    setImportResult(data)
    if (res.ok) fetchParents()
  } catch { notify('Error al importar', 'error') }
  finally  { setImporting(false) }
}
  const toggleLink = (id: number) => setLinkStudentIds(p => p.includes(id) ? p.filter(s => s !== id) : [...p, id])
  const toggleForm = (id: number) => setForm(p => ({ ...p, studentIds: p.studentIds.includes(id) ? p.studentIds.filter(s => s !== id) : [...p.studentIds, id] }))

  const isTutorLegalSinAcceso = (p: Parent) => !p.user && p.students.some(s => s.relationType === 'TUTOR_LEGAL')

  return (
    <div>
      <div className="page-header">
        <div><h1>Padres y Tutores</h1><p>Registro y vinculación con estudiantes</p></div>
        <div style={{display:'flex', gap:'8px'}}>
       <button className="btn-outline" onClick={() => { setShowImportModal(true); setImportResult(null) }}>
      📥 Importar Excel
    </button>
        <button className="btn-primary" onClick={openCreate}><Plus size={16}/> Nuevo padre/tutor</button>
</div>
        <button className="btn-primary" onClick={openCreate}><Plus size={16}/> Nuevo padre/tutor</button>
      </div>

      {success && <div className="alert suc">{success}</div>}
      {error && !showModal && !showLinkModal && !showChangeRelModal && <div className="alert err">{error}</div>}

      <div className="filters-bar">
        <div className="search-wrap">
          <Search size={14} className="sicon"/>
          <input placeholder="Buscar por nombre, CI o teléfono..." value={search}
            onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && fetchParents()}/>
        </div>
        <select value={filterTutor} onChange={e => { setFilterTutor(e.target.value); fetchParents() }}>
          <option value="">Todos</option>
          <option value="TUTOR">Solo tutores legales</option>
          <option value="SIN_VINCULAR">Sin vincular</option>
          <option value="NO_TUTOR">Vinculados no tutores</option>
      </select>
      <select value={orderBy} onChange={e => setOrderBy(e.target.value)}>
        <option value="alfabetico">Ordenar: Alfabético</option>
        <option value="kardex">Ordenar: Por Kardex</option>
      </select>
        <button className="btn-outline" onClick={fetchParents}>Buscar</button>
      </div>

      <div className="table-card">
        {loading ? (
          <div className="center-state"><div className="spinner"/><p>Cargando...</p></div>
        ) : parents.length === 0 ? (
          <div className="center-state"><p>No se encontraron padres/tutores</p></div>
        ) : (
          <table>
            <thead>
              <tr><th>#</th><th>Nombre completo</th><th>CI</th><th>Teléfono</th><th>Hijos vinculados</th><th>Acceso</th><th>Acciones</th></tr>
            </thead>
            <tbody>
              {parents.map((p, i) => (
                <tr key={p.id}>
                  <td className="muted">{i+1}</td>
                  <td>
                    <div className="pname">{p.lastName} {p.firstName}</div>
                    {p.user && <div className="puser">{p.user.email}</div>}
                  </td>
                  <td className="muted">{p.ci || '—'}</td>
                  <td className="muted">{p.phone || '—'}</td>
                  <td>
                    {p.students.length === 0
                      ? <span className="no-link">Sin vincular</span>
                      : <div className="students-list">
                          {p.students.map(ps => (
                            <div key={ps.student.id} className="schip">
                            <button className="rbadge-btn" style={{ background: relColor[ps.relationType]+'18', color: relColor[ps.relationType] }}
                              title="Click para cambiar tipo de relación" onClick={() => openChangeRel(p.id, ps.student.id, ps.relationType, ps.isTutor)}>
                              {relLabel(ps.relationType, ps.isTutor)} ✏️
                            </button>
                              <span className="sname">{ps.student.lastName} {ps.student.firstName}</span>
                              {ps.student.kardex && <span className="muted-sm">K:{ps.student.kardex}</span>}
                              <button className="unlink-btn" onClick={() => handleUnlink(p.id, ps.student.id)} title="Desvincular">×</button>
                            </div>
                          ))}
                        </div>
                    }
                  </td>
                  <td>
                    {p.user ? (
                      <span className={`sbadge ${p.user.isActive ? 'act' : 'ina'}`}>{p.user.isActive ? 'Activo' : 'Inactivo'}</span>
                    ) : isTutorLegalSinAcceso(p) ? (
                      <button className="gen-cred-btn" onClick={() => handleGenerateCreds(p.id, `${p.firstName} ${p.lastName}`)}>
                        <KeyRound size={11}/> Generar acceso
                      </button>
                    ) : (
                      <span className="no-access">Sin acceso</span>
                    )}
                  </td>
                  <td>
                    <div className="actions">
                      <button className="icon-btn view" title="Ver detalle" onClick={() => router.push(`/dashboard/admin/padres/${p.id}`)}><Eye size={13}/></button>
                      <button className="icon-btn edit" title="Editar" onClick={() => openEdit(p)}><Edit size={13}/></button>
                      <button className="icon-btn link" title="Vincular estudiante" onClick={() => openLink(p.id)}><Link size={13}/></button>
                      {p.user && (
                        <button className={`icon-btn ${p.user.isActive ? 'deact' : 'act2'}`} title={p.user.isActive ? 'Desactivar' : 'Activar'} onClick={() => handleToggle(p.id)}>
                          {p.user.isActive ? <UserX size={13}/> : <UserCheck size={13}/>}
                        </button>
                      )}
                      <button className="icon-btn del" title="Eliminar" onClick={() => handleDelete(p.id, `${p.firstName} ${p.lastName}`)}><Trash2 size={13}/></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <div className="tfooter">Total: <strong>{parents.length}</strong> padres/tutores</div>

      {showModal && (
        <div className="overlay" onClick={() => setShowModal(false)}>
          <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
            <div className="mhead">
              <h2>{editMode ? 'Editar Padre/Tutor' : 'Nuevo Padre/Tutor'}</h2>
              <button onClick={() => setShowModal(false)}><X size={18}/></button>
            </div>
            <div className="mbody">
              {error && <div className="alert err">{error}</div>}
              {!editMode && (
                <div className="info-box">
                  🔑 Solo el <strong>Tutor Legal</strong> recibirá acceso al sistema.
                  Padres y madres son registrados sin acceso.
                </div>
              )}
              <div className="section-lbl">Datos personales</div>
              <div className="form-grid">
                <div className="fg"><label>Nombres *</label>
                  <input type="text" placeholder="Ej: Carlos Alberto" value={form.firstName} onChange={e => setForm({...form, firstName: e.target.value})}/></div>
                <div className="fg"><label>Apellidos *</label>
                  <input type="text" placeholder="Ej: García López" value={form.lastName} onChange={e => setForm({...form, lastName: e.target.value})}/></div>
                <div className="fg"><label>CI</label>
                  <input type="text" placeholder="Ej: 12345678" value={form.ci} onChange={e => setForm({...form, ci: e.target.value})}/></div>
                <div className="fg"><label>Teléfono</label>
                  <input type="text" placeholder="Ej: 70012345" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})}/></div>
                <div className="fg"><label>Correo personal</label>
                  <input type="email" placeholder="Ej: padre@gmail.com" value={form.email} onChange={e => setForm({...form, email: e.target.value})}/></div>
                <div className="fg"><label>Dirección</label>
                  <input type="text" placeholder="Ej: Av. Principal 123" value={form.address} onChange={e => setForm({...form, address: e.target.value})}/></div>
              </div>
              {!editMode && (
                <>
                  <div className="section-lbl">Tipo de relación *</div>
                  <div className="relation-grid">
                    {RELATION_TYPES.map(r => (
                      <button key={r.value} type="button" className={`rel-btn ${form.relationType === r.value ? 'selected' : ''}`}
                        onClick={() => setForm({...form, relationType: r.value})}>
                        {r.value === 'TUTOR_LEGAL' ? '🔑 ' : ''}{r.label}
                      </button>
                    ))}
                  </div>
                  {form.relationType === 'TUTOR_LEGAL' && (
                    <div className="info-box warn">⚠️ Se generará usuario y contraseña de acceso para este tutor legal.</div>
                  )}
                  <div className="section-lbl">Vincular estudiantes</div>
                  <div className="students-select">
                    {students.length === 0
                      ? <p className="muted-sm">No hay estudiantes registrados</p>
                      : students.map(s => (
                          <label key={s.id} className={`student-option ${form.studentIds.includes(s.id) ? 'selected' : ''}`}>
                            <input type="checkbox" checked={form.studentIds.includes(s.id)} onChange={() => toggleForm(s.id)}/>
                            <span>{s.lastName} {s.firstName}</span>
                            {s.ci && <span className="muted-sm">CI: {s.ci}</span>}
                          </label>
                        ))
                    }
                  </div>
                </>
              )}
            </div>
            <div className="mfoot">
              <button className="btn-outline" onClick={() => setShowModal(false)}>Cancelar</button>
              <button className="btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? <span className="spinsm"/> : editMode ? <Edit size={14}/> : <Plus size={14}/>}
                {saving ? 'Guardando...' : editMode ? 'Actualizar' : 'Registrar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showChangeRelModal && (
        <div className="overlay" onClick={() => setShowChangeRelModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="mhead"><h2>Cambiar tipo de relación</h2><button onClick={() => setShowChangeRelModal(false)}><X size={18}/></button></div>
            <div className="mbody">
              {error && <div className="alert err">{error}</div>}
              <div className="info-box">Relación actual: <strong style={{ color: relColor[currentRelType] }}>{relLabel(currentRelType)}</strong></div>
              <div className="section-lbl">Nuevo tipo de relación</div>
              {/* Checkbox tutor legal */}
<div className="tolerance-box" style={{marginTop:'8px'}}>
  <label className="checkbox-label">
    <input type="checkbox"
      checked={changeRelType === 'TUTOR_LEGAL'}
      onChange={e => {
        if (e.target.checked) setChangeRelType('TUTOR_LEGAL')
        else setChangeRelType(currentRelType)
      }}/>
    <span>🔑 Designar como Tutor Legal</span>
  </label>
</div>
              <div className="relation-grid">
                {RELATION_TYPES.filter(r => r.value !== currentRelType).map(r => (
                  <button key={r.value} type="button" className={`rel-btn ${changeRelType === r.value ? 'selected' : ''}`}
                    onClick={() => setChangeRelType(r.value)}>
                    {r.value === 'TUTOR_LEGAL' ? '🔑 ' : ''}{r.label}
                  </button>
                ))}
              </div>
              <div className="tolerance-box" style={{marginTop:'8px'}}>
  <label className="checkbox-label">
    <input type="checkbox"
      checked={changeIsTutor}
      onChange={e => setChangeIsTutor(e.target.checked)}/>
    <span>🔑 Designar como Tutor Legal</span>
  </label>
</div>
              {changeRelType === 'TUTOR_LEGAL' && (
                <div className="info-box warn">
                  ⚠️ Al asignar como <strong>Tutor Legal</strong>:<br/>
                  • Se le generará acceso al sistema si no tiene<br/>
                  • Los otros tutores legales serán cambiados a "Otro"
                </div>
              )}
            </div>
            <div className="mfoot">
              <button className="btn-outline" onClick={() => setShowChangeRelModal(false)}>Cancelar</button>
              <button className="btn-primary" onClick={handleChangeRel} disabled={saving}>
                {saving ? <span className="spinsm"/> : null}
                {saving ? 'Guardando...' : 'Confirmar cambio'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showLinkModal && (
        <div className="overlay" onClick={() => setShowLinkModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="mhead"><h2>Vincular Estudiantes</h2><button onClick={() => setShowLinkModal(false)}><X size={18}/></button></div>
            <div className="mbody">
              {error && <div className="alert err">{error}</div>}
              <div className="fg"><label>Tipo de relación *</label>
                <select value={linkRelType} onChange={e => setLinkRelType(e.target.value)}>
                  {RELATION_TYPES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>
            <div className="fg"><label>Estudiantes *</label>
  <input type="text" placeholder="Buscar por nombre, CI o RUDE..."
    value={linkSearch} onChange={e => setLinkSearch(e.target.value)}
    style={{padding:'8px 12px',border:'1.5px solid #CBE0F0',borderRadius:'8px',fontSize:'13px',marginBottom:'8px',width:'100%',outline:'none'}}/>
  <div className="students-select">
    {students.filter(s =>
      linkSearch === '' ||
      `${s.firstName} ${s.lastName}`.toLowerCase().includes(linkSearch.toLowerCase()) ||
      (s.ci   && s.ci.includes(linkSearch)) ||
      (s.rude && s.rude.includes(linkSearch))
    ).map(s => (
      <label key={s.id} className={`student-option ${linkStudentIds.includes(s.id) ? 'selected' : ''}`}>
        <input type="checkbox" checked={linkStudentIds.includes(s.id)} onChange={() => toggleLink(s.id)}/>
        <span>{s.lastName} {s.firstName}</span>
        {s.ci && <span className="muted-sm">CI: {s.ci}</span>}
      </label>
    ))}
  </div>
</div>
            </div>
            <div className="mfoot">
              <button className="btn-outline" onClick={() => setShowLinkModal(false)}>Cancelar</button>
              <button className="btn-primary" onClick={handleLink} disabled={saving}>
                {saving ? <span className="spinsm"/> : <Link size={14}/>}
                {saving ? 'Vinculando...' : 'Vincular'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showCredentials && creds && (
        <div className="overlay">
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="mhead"><h2>✅ Acceso generado</h2></div>
            <div className="mbody">
              <div className="cred-box">
                {creds.name && <><p className="cred-title">Credenciales para:</p><p className="cred-name">{creds.name}</p></>}
                <div className="cred-row"><span className="cred-label">Email:</span><span className="cred-value">{creds.accessEmail}</span></div>
                <div className="cred-row"><span className="cred-label">Contraseña:</span><span className="cred-value">{creds.defaultPassword}</span></div>
                <div className="cred-note">⚠️ Anota estas credenciales. No se podrán ver de nuevo.</div>
              </div>
            </div>
            <div className="mfoot">
              <button className="btn-outline" onClick={copyCreds}>
                {copied ? <Check size={14}/> : <Copy size={14}/>}
                {copied ? 'Copiado' : 'Copiar'}
              </button>
              <button className="btn-primary" onClick={() => setShowCredentials(false)}>Entendido</button>
            </div>
          </div>
        </div>
      )}
    {/* Modal importar Excel padres */}
{showImportModal && (
  <div className="overlay" onClick={() => setShowImportModal(false)}>
    <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
      <div className="mhead">
        <h2>📥 Importar Padres desde Excel</h2>
        <button onClick={() => setShowImportModal(false)}><X size={18}/></button>
      </div>
      <div className="mbody">
        {!importResult ? (
          <>
            <div className="info-box">
              El archivo Excel debe tener estas columnas:<br/>
              <strong>NROKARDEX · NOMBREPADRE · APELLIDOPADRE · NROCIPADRE · TELEFONOPADRE · NOMBRESMADRE · APELLIDOSMADRE · NROCIMADRE · TELEFONOMADRE</strong>
            </div>
            <div className="fg">
              <label>Seleccionar archivo Excel *</label>
              <input type="file" accept=".xlsx,.xls"
                onChange={e => {
                  const file = e.target.files?.[0]
                  if (file) handleImportParents(file)
                }}/>
            </div>
            {importing && (
              <div className="center-state">
                <div className="spinner"/>
                <p>Importando padres... esto puede tomar varios minutos</p>
              </div>
            )}
          </>
        ) : (
          <div style={{display:'flex',flexDirection:'column',gap:'12px'}}>
            <div className="alert suc">{importResult.message}</div>
            {importResult.created?.length > 0 && (
              <div>
                <div className="section-lbl">✅ Creados ({importResult.created.length})</div>
                <div style={{maxHeight:'200px',overflowY:'auto',marginTop:'8px'}}>
                  {importResult.created.map((p: any, i: number) => (
                    <div key={i} style={{padding:'6px 0',borderBottom:'1px solid #F0F6FC',fontSize:'12px'}}>
                      <strong>{p.name}</strong> ({p.type}) — {p.email} / {p.password}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {importResult.skipped?.length > 0 && (
              <div>
                <div className="section-lbl">⚠️ Omitidos ({importResult.skipped.length})</div>
                {importResult.skipped.map((s: any, i: number) => (
                  <div key={i} style={{fontSize:'12px',color:'#7A6000',padding:'4px 0'}}>
                    Kardex {s.kardex} — {s.reason}
                  </div>
                ))}
              </div>
            )}
            {importResult.errors?.length > 0 && (
              <div>
                <div className="section-lbl">❌ Errores ({importResult.errors.length})</div>
                {importResult.errors.map((e: any, i: number) => (
                  <div key={i} style={{fontSize:'12px',color:'#C0392B',padding:'4px 0'}}>
                    Kardex {e.kardex} — {e.reason}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
      <div className="mfoot">
        <button className="btn-primary" onClick={() => setShowImportModal(false)}>Cerrar</button>
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
        .btn-primary{display:flex;align-items:center;gap:6px;padding:9px 16px;background:#1A3A7C;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:500;cursor:pointer;white-space:nowrap}
        .btn-primary:hover:not(:disabled){background:#4A9FD4}
        .btn-primary:disabled{opacity:.6;cursor:not-allowed}
        .btn-outline{display:flex;align-items:center;gap:6px;padding:9px 14px;background:#fff;color:#1A3A7C;border:1.5px solid #CBE0F0;border-radius:8px;font-size:13px;cursor:pointer;white-space:nowrap}
        .btn-outline:hover{background:#F0F6FC}
        .table-card{background:#fff;border:1px solid #CBE0F0;border-radius:12px;overflow:hidden}
        table{width:100%;border-collapse:collapse}
        thead tr{background:#F0F6FC}
        th{padding:11px 14px;text-align:left;font-size:11px;font-weight:600;color:#1A3A7C;text-transform:uppercase;letter-spacing:.5px;white-space:nowrap}
        td{padding:11px 14px;font-size:13px;color:#1A3A7C;border-top:1px solid #F0F6FC;vertical-align:top}
        tr:hover td{background:#FAFCFF}
        .muted{color:#6B8BB0;font-size:12px}
        .muted-sm{font-size:11px;color:#6B8BB0}
        .pname{font-weight:500;color:#1A3A7C}
        .puser{font-size:11px;color:#6B8BB0;margin-top:2px}
        .gen-cred-btn{display:inline-flex;align-items:center;gap:4px;background:none;border:1px dashed #F5C518;color:#7A6000;border-radius:6px;padding:3px 8px;font-size:11px;cursor:pointer}
        .gen-cred-btn:hover{background:#FFFBEA}
        .no-access{font-size:11px;color:#6B8BB0;font-style:italic}
        .no-link{font-size:11px;color:#6B8BB0;font-style:italic}
        .students-list{display:flex;flex-direction:column;gap:4px}
        .schip{display:flex;align-items:center;gap:5px;font-size:12px}
        .sname{color:#1A3A7C}
        .rbadge-btn{padding:2px 8px;border-radius:20px;font-size:10px;font-weight:500;white-space:nowrap;border:none;cursor:pointer;transition:opacity .2s}
        .rbadge-btn:hover{opacity:.75}
        .unlink-btn{background:none;border:none;cursor:pointer;color:#C0392B;font-size:15px;padding:0 2px;line-height:1}
        .sbadge{padding:3px 9px;border-radius:20px;font-size:11px;font-weight:500}
        .sbadge.act{background:#E1F5EE;color:#0F6E56}
        .sbadge.ina{background:#FFF0F0;color:#C0392B}
        .actions{display:flex;gap:5px}
        .icon-btn{width:28px;height:28px;border:none;border-radius:6px;cursor:pointer;display:flex;align-items:center;justify-content:center}
        .icon-btn.view{background:#E0ECF8;color:#1A3A7C}
        .icon-btn.edit{background:#FAEEDA;color:#633806}
        .icon-btn.link{background:#E1F5EE;color:#0F6E56}
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
        .fg input,.fg select{padding:9px 12px;border:1.5px solid #CBE0F0;border-radius:8px;font-size:13px;color:#1A3A7C;outline:none}
        .fg input:focus,.fg select:focus{border-color:#4A9FD4;box-shadow:0 0 0 3px rgba(74,159,212,.12)}
        .info-box{background:#F0F6FC;border:1px solid #CBE0F0;border-radius:8px;padding:12px;font-size:12px;color:#6B8BB0;line-height:1.6}
        .info-box.warn{background:#FFFBEA;border-color:#F5C518;color:#7A6000}
        .relation-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}
        .rel-btn{padding:8px 4px;border:1.5px solid #CBE0F0;border-radius:8px;background:#fff;color:#1A3A7C;font-size:12px;cursor:pointer;text-align:center;transition:all .15s}
        .rel-btn:hover{border-color:#4A9FD4;background:#F0F6FC}
        .rel-btn.selected{border-color:#1A3A7C;background:#1A3A7C;color:#fff}
        .students-select{display:flex;flex-direction:column;gap:6px;max-height:200px;overflow-y:auto;border:1.5px solid #CBE0F0;border-radius:8px;padding:8px}
        .student-option{display:flex;align-items:center;gap:8px;padding:8px;border-radius:6px;cursor:pointer;font-size:13px;color:#1A3A7C}
        .student-option:hover{background:#F0F6FC}
        .student-option.selected{background:#E0ECF8}
        .student-option input{accent-color:#1A3A7C;cursor:pointer}
        .cred-box{display:flex;flex-direction:column;gap:10px}
        .cred-title{font-size:13px;color:#6B8BB0}
        .cred-name{font-size:16px;font-weight:700;color:#1A3A7C}
        .cred-row{display:flex;align-items:center;gap:10px;background:#F0F6FC;border:1px solid #CBE0F0;border-radius:8px;padding:10px 14px}
        .cred-label{font-size:12px;font-weight:600;color:#6B8BB0;min-width:80px;text-transform:uppercase;letter-spacing:.5px}
        .cred-value{font-size:14px;font-weight:600;color:#1A3A7C;font-family:monospace;word-break:break-all}
        .cred-note{font-size:12px;color:#BA7517;background:#FFFBEA;border:1px solid #F5C518;border-radius:8px;padding:10px;line-height:1.5}
        .spinner{width:20px;height:20px;border:2px solid rgba(26,58,124,.2);border-top-color:#1A3A7C;border-radius:50%;animation:spin .7s linear infinite}
        .spinsm{width:14px;height:14px;border:2px solid rgba(255,255,255,.3);border-top-color:#fff;border-radius:50%;animation:spin .7s linear infinite;display:inline-block}
        @keyframes spin{to{transform:rotate(360deg)}}
        @media(max-width:600px){.page-header{flex-direction:column}.form-grid{grid-template-columns:1fr}.relation-grid{grid-template-columns:repeat(2,1fr)}}
      `}</style>
    </div>
  )
}