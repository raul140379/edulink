'use client'

import { useEffect, useState } from 'react'
import { Users, X, Check, UserPlus, UserMinus, BookOpen } from 'lucide-react'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

interface Teacher {
  id: number; firstName: string; lastName: string
}

interface Course {
  id:            number
  level:         string
  grade:         string
  parallel:      string
  educationType: string
  shift:         string
  delegateId:    number | null
  delegate: {
    id:        number
    firstName: string
    lastName:  string
    ci?:       string
    phone?:    string
    user?:     { email: string; role: string; isActive: boolean }
  } | null
  tutor: {
    teacher: { id: number; firstName: string; lastName: string }
  } | null
  _count: { assignments: number }
}

interface EligibleParent {
  id:           number
  firstName:    string
  lastName:     string
  ci?:          string
  phone?:       string
  relationType: string
  studentName:  string
  user?:        { email: string; role: string }
}

const GRADE_LABELS: Record<string, string> = {
  PRIMERO: '1°', SEGUNDO: '2°', TERCERO: '3°',
  CUARTO: '4°', QUINTO: '5°', SEXTO: '6°'
}
const LEVEL_LABELS: Record<string, string> = {
  INICIAL: 'Inicial', PRIMARIA: 'Primaria', SECUNDARIA: 'Secundaria'
}
const SHIFT_LABELS: Record<string, string> = {
  MORNING: 'Mañana', AFTERNOON: 'Tarde', NIGHT: 'Noche'
}
const LEVEL_COLORS: Record<string, string> = {
  INICIAL: '#0F6E56', PRIMARIA: '#1A3A7C', SECUNDARIA: '#712B13'
}

export default function DelegadosPage() {
  const [courses,         setCourses]         = useState<Course[]>([])
  const [loading,         setLoading]         = useState(true)
  const [success,         setSuccess]         = useState('')
  const [error,           setError]           = useState('')
  const [showModal,       setShowModal]       = useState(false)
  const [selectedCourse,  setSelectedCourse]  = useState<Course | null>(null)
  const [eligibleParents, setEligibleParents] = useState<EligibleParent[]>([])
  const [loadingParents,  setLoadingParents]  = useState(false)
  const [selectedParent,  setSelectedParent]  = useState<number | null>(null)
  const [saving,          setSaving]          = useState(false)
  const [filterLevel,     setFilterLevel]     = useState('')

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : ''

  const notify = (msg: string, type: 'success' | 'error' = 'success') => {
    if (type === 'success') { setSuccess(msg); setTimeout(() => setSuccess(''), 3000) }
    else                    { setError(msg);   setTimeout(() => setError(''),   4000) }
  }

  const fetchCourses = async () => {
    setLoading(true)
    try {
      const res  = await fetch(`${API_URL}/api/delegates`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await res.json()
      if (res.ok) setCourses(data)
      else notify('Error al cargar cursos', 'error')
    } catch { notify('Error de conexión', 'error') }
    finally  { setLoading(false) }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchCourses() }, [])

  const openAssignModal = async (course: Course) => {
    setSelectedCourse(course)
    setSelectedParent(null)
    setShowModal(true)
    setLoadingParents(true)
    try {
      const res  = await fetch(`${API_URL}/api/delegates/course/${course.id}/eligible-parents`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await res.json()
      if (res.ok) setEligibleParents(data)
      else notify('Error al cargar padres elegibles', 'error')
    } catch { notify('Error de conexión', 'error') }
    finally  { setLoadingParents(false) }
  }

  const handleAssign = async () => {
    if (!selectedParent || !selectedCourse) return
    setSaving(true)
    try {
      const res  = await fetch(`${API_URL}/api/delegates/course/${selectedCourse.id}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ parentId: selectedParent }),
      })
      const data = await res.json()
      if (!res.ok) { notify(data.message, 'error'); return }
      notify(data.message)
      setShowModal(false)
      fetchCourses()
    } catch { notify('Error de conexión', 'error') }
    finally  { setSaving(false) }
  }

  const handleRemove = async (course: Course) => {
    if (!confirm(`¿Quitar al delegado de ${GRADE_LABELS[course.grade]} ${course.parallel}?`)) return
    try {
      const res  = await fetch(`${API_URL}/api/delegates/course/${course.id}/remove`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await res.json()
      if (res.ok) { notify(data.message); fetchCourses() }
      else notify(data.message, 'error')
    } catch { notify('Error al remover delegado', 'error') }
  }

  const filtered = filterLevel
    ? courses.filter(c => c.level === filterLevel)
    : courses

  const grouped = filtered.reduce((acc, c) => {
    if (!acc[c.level]) acc[c.level] = []
    acc[c.level].push(c)
    return acc
  }, {} as Record<string, Course[]>)

  const withDelegate    = courses.filter(c => c.delegateId).length
  const withoutDelegate = courses.filter(c => !c.delegateId).length

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Delegados de Curso</h1>
          <p>Asignación de padres delegados por curso</p>
        </div>
        <div className="header-stats">
          <span className="stat-pill green"><Check size={12}/> {withDelegate} asignados</span>
          <span className="stat-pill red"><Users size={12}/> {withoutDelegate} sin delegado</span>
        </div>
      </div>

      {success && <div className="alert suc">{success}</div>}
      {error   && <div className="alert err">{error}</div>}

      {/* Filtro por nivel */}
      <div className="filters-bar">
        <select value={filterLevel} onChange={e => setFilterLevel(e.target.value)}>
          <option value="">Todos los niveles</option>
          <option value="INICIAL">Inicial</option>
          <option value="PRIMARIA">Primaria</option>
          <option value="SECUNDARIA">Secundaria</option>
        </select>
      </div>

      {loading ? (
        <div className="center"><div className="spinner"/></div>
      ) : courses.length === 0 ? (
        <div className="empty-card">
          <BookOpen size={40} color="#CBE0F0"/>
          <p>No hay cursos registrados</p>
        </div>
      ) : (
        Object.entries(grouped).map(([level, list]) => (
          <div key={level} className="level-section">
            <div className="level-header" style={{ borderLeftColor: LEVEL_COLORS[level] }}>
              <span className="level-title" style={{ color: LEVEL_COLORS[level] }}>
                {LEVEL_LABELS[level]}
              </span>
              <span className="level-count">{list.length} cursos</span>
            </div>
            <div className="courses-grid">
              {list.map(c => (
                <div key={c.id} className={`course-card ${c.delegateId ? 'has-delegate' : 'no-delegate'}`}>
                  <div className="course-top">
                    <div className="course-name">{GRADE_LABELS[c.grade]} {c.parallel}</div>
                    <div className="course-meta">
                      <span className="meta-badge">{SHIFT_LABELS[c.shift]}</span>
                      {c.educationType === 'BTH' && <span className="meta-badge bth">BTH</span>}
                    </div>
                  </div>

                  <div className="course-stats">
                    <span className="stat"><Users size={11}/> {c._count.assignments} estudiantes</span>
                  </div>

                  {/* Delegado */}
                  <div className="delegate-section">
                    <div className="delegate-label">Delegado:</div>
                    {c.delegate ? (
                      <div className="delegate-info">
                        <div className="delegate-name">
                          {c.delegate.lastName} {c.delegate.firstName}
                        </div>
                        {c.delegate.ci && <div className="delegate-sub">CI: {c.delegate.ci}</div>}
                        {c.delegate.phone && <div className="delegate-sub">📱 {c.delegate.phone}</div>}
                        {c.delegate.user && (
                          <div className="delegate-access">
                            <span className={`access-badge ${c.delegate.user.isActive ? 'active' : 'inactive'}`}>
                              {c.delegate.user.isActive ? '✅ Acceso activo' : '❌ Sin acceso'}
                            </span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="no-delegate-msg">Sin delegado asignado</div>
                    )}
                  </div>

                  {/* Maestro tutor */}
                  {c.tutor && (
                    <div className="tutor-section">
                      <div className="tutor-label">Maestro tutor:</div>
                      <div className="tutor-name">
                        {c.tutor.teacher.lastName} {c.tutor.teacher.firstName}
                      </div>
                    </div>
                  )}

                  {/* Acciones */}
                  <div className="course-actions">
                    {c.delegate ? (
                      <button className="btn-remove" onClick={() => handleRemove(c)}>
                        <UserMinus size={13}/> Quitar delegado
                      </button>
                    ) : (
                      <button className="btn-assign" onClick={() => openAssignModal(c)}>
                        <UserPlus size={13}/> Asignar delegado
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}

      {/* Modal asignar delegado */}
      {showModal && selectedCourse && (
        <div className="overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="mhead">
              <h2>Asignar Delegado</h2>
              <button onClick={() => setShowModal(false)}><X size={18}/></button>
            </div>
            <div className="mbody">
              <div className="info-box">
                Curso: <strong>{LEVEL_LABELS[selectedCourse.level]} — {GRADE_LABELS[selectedCourse.grade]} {selectedCourse.parallel} · {SHIFT_LABELS[selectedCourse.shift]}</strong>
              </div>
              <div className="section-lbl">Selecciona un padre del curso</div>
              {loadingParents ? (
                <div className="center"><div className="spinner"/></div>
              ) : eligibleParents.length === 0 ? (
                <div className="no-data">No hay padres registrados en este curso para la gestión activa.</div>
              ) : (
                <div className="parents-list">
                  {eligibleParents.map(p => (
                    <label key={p.id} className={`parent-option ${selectedParent === p.id ? 'selected' : ''}`}>
                      <input type="radio" name="parent" value={p.id}
                        checked={selectedParent === p.id}
                        onChange={() => setSelectedParent(p.id)}/>
                      <div className="parent-data">
                        <div className="parent-name">{p.lastName} {p.firstName}</div>
                        <div className="parent-meta">
                          {p.ci && <span>CI: {p.ci}</span>}
                          {p.phone && <span>📱 {p.phone}</span>}
                          <span className="student-ref">Hijo/a: {p.studentName}</span>
                        </div>
                        {p.user && (
                          <div className="parent-role">{p.user.role === 'DELEGATE' ? '👑 Ya es delegado' : `Rol actual: ${p.user.role}`}</div>
                        )}
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>
            <div className="mfoot">
              <button className="btn-outline" onClick={() => setShowModal(false)}>Cancelar</button>
              <button className="btn-primary" onClick={handleAssign}
                disabled={saving || !selectedParent}>
                {saving ? <span className="spinsm"/> : <UserPlus size={14}/>}
                {saving ? 'Asignando...' : 'Confirmar asignación'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .page-header{display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:24px;gap:16px;flex-wrap:wrap}
        .page-header h1{font-size:20px;font-weight:700;color:#0F6E56;margin-bottom:4px}
        .page-header p{font-size:13px;color:#6B8BB0}
        .header-stats{display:flex;gap:8px;align-items:center}
        .stat-pill{display:flex;align-items:center;gap:5px;padding:5px 12px;border-radius:20px;font-size:12px;font-weight:500}
        .stat-pill.green{background:#E1F5EE;color:#0F6E56}
        .stat-pill.red{background:#FFF0F0;color:#C0392B}
        .alert{padding:10px 14px;border-radius:8px;font-size:13px;margin-bottom:16px}
        .alert.suc{background:#E1F5EE;border:1px solid #9FE1CB;color:#0F6E56}
        .alert.err{background:#FFF0F0;border:1px solid #FFBBBB;color:#C0392B}
        .filters-bar{margin-bottom:16px}
        .filters-bar select{padding:9px 12px;border:1.5px solid #CBE0F0;border-radius:8px;font-size:13px;outline:none;color:#1A3A7C;cursor:pointer}
        .center{display:flex;justify-content:center;padding:48px}
        .empty-card{background:#fff;border:1px solid #CBE0F0;border-radius:12px;padding:48px;display:flex;flex-direction:column;align-items:center;gap:12px;color:#6B8BB0;font-size:13px}
        .level-section{margin-bottom:20px}
        .level-header{display:flex;align-items:center;justify-content:space-between;padding:12px 16px;background:#fff;border:1px solid #CBE0F0;border-left:4px solid #1A3A7C;border-radius:10px;margin-bottom:12px}
        .level-title{font-size:15px;font-weight:700}
        .level-count{font-size:12px;color:#6B8BB0}
        .courses-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:12px}
        .course-card{background:#fff;border:1px solid #CBE0F0;border-radius:12px;padding:16px;display:flex;flex-direction:column;gap:10px}
        .course-card.has-delegate{border-color:#9FE1CB}
        .course-card.no-delegate{border-color:#FFBBBB}
        .course-top{display:flex;align-items:center;justify-content:space-between}
        .course-name{font-size:20px;font-weight:800;color:#1A3A7C}
        .course-meta{display:flex;gap:4px}
        .meta-badge{background:#F0F6FC;color:#1A3A7C;padding:2px 8px;border-radius:20px;font-size:10px;font-weight:500}
        .meta-badge.bth{background:#FFF3CC;color:#7A6000}
        .course-stats{font-size:11px;color:#6B8BB0}
        .stat{display:flex;align-items:center;gap:4px}
        .delegate-section{background:#F8FBFF;border:1px solid #CBE0F0;border-radius:8px;padding:10px}
        .delegate-label{font-size:10px;font-weight:700;color:#6B8BB0;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px}
        .delegate-name{font-size:13px;font-weight:600;color:#1A3A7C}
        .delegate-sub{font-size:11px;color:#6B8BB0;margin-top:2px}
        .delegate-access{margin-top:4px}
        .access-badge{font-size:10px;font-weight:500}
        .access-badge.active{color:#0F6E56}
        .access-badge.inactive{color:#C0392B}
        .no-delegate-msg{font-size:12px;color:#C0392B;font-style:italic}
        .tutor-section{background:#FFFBEA;border:1px solid #F5C518;border-radius:8px;padding:8px}
        .tutor-label{font-size:10px;font-weight:700;color:#7A6000;text-transform:uppercase;letter-spacing:.5px;margin-bottom:2px}
        .tutor-name{font-size:12px;font-weight:500;color:#7A6000}
        .course-actions{margin-top:4px}
        .btn-assign{display:flex;align-items:center;gap:5px;width:100%;padding:8px 12px;background:#0F6E56;color:#fff;border:none;border-radius:7px;font-size:12px;font-weight:500;cursor:pointer;justify-content:center}
        .btn-assign:hover{background:#0A5040}
        .btn-remove{display:flex;align-items:center;gap:5px;width:100%;padding:8px 12px;background:#FFF0F0;color:#C0392B;border:1px solid #FFBBBB;border-radius:7px;font-size:12px;font-weight:500;cursor:pointer;justify-content:center}
        .btn-remove:hover{background:#FFE0E0}
        .overlay{position:fixed;inset:0;background:rgba(0,0,0,0.4);z-index:500;display:flex;align-items:center;justify-content:center;padding:16px}
        .modal{background:#fff;border-radius:14px;width:100%;max-width:480px;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,0.15);max-height:90vh;display:flex;flex-direction:column}
        .mhead{display:flex;align-items:center;justify-content:space-between;padding:18px 20px;border-bottom:1px solid #CBE0F0;flex-shrink:0}
        .mhead h2{font-size:16px;font-weight:600;color:#1A3A7C}
        .mhead button{background:none;border:none;cursor:pointer;color:#6B8BB0;display:flex;padding:4px;border-radius:6px}
        .mhead button:hover{background:#F0F6FC;color:#1A3A7C}
        .mbody{padding:20px;display:flex;flex-direction:column;gap:14px;overflow-y:auto}
        .mfoot{display:flex;justify-content:flex-end;gap:10px;padding:16px 20px;border-top:1px solid #CBE0F0;flex-shrink:0}
        .info-box{background:#F0F6FC;border:1px solid #CBE0F0;border-radius:8px;padding:12px;font-size:13px;color:#6B8BB0;line-height:1.6}
        .section-lbl{font-size:12px;font-weight:700;color:#1A3A7C;text-transform:uppercase;letter-spacing:.6px;padding-bottom:4px;border-bottom:1px solid #F0F6FC}
        .no-data{font-size:13px;color:#6B8BB0;font-style:italic;padding:8px 0}
        .parents-list{display:flex;flex-direction:column;gap:8px;max-height:300px;overflow-y:auto}
        .parent-option{display:flex;align-items:flex-start;gap:10px;padding:12px;border:1.5px solid #CBE0F0;border-radius:8px;cursor:pointer}
        .parent-option:hover{background:#F0F6FC}
        .parent-option.selected{border-color:#0F6E56;background:#E1F5EE}
        .parent-option input{accent-color:#0F6E56;cursor:pointer;margin-top:3px;flex-shrink:0}
        .parent-data{display:flex;flex-direction:column;gap:3px}
        .parent-name{font-size:13px;font-weight:600;color:#1A3A7C}
        .parent-meta{display:flex;gap:10px;font-size:11px;color:#6B8BB0;flex-wrap:wrap}
        .student-ref{color:#4A9FD4;font-weight:500}
        .parent-role{font-size:11px;color:#0F6E56;font-weight:500}
        .btn-primary{display:flex;align-items:center;gap:6px;padding:9px 16px;background:#0F6E56;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:500;cursor:pointer}
        .btn-primary:hover:not(:disabled){background:#0A5040}
        .btn-primary:disabled{opacity:.6;cursor:not-allowed}
        .btn-outline{display:flex;align-items:center;gap:6px;padding:9px 14px;background:#fff;color:#1A3A7C;border:1.5px solid #CBE0F0;border-radius:8px;font-size:13px;cursor:pointer}
        .btn-outline:hover{background:#F0F6FC}
        .spinner{width:24px;height:24px;border:2px solid rgba(15,110,86,.2);border-top-color:#0F6E56;border-radius:50%;animation:spin .7s linear infinite}
        .spinsm{width:14px;height:14px;border:2px solid rgba(255,255,255,.3);border-top-color:#fff;border-radius:50%;animation:spin .7s linear infinite;display:inline-block}
        @keyframes spin{to{transform:rotate(360deg)}}
        @media(max-width:600px){.courses-grid{grid-template-columns:1fr}}
      `}</style>
    </div>
  )
}