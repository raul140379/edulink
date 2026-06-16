'use client'

import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, ChevronDown, ChevronUp } from 'lucide-react'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

interface TeacherRecord {
  teacher: { id: number; firstName: string; lastName: string; ci?: string }
  records: {
    id: number; date: string; checkIn: string | null
    checkOut: string | null; status: string; note: string | null
  }[]
  summary: { presente: number; tardanza: number; ausente: number; licencia: number; total: number }
}

interface ReportData {
  period: { start: string; end: string; month: number; year: number; week: number | null }
  teachers: TeacherRecord[]
  totalRecords: number
}

const STATUS_CONFIG: Record<string, { label: string; bg: string; color: string }> = {
  PRESENTE: { label: 'Presente',  bg: '#E1F5EE', color: '#0F6E56' },
  TARDANZA: { label: 'Tardanza',  bg: '#FFFBEA', color: '#BA7517' },
  AUSENTE:  { label: 'Ausente',   bg: '#FFF0F0', color: '#C0392B' },
  LICENCIA: { label: 'Licencia',  bg: '#E0ECF8', color: '#1A3A7C' },
}

const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

const fmtTime = (d: string | null) => d ? new Date(d).toLocaleTimeString('es-BO', { hour:'2-digit', minute:'2-digit' }) : '—'
const fmtDate = (d: string) => new Date(d).toLocaleDateString('es-BO', { weekday:'short', day:'2-digit', month:'short' })
const fmtDateFull = (d: string) => new Date(d).toLocaleDateString('es-BO', { weekday:'long', day:'2-digit', month:'long', year:'numeric' })

export default function AsistenciaReporte() {
  const [data,     setData]     = useState<ReportData | null>(null)
  const [loading,  setLoading]  = useState(false)
  const [month,    setMonth]    = useState(new Date().getMonth() + 1)
  const [year,     setYear]     = useState(new Date().getFullYear())
  const [mode,     setMode]     = useState<'diario' | 'semanal' | 'mensual'>('diario')
  const [week,     setWeek]     = useState(1)
  const [selDate,  setSelDate]  = useState(new Date().toISOString().split('T')[0])
  const [expanded, setExpanded] = useState<number | null>(null)
  const [search,   setSearch]   = useState('')

  const token = () => localStorage.getItem('token') || ''
  const auth  = () => ({ Authorization: `Bearer ${token()}` })

  const loadReport = async () => {
    setLoading(true)
    try {
      let url = ''
      if (mode === 'diario') {
        const d = new Date(selDate)
        const m = d.getMonth() + 1
        const y = d.getFullYear()
        url = `${API}/api/teacher-attendance/report?month=${m}&year=${y}&date=${selDate}`
      } else if (mode === 'semanal') {
        url = `${API}/api/teacher-attendance/report?month=${month}&year=${year}&week=${week}`
      } else {
        url = `${API}/api/teacher-attendance/report?month=${month}&year=${year}`
      }
      const res = await fetch(url, { headers: auth() })
      const d   = await res.json()
      if (res.ok) setData(d)
    } catch { console.error('Error al cargar reporte') }
    finally  { setLoading(false) }
  }

  useEffect(() => { loadReport() }, [month, year, mode, week, selDate])

  const prevMonth = () => { if (month===1){setMonth(12);setYear(y=>y-1)}else setMonth(m=>m-1) }
  const nextMonth = () => { if (month===12){setMonth(1);setYear(y=>y+1)}else setMonth(m=>m+1) }

  const filteredTeachers = data?.teachers.filter(t =>
    search==='' ||
    `${t.teacher.lastName} ${t.teacher.firstName}`.toLowerCase().includes(search.toLowerCase())
  ) || []

  const totals = filteredTeachers.reduce((acc, t) => ({
    presente: acc.presente + t.summary.presente,
    tardanza: acc.tardanza + t.summary.tardanza,
    ausente:  acc.ausente  + t.summary.ausente,
    licencia: acc.licencia + t.summary.licencia,
    total:    acc.total    + t.summary.total,
  }), { presente:0, tardanza:0, ausente:0, licencia:0, total:0 })

  return (
    <div>
      {/* Header */}
      <div style={{marginBottom:24}}>
        <h1 style={{fontSize:20,fontWeight:700,color:'#1A3A7C',marginBottom:4}}>Reporte de Asistencia</h1>
        <p style={{fontSize:13,color:'#6B8BB0'}}>Control de asistencia de maestros — U.E. Naciones Unidas</p>
      </div>

      {/* Controles */}
      <div style={{background:'#fff',border:'1px solid #CBE0F0',borderRadius:12,padding:'16px 20px',marginBottom:20,display:'flex',flexWrap:'wrap',gap:16,alignItems:'center'}}>
        
        {/* Modo */}
        <div style={{display:'flex',gap:6}}>
          {(['diario','semanal','mensual'] as const).map(m=>(
            <button key={m} onClick={()=>setMode(m)} style={{
              padding:'6px 16px',borderRadius:20,border:'none',cursor:'pointer',fontSize:12,fontWeight:600,
              background:mode===m?'#1A3A7C':'#F0F6FC',
              color:mode===m?'#fff':'#1A3A7C',
              textTransform:'capitalize',
            }}>{m.charAt(0).toUpperCase()+m.slice(1)}</button>
          ))}
        </div>

        {/* Selector diario */}
        {mode==='diario' && (
          <input
            type="date"
            value={selDate}
            onChange={e=>setSelDate(e.target.value)}
            style={{padding:'7px 12px',border:'1.5px solid #CBE0F0',borderRadius:8,fontSize:13,color:'#1A3A7C',outline:'none'}}
          />
        )}

        {/* Navegación mes (semanal y mensual) */}
        {(mode==='semanal'||mode==='mensual') && (
          <div style={{display:'flex',alignItems:'center',gap:8}}>
            <button onClick={prevMonth} style={{background:'#F0F6FC',border:'none',borderRadius:8,width:32,height:32,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',color:'#1A3A7C'}}>
              <ChevronLeft size={16}/>
            </button>
            <span style={{fontSize:14,fontWeight:700,color:'#1A3A7C',minWidth:130,textAlign:'center'}}>
              {MONTHS[month-1]} {year}
            </span>
            <button onClick={nextMonth} style={{background:'#F0F6FC',border:'none',borderRadius:8,width:32,height:32,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',color:'#1A3A7C'}}>
              <ChevronRight size={16}/>
            </button>
          </div>
        )}

        {/* Semanas */}
        {mode==='semanal' && (
          <div style={{display:'flex',alignItems:'center',gap:6}}>
            <span style={{fontSize:12,color:'#6B8BB0'}}>Semana:</span>
            {[1,2,3,4,5].map(w=>(
              <button key={w} onClick={()=>setWeek(w)} style={{
                width:32,height:32,borderRadius:8,border:'none',cursor:'pointer',fontSize:12,fontWeight:600,
                background:week===w?'#1A3A7C':'#F0F6FC',
                color:week===w?'#fff':'#1A3A7C',
              }}>{w}</button>
            ))}
          </div>
        )}

        {/* Búsqueda */}
        <input
          type="text"
          placeholder="Buscar maestro..."
          value={search}
          onChange={e=>setSearch(e.target.value)}
          style={{padding:'8px 12px',border:'1.5px solid #CBE0F0',borderRadius:8,fontSize:13,color:'#1A3A7C',outline:'none',marginLeft:'auto',width:200}}
        />
      </div>

      {/* Período activo */}
      {mode==='diario' && (
        <div style={{background:'#E0ECF8',border:'1px solid #CBE0F0',borderRadius:8,padding:'8px 16px',marginBottom:16,fontSize:13,color:'#1A3A7C',fontWeight:600,textTransform:'capitalize'}}>
          📅 {fmtDateFull(selDate)}
        </div>
      )}

      {/* Totales generales */}
      {data && (
        <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:10,marginBottom:20}}>
          {[
            {label:'Presente',   value:totals.presente, color:'#0F6E56', bg:'#E1F5EE'},
            {label:'Tardanza',   value:totals.tardanza, color:'#BA7517', bg:'#FFFBEA'},
            {label:'Ausente',    value:totals.ausente,  color:'#C0392B', bg:'#FFF0F0'},
            {label:'Licencia',   value:totals.licencia, color:'#1A3A7C', bg:'#E0ECF8'},
            {label:'Total días', value:totals.total,    color:'#633806', bg:'#FDF0E6'},
          ].map(s=>(
            <div key={s.label} style={{background:s.bg,borderRadius:10,padding:'12px 14px',textAlign:'center',border:`1px solid ${s.color}22`}}>
              <div style={{fontSize:24,fontWeight:800,color:s.color}}>{s.value}</div>
              <div style={{fontSize:11,color:s.color,fontWeight:600,marginTop:2}}>{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Lista de maestros */}
      {loading ? (
        <div style={{display:'flex',justifyContent:'center',padding:48}}><div className="spinner"/></div>
      ) : filteredTeachers.length === 0 ? (
        <div style={{background:'#fff',border:'1px solid #CBE0F0',borderRadius:12,padding:48,textAlign:'center',color:'#6B8BB0'}}>
          No hay registros para el período seleccionado
        </div>
      ) : (
        <div style={{display:'flex',flexDirection:'column',gap:10}}>
          {filteredTeachers.map(t => {
            const isOpen = expanded === t.teacher.id
            const pct    = t.summary.total > 0 ? Math.round((t.summary.presente / t.summary.total) * 100) : 0
            return (
              <div key={t.teacher.id} style={{background:'#fff',border:'1px solid #CBE0F0',borderRadius:12,overflow:'hidden'}}>
                {/* Cabecera maestro */}
                <div
                  style={{display:'flex',alignItems:'center',padding:'14px 18px',cursor:'pointer',gap:16}}
                  onClick={()=>setExpanded(isOpen?null:t.teacher.id)}>
                  <div style={{width:38,height:38,borderRadius:'50%',background:'#1A3A7C',color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700,fontSize:14,flexShrink:0}}>
                    {t.teacher.lastName.charAt(0)}
                  </div>
                  <div style={{flex:1}}>
                    <div style={{fontWeight:700,fontSize:14,color:'#1A3A7C'}}>{t.teacher.lastName} {t.teacher.firstName}</div>
                    {t.teacher.ci && <div style={{fontSize:12,color:'#6B8BB0'}}>CI: {t.teacher.ci}</div>}
                  </div>

                  {/* En modo diario mostrar entrada/salida directo */}
                  {mode==='diario' && t.records[0] ? (
                    <div style={{display:'flex',gap:20,alignItems:'center'}}>
                      <div style={{textAlign:'center'}}>
                        <div style={{fontSize:10,color:'#6B8BB0',marginBottom:2}}>Entrada</div>
                        <div style={{fontSize:15,fontWeight:800,color:'#0F6E56'}}>{fmtTime(t.records[0].checkIn)}</div>
                      </div>
                      <div style={{textAlign:'center'}}>
                        <div style={{fontSize:10,color:'#6B8BB0',marginBottom:2}}>Salida</div>
                        <div style={{fontSize:15,fontWeight:800,color:'#C0392B'}}>{fmtTime(t.records[0].checkOut)}</div>
                      </div>
                      <span style={{
                        background:STATUS_CONFIG[t.records[0].status]?.bg,
                        color:STATUS_CONFIG[t.records[0].status]?.color,
                        padding:'3px 10px',borderRadius:20,fontSize:11,fontWeight:600
                      }}>
                        {STATUS_CONFIG[t.records[0].status]?.label}
                      </span>
                    </div>
                  ) : (
                    /* En modo semanal/mensual mostrar resumen */
                    <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
                      {[
                        {key:'presente', label:'P', color:'#0F6E56', bg:'#E1F5EE', val:t.summary.presente},
                        {key:'tardanza', label:'T', color:'#BA7517', bg:'#FFFBEA', val:t.summary.tardanza},
                        {key:'ausente',  label:'A', color:'#C0392B', bg:'#FFF0F0', val:t.summary.ausente},
                        {key:'licencia', label:'L', color:'#1A3A7C', bg:'#E0ECF8', val:t.summary.licencia},
                      ].map(s=>(
                        <div key={s.key} style={{textAlign:'center',minWidth:36}}>
                          <div style={{fontSize:14,fontWeight:800,color:s.color}}>{s.val}</div>
                          <div style={{fontSize:9,background:s.bg,color:s.color,padding:'1px 5px',borderRadius:10,fontWeight:600}}>{s.label}</div>
                        </div>
                      ))}
                      <div style={{marginLeft:8}}>
                        <div style={{fontSize:11,color:'#6B8BB0',marginBottom:3,textAlign:'right'}}>{pct}% asistencia</div>
                        <div style={{width:80,height:6,background:'#F0F6FC',borderRadius:3,overflow:'hidden'}}>
                          <div style={{width:`${pct}%`,height:'100%',background:pct>=80?'#0F6E56':pct>=60?'#BA7517':'#C0392B',borderRadius:3}}/>
                        </div>
                      </div>
                    </div>
                  )}
                  {mode!=='diario' && (isOpen?<ChevronUp size={15} color="#6B8BB0"/>:<ChevronDown size={15} color="#6B8BB0"/>)}
                </div>

                {/* Detalle de días (solo semanal/mensual) */}
                {isOpen && mode!=='diario' && (
                  <div style={{borderTop:'1px solid #F0F6FC',background:'#FAFCFF'}}>
                    <table style={{width:'100%',borderCollapse:'collapse'}}>
                      <thead>
                        <tr style={{background:'#F0F6FC'}}>
                          <th style={th}>Fecha</th>
                          <th style={{...th,textAlign:'center'}}>Estado</th>
                          <th style={{...th,textAlign:'center'}}>Entrada</th>
                          <th style={{...th,textAlign:'center'}}>Salida</th>
                          <th style={th}>Observación</th>
                        </tr>
                      </thead>
                      <tbody>
                        {t.records.map(r => {
                          const st = STATUS_CONFIG[r.status] || STATUS_CONFIG['AUSENTE']
                          return (
                            <tr key={r.id}>
                              <td style={td}>{fmtDate(r.date)}</td>
                              <td style={{...td,textAlign:'center'}}>
                                <span style={{background:st.bg,color:st.color,padding:'2px 8px',borderRadius:20,fontSize:11,fontWeight:600}}>
                                  {st.label}
                                </span>
                              </td>
                              <td style={{...td,textAlign:'center',color:'#0F6E56',fontWeight:600}}>{fmtTime(r.checkIn)}</td>
                              <td style={{...td,textAlign:'center',color:'#C0392B',fontWeight:600}}>{fmtTime(r.checkOut)}</td>
                              <td style={{...td,color:'#6B8BB0',fontSize:12}}>{r.note||'—'}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <style>{`
        .spinner{width:24px;height:24px;border:2px solid rgba(26,58,124,.2);border-top-color:#1A3A7C;border-radius:50%;animation:spin .7s linear infinite}
        @keyframes spin{to{transform:rotate(360deg)}}
        @media(max-width:600px){div[style*="grid-template-columns: repeat(5"]{grid-template-columns:repeat(3,1fr) !important}}
      `}</style>
    </div>
  )
}

const th: React.CSSProperties = { padding:'9px 14px', textAlign:'left', fontSize:11, fontWeight:600, color:'#1A3A7C', textTransform:'uppercase', letterSpacing:'.5px' }
const td: React.CSSProperties = { padding:'10px 14px', fontSize:13, color:'#1A3A7C', borderTop:'1px solid #F0F6FC' }