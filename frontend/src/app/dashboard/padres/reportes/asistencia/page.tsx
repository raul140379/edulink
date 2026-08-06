'use client'

import { useEffect, useState } from 'react'
import { ClipboardCheck } from 'lucide-react'
import Card from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import Table, { Column } from '@/components/ui/Table'
import { useToast } from '@/components/ui/ToastProvider'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

const GRADE_LABELS: Record<string, string> = { PRIMERO: '1°', SEGUNDO: '2°', TERCERO: '3°', CUARTO: '4°', QUINTO: '5°', SEXTO: '6°' }
const LEVEL_LABELS: Record<string, string> = { INICIAL: 'Inicial', PRIMARIA: 'Primaria', SECUNDARIA: 'Secundaria' }
const SHIFT_LABELS: Record<string, string> = { MORNING: 'Mañana', AFTERNOON: 'Tarde', NIGHT: 'Noche' }

interface CourseAttendance {
  course: { id: number; level: string; grade: string; parallel: string; shift: string }
  totalMeetings: number; totalPresent: number; totalAttendances: number; presentRate: number
}

// Reporte de asistencia a reuniones de curso de la gestión activa — por
// curso: reuniones realizadas y % de presentes acumulado (ver reportRepository.findMeetingsInDateRange).
export default function ReportesAsistenciaPage() {
  const toast = useToast()
  const [data, setData]       = useState<CourseAttendance[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('token')
    fetch(`${API_URL}/api/reports/attendance`, { headers: { Authorization: `Bearer ${token}` } })
      .then(async r => {
        const body = await r.json()
        if (!r.ok) { toast(body.message, 'error'); return }
        setData(body)
      })
      .catch(() => toast('Error de conexión', 'error'))
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const columns: Column<CourseAttendance>[] = [
    { key: 'curso', header: 'Curso', render: d => (
      <span className="font-medium text-brand-700">{LEVEL_LABELS[d.course.level] || d.course.level} — {GRADE_LABELS[d.course.grade] || d.course.grade} &quot;{d.course.parallel}&quot;</span>
    ) },
    { key: 'turno', header: 'Turno', render: d => <Badge tone="neutral">{SHIFT_LABELS[d.course.shift] || d.course.shift}</Badge> },
    { key: 'reuniones', header: 'Reuniones', render: d => <span className="text-[12.5px] text-neutral-500">{d.totalMeetings}</span> },
    { key: 'presentes', header: 'Presentes', render: d => <span className="text-[12.5px] text-success-700 font-medium">{d.totalPresent} / {d.totalAttendances}</span> },
    { key: 'tasa', header: '% Asistencia', render: d => (
      <Badge tone={d.presentRate >= 80 ? 'success' : d.presentRate >= 50 ? 'warning' : 'danger'}>{d.presentRate}%</Badge>
    ) },
  ]

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-brand-700 mb-1">Reportes de Asistencia</h1>
        <p className="text-[13px] text-neutral-500">Asistencia a reuniones de curso — gestión activa</p>
      </div>

      <Card padded={false} className="overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16"><p className="text-sm text-neutral-500">Cargando...</p></div>
        ) : data.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-neutral-500">
            <ClipboardCheck size={40} className="text-neutral-300"/>
            <p className="text-[13px]">Todavía no hay reuniones registradas esta gestión</p>
          </div>
        ) : (
          <div className="p-4">
            <Table columns={columns} rows={data} rowKey={d => d.course.id} />
          </div>
        )}
      </Card>
    </div>
  )
}
