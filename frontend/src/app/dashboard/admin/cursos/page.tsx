'use client'

import { useEffect, useState } from 'react'
import { Plus, X, Trash2, Users, Filter, Edit, Eye } from 'lucide-react'
import { useRouter } from 'next/navigation'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

interface Course {
  id:            number
  level:         string
  grade:         string
  parallel:      string
  educationType: string
  shift:         string
  _count:        { assignments: number; schedules: number }
    tutor?: {
    teacher: { firstName: string; lastName: string }
  }
}

const LEVELS    = [{ value: 'INICIAL', label: 'Inicial' }, { value: 'PRIMARIA', label: 'Primaria' }, { value: 'SECUNDARIA', label: 'Secundaria' }]
const GRADES    = [{ value: 'PRIMERO', label: '1°' }, { value: 'SEGUNDO', label: '2°' }, { value: 'TERCERO', label: '3°' }, { value: 'CUARTO', label: '4°' }, { value: 'QUINTO', label: '5°' }, { value: 'SEXTO', label: '6°' }]
const PARALLELS = [{ value: 'A', label: 'A' }, { value: 'B', label: 'B' }, { value: 'C', label: 'C' }]
const SHIFTS    = [{ value: 'MORNING', label: 'Mañana' }, { value: 'AFTERNOON', label: 'Tarde' }, { value: 'NIGHT', label: 'Noche' }]
const EDU_TYPES = [{ value: 'REGULAR', label: 'Regular' }, { value: 'BTH', label: 'BTH' }]

const levelLabel = (v: string) => LEVELS.find(l => l.value === v)?.label || v
const gradeLabel = (v: string) => GRADES.find(g => g.value === v)?.label || v
const shiftLabel = (v: string) => SHIFTS.find(s => s.value === v)?.label || v

const shiftColor: Record<string, string> = { MORNING: '#1A3A7C', AFTERNOON: '#633806', NIGHT: '#3C3489' }
const levelColor: Record<string, string> = { INICIAL: '#0F6E56', PRIMARIA: '#1A3A7C', SECUNDARIA: '#712B13' }

const emptyForm = { level: 'PRIMARIA', grade: 'PRIMERO', parallel: 'A', educationType: 'REGULAR', shift: 'MORNING' }

export default function CursosPage() {
  const router = useRouter()
  const [courses, setCourses]     = useState<Course[]>([])
  const [loading, setLoading]     = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editMode, setEditMode]   = useState(false)
  const [editId, setEditId]       = useState<number | null>(null)
  const [saving, setSaving]       = useState(false)
  const [success, setSuccess]     = useState('')
  const [error, setError]         = useState('')
  const [filterLevel, setFilterLevel] = useState('')
  const [filterShift, setFilterShift] = useState('')
  const [filterType,  setFilterType]  = useState('')
  const [form, setForm] = useState(emptyForm)
  const [warning, setWarning] = useState('')

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : ''

  const notify = (msg: string, type: 'success' | 'error' = 'success') => {
    if (type === 'success') { setSuccess(msg); setTimeout(() => setSuccess(''), 3000) }
    else                    { setError(msg);   setTimeout(() => setError(''),   4000) }
  }

  const checkWarning = (level: string, shift: string) => {
    if (level === 'INICIAL' && shift !== 'MORNING') {
      setWarning('⚠️ El nivel Inicial normalmente funciona en turno Mañana.')
    } else {
      setWarning('')
    }
  }

  const fetchCourses = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filterLevel) params.set('level', filterLevel)
      if (filterShift) params.set('shift', filterShift)
      if (filterType)  params.set('educationType', filterType)
      const res  = await fetch(`${API_URL}/api/courses?${params}`, { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      if (res.ok) setCourses(data)
      else notify('Error al cargar cursos', 'error')
    } catch { notify('Error de conexión', 'error') }
    finally  { setLoading(false) }
  }

useEffect(() => { fetchCourses() }, [])  

  const openCreate = () => {
    setEditMode(false); setEditId(null)
    setForm(emptyForm); setError('')
    checkWarning(emptyForm.level, emptyForm.shift)
    setShowModal(true)
  }

  const openEdit = (c: Course) => {
    setEditMode(true); setEditId(c.id)
    setForm({ level: c.level, grade: c.grade, parallel: c.parallel, educationType: c.educationType, shift: c.shift })
    setError('')
    checkWarning(c.level, c.shift)
    setShowModal(true)
  }

  const handleSave = async () => {
    setError(''); setSaving(true)
    try {
      const url    = editMode ? `${API_URL}/api/courses/${editId}` : `${API_URL}/api/courses`
      const method = editMode ? 'PUT' : 'POST'
      const res    = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) { notify(data.message, 'error'); return }
      notify(editMode ? 'Curso actualizado correctamente' : 'Curso creado correctamente')
      setShowModal(false)
      fetchCourses()
    } catch { notify('Error de conexión', 'error') }
    finally  { setSaving(false) }
  }

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`¿Eliminar el curso ${name}?`)) return
    try {
      const res  = await fetch(`${API_URL}/api/courses/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      if (res.ok) { notify(data.message); fetchCourses() }
      else notify(data.message, 'error')
    } catch { notify('Error al eliminar', 'error') }
  }

  const grouped = courses.reduce((acc, c) => {
    if (!acc[c.level]) acc[c.level] = []
    acc[c.level].push(c)
    return acc
  }, {} as Record<string, Course[]>)

  const courseName = (c: Course) => `${gradeLabel(c.grade)} ${c.parallel}`

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Gestión de Cursos</h1>
          <p>Administra los cursos por nivel, grado, paralelo y turno</p>
        </div>
        <button className="btn-primary" onClick={openCreate}><Plus size={16}/> Nuevo curso</button>
      </div>

      {success && <div className="alert suc">{success}</div>}
      {error && !showModal && <div className="alert err">{error}</div>}

      <div className="filters-bar">
        <Filter size={15} color="#6B8BB0"/>
        <select value={filterLevel} onChange={e => setFilterLevel(e.target.value)}>
          <option value="">Todos los niveles</option>
          {LEVELS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
        </select>
        <select value={filterShift} onChange={e => setFilterShift(e.target.value)}>
          <option value="">Todos los turnos</option>
          {SHIFTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <select value={filterType} onChange={e => setFilterType(e.target.value)}>
          <option value="">Todos los tipos</option>
          {EDU_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <button className="btn-outline" onClick={fetchCourses}>Filtrar</button>
      </div>

      {loading ? (
        <div className="center"><div className="spinner"/></div>
      ) : courses.length === 0 ? (
        <div className="empty-card">
          <p>No se encontraron cursos</p>
          <button className="btn-primary" onClick={openCreate}><Plus size={14}/> Crear primer curso</button>
        </div>
      ) : (
        <div className="levels-container">
          {Object.entries(grouped).map(([level, list]) => (
            <div key={level} className="level-section">
              <div className="level-header">
                <span className="level-title" style={{ color: levelColor[level] }}>{levelLabel(level)}</span>
                <span className="level-count">{list.length} cursos</span>
              </div>
              <div className="courses-grid">
                {list.map(c => (
                  <div key={c.id} className="course-card">
                    <div className="course-top">
                      <div className="course-name">{courseName(c)}</div>
                      <div className="course-badges">
                        <span className="cbadge" style={{ background: shiftColor[c.shift]+'18', color: shiftColor[c.shift] }}>
                          {shiftLabel(c.shift)}
                        </span>
                        {c.educationType === 'BTH' && <span className="cbadge bth">BTH</span>}
                      </div>
                    </div> 
                    <div className="cstat"><Users size={12}/>{c._count.assignments} estudiantes</div>
                      {c.tutor && (
                        <div className="cstat tutor-info">
                          <span>🎓 {c.tutor.teacher.lastName} {c.tutor.teacher.firstName}</span>
                        </div>
                      )}
                    <div className="course-actions">
                      <button className="icon-btn view" title="Ver detalle" onClick={() => router.push(`/dashboard/admin/cursos/${c.id}`)}>
                        <Eye size={13}/>
                      </button>
                      <button className="icon-btn edit" title="Editar" onClick={() => openEdit(c)}>
                        <Edit size={13}/>
                      </button>
                      <button className="icon-btn del" title="Eliminar" onClick={() => handleDelete(c.id, courseName(c))}>
                        <Trash2 size={13}/>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {courses.length > 0 && <div className="summary">Total: <strong>{courses.length}</strong> cursos registrados</div>}

      {showModal && (
        <div className="overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="mhead">
              <h2>{editMode ? 'Editar Curso' : 'Nuevo Curso'}</h2>
              <button onClick={() => setShowModal(false)}><X size={18}/></button>
            </div>
            <div className="mbody">
              {error && <div className="alert err">{error}</div>}
              {warning && <div className="alert warn">{warning}</div>}
              <div className="form-grid">
                <div className="fg">
                  <label>Nivel *</label>
                  <select value={form.level} onChange={e => { setForm({...form, level: e.target.value}); checkWarning(e.target.value, form.shift) }}>
                    {LEVELS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
                  </select>
                </div>
                <div className="fg">
                  <label>Grado *</label>
                  <select value={form.grade} onChange={e => setForm({...form, grade: e.target.value})}>
                    {GRADES.map(g => <option key={g.value} value={g.value}>{g.label} Grado</option>)}
                  </select>
                </div>
                <div className="fg">
                  <label>Paralelo *</label>
                  <select value={form.parallel} onChange={e => setForm({...form, parallel: e.target.value})}>
                    {PARALLELS.map(p => <option key={p.value} value={p.value}>Paralelo {p.label}</option>)}
                  </select>
                </div>
                <div className="fg">
                  <label>Turno *</label>
                  <select value={form.shift} onChange={e => { setForm({...form, shift: e.target.value}); checkWarning(form.level, e.target.value) }}>
                    {SHIFTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
                <div className="fg fg-full">
                  <label>Tipo de educación *</label>
                  <select value={form.educationType} onChange={e => setForm({...form, educationType: e.target.value})}>
                    {EDU_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
              </div>
              <div className="preview">
                <span>Vista previa:</span>
                <strong>{levelLabel(form.level)} — {gradeLabel(form.grade)} {form.parallel} · {shiftLabel(form.shift)} · {form.educationType}</strong>
              </div>
            </div>
            <div className="mfoot">
              <button className="btn-outline" onClick={() => setShowModal(false)}>Cancelar</button>
              <button className="btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? <span className="spinsm"/> : editMode ? <Edit size={14}/> : <Plus size={14}/>}
                {saving ? 'Guardando...' : editMode ? 'Actualizar' : 'Crear curso'}
              </button>
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
        .alert.warn{background:#FFFBEA;border:1px solid #F5C518;color:#7A6000}
        .filters-bar{display:flex;align-items:center;gap:10px;margin-bottom:20px;flex-wrap:wrap;background:#fff;border:1px solid #CBE0F0;border-radius:10px;padding:12px 16px}
        .filters-bar select{padding:7px 10px;border:1.5px solid #CBE0F0;border-radius:7px;font-size:13px;outline:none;color:#1A3A7C;cursor:pointer}
        .btn-primary{display:flex;align-items:center;gap:6px;padding:9px 16px;background:#1A3A7C;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:500;cursor:pointer;white-space:nowrap}
        .btn-primary:hover:not(:disabled){background:#4A9FD4}
        .btn-primary:disabled{opacity:.6;cursor:not-allowed}
        .btn-outline{display:flex;align-items:center;gap:6px;padding:8px 14px;background:#fff;color:#1A3A7C;border:1.5px solid #CBE0F0;border-radius:8px;font-size:13px;cursor:pointer}
        .btn-outline:hover{background:#F0F6FC}
        .center{display:flex;justify-content:center;padding:48px}
        .empty-card{background:#fff;border:1px solid #CBE0F0;border-radius:12px;padding:48px;display:flex;flex-direction:column;align-items:center;gap:12px;color:#6B8BB0;font-size:13px}
        .levels-container{display:flex;flex-direction:column;gap:20px}
        .level-section{background:#fff;border:1px solid #CBE0F0;border-radius:12px;overflow:hidden}
        .level-header{display:flex;align-items:center;justify-content:space-between;padding:14px 20px;border-bottom:1px solid #F0F6FC;border-left:4px solid #1A3A7C}
        .level-title{font-size:15px;font-weight:700}
        .level-count{font-size:12px;color:#6B8BB0}
        .courses-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:12px;padding:16px}
        .course-card{background:#F8FBFF;border:1px solid #CBE0F0;border-radius:10px;padding:14px;display:flex;flex-direction:column;gap:10px;transition:box-shadow .2s}
        .course-card:hover{box-shadow:0 2px 12px rgba(26,58,124,.1)}
        .course-top{display:flex;flex-direction:column;gap:6px}
        .course-name{font-size:20px;font-weight:800;color:#1A3A7C}
        .course-badges{display:flex;gap:6px;flex-wrap:wrap}
        .cbadge{padding:2px 8px;border-radius:20px;font-size:11px;font-weight:500}
        .cbadge.bth{background:#F5C518;color:#3A2F00}
        .cstat{display:flex;align-items:center;gap:6px;font-size:12px;color:#6B8BB0}
        .course-actions{display:flex;gap:6px;justify-content:flex-end;margin-top:4px}
        .icon-btn{width:28px;height:28px;border:none;border-radius:6px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:opacity .2s}
        .icon-btn.view{background:#E0ECF8;color:#1A3A7C}
        .icon-btn.edit{background:#FAEEDA;color:#633806}
        .icon-btn.del{background:#FFF0F0;color:#C0392B}
        .icon-btn:hover{opacity:.75}
        .summary{padding:12px 4px;font-size:12px;color:#6B8BB0}
        .overlay{position:fixed;inset:0;background:rgba(0,0,0,0.4);z-index:500;display:flex;align-items:center;justify-content:center;padding:16px}
        .modal{background:#fff;border-radius:14px;width:100%;max-width:460px;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,0.15)}
        .mhead{display:flex;align-items:center;justify-content:space-between;padding:18px 20px;border-bottom:1px solid #CBE0F0}
        .mhead h2{font-size:16px;font-weight:600;color:#1A3A7C}
        .mhead button{background:none;border:none;cursor:pointer;color:#6B8BB0;display:flex;padding:4px;border-radius:6px}
        .mhead button:hover{background:#F0F6FC;color:#1A3A7C}
        .mbody{padding:20px;display:flex;flex-direction:column;gap:16px}
        .mfoot{display:flex;justify-content:flex-end;gap:10px;padding:16px 20px;border-top:1px solid #CBE0F0}
        .form-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
        .fg-full{grid-column:1/-1}
        .fg{display:flex;flex-direction:column;gap:6px}
        .fg label{font-size:11px;font-weight:700;color:#1A3A7C;text-transform:uppercase;letter-spacing:.6px}
        .fg select{padding:10px 12px;border:1.5px solid #CBE0F0;border-radius:8px;font-size:13px;color:#1A3A7C;outline:none}
        .fg select:focus{border-color:#4A9FD4;box-shadow:0 0 0 3px rgba(74,159,212,.12)}
        .preview{background:#F0F6FC;border:1px solid #CBE0F0;border-radius:8px;padding:12px;font-size:13px;color:#6B8BB0;display:flex;flex-direction:column;gap:4px}
        .preview strong{color:#1A3A7C}
        .spinner{width:24px;height:24px;border:2px solid rgba(26,58,124,.2);border-top-color:#1A3A7C;border-radius:50%;animation:spin .7s linear infinite}
        .spinsm{width:14px;height:14px;border:2px solid rgba(255,255,255,.3);border-top-color:#fff;border-radius:50%;animation:spin .7s linear infinite;display:inline-block}
        @keyframes spin{to{transform:rotate(360deg)}}
        @media(max-width:600px){.page-header{flex-direction:column}.form-grid{grid-template-columns:1fr}}
      `}</style>
    </div>
  )
}