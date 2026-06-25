'use client'

import { useEffect, useState } from 'react'
import { Plus, Search, X, Edit, Eye, UserCheck, UserX, Trash2, Copy, Check, BookOpen, Clock } from 'lucide-react'
import { useRouter } from 'next/navigation'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

interface Specialty {
  id: number
  subject: { id: number; name: string; campo?: string }
}

interface Teacher {
  id:         number
  firstName:  string
  lastName:   string
  ci?:        string
  phone?:     string
  email?:     string
  specialty?: string
  birthDate?: string
  hoursLoad?: number
  gender?:    string
  isActive:   boolean
  user?:      { id: number; email: string; role: string; isActive: boolean }
  _count:     { assignments: number }
  specialties?: Specialty[]
}

interface Subject {
  id: number; name: string; campo?: string; level: string
}

interface Credentials {
  accessEmail: string; defaultPassword: string; hint: string; name: string
}

const emptyForm = {
  firstName: '', lastName: '', ci: '', phone: '', email: '', specialty: '',
  birthDate: '', hoursLoad: '', gender: '',
  subjectIds: [] as number[],
}

const CAMPOS = [
  { value: 'VIDA_TIERRA_TERRITORIO',        label: '🌿 Vida, Tierra y Territorio' },
  { value: 'COMUNIDAD_SOCIEDAD',            label: '🌐 Comunidad y Sociedad' },
  { value: 'COSMOS_PENSAMIENTO',            label: '✨ Cosmos y Pensamiento' },
  { value: 'CIENCIA_TECNOLOGIA_PRODUCCION', label: '⚙️ Ciencia, Tecnología y Producción' },
]

const CAMPO_LABELS: Record<string, string> = {
  VIDA_TIERRA_TERRITORIO:        'Vida Tierra y Territorio',
  COMUNIDAD_SOCIEDAD:            'Comunidad y Sociedad',
  COSMOS_PENSAMIENTO:            'Cosmos y Pensamiento',
  CIENCIA_TECNOLOGIA_PRODUCCION: 'Ciencia Tecnología y Producción',
}

const CAMPO_COLORS: Record<string, string> = {
  VIDA_TIERRA_TERRITORIO:        '#E1F5EE',
  COMUNIDAD_SOCIEDAD:            '#E0ECF8',
  COSMOS_PENSAMIENTO:            '#F5EFE6',
  CIENCIA_TECNOLOGIA_PRODUCCION: '#F0F0FF',
}

const CAMPO_TEXT: Record<string, string> = {
  VIDA_TIERRA_TERRITORIO:        '#0F6E56',
  COMUNIDAD_SOCIEDAD:            '#1A3A7C',
  COSMOS_PENSAMIENTO:            '#633806',
  CIENCIA_TECNOLOGIA_PRODUCCION: '#444441',
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
  const [loadingEdit,  setLoadingEdit]  = useState(false)
  const [success,      setSuccess]      = useState('')
  const [error,        setError]        = useState('')
  const [form,         setForm]         = useState(emptyForm)
  const [creds,        setCreds]        = useState<Credentials | null>(null)
  const [copied,       setCopied]       = useState(false)
  const [subjectsByCampo, setSubjectsByCampo] = useState<Record<string, Subject[]>>({})

  const [showSpecialties,   setShowSpecialties]   = useState(false)
  const [specTeacher,       setSpecTeacher]       = useState<Teacher | null>(null)
  const [specialties,       setSpecialties]       = useState<Specialty[]>([])
  const [selectedSubjectId, setSelectedSubjectId] = useState('')
  const [specSearch,        setSpecSearch]        = useState('')
  const [addingSpec,        setAddingSpec]        = useState(false)
  const [loadingSpec,       setLoadingSpec]       = useState(false)
  const [allSubjectsForSpec, setAllSubjectsForSpec] = useState<Subject[]>([])

  const [workloadModal, setWorkloadModal] = useState<{ open: boolean; teacherId: number | null; data: any }>({
    open: false, teacherId: null, data: null
  })

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : ''

  const notify = (msg: string, type: 'success' | 'error' = 'success') => {
    if (type === 'success') { setSuccess(msg); setTimeout(() => setSuccess(''), 3000) }
    else                    { setError(msg);   setTimeout(() => setError(''),   4000) }
  }

  const fetchTeachers = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (search)       params.set('search',   search)
      if (filterActive) params.set('isActive', filterActive)
      const res  = await fetch(`${API_URL}/api/teachers?${params}`, { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      if (res.ok) setTeachers(data)
      else notify('Error al cargar maestros', 'error')
    } catch { notify('Error de conexión', 'error') }
    finally  { setLoading(false) }
  }

  const fetchWorkload = async (teacherId: number) => {
    try {
      const res  = await fetch(`${API_URL}/api/teachers/${teacherId}/workload`, { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      setWorkloadModal({ open: true, teacherId, data })
    } catch { notify('Error al cargar carga horaria', 'error') }
  }

  const fetchSpecialties = async (teacherId: number) => {
    setLoadingSpec(true)
    try {
      const res  = await fetch(`${API_URL}/api/teachers/${teacherId}/specialties`, { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      if (res.ok) setSpecialties(data)
    } catch { notify('Error al cargar especialidades', 'error') }
    finally  { setLoadingSpec(false) }
  }

  useEffect(() => { fetchTeachers() }, [])

  const loadAllSubjects = async () => {
    try {
      const res  = await fetch(`${API_URL}/api/subjects?level=SECUNDARIA`, { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      if (res.ok && Array.isArray(data)) {
        const grouped: Record<string, Subject[]> = {}
        for (const s of data) {
          const c = s.campo || 'SIN_CAMPO'
          if (!grouped[c]) grouped[c] = []
          grouped[c].push(s)
        }
        setSubjectsByCampo(grouped)
      }
    } catch (e) { console.error('Error cargando materias', e) }
  }

  const loadSubjectsForSpec = async () => {
    try {
      const res  = await fetch(`${API_URL}/api/subjects`, { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      if (res.ok) setAllSubjectsForSpec(Array.isArray(data) ? data : [])
    } catch { console.error('Error al cargar materias') }
  }

  const toggleSubject = (subjectId: number) => {
    setForm(prev => ({
      ...prev,
      subjectIds: prev.subjectIds.includes(subjectId)
        ? prev.subjectIds.filter(id => id !== subjectId)
        : [...prev.subjectIds, subjectId]
    }))
  }

  const openSpecialties = async (teacher: Teacher) => {
    setSpecTeacher(teacher); setSelectedSubjectId(''); setSpecSearch(''); setShowSpecialties(true)
    await Promise.all([fetchSpecialties(teacher.id), loadSubjectsForSpec()])
  }

  const handleAddSpecialty = async () => {
    if (!selectedSubjectId || !specTeacher) return
    setAddingSpec(true)
    try {
      const res  = await fetch(`${API_URL}/api/teachers/${specTeacher.id}/specialties`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ subjectId: parseInt(selectedSubjectId) }),
      })
      const data = await res.json()
      if (res.ok) { setSelectedSubjectId(''); await fetchSpecialties(specTeacher.id); fetchTeachers() }
      else notify(data.message, 'error')
    } catch { notify('Error de conexión', 'error') }
    finally  { setAddingSpec(false) }
  }

  const handleRemoveSpecialty = async (specialtyId: number) => {
    if (!specTeacher) return
    try {
      const res  = await fetch(`${API_URL}/api/teachers/${specTeacher.id}/specialties/${specialtyId}`,
        { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      if (res.ok) { await fetchSpecialties(specTeacher.id); fetchTeachers() }
      else notify(data.message, 'error')
    } catch { notify('Error al quitar especialidad', 'error') }
  }

  const openCreate = () => {
    setEditMode(false); setEditId(null); setForm(emptyForm); setError('')
    loadAllSubjects(); setShowModal(true)
  }

  const openEdit = async (t: Teacher) => {
    setEditMode(true); setEditId(t.id); setError(''); setLoadingEdit(true)
    loadAllSubjects(); setShowModal(true)
    try {
      const res   = await fetch(`${API_URL}/api/teachers/${t.id}/specialties`, { headers: { Authorization: `Bearer ${token}` } })
      const specs: Specialty[] = await res.json()
      setForm({
        firstName: t.firstName, lastName: t.lastName, ci: t.ci || '', phone: t.phone || '',
        email: t.email || '', specialty: t.specialty || '',
        birthDate: t.birthDate ? t.birthDate.substring(0, 10) : '',
        hoursLoad: t.hoursLoad ? String(t.hoursLoad) : '', gender: t.gender || '',
        subjectIds: specs.map(s => s.subject.id),
      })
    } catch {
      setForm({
        firstName: t.firstName, lastName: t.lastName, ci: t.ci || '', phone: t.phone || '',
        email: t.email || '', specialty: t.specialty || '',
        birthDate: t.birthDate ? t.birthDate.substring(0, 10) : '',
        hoursLoad: t.hoursLoad ? String(t.hoursLoad) : '', gender: t.gender || '', subjectIds: [],
      })
    } finally { setLoadingEdit(false) }
  }

  const handleSave = async () => {
    setError(''); setSaving(true)
    try {
      const url    = editMode ? `${API_URL}/api/teachers/${editId}` : `${API_URL}/api/teachers`
      const method = editMode ? 'PUT' : 'POST'
      const res    = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          firstName: form.firstName, lastName: form.lastName, ci: form.ci,
          phone: form.phone, email: form.email, specialty: form.specialty,
          birthDate: form.birthDate || null, hoursLoad: form.hoursLoad || null, gender: form.gender || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) { notify(data.message, 'error'); return }

      const teacherIdToUse = editMode ? editId! : data.teacher?.id
      if (teacherIdToUse) {
        if (editMode) {
          const currentSpecs: Specialty[] = await fetch(
            `${API_URL}/api/teachers/${teacherIdToUse}/specialties`, { headers: { Authorization: `Bearer ${token}` } }
          ).then(r => r.json())
          await Promise.all(currentSpecs.filter(s => !form.subjectIds.includes(s.subject.id)).map(s =>
            fetch(`${API_URL}/api/teachers/${teacherIdToUse}/specialties/${s.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
          ))
          const currentIds = currentSpecs.map(s => s.subject.id)
          await Promise.all(form.subjectIds.filter(id => !currentIds.includes(id)).map(subjectId =>
            fetch(`${API_URL}/api/teachers/${teacherIdToUse}/specialties`, {
              method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
              body: JSON.stringify({ subjectId }),
            })
          ))
        } else if (form.subjectIds.length > 0) {
          await Promise.all(form.subjectIds.map(subjectId =>
            fetch(`${API_URL}/api/teachers/${teacherIdToUse}/specialties`, {
              method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
              body: JSON.stringify({ subjectId }),
            })
          ))
        }
      }

      setShowModal(false); fetchTeachers()
      if (!editMode && data.accessEmail) {
        setCreds({ accessEmail: data.accessEmail, defaultPassword: data.defaultPassword, hint: data.passwordHint, name: `${form.firstName} ${form.lastName}` })
        setShowCredentials(true)
      } else {
        notify(editMode ? 'Maestro actualizado correctamente' : 'Maestro registrado correctamente')
      }
    } catch { notify('Error de conexión', 'error') }
    finally  { setSaving(false) }
  }

  const handleToggle = async (id: number) => {
    try {
      const res  = await fetch(`${API_URL}/api/teachers/${id}/toggle`, { method: 'PATCH', headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      if (res.ok) { notify(data.message); fetchTeachers() }
      else notify(data.message, 'error')
    } catch { notify('Error al cambiar estado', 'error') }
  }

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`¿Eliminar al maestro ${name}?`)) return
    try {
      const res  = await fetch(`${API_URL}/api/teachers/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
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

  const calcAge = (birthDate?: string) => {
    if (!birthDate) return null
    return Math.floor((Date.now() - new Date(birthDate).getTime()) / (1000 * 60 * 60 * 24 * 365.25))
  }

  const availableSubjects = allSubjectsForSpec.filter(s =>
    !specialties.some(sp => sp.subject.id === s.id) &&
    (specSearch === '' || s.name.toLowerCase().includes(specSearch.toLowerCase()))
  )

  const specialtiesByCampo = specialties.reduce((acc: Record<string, Specialty[]>, sp) => {
    const campo = sp.subject.campo || 'SIN_CAMPO'
    if (!acc[campo]) acc[campo] = []
    acc[campo].push(sp)
    return acc
  }, {})

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

      <div className="table-card">
        {loading ? (
          <div className="center-state"><div className="spinner"/><p>Cargando...</p></div>
        ) : teachers.length === 0 ? (
          <div className="center-state"><p>No se encontraron maestros</p></div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>#</th><th>Nombre completo</th><th>CI</th><th>Edad</th><th>Género</th>
                <th>Carga hrs/mes</th><th>Materias asignadas</th><th>Estado</th><th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {teachers.map((t, i) => {
                const specs = t.specialties || []
                const age   = calcAge(t.birthDate)
                return (
                  <tr key={t.id}>
                    <td className="muted">{i + 1}</td>
                    <td>
                      <div className="tname">{t.lastName} {t.firstName}</div>
                      {t.user      && <div className="tuser">{t.user.email}</div>}
                      {t.specialty && <div className="tspec">{t.specialty}</div>}
                    </td>
                    <td className="muted">{t.ci || '—'}</td>
                    <td className="muted">{age ? `${age} años` : '—'}</td>
                    <td>
                      {t.gender ? (
                        <span className={`gbadge ${t.gender === 'MASCULINO' ? 'masc' : 'fem'}`}>
                          {t.gender === 'MASCULINO' ? '♂ Masculino' : '♀ Femenino'}
                        </span>
                      ) : <span className="muted">—</span>}
                    </td>
                    <td className="muted">
                      {t.hoursLoad ? <span className="hours-badge">{t.hoursLoad} hrs</span> : '—'}
                    </td>
                    <td>
                      {specs.length === 0 ? (
                        <button className="spec-badge-empty" onClick={() => openSpecialties(t)}>
                          <Plus size={10}/> Asignar
                        </button>
                      ) : (
                        <div className="spec-tags-wrap">
                          {specs.slice(0, 2).map(sp => (
                            <span key={sp.id} className="spec-tag"
                              style={{ background: CAMPO_COLORS[sp.subject.campo || ''] || '#F0F0F0', color: CAMPO_TEXT[sp.subject.campo || ''] || '#444' }}>
                              {sp.subject.name}
                            </span>
                          ))}
                          {specs.length > 2 && (
                            <button className="spec-more" onClick={() => openSpecialties(t)}>+{specs.length - 2} más</button>
                          )}
                          <button className="spec-edit-btn" onClick={() => openSpecialties(t)}><Edit size={10}/></button>
                        </div>
                      )}
                    </td>
                    <td><span className={`sbadge ${t.isActive ? 'act' : 'ina'}`}>{t.isActive ? 'Activo' : 'Inactivo'}</span></td>
                    <td>
                      <div className="actions">
                        <button className="icon-btn view" title="Ver detalle" onClick={() => router.push(`/dashboard/admin/maestros/${t.id}`)}><Eye size={13}/></button>
                        <button className="icon-btn edit" title="Editar" onClick={() => openEdit(t)}><Edit size={13}/></button>
                        <button className="icon-btn spec" title="Gestionar materias" onClick={() => openSpecialties(t)}><BookOpen size={13}/></button>
                        <button className={`icon-btn ${t.isActive ? 'deact' : 'act2'}`} title={t.isActive ? 'Desactivar' : 'Activar'} onClick={() => handleToggle(t.id)}>
                          {t.isActive ? <UserX size={13}/> : <UserCheck size={13}/>}
                        </button>
                        <button className="icon-btn del" title="Eliminar" onClick={() => handleDelete(t.id, `${t.firstName} ${t.lastName}`)}><Trash2 size={13}/></button>
                        <button className="icon-btn view" title="Ver carga horaria" onClick={() => fetchWorkload(t.id)}><Clock size={13}/></button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
      <div className="tfooter">
        Total: <strong>{teachers.length}</strong> maestros ·
        Masculino: <strong>{teachers.filter(t => t.gender === 'MASCULINO').length}</strong> ·
        Femenino: <strong>{teachers.filter(t => t.gender === 'FEMENINO').length}</strong>
      </div>

      {/* ── Modal crear/editar ── */}
      {showModal && (
        <div className="overlay" onClick={() => setShowModal(false)}>
          <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
            <div className="mhead">
              <h2>{editMode ? 'Editar Maestro' : 'Nuevo Maestro'}</h2>
              <button onClick={() => setShowModal(false)}><X size={18}/></button>
            </div>
            <div className="mbody">
              {error && <div className="alert err">{error}</div>}
              {loadingEdit ? (
                <div className="center-state"><div className="spinner"/><p>Cargando datos...</p></div>
              ) : (
                <>
                  {!editMode && <div className="info-box">🔑 El sistema generará automáticamente un email y contraseña de acceso.</div>}
                  <div className="section-lbl">Datos personales</div>
                  <div className="form-grid">
                    <div className="fg"><label>Nombres *</label><input type="text" placeholder="Ej: Juan Carlos" value={form.firstName} onChange={e => setForm({...form, firstName: e.target.value})}/></div>
                    <div className="fg"><label>Apellidos *</label><input type="text" placeholder="Ej: García López" value={form.lastName} onChange={e => setForm({...form, lastName: e.target.value})}/></div>
                    <div className="fg"><label>CI</label><input type="text" placeholder="Ej: 12345678" value={form.ci} onChange={e => setForm({...form, ci: e.target.value})}/></div>
                    <div className="fg"><label>Teléfono</label><input type="text" placeholder="Ej: 70012345" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})}/></div>
                    <div className="fg"><label>Correo electrónico</label><input type="email" placeholder="Ej: maestro@gmail.com (opcional)" value={form.email} onChange={e => setForm({...form, email: e.target.value})}/></div>
                    <div className="fg"><label>Especialidad (título)</label><input type="text" placeholder="Ej: Lic. en Matemáticas..." value={form.specialty} onChange={e => setForm({...form, specialty: e.target.value})}/></div>
                    <div className="fg"><label>Fecha de nacimiento</label><input type="date" value={form.birthDate} onChange={e => setForm({...form, birthDate: e.target.value})}/></div>
                    <div className="fg"><label>Carga horaria (hrs/mes)</label><input type="number" min={1} max={320} placeholder="Ej: 128" value={form.hoursLoad} onChange={e => setForm({...form, hoursLoad: e.target.value})}/></div>
                    <div className="fg"><label>Género</label>
                      <select value={form.gender} onChange={e => setForm({...form, gender: e.target.value})} className="fg-select">
                        <option value="">— Seleccionar —</option>
                        <option value="MASCULINO">Masculino</option>
                        <option value="FEMENINO">Femenino</option>
                      </select>
                    </div>
                  </div>
                  <div className="section-lbl">Campos de Saberes y Materias</div>
                  {CAMPOS.map(campo => {
                    const materias = subjectsByCampo[campo.value] || []
                    const selCount = materias.filter(s => form.subjectIds.includes(s.id)).length
                    return (
                      <div key={campo.value} style={{border:'1.5px solid #CBE0F0',borderRadius:'10px',marginBottom:'8px'}}>
                        <div style={{background:'#F8FBFF',padding:'9px 14px',fontWeight:700,fontSize:'12px',color:'#1A3A7C',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                          <span>{campo.label}</span>
                          {selCount > 0 && <span style={{background:'#1A3A7C',color:'#fff',borderRadius:'20px',padding:'2px 10px',fontSize:'11px'}}>{selCount} seleccionada{selCount>1?'s':''}</span>}
                        </div>
                        <div className="subject-checks" style={{padding:'10px 14px'}}>
                          {materias.map(s => (
                            <label key={s.id} className={`check-item ${form.subjectIds.includes(s.id) ? 'checked' : ''}`}>
                              <input type="checkbox" checked={form.subjectIds.includes(s.id)} onChange={() => toggleSubject(s.id)}/>
                              <span>{s.name}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </>
              )}
            </div>
            <div className="mfoot">
              <button className="btn-outline" onClick={() => setShowModal(false)}>Cancelar</button>
              <button className="btn-primary" onClick={handleSave} disabled={saving || loadingEdit}>
                {saving ? <span className="spinsm"/> : editMode ? <Edit size={14}/> : <Plus size={14}/>}
                {saving ? 'Guardando...' : editMode ? 'Actualizar' : 'Registrar maestro'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal especialidades ── */}
      {showSpecialties && specTeacher && (
        <div className="overlay" onClick={() => setShowSpecialties(false)}>
          <div className="modal modal-spec" onClick={e => e.stopPropagation()}>
            <div className="mhead">
              <div>
                <h2>Materias que puede enseñar</h2>
                <p className="mhead-sub">{specTeacher.lastName} {specTeacher.firstName}</p>
              </div>
              <button onClick={() => setShowSpecialties(false)}><X size={18}/></button>
            </div>
            <div className="mbody">
              <div className="fg">
                <label>Agregar materia</label>
                <div className="sw">
                  <Search size={12} className="sw-icon"/>
                  <input type="text" placeholder="Buscar materia..." value={specSearch}
                    onChange={e => { setSpecSearch(e.target.value); setSelectedSubjectId('') }}/>
                </div>
                <div className="option-list">
                  {availableSubjects.length === 0 ? (
                    <div className="no-opt">
                      {specSearch ? 'No se encontraron materias' : 'Todas las materias ya están asignadas'}
                    </div>
                  ) : availableSubjects.map(s => {
                    const sel = selectedSubjectId === String(s.id)
                    return (
                      <label key={s.id} className={`opt-item ${sel ? 'sel' : ''}`}>
                        <input type="radio" name="spec-subj" value={s.id} checked={sel}
                          onChange={() => setSelectedSubjectId(String(s.id))}/>
                        <div className="opt-info">
                          <span className="opt-name">{s.name}</span>
                          {s.campo && <span className="opt-sub">{CAMPO_LABELS[s.campo] || s.campo}</span>}
                        </div>
                      </label>
                    )
                  })}
                </div>
                <button className="btn-primary" style={{justifyContent:'center'}}
                  onClick={handleAddSpecialty} disabled={!selectedSubjectId || addingSpec}>
                  {addingSpec ? <span className="spinsm"/> : <Plus size={14}/>}
                  {addingSpec ? 'Agregando...' : 'Agregar materia seleccionada'}
                </button>
              </div>
              {loadingSpec ? (
                <div className="center-state"><div className="spinner"/></div>
              ) : specialties.length === 0 ? (
                <div className="spec-empty"><BookOpen size={28} style={{opacity:.3}}/><p>Sin materias asignadas aún.</p></div>
              ) : (
                <div className="fg">
                  <label>Materias asignadas ({specialties.length})</label>
                  <div className="spec-list">
                    {Object.entries(specialtiesByCampo).map(([campo, items]) => (
                      <div key={campo} className="spec-campo-group">
                        <div className="spec-campo-label" style={{ background: CAMPO_COLORS[campo] || '#F5F5F5', color: CAMPO_TEXT[campo] || '#444' }}>
                          {CAMPO_LABELS[campo] || campo}
                        </div>
                        {items.map(sp => (
                          <div key={sp.id} className="spec-item">
                            <span className="spec-name">{sp.subject.name}</span>
                            <button className="spec-remove" onClick={() => handleRemoveSpecialty(sp.id)}><X size={12}/></button>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="mfoot">
              <span className="spec-count">{specialties.length} materia{specialties.length !== 1 ? 's' : ''} asignada{specialties.length !== 1 ? 's' : ''}</span>
              <button className="btn-primary" onClick={() => setShowSpecialties(false)}>Listo</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal credenciales ── */}
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
              <button className="btn-outline" onClick={copyCreds}>{copied ? <Check size={14}/> : <Copy size={14}/>} {copied ? 'Copiado' : 'Copiar credenciales'}</button>
              <button className="btn-primary" onClick={() => setShowCredentials(false)}>Entendido</button>
            </div>
          </div>
        </div>
      )}
{/* ── Modal carga horaria ACTUALIZADO ── */}
      {workloadModal.open && workloadModal.data && (
        <div className="overlay" onClick={() => setWorkloadModal({ open: false, teacherId: null, data: null })}>
          <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
            <div className="mhead">
              <div>
                <h2>{workloadModal.data.teacher?.lastName} {workloadModal.data.teacher?.firstName}</h2>
                <p className="mhead-sub">{workloadModal.data.teacher?.specialty || 'Sin especialidad registrada'}</p>
              </div>
              <button onClick={() => setWorkloadModal({ open: false, teacherId: null, data: null })}><X size={18}/></button>
            </div>
            <div className="mbody">

              {/* Tarjetas resumen */}
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'12px',flexShrink:0}}>
                <div style={{background:'#633806',color:'#fff',borderRadius:'12px',padding:'16px',textAlign:'center'}}>
                  <div style={{fontSize:'11px',opacity:.8,textTransform:'uppercase',letterSpacing:'.5px',marginBottom:6}}>Carga contratada</div>
                  <div style={{fontSize:'28px',fontWeight:'800',lineHeight:1}}>{workloadModal.data.horasContratadaMes || 0}</div>
                  <div style={{fontSize:'11px',opacity:.7,marginTop:4}}>hrs/mes</div>
                </div>
                <div style={{background:'#1A3A7C',color:'#fff',borderRadius:'12px',padding:'16px',textAlign:'center'}}>
                  <div style={{fontSize:'11px',opacity:.8,textTransform:'uppercase',letterSpacing:'.5px',marginBottom:6}}>Materias distintas</div>
                  <div style={{fontSize:'28px',fontWeight:'800',lineHeight:1}}>
                    {[...new Set(workloadModal.data.assignments.map((a: any) => a.subjectName))].length}
                  </div>
                  <div style={{fontSize:'11px',opacity:.7,marginTop:4}}>materias</div>
                </div>
                <div style={{background:'#0F6E56',color:'#fff',borderRadius:'12px',padding:'16px',textAlign:'center'}}>
                  <div style={{fontSize:'11px',opacity:.8,textTransform:'uppercase',letterSpacing:'.5px',marginBottom:6}}>Asignaciones</div>
                  <div style={{fontSize:'28px',fontWeight:'800',lineHeight:1}}>{workloadModal.data.assignments.length}</div>
                  <div style={{fontSize:'11px',opacity:.7,marginTop:4}}>cursos</div>
                </div>
              </div>

              {/* Horas por tipo de horario institucional */}
              {workloadModal.data.totalesPorHorario && workloadModal.data.totalesPorHorario.length > 0 && (
                <div style={{flexShrink:0}}>
                  <div style={{fontSize:'11px',fontWeight:700,color:'#1A3A7C',textTransform:'uppercase',letterSpacing:'.5px',marginBottom:8}}>
                    Horas asignadas en horario
                  </div>
                  <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))',gap:10}}>
                    {workloadModal.data.totalesPorHorario.map((h: any) => {
                      const porcentaje = workloadModal.data.horasContratadaMes > 0
                        ? Math.min(Math.round((h.horasMes / workloadModal.data.horasContratadaMes) * 100), 100)
                        : 0
                      const color = porcentaje >= 100 ? '#0F6E56' : porcentaje >= 75 ? '#BA7517' : '#C0392B'
                      const bg    = porcentaje >= 100 ? '#E1F5EE' : porcentaje >= 75 ? '#FFFBEA' : '#FFF0F0'
                      return (
                        <div key={h.horarioId} style={{background:'#F8FBFF',border:'1px solid #CBE0F0',borderRadius:10,padding:14}}>
                          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8}}>
                            <div>
                              <div style={{fontSize:13,fontWeight:700,color:'#1A3A7C'}}>
                                {h.isWinter ? '❄️' : '☀️'} {h.nombre}
                              </div>
                              <div style={{fontSize:11,color:'#6B8BB0',marginTop:2}}>
                                {h.minPeriodo} min/periodo · {h.totalPeriodos} periodos/sem
                              </div>
                            </div>
                            <div style={{background:bg,color,borderRadius:8,padding:'4px 10px',fontSize:12,fontWeight:700}}>
                              {porcentaje}%
                            </div>
                          </div>
                          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:8}}>
                            <div style={{background:'#fff',borderRadius:8,padding:'6px',textAlign:'center'}}>
                              <div style={{fontSize:16,fontWeight:800,color:'#1A3A7C'}}>{h.horasSemana}</div>
                              <div style={{fontSize:10,color:'#6B8BB0'}}>hrs/semana</div>
                            </div>
                            <div style={{background:'#fff',borderRadius:8,padding:'6px',textAlign:'center'}}>
                              <div style={{fontSize:16,fontWeight:800,color:'#1A3A7C'}}>{h.horasMes}</div>
                              <div style={{fontSize:10,color:'#6B8BB0'}}>hrs/mes</div>
                            </div>
                          </div>
                          <div style={{background:'#F0F6FC',borderRadius:20,height:5,overflow:'hidden'}}>
                            <div style={{height:'100%',borderRadius:20,width:`${porcentaje}%`,background:color}}/>
                          </div>
                          <div style={{display:'flex',justifyContent:'space-between',marginTop:3}}>
                            <span style={{fontSize:10,color:'#6B8BB0'}}>0</span>
                            <span style={{fontSize:10,color:'#6B8BB0'}}>Meta: {workloadModal.data.horasContratadaMes} hrs/mes</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Detalle de asignaciones — con scroll propio */}
              <div style={{display:'flex',flexDirection:'column',flex:1,minHeight:0,border:'1px solid #CBE0F0',borderRadius:'10px',overflow:'hidden'}}>
                <div style={{
                  padding:'12px 16px',background:'#F8FBFF',borderBottom:'1px solid #CBE0F0',
                  fontSize:'12px',fontWeight:'700',color:'#1A3A7C',textTransform:'uppercase',
                  letterSpacing:'.5px',flexShrink:0
                }}>
                  Detalle de asignaciones ({workloadModal.data.assignments.length})
                </div>
                <div style={{overflowY:'auto',flex:1}}>
                  <table style={{width:'100%',borderCollapse:'collapse'}}>
                    <thead>
                      <tr style={{background:'#F0F6FC',position:'sticky',top:0,zIndex:1}}>
                        <th style={{padding:'10px 14px',textAlign:'left',fontSize:'11px',fontWeight:'600',color:'#1A3A7C',textTransform:'uppercase',letterSpacing:'.5px'}}>Materia</th>
                        <th style={{padding:'10px 14px',textAlign:'left',fontSize:'11px',fontWeight:'600',color:'#1A3A7C',textTransform:'uppercase',letterSpacing:'.5px'}}>Curso</th>
                        <th style={{padding:'10px 14px',textAlign:'center',fontSize:'11px',fontWeight:'600',color:'#1A3A7C',textTransform:'uppercase',letterSpacing:'.5px'}}>Periodos</th>
                        <th style={{padding:'10px 14px',textAlign:'right',fontSize:'11px',fontWeight:'600',color:'#1A3A7C',textTransform:'uppercase',letterSpacing:'.5px'}}>Hrs/Sem</th>
                      </tr>
                    </thead>
                    <tbody>
                      {workloadModal.data.assignments.map((a: any, i: number) => (
                        <tr key={i} style={{borderTop:'1px solid #F0F6FC'}}>
                          <td style={{padding:'10px 14px',fontSize:'13px',fontWeight:'500',color:'#1A3A7C'}}>{a.subjectName}</td>
                          <td style={{padding:'10px 14px',fontSize:'13px',color:'#6B8BB0'}}>{a.courseLabel}</td>
                          <td style={{padding:'10px 14px',textAlign:'center'}}>
                            <span style={{background:'#FDF0E6',color:'#633806',padding:'2px 10px',borderRadius:'20px',fontSize:'12px',fontWeight:'600'}}>
                              {a.periodosAsignados || 0} per.
                            </span>
                          </td>
                          <td style={{padding:'10px 14px',textAlign:'right'}}>
                            <span style={{background:'#FFFBEA',color:'#BA7517',border:'1px solid #F5C518',padding:'3px 12px',borderRadius:'20px',fontSize:'12px',fontWeight:'600'}}>
                              {a.hoursPerWeek} hrs
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
            <div className="mfoot">
              <span style={{fontSize:'12px',color:'#6B8BB0'}}>
                Carga contratada: <strong>{workloadModal.data.horasContratadaMes || 0} hrs/mes</strong>
              </span>
              <button className="btn-primary" onClick={() => setWorkloadModal({ open: false, teacherId: null, data: null })}>Cerrar</button>
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
        td{padding:11px 14px;font-size:13px;color:#1A3A7C;border-top:1px solid #F0F6FC;vertical-align:middle}
        tr:hover td{background:#FAFCFF}
        .muted{color:#6B8BB0;font-size:12px}
        .tname{font-weight:500;color:#1A3A7C}
        .tuser{font-size:11px;color:#6B8BB0;margin-top:2px}
        .tspec{font-size:11px;color:#633806;margin-top:2px;font-style:italic}
        .gbadge{padding:2px 8px;border-radius:20px;font-size:11px;font-weight:500}
        .gbadge.masc{background:#E0ECF8;color:#1A3A7C}
        .gbadge.fem{background:#FDEEF5;color:#9B3070}
        .hours-badge{background:#FFFBEA;color:#BA7517;border:1px solid #F5C518;padding:2px 8px;border-radius:20px;font-size:11px;font-weight:500}
        .spec-tags-wrap{display:flex;flex-wrap:wrap;gap:4px;align-items:center}
        .spec-tag{display:inline-block;padding:2px 8px;border-radius:20px;font-size:11px;font-weight:500;white-space:nowrap}
        .spec-badge-empty{display:inline-flex;align-items:center;gap:4px;background:#F0F6FC;color:#6B8BB0;border:1px dashed #CBE0F0;padding:3px 9px;border-radius:20px;font-size:11px;cursor:pointer}
        .spec-badge-empty:hover{background:#E0ECF8;color:#1A3A7C;border-color:#4A9FD4}
        .spec-more{background:#F0F6FC;color:#1A3A7C;border:1px solid #CBE0F0;padding:2px 7px;border-radius:20px;font-size:11px;cursor:pointer}
        .spec-more:hover{background:#E0ECF8}
        .spec-edit-btn{background:none;border:none;color:#6B8BB0;cursor:pointer;display:flex;align-items:center;padding:2px}
        .spec-edit-btn:hover{color:#1A3A7C}
        .sbadge{padding:3px 9px;border-radius:20px;font-size:11px;font-weight:500}
        .sbadge.act{background:#E1F5EE;color:#0F6E56}
        .sbadge.ina{background:#FFF0F0;color:#C0392B}
        .actions{display:flex;gap:5px}
        .icon-btn{width:28px;height:28px;border:none;border-radius:6px;cursor:pointer;display:flex;align-items:center;justify-content:center}
        .icon-btn.view{background:#E0ECF8;color:#1A3A7C}
        .icon-btn.edit{background:#FAEEDA;color:#633806}
        .icon-btn.spec{background:#E8F0FB;color:#1A3A7C}
        .icon-btn.deact{background:#FFF0F0;color:#C0392B}
        .icon-btn.act2{background:#E1F5EE;color:#0F6E56}
        .icon-btn.del{background:#FFF0F0;color:#C0392B}
        .icon-btn:hover{opacity:.75}
        .tfooter{padding:10px 14px;font-size:12px;color:#6B8BB0;display:flex;gap:16px}
        .center-state{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:48px;gap:12px;color:#6B8BB0;font-size:13px}
        .overlay{position:fixed;inset:0;background:rgba(0,0,0,0.4);z-index:500;display:flex;align-items:center;justify-content:center;padding:16px}
        .modal{background:#fff;border-radius:14px;width:100%;max-width:440px;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,0.15);max-height:92vh;display:flex;flex-direction:column}
        .modal-lg{max-width:780px;height:90vh}
        .modal-spec{max-width:460px}
        .mhead{display:flex;align-items:flex-start;justify-content:space-between;padding:18px 20px;border-bottom:1px solid #CBE0F0;flex-shrink:0;gap:12px}
        .mhead h2{font-size:16px;font-weight:600;color:#1A3A7C;margin:0}
        .mhead-sub{font-size:12px;color:#6B8BB0;margin-top:2px}
        .mhead button{background:none;border:none;cursor:pointer;color:#6B8BB0;display:flex;padding:4px;border-radius:6px;flex-shrink:0}
        .mhead button:hover{background:#F0F6FC;color:#1A3A7C}
       .mbody{padding:20px;display:flex;flex-direction:column;gap:14px;overflow-y:auto;flex:1;min-height:0}
        .mfoot{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:16px 20px;border-top:1px solid #CBE0F0;flex-shrink:0}
        .section-lbl{font-size:12px;font-weight:700;color:#1A3A7C;text-transform:uppercase;letter-spacing:.6px;padding-bottom:4px;border-bottom:1px solid #F0F6FC}
        .form-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
        .fg{display:flex;flex-direction:column;gap:6px}
        .fg label{font-size:11px;font-weight:700;color:#1A3A7C;text-transform:uppercase;letter-spacing:.5px}
        .fg input,.fg-select{padding:9px 12px;border:1.5px solid #CBE0F0;border-radius:8px;font-size:13px;color:#1A3A7C;outline:none;width:100%}
        .fg input:focus,.fg-select:focus{border-color:#4A9FD4;box-shadow:0 0 0 3px rgba(74,159,212,.12)}
        .info-box{background:#F0F6FC;border:1px solid #CBE0F0;border-radius:8px;padding:12px;font-size:12px;color:#6B8BB0;line-height:1.6}
        .subject-checks{display:flex;flex-wrap:wrap;gap:8px}
        .check-item{display:flex;align-items:center;gap:6px;padding:6px 10px;border:1.5px solid #CBE0F0;border-radius:8px;font-size:12px;color:#1A3A7C;cursor:pointer;transition:all .15s;user-select:none}
        .check-item:hover{border-color:#4A9FD4;background:#F0F6FC}
        .check-item.checked{border-color:#1A3A7C;background:#E8F0FB;font-weight:500}
        .check-item input{accent-color:#1A3A7C;width:13px;height:13px;flex-shrink:0}
        .sw{position:relative}
        .sw-icon{position:absolute;left:9px;top:50%;transform:translateY(-50%);color:#4A9FD4;pointer-events:none}
        .sw input{padding:7px 10px 7px 28px;border:1.5px solid #CBE0F0;border-radius:8px;font-size:13px;color:#1A3A7C;outline:none;width:100%}
        .sw input:focus{border-color:#4A9FD4}
        .option-list{border:1.5px solid #CBE0F0;border-radius:8px;max-height:150px;overflow-y:auto}
        .opt-item{display:flex;align-items:center;gap:8px;padding:6px 10px;cursor:pointer;border-bottom:1px solid #F0F6FC;transition:background .12s}
        .opt-item:last-child{border-bottom:none}
        .opt-item:hover{background:#F8FBFF}
        .opt-item.sel{background:#E8F0FB;border-left:3px solid #1A3A7C}
        .opt-item input{accent-color:#1A3A7C;width:13px;height:13px;flex-shrink:0;cursor:pointer}
        .opt-info{flex:1;display:flex;flex-direction:column;gap:1px}
        .opt-name{font-size:12px;font-weight:500;color:#1A3A7C}
        .opt-sub{font-size:10px;color:#6B8BB0}
        .no-opt{padding:12px;text-align:center;font-size:12px;color:#6B8BB0;font-style:italic}
        .spec-list{display:flex;flex-direction:column;gap:6px}
        .spec-campo-group{border:1px solid #E8EFF8;border-radius:8px;overflow:hidden}
        .spec-campo-label{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;padding:6px 12px}
        .spec-item{display:flex;align-items:center;justify-content:space-between;padding:8px 12px;border-top:1px solid #F0F6FC;background:#fff}
        .spec-item:hover{background:#FAFCFF}
        .spec-name{font-size:12px;color:#1A3A7C;font-weight:500}
        .spec-remove{width:22px;height:22px;border:none;border-radius:5px;background:#FFF0F0;color:#C0392B;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0}
        .spec-remove:hover{opacity:.75}
        .spec-empty{text-align:center;padding:20px;color:#6B8BB0;font-size:13px;display:flex;flex-direction:column;align-items:center;gap:8px}
        .spec-count{font-size:12px;color:#6B8BB0}
        .cred-box{display:flex;flex-direction:column;gap:10px}
        .cred-title{font-size:13px;color:#6B8BB0;margin:0}
        .cred-name{font-size:16px;font-weight:700;color:#1A3A7C;margin:0}
        .cred-row{display:flex;align-items:center;gap:10px;background:#F0F6FC;border:1px solid #CBE0F0;border-radius:8px;padding:10px 14px}
        .cred-label{font-size:12px;font-weight:600;color:#6B8BB0;min-width:80px;text-transform:uppercase;letter-spacing:.5px}
        .cred-value{font-size:14px;font-weight:600;color:#1A3A7C;font-family:monospace;word-break:break-all}
        .cred-hint{font-size:12px;color:#0F6E56;background:#E1F5EE;border:1px solid #9FE1CB;border-radius:8px;padding:10px}
        .cred-note{font-size:12px;color:#BA7517;background:#FFFBEA;border:1px solid #F5C518;border-radius:8px;padding:10px;line-height:1.5}
        .spinner{width:20px;height:20px;border:2px solid rgba(26,58,124,.2);border-top-color:#1A3A7C;border-radius:50%;animation:spin .7s linear infinite}
        .spinsm{width:14px;height:14px;border:2px solid rgba(255,255,255,.3);border-top-color:#fff;border-radius:50%;animation:spin .7s linear infinite;display:inline-block}
        @keyframes spin{to{transform:rotate(360deg)}}
        @media(max-width:600px){.page-header{flex-direction:column}.form-grid{grid-template-columns:1fr}.spec-add-row{flex-direction:column}}
      `}</style>
    </div>
  )
}