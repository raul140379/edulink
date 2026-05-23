'use client'

import { useEffect, useState } from 'react'
import { Plus, X, Edit, Trash2, BookOpen, Search } from 'lucide-react'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

interface Subject {
  id:           number
  name:         string
  code?:        string
  level:        string
  hoursPerWeek: number
  _count:       { teacherSubjects: number }
}

const LEVELS = [
  { value: 'INICIAL',    label: 'Inicial'    },
  { value: 'PRIMARIA',   label: 'Primaria'   },
  { value: 'SECUNDARIA', label: 'Secundaria' },
]

const levelColor: Record<string, string> = {
  INICIAL:    '#0F6E56',
  PRIMARIA:   '#1A3A7C',
  SECUNDARIA: '#712B13',
}

const emptyForm = { name: '', code: '', level: 'PRIMARIA', hoursPerWeek: '4' }

export default function MateriasPage() {
  const [subjects,    setSubjects]    = useState<Subject[]>([])
  const [loading,     setLoading]     = useState(true)
  const [showModal,   setShowModal]   = useState(false)
  const [editMode,    setEditMode]    = useState(false)
  const [editId,      setEditId]      = useState<number | null>(null)
  const [saving,      setSaving]      = useState(false)
  const [success,     setSuccess]     = useState('')
  const [error,       setError]       = useState('')
  const [search,      setSearch]      = useState('')
  const [filterLevel, setFilterLevel] = useState('')
  const [form,        setForm]        = useState(emptyForm)

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : ''

  const notify = (msg: string, type: 'success' | 'error' = 'success') => {
    if (type === 'success') { setSuccess(msg); setTimeout(() => setSuccess(''), 3000) }
    else                    { setError(msg);   setTimeout(() => setError(''),   4000) }
  }

  const fetchSubjects = async () => {
    setLoading(true)
    try {
      const res  = await fetch(`${API_URL}/api/subjects`, { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      if (res.ok) setSubjects(data)
      else notify('Error al cargar materias', 'error')
    } catch { notify('Error de conexión', 'error') }
    finally  { setLoading(false) }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchSubjects() }, [])

  const openCreate = () => {
    setEditMode(false); setEditId(null)
    setForm(emptyForm); setError('')
    setShowModal(true)
  }

  const openEdit = (s: Subject) => {
    setEditMode(true); setEditId(s.id)
    setForm({
      name:         s.name,
      code:         s.code || '',
      level:        s.level,
      hoursPerWeek: String(s.hoursPerWeek),
    })
    setError('')
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!form.name || !form.level) {
      setError('Nombre y nivel son requeridos'); return
    }
    setSaving(true); setError('')
    try {
      const url    = editMode ? `${API_URL}/api/subjects/${editId}` : `${API_URL}/api/subjects`
      const method = editMode ? 'PUT' : 'POST'
      const res    = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          name:         form.name,
          code:         form.code || undefined,
          level:        form.level,
          hoursPerWeek: parseInt(form.hoursPerWeek),
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.message); return }
      //notify(data.message)
      notify(editMode ? 'Materia actualizada' : 'Materia creada')
      setShowModal(false)
      fetchSubjects()
    } catch { notify('Error de conexión', 'error') }
    finally  { setSaving(false) }
  }

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`¿Eliminar la materia "${name}"?`)) return
    try {
      const res  = await fetch(`${API_URL}/api/subjects/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await res.json()
      if (res.ok) { notify(data.message); fetchSubjects() }
      else notify(data.message, 'error')
    } catch { notify('Error al eliminar', 'error') }
  }

  // Filtrar materias
  const filtered = subjects.filter(s => {
    const matchSearch = !search || s.name.toLowerCase().includes(search.toLowerCase()) ||
      (s.code && s.code.toLowerCase().includes(search.toLowerCase()))
    const matchLevel = !filterLevel || s.level === filterLevel
    return matchSearch && matchLevel
  })

  // Agrupar por nivel
  const grouped = filtered.reduce((acc, s) => {
    if (!acc[s.level]) acc[s.level] = []
    acc[s.level].push(s)
    return acc
  }, {} as Record<string, Subject[]>)

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Gestión de Materias</h1>
          <p>Registro de materias por nivel educativo</p>
        </div>
        <button className="btn-primary" onClick={openCreate}>
          <Plus size={16}/> Nueva materia
        </button>
      </div>

      {success && <div className="alert suc">{success}</div>}
      {error && !showModal && <div className="alert err">{error}</div>}

      {/* Filtros */}
      <div className="filters-bar">
        <div className="search-wrap">
          <Search size={14} className="sicon"/>
          <input placeholder="Buscar materia..." value={search}
            onChange={e => setSearch(e.target.value)}/>
        </div>
        <select value={filterLevel} onChange={e => setFilterLevel(e.target.value)}>
          <option value="">Todos los niveles</option>
          {LEVELS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="center"><div className="spinner"/></div>
      ) : filtered.length === 0 ? (
        <div className="empty-card">
          <BookOpen size={40} color="#CBE0F0"/>
          <p>No se encontraron materias</p>
          <button className="btn-primary" onClick={openCreate}><Plus size={14}/> Crear primera materia</button>
        </div>
      ) : (
        Object.entries(grouped).map(([level, list]) => (
          <div key={level} className="level-section">
            <div className="level-header" style={{ borderLeftColor: levelColor[level] }}>
              <span className="level-title" style={{ color: levelColor[level] }}>
                {LEVELS.find(l => l.value === level)?.label}
              </span>
              <span className="level-count">{list.length} materias</span>
            </div>
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Materia</th>
                  <th>Código</th>
                  <th>Hrs/Semana</th>
                  <th>Cursos asignados</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {list.map((s, i) => (
                  <tr key={s.id}>
                    <td className="muted">{i + 1}</td>
                    <td><div className="subject-name">{s.name}</div></td>
                    <td className="muted">{s.code || '—'}</td>
                    <td className="muted">{s.hoursPerWeek}h</td>
                    <td>
                      <span className={`sbadge ${s._count.teacherSubjects > 0 ? 'blue' : 'gray'}`}>
                        {s._count.teacherSubjects} curso{s._count.teacherSubjects !== 1 ? 's' : ''}
                      </span>
                    </td>
                    <td>
                      <div className="actions">
                        <button className="icon-btn edit" onClick={() => openEdit(s)} title="Editar">
                          <Edit size={13}/>
                        </button>
                        <button className="icon-btn del" onClick={() => handleDelete(s.id, s.name)} title="Eliminar">
                          <Trash2 size={13}/>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))
      )}

      {/* Modal crear/editar */}
      {showModal && (
        <div className="overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="mhead">
              <h2>{editMode ? 'Editar Materia' : 'Nueva Materia'}</h2>
              <button onClick={() => setShowModal(false)}><X size={18}/></button>
            </div>
            <div className="mbody">
              {error && <div className="alert err">{error}</div>}
              <div className="form-grid">
                <div className="fg fg-full">
                  <label>Nombre *</label>
                  <input type="text" placeholder="Ej: Matemáticas, Lenguaje, Ciencias..."
                    value={form.name} onChange={e => setForm({...form, name: e.target.value})}/>
                </div>
                <div className="fg">
                  <label>Código</label>
                  <input type="text" placeholder="Ej: MAT, LEN..."
                    value={form.code} onChange={e => setForm({...form, code: e.target.value})}/>
                </div>
                <div className="fg">
                  <label>Horas por semana</label>
                  <input type="number" min="1" max="20" value={form.hoursPerWeek}
                    onChange={e => setForm({...form, hoursPerWeek: e.target.value})}/>
                </div>
                <div className="fg fg-full">
                  <label>Nivel *</label>
                  <select value={form.level} onChange={e => setForm({...form, level: e.target.value})}>
                    {LEVELS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
                  </select>
                </div>
              </div>
            </div>
            <div className="mfoot">
              <button className="btn-outline" onClick={() => setShowModal(false)}>Cancelar</button>
              <button className="btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? <span className="spinsm"/> : editMode ? <Edit size={14}/> : <Plus size={14}/>}
                {saving ? 'Guardando...' : editMode ? 'Actualizar' : 'Crear materia'}
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
        .filters-bar{display:flex;gap:10px;margin-bottom:16px;flex-wrap:wrap;align-items:center}
        .search-wrap{position:relative;flex:1;min-width:200px}
        .sicon{position:absolute;left:11px;top:50%;transform:translateY(-50%);color:#4A9FD4;pointer-events:none}
        .search-wrap input{width:100%;padding:9px 12px 9px 34px;border:1.5px solid #CBE0F0;border-radius:8px;font-size:13px;outline:none;color:#1A3A7C}
        .search-wrap input:focus{border-color:#4A9FD4}
        .filters-bar select{padding:9px 12px;border:1.5px solid #CBE0F0;border-radius:8px;font-size:13px;outline:none;color:#1A3A7C;cursor:pointer}
        .center{display:flex;justify-content:center;padding:48px}
        .empty-card{background:#fff;border:1px solid #CBE0F0;border-radius:12px;padding:48px;display:flex;flex-direction:column;align-items:center;gap:12px;color:#6B8BB0;font-size:13px}
        .level-section{background:#fff;border:1px solid #CBE0F0;border-radius:12px;overflow:hidden;margin-bottom:16px}
        .level-header{display:flex;align-items:center;justify-content:space-between;padding:14px 18px;border-bottom:1px solid #F0F6FC;border-left:4px solid #1A3A7C}
        .level-title{font-size:14px;font-weight:700}
        .level-count{font-size:12px;color:#6B8BB0}
        table{width:100%;border-collapse:collapse}
        thead tr{background:#F0F6FC}
        th{padding:10px 14px;text-align:left;font-size:11px;font-weight:600;color:#1A3A7C;text-transform:uppercase;letter-spacing:.5px}
        td{padding:11px 14px;font-size:13px;color:#1A3A7C;border-top:1px solid #F0F6FC;vertical-align:middle}
        tr:hover td{background:#FAFCFF}
        .muted{color:#6B8BB0;font-size:12px}
        .subject-name{font-weight:500;color:#1A3A7C}
        .sbadge{padding:3px 9px;border-radius:20px;font-size:11px;font-weight:500}
        .sbadge.blue{background:#E0ECF8;color:#1A3A7C}
        .sbadge.gray{background:#F0F6FC;color:#6B8BB0}
        .actions{display:flex;gap:5px}
        .icon-btn{width:28px;height:28px;border:none;border-radius:6px;cursor:pointer;display:flex;align-items:center;justify-content:center}
        .icon-btn.edit{background:#FAEEDA;color:#633806}
        .icon-btn.del{background:#FFF0F0;color:#C0392B}
        .icon-btn:hover{opacity:.75}
        .overlay{position:fixed;inset:0;background:rgba(0,0,0,0.4);z-index:500;display:flex;align-items:center;justify-content:center;padding:16px}
        .modal{background:#fff;border-radius:14px;width:100%;max-width:460px;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,0.15)}
        .mhead{display:flex;align-items:center;justify-content:space-between;padding:18px 20px;border-bottom:1px solid #CBE0F0}
        .mhead h2{font-size:16px;font-weight:600;color:#1A3A7C}
        .mhead button{background:none;border:none;cursor:pointer;color:#6B8BB0;display:flex;padding:4px;border-radius:6px}
        .mhead button:hover{background:#F0F6FC;color:#1A3A7C}
        .mbody{padding:20px;display:flex;flex-direction:column;gap:14px}
        .mfoot{display:flex;justify-content:flex-end;gap:10px;padding:16px 20px;border-top:1px solid #CBE0F0}
        .form-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
        .fg-full{grid-column:1/-1}
        .fg{display:flex;flex-direction:column;gap:6px}
        .fg label{font-size:11px;font-weight:700;color:#1A3A7C;text-transform:uppercase;letter-spacing:.6px}
        .fg input,.fg select{padding:10px 12px;border:1.5px solid #CBE0F0;border-radius:8px;font-size:13px;color:#1A3A7C;outline:none}
        .fg input:focus,.fg select:focus{border-color:#4A9FD4;box-shadow:0 0 0 3px rgba(74,159,212,.12)}
        .btn-primary{display:flex;align-items:center;gap:6px;padding:9px 16px;background:#1A3A7C;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:500;cursor:pointer}
        .btn-primary:hover:not(:disabled){background:#4A9FD4}
        .btn-primary:disabled{opacity:.6;cursor:not-allowed}
        .btn-outline{display:flex;align-items:center;gap:6px;padding:9px 14px;background:#fff;color:#1A3A7C;border:1.5px solid #CBE0F0;border-radius:8px;font-size:13px;cursor:pointer}
        .btn-outline:hover{background:#F0F6FC}
        .spinner{width:24px;height:24px;border:2px solid rgba(26,58,124,.2);border-top-color:#1A3A7C;border-radius:50%;animation:spin .7s linear infinite}
        .spinsm{width:14px;height:14px;border:2px solid rgba(255,255,255,.3);border-top-color:#fff;border-radius:50%;animation:spin .7s linear infinite;display:inline-block}
        @keyframes spin{to{transform:rotate(360deg)}}
        @media(max-width:600px){.page-header{flex-direction:column}.form-grid{grid-template-columns:1fr}}
      `}</style>
    </div>
  )
}