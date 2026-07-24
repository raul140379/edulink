'use client'

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Zap, Trash2, Save, Edit2, Users } from 'lucide-react'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import { useConfirm } from '@/components/ui/ConfirmProvider'
import { useToast } from '@/components/ui/ToastProvider'

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
  const router  = useRouter()
  const confirm = useConfirm()
  const toast   = useToast()

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
      if (!res.ok) { toast(data.message, 'error'); return }
      toast(`${data.message}${data.errors?.length > 0 ? ` · ${data.errors.length} sin espacio` : ''}`, 'success')
      setActiveSlot('TEMP')
      await loadPlansForSlot('TEMP', courses)
      await loadSlotsStatus()
      setShowSaveModal(true)
    } catch { toast('Error de conexión', 'error') }
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
      if (!res.ok) { toast(data.message, 'error'); return }
      toast(data.message, 'success')
      setShowSaveModal(false)
      await loadSlotsStatus()
    } catch { toast('Error de conexión', 'error') }
    finally { setSaving(false) }
  }

  const handleClearSlot = async (slot: string) => {
    if (!await confirm(`¿Eliminar la planificación del Slot ${slot}?`, { danger: true })) return
    try {
      const res  = await fetch(`${API}/api/planificacion/slot/${slot}`, { method: 'DELETE', headers: auth() })
      const data = await res.json()
      if (!res.ok) { toast(data.message, 'error'); return }
      toast(data.message, 'success')
      if (activeSlot === slot) {
        setPlans({})
        setActiveSlot('TEMP')
      }
      await loadSlotsStatus()
    } catch { toast('Error de conexión', 'error') }
  }

  const handlePromote = async (slot: 'TEMP'|'A'|'B') => {
    if (!await confirm(`¿Promover Slot ${slot} al horario oficial? Esta acción reemplazará los borradores actuales.`, { danger: true })) return
    if (!await confirm('⚠️ CONFIRMACIÓN FINAL — ¿Estás seguro? Esta acción no se puede deshacer.', { danger: true, confirmLabel: 'Sí, promover' })) return
    setPromoting(true)
    try {
      const res  = await fetch(`${API}/api/planificacion/promote`, {
        method: 'POST',
        headers: { ...auth(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ slot })
      })
      const data = await res.json()
      if (!res.ok) { toast(data.message, 'error'); return }
      toast(data.message, 'success')
      setShowPromote(false)
    } catch { toast('Error de conexión', 'error') }
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
    if (!res.ok) { toast(data.message, 'error'); return }
    toast('Periodo asignado', 'success')
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
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <button onClick={()=>router.push('/dashboard/admin/horarios')} className="flex items-center gap-1.5 text-neutral-500 hover:text-brand-700 text-[13px]">
          <ArrowLeft size={16}/> Volver
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-brand-700 m-0">Planificación Global de Horarios</h1>
          <p className="text-[13px] text-neutral-500 m-0">Genera y compara prototipos de horario antes de publicar</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="secondary" onClick={()=>router.push('/dashboard/admin/horarios/planificacion/maestros')}>
            <Users size={14}/> Vista Maestros
          </Button>
          {hasPlan && (
            <>
              <Button variant={editMode ? 'primary' : 'secondary'} onClick={()=>setEditMode(!editMode)}>
                <Edit2 size={14}/> {editMode?'✅ Salir edición':'✏️ Editar'}
              </Button>
              <Button className="!bg-success-700 !border-success-700" onClick={()=>setShowPromote(true)}>✅ Promover a Oficial</Button>
            </>
          )}
          <Button className="!bg-[#8B1A7C] !border-[#8B1A7C]" onClick={()=>setShowParams(true)} disabled={generating} loading={generating}>
            {!generating && <Zap size={14}/>} {generating?'Generando...':'⚡ Generar'}
          </Button>
        </div>
      </div>

      <Card className="mb-4">
        <div className="text-[11px] font-bold text-brand-700 uppercase tracking-wide mb-2.5">Planificaciones guardadas</div>
        <div className="flex gap-2.5 flex-wrap">
          {(['TEMP','A','B'] as const).map(slot => {
            const col      = SLOT_COLORS[slot]
            const count    = slotsStatus[slot]
            const isActive = activeSlot === slot
            return (
              <div
                key={slot}
                onClick={() => handleSlotChange(slot)}
                className="rounded-[10px] px-4 py-2.5 cursor-pointer"
                style={{ border:`2px solid ${isActive ? col.badge : '#CBE0F0'}`, background: isActive ? col.bg : '#fff', minWidth:160 }}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-[13px]" style={{ color:isActive?col.text:'#6B8BB0' }}>
                    {slot === 'TEMP' ? '⏳ Temporal' : `📋 Slot ${slot}`}
                  </span>
                  {count > 0 && slot !== 'TEMP' && (
                    <button onClick={e=>{e.stopPropagation();handleClearSlot(slot)}} className="text-danger-600 p-0.5">
                      <Trash2 size={12}/>
                    </button>
                  )}
                </div>
                <div className="text-xs text-neutral-500">{count > 0 ? `${count} periodos` : 'Vacío'}</div>
                {isActive && <div className="text-[10px] font-semibold mt-1" style={{ color:col.badge }}>● Viendo ahora</div>}
              </div>
            )
          })}
        </div>
      </Card>

      {loading ? (
        <div className="flex justify-center py-12"><p className="text-sm text-neutral-500">Cargando...</p></div>
      ) : (
        <>
          {!hasPlan && (
            <div className="bg-white border border-dashed border-neutral-300 rounded-xl p-12 text-center text-neutral-500">
              <div className="text-4xl mb-3">📅</div>
              <p className="text-sm font-semibold text-brand-700 mb-1.5">{activeSlot === 'TEMP' ? 'Sin planificación generada' : `Slot ${activeSlot} vacío`}</p>
              <p className="text-[13px] mb-5">
                {activeSlot === 'TEMP'
                  ? 'Genera una planificación para ver el prototipo de horario'
                  : 'Genera una planificación y guárdala en este slot'}
              </p>
              <Button className="!bg-[#8B1A7C] !border-[#8B1A7C]" onClick={()=>setShowParams(true)}>⚡ Generar Planificación</Button>
            </div>
          )}

          {hasPlan && (
            <>
              <div
                className="rounded-lg px-4 py-2 mb-4 text-xs flex gap-5 flex-wrap items-center"
                style={{ background:SLOT_COLORS[activeSlot].bg, border:`1px solid ${SLOT_COLORS[activeSlot].border}`, color:SLOT_COLORS[activeSlot].text }}
              >
                <span>📊 <strong>{totalPeriodos}</strong> periodos</span>
                <span>🏫 <strong>{courses.length}</strong> cursos</span>
                <span>⚙️ <strong>{periodosConsecutivos}</strong> consec. · máx <strong>{maxPorDia}</strong>/día · P<strong>{maxPeriodo}</strong> · base <strong>{porcentajeBase}%</strong></span>
                {activeSlot === 'TEMP' && slotsStatus.TEMP > 0 ? (
                  <Button size="sm" onClick={()=>setShowSaveModal(true)} className="ml-auto">💾 Guardar en Slot A o B</Button>
                ) : (
                  <span className="ml-auto font-bold" style={{ color:SLOT_COLORS[activeSlot].text }}>📋 Slot {activeSlot}</span>
                )}
              </div>

              {morning.length > 0 && (
                <div className="mb-2">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-sm font-bold text-[#BA7517]">☀️ Turno Mañana</span>
                  </div>
                  <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(480px, 1fr))' }}>
                    {morning.map(c => renderCourseGrid(c))}
                  </div>
                </div>
              )}
              {afternoon.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-sm font-bold text-brand-700">🌙 Turno Tarde / BTH</span>
                  </div>
                  <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(480px, 1fr))' }}>
                    {afternoon.map(c => renderCourseGrid(c))}
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}

      <Modal
        open={showParams} onClose={()=>setShowParams(false)} title="⚡ Parámetros de Generación"
        footer={
          <>
            <Button variant="secondary" onClick={()=>setShowParams(false)}>Cancelar</Button>
            <Button className="!bg-[#8B1A7C] !border-[#8B1A7C]" onClick={handleGenerate} disabled={generating}><Zap size={13}/> Generar</Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <p className="text-xs text-neutral-500 -mt-2">Cada generación produce una distribución diferente</p>

          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-bold text-brand-700 uppercase tracking-wide">Periodos consecutivos por materia</label>
            <div className="flex gap-2">
              {[1,2,3].map(v => (
                <button
                  key={v} onClick={()=>setPeriodosConsecutivos(v)}
                  className={`flex-1 py-2.5 rounded-lg text-[13px] font-semibold border-2 ${periodosConsecutivos===v ? 'border-brand-700 bg-brand-700 text-white' : 'border-neutral-300 bg-white text-brand-700'}`}
                >
                  {v} {v===1?'periodo':'seguidos'}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-bold text-brand-700 uppercase tracking-wide">Máximo periodos por día por materia</label>
            <div className="flex gap-2">
              {[1,2,3,4].map(v => (
                <button
                  key={v} onClick={()=>setMaxPorDia(v)}
                  className={`flex-1 py-2.5 rounded-lg text-[13px] font-semibold border-2 ${maxPorDia===v ? 'border-success-700 bg-success-700 text-white' : 'border-neutral-300 bg-white text-brand-700'}`}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-bold text-brand-700 uppercase tracking-wide">Periodos a usar por día</label>
            <div className="flex gap-2">
              {[6,7].map(v => (
                <button
                  key={v} onClick={()=>setMaxPeriodo(v)}
                  className={`flex-1 py-2.5 rounded-lg text-[13px] font-semibold border-2 ${maxPeriodo===v ? 'border-[#633806] bg-[#633806] text-white' : 'border-neutral-300 bg-white text-brand-700'}`}
                >
                  {v} periodos {v===7?'(+extra)':''}
                </button>
              ))}
            </div>
            <span className="text-[11px] text-neutral-500">
              {maxPeriodo===6 ? 'P7 libre — solo para ajuste manual posterior' : 'P7 disponible para completar materias sin espacio'}
            </span>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-bold text-brand-700 uppercase tracking-wide">% base garantizado por materia — Fase 1</label>
            <div className="flex gap-2">
              {[60,70,80,90].map(v => (
                <button
                  key={v} onClick={()=>setPorcentajeBase(v)}
                  className={`flex-1 py-2.5 rounded-lg text-[13px] font-semibold border-2 ${porcentajeBase===v ? 'border-[#8B1A7C] bg-[#8B1A7C] text-white' : 'border-neutral-300 bg-white text-brand-700'}`}
                >
                  {v}%
                </button>
              ))}
            </div>
            <span className="text-[11px] text-neutral-500">
              Fase 1: {porcentajeBase}% equitativo para todas · Fase 2: {100-porcentajeBase}% restante priorizando más pendientes
            </span>
          </div>

          <div className="bg-neutral-100 border border-neutral-300 rounded-lg px-3 py-2.5 text-xs text-neutral-500">
            💡 El resultado se guardará en <strong>Temporal</strong>. Puedes guardarlo en Slot A o B después de revisarlo. El horario oficial publicado <strong>no se verá afectado</strong>.
          </div>
        </div>
      </Modal>

      <Modal
        open={showSaveModal} onClose={()=>setShowSaveModal(false)} title="💾 Guardar Planificación"
        footer={<Button variant="secondary" onClick={()=>setShowSaveModal(false)}>Solo ver por ahora</Button>}
      >
        <div className="flex flex-col gap-3">
          <p className="text-[13px] text-neutral-500 m-0">Guarda esta planificación en un slot para compararla con otras generaciones. Genera de nuevo y guarda en el otro slot para comparar.</p>
          <div className="flex gap-2.5">
            <button
              onClick={()=>handleSaveSlot('A')} disabled={saving}
              className="flex-1 py-3.5 px-3 rounded-lg text-[13px] font-bold flex flex-col items-center gap-1 border-2"
              style={{ borderColor:SLOT_COLORS.A.border, background:SLOT_COLORS.A.bg, color:SLOT_COLORS.A.text }}
            >
              <span>📋 Slot A</span>
              <span className="text-[10px] font-normal text-neutral-500">{slotsStatus.A > 0 ? `${slotsStatus.A} periodos (reemplazar)` : 'Vacío'}</span>
            </button>
            <button
              onClick={()=>handleSaveSlot('B')} disabled={saving}
              className="flex-1 py-3.5 px-3 rounded-lg text-[13px] font-bold flex flex-col items-center gap-1 border-2"
              style={{ borderColor:SLOT_COLORS.B.border, background:SLOT_COLORS.B.bg, color:SLOT_COLORS.B.text }}
            >
              <span>📋 Slot B</span>
              <span className="text-[10px] font-normal text-neutral-500">{slotsStatus.B > 0 ? `${slotsStatus.B} periodos (reemplazar)` : 'Vacío'}</span>
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        open={showPromote} onClose={()=>setShowPromote(false)} title="✅ Promover a Horario Oficial"
        footer={<Button variant="secondary" onClick={()=>setShowPromote(false)}>Cancelar</Button>}
      >
        <div className="flex flex-col gap-2.5">
          <p className="text-xs text-neutral-500 -mt-2">¿Qué slot quieres promover?</p>
          <div className="bg-danger-100 border border-danger-500/40 rounded-lg px-3 py-2.5 text-xs text-danger-600">
            ⚠️ Esto reemplazará los borradores actuales del horario oficial. Se pedirá doble confirmación.
          </div>
          {(['TEMP','A','B'] as const).map(slot => {
            const count = slotsStatus[slot]
            const col   = SLOT_COLORS[slot]
            if (count === 0) return null
            return (
              <button
                key={slot} onClick={()=>handlePromote(slot)} disabled={promoting}
                className="px-4 py-3 rounded-lg text-[13px] font-semibold text-left flex justify-between items-center border-2"
                style={{ borderColor:col.border, background:col.bg, color:col.text }}
              >
                <span>{slot==='TEMP'?'⏳ Temporal':`📋 Slot ${slot}`}</span>
                <span className="text-[11px] font-normal text-neutral-500">{count} periodos</span>
              </button>
            )
          })}
          {slotsStatus.TEMP === 0 && slotsStatus.A === 0 && slotsStatus.B === 0 && (
            <p className="text-[13px] text-neutral-500 text-center">No hay planificaciones guardadas</p>
          )}
        </div>
      </Modal>

      <Modal
        open={showModal && !!selCell && !!selCourse} onClose={()=>setShowModal(false)} title="Asignar Periodo"
        footer={
          <>
            <Button variant="secondary" onClick={()=>setShowModal(false)}>Cancelar</Button>
            <Button onClick={handleAssign} disabled={!selTsc}><Save size={13}/> Asignar</Button>
          </>
        }
      >
        {selCell && selCourse && (
          <div className="flex flex-col gap-2">
            <p className="text-xs text-neutral-500 -mt-2">{GRADES[selCourse.grade]} &quot;{selCourse.parallel}&quot; · {DAYS[selCell.day]} · P{selCell.period}</p>
            <label className="text-[11px] font-bold text-brand-700 uppercase tracking-wide">Materia / Maestro</label>
            <select
              value={selTsc} onChange={e=>setSelTsc(e.target.value)}
              className="w-full px-3 py-2.5 border border-neutral-300 rounded-lg text-[13px] text-brand-700 outline-none"
            >
              <option value="">-- Selecciona materia --</option>
              {(tscs[selCourse.id] || []).map(t => (
                <option key={t.id} value={t.id}>{t.subject.name} — {t.teacher.lastName}</option>
              ))}
            </select>
          </div>
        )}
      </Modal>
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
