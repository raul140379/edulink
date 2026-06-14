'use client'

import { useEffect, useState } from 'react'
import { ClipboardList, Clock, CheckCircle, BookOpen, Filter } from 'lucide-react'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

interface Task {
  id:          number
  title:       string
  description: string | null
  type:        string
  maxScore:    number
  dueDate:     string | null
  subject:     { id: number; name: string; campo?: string | null }
  teacher:     string
  trimester:   { id: number; number: number; name?: string } | null
  score:       number | null
  status:      string
  note:        string | null
  gradedAt:    string | null
}

const TYPE_LABEL: Record<string, string> = {
  EVALUACION: 'Evaluación',
  TRABAJO:    'Trabajo',
  SER:        'Ser',
  DECIDIR:    'Decidir',
}

const TYPE_COLOR: Record<string, string> = {
  EVALUACION: '#c0392b',
  TRABAJO:    '#1A3A7C',
  SER:        '#0F6E56',
  DECIDIR:    '#633806',
}

const TYPE_MAX: Record<string, number> = {
  EVALUACION: 45,
  TRABAJO:    40,
  SER:        10,
  DECIDIR:    5,
}

export default function TareasPage() {
  const [tasks,         setTasks]         = useState<Task[]>([])
  const [loading,       setLoading]       = useState(true)
  const [filterStatus,  setFilterStatus]  = useState<'todos' | 'PENDIENTE' | 'CALIFICADO'>('todos')
  const [filterType,    setFilterType]    = useState<string>('todos')
  const [filterSubject, setFilterSubject] = useState<string>('todos')

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) return
    fetch(`${API_URL}/api/students/my-tasks`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(d => { setTasks(Array.isArray(d) ? d : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const materias    = [...new Set(tasks.map(t => t.subject.name))]
  const tipos       = [...new Set(tasks.map(t => t.type))]
  const pendientes  = tasks.filter(t => t.status === 'PENDIENTE').length
  const calificadas = tasks.filter(t => t.status === 'CALIFICADO').length
  const promedio    = tasks.filter(t => t.score !== null).length
    ? (tasks.filter(t => t.score !== null).reduce((s, t) => s + (t.score ?? 0), 0) /
       tasks.filter(t => t.score !== null).length).toFixed(1)
    : '—'

const tareasFiltradas = tasks.filter(t => {
    if (filterStatus  !== 'todos' && t.status       !== filterStatus)      return false
    if (filterType    !== 'todos' && t.type         !== filterType)        return false
    if (filterSubject !== 'todos' && t.subject.name !== filterSubject)     return false
    return true
  }).sort((a, b) => {
    const campoA = a.subject.campo || 'ZZZ'
    const campoB = b.subject.campo || 'ZZZ'
    if (campoA !== campoB) return campoA.localeCompare(campoB)
    return a.subject.name.localeCompare(b.subject.name)
  })

  const formatDate = (d?: string | null) => {
    if (!d) return null
    return new Date(d).toLocaleDateString('es-BO', { day:'2-digit', month:'short', year:'numeric' })
  }

  const isOverdue = (dueDate?: string | null, status?: string) => {
    if (!dueDate || status === 'CALIFICADO') return false
    return new Date(dueDate) < new Date()
  }

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:300 }}>
      <div className="spinner"/>
    </div>
  )

  return (
    <div>
      {/* Header */}
      <div style={{
        background:'linear-gradient(135deg,#1A3A7C,#2756B8)',
        borderRadius:12, padding:'20px 24px', marginBottom:24, color:'#fff',
      }}>
        <div style={{ fontSize:13, opacity:.75, marginBottom:4, display:'flex', alignItems:'center', gap:6 }}>
          <ClipboardList size={14}/> Tareas y Actividades
        </div>
        <div style={{ fontSize:20, fontWeight:800 }}>Mis Tareas</div>
        <div style={{ fontSize:13, opacity:.8, marginTop:4 }}>
          Evaluaciones, trabajos y actividades de todas las materias
        </div>
      </div>

      {/* Stats */}
      <div className="stats-grid" style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:16, marginBottom:24 }}>
        {[
          { label:'Pendientes',  value: pendientes,  color:'#BA7517', icon:<Clock size={18}/> },
          { label:'Calificadas', value: calificadas, color:'#0F6E56', icon:<CheckCircle size={18}/> },
          { label:'Promedio',    value: promedio,    color:'#1A3A7C', icon:<BookOpen size={18}/> },
        ].map(s => (
          <div key={s.label} style={{
            backgroundColor:'#fff', borderRadius:10, padding:'16px 18px',
            boxShadow:'0 1px 4px rgba(26,58,124,.08)',
          }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, color:s.color, marginBottom:8 }}>
              {s.icon}
              <span style={{ fontSize:11, fontWeight:600, textTransform:'uppercase', letterSpacing:'.4px' }}>
                {s.label}
              </span>
            </div>
            <div style={{ fontSize:28, fontWeight:800, color:'#1A3A7C' }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div style={{
        backgroundColor:'#fff', borderRadius:10, padding:'14px 18px',
        boxShadow:'0 1px 4px rgba(26,58,124,.08)', marginBottom:20,
        display:'flex', flexWrap:'wrap', gap:16, alignItems:'center',
      }}>
        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
          <Filter size={14} color="#6B8BB0"/>
          <span style={{ fontSize:12, color:'#6B8BB0', fontWeight:600 }}>Filtros:</span>
        </div>

        {/* Estado */}
        <div style={{ display:'flex', gap:6, alignItems:'center' }}>
          <span style={{ fontSize:11, color:'#6B8BB0' }}>Estado:</span>
          {[
            { label:'Todos',      value:'todos'      },
            { label:'Pendiente',  value:'PENDIENTE'  },
            { label:'Calificado', value:'CALIFICADO' },
          ].map(opt => (
            <button key={opt.value} onClick={() => setFilterStatus(opt.value as any)}
              style={{
                padding:'4px 12px', borderRadius:20, border:'none', cursor:'pointer', fontSize:12,
                backgroundColor: filterStatus === opt.value ? '#1A3A7C' : '#F0F6FC',
                color:           filterStatus === opt.value ? '#fff'    : '#1A3A7C',
                fontWeight:      filterStatus === opt.value ? 600       : 400,
              }}>
              {opt.label}
            </button>
          ))}
        </div>

        {/* Tipo */}
        <div style={{ display:'flex', gap:6, alignItems:'center', flexWrap:'wrap' }}>
          <span style={{ fontSize:11, color:'#6B8BB0' }}>Tipo:</span>
          <button onClick={() => setFilterType('todos')}
            style={{
              padding:'4px 12px', borderRadius:20, border:'none', cursor:'pointer', fontSize:12,
              backgroundColor: filterType === 'todos' ? '#1A3A7C' : '#F0F6FC',
              color:           filterType === 'todos' ? '#fff'    : '#1A3A7C',
              fontWeight:      filterType === 'todos' ? 600       : 400,
            }}>Todos</button>
          {tipos.map(t => (
            <button key={t} onClick={() => setFilterType(t)}
              style={{
                padding:'4px 12px', borderRadius:20, border:'none', cursor:'pointer', fontSize:12,
                backgroundColor: filterType === t ? TYPE_COLOR[t] || '#1A3A7C' : '#F0F6FC',
                color:           filterType === t ? '#fff' : '#1A3A7C',
                fontWeight:      filterType === t ? 600    : 400,
              }}>
              {TYPE_LABEL[t] || t}
            </button>
          ))}
        </div>

        {/* Materia */}
        {materias.length > 1 && (
          <div style={{ display:'flex', gap:6, alignItems:'center' }}>
            <span style={{ fontSize:11, color:'#6B8BB0' }}>Materia:</span>
            <select
              value={filterSubject}
              onChange={e => setFilterSubject(e.target.value)}
              style={{
                padding:'4px 10px', borderRadius:8, border:'1px solid #E0EAF5',
                fontSize:12, color:'#1A3A7C', backgroundColor:'#F0F6FC', cursor:'pointer',
              }}>
              <option value="todos">Todas</option>
              {materias.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
        )}
      </div>

      {/* Lista de tareas */}
      {tareasFiltradas.length === 0 ? (
        <div style={{
          backgroundColor:'#fff', borderRadius:10, padding:48,
          textAlign:'center', color:'#6B8BB0',
          boxShadow:'0 1px 4px rgba(26,58,124,.08)',
        }}>
          <ClipboardList size={40} style={{ marginBottom:12, opacity:.4 }}/>
          <div style={{ fontSize:15 }}>No hay tareas con los filtros seleccionados.</div>
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          {tareasFiltradas.map(task => {
            const overdue  = isOverdue(task.dueDate, task.status)
            const pct      = task.score !== null ? Math.round((task.score / task.maxScore) * 100) : null

            return (
              <div key={task.id} style={{
                backgroundColor:'#fff', borderRadius:10,
                boxShadow:'0 1px 4px rgba(26,58,124,.08)',
                border: overdue ? '1px solid #FECDD3' : '1px solid transparent',
                overflow:'hidden',
              }}>
                <div style={{ display:'flex', alignItems:'stretch' }}>
                  {/* Barra lateral de color por tipo */}
                  <div style={{
                    width:4, flexShrink:0,
                    backgroundColor: TYPE_COLOR[task.type] || '#6B8BB0',
                  }}/>

                  <div style={{ flex:1, padding:'16px 18px', display:'flex', gap:16, alignItems:'center' }}>
                    {/* Info principal */}
                    <div style={{ flex:1 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6, flexWrap:'wrap' }}>
                        <span style={{
                          fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:20,
                          backgroundColor: TYPE_COLOR[task.type] || '#6B8BB0', color:'#fff',
                        }}>
                          {TYPE_LABEL[task.type] || task.type}
                        </span>
                        <span style={{
                          fontSize:10, fontWeight:600, padding:'2px 8px', borderRadius:20,
                          backgroundColor: task.status === 'CALIFICADO' ? '#E8F8F2' : '#FFFBEA',
                          color:           task.status === 'CALIFICADO' ? '#0F6E56' : '#BA7517',
                        }}>
                          {task.status === 'CALIFICADO' ? 'Calificado' : 'Pendiente'}
                        </span>
                        {overdue && (
                          <span style={{
                            fontSize:10, fontWeight:600, padding:'2px 8px', borderRadius:20,
                            backgroundColor:'#FDE8E8', color:'#c0392b',
                          }}>Vencido</span>
                        )}
                      </div>

                      <div style={{ fontSize:15, fontWeight:700, color:'#1A3A7C', marginBottom:4 }}>
                        {task.title}
                      </div>

                      {task.description && (
                        <div style={{ fontSize:12, color:'#6B8BB0', marginBottom:6, lineHeight:1.5 }}>
                          {task.description}
                        </div>
                      )}

                      <div style={{ display:'flex', gap:16, flexWrap:'wrap' }}>
                        <span style={{ fontSize:12, color:'#6B8BB0' }}>
                          📚 {task.subject.name}
                        </span>
                        <span style={{ fontSize:12, color:'#6B8BB0' }}>
                          👤 {task.teacher}
                        </span>
                        {task.trimester && (
                          <span style={{ fontSize:12, color:'#6B8BB0' }}>
                            📅 {task.trimester.name || `${task.trimester.number}er Trimestre`}
                          </span>
                        )}
                        {task.dueDate && (
                          <span style={{ fontSize:12, color: overdue ? '#c0392b' : '#6B8BB0', fontWeight: overdue ? 600 : 400 }}>
                            ⏰ Entrega: {formatDate(task.dueDate)}
                          </span>
                        )}
                      </div>

                      {task.note && (
                        <div style={{
                          marginTop:8, padding:'8px 12px', borderRadius:8,
                          backgroundColor:'#F0F6FC', fontSize:12, color:'#1A3A7C',
                        }}>
                          💬 {task.note}
                        </div>
                      )}
                    </div>

                    {/* Calificación */}
                    <div style={{ flexShrink:0, textAlign:'center', minWidth:80 }}>
                      {task.score !== null ? (
                        <div>
                          <div style={{
                            fontSize:32, fontWeight:800,
                            color: task.score >= (task.maxScore * 0.51) ? '#0F6E56' : '#c0392b',
                          }}>
                            {task.score}
                          </div>
                          <div style={{ fontSize:11, color:'#6B8BB0' }}>de {task.maxScore}</div>
                          {pct !== null && (
                            <div style={{ marginTop:6 }}>
                              <div style={{
                                height:4, width:70, backgroundColor:'#F0F6FC',
                                borderRadius:2, overflow:'hidden',
                              }}>
                                <div style={{
                                  height:'100%', borderRadius:2,
                                  width:`${Math.min(pct,100)}%`,
                                  backgroundColor: task.score >= (task.maxScore * 0.51) ? '#0F6E56' : '#c0392b',
                                }}/>
                              </div>
                              <div style={{ fontSize:10, color:'#6B8BB0', marginTop:2 }}>{pct}%</div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div>
                          <div style={{ fontSize:11, color:'#BA7517', fontWeight:600 }}>Sin nota</div>
                          <div style={{ fontSize:10, color:'#6B8BB0', marginTop:2 }}>
                            Máx: {task.maxScore}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <style>{`
        .spinner{width:24px;height:24px;border:2px solid rgba(26,58,124,.2);border-top-color:#1A3A7C;border-radius:50%;animation:spin .7s linear infinite}
        @keyframes spin{to{transform:rotate(360deg)}}
        @media(max-width:768px){.stats-grid{grid-template-columns:1fr 1fr}}
      `}</style>
    </div>
  )
}