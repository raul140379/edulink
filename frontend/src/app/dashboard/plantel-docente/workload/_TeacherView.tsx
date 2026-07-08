'use client'

import { useEffect, useState } from 'react'
import { BookOpen, Clock, Layers } from 'lucide-react'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

interface Assignment {
  subjectName:   string
  campo:         string | null
  courseLabel:   string
  hoursPerWeek:  number
  educationType: string
}

interface Workload {
  totalHoursPerWeek: number
  assignments:       Assignment[]
}

const CAMPO_COLORS: Record<string, { bg: string; text: string }> = {
  VIDA_TIERRA_TERRITORIO:        { bg: '#E8F5F0', text: '#0F6E56' },
  COMUNIDAD_SOCIEDAD:            { bg: '#E0ECF8', text: '#1A3A7C' },
  COSMOS_PENSAMIENTO:            { bg: '#F3E8FF', text: '#6B21A8' },
  CIENCIA_TECNOLOGIA_PRODUCCION: { bg: '#FFF3E0', text: '#1565C0' },
}

const CAMPO_LABELS: Record<string, string> = {
  VIDA_TIERRA_TERRITORIO:        '🌿 Vida, Tierra y Territorio',
  COMUNIDAD_SOCIEDAD:            '🌐 Comunidad y Sociedad',
  COSMOS_PENSAMIENTO:            '✨ Cosmos y Pensamiento',
  CIENCIA_TECNOLOGIA_PRODUCCION: '⚙️ Ciencia, Tecnología y Producción',
}

export default function TeacherWorkloadPage() {
  const [data,    setData]    = useState<Workload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : ''

  useEffect(() => {
    fetch(`${API_URL}/api/teachers/my-workload`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => { setError('Error al cargar datos'); setLoading(false) })
  }, [])

  if (loading) return <div className="center"><div className="spinner"/></div>
  if (error)   return <div className="center"><p className="err-msg">{error}</p></div>
  if (!data)   return null

  // Agrupar por materia
  const grouped = data.assignments.reduce<Record<string, Assignment[]>>((acc, a) => {
    if (!acc[a.subjectName]) acc[a.subjectName] = []
    acc[a.subjectName].push(a)
    return acc
  }, {})

  const totalCursos   = data.assignments.length
  const totalMaterias = Object.keys(grouped).length

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Mi Carga Horaria</h1>
          <p>Resumen de materias y cursos asignados</p>
        </div>
      </div>

      {/* Resumen */}
      <div className="stats-grid">
        <div className="stat-card accent">
          <Clock size={28} color="#fff"/>
          <div>
            <div className="stat-label">Total hrs/mes</div>
            <div className="stat-value">{data.totalHoursPerWeek}</div>
          </div>
        </div>
        <div className="stat-card">
          <BookOpen size={28} color="#1A3A7C"/>
          <div>
            <div className="stat-label">Materias</div>
            <div className="stat-value">{totalMaterias}</div>
          </div>
        </div>
        <div className="stat-card">
          <Layers size={28} color="#1A3A7C"/>
          <div>
            <div className="stat-label">Cursos</div>
            <div className="stat-value">{totalCursos}</div>
          </div>
        </div>
      </div>

      {/* Sin asignaciones */}
      {totalMaterias === 0 && (
        <div className="empty-state">
          <BookOpen size={40} color="#CBE0F0"/>
          <p>No tienes materias asignadas aún.</p>
          <span>El administrador debe asignarte materias y cursos.</span>
        </div>
      )}

      {/* Detalle agrupado por materia */}
      <div className="subjects-list">
        {Object.entries(grouped).map(([subject, items]) => {
          const campo      = items[0].campo
          const col        = CAMPO_COLORS[campo || ''] || { bg: '#F5F5F5', text: '#444' }
          const totalHrs   = items.reduce((s, i) => s + i.hoursPerWeek, 0)

          return (
            <div key={subject} className="subject-card">
              {/* Header de la materia */}
              <div className="subject-header">
                <div className="subject-left">
                  <BookOpen size={16} color="#1A3A7C"/>
                  <span className="subject-name">{subject}</span>
                  {campo && (
                    <span className="campo-tag" style={{ background: col.bg, color: col.text }}>
                      {CAMPO_LABELS[campo] || campo}
                    </span>
                  )}
                </div>
                <span className="subject-hrs">{totalHrs} hrs/mes</span>
              </div>

              {/* Cursos */}
              <div className="courses-list">
                {items.map((item, i) => (
                  <div key={i} className="course-row">
                    <div className="course-label">
                      <span>{item.courseLabel}</span>
                      {item.educationType === 'BTH' && (
                        <span className="bth-badge">BTH</span>
                      )}
                    </div>
                    <span className="course-hrs">{item.hoursPerWeek} hrs/mes</span>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      <style>{`
        .center{display:flex;justify-content:center;align-items:center;padding:48px;color:#6B8BB0;flex-direction:column;gap:8px}
        .err-msg{color:#C0392B;font-size:14px}
        .page-header{margin-bottom:24px}
        .page-header h1{font-size:20px;font-weight:700;color:#1565C0;margin-bottom:4px}
        .page-header p{font-size:13px;color:#6B8BB0}
        .stats-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;margin-bottom:24px}
        .stat-card{background:#fff;border:1px solid #CBE0F0;border-radius:12px;padding:18px;display:flex;align-items:center;gap:14px}
        .stat-card.accent{background:#1565C0;border-color:#1565C0}
        .stat-card.accent .stat-label{color:rgba(255,255,255,0.7)}
        .stat-card.accent .stat-value{color:#fff}
        .stat-label{font-size:11px;color:#6B8BB0;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px}
        .stat-value{font-size:28px;font-weight:800;color:#1A3A7C}
        .empty-state{text-align:center;padding:48px;color:#6B8BB0;display:flex;flex-direction:column;align-items:center;gap:8px;background:#fff;border:1px dashed #CBE0F0;border-radius:12px}
        .empty-state p{font-size:15px;font-weight:500;color:#1A3A7C}
        .empty-state span{font-size:13px}
        .subjects-list{display:flex;flex-direction:column;gap:14px}
        .subject-card{background:#fff;border:1px solid #CBE0F0;border-radius:12px;overflow:hidden}
        .subject-header{display:flex;align-items:center;justify-content:space-between;padding:14px 18px;background:#F8FBFF;border-bottom:1px solid #CBE0F0;gap:12px;flex-wrap:wrap}
        .subject-left{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
        .subject-name{font-size:15px;font-weight:700;color:#1A3A7C}
        .campo-tag{padding:3px 10px;border-radius:20px;font-size:11px;font-weight:500;white-space:nowrap}
        .subject-hrs{font-size:13px;font-weight:700;color:#1565C0;white-space:nowrap;background:#E3F2FD;padding:4px 12px;border-radius:20px;border:1px solid #F5C518}
        .courses-list{display:flex;flex-direction:column}
        .course-row{display:flex;align-items:center;justify-content:space-between;padding:11px 18px;border-top:1px solid #F0F6FC}
        .course-row:hover{background:#FAFCFF}
        .course-label{display:flex;align-items:center;gap:8px;font-size:13px;color:#1A3A7C;font-weight:500}
        .bth-badge{background:#FFFBEA;color:#BA7517;border:1px solid #F5C518;padding:2px 8px;border-radius:20px;font-size:11px;font-weight:500}
        .course-hrs{font-size:12px;font-weight:600;color:#6B8BB0;background:#F0F6FC;padding:3px 10px;border-radius:20px}
        .spinner{width:24px;height:24px;border:2px solid rgba(99,56,6,.2);border-top-color:#1565C0;border-radius:50%;animation:spin .7s linear infinite}
        @keyframes spin{to{transform:rotate(360deg)}}
        @media(max-width:600px){.stats-grid{grid-template-columns:1fr 1fr}}
      `}</style>
    </div>
  )
}