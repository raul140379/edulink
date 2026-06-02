'use client'

import { useEffect, useState } from 'react'
import { Plus, Search, X, Edit, Eye, UserCheck, UserX, BookOpen, Copy, Check, Trash2, KeyRound } from 'lucide-react'
import { useRouter } from 'next/navigation'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

interface Student {
  id:        number
  firstName: string
  lastName:  string
  gender:    string
  ci?:       string
  rude?:     string
  birthDate?: string
  phone?:    string
  email?:    string
  address?:  string
  isActive:  boolean
  user?:     { id: number; email: string; role: string }
  parents:   { relationType: string; parent: { firstName: string; lastName: string; phone?: string } }[]
  assignments: {
    year: number
    educationType: string
    course: { level: string; grade: string; parallel: string; shift: string }
    academicYear: { isActive: boolean }
  }[]
}

interface Course {
  id: number; level: string; grade: string; parallel: string; shift: string; educationType: string
}

interface CreatedCredentials {
  accessEmail:     string
  defaultPassword: string
  studentName:     string
}

const GRADE_LABELS: Record<string, string> = { PRIMERO: '1°', SEGUNDO: '2°', TERCERO: '3°', CUARTO: '4°', QUINTO: '5°', SEXTO: '6°' }
const SHIFT_LABELS: Record<string, string> = { MORNING: 'Mañana', AFTERNOON: 'Tarde', NIGHT: 'Noche' }
const LEVEL_LABELS: Record<string, string> = { INICIAL: 'Inicial', PRIMARIA: 'Primaria', SECUNDARIA: 'Secundaria' }

const emptyForm = { firstName: '', lastName: '', ci: '', rude: '', birthDate: '', phone: '', email: '', address: '', gender: '' }

export default function EstudiantesPage() {
  const router = useRouter()
  const [students,     setStudents]     = useState<Student[]>([])
  const [courses,      setCourses]      = useState<Course[]>([])
  const [loading,      setLoading]      = useState(true)
  const [search,       setSearch]       = useState('')
  const [filterActive, setFilterActive] = useState('')
  const [filterGender, setFilterGender] = useState('')
  const [filterCourse, setFilterCourse] = useState('')
  const [showModal,        setShowModal]        = useState(false)
  const [showEnrollModal,  setShowEnrollModal]  = useState(false)
  const [showCredentials,  setShowCredentials]  = useState(false)
  const [editMode,     setEditMode]     = useState(false)
  const [editId,       setEditId]       = useState<number | null>(null)
  const [enrollId,     setEnrollId]     = useState<number | null>(null)
  const [saving,       setSaving]       = useState(false)
  const [success,      setSuccess]      = useState('')
  const [error,        setError]        = useState('')
  const [form,         setForm]         = useState(emptyForm)
  const [enrollCourseId, setEnrollCourseId] = useState('')
  const [credentials,  setCredentials]  = useState<CreatedCredentials | null>(null)
  const [copied,       setCopied]       = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [importing,       setImporting]       = useState(false)
  const [importResult,    setImportResult]    = useState<any>(null)
  const [importType, setImportType] = useState<'students' | 'tutors'>('students')

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : ''

  const notify = (msg: string, type: 'success' | 'error' = 'success') => {
    if (type === 'success') { setSuccess(msg); setTimeout(() => setSuccess(''), 3000) }
    else                    { setError(msg);   setTimeout(() => setError(''),   4000) }
  }

  const fetchStudents = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (search)       params.set('search', search)
      if (filterActive) params.set('isActive', filterActive)
      const res  = await fetch(`${API_URL}/api/students?${params}`, { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      if (res.ok) setStudents(data)
      else notify('Error al cargar estudiantes', 'error')
    } catch { notify('Error de conexión', 'error') }
    finally  { setLoading(false) }
  }

  const fetchCourses = async () => {
    try {
      const res  = await fetch(`${API_URL}/api/courses`, { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      if (res.ok) setCourses(data)
    } catch { console.error('Error cargando cursos') }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchStudents(); fetchCourses() }, [])

  const openCreate = () => { setEditMode(false); setEditId(null); setForm(emptyForm); setError(''); setShowModal(true) }

  const openEdit = (s: Student) => {
    setEditMode(true); setEditId(s.id)
    setForm({
      firstName: s.firstName, lastName: s.lastName,
      ci: s.ci || '', rude: s.rude || '',
      birthDate: s.birthDate ? s.birthDate.split('T')[0] : '',
      phone: s.phone || '', email: s.email || '', address: s.address || '',gender: s.gender || '',
    })
    setError(''); setShowModal(true)
  }

  const openEnroll = (id: number) => { setEnrollId(id); setEnrollCourseId(''); setError(''); setShowEnrollModal(true) }

  const handleSave = async () => {
    setError(''); setSaving(true)
    if (!form.gender) { notify('El género es requerido', 'error'); setSaving(false); return }
    try {
      const url    = editMode ? `${API_URL}/api/students/${editId}` : `${API_URL}/api/students`
      const method = editMode ? 'PUT' : 'POST'
      const res    = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) { notify(data.message, 'error'); return }
      setShowModal(false)
      fetchStudents()
      if (!editMode && data.accessEmail) {
        setCredentials({ accessEmail: data.accessEmail, defaultPassword: data.defaultPassword, studentName: `${form.firstName} ${form.lastName}` })
        setShowCredentials(true)
      } else {
        notify('Estudiante actualizado correctamente')
      }
    } catch { notify('Error de conexión', 'error') }
    finally  { setSaving(false) }
  }

  const handleEnroll = async () => {
    if (!enrollCourseId) { notify('Selecciona un curso', 'error'); return }
    setError(''); setSaving(true)
    try {
      const res  = await fetch(`${API_URL}/api/students/${enrollId}/enroll`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ courseId: parseInt(enrollCourseId) }),
      })
      const data = await res.json()
      if (!res.ok) { notify(data.message, 'error'); return }
      notify(data.message); setShowEnrollModal(false); fetchStudents()
    } catch { notify('Error de conexión', 'error') }
    finally  { setSaving(false) }
  }

  const handleToggle = async (id: number) => {
    try {
      const res  = await fetch(`${API_URL}/api/students/${id}/toggle`, { method: 'PATCH', headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      if (res.ok) { notify(data.message); fetchStudents() }
      else notify(data.message, 'error')
    } catch { notify('Error al cambiar estado', 'error') }
  }

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`¿Eliminar a ${name}? Esta acción no se puede deshacer.`)) return
    try {
      const res  = await fetch(`${API_URL}/api/students/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      if (res.ok) { notify(data.message); fetchStudents() }
      else notify(data.message, 'error')
    } catch { notify('Error al eliminar', 'error') }
  }

  const handleGenerateCredentials = async (id: number, name: string) => {
    try {
      const res  = await fetch(`${API_URL}/api/students/${id}/generate-credentials`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      if (!res.ok) { notify(data.message, 'error'); return }
      setCredentials({ accessEmail: data.accessEmail, defaultPassword: data.defaultPassword, studentName: name })
      setShowCredentials(true)
      fetchStudents()
    } catch { notify('Error al generar credenciales', 'error') }
  }

  const copyCredentials = () => {
    if (!credentials) return
    navigator.clipboard.writeText(`Estudiante: ${credentials.studentName}\nEmail: ${credentials.accessEmail}\nContraseña: ${credentials.defaultPassword}`)
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }

  const getCurrentCourse = (s: Student) => {
    const active = s.assignments.find(a => a.academicYear.isActive)
    if (!active) return '—'
    const c = active.course
    return `${LEVEL_LABELS[c.level]} ${GRADE_LABELS[c.grade]} ${c.parallel} · ${SHIFT_LABELS[c.shift]}`
  }

  const formatDate = (d?: string) => {
    if (!d) return "—"
    const dt = new Date(d)
    return dt.toLocaleDateString("es-BO", { day:"2-digit", month:"2-digit", year:"numeric" })
  }

  const filteredStudents = students.filter(s => {
    if (filterGender && s.gender !== filterGender) return false
    if (filterCourse) {
      const active = s.assignments.find(a => a.academicYear.isActive)
      if (!active || String(active.course.level + '_' + active.course.grade + '_' + active.course.parallel) !== filterCourse) return false
    }
    return true
  })

  const handleImport = async (file: File) => {
  setImporting(true)
  try {
    const formData = new FormData()
    formData.append('file', file)
    const res  = await fetch(`${API_URL}/api/students/import`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    })
    const data = await res.json()
    setImportResult(data)
    if (res.ok) fetchStudents()
  } catch { notify('Error al importar', 'error') }
  finally  { setImporting(false) }
}

const handleImportTutors = async (file: File) => {
  setImporting(true)
  try {
    const formData = new FormData()
    formData.append('file', file)
    const res  = await fetch(`${API_URL}/api/students/import-tutors`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    })
    const data = await res.json()
    setImportResult(data)
    if (res.ok) fetchStudents()
  } catch { notify('Error al importar tutores', 'error') }
  finally  { setImporting(false) }
}
  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Gestión de Estudiantes</h1>
          <p>Registro, edición e inscripción de estudiantes</p>
        </div>
        <button className="btn-outline" onClick={() => { setShowImportModal(true); setImportResult(null) }}>
  📥 Importar Excel
</button>
        <button className="btn-primary" onClick={openCreate}><Plus size={16}/> Nuevo estudiante</button>
      </div>

      {success && <div className="alert suc">{success}</div>}
      {error && !showModal && !showEnrollModal && <div className="alert err">{error}</div>}

      <div className="filters-bar">
        <div className="search-wrap">
          <Search size={14} className="sicon"/>
          <input placeholder="Buscar por nombre, CI o RUDE..." value={search}
            onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && fetchStudents()}/>
        </div>
        <select value={filterActive} onChange={e => setFilterActive(e.target.value)}>
          <option value="">Todos</option>
          <option value="true">Activos</option>
          <option value="false">Inactivos</option>
        </select>
        <select value={filterGender} onChange={e => setFilterGender(e.target.value)}>
          <option value="">Género</option>
          <option value="MASCULINO">Masculino</option>
          <option value="FEMENINO">Femenino</option>
        </select>
        <select value={filterCourse} onChange={e => setFilterCourse(e.target.value)}>
          <option value="">Curso</option>
          {courses
            .filter(c => c.shift === 'MORNING' && c.educationType === 'REGULAR')
            .sort((a, b) => {
              const order = ['PRIMERO','SEGUNDO','TERCERO','CUARTO','QUINTO','SEXTO']
              return order.indexOf(a.grade) - order.indexOf(b.grade) || a.parallel.localeCompare(b.parallel)
            })
            .map(c => {
              const key = `${c.level}_${c.grade}_${c.parallel}`
              return <option key={c.id} value={key}>{GRADE_LABELS[c.grade]}{c.parallel} · {LEVEL_LABELS[c.level]}</option>
            })
          }
        </select>
        <button className="btn-outline" onClick={fetchStudents}>Buscar</button>
      </div>

      <div className="table-card">
        {loading ? (
          <div className="center-state"><div className="spinner"/><p>Cargando...</p></div>
        ) : students.length === 0 ? (
          <div className="center-state"><p>No se encontraron estudiantes</p></div>
        ) : (
          <table>
            <thead>
              <tr><th>#</th><th>Nombre completo</th><th>CI</th><th>RUDE</th><th>Fecha Nac.</th><th>Género</th><th>Curso actual</th><th>Estado</th><th>Acciones</th></tr>
            </thead>
            <tbody>
              {filteredStudents.map((s, i) => (
                <tr key={s.id}>
                  <td className="muted">{i + 1}</td>
                  <td>
                    <div className="student-name">{s.lastName} {s.firstName}</div>
                    {s.user
                      ? <div className="student-user">{s.user.email}</div>
                      : <button className="gen-cred-btn" onClick={() => handleGenerateCredentials(s.id, `${s.firstName} ${s.lastName}`)}>
                          <KeyRound size={11}/> Generar acceso
                        </button>
                    }
                  </td>
                  <td className="muted">{s.ci || '—'}</td>
                  <td className="muted">{s.rude || "—"}</td>
                  <td className="muted">
                    <div>{formatDate(s.birthDate)}</div>
                    {s.birthDate && (
                      <div style={{fontSize:'11px',color:'#4A9FD4'}}>
                        {Math.floor((Date.now() - new Date(s.birthDate).getTime()) / (365.25 * 24 * 60 * 60 * 1000))} años
                      </div>
                    )}
                  </td>
                  <td>
                    <span className={`sbadge ${s.gender === 'MASCULINO' ? 'gen-m' : 'gen-f'}`}>
                      {s.gender === 'MASCULINO' ? '♂ M' : '♀ F'}
                    </span>
                  </td>
                  <td className="muted">{getCurrentCourse(s)}</td>
                  <td><span className={`sbadge ${s.isActive ? 'act' : 'ina'}`}>{s.isActive ? 'Activo' : 'Inactivo'}</span></td>
                  <td>
                    <div className="actions">
                      <button className="icon-btn view" title="Ver detalle" onClick={() => router.push(`/dashboard/admin/estudiantes/${s.id}`)}><Eye size={13}/></button>
                      <button className="icon-btn edit" title="Editar" onClick={() => openEdit(s)}><Edit size={13}/></button>
                      <button className="icon-btn enroll" title="Inscribir en curso" onClick={() => openEnroll(s.id)}><BookOpen size={13}/></button>
                      <button className={`icon-btn ${s.isActive ? 'deact' : 'act2'}`} title={s.isActive ? 'Desactivar' : 'Activar'} onClick={() => handleToggle(s.id)}>
                        {s.isActive ? <UserX size={13}/> : <UserCheck size={13}/>}
                      </button>
                      <button className="icon-btn del" title="Eliminar" onClick={() => handleDelete(s.id, `${s.firstName} ${s.lastName}`)}><Trash2 size={13}/></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <div className="tfooter">
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:'8px'}}>
          <span>Mostrando <strong>{filteredStudents.length}</strong> de <strong>{students.length}</strong> estudiantes</span>
          <div style={{display:'flex',gap:'12px'}}>
            <span style={{display:'flex',alignItems:'center',gap:'5px'}}>
              <span className="sbadge gen-m">♂ M</span>
              <strong>{filteredStudents.filter(s => s.gender === 'MASCULINO').length}</strong> masculinos
            </span>
            <span style={{display:'flex',alignItems:'center',gap:'5px'}}>
              <span className="sbadge gen-f">♀ F</span>
              <strong>{filteredStudents.filter(s => s.gender === 'FEMENINO').length}</strong> femeninas
            </span>
          </div>
        </div>
      </div>

      {showModal && (
        <div className="overlay" onClick={() => setShowModal(false)}>
          <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
            <div className="mhead">
              <h2>{editMode ? 'Editar Estudiante' : 'Nuevo Estudiante'}</h2>
              <button onClick={() => setShowModal(false)}><X size={18}/></button>
            </div>
            <div className="mbody">
              {error && <div className="alert err">{error}</div>}
              {!editMode && <div className="info-box">🔑 El sistema generará automáticamente un email y contraseña de acceso.</div>}
              <div className="section-lbl">Datos personales</div>
              <div className="form-grid">
                <div className="fg"><label>Nombres *</label>
                  <input type="text" placeholder="Ej: Juan Carlos" value={form.firstName} onChange={e => setForm({...form, firstName: e.target.value})}/></div>
                <div className="fg"><label>Apellidos *</label>
                  <input type="text" placeholder="Ej: García López" value={form.lastName} onChange={e => setForm({...form, lastName: e.target.value})}/></div>
                <div className="fg"><label>CI (Cédula de Identidad)</label>
                  <input type="text" placeholder="Ej: 12345678" value={form.ci} onChange={e => setForm({...form, ci: e.target.value})}/></div>
                <div className="fg"><label>RUDE (Código nacional)</label>
                  <input type="text" placeholder="Ej: 00123456789" value={form.rude} onChange={e => setForm({...form, rude: e.target.value})}/></div>
                <div className="fg"><label>Fecha de nacimiento</label>
                  <input type="date" value={form.birthDate} onChange={e => setForm({...form, birthDate: e.target.value})}/></div>
                  <div className="fg"><label>Género *</label>
                    <select value={form.gender} onChange={e => setForm({...form, gender: e.target.value})}>
                       <option value="">-- Selecciona género --</option>
                      <option value="MASCULINO">Masculino</option>
                      <option value="FEMENINO">Femenino</option>
                    </select>
                  </div>
                <div className="fg"><label>Teléfono</label>
                  <input type="text" placeholder="Ej: 70012345" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})}/></div>
                <div className="fg"><label>Correo personal</label>
                  <input type="email" placeholder="Ej: estudiante@gmail.com" value={form.email} onChange={e => setForm({...form, email: e.target.value})}/></div>
                <div className="fg"><label>Dirección</label>
                  <input type="text" placeholder="Ej: Av. Principal 123" value={form.address} onChange={e => setForm({...form, address: e.target.value})}/></div>
              </div>
            </div>
            <div className="mfoot">
              <button className="btn-outline" onClick={() => setShowModal(false)}>Cancelar</button>
              <button className="btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? <span className="spinsm"/> : editMode ? <Edit size={14}/> : <Plus size={14}/>}
                {saving ? 'Guardando...' : editMode ? 'Actualizar' : 'Registrar estudiante'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showCredentials && credentials && (
        <div className="overlay">
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="mhead"><h2>✅ Credenciales generadas</h2></div>
            <div className="mbody">
              <div className="cred-box">
                <p className="cred-title">Credenciales de acceso para:</p>
                <p className="cred-name">{credentials.studentName}</p>
                <div className="cred-row"><span className="cred-label">Email:</span><span className="cred-value">{credentials.accessEmail}</span></div>
                <div className="cred-row"><span className="cred-label">Contraseña:</span><span className="cred-value">{credentials.defaultPassword}</span></div>
                <div className="cred-note">⚠️ Anota estas credenciales. La contraseña no se podrá ver de nuevo.</div>
              </div>
            </div>
            <div className="mfoot">
              <button className="btn-outline" onClick={copyCredentials}>
                {copied ? <Check size={14}/> : <Copy size={14}/>}
                {copied ? 'Copiado' : 'Copiar credenciales'}
              </button>
              <button className="btn-primary" onClick={() => setShowCredentials(false)}>Entendido</button>
            </div>
          </div>
        </div>
      )}

      {showEnrollModal && (
        <div className="overlay" onClick={() => setShowEnrollModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="mhead"><h2>Inscribir en Curso</h2><button onClick={() => setShowEnrollModal(false)}><X size={18}/></button></div>
            <div className="mbody">
              {error && <div className="alert err">{error}</div>}
              <div className="info-box">Se inscribirá en la <strong>gestión activa</strong>.</div>
              <div className="fg"><label>Seleccionar curso *</label>
                <select value={enrollCourseId} onChange={e => setEnrollCourseId(e.target.value)}>
                  <option value="">-- Selecciona un curso --</option>
                  {['INICIAL','PRIMARIA','SECUNDARIA'].map(level => (
                    <optgroup key={level} label={LEVEL_LABELS[level]}>
                      {courses.filter(c => c.level === level).map(c => (
                        <option key={c.id} value={c.id}>{GRADE_LABELS[c.grade]} {c.parallel} · {SHIFT_LABELS[c.shift]} · {c.educationType}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>
            </div>
            <div className="mfoot">
              <button className="btn-outline" onClick={() => setShowEnrollModal(false)}>Cancelar</button>
              <button className="btn-primary" onClick={handleEnroll} disabled={saving}>
                {saving ? <span className="spinsm"/> : <BookOpen size={14}/>}
                {saving ? 'Inscribiendo...' : 'Inscribir'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Modal importar Excel */} 
      {showImportModal && (
  <div className="overlay" onClick={() => setShowImportModal(false)}>
    <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
      <div className="mhead">
        <h2>📥 Importar desde Excel</h2>
        <button onClick={() => setShowImportModal(false)}><X size={18}/></button>
      </div>
      <div className="mbody">
        {!importResult ? (
          <>
            {/* Selector de tipo */}
            <div className="mode-toggle">
              <button className={`mode-btn ${importType === 'students' ? 'active' : ''}`}
                onClick={() => setImportType('students')}>
                Estudiantes
              </button>
              <button className={`mode-btn ${importType === 'tutors' ? 'active' : ''}`}
                onClick={() => setImportType('tutors')}>
                Tutores Legales
              </button>
            </div>
            <div className="info-box">
              {importType === 'students' ? (
                <>Columnas requeridas:<br/><strong>RUDE · NROKARDEX · NOMBRESCOMPLETO · APELLIDOS · GENERO</strong><br/>Género: <strong>M</strong> o <strong>F</strong></>
              ) : (
                <>Columnas requeridas:<br/><strong>RUDE · NROKARDEX · TUTORLEGAL</strong><br/>Si no tiene tutor escribe: <strong>SIN REGISTRO</strong></>
              )}
            </div>
            <div className="fg">
              <label>Seleccionar archivo Excel *</label>
              <input type="file" accept=".xlsx,.xls"
                onChange={e => {
                  const file = e.target.files?.[0]
                  if (file) importType === 'students' ? handleImport(file) : handleImportTutors(file)
                }}/>
            </div>
            {importing && (
              <div className="center-state">
                <div className="spinner"/>
                <p>Importando... esto puede tomar varios minutos</p>
              </div>
            )}
          </>
        ) : (
          <div style={{display:'flex',flexDirection:'column',gap:'12px'}}>
            <div className="alert suc">{importResult.message}</div>
            {/* Resultados de estudiantes */}
            {importResult.created?.length > 0 && (
              <div>
                <div className="section-lbl">✅ Creados ({importResult.created.length})</div>
                <div style={{maxHeight:'200px',overflowY:'auto',marginTop:'8px'}}>
                  {importResult.created.map((s: any, i: number) => (
                    <div key={i} style={{padding:'6px 0',borderBottom:'1px solid #F0F6FC',fontSize:'12px'}}>
                      <strong>{s.name}</strong> — {s.email} / {s.password}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {/* Resultados de tutores asignados */}
            {importResult.assigned?.length > 0 && (
              <div>
                <div className="section-lbl">✅ Tutores asignados ({importResult.assigned.length})</div>
                <div style={{maxHeight:'200px',overflowY:'auto',marginTop:'8px'}}>
                  {importResult.assigned.map((s: any, i: number) => (
                    <div key={i} style={{padding:'6px 0',borderBottom:'1px solid #F0F6FC',fontSize:'12px'}}>
                      <strong>{s.student}</strong> → Tutor: {s.tutor}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {importResult.skipped?.length > 0 && (
              <div>
                <div className="section-lbl">⚠️ Omitidos ({importResult.skipped.length})</div>
                <div style={{maxHeight:'150px',overflowY:'auto',marginTop:'4px'}}>
                  {importResult.skipped.map((s: any, i: number) => (
                    <div key={i} style={{fontSize:'12px',color:'#7A6000',padding:'4px 0'}}>
                      {s.name || `Kardex ${s.kardex}`} — {s.reason}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {importResult.errors?.length > 0 && (
              <div>
                <div className="section-lbl">❌ Errores ({importResult.errors.length})</div>
                <div style={{maxHeight:'150px',overflowY:'auto',marginTop:'4px'}}>
                  {importResult.errors.map((e: any, i: number) => (
                    <div key={i} style={{fontSize:'12px',color:'#C0392B',padding:'4px 0'}}>
                      {e.name || e.tutorNombre || `Kardex ${e.kardex}`} — {e.reason}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      <div className="mfoot">
        <button className="btn-primary" onClick={() => { setShowImportModal(false); setImportResult(null) }}>Cerrar</button>
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
        .student-name{font-weight:500;color:#1A3A7C}
        .student-user{font-size:11px;color:#6B8BB0;margin-top:2px}
        .gen-cred-btn{display:inline-flex;align-items:center;gap:4px;background:none;border:1px dashed #4A9FD4;color:#4A9FD4;border-radius:6px;padding:2px 8px;font-size:11px;cursor:pointer;margin-top:3px}
        .gen-cred-btn:hover{background:#E0ECF8}
        .sbadge{padding:3px 9px;border-radius:20px;font-size:11px;font-weight:500}
        .sbadge.act{background:#E1F5EE;color:#0F6E56}
        .sbadge.ina{background:#FFF0F0;color:#C0392B}
        .sbadge.gen-m{background:#E0ECF8;color:#1A3A7C}
        .sbadge.gen-f{background:#FCE8F3;color:#8B1A5C}
        .actions{display:flex;gap:5px}
        .icon-btn{width:28px;height:28px;border:none;border-radius:6px;cursor:pointer;display:flex;align-items:center;justify-content:center}
        .icon-btn.view{background:#E0ECF8;color:#1A3A7C}
        .icon-btn.edit{background:#FAEEDA;color:#633806}
        .icon-btn.enroll{background:#E1F5EE;color:#0F6E56}
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
        .info-box{background:#F0F6FC;border:1px solid #CBE0F0;border-radius:8px;padding:12px;font-size:12px;color:#6B8BB0;line-height:1.5}
        .cred-box{background:#F0F6FC;border:1px solid #CBE0F0;border-radius:10px;padding:16px;display:flex;flex-direction:column;gap:10px}
        .cred-title{font-size:13px;color:#6B8BB0}
        .cred-name{font-size:16px;font-weight:700;color:#1A3A7C}
        .cred-row{display:flex;align-items:center;gap:10px;background:#fff;border:1px solid #CBE0F0;border-radius:8px;padding:10px 14px}
        .cred-label{font-size:12px;font-weight:600;color:#6B8BB0;min-width:80px;text-transform:uppercase;letter-spacing:.5px}
        .cred-value{font-size:14px;font-weight:600;color:#1A3A7C;font-family:monospace}
        .cred-note{font-size:12px;color:#BA7517;background:#FFFBEA;border:1px solid #F5C518;border-radius:8px;padding:10px;line-height:1.5}
        .spinner{width:20px;height:20px;border:2px solid rgba(26,58,124,.2);border-top-color:#1A3A7C;border-radius:50%;animation:spin .7s linear infinite}
        .spinsm{width:14px;height:14px;border:2px solid rgba(255,255,255,.3);border-top-color:#fff;border-radius:50%;animation:spin .7s linear infinite;display:inline-block}
        @keyframes spin{to{transform:rotate(360deg)}}
        @media(max-width:600px){.page-header{flex-direction:column}.form-grid{grid-template-columns:1fr}th:nth-child(4),td:nth-child(4){display:none}}
        .mode-toggle{display:flex;background:#F0F6FC;border-radius:10px;padding:4px;gap:4px}
.mode-btn{flex:1;padding:8px;border:none;border-radius:8px;font-size:13px;cursor:pointer;background:transparent;color:#6B8BB0;transition:all .15s}
.mode-btn.active{background:#fff;color:#1A3A7C;font-weight:600;box-shadow:0 1px 4px rgba(0,0,0,.1)}
      `}</style>
    </div>
  )
}