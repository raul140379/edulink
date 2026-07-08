'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Users, MessageCircle, BookOpen, GraduationCap } from 'lucide-react'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

interface Parent {
  id:        number
  firstName: string
  lastName:  string
  phone?:    string
  ci?:       string
}

interface Student {
  id:        number
  firstName: string
  lastName:  string
  ci?:       string
  rude?:     string
  gender:    string
  isActive:  boolean
  parents:   { isTutor: boolean; parent: Parent }[]
}

interface Assignment {
  id:      number
  student: Student
}

interface CourseInfo {
  id:            number
  grade:         string
  parallel:      string
  level:         string
  shift:         string
  educationType: string
}

const GRADES: Record<string, string> = {
  PRIMERO: '1°', SEGUNDO: '2°', TERCERO: '3°',
  CUARTO: '4°', QUINTO: '5°', SEXTO: '6°',
}
const SHIFTS: Record<string, string> = {
  MORNING: 'Mañana', AFTERNOON: 'Tarde', NIGHT: 'Noche',
}
const LEVELS: Record<string, string> = {
  INICIAL: 'Inicial', PRIMARIA: 'Primaria', SECUNDARIA: 'Secundaria',
}

export default function TeacherCursoPage() {
  const params = useParams()
  const router = useRouter()
  const courseId = params.id as string

  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [courseInfo,  setCourseInfo]  = useState<CourseInfo | null>(null)
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState('')
  const [search,      setSearch]      = useState('')

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : ''

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      try {
        const [sRes, cRes] = await Promise.all([
          fetch(`${API_URL}/api/students/by-course/${courseId}`, {
            headers: { Authorization: `Bearer ${token}` }
          }),
          fetch(`${API_URL}/api/courses/${courseId}`, {
            headers: { Authorization: `Bearer ${token}` }
          }),
        ])
        const [sData, cData] = await Promise.all([sRes.json(), cRes.json()])
        if (sRes.ok) setAssignments(sData)
        else setError(sData.message || 'Error al cargar estudiantes')
        if (cRes.ok) setCourseInfo(cData)
      } catch { setError('Error de conexión') }
      finally  { setLoading(false) }
    }
    fetchData()
  }, [courseId])

  const openWhatsApp = (phone: string, name: string) => {
    const msg = encodeURIComponent(`Estimado/a ${name}, le contactamos desde la U.E. Naciones Unidas.`)
    window.open(`https://wa.me/591${phone.replace(/\D/g, '')}?text=${msg}`, '_blank')
  }

  const filtered = assignments.filter(a => {
    const q = search.toLowerCase()
    return (
      a.student.firstName.toLowerCase().includes(q) ||
      a.student.lastName.toLowerCase().includes(q)  ||
      (a.student.ci   || '').toLowerCase().includes(q) ||
      (a.student.rude || '').toLowerCase().includes(q)
    )
  })

  const varones = assignments.filter(a => a.student.gender === 'MASCULINO').length
  const mujeres = assignments.filter(a => a.student.gender === 'FEMENINO').length

  if (loading) return <div className="center"><div className="spinner"/></div>
  if (error)   return <div className="center"><p className="err-msg">{error}</p></div>

  return (
    <div>
      {/* Cabecera */}
      <div className="page-header">
        <button className="back-btn" onClick={() => router.back()}>
          <ArrowLeft size={16}/> Volver
        </button>
        <div style={{flex:1}}>
          {courseInfo && (
            <>
              <h1>
                {GRADES[courseInfo.grade]} &quot;{courseInfo.parallel}&quot; · {SHIFTS[courseInfo.shift]}
              </h1>
              <p className="sub">
                {LEVELS[courseInfo.level]}
                {courseInfo.educationType === 'BTH' && ' · BTH'}
              </p>
            </>
          )}
        </div>
      </div>

      {/* Resumen */}
      <div className="summary-grid">
        <div className="sum-card accent">
          <Users size={24} color="#fff"/>
          <div>
            <div className="sum-label">Total estudiantes</div>
            <div className="sum-value">{assignments.length}</div>
          </div>
        </div>
        <div className="sum-card">
          <GraduationCap size={24} color="#1A3A7C"/>
          <div>
            <div className="sum-label">Varones</div>
            <div className="sum-value">{varones}</div>
          </div>
        </div>
        <div className="sum-card">
          <GraduationCap size={24} color="#9B3070"/>
          <div>
            <div className="sum-label">Mujeres</div>
            <div className="sum-value">{mujeres}</div>
          </div>
        </div>
      </div>

      {/* Buscador */}
      <div className="search-bar">
        <input
          type="text"
          placeholder="Buscar por nombre, CI o RUDE..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Lista de estudiantes */}
      <div className="table-card">
        <div className="table-header">
          <BookOpen size={15}/>
          Estudiantes ({filtered.length})
        </div>
        {filtered.length === 0 ? (
          <div className="empty">No se encontraron estudiantes</div>
        ) : (
          <div className="students-list">
            {filtered.map((a, i) => {
              const tutor = a.student.parents.find(p => p.isTutor)
              return (
                <div key={a.id} className="student-row">
                  <div className="student-num">{i + 1}</div>
                  <div className="student-avatar">
                    {a.student.gender === 'MASCULINO' ? '👦' : '👧'}
                  </div>
                  <div className="student-info">
                    <div className="student-name">
                      {a.student.lastName} {a.student.firstName}
                    </div>
                    <div className="student-meta">
                      {a.student.ci   && <span>CI: {a.student.ci}</span>}
                      {a.student.rude && <span>RUDE: {a.student.rude}</span>}
                      {!a.student.isActive && (
                        <span className="inactive-badge">Inactivo</span>
                      )}
                    </div>
                    {tutor && (
                      <div className="tutor-row">
                        <span className="tutor-label">Tutor:</span>
                        <span className="tutor-name">
                          {tutor.parent.lastName} {tutor.parent.firstName}
                        </span>
                        {tutor.parent.phone && (
                          <button
                            className="wa-btn"
                            onClick={() => openWhatsApp(
                              tutor.parent.phone!,
                              `${tutor.parent.lastName} ${tutor.parent.firstName}`
                            )}
                          >
                            <MessageCircle size={11}/> WhatsApp
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                  <div className={`gender-badge ${a.student.gender === 'MASCULINO' ? 'masc' : 'fem'}`}>
                    {a.student.gender === 'MASCULINO' ? '♂' : '♀'}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <style>{`
        .center{display:flex;justify-content:center;align-items:center;padding:48px;color:#6B8BB0;flex-direction:column;gap:8px}
        .err-msg{color:#C0392B;font-size:14px}
        .page-header{display:flex;align-items:flex-start;gap:16px;margin-bottom:20px;flex-wrap:wrap}
        .page-header h1{font-size:20px;font-weight:700;color:#1A3A7C;margin:0 0 4px}
        .sub{font-size:13px;color:#6B8BB0;margin:0}
        .back-btn{display:flex;align-items:center;gap:6px;background:none;border:none;cursor:pointer;color:#6B8BB0;font-size:13px;padding:6px 0;white-space:nowrap}
        .back-btn:hover{color:#1A3A7C}
        .summary-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin-bottom:16px}
        .sum-card{background:#fff;border:1px solid #CBE0F0;border-radius:12px;padding:14px;display:flex;align-items:center;gap:12px}
        .sum-card.accent{background:#1A3A7C;border-color:#1A3A7C}
        .sum-card.accent .sum-label{color:rgba(255,255,255,0.7)}
        .sum-card.accent .sum-value{color:#fff}
        .sum-label{font-size:11px;color:#6B8BB0;text-transform:uppercase;letter-spacing:.5px;margin-bottom:2px}
        .sum-value{font-size:22px;font-weight:700;color:#1A3A7C}
        .search-bar{margin-bottom:14px}
        .search-bar input{width:100%;padding:10px 14px;border:1.5px solid #CBE0F0;border-radius:8px;font-size:13px;color:#1A3A7C;outline:none}
        .search-bar input:focus{border-color:#4A9FD4;box-shadow:0 0 0 3px rgba(74,159,212,.12)}
        .table-card{background:#fff;border:1px solid #CBE0F0;border-radius:12px;overflow:hidden}
        .table-header{display:flex;align-items:center;gap:8px;padding:14px 18px;border-bottom:1px solid #F0F6FC;font-size:13px;font-weight:700;color:#1A3A7C}
        .empty{padding:32px;text-align:center;font-size:13px;color:#6B8BB0;font-style:italic}
        .students-list{display:flex;flex-direction:column}
        .student-row{display:flex;align-items:flex-start;gap:12px;padding:12px 18px;border-top:1px solid #F0F6FC}
        .student-row:hover{background:#FAFCFF}
        .student-num{font-size:11px;color:#6B8BB0;min-width:20px;padding-top:3px}
        .student-avatar{font-size:20px;flex-shrink:0}
        .student-info{flex:1}
        .student-name{font-size:13px;font-weight:600;color:#1A3A7C;margin-bottom:3px}
        .student-meta{display:flex;gap:10px;font-size:11px;color:#6B8BB0;flex-wrap:wrap;margin-bottom:4px}
        .inactive-badge{background:#FFF0F0;color:#C0392B;padding:1px 6px;border-radius:10px;font-size:10px;font-weight:500}
        .tutor-row{display:flex;align-items:center;gap:6px;font-size:11px;color:#6B8BB0}
        .tutor-label{font-weight:600;color:#4A9FD4}
        .tutor-name{color:#1A3A7C}
        .wa-btn{display:flex;align-items:center;gap:3px;background:#25D366;color:#fff;border:none;border-radius:10px;padding:2px 7px;font-size:10px;cursor:pointer;flex-shrink:0}
        .wa-btn:hover{background:#1DA851}
        .gender-badge{font-size:16px;padding-top:2px;flex-shrink:0}
        .gender-badge.masc{color:#1A3A7C}
        .gender-badge.fem{color:#9B3070}
        .spinner{width:24px;height:24px;border:2px solid rgba(26,58,124,.2);border-top-color:#1A3A7C;border-radius:50%;animation:spin .7s linear infinite}
        @keyframes spin{to{transform:rotate(360deg)}}
        @media(max-width:600px){.summary-grid{grid-template-columns:1fr 1fr}}
      `}</style>
    </div>
  )
}