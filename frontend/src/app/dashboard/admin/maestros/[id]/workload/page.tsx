'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Clock, BookOpen, GraduationCap, Users } from 'lucide-react'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

interface Assignment {
  subjectName:       string
  courseLabel:       string
  grade:             string
  parallel:          string
  shift:             string
  educationType:     string
  hoursPerWeek:      number
  periodosAsignados: number
}

interface HorarioResumen {
  horarioId:     number
  nombre:        string
  turno:         string
  isWinter:      boolean
  minPeriodo:    number
  totalPeriodos: number
  horasSemana:   number
  horasMes:      number
}

interface WorkloadData {
  teacher: { id: number; firstName: string; lastName: string; specialty?: string }
  totalHoursPerWeek:  number
  horasContratadaMes: number
  totalesPorHorario:  HorarioResumen[]
  assignments:        Assignment[]
}

const GRADES: Record<string,string> = {
  PRIMERO:'1°', SEGUNDO:'2°', TERCERO:'3°', CUARTO:'4°', QUINTO:'5°', SEXTO:'6°'
}
const SHIFTS: Record<string,string> = { MORNING:'Mañana', AFTERNOON:'Tarde' }

export default function TeacherWorkloadPage() {
  const params = useParams()
  const router = useRouter()
  const id     = params.id as string

  const [data,    setData]    = useState<WorkloadData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : ''

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const res  = await fetch(`${API_URL}/api/teachers/${id}/workload`, {
          headers: { Authorization: `Bearer ${token}` }
        })
        const d = await res.json()
        if (res.ok) setData(d)
        else setError(d.message || 'Error al cargar datos')
      } catch { setError('Error de conexión') }
      finally  { setLoading(false) }
    }
    load()
  }, [id])

  if (loading) return (
    <div style={{display:'flex',justifyContent:'center',alignItems:'center',padding:80}}>
      <div className="spinner"/>
    </div>
  )

  if (error || !data) return (
    <div style={{display:'flex',flexDirection:'column',alignItems:'center',padding:80,gap:12,color:'#6B8BB0'}}>
      <p style={{color:'#C0392B'}}>{error || 'No se encontraron datos'}</p>
      <button onClick={() => router.back()} style={{padding:'8px 16px',background:'#1A3A7C',color:'#fff',border:'none',borderRadius:8,cursor:'pointer'}}>
        Volver
      </button>
    </div>
  )

  // Agrupar asignaciones por materia
  const bySubject = data.assignments.reduce<Record<string, Assignment[]>>((acc, a) => {
    if (!acc[a.subjectName]) acc[a.subjectName] = []
    acc[a.subjectName].push(a)
    return acc
  }, {})

  return (
    <div>
      {/* Header */}
      <div style={{display:'flex',alignItems:'flex-start',gap:16,marginBottom:24,flexWrap:'wrap'}}>
        <button onClick={() => router.back()} style={{
          display:'flex',alignItems:'center',gap:6,background:'none',border:'none',
          cursor:'pointer',color:'#6B8BB0',fontSize:13,padding:'6px 0',whiteSpace:'nowrap'
        }}>
          <ArrowLeft size={16}/> Volver
        </button>
        <div style={{flex:1}}>
          <h1 style={{fontSize:22,fontWeight:700,color:'#1A3A7C',margin:'0 0 4px'}}>
            {data.teacher.lastName} {data.teacher.firstName}
          </h1>
          <p style={{fontSize:13,color:'#6B8BB0',margin:0}}>
            {data.teacher.specialty || 'Sin especialidad registrada'} · Carga Horaria
          </p>
        </div>
      </div>

      {/* Tarjetas resumen */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))',gap:14,marginBottom:24}}>
        <div style={{background:'#1A3A7C',color:'#fff',borderRadius:14,padding:'20px',textAlign:'center'}}>
          <Clock size={24} color="rgba(255,255,255,0.7)" style={{marginBottom:8}}/>
          <div style={{fontSize:11,opacity:.8,textTransform:'uppercase',letterSpacing:'.5px',marginBottom:4}}>Carga contratada</div>
          <div style={{fontSize:36,fontWeight:800,lineHeight:1}}>{data.horasContratadaMes}</div>
          <div style={{fontSize:12,opacity:.7,marginTop:4}}>hrs/mes</div>
        </div>
        <div style={{background:'#1A3A7C',color:'#fff',borderRadius:14,padding:'20px',textAlign:'center'}}>
          <BookOpen size={24} color="rgba(255,255,255,0.7)" style={{marginBottom:8}}/>
          <div style={{fontSize:11,opacity:.8,textTransform:'uppercase',letterSpacing:'.5px',marginBottom:4}}>Materias distintas</div>
          <div style={{fontSize:36,fontWeight:800,lineHeight:1}}>{Object.keys(bySubject).length}</div>
          <div style={{fontSize:12,opacity:.7,marginTop:4}}>materias</div>
        </div>
        <div style={{background:'#0F6E56',color:'#fff',borderRadius:14,padding:'20px',textAlign:'center'}}>
          <GraduationCap size={24} color="rgba(255,255,255,0.7)" style={{marginBottom:8}}/>
          <div style={{fontSize:11,opacity:.8,textTransform:'uppercase',letterSpacing:'.5px',marginBottom:4}}>Cursos</div>
          <div style={{fontSize:36,fontWeight:800,lineHeight:1}}>{data.assignments.length}</div>
          <div style={{fontSize:12,opacity:.7,marginTop:4}}>asignaciones</div>
        </div>
        <div style={{background:'#4A9FD4',color:'#fff',borderRadius:14,padding:'20px',textAlign:'center'}}>
          <Users size={24} color="rgba(255,255,255,0.7)" style={{marginBottom:8}}/>
          <div style={{fontSize:11,opacity:.8,textTransform:'uppercase',letterSpacing:'.5px',marginBottom:4}}>Periodos/semana</div>
          <div style={{fontSize:36,fontWeight:800,lineHeight:1}}>
            {data.totalesPorHorario[0]?.totalPeriodos || 0}
          </div>
          <div style={{fontSize:12,opacity:.7,marginTop:4}}>periodos</div>
        </div>
      </div>

      {/* Horas por tipo de horario */}
      {data.totalesPorHorario && data.totalesPorHorario.length > 0 && (
        <div style={{marginBottom:24}}>
          <h2 style={{fontSize:15,fontWeight:700,color:'#1A3A7C',marginBottom:12,textTransform:'uppercase',letterSpacing:'.5px',display:'flex',alignItems:'center',gap:8}}>
            <Clock size={16}/> Horas asignadas en horario
          </h2>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(280px,1fr))',gap:14}}>
            {data.totalesPorHorario.map(h => {
              const porcentaje = data.horasContratadaMes > 0
                ? Math.min(Math.round((h.horasMes / data.horasContratadaMes) * 100), 100)
                : 0
              const color = porcentaje >= 90 ? '#0F6E56' : porcentaje >= 75 ? '#BA7517' : '#C0392B'
              const bg    = porcentaje >= 90 ? '#E1F5EE' : porcentaje >= 75 ? '#FFFBEA' : '#FFF0F0'
              return (
                <div key={h.horarioId} style={{background:'#fff',border:'1px solid #CBE0F0',borderRadius:14,padding:20}}>
                  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16}}>
                    <div>
                      <div style={{fontSize:16,fontWeight:700,color:'#1A3A7C'}}>
                        {h.isWinter ? '❄️' : '☀️'} {h.nombre}
                      </div>
                      <div style={{fontSize:12,color:'#6B8BB0',marginTop:4}}>
                        {h.minPeriodo} min/periodo · {h.totalPeriodos} periodos/semana
                      </div>
                    </div>
                    <div style={{
                      background:bg, color, borderRadius:10,
                      padding:'6px 14px', fontSize:16, fontWeight:800,
                    }}>
                      {porcentaje}%
                    </div>
                  </div>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10,marginBottom:16}}>
                    <div style={{background:'#F8FBFF',borderRadius:10,padding:'12px',textAlign:'center'}}>
                      <div style={{fontSize:24,fontWeight:800,color:'#1A3A7C'}}>{h.totalPeriodos}</div>
                      <div style={{fontSize:11,color:'#6B8BB0',marginTop:2}}>periodos/sem</div>
                    </div>
                    <div style={{background:'#F8FBFF',borderRadius:10,padding:'12px',textAlign:'center'}}>
                      <div style={{fontSize:24,fontWeight:800,color:'#1A3A7C'}}>{h.horasSemana}</div>
                      <div style={{fontSize:11,color:'#6B8BB0',marginTop:2}}>hrs/semana</div>
                    </div>
                    <div style={{background:'#F8FBFF',borderRadius:10,padding:'12px',textAlign:'center'}}>
                      <div style={{fontSize:24,fontWeight:800,color:'#1A3A7C'}}>{h.horasMes}</div>
                      <div style={{fontSize:11,color:'#6B8BB0',marginTop:2}}>hrs/mes</div>
                    </div>
                  </div>
                  {/* Barra progreso */}
                  <div style={{background:'#F0F6FC',borderRadius:20,height:8,overflow:'hidden',marginBottom:6}}>
                    <div style={{
                      height:'100%',borderRadius:20,
                      width:`${porcentaje}%`,
                      background:color,
                      transition:'width .3s ease',
                    }}/>
                  </div>
                  <div style={{display:'flex',justifyContent:'space-between'}}>
                    <span style={{fontSize:11,color:'#6B8BB0'}}>0 hrs</span>
                    <span style={{fontSize:11,color,fontWeight:600}}>{h.horasMes} / {data.horasContratadaMes} hrs/mes</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Detalle por materia */}
      <div>
        <h2 style={{fontSize:15,fontWeight:700,color:'#1A3A7C',marginBottom:12,textTransform:'uppercase',letterSpacing:'.5px',display:'flex',alignItems:'center',gap:8}}>
          <BookOpen size={16}/> Detalle de asignaciones ({data.assignments.length})
        </h2>
        <div style={{background:'#fff',border:'1px solid #CBE0F0',borderRadius:12,overflow:'hidden'}}>
          <table style={{width:'100%',borderCollapse:'collapse'}}>
            <thead>
              <tr style={{background:'#F0F6FC'}}>
                <th style={th}>#</th>
                <th style={th}>Materia</th>
                <th style={th}>Curso</th>
                <th style={th}>Turno</th>
                <th style={{...th,textAlign:'center'}}>Periodos/sem</th>
                <th style={{...th,textAlign:'right'}}>Hrs/sem</th>
              </tr>
            </thead>
            <tbody>
              {data.assignments.map((a, i) => (
                <tr key={i} style={{borderTop:'1px solid #F0F6FC'}}>
                  <td style={{...td,color:'#6B8BB0',fontSize:12}}>{i + 1}</td>
                  <td style={{...td,fontWeight:600}}>{a.subjectName}</td>
                  <td style={td}>
                    {GRADES[a.grade]} &quot;{a.parallel}&quot;
                    {a.educationType === 'BTH' && (
                      <span style={{marginLeft:6,background:'#FFFBEA',color:'#BA7517',padding:'1px 6px',borderRadius:20,fontSize:10,fontWeight:600}}>BTH</span>
                    )}
                  </td>
                  <td style={td}>{SHIFTS[a.shift] || a.shift}</td>
                  <td style={{...td,textAlign:'center'}}>
                    <span style={{
                      background: a.periodosAsignados > 0 ? '#E0ECF8' : '#F0F6FC',
                      color:      a.periodosAsignados > 0 ? '#1A3A7C' : '#6B8BB0',
                      padding:'3px 12px',borderRadius:20,fontSize:12,fontWeight:600
                    }}>
                      {a.periodosAsignados || 0} per.
                    </span>
                  </td>
                  <td style={{...td,textAlign:'right'}}>
                    <span style={{background:'#FFFBEA',color:'#BA7517',border:'1px solid #F5C518',padding:'3px 12px',borderRadius:20,fontSize:12,fontWeight:600}}>
                      {a.hoursPerWeek} hrs
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{borderTop:'2px solid #CBE0F0',background:'#F8FBFF'}}>
                <td colSpan={4} style={{padding:'12px 14px',fontWeight:700,color:'#1A3A7C',fontSize:13}}>
                  Total
                </td>
                <td style={{padding:'12px 14px',textAlign:'center'}}>
                  <span style={{background:'#E0ECF8',color:'#1A3A7C',padding:'3px 12px',borderRadius:20,fontSize:13,fontWeight:700}}>
                    {data.totalesPorHorario[0]?.totalPeriodos || 0} per.
                  </span>
                </td>
                <td style={{padding:'12px 14px',textAlign:'right'}}>
                  <span style={{background:'#FFFBEA',color:'#BA7517',border:'1px solid #F5C518',padding:'3px 12px',borderRadius:20,fontSize:13,fontWeight:700}}>
                    {data.totalHoursPerWeek} hrs
                  </span>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <style>{`
        .spinner{width:28px;height:28px;border:3px solid rgba(26,58,124,.2);border-top-color:#1A3A7C;border-radius:50%;animation:spin .7s linear infinite}
        @keyframes spin{to{transform:rotate(360deg)}}
      `}</style>
    </div>
  )
}

const th: React.CSSProperties = {
  padding:'11px 14px', textAlign:'left', fontSize:11, fontWeight:600,
  color:'#1A3A7C', textTransform:'uppercase', letterSpacing:'.5px', whiteSpace:'nowrap'
}
const td: React.CSSProperties = {
  padding:'11px 14px', fontSize:13, color:'#1A3A7C', verticalAlign:'middle'
}