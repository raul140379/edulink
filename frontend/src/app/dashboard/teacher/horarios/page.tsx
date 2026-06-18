'use client'

import { useEffect, useState } from 'react'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

interface ScheduleItem {
  id: number; dayOfWeek: number; period: number
  startTime: string; endTime: string; status: string
  course: { id: number; grade: string; parallel: string; level: string; shift: string }
  teacherSubjectCourse: {
    subject: { name: string; campo?: string }
  }
}

const GRADES: Record<string,string> = { PRIMERO:'1°', SEGUNDO:'2°', TERCERO:'3°', CUARTO:'4°', QUINTO:'5°', SEXTO:'6°' }
const DAYS = ['', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
const DAYS_SHORT = ['', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

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

export default function TeacherHorarioPage() {
  const [schedule, setSchedule] = useState<ScheduleItem[]>([])
  const [loading,  setLoading]  = useState(true)
  const [view,     setView]     = useState<'grilla'|'lista'>('grilla')

  const token = () => localStorage.getItem('token') || ''
  const auth  = () => ({ Authorization: `Bearer ${token()}` })

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const res  = await fetch(`${API}/api/schedules/my-schedule`, { headers: auth() })
        const data = await res.json()
        if (res.ok) {
          const items = data.flatMap((d:any) => d.periods || [])
          setSchedule(items)
        }
      } catch { console.error('Error') }
      finally { setLoading(false) }
    }
    load()
  }, [])

  // Obtener días y periodos únicos
  const days    = [...new Set(schedule.map(s => s.dayOfWeek))].sort()
  const periods = [...new Set(schedule.map(s => s.period))].sort((a,b)=>a-b)

  const getCell = (day: number, period: number) =>
    schedule.find(s => s.dayOfWeek === day && s.period === period)

  // Agrupar por día para vista lista
  const byDay: Record<number, ScheduleItem[]> = {}
  schedule.forEach(s => {
    if (!byDay[s.dayOfWeek]) byDay[s.dayOfWeek] = []
    byDay[s.dayOfWeek].push(s)
  })

  // Stats
  const totalClases   = schedule.length
  const totalCursos   = new Set(schedule.map(s => s.course.id)).size
  const totalMaterias = new Set(schedule.map(s => s.teacherSubjectCourse.subject.name)).size

  if (loading) return (
    <div style={{display:'flex',justifyContent:'center',padding:48}}>
      <div className="spinner"/>
    </div>
  )

  return (
    <div>
      {/* Header */}
      <div style={{marginBottom:24}}>
        <h1 style={{fontSize:20,fontWeight:700,color:'#633806',marginBottom:4}}>Mi Horario Semanal</h1>
        <p style={{fontSize:13,color:'#6B8BB0'}}>Distribución de clases por día y periodo</p>
      </div>

      {/* Stats */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12,marginBottom:20}}>
        {[
          {label:'Total clases/semana', value:totalClases, color:'#633806', bg:'#FDF0E6'},
          {label:'Cursos',              value:totalCursos,   color:'#1A3A7C', bg:'#E0ECF8'},
          {label:'Materias',            value:totalMaterias, color:'#0F6E56', bg:'#E1F5EE'},
        ].map(s=>(
          <div key={s.label} style={{background:s.bg,borderRadius:10,padding:'14px 16px',border:`1px solid ${s.color}22`}}>
            <div style={{fontSize:24,fontWeight:800,color:s.color}}>{String(s.value)}</div>
            <div style={{fontSize:11,color:s.color,fontWeight:600,marginTop:2}}>{s.label}</div>
          </div>
        ))}
      </div>

      {schedule.length === 0 ? (
        <div style={{background:'#fff',border:'1px dashed #CBE0F0',borderRadius:12,padding:48,textAlign:'center',color:'#6B8BB0'}}>
          <div style={{fontSize:40,marginBottom:12}}>📅</div>
          <p>No tienes horario asignado aún.</p>
          <p style={{fontSize:12,marginTop:4}}>Contacta al administrador para que asigne tu horario.</p>
        </div>
      ) : (
        <>
          {/* Toggle vista */}
          <div style={{display:'flex',gap:8,marginBottom:16}}>
            {(['grilla','lista'] as const).map(v=>(
              <button key={v} onClick={()=>setView(v)} style={{
                padding:'6px 16px',borderRadius:20,border:'none',cursor:'pointer',fontSize:12,fontWeight:600,
                background:view===v?'#633806':'#F0F6FC',
                color:view===v?'#fff':'#633806',
              }}>
                {v==='grilla'?'📊 Grilla':'📋 Lista'}
              </button>
            ))}
          </div>

          {/* Vista Grilla */}
          {view==='grilla' && (
            <div style={{overflowX:'auto',borderRadius:10,border:'1px solid #CBE0F0'}}>
              <table style={{borderCollapse:'collapse',width:'100%',minWidth:600}}>
                <thead>
                  <tr>
                    <th style={thStyle}>Periodo</th>
                    {days.map(d=>(
                      <th key={d} style={thStyle}>{DAYS[d]}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {periods.map(period => {
                    const firstCell = schedule.find(s => s.period === period)
                    return (
                      <tr key={period}>
                        <td style={{...tdStyle,textAlign:'center',background:'#F8FBFF',fontWeight:700,fontSize:11,whiteSpace:'nowrap'}}>
                          <div style={{color:'#633806'}}>P{period}</div>
                          {firstCell && (
                            <>
                              <div style={{fontSize:10,color:'#6B8BB0'}}>{firstCell.startTime}</div>
                              <div style={{fontSize:10,color:'#6B8BB0'}}>{firstCell.endTime}</div>
                            </>
                          )}
                        </td>
                        {days.map(day => {
                          const cell  = getCell(day, period)
                          const campo = cell?.teacherSubjectCourse?.subject?.campo
                          return (
                            <td key={day} style={{
                              ...tdStyle,
                              background: cell ? (campo?CAMPO_BG[campo]||'#F0F6FC':'#F0F6FC') : '#FAFCFF',
                              borderStyle: cell ? 'solid' : 'dashed',
                              borderColor: cell ? (campo?CAMPO_COLOR[campo]+'33':'#CBE0F0') : '#E0EAF5',
                              minWidth: 120,
                            }}>
                              {cell ? (
                                <div>
                                  <div style={{fontSize:16,marginBottom:3}}>
                                    {SUBJECT_EMOJI[cell.teacherSubjectCourse.subject.name]||'📚'}
                                  </div>
                                  <div style={{fontSize:11,fontWeight:700,color:campo?CAMPO_COLOR[campo]:'#1A3A7C',lineHeight:1.3}}>
                                    {cell.teacherSubjectCourse.subject.name}
                                  </div>
                                  <div style={{fontSize:10,color:'#6B8BB0',marginTop:2}}>
                                    {GRADES[cell.course.grade]} "{cell.course.parallel}"
                                  </div>
                                </div>
                              ) : (
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

          {/* Vista Lista */}
          {view==='lista' && (
            <div style={{display:'flex',flexDirection:'column',gap:12}}>
              {Object.entries(byDay).sort(([a],[b])=>parseInt(a)-parseInt(b)).map(([day, items]) => (
                <div key={day} style={{background:'#fff',border:'1px solid #CBE0F0',borderRadius:12,overflow:'hidden'}}>
                  <div style={{background:'#FDF0E6',padding:'10px 16px',fontWeight:700,fontSize:13,color:'#633806',borderBottom:'1px solid #CBE0F0'}}>
                    📅 {DAYS[parseInt(day)]}
                  </div>
                  <div style={{display:'flex',flexDirection:'column'}}>
                    {items.sort((a,b)=>a.period-b.period).map(item => {
                      const campo = item.teacherSubjectCourse.subject.campo
                      return (
                        <div key={item.id} style={{
                          display:'flex',alignItems:'center',gap:14,padding:'12px 16px',
                          borderTop:'1px solid #F0F6FC',
                        }}>
                          <div style={{textAlign:'center',minWidth:50}}>
                            <div style={{fontSize:11,fontWeight:700,color:'#633806'}}>P{item.period}</div>
                            <div style={{fontSize:10,color:'#6B8BB0'}}>{item.startTime}</div>
                            <div style={{fontSize:10,color:'#6B8BB0'}}>{item.endTime}</div>
                          </div>
                          <div style={{fontSize:20}}>{SUBJECT_EMOJI[item.teacherSubjectCourse.subject.name]||'📚'}</div>
                          <div style={{flex:1}}>
                            <div style={{fontWeight:700,fontSize:13,color:campo?CAMPO_COLOR[campo]:'#1A3A7C'}}>
                              {item.teacherSubjectCourse.subject.name}
                            </div>
                            <div style={{fontSize:12,color:'#6B8BB0',marginTop:2}}>
                              {GRADES[item.course.grade]} "{item.course.parallel}"
                            </div>
                          </div>
                          <div style={{
                            background:campo?CAMPO_BG[campo]:'#F0F6FC',
                            color:campo?CAMPO_COLOR[campo]:'#1A3A7C',
                            padding:'3px 10px',borderRadius:20,fontSize:11,fontWeight:600,
                          }}>
                            {item.startTime} — {item.endTime}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <style>{`
        .spinner{width:24px;height:24px;border:2px solid rgba(99,56,6,.2);border-top-color:#633806;border-radius:50%;animation:spin .7s linear infinite}
        @keyframes spin{to{transform:rotate(360deg)}}
      `}</style>
    </div>
  )
}

const thStyle: React.CSSProperties = {
  padding:'10px 12px', background:'#F0F6FC', fontSize:12, fontWeight:700,
  color:'#633806', textAlign:'center', border:'1px solid #CBE0F0',
}
const tdStyle: React.CSSProperties = {
  padding:'8px 10px', border:'1px solid #CBE0F0', verticalAlign:'top', fontSize:12,
}