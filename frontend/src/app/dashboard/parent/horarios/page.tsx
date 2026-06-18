'use client'

import { useEffect, useState } from 'react'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

interface ScheduleItem {
  id: number; dayOfWeek: number; period: number
  startTime: string; endTime: string; status: string
  teacherSubjectCourse: {
    teacher: { firstName: string; lastName: string }
    subject:  { name: string; campo?: string }
  }
}

interface Student {
  id: number; firstName: string; lastName: string
  course?: { id: number; grade: string; parallel: string; level: string; shift: string }
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
const SUBJECT_EMOJI: Record<string,string> = {
  'Matemática':                                  '🔢',
  'Lenguas Castellana y Originaria':             '📖',
  'Lengua Extranjera':                           '🌍',
  'Ciencias Sociales':                           '🏛️',
  'Ciencias Naturales: Biología':                '🧬',
  'Física':                                      '⚛️',
  'Química':                                     '🧪',
  'Educación Física y Deportes':                 '⚽',
  'Educación Musical':                           '🎵',
  'Artes Plásticas y Visuales':                  '🎨',
  'Cosmovisiones y Filosofía':                   '🌌',
  'Valores, Espiritualidad y Religiones':        '☮️',
  'Psicología':                                  '🧠',
  'Técnica Tecnológica General':                 '⚙️',
  'Técnica Tecnológica General y Especializada': '🔧',
}

export default function ParentHorarioPage() {
  const [students,  setStudents]  = useState<Student[]>([])
  const [selStudent,setSelStudent]= useState<Student | null>(null)
  const [schedule,  setSchedule]  = useState<ScheduleItem[]>([])
  const [loading,   setLoading]   = useState(false)
  const [view,      setView]      = useState<'grilla'|'lista'>('grilla')
  const [todayDay,  setTodayDay]  = useState(0)

  const token = () => localStorage.getItem('token') || ''
  const auth  = () => ({ Authorization: `Bearer ${token()}` })

  useEffect(() => {
    const d = new Date().getDay()
    setTodayDay(d === 0 ? 7 : d)

    // Cargar hijos del padre
    fetch(`${API}/api/parents/my-students`, { headers: auth() })
      .then(r=>r.json())
      .then(d=>{ if(Array.isArray(d)) { setStudents(d); if(d.length>0) setSelStudent(d[0]) } })
      .catch(()=>{})
  }, [])

  useEffect(() => {
    if (!selStudent?.course?.id) return
    setLoading(true)
    fetch(`${API}/api/schedules/course/${selStudent.course.id}`, { headers: auth() })
      .then(r=>r.json())
      .then(data=>{ if(data.schedule) setSchedule(data.schedule.flatMap((d:any)=>d.periods)||[]) })
      .catch(()=>{})
      .finally(()=>setLoading(false))
  }, [selStudent])

  const days    = [...new Set(schedule.map(s=>s.dayOfWeek))].sort()
  const periods = [...new Set(schedule.map(s=>s.period))].sort((a,b)=>a-b)
  const getCell = (day:number, period:number) => schedule.find(s=>s.dayOfWeek===day&&s.period===period)

  const byDay: Record<number,ScheduleItem[]> = {}
  schedule.forEach(s=>{ if(!byDay[s.dayOfWeek]) byDay[s.dayOfWeek]=[]; byDay[s.dayOfWeek].push(s) })

  const clasesHoy = schedule.filter(s=>s.dayOfWeek===todayDay).sort((a,b)=>a.period-b.period)

  return (
    <div>
      {/* Header */}
      <div style={{marginBottom:20}}>
        <h1 style={{fontSize:20,fontWeight:700,color:'#27500A',marginBottom:4}}>Horario Escolar</h1>
        <p style={{fontSize:13,color:'#6B8BB0'}}>Consulta el horario semanal de tus hijos</p>
      </div>

      {/* Selector de hijo */}
      {students.length > 1 && (
        <div style={{background:'#fff',border:'1px solid #CBE0F0',borderRadius:10,padding:'12px 16px',marginBottom:16,display:'flex',gap:8,flexWrap:'wrap',alignItems:'center'}}>
          <span style={{fontSize:12,fontWeight:700,color:'#27500A'}}>Seleccionar hijo:</span>
          {students.map(s=>(
            <button key={s.id} onClick={()=>setSelStudent(s)} style={{
              padding:'6px 14px',borderRadius:20,border:'none',cursor:'pointer',fontSize:12,fontWeight:600,
              background:selStudent?.id===s.id?'#27500A':'#F0F6FC',
              color:selStudent?.id===s.id?'#fff':'#27500A',
            }}>
              {s.lastName} {s.firstName}
            </button>
          ))}
        </div>
      )}

      {selStudent && (
        <div style={{background:'#E8F5E0',border:'1px solid #27500A22',borderRadius:8,padding:'8px 16px',marginBottom:16,fontSize:12,color:'#27500A',display:'flex',gap:16,flexWrap:'wrap'}}>
          <span>👨‍🎓 <strong>{selStudent.lastName} {selStudent.firstName}</strong></span>
          {selStudent.course && (
            <>
              <span>Curso: <strong>{GRADES[selStudent.course.grade]} "{selStudent.course.parallel}"</strong></span>
              <span>Turno: <strong>{SHIFTS[selStudent.course.shift]||selStudent.course.shift}</strong></span>
            </>
          )}
        </div>
      )}

      {loading ? (
        <div style={{display:'flex',justifyContent:'center',padding:48}}><div className="spinner"/></div>
      ) : schedule.length === 0 ? (
        <div style={{background:'#fff',border:'1px dashed #CBE0F0',borderRadius:12,padding:48,textAlign:'center',color:'#6B8BB0'}}>
          <div style={{fontSize:40,marginBottom:12}}>📅</div>
          <p>El horario del curso aún no ha sido publicado.</p>
        </div>
      ) : (
        <>
          {/* Clases de hoy */}
          {clasesHoy.length > 0 && (
            <div style={{background:'#E8F5E0',border:'1px solid #27500A22',borderRadius:12,padding:'14px 18px',marginBottom:20}}>
              <div style={{fontWeight:700,fontSize:13,color:'#27500A',marginBottom:10}}>
                📅 Hoy — {DAYS[todayDay]}
              </div>
              <div style={{display:'flex',flexWrap:'wrap',gap:8}}>
                {clasesHoy.map(item=>{
                  const campo = item.teacherSubjectCourse.subject.campo
                  return (
                    <div key={item.id} style={{
                      background:'#fff',borderRadius:8,padding:'8px 12px',
                      border:`1px solid ${campo?CAMPO_COLOR[campo]+'33':'#CBE0F0'}`,
                      display:'flex',alignItems:'center',gap:8,
                    }}>
                      <span style={{fontSize:18}}>{SUBJECT_EMOJI[item.teacherSubjectCourse.subject.name]||'📚'}</span>
                      <div>
                        <div style={{fontSize:12,fontWeight:700,color:campo?CAMPO_COLOR[campo]:'#1A3A7C'}}>
                          {item.teacherSubjectCourse.subject.name}
                        </div>
                        <div style={{fontSize:10,color:'#6B8BB0'}}>
                          P{item.period} · {item.startTime}–{item.endTime} · {item.teacherSubjectCourse.teacher.lastName}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Toggle */}
          <div style={{display:'flex',gap:8,marginBottom:16}}>
            {(['grilla','lista'] as const).map(v=>(
              <button key={v} onClick={()=>setView(v)} style={{
                padding:'6px 16px',borderRadius:20,border:'none',cursor:'pointer',fontSize:12,fontWeight:600,
                background:view===v?'#27500A':'#F0F6FC',
                color:view===v?'#fff':'#27500A',
              }}>
                {v==='grilla'?'📊 Grilla':'📋 Lista'}
              </button>
            ))}
          </div>

          {/* Grilla */}
          {view==='grilla' && (
            <div style={{overflowX:'auto',borderRadius:10,border:'1px solid #CBE0F0'}}>
              <table style={{borderCollapse:'collapse',width:'100%',minWidth:600}}>
                <thead>
                  <tr>
                    <th style={thStyle}>Periodo</th>
                    {days.map(d=>(
                      <th key={d} style={{
                        ...thStyle,
                        background:d===todayDay?'#27500A':'#F0F6FC',
                        color:d===todayDay?'#fff':'#1A3A7C',
                      }}>
                        {DAYS[d]}
                        {d===todayDay&&<div style={{fontSize:9,fontWeight:400,opacity:.8}}>Hoy</div>}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {periods.map(period=>{
                    const firstCell = schedule.find(s=>s.period===period)
                    return (
                      <tr key={period}>
                        <td style={{...tdStyle,textAlign:'center',background:'#F8FBFF',fontWeight:700,fontSize:11,whiteSpace:'nowrap'}}>
                          <div style={{color:'#27500A'}}>P{period}</div>
                          {firstCell&&<>
                            <div style={{fontSize:10,color:'#6B8BB0'}}>{firstCell.startTime}</div>
                            <div style={{fontSize:10,color:'#6B8BB0'}}>{firstCell.endTime}</div>
                          </>}
                        </td>
                        {days.map(day=>{
                          const cell  = getCell(day,period)
                          const campo = cell?.teacherSubjectCourse?.subject?.campo
                          return (
                            <td key={day} style={{
                              ...tdStyle,
                              background:cell?(campo?CAMPO_BG[campo]||'#F0F6FC':'#F0F6FC'):(day===todayDay?'#F0F7F0':'#FAFCFF'),
                              borderColor:day===todayDay?'#27500A33':'#E0EAF5',
                              minWidth:110,
                            }}>
                              {cell?(
                                <div>
                                  <div style={{fontSize:18,marginBottom:3}}>{SUBJECT_EMOJI[cell.teacherSubjectCourse.subject.name]||'📚'}</div>
                                  <div style={{fontSize:11,fontWeight:700,color:campo?CAMPO_COLOR[campo]:'#1A3A7C',lineHeight:1.3}}>
                                    {cell.teacherSubjectCourse.subject.name}
                                  </div>
                                  <div style={{fontSize:10,color:'#6B8BB0',marginTop:2}}>
                                    {cell.teacherSubjectCourse.teacher.lastName}
                                  </div>
                                </div>
                              ):(
                                <div style={{textAlign:'center',color:'#E0EAF5',fontSize:18}}>—</div>
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

          {/* Lista */}
          {view==='lista' && (
            <div style={{display:'flex',flexDirection:'column',gap:12}}>
              {Object.entries(byDay).sort(([a],[b])=>parseInt(a)-parseInt(b)).map(([day,items])=>{
                const isToday = parseInt(day)===todayDay
                return (
                  <div key={day} style={{
                    background:'#fff',
                    border:`1px solid ${isToday?'#27500A':'#CBE0F0'}`,
                    borderRadius:12,overflow:'hidden'
                  }}>
                    <div style={{
                      background:isToday?'#27500A':'#F0F6FC',
                      padding:'10px 16px',fontWeight:700,fontSize:13,
                      color:isToday?'#fff':'#27500A',
                      borderBottom:'1px solid #CBE0F0',
                      display:'flex',alignItems:'center',gap:8,
                    }}>
                      📅 {DAYS[parseInt(day)]}
                      {isToday&&<span style={{fontSize:10,background:'rgba(255,255,255,.2)',padding:'2px 8px',borderRadius:20}}>Hoy</span>}
                    </div>
                    <div style={{display:'flex',flexDirection:'column'}}>
                      {items.sort((a,b)=>a.period-b.period).map(item=>{
                        const campo = item.teacherSubjectCourse.subject.campo
                        return (
                          <div key={item.id} style={{display:'flex',alignItems:'center',gap:14,padding:'12px 16px',borderTop:'1px solid #F0F6FC'}}>
                            <div style={{textAlign:'center',minWidth:50}}>
                              <div style={{fontSize:11,fontWeight:700,color:'#27500A'}}>P{item.period}</div>
                              <div style={{fontSize:10,color:'#6B8BB0'}}>{item.startTime}</div>
                              <div style={{fontSize:10,color:'#6B8BB0'}}>{item.endTime}</div>
                            </div>
                            <div style={{fontSize:20}}>{SUBJECT_EMOJI[item.teacherSubjectCourse.subject.name]||'📚'}</div>
                            <div style={{flex:1}}>
                              <div style={{fontWeight:700,fontSize:13,color:campo?CAMPO_COLOR[campo]:'#1A3A7C'}}>
                                {item.teacherSubjectCourse.subject.name}
                              </div>
                              <div style={{fontSize:12,color:'#6B8BB0',marginTop:2}}>
                                {item.teacherSubjectCourse.teacher.lastName} {item.teacherSubjectCourse.teacher.firstName}
                              </div>
                            </div>
                            <div style={{
                              background:campo?CAMPO_BG[campo]:'#F0F6FC',
                              color:campo?CAMPO_COLOR[campo]:'#1A3A7C',
                              padding:'3px 10px',borderRadius:20,fontSize:11,fontWeight:600,whiteSpace:'nowrap',
                            }}>
                              {item.startTime} — {item.endTime}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      <style>{`
        .spinner{width:24px;height:24px;border:2px solid rgba(39,80,10,.2);border-top-color:#27500A;border-radius:50%;animation:spin .7s linear infinite}
        @keyframes spin{to{transform:rotate(360deg)}}
      `}</style>
    </div>
  )
}

const thStyle: React.CSSProperties = {
  padding:'10px 12px',background:'#F0F6FC',fontSize:12,fontWeight:700,
  color:'#27500A',textAlign:'center',border:'1px solid #CBE0F0',
}
const tdStyle: React.CSSProperties = {
  padding:'8px 10px',border:'1px solid #CBE0F0',verticalAlign:'top',fontSize:12,
}