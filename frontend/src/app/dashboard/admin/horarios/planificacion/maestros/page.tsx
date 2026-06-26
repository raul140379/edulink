'use client'

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

const DAYS = ['', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
const GRADES: Record<string,string> = { PRIMERO:'1°', SEGUNDO:'2°', TERCERO:'3°', CUARTO:'4°', QUINTO:'5°', SEXTO:'6°' }

const CAMPO_COLOR: Record<string,string> = {
  VIDA_TIERRA_TERRITORIO:        '#0F6E56',
  COMUNIDAD_SOCIEDAD:            '#1A3A7C',
  COSMOS_PENSAMIENTO:            '#633806',
  CIENCIA_TECNOLOGIA_PRODUCCION: '#8B1A7C',
}

export default function PlanificacionMaestrosPage() {
  const router = useRouter()
  const [plans,      setPlans]      = useState<any[]>([])
  const [schoolSchs, setSchoolSchs] = useState<any[]>([])
  const [loading,    setLoading]    = useState(true)
  const [selShift,   setSelShift]   = useState<'MORNING'|'AFTERNOON'>('MORNING')

  const token = () => localStorage.getItem('token') || ''
  const auth  = () => ({ Authorization: `Bearer ${token()}` })

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const [pRes, sRes] = await Promise.all([
          fetch(`${API}/api/planificacion/teachers`,          { headers: auth() }),
          fetch(`${API}/api/schedules/school-schedules`,      { headers: auth() }),
        ])
        const [pData, sData] = await Promise.all([pRes.json(), sRes.json()])
        if (pRes.ok) setPlans(pData.plans || [])
        if (sRes.ok) setSchoolSchs(sData)
      } catch { console.error('Error') }
      finally { setLoading(false) }
    }
    load()
  }, [])

  const ss = schoolSchs.find(s => s.isActive && s.shift === selShift)
  const totalPeriods = ss?.periods || 7
  const breakPeriods = ss?.breakAfter?.split(',').map(Number) || []
  const days = [1,2,3,4,5,6]

  // Filtrar planes por turno
  const filteredPlans = plans.filter(p => p.course.shift === selShift)

  // Agrupar por maestro
  const maestrosMap: Record<number, { teacher: any; plans: any[] }> = {}
  filteredPlans.forEach(p => {
    const tid = p.teacherSubjectCourse.teacher.id
    if (!maestrosMap[tid]) maestrosMap[tid] = { teacher: p.teacherSubjectCourse.teacher, plans: [] }
    maestrosMap[tid].plans.push(p)
  })
  const maestros = Object.values(maestrosMap).sort((a,b) =>
    a.teacher.lastName.localeCompare(b.teacher.lastName)
  )

  // Detectar conflictos (mismo maestro, mismo día, mismo periodo, distinto curso)
  const conflictos = new Set<string>()
  filteredPlans.forEach(p => {
    const key = `${p.teacherSubjectCourse.teacher.id}-${p.dayOfWeek}-${p.period}`
    const dups = filteredPlans.filter(q =>
      q.teacherSubjectCourse.teacher.id === p.teacherSubjectCourse.teacher.id &&
      q.dayOfWeek === p.dayOfWeek &&
      q.period === p.period &&
      q.id !== p.id
    )
    if (dups.length > 0) conflictos.add(key)
  })

  const getCell = (teacherId: number, day: number, period: number) =>
    filteredPlans.find(p =>
      p.teacherSubjectCourse.teacher.id === teacherId &&
      p.dayOfWeek === day &&
      p.period === period
    )

  return (
    <div>
      {/* Header */}
      <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:24,flexWrap:'wrap'}}>
        <button onClick={()=>router.push('/dashboard/admin/horarios/planificacion')}
          style={{display:'flex',alignItems:'center',gap:6,background:'none',border:'none',cursor:'pointer',color:'#6B8BB0',fontSize:13}}>
          <ArrowLeft size={16}/> Volver
        </button>
        <div style={{flex:1}}>
          <h1 style={{fontSize:20,fontWeight:700,color:'#1A3A7C',margin:0}}>Vista de Maestros</h1>
          <p style={{fontSize:13,color:'#6B8BB0',margin:0}}>Planificación global — maestros vs días/periodos</p>
        </div>
        <div style={{display:'flex',gap:8}}>
          {(['MORNING','AFTERNOON'] as const).map(shift => (
            <button key={shift} onClick={()=>setSelShift(shift)} style={{
              padding:'8px 16px',border:`2px solid ${selShift===shift?'#1A3A7C':'#CBE0F0'}`,
              borderRadius:8,fontSize:13,fontWeight:600,cursor:'pointer',
              background:selShift===shift?'#1A3A7C':'#fff',
              color:selShift===shift?'#fff':'#1A3A7C',
            }}>
              {shift==='MORNING'?'☀️ Mañana':'🌙 Tarde'}
            </button>
          ))}
        </div>
      </div>

      {conflictos.size > 0 && (
        <div style={{background:'#FFF0F0',border:'1px solid #FFBBBB',borderRadius:8,padding:'10px 14px',marginBottom:16,fontSize:12,color:'#C0392B',fontWeight:600}}>
          ⚠️ Se detectaron {conflictos.size} conflicto{conflictos.size>1?'s':''} de horario — celdas marcadas en rojo
        </div>
      )}

      {loading ? (
        <div style={{display:'flex',justifyContent:'center',padding:48}}><div className="spinner"/></div>
      ) : maestros.length === 0 ? (
        <div style={{background:'#fff',border:'1px dashed #CBE0F0',borderRadius:12,padding:48,textAlign:'center',color:'#6B8BB0'}}>
          <p>No hay planificación generada para este turno.</p>
        </div>
      ) : (
        <div style={{overflowX:'auto',borderRadius:10,border:'1px solid #CBE0F0'}}>
          <table style={{borderCollapse:'collapse',width:'100%',minWidth:700}}>
            <thead>
              <tr>
                <th style={{...thStyle,width:160,textAlign:'left'}}>Maestro</th>
                {days.map(d => (
                  <th key={d} colSpan={totalPeriods} style={{...thStyle,borderLeft:'2px solid #CBE0F0'}}>
                    {DAYS[d]}
                  </th>
                ))}
              </tr>
              <tr>
                <th style={{...thStyle,background:'#F8FBFF'}}/>
                {days.map(d =>
                  Array.from({length:totalPeriods},(_,i)=>i+1).map(p => {
                    const isBreak = breakPeriods.includes(p)
                    return (
                      <th key={`${d}-${p}`} style={{
                        ...thStyle,
                        fontSize:9,
                        borderLeft: p===1?'2px solid #CBE0F0':'1px solid #CBE0F0',
                        background: isBreak?'#D0EFFF':'#F0F6FC',
                        color: isBreak?'#1A5F8A':'#1A3A7C',
                      }}>
                        {isBreak ? '☕' : `P${p}`}
                      </th>
                    )
                  })
                )}
              </tr>
            </thead>
            <tbody>
              {maestros.map(({ teacher, plans: mPlans }) => {
                const totalHoras = mPlans.length
                return (
                  <tr key={teacher.id}>
                    <td style={{...tdStyle,fontWeight:600,fontSize:12,whiteSpace:'nowrap',background:'#F8FBFF'}}>
                      <div style={{color:'#1A3A7C'}}>{teacher.lastName} {teacher.firstName}</div>
                      <div style={{fontSize:10,color:'#6B8BB0'}}>{totalHoras} periodos/semana</div>
                    </td>
                    {days.map(d =>
                      Array.from({length:totalPeriods},(_,i)=>i+1).map(p => {
                        const cell       = getCell(teacher.id, d, p)
                        const isBreak    = breakPeriods.includes(p)
                        const conflicto  = conflictos.has(`${teacher.id}-${d}-${p}`)
                        const campo      = cell?.teacherSubjectCourse?.subject?.campo

                        if (isBreak && !cell) {
                          return (
                            <td key={`${d}-${p}`} style={{
                              ...tdStyle,
                              background:'#D0EFFF',
                              borderLeft: p===1?'2px solid #4A9FD4':'1px solid #CBE0F0',
                            }}/>
                          )
                        }

                        return (
                          <td key={`${d}-${p}`} style={{
                            ...tdStyle,
                            background: conflicto?'#FFF0F0': cell?'#F0FBF5':'#FAFCFF',
                            borderLeft: p===1?'2px solid #CBE0F0':'1px solid #CBE0F0',
                            borderColor: conflicto?'#FFBBBB': cell?'#9FE1CB':'#E0EAF5',
                            minWidth: 70,
                          }}>
                            {cell ? (
                              <div>
                                <div style={{fontSize:9,fontWeight:700,color:conflicto?'#C0392B':(campo?CAMPO_COLOR[campo]:'#1A3A7C'),lineHeight:1.3}}>
                                  {cell.teacherSubjectCourse.subject.name.slice(0,10)}
                                </div>
                                <div style={{fontSize:9,color:'#6B8BB0'}}>
                                  {GRADES[cell.course.grade]}&quot;{cell.course.parallel}&quot;
                                </div>
                                {conflicto && <div style={{fontSize:9,color:'#C0392B',fontWeight:700}}>⚠️ Conflicto</div>}
                              </div>
                            ) : null}
                          </td>
                        )
                      })
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
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
  color:'#1A3A7C',textAlign:'center',border:'1px solid #CBE0F0',whiteSpace:'nowrap',
}
const tdStyle: React.CSSProperties = {
  padding:'4px 6px',border:'1px solid #CBE0F0',verticalAlign:'middle',fontSize:11,
}