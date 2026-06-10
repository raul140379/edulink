'use client'

import { useEffect, useState } from 'react'
import { BookOpen, Users, CheckCircle, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react'

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

const statusBadge = (val?: number) => {
  if (val === undefined) return <span className="nd">—</span>
  const apr = val >= 51
  return <span className={`nbadge ${apr ? 'apr' : 'rep'}`}>{val.toFixed(1)}</span>
}

export default function TeacherTutorNotasPage() {
  const [courseId,   setCourseId]   = useState<number | null>(null)
  const [summary,    setSummary]    = useState<Summary | null>(null)
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState('')
  const [selTrim,    setSelTrim]    = useState<number | null>(null)
  const [expanded,   setExpanded]   = useState<Record<number, boolean>>({})
  const year = new Date().getFullYear()

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : ''

  useEffect(() => {
    const init = async () => {
      setLoading(true)
      try {
        // Obtener curso del maestro tutor
        const cRes  = await fetch(`${API_URL}/api/teachers/my-course`, {
          headers: { Authorization: `Bearer ${token}` }
        })
        const cData = await cRes.json()
        if (!cRes.ok) { setError(cData.message || 'No se encontró el curso'); return }
        const cid = cData.id
        setCourseId(cid)

        // Obtener resumen de notas
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
  }, [])

  if (loading) return <div className="center"><div className="spinner"/></div>
  if (error)   return <div className="center"><p className="err-msg">{error}</p></div>
  if (!summary) return null

  const trimLabel = (t: Trimester) => t.name || `${t.number}° Trimestre`
  const selTrimNum = summary.trimesters.find(t => t.id === selTrim)?.number

  // Stats
  const totalStudents = summary.students.length
  const aprobados = summary.students.filter(s => s.promedioGeneral >= 51).length
  const reprobados = totalStudents - aprobados

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Notas del Curso</h1>
          <p>Vista de calificaciones — Gestión {year} · Solo lectura</p>
        </div>
        <span className="readonly-badge">👁 Solo lectura</span>
      </div>

      {/* Stats */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon blue"><Users size={18}/></div>
          <div><div className="stat-num">{totalStudents}</div><div className="stat-lbl">Estudiantes</div></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon green"><CheckCircle size={18}/></div>
          <div><div className="stat-num" style={{color:'#0F6E56'}}>{aprobados}</div><div className="stat-lbl">Aprobados</div></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon red"><AlertCircle size={18}/></div>
          <div><div className="stat-num" style={{color:'#C0392B'}}>{reprobados}</div><div className="stat-lbl">Reprobados</div></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon blue"><BookOpen size={18}/></div>
          <div><div className="stat-num">{summary.subjects.length}</div><div className="stat-lbl">Materias</div></div>
        </div>
      </div>

      {/* Selector trimestre */}
      <div className="trim-bar">
        <span className="trim-label">Trimestre:</span>
        {summary.trimesters.map(t => (
          <button key={t.id} className={`trim-btn ${selTrim === t.id ? 'active' : ''}`}
            onClick={() => setSelTrim(t.id)}>
            {trimLabel(t)}
          </button>
        ))}
        <button className={`trim-btn ${selTrim === null ? 'active' : ''}`}
          onClick={() => setSelTrim(null)}>
          Promedio general
        </button>
      </div>

      {/* Tabla de notas por estudiante */}
      <div className="table-card">
        <div className="table-header">
          <BookOpen size={14}/>
          <span>
            {selTrim === null
              ? 'Promedio General de todas las materias'
              : `Notas del ${trimLabel(summary.trimesters.find(t => t.id === selTrim)!)}`}
          </span>
          <span className="count-badge">{totalStudents} estudiantes · {summary.subjects.length} materias</span>
        </div>

        {summary.students.map((row, i) => {
          const isOpen = expanded[row.student.id]
          const prom   = row.promedioGeneral
          const apr    = prom >= 51

          // Contar reprobados en este trimestre
          const repCount = selTrim !== null
            ? summary.subjects.filter(s => {
                const val = selTrimNum === 1 ? row.subjects[s.id]?.t1
                          : selTrimNum === 2 ? row.subjects[s.id]?.t2
                          : row.subjects[s.id]?.t3
                return val !== undefined && val < 51
              }).length
            : summary.subjects.filter(s => row.subjects[s.id]?.promedio < 51 && row.subjects[s.id]?.promedio !== undefined).length

          return (
            <div key={row.student.id} className="student-block">
              {/* Fila resumen del estudiante */}
              <div className={`student-row ${isOpen ? 'open' : ''}`}
                onClick={() => setExpanded(prev => ({ ...prev, [row.student.id]: !isOpen }))}>
                <div className="student-num">{i + 1}</div>
                <div className="student-name">
                  {row.student.lastName} {row.student.firstName}
                  {row.student.kardex && <span className="kardex">Kardex: {row.student.kardex}</span>}
                </div>
                <div className="student-stats">
                  {repCount > 0 && (
                    <span className="rep-count">{repCount} rep.</span>
                  )}
                  <span className={`prom-badge ${apr ? 'apr' : 'rep'}`}>
                    Prom: {prom.toFixed(1)}
                  </span>
                </div>
                <button className="expand-btn">
                  {isOpen ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}
                </button>
              </div>

              {/* Detalle de materias */}
              {isOpen && (
                <div className="subject-detail">
                  <table>
                    <thead>
                      <tr>
                        <th>Materia</th>
                        {selTrim === null ? (
                          <>
                            <th style={{textAlign:'center'}}>T1</th>
                            <th style={{textAlign:'center'}}>T2</th>
                            <th style={{textAlign:'center'}}>T3</th>
                            <th style={{textAlign:'center'}}>Promedio</th>
                          </>
                        ) : (
                          <th style={{textAlign:'center'}}>Nota</th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {summary.subjects.map(s => {
                        const sData = row.subjects[s.id]
                        return (
                          <tr key={s.id}>
                            <td>{s.name}</td>
                            {selTrim === null ? (
                              <>
                                <td style={{textAlign:'center'}}>{statusBadge(sData?.t1)}</td>
                                <td style={{textAlign:'center'}}>{statusBadge(sData?.t2)}</td>
                                <td style={{textAlign:'center'}}>{statusBadge(sData?.t3)}</td>
                                <td style={{textAlign:'center'}}>{statusBadge(sData?.promedio)}</td>
                              </>
                            ) : (
                              <td style={{textAlign:'center'}}>
                                {statusBadge(
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
              )}
            </div>
          )
        })}
      </div>

      <style>{`
        .center{display:flex;justify-content:center;align-items:center;padding:48px;flex-direction:column;gap:12px;color:#6B8BB0}
        .err-msg{color:#C0392B;font-size:14px}
        .page-header{display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:24px;gap:16px;flex-wrap:wrap}
        .page-header h1{font-size:20px;font-weight:700;color:#0F6E56;margin-bottom:4px}
        .page-header p{font-size:13px;color:#6B8BB0}
        .readonly-badge{background:#E1F5EE;color:#0F6E56;border:1px solid #9FE1CB;padding:6px 14px;border-radius:20px;font-size:12px;font-weight:600;white-space:nowrap}
        .stats-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin-bottom:20px}
        .stat-card{background:#fff;border:1px solid #CBE0F0;border-radius:12px;padding:16px;display:flex;align-items:center;gap:12px}
        .stat-icon{width:38px;height:38px;border-radius:10px;display:flex;align-items:center;justify-content:center;flex-shrink:0}
        .stat-icon.blue{background:#E0ECF8;color:#1A3A7C}
        .stat-icon.green{background:#E1F5EE;color:#0F6E56}
        .stat-icon.red{background:#FFF0F0;color:#C0392B}
        .stat-num{font-size:22px;font-weight:700;color:#1A3A7C}
        .stat-lbl{font-size:11px;color:#6B8BB0}
        .trim-bar{display:flex;align-items:center;gap:8px;margin-bottom:16px;flex-wrap:wrap}
        .trim-label{font-size:12px;font-weight:600;color:#6B8BB0;text-transform:uppercase;letter-spacing:.5px}
        .trim-btn{padding:6px 14px;border-radius:8px;font-size:12px;font-weight:500;border:1.5px solid #CBE0F0;background:#fff;color:#1A3A7C;cursor:pointer;transition:all .15s}
        .trim-btn:hover{border-color:#4A9FD4;background:#F0F6FC}
        .trim-btn.active{background:#0F6E56;color:#fff;border-color:#0F6E56}
        .table-card{background:#fff;border:1px solid #CBE0F0;border-radius:12px;overflow:hidden}
        .table-header{display:flex;align-items:center;gap:8px;padding:14px 18px;border-bottom:1px solid #F0F6FC;font-size:13px;font-weight:600;color:#1A3A7C}
        .count-badge{margin-left:auto;font-size:11px;color:#6B8BB0;font-weight:400}
        .student-block{border-top:1px solid #F0F6FC}
        .student-row{display:flex;align-items:center;gap:12px;padding:12px 18px;cursor:pointer;transition:background .15s}
        .student-row:hover{background:#F8FBFF}
        .student-row.open{background:#F0F6FC}
        .student-num{font-size:11px;color:#6B8BB0;min-width:22px}
        .student-name{flex:1;font-size:13px;font-weight:500;color:#1A3A7C;display:flex;flex-direction:column;gap:2px}
        .kardex{font-size:11px;color:#6B8BB0;font-weight:400}
        .student-stats{display:flex;align-items:center;gap:8px}
        .rep-count{font-size:11px;background:#FFF0F0;color:#C0392B;padding:2px 8px;border-radius:10px;font-weight:500}
        .prom-badge{font-size:12px;padding:3px 10px;border-radius:20px;font-weight:600}
        .prom-badge.apr{background:#E1F5EE;color:#0F6E56}
        .prom-badge.rep{background:#FFF0F0;color:#C0392B}
        .expand-btn{background:none;border:none;cursor:pointer;color:#6B8BB0;display:flex;padding:4px;border-radius:6px}
        .expand-btn:hover{background:#E0ECF8;color:#1A3A7C}
        .subject-detail{padding:0 18px 14px;background:#F8FBFF}
        .subject-detail table{width:100%;border-collapse:collapse;border:1px solid #CBE0F0;border-radius:8px;overflow:hidden}
        .subject-detail th{padding:8px 12px;text-align:left;font-size:11px;font-weight:600;color:#1A3A7C;text-transform:uppercase;letter-spacing:.5px;background:#F0F6FC}
        .subject-detail td{padding:9px 12px;font-size:12px;color:#1A3A7C;border-top:1px solid #F0F6FC}
        .nbadge{padding:2px 8px;border-radius:10px;font-size:11px;font-weight:600}
        .nbadge.apr{background:#E1F5EE;color:#0F6E56}
        .nbadge.rep{background:#FFF0F0;color:#C0392B}
        .nd{color:#CBD5E0;font-size:12px}
        .spinner{width:24px;height:24px;border:2px solid rgba(15,110,86,.2);border-top-color:#0F6E56;border-radius:50%;animation:spin .7s linear infinite}
        @keyframes spin{to{transform:rotate(360deg)}}
        @media(max-width:600px){.stats-grid{grid-template-columns:1fr 1fr}}
      `}</style>
    </div>
  )
}