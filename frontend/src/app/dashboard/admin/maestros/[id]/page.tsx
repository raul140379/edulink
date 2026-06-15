'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  ArrowLeft, BookOpen, Plus, Trash2, Clock,
  User, Save, X, GraduationCap, CheckCircle2, Search
} from 'lucide-react'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

interface Teacher {
  id: number; firstName: string; lastName: string
  ci?: string; phone?: string; email?: string
  specialty?: string; hoursLoad?: number; gender?: string; isActive: boolean
  attendanceCode?: string  // ← agregar
  user?: { email: string; role: string }
  assignments: Assignment[]
}

interface Assignment {
  id: number; subjectId: number; courseId: number
  subject: { id: number; name: string; code?: string; campo?: string }
  course:  { id: number; grade: string; parallel: string; level: string; shift: string; educationType: string }
}

interface Course {
  id: number; grade: string; parallel: string; level: string; shift: string; educationType: string
}

interface Specialty {
  id: number
  subject: { id: number; name: string; campo?: string }
}

const GRADES:  Record<string,string> = { PRIMERO:'1°', SEGUNDO:'2°', TERCERO:'3°', CUARTO:'4°', QUINTO:'5°', SEXTO:'6°' }
const SHIFTS:  Record<string,string> = { MORNING:'Mañana', AFTERNOON:'Tarde', NIGHT:'Noche' }
const LEVELS:  Record<string,string> = { INICIAL:'Inicial', PRIMARIA:'Primaria', SECUNDARIA:'Secundaria' }
const CAMPO_COLORS: Record<string,string> = {
  VIDA_TIERRA_TERRITORIO:'#E1F5EE', COMUNIDAD_SOCIEDAD:'#E0ECF8',
  COSMOS_PENSAMIENTO:'#F3E8FF', CIENCIA_TECNOLOGIA_PRODUCCION:'#FFF3E0',
}
const CAMPO_TEXT: Record<string,string> = {
  VIDA_TIERRA_TERRITORIO:'#0F6E56', COMUNIDAD_SOCIEDAD:'#1A3A7C',
  COSMOS_PENSAMIENTO:'#6B21A8', CIENCIA_TECNOLOGIA_PRODUCCION:'#633806',
}
const CAMPO_LABELS: Record<string,string> = {
  VIDA_TIERRA_TERRITORIO:'Vida, Tierra y Territorio',
  COMUNIDAD_SOCIEDAD:'Comunidad y Sociedad',
  COSMOS_PENSAMIENTO:'Cosmos y Pensamiento',
  CIENCIA_TECNOLOGIA_PRODUCCION:'Ciencia, Tecnología y Producción',
}
const CAMPO_ICONS: Record<string,string> = {
  VIDA_TIERRA_TERRITORIO:'🌿', COMUNIDAD_SOCIEDAD:'🌐',
  COSMOS_PENSAMIENTO:'✨', CIENCIA_TECNOLOGIA_PRODUCCION:'⚙️',
}

export default function TeacherDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id     = params.id as string

  const [teacher,      setTeacher]      = useState<Teacher | null>(null)
  const [specialties,  setSpecialties]  = useState<Specialty[]>([])
  const [courses,      setCourses]      = useState<Course[]>([])
  const [loading,      setLoading]      = useState(true)
  const [showModal,    setShowModal]    = useState(false)
  const [selectedCourse,  setSelectedCourse]  = useState('')
  const [selectedSubject, setSelectedSubject] = useState('')
  const [subjectSearch,   setSubjectSearch]   = useState('')
  const [courseSearch,    setCourseSearch]    = useState('')
  const [saving,       setSaving]       = useState(false)
  const [removing,     setRemoving]     = useState<number | null>(null)
  const [success,      setSuccess]      = useState('')
  const [error,        setError]        = useState('')
  const [attCode,    setAttCode]    = useState('')
  const [savingCode, setSavingCode] = useState(false)

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : ''

  const notify = (msg: string, type: 'ok' | 'err' = 'ok') => {
    if (type === 'ok') { setSuccess(msg); setTimeout(() => setSuccess(''), 3000) }
    else               { setError(msg);   setTimeout(() => setError(''),   4000) }
  }
const fetchTeacher = async () => {
    setLoading(true)
    try {
      const res  = await fetch(`${API_URL}/api/teachers/${id}`, { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      if (res.ok) {
        setTeacher(data)
        setAttCode(data.attendanceCode || '')
      }
      else notify('Error al cargar maestro', 'err')
    } catch { notify('Error de conexión', 'err') }
    finally  { setLoading(false) }
  }

  const fetchSpecialties = async () => {
    try {
      const res  = await fetch(`${API_URL}/api/teachers/${id}/specialties`, { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      if (res.ok) setSpecialties(data)
    } catch { console.error('Error cargando especialidades') }
  }

  const fetchCourses = async () => {
    try {
      const res  = await fetch(`${API_URL}/api/courses`, { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      if (res.ok) setCourses(data)
    } catch { console.error('Error cargando cursos') }
  }

  useEffect(() => { fetchTeacher() }, [id])

  const openModal = async () => {
    setSelectedCourse(''); setSelectedSubject('')
    setSubjectSearch(''); setCourseSearch('')
    setShowModal(true)
    await Promise.all([fetchSpecialties(), fetchCourses()])
  }

  const handleSaveCode = async () => {
    if (!attCode.trim()) { notify('Ingresa un código', 'err'); return }
    setSavingCode(true)
    try {
      const res  = await fetch(`${API_URL}/api/teachers/${id}/attendance-code`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ code: attCode.trim() })
      })
      const data = await res.json()
      if (!res.ok) { notify(data.message, 'err'); return }
      notify('Código asignado correctamente')
      setAttCode(data.teacher.attendanceCode)
    } catch { notify('Error de conexión', 'err') }
    finally  { setSavingCode(false) }
  }

  const handleAssign = async () => {
    if (!selectedCourse || !selectedSubject) { notify('Selecciona un curso y una materia', 'err'); return }
    setSaving(true)
    try {
      const res  = await fetch(`${API_URL}/api/subjects/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ subjectId: parseInt(selectedSubject), teacherId: parseInt(id), courseId: parseInt(selectedCourse) }),
      })
      const data = await res.json()
      if (!res.ok) { notify(data.message, 'err'); return }
      notify(data.message); setShowModal(false); fetchTeacher()
    } catch { notify('Error de conexión', 'err') }
    finally  { setSaving(false) }
  }

  const handleRemove = async (assignmentId: number) => {
    if (!confirm('¿Quitar esta asignación?')) return
    setRemoving(assignmentId)
    try {
      const res  = await fetch(`${API_URL}/api/subjects/assign/${assignmentId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      if (res.ok) { notify(data.message); fetchTeacher() }
      else notify(data.message, 'err')
    } catch { notify('Error al quitar asignación', 'err') }
    finally  { setRemoving(null) }
  }

  const groupByCourse = (assignments: Assignment[]) => {
    const map: Record<number, { course: Assignment['course']; items: Assignment[] }> = {}
    for (const a of assignments) {
      if (!map[a.courseId]) map[a.courseId] = { course: a.course, items: [] }
      map[a.courseId].items.push(a)
    }
    return Object.values(map)
  }

  if (loading) return <div className="center"><div className="spinner"/></div>
  if (!teacher) return <div className="center"><p>Maestro no encontrado</p></div>

  const grouped       = groupByCourse(teacher.assignments)
  const totalMaterias = teacher.assignments.length

  const previewCourse  = courses.find(c => c.id === parseInt(selectedCourse))
  const previewSubject = specialties.find(s => s.subject.id === parseInt(selectedSubject))

  const filteredSpecialties = specialties.filter(sp =>
    subjectSearch === '' || sp.subject.name.toLowerCase().includes(subjectSearch.toLowerCase())
  )
  const filteredCourses = courses.filter(c => {
    const label = `${GRADES[c.grade]} ${c.parallel} ${SHIFTS[c.shift]} ${LEVELS[c.level]}`.toLowerCase()
    return courseSearch === '' || label.includes(courseSearch.toLowerCase())
  })

  return (
    <div>
      <div className="page-header">
        <button className="back-btn" onClick={() => router.back()}><ArrowLeft size={16}/> Volver</button>
        <div style={{flex:1}}>
          <h1>{teacher.lastName} {teacher.firstName}</h1>
          <p className="sub">{teacher.specialty || 'Sin especialidad registrada'}</p>
        </div>
        <button className="btn-primary" onClick={openModal}><Plus size={15}/> Agregar asignación</button>
      </div>

      {success && <div className="alert ok">{success}</div>}
      {error   && <div className="alert err">{error}</div>}

      {/* Info */}
      <div className="info-card">

        <div className="info-row"><User size={15} className="info-icon"/><span className="info-label">CI:</span><span className="info-val">{teacher.ci || '—'}</span></div>

        <div className="info-row"><span className="info-label">Teléfono:</span><span className="info-val">{teacher.phone || '—'}</span></div>
        <div className="info-row"><span className="info-label">Email:</span><span className="info-val">{teacher.user?.email || teacher.email || '—'}</span></div>
        <div className="info-row">
          <Clock size={15} className="info-icon"/>
          <span className="info-label">Carga hrs/mes:</span>
          <span className="info-val">{teacher.hoursLoad ? <span className="hrs-badge">{teacher.hoursLoad} hrs</span> : '—'}</span>
        </div>
       <div className="info-row">
          <GraduationCap size={15} className="info-icon"/>
          <span className="info-label">Asignaciones:</span>
          <span className="info-val"><strong>{grouped.length}</strong> cursos · <strong>{totalMaterias}</strong> materias</span>
        </div>

        <div className="info-row" style={{width:'100%',marginTop:8,paddingTop:8,borderTop:'1px solid #F0F6FC'}}>
          <span className="info-label">Código de Asistencia:</span>
          <div style={{display:'flex',alignItems:'center',gap:8,flex:1}}>
            <input
              type="text"
              value={attCode}
              onChange={e=>setAttCode(e.target.value.toUpperCase())}
              placeholder="Ej: MGOM01"
              maxLength={10}
              style={{
                padding:'6px 10px',border:'1.5px solid #CBE0F0',borderRadius:7,
                fontSize:13,color:'#1A3A7C',outline:'none',width:120,
                fontWeight:700,letterSpacing:2,textAlign:'center'
              }}
            />
            <button
              onClick={handleSaveCode}
              disabled={savingCode}
              style={{
                display:'flex',alignItems:'center',gap:5,padding:'6px 12px',
                background:'#1A3A7C',color:'#fff',border:'none',borderRadius:7,
                fontSize:12,cursor:'pointer',opacity:savingCode?0.6:1
              }}>
              <Save size={12}/> {savingCode?'Guardando...':'Guardar'}
            </button>
            {teacher.attendanceCode && (
              <span style={{fontSize:11,color:'#0F6E56',background:'#E1F5EE',padding:'2px 8px',borderRadius:20,fontWeight:600}}>
                ✅ Activo: {teacher.attendanceCode}
              </span>
            )}
          </div>
        </div>
      </div> 

      {/* Asignaciones */}

      <div className="section-title"><BookOpen size={16}/> Cursos y materias asignadas</div>

      {grouped.length === 0 ? (
        <div className="empty-state">
          <BookOpen size={32} style={{opacity:.3}}/>
          <p>Este maestro no tiene asignaciones aún.</p>
          <button className="btn-primary" onClick={openModal}><Plus size={14}/> Agregar primera asignación</button>
        </div>
      ) : (
        grouped.map(({ course, items }) => (
          <div key={course.id} className="course-card">
            <div className="course-header">
              <div className="course-title-row">
                <GraduationCap size={16}/>
                <span>{GRADES[course.grade]} &quot;{course.parallel}&quot;</span>
                <span className="course-badge">{SHIFTS[course.shift]}</span>
                <span className="course-badge level">{LEVELS[course.level]}</span>
                {course.educationType === 'BTH' && <span className="course-badge bth">BTH</span>}
              </div>
              <span className="course-count">{items.length} materia{items.length !== 1 ? 's' : ''}</span>
            </div>
            <div className="subject-list">
              {items.map(a => (
                <div key={a.id} className="subject-row">
                  <div className="subject-info">
                    <span className="campo-dot" style={{ background: CAMPO_COLORS[a.subject.campo||'']||'#F0F0F0', color: CAMPO_TEXT[a.subject.campo||'']||'#444' }}>
                      {CAMPO_LABELS[a.subject.campo||'']||'Sin campo'}
                    </span>
                    <span className="subject-name">{a.subject.name}</span>
                  </div>
                  <button className="btn-remove" onClick={() => handleRemove(a.id)} disabled={removing === a.id} title="Quitar asignación">
                    {removing === a.id ? <span className="spinsm"/> : <Trash2 size={13}/>}
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))
      )}

      {/* ── Modal agregar asignación ── */}
      {showModal && (
        <div className="overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="mhead">
              <div>
                <h2>Agregar asignación</h2>
                <p className="mhead-sub">{teacher.lastName} {teacher.firstName}</p>
              </div>
              <button onClick={() => setShowModal(false)}><X size={18}/></button>
            </div>
            <div className="mbody">

              {/* Selector de materia */}
              <div className="fg">
                <label>Materia *</label>
                {specialties.length === 0 ? (
                  <div className="warn-box">⚠️ Este maestro no tiene materias como especialidad. Agrégalas primero.</div>
                ) : (
                  <>
                    <div className="search-wrap">
                      <Search size={13} className="s-icon"/>
                      <input type="text" placeholder="Buscar materia..." value={subjectSearch}
                        onChange={e => setSubjectSearch(e.target.value)}/>
                    </div>
                    <div className="option-list">
                      {filteredSpecialties.length === 0 ? (
                        <div className="no-options">No se encontraron materias</div>
                      ) : (
                        filteredSpecialties.map(sp => {
                          const campo = sp.subject.campo
                          const sel   = selectedSubject === String(sp.subject.id)
                          return (
                            <label key={sp.subject.id} className={`option-item ${sel ? 'selected' : ''}`}>
                              <input type="radio" name="subject" value={sp.subject.id}
                                checked={sel} onChange={() => setSelectedSubject(String(sp.subject.id))}/>
                              <div className="option-info">
                                <span className="option-name">{sp.subject.name}</span>
                                {campo && (
                                  <span className="option-tag" style={{ background: CAMPO_COLORS[campo]||'#F0F0F0', color: CAMPO_TEXT[campo]||'#444' }}>
                                    {CAMPO_ICONS[campo]||'📌'} {CAMPO_LABELS[campo]||campo}
                                  </span>
                                )}
                              </div>
                            </label>
                          )
                        })
                      )}
                    </div>
                  </>
                )}
              </div>

              {/* Selector de curso */}
              <div className="fg">
                <label>Curso *</label>
                <div className="search-wrap">
                  <Search size={13} className="s-icon"/>
                  <input type="text" placeholder="Buscar curso..." value={courseSearch}
                    onChange={e => setCourseSearch(e.target.value)} disabled={!selectedSubject}/>
                </div>
                <div className={`option-list ${!selectedSubject ? 'disabled' : ''}`}>
                  {!selectedSubject ? (
                    <div className="no-options">Selecciona primero una materia</div>
                  ) : filteredCourses.length === 0 ? (
                    <div className="no-options">No se encontraron cursos</div>
                  ) : (
                    filteredCourses.map(c => {
                      const sel = selectedCourse === String(c.id)
                      return (
                        <label key={c.id} className={`option-item ${sel ? 'selected' : ''}`}>
                          <input type="radio" name="course" value={c.id}
                            checked={sel} onChange={() => setSelectedCourse(String(c.id))}/>
                          <div className="option-info">
                            <span className="option-name">
                              {GRADES[c.grade]} &quot;{c.parallel}&quot; · {SHIFTS[c.shift]}
                            </span>
                            <span className="option-sub">
                              {LEVELS[c.level]}{c.educationType === 'BTH' ? ' · BTH' : ''}
                            </span>
                          </div>
                        </label>
                      )
                    })
                  )}
                </div>
              </div>

              {/* Preview */}
              {previewCourse && previewSubject && (
                <div className="preview-box">
                  <CheckCircle2 size={14} color="#0F6E56"/>
                  <span>
                    <strong>{teacher.firstName}</strong> enseñará <strong>{previewSubject.subject.name}</strong> en{' '}
                    <strong>{GRADES[previewCourse.grade]} &quot;{previewCourse.parallel}&quot; {SHIFTS[previewCourse.shift]}</strong>
                  </span>
                </div>
              )}
            </div>
            <div className="mfoot">
              <button className="btn-outline" onClick={() => setShowModal(false)}>Cancelar</button>
              <button className="btn-primary" onClick={handleAssign} disabled={saving || !selectedCourse || !selectedSubject}>
                {saving ? <span className="spinsm"/> : <Save size={14}/>}
                {saving ? 'Guardando...' : 'Asignar'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .center{display:flex;justify-content:center;align-items:center;padding:48px;color:#6B8BB0;flex-direction:column;gap:12px}
        .page-header{display:flex;align-items:flex-start;gap:16px;margin-bottom:20px;flex-wrap:wrap}
        .page-header h1{font-size:20px;font-weight:700;color:#1A3A7C;margin:0 0 4px}
        .sub{font-size:13px;color:#6B8BB0;margin:0}
        .back-btn{display:flex;align-items:center;gap:6px;background:none;border:none;cursor:pointer;color:#6B8BB0;font-size:13px;padding:6px 0;white-space:nowrap}
        .back-btn:hover{color:#1A3A7C}
        .btn-primary{display:flex;align-items:center;gap:6px;padding:9px 16px;background:#1A3A7C;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:500;cursor:pointer;white-space:nowrap}
        .btn-primary:hover:not(:disabled){background:#4A9FD4}
        .btn-primary:disabled{opacity:.6;cursor:not-allowed}
        .btn-outline{display:flex;align-items:center;gap:6px;padding:9px 14px;background:#fff;color:#1A3A7C;border:1.5px solid #CBE0F0;border-radius:8px;font-size:13px;cursor:pointer}
        .btn-outline:hover{background:#F0F6FC}
        .alert{padding:10px 14px;border-radius:8px;font-size:13px;margin-bottom:14px}
        .alert.ok{background:#E1F5EE;border:1px solid #9FE1CB;color:#0F6E56}
        .alert.err{background:#FFF0F0;border:1px solid #FFBBBB;color:#C0392B}
        .info-card{background:#fff;border:1px solid #CBE0F0;border-radius:12px;padding:16px 20px;margin-bottom:20px;display:flex;flex-wrap:wrap;gap:10px 24px}
        .info-row{display:flex;align-items:center;gap:6px;font-size:13px}
        .info-icon{color:#4A9FD4;flex-shrink:0}
        .info-label{color:#6B8BB0;font-weight:500}
        .info-val{color:#1A3A7C}
        .hrs-badge{background:#FFFBEA;color:#BA7517;border:1px solid #F5C518;padding:2px 8px;border-radius:20px;font-size:11px;font-weight:500}
        .section-title{display:flex;align-items:center;gap:8px;font-size:14px;font-weight:700;color:#1A3A7C;margin-bottom:12px;text-transform:uppercase;letter-spacing:.5px}
        .empty-state{text-align:center;padding:48px;color:#6B8BB0;display:flex;flex-direction:column;align-items:center;gap:12px;background:#fff;border:1px dashed #CBE0F0;border-radius:12px}
        .course-card{background:#fff;border:1px solid #CBE0F0;border-radius:12px;overflow:hidden;margin-bottom:12px}
        .course-header{display:flex;align-items:center;justify-content:space-between;padding:12px 16px;background:#F0F6FC;border-bottom:1px solid #CBE0F0}
        .course-title-row{display:flex;align-items:center;gap:8px;font-weight:700;color:#1A3A7C;font-size:14px}
        .course-badge{padding:2px 8px;border-radius:20px;font-size:11px;font-weight:500;background:#E0ECF8;color:#1A3A7C}
        .course-badge.level{background:#E1F5EE;color:#0F6E56}
        .course-badge.bth{background:#FFFBEA;color:#BA7517}
        .course-count{font-size:12px;color:#6B8BB0}
        .subject-list{display:flex;flex-direction:column}
        .subject-row{display:flex;align-items:center;justify-content:space-between;padding:10px 16px;border-top:1px solid #F0F6FC}
        .subject-row:hover{background:#FAFCFF}
        .subject-info{display:flex;align-items:center;gap:10px}
        .campo-dot{padding:2px 8px;border-radius:20px;font-size:11px;font-weight:500;white-space:nowrap}
        .subject-name{font-size:13px;color:#1A3A7C;font-weight:500}
        .btn-remove{width:28px;height:28px;border:none;border-radius:6px;background:#FFF0F0;color:#C0392B;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0}
        .btn-remove:hover:not(:disabled){opacity:.75}
        .btn-remove:disabled{opacity:.5;cursor:not-allowed}
        .overlay{position:fixed;inset:0;background:rgba(0,0,0,0.4);z-index:500;display:flex;align-items:center;justify-content:center;padding:16px}
        .modal{background:#fff;border-radius:14px;width:100%;max-width:460px;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,0.15);max-height:90vh;display:flex;flex-direction:column}
        .mhead{display:flex;align-items:flex-start;justify-content:space-between;padding:18px 20px;border-bottom:1px solid #CBE0F0;gap:12px;flex-shrink:0}
        .mhead h2{font-size:16px;font-weight:600;color:#1A3A7C;margin:0}
        .mhead-sub{font-size:12px;color:#6B8BB0;margin:2px 0 0}
        .mhead button{background:none;border:none;cursor:pointer;color:#6B8BB0;display:flex;padding:4px;border-radius:6px;flex-shrink:0}
        .mhead button:hover{background:#F0F6FC;color:#1A3A7C}
        .mbody{padding:20px;display:flex;flex-direction:column;gap:14px;overflow-y:auto;flex:1}
        .mfoot{display:flex;justify-content:flex-end;gap:10px;padding:16px 20px;border-top:1px solid #CBE0F0;flex-shrink:0}
        .fg{display:flex;flex-direction:column;gap:6px}
        .fg label{font-size:11px;font-weight:600;color:#1A3A7C;text-transform:uppercase;letter-spacing:.5px}
        .search-wrap{position:relative}
        .s-icon{position:absolute;left:10px;top:50%;transform:translateY(-50%);color:#4A9FD4;pointer-events:none}
        .search-wrap input{padding:8px 10px 8px 30px;border:1.5px solid #CBE0F0;border-radius:8px;font-size:13px;color:#1A3A7C;outline:none;width:100%}
        .search-wrap input:focus{border-color:#4A9FD4;box-shadow:0 0 0 3px rgba(74,159,212,.12)}
        .search-wrap input:disabled{opacity:.5;cursor:not-allowed;background:#F8FBFF}
        .option-list{border:1.5px solid #CBE0F0;border-radius:8px;max-height:160px;overflow-y:auto}
        .option-list.disabled{opacity:.5;pointer-events:none}
        .option-item{display:flex;align-items:center;gap:8px;padding:7px 10px;cursor:pointer;border-bottom:1px solid #F0F6FC;transition:background .12s}
        .option-item:last-child{border-bottom:none}
        .option-item:hover{background:#F8FBFF}
        .option-item.selected{background:#E8F0FB;border-left:3px solid #1A3A7C}
        .option-item input{accent-color:#1A3A7C;cursor:pointer;flex-shrink:0;width:14px;height:14px}
        .option-info{flex:1;display:flex;flex-direction:column;gap:2px}
        .option-name{font-size:12px;font-weight:500;color:#1A3A7C}
        .option-sub{font-size:11px;color:#6B8BB0}
        .option-tag{font-size:10px;font-weight:500;padding:1px 7px;border-radius:20px;width:fit-content}
        .no-options{padding:12px;text-align:center;font-size:12px;color:#6B8BB0;font-style:italic}
        .preview-box{display:flex;align-items:flex-start;gap:8px;background:#E1F5EE;border:1px solid #9FE1CB;border-radius:8px;padding:10px 14px;font-size:13px;color:#0F6E56;line-height:1.5}
        .warn-box{background:#FFFBEA;border:1px solid #F5C518;border-radius:8px;padding:10px 14px;font-size:13px;color:#BA7517;line-height:1.5}
        .spinner{width:24px;height:24px;border:2px solid rgba(26,58,124,.2);border-top-color:#1A3A7C;border-radius:50%;animation:spin .7s linear infinite}
        .spinsm{width:12px;height:12px;border:2px solid rgba(255,255,255,.3);border-top-color:currentColor;border-radius:50%;animation:spin .7s linear infinite;display:inline-block}
        @keyframes spin{to{transform:rotate(360deg)}}
        @media(max-width:600px){.page-header{flex-direction:column}.info-card{flex-direction:column}}
      `}</style>
    </div>
  )
}