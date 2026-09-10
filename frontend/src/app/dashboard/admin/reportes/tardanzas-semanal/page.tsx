'use client'

import { useEffect, useState } from 'react'
import { CalendarClock, ChevronLeft, ChevronRight } from 'lucide-react'
import Card from '@/components/ui/Card'
import Table, { Column } from '@/components/ui/Table'
import PageHeader from '@/components/ui/PageHeader'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import { Select } from '@/components/ui/Input'
import LoadingState from '@/components/ui/LoadingState'
import { useToast } from '@/components/ui/ToastProvider'
import API_URL from '@/lib/api'
import { todayLocalStr, addDaysLocalStr } from '@/lib/localDate'

const GRADE_LABELS: Record<string, string> = { PRIMERO: '1°', SEGUNDO: '2°', TERCERO: '3°', CUARTO: '4°', QUINTO: '5°', SEXTO: '6°' }
const STATUS_LABELS: Record<string, string> = { PRESENTE: 'Presente', AUSENTE: 'Ausente', RETRASO: 'Retraso', LICENCIA: 'Licencia' }

interface CourseOption { id: number; grade: string; parallel: string; level: string; shift: string }
const courseLabel = (c: CourseOption) => `${GRADE_LABELS[c.grade] || c.grade} "${c.parallel}"`

function formatShortDate(iso: string): string {
  const [, m, d] = iso.split('-')
  return `${d}/${m}`
}

interface Row {
  id: number; studentId: number; firstName: string; lastName: string
  date: string; arrivalTime: string; minutesLate: number; enteredClass: boolean
  notified: boolean; realAttendanceStatus: string | null
}

export default function TardanzasSemanalPage() {
  const toast = useToast()
  const [courses, setCourses] = useState<CourseOption[]>([])
  const [courseId, setCourseId] = useState<number | null>(null)
  const [anchorDate, setAnchorDate] = useState(todayLocalStr())
  const [weekStart, setWeekStart] = useState<string | null>(null)
  const [weekEnd, setWeekEnd] = useState<string | null>(null)
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingCourses, setLoadingCourses] = useState(true)

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : ''

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_URL}/api/courses`, { headers: { Authorization: `Bearer ${token}` } })
        const list: CourseOption[] = await res.json()
        setCourses(list)
        if (list.length > 0) setCourseId(list[0].id)
      } catch { toast('Error al cargar los cursos', 'error') }
      finally { setLoadingCourses(false) }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    })()
  }, [])

  useEffect(() => {
    if (!courseId) return
    setLoading(true)
    ;(async () => {
      try {
        const res = await fetch(`${API_URL}/api/reports/late-arrivals-weekly/${courseId}?date=${anchorDate}`, { headers: { Authorization: `Bearer ${token}` } })
        const data = await res.json()
        if (!res.ok) { toast(data.message || 'Error al cargar la matriz', 'error'); return }
        setRows(data.rows)
        setWeekStart(data.weekStart)
        setWeekEnd(data.weekEnd)
      } catch { toast('Error de conexión', 'error') }
      finally { setLoading(false) }
    })()
  }, [courseId, anchorDate])

  const selectedCourse = courses.find((c) => c.id === courseId) || null

  const columns: Column<Row>[] = [
    { key: 'student', header: 'Estudiante', render: r => <span className="font-semibold text-brand-700">{r.lastName} {r.firstName}</span> },
    { key: 'date', header: 'Día', render: r => formatShortDate(r.date) },
    { key: 'arrival', header: 'Hora llegada', render: r => r.arrivalTime },
    { key: 'minutes', header: 'Atraso', render: r => `${r.minutesLate} min` },
    { key: 'entered', header: 'Entró a clase', render: r => r.enteredClass ? <Badge tone="success">Sí</Badge> : <Badge tone="danger">No</Badge> },
    {
      key: 'realStatus', header: 'Asistencia real ese día',
      render: r => r.realAttendanceStatus
        ? <Badge tone={r.realAttendanceStatus === 'PRESENTE' ? 'success' : r.realAttendanceStatus === 'AUSENTE' ? 'danger' : r.realAttendanceStatus === 'RETRASO' ? 'warning' : 'brand'}>
            {STATUS_LABELS[r.realAttendanceStatus] || r.realAttendanceStatus}
          </Badge>
        : <Badge tone="neutral">Sin registrar</Badge>,
    },
    { key: 'notified', header: 'Notificado', render: r => r.notified ? <Badge tone="brand">Sí</Badge> : <Badge tone="neutral">No</Badge> },
  ]

  return (
    <div>
      <PageHeader
        icon={CalendarClock}
        title="Llegadas Tarde — Reporte Semanal"
        description="Llegadas tarde de la semana, cruzadas con la asistencia real de esos días — para un solo curso"
      />

      <Card className="mb-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-64">
            <Select label="Curso" value={courseId ?? ''} onChange={(e) => setCourseId(Number(e.target.value))} disabled={loadingCourses}>
              {courses.map((c) => <option key={c.id} value={c.id}>{courseLabel(c)}</option>)}
            </Select>
          </div>
          <div className="flex items-center gap-1.5">
            <Button variant="ghost" size="sm" onClick={() => setAnchorDate((d) => addDaysLocalStr(d, -7))}>
              <ChevronLeft size={16} />
            </Button>
            <span className="text-[13px] font-semibold text-brand-700 min-w-[150px] text-center">
              {weekStart && weekEnd ? `${formatShortDate(weekStart)} al ${formatShortDate(weekEnd)}` : '—'}
            </span>
            <Button variant="ghost" size="sm" onClick={() => setAnchorDate((d) => addDaysLocalStr(d, 7))}>
              <ChevronRight size={16} />
            </Button>
          </div>
        </div>
      </Card>

      <Card>
        {loading || loadingCourses ? <LoadingState /> : (
          <Table columns={columns} rows={rows} rowKey={r => r.id} emptyLabel="Sin llegadas tarde esta semana para este curso" />
        )}
      </Card>
    </div>
  )
}
