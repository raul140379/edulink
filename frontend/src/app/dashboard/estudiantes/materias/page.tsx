'use client'

import { useEffect, useState } from 'react'
import { BookOpen, Clock, CheckCircle, AlertCircle, User } from 'lucide-react'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

interface Trimestre { id: number; number: number; name?: string }

interface Materia {
  subjectId:    number
  subjectName:  string
  campo:        string | null
  hoursPerWeek: number
  teacher:      { id: number; firstName: string; lastName: string; specialty: string | null }
  trimestres:   Trimestre[]
  notas:        Record<number, number>
  avg:          number | null
  aprobado:     boolean | null
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
  COSMOS_PENSAMIENTO:            '#6B21A8',
  CIENCIA_TECNOLOGIA_PRODUCCION: '#633806',
}
const CAMPO_BG: Record<string, string> = {
  VIDA_TIERRA_TERRITORIO:        '#E8F8F2',
  COMUNIDAD_SOCIEDAD:            '#E0ECF8',
  COSMOS_PENSAMIENTO:            '#F3E8FF',
  CIENCIA_TECNOLOGIA_PRODUCCION: '#FFF3E0',
}

export default function MateriasPage() {
  const [materias,     setMaterias]     = useState<Materia[]>([])
  const [loading,      setLoading]      = useState(true)
  const [filterCampo,  setFilterCampo]  = useState<string>('todos')

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) return
    fetch(`${API_URL}/api/students/my-subjects`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(d => { setMaterias(Array.isArray(d) ? d : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const campos       = [...new Set(materias.map(m => m.campo).filter(Boolean))] as string[]
  const aprobadas    = materias.filter(m => m.aprobado === true).length
  const reprobadas   = materias.filter(m => m.aprobado === false).length
  const sinNotas     = materias.filter(m => m.avg === null).length
  const totalHoras   = materias.reduce((s, m) => s + (m.hoursPerWeek || 0), 0)

  const filtradas = materias.filter(m =>
    filterCampo === 'todos' || m.campo === filterCampo
  )

  const trimLabel = (t: Trimestre) => t.name || `${t.number}er T.`

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:300 }}>
      <div className="spinner"/>
    </div>
  )

  return (
    <div>
      {/* Header */}
      <div className="banner">
        <div>
          <div style={{ fontSize:13, opacity:.8, marginBottom:4, display:'flex', alignItems:'center', gap:6 }}>
            <BookOpen size={14}/> Mis Materias
          </div>
          <div style={{ fontSize:22, fontWeight:800 }}>Plan de Estudios</div>
          <div style={{ fontSize:13, opacity:.8, marginTop:4 }}>
            Materias, maestros y calificaciones de tu curso
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="summary-grid">
        <div className="sum-card accent">
          <BookOpen size={26} color="#fff"/>
          <div>
            <div className="sum-label">Total Materias</div>
            <div className="sum-value">{materias.length}</div>
          </div>
        </div>
        <div className="sum-card">
          <Clock size={26} color="#1A7DB8"/>
          <div>
            <div className="sum-label">Horas / semana</div>
            <div className="sum-value" style={{ color:'#1A7DB8' }}>{totalHoras}</div>
          </div>
        </div>
        <div className="sum-card">
          <CheckCircle size={26} color="#0F6E56"/>
          <div>
            <div className="sum-label">Aprobadas</div>
            <div className="sum-value" style={{ color:'#0F6E56' }}>{aprobadas}</div>
          </div>
        </div>
        <div className="sum-card">
          <AlertCircle size={26} color="#c0392b"/>
          <div>
            <div className="sum-label">Reprobadas</div>
            <div className="sum-value" style={{ color:'#c0392b' }}>{reprobadas}</div>
          </div>
        </div>
      </div>

      {/* Filtro campo */}
      {campos.length > 1 && (
        <div style={{
          backgroundColor:'#fff', borderRadius:10, padding:'12px 18px',
          border:'1px solid #CBE0F0', marginBottom:20,
          display:'flex', gap:8, flexWrap:'wrap', alignItems:'center',
        }}>
          <span style={{ fontSize:11, color:'#6B8BB0', fontWeight:600 }}>Campo:</span>
          <button onClick={() => setFilterCampo('todos')} style={{
            padding:'4px 12px', borderRadius:20, border:'none', cursor:'pointer', fontSize:12,
            backgroundColor: filterCampo === 'todos' ? '#1A7DB8' : '#F0F6FC',
            color:           filterCampo === 'todos' ? '#fff'    : '#1A3A7C',
            fontWeight:      filterCampo === 'todos' ? 600       : 400,
          }}>Todos</button>
          {campos.map(c => (
            <button key={c} onClick={() => setFilterCampo(c)} style={{
              padding:'4px 12px', borderRadius:20, border:'none', cursor:'pointer', fontSize:12,
              backgroundColor: filterCampo === c ? CAMPO_COLOR[c] : CAMPO_BG[c] || '#F0F6FC',
              color:           filterCampo === c ? '#fff'          : CAMPO_COLOR[c] || '#1A3A7C',
              fontWeight:      filterCampo === c ? 600             : 500,
            }}>{CAMPO_LABEL[c] || c}</button>
          ))}
        </div>
      )}

      {/* Lista de materias */}
      {filtradas.length === 0 ? (
        <div style={{
          backgroundColor:'#fff', borderRadius:12, padding:48,
          textAlign:'center', color:'#6B8BB0', border:'1px solid #CBE0F0',
        }}>
          <BookOpen size={40} style={{ marginBottom:12, opacity:.3 }}/>
          <div>No hay materias registradas aún.</div>
        </div>
      ) : (
        <div className="materias-list">
          {filtradas.map(m => (
            <div key={m.subjectId} className="materia-card">
              {/* Header */}
              <div className="materia-header">
                <div style={{ display:'flex', alignItems:'center', gap:14, flex:1 }}>
                  {/* Avatar materia */}
                  <div style={{
                    width:48, height:48, borderRadius:10, flexShrink:0,
                    backgroundColor: m.campo ? CAMPO_COLOR[m.campo] : '#1A7DB8',
                    display:'flex', alignItems:'center', justifyContent:'center',
                    fontSize:11, fontWeight:800, color:'#fff', textAlign:'center', lineHeight:1.2,
                    padding:4,
                  }}>
                    {m.subjectName.split(' ').slice(0,2).map(w => w[0]).join('')}
                  </div>

                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:15, fontWeight:700, color:'#1A3A7C', marginBottom:4 }}>
                      {m.subjectName}
                    </div>
                    <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                      {m.campo && (
                        <span style={{
                          fontSize:10, fontWeight:600, padding:'2px 8px', borderRadius:20,
                          backgroundColor: CAMPO_BG[m.campo] || '#F0F6FC',
                          color: CAMPO_COLOR[m.campo] || '#1A3A7C',
                        }}>
                          {CAMPO_LABEL[m.campo] || m.campo}
                        </span>
                      )}
                      {m.hoursPerWeek > 0 && (
                        <span style={{
                          fontSize:10, fontWeight:600, padding:'2px 8px', borderRadius:20,
                          backgroundColor:'#E3F2FD', color:'#1A7DB8',
                          display:'flex', alignItems:'center', gap:3,
                        }}>
                          <Clock size={9}/> {m.hoursPerWeek} hrs/sem
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Promedio */}
                <div style={{ flexShrink:0, textAlign:'center', minWidth:70 }}>
                  {m.avg !== null ? (
                    <>
                      <div style={{
                        fontSize:26, fontWeight:800,
                        color: m.aprobado ? '#0F6E56' : '#c0392b',
                      }}>{m.avg.toFixed(1)}</div>
                      <div style={{ fontSize:10, color:'#6B8BB0' }}>promedio</div>
                      <span style={{
                        fontSize:10, fontWeight:600, padding:'2px 8px', borderRadius:20,
                        backgroundColor: m.aprobado ? '#E8F8F2' : '#FDE8E8',
                        color:           m.aprobado ? '#0F6E56' : '#c0392b',
                      }}>
                        {m.aprobado ? 'Aprobado' : 'Reprobado'}
                      </span>
                    </>
                  ) : (
                    <span style={{ fontSize:11, color:'#6B8BB0' }}>Sin notas</span>
                  )}
                </div>
              </div>

              {/* Maestro + Notas por trimestre */}
              <div className="materia-body">
                {/* Maestro */}
                <div style={{
                  display:'flex', alignItems:'center', gap:8,
                  padding:'10px 18px', borderBottom:'1px solid #F0F6FC',
                  backgroundColor:'#FAFCFF',
                }}>
                  <User size={13} color="#6B8BB0"/>
                  <span style={{ fontSize:12, color:'#6B8BB0' }}>Maestro/a:</span>
                  <span style={{ fontSize:13, fontWeight:600, color:'#1A3A7C' }}>
                    {m.teacher.lastName} {m.teacher.firstName}
                  </span>
                  {m.teacher.specialty && (
                    <span style={{ fontSize:11, color:'#6B8BB0' }}>— {m.teacher.specialty}</span>
                  )}
                </div>

                {/* Notas por trimestre */}
                {m.trimestres.length > 0 && (
                  <div style={{ display:'flex', borderTop:'1px solid #F0F6FC' }}>
                    {m.trimestres.map(t => {
                      const nota = m.notas[t.id]
                      return (
                        <div key={t.id} style={{
                          flex:1, padding:'12px 16px', textAlign:'center',
                          borderRight:'1px solid #F0F6FC',
                        }}>
                          <div style={{ fontSize:10, color:'#6B8BB0', fontWeight:600, marginBottom:6, textTransform:'uppercase' }}>
                            {trimLabel(t)}
                          </div>
                          <div style={{
                            fontSize:20, fontWeight:800,
                            color: nota === undefined ? '#ccc' : nota >= 51 ? '#0F6E56' : '#c0392b',
                          }}>
                            {nota !== undefined ? nota : '—'}
                          </div>
                        </div>
                      )
                    })}
                    {/* Promedio final */}
                    <div style={{ flex:1, padding:'12px 16px', textAlign:'center', backgroundColor:'#F8FBFF' }}>
                      <div style={{ fontSize:10, color:'#6B8BB0', fontWeight:600, marginBottom:6, textTransform:'uppercase' }}>
                        Promedio
                      </div>
                      <div style={{
                        fontSize:20, fontWeight:800,
                        color: m.avg === null ? '#ccc' : m.aprobado ? '#0F6E56' : '#c0392b',
                      }}>
                        {m.avg?.toFixed(1) ?? '—'}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <style>{`
        .banner{background:linear-gradient(135deg,#1A7DB8 0%,#1565A0 60%,#1A3A7C 100%);border-radius:14px;padding:24px 28px;margin-bottom:20px;color:#fff;box-shadow:0 4px 16px rgba(26,125,184,.3)}
        .summary-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin-bottom:20px}
        .sum-card{background:#fff;border:1px solid #CBE0F0;border-radius:12px;padding:16px;display:flex;align-items:center;gap:12px}
        .sum-card.accent{background:#1A7DB8;border-color:#1A7DB8}
        .sum-card.accent .sum-label{color:rgba(255,255,255,.75)}
        .sum-card.accent .sum-value{color:#fff}
        .sum-label{font-size:11px;color:#6B8BB0;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px}
        .sum-value{font-size:22px;font-weight:700;color:#1A3A7C}
        .materias-list{display:flex;flex-direction:column;gap:14px}
        .materia-card{background:#fff;border:1px solid #CBE0F0;border-radius:12px;overflow:hidden}
        .materia-header{display:flex;align-items:center;gap:14px;padding:16px 18px;background:#F8FBFF;border-bottom:1px solid #CBE0F0}
        .materia-body{display:flex;flex-direction:column}
        .spinner{width:28px;height:28px;border:3px solid rgba(26,125,184,.2);border-top-color:#1A7DB8;border-radius:50%;animation:spin .7s linear infinite}
        @keyframes spin{to{transform:rotate(360deg)}}
        @media(max-width:768px){.summary-grid{grid-template-columns:1fr 1fr}.materia-header{flex-wrap:wrap}}
      `}</style>
    </div>
  )
}