'use client'

import { useEffect, useState } from 'react'
import { Plus, X, Edit, Trash2, BookOpen, Search, Settings } from 'lucide-react'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

interface GradeConfig {
  id:            number
  grade:         string
  hoursPerWeek:  number
  educationType: string
}

interface Subject {
  id:           number
  name:         string
  code?:        string
  level:        string
  campo?:       string
  hoursPerWeek: number
  isActive:     boolean
  gradeConfigs?: GradeConfig[]
  _count:       { teacherSubjects: number }
}

const LEVELS = [
  { value: 'INICIAL',    label: 'Inicial'    },
  { value: 'PRIMARIA',   label: 'Primaria'   },
  { value: 'SECUNDARIA', label: 'Secundaria' },
]

const GRADES: Record<string,string> = {
  PRIMERO:'1°', SEGUNDO:'2°', TERCERO:'3°',
  CUARTO:'4°',  QUINTO:'5°',  SEXTO:'6°',
}

const GRADE_ORDER: Record<string,number> = {
  PRIMERO:1, SEGUNDO:2, TERCERO:3, CUARTO:4, QUINTO:5, SEXTO:6
}

const CAMPO_LABELS: Record<string,string> = {
  VIDA_TIERRA_TERRITORIO:        'Vida, Tierra y Territorio',
  COMUNIDAD_SOCIEDAD:            'Comunidad y Sociedad',
  COSMOS_PENSAMIENTO:            'Cosmos y Pensamiento',
  CIENCIA_TECNOLOGIA_PRODUCCION: 'Ciencia, Tecnología y Producción',
  SIN_CAMPO:                     'Sin campo asignado',
}

const CAMPO_COLORS: Record<string,string> = {
  VIDA_TIERRA_TERRITORIO:        '#E1F5EE',
  COMUNIDAD_SOCIEDAD:            '#E0ECF8',
  COSMOS_PENSAMIENTO:            '#F5EFE6',
  CIENCIA_TECNOLOGIA_PRODUCCION: '#F0F0FF',
  SIN_CAMPO:                     '#F5F5F5',
}

const CAMPO_TEXT: Record<string,string> = {
  VIDA_TIERRA_TERRITORIO:        '#0F6E56',
  COMUNIDAD_SOCIEDAD:            '#1A3A7C',
  COSMOS_PENSAMIENTO:            '#633806',
  CIENCIA_TECNOLOGIA_PRODUCCION: '#6B21A8',
  SIN_CAMPO:                     '#6B8BB0',
}

const CAMPO_BORDER: Record<string,string> = {
  VIDA_TIERRA_TERRITORIO:        '#0F6E56',
  COMUNIDAD_SOCIEDAD:            '#1A3A7C',
  COSMOS_PENSAMIENTO:            '#633806',
  CIENCIA_TECNOLOGIA_PRODUCCION: '#6B21A8',
  SIN_CAMPO:                     '#CBE0F0',
}

const CAMPO_ICONS: Record<string,string> = {
  VIDA_TIERRA_TERRITORIO:        '🌿',
  COMUNIDAD_SOCIEDAD:            '🌐',
  COSMOS_PENSAMIENTO:            '✨',
  CIENCIA_TECNOLOGIA_PRODUCCION: '⚙️',
  SIN_CAMPO:                     '📋',
}

const CAMPO_ORDER = [
  'VIDA_TIERRA_TERRITORIO',
  'COMUNIDAD_SOCIEDAD',
  'COSMOS_PENSAMIENTO',
  'CIENCIA_TECNOLOGIA_PRODUCCION',
  'SIN_CAMPO',
]

const levelColor: Record<string, string> = {
  INICIAL:    '#0F6E56',
  PRIMARIA:   '#1A3A7C',
  SECUNDARIA: '#712B13',
}

const emptyForm = { name: '', code: '', level: 'SECUNDARIA', hoursPerWeek: '4', campo: '' }

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
  const [filterCampo, setFilterCampo] = useState('')
  const [form,        setForm]        = useState(emptyForm)

  // Grade config modal
  const [showGradeModal, setShowGradeModal] = useState(false)
  const [gradeSubject,   setGradeSubject]   = useState<Subject | null>(null)
  const [gradeConfigs,   setGradeConfigs]   = useState<GradeConfig[]>([])
  const [loadingGrades,  setLoadingGrades]  = useState(false)
  const [editingGrade,   setEditingGrade]   = useState<{id:number; hours:string} | null>(null)
  const [savingGrade,    setSavingGrade]    = useState(false)

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
      campo:        s.campo || '',
      hoursPerWeek: String(s.hoursPerWeek),
    })
    setError('')
    setShowModal(true)
  }

  const openGradeConfig = async (s: Subject) => {
    setGradeSubject(s)
    setShowGradeModal(true)
    setLoadingGrades(true)
    setEditingGrade(null)
    try {
      const res  = await fetch(`${API_URL}/api/subjects/${s.id}/grade-configs`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await res.json()
      if (res.ok) {
        const sorted = [...data].sort((a: GradeConfig, b: GradeConfig) => {
          const typeDiff = a.educationType.localeCompare(b.educationType)
          if (typeDiff !== 0) return typeDiff
          return (GRADE_ORDER[a.grade] || 99) - (GRADE_ORDER[b.grade] || 99)
        })
        setGradeConfigs(sorted)
      }
    } catch { notify('Error al cargar configuración', 'error') }
    finally { setLoadingGrades(false) }
  }

  const handleSaveGrade = async (configId: number, hours: string) => {
    if (!hours || parseInt(hours) < 1) { notify('Las horas deben ser mayor a 0', 'error'); return }
    setSavingGrade(true)
    try {
      const res  = await fetch(`${API_URL}/api/subjects/grade-config/${configId}`, {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ hoursPerWeek: parseInt(hours) })
      })
      const data = await res.json()
      if (!res.ok) { notify(data.message, 'error'); return }
      notify('Horas actualizadas correctamente')
      setGradeConfigs(prev => prev.map(gc =>
        gc.id === configId ? { ...gc, hoursPerWeek: parseInt(hours) } : gc
      ))
      setEditingGrade(null)
    } catch { notify('Error de conexión', 'error') }
    finally { setSavingGrade(false) }
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
          campo:        form.campo || undefined,
          hoursPerWeek: parseInt(form.hoursPerWeek),
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.message); return }
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

  // Filtrar
  const filtered = subjects.filter(s => {
    const matchSearch = !search || s.name.toLowerCase().includes(search.toLowerCase()) ||
      (s.code && s.code.toLowerCase().includes(search.toLowerCase()))
    const matchLevel = !filterLevel || s.level === filterLevel
    const matchCampo = !filterCampo || (s.campo || 'SIN_CAMPO') === filterCampo
    return matchSearch && matchLevel && matchCampo
  })

  // Agrupar por campo del saber
  const grouped = filtered.reduce((acc, s) => {
    const campo = s.campo || 'SIN_CAMPO'
    if (!acc[campo]) acc[campo] = []
    acc[campo].push(s)
    return acc
  }, {} as Record<string, Subject[]>)

  // Ordenar grupos por CAMPO_ORDER
  const sortedCampos = CAMPO_ORDER.filter(c => grouped[c])

  // Agrupar gradeConfigs por educationType
  const configsByType = gradeConfigs.reduce((acc, gc) => {
    if (!acc[gc.educationType]) acc[gc.educationType] = []
    acc[gc.educationType].push(gc)
    return acc
  }, {} as Record<string, GradeConfig[]>)

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Gestión de Materias</h1>
          <p>Materias agrupadas por Campo del Saber y Conocimiento</p>
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
        <select value={filterCampo} onChange={e => setFilterCampo(e.target.value)}>
          <option value="">Todos los campos</option>
          {CAMPO_ORDER.map(c => (
            <option key={c} value={c}>{CAMPO_ICONS[c]} {CAMPO_LABELS[c]}</option>
          ))}
        </select>
      </div>

      {/* Resumen por campo */}
      {!loading && filtered.length > 0 && (
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))',gap:10,marginBottom:20}}>
          {sortedCampos.map(campo => (
            <div key={campo} style={{
              background: CAMPO_COLORS[campo],
              border: `1px solid ${CAMPO_BORDER[campo]}33`,
              borderLeft: `4px solid ${CAMPO_BORDER[campo]}`,
              borderRadius:10, padding:'10px 14px',
              cursor:'pointer',
              outline: filterCampo === campo ? `2px solid ${CAMPO_BORDER[campo]}` : 'none',
            }} onClick={() => setFilterCampo(filterCampo === campo ? '' : campo)}>
              <div style={{fontSize:20,marginBottom:4}}>{CAMPO_ICONS[campo]}</div>
              <div style={{fontSize:12,fontWeight:700,color:CAMPO_TEXT[campo],lineHeight:1.3,marginBottom:4}}>
                {CAMPO_LABELS[campo]}
              </div>
              <div style={{fontSize:18,fontWeight:800,color:CAMPO_TEXT[campo]}}>
                {grouped[campo]?.length || 0}
                <span style={{fontSize:11,fontWeight:400,marginLeft:4}}>materias</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <div className="center"><div className="spinner"/></div>
      ) : filtered.length === 0 ? (
        <div className="empty-card">
          <BookOpen size={40} color="#CBE0F0"/>
          <p>No se encontraron materias</p>
          <button className="btn-primary" onClick={openCreate}><Plus size={14}/> Crear primera materia</button>
        </div>
      ) : (
        sortedCampos.map(campo => (
          <div key={campo} className="campo-section">
            {/* Header del campo */}
            <div className="campo-header" style={{
              background: CAMPO_COLORS[campo],
              borderLeft: `5px solid ${CAMPO_BORDER[campo]}`,
            }}>
              <div style={{display:'flex',alignItems:'center',gap:10}}>
                <span style={{fontSize:22}}>{CAMPO_ICONS[campo]}</span>
                <div>
                  <div style={{fontSize:15,fontWeight:700,color:CAMPO_TEXT[campo]}}>
                    {CAMPO_LABELS[campo]}
                  </div>
                  <div style={{fontSize:11,color:CAMPO_TEXT[campo],opacity:.7}}>
                    {grouped[campo]?.length || 0} materia{(grouped[campo]?.length || 0) !== 1 ? 's' : ''}
                  </div>
                </div>
              </div>
            </div>

            {/* Tabla de materias */}
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Materia</th>
                  <th>Nivel</th>
                  <th>Código</th>
                  <th>Hrs/Plan</th>
                  <th>Cursos</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {(grouped[campo] || []).map((s, i) => (
                  <tr key={s.id}>
                    <td className="muted">{i + 1}</td>
                    <td>
                      <div className="subject-name">{s.name}</div>
                    </td>
                    <td>
                      <span className="level-badge" style={{
                        background: levelColor[s.level] + '18',
                        color: levelColor[s.level],
                        border: `1px solid ${levelColor[s.level]}33`
                      }}>
                        {LEVELS.find(l => l.value === s.level)?.label || s.level}
                      </span>
                    </td>
                    <td className="muted">{s.code || '—'}</td>
                    <td className="muted">{s.hoursPerWeek}h</td>
                    <td>
                      <span className={`sbadge ${s._count.teacherSubjects > 0 ? 'blue' : 'gray'}`}>
                        {s._count.teacherSubjects} curso{s._count.teacherSubjects !== 1 ? 's' : ''}
                      </span>
                    </td>
                    <td>
                      <div className="actions">
                        <button className="icon-btn edit" onClick={() => openEdit(s)} title="Editar materia">
                          <Edit size={13}/>
                        </button>
                        <button className="icon-btn config" onClick={() => openGradeConfig(s)} title="Horas por grado">
                          <Settings size={13}/>
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

      {/* ── Modal crear/editar materia ── */}
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
                  <label>Horas Plan</label>
                  <input type="number" min="1" max="20" value={form.hoursPerWeek}
                    onChange={e => setForm({...form, hoursPerWeek: e.target.value})}/>
                </div>
                <div className="fg fg-full">
                  <label>Nivel *</label>
                  <select value={form.level} onChange={e => setForm({...form, level: e.target.value})}>
                    {LEVELS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
                  </select>
                </div>
                <div className="fg fg-full">
                  <label>Campo del Saber</label>
                  <select value={form.campo} onChange={e => setForm({...form, campo: e.target.value})}>
                    <option value="">— Sin campo —</option>
                    <option value="VIDA_TIERRA_TERRITORIO">🌿 Vida, Tierra y Territorio</option>
                    <option value="COMUNIDAD_SOCIEDAD">🌐 Comunidad y Sociedad</option>
                    <option value="COSMOS_PENSAMIENTO">✨ Cosmos y Pensamiento</option>
                    <option value="CIENCIA_TECNOLOGIA_PRODUCCION">⚙️ Ciencia, Tecnología y Producción</option>
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

      {/* ── Modal configuración horas por grado ── */}
      {showGradeModal && gradeSubject && (
        <div className="overlay" onClick={() => { setShowGradeModal(false); setEditingGrade(null) }}>
          <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
            <div className="mhead">
              <div>
                <h2>Horas por Grado</h2>
                <p className="mhead-sub">{gradeSubject.name}</p>
              </div>
              <button onClick={() => { setShowGradeModal(false); setEditingGrade(null) }}><X size={18}/></button>
            </div>
            <div className="mbody">
              {loadingGrades ? (
                <div className="center"><div className="spinner"/></div>
              ) : gradeConfigs.length === 0 ? (
                <div style={{textAlign:'center',padding:32,color:'#6B8BB0'}}>
                  <Settings size={32} style={{opacity:.3,marginBottom:8}}/>
                  <p>No hay configuración de grados para esta materia.</p>
                  <p style={{fontSize:12,marginTop:4}}>Configura el plan de estudios primero.</p>
                </div>
              ) : (
                Object.entries(configsByType).map(([type, configs]) => (
                  <div key={type}>
                    <div style={{
                      fontSize:11,fontWeight:700,color:'#1A3A7C',textTransform:'uppercase',
                      letterSpacing:'.5px',marginBottom:8,
                      padding:'6px 12px',background:'#F0F6FC',borderRadius:8,
                    }}>
                      {type === 'REGULAR' ? '📚 Regular' : '🔧 BTH'}
                    </div>
                    <div style={{border:'1px solid #CBE0F0',borderRadius:10,overflow:'hidden',marginBottom:14}}>
                      <table style={{width:'100%',borderCollapse:'collapse'}}>
                        <thead>
                          <tr style={{background:'#F8FBFF'}}>
                            <th style={th}>Grado</th>
                            <th style={{...th,textAlign:'center'}}>Hrs/semana</th>
                            <th style={{...th,textAlign:'center'}}>Periodos máx</th>
                            <th style={{...th,textAlign:'center'}}>Acción</th>
                          </tr>
                        </thead>
                        <tbody>
                          {configs.map(gc => {
                            const isEditing = editingGrade?.id === gc.id
                            return (
                              <tr key={gc.id} style={{borderTop:'1px solid #F0F6FC',background:isEditing?'#F8FBFF':'#fff'}}>
                                <td style={td}>
                                  <span style={{fontWeight:600,color:'#1A3A7C'}}>
                                    {GRADES[gc.grade] || gc.grade} {gc.grade}
                                  </span>
                                </td>
                                <td style={{...td,textAlign:'center'}}>
                                  {isEditing ? (
                                    <input
                                      type="number" min="1" max="20"
                                      value={editingGrade.hours}
                                      onChange={e => setEditingGrade({...editingGrade, hours: e.target.value})}
                                      style={{
                                        width:70,padding:'6px 8px',border:'1.5px solid #4A9FD4',
                                        borderRadius:6,fontSize:14,fontWeight:700,textAlign:'center',
                                        color:'#1A3A7C',outline:'none'
                                      }}
                                      autoFocus
                                      onKeyDown={e => {
                                        if (e.key === 'Enter') handleSaveGrade(gc.id, editingGrade.hours)
                                        if (e.key === 'Escape') setEditingGrade(null)
                                      }}
                                    />
                                  ) : (
                                    <span style={{
                                      background:'#E0ECF8',color:'#1A3A7C',
                                      padding:'4px 16px',borderRadius:20,
                                      fontSize:14,fontWeight:700
                                    }}>
                                      {gc.hoursPerWeek} hrs
                                    </span>
                                  )}
                                </td>
                                <td style={{...td,textAlign:'center'}}>
                                  <span style={{
                                    background:'#FDF0E6',color:'#633806',
                                    padding:'4px 16px',borderRadius:20,
                                    fontSize:14,fontWeight:700
                                  }}>
                                    {isEditing ? parseInt(editingGrade.hours) || 0 : gc.hoursPerWeek} per.
                                  </span>
                                </td>
                                <td style={{...td,textAlign:'center'}}>
                                  {isEditing ? (
                                    <div style={{display:'flex',gap:6,justifyContent:'center'}}>
                                      <button
                                        onClick={() => handleSaveGrade(gc.id, editingGrade.hours)}
                                        disabled={savingGrade}
                                        style={{
                                          padding:'5px 12px',background:'#0F6E56',color:'#fff',
                                          border:'none',borderRadius:6,fontSize:12,fontWeight:600,
                                          cursor:'pointer',opacity:savingGrade?0.6:1
                                        }}>
                                        {savingGrade ? '...' : '✅ Guardar'}
                                      </button>
                                      <button
                                        onClick={() => setEditingGrade(null)}
                                        style={{
                                          padding:'5px 10px',background:'#F0F6FC',color:'#6B8BB0',
                                          border:'1px solid #CBE0F0',borderRadius:6,fontSize:12,cursor:'pointer'
                                        }}>
                                        ✕
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      onClick={() => setEditingGrade({id: gc.id, hours: String(gc.hoursPerWeek)})}
                                      style={{
                                        padding:'5px 12px',background:'#FAEEDA',color:'#633806',
                                        border:'none',borderRadius:6,fontSize:12,fontWeight:600,
                                        cursor:'pointer',display:'flex',alignItems:'center',
                                        gap:4,margin:'0 auto'
                                      }}>
                                      <Edit size={12}/> Editar
                                    </button>
                                  )}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))
              )}
              <div style={{
                background:'#F0F6FC',borderRadius:8,padding:'10px 14px',
                fontSize:12,color:'#6B8BB0',
              }}>
                💡 Las hrs/semana determinan los periodos máximos asignables en el horario para cada grado. Presiona Enter para guardar rápidamente.
              </div>
            </div>
            <div className="mfoot">
              <button className="btn-primary" onClick={() => { setShowGradeModal(false); setEditingGrade(null) }}>
                Cerrar
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
        .campo-section{background:#fff;border:1px solid #CBE0F0;border-radius:12px;overflow:hidden;margin-bottom:16px}
        .campo-header{padding:14px 18px;border-bottom:1px solid rgba(0,0,0,0.06)}
        table{width:100%;border-collapse:collapse}
        thead tr{background:#F0F6FC}
        th{padding:10px 14px;text-align:left;font-size:11px;font-weight:600;color:#1A3A7C;text-transform:uppercase;letter-spacing:.5px}
        td{padding:11px 14px;font-size:13px;color:#1A3A7C;border-top:1px solid #F0F6FC;vertical-align:middle}
        tr:hover td{background:#FAFCFF}
        .muted{color:#6B8BB0;font-size:12px}
        .subject-name{font-weight:500;color:#1A3A7C}
        .level-badge{padding:2px 8px;border-radius:20px;font-size:11px;font-weight:500}
        .sbadge{padding:3px 9px;border-radius:20px;font-size:11px;font-weight:500}
        .sbadge.blue{background:#E0ECF8;color:#1A3A7C}
        .sbadge.gray{background:#F0F6FC;color:#6B8BB0}
        .actions{display:flex;gap:5px}
        .icon-btn{width:28px;height:28px;border:none;border-radius:6px;cursor:pointer;display:flex;align-items:center;justify-content:center}
        .icon-btn.edit{background:#FAEEDA;color:#633806}
        .icon-btn.config{background:#E0ECF8;color:#1A3A7C}
        .icon-btn.del{background:#FFF0F0;color:#C0392B}
        .icon-btn:hover{opacity:.75}
        .overlay{position:fixed;inset:0;background:rgba(0,0,0,0.4);z-index:500;display:flex;align-items:center;justify-content:center;padding:16px}
        .modal{background:#fff;border-radius:14px;width:100%;max-width:460px;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,0.15);max-height:92vh;display:flex;flex-direction:column}
        .modal-lg{max-width:600px}
        .mhead{display:flex;align-items:flex-start;justify-content:space-between;padding:18px 20px;border-bottom:1px solid #CBE0F0;flex-shrink:0;gap:12px}
        .mhead h2{font-size:16px;font-weight:600;color:#1A3A7C;margin:0}
        .mhead-sub{font-size:12px;color:#6B8BB0;margin:2px 0 0}
        .mhead button{background:none;border:none;cursor:pointer;color:#6B8BB0;display:flex;padding:4px;border-radius:6px;flex-shrink:0}
        .mhead button:hover{background:#F0F6FC;color:#1A3A7C}
        .mbody{padding:20px;display:flex;flex-direction:column;gap:14px;overflow-y:auto;flex:1;min-height:0}
        .mfoot{display:flex;justify-content:flex-end;gap:10px;padding:16px 20px;border-top:1px solid #CBE0F0;flex-shrink:0}
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

const th: React.CSSProperties = {
  padding:'10px 14px', textAlign:'left', fontSize:11, fontWeight:600,
  color:'#1A3A7C', textTransform:'uppercase', letterSpacing:'.5px'
}
const td: React.CSSProperties = {
  padding:'11px 14px', fontSize:13, color:'#1A3A7C', verticalAlign:'middle'
}