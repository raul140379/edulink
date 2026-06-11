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

interface NotaRow {
  subject:  { id: number; name: string }
  course:   { grade: string; parallel: string; level: string }
  t1:       number | null
  t2:       number | null
  t3:       number | null
  promedio: number
}

interface ParentData {
  id: number; firstName: string; lastName: string
  students: { isTutor: boolean; student: Student }[]
}

const GRADES: Record<string,string> = { PRIMERO:'1°', SEGUNDO:'2°', TERCERO:'3°', CUARTO:'4°', QUINTO:'5°', SEXTO:'6°' }
const SHIFTS: Record<string,string> = { MORNING:'Mañana', AFTERNOON:'Tarde', NIGHT:'Noche' }
const LEVELS: Record<string,string> = { INICIAL:'Inicial', PRIMARIA:'Primaria', SECUNDARIA:'Secundaria' }

const notaFmt = (v: number | null) => v !== null && v !== undefined ? v.toFixed(0) : '—'
const color   = (v: number | null) => {
  if (v === null || v === undefined) return '#6B8BB0'
  if (v >= 71) return '#0F6E56'
  if (v >= 51) return '#BA7517'
  return '#C0392B'
}
const badge = (v: number | null) => {
  if (v === null || v === undefined) return ''
  if (v >= 71) return 'ap-alto'
  if (v >= 51) return 'ap-bajo'
  return 'rep'
}

export default function ParentCalificacionesPage() {
  const searchParams  = useSearchParams()
  const [parent,      setParent]      = useState<ParentData | null>(null)
  const [selStudentId,setSelStudentId]= useState<number | null>(null)
  const [notas,       setNotas]       = useState<NotaRow[]>([])
  const [loading,     setLoading]     = useState(true)
  const [loadingNotas,setLoadingNotas]= useState(false)
  const [expanded,    setExpanded]    = useState(true)
  const [error,       setError]       = useState('')
  const year = new Date().getFullYear()

  useEffect(() => {
    const init = async () => {
      const token = localStorage.getItem('token')
      if (!token) { setError('No autenticado'); setLoading(false); return }
      setLoading(true)
      try {
        const res  = await fetch(`${API_URL}/api/parents/me`, {
          headers: { Authorization: `Bearer ${token}` }
        })
        const data = await res.json()
        if (res.ok) {
          setParent(data)
          const students = data.students.filter((ps: any) => ps.isTutor).map((ps: any) => ps.student)
          const qId  = searchParams.get('studentId')
          const presel = qId ? parseInt(qId) : students[0]?.id
          if (presel) setSelStudentId(presel)
        } else {
          setError(data.message || 'Error al cargar datos')
        }
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
        const res  = await fetch(`${API_URL}/api/notas/student/${selStudentId}?year=${year}`, {
          headers: { Authorization: `Bearer ${token}` }
        })
        const data = await res.json()
        if (res.ok) setNotas(Array.isArray(data) ? data : [])
      } catch { console.error('Error al cargar notas') }
      finally  { setLoadingNotas(false) }
    }
    load()
  }, [selStudentId])

  if (loading) return <div className="center"><div className="spinner"/></div>
  if (error)   return <div className="center"><p style={{color:'#C0392B'}}>{error}</p></div>
  if (!parent) return null

  const myStudents    = parent.students.filter(ps => ps.isTutor).map(ps => ps.student)
  const selStudent    = myStudents.find(s => s.id === selStudentId)
  const activeAssignment = selStudent?.assignments?.find(a => a.academicYear?.isActive)

  const withNota    = notas.filter(n => n.promedio > 0)
  const aprobados   = withNota.filter(n => n.promedio >= 51).length
  const reprobados  = withNota.filter(n => n.promedio < 51).length
  const promGeneral = withNota.length > 0
    ? (withNota.reduce((s, n) => s + n.promedio, 0) / withNota.length).toFixed(1)
    : '—'

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Calificaciones</h1>
          <p>Gestión {year} · Escala 0–100 · Aprobado ≥ 51</p>
        </div>
      </div>

      {/* Selector de hijo */}
      {myStudents.length > 1 && (
        <div className="student-selector">
          {myStudents.map(s => (
            <button key={s.id} className={`stu-btn ${selStudentId === s.id ? 'active' : ''}`}
              onClick={() => setSelStudentId(s.id)}>
              {s.gender === 'MASCULINO' ? '👦' : '👧'} {s.lastName} {s.firstName}
            </button>
          ))}
        </div>
      )}

      {selStudent && (
        <>
          {/* Info del estudiante */}
          <div className="stu-info-card">
            <div className="stu-avatar">{selStudent.gender === 'MASCULINO' ? '👦' : '👧'}</div>
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
          ) : notas.length === 0 ? (
            <div className="empty-state">
              <BookOpen size={40} color="#CBE0F0"/>
              <p>No hay calificaciones registradas aún para la gestión {year}</p>
            </div>
          ) : (
            <>
              <div className="stats-grid">
                <div className="stat-card">
                  <div className="stat-num" style={{color:'#1A3A7C'}}>{notas.length}</div>
                  <div className="stat-lbl">Materias</div>
                </div>
                <div className="stat-card">
                  <div className="stat-num" style={{color:'#0F6E56'}}>{aprobados}</div>
                  <div className="stat-lbl">Aprobadas</div>
                </div>
                <div className="stat-card">
                  <div className="stat-num" style={{color: reprobados > 0 ? '#C0392B' : '#0F6E56'}}>{reprobados}</div>
                  <div className="stat-lbl">Reprobadas</div>
                </div>
                <div className="stat-card">
                  <div className="stat-num" style={{color: parseFloat(promGeneral) >= 51 ? '#0F6E56' : '#C0392B'}}>
                    {promGeneral}
                  </div>
                  <div className="stat-lbl">Promedio general</div>
                </div>
              </div>

              {reprobados === 0 && withNota.length > 0 ? (
                <div className="alert-ok"><CheckCircle size={14}/> ¡Todas las materias aprobadas! ✓</div>
              ) : reprobados > 0 ? (
                <div className="alert-warn"><AlertCircle size={14}/> {reprobados} {reprobados === 1 ? 'materia reprobada' : 'materias reprobadas'}</div>
              ) : null}

              <div className="table-card">
                <div className="table-header" onClick={() => setExpanded(!expanded)}>
                  <BookOpen size={14}/> Detalle de calificaciones
                  {expanded ? <ChevronUp size={14} style={{marginLeft:'auto'}}/> : <ChevronDown size={14} style={{marginLeft:'auto'}}/>}
                </div>
                {expanded && (
                  <table>
                    <thead>
                      <tr>
                        <th>Materia</th>
                        <th style={{textAlign:'center'}}>1° Trim</th>
                        <th style={{textAlign:'center'}}>2° Trim</th>
                        <th style={{textAlign:'center'}}>3° Trim</th>
                        <th style={{textAlign:'center'}}>Promedio</th>
                        <th style={{textAlign:'center'}}>Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {notas.map(n => (
                        <tr key={n.subject.id}>
                          <td style={{fontWeight:500}}>{n.subject.name}</td>
                          <td style={{textAlign:'center',color:color(n.t1)}}>{notaFmt(n.t1)}</td>
                          <td style={{textAlign:'center',color:color(n.t2)}}>{notaFmt(n.t2)}</td>
                          <td style={{textAlign:'center',color:color(n.t3)}}>{notaFmt(n.t3)}</td>
                          <td style={{textAlign:'center'}}>
                            <strong style={{color:color(n.promedio)}}>{n.promedio > 0 ? n.promedio.toFixed(1) : '—'}</strong>
                          </td>
                          <td style={{textAlign:'center'}}>
                            {n.promedio > 0 ? (
                              <span className={`estado-badge ${badge(n.promedio)}`}>
                                {n.promedio >= 71 ? 'Alto ✓' : n.promedio >= 51 ? 'Básico' : 'En proceso'}
                              </span>
                            ) : <span className="muted">—</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              <div className="leyenda">
                <span className="ley-item"><span className="ley-dot" style={{background:'#0F6E56'}}/> Alto (71–100)</span>
                <span className="ley-item"><span className="ley-dot" style={{background:'#BA7517'}}/> Básico (51–70)</span>
                <span className="ley-item"><span className="ley-dot" style={{background:'#C0392B'}}/> En proceso (0–50)</span>
              </div>
            </>
          )}
        </>
      )}

      <style>{`
        .page-header{margin-bottom:24px}
        .page-header h1{font-size:20px;font-weight:700;color:#27500A;margin-bottom:4px}
        .page-header p{font-size:13px;color:#6B8BB0}
        .center{display:flex;justify-content:center;align-items:center;padding:48px;color:#6B8BB0}
        .student-selector{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px}
        .stu-btn{display:flex;align-items:center;gap:6px;padding:8px 16px;border:1.5px solid #CBE0F0;border-radius:8px;background:#fff;color:#1A3A7C;font-size:13px;font-weight:500;cursor:pointer}
        .stu-btn:hover{border-color:#27500A;background:#F8FFF4}
        .stu-btn.active{background:#27500A;color:#fff;border-color:#27500A}
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
        .table-card{background:#fff;border:1px solid #CBE0F0;border-radius:12px;overflow:hidden;margin-bottom:12px}
        .table-header{display:flex;align-items:center;gap:8px;padding:14px 18px;border-bottom:1px solid #F0F6FC;font-size:13px;font-weight:600;color:#1A3A7C;cursor:pointer;user-select:none}
        .table-header:hover{background:#FAFCFF}
        table{width:100%;border-collapse:collapse}
        thead tr{background:#F0F6FC}
        th{padding:10px 14px;text-align:left;font-size:11px;font-weight:600;color:#1A3A7C;text-transform:uppercase;letter-spacing:.5px}
        td{padding:11px 14px;font-size:13px;color:#1A3A7C;border-top:1px solid #F0F6FC}
        tr:hover td{background:#FAFCFF}
        .muted{color:#6B8BB0}
        .estado-badge{padding:3px 10px;border-radius:20px;font-size:11px;font-weight:600}
        .estado-badge.ap-alto{background:#E1F5EE;color:#0F6E56}
        .estado-badge.ap-bajo{background:#FFFBEA;color:#BA7517}
        .estado-badge.rep{background:#FFF0F0;color:#C0392B}
        .leyenda{display:flex;gap:16px;flex-wrap:wrap;font-size:12px;color:#6B8BB0;padding:4px 0}
        .ley-item{display:flex;align-items:center;gap:6px}
        .ley-dot{width:10px;height:10px;border-radius:50%;flex-shrink:0}
        .spinner{width:24px;height:24px;border:2px solid rgba(39,80,10,.2);border-top-color:#27500A;border-radius:50%;animation:spin .7s linear infinite}
        @keyframes spin{to{transform:rotate(360deg)}}
        @media(max-width:600px){.stats-grid{grid-template-columns:1fr 1fr}}
      `}</style>
    </div>
  )
}