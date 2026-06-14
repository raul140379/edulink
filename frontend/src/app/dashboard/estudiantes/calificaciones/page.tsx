'use client'

import { useEffect, useState } from 'react'
import { BookOpen, TrendingUp, CheckCircle, AlertCircle, Award, Save, ChevronDown, ChevronUp } from 'lucide-react'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

interface Trimestre { id: number; number: number; name?: string; isClosed?: boolean }

interface NotaTrimestre {
  notaId:         number | null
  saber:          number | null
  hacer:          number | null
  ser:            number | null
  autoEvaluacion: number | null
  total:          number | null
  cerrado:        boolean
}

interface NotaMateria {
  subjectId:   number
  subjectName: string
  campo:       string | null
  teacher:     string
  trimestres:  Record<number, number>  // trimesterId → total (para compatibilidad)
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

const GRADE_LABEL: Record<string, string> = {
  PRIMERO:'1°', SEGUNDO:'2°', TERCERO:'3°', CUARTO:'4°', QUINTO:'5°', SEXTO:'6°',
}

export default function CalificacionesPage() {
  const [data,         setData]         = useState<GradesData | null>(null)
  const [notasDetalle, setNotasDetalle] = useState<Record<string, NotaTrimestre>>({}) // key: subjectId-trimesterId
  const [loading,      setLoading]      = useState(true)
  const [selTrim,      setSelTrim]      = useState<number | 'todos'>('todos')
  const [filterCampo,  setFilterCampo]  = useState<string>('todos')
  const [expanded,     setExpanded]     = useState<number | null>(null)
  const [autoEvals,    setAutoEvals]    = useState<Record<string, string>>({}) // notaId → valor
  const [saving,       setSaving]       = useState<number | null>(null)
  const [toast,        setToast]        = useState<{type:'ok'|'err'; text:string} | null>(null)

  const token = () => typeof window !== 'undefined' ? localStorage.getItem('token') || '' : ''
  const auth  = () => ({ Authorization: `Bearer ${token()}` })

  const showToast = (type: 'ok'|'err', text: string) => {
    setToast({type, text}); setTimeout(()=>setToast(null), 4000)
  }

  useEffect(() => {
    fetch(`${API_URL}/api/students/my-grades`, { headers: auth() })
      .then(r => r.json())
      .then(d => {
        setData(d)
        setLoading(false)
        // Cargar detalle de notas por dimensión
        if (d?.notas && d?.trimestres) {
          loadNotasDetalle(d)
        }
      })
      .catch(() => setLoading(false))
  }, [])

  const loadNotasDetalle = async (d: GradesData) => {
    // Para cada materia y trimestre, cargamos el detalle de notas con dimensiones
    const student = await fetch(`${API_URL}/api/students/me`, { headers: auth() }).then(r=>r.json())
    if (!student?.course) return

    const year = d.academicYear?.year || new Date().getFullYear()
    const notasRes = await fetch(
      `${API_URL}/api/notas/student/${student.id}?year=${year}`,
      { headers: auth() }
    ).then(r=>r.json()).catch(()=>[])

    const detalleMap: Record<string, NotaTrimestre> = {}
    const autoEvalMap: Record<string, string> = {}

    if (Array.isArray(notasRes)) {
      notasRes.forEach((materia: any) => {
        ['t1','t2','t3'].forEach((tk, idx) => {
          const t = materia[tk]
          if (t) {
            const key = `${materia.subject.id}-${d.trimestres[idx]?.id}`
            detalleMap[key] = {
              notaId:         t.notaId,
              saber:          t.saber,
              hacer:          t.hacer,
              ser:            t.ser,
              autoEvaluacion: t.autoEvaluacion,
              total:          t.total,
              cerrado:        t.cerrado,
            }
            if (t.autoEvaluacion !== null) {
              autoEvalMap[t.notaId] = String(t.autoEvaluacion)
            }
          }
        })
      })
    }

    setNotasDetalle(detalleMap)
    setAutoEvals(autoEvalMap)
  }

  const saveAutoEval = async (notaId: number) => {
    const val = parseFloat(autoEvals[notaId] || '0')
    if (isNaN(val) || val < 0 || val > 5) {
      showToast('err', 'La autoevaluación debe estar entre 0 y 5 puntos'); return
    }
    setSaving(notaId)
    try {
      const res = await fetch(`${API_URL}/api/students/my-autoevaluacion`, {
        method: 'PUT',
        headers: { ...auth(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ notaId, autoEvaluacion: val })
      })
      const d = await res.json()
      if (!res.ok) { showToast('err', d.message || 'Error'); return }
      showToast('ok', 'Autoevaluación guardada correctamente')
      // Actualizar localmente
      setNotasDetalle(prev => {
        const updated = { ...prev }
        Object.keys(updated).forEach(k => {
          if (updated[k].notaId === notaId) {
            updated[k] = { ...updated[k], autoEvaluacion: val, total: d.nota.total }
          }
        })
        return updated
      })
    } catch { showToast('err', 'Error de conexión') }
    finally { setSaving(null) }
  }

  if (loading) return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',minHeight:300}}>
      <div className="spinner"/>
    </div>
  )

  if (!data || !data.notas?.length) return (
    <div style={{textAlign:'center',padding:48,color:'#6B8BB0'}}>
      <BookOpen size={40} style={{marginBottom:12,opacity:.4}}/>
      <div style={{fontSize:15}}>No hay calificaciones registradas aún.</div>
    </div>
  )

  const { trimestres, notas, course, academicYear } = data
  const notasConProm  = notas.filter(n => n.avg !== null)
  const promedioGral  = notasConProm.length
    ? (notasConProm.reduce((s,n)=>s+(n.avg??0),0)/notasConProm.length).toFixed(1)
    : '—'
  const aprobadas  = notasConProm.filter(n=>(n.avg??0)>=51).length
  const reprobadas = notasConProm.filter(n=>(n.avg??0)<51).length

  const camposDisp = [...new Set(notas.map(n=>n.campo).filter(Boolean))] as string[]
  const notasFiltradas = notas.filter(n => filterCampo==='todos' || n.campo===filterCampo)

  const scoreColor = (v?: number|null) => v==null?'#6B8BB0':v>=51?'#0F6E56':'#c0392b'
  const trimLabel  = (t: Trimestre) => t.name || `${t.number}° Trim.`

  const dimBar = (val: number|null, max: number, color: string) => (
    <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:4}}>
      <div style={{flex:1,background:'#F0F6FC',borderRadius:4,height:6,overflow:'hidden'}}>
        <div style={{width:`${val!=null?Math.min((val/max)*100,100):0}%`,background:color,height:'100%',borderRadius:4,transition:'width .3s'}}/>
      </div>
      <span style={{fontSize:11,fontWeight:700,color,minWidth:28,textAlign:'right'}}>
        {val!=null?val.toFixed(1):'—'}
      </span>
      <span style={{fontSize:10,color:'#6B8BB0'}}>/{max}</span>
    </div>
  )

  return (
    <div>
      {/* Toast */}
      {toast && (
        <div style={{
          position:'fixed',top:16,right:16,zIndex:999,
          padding:'10px 16px',borderRadius:8,fontSize:13,
          background:toast.type==='ok'?'#E1F5EE':'#FFF0F0',
          border:`1px solid ${toast.type==='ok'?'#9FE1CB':'#FFBBBB'}`,
          color:toast.type==='ok'?'#0F6E56':'#C0392B',
          boxShadow:'0 4px 12px rgba(0,0,0,.1)',
        }}>
          {toast.text}
        </div>
      )}

      {/* Header */}
      <div style={{
        background:'linear-gradient(135deg,#1A3A7C,#2756B8)',
        borderRadius:12,padding:'20px 24px',marginBottom:24,color:'#fff',
      }}>
        <div style={{fontSize:13,opacity:.75,marginBottom:4,display:'flex',alignItems:'center',gap:6}}>
          <BookOpen size={14}/> Calificaciones
        </div>
        <div style={{fontSize:20,fontWeight:800}}>
          {academicYear?`Gestión ${academicYear.year}`:'Mis Calificaciones'}
        </div>
        {course && (
          <div style={{fontSize:13,opacity:.8,marginTop:4}}>
            {GRADE_LABEL[course.grade]||course.grade} "{course.parallel}" · {course.level}
          </div>
        )}
      </div>

      {/* Stats */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:16,marginBottom:24}}>
        {[
          {label:'Promedio General',value:promedioGral,icon:<TrendingUp size={20}/>,color:'#1A3A7C'},
          {label:'Aprobadas',value:aprobadas,icon:<CheckCircle size={20}/>,color:'#0F6E56'},
          {label:'Reprobadas',value:reprobadas,icon:<AlertCircle size={20}/>,color:'#c0392b'},
        ].map(s=>(
          <div key={s.label} style={{background:'#fff',borderRadius:10,padding:'16px 18px',boxShadow:'0 1px 4px rgba(26,58,124,.08)'}}>
            <div style={{display:'flex',alignItems:'center',gap:8,color:s.color,marginBottom:8}}>
              {s.icon}
              <span style={{fontSize:11,fontWeight:600,textTransform:'uppercase',letterSpacing:'.4px'}}>{s.label}</span>
            </div>
            <div style={{fontSize:28,fontWeight:800,color:'#1A3A7C'}}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div style={{display:'flex',gap:10,flexWrap:'wrap',marginBottom:20,alignItems:'center'}}>
        <span style={{fontSize:12,color:'#6B8BB0',fontWeight:600}}>Trimestre:</span>
        {[{label:'Todos',value:'todos' as const},...trimestres.map(t=>({label:trimLabel(t),value:t.id as number|'todos'}))].map(opt=>(
          <button key={String(opt.value)} onClick={()=>setSelTrim(opt.value as any)}
            style={{
              padding:'5px 12px',borderRadius:20,border:'none',cursor:'pointer',fontSize:12,
              background:selTrim===opt.value?'#1A3A7C':'#F0F6FC',
              color:selTrim===opt.value?'#fff':'#1A3A7C',
              fontWeight:selTrim===opt.value?600:400,
            }}>
            {opt.label}
          </button>
        ))}
        {camposDisp.length>1 && (
          <>
            <span style={{fontSize:12,color:'#6B8BB0',fontWeight:600,marginLeft:8}}>Campo:</span>
            {['todos',...camposDisp].map(c=>(
              <button key={c} onClick={()=>setFilterCampo(c)}
                style={{
                  padding:'5px 12px',borderRadius:20,border:'none',cursor:'pointer',fontSize:12,
                  background:filterCampo===c?(c==='todos'?'#1A3A7C':CAMPO_COLOR[c]||'#1A3A7C'):'#F0F6FC',
                  color:filterCampo===c?'#fff':'#1A3A7C',
                  fontWeight:filterCampo===c?600:400,
                }}>
                {c==='todos'?'Todos':CAMPO_LABEL[c]||c}
              </button>
            ))}
          </>
        )}
      </div>

      {/* Lista de materias con acordeón */}
      <div style={{display:'flex',flexDirection:'column',gap:10}}>
        {notasFiltradas.map(n => {
          const isOpen = expanded === n.subjectId

          // Notas por trimestre para esta materia
          const trimNotas = trimestres.map(t => ({
            trimestre: t,
            detalle: notasDetalle[`${n.subjectId}-${t.id}`] || null,
            total: n.trimestres[t.id] ?? null,
          }))

          const trimsFiltrados = selTrim==='todos' ? trimNotas : trimNotas.filter(tn=>tn.trimestre.id===selTrim)

          return (
            <div key={n.subjectId} style={{background:'#fff',borderRadius:10,border:'1px solid #CBE0F0',overflow:'hidden'}}>
              {/* Cabecera materia */}
              <div
                style={{display:'flex',alignItems:'center',padding:'14px 18px',cursor:'pointer',gap:12}}
                onClick={()=>setExpanded(isOpen?null:n.subjectId)}>
                <div style={{flex:1}}>
                  <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:4}}>
                    <span style={{fontWeight:700,fontSize:14,color:'#1A3A7C'}}>{n.subjectName}</span>
                    {n.campo && (
                      <span style={{fontSize:10,fontWeight:600,padding:'2px 8px',borderRadius:20,background:CAMPO_COLOR[n.campo]||'#6B8BB0',color:'#fff'}}>
                        {CAMPO_LABEL[n.campo]||n.campo}
                      </span>
                    )}
                  </div>
                  <div style={{fontSize:12,color:'#6B8BB0'}}>Maestro/a: {n.teacher}</div>
                </div>
                {/* Totales por trimestre */}
                <div style={{display:'flex',gap:16,alignItems:'center'}}>
                  {trimestres.map(t=>(
                    <div key={t.id} style={{textAlign:'center',minWidth:50}}>
                      <div style={{fontSize:10,color:'#6B8BB0',marginBottom:2}}>{trimLabel(t)}</div>
                      <div style={{fontSize:16,fontWeight:800,color:scoreColor(n.trimestres[t.id])}}>
                        {n.trimestres[t.id]!=null?n.trimestres[t.id].toFixed(1):'—'}
                      </div>
                    </div>
                  ))}
                  <div style={{textAlign:'center',minWidth:60,borderLeft:'1px solid #F0F6FC',paddingLeft:16}}>
                    <div style={{fontSize:10,color:'#6B8BB0',marginBottom:2}}>Promedio</div>
                    <div style={{fontSize:18,fontWeight:800,color:scoreColor(n.avg)}}>
                      {n.avg!=null?n.avg.toFixed(1):'—'}
                    </div>
                    {n.avg!=null && (
                      <div style={{fontSize:10,fontWeight:600,color:n.avg>=51?'#0F6E56':'#c0392b'}}>
                        {n.avg>=51?'Aprobado':'Reprobado'}
                      </div>
                    )}
                  </div>
                </div>
                {isOpen?<ChevronUp size={16} color="#6B8BB0"/>:<ChevronDown size={16} color="#6B8BB0"/>}
              </div>

              {/* Detalle expandible */}
              {isOpen && (
                <div style={{borderTop:'1px solid #F0F6FC',padding:'16px 18px',background:'#FAFCFF'}}>
                  <div style={{display:'grid',gridTemplateColumns:`repeat(${trimsFiltrados.length},1fr)`,gap:12}}>
                    {trimsFiltrados.map(({trimestre, detalle}) => (
                      <div key={trimestre.id} style={{
                        background:'#fff',borderRadius:8,border:'1px solid #CBE0F0',padding:14,
                        borderColor: detalle?.cerrado||trimestre.isClosed?'#F39C12':'#CBE0F0',
                      }}>
                        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}>
                          <span style={{fontWeight:700,fontSize:13,color:'#1A3A7C'}}>{trimLabel(trimestre)}</span>
                          {(detalle?.cerrado||trimestre.isClosed) && (
                            <span style={{fontSize:10,background:'#FFF3E0',color:'#E67E22',padding:'2px 8px',borderRadius:20,fontWeight:600}}>
                              🔒 Cerrado
                            </span>
                          )}
                        </div>

                        {detalle ? (
                          <>
                            {dimBar(detalle.saber, 45, '#1A3A7C')}
                            <div style={{fontSize:10,color:'#6B8BB0',marginBottom:8}}>Saber (máx 45)</div>

                            {dimBar(detalle.hacer, 40, '#0F6E56')}
                            <div style={{fontSize:10,color:'#6B8BB0',marginBottom:8}}>Hacer (máx 40)</div>

                            {dimBar(detalle.ser, 10, '#633806')}
                            <div style={{fontSize:10,color:'#6B8BB0',marginBottom:8}}>Ser (máx 10)</div>

                            {/* Autoevaluación */}
                            <div style={{marginTop:8,padding:'10px',background:'#EAF5FF',borderRadius:8,border:'1px solid #CBE0F0'}}>
                              <div style={{fontSize:11,fontWeight:700,color:'#4A9FD4',marginBottom:6}}>
                                Autoevaluación (máx 5 pts)
                              </div>
                              {detalle.cerrado || trimestre.isClosed ? (
                                <div style={{fontSize:16,fontWeight:800,color:'#4A9FD4'}}>
                                  {detalle.autoEvaluacion!=null?detalle.autoEvaluacion:'—'} / 5
                                </div>
                              ) : (
                                <div style={{display:'flex',alignItems:'center',gap:8}}>
                                  <input type="number" min={0} max={5} step={0.5}
                                    value={autoEvals[detalle.notaId!]??detalle.autoEvaluacion??''}
                                    placeholder="0–5"
                                    onChange={e=>setAutoEvals(p=>({...p,[detalle.notaId!]:e.target.value}))}
                                    style={{
                                      width:70,padding:'6px 8px',border:'1.5px solid #CBE0F0',
                                      borderRadius:7,fontSize:14,textAlign:'center',outline:'none',color:'#1A3A7C'
                                    }}/>
                                  <button
                                    onClick={()=>saveAutoEval(detalle.notaId!)}
                                    disabled={saving===detalle.notaId}
                                    style={{
                                      display:'inline-flex',alignItems:'center',gap:4,padding:'6px 12px',
                                      background:'#4A9FD4',color:'#fff',border:'none',borderRadius:7,
                                      fontSize:12,cursor:'pointer',opacity:saving===detalle.notaId?.6:1
                                    }}>
                                    <Save size={12}/>
                                    {saving===detalle.notaId?'...':'Guardar'}
                                  </button>
                                </div>
                              )}
                            </div>

                            {/* Total */}
                            <div style={{marginTop:10,textAlign:'center',padding:'8px',background:'#F8FBFF',borderRadius:8}}>
                              <div style={{fontSize:10,color:'#6B8BB0',marginBottom:2}}>TOTAL</div>
                              <div style={{fontSize:24,fontWeight:800,color:scoreColor(detalle.total)}}>
                                {detalle.total!=null?detalle.total.toFixed(1):'—'}
                              </div>
                              <div style={{fontSize:10,color:'#6B8BB0'}}>/100 pts</div>
                              {detalle.total!=null && (
                                <div style={{fontSize:11,fontWeight:700,marginTop:4,color:detalle.total>=51?'#0F6E56':'#c0392b'}}>
                                  {detalle.total>=51?'✅ Aprobado':'❌ Reprobado'}
                                </div>
                              )}
                            </div>
                          </>
                        ) : (
                          <div style={{textAlign:'center',color:'#6B8BB0',fontSize:12,padding:'20px 0'}}>
                            Sin notas registradas
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      <style>{`
        .spinner{width:24px;height:24px;border:2px solid rgba(26,58,124,.2);border-top-color:#1A3A7C;border-radius:50%;animation:spin .7s linear infinite}
        @keyframes spin{to{transform:rotate(360deg)}}
        @media(max-width:768px){
          div[style*="grid-template-columns: repeat(3"]{grid-template-columns:1fr 1fr !important}
        }
      `}</style>
    </div>
  )
}