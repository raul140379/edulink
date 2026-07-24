'use client'

import { useEffect, useState } from 'react'
import { BookOpen, Clock, CheckCircle, AlertCircle } from 'lucide-react'
import Card from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import Table, { Column } from '@/components/ui/Table'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

interface PlanItem {
  gradeConfigId: number
  subjectId:     number
  subject:       { id: number; name: string; code?: string; campo?: string }
  hoursPerWeek:  number
  teacher:       { id: number; firstName: string; lastName: string } | null
  assignmentId:  number | null
}

interface CoursePlan {
  course:        { id: number; grade: string; parallel: string; level: string }
  totalHours:    number
  totalSubjects: number
  assignedCount: number
  pendingCount:  number
  grouped:       Record<string, PlanItem[]>
  campoOrder:    string[]
}

const GRADES: Record<string, string> = {
  PRIMERO: '1°', SEGUNDO: '2°', TERCERO: '3°',
  CUARTO: '4°', QUINTO: '5°', SEXTO: '6°',
}
const LEVELS: Record<string, string> = {
  INICIAL: 'Inicial', PRIMARIA: 'Primaria', SECUNDARIA: 'Secundaria',
}
const CAMPO_LABELS: Record<string, string> = {
  VIDA_TIERRA_TERRITORIO:        '🌿 Vida, Tierra y Territorio',
  COMUNIDAD_SOCIEDAD:            '🌐 Comunidad y Sociedad',
  COSMOS_PENSAMIENTO:            '✨ Cosmos y Pensamiento',
  CIENCIA_TECNOLOGIA_PRODUCCION: '⚙️ Ciencia, Tecnología y Producción',
  SIN_CAMPO:                     '📌 Sin campo asignado',
}
const CAMPO_TONE: Record<string, 'success' | 'brand' | 'info' | 'warning' | 'neutral'> = {
  VIDA_TIERRA_TERRITORIO:        'success',
  COMUNIDAD_SOCIEDAD:            'brand',
  COSMOS_PENSAMIENTO:            'info',
  CIENCIA_TECNOLOGIA_PRODUCCION: 'warning',
  SIN_CAMPO:                     'neutral',
}

export default function TeacherTutorWorkloadPage() {
  const [plan,    setPlan]    = useState<CoursePlan | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')

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

        const pRes  = await fetch(`${API_URL}/api/subjects/plan/${cData.id}`, {
          headers: { Authorization: `Bearer ${token}` }
        })
        const pData = await pRes.json()
        if (!pRes.ok) { setError(pData.message || 'Error al cargar el plan'); return }
        setPlan(pData)
      } catch { setError('Error de conexión') }
      finally  { setLoading(false) }
    }
    init()
  }, [])

  if (loading) return <div className="flex justify-center py-16"><p className="text-sm text-neutral-500">Cargando...</p></div>
  if (error)   return <div className="flex justify-center py-16"><p className="text-sm text-danger-600">{error}</p></div>
  if (!plan)   return null

  const camposOrden = [...plan.campoOrder, 'SIN_CAMPO'].filter(c => plan.grouped[c]?.length > 0)

  const buildColumns = (items: PlanItem[]): Column<PlanItem>[] => [
    { key: 'num', header: '#', render: (item) => <span className="text-xs text-neutral-500">{items.indexOf(item) + 1}</span> },
    { key: 'materia', header: 'Materia', render: item => <span className="font-medium text-brand-700">{item.subject.name}</span> },
    { key: 'hrs', header: 'Hrs/Mes', className: 'text-center', render: item => <Badge tone="brand">{item.hoursPerWeek}</Badge> },
    {
      key: 'maestro', header: 'Maestro asignado', render: item => item.teacher ? (
        <span className="flex items-center gap-1.5 text-brand-700 font-medium">
          <CheckCircle size={13} className="text-success-700"/> {item.teacher.lastName} {item.teacher.firstName}
        </span>
      ) : (
        <span className="flex items-center gap-1.5 text-[#BA7517] text-xs italic">
          <AlertCircle size={13}/> Sin maestro asignado
        </span>
      )
    },
    { key: 'horario', header: 'Horario', className: 'text-center', render: () => <Badge tone="warning">🗓 Próximamente</Badge> },
  ]

  return (
    <div>
      <div className="flex items-start justify-between gap-4 mb-5 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-brand-700 mb-1">Plan de Estudios del Curso</h1>
          <p className="text-[13px] text-neutral-500">
            {LEVELS[plan.course.level]} — {GRADES[plan.course.grade]} &quot;{plan.course.parallel}&quot; · Vista de materias y maestros
          </p>
        </div>
        <Badge tone="warning">🗓 Horario próximamente</Badge>
      </div>

      <div className="grid gap-3 mb-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))' }}>
        <Card className="flex items-center gap-3">
          <div className="p-2.5 rounded-[10px] bg-brand-100 text-brand-700"><BookOpen size={20}/></div>
          <div><div className="text-xl font-bold text-brand-700">{plan.totalSubjects}</div><div className="text-[11px] text-neutral-500">Total materias</div></div>
        </Card>
        <Card className="flex items-center gap-3">
          <div className="p-2.5 rounded-[10px] bg-success-100 text-success-700"><CheckCircle size={20}/></div>
          <div><div className="text-xl font-bold text-success-700">{plan.assignedCount}</div><div className="text-[11px] text-neutral-500">Con maestro</div></div>
        </Card>
        <Card className="flex items-center gap-3">
          <div className="p-2.5 rounded-[10px] bg-danger-100 text-danger-600"><AlertCircle size={20}/></div>
          <div><div className={`text-xl font-bold ${plan.pendingCount > 0 ? 'text-danger-600' : 'text-success-700'}`}>{plan.pendingCount}</div><div className="text-[11px] text-neutral-500">Sin maestro</div></div>
        </Card>
        <Card className="flex items-center gap-3">
          <div className="p-2.5 rounded-[10px] bg-brand-100 text-brand-700"><Clock size={20}/></div>
          <div><div className="text-xl font-bold text-brand-700">{plan.totalHours}</div><div className="text-[11px] text-neutral-500">Hrs / mes</div></div>
        </Card>
      </div>

      {plan.pendingCount === 0 ? (
        <div className="flex items-center gap-2 px-3.5 py-2.5 bg-success-100 border border-success-500/40 rounded-lg text-[13px] text-success-700 mb-4"><CheckCircle size={14}/> Todas las materias tienen maestro asignado ✓</div>
      ) : (
        <div className="flex items-center gap-2 px-3.5 py-2.5 bg-warning-100 border border-warning-500 rounded-lg text-[13px] text-[#7A6000] mb-4"><AlertCircle size={14}/> {plan.pendingCount} {plan.pendingCount === 1 ? 'materia sin' : 'materias sin'} maestro asignado</div>
      )}

      {camposOrden.map(campo => {
        const items = plan.grouped[campo] || []
        const hrs   = items.reduce((s, i) => s + i.hoursPerWeek, 0)

        return (
          <Card key={campo} padded={false} className="overflow-hidden mb-4">
            <div className="flex items-center gap-2.5 px-4 py-2.5 border-b border-neutral-100 flex-wrap">
              <Badge tone={CAMPO_TONE[campo] || 'neutral'}>{CAMPO_LABELS[campo] || campo}</Badge>
              <div className="ml-auto flex gap-3 items-center">
                <span className="text-xs text-neutral-500 font-medium">{hrs} hrs/mes</span>
                <span className="text-xs text-neutral-500 font-medium">{items.length} {items.length === 1 ? 'materia' : 'materias'}</span>
              </div>
            </div>
            <div className="p-4">
              <Table columns={buildColumns(items)} rows={items} rowKey={item => item.subjectId} />
            </div>
          </Card>
        )
      })}
    </div>
  )
}
