'use client'

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Zap, CheckCircle, Trash2, Save, Edit2 } from 'lucide-react'
import Card from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import { useConfirm } from '@/components/ui/ConfirmProvider'
import { useToast } from '@/components/ui/ToastProvider'

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
  COMUNIDAD_SOCIEDAD:            '#0A5A45',
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
  const router  = useRouter()
  const confirm = useConfirm()
  const toast   = useToast()

  const [courses,    setCourses]    = useState<Course[]>([])
  const [selCourse,  setSelCourse]  = useState<Course | null>(null)
  const [selGrade,   setSelGrade]   = useState<string>('')
  const [schedule,   setSchedule]   = useState<ScheduleItem[]>([])
  const [tscs,       setTscs]       = useState<TSC[]>([])
  const [schoolSch,  setSchoolSch]  = useState<any>(null)
  const [loading,    setLoading]    = useState(false)
  const [generating, setGenerating] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [editMode,   setEditMode]   = useState(false)

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

  const GRADE_ORDER = ['PRIMERO','SEGUNDO','TERCERO','CUARTO','QUINTO','SEXTO']
  const gradesWithCourses = GRADE_ORDER.filter(g => courses.some(c => c.grade === g))
  const paralelosDelGrado = courses
    .filter(c => c.grade === selGrade)
    .sort((a, b) => a.parallel.localeCompare(b.parallel))

  const selectGrade = (grade: string) => {
    setSelGrade(grade)
    if (selCourse?.grade !== grade) { setSelCourse(null); setSchedule([]); setTscs([]) }
  }

  const selectParalelo = (c: Course) => {
    setSelCourse(c)
    setSchedule([])
    setTscs([])
  }

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
      if (!res.ok) { toast(data.message, 'error'); return }
      toast(data.message, 'success')
      if (data.errors?.length > 0) {
        setTimeout(() => toast(`⚠️ Sin espacio para: ${data.errors.map((e:any)=>e.subject).join(', ')}`, 'warning'), 1000)
      }
      loadSchedule(); loadTscs()
    } catch { toast('Error de conexión', 'error') }
    finally { setGenerating(false) }
  }

  const handlePublish = async () => {
    if (!selCourse) return
    if (!await confirm('¿Confirmar y publicar este horario?')) return
    setPublishing(true)
    try {
      const res  = await fetch(`${API}/api/schedules/publish/${selCourse.id}`, {
        method: 'POST', headers: auth()
      })
      const data = await res.json()
      if (!res.ok) { toast(data.message, 'error'); return }
      toast(data.message, 'success')
      setEditMode(false)
      loadSchedule()
    } catch { toast('Error de conexión', 'error') }
    finally { setPublishing(false) }
  }

  const handleDeleteDraft = async () => {
    if (!selCourse) return
    if (!await confirm('¿Eliminar el borrador?', { danger: true })) return
    await fetch(`${API}/api/schedules/draft/${selCourse.id}`, { method: 'DELETE', headers: auth() })
    toast('Borrador eliminado', 'success')
    setEditMode(false)
    loadSchedule(); loadTscs()
  }

  const handleDeleteAll = async () => {
    if (!selCourse) return
    if (!await confirm('¿Eliminar TODO el horario de este curso (borradores y publicados)? Esta acción no se puede deshacer.', { danger: true })) return
    try {
      const res  = await fetch(`${API}/api/schedules/course/${selCourse.id}/all`, {
        method: 'DELETE', headers: auth()
      })
      const data = await res.json()
      if (!res.ok) { toast(data.message, 'error'); return }
      toast(data.message, 'success')
      setEditMode(false)
      loadSchedule(); loadTscs()
    } catch { toast('Error de conexión', 'error') }
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
    if (!res.ok) { toast(data.message, 'error'); return }
    toast('Periodo asignado correctamente', 'success')
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
    if (!res.ok) { toast(data.message, 'error'); return }
    toast(selClassroom ? 'Aula asignada correctamente' : 'Aula removida', 'success')
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
    if (!res.ok) { toast(data.message, 'error'); return }
    toast(data.message, 'success')
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
      <div className="flex items-center mb-6 gap-3">
        <div className="flex-1 flex">
          <button onClick={()=>router.push('/dashboard/admin/horarios')} className="flex items-center gap-1.5 text-neutral-500 hover:text-brand-700 text-[13px]">
            <ArrowLeft size={16}/> Volver
          </button>
        </div>

        <div className="flex flex-col items-center gap-2 text-center">
          <div>
            <h1 className="text-xl font-bold text-brand-700 m-0">Horario por Curso</h1>
            <p className="text-[13px] text-neutral-500 m-0">Genera y asigna el horario semanal</p>
          </div>
          {selCourse && (
            <div className="flex items-center gap-2 bg-brand-700 text-white rounded-[10px] px-4 py-2 text-sm font-bold whitespace-nowrap">
              {GRADES[selCourse.grade]} &quot;{selCourse.parallel}&quot;
              <span className="font-medium text-xs text-[#B9CBE8]">· {SHIFTS[selCourse.shift]} · {selCourse.level}{selCourse.educationType==='BTH' ? ' · BTH' : ''}</span>
            </div>
          )}
        </div>

        <div className="flex-1"/>
      </div>

      <Card className="mb-5">
        <label className="text-[11px] font-bold text-brand-700 uppercase tracking-wide block mb-2.5 text-center">Seleccionar Curso</label>

        <div className="flex gap-1.5 flex-wrap justify-center border-b-2 border-neutral-100 pb-2.5 mb-2.5">
          {gradesWithCourses.map(grade => {
            const active = selGrade === grade
            return (
              <button
                key={grade} onClick={() => selectGrade(grade)}
                className={`px-4 py-1.5 rounded-lg text-[13px] font-bold transition-colors ${active ? 'bg-brand-700 text-white' : 'bg-neutral-100 text-neutral-500'}`}
              >
                {GRADES[grade]}
              </button>
            )
          })}
        </div>

        {selGrade && (
          <div className="flex gap-2 flex-wrap items-center justify-center">
            {paralelosDelGrado.map(c => {
              const active = selCourse?.id === c.id
              return (
                <button
                  key={c.id} onClick={() => selectParalelo(c)}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[13px] font-bold text-brand-700 border ${active ? 'border-brand-700 bg-brand-100' : 'border-neutral-300 bg-white'}`}
                >
                  &quot;{c.parallel}&quot;
                  <span className="font-medium text-[11.5px] text-neutral-500">{SHIFTS[c.shift]}{c.educationType==='BTH' ? ' · BTH' : ''}</span>
                </button>
              )
            })}
            {paralelosDelGrado.length === 0 && (
              <span className="text-[12.5px] text-neutral-500">Sin cursos registrados para este grado.</span>
            )}
          </div>
        )}
      </Card>

      {selCourse && (
        <>
          {schoolSch ? (
            <div className="bg-brand-100 border border-neutral-300 rounded-lg px-4 py-2 mb-4 text-xs text-brand-700 flex gap-4 flex-wrap items-center">
              <span>{schoolSch.isWinter?'❄️':'☀️'} <strong>{schoolSch.name}</strong></span>
              <span>Entrada: <strong>{schoolSch.startTime}</strong></span>
              <span>Salida: <strong>{schoolSch.exitTime}</strong></span>
              <span><strong>{schoolSch.periods}</strong> periodos · <strong>{schoolSch.periodDuration}</strong> min/periodo</span>
              <span>☕ <strong>{breakPeriods.length}</strong> recreo{breakPeriods.length!==1?'s':''} × <strong>{schoolSch.breakDuration}</strong> min</span>
            </div>
          ) : (
            <div className="bg-danger-100 border border-danger-500/40 rounded-lg px-4 py-2 mb-4 text-xs text-danger-600">
              ⚠️ No hay horario institucional activo para el turno {SHIFTS[selCourse.shift]}
            </div>
          )}

          <div className="flex gap-2.5 mb-4 flex-wrap items-center">
            <Button className="!bg-[#633806] !border-[#633806]" onClick={handleGenerate} disabled={generating||!schoolSch} loading={generating}>
              {!generating && <Zap size={15}/>} {generating?'Generando...':'⚡ Generar Automático'}
            </Button>

            {hasAny && (
              <>
                <Button variant="secondary" onClick={()=>{ setBulkClassroom(''); setShowBulkClassroomModal(true) }}>🚪 Asignar aula al curso</Button>
                <Button variant={editMode ? 'primary' : 'secondary'} onClick={()=>setEditMode(!editMode)}>
                  <Edit2 size={14}/> {editMode?'✅ Salir de edición':'✏️ Modo edición'}
                </Button>
                <Button variant="danger" onClick={handleDeleteAll}><Trash2 size={14}/> Eliminar Todo</Button>
              </>
            )}

            {hasDraft && (
              <>
                <Button className="!bg-success-700 !border-success-700" onClick={handlePublish} disabled={publishing} loading={publishing}>
                  {!publishing && <CheckCircle size={15}/>} {publishing?'Publicando...':'✅ Publicar'}
                </Button>
                <Button variant="danger" onClick={handleDeleteDraft}><Trash2 size={15}/> Eliminar Borrador</Button>
              </>
            )}
          </div>

          {editMode && (
            <div className="bg-warning-100 border border-warning-500 rounded-lg px-3.5 py-2 mb-3 text-xs text-[#7A6000] flex items-center gap-2">
              ✏️ <strong>Modo edición activo</strong> — haz clic en el <strong>×</strong> de cualquier celda para eliminar ese periodo.
            </div>
          )}

          {totalMaximo > 0 && (
            <Card className="mb-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-bold text-brand-700">Progreso del horario</span>
                <span className="text-xs text-neutral-500">{totalAsignados} / {totalMaximo} periodos ({progresoPct}%)</span>
              </div>
              <div className="h-2 bg-neutral-100 rounded overflow-hidden">
                <div
                  className="h-full rounded transition-[width] duration-300"
                  style={{ width:`${progresoPct}%`, background: progresoPct===100?'#0F6E56':progresoPct>=60?'#BA7517':'#0A5A45' }}
                />
              </div>
            </Card>
          )}

          {resumenMaterias.length > 0 && (
            <Card className="mb-4">
              <div className="text-[11px] font-bold text-brand-700 uppercase tracking-wide mb-2.5">Materias del curso — periodos asignados / máximo</div>
              <div className="flex flex-wrap gap-2">
                {resumenMaterias.map(t => {
                  const campo = t.subject.campo
                  const pct   = t.maxPeriodos > 0 ? (t.asignados / t.maxPeriodos) : 0
                  return (
                    <div
                      key={t.id}
                      className="rounded-lg px-3 py-1.5 text-xs flex items-center gap-1.5"
                      style={{
                        background: t.completo ? '#E1F5EE' : (campo ? CAMPO_BG[campo]||'#F5FAF7' : '#F5FAF7'),
                        border:`1px solid ${t.completo ? '#9FE1CB' : (campo ? CAMPO_COLOR[campo]||'#DCEEE6' : '#DCEEE6')}33`,
                      }}
                    >
                      <span className="font-bold" style={{ color: t.completo?'#0F6E56':(campo?CAMPO_COLOR[campo]:'#0A5A45') }}>
                        {t.completo?'✅ ':''}{t.subject.name}
                      </span>
                      <span className="text-neutral-500 text-[11px]">{t.teacher.lastName}</span>
                      <span
                        className="text-white px-1.5 py-0.5 rounded-[10px] text-[10px] font-bold whitespace-nowrap"
                        style={{ background: t.completo?'#0F6E56':pct>=0.5?'#BA7517':'#0A5A45' }}
                      >
                        {t.asignados}/{t.maxPeriodos}P
                      </span>
                    </div>
                  )
                })}
              </div>
            </Card>
          )}

          <div className="flex gap-4 mb-3 flex-wrap">
            <div className="flex items-center gap-1.5 text-xs text-neutral-500">
              <div className="w-3 h-3 rounded-[3px] bg-[#FFFEF0] border border-warning-500"/> Borrador
            </div>
            <div className="flex items-center gap-1.5 text-xs text-neutral-500">
              <div className="w-3 h-3 rounded-[3px] bg-[#F0FBF5] border border-success-500/40"/> Publicado
            </div>
            <div className="flex items-center gap-1.5 text-xs text-neutral-500">
              <div className="w-3 h-3 rounded-[3px] bg-[#FAFCFF] border border-dashed border-neutral-300"/> Libre
            </div>
            <div className="flex items-center gap-1.5 text-xs text-neutral-500"><span>☕</span> Recreo</div>
            {!editMode && (
              <div className="flex items-center gap-1.5 text-xs text-neutral-500">📍 Clic en celda ocupada → asignar aula</div>
            )}
          </div>

          {loading ? (
            <div className="flex justify-center py-12"><p className="text-sm text-neutral-500">Cargando...</p></div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-neutral-300">
              <table className="border-collapse w-full" style={{ minWidth: 700 }}>
                <thead>
                  <tr>
                    <th style={{...thStyle, width:90}}>Periodo</th>
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
                            <div style={{color:'#0A5A45'}}>P{period}</div>
                            <div style={{fontSize:10,color:'#6B8F7F',fontWeight:400}}>{pt.startTime}</div>
                            <div style={{fontSize:10,color:'#6B8F7F',fontWeight:400}}>{pt.endTime}</div>
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
                                    <div style={{fontSize:11,fontWeight:700,lineHeight:1.3,color:campo?CAMPO_COLOR[campo]:'#0A5A45'}}>
                                      {cell.teacherSubjectCourse.subject.name}
                                    </div>
                                    <div style={{fontSize:10,color:'#6B8F7F',marginTop:1}}>
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

      <Modal
        open={showModal && !!selCell} onClose={()=>setShowModal(false)} title="Asignar Periodo"
        footer={
          <>
            <Button variant="secondary" onClick={()=>setShowModal(false)}>Cancelar</Button>
            <Button onClick={handleAssign} disabled={!selTsc}><Save size={13}/> Asignar</Button>
          </>
        }
      >
        {selCell && (
          <div className="flex flex-col gap-2">
            <p className="text-xs text-neutral-500 -mt-2">{DAYS[selCell.day]} · Periodo {selCell.period} · {selCell.startTime} — {selCell.endTime}</p>
            <label className="text-[11px] font-bold text-brand-700 uppercase tracking-wide block">Materia / Maestro</label>
            <select
              value={selTsc} onChange={e=>setSelTsc(e.target.value)}
              className="w-full px-3 py-2.5 border border-neutral-300 rounded-lg text-[13px] text-brand-700 outline-none"
            >
              <option value="">-- Selecciona materia --</option>
              {resumenMaterias.map(t=>(
                <option key={t.id} value={t.id} disabled={t.completo}>
                  {t.completo?'🚫 ':''}{t.subject.name} — {t.teacher.lastName} ({t.asignados}/{t.maxPeriodos} periodos)
                </option>
              ))}
            </select>
            <p className="text-[11px] text-neutral-500">Las materias con 🚫 ya alcanzaron su máximo de periodos semanales.</p>
          </div>
        )}
      </Modal>

      <Modal
        open={showClassroomModal} onClose={()=>setShowClassroomModal(false)} title="Asignar Aula"
        footer={
          <>
            <Button variant="secondary" onClick={()=>setShowClassroomModal(false)}>Cancelar</Button>
            <Button className="!bg-success-700 !border-success-700" onClick={handleAssignClassroom} disabled={classrooms.length===0}><Save size={13}/> Guardar</Button>
          </>
        }
      >
        <div className="flex flex-col gap-2">
          <p className="text-xs text-neutral-500 -mt-2">Espacio físico para este periodo</p>
          <label className="text-[11px] font-bold text-brand-700 uppercase tracking-wide block">Aula física</label>
          {classrooms.length === 0 ? (
            <div className="p-3 bg-danger-100 rounded-lg text-xs text-danger-600">
              No hay aulas registradas.{' '}
              <span onClick={()=>router.push('/dashboard/admin/horarios/aulas')} className="underline cursor-pointer">Crear aulas aquí</span>
            </div>
          ) : (
            <select
              value={selClassroom} onChange={e=>setSelClassroom(e.target.value)}
              className="w-full px-3 py-2.5 border border-neutral-300 rounded-lg text-[13px] text-brand-700 outline-none"
            >
              <option value="">-- Sin aula asignada --</option>
              {classrooms.map(c=>(
                <option key={c.id} value={c.id}>{c.name}{c.capacity ? ` (cap. ${c.capacity})` : ''}</option>
              ))}
            </select>
          )}
          <p className="text-[11px] text-neutral-500">Selecciona &quot;Sin aula asignada&quot; para quitar el aula de este periodo.</p>
        </div>
      </Modal>

      <Modal
        open={showBulkClassroomModal} onClose={()=>setShowBulkClassroomModal(false)} title="Asignar aula a todo el curso"
        footer={
          <>
            <Button variant="secondary" onClick={()=>setShowBulkClassroomModal(false)}>Cancelar</Button>
            <Button onClick={handleAssignClassroomToAll} disabled={!bulkClassroom||classrooms.length===0}><Save size={13}/> Asignar a todos</Button>
          </>
        }
      >
        <div className="flex flex-col gap-2">
          <p className="text-xs text-neutral-500 -mt-2">Se aplicará a todos los periodos del curso</p>
          <label className="text-[11px] font-bold text-brand-700 uppercase tracking-wide block">Aula física</label>
          {classrooms.length === 0 ? (
            <div className="p-3 bg-danger-100 rounded-lg text-xs text-danger-600">
              No hay aulas registradas.{' '}
              <span onClick={()=>router.push('/dashboard/admin/horarios/aulas')} className="underline cursor-pointer">Crear aulas aquí</span>
            </div>
          ) : (
            <select
              value={bulkClassroom} onChange={e=>setBulkClassroom(e.target.value)}
              className="w-full px-3 py-2.5 border border-neutral-300 rounded-lg text-[13px] text-brand-700 outline-none"
            >
              <option value="">-- Selecciona un aula --</option>
              {classrooms.map(c=>(
                <option key={c.id} value={c.id}>{c.name}{c.capacity ? ` (cap. ${c.capacity})` : ''}</option>
              ))}
            </select>
          )}
          <p className="text-[11px] text-neutral-500">Esto sobreescribirá el aula de todos los periodos del curso.</p>
        </div>
      </Modal>
    </div>
  )
}

const thStyle: React.CSSProperties = {
  padding:'10px 12px', background:'#F5FAF7', fontSize:12, fontWeight:700,
  color:'#0A5A45', textAlign:'center', border:'1px solid #DCEEE6',
}
const tdStyle: React.CSSProperties = {
  padding:'8px 10px', border:'1px solid #DCEEE6', verticalAlign:'middle', fontSize:12,
}
