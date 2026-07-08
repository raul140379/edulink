'use client'

import { useEffect, useState } from 'react'
import { BookOpen, ChevronDown, ChevronUp, CheckCircle, AlertCircle } from 'lucide-react'
import { useSearchParams } from 'next/navigation'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

interface Student {
  id: number; firstName: string; lastName: string; gender?: string
  assignments: {
    course: { id: number; grade: string; parallel: string; level: string; shift: string }
    academicYear: { isActive: boolean; year: number }
  }[]
}

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
  subject:  { id: number; name: string; campo?: string | null }
  course:   { grade: string; parallel: string; level: string }
  t1:       NotaTrimestre | null
  t2:       NotaTrimestre | null
  t3:       NotaTrimestre | null
  promedio: number
}

interface Trimestre { id: number; number: number; name?: string }

interface ParentData {
  id: number; firstName: string; lastName: string
  students: { isTutor: boolean; student: Student }[]
}

const GRADES: Record<string,string> = { PRIMERO:'1°', SEGUNDO:'2°', TERCERO:'3°', CUARTO:'4°', QUINTO:'5°', SEXTO:'6°' }
const SHIFTS: Record<string,string> = { MORNING:'Mañana', AFTERNOON:'Tarde', NIGHT:'Noche' }
const LEVELS: Record<string,string> = { INICIAL:'Inicial', PRIMARIA:'Primaria', SECUNDARIA:'Secundaria' }

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

const scoreColor = (v?: number|null) => v==null?'#6B8BB0':v>=51?'#0F6E56':'#c0392b'

const dimBar = (val: number|null, max: number, color: string) => (
  <div style={{display:'flex',alignItems:'center',gap:4,marginBottom:3}}>
    <div style={{flex:1,background:'#F0F6FC',borderRadius:3,height:5,overflow:'hidden'}}>
      <div style={{width:`${val!=null?Math.min((val/max)*100,100):0}%`,background:color,height:'100%',borderRadius:3}}/>
    </div>
    <span style={{fontSize:10,fontWeight:700,color,minWidth:24,textAlign:'right'}}>
      {val!=null?val.toFixed(1):'—'}
    </span>
    <span style={{fontSize:9,color:'#6B8BB0'}}>/{max}</span>
  </div>
)

export default function ParentCalificacionesPage() {
  const searchParams   = useSearchParams()
  const [parent,       setParent]       = useState<ParentData | null>(null)
  const [selStudentId, setSelStudentId] = useState<number | null>(null)
  const [notas,        setNotas]        = useState<any[]>([])
  const [trimestres,   setTrimestres]   = useState<Trimestre[]>([])
  const [loading,      setLoading]      = useState(true)
  const [loadingNotas, setLoadingNotas] = useState(false)
  const [expanded,     setExpanded]     = useState<number|null>(null)
  const [error,        setError]        = useState('')
  const year = new Date().getFullYear()

  useEffect(() => {
    const init = async () => {
      const token = localStorage.getItem('token')
      if (!token) { setError('No autenticado'); setLoading(false); return }
      setLoading(true)
      try {
        const res  = await fetch(`${API_URL}/api/parents/me`, { headers: { Authorization: `Bearer ${token}` } })
        const data = await res.json()
        if (res.ok) {
          setParent(data)
          const students = data.students.filter((ps: any) => ps.isTutor).map((ps: any) => ps.student)
          const qId   = searchParams.get('studentId')
          const presel = qId ? parseInt(qId) : students[0]?.id
          if (presel) setSelStudentId(presel)
        } else { setError(data.message || 'Error al cargar datos') }
      } catch { setError('Error de conexión') }
      finally  { setLoading(false) }
    }
    init()
  }, [])

  useEffect(() => {
    if (!selStudentId) return
    const load = async () => {
      const token = localStorage.getItem('token')
      if (!token) return
      setLoadingNotas(true); setNotas([])
      try {
        const [notasRes, trimsRes] = await Promise.all([
          fetch(`${API_URL}/api/notas/student/${selStudentId}?year=${year}`, { headers: { Authorization: `Bearer ${token}` } }),
          fetch(`${API_URL}/api/notas/trimestres?year=${year}`, { headers: { Authorization: `Bearer ${token}` } }),
        ])
        const notasData = await notasRes.json()
        const trimsData = await trimsRes.json()
        if (notasRes.ok) setNotas(Array.isArray(notasData)?notasData:[])
        if (trimsRes.ok) setTrimestres(Array.isArray(trimsData)?trimsData:[])
      } catch { console.error('Error al cargar notas') }
      finally  { setLoadingNotas(false) }
    }
    load()
  }, [selStudentId])

  if (loading) return <div className="center"><div className="spinner"/></div>
  if (error)   return <div className="center"><p style={{color:'#C0392B'}}>{error}</p></div>
  if (!parent) return null

  const myStudents       = parent.students.filter(ps => ps.isTutor).map(ps => ps.student)
  const selStudent       = myStudents.find(s => s.id === selStudentId)
  const activeAssignment = selStudent?.assignments?.find(a => a.academicYear?.isActive)

  // Procesar notas con dimensiones
  const notasProcesadas = notas.map((n: any) => {
    const getTrim = (tk: string) => {
      const t = n[tk]
      if (!t) return null
      return { notaId: t.notaId, saber: t.saber, hacer: t.hacer, ser: t.ser, autoEvaluacion: t.autoEvaluacion, total: t.total, cerrado: t.cerrado }
    }
    const totales = ['t1','t2','t3'].map(tk => n[tk]?.total).filter((v:any) => v!=null) as number[]
    const promedio = totales.length > 0 ? Math.round((totales.reduce((a:number,b:number)=>a+b,0)/totales.length)*100)/100 : 0
    return {
      subject:  n.subject,
      course:   n.course,
      t1:       getTrim('t1'),
      t2:       getTrim('t2'),
      t3:       getTrim('t3'),
      promedio,
    }
  })

  // Agrupar por campo
  const porCampo: Record<string, typeof notasProcesadas> = {}
  notasProcesadas.forEach(n => {
    const campo = n.subject?.campo || 'SIN_CAMPO'
    if (!porCampo[campo]) porCampo[campo] = []
    porCampo[campo].push(n)
  })

  const withNota   = notasProcesadas.filter(n => n.promedio > 0)
  const aprobados  = withNota.filter(n => n.promedio >= 51).length
  const reprobados = withNota.filter(n => n.promedio < 51).length
  const promGeneral = withNota.length > 0
    ? (withNota.reduce((s,n)=>s+n.promedio,0)/withNota.length).toFixed(1)
    : '—'

  const trimLabel = (t: Trimestre) => t.name || `${t.number}° Trim.`

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Calificaciones</h1>
          <p>Gestión {year} · Saber(45) + Hacer(40) + Ser(10) + Autoevaluación(5) = 100 pts</p>
        </div>
      </div>

      {/* Selector de hijo */}
      {myStudents.length > 1 && (
        <div className="student-selector">
          {myStudents.map(s => (
            <button key={s.id} className={`stu-btn${selStudentId===s.id?' active':''}`}
              onClick={()=>setSelStudentId(s.id)}>
              {s.gender==='MASCULINO'?'👦':'👧'} {s.lastName} {s.firstName}
            </button>
          ))}
        </div>
      )}

      {selStudent && (
        <>
          {/* Info del estudiante */}
          <div className="stu-info-card">
            <div className="stu-avatar">{selStudent.gender==='MASCULINO'?'👦':'👧'}</div>
            <div>
              <div className="stu-name">{selStudent.lastName} {selStudent.firstName}</div>
              {activeAssignment && (
                <div className="stu-course">
                  📚 {LEVELS[activeAssignment.course.level]} —{' '}
                  {GRADES[activeAssignment.course.grade]} &quot;{activeAssignment.course.parallel}&quot; ·{' '}
                  {SHIFTS[activeAssignment.course.shift]}
                </div>
              )}
            </div>
          </div>

          {loadingNotas ? (
            <div className="center"><div className="spinner"/></div>
          ) : notasProcesadas.length === 0 ? (
            <div className="empty-state">
              <BookOpen size={40} color="#CBE0F0"/>
              <p>No hay calificaciones registradas aún para la gestión {year}</p>
            </div>
          ) : (
            <>
              {/* Stats */}
              <div className="stats-grid">
                <div className="stat-card"><div className="stat-num" style={{color:'#1A3A7C'}}>{notasProcesadas.length}</div><div className="stat-lbl">Materias</div></div>
                <div className="stat-card"><div className="stat-num" style={{color:'#0F6E56'}}>{aprobados}</div><div className="stat-lbl">Aprobadas</div></div>
                <div className="stat-card"><div className="stat-num" style={{color:reprobados>0?'#C0392B':'#0F6E56'}}>{reprobados}</div><div className="stat-lbl">Reprobadas</div></div>
                <div className="stat-card">
                  <div className="stat-num" style={{color:parseFloat(promGeneral)>=51?'#0F6E56':'#C0392B'}}>{promGeneral}</div>
                  <div className="stat-lbl">Promedio general</div>
                </div>
              </div>

              {reprobados===0 && withNota.length>0
                ? <div className="alert-ok"><CheckCircle size={14}/> ¡Todas las materias aprobadas!</div>
                : reprobados>0
                ? <div className="alert-warn"><AlertCircle size={14}/> {reprobados} materia{reprobados!==1?'s':''} reprobada{reprobados!==1?'s':''}</div>
                : null}

              {/* Materias agrupadas por campo */}
              {Object.entries(porCampo).map(([campo, materias]) => (
                <div key={campo} style={{marginBottom:20}}>
                  {/* Encabezado campo */}
                  <div style={{
                    display:'flex',alignItems:'center',gap:10,marginBottom:10,
                    padding:'10px 16px',borderRadius:10,
                    background:CAMPO_COLOR[campo]?`${CAMPO_COLOR[campo]}15`:'#F0F6FC',
                    borderLeft:`4px solid ${CAMPO_COLOR[campo]||'#6B8BB0'}`,
                  }}>
                    <div style={{width:10,height:10,borderRadius:'50%',background:CAMPO_COLOR[campo]||'#6B8BB0',flexShrink:0}}/>
                    <span style={{fontWeight:700,fontSize:13,color:CAMPO_COLOR[campo]||'#6B8BB0'}}>
                      {campo==='SIN_CAMPO'?'Sin campo asignado':CAMPO_LABEL[campo]||campo}
                    </span>
                    <span style={{fontSize:12,color:'#6B8BB0',marginLeft:'auto'}}>{materias.length} materia{materias.length!==1?'s':''}</span>
                  </div>

                  {/* Lista de materias */}
                  <div style={{display:'flex',flexDirection:'column',gap:8,paddingLeft:8}}>
                    {materias.map(n => {
                      const isOpen = expanded===n.subject.id
                      return (
                        <div key={n.subject.id} style={{background:'#fff',borderRadius:10,border:'1px solid #CBE0F0',overflow:'hidden'}}>
                          {/* Cabecera materia */}
                          <div style={{display:'flex',alignItems:'center',padding:'12px 16px',cursor:'pointer',gap:12}}
                            onClick={()=>setExpanded(isOpen?null:n.subject.id)}>
                            <div style={{flex:1}}>
                              <div style={{fontWeight:700,fontSize:14,color:'#1A3A7C'}}>{n.subject.name}</div>
                            </div>
                            {/* Totales por trimestre */}
                            <div style={{display:'flex',gap:16,alignItems:'center'}}>
                              {trimestres.map(t => {
                                const tk = `t${t.number}` as 't1'|'t2'|'t3'
                                const val = n[tk]?.total ?? null
                                return (
                                  <div key={t.id} style={{textAlign:'center',minWidth:46}}>
                                    <div style={{fontSize:10,color:'#6B8BB0',marginBottom:2}}>{trimLabel(t)}</div>
                                    <div style={{fontSize:15,fontWeight:800,color:scoreColor(val)}}>
                                      {val!=null?val.toFixed(1):'—'}
                                    </div>
                                  </div>
                                )
                              })}
                              <div style={{textAlign:'center',minWidth:56,borderLeft:'1px solid #F0F6FC',paddingLeft:12}}>
                                <div style={{fontSize:10,color:'#6B8BB0',marginBottom:2}}>Promedio</div>
                                <div style={{fontSize:17,fontWeight:800,color:scoreColor(n.promedio>0?n.promedio:null)}}>
                                  {n.promedio>0?n.promedio.toFixed(1):'—'}
                                </div>
                                {n.promedio>0 && (
                                  <div style={{fontSize:10,fontWeight:600,color:n.promedio>=51?'#0F6E56':'#c0392b'}}>
                                    {n.promedio>=51?'Aprobado':'Reprobado'}
                                  </div>
                                )}
                              </div>
                            </div>
                            {isOpen?<ChevronUp size={15} color="#6B8BB0"/>:<ChevronDown size={15} color="#6B8BB0"/>}
                          </div>

                          {/* Detalle por trimestre */}
                          {isOpen && (
                            <div style={{borderTop:'1px solid #F0F6FC',padding:'14px 16px',background:'#FAFCFF'}}>
                              <div style={{display:'grid',gridTemplateColumns:`repeat(${trimestres.length},1fr)`,gap:10}}>
                                {trimestres.map(t => {
                                  const tk  = `t${t.number}` as 't1'|'t2'|'t3'
                                  const det = n[tk] as NotaTrimestre|null
                                  return (
                                    <div key={t.id} style={{
                                      background:'#fff',borderRadius:8,padding:12,
                                      border:`1px solid ${det?.cerrado?'#F39C12':'#CBE0F0'}`,
                                    }}>
                                      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}>
                                        <span style={{fontWeight:700,fontSize:12,color:'#1A3A7C'}}>{trimLabel(t)}</span>
                                        {det?.cerrado && (
                                          <span style={{fontSize:9,background:'#FFF3E0',color:'#E67E22',padding:'2px 6px',borderRadius:20,fontWeight:600}}>
                                            🔒
                                          </span>
                                        )}
                                      </div>
                                      {det ? (
                                        <>
                                          {dimBar(det.saber, 45, '#1A3A7C')}
                                          <div style={{fontSize:9,color:'#6B8BB0',marginBottom:6}}>Saber /45</div>
                                          {dimBar(det.hacer, 40, '#0F6E56')}
                                          <div style={{fontSize:9,color:'#6B8BB0',marginBottom:6}}>Hacer /40</div>
                                          {dimBar(det.ser, 10, '#633806')}
                                          <div style={{fontSize:9,color:'#6B8BB0',marginBottom:6}}>Ser /10</div>
                                          {dimBar(det.autoEvaluacion, 5, '#4A9FD4')}
                                          <div style={{fontSize:9,color:'#6B8BB0',marginBottom:8}}>Autoevaluación /5</div>
                                          <div style={{textAlign:'center',padding:'6px',background:'#F8FBFF',borderRadius:6}}>
                                            <div style={{fontSize:9,color:'#6B8BB0'}}>TOTAL</div>
                                            <div style={{fontSize:20,fontWeight:800,color:scoreColor(det.total)}}>
                                              {det.total!=null?det.total.toFixed(1):'—'}
                                            </div>
                                            {det.total!=null && (
                                              <div style={{fontSize:9,fontWeight:700,color:det.total>=51?'#0F6E56':'#c0392b'}}>
                                                {det.total>=51?'✅ Aprobado':'❌ Reprobado'}
                                              </div>
                                            )}
                                          </div>
                                        </>
                                      ) : (
                                        <div style={{textAlign:'center',color:'#6B8BB0',fontSize:11,padding:'16px 0'}}>
                                          Sin notas
                                        </div>
                                      )}
                                    </div>
                                  )
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}

              {/* Leyenda */}
              <div className="leyenda">
                <span className="ley-item"><span className="ley-dot" style={{background:'#0F6E56'}}/> Aprobado (≥51)</span>
                <span className="ley-item"><span className="ley-dot" style={{background:'#c0392b'}}/> Reprobado (&lt;51)</span>
              </div>
            </>
          )}
        </>
      )}

      <style>{`
        .page-header{margin-bottom:24px}
        .page-header h1{font-size:20px;font-weight:700;color:#00838F;margin-bottom:4px}
        .page-header p{font-size:12px;color:#6B8BB0}
        .center{display:flex;justify-content:center;align-items:center;padding:48px;color:#6B8BB0}
        .student-selector{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px}
        .stu-btn{display:flex;align-items:center;gap:6px;padding:8px 16px;border:1.5px solid #CBE0F0;border-radius:8px;background:#fff;color:#1A3A7C;font-size:13px;font-weight:500;cursor:pointer}
        .stu-btn:hover{border-color:#00838F}
        .stu-btn.active{background:#00838F;color:#fff;border-color:#00838F}
        .stu-info-card{background:#fff;border:1px solid #CBE0F0;border-radius:12px;padding:16px;display:flex;align-items:center;gap:14px;margin-bottom:16px}
        .stu-avatar{font-size:36px;flex-shrink:0}
        .stu-name{font-size:16px;font-weight:700;color:#1A3A7C;margin-bottom:4px}
        .stu-course{font-size:12px;color:#6B8BB0}
        .stats-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px}
        .stat-card{background:#fff;border:1px solid #CBE0F0;border-radius:12px;padding:16px;text-align:center}
        .stat-num{font-size:28px;font-weight:800}
        .stat-lbl{font-size:12px;color:#6B8BB0;margin-top:4px}
        .alert-ok{display:flex;align-items:center;gap:8px;padding:10px 14px;background:#E1F5EE;border:1px solid #9FE1CB;border-radius:8px;font-size:13px;color:#0F6E56;margin-bottom:16px}
        .alert-warn{display:flex;align-items:center;gap:8px;padding:10px 14px;background:#FFFBEA;border:1px solid #F5C518;border-radius:8px;font-size:13px;color:#7A6000;margin-bottom:16px}
        .empty-state{display:flex;flex-direction:column;align-items:center;gap:12px;padding:60px;color:#6B8BB0;font-size:13px;background:#fff;border:1px solid #CBE0F0;border-radius:12px}
        .leyenda{display:flex;gap:16px;flex-wrap:wrap;font-size:12px;color:#6B8BB0;padding:4px 0;margin-top:8px}
        .ley-item{display:flex;align-items:center;gap:6px}
        .ley-dot{width:10px;height:10px;border-radius:50%;flex-shrink:0}
        .spinner{width:24px;height:24px;border:2px solid rgba(0,131,143,.2);border-top-color:#00838F;border-radius:50%;animation:spin .7s linear infinite}
        @keyframes spin{to{transform:rotate(360deg)}}
        @media(max-width:600px){.stats-grid{grid-template-columns:1fr 1fr}}
      `}</style>
    </div>
  )
}