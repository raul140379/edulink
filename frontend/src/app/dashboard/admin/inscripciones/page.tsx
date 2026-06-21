'use client'

import { useEffect, useState } from 'react'
import { Search, UserPlus, RefreshCw, Users, BookOpen, X, UserCheck } from 'lucide-react'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

interface Parent {
  id:        number
  firstName: string
  lastName:  string
  phone?:    string
  ci?:       string
}

interface Student {
  id:        number
  firstName: string
  lastName:  string
  ci?:       string
  rude?:     string
  gender?:   string
  isActive:  boolean
  parents:   { isTutor: boolean; relationType: string; parent: Parent }[]
  assignments: {
    id:      number
    year:    number
    course:  { id: number; grade: string; parallel: string; level: string; shift: string }
    academicYear: { isActive: boolean; year: number }
  }[]
}

interface Course {
  id:            number
  grade:         string
  parallel:      string
  level:         string
  shift:         string
  educationType: string
  _count:        { assignments: number }
}

const GRADES: Record<string, string> = {
  PRIMERO: '1°', SEGUNDO: '2°', TERCERO: '3°',
  CUARTO: '4°', QUINTO: '5°', SEXTO: '6°',
}
const SHIFTS: Record<string, string> = {
  MORNING: 'Mañana', AFTERNOON: 'Tarde', NIGHT: 'Noche',
}
const LEVELS: Record<string, string> = {
  INICIAL: 'Inicial', PRIMARIA: 'Primaria', SECUNDARIA: 'Secundaria',
}

export default function InscripcionesPage() {
  const [tab,            setTab]            = useState<'sin' | 'inscritos'>('sin')
  const [students,       setStudents]       = useState<Student[]>([])
  const [courses,        setCourses]        = useState<Course[]>([])
  const [loading,        setLoading]        = useState(true)
  const [search,         setSearch]         = useState('')
  const [filterCourse,   setFilterCourse]   = useState('')
  const [filterLevel,    setFilterLevel]    = useState('')
  const [success,        setSuccess]        = useState('')
  const [error,          setError]          = useState('')

  // Modal inscripción/cambio
  const [showEnrollModal, setShowEnrollModal] = useState(false)
  const [enrollStudent,   setEnrollStudent]   = useState<Student | null>(null)
  const [enrollMode,      setEnrollMode]      = useState<'enroll' | 'change'>('enroll')
  const [selectedCourse,  setSelectedCourse]  = useState('')
  const [enrollFilterLvl, setEnrollFilterLvl] = useState('')
  const [saving,          setSaving]          = useState(false)
  const [canceling,       setCanceling]       = useState<number | null>(null)

  // Modal tutor
  const [showTutorModal,  setShowTutorModal]  = useState(false)
  const [tutorStudent,    setTutorStudent]    = useState<Student | null>(null)
  const [tutorMode,       setTutorMode]       = useState<'assign' | 'change'>('assign')
  const [parents,         setParents]         = useState<Parent[]>([])
  const [searchParent,    setSearchParent]    = useState('')
  const [loadingParents,  setLoadingParents]  = useState(false)
  const [selectedParent,  setSelectedParent]  = useState<number | null>(null)
  const [savingTutor,     setSavingTutor]     = useState(false)

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : ''

  const notify = (msg: string, type: 'ok' | 'err' = 'ok') => {
    if (type === 'ok') { setSuccess(msg); setTimeout(() => setSuccess(''), 3000) }
    else               { setError(msg);   setTimeout(() => setError(''),   4000) }
  }

  const fetchData = async () => {
    setLoading(true)
    try {
      const [sRes, cRes] = await Promise.all([
        fetch(`${API_URL}/api/students?isActive=true`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_URL}/api/courses`,  { headers: { Authorization: `Bearer ${token}` } }),
      ])
      const [sData, cData] = await Promise.all([sRes.json(), cRes.json()])
      if (sRes.ok) setStudents(sData)
      if (cRes.ok) setCourses(cData)
    } catch { notify('Error de conexión', 'err') }
    finally  { setLoading(false) }
  }

  const fetchParents = async (search: string) => {
    setLoadingParents(true)
    try {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      const res  = await fetch(`${API_URL}/api/parents?${params}`, { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      if (res.ok) setParents(data)
    } catch { console.error('Error cargando padres') }
    finally  { setLoadingParents(false) }
  }

  useEffect(() => { fetchData() }, [])

  // ── Inscripción ──
  const openEnroll = (student: Student) => {
    setEnrollStudent(student)
    setEnrollMode('enroll')
    setSelectedCourse('')
    setEnrollFilterLvl('')
    setShowEnrollModal(true)
  }

  const openChange = (student: Student) => {
    setEnrollStudent(student)
    setEnrollMode('change')
    setSelectedCourse('')
    setEnrollFilterLvl('')
    setShowEnrollModal(true)
  }

  const handleEnroll = async () => {
    if (!selectedCourse || !enrollStudent) return
    setSaving(true)
    try {
      const method = enrollMode === 'change' ? 'PUT' : 'POST'
      const res    = await fetch(`${API_URL}/api/students/${enrollStudent.id}/enroll`, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ courseId: parseInt(selectedCourse) }),
      })
      const data = await res.json()
      if (!res.ok) { notify(data.message, 'err'); return }
      notify(data.message)
      setShowEnrollModal(false)
      fetchData()
    } catch { notify('Error de conexión', 'err') }
    finally  { setSaving(false) }
  }

  const handleCancel = async (student: Student) => {
    if (!confirm(`¿Anular la inscripción de ${student.lastName} ${student.firstName}? El estudiante quedará sin curso.`)) return
    setCanceling(student.id)
    try {
      const res  = await fetch(`${API_URL}/api/students/${student.id}/enroll`, {
        method:  'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (!res.ok) { notify(data.message, 'err'); return }
      notify(data.message)
      fetchData()
    } catch { notify('Error de conexión', 'err') }
    finally  { setCanceling(null) }
  }

  // ── Tutor ──
  const openAssignTutor = (student: Student) => {
    setTutorStudent(student)
    setTutorMode('assign')
    setSelectedParent(null)
    setSearchParent('')
    setParents([])
    setShowTutorModal(true)
  }

  const openChangeTutor = (student: Student) => {
    setTutorStudent(student)
    setTutorMode('change')
    setSelectedParent(null)
    setSearchParent('')
    setParents([])
    setShowTutorModal(true)
  }

  const handleSearchParent = async () => {
    if (!searchParent.trim()) return
    await fetchParents(searchParent)
  }

  const handleSaveTutor = async () => {
    if (!selectedParent || !tutorStudent) return
    setSavingTutor(true)
    try {
      if (tutorMode === 'assign') {
        // Primero vincular si no está vinculado
        await fetch(`${API_URL}/api/parents/${selectedParent}/link-students`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body:    JSON.stringify({ studentIds: [tutorStudent.id], relationType: 'TUTOR_LEGAL' }),
        })
        // Luego asignar como tutor
        const res  = await fetch(`${API_URL}/api/parents/student/${tutorStudent.id}/change-tutor`, {
          method:  'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body:    JSON.stringify({ newTutorId: selectedParent }),
        })
        const data = await res.json()
        if (!res.ok) { notify(data.message, 'err'); return }
        notify(data.message)
      } else {
        const res  = await fetch(`${API_URL}/api/parents/student/${tutorStudent.id}/change-tutor`, {
          method:  'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body:    JSON.stringify({ newTutorId: selectedParent }),
        })
        const data = await res.json()
        if (!res.ok) { notify(data.message, 'err'); return }
        notify(data.message)
      }
      setShowTutorModal(false)
      fetchData()
    } catch { notify('Error de conexión', 'err') }
    finally  { setSavingTutor(false) }
  }

  // Separar inscritos y no inscritos
  const sinInscripcion = students.filter(s => !s.assignments?.some(a => a.academicYear?.isActive))
  const inscritos      = students.filter(s =>  s.assignments?.some(a => a.academicYear?.isActive))

  const filterStudents = (list: Student[]) => {
    let result = list
    const q = search.toLowerCase()
    if (q) {
      result = result.filter(s =>
        s.firstName.toLowerCase().includes(q) ||
        s.lastName.toLowerCase().includes(q)  ||
        (s.ci   || '').toLowerCase().includes(q) ||
        (s.rude || '').toLowerCase().includes(q)
      )
    }
    if (filterCourse && tab === 'inscritos') {
      result = result.filter(s =>
        s.assignments?.some(a => a.academicYear?.isActive && a.course.id === parseInt(filterCourse))
      )
    }
    return result
  }

  const filteredEnrollCourses = enrollFilterLvl
    ? courses.filter(c => c.level === enrollFilterLvl)
    : courses

  const currentList    = filterStudents(tab === 'sin' ? sinInscripcion : inscritos)
  const getTutor       = (s: Student) => s.parents?.find(p => p.isTutor)
  const getAssignment  = (s: Student) => s.assignments?.find(a => a.academicYear?.isActive)

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Inscripciones</h1>
          <p>Gestión de inscripciones del año activo</p>
        </div>
      </div>

      {success && <div className="alert ok">{success}</div>}
      {error   && <div className="alert err">{error}</div>}

      {/* Resumen */}
      <div className="summary-grid">
        <div className="sum-card accent">
          <Users size={24} color="#fff"/>
          <div>
            <div className="sum-label">Total estudiantes</div>
            <div className="sum-value">{students.length}</div>
          </div>
        </div>
        <div className="sum-card">
          <BookOpen size={24} color="#0F6E56"/>
          <div>
            <div className="sum-label">Inscritos</div>
            <div className="sum-value" style={{color:'#0F6E56'}}>{inscritos.length}</div>
          </div>
        </div>
        <div className="sum-card">
          <Users size={24} color="#C0392B"/>
          <div>
            <div className="sum-label">Sin inscripción</div>
            <div className="sum-value" style={{color:'#C0392B'}}>{sinInscripcion.length}</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs">
        <button className={`tab ${tab === 'sin' ? 'active' : ''}`} onClick={() => setTab('sin')}>
          Sin inscripción ({sinInscripcion.length})
        </button>
        <button className={`tab ${tab === 'inscritos' ? 'active' : ''}`} onClick={() => setTab('inscritos')}>
          Inscritos ({inscritos.length})
        </button>
      </div>

      {/* Filtros */}
      <div className="filters-bar">
        <div className="search-wrap">
          <Search size={14} className="sicon"/>
          <input type="text" placeholder="Buscar por nombre, CI o RUDE..."
            value={search} onChange={e => setSearch(e.target.value)}/>
        </div>
        {tab === 'inscritos' && (
          <select value={filterCourse} onChange={e => setFilterCourse(e.target.value)} className="filter-select">
            <option value="">Todos los cursos</option>
            {courses.map(c => (
              <option key={c.id} value={c.id}>
                {GRADES[c.grade]} &quot;{c.parallel}&quot; {SHIFTS[c.shift]}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Tabla */}
      <div className="table-card">
        {loading ? (
          <div className="center"><div className="spinner"/></div>
        ) : currentList.length === 0 ? (
          <div className="empty">
            {tab === 'sin' ? '🎉 Todos los estudiantes están inscritos' : 'No hay estudiantes en este filtro'}
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Estudiante</th>
                <th>CI / RUDE</th>
                <th>Tutor legal</th>
                <th>Teléfono</th>
                {tab === 'inscritos' && <th>Curso</th>}
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {currentList.map((s, i) => {
                const tutor      = getTutor(s)
                const assignment = getAssignment(s)
                return (
                  <tr key={s.id}>
                    <td className="muted">{i + 1}</td>
                    <td>
                      <div className="sname">{s.lastName} {s.firstName}</div>
                      <div className="ssub">{s.gender === 'MASCULINO' ? '👦' : s.gender === 'FEMENINO' ? '👧' : ''}</div>
                    </td>
                    <td className="muted">
                      {s.ci   && <div>CI: {s.ci}</div>}
                      {s.rude && <div>RUDE: {s.rude}</div>}
                      {!s.ci && !s.rude && '—'}
                    </td>
                    <td>
                      {tutor ? (
                        <div>
                          <div className="sname">{tutor.parent.lastName} {tutor.parent.firstName}</div>
                          <div className="ssub">{tutor.relationType}</div>
                        </div>
                      ) : <span className="no-tutor">Sin tutor</span>}
                    </td>
                    <td className="muted">{tutor?.parent.phone || '—'}</td>
                    {tab === 'inscritos' && (
                      <td>
                        {assignment ? (
                          <span className="course-badge">
                            {GRADES[assignment.course.grade]} &quot;{assignment.course.parallel}&quot; {SHIFTS[assignment.course.shift]}
                          </span>
                        ) : '—'}
                      </td>
                    )}
                    <td>
                      <div className="actions">
                        {tab === 'sin' ? (
                          <button className="btn-action enroll" onClick={() => openEnroll(s)} title="Inscribir">
                            <UserPlus size={13}/> Inscribir
                          </button>
                        ) : (
                          <>
                            <button className="btn-action change" onClick={() => openChange(s)} title="Cambiar curso">
                              <RefreshCw size={13}/> Cambiar
                            </button>
                            <button
                              className="btn-action cancel"
                              onClick={() => handleCancel(s)}
                              disabled={canceling === s.id}
                              title="Anular inscripción">
                              {canceling === s.id ? <span className="spinsm"/> : <X size={13}/>}
                              Anular
                            </button>
                          </>
                        )}
                        {tutor ? (
                          <button className="btn-action tutor-change" onClick={() => openChangeTutor(s)} title="Cambiar tutor">
                            <UserCheck size={13}/> Tutor
                          </button>
                        ) : (
                          <button className="btn-action tutor-assign" onClick={() => openAssignTutor(s)} title="Asignar tutor">
                            <UserCheck size={13}/> Tutor
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Modal inscripción ── */}
      {showEnrollModal && enrollStudent && (
        <div className="overlay" onClick={() => setShowEnrollModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="mhead">
              <div>
                <h2>{enrollMode === 'enroll' ? 'Inscribir estudiante' : 'Cambiar inscripción'}</h2>
                <p style={{fontSize:'12px',color:'#6B8BB0',margin:'2px 0 0'}}>
                  {enrollStudent.lastName} {enrollStudent.firstName}
                </p>
              </div>
              <button onClick={() => setShowEnrollModal(false)}><X size={18}/></button>
            </div>
            <div className="mbody">
              {enrollMode === 'change' && (
                <div className="current-box">
                  <span className="current-label">Curso actual:</span>
                  {(() => {
                    const a = getAssignment(enrollStudent)
                    return a
                      ? <span className="course-badge">{GRADES[a.course.grade]} &quot;{a.course.parallel}&quot; {SHIFTS[a.course.shift]}</span>
                      : <span className="muted">Sin curso</span>
                  })()}
                </div>
              )}
              <div className="fg">
                <label>Filtrar por nivel</label>
                <select value={enrollFilterLvl} onChange={e => setEnrollFilterLvl(e.target.value)} className="fg-select">
                  <option value="">Todos los niveles</option>
                  <option value="INICIAL">Inicial</option>
                  <option value="PRIMARIA">Primaria</option>
                  <option value="SECUNDARIA">Secundaria</option>
                </select>
              </div>
              <div className="fg">
                <label>Curso *</label>
                <select value={selectedCourse} onChange={e => setSelectedCourse(e.target.value)} className="fg-select">
                  <option value="">— Seleccionar curso —</option>
                  {filteredEnrollCourses.map(c => (
                    <option key={c.id} value={c.id}>
                      {LEVELS[c.level]} — {GRADES[c.grade]} &quot;{c.parallel}&quot; {SHIFTS[c.shift]}
                      {c.educationType === 'BTH' ? ' · BTH' : ''}
                      {' '}({c._count.assignments} estudiantes)
                    </option>
                  ))}
                </select>
              </div>
              {/* Tutor */}
              {(() => {
                const tutor = getTutor(enrollStudent)
                return tutor ? (
                  <div className="tutor-box">
                    <div className="tutor-box-label">Tutor legal:</div>
                    <div className="tutor-box-name">{tutor.parent.lastName} {tutor.parent.firstName}</div>
                    {tutor.parent.phone && <div className="tutor-box-sub">📱 {tutor.parent.phone}</div>}
                  </div>
                ) : (
                  <div className="warn-box">⚠️ Este estudiante no tiene tutor legal asignado.</div>
                )
              })()}
            </div>
            <div className="mfoot">
              <button className="btn-outline" onClick={() => setShowEnrollModal(false)}>Cancelar</button>
              <button className="btn-primary" onClick={handleEnroll} disabled={saving || !selectedCourse}>
                {saving ? <span className="spinsm"/> : enrollMode === 'enroll' ? <UserPlus size={14}/> : <RefreshCw size={14}/>}
                {saving ? 'Guardando...' : enrollMode === 'enroll' ? 'Inscribir' : 'Cambiar curso'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal tutor ── */}
      {showTutorModal && tutorStudent && (
        <div className="overlay" onClick={() => setShowTutorModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="mhead">
              <div>
                <h2>{tutorMode === 'assign' ? 'Asignar tutor legal' : 'Cambiar tutor legal'}</h2>
                <p style={{fontSize:'12px',color:'#6B8BB0',margin:'2px 0 0'}}>
                  {tutorStudent.lastName} {tutorStudent.firstName}
                </p>
              </div>
              <button onClick={() => setShowTutorModal(false)}><X size={18}/></button>
            </div>
            <div className="mbody">
              {tutorMode === 'change' && (
                <div className="current-box">
                  <span className="current-label">Tutor actual:</span>
                  {(() => {
                    const t = getTutor(tutorStudent)
                    return t
                      ? <span>{t.parent.lastName} {t.parent.firstName}</span>
                      : <span className="muted">Sin tutor</span>
                  })()}
                </div>
              )}
              <div className="search-row">
                <div className="search-wrap">
                  <Search size={14} className="sicon"/>
                  <input type="text" placeholder="Buscar padre por nombre o CI..."
                    value={searchParent} onChange={e => setSearchParent(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSearchParent()}/>
                </div>
                <button className="btn-primary" onClick={handleSearchParent} disabled={loadingParents}>
                  {loadingParents ? <span className="spinsm"/> : <Search size={14}/>}
                  Buscar
                </button>
              </div>

              {loadingParents ? (
                <div className="center"><div className="spinner"/></div>
              ) : parents.length === 0 && searchParent ? (
                <div className="no-data">No se encontraron padres</div>
              ) : parents.length === 0 ? (
                <div className="no-data">Busca un padre para asignar como tutor</div>
              ) : (
                <div className="parents-list">
                  {parents.map(p => (
                    <label key={p.id} className={`parent-option ${selectedParent === p.id ? 'selected' : ''}`}>
                      <input type="radio" name="parent" value={p.id}
                        checked={selectedParent === p.id}
                        onChange={() => setSelectedParent(p.id)}/>
                      <div className="parent-data">
                        <div className="parent-name">{p.lastName} {p.firstName}</div>
                        <div className="parent-meta">
                          {p.ci    && <span>CI: {p.ci}</span>}
                          {p.phone && <span>📱 {p.phone}</span>}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>
            <div className="mfoot">
              <button className="btn-outline" onClick={() => setShowTutorModal(false)}>Cancelar</button>
              <button className="btn-primary" onClick={handleSaveTutor} disabled={savingTutor || !selectedParent}>
                {savingTutor ? <span className="spinsm"/> : <UserCheck size={14}/>}
                {savingTutor ? 'Guardando...' : tutorMode === 'assign' ? 'Asignar tutor' : 'Cambiar tutor'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .page-header{display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:24px;gap:16px}
        .page-header h1{font-size:20px;font-weight:700;color:#1A3A7C;margin-bottom:4px}
        .page-header p{font-size:13px;color:#6B8BB0}
        .alert{padding:10px 14px;border-radius:8px;font-size:13px;margin-bottom:14px}
        .alert.ok{background:#E1F5EE;border:1px solid #9FE1CB;color:#0F6E56}
        .alert.err{background:#FFF0F0;border:1px solid #FFBBBB;color:#C0392B}
        .summary-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin-bottom:20px}
        .sum-card{background:#fff;border:1px solid #CBE0F0;border-radius:12px;padding:14px;display:flex;align-items:center;gap:12px}
        .sum-card.accent{background:#1A3A7C;border-color:#1A3A7C}
        .sum-card.accent .sum-label{color:rgba(255,255,255,0.7)}
        .sum-card.accent .sum-value{color:#fff}
        .sum-label{font-size:11px;color:#6B8BB0;text-transform:uppercase;letter-spacing:.5px;margin-bottom:2px}
        .sum-value{font-size:22px;font-weight:700;color:#1A3A7C}
        .tabs{display:flex;margin-bottom:16px;background:#fff;border:1px solid #CBE0F0;border-radius:10px;overflow:hidden}
        .tab{flex:1;padding:12px;font-size:13px;font-weight:500;color:#6B8BB0;background:none;border:none;cursor:pointer;transition:all .15s}
        .tab:hover{background:#F0F6FC;color:#1A3A7C}
        .tab.active{background:#1A3A7C;color:#fff;font-weight:600}
        .filters-bar{display:flex;gap:10px;margin-bottom:14px;flex-wrap:wrap}
        .search-wrap{position:relative;flex:1;min-width:200px}
        .sicon{position:absolute;left:11px;top:50%;transform:translateY(-50%);color:#4A9FD4;pointer-events:none}
        .search-wrap input{width:100%;padding:10px 12px 10px 34px;border:1.5px solid #CBE0F0;border-radius:8px;font-size:13px;color:#1A3A7C;outline:none}
        .search-wrap input:focus{border-color:#4A9FD4}
        .filter-select{padding:9px 12px;border:1.5px solid #CBE0F0;border-radius:8px;font-size:13px;color:#1A3A7C;outline:none;cursor:pointer}
        .table-card{background:#fff;border:1px solid #CBE0F0;border-radius:12px;overflow:hidden}
        .center{display:flex;justify-content:center;padding:48px}
        .empty{padding:32px;text-align:center;font-size:13px;color:#6B8BB0}
        table{width:100%;border-collapse:collapse}
        thead tr{background:#F0F6FC}
        th{padding:10px 14px;text-align:left;font-size:11px;font-weight:600;color:#1A3A7C;text-transform:uppercase;letter-spacing:.5px}
        td{padding:10px 14px;font-size:13px;color:#1A3A7C;border-top:1px solid #F0F6FC;vertical-align:middle}
        tr:hover td{background:#FAFCFF}
        .muted{color:#6B8BB0;font-size:12px}
        .sname{font-weight:500;color:#1A3A7C}
        .ssub{font-size:11px;color:#6B8BB0;margin-top:1px}
        .no-tutor{font-size:11px;color:#C0392B;font-style:italic}
        .course-badge{background:#E1F5EE;color:#0F6E56;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:500;white-space:nowrap}
        .actions{display:flex;gap:6px;flex-wrap:wrap}
        .btn-action{display:flex;align-items:center;gap:4px;padding:5px 10px;border:none;border-radius:6px;font-size:11px;font-weight:500;cursor:pointer;white-space:nowrap}
        .btn-action:disabled{opacity:.6;cursor:not-allowed}
        .btn-action.enroll{background:#1A3A7C;color:#fff}
        .btn-action.enroll:hover{background:#4A9FD4}
        .btn-action.change{background:#F0F6FC;color:#1A3A7C;border:1px solid #CBE0F0}
        .btn-action.change:hover{background:#E0ECF8}
        .btn-action.cancel{background:#FFF0F0;color:#C0392B;border:1px solid #FFBBBB}
        .btn-action.cancel:hover:not(:disabled){background:#FFE0E0}
        .btn-action.tutor-assign{background:#E1F5EE;color:#0F6E56;border:1px solid #9FE1CB}
        .btn-action.tutor-assign:hover{background:#C8EFE3}
        .btn-action.tutor-change{background:#FFFBEA;color:#BA7517;border:1px solid #F5C518}
        .btn-action.tutor-change:hover{background:#FFF0CC}
        .overlay{position:fixed;inset:0;background:rgba(0,0,0,0.4);z-index:500;display:flex;align-items:center;justify-content:center;padding:16px}
        .modal{background:#fff;border-radius:14px;width:100%;max-width:480px;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,0.15);max-height:90vh;display:flex;flex-direction:column}
        .mhead{display:flex;align-items:flex-start;justify-content:space-between;padding:18px 20px;border-bottom:1px solid #CBE0F0;flex-shrink:0;gap:12px}
        .mhead h2{font-size:16px;font-weight:600;color:#1A3A7C;margin:0}
        .mhead button{background:none;border:none;cursor:pointer;color:#6B8BB0;display:flex;padding:4px;border-radius:6px;flex-shrink:0}
        .mhead button:hover{background:#F0F6FC}
        .mbody{padding:20px;display:flex;flex-direction:column;gap:14px;overflow-y:auto;flex:1}
        .mfoot{display:flex;justify-content:flex-end;gap:10px;padding:16px 20px;border-top:1px solid #CBE0F0;flex-shrink:0}
        .current-box{display:flex;align-items:center;gap:10px;background:#F0F6FC;border:1px solid #CBE0F0;border-radius:8px;padding:10px 14px;font-size:13px}
        .current-label{color:#6B8BB0;font-weight:500;white-space:nowrap}
        .fg{display:flex;flex-direction:column;gap:5px}
        .fg label{font-size:11px;font-weight:600;color:#1A3A7C;text-transform:uppercase;letter-spacing:.5px}
        .fg-select{padding:9px 12px;border:1.5px solid #CBE0F0;border-radius:8px;font-size:13px;color:#1A3A7C;outline:none;width:100%}
        .fg-select:focus{border-color:#4A9FD4;box-shadow:0 0 0 3px rgba(74,159,212,.12)}
        .tutor-box{background:#E1F5EE;border:1px solid #9FE1CB;border-radius:8px;padding:12px}
        .tutor-box-label{font-size:11px;font-weight:600;color:#0F6E56;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px}
        .tutor-box-name{font-size:13px;font-weight:600;color:#1A3A7C}
        .tutor-box-sub{font-size:12px;color:#6B8BB0;margin-top:2px}
        .warn-box{background:#FFFBEA;border:1px solid #F5C518;border-radius:8px;padding:10px 14px;font-size:13px;color:#BA7517}
        .search-row{display:flex;gap:10px}
        .no-data{font-size:13px;color:#6B8BB0;font-style:italic;padding:8px 0}
        .parents-list{display:flex;flex-direction:column;gap:8px;max-height:250px;overflow-y:auto}
        .parent-option{display:flex;align-items:flex-start;gap:10px;padding:10px 12px;border:1.5px solid #CBE0F0;border-radius:8px;cursor:pointer}
        .parent-option:hover{background:#F0F6FC}
        .parent-option.selected{border-color:#1A3A7C;background:#E8F0FB}
        .parent-option input{accent-color:#1A3A7C;cursor:pointer;margin-top:3px;flex-shrink:0}
        .parent-data{display:flex;flex-direction:column;gap:3px}
        .parent-name{font-size:13px;font-weight:600;color:#1A3A7C}
        .parent-meta{display:flex;gap:10px;font-size:11px;color:#6B8BB0;flex-wrap:wrap}
        .btn-primary{display:flex;align-items:center;gap:6px;padding:9px 16px;background:#1A3A7C;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:500;cursor:pointer}
        .btn-primary:hover:not(:disabled){background:#4A9FD4}
        .btn-primary:disabled{opacity:.6;cursor:not-allowed}
        .btn-outline{display:flex;align-items:center;gap:6px;padding:9px 14px;background:#fff;color:#1A3A7C;border:1.5px solid #CBE0F0;border-radius:8px;font-size:13px;cursor:pointer}
        .btn-outline:hover{background:#F0F6FC}
        .spinner{width:24px;height:24px;border:2px solid rgba(26,58,124,.2);border-top-color:#1A3A7C;border-radius:50%;animation:spin .7s linear infinite}
        .spinsm{width:14px;height:14px;border:2px solid rgba(255,255,255,.3);border-top-color:#fff;border-radius:50%;animation:spin .7s linear infinite;display:inline-block}
        @keyframes spin{to{transform:rotate(360deg)}}
        @media(max-width:768px){.summary-grid{grid-template-columns:1fr 1fr}.actions{flex-direction:column}}
      `}</style>
    </div>
  )
}