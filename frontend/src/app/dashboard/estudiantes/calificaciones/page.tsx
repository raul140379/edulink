'use client'

import { useEffect, useState } from 'react'
import { BookOpen, TrendingUp, CheckCircle, AlertCircle, Award } from 'lucide-react'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

interface Trimestre { id: number; number: number; name?: string }

interface NotaMateria {
  subjectId:   number
  subjectName: string
  campo:       string | null
  teacher:     string
  trimestres:  Record<number, number>
  avg:         number | null
}

interface GradesData {
  course:       { grade: string; parallel: string; level: string; shift: string } | null
  academicYear: { year: number } | null
  trimestres:   Trimestre[]
  notas:        NotaMateria[]
}

const CAMPO_LABEL: Record<string, string> = {
  VIDA_TIERRA_TERRITORIO:        'Vida, Tierra y Territorio',
  COMUNIDAD_SOCIEDAD:            'Comunidad y Sociedad',
  COSMOS_PENSAMIENTO:            'Cosmos y Pensamiento',
  CIENCIA_TECNOLOGIA_PRODUCCION: 'Ciencia, Tecnología y Producción',
}

const CAMPO_COLOR: Record<string, string> = {
  VIDA_TIERRA_TERRITORIO:        '#0F6E56',
  COMUNIDAD_SOCIEDAD:            '#1A3A7C',
  COSMOS_PENSAMIENTO:            '#633806',
  CIENCIA_TECNOLOGIA_PRODUCCION: '#8B1A7C',
}

export default function CalificacionesPage() {
  const [data,         setData]         = useState<GradesData | null>(null)
  const [loading,      setLoading]      = useState(true)
  const [selectedTrim, setSelectedTrim] = useState<'todos' | number>('todos')
  const [filterCampo,  setFilterCampo]  = useState<string>('todos')

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) return
    fetch(`${API_URL}/api/students/my-grades`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:300 }}>
      <div className="spinner"/>
    </div>
  )

  if (!data || !data.notas.length) return (
    <div style={{ textAlign:'center', padding:48, color:'#6B8BB0' }}>
      <BookOpen size={40} style={{ marginBottom:12, opacity:.4 }}/>
      <div style={{ fontSize:15 }}>No hay calificaciones registradas aún.</div>
    </div>
  )

  const { trimestres, notas, course, academicYear } = data

  // Stats generales
  const notasConPromedio = notas.filter(n => n.avg !== null)
  const promedioGeneral  = notasConPromedio.length
    ? (notasConPromedio.reduce((s, n) => s + (n.avg ?? 0), 0) / notasConPromedio.length).toFixed(1)
    : '—'
  const aprobadas  = notasConPromedio.filter(n => (n.avg ?? 0) >= 51).length
  const reprobadas = notasConPromedio.filter(n => (n.avg ?? 0) < 51).length

  // Filtrar notas
  const camposDisponibles = [...new Set(notas.map(n => n.campo).filter(Boolean))] as string[]
  const notasFiltradas = notas.filter(n =>
    filterCampo === 'todos' || n.campo === filterCampo
  )

  const scoreColor = (v?: number | null) => {
    if (v === undefined || v === null) return '#6B8BB0'
    return v >= 51 ? '#0F6E56' : '#c0392b'
  }

  const trimLabel = (t: Trimestre) => t.name || `${t.number}er Trim.`

  return (
    <div>
      {/* Header */}
      <div style={{
        background:'linear-gradient(135deg,#1A3A7C,#2756B8)',
        borderRadius:12, padding:'20px 24px', marginBottom:24, color:'#fff',
      }}>
        <div style={{ fontSize:13, opacity:.75, marginBottom:4, display:'flex', alignItems:'center', gap:6 }}>
          <BookOpen size={14}/> Calificaciones
        </div>
        <div style={{ fontSize:20, fontWeight:800 }}>
          {academicYear ? `Gestión ${academicYear.year}` : 'Mis Calificaciones'}
        </div>
        {course && (
          <div style={{ fontSize:13, opacity:.8, marginTop:4 }}>
            {course.grade} {course.parallel} · {course.level} · Turno {course.shift}
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="stats-grid" style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:16, marginBottom:24 }}>
        {[
          { label:'Promedio General', value: promedioGeneral, icon:<TrendingUp size={20}/>,  color:'#1A3A7C' },
          { label:'Aprobadas',        value: aprobadas,       icon:<CheckCircle size={20}/>, color:'#0F6E56' },
          { label:'Reprobadas',       value: reprobadas,      icon:<AlertCircle size={20}/>, color:'#c0392b' },
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
      <div style={{ display:'flex', gap:10, flexWrap:'wrap', marginBottom:20 }}>
        {/* Filtro trimestre */}
        <div style={{ display:'flex', gap:6, alignItems:'center' }}>
          <span style={{ fontSize:12, color:'#6B8BB0', fontWeight:600 }}>Trimestre:</span>
          {[{ label:'Todos', value:'todos' as const }, ...trimestres.map(t => ({ label: trimLabel(t), value: t.id as number | 'todos' }))].map(opt => (
            <button key={String(opt.value)} onClick={() => setSelectedTrim(opt.value as any)}
              style={{
                padding:'5px 12px', borderRadius:20, border:'none', cursor:'pointer', fontSize:12,
                backgroundColor: selectedTrim === opt.value ? '#1A3A7C' : '#F0F6FC',
                color:           selectedTrim === opt.value ? '#fff'    : '#1A3A7C',
                fontWeight:      selectedTrim === opt.value ? 600       : 400,
              }}>
              {opt.label}
            </button>
          ))}
        </div>
        {/* Filtro campo */}
        {camposDisponibles.length > 1 && (
          <div style={{ display:'flex', gap:6, alignItems:'center', flexWrap:'wrap' }}>
            <span style={{ fontSize:12, color:'#6B8BB0', fontWeight:600 }}>Campo:</span>
            <button onClick={() => setFilterCampo('todos')}
              style={{
                padding:'5px 12px', borderRadius:20, border:'none', cursor:'pointer', fontSize:12,
                backgroundColor: filterCampo === 'todos' ? '#1A3A7C' : '#F0F6FC',
                color:           filterCampo === 'todos' ? '#fff'    : '#1A3A7C',
                fontWeight:      filterCampo === 'todos' ? 600       : 400,
              }}>Todos</button>
            {camposDisponibles.map(c => (
              <button key={c} onClick={() => setFilterCampo(c)}
                style={{
                  padding:'5px 12px', borderRadius:20, border:'none', cursor:'pointer', fontSize:12,
                  backgroundColor: filterCampo === c ? CAMPO_COLOR[c] || '#1A3A7C' : '#F0F6FC',
                  color:           filterCampo === c ? '#fff' : '#1A3A7C',
                  fontWeight:      filterCampo === c ? 600    : 400,
                }}>
                {CAMPO_LABEL[c] || c}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Tabla de notas */}
      <div style={{ backgroundColor:'#fff', borderRadius:10, boxShadow:'0 1px 4px rgba(26,58,124,.08)', overflow:'hidden' }}>
        <div style={{ padding:'14px 18px', borderBottom:'1px solid #F0F6FC', display:'flex', alignItems:'center', gap:8 }}>
          <Award size={16} color="#1A3A7C"/>
          <span style={{ fontWeight:700, fontSize:14, color:'#1A3A7C' }}>Detalle por Materia</span>
        </div>
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead>
              <tr style={{ backgroundColor:'#F0F6FC' }}>
                <th style={th}>Materia</th>
                <th style={th}>Campo</th>
                <th style={th}>Maestro/a</th>
                {selectedTrim === 'todos'
                  ? trimestres.map(t => <th key={t.id} style={{ ...th, textAlign:'center' }}>{trimLabel(t)}</th>)
                  : <th style={{ ...th, textAlign:'center' }}>Nota</th>
                }
                <th style={{ ...th, textAlign:'center' }}>Promedio</th>
                <th style={{ ...th, textAlign:'center' }}>Estado</th>
              </tr>
            </thead>
            <tbody>
              {notasFiltradas.map(n => {
                const avg = n.avg
                const aprobado = avg !== null && avg !== undefined && avg >= 51

                return (
                  <tr key={n.subjectId} style={{ borderTop:'1px solid #F0F6FC' }}
                    onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#FAFCFF')}
                    onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#fff')}>
                    <td style={{ ...td, fontWeight:600 }}>{n.subjectName}</td>
                    <td style={td}>
                      {n.campo ? (
                        <span style={{
                          fontSize:10, fontWeight:600, padding:'2px 8px', borderRadius:20,
                          backgroundColor: CAMPO_COLOR[n.campo] || '#6B8BB0',
                          color:'#fff', whiteSpace:'nowrap',
                        }}>
                          {CAMPO_LABEL[n.campo] || n.campo}
                        </span>
                      ) : '—'}
                    </td>
                    <td style={{ ...td, fontSize:12, color:'#6B8BB0' }}>{n.teacher}</td>

                    {selectedTrim === 'todos'
                      ? trimestres.map(t => {
                          const val = n.trimestres[t.id]
                          return (
                            <td key={t.id} style={{ ...td, textAlign:'center' }}>
                              {val !== undefined ? (
                                <span style={{
                                  fontWeight:700, fontSize:15,
                                  color: scoreColor(val),
                                }}>{val}</span>
                              ) : <span style={{ color:'#ccc' }}>—</span>}
                            </td>
                          )
                        })
                      : (() => {
                          const val = n.trimestres[selectedTrim as number]
                          return (
                            <td style={{ ...td, textAlign:'center' }}>
                              {val !== undefined
                                ? <span style={{ fontWeight:700, fontSize:15, color:scoreColor(val) }}>{val}</span>
                                : <span style={{ color:'#ccc' }}>—</span>}
                            </td>
                          )
                        })()
                    }

                    <td style={{ ...td, textAlign:'center' }}>
                      <span style={{ fontWeight:800, fontSize:16, color: scoreColor(avg) }}>
                        {avg?.toFixed(1) ?? '—'}
                      </span>
                    </td>
                    <td style={{ ...td, textAlign:'center' }}>
                      {avg !== null && avg !== undefined ? (
                        <span style={{
                          fontSize:11, fontWeight:600, padding:'3px 10px', borderRadius:20,
                          backgroundColor: aprobado ? '#E8F8F2' : '#FDE8E8',
                          color:           aprobado ? '#0F6E56' : '#c0392b',
                        }}>
                          {aprobado ? 'Aprobado' : 'Reprobado'}
                        </span>
                      ) : <span style={{ color:'#ccc', fontSize:12 }}>Sin notas</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <style>{`
        .spinner{width:24px;height:24px;border:2px solid rgba(26,58,124,.2);border-top-color:#1A3A7C;border-radius:50%;animation:spin .7s linear infinite}
        @keyframes spin{to{transform:rotate(360deg)}}
        @media(max-width:768px){.stats-grid{grid-template-columns:1fr 1fr}}
      `}</style>
    </div>
  )
}

const th: React.CSSProperties = {
  padding:'10px 14px', textAlign:'left', fontSize:11,
  fontWeight:600, color:'#1A3A7C', textTransform:'uppercase', letterSpacing:'.5px',
}
const td: React.CSSProperties = {
  padding:'12px 14px', fontSize:13, color:'#1A3A7C',
}