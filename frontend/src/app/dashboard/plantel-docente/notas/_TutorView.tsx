'use client'

import { useEffect, useState } from 'react'
import { BookOpen, Users, CheckCircle, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react'
import Card from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

interface Trimester { id: number; number: number; name: string | null }
interface Subject   { id: number; name: string }
interface Student   {
  id: number; firstName: string; lastName: string; kardex: string | null
  subjects: Record<number, { t1?: number; t2?: number; t3?: number; promedio: number }>
  promedioGeneral: number
}

interface Summary {
  academicYear: { id: number; year: number }
  trimesters:   Trimester[]
  subjects:     Subject[]
  students:     { student: Student; subjects: Record<number, { t1?: number; t2?: number; t3?: number; promedio: number }>; promedioGeneral: number }[]
}

const scoreBadge = (val?: number) => {
  if (val === undefined) return <span className="text-neutral-300 text-xs">—</span>
  return <Badge tone={val >= 51 ? 'success' : 'danger'}>{val.toFixed(1)}</Badge>
}

export default function TeacherTutorNotasPage() {
  const [courseId,   setCourseId]   = useState<number | null>(null)
  const [summary,    setSummary]    = useState<Summary | null>(null)
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState('')
  const [selTrim,    setSelTrim]    = useState<number | null>(null)
  const [expanded,   setExpanded]   = useState<Record<number, boolean>>({})
  const year = new Date().getFullYear()

  useEffect(() => {
    const init = async () => {
      const token = localStorage.getItem('token')
      setLoading(true)
      try {
        const cRes  = await fetch(`${API_URL}/api/teachers/my-course`, {
          headers: { Authorization: `Bearer ${token}` }
        })
        const cData = await cRes.json()
        if (!cRes.ok) { setError(cData.message || 'No se encontró el curso'); return }
        const cid = cData.id
        setCourseId(cid)

        const sRes  = await fetch(`${API_URL}/api/notas/summary/${cid}?year=${year}`, {
          headers: { Authorization: `Bearer ${token}` }
        })
        const sData = await sRes.json()
        if (!sRes.ok) { setError(sData.error || 'Error al cargar notas'); return }
        setSummary(sData)
        if (sData.trimesters?.length > 0) setSelTrim(sData.trimesters[0].id)
      } catch { setError('Error de conexión') }
      finally  { setLoading(false) }
    }
    init()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (loading) return <div className="flex justify-center py-16"><p className="text-sm text-neutral-500">Cargando...</p></div>
  if (error)   return <div className="flex justify-center py-16"><p className="text-sm text-danger-600">{error}</p></div>
  if (!summary) return null

  const trimLabel = (t: Trimester) => t.name || `${t.number}° Trimestre`
  const selTrimNum = summary.trimesters.find(t => t.id === selTrim)?.number

  const totalStudents = summary.students.length
  const aprobados = summary.students.filter(s => s.promedioGeneral >= 51).length
  const reprobados = totalStudents - aprobados

  return (
    <div>
      <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-brand-700 mb-1">Notas del Curso</h1>
          <p className="text-[13px] text-neutral-500">Vista de calificaciones — Gestión {year} · Solo lectura</p>
        </div>
        <Badge tone="success">👁 Solo lectura</Badge>
      </div>

      <div className="grid gap-3 mb-5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))' }}>
        <Card className="flex items-center gap-3">
          <div className="p-2.5 rounded-[10px] bg-brand-100 text-brand-700"><Users size={18}/></div>
          <div><div className="text-xl font-bold text-brand-700">{totalStudents}</div><div className="text-[11px] text-neutral-500">Estudiantes</div></div>
        </Card>
        <Card className="flex items-center gap-3">
          <div className="p-2.5 rounded-[10px] bg-success-100 text-success-700"><CheckCircle size={18}/></div>
          <div><div className="text-xl font-bold text-success-700">{aprobados}</div><div className="text-[11px] text-neutral-500">Aprobados</div></div>
        </Card>
        <Card className="flex items-center gap-3">
          <div className="p-2.5 rounded-[10px] bg-danger-100 text-danger-600"><AlertCircle size={18}/></div>
          <div><div className="text-xl font-bold text-danger-600">{reprobados}</div><div className="text-[11px] text-neutral-500">Reprobados</div></div>
        </Card>
        <Card className="flex items-center gap-3">
          <div className="p-2.5 rounded-[10px] bg-brand-100 text-brand-700"><BookOpen size={18}/></div>
          <div><div className="text-xl font-bold text-brand-700">{summary.subjects.length}</div><div className="text-[11px] text-neutral-500">Materias</div></div>
        </Card>
      </div>

      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">Trimestre:</span>
        {summary.trimesters.map(t => (
          <button
            key={t.id} onClick={() => setSelTrim(t.id)}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-medium border transition-colors ${selTrim === t.id ? 'bg-success-500 text-white border-success-500' : 'bg-white text-brand-700 border-neutral-300 hover:bg-neutral-100'}`}
          >
            {trimLabel(t)}
          </button>
        ))}
        <button
          onClick={() => setSelTrim(null)}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-medium border transition-colors ${selTrim === null ? 'bg-success-500 text-white border-success-500' : 'bg-white text-brand-700 border-neutral-300 hover:bg-neutral-100'}`}
        >
          Promedio general
        </button>
      </div>

      <Card padded={false} className="overflow-hidden">
        <div className="flex items-center gap-2 px-4.5 py-3.5 border-b border-neutral-100 text-[13px] font-semibold text-brand-700">
          <BookOpen size={14}/>
          <span>
            {selTrim === null
              ? 'Promedio General de todas las materias'
              : `Notas del ${trimLabel(summary.trimesters.find(t => t.id === selTrim)!)}`}
          </span>
          <span className="ml-auto text-[11px] text-neutral-500 font-normal">{totalStudents} estudiantes · {summary.subjects.length} materias</span>
        </div>

        {summary.students.map((row, i) => {
          const isOpen = expanded[row.student.id]
          const prom   = row.promedioGeneral
          const apr    = prom >= 51

          const repCount = selTrim !== null
            ? summary.subjects.filter(s => {
                const val = selTrimNum === 1 ? row.subjects[s.id]?.t1
                          : selTrimNum === 2 ? row.subjects[s.id]?.t2
                          : row.subjects[s.id]?.t3
                return val !== undefined && val < 51
              }).length
            : summary.subjects.filter(s => row.subjects[s.id]?.promedio < 51 && row.subjects[s.id]?.promedio !== undefined).length

          return (
            <div key={row.student.id} className="border-t border-neutral-100">
              <div
                className={`flex items-center gap-3 px-4.5 py-3 cursor-pointer transition-colors ${isOpen ? 'bg-neutral-100' : 'hover:bg-neutral-100/40'}`}
                onClick={() => setExpanded(prev => ({ ...prev, [row.student.id]: !isOpen }))}
              >
                <div className="text-[11px] text-neutral-500 min-w-[22px]">{i + 1}</div>
                <div className="flex-1 flex flex-col gap-0.5">
                  <span className="text-[13px] font-medium text-brand-700">{row.student.lastName} {row.student.firstName}</span>
                  {row.student.kardex && <span className="text-[11px] text-neutral-500">Kardex: {row.student.kardex}</span>}
                </div>
                <div className="flex items-center gap-2">
                  {repCount > 0 && <Badge tone="danger">{repCount} rep.</Badge>}
                  <Badge tone={apr ? 'success' : 'danger'}>Prom: {prom.toFixed(1)}</Badge>
                </div>
                <button className="text-neutral-500 hover:text-brand-700 hover:bg-brand-100 rounded-md p-1">
                  {isOpen ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}
                </button>
              </div>

              {isOpen && (
                <div className="px-4.5 pb-3.5 bg-neutral-100/40">
                  <div className="overflow-x-auto rounded-lg border border-neutral-300">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="bg-neutral-100">
                          <th className="px-3 py-2 text-left text-[11px] font-semibold text-brand-700 uppercase tracking-wide">Materia</th>
                          {selTrim === null ? (
                            <>
                              <th className="px-3 py-2 text-center text-[11px] font-semibold text-brand-700 uppercase tracking-wide">T1</th>
                              <th className="px-3 py-2 text-center text-[11px] font-semibold text-brand-700 uppercase tracking-wide">T2</th>
                              <th className="px-3 py-2 text-center text-[11px] font-semibold text-brand-700 uppercase tracking-wide">T3</th>
                              <th className="px-3 py-2 text-center text-[11px] font-semibold text-brand-700 uppercase tracking-wide">Promedio</th>
                            </>
                          ) : (
                            <th className="px-3 py-2 text-center text-[11px] font-semibold text-brand-700 uppercase tracking-wide">Nota</th>
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {summary.subjects.map(s => {
                          const sData = row.subjects[s.id]
                          return (
                            <tr key={s.id} className="border-t border-neutral-100">
                              <td className="px-3 py-2 text-xs text-brand-700">{s.name}</td>
                              {selTrim === null ? (
                                <>
                                  <td className="px-3 py-2 text-center">{scoreBadge(sData?.t1)}</td>
                                  <td className="px-3 py-2 text-center">{scoreBadge(sData?.t2)}</td>
                                  <td className="px-3 py-2 text-center">{scoreBadge(sData?.t3)}</td>
                                  <td className="px-3 py-2 text-center">{scoreBadge(sData?.promedio)}</td>
                                </>
                              ) : (
                                <td className="px-3 py-2 text-center">
                                  {scoreBadge(
                                    selTrimNum === 1 ? sData?.t1 :
                                    selTrimNum === 2 ? sData?.t2 : sData?.t3
                                  )}
                                </td>
                              )}
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </Card>
    </div>
  )
}
