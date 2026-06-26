'use client'

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Zap, Trash2, X, Save, Edit2, Users } from 'lucide-react'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

interface Course {
  id: number; grade: string; parallel: string; level: string
  shift: string; educationType: string
}

interface PlanItem {
  id: number; dayOfWeek: number; period: number
  startTime: string; endTime: string; slot: string
  teacherSubjectCourse: {
    id: number
    teacher: { firstName: string; lastName: string }
    subject: { name: string; campo?: string }
  }
}

interface TSC {
  id: number
  teacher: { id: number; firstName: string; lastName: string }
  subject: { id: number; name: string; campo?: string }
  hoursPerMonth: number
  maxPeriodos: number
}

interface SlotsStatus {
  TEMP: number; A: number; B: number
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

const SUBJECT_EMOJI: Record<string, string> = {
  'Matemática': '🔢', 'Lenguas Castellana y Originaria': '📖',
  'Lengua Extranjera': '🌍', 'Ciencias Sociales': '🏛️',
  'Ciencias Naturales: Biología': '🧬', 'Física': '⚛️',
  'Química': '🧪', 'Educación Física y Deportes': '⚽',
  'Educación Musical': '🎵', 'Artes Plásticas y Visuales': '🎨',
  'Cosmovisiones y Filosofía': '🌌', 'Valores, Espiritualidad y Religiones': '☮️',
  'Psicología': '🧠', 'Técnica Tecnológica General': '⚙️',
  'Técnica Tecnológica General y Especializada': '🔧',
}

const SLOT_COLORS: Record<string, {bg:string; border:string; text:string; badge:string}> = {
  TEMP: { bg:'#F0F6FC', border:'#CBE0F0', text:'#1A3A7C', badge:'#1A3A7C' },
  A:    { bg:'#E8F5F0', border:'#9FE1CB', text:'#0F6E56', badge:'#0F6E56' },
  B:    { bg:'#F3E8FF', border:'#C4A8E8', text:'#6B21A8', badge:'#6B21A8' },
}

export default function PlanificacionPage() {
  const router = useRouter()

  const [courses,    setCourses]    = useState<Course[]>([])
  const [plans,      setPlans]      = useState<Record<number, PlanItem[]>>({})
  const [tscs,       setTscs]       = useState<Record<number, TSC[]>>({})
  const [schoolSchs, setSchoolSchs] = useState<any[]>([])
  const [slotsStatus,setSlotsStatus]= useState<SlotsStatus>({ TEMP:0, A:0, B:0 })
  const [activeSlot, setActiveSlot] = useState<'TEMP'|'A'|'B'>('TEMP')
  const [loading,    setLoading]    = useState(false)
  const [generating, setGenerating] = useState(false)
  const [saving,     setSaving]     = useState(false)
  const [promoting,  setPromoting]  = useState(false)
  const [editMode,   setEditMode]   = useState(false)
  const [toast,      setToast]      = useState<{type:'ok'|'err'|'warn'; text:string} | null>(null)

  const [showParams,           setShowParams]           = useState(false)
  const [periodosConsecutivos, setPeriodosConsecutivos] = useState(2)
  const [maxPorDia,            setMaxPorDia]            = useState(2)
  const [maxPeriodo,           setMaxPeriodo]           = useState(6)
  const [porcentajeBase,       setPorcentajeBase]       = useState(80)

  const [showModal, setShowModal] = useState(false)
  const [selCourse, setSelCourse] = useState<Course | null>(null)
  const [selCell,   setSelCell]   = useState<{day:number; period:number; startTime:string; endTime:string} | null>(null)
  const [selTsc,    setSelTsc]    = useState('')

  const [showSaveModal, setShowSaveModal] = useState(false)
  const [showPromote,   setShowPromote]   = useState(false)

  const token = () => localStorage.getItem('token') || ''
  const auth  = () => ({ Authorization: `Bearer ${token()}` })

  const showToast = (type:'ok'|'err'|'warn', text:string) => {
    setToast({type, text}); setTimeout(()=>setToast(null), 5000)
  }

  const loadSlotsStatus = async () => {
    const res  = await fetch(`${API}/api/planificacion/slots-status`, { headers: auth() })
    const data = await res.json()
    if (res.ok) setSlotsStatus(data)
  }

  const loadPlansForSlot = async (slot: string, courseList: Course[]) => {
    setLoading(true)
    try {
      await Promise.all(courseList.map(async (c: Course) => {
        const res  = await fetch(`${API}/api/planificacion/course/${c.id}?slot=${slot}`, { headers: auth() })
        const data = await res.json()
        if (res.ok) setPlans(prev => ({ ...prev, [c.id]: data.plans || [] }))
      }))
    } finally { setLoading(false) }
  }

  const loadAll = async () => {
    setLoading(true)
    try {
      const [cRes, sRes] = await Promise.all([
        fetch(`${API}/api/courses`,                    { headers: auth() }),
        fetch(`${API}/api/schedules/school-schedules`, { headers: auth() }),
      ])
      const [cData, sData] = await Promise.all([cRes.json(), sRes.json()])
      if (cRes.ok) {
        setCourses(cData)
        await Promise.all(cData.map(async (c: Course) => {
          const [pRes, tRes] = await Promise.all([
            fetch(`${API}/api/planificacion/course/${c.id}?slot=${activeSlot}`, { headers: auth() }),
            fetch(`${API}/api/schedules/tscs/${c.id}`,                          { headers: auth() }),
          ])
          const [pData, tData] = await Promise.all([pRes.json(), tRes.json()])
          if (pRes.ok) setPlans(prev => ({ ...prev, [c.id]: pData.plans || [] }))
          if (tRes.ok) setTscs(prev  => ({ ...prev, [c.id]: tData }))
        }))
      }
      if (sRes.ok) setSchoolSchs(sData)
      await loadSlotsStatus()
    } catch { console.error('Error') }
    finally { setLoading(false) }
  }

  useEffect(() => { loadAll() }, [])

  const handleSlotChange = async (slot: 'TEMP'|'A'|'B') => {
    setActiveSlot(slot)
    setEditMode(false)
    setPlans({})
    await loadPlansForSlot(slot, courses)
  }

  const getSchoolSch = (shift: string) =>
    schoolSchs.find(s => s.isActive && s.shift === shift) || null

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
      result.push({ period: i, startTime: start, endTime: end })
      if (breakPeriods.includes(i)) cur += ss.breakDuration
    }
    return result
  }

  const handleGenerate = async () => {
    setGenerating(true)
    setShowParams(false)
    try {
      const res  = await fetch(`${API}/api/planificacion/generate`, {
        method: 'POST',
        headers: { ...auth(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ periodosConsecutivos, maxPorDia, maxPeriodo, porcentajeBase })
      })
      const data = await res.json()
      if (!res.ok) { showToast('err', data.message); return }
      showToast('ok', `${data.message}${data.errors?.length > 0 ? ` · ${data.errors.length} sin espacio` : ''}`)
      setActiveSlot('TEMP')
      await loadPlansForSlot('TEMP', courses)
      await loadSlotsStatus()
      setShowSaveModal(true)
    } catch { showToast('err', 'Error de conexión') }
    finally { setGenerating(false) }
  }

  const handleSaveSlot = async (slot: 'A'|'B') => {
    setSaving(true)
    try {
      const res  = await fetch(`${API}/api/planificacion/save-slot`, {
        method: 'POST',
        headers: { ...auth(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ slot })
      })
      const data = await res.json()
      if (!res.ok) { showToast('err', data.message); return }
      showToast('ok', data.message)
      setShowSaveModal(false)
      await loadSlotsStatus()
    } catch { showToast('err', 'Error de conexión') }
    finally { setSaving(false) }
  }

  const handleClearSlot = async (slot: string) => {
    if (!confirm(`¿Eliminar la planificación del Slot ${slot}?`)) return
    try {
      const res  = await fetch(`${API}/api/planificacion/slot/${slot}`, { method: 'DELETE', headers: auth() })
      const data = await res.json()
      if (!res.ok) { showToast('err', data.message); return }
      showToast('ok', data.message)
      if (activeSlot === slot) {
        setPlans({})
        setActiveSlot('TEMP')
      }
      await loadSlotsStatus()
    } catch { showToast('err', 'Error de conexión') }
  }

  const handlePromote = async (slot: 'TEMP'|'A'|'B') => {
    if (!confirm(`¿Promover Slot ${slot} al horario oficial?\n\nEsta acción reemplazará los borradores actuales.`)) return
    if (!confirm(`⚠️ CONFIRMACIÓN FINAL\n\n¿Estás seguro? Esta acción no se puede deshacer.`)) return
    setPromoting(true)
    try {
      const res  = await fetch(`${API}/api/planificacion/promote`, {
        method: 'POST',
        headers: { ...auth(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ slot })
      })
      const data = await res.json()
      if (!res.ok) { showToast('err', data.message); return }
      showToast('ok', data.message)
      setShowPromote(false)
    } catch { showToast('err', 'Error de conexión') }
    finally { setPromoting(false) }
  }

  const handleDeletePeriod = async (id: number, courseId: number) => {
    await fetch(`${API}/api/planificacion/${id}`, { method: 'DELETE', headers: auth() })
    const res  = await fetch(`${API}/api/planificacion/course/${courseId}?slot=${activeSlot}`, { headers: auth() })
    const data = await res.json()
    if (res.ok) setPlans(prev => ({ ...prev, [courseId]: data.plans || [] }))
    await loadSlotsStatus()
  }

  const handleAssign = async () => {
    if (!selCourse || !selCell || !selTsc) return
    const res = await fetch(`${API}/api/planificacion/course/${selCourse.id}/period`, {
      method: 'POST',
      headers: { ...auth(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dayOfWeek:              selCell.day,
        period:                 selCell.period,
        startTime:              selCell.startTime,
        endTime:                selCell.endTime,
        teacherSubjectCourseId: parseInt(selTsc),
        slot:                   activeSlot,
      })
    })
    const data = await res.json()
    if (!res.ok) { showToast('err', data.message); return }
    showToast('ok', 'Periodo asignado')
    setShowModal(false)
    const pRes  = await fetch(`${API}/api/planificacion/course/${selCourse.id}?slot=${activeSlot}`, { headers: auth() })
    const pData = await pRes.json()
    if (pRes.ok) setPlans(prev => ({ ...prev, [selCourse.id]: pData.plans || [] }))
  }

  const totalPeriodos = Object.values(plans).reduce((a, b) => a + b.length, 0)
  const hasPlan = totalPeriodos > 0
  const morning   = courses.filter(c => c.shift === 'MORNING')
  const afternoon = courses.filter(c => c.shift === 'AFTERNOON')

  const renderCourseGrid = (course: Course) => {
    const ss          = getSchoolSch(course.shift)
    const coursePlans = plans[course.id] || []
    const courseTscs  = tscs[course.id]  || []
    const days        = course.level === 'SECUNDARIA' ? [1,2,3,4,5,6] : [1,2,3,4,5]
    const totalP      = ss?.periods || 7
    const breakP      = ss?.breakAfter?.split(',').map(Number) || []
    const periodTimes = calcPeriodos(ss)
    const slotCol     = SLOT_COLORS[activeSlot]

    const getCell = (day: number, period: number) =>
      coursePlans.find(p => p.dayOfWeek === day && p.period === period)

    const asignadosPorTsc = (tscId: number) =>
      coursePlans.filter(p => p.teacherSubjectCourse.id === tscId).length

    const resumen = courseTscs.map(t => ({
      ...t,
      asignados: asignadosPorTsc(t.id),
      completo:  t.maxPeriodos > 0 && asignadosPorTsc(t.id) >= t.maxPeriodos,
    }))

    const totalAsig = resumen.reduce((s,t) => s + t.asignados, 0)
    const totalMax  = resumen.reduce((s,t) => s + t.maxPeriodos, 0)
    const pct       = totalMax > 0 ? Math.round((totalAsig/totalMax)*100) : 0

    return (
      <div key={course.id} style={{background:'#fff',border:`1px solid ${slotCol.border}`,borderRadius:12,overflow:'hidden',marginBottom:20}}>
        <div style={{padding:'10px 16px',background:slotCol.bg,borderBottom:`1px solid ${slotCol.border}`,display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:8}}>
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            <span style={{fontWeight:700,fontSize:14,color:slotCol.text}}>
              {GRADES[course.grade]} &quot;{course.parallel}&quot;
            </span>
            <span style={{fontSize:11,background:slotCol.badge+'22',color:slotCol.badge,padding:'2px 8px',borderRadius:20,fontWeight:600}}>
              {SHIFTS[course.shift]}
            </span>
            <span style={{fontSize:11,color:'#6B8BB0'}}>{course.level}</span>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            <span style={{fontSize:12,color:pct===100?'#0F6E56':'#BA7517',fontWeight:600}}>
              {totalAsig}/{totalMax}P ({pct}%)
            </span>
            <div style={{width:80,height:6,background:'#E0ECF8',borderRadius:3,overflow:'hidden'}}>
              <div style={{height:'100%',width:`${pct}%`,background:pct===100?'#0F6E56':pct>=60?'#BA7517':'#1A3A7C',borderRadius:3}}/>
            </div>
          </div>
        </div>

        <div style={{overflowX:'auto'}}>
          <table style={{borderCollapse:'collapse',width:'100%',minWidth:500}}>
            <thead>
              <tr>
                <th style={{...thStyle,width:70,fontSize:10}}>P</th>
                {days.map(d => <th key={d} style={{...thStyle,fontSize:10}}>{DAYS[d].slice(0,3)}</th>)}
              </tr>
            </thead>
            <tbody>
              {Array.from({length:totalP},(_,i)=>i+1).map(period => {
                const pt = periodTimes[period-1] || { startTime:'', endTime:'' }
                const tieneRecreo = breakP.includes(period)
                return (
                  <React.Fragment key={period}>
                    <tr>
                      <td style={{...tdStyle,textAlign:'center',background:'#F8FBFF',fontSize:10,whiteSpace:'nowrap',fontWeight:700}}>
                        <div style={{color:'#1A3A7C'}}>P{period}</div>
                        <div style={{fontSize:9,color:'#6B8BB0',fontWeight:400}}>{pt.startTime}</div>
                      </td>
                      {days.map(day => {
                        const cell  = getCell(day, period)
                        const campo = cell?.teacherSubjectCourse?.subject?.campo
                        return (
                          <td key={day} style={{
                            ...tdStyle,
                            background: cell ? slotCol.bg : '#FAFCFF',
                            borderColor: cell ? slotCol.border : '#E0EAF5',
                            borderStyle: cell ? 'solid' : 'dashed',
                            minWidth: 80,
                            cursor: editMode ? 'default' : 'pointer',
                          }}
                            onClick={() => {
                              if (editMode) return
                              if (!cell) {
                                const pt = periodTimes[period-1] || { startTime:'', endTime:'' }
                                setSelCourse(course)
                                setSelCell({ day, period, startTime: pt.startTime, endTime: pt.endTime })
                                setSelTsc('')
                                setShowModal(true)
                              }
                            }}>
                            {cell ? (
                              <div style={{position:'relative',padding:'1px 0'}}>
                                <div style={{fontSize:9,fontWeight:700,color:campo?CAMPO_COLOR[campo]:slotCol.text,lineHeight:1.3}}>
                                  {SUBJECT_EMOJI[cell.teacherSubjectCourse.subject.name] || '📚'}{' '}
                                  {cell.teacherSubjectCourse.subject.name.slice(0,12)}
                                </div>
                                <div style={{fontSize:9,color:'#6B8BB0'}}>
                                  {cell.teacherSubjectCourse.teacher.lastName}
                                </div>
                                {editMode && (
                                  <button
                                    onClick={e => { e.stopPropagation(); handleDeletePeriod(cell.id, course.id) }}
                                    style={{
                                      position:'absolute',top:-2,right:-2,
                                      background:'#C0392B',border:'none',borderRadius:'50%',
                                      cursor:'pointer',color:'#fff',width:14,height:14,
                                      display:'flex',alignItems:'center',justifyContent:'center',
                                      fontSize:9,lineHeight:1,
                                    }}>×</button>
                                )}
                              </div>
                            ) : (
                              <div style={{textAlign:'center',color:'#D0E4F0',fontSize:14}}>
                                {editMode ? '' : '+'}
                              </div>
                            )}
                          </td>
                        )
                      })}
                    </tr>
                    {tieneRecreo && (
                      <tr>
                        <td colSpan={days.length+1} style={{
                          padding:'3px 8px',background:'#D0EFFF',
                          borderTop:'1px solid #4A9FD4',borderBottom:'1px solid #4A9FD4',
                          textAlign:'center',fontSize:9,color:'#1A5F8A',fontWeight:700,
                        }}>
                          ☕ Recreo — {ss?.breakDuration} min
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

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
      <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:20,flexWrap:'wrap'}}>
        <button onClick={()=>router.push('/dashboard/admin/horarios')}
          style={{display:'flex',alignItems:'center',gap:6,background:'none',border:'none',cursor:'pointer',color:'#6B8BB0',fontSize:13}}>
          <ArrowLeft size={16}/> Volver
        </button>
        <div style={{flex:1}}>
          <h1 style={{fontSize:20,fontWeight:700,color:'#1A3A7C',margin:0}}>Planificación Global de Horarios</h1>
          <p style={{fontSize:13,color:'#6B8BB0',margin:0}}>Genera y compara prototipos de horario antes de publicar</p>
        </div>
        <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
          <button onClick={()=>router.push('/dashboard/admin/horarios/planificacion/maestros')}
            style={{display:'flex',alignItems:'center',gap:7,padding:'9px 16px',background:'#fff',color:'#1A3A7C',border:'1.5px solid #CBE0F0',borderRadius:8,fontSize:13,fontWeight:600,cursor:'pointer'}}>
            <Users size={14}/> Vista Maestros
          </button>
          {hasPlan && (
            <>
              <button onClick={()=>setEditMode(!editMode)} style={{
                display:'flex',alignItems:'center',gap:7,padding:'9px 16px',
                background:editMode?'#1A3A7C':'#F0F6FC',
                color:editMode?'#fff':'#1A3A7C',
                border:`1.5px solid ${editMode?'#1A3A7C':'#CBE0F0'}`,
                borderRadius:8,fontSize:13,fontWeight:600,cursor:'pointer'
              }}>
                <Edit2 size={14}/> {editMode?'✅ Salir edición':'✏️ Editar'}
              </button>
              <button onClick={()=>setShowPromote(true)}
                style={{display:'flex',alignItems:'center',gap:7,padding:'9px 16px',background:'#0F6E56',color:'#fff',border:'none',borderRadius:8,fontSize:13,fontWeight:600,cursor:'pointer'}}>
                ✅ Promover a Oficial
              </button>
            </>
          )}
          <button onClick={()=>setShowParams(true)} disabled={generating}
            style={{display:'flex',alignItems:'center',gap:7,padding:'9px 16px',background:'#8B1A7C',color:'#fff',border:'none',borderRadius:8,fontSize:13,fontWeight:600,cursor:'pointer',opacity:generating?0.6:1}}>
            <Zap size={14}/> {generating?'Generando...':'⚡ Generar'}
          </button>
        </div>
      </div>

      {/* Selector de slots */}
      <div style={{background:'#fff',border:'1px solid #CBE0F0',borderRadius:12,padding:'14px 18px',marginBottom:16}}>
        <div style={{fontSize:11,fontWeight:700,color:'#1A3A7C',textTransform:'uppercase',letterSpacing:'.5px',marginBottom:10}}>
          Planificaciones guardadas
        </div>
        <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
          {(['TEMP','A','B'] as const).map(slot => {
            const col      = SLOT_COLORS[slot]
            const count    = slotsStatus[slot]
            const isActive = activeSlot === slot
            return (
              <div key={slot} style={{
                border:`2px solid ${isActive ? col.badge : '#CBE0F0'}`,
                borderRadius:10, padding:'10px 16px', cursor:'pointer',
                background: isActive ? col.bg : '#fff',
                minWidth:160,
              }}
                onClick={() => handleSlotChange(slot)}>
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:4}}>
                  <span style={{fontWeight:700,fontSize:13,color:isActive?col.text:'#6B8BB0'}}>
                    {slot === 'TEMP' ? '⏳ Temporal' : `📋 Slot ${slot}`}
                  </span>
                  {count > 0 && slot !== 'TEMP' && (
                    <button onClick={e=>{e.stopPropagation();handleClearSlot(slot)}}
                      style={{background:'none',border:'none',cursor:'pointer',color:'#C0392B',padding:2}}>
                      <Trash2 size={12}/>
                    </button>
                  )}
                </div>
                <div style={{fontSize:12,color:'#6B8BB0'}}>
                  {count > 0 ? `${count} periodos` : 'Vacío'}
                </div>
                {isActive && (
                  <div style={{fontSize:10,color:col.badge,fontWeight:600,marginTop:4}}>● Viendo ahora</div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {loading ? (
        <div style={{display:'flex',justifyContent:'center',padding:48}}><div className="spinner"/></div>
      ) : (
        <>
          {!hasPlan && (
            <div style={{background:'#fff',border:'1px dashed #CBE0F0',borderRadius:12,padding:48,textAlign:'center',color:'#6B8BB0'}}>
              <div style={{fontSize:40,marginBottom:12}}>📅</div>
              <p style={{fontSize:14,fontWeight:600,color:'#1A3A7C',marginBottom:6}}>
                {activeSlot === 'TEMP' ? 'Sin planificación generada' : `Slot ${activeSlot} vacío`}
              </p>
              <p style={{fontSize:13,marginBottom:20}}>
                {activeSlot === 'TEMP'
                  ? 'Genera una planificación para ver el prototipo de horario'
                  : 'Genera una planificación y guárdala en este slot'}
              </p>
              <button onClick={()=>setShowParams(true)}
                style={{padding:'10px 24px',background:'#8B1A7C',color:'#fff',border:'none',borderRadius:8,fontSize:13,fontWeight:600,cursor:'pointer'}}>
                ⚡ Generar Planificación
              </button>
            </div>
          )}

          {hasPlan && (
            <>
              <div style={{
                background:SLOT_COLORS[activeSlot].bg,
                border:`1px solid ${SLOT_COLORS[activeSlot].border}`,
                borderRadius:8,padding:'8px 16px',marginBottom:16,fontSize:12,
                color:SLOT_COLORS[activeSlot].text,
                display:'flex',gap:20,flexWrap:'wrap',alignItems:'center'
              }}>
                <span>📊 <strong>{totalPeriodos}</strong> periodos</span>
                <span>🏫 <strong>{courses.length}</strong> cursos</span>
                <span>⚙️ <strong>{periodosConsecutivos}</strong> consec. · máx <strong>{maxPorDia}</strong>/día · P<strong>{maxPeriodo}</strong> · base <strong>{porcentajeBase}%</strong></span>
                {activeSlot === 'TEMP' && slotsStatus.TEMP > 0 ? (
                  <button onClick={()=>setShowSaveModal(true)} style={{
                    marginLeft:'auto',display:'flex',alignItems:'center',gap:6,
                    padding:'6px 14px',background:'#1A3A7C',color:'#fff',
                    border:'none',borderRadius:8,fontSize:12,fontWeight:600,cursor:'pointer'
                  }}>
                    💾 Guardar en Slot A o B
                  </button>
                ) : (
                  <span style={{marginLeft:'auto',fontWeight:700,color:SLOT_COLORS[activeSlot].text}}>
                    📋 Slot {activeSlot}
                  </span>
                )}
              </div>

              {morning.length > 0 && (
                <div style={{marginBottom:8}}>
                  <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:12}}>
                    <span style={{fontSize:14,fontWeight:700,color:'#BA7517'}}>☀️ Turno Mañana</span>
                  </div>
                  <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(480px,1fr))',gap:16}}>
                    {morning.map(c => renderCourseGrid(c))}
                  </div>
                </div>
              )}
              {afternoon.length > 0 && (
                <div>
                  <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:12}}>
                    <span style={{fontSize:14,fontWeight:700,color:'#1A3A7C'}}>🌙 Turno Tarde / BTH</span>
                  </div>
                  <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(480px,1fr))',gap:16}}>
                    {afternoon.map(c => renderCourseGrid(c))}
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* Modal parámetros */}
      {showParams && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.45)',zIndex:500,display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
          <div style={{background:'#fff',borderRadius:14,width:'100%',maxWidth:440,maxHeight:'90vh',overflow:'auto',boxShadow:'0 20px 60px rgba(0,0,0,.2)'}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'16px 20px',borderBottom:'1px solid #CBE0F0'}}>
              <div>
                <h3 style={{fontSize:15,fontWeight:700,color:'#1A3A7C',margin:0}}>⚡ Parámetros de Generación</h3>
                <p style={{fontSize:12,color:'#6B8BB0',margin:'2px 0 0'}}>Cada generación produce una distribución diferente</p>
              </div>
              <button onClick={()=>setShowParams(false)} style={{background:'none',border:'none',cursor:'pointer',color:'#6B8BB0'}}>
                <X size={18}/>
              </button>
            </div>
            <div style={{padding:20,display:'flex',flexDirection:'column',gap:16}}>

              {/* Periodos consecutivos */}
              <div style={{display:'flex',flexDirection:'column',gap:6}}>
                <label style={{fontSize:11,fontWeight:700,color:'#1A3A7C',textTransform:'uppercase',letterSpacing:'.5px'}}>
                  Periodos consecutivos por materia
                </label>
                <div style={{display:'flex',gap:8}}>
                  {[1,2,3].map(v => (
                    <button key={v} onClick={()=>setPeriodosConsecutivos(v)} style={{
                      flex:1,padding:'10px',border:`2px solid ${periodosConsecutivos===v?'#1A3A7C':'#CBE0F0'}`,
                      borderRadius:8,fontSize:13,fontWeight:600,cursor:'pointer',
                      background:periodosConsecutivos===v?'#1A3A7C':'#fff',
                      color:periodosConsecutivos===v?'#fff':'#1A3A7C',
                    }}>
                      {v} {v===1?'periodo':'seguidos'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Máximo por día */}
              <div style={{display:'flex',flexDirection:'column',gap:6}}>
                <label style={{fontSize:11,fontWeight:700,color:'#1A3A7C',textTransform:'uppercase',letterSpacing:'.5px'}}>
                  Máximo periodos por día por materia
                </label>
                <div style={{display:'flex',gap:8}}>
                  {[1,2,3,4].map(v => (
                    <button key={v} onClick={()=>setMaxPorDia(v)} style={{
                      flex:1,padding:'10px',border:`2px solid ${maxPorDia===v?'#0F6E56':'#CBE0F0'}`,
                      borderRadius:8,fontSize:13,fontWeight:600,cursor:'pointer',
                      background:maxPorDia===v?'#0F6E56':'#fff',
                      color:maxPorDia===v?'#fff':'#1A3A7C',
                    }}>
                      {v}
                    </button>
                  ))}
                </div>
              </div>

              {/* Periodos máximos */}
              <div style={{display:'flex',flexDirection:'column',gap:6}}>
                <label style={{fontSize:11,fontWeight:700,color:'#1A3A7C',textTransform:'uppercase',letterSpacing:'.5px'}}>
                  Periodos a usar por día
                </label>
                <div style={{display:'flex',gap:8}}>
                  {[6,7].map(v => (
                    <button key={v} onClick={()=>setMaxPeriodo(v)} style={{
                      flex:1,padding:'10px',border:`2px solid ${maxPeriodo===v?'#633806':'#CBE0F0'}`,
                      borderRadius:8,fontSize:13,fontWeight:600,cursor:'pointer',
                      background:maxPeriodo===v?'#633806':'#fff',
                      color:maxPeriodo===v?'#fff':'#1A3A7C',
                    }}>
                      {v} periodos {v===7?'(+extra)':''}
                    </button>
                  ))}
                </div>
                <span style={{fontSize:11,color:'#6B8BB0'}}>
                  {maxPeriodo===6 ? 'P7 libre — solo para ajuste manual posterior' : 'P7 disponible para completar materias sin espacio'}
                </span>
              </div>

              {/* Porcentaje base */}
              <div style={{display:'flex',flexDirection:'column',gap:6}}>
                <label style={{fontSize:11,fontWeight:700,color:'#1A3A7C',textTransform:'uppercase',letterSpacing:'.5px'}}>
                  % base garantizado por materia — Fase 1
                </label>
                <div style={{display:'flex',gap:8}}>
                  {[60,70,80,90].map(v => (
                    <button key={v} onClick={()=>setPorcentajeBase(v)} style={{
                      flex:1,padding:'10px',border:`2px solid ${porcentajeBase===v?'#8B1A7C':'#CBE0F0'}`,
                      borderRadius:8,fontSize:13,fontWeight:600,cursor:'pointer',
                      background:porcentajeBase===v?'#8B1A7C':'#fff',
                      color:porcentajeBase===v?'#fff':'#1A3A7C',
                    }}>
                      {v}%
                    </button>
                  ))}
                </div>
                <span style={{fontSize:11,color:'#6B8BB0'}}>
                  Fase 1: {porcentajeBase}% equitativo para todas · Fase 2: {100-porcentajeBase}% restante priorizando más pendientes
                </span>
              </div>

              <div style={{background:'#F0F6FC',border:'1px solid #CBE0F0',borderRadius:8,padding:'10px 12px',fontSize:12,color:'#6B8BB0'}}>
                💡 El resultado se guardará en <strong>Temporal</strong>. Puedes guardarlo en Slot A o B después de revisarlo. El horario oficial publicado <strong>no se verá afectado</strong>.
              </div>
            </div>
            <div style={{display:'flex',justifyContent:'flex-end',gap:10,padding:'12px 20px',borderTop:'1px solid #CBE0F0'}}>
              <button onClick={()=>setShowParams(false)}
                style={{padding:'8px 16px',background:'#fff',border:'1.5px solid #CBE0F0',borderRadius:8,fontSize:13,cursor:'pointer',color:'#1A3A7C'}}>
                Cancelar
              </button>
              <button onClick={handleGenerate} disabled={generating}
                style={{display:'flex',alignItems:'center',gap:6,padding:'8px 18px',background:'#8B1A7C',color:'#fff',border:'none',borderRadius:8,fontSize:13,fontWeight:600,cursor:'pointer'}}>
                <Zap size={13}/> Generar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal guardar en slot */}
      {showSaveModal && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.45)',zIndex:500,display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
          <div style={{background:'#fff',borderRadius:14,width:'100%',maxWidth:380,boxShadow:'0 20px 60px rgba(0,0,0,.2)'}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'16px 20px',borderBottom:'1px solid #CBE0F0'}}>
              <div>
                <h3 style={{fontSize:15,fontWeight:700,color:'#1A3A7C',margin:0}}>💾 Guardar Planificación</h3>
                <p style={{fontSize:12,color:'#6B8BB0',margin:'2px 0 0'}}>Elige dónde guardar para poder comparar después</p>
              </div>
              <button onClick={()=>setShowSaveModal(false)} style={{background:'none',border:'none',cursor:'pointer',color:'#6B8BB0'}}>
                <X size={18}/>
              </button>
            </div>
            <div style={{padding:20,display:'flex',flexDirection:'column',gap:12}}>
              <p style={{fontSize:13,color:'#6B8BB0',margin:0}}>
                Guarda esta planificación en un slot para compararla con otras generaciones. Genera de nuevo y guarda en el otro slot para comparar.
              </p>
              <div style={{display:'flex',gap:10}}>
                <button onClick={()=>handleSaveSlot('A')} disabled={saving} style={{
                  flex:1,padding:'14px 12px',border:`2px solid ${SLOT_COLORS.A.border}`,
                  borderRadius:8,fontSize:13,fontWeight:700,cursor:'pointer',
                  background:SLOT_COLORS.A.bg,color:SLOT_COLORS.A.text,
                  display:'flex',flexDirection:'column',alignItems:'center',gap:4,
                }}>
                  <span>📋 Slot A</span>
                  <span style={{fontSize:10,fontWeight:400,color:'#6B8BB0'}}>
                    {slotsStatus.A > 0 ? `${slotsStatus.A} periodos (reemplazar)` : 'Vacío'}
                  </span>
                </button>
                <button onClick={()=>handleSaveSlot('B')} disabled={saving} style={{
                  flex:1,padding:'14px 12px',border:`2px solid ${SLOT_COLORS.B.border}`,
                  borderRadius:8,fontSize:13,fontWeight:700,cursor:'pointer',
                  background:SLOT_COLORS.B.bg,color:SLOT_COLORS.B.text,
                  display:'flex',flexDirection:'column',alignItems:'center',gap:4,
                }}>
                  <span>📋 Slot B</span>
                  <span style={{fontSize:10,fontWeight:400,color:'#6B8BB0'}}>
                    {slotsStatus.B > 0 ? `${slotsStatus.B} periodos (reemplazar)` : 'Vacío'}
                  </span>
                </button>
              </div>
            </div>
            <div style={{display:'flex',justifyContent:'flex-end',padding:'12px 20px',borderTop:'1px solid #CBE0F0'}}>
              <button onClick={()=>setShowSaveModal(false)}
                style={{padding:'8px 16px',background:'#fff',border:'1.5px solid #CBE0F0',borderRadius:8,fontSize:13,cursor:'pointer',color:'#1A3A7C'}}>
                Solo ver por ahora
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal promover */}
      {showPromote && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.45)',zIndex:500,display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
          <div style={{background:'#fff',borderRadius:14,width:'100%',maxWidth:380,boxShadow:'0 20px 60px rgba(0,0,0,.2)'}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'16px 20px',borderBottom:'1px solid #CBE0F0'}}>
              <div>
                <h3 style={{fontSize:15,fontWeight:700,color:'#1A3A7C',margin:0}}>✅ Promover a Horario Oficial</h3>
                <p style={{fontSize:12,color:'#6B8BB0',margin:'2px 0 0'}}>¿Qué slot quieres promover?</p>
              </div>
              <button onClick={()=>setShowPromote(false)} style={{background:'none',border:'none',cursor:'pointer',color:'#6B8BB0'}}>
                <X size={18}/>
              </button>
            </div>
            <div style={{padding:20,display:'flex',flexDirection:'column',gap:10}}>
              <div style={{background:'#FFF0F0',border:'1px solid #FFBBBB',borderRadius:8,padding:'10px 12px',fontSize:12,color:'#C0392B'}}>
                ⚠️ Esto reemplazará los borradores actuales del horario oficial. Se pedirá doble confirmación.
              </div>
              {(['TEMP','A','B'] as const).map(slot => {
                const count = slotsStatus[slot]
                const col   = SLOT_COLORS[slot]
                if (count === 0) return null
                return (
                  <button key={slot} onClick={()=>handlePromote(slot)} disabled={promoting} style={{
                    padding:'12px 16px',border:`2px solid ${col.border}`,
                    borderRadius:8,fontSize:13,fontWeight:600,cursor:'pointer',
                    background:col.bg,color:col.text,textAlign:'left',
                    display:'flex',justifyContent:'space-between',alignItems:'center',
                  }}>
                    <span>{slot==='TEMP'?'⏳ Temporal':`📋 Slot ${slot}`}</span>
                    <span style={{fontSize:11,fontWeight:400,color:'#6B8BB0'}}>{count} periodos</span>
                  </button>
                )
              })}
              {slotsStatus.TEMP === 0 && slotsStatus.A === 0 && slotsStatus.B === 0 && (
                <p style={{fontSize:13,color:'#6B8BB0',textAlign:'center'}}>No hay planificaciones guardadas</p>
              )}
            </div>
            <div style={{display:'flex',justifyContent:'flex-end',padding:'12px 20px',borderTop:'1px solid #CBE0F0'}}>
              <button onClick={()=>setShowPromote(false)}
                style={{padding:'8px 16px',background:'#fff',border:'1.5px solid #CBE0F0',borderRadius:8,fontSize:13,cursor:'pointer',color:'#1A3A7C'}}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal asignar periodo */}
      {showModal && selCell && selCourse && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.45)',zIndex:500,display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
          <div style={{background:'#fff',borderRadius:14,width:'100%',maxWidth:440,boxShadow:'0 20px 60px rgba(0,0,0,.2)'}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'16px 20px',borderBottom:'1px solid #CBE0F0'}}>
              <div>
                <h3 style={{fontSize:15,fontWeight:700,color:'#1A3A7C',margin:0}}>Asignar Periodo</h3>
                <p style={{fontSize:12,color:'#6B8BB0',margin:'2px 0 0'}}>
                  {GRADES[selCourse.grade]} &quot;{selCourse.parallel}&quot; · {DAYS[selCell.day]} · P{selCell.period}
                </p>
              </div>
              <button onClick={()=>setShowModal(false)} style={{background:'none',border:'none',cursor:'pointer',color:'#6B8BB0'}}>
                <X size={18}/>
              </button>
            </div>
            <div style={{padding:20}}>
              <label style={{fontSize:11,fontWeight:700,color:'#1A3A7C',textTransform:'uppercase',letterSpacing:'.5px',display:'block',marginBottom:8}}>
                Materia / Maestro
              </label>
              <select value={selTsc} onChange={e=>setSelTsc(e.target.value)}
                style={{width:'100%',padding:'10px 12px',border:'1.5px solid #CBE0F0',borderRadius:8,fontSize:13,color:'#1A3A7C',outline:'none'}}>
                <option value="">-- Selecciona materia --</option>
                {(tscs[selCourse.id] || []).map(t => (
                  <option key={t.id} value={t.id}>
                    {t.subject.name} — {t.teacher.lastName}
                  </option>
                ))}
              </select>
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

      <style>{`
        .spinner{width:24px;height:24px;border:2px solid rgba(26,58,124,.2);border-top-color:#1A3A7C;border-radius:50%;animation:spin .7s linear infinite}
        @keyframes spin{to{transform:rotate(360deg)}}
      `}</style>
    </div>
  )
}

const thStyle: React.CSSProperties = {
  padding:'6px 8px',background:'#F0F6FC',fontSize:11,fontWeight:700,
  color:'#1A3A7C',textAlign:'center',border:'1px solid #CBE0F0',
}
const tdStyle: React.CSSProperties = {
  padding:'4px 6px',border:'1px solid #CBE0F0',verticalAlign:'middle',fontSize:11,
}