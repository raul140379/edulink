'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Zap, CheckCircle, Trash2, Edit2, X, Save } from 'lucide-react'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

interface Course {
  id: number; grade: string; parallel: string; level: string
  shift: string; educationType: string
}

interface TSC {
  id: number
  teacher: { id: number; firstName: string; lastName: string }
  subject:  { id: number; name: string; campo?: string }
}

interface ScheduleItem {
  id: number; dayOfWeek: number; period: number
  startTime: string; endTime: string; status: string
  teacherSubjectCourse: {
    teacher: { firstName: string; lastName: string }
    subject:  { name: string; campo?: string }
  }
}

const GRADES:  Record<string,string> = { PRIMERO:'1°', SEGUNDO:'2°', TERCERO:'3°', CUARTO:'4°', QUINTO:'5°', SEXTO:'6°' }
const SHIFTS:  Record<string,string> = { MORNING:'Mañana', AFTERNOON:'Tarde' }
const DAYS = ['', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

const CAMPO_COLOR: Record<string,string> = {
  VIDA_TIERRA_TERRITORIO:        '#0F6E56',
  COMUNIDAD_SOCIEDAD:            '#1A3A7C',
  COSMOS_PENSAMIENTO:            '#633806',
  CIENCIA_TECNOLOGIA_PRODUCCION: '#8B1A7C',
}

export default function HorarioCursoPage() {
  const router = useRouter()
  const [courses,   setCourses]   = useState<Course[]>([])
  const [selCourse, setSelCourse] = useState<Course | null>(null)
  const [schedule,  setSchedule]  = useState<ScheduleItem[]>([])
  const [tscs,      setTscs]      = useState<TSC[]>([])
  const [schoolSch, setSchoolSch] = useState<any>(null)
  const [loading,   setLoading]   = useState(false)
  const [generating,setGenerating]= useState(false)
  const [publishing,setPublishing]= useState(false)
  const [toast,     setToast]     = useState<{type:'ok'|'err'|'warn'; text:string} | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [selCell,   setSelCell]   = useState<{day:number; period:number; startTime:string; endTime:string} | null>(null)
  const [selTsc,    setSelTsc]    = useState('')

  const token = () => localStorage.getItem('token') || ''
  const auth  = () => ({ Authorization: `Bearer ${token()}` })

  const showToast = (type:'ok'|'err'|'warn', text:string) => {
    setToast({type,text}); setTimeout(()=>setToast(null), 4000)
  }

  useEffect(() => {
    fetch(`${API}/api/courses`, { headers: auth() })
      .then(r=>r.json()).then(d=>{ if(Array.isArray(d)) setCourses(d) })
  }, [])

  useEffect(() => {
    if (!selCourse) return
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
    const res  = await fetch(`${API}/api/subjects/plan/${selCourse.id}`, { headers: auth() })
    const data = await res.json()
    if (res.ok) {
      const items = Object.values(data.grouped || {}).flat() as any[]
      setTscs(items.map((i:any) => ({
        id:      i.tscId || 0,
        teacher: i.teacher,
        subject: i.subject,
      })).filter(i => i.id > 0))
    }
  }

  const loadSchoolSchedule = async () => {
    if (!selCourse) return
    const res  = await fetch(`${API}/api/schedules/school-schedules`, { headers: auth() })
    const data = await res.json()
    if (res.ok) {
      const shift = selCourse.shift
      const active = data.find((s:any) => s.isActive && s.shift === shift)
      setSchoolSch(active || null)
    }
  }

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
        showToast('warn', `⚠️ Sin espacio: ${data.errors.map((e:any)=>e.subject).join(', ')}`)
      }
      loadSchedule()
    } catch { showToast('err', 'Error de conexión') }
    finally { setGenerating(false) }
  }

  const handlePublish = async () => {
    if (!selCourse) return
    if (!confirm('¿Confirmar y publicar este horario? No se podrá deshacer.')) return
    setPublishing(true)
    try {
      const res  = await fetch(`${API}/api/schedules/publish/${selCourse.id}`, {
        method: 'POST', headers: auth()
      })
      const data = await res.json()
      if (!res.ok) { showToast('err', data.message); return }
      showToast('ok', data.message)
      loadSchedule()
    } catch { showToast('err', 'Error de conexión') }
    finally { setPublishing(false) }
  }

  const handleDeleteDraft = async () => {
    if (!selCourse) return
    if (!confirm('¿Eliminar el borrador?')) return
    await fetch(`${API}/api/schedules/draft/${selCourse.id}`, { method: 'DELETE', headers: auth() })
    showToast('ok', 'Borrador eliminado')
    loadSchedule()
  }

  const handleDeletePeriod = async (id: number) => {
    await fetch(`${API}/api/schedules/${id}`, { method: 'DELETE', headers: auth() })
    loadSchedule()
  }

  const handleAssign = async () => {
    if (!selCourse || !selCell || !selTsc) return
    const res  = await fetch(`${API}/api/schedules/course/${selCourse.id}/period`, {
      method: 'POST',
      headers: { ...auth(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dayOfWeek:             selCell.day,
        period:                selCell.period,
        startTime:             selCell.startTime,
        endTime:               selCell.endTime,
        teacherSubjectCourseId: parseInt(selTsc),
      })
    })
    const data = await res.json()
    if (!res.ok) { showToast('err', data.message); return }
    showToast('ok', 'Periodo asignado')
    setShowModal(false)
    loadSchedule()
  }

  // Construir grilla
  const totalPeriods = schoolSch?.periods || 7
  const days = selCourse?.level === 'SECUNDARIA' ? [1,2,3,4,5,6] : [1,2,3,4,5]

  const getCell = (day: number, period: number) =>
    schedule.find(s => s.dayOfWeek === day && s.period === period)

  const hasDraft     = schedule.some(s => s.status === 'BORRADOR')
  const hasPublished = schedule.some(s => s.status === 'PUBLICADO')

  // Calcular horas del periodo
  const getPeriodTime = (period: number) => {
    if (!schoolSch) return { start: '', end: '' }
    const periodos = calcPeriodos(schoolSch)
    return periodos[period - 1] || { startTime: '', endTime: '' }
  }

  const calcPeriodos = (ss: any) => {
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

  return (
    <div>
      {/* Toast */}
      {toast && (
        <div style={{
          position:'fixed',top:16,right:16,zIndex:999,padding:'10px 16px',borderRadius:8,fontSize:13,
          background:toast.type==='ok'?'#E1F5EE':toast.type==='warn'?'#FFFBEA':'#FFF0F0',
          border:`1px solid ${toast.type==='ok'?'#9FE1CB':toast.type==='warn'?'#F5C518':'#FFBBBB'}`,
          color:toast.type==='ok'?'#0F6E56':toast.type==='warn'?'#7A6000':'#C0392B',
          boxShadow:'0 4px 12px rgba(0,0,0,.1)',maxWidth:400,
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
          <p style={{fontSize:13,color:'#6B8BB0',margin:0}}>Asigna y genera el horario semanal</p>
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
          }}
          style={{padding:'10px 12px',border:'1.5px solid #CBE0F0',borderRadius:8,fontSize:13,color:'#1A3A7C',outline:'none',width:300}}>
          <option value="">-- Selecciona un curso --</option>
          {['PRIMERO','SEGUNDO','TERCERO','CUARTO','QUINTO','SEXTO'].map(grade => (
            <optgroup key={grade} label={`${GRADES[grade]} Grado`}>
              {courses.filter(c=>c.grade===grade).map(c=>(
                <option key={c.id} value={c.id}>
                  {GRADES[c.grade]} &quot;{c.parallel}&quot; · {SHIFTS[c.shift]} · {c.level}
                  {c.educationType==='BTH'?' · BTH':''}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      {selCourse && (
        <>
          {/* Acciones */}
          <div style={{display:'flex',gap:10,marginBottom:20,flexWrap:'wrap',alignItems:'center'}}>
            <button onClick={handleGenerate} disabled={generating}
              style={{display:'flex',alignItems:'center',gap:7,padding:'9px 16px',background:'#633806',color:'#fff',border:'none',borderRadius:8,fontSize:13,fontWeight:600,cursor:'pointer',opacity:generating?.6:1}}>
              <Zap size={15}/> {generating?'Generando...':'Generar Automático'}
            </button>
            {hasDraft && (
              <>
                <button onClick={handlePublish} disabled={publishing}
                  style={{display:'flex',alignItems:'center',gap:7,padding:'9px 16px',background:'#0F6E56',color:'#fff',border:'none',borderRadius:8,fontSize:13,fontWeight:600,cursor:'pointer',opacity:publishing?.6:1}}>
                  <CheckCircle size={15}/> {publishing?'Publicando...':'Publicar Horario'}
                </button>
                <button onClick={handleDeleteDraft}
                  style={{display:'flex',alignItems:'center',gap:7,padding:'9px 16px',background:'#FFF0F0',color:'#C0392B',border:'1px solid #FFBBBB',borderRadius:8,fontSize:13,cursor:'pointer'}}>
                  <Trash2 size={15}/> Eliminar Borrador
                </button>
              </>
            )}
            {!schoolSch && (
              <span style={{fontSize:12,color:'#C0392B',background:'#FFF0F0',padding:'6px 12px',borderRadius:8}}>
                ⚠️ No hay horario institucional activo para el turno {SHIFTS[selCourse.shift]}
              </span>
            )}
          </div>

          {/* Leyenda */}
          <div style={{display:'flex',gap:12,marginBottom:16,flexWrap:'wrap'}}>
            <div style={{display:'flex',alignItems:'center',gap:6,fontSize:12,color:'#6B8BB0'}}>
              <div style={{width:12,height:12,borderRadius:3,background:'#FFFBEA',border:'1px solid #F5C518'}}/> Borrador
            </div>
            <div style={{display:'flex',alignItems:'center',gap:6,fontSize:12,color:'#6B8BB0'}}>
              <div style={{width:12,height:12,borderRadius:3,background:'#E1F5EE',border:'1px solid #9FE1CB'}}/> Publicado
            </div>
            <div style={{display:'flex',alignItems:'center',gap:6,fontSize:12,color:'#6B8BB0'}}>
              <div style={{width:12,height:12,borderRadius:3,background:'#F0F6FC',border:'1px dashed #CBE0F0'}}/> Libre
            </div>
          </div>

          {/* Grilla */}
          {loading ? (
            <div style={{display:'flex',justifyContent:'center',padding:48}}><div className="spinner"/></div>
          ) : (
            <div style={{overflowX:'auto'}}>
              <table style={{borderCollapse:'collapse',width:'100%',minWidth:700}}>
                <thead>
                  <tr>
                    <th style={{...thStyle,width:80}}>Periodo</th>
                    {days.map(d=>(
                      <th key={d} style={thStyle}>{DAYS[d]}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Array.from({length:totalPeriods},(_,i)=>i+1).map(period => {
                    const pt = getPeriodTime(period)
                    return (
                      <tr key={period}>
                        <td style={{...tdStyle,textAlign:'center',background:'#F0F6FC',fontWeight:700,fontSize:12}}>
                          <div>P{period}</div>
                          <div style={{fontSize:10,color:'#6B8BB0',fontWeight:400}}>{pt.startTime}</div>
                          <div style={{fontSize:10,color:'#6B8BB0',fontWeight:400}}>{pt.endTime}</div>
                        </td>
                        {days.map(day => {
                          const cell = getCell(day, period)
                          const isDraft = cell?.status === 'BORRADOR'
                          const isPublished = cell?.status === 'PUBLICADO'
                          const campo = cell?.teacherSubjectCourse?.subject?.campo
                          return (
                            <td key={day} style={{
                              ...tdStyle,
                              background: isDraft ? '#FFFBEA' : isPublished ? '#E1F5EE' : '#FAFCFF',
                              border: isDraft ? '1px solid #F5C518' : isPublished ? '1px solid #9FE1CB' : '1px dashed #CBE0F0',
                              cursor: 'pointer',
                              minWidth: 120,
                            }}
                              onClick={()=>{
                                if (!cell) {
                                  const pt = getPeriodTime(period)
                                  setSelCell({day, period, startTime:pt.startTime, endTime:pt.endTime})
                                  setSelTsc('')
                                  setShowModal(true)
                                }
                              }}>
                              {cell ? (
                                <div style={{position:'relative'}}>
                                  <div style={{
                                    fontSize:11,fontWeight:700,
                                    color: campo ? CAMPO_COLOR[campo] : '#1A3A7C',
                                    marginBottom:2,lineHeight:1.3
                                  }}>
                                    {cell.teacherSubjectCourse.subject.name}
                                  </div>
                                  <div style={{fontSize:10,color:'#6B8BB0'}}>
                                    {cell.teacherSubjectCourse.teacher.lastName}
                                  </div>
                                  {!isPublished && (
                                    <button
                                      onClick={e=>{e.stopPropagation();handleDeletePeriod(cell.id)}}
                                      style={{position:'absolute',top:0,right:0,background:'none',border:'none',cursor:'pointer',color:'#C0392B',padding:0,fontSize:12}}>
                                      ×
                                    </button>
                                  )}
                                </div>
                              ) : (
                                <div style={{textAlign:'center',color:'#CBE0F0',fontSize:18}}>+</div>
                              )}
                            </td>
                          )
                        })}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Modal asignar periodo */}
      {showModal && selCell && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.4)',zIndex:500,display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
          <div style={{background:'#fff',borderRadius:14,width:'100%',maxWidth:400,boxShadow:'0 20px 60px rgba(0,0,0,.15)'}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'16px 20px',borderBottom:'1px solid #CBE0F0'}}>
              <div>
                <h3 style={{fontSize:15,fontWeight:700,color:'#1A3A7C',margin:0}}>Asignar Periodo</h3>
                <p style={{fontSize:12,color:'#6B8BB0',margin:0}}>{DAYS[selCell.day]} · P{selCell.period} · {selCell.startTime} - {selCell.endTime}</p>
              </div>
              <button onClick={()=>setShowModal(false)} style={{background:'none',border:'none',cursor:'pointer',color:'#6B8BB0'}}><X size={18}/></button>
            </div>
            <div style={{padding:20}}>
              <label style={{fontSize:11,fontWeight:700,color:'#1A3A7C',textTransform:'uppercase',letterSpacing:'.5px',display:'block',marginBottom:8}}>
                Materia / Maestro
              </label>
              <select value={selTsc} onChange={e=>setSelTsc(e.target.value)}
                style={{width:'100%',padding:'10px 12px',border:'1.5px solid #CBE0F0',borderRadius:8,fontSize:13,color:'#1A3A7C',outline:'none'}}>
                <option value="">-- Selecciona --</option>
                {tscs.map(t=>(
                  <option key={t.id} value={t.id}>
                    {t.subject.name} — {t.teacher.lastName} {t.teacher.firstName}
                  </option>
                ))}
              </select>
            </div>
            <div style={{display:'flex',justifyContent:'flex-end',gap:10,padding:'12px 20px',borderTop:'1px solid #CBE0F0'}}>
              <button onClick={()=>setShowModal(false)} style={{padding:'8px 14px',background:'#fff',border:'1.5px solid #CBE0F0',borderRadius:8,fontSize:13,cursor:'pointer',color:'#1A3A7C'}}>
                Cancelar
              </button>
              <button onClick={handleAssign} disabled={!selTsc}
                style={{display:'flex',alignItems:'center',gap:6,padding:'8px 16px',background:'#1A3A7C',color:'#fff',border:'none',borderRadius:8,fontSize:13,fontWeight:600,cursor:'pointer',opacity:!selTsc?.6:1}}>
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
  padding:'10px 12px', background:'#F0F6FC', fontSize:12, fontWeight:700,
  color:'#1A3A7C', textAlign:'center', border:'1px solid #CBE0F0',
}
const tdStyle: React.CSSProperties = {
  padding:'8px 10px', border:'1px solid #CBE0F0', verticalAlign:'top', fontSize:12,
}