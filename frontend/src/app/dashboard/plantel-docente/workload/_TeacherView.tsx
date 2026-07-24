'use client'

import { useEffect, useState } from 'react'
import { BookOpen, Clock, Layers } from 'lucide-react'
import Card from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'

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

const CAMPO_TONE: Record<string, 'success' | 'brand' | 'info' | 'warning'> = {
  VIDA_TIERRA_TERRITORIO:        'success',
  COMUNIDAD_SOCIEDAD:            'brand',
  COSMOS_PENSAMIENTO:            'info',
  CIENCIA_TECNOLOGIA_PRODUCCION: 'warning',
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

  useEffect(() => {
    const token = localStorage.getItem('token')
    fetch(`${API_URL}/api/teachers/my-workload`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => { setError('Error al cargar datos'); setLoading(false) })
  }, [])

  if (loading) return <div className="flex justify-center py-16"><p className="text-sm text-neutral-500">Cargando...</p></div>
  if (error)   return <div className="flex justify-center py-16"><p className="text-sm text-danger-600">{error}</p></div>
  if (!data)   return null

  const grouped = data.assignments.reduce<Record<string, Assignment[]>>((acc, a) => {
    if (!acc[a.subjectName]) acc[a.subjectName] = []
    acc[a.subjectName].push(a)
    return acc
  }, {})

  const totalCursos   = data.assignments.length
  const totalMaterias = Object.keys(grouped).length

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-brand-700 mb-1">Mi Carga Horaria</h1>
        <p className="text-[13px] text-neutral-500">Resumen de materias y cursos asignados</p>
      </div>

      <div className="grid gap-3 mb-6" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
        <Card className="!bg-brand-700 !border-brand-700 flex items-center gap-3.5">
          <Clock size={28} className="text-white"/>
          <div><div className="text-[11px] text-white/70 uppercase tracking-wide mb-1">Total hrs/mes</div><div className="text-[28px] font-extrabold text-white">{data.totalHoursPerWeek}</div></div>
        </Card>
        <Card className="flex items-center gap-3.5">
          <BookOpen size={28} className="text-brand-700"/>
          <div><div className="text-[11px] text-neutral-500 uppercase tracking-wide mb-1">Materias</div><div className="text-[28px] font-extrabold text-brand-700">{totalMaterias}</div></div>
        </Card>
        <Card className="flex items-center gap-3.5">
          <Layers size={28} className="text-brand-700"/>
          <div><div className="text-[11px] text-neutral-500 uppercase tracking-wide mb-1">Cursos</div><div className="text-[28px] font-extrabold text-brand-700">{totalCursos}</div></div>
        </Card>
      </div>

      {totalMaterias === 0 && (
        <Card className="text-center py-12 border-dashed flex flex-col items-center gap-2">
          <BookOpen size={40} className="text-neutral-300"/>
          <p className="text-[15px] font-medium text-brand-700">No tienes materias asignadas aún.</p>
          <span className="text-[13px] text-neutral-500">El administrador debe asignarte materias y cursos.</span>
        </Card>
      )}

      <div className="flex flex-col gap-3.5">
        {Object.entries(grouped).map(([subject, items]) => {
          const campo    = items[0].campo
          const totalHrs = items.reduce((s, i) => s + i.hoursPerWeek, 0)

          return (
            <Card key={subject} padded={false} className="overflow-hidden">
              <div className="flex items-center justify-between gap-3 px-4.5 py-3.5 bg-neutral-100/60 border-b border-neutral-300/60 flex-wrap">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <BookOpen size={16} className="text-brand-700"/>
                  <span className="text-[15px] font-bold text-brand-700">{subject}</span>
                  {campo && <Badge tone={CAMPO_TONE[campo] || 'neutral'}>{CAMPO_LABELS[campo] || campo}</Badge>}
                </div>
                <Badge tone="info">{totalHrs} hrs/mes</Badge>
              </div>

              <div className="flex flex-col">
                {items.map((item, i) => (
                  <div key={i} className="flex items-center justify-between px-4.5 py-2.5 border-t border-neutral-100 hover:bg-neutral-100/40">
                    <div className="flex items-center gap-2 text-[13px] text-brand-700 font-medium">
                      <span>{item.courseLabel}</span>
                      {item.educationType === 'BTH' && <Badge tone="warning">BTH</Badge>}
                    </div>
                    <span className="text-xs font-semibold text-neutral-500 bg-neutral-100 px-2.5 py-0.5 rounded-full">{item.hoursPerWeek} hrs/mes</span>
                  </div>
                ))}
              </div>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
