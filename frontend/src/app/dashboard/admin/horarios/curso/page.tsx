'use client'

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Zap, CheckCircle, Trash2, X, Save, Edit2 } from 'lucide-react'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

interface Course {
  id: number; grade: string; parallel: string; level: string
  shift: string; educationType: string
}

interface TSC {
  id: number
  teacher: { id: number; firstName: string; lastName: string }
  subject:  { id: number; name: string; campo?: string }
  hoursPerMonth: number
  maxPeriodos:   number
}

interface Classroom {
  id:       number
  name:     string
  capacity: number | null
}

interface ScheduleItem {
  id: number; dayOfWeek: number; period: number
  startTime: string; endTime: string; status: string
  classroomId?: number
  classroom?: { id: number; name: string }
  teacherSubjectCourse: {
    id: number
    teacher: { firstName: string; lastName: string }
    subject:  { name: string; campo?: string }
  }
}

const GRADES: Record<string,string> = { PRIMERO:'1°', SEGUNDO:'2°', TERCERO:'3°', CUARTO:'4°', QUINTO:'5°', SEXTO:'6°' }
const SHIFTS: Record<string,string> = { MORNING:'Mañana', AFTERNOON:'Tarde' }
const DAYS = ['', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

const CAMPO_COLOR: Record<string,string> = {
  VIDA_TIERRA_TERRITORIO:        '#0F6E56',
  COMUNIDAD_SOCIEDAD:            '#1A3A7C',
  COSMOS_PENSAMIENTO:            '#633806',
  CIENCIA_TECNOLOGIA_PRODUCCION: '#8B1A7C',
}

const CAMPO_BG: Record<string,string> = {
  VIDA_TIERRA_TERRITORIO:        '#E8F5F0',
  COMUNIDAD_SOCIEDAD:            '#E8EEF8',
  COSMOS_PENSAMIENTO:            '#F5EEE8',
  CIENCIA_TECNOLOGIA_PRODUCCION: '#F5E8F5',
}

const SUBJECT_EMOJI: Record<string, string> = {
  'Matemática':                             '🔢',
  'Lenguas Castellana y Originaria':        '📖',
  'Lengua Extranjera':                      '🌍',
  'Ciencias Sociales':                      '🏛️',
  'Ciencias Naturales: Biología':           '🧬',
  'Física':                                 '⚛️',
  'Química':                                '🧪',
  'Educación Física y Deportes':            '⚽',
  'Educación Musical':                      '🎵',
  'Artes Plásticas y Visuales':             '🎨',
  'Cosmovisiones y Filosofía':              '🌌',
  'Valores, Espiritualidad y Religiones':   '☮️',
  'Psicología':                             '🧠',
  'Técnica Tecnológica General':            '⚙️',
  'Técnica Tecnológica General y Especializada': '🔧',
}

export default function HorarioCursoPage() {
  const router = useRouter()
  const [courses,    setCourses]    = useState<Course[]>([])
  const [selCourse,  setSelCourse]  = useState<Course | null>(null)
  const [schedule,   setSchedule]   = useState<ScheduleItem[]>([])
  const [tscs,       setTscs]       = useState<TSC[]>([])
  const [schoolSch,  setSchoolSch]  = useState<any>(null)
  const [loading,    setLoading]    = useState(false)
  const [generating, setGenerating] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [editMode,   setEditMode]   = useState(false)
  const [toast,      setToast]      = useState<{type:'ok'|'err'|'warn'; text:string} | null>(null)

  const [showModal, setShowModal] = useState(false)
  const [selCell,   setSelCell]   = useState<{day:number; period:number; startTime:string; endTime:string} | null>(null)
  const [selTsc,    setSelTsc]    = useState('')

  const [classrooms,         setClassrooms]         = useState<Classroom[]>([])
  const [showClassroomModal, setShowClassroomModal] = useState(false)
  const [selScheduleId,      setSelScheduleId]      = useState<number | null>(null)
  const [selClassroom,       setSelClassroom]       = useState('')

  const [showBulkClassroomModal, setShowBulkClassroomModal] = useState(false)
  const [bulkClassroom,          setBulkClassroom]          = useState('')

  const token = () => localStorage.getItem('token') || ''
  const auth  = () => ({ Authorization: `Bearer ${token()}` })

  const showToast = (type:'ok'|'err'|'warn', text:string) => {
    setToast({type,text}); setTimeout(()=>setToast(null), 5000)
  }

  useEffect(() => {
    fetch(`${API}/api/courses`, { headers: auth() })
      .then(r=>r.json()).then(d=>{ if(Array.isArray(d)) setCourses(d) })
    fetch(`${API}/api/classrooms`, { headers: auth() })
      .then(r=>r.json()).then(d=>{ if(Array.isArray(d)) setClassrooms(d) })
  }, [])

  useEffect(() => {
    if (!selCourse) return
    setEditMode(false)
    loadSchedule()
    loadTscs()
    loadSchoolSchedule()
  }, [selCourse])

  const loadSchedule = async () => {
    if (!selCourse) return
    setLoading(true)
    try {
      const res  = await fetch(`${API}/api/schedules/course/${selCourse.id}`, { headers: auth() })
      const data = await res.json()
      if (res.ok) setSchedule(data.schedule?.flatMap((d:any) => d.periods) || [])
    } catch { console.error('Error') }
    finally { setLoading(false) }
  }

  const loadTscs = async () => {
    if (!selCourse) return
    const res  = await fetch(`${API}/api/schedules/tscs/${selCourse.id}`, { headers: auth() })
    const data = await res.json()
    if (res.ok) setTscs(data)
  }

  const loadSchoolSchedule = async () => {
    if (!selCourse) return
    const res  = await fetch(`${API}/api/schedules/school-schedules`, { headers: auth() })
    const data = await res.json()
    if (res.ok) {
      const active = data.find((s:any) => s.isActive && s.shift === selCourse.shift)
      setSchoolSch(active || null)
    }
  }

  const calcPeriodos = (ss: any) => {
    if (!ss) return []
    const breakPeriods = ss.breakAfter.split(',').map(Number)
    const [h, m] = ss.startTime.split(':').map(Number)
    let cur = h * 60 + m
    const result: any[] = []
    for (let i = 1; i <= ss.periods; i++) {
      const start = `${String(Math.floor(cur/60)).padStart(2,'0')}:${String(cur%60).padStart(2,'0')}`
      cur += ss.periodDuration
      const end = `${String(Math.floor(cur/60)).padStart(2,'0')}:${String(cur%60).padStart(2,'0')}`
      result.push({ startTime: start, endTime: end })
      if (breakPeriods.includes(i)) cur += ss.breakDuration
    }
    return result
  }

  const getPeriodTime = (period: number) => {
    const periodos = calcPeriodos(schoolSch)
    return periodos[period - 1] || { startTime: '', endTime: '' }
  }

  const getAsignadosPorTsc = (tscId: number) =>
    schedule.filter(s => s.teacherSubjectCourse.id === tscId).length

  const resumenMaterias = tscs.map(t => ({
    ...t,
    asignados: getAsignadosPorTsc(t.id),
    completo:  t.maxPeriodos > 0 && getAsignadosPorTsc(t.id) >= t.maxPeriodos,
  }))

  const handleGenerate = async () => {
    if (!selCourse) return
    setGenerating(true)
    try {
      const res  = await fetch(`${API}/api/schedules/generate/${selCourse.id}`, {
        method: 'POST', headers: auth()
      })
      const data = await res.json()
      if (!res.ok) { showToast('err', data.message); return }
      showToast('ok', data.message)
      if (data.errors?.length > 0) {
        setTimeout(() => showToast('warn', `⚠️ Sin espacio para: ${data.errors.map((e:any)=>e.subject).join(', ')}`), 1000)
      }
      loadSchedule(); loadTscs()
    } catch { showToast('err', 'Error de conexión') }
    finally { setGenerating(false) }
  }

  const handlePublish = async () => {
    if (!selCourse) return
    if (!confirm('¿Confirmar y publicar este horario?')) return
    setPublishing(true)
    try {
      const res  = await fetch(`${API}/api/schedules/publish/${selCourse.id}`, {
        method: 'POST', headers: auth()
      })
      const data = await res.json()
      if (!res.ok) { showToast('err', data.message); return }
      showToast('ok', data.message)
      setEditMode(false)
      loadSchedule()
    } catch { showToast('err', 'Error de conexión') }
    finally { setPublishing(false) }
  }

  const handleDeleteDraft = async () => {
    if (!selCourse) return
    if (!confirm('¿Eliminar el borrador?')) return
    await fetch(`${API}/api/schedules/draft/${selCourse.id}`, { method: 'DELETE', headers: auth() })
    showToast('ok', 'Borrador eliminado')
    setEditMode(false)
    loadSchedule(); loadTscs()
  }

  const handleDeleteAll = async () => {
    if (!selCourse) return
    if (!confirm(`¿Eliminar TODO el horario de este curso (borradores y publicados)? Esta acción no se puede deshacer.`)) return
    try {
      const res  = await fetch(`${API}/api/schedules/course/${selCourse.id}/all`, {
        method: 'DELETE', headers: auth()
      })
      const data = await res.json()
      if (!res.ok) { showToast('err', data.message); return }
      showToast('ok', data.message)
      setEditMode(false)
      loadSchedule(); loadTscs()
    } catch { showToast('err', 'Error de conexión') }
  }

  const handleDeletePeriod = async (id: number) => {
    await fetch(`${API}/api/schedules/${id}`, { method: 'DELETE', headers: auth() })
    loadSchedule(); loadTscs()
  }

  const handleAssign = async () => {
    if (!selCourse || !selCell || !selTsc) return
    const res = await fetch(`${API}/api/schedules/course/${selCourse.id}/period`, {
      method: 'POST',
      headers: { ...auth(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dayOfWeek:              selCell.day,
        period:                 selCell.period,
        startTime:              selCell.startTime,
        endTime:                selCell.endTime,
        teacherSubjectCourseId: parseInt(selTsc),
      })
    })
    const data = await res.json()
    if (!res.ok) { showToast('err', data.message); return }
    showToast('ok', 'Periodo asignado correctamente')
    setShowModal(false)
    loadSchedule(); loadTscs()
  }

  const handleAssignClassroom = async () => {
    if (!selScheduleId) return
    const res = await fetch(`${API}/api/classrooms/${selScheduleId}/classroom`, {
      method: 'PATCH',
      headers: { ...auth(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ classroomId: selClassroom ? parseInt(selClassroom) : null })
    })
    const data = await res.json()
    if (!res.ok) { showToast('err', data.message); return }
    showToast('ok', selClassroom ? 'Aula asignada correctamente' : 'Aula removida')
    setShowClassroomModal(false)
    loadSchedule()
  }

  const handleAssignClassroomToAll = async () => {
    if (!selCourse || !bulkClassroom) return
    const res = await fetch(`${API}/api/classrooms/course/${selCourse.id}/all`, {
      method: 'PATCH',
      headers: { ...auth(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ classroomId: parseInt(bulkClassroom) })
    })
    const data = await res.json()
    if (!res.ok) { showToast('err', data.message); return }
    showToast('ok', data.message)
    setShowBulkClassroomModal(false)
    loadSchedule()
  }

  const totalPeriods = schoolSch?.periods || 7
  const days = selCourse?.level === 'SECUNDARIA' ? [1,2,3,4,5,6] : [1,2,3,4,5]
  const getCell = (day: number, period: number) =>
    schedule.find(s => s.dayOfWeek === day && s.period === period)

  const hasDraft     = schedule.some(s => s.status === 'BORRADOR')
  const hasPublished = schedule.some(s => s.status === 'PUBLICADO')
  const hasAny       = hasDraft || hasPublished

  const totalAsignados = resumenMaterias.reduce((s,t)=>s+t.asignados,0)
  const totalMaximo    = resumenMaterias.reduce((s,t)=>s+t.maxPeriodos,0)
  const progresoPct    = totalMaximo > 0 ? Math.round((totalAsignados/totalMaximo)*100) : 0

  const breakPeriods = schoolSch?.breakAfter?.split(',').map(Number) || []

  return (
    <div>
      {/* Toast */}
      {toast && (
        <div style={{
          position:'fixed',top:16,right:16,zIndex:999,padding:'12px 18px',borderRadius:10,fontSize:13,
          background:toast.type==='ok'?'#E1F5EE':toast.type==='warn'?'#FFFBEA':'#FFF0F0',
          border:`1px solid ${toast.type==='ok'?'#9FE1CB':toast.type==='warn'?'#F5C518':'#FFBBBB'}`,
          color:toast.type==='ok'?'#0F6E56':toast.type==='warn'?'#7A6000':'#C0392B',
          boxShadow:'0 4px 16px rgba(0,0,0,.12)',maxWidth:420,lineHeight:1.5,
        }}>
          {toast.text}
        </div>
      )}

      {/* Header */}
      <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:24,flexWrap:'wrap'}}>
        <button onClick={()=>router.push('/dashboard/admin/horarios')}
          style={{display:'flex',alignItems:'center',gap:6,background:'none',border:'none',cursor:'pointer',color:'#6B8BB0',fontSize:13}}>
          <ArrowLeft size={16}/> Volver
        </button>
        <div style={{flex:1}}>
          <h1 style={{fontSize:20,fontWeight:700,color:'#1A3A7C',margin:0}}>Horario por Curso</h1>
          <p style={{fontSize:13,color:'#6B8BB0',margin:0}}>Genera y asigna el horario semanal</p>
        </div>
      </div>

      {/* Selector de curso */}
      <div style={{background:'#fff',border:'1px solid #CBE0F0',borderRadius:12,padding:'16px 20px',marginBottom:20}}>
        <label style={{fontSize:11,fontWeight:700,color:'#1A3A7C',textTransform:'uppercase',letterSpacing:'.5px',display:'block',marginBottom:8}}>
          Seleccionar Curso
        </label>
        <select
          value={selCourse?.id || ''}
          onChange={e => {
            const c = courses.find(c => c.id === parseInt(e.target.value))
            setSelCourse(c || null)
            setSchedule([])
            setTscs([])
          }}
          style={{padding:'10px 12px',border:'1.5px solid #CBE0F0',borderRadius:8,fontSize:13,color:'#1A3A7C',outline:'none',width:'100%',maxWidth:420}}>
          <option value="">-- Selecciona un curso --</option>
          {['PRIMERO','SEGUNDO','TERCERO','CUARTO','QUINTO','SEXTO'].map(grade => (
            <optgroup key={grade} label={`${GRADES[grade]} Grado`}>
              {courses.filter(c=>c.grade===grade).map(c=>(
                <option key={c.id} value={c.id}>
                  {GRADES[c.grade]} &quot;{c.parallel}&quot; · {SHIFTS[c.shift]} · {c.level}{c.educationType==='BTH'?' · BTH':''}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      {selCourse && (
        <>
          {/* Info horario activo */}
          {schoolSch ? (
            <div style={{background:'#E0ECF8',border:'1px solid #CBE0F0',borderRadius:8,padding:'8px 16px',marginBottom:16,fontSize:12,color:'#1A3A7C',display:'flex',gap:16,flexWrap:'wrap',alignItems:'center'}}>
              <span>{schoolSch.isWinter?'❄️':'☀️'} <strong>{schoolSch.name}</strong></span>
              <span>Entrada: <strong>{schoolSch.startTime}</strong></span>
              <span>Salida: <strong>{schoolSch.exitTime}</strong></span>
              <span><strong>{schoolSch.periods}</strong> periodos · <strong>{schoolSch.periodDuration}</strong> min/periodo</span>
              <span>☕ <strong>{breakPeriods.length}</strong> recreo{breakPeriods.length!==1?'s':''} × <strong>{schoolSch.breakDuration}</strong> min</span>
            </div>
          ) : (
            <div style={{background:'#FFF0F0',border:'1px solid #FFBBBB',borderRadius:8,padding:'8px 16px',marginBottom:16,fontSize:12,color:'#C0392B'}}>
              ⚠️ No hay horario institucional activo para el turno {SHIFTS[selCourse.shift]}
            </div>
          )}

          {/* Acciones */}
          <div style={{display:'flex',gap:10,marginBottom:16,flexWrap:'wrap',alignItems:'center'}}>
            <button onClick={handleGenerate} disabled={generating||!schoolSch}
              style={{display:'flex',alignItems:'center',gap:7,padding:'9px 16px',background:'#633806',color:'#fff',border:'none',borderRadius:8,fontSize:13,fontWeight:600,cursor:'pointer',opacity:(generating||!schoolSch)?0.6:1}}>
              <Zap size={15}/> {generating?'Generando...':'⚡ Generar Automático'}
            </button>

            {hasAny && (
              <>
                <button onClick={()=>{ setBulkClassroom(''); setShowBulkClassroomModal(true) }}
                  style={{display:'flex',alignItems:'center',gap:7,padding:'9px 16px',background:'#fff',color:'#1A3A7C',border:'1.5px solid #CBE0F0',borderRadius:8,fontSize:13,fontWeight:600,cursor:'pointer'}}>
                  🚪 Asignar aula al curso
                </button>
                <button onClick={()=>setEditMode(!editMode)} style={{
                  display:'flex',alignItems:'center',gap:7,padding:'9px 16px',
                  background:editMode?'#1A3A7C':'#F0F6FC',
                  color:editMode?'#fff':'#1A3A7C',
                  border:`1.5px solid ${editMode?'#1A3A7C':'#CBE0F0'}`,
                  borderRadius:8,fontSize:13,fontWeight:600,cursor:'pointer'
                }}>
                  <Edit2 size={14}/> {editMode?'✅ Salir de edición':'✏️ Modo edición'}
                </button>
                <button onClick={handleDeleteAll}
                  style={{display:'flex',alignItems:'center',gap:7,padding:'9px 16px',background:'#FFF0F0',color:'#C0392B',border:'1px solid #FFBBBB',borderRadius:8,fontSize:13,cursor:'pointer',fontWeight:600}}>
                  <Trash2 size={14}/> Eliminar Todo
                </button>
              </>
            )}

            {hasDraft && (
              <>
                <button onClick={handlePublish} disabled={publishing}
                  style={{display:'flex',alignItems:'center',gap:7,padding:'9px 16px',background:'#0F6E56',color:'#fff',border:'none',borderRadius:8,fontSize:13,fontWeight:600,cursor:'pointer',opacity:publishing?0.6:1}}>
                  <CheckCircle size={15}/> {publishing?'Publicando...':'✅ Publicar'}
                </button>
                <button onClick={handleDeleteDraft}
                  style={{display:'flex',alignItems:'center',gap:7,padding:'9px 16px',background:'#FFF0F0',color:'#C0392B',border:'1px solid #FFBBBB',borderRadius:8,fontSize:13,cursor:'pointer'}}>
                  <Trash2 size={15}/> Eliminar Borrador
                </button>
              </>
            )}
          </div>

          {/* Aviso modo edición */}
          {editMode && (
            <div style={{background:'#FFF8E1',border:'1px solid #F5C518',borderRadius:8,padding:'8px 14px',marginBottom:12,fontSize:12,color:'#7A6000',display:'flex',alignItems:'center',gap:8}}>
              ✏️ <strong>Modo edición activo</strong> — haz clic en el <strong>×</strong> de cualquier celda para eliminar ese periodo.
            </div>
          )}

          {/* Progreso general */}
          {totalMaximo > 0 && (
            <div style={{background:'#fff',border:'1px solid #CBE0F0',borderRadius:10,padding:'12px 16px',marginBottom:16}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
                <span style={{fontSize:12,fontWeight:700,color:'#1A3A7C'}}>Progreso del horario</span>
                <span style={{fontSize:12,color:'#6B8BB0'}}>{totalAsignados} / {totalMaximo} periodos ({progresoPct}%)</span>
              </div>
              <div style={{height:8,background:'#F0F6FC',borderRadius:4,overflow:'hidden'}}>
                <div style={{
                  height:'100%',borderRadius:4,transition:'width .3s',
                  width:`${progresoPct}%`,
                  background: progresoPct===100?'#0F6E56':progresoPct>=60?'#BA7517':'#1A3A7C'
                }}/>
              </div>
            </div>
          )}

          {/* Resumen de materias */}
          {resumenMaterias.length > 0 && (
            <div style={{background:'#fff',border:'1px solid #CBE0F0',borderRadius:10,padding:'12px 16px',marginBottom:16}}>
              <div style={{fontSize:11,fontWeight:700,color:'#1A3A7C',textTransform:'uppercase',letterSpacing:'.5px',marginBottom:10}}>
                Materias del curso — periodos asignados / máximo
              </div>
              <div style={{display:'flex',flexWrap:'wrap',gap:8}}>
                {resumenMaterias.map(t => {
                  const campo = t.subject.campo
                  const pct   = t.maxPeriodos > 0 ? (t.asignados / t.maxPeriodos) : 0
                  return (
                    <div key={t.id} style={{
                      background: t.completo ? '#E1F5EE' : (campo ? CAMPO_BG[campo]||'#F0F6FC' : '#F0F6FC'),
                      border:`1px solid ${t.completo ? '#9FE1CB' : (campo ? CAMPO_COLOR[campo]||'#CBE0F0' : '#CBE0F0')}33`,
                      borderRadius:8,padding:'6px 12px',fontSize:12,
                      display:'flex',alignItems:'center',gap:6,
                    }}>
                      <span style={{fontWeight:700,color:t.completo?'#0F6E56':(campo?CAMPO_COLOR[campo]:'#1A3A7C')}}>
                        {t.completo?'✅ ':''}{t.subject.name}
                      </span>
                      <span style={{color:'#6B8BB0',fontSize:11}}>{t.teacher.lastName}</span>
                      <span style={{
                        background: t.completo?'#0F6E56':pct>=0.5?'#BA7517':'#1A3A7C',
                        color:'#fff',padding:'1px 7px',borderRadius:10,fontSize:10,fontWeight:700,whiteSpace:'nowrap'
                      }}>
                        {t.asignados}/{t.maxPeriodos}P
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Leyenda */}
          <div style={{display:'flex',gap:16,marginBottom:12,flexWrap:'wrap'}}>
            <div style={{display:'flex',alignItems:'center',gap:6,fontSize:12,color:'#6B8BB0'}}>
              <div style={{width:12,height:12,borderRadius:3,background:'#FFFEF0',border:'1px solid #F5C518'}}/> Borrador
            </div>
            <div style={{display:'flex',alignItems:'center',gap:6,fontSize:12,color:'#6B8BB0'}}>
              <div style={{width:12,height:12,borderRadius:3,background:'#F0FBF5',border:'1px solid #9FE1CB'}}/> Publicado
            </div>
            <div style={{display:'flex',alignItems:'center',gap:6,fontSize:12,color:'#6B8BB0'}}>
              <div style={{width:12,height:12,borderRadius:3,background:'#FAFCFF',border:'1px dashed #CBE0F0'}}/> Libre
            </div>
            <div style={{display:'flex',alignItems:'center',gap:6,fontSize:12,color:'#6B8BB0'}}>
              <span>☕</span> Recreo
            </div>
            {!editMode && (
              <div style={{display:'flex',alignItems:'center',gap:6,fontSize:12,color:'#6B8BB0'}}>
                📍 Clic en celda ocupada → asignar aula
              </div>
            )}
          </div>

          {/* Grilla */}
          {loading ? (
            <div style={{display:'flex',justifyContent:'center',padding:48}}><div className="spinner"/></div>
          ) : (
            <div style={{overflowX:'auto',borderRadius:10,border:'1px solid #CBE0F0'}}>
              <table style={{borderCollapse:'collapse',width:'100%',minWidth:700}}>
                <thead>
                  <tr>
                    <th style={{...thStyle,width:90}}>Periodo</th>
                    {days.map(d=>(
                      <th key={d} style={thStyle}>{DAYS[d]}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Array.from({length:totalPeriods},(_,i)=>i+1).map(period => {
                    const pt          = getPeriodTime(period)
                    const tieneRecreo = breakPeriods.includes(period)
                    return (
                      <React.Fragment key={period}>
                        <tr>
                          <td style={{...tdStyle,textAlign:'center',background:'#F8FBFF',fontWeight:700,fontSize:11,whiteSpace:'nowrap'}}>
                            <div style={{color:'#1A3A7C'}}>P{period}</div>
                            <div style={{fontSize:10,color:'#6B8BB0',fontWeight:400}}>{pt.startTime}</div>
                            <div style={{fontSize:10,color:'#6B8BB0',fontWeight:400}}>{pt.endTime}</div>
                          </td>
                          {days.map(day => {
                            const cell        = getCell(day, period)
                            const isDraft     = cell?.status === 'BORRADOR'
                            const isPublished = cell?.status === 'PUBLICADO'
                            const campo       = cell?.teacherSubjectCourse?.subject?.campo
                            return (
                              <td key={day} style={{
                                ...tdStyle,
                                background:  isDraft ? '#FFFEF0' : isPublished ? '#F0FBF5' : '#FAFCFF',
                                borderColor: isDraft ? '#F5C518' : isPublished ? '#9FE1CB' : '#E0EAF5',
                                borderStyle: cell ? 'solid' : 'dashed',
                                cursor: editMode ? 'default' : (cell ? 'pointer' : 'default'),
                                minWidth: 110,
                              }}
                                onClick={() => {
                                  if (editMode) return
                                  if (!cell) {
                                    const pt = getPeriodTime(period)
                                    setSelCell({day, period, startTime:pt.startTime, endTime:pt.endTime})
                                    setSelTsc('')
                                    setShowModal(true)
                                  } else {
                                    setSelScheduleId(cell.id)
                                    setSelClassroom(cell.classroomId ? String(cell.classroomId) : '')
                                    setShowClassroomModal(true)
                                  }
                                }}>
                                {cell ? (
                                  <div style={{position:'relative',padding:'2px 0'}}>
                                    <div style={{fontSize:16,lineHeight:1,marginBottom:3}}>
                                      {SUBJECT_EMOJI[cell.teacherSubjectCourse.subject.name] || '📚'}
                                    </div>
                                    <div style={{fontSize:11,fontWeight:700,lineHeight:1.3,color:campo?CAMPO_COLOR[campo]:'#1A3A7C'}}>
                                      {cell.teacherSubjectCourse.subject.name}
                                    </div>
                                    <div style={{fontSize:10,color:'#6B8BB0',marginTop:1}}>
                                      {cell.teacherSubjectCourse.teacher.lastName}
                                    </div>
                                    {cell.classroom && (
                                      <div style={{fontSize:9,color:'#0F6E56',fontWeight:600,marginTop:2,background:'#E1F5EE',borderRadius:4,padding:'1px 5px',display:'inline-block'}}>
                                        📍 {cell.classroom.name}
                                      </div>
                                    )}
                                    {editMode && (
                                      <button
                                        onClick={e=>{e.stopPropagation();handleDeletePeriod(cell.id)}}
                                        style={{
                                          position:'absolute',top:-2,right:-2,
                                          background:'#C0392B',border:'none',borderRadius:'50%',
                                          cursor:'pointer',color:'#fff',width:16,height:16,
                                          display:'flex',alignItems:'center',justifyContent:'center',
                                          fontSize:10,lineHeight:1,
                                        }}>
                                        ×
                                      </button>
                                    )}
                                  </div>
                                ) : (
                                  <div style={{textAlign:'center',color:'#D0E4F0',fontSize:20}}>
                                    {editMode ? '' : '+'}
                                  </div>
                                )}
                              </td>
                            )
                          })}
                        </tr>

                        {/* Separador de recreo */}
   {tieneRecreo && (
  <tr>
    <td colSpan={days.length + 1} style={{
      padding:'6px 12px',
      background:'#D0EFFF',
      borderTop:'2px solid #4A9FD4',
      borderBottom:'2px solid #4A9FD4',
      textAlign:'center',
      fontSize:11,
      color:'#1A5F8A',
      fontWeight:700,
      letterSpacing:'.3px',
    }}>
      ☕ Recreo — {schoolSch?.breakDuration} min
    </td>
  </tr>
)}
                      </React.Fragment>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Modal asignar materia */}
      {showModal && selCell && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.45)',zIndex:500,display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
          <div style={{background:'#fff',borderRadius:14,width:'100%',maxWidth:440,boxShadow:'0 20px 60px rgba(0,0,0,.2)'}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'16px 20px',borderBottom:'1px solid #CBE0F0'}}>
              <div>
                <h3 style={{fontSize:15,fontWeight:700,color:'#1A3A7C',margin:0}}>Asignar Periodo</h3>
                <p style={{fontSize:12,color:'#6B8BB0',margin:'2px 0 0'}}>
                  {DAYS[selCell.day]} · Periodo {selCell.period} · {selCell.startTime} — {selCell.endTime}
                </p>
              </div>
              <button onClick={()=>setShowModal(false)} style={{background:'none',border:'none',cursor:'pointer',color:'#6B8BB0',padding:4}}>
                <X size={18}/>
              </button>
            </div>
            <div style={{padding:20}}>
              <label style={{fontSize:11,fontWeight:700,color:'#1A3A7C',textTransform:'uppercase',letterSpacing:'.5px',display:'block',marginBottom:8}}>
                Materia / Maestro
              </label>
              <select value={selTsc} onChange={e=>setSelTsc(e.target.value)}
                style={{width:'100%',padding:'10px 12px',border:'1.5px solid #CBE0F0',borderRadius:8,fontSize:13,color:'#1A3A7C',outline:'none',marginBottom:10}}>
                <option value="">-- Selecciona materia --</option>
                {resumenMaterias.map(t=>(
                  <option key={t.id} value={t.id} disabled={t.completo}>
                    {t.completo?'🚫 ':''}{t.subject.name} — {t.teacher.lastName} ({t.asignados}/{t.maxPeriodos} periodos)
                  </option>
                ))}
              </select>
              <p style={{fontSize:11,color:'#6B8BB0',margin:0}}>
                Las materias con 🚫 ya alcanzaron su máximo de periodos semanales.
              </p>
            </div>
            <div style={{display:'flex',justifyContent:'flex-end',gap:10,padding:'12px 20px',borderTop:'1px solid #CBE0F0'}}>
              <button onClick={()=>setShowModal(false)}
                style={{padding:'8px 16px',background:'#fff',border:'1.5px solid #CBE0F0',borderRadius:8,fontSize:13,cursor:'pointer',color:'#1A3A7C'}}>
                Cancelar
              </button>
              <button onClick={handleAssign} disabled={!selTsc}
                style={{display:'flex',alignItems:'center',gap:6,padding:'8px 18px',background:'#1A3A7C',color:'#fff',border:'none',borderRadius:8,fontSize:13,fontWeight:600,cursor:'pointer',opacity:!selTsc?0.5:1}}>
                <Save size={13}/> Asignar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal asignar aula a periodo individual */}
      {showClassroomModal && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.45)',zIndex:500,display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
          <div style={{background:'#fff',borderRadius:14,width:'100%',maxWidth:380,boxShadow:'0 20px 60px rgba(0,0,0,.2)'}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'16px 20px',borderBottom:'1px solid #CBE0F0'}}>
              <div>
                <h3 style={{fontSize:15,fontWeight:700,color:'#1A3A7C',margin:0}}>Asignar Aula</h3>
                <p style={{fontSize:12,color:'#6B8BB0',margin:'2px 0 0'}}>Espacio físico para este periodo</p>
              </div>
              <button onClick={()=>setShowClassroomModal(false)} style={{background:'none',border:'none',cursor:'pointer',color:'#6B8BB0'}}>
                <X size={18}/>
              </button>
            </div>
            <div style={{padding:20}}>
              <label style={{fontSize:11,fontWeight:700,color:'#1A3A7C',textTransform:'uppercase',letterSpacing:'.5px',display:'block',marginBottom:8}}>
                Aula física
              </label>
              {classrooms.length === 0 ? (
                <div style={{padding:'12px',background:'#FFF0F0',borderRadius:8,fontSize:12,color:'#C0392B'}}>
                  No hay aulas registradas.{' '}
                  <span onClick={()=>router.push('/dashboard/admin/horarios/aulas')} style={{textDecoration:'underline',cursor:'pointer'}}>
                    Crear aulas aquí
                  </span>
                </div>
              ) : (
                <select value={selClassroom} onChange={e=>setSelClassroom(e.target.value)}
                  style={{width:'100%',padding:'10px 12px',border:'1.5px solid #CBE0F0',borderRadius:8,fontSize:13,color:'#1A3A7C',outline:'none'}}>
                  <option value="">-- Sin aula asignada --</option>
                  {classrooms.map(c=>(
                    <option key={c.id} value={c.id}>
                      {c.name}{c.capacity ? ` (cap. ${c.capacity})` : ''}
                    </option>
                  ))}
                </select>
              )}
              <p style={{fontSize:11,color:'#6B8BB0',margin:'8px 0 0'}}>
                Selecciona &quot;Sin aula asignada&quot; para quitar el aula de este periodo.
              </p>
            </div>
            <div style={{display:'flex',justifyContent:'flex-end',gap:10,padding:'12px 20px',borderTop:'1px solid #CBE0F0'}}>
              <button onClick={()=>setShowClassroomModal(false)}
                style={{padding:'8px 16px',background:'#fff',border:'1.5px solid #CBE0F0',borderRadius:8,fontSize:13,cursor:'pointer',color:'#1A3A7C'}}>
                Cancelar
              </button>
              <button onClick={handleAssignClassroom} disabled={classrooms.length===0}
                style={{display:'flex',alignItems:'center',gap:6,padding:'8px 18px',background:'#0F6E56',color:'#fff',border:'none',borderRadius:8,fontSize:13,fontWeight:600,cursor:'pointer',opacity:classrooms.length===0?0.5:1}}>
                <Save size={13}/> Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal asignar aula a todo el curso */}
      {showBulkClassroomModal && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.45)',zIndex:500,display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
          <div style={{background:'#fff',borderRadius:14,width:'100%',maxWidth:400,boxShadow:'0 20px 60px rgba(0,0,0,.2)'}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'16px 20px',borderBottom:'1px solid #CBE0F0'}}>
              <div>
                <h3 style={{fontSize:15,fontWeight:700,color:'#1A3A7C',margin:0}}>Asignar aula a todo el curso</h3>
                <p style={{fontSize:12,color:'#6B8BB0',margin:'2px 0 0'}}>Se aplicará a todos los periodos del curso</p>
              </div>
              <button onClick={()=>setShowBulkClassroomModal(false)} style={{background:'none',border:'none',cursor:'pointer',color:'#6B8BB0'}}>
                <X size={18}/>
              </button>
            </div>
            <div style={{padding:20}}>
              <label style={{fontSize:11,fontWeight:700,color:'#1A3A7C',textTransform:'uppercase',letterSpacing:'.5px',display:'block',marginBottom:8}}>
                Aula física
              </label>
              {classrooms.length === 0 ? (
                <div style={{padding:'12px',background:'#FFF0F0',borderRadius:8,fontSize:12,color:'#C0392B'}}>
                  No hay aulas registradas.{' '}
                  <span onClick={()=>router.push('/dashboard/admin/horarios/aulas')} style={{textDecoration:'underline',cursor:'pointer'}}>
                    Crear aulas aquí
                  </span>
                </div>
              ) : (
                <select value={bulkClassroom} onChange={e=>setBulkClassroom(e.target.value)}
                  style={{width:'100%',padding:'10px 12px',border:'1.5px solid #CBE0F0',borderRadius:8,fontSize:13,color:'#1A3A7C',outline:'none'}}>
                  <option value="">-- Selecciona un aula --</option>
                  {classrooms.map(c=>(
                    <option key={c.id} value={c.id}>
                      {c.name}{c.capacity ? ` (cap. ${c.capacity})` : ''}
                    </option>
                  ))}
                </select>
              )}
              <p style={{fontSize:11,color:'#6B8BB0',margin:'8px 0 0'}}>
                Esto sobreescribirá el aula de todos los periodos del curso.
              </p>
            </div>
            <div style={{display:'flex',justifyContent:'flex-end',gap:10,padding:'12px 20px',borderTop:'1px solid #CBE0F0'}}>
              <button onClick={()=>setShowBulkClassroomModal(false)}
                style={{padding:'8px 16px',background:'#fff',border:'1.5px solid #CBE0F0',borderRadius:8,fontSize:13,cursor:'pointer',color:'#1A3A7C'}}>
                Cancelar
              </button>
              <button onClick={handleAssignClassroomToAll} disabled={!bulkClassroom||classrooms.length===0}
                style={{display:'flex',alignItems:'center',gap:6,padding:'8px 18px',background:'#1A3A7C',color:'#fff',border:'none',borderRadius:8,fontSize:13,fontWeight:600,cursor:'pointer',opacity:(!bulkClassroom||classrooms.length===0)?0.5:1}}>
                <Save size={13}/> Asignar a todos
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .spinner{width:24px;height:24px;border:2px solid rgba(26,58,124,.2);border-top-color:#1A3A7C;border-radius:50%;animation:spin .7s linear infinite}
        @keyframes spin{to{transform:rotate(360deg)}}
      `}</style>
    </div>
  )
}

const thStyle: React.CSSProperties = {
  padding:'10px 12px', background:'#F0F6FC', fontSize:12, fontWeight:700,
  color:'#1A3A7C', textAlign:'center', border:'1px solid #CBE0F0',
}
const tdStyle: React.CSSProperties = {
  padding:'8px 10px', border:'1px solid #CBE0F0', verticalAlign:'middle', fontSize:12,
}