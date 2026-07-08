'use client'

import { useEffect, useState } from 'react'
import { BookOpen, Clock, CheckCircle, AlertCircle, MessageCircle } from 'lucide-react'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

interface Student {
  id: number; firstName: string; lastName: string; gender?: string
  assignments: {
    course: { id: number; grade: string; parallel: string; level: string; shift: string }
    academicYear: { isActive: boolean; year: number }
  }[]
}

interface PlanItem {
  subjectId:    number
  subject:      { id: number; name: string; campo?: string }
  hoursPerWeek: number
  teacher:      { id: number; firstName: string; lastName: string; phone?: string } | null
}

interface CoursePlan {
  course:     { id: number; grade: string; parallel: string; level: string }
  totalHours: number
  grouped:    Record<string, PlanItem[]>
  campoOrder: string[]
}

interface ParentData {
  id: number; firstName: string; lastName: string
  students: { isTutor: boolean; student: Student }[]
}

const GRADES: Record<string,string> = { PRIMERO:'1°', SEGUNDO:'2°', TERCERO:'3°', CUARTO:'4°', QUINTO:'5°', SEXTO:'6°' }
const SHIFTS: Record<string,string> = { MORNING:'Mañana', AFTERNOON:'Tarde', NIGHT:'Noche' }
const LEVELS: Record<string,string> = { INICIAL:'Inicial', PRIMARIA:'Primaria', SECUNDARIA:'Secundaria' }

const CAMPO_COLORS: Record<string,{bg:string;text:string;border:string}> = {
  VIDA_TIERRA_TERRITORIO:        { bg:'#E8F5F0', text:'#0F6E56', border:'#9FE1CB' },
  COMUNIDAD_SOCIEDAD:            { bg:'#E0ECF8', text:'#1A3A7C', border:'#A8C4E8' },
  COSMOS_PENSAMIENTO:            { bg:'#F3E8FF', text:'#6B21A8', border:'#C4A8E8' },
  CIENCIA_TECNOLOGIA_PRODUCCION: { bg:'#FFF3E0', text:'#633806', border:'#F5C518' },
  SIN_CAMPO:                     { bg:'#F5F5F5', text:'#444',    border:'#CCC'    },
}
const CAMPO_LABELS: Record<string,string> = {
  VIDA_TIERRA_TERRITORIO:        '🌿 Vida, Tierra y Territorio',
  COMUNIDAD_SOCIEDAD:            '🌐 Comunidad y Sociedad',
  COSMOS_PENSAMIENTO:            '✨ Cosmos y Pensamiento',
  CIENCIA_TECNOLOGIA_PRODUCCION: '⚙️ Ciencia, Tecnología y Producción',
  SIN_CAMPO:                     '📌 Sin campo asignado',
}

const buildWaUrl = (phone: string, msg: string) => {
  const clean = phone.replace(/\D/g, '')
  const num   = clean.startsWith('591') ? clean : `591${clean}`
  return `https://wa.me/${num}?text=${encodeURIComponent(msg)}`
}

export default function ParentMaestrosPage() {
  const [parent,      setParent]      = useState<ParentData | null>(null)
  const [selStudentId,setSelStudentId]= useState<number | null>(null)
  const [plan,        setPlan]        = useState<CoursePlan | null>(null)
  const [loading,     setLoading]     = useState(true)
  const [loadingPlan, setLoadingPlan] = useState(false)
  const [error,       setError]       = useState('')
  const [parentName,  setParentName]  = useState('')

  useEffect(() => {
    const init = async () => {
      const token = localStorage.getItem('token')
      if (!token) { setError('No autenticado'); setLoading(false); return }
      setLoading(true)
      try {
        const res  = await fetch(`${API_URL}/api/parents/me`, { headers: { Authorization: `Bearer ${token}` } })
        const data = await res.json()
        if (res.ok) {
          setParent(data)
          setParentName(`${data.lastName} ${data.firstName}`)
          const students = data.students.filter((ps: any) => ps.isTutor).map((ps: any) => ps.student)
          if (students[0]) setSelStudentId(students[0].id)
        } else { setError(data.message || 'Error al cargar datos') }
      } catch { setError('Error de conexión') }
      finally  { setLoading(false) }
    }
    init()
  }, [])

  useEffect(() => {
    if (!selStudentId || !parent) return
    const student    = parent.students.find(ps => ps.student.id === selStudentId)?.student
    const assignment = student?.assignments?.find(a => a.academicYear?.isActive)
    if (!assignment) return

    const loadPlan = async () => {
      const token = localStorage.getItem('token')
      if (!token) return
      setLoadingPlan(true); setPlan(null)
      try {
        const res  = await fetch(`${API_URL}/api/subjects/plan/${assignment.course.id}`, {
          headers: { Authorization: `Bearer ${token}` }
        })
        const data = await res.json()
        if (res.ok) setPlan(data)
      } catch { console.error('Error al cargar plan') }
      finally  { setLoadingPlan(false) }
    }
    loadPlan()
  }, [selStudentId, parent])

  if (loading) return <div className="center"><div className="spinner"/></div>
  if (error)   return <div className="center"><p style={{color:'#C0392B'}}>{error}</p></div>
  if (!parent) return null

  const myStudents       = parent.students.filter(ps => ps.isTutor).map(ps => ps.student)
  const selStudent       = myStudents.find(s => s.id === selStudentId)
  const activeAssignment = selStudent?.assignments?.find(a => a.academicYear?.isActive)
  const camposOrden      = plan ? [...plan.campoOrder, 'SIN_CAMPO'].filter(c => plan.grouped[c]?.length > 0) : []
  const allItems         = plan ? Object.values(plan.grouped).flat() : []
  const withTeacher      = allItems.filter(i => i.teacher).length
  const withoutTeacher   = allItems.filter(i => !i.teacher).length

  const studentName = selStudent ? `${selStudent.lastName} ${selStudent.firstName}` : ''

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Maestros y Horario</h1>
          <p>Plan de estudios, maestros asignados y contacto</p>
        </div>
      </div>

      {/* Selector de hijo */}
      {myStudents.length > 1 && (
        <div className="student-selector">
          {myStudents.map(s => (
            <button key={s.id} className={`stu-btn ${selStudentId === s.id ? 'active' : ''}`}
              onClick={() => setSelStudentId(s.id)}>
              {s.gender === 'MASCULINO' ? '👦' : '👧'} {s.lastName} {s.firstName}
            </button>
          ))}
        </div>
      )}

      {selStudent && (
        <>
          <div className="stu-info-card">
            <div className="stu-avatar">{selStudent.gender === 'MASCULINO' ? '👦' : '👧'}</div>
            <div>
              <div className="stu-name">{selStudent.lastName} {selStudent.firstName}</div>
              {activeAssignment ? (
                <div className="stu-course">
                  📚 {LEVELS[activeAssignment.course.level]} —{' '}
                  {GRADES[activeAssignment.course.grade]} &quot;{activeAssignment.course.parallel}&quot; ·{' '}
                  {SHIFTS[activeAssignment.course.shift]}
                </div>
              ) : <div className="no-course">Sin curso inscrito en la gestión activa</div>}
            </div>
          </div>

          {!activeAssignment ? null : loadingPlan ? (
            <div className="center"><div className="spinner"/></div>
          ) : !plan ? (
            <div className="empty-state"><BookOpen size={40} color="#CBE0F0"/><p>No hay plan de estudios configurado</p></div>
          ) : (
            <>
              {/* Stats */}
              <div className="stats-grid">
                <div className="stat-card">
                  <div className="stat-icon blue"><BookOpen size={18}/></div>
                  <div><div className="stat-num">{allItems.length}</div><div className="stat-lbl">Materias</div></div>
                </div>
                <div className="stat-card">
                  <div className="stat-icon green"><CheckCircle size={18}/></div>
                  <div><div className="stat-num" style={{color:'#0F6E56'}}>{withTeacher}</div><div className="stat-lbl">Con maestro</div></div>
                </div>
                <div className="stat-card">
                  <div className="stat-icon yellow"><Clock size={18}/></div>
                  <div><div className="stat-num">{plan.totalHours}</div><div className="stat-lbl">Hrs/Mes</div></div>
                </div>
                <div className="stat-card">
                  <div className={`stat-icon ${withoutTeacher > 0 ? 'red' : 'green'}`}><AlertCircle size={18}/></div>
                  <div>
                    <div className="stat-num" style={{color: withoutTeacher > 0 ? '#C0392B' : '#0F6E56'}}>{withoutTeacher}</div>
                    <div className="stat-lbl">Sin maestro</div>
                  </div>
                </div>
              </div>

              {/* Horario próximamente */}
              <div className="coming-card">
                <div className="coming-icon">🗓</div>
                <div>
                  <div className="coming-title">Horario de clases</div>
                  <div className="coming-desc">El módulo de horarios estará disponible próximamente.</div>
                </div>
                <span className="coming-badge">Próximamente</span>
              </div>

              {/* Plan por campo */}
              {camposOrden.map(campo => {
                const items = plan.grouped[campo] || []
                const col   = CAMPO_COLORS[campo] || CAMPO_COLORS['SIN_CAMPO']
                const hrs   = items.reduce((s, i) => s + i.hoursPerWeek, 0)
                return (
                  <div key={campo} className="campo-section">
                    <div className="campo-header" style={{background:col.bg, borderColor:col.border}}>
                      <span style={{fontWeight:700, color:col.text, fontSize:'12px'}}>
                        {CAMPO_LABELS[campo] || campo}
                      </span>
                      <span style={{marginLeft:'auto', fontSize:'12px', color:col.text, fontWeight:500}}>
                        {hrs} hrs/mes · {items.length} {items.length === 1 ? 'materia' : 'materias'}
                      </span>
                    </div>
                    <div className="items-list">
                      {items.map(item => {
                        const waMsg = item.teacher
                          ? `Hola ${item.teacher.firstName}, soy ${parentName}, padre/madre de ${studentName}. Le contacto por la materia de ${item.subject.name}.`
                          : ''
                        return (
                          <div key={item.subjectId} className="plan-item">
                            <div className="plan-item-left">
                              <div className="subject-name">{item.subject.name}</div>
                              <div className="hrs-info">{item.hoursPerWeek} hrs/mes</div>
                            </div>
                            <div className="plan-item-right">
                              {item.teacher ? (
                                <div className="teacher-row">
                                  <div className="teacher-info">
                                    <div className="teacher-avatar">{item.teacher.lastName.charAt(0)}</div>
                                    <div>
                                      <div className="teacher-name">{item.teacher.lastName} {item.teacher.firstName}</div>
                                      <div className="teacher-label">
                                        {item.teacher.phone
                                          ? <span className="has-phone">📱 {item.teacher.phone}</span>
                                          : <span className="no-phone">Sin teléfono</span>
                                        }
                                      </div>
                                    </div>
                                  </div>
                                  {item.teacher.phone && (
                                    <a href={buildWaUrl(item.teacher.phone, waMsg)}
                                      target="_blank" rel="noopener noreferrer"
                                      className="wa-btn" title="Enviar WhatsApp al maestro">
                                      <MessageCircle size={13}/> WhatsApp
                                    </a>
                                  )}
                                </div>
                              ) : (
                                <span className="no-teacher"><AlertCircle size={12}/> Sin maestro</span>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </>
          )}
        </>
      )}

      <style>{`
        .page-header{margin-bottom:24px}
        .page-header h1{font-size:20px;font-weight:700;color:#00838F;margin-bottom:4px}
        .page-header p{font-size:13px;color:#6B8BB0}
        .center{display:flex;justify-content:center;align-items:center;padding:48px;color:#6B8BB0}
        .student-selector{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px}
        .stu-btn{display:flex;align-items:center;gap:6px;padding:8px 16px;border:1.5px solid #CBE0F0;border-radius:8px;background:#fff;color:#1A3A7C;font-size:13px;font-weight:500;cursor:pointer}
        .stu-btn:hover{border-color:#00838F;background:#E0F7FA}
        .stu-btn.active{background:#00838F;color:#fff;border-color:#00838F}
        .stu-info-card{background:#fff;border:1px solid #CBE0F0;border-radius:12px;padding:16px;display:flex;align-items:center;gap:14px;margin-bottom:16px}
        .stu-avatar{font-size:36px;flex-shrink:0}
        .stu-name{font-size:16px;font-weight:700;color:#1A3A7C;margin-bottom:4px}
        .stu-course{font-size:12px;color:#6B8BB0}
        .no-course{font-size:12px;color:#C0392B;font-style:italic}
        .stats-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px}
        .stat-card{background:#fff;border:1px solid #CBE0F0;border-radius:12px;padding:14px;display:flex;align-items:center;gap:10px}
        .stat-icon{padding:8px;border-radius:8px;display:flex}
        .stat-icon.blue{background:#E0ECF8;color:#1A3A7C}
        .stat-icon.green{background:#E1F5EE;color:#0F6E56}
        .stat-icon.yellow{background:#FFFBEA;color:#BA7517}
        .stat-icon.red{background:#FFF0F0;color:#C0392B}
        .stat-num{font-size:22px;font-weight:800;color:#1A3A7C}
        .stat-lbl{font-size:11px;color:#6B8BB0}
        .coming-card{background:#FFFBEA;border:1px solid #F5C518;border-radius:12px;padding:16px;display:flex;align-items:center;gap:14px;margin-bottom:16px}
        .coming-icon{font-size:28px}
        .coming-title{font-size:14px;font-weight:600;color:#7A6000;margin-bottom:2px}
        .coming-desc{font-size:12px;color:#BA7517}
        .coming-badge{margin-left:auto;background:#F5C518;color:#3A2F00;padding:4px 12px;border-radius:20px;font-size:11px;font-weight:600;white-space:nowrap}
        .empty-state{display:flex;flex-direction:column;align-items:center;gap:12px;padding:60px;color:#6B8BB0;font-size:13px;background:#fff;border:1px solid #CBE0F0;border-radius:12px}
        .campo-section{background:#fff;border:1px solid #CBE0F0;border-radius:12px;overflow:hidden;margin-bottom:12px}
        .campo-header{display:flex;align-items:center;gap:10px;padding:10px 16px;border-bottom:1px solid #F0F6FC;border-left:4px solid}
        .items-list{display:flex;flex-direction:column}
        .plan-item{display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-top:1px solid #F0F6FC;gap:16px}
        .plan-item:hover{background:#FAFCFF}
        .plan-item-left{flex:1}
        .subject-name{font-size:13px;font-weight:500;color:#1A3A7C;margin-bottom:2px}
        .hrs-info{font-size:11px;color:#6B8BB0}
        .plan-item-right{flex-shrink:0}
        .teacher-row{display:flex;align-items:center;gap:10px}
        .teacher-info{display:flex;align-items:center;gap:8px}
        .teacher-avatar{width:32px;height:32px;border-radius:50%;background:#1A3A7C;color:#fff;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;flex-shrink:0}
        .teacher-name{font-size:13px;font-weight:500;color:#1A3A7C}
        .teacher-label{font-size:11px;margin-top:1px}
        .has-phone{color:#25D366;font-weight:500}
        .no-phone{color:#6B8BB0;font-style:italic}
        .no-teacher{display:flex;align-items:center;gap:4px;font-size:12px;color:#BA7517;font-style:italic}
        .wa-btn{display:flex;align-items:center;gap:4px;padding:5px 10px;background:#25D366;color:#fff;border-radius:8px;font-size:11px;font-weight:600;text-decoration:none;white-space:nowrap;flex-shrink:0}
        .wa-btn:hover{background:#1DA851}
        .spinner{width:24px;height:24px;border:2px solid rgba(0,131,143,.2);border-top-color:#00838F;border-radius:50%;animation:spin .7s linear infinite}
        @keyframes spin{to{transform:rotate(360deg)}}
        @media(max-width:600px){.stats-grid{grid-template-columns:1fr 1fr}.teacher-row{flex-direction:column;align-items:flex-start}}
      `}</style>
    </div>
  )
}