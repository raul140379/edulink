'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Users, BookOpen, Clock, GraduationCap, CheckCircle2, AlertCircle, Trash2, Plus, RefreshCw, Copy, Check, X, Search } from 'lucide-react'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

interface Teacher {
  id: number; firstName: string; lastName: string
  tutorUserId?: number
  tutorUser?:   { email: string; isActive: boolean }
}

interface Course {
  id: number; level: string; grade: string; parallel: string
  educationType: string; shift: string
  _count: { assignments: number }
  tutor?: { teacher: Teacher }
}

interface PlanItem {
  gradeConfigId: number
  subjectId:     number
  subject:       { id: number; name: string; code: string; campo: string | null }
  hoursPerWeek:  number
  teacher:       { id: number; firstName: string; lastName: string } | null
  assignmentId:  number | null
}

interface CoursePlan {
  course:        { id: number; grade: string; parallel: string; level: string; educationType: string }
  totalHours:    number
  totalSubjects: number
  assignedCount: number
  pendingCount:  number
  grouped:       Record<string, PlanItem[]>
  campoOrder:    string[]
}

interface Assignment {
  id: number; year: number
  student: { id: number; firstName: string; lastName: string; ci?: string; rude?: string }
}

interface Credentials {
  accessEmail:     string
  defaultPassword: string
  name:            string
}

interface Subject {
  id: number; name: string; code?: string; campo?: string
}

const LEVELS = { INICIAL:'Inicial', PRIMARIA:'Primaria', SECUNDARIA:'Secundaria' } as Record<string,string>
const GRADES = { PRIMERO:'1°', SEGUNDO:'2°', TERCERO:'3°', CUARTO:'4°', QUINTO:'5°', SEXTO:'6°' } as Record<string,string>
const SHIFTS = { MORNING:'Mañana', AFTERNOON:'Tarde', NIGHT:'Noche' } as Record<string,string>

const CAMPO_LABELS: Record<string,string> = {
  VIDA_TIERRA_TERRITORIO:        'Vida, Tierra y Territorio',
  COMUNIDAD_SOCIEDAD:            'Comunidad y Sociedad',
  COSMOS_PENSAMIENTO:            'Cosmos y Pensamiento',
  CIENCIA_TECNOLOGIA_PRODUCCION: 'Ciencia, Tecnología y Producción',
  SIN_CAMPO:                     'Sin campo asignado',
}
const CAMPO_COLORS: Record<string,{bg:string;text:string;border:string}> = {
  VIDA_TIERRA_TERRITORIO:        { bg:'#E8F5F0', text:'#0F6E56', border:'#9FE1CB' },
  COMUNIDAD_SOCIEDAD:            { bg:'#E0ECF8', text:'#1A3A7C', border:'#A8C4E8' },
  COSMOS_PENSAMIENTO:            { bg:'#F3E8FF', text:'#6B21A8', border:'#C4A8E8' },
  CIENCIA_TECNOLOGIA_PRODUCCION: { bg:'#FFF3E0', text:'#633806', border:'#F5C518' },
  SIN_CAMPO:                     { bg:'#F5F5F5', text:'#444441', border:'#CCCCCC' },
}
const CAMPO_ICONS: Record<string,string> = {
  VIDA_TIERRA_TERRITORIO:        '🌿',
  COMUNIDAD_SOCIEDAD:            '🌐',
  COSMOS_PENSAMIENTO:            '✨',
  CIENCIA_TECNOLOGIA_PRODUCCION: '⚙️',
  SIN_CAMPO:                     '📌',
}
const shiftColor: Record<string,string> = { MORNING:'#1A3A7C', AFTERNOON:'#633806', NIGHT:'#3C3489' }
const levelColor: Record<string,string> = { INICIAL:'#0F6E56', PRIMARIA:'#1A3A7C', SECUNDARIA:'#712B13' }

export default function CourseDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id     = params.id as string

  const [course,         setCourse]         = useState<Course | null>(null)
  const [plan,           setPlan]           = useState<CoursePlan | null>(null)
  const [assignments,    setAssignments]    = useState<Assignment[]>([])
  const [periodsSummary, setPeriodsSummary] = useState<Record<number,number>>({})
  const [schoolSch,      setSchoolSch]      = useState<any>(null)
  const [loading,        setLoading]        = useState(true)
  const [removing,       setRemoving]       = useState<number | null>(null)
  const [removingPlan,   setRemovingPlan]   = useState<number | null>(null)
  const [working,        setWorking]        = useState(false)
  const [creds,          setCreds]          = useState<Credentials | null>(null)
  const [copied,         setCopied]         = useState(false)
  const [success,        setSuccess]        = useState('')
  const [error,          setError]          = useState('')

  const [showAddSubject,  setShowAddSubject]  = useState(false)
  const [allSubjects,     setAllSubjects]     = useState<Subject[]>([])
  const [subjectSearch,   setSubjectSearch]   = useState('')
  const [selectedSubject, setSelectedSubject] = useState<number | null>(null)
  const [hoursPerWeek,    setHoursPerWeek]    = useState('4')
  const [addingSubject,   setAddingSubject]   = useState(false)

  const token    = typeof window !== 'undefined' ? localStorage.getItem('token') : ''
  const userRole = typeof window !== 'undefined'
    ? JSON.parse(localStorage.getItem('user') || '{}').role
    : ''
  const isDirector = userRole === 'DIRECTOR' || userRole === 'SUPER_ADMIN'

  const notify = (msg: string, type: 'ok' | 'err' = 'ok') => {
    if (type === 'ok') { setSuccess(msg); setTimeout(() => setSuccess(''), 3000) }
    else               { setError(msg);   setTimeout(() => setError(''),   4000) }
  }

  const fetchData = async () => {
    setLoading(true)
    try {
      const [cRes, aRes, pRes] = await Promise.all([
        fetch(`${API_URL}/api/courses/${id}`,          { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_URL}/api/courses/${id}/students`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_URL}/api/subjects/plan/${id}`,    { headers: { Authorization: `Bearer ${token}` } }),
      ])
      const [cData, aData, pData] = await Promise.all([cRes.json(), aRes.json(), pRes.json()])
      if (cRes.ok) {
        setCourse(cData)
        fetchSchoolSchedule(cData.shift)
        fetchPeriodsSummary()
      }
      if (aRes.ok) setAssignments(aData)
      if (pRes.ok) setPlan(pData)
    } catch (e) { console.error(e) }
    finally     { setLoading(false) }
  }

  const fetchPeriodsSummary = async () => {
    try {
      const res  = await fetch(`${API_URL}/api/schedules/course/${id}/periods-summary`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await res.json()
      if (res.ok) setPeriodsSummary(data.summary || {})
    } catch { console.error('Error al obtener resumen de periodos') }
  }

  const fetchSchoolSchedule = async (shift: string) => {
    try {
      const res  = await fetch(`${API_URL}/api/schedules/school-schedules`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await res.json()
      if (res.ok) {
        const active = data.find((s: any) => s.isActive && s.shift === shift)
        setSchoolSch(active || null)
      }
    } catch { console.error('Error al obtener horario institucional') }
  }

  const fetchAllSubjects = async () => {
    try {
      const res  = await fetch(`${API_URL}/api/subjects`, { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      if (res.ok) setAllSubjects(data)
    } catch { console.error('Error al cargar materias') }
  }

  useEffect(() => { fetchData() }, [id])

  const handleRemoveAssignment = async (assignmentId: number) => {
    if (!confirm('¿Quitar este maestro de la materia?')) return
    setRemoving(assignmentId)
    try {
      const res = await fetch(`${API_URL}/api/subjects/assign/${assignmentId}`, {
        method: 'DELETE', headers: { Authorization: `Bearer ${token}` }
      })
      if (res.ok) { notify('Maestro quitado correctamente'); fetchData() }
    } catch { console.error('Error al quitar asignación') }
    finally  { setRemoving(null) }
  }

  const handleRemoveFromPlan = async (gradeConfigId: number, subjectName: string) => {
    if (!confirm(`¿Eliminar "${subjectName}" del plan de estudios? Esto también quitará al maestro asignado.`)) return
    setRemovingPlan(gradeConfigId)
    try {
      const res  = await fetch(`${API_URL}/api/subjects/grade-config/${gradeConfigId}`, {
        method: 'DELETE', headers: { Authorization: `Bearer ${token}` }
      })
      const data = await res.json()
      if (res.ok) { notify(data.message); fetchData() }
      else notify(data.message, 'err')
    } catch { notify('Error de conexión', 'err') }
    finally  { setRemovingPlan(null) }
  }

  const handleAddSubjectToPlan = async () => {
    if (!selectedSubject || !plan) return
    setAddingSubject(true)
    try {
      const res  = await fetch(`${API_URL}/api/subjects/grade-config`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body:    JSON.stringify({
          subjectId:     selectedSubject,
          grade:         plan.course.grade,
          educationType: plan.course.educationType,
          hoursPerWeek:  parseInt(hoursPerWeek) || 4,
        }),
      })
      const data = await res.json()
      if (!res.ok) { notify(data.message, 'err'); return }
      notify(data.message)
      setShowAddSubject(false)
      setSelectedSubject(null)
      setHoursPerWeek('4')
      fetchData()
    } catch { notify('Error de conexión', 'err') }
    finally  { setAddingSubject(false) }
  }

  const handleCreateTutorUser = async () => {
    setWorking(true)
    try {
      const res  = await fetch(`${API_URL}/api/courses/${id}/tutor-user`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}` }
      })
      const data = await res.json()
      if (!res.ok) { notify(data.message, 'err'); return }
      setCreds({ accessEmail: data.accessEmail, defaultPassword: data.defaultPassword, name: data.tutorName })
      fetchData()
    } catch { notify('Error de conexión', 'err') }
    finally  { setWorking(false) }
  }

  const handleResetTutorPassword = async () => {
    if (!confirm('¿Resetear la contraseña del maestro tutor?')) return
    setWorking(true)
    try {
      const res  = await fetch(`${API_URL}/api/courses/${id}/tutor-user/reset`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}` }
      })
      const data = await res.json()
      if (!res.ok) { notify(data.message, 'err'); return }
      setCreds({
        accessEmail:     course?.tutor?.teacher.tutorUser?.email || '',
        defaultPassword: data.defaultPassword,
        name:            data.tutorName,
      })
    } catch { notify('Error de conexión', 'err') }
    finally  { setWorking(false) }
  }

  const copyCreds = () => {
    if (!creds) return
    navigator.clipboard.writeText(`Nombre: ${creds.name}\nEmail: ${creds.accessEmail}\nContraseña: ${creds.defaultPassword}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // ── Cálculos de periodos ──
  const getDuracionEfectiva = () => {
    if (!schoolSch) return 0
    const cantidadRecreos  = schoolSch.breakAfter ? schoolSch.breakAfter.split(',').filter(Boolean).length : 0
    const totalMinReceso   = cantidadRecreos * schoolSch.breakDuration
    const minExtra         = schoolSch.periods > 0 ? totalMinReceso / schoolSch.periods : 0
    return schoolSch.periodDuration + minExtra
  }

  const calcPeriodosPlan = (hoursPerMonth: number) => {
    if (!schoolSch || !hoursPerMonth) return null
    return Math.floor((hoursPerMonth / 4 * 60) / getDuracionEfectiva())
  }

  const totalPeriodosAsignados = Object.values(periodsSummary).reduce((a, b) => a + b, 0)
  const totalPeriodosPlan      = plan && schoolSch
    ? Math.floor((plan.totalHours / 4 * 60) / getDuracionEfectiva())
    : 0

  if (loading) return <div className="center"><div className="spinner"/></div>
  if (!course)  return <div className="center"><p>Curso no encontrado</p></div>

  const camposOrden = plan
    ? [...plan.campoOrder, 'SIN_CAMPO'].filter(c => plan.grouped[c]?.length > 0)
    : []

  const hasTutor     = !!course.tutor
  const hasTutorUser = !!course.tutor?.teacher.tutorUserId
  const hayHorario   = Object.keys(periodsSummary).length > 0

  const planSubjectIds = plan
    ? Object.values(plan.grouped).flat().map(i => i.subjectId)
    : []

  const availableSubjects = allSubjects.filter(s =>
    !planSubjectIds.includes(s.id) &&
    (subjectSearch === '' || s.name.toLowerCase().includes(subjectSearch.toLowerCase()))
  )

  return (
    <div>
      {/* Cabecera */}
      <div className="page-header">
        <button className="back-btn" onClick={() => router.back()}>
          <ArrowLeft size={16}/> Volver
        </button>
        <div className="course-title">
          <span className="level-pill" style={{ background: levelColor[course.level]+'18', color: levelColor[course.level] }}>
            {LEVELS[course.level]}
          </span>
          <h1>{GRADES[course.grade]} {course.parallel}</h1>
          <div className="course-meta">
            <span className="meta-badge" style={{ background: shiftColor[course.shift]+'18', color: shiftColor[course.shift] }}>
              <Clock size={12}/> {SHIFTS[course.shift]}
            </span>
            {course.educationType === 'BTH' && (
              <span className="meta-badge bth"><GraduationCap size={12}/> BTH</span>
            )}
          </div>
        </div>
      </div>

      {success && <div className="alert ok">{success}</div>}
      {error   && <div className="alert err">{error}</div>}

      {/* Stats */}
      <div className="stats-row">
        <div className="stat-card">
          <Users size={20} color="#1A3A7C"/>
          <div><div className="stat-num">{course._count.assignments}</div><div className="stat-lbl">Estudiantes inscritos</div></div>
        </div>
        {plan && (
          <>
            <div className="stat-card">
              <BookOpen size={20} color="#4A9FD4"/>
              <div><div className="stat-num">{plan.totalSubjects}</div><div className="stat-lbl">Materias del grado</div></div>
            </div>
            <div className="stat-card">
              <Clock size={20} color="#0F6E56"/>
              <div><div className="stat-num">{plan.totalHours}</div><div className="stat-lbl">Horas / Mes (plan)</div></div>
            </div>
            <div className="stat-card">
              <CheckCircle2 size={20} color={plan.pendingCount === 0 ? '#0F6E56' : '#BA7517'}/>
              <div>
                <div className="stat-num" style={{color: plan.pendingCount === 0 ? '#0F6E56' : '#BA7517'}}>
                  {plan.assignedCount}/{plan.totalSubjects}
                </div>
                <div className="stat-lbl">Con maestro asignado</div>
              </div>
            </div>
            {hayHorario && schoolSch && (
              <div className="stat-card">
                <Clock size={20} color={totalPeriodosAsignados >= totalPeriodosPlan ? '#0F6E56' : '#BA7517'}/>
                <div>
                  <div className="stat-num" style={{color: totalPeriodosAsignados >= totalPeriodosPlan ? '#0F6E56' : '#BA7517'}}>
                    {totalPeriodosAsignados} / {totalPeriodosPlan}
                  </div>
                  <div className="stat-lbl">Periodos ejecutados / plan</div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Maestro Tutor */}
      <div className="section-card">
        <div className="section-title"><GraduationCap size={15}/> Maestro Tutor</div>
        <div style={{padding:'16px 18px'}}>
          {hasTutor ? (
            <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:'16px',flexWrap:'wrap'}}>
              <div>
                <div style={{fontWeight:600,color:'#1A3A7C',fontSize:'14px'}}>
                  {course.tutor!.teacher.lastName} {course.tutor!.teacher.firstName}
                </div>
                {hasTutorUser ? (
                  <div style={{marginTop:'4px'}}>
                    <span style={{fontSize:'11px',color:'#0F6E56'}}>✅ Usuario tutor activo</span>
                    <div style={{fontSize:'11px',color:'#6B8BB0',fontFamily:'monospace'}}>{course.tutor!.teacher.tutorUser?.email}</div>
                  </div>
                ) : (
                  <span style={{fontSize:'11px',color:'#C0392B'}}>❌ Sin usuario tutor</span>
                )}
              </div>
              <div style={{display:'flex',gap:'8px',flexWrap:'wrap'}}>
                <button className="btn-outline-sm" onClick={() => router.push(`/dashboard/admin/cursos/${id}/asignar-tutor`)}>Cambiar tutor</button>
                {isDirector && !hasTutorUser && (
                  <button className="btn-primary-sm" onClick={handleCreateTutorUser} disabled={working}>
                    {working ? <span className="spinsm"/> : <Plus size={12}/>} Crear usuario
                  </button>
                )}
                {isDirector && hasTutorUser && (
                  <button className="btn-outline-sm" onClick={handleResetTutorPassword} disabled={working}>
                    {working ? <span className="spinsm"/> : <RefreshCw size={12}/>} Resetear password
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
              <span style={{fontSize:'13px',color:'#6B8BB0',fontStyle:'italic'}}>Sin maestro tutor asignado</span>
              <button className="btn-primary-sm" onClick={() => router.push(`/dashboard/admin/cursos/${id}/asignar-tutor`)}>+ Asignar tutor</button>
            </div>
          )}
        </div>
      </div>

      {/* Plan de Estudios */}
      <div className="section-card">
        <div className="section-title" style={{justifyContent:'space-between'}}>
          <span style={{display:'flex',alignItems:'center',gap:'8px'}}>
            <BookOpen size={15}/> Plan de Estudios · {GRADES[course.grade]} {course.parallel}
            {plan && <span style={{fontSize:'12px',fontWeight:400,color:'#6B8BB0'}}>{plan.totalHours} hrs/mes</span>}
          </span>
          <div style={{display:'flex',gap:'8px'}}>
            <button className="btn-outline-sm" onClick={() => { setShowAddSubject(true); fetchAllSubjects(); setSubjectSearch(''); setSelectedSubject(null); setHoursPerWeek('4') }}>
              <Plus size={12}/> Agregar materia
            </button>
            <button className="btn-primary-sm" onClick={() => router.push(`/dashboard/admin/cursos/${id}/asignar-materia`)}>
              + Asignar maestro
            </button>
          </div>
        </div>

        {!plan ? (
          <div className="empty-state"><p>No hay plan de estudios configurado para este grado</p></div>
        ) : (
          <div style={{padding:'12px 16px',display:'flex',flexDirection:'column',gap:'16px'}}>
            {plan.pendingCount > 0 ? (
              <div className="alert-warn"><AlertCircle size={14}/>{plan.pendingCount} {plan.pendingCount === 1 ? 'materia sin' : 'materias sin'} maestro asignado</div>
            ) : (
              <div className="alert-ok"><CheckCircle2 size={14}/>Todas las materias tienen maestro asignado ✓</div>
            )}

            {!hayHorario && (
              <div style={{display:'flex',alignItems:'center',gap:8,padding:'8px 12px',background:'#FFFBEA',border:'1px solid #F5C518',borderRadius:8,fontSize:12,color:'#7A6000'}}>
                ⚠️ Este curso aún no tiene horario publicado — los periodos asignados aparecerán una vez publicado.
              </div>
            )}

            {camposOrden.map(campo => {
              const items      = plan.grouped[campo] || []
              const col        = CAMPO_COLORS[campo] || CAMPO_COLORS['SIN_CAMPO']
              const icon       = CAMPO_ICONS[campo]  || '📌'
              const label      = CAMPO_LABELS[campo] || campo
              const horasCampo = items.reduce((s, i) => s + i.hoursPerWeek, 0)

              return (
                <div key={campo}>
                  <div className="campo-header" style={{background:col.bg,borderColor:col.border}}>
                    <span style={{fontSize:'14px'}}>{icon}</span>
                    <span style={{fontWeight:700,color:col.text,fontSize:'12px',textTransform:'uppercase',letterSpacing:'.5px'}}>{label}</span>
                    <span style={{marginLeft:'auto',fontSize:'12px',color:col.text,fontWeight:500}}>
                      {horasCampo} hrs/mes · {items.length} {items.length === 1 ? 'materia' : 'materias'}
                    </span>
                  </div>
                  <table style={{width:'100%',borderCollapse:'collapse'}}>
                    <thead>
                      <tr style={{background:'#F8FBFF'}}>
                        <th className="th">Materia</th>
                        <th className="th">Código</th>
                        <th className="th" style={{textAlign:'center'}}>Hrs/Mes</th>
                        <th className="th" style={{textAlign:'center'}}>Per. Plan</th>
                        <th className="th" style={{textAlign:'center'}}>Per. Asignados</th>
                        <th className="th">Maestro</th>
                        <th className="th" style={{width:'80px',textAlign:'center'}}>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map(item => {
                        const periodosPlan      = calcPeriodosPlan(item.hoursPerWeek)
                        const periodosAsignados = periodsSummary[item.subjectId] || 0
                        const cumplido          = periodosPlan !== null && periodosAsignados >= periodosPlan
                        const parcial           = periodosPlan !== null && periodosAsignados > 0 && periodosAsignados < periodosPlan

                        return (
                          <tr key={item.subjectId} style={{borderTop:'1px solid #F0F6FC'}}>
                            <td className="td" style={{fontWeight:500}}>{item.subject.name}</td>
                            <td className="td muted">{item.subject.code || '—'}</td>
                            <td className="td" style={{textAlign:'center'}}>
                              <span className="hrs-badge">{item.hoursPerWeek}</span>
                            </td>
                            <td className="td" style={{textAlign:'center'}}>
                              {periodosPlan !== null ? (
                                <span style={{background:'#E0ECF8',color:'#1A3A7C',borderRadius:20,padding:'2px 10px',fontSize:12,fontWeight:600}}>
                                  {periodosPlan}P
                                </span>
                              ) : <span className="muted">—</span>}
                            </td>
                            <td className="td" style={{textAlign:'center'}}>
                              {hayHorario ? (
                                <span style={{
                                  background: cumplido?'#E1F5EE':parcial?'#FFFBEA':'#FFF0F0',
                                  color:      cumplido?'#0F6E56':parcial?'#7A6000':'#C0392B',
                                  borderRadius:20, padding:'2px 10px', fontSize:12, fontWeight:600,
                                }}>
                                  {periodosAsignados}P {cumplido?'✅':parcial?'⚠️':'❌'}
                                </span>
                              ) : <span className="muted">—</span>}
                            </td>
                            <td className="td">
                              {item.teacher ? (
                                <span style={{display:'flex',alignItems:'center',gap:'6px'}}>
                                  <CheckCircle2 size={13} color="#0F6E56"/>
                                  <span style={{color:'#1A3A7C'}}>{item.teacher.lastName} {item.teacher.firstName}</span>
                                </span>
                              ) : (
                                <span style={{display:'flex',alignItems:'center',gap:'6px',color:'#BA7517'}}>
                                  <AlertCircle size={13}/>
                                  <span style={{fontSize:'12px',fontStyle:'italic'}}>Sin maestro</span>
                                </span>
                              )}
                            </td>
                            <td className="td" style={{textAlign:'center'}}>
                              <div style={{display:'flex',gap:'6px',justifyContent:'center'}}>
                                {item.assignmentId && (
                                  <button className="icon-btn-sm" title="Quitar maestro"
                                    style={{background:'#FFFBEA',color:'#BA7517',border:'1px solid #F5C518'}}
                                    disabled={removing === item.assignmentId}
                                    onClick={() => handleRemoveAssignment(item.assignmentId!)}>
                                    <Trash2 size={11}/>
                                  </button>
                                )}
                                <button className="icon-btn-sm" title="Eliminar materia del plan"
                                  style={{background:'#FFF0F0',color:'#C0392B',border:'1px solid #FFBBBB'}}
                                  disabled={removingPlan === item.gradeConfigId}
                                  onClick={() => handleRemoveFromPlan(item.gradeConfigId, item.subject.name)}>
                                  <X size={11}/>
                                </button>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Estudiantes inscritos */}
      <div className="section-card">
        <div className="section-title"><Users size={15}/> Estudiantes inscritos ({assignments.length})</div>
        {assignments.length === 0 ? (
          <div className="empty-state"><Users size={32} color="#CBE0F0"/><p>No hay estudiantes inscritos en este curso</p></div>
        ) : (
          <table>
            <thead>
              <tr>
                <th className="th">#</th><th className="th">Nombre completo</th>
                <th className="th">CI</th><th className="th">RUDE</th>
              </tr>
            </thead>
            <tbody>
              {assignments.map((a, i) => (
                <tr key={a.id} style={{borderTop:'1px solid #F0F6FC'}}>
                  <td className="td muted">{i + 1}</td>
                  <td className="td"><strong>{a.student.lastName} {a.student.firstName}</strong></td>
                  <td className="td muted">{a.student.ci   || '—'}</td>
                  <td className="td muted">{a.student.rude || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal agregar materia al plan */}
      {showAddSubject && (
        <div className="overlay" onClick={() => setShowAddSubject(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="mhead">
              <div>
                <h2>Agregar materia al plan</h2>
                <p style={{fontSize:'12px',color:'#6B8BB0',margin:'2px 0 0'}}>
                  {GRADES[course.grade]} {course.parallel} · {LEVELS[course.level]}
                </p>
              </div>
              <button onClick={() => setShowAddSubject(false)}><X size={18}/></button>
            </div>
            <div className="mbody">
              <div className="info-box">
                📋 La materia se agregará al plan del grado <strong>{GRADES[course.grade]}</strong> y estará disponible en todos los cursos de ese grado.
              </div>
              <div className="fg">
                <label>Buscar materia</label>
                <div className="search-wrap">
                  <Search size={13} className="s-icon"/>
                  <input type="text" placeholder="Buscar por nombre..." value={subjectSearch}
                    onChange={e => setSubjectSearch(e.target.value)}/>
                </div>
              </div>
              <div className="fg">
                <label>Seleccionar materia *</label>
                <div className="subject-list">
                  {availableSubjects.length === 0 ? (
                    <div style={{padding:'16px',textAlign:'center',fontSize:'13px',color:'#6B8BB0',fontStyle:'italic'}}>
                      {subjectSearch ? 'No se encontraron materias' : 'Todas las materias ya están en el plan'}
                    </div>
                  ) : (
                    availableSubjects.map(s => (
                      <label key={s.id} className={`subject-option ${selectedSubject === s.id ? 'selected' : ''}`}>
                        <input type="radio" name="subject" value={s.id}
                          checked={selectedSubject === s.id}
                          onChange={() => setSelectedSubject(s.id)}/>
                        <div style={{flex:1}}>
                          <div style={{fontSize:'13px',fontWeight:'500',color:'#1A3A7C'}}>{s.name}</div>
                          {s.campo && (
                            <div style={{fontSize:'11px',color:'#6B8BB0',marginTop:'2px'}}>
                              {CAMPO_LABELS[s.campo] || s.campo}
                            </div>
                          )}
                        </div>
                      </label>
                    ))
                  )}
                </div>
              </div>
              <div className="fg">
                <label>Horas por mes *</label>
                <input type="number" min={1} max={200} value={hoursPerWeek}
                  onChange={e => setHoursPerWeek(e.target.value)}
                  placeholder="Ej: 16"/>
              </div>
            </div>
            <div className="mfoot">
              <button className="btn-outline-sm" onClick={() => setShowAddSubject(false)}>Cancelar</button>
              <button className="btn-primary-sm" onClick={handleAddSubjectToPlan}
                disabled={addingSubject || !selectedSubject}>
                {addingSubject ? <span className="spinsm"/> : <Plus size={13}/>}
                {addingSubject ? 'Agregando...' : 'Agregar al plan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal credenciales tutor */}
      {creds && (
        <div className="overlay" onClick={() => setCreds(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="mhead">
              <h2>✅ Credenciales de acceso</h2>
              <button onClick={() => setCreds(null)}><X size={18}/></button>
            </div>
            <div className="mbody">
              <div className="info-box"><strong>{creds.name}</strong></div>
              <div className="cred-row"><span className="cred-label">Email:</span><span className="cred-value">{creds.accessEmail}</span></div>
              <div className="cred-row"><span className="cred-label">Contraseña:</span><span className="cred-value">{creds.defaultPassword}</span></div>
              <div className="cred-note">⚠️ Anota estas credenciales. El maestro puede cambiar su contraseña desde su perfil.</div>
            </div>
            <div className="mfoot">
              <button className="btn-outline-sm" onClick={copyCreds}>
                {copied ? <Check size={14}/> : <Copy size={14}/>} {copied ? 'Copiado' : 'Copiar'}
              </button>
              <button className="btn-primary-sm" onClick={() => setCreds(null)}>Entendido</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .center{display:flex;justify-content:center;align-items:center;padding:48px;flex-direction:column;gap:12px;color:#6B8BB0}
        .page-header{display:flex;flex-direction:column;gap:12px;margin-bottom:24px}
        .back-btn{display:flex;align-items:center;gap:6px;background:none;border:none;cursor:pointer;color:#6B8BB0;font-size:13px;padding:0;width:fit-content}
        .back-btn:hover{color:#1A3A7C}
        .course-title{display:flex;align-items:center;gap:12px;flex-wrap:wrap}
        .course-title h1{font-size:28px;font-weight:800;color:#1A3A7C;margin:0}
        .level-pill{padding:4px 12px;border-radius:20px;font-size:12px;font-weight:600}
        .course-meta{display:flex;gap:8px}
        .meta-badge{display:flex;align-items:center;gap:4px;padding:4px 10px;border-radius:20px;font-size:12px;font-weight:500}
        .meta-badge.bth{background:#FFF3CC;color:#7A6000}
        .alert{padding:10px 14px;border-radius:8px;font-size:13px;margin-bottom:14px}
        .alert.ok{background:#E1F5EE;border:1px solid #9FE1CB;color:#0F6E56}
        .alert.err{background:#FFF0F0;border:1px solid #FFBBBB;color:#C0392B}
        .stats-row{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin-bottom:20px}
        .stat-card{background:#fff;border:1px solid #CBE0F0;border-radius:10px;padding:16px;display:flex;align-items:center;gap:12px}
        .stat-num{font-size:22px;font-weight:700;color:#1A3A7C}
        .stat-lbl{font-size:12px;color:#6B8BB0}
        .section-card{background:#fff;border:1px solid #CBE0F0;border-radius:12px;overflow:hidden;margin-bottom:16px}
        .section-title{display:flex;align-items:center;gap:8px;padding:14px 18px;border-bottom:1px solid #F0F6FC;font-size:13px;font-weight:600;color:#1A3A7C}
        .campo-header{display:flex;align-items:center;gap:8px;padding:8px 12px;border-radius:8px;border:1px solid;margin-bottom:4px}
        .th{padding:9px 14px;text-align:left;font-size:11px;font-weight:600;color:#1A3A7C;text-transform:uppercase;letter-spacing:.5px;white-space:nowrap}
        .td{padding:11px 14px;font-size:13px;color:#1A3A7C}
        .muted{color:#6B8BB0}
        .hrs-badge{background:#E0ECF8;color:#1A3A7C;border-radius:20px;padding:2px 10px;font-size:12px;font-weight:600}
        .alert-warn{display:flex;align-items:center;gap:8px;padding:10px 14px;background:#FFFBEA;border:1px solid #F5C518;border-radius:8px;font-size:13px;color:#7A6000}
        .alert-ok{display:flex;align-items:center;gap:8px;padding:10px 14px;background:#E1F5EE;border:1px solid #9FE1CB;border-radius:8px;font-size:13px;color:#0F6E56}
        .empty-state{display:flex;flex-direction:column;align-items:center;padding:40px;gap:10px;color:#6B8BB0;font-size:13px}
        .spinner{width:24px;height:24px;border:2px solid rgba(26,58,124,.2);border-top-color:#1A3A7C;border-radius:50%;animation:spin .7s linear infinite}
        .spinsm{width:12px;height:12px;border:2px solid rgba(255,255,255,.3);border-top-color:currentColor;border-radius:50%;animation:spin .7s linear infinite;display:inline-block}
        @keyframes spin{to{transform:rotate(360deg)}}
        .btn-primary-sm{display:flex;align-items:center;gap:5px;padding:6px 14px;background:#1A3A7C;color:#fff;border:none;border-radius:6px;font-size:12px;cursor:pointer;white-space:nowrap}
        .btn-primary-sm:hover:not(:disabled){background:#4A9FD4}
        .btn-primary-sm:disabled{opacity:.6;cursor:not-allowed}
        .btn-outline-sm{display:flex;align-items:center;gap:5px;padding:6px 14px;background:#fff;color:#1A3A7C;border:1.5px solid #CBE0F0;border-radius:6px;font-size:12px;cursor:pointer;white-space:nowrap}
        .btn-outline-sm:hover:not(:disabled){background:#F0F6FC}
        .btn-outline-sm:disabled{opacity:.6;cursor:not-allowed}
        .icon-btn-sm{width:24px;height:24px;border:none;border-radius:5px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:opacity .2s}
        .icon-btn-sm:hover:not(:disabled){opacity:.75}
        .icon-btn-sm:disabled{opacity:.4;cursor:not-allowed}
        .overlay{position:fixed;inset:0;background:rgba(0,0,0,0.4);z-index:500;display:flex;align-items:center;justify-content:center;padding:16px}
        .modal{background:#fff;border-radius:14px;width:100%;max-width:460px;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,0.15);max-height:90vh;display:flex;flex-direction:column}
        .mhead{display:flex;align-items:flex-start;justify-content:space-between;padding:18px 20px;border-bottom:1px solid #CBE0F0;flex-shrink:0;gap:12px}
        .mhead h2{font-size:16px;font-weight:600;color:#1A3A7C;margin:0}
        .mhead button{background:none;border:none;cursor:pointer;color:#6B8BB0;display:flex;padding:4px;border-radius:6px;flex-shrink:0}
        .mhead button:hover{background:#F0F6FC}
        .mbody{padding:20px;display:flex;flex-direction:column;gap:14px;overflow-y:auto;flex:1}
        .mfoot{display:flex;justify-content:flex-end;gap:10px;padding:16px 20px;border-top:1px solid #CBE0F0;flex-shrink:0}
        .fg{display:flex;flex-direction:column;gap:5px}
        .fg label{font-size:11px;font-weight:600;color:#1A3A7C;text-transform:uppercase;letter-spacing:.5px}
        .fg input{padding:9px 12px;border:1.5px solid #CBE0F0;border-radius:8px;font-size:13px;color:#1A3A7C;outline:none;width:100%}
        .fg input:focus{border-color:#4A9FD4;box-shadow:0 0 0 3px rgba(74,159,212,.12)}
        .info-box{background:#F0F6FC;border:1px solid #CBE0F0;border-radius:8px;padding:12px;font-size:12px;color:#6B8BB0;line-height:1.6}
        .search-wrap{position:relative}
        .s-icon{position:absolute;left:10px;top:50%;transform:translateY(-50%);color:#4A9FD4;pointer-events:none}
        .search-wrap input{padding-left:32px!important}
        .subject-list{border:1.5px solid #CBE0F0;border-radius:8px;max-height:180px;overflow-y:auto}
        .subject-option{display:flex;align-items:center;gap:8px;padding:5px 10px;cursor:pointer;border-bottom:1px solid #F0F6FC}
        .subject-option:last-child{border-bottom:none}
        .subject-option:hover{background:#F8FBFF}
        .subject-option.selected{background:#E8F0FB;border-left:3px solid #1A3A7C}
        .subject-option input{accent-color:#1A3A7C;cursor:pointer;flex-shrink:0;width:14px;height:14px}
        .cred-row{display:flex;align-items:center;gap:10px;background:#F0F6FC;border:1px solid #CBE0F0;border-radius:8px;padding:10px 14px}
        .cred-label{font-size:12px;font-weight:600;color:#6B8BB0;min-width:80px;text-transform:uppercase;letter-spacing:.5px}
        .cred-value{font-size:13px;font-weight:600;color:#1A3A7C;font-family:monospace;word-break:break-all}
        .cred-note{font-size:12px;color:#BA7517;background:#FFFBEA;border:1px solid #F5C518;border-radius:8px;padding:10px;line-height:1.5}
      `}</style>
    </div>
  )
}