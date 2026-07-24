'use client'

import { useEffect, useState } from 'react'
import { BookOpen, ChevronDown, ChevronUp, CheckCircle, AlertCircle } from 'lucide-react'
import { useSearchParams } from 'next/navigation'
import Card from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'

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
const CAMPO_TONE: Record<string, 'success' | 'brand' | 'warning' | 'info'> = {
  VIDA_TIERRA_TERRITORIO:        'success',
  COMUNIDAD_SOCIEDAD:            'brand',
  COSMOS_PENSAMIENTO:            'warning',
  CIENCIA_TECNOLOGIA_PRODUCCION: 'info',
}

const scoreClass = (v?: number|null) => v==null ? 'text-neutral-500' : v>=51 ? 'text-success-700' : 'text-danger-600'

const DimBar = ({ val, max, colorVar }: { val: number|null; max: number; colorVar: string }) => (
  <div className="flex items-center gap-1 mb-0.5">
    <div className="flex-1 bg-neutral-100 rounded h-1.5 overflow-hidden">
      <div className="h-full rounded" style={{ width: `${val != null ? Math.min((val / max) * 100, 100) : 0}%`, background: colorVar }}/>
    </div>
    <span className="text-[10px] font-bold min-w-[24px] text-right" style={{ color: colorVar }}>{val != null ? val.toFixed(1) : '—'}</span>
    <span className="text-[9px] text-neutral-500">/{max}</span>
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selStudentId])

  if (loading) return <div className="flex justify-center py-16"><p className="text-sm text-neutral-500">Cargando...</p></div>
  if (error)   return <div className="flex justify-center py-16"><p className="text-sm text-danger-600">{error}</p></div>
  if (!parent) return null

  const myStudents       = parent.students.filter(ps => ps.isTutor).map(ps => ps.student)
  const selStudent       = myStudents.find(s => s.id === selStudentId)
  const activeAssignment = selStudent?.assignments?.find(a => a.academicYear?.isActive)

  const notasProcesadas = notas.map((n: any) => {
    const getTrim = (tk: string): NotaTrimestre | null => {
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
      <div className="mb-6">
        <h1 className="text-xl font-bold text-brand-700 mb-1">Calificaciones</h1>
        <p className="text-xs text-neutral-500">Gestión {year} · Saber(45) + Hacer(40) + Ser(10) + Autoevaluación(5) = 100 pts</p>
      </div>

      {myStudents.length > 1 && (
        <div className="flex gap-2 flex-wrap mb-4">
          {myStudents.map(s => (
            <button
              key={s.id} onClick={() => setSelStudentId(s.id)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-[13px] font-medium border transition-colors ${selStudentId === s.id ? 'bg-brand-700 text-white border-brand-700' : 'bg-white text-brand-700 border-neutral-300 hover:border-brand-500'}`}
            >
              {s.gender === 'MASCULINO' ? '👦' : '👧'} {s.lastName} {s.firstName}
            </button>
          ))}
        </div>
      )}

      {selStudent && (
        <>
          <Card className="flex items-center gap-3.5 mb-4">
            <div className="text-4xl shrink-0">{selStudent.gender === 'MASCULINO' ? '👦' : '👧'}</div>
            <div>
              <div className="text-base font-bold text-brand-700 mb-1">{selStudent.lastName} {selStudent.firstName}</div>
              {activeAssignment && (
                <div className="text-xs text-neutral-500">
                  📚 {LEVELS[activeAssignment.course.level]} —{' '}
                  {GRADES[activeAssignment.course.grade]} &quot;{activeAssignment.course.parallel}&quot; ·{' '}
                  {SHIFTS[activeAssignment.course.shift]}
                </div>
              )}
            </div>
          </Card>

          {loadingNotas ? (
            <div className="flex justify-center py-16"><p className="text-sm text-neutral-500">Cargando...</p></div>
          ) : notasProcesadas.length === 0 ? (
            <Card className="flex flex-col items-center gap-3 py-14 text-neutral-500">
              <BookOpen size={40} className="text-neutral-300"/>
              <p className="text-[13px]">No hay calificaciones registradas aún para la gestión {year}</p>
            </Card>
          ) : (
            <>
              <div className="grid grid-cols-4 gap-3 mb-4">
                <Card className="text-center"><div className="text-[28px] font-extrabold text-brand-700">{notasProcesadas.length}</div><div className="text-xs text-neutral-500 mt-1">Materias</div></Card>
                <Card className="text-center"><div className="text-[28px] font-extrabold text-success-700">{aprobados}</div><div className="text-xs text-neutral-500 mt-1">Aprobadas</div></Card>
                <Card className="text-center"><div className={`text-[28px] font-extrabold ${reprobados > 0 ? 'text-danger-600' : 'text-success-700'}`}>{reprobados}</div><div className="text-xs text-neutral-500 mt-1">Reprobadas</div></Card>
                <Card className="text-center"><div className={`text-[28px] font-extrabold ${parseFloat(promGeneral) >= 51 ? 'text-success-700' : 'text-danger-600'}`}>{promGeneral}</div><div className="text-xs text-neutral-500 mt-1">Promedio general</div></Card>
              </div>

              {reprobados === 0 && withNota.length > 0
                ? <div className="flex items-center gap-2 px-3.5 py-2.5 bg-success-100 border border-success-500/40 rounded-lg text-[13px] text-success-700 mb-4"><CheckCircle size={14}/> ¡Todas las materias aprobadas!</div>
                : reprobados > 0
                ? <div className="flex items-center gap-2 px-3.5 py-2.5 bg-warning-100 border border-warning-500/40 rounded-lg text-[13px] text-[#7A6000] mb-4"><AlertCircle size={14}/> {reprobados} materia{reprobados!==1?'s':''} reprobada{reprobados!==1?'s':''}</div>
                : null}

              {Object.entries(porCampo).map(([campo, materias]) => (
                <div key={campo} className="mb-5">
                  <div className="flex items-center gap-2.5 mb-2.5">
                    <Badge tone={CAMPO_TONE[campo] || 'neutral'}>{campo === 'SIN_CAMPO' ? 'Sin campo asignado' : CAMPO_LABEL[campo] || campo}</Badge>
                    <span className="text-xs text-neutral-500 ml-auto">{materias.length} materia{materias.length!==1?'s':''}</span>
                  </div>

                  <div className="flex flex-col gap-2 pl-2">
                    {materias.map(n => {
                      const isOpen = expanded === n.subject.id
                      return (
                        <Card key={n.subject.id} padded={false} className="overflow-hidden">
                          <div className="flex items-center px-4 py-3 cursor-pointer gap-3" onClick={() => setExpanded(isOpen ? null : n.subject.id)}>
                            <div className="flex-1">
                              <div className="font-bold text-sm text-brand-700">{n.subject.name}</div>
                            </div>
                            <div className="flex gap-4 items-center">
                              {trimestres.map(t => {
                                const tk = `t${t.number}` as 't1'|'t2'|'t3'
                                const val = (n as any)[tk]?.total ?? null
                                return (
                                  <div key={t.id} className="text-center min-w-[46px]">
                                    <div className="text-[10px] text-neutral-500 mb-0.5">{trimLabel(t)}</div>
                                    <div className={`text-[15px] font-extrabold ${scoreClass(val)}`}>{val != null ? val.toFixed(1) : '—'}</div>
                                  </div>
                                )
                              })}
                              <div className="text-center min-w-[56px] border-l border-neutral-100 pl-3">
                                <div className="text-[10px] text-neutral-500 mb-0.5">Promedio</div>
                                <div className={`text-[17px] font-extrabold ${scoreClass(n.promedio > 0 ? n.promedio : null)}`}>{n.promedio > 0 ? n.promedio.toFixed(1) : '—'}</div>
                                {n.promedio > 0 && <Badge tone={n.promedio >= 51 ? 'success' : 'danger'}>{n.promedio >= 51 ? 'Aprobado' : 'Reprobado'}</Badge>}
                              </div>
                            </div>
                            {isOpen ? <ChevronUp size={15} className="text-neutral-500"/> : <ChevronDown size={15} className="text-neutral-500"/>}
                          </div>

                          {isOpen && (
                            <div className="border-t border-neutral-100 p-3.5 bg-neutral-100/40">
                              <div className="grid gap-2.5" style={{ gridTemplateColumns: `repeat(${trimestres.length}, 1fr)` }}>
                                {trimestres.map(t => {
                                  const tk  = `t${t.number}` as 't1'|'t2'|'t3'
                                  const det = (n as any)[tk] as NotaTrimestre|null
                                  return (
                                    <Card key={t.id} className={det?.cerrado ? '!border-warning-500' : ''}>
                                      <div className="flex items-center justify-between mb-2.5">
                                        <span className="font-bold text-xs text-brand-700">{trimLabel(t)}</span>
                                        {det?.cerrado && <Badge tone="warning">🔒</Badge>}
                                      </div>
                                      {det ? (
                                        <>
                                          <DimBar val={det.saber} max={45} colorVar="var(--color-brand-700)"/>
                                          <div className="text-[9px] text-neutral-500 mb-1.5">Saber /45</div>
                                          <DimBar val={det.hacer} max={40} colorVar="var(--color-success-500)"/>
                                          <div className="text-[9px] text-neutral-500 mb-1.5">Hacer /40</div>
                                          <DimBar val={det.ser} max={10} colorVar="var(--color-warning-500)"/>
                                          <div className="text-[9px] text-neutral-500 mb-1.5">Ser /10</div>
                                          <DimBar val={det.autoEvaluacion} max={5} colorVar="var(--color-info-500)"/>
                                          <div className="text-[9px] text-neutral-500 mb-2">Autoevaluación /5</div>
                                          <div className="text-center p-1.5 bg-neutral-100 rounded-md">
                                            <div className="text-[9px] text-neutral-500">TOTAL</div>
                                            <div className={`text-xl font-extrabold ${scoreClass(det.total)}`}>{det.total != null ? det.total.toFixed(1) : '—'}</div>
                                            {det.total != null && (
                                              <div className={`text-[9px] font-bold ${det.total >= 51 ? 'text-success-700' : 'text-danger-600'}`}>
                                                {det.total >= 51 ? '✅ Aprobado' : '❌ Reprobado'}
                                              </div>
                                            )}
                                          </div>
                                        </>
                                      ) : (
                                        <div className="text-center text-neutral-500 text-[11px] py-4">Sin notas</div>
                                      )}
                                    </Card>
                                  )
                                })}
                              </div>
                            </div>
                          )}
                        </Card>
                      )
                    })}
                  </div>
                </div>
              ))}

              <div className="flex gap-4 flex-wrap text-xs text-neutral-500 py-1 mt-2">
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-success-500 shrink-0"/> Aprobado (≥51)</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-danger-500 shrink-0"/> Reprobado (&lt;51)</span>
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}
