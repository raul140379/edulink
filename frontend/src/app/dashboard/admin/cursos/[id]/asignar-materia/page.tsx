'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, BookOpen, CheckCircle2, AlertCircle, Save, X, Plus } from 'lucide-react'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

// ── Tipos ─────────────────────────────────────────────────────────────────
interface PlanItem {
  subjectId:    number
  subject:      { id: number; name: string; code: string; campo: string | null }
  hoursPerWeek: number
  teacher:      { id: number; firstName: string; lastName: string } | null
  assignmentId: number | null
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
interface Teacher {
  id: number; firstName: string; lastName: string
}
interface Subject {
  id: number; name: string; code?: string; campo?: string; level: string
}

// ── Constantes ────────────────────────────────────────────────────────────
const GRADES = { PRIMERO:'1°', SEGUNDO:'2°', TERCERO:'3°', CUARTO:'4°', QUINTO:'5°', SEXTO:'6°' } as Record<string,string>
const LEVELS = { INICIAL:'Inicial', PRIMARIA:'Primaria', SECUNDARIA:'Secundaria' } as Record<string,string>
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

export default function AsignarMateriaPage() {
  const params = useParams()
  const router = useRouter()
  const id     = params.id as string

  const [plan,      setPlan]      = useState<CoursePlan | null>(null)
  const [teachersBySubject, setTeachersBySubject] = useState<Record<number, Teacher[]>>({})
  const [loadingTeachers, setLoadingTeachers]     = useState<Record<number, boolean>>({})
  const [loading,   setLoading]   = useState(true)
  const [saving,    setSaving]    = useState<number | null>(null)
  const [selections, setSelections] = useState<Record<number, string>>({})
  const [success,   setSuccess]   = useState('')
  const [error,     setError]     = useState('')
  const [courseInfo, setCourseInfo] = useState<{level:string;grade:string;parallel:string;shift:string;educationType?:string} | null>(null)

  // Agregar materia al plan
  const [showAddPlan,  setShowAddPlan]  = useState(false)
  const [allSubjects,  setAllSubjects]  = useState<Subject[]>([])
  const [planForm,     setPlanForm]     = useState({ subjectId: '', hoursPerWeek: '4' })
  const [savingPlan,   setSavingPlan]   = useState(false)

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : ''

  const notify = (msg: string, type: 'ok' | 'err' = 'ok') => {
    if (type === 'ok') { setSuccess(msg); setTimeout(() => setSuccess(''), 3000) }
    else               { setError(msg);   setTimeout(() => setError(''),   4000) }
  }

  const fetchData = async () => {
    setLoading(true)
    try {
      const [cRes, pRes] = await Promise.all([
        fetch(`${API_URL}/api/courses/${id}`,       { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_URL}/api/subjects/plan/${id}`, { headers: { Authorization: `Bearer ${token}` } }),
      ])
      const [cData, pData] = await Promise.all([cRes.json(), pRes.json()])
      if (cRes.ok) setCourseInfo(cData)
      if (pRes.ok) setPlan(pData)
    } catch { notify('Error de conexión', 'err') }
    finally  { setLoading(false) }
  }

  const loadTeachersForSubject = async (subjectId: number, campo: string | null) => {
    if (teachersBySubject[subjectId] !== undefined) return
    setLoadingTeachers(prev => ({...prev, [subjectId]: true}))
    try {
      let res  = await fetch(`${API_URL}/api/teachers?subjectId=${subjectId}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      let data = await res.json()
      if (res.ok && Array.isArray(data) && data.length === 0 && campo) {
        res  = await fetch(`${API_URL}/api/teachers?campo=${campo}`, {
          headers: { Authorization: `Bearer ${token}` }
        })
        data = await res.json()
      }
      setTeachersBySubject(prev => ({...prev, [subjectId]: res.ok ? data : []}))
    } catch {
      setTeachersBySubject(prev => ({...prev, [subjectId]: []}))
    } finally {
      setLoadingTeachers(prev => ({...prev, [subjectId]: false}))
    }
  }

  const fetchAllSubjects = async () => {
    try {
      const res  = await fetch(`${API_URL}/api/subjects?level=SECUNDARIA`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await res.json()
      if (res.ok) setAllSubjects(data)
    } catch { console.error('Error cargando materias') }
  }

  useEffect(() => { fetchData() }, [id])

  useEffect(() => {
    if (!plan) return
    const pre: Record<number, string> = {}
    for (const items of Object.values(plan.grouped)) {
      for (const item of items) {
        if (item.teacher) pre[item.subjectId] = String(item.teacher.id)
      }
    }
    setSelections(pre)
  }, [plan])

  const handleAssign = async (subjectId: number) => {
    const teacherId = selections[subjectId]
    if (!teacherId) { notify('Selecciona un maestro', 'err'); return }
    setSaving(subjectId)
    try {
      const res  = await fetch(`${API_URL}/api/subjects/assign`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ subjectId, teacherId: parseInt(teacherId), courseId: parseInt(id) }),
      })
      const data = await res.json()
      if (!res.ok) { notify(data.message, 'err'); return }
      notify(data.message)
      fetchData()
    } catch { notify('Error de conexión', 'err') }
    finally  { setSaving(null) }
  }

  const handleAddToPlan = async () => {
    if (!planForm.subjectId) { notify('Selecciona una materia', 'err'); return }
    setSavingPlan(true)
    try {
      const res  = await fetch(`${API_URL}/api/subjects/grade-config`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          subjectId:     parseInt(planForm.subjectId),
          grade:         courseInfo!.grade,
          educationType: courseInfo!.educationType ?? 'REGULAR',
          hoursPerWeek:  parseInt(planForm.hoursPerWeek) || 4,
        }),
      })
      const data = await res.json()
      if (!res.ok) { notify(data.message, 'err'); return }
      notify(data.message)
      setShowAddPlan(false)
      setPlanForm({ subjectId: '', hoursPerWeek: '4' })
      fetchData()
    } catch { notify('Error de conexión', 'err') }
    finally  { setSavingPlan(false) }
  }

  const handleRemove = async (assignmentId: number, subjectId: number) => {
    if (!confirm('¿Quitar el maestro de esta materia?')) return
    setSaving(subjectId)
    try {
      const res = await fetch(`${API_URL}/api/subjects/assign/${assignmentId}`, {
        method: 'DELETE', headers: { Authorization: `Bearer ${token}` }
      })
      const data = await res.json()
      if (res.ok) {
        notify(data.message)
        setSelections(prev => { const n = {...prev}; delete n[subjectId]; return n })
        fetchData()
      } else notify(data.message, 'err')
    } catch { notify('Error al quitar', 'err') }
    finally  { setSaving(null) }
  }

  if (loading) return <div className="center"><div className="spinner"/></div>
  if (!plan || !courseInfo) return <div className="center"><p>No se pudo cargar el plan</p></div>

  const camposOrden = [...plan.campoOrder, 'SIN_CAMPO'].filter(c => plan.grouped[c]?.length > 0)

  return (
    <div>
      {/* Cabecera */}
      <div className="page-header">
        <button className="back-btn" onClick={() => router.back()}>
          <ArrowLeft size={16}/> Volver
        </button>
        <div style={{flex:1}}>
          <h1>Asignar Maestros · {GRADES[courseInfo.grade]} {courseInfo.parallel}</h1>
          <p className="sub">{LEVELS[courseInfo.level]} · {SHIFTS[courseInfo.shift]}</p>
        </div>
        <button className="btn-add-plan" onClick={() => { setShowAddPlan(true); fetchAllSubjects() }}>
          <Plus size={14}/> Agregar materia al plan
        </button>
      </div>

      {success && <div className="alert ok">{success}</div>}
      {error   && <div className="alert err">{error}</div>}

      {/* Stats */}
      <div className="stats-row">
        <div className="stat-card">
          <BookOpen size={18} color="#4A9FD4"/>
          <div><div className="sn">{plan.totalSubjects}</div><div className="sl">Materias del grado</div></div>
        </div>
        <div className="stat-card">
          <CheckCircle2 size={18} color="#0F6E56"/>
          <div><div className="sn" style={{color:'#0F6E56'}}>{plan.assignedCount}</div><div className="sl">Con maestro</div></div>
        </div>
        <div className="stat-card">
          <AlertCircle size={18} color={plan.pendingCount > 0 ? '#BA7517' : '#0F6E56'}/>
          <div>
            <div className="sn" style={{color: plan.pendingCount > 0 ? '#BA7517' : '#0F6E56'}}>{plan.pendingCount}</div>
            <div className="sl">Sin maestro</div>
          </div>
        </div>
        <div className="stat-card">
          <div style={{fontWeight:700,fontSize:18,color:'#1A3A7C'}}>{plan.totalHours}</div>
          <div className="sl">Hrs/semana</div>
        </div>
      </div>

      {/* Plan agrupado por Campo de Saber */}
      {camposOrden.map(campo => {
        const items  = plan.grouped[campo] || []
        const col    = CAMPO_COLORS[campo] || CAMPO_COLORS['SIN_CAMPO']
        const icon   = CAMPO_ICONS[campo]  || '📌'
        const label  = CAMPO_LABELS[campo] || campo
        const horas  = items.reduce((s, i) => s + i.hoursPerWeek, 0)

        return (
          <div key={campo} className="section-card">
            <div className="campo-header" style={{background:col.bg, borderBottom:`2px solid ${col.border}`}}>
              <span style={{fontSize:'16px'}}>{icon}</span>
              <span style={{fontWeight:700,color:col.text,fontSize:'13px',textTransform:'uppercase',letterSpacing:'.5px'}}>
                {label}
              </span>
              <span style={{marginLeft:'auto',fontSize:'12px',color:col.text,fontWeight:500}}>
                {horas} hrs/sem · {items.length} {items.length === 1 ? 'materia' : 'materias'}
              </span>
            </div>

            <table>
              <thead>
                <tr>
                  <th>Materia</th>
                  <th style={{textAlign:'center',width:'70px'}}>Hrs/sem</th>
                  <th>Maestro asignado / Seleccionar</th>
                  <th style={{width:'110px'}}></th>
                </tr>
              </thead>
              <tbody>
                {items.map(item => {
                  const isSaving   = saving === item.subjectId
                  const selected   = selections[item.subjectId] || ''
                  const hasTeacher = !!item.teacher

                  return (
                    <tr key={item.subjectId} className={hasTeacher ? 'row-ok' : 'row-pend'}>
                      <td>
                        <div style={{fontWeight:500,color:'#1A3A7C'}}>{item.subject.name}</div>
                        {item.subject.code && <div style={{fontSize:'11px',color:'#6B8BB0'}}>{item.subject.code}</div>}
                      </td>
                      <td style={{textAlign:'center'}}>
                        <span className="hrs-badge">{item.hoursPerWeek}</span>
                      </td>
                      <td>
                        <select
                          value={selected}
                          onFocus={() => loadTeachersForSubject(item.subjectId, item.subject.campo)}
                          onChange={e => setSelections(prev => ({...prev, [item.subjectId]: e.target.value}))}
                          className={`sel ${hasTeacher ? 'sel-ok' : 'sel-pend'}`}
                          disabled={isSaving}
                        >
                          <option value="">
                            {loadingTeachers[item.subjectId] ? 'Cargando maestros...' : '— Seleccionar maestro —'}
                          </option>
                          {(teachersBySubject[item.subjectId] || []).length === 0 &&
                           !loadingTeachers[item.subjectId] &&
                           teachersBySubject[item.subjectId] !== undefined && (
                            <option disabled value="">Sin maestros con esta especialidad</option>
                          )}
                          {(teachersBySubject[item.subjectId] || []).map(t => (
                            <option key={t.id} value={t.id}>{t.lastName} {t.firstName}</option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <div style={{display:'flex',gap:'6px',justifyContent:'flex-end'}}>
                          <button
                            className="btn-save"
                            onClick={() => handleAssign(item.subjectId)}
                            disabled={isSaving || !selected}
                            title={hasTeacher ? 'Cambiar maestro' : 'Asignar maestro'}
                          >
                            {isSaving ? <span className="spinsm"/> : <Save size={12}/>}
                            {hasTeacher ? 'Cambiar' : 'Asignar'}
                          </button>
                          {hasTeacher && item.assignmentId && (
                            <button
                              className="btn-del"
                              onClick={() => handleRemove(item.assignmentId!, item.subjectId)}
                              disabled={isSaving}
                              title="Quitar maestro"
                            >✕</button>
                          )}
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

      {/* ── Modal agregar materia al plan ─────────────────────────────────── */}
      {showAddPlan && courseInfo && (
        <div className="overlay" onClick={() => setShowAddPlan(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="mhead">
              <div>
                <h2>Agregar materia al plan</h2>
                <p style={{fontSize:'12px',color:'#6B8BB0',margin:'2px 0 0'}}>
                  {GRADES[courseInfo.grade]} · {courseInfo.educationType ?? 'REGULAR'}
                </p>
              </div>
              <button onClick={() => setShowAddPlan(false)}><X size={18}/></button>
            </div>
            <div className="mbody">
              <div className="fg">
                <label>Materia *</label>
                <select
                  value={planForm.subjectId}
                  onChange={e => setPlanForm({...planForm, subjectId: e.target.value})}
                  className="sel"
                >
                  <option value="">— Seleccionar materia —</option>
                  {allSubjects.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name}{s.campo ? ` · ${CAMPO_LABELS[s.campo] || s.campo}` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div className="fg">
                <label>Horas por semana *</label>
                <input
                  type="number" min={1} max={40}
                  value={planForm.hoursPerWeek}
                  onChange={e => setPlanForm({...planForm, hoursPerWeek: e.target.value})}
                  style={{padding:'8px 10px',border:'1.5px solid #CBE0F0',borderRadius:'7px',fontSize:'13px',color:'#1A3A7C',outline:'none'}}
                />
              </div>
            </div>
            <div className="mfoot">
              <button className="btn-cancel" onClick={() => setShowAddPlan(false)}>Cancelar</button>
              <button
                className="btn-save"
                onClick={handleAddToPlan}
                disabled={savingPlan || !planForm.subjectId}
              >
                {savingPlan ? <span className="spinsm"/> : <Plus size={12}/>}
                {savingPlan ? 'Guardando...' : 'Agregar al plan'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .center{display:flex;justify-content:center;align-items:center;padding:48px;color:#6B8BB0}
        .page-header{display:flex;align-items:flex-start;gap:16px;margin-bottom:20px;flex-wrap:wrap}
        .page-header h1{font-size:20px;font-weight:700;color:#1A3A7C;margin:0 0 4px}
        .sub{font-size:13px;color:#6B8BB0;margin:0}
        .back-btn{display:flex;align-items:center;gap:6px;background:none;border:none;cursor:pointer;color:#6B8BB0;font-size:13px;padding:4px 0;white-space:nowrap}
        .back-btn:hover{color:#1A3A7C}
        .btn-add-plan{display:flex;align-items:center;gap:6px;padding:8px 14px;background:#0F6E56;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:500;cursor:pointer;white-space:nowrap}
        .btn-add-plan:hover{background:#0A5240}
        .btn-cancel{display:flex;align-items:center;gap:6px;padding:8px 14px;background:#fff;color:#1A3A7C;border:1.5px solid #CBE0F0;border-radius:7px;font-size:13px;cursor:pointer}
        .btn-cancel:hover{background:#F0F6FC}
        .alert{padding:10px 14px;border-radius:8px;font-size:13px;margin-bottom:14px}
        .alert.ok{background:#E1F5EE;border:1px solid #9FE1CB;color:#0F6E56}
        .alert.err{background:#FFF0F0;border:1px solid #FFBBBB;color:#C0392B}
        .stats-row{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px;margin-bottom:18px}
        .stat-card{background:#fff;border:1px solid #CBE0F0;border-radius:10px;padding:14px;display:flex;align-items:center;gap:10px}
        .sn{font-size:20px;font-weight:700;color:#1A3A7C}
        .sl{font-size:11px;color:#6B8BB0}
        .section-card{background:#fff;border:1px solid #CBE0F0;border-radius:12px;overflow:hidden;margin-bottom:14px}
        .campo-header{display:flex;align-items:center;gap:10px;padding:10px 16px}
        table{width:100%;border-collapse:collapse}
        th{padding:9px 14px;text-align:left;font-size:11px;font-weight:600;color:#1A3A7C;text-transform:uppercase;letter-spacing:.5px;background:#F8FBFF}
        td{padding:10px 14px;font-size:13px;color:#1A3A7C;border-top:1px solid #F0F6FC}
        .row-ok td{background:#FAFFFE}
        .row-pend td{background:#FFFDF8}
        tr:hover td{filter:brightness(.97)}
        .hrs-badge{background:#E0ECF8;color:#1A3A7C;border-radius:20px;padding:2px 10px;font-size:12px;font-weight:600}
        .sel{width:100%;padding:8px 10px;border:1.5px solid #CBE0F0;border-radius:7px;font-size:13px;color:#1A3A7C;outline:none;background:#fff}
        .sel:focus{border-color:#4A9FD4;box-shadow:0 0 0 3px rgba(74,159,212,.12)}
        .sel-ok{border-color:#9FE1CB;background:#FAFFFD}
        .sel-pend{border-color:#F5C518}
        .btn-save{display:flex;align-items:center;gap:5px;padding:7px 12px;background:#1A3A7C;color:#fff;border:none;border-radius:6px;font-size:12px;cursor:pointer;white-space:nowrap}
        .btn-save:hover:not(:disabled){background:#4A9FD4}
        .btn-save:disabled{opacity:.5;cursor:not-allowed}
        .btn-del{width:28px;height:28px;border:none;border-radius:6px;background:#FFF0F0;color:#C0392B;cursor:pointer;font-size:13px;font-weight:700}
        .btn-del:hover:not(:disabled){background:#FFD5D5}
        .btn-del:disabled{opacity:.5;cursor:not-allowed}
        .overlay{position:fixed;inset:0;background:rgba(0,0,0,0.4);z-index:500;display:flex;align-items:center;justify-content:center;padding:16px}
        .modal{background:#fff;border-radius:14px;width:100%;max-width:420px;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,0.15)}
        .mhead{display:flex;align-items:flex-start;justify-content:space-between;padding:18px 20px;border-bottom:1px solid #CBE0F0;gap:12px}
        .mhead h2{font-size:16px;font-weight:600;color:#1A3A7C;margin:0}
        .mhead button{background:none;border:none;cursor:pointer;color:#6B8BB0;display:flex;padding:4px;border-radius:6px}
        .mhead button:hover{background:#F0F6FC;color:#1A3A7C}
        .mbody{padding:20px;display:flex;flex-direction:column;gap:14px}
        .mfoot{display:flex;justify-content:flex-end;gap:10px;padding:16px 20px;border-top:1px solid #CBE0F0}
        .fg{display:flex;flex-direction:column;gap:5px}
        .fg label{font-size:11px;font-weight:600;color:#1A3A7C;text-transform:uppercase;letter-spacing:.5px}
        .spinner{width:24px;height:24px;border:2px solid rgba(26,58,124,.2);border-top-color:#1A3A7C;border-radius:50%;animation:spin .7s linear infinite}
        .spinsm{width:12px;height:12px;border:2px solid rgba(255,255,255,.3);border-top-color:#fff;border-radius:50%;animation:spin .7s linear infinite;display:inline-block}
        @keyframes spin{to{transform:rotate(360deg)}}
        @media(max-width:600px){.page-header{flex-direction:column}}
      `}</style>
    </div>
  )
}