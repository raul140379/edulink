'use client'

import { useEffect, useState } from 'react'
import { BookOpen, Users, Clock, CheckCircle, AlertCircle } from 'lucide-react'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

interface PlanItem {
  gradeConfigId: number
  subjectId:     number
  subject:       { id: number; name: string; code?: string; campo?: string }
  hoursPerWeek:  number
  teacher:       { id: number; firstName: string; lastName: string } | null
  assignmentId:  number | null
}

interface CoursePlan {
  course:        { id: number; grade: string; parallel: string; level: string }
  totalHours:    number
  totalSubjects: number
  assignedCount: number
  pendingCount:  number
  grouped:       Record<string, PlanItem[]>
  campoOrder:    string[]
}

const GRADES: Record<string, string> = {
  PRIMERO: '1°', SEGUNDO: '2°', TERCERO: '3°',
  CUARTO: '4°', QUINTO: '5°', SEXTO: '6°',
}
const LEVELS: Record<string, string> = {
  INICIAL: 'Inicial', PRIMARIA: 'Primaria', SECUNDARIA: 'Secundaria',
}
const CAMPO_LABELS: Record<string, string> = {
  VIDA_TIERRA_TERRITORIO:        '🌿 Vida, Tierra y Territorio',
  COMUNIDAD_SOCIEDAD:            '🌐 Comunidad y Sociedad',
  COSMOS_PENSAMIENTO:            '✨ Cosmos y Pensamiento',
  CIENCIA_TECNOLOGIA_PRODUCCION: '⚙️ Ciencia, Tecnología y Producción',
  SIN_CAMPO:                     '📌 Sin campo asignado',
}
const CAMPO_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  VIDA_TIERRA_TERRITORIO:        { bg: '#E8F5F0', text: '#0F6E56', border: '#9FE1CB' },
  COMUNIDAD_SOCIEDAD:            { bg: '#E0ECF8', text: '#1A3A7C', border: '#A8C4E8' },
  COSMOS_PENSAMIENTO:            { bg: '#F3E8FF', text: '#6B21A8', border: '#C4A8E8' },
  CIENCIA_TECNOLOGIA_PRODUCCION: { bg: '#FFF3E0', text: '#1565C0', border: '#F5C518' },
  SIN_CAMPO:                     { bg: '#F5F5F5', text: '#444441', border: '#CCCCCC' },
}

export default function TeacherTutorWorkloadPage() {
  const [plan,    setPlan]    = useState<CoursePlan | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : ''

  useEffect(() => {
    const init = async () => {
      setLoading(true)
      try {
        // Obtener curso del maestro tutor
        const cRes  = await fetch(`${API_URL}/api/teachers/my-course`, {
          headers: { Authorization: `Bearer ${token}` }
        })
        const cData = await cRes.json()
        if (!cRes.ok) { setError(cData.message || 'No se encontró el curso'); return }

        // Obtener plan de estudios del curso
        const pRes  = await fetch(`${API_URL}/api/subjects/plan/${cData.id}`, {
          headers: { Authorization: `Bearer ${token}` }
        })
        const pData = await pRes.json()
        if (!pRes.ok) { setError(pData.message || 'Error al cargar el plan'); return }
        setPlan(pData)
      } catch { setError('Error de conexión') }
      finally  { setLoading(false) }
    }
    init()
  }, [])

  if (loading) return <div className="center"><div className="spinner"/></div>
  if (error)   return <div className="center"><p className="err-msg">{error}</p></div>
  if (!plan)   return null

  const camposOrden = [...plan.campoOrder, 'SIN_CAMPO'].filter(c => plan.grouped[c]?.length > 0)

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Plan de Estudios del Curso</h1>
          <p>
            {LEVELS[plan.course.level]} — {GRADES[plan.course.grade]} &quot;{plan.course.parallel}&quot; · Vista de materias y maestros
          </p>
        </div>
        <div className="coming-badge">🗓 Horario próximamente</div>
      </div>

      {/* Stats */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon blue"><BookOpen size={20}/></div>
          <div>
            <div className="stat-num">{plan.totalSubjects}</div>
            <div className="stat-lbl">Total materias</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon green"><CheckCircle size={20}/></div>
          <div>
            <div className="stat-num" style={{color:'#0F6E56'}}>{plan.assignedCount}</div>
            <div className="stat-lbl">Con maestro</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon red"><AlertCircle size={20}/></div>
          <div>
            <div className="stat-num" style={{color: plan.pendingCount > 0 ? '#C0392B' : '#0F6E56'}}>{plan.pendingCount}</div>
            <div className="stat-lbl">Sin maestro</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon blue"><Clock size={20}/></div>
          <div>
            <div className="stat-num">{plan.totalHours}</div>
            <div className="stat-lbl">Hrs / mes</div>
          </div>
        </div>
      </div>

      {/* Estado general */}
      {plan.pendingCount === 0 ? (
        <div className="alert-ok"><CheckCircle size={14}/> Todas las materias tienen maestro asignado ✓</div>
      ) : (
        <div className="alert-warn"><AlertCircle size={14}/> {plan.pendingCount} {plan.pendingCount === 1 ? 'materia sin' : 'materias sin'} maestro asignado</div>
      )}

      {/* Plan agrupado por campo */}
      {camposOrden.map(campo => {
        const items = plan.grouped[campo] || []
        const col   = CAMPO_COLORS[campo] || CAMPO_COLORS['SIN_CAMPO']
        const hrs   = items.reduce((s, i) => s + i.hoursPerWeek, 0)

        return (
          <div key={campo} className="section-card">
            {/* Cabecera del campo */}
            <div className="campo-header" style={{background: col.bg, borderColor: col.border}}>
              <span style={{fontSize:'15px'}}>{CAMPO_LABELS[campo]?.split(' ')[0]}</span>
              <span style={{fontWeight:700, color: col.text, fontSize:'12px', textTransform:'uppercase', letterSpacing:'.5px'}}>
                {CAMPO_LABELS[campo]?.substring(2)}
              </span>
              <div style={{marginLeft:'auto', display:'flex', gap:'12px', alignItems:'center'}}>
                <span style={{fontSize:'12px', color: col.text, fontWeight:500}}>{hrs} hrs/mes</span>
                <span style={{fontSize:'12px', color: col.text, fontWeight:500}}>{items.length} {items.length === 1 ? 'materia' : 'materias'}</span>
              </div>
            </div>

            {/* Tabla de materias */}
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Materia</th>
                  <th style={{textAlign:'center'}}>Hrs/Mes</th>
                  <th>Maestro asignado</th>
                  <th style={{textAlign:'center'}}>Horario</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, i) => (
                  <tr key={item.subjectId}>
                    <td className="muted">{i + 1}</td>
                    <td style={{fontWeight:500}}>{item.subject.name}</td>
                    <td style={{textAlign:'center'}}>
                      <span className="hrs-badge">{item.hoursPerWeek}</span>
                    </td>
                    <td>
                      {item.teacher ? (
                        <span className="teacher-cell">
                          <CheckCircle size={13} color="#0F6E56"/>
                          {item.teacher.lastName} {item.teacher.firstName}
                        </span>
                      ) : (
                        <span className="no-teacher">
                          <AlertCircle size={13}/>
                          Sin maestro asignado
                        </span>
                      )}
                    </td>
                    <td style={{textAlign:'center'}}>
                      <span className="schedule-badge">🗓 Próximamente</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      })}

      <style>{`
        .center{display:flex;justify-content:center;align-items:center;padding:48px;flex-direction:column;gap:12px;color:#6B8BB0}
        .err-msg{color:#C0392B;font-size:14px}
        .page-header{display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:24px;gap:16px;flex-wrap:wrap}
        .page-header h1{font-size:20px;font-weight:700;color:#0F6E56;margin-bottom:4px}
        .page-header p{font-size:13px;color:#6B8BB0}
        .coming-badge{background:#FFFBEA;color:#BA7517;border:1px solid #F5C518;padding:6px 14px;border-radius:20px;font-size:12px;font-weight:600;white-space:nowrap;height:fit-content}
        .stats-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin-bottom:16px}
        .stat-card{background:#fff;border:1px solid #CBE0F0;border-radius:12px;padding:16px;display:flex;align-items:center;gap:12px}
        .stat-icon{width:40px;height:40px;border-radius:10px;display:flex;align-items:center;justify-content:center;flex-shrink:0}
        .stat-icon.blue{background:#E0ECF8;color:#1A3A7C}
        .stat-icon.green{background:#E1F5EE;color:#0F6E56}
        .stat-icon.red{background:#FFF0F0;color:#C0392B}
        .stat-num{font-size:22px;font-weight:700;color:#1A3A7C}
        .stat-lbl{font-size:11px;color:#6B8BB0}
        .alert-ok{display:flex;align-items:center;gap:8px;padding:10px 14px;background:#E1F5EE;border:1px solid #9FE1CB;border-radius:8px;font-size:13px;color:#0F6E56;margin-bottom:16px}
        .alert-warn{display:flex;align-items:center;gap:8px;padding:10px 14px;background:#FFFBEA;border:1px solid #F5C518;border-radius:8px;font-size:13px;color:#7A6000;margin-bottom:16px}
        .section-card{background:#fff;border:1px solid #CBE0F0;border-radius:12px;overflow:hidden;margin-bottom:16px}
        .campo-header{display:flex;align-items:center;gap:10px;padding:10px 16px;border-bottom:1px solid #F0F6FC;border-left:4px solid}
        table{width:100%;border-collapse:collapse}
        thead tr{background:#F8FBFF}
        th{padding:10px 14px;text-align:left;font-size:11px;font-weight:600;color:#1A3A7C;text-transform:uppercase;letter-spacing:.5px;white-space:nowrap}
        td{padding:12px 14px;font-size:13px;color:#1A3A7C;border-top:1px solid #F0F6FC}
        tr:hover td{background:#FAFCFF}
        .muted{color:#6B8BB0;font-size:12px}
        .hrs-badge{background:#E0ECF8;color:#1A3A7C;border-radius:20px;padding:3px 10px;font-size:12px;font-weight:600}
        .teacher-cell{display:flex;align-items:center;gap:6px;color:#1A3A7C;font-weight:500}
        .no-teacher{display:flex;align-items:center;gap:6px;color:#BA7517;font-size:12px;font-style:italic}
        .schedule-badge{background:#FFFBEA;color:#BA7517;border:1px solid #F5C518;border-radius:20px;padding:2px 10px;font-size:11px;font-weight:500;white-space:nowrap}
        .spinner{width:24px;height:24px;border:2px solid rgba(15,110,86,.2);border-top-color:#0F6E56;border-radius:50%;animation:spin .7s linear infinite}
        @keyframes spin{to{transform:rotate(360deg)}}
        @media(max-width:600px){.stats-grid{grid-template-columns:1fr 1fr}th:last-child,td:last-child{display:none}}
      `}</style>
    </div>
  )
}