'use client'

import { useEffect, useState } from 'react'
import { Clock, Eye, CheckCircle2, XCircle } from 'lucide-react'
import Card from '@/components/ui/Card'
import Table, { Column } from '@/components/ui/Table'
import PageHeader from '@/components/ui/PageHeader'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import Input from '@/components/ui/Input'
import LoadingState from '@/components/ui/LoadingState'
import { useToast } from '@/components/ui/ToastProvider'
import API_URL from '@/lib/api'
import { todayLocalStr } from '@/lib/localDate'

const GRADE_LABELS: Record<string, string> = { PRIMERO: '1°', SEGUNDO: '2°', TERCERO: '3°', CUARTO: '4°', QUINTO: '5°', SEXTO: '6°' }

interface Record_ {
  id: number; studentId: number; firstName: string; lastName: string
  arrivalTime: string; minutesLate: number; enteredClass: boolean; notified: boolean
}
interface CourseGroup {
  course: { id: number; grade: string; parallel: string; level: string }
  total: number; entraronClase: number; noEntraronClase: number; promedioMinutos: number
  records: Record_[]
}

const courseLabel = (c: CourseGroup['course']) => `${GRADE_LABELS[c.grade] || c.grade} "${c.parallel}"`

export default function TardanzasDiarioPage() {
  const toast = useToast()
  const [date, setDate] = useState(todayLocalStr())
  const [courses, setCourses] = useState<CourseGroup[]>([])
  const [totalDia, setTotalDia] = useState(0)
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<CourseGroup | null>(null)

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : ''

  const fetchReport = async (d: string) => {
    setLoading(true)
    try {
      const res = await fetch(`${API_URL}/api/reports/late-arrivals-daily?date=${d}`, { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      if (!res.ok) { toast(data.message || 'Error al cargar', 'error'); return }
      setCourses(data.courses)
      setTotalDia(data.totalDia)
    } catch { toast('Error de conexión', 'error') }
    finally { setLoading(false) }
  }

  useEffect(() => {
    fetchReport(date)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date])

  const columns: Column<CourseGroup>[] = [
    { key: 'course', header: 'Curso', render: r => <span className="font-semibold text-brand-700">{courseLabel(r.course)}</span> },
    { key: 'total', header: 'Llegadas tarde', render: r => r.total },
    { key: 'entraron', header: 'Entraron a clase', render: r => <span className="text-success-700 font-semibold">{r.entraronClase}</span> },
    { key: 'noEntraron', header: 'No entraron', render: r => <span className="text-danger-600 font-semibold">{r.noEntraronClase}</span> },
    { key: 'promedio', header: 'Prom. minutos', render: r => `${r.promedioMinutos} min` },
    {
      key: 'actions', header: '', className: 'text-right',
      render: r => (
        <Button variant="ghost" size="sm" onClick={() => setSelected(r)}>
          <Eye size={14} /> Ver detalle
        </Button>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        icon={Clock}
        title="Llegadas Tarde — Reporte Diario"
        description="Estudiantes que llegaron tarde en el día elegido, por curso"
      />

      <Card className="mb-4">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="w-52">
            <Input type="date" label="Fecha" value={date} max={todayLocalStr()} onChange={e => setDate(e.target.value)} />
          </div>
          <div className="text-[13px] text-neutral-500">
            Total del día: <span className="font-semibold text-brand-700">{totalDia}</span> llegada{totalDia !== 1 ? 's' : ''} tarde
          </div>
        </div>
      </Card>

      <Card>
        {loading ? <LoadingState /> : (
          <Table columns={columns} rows={courses} rowKey={r => r.course.id} emptyLabel="Sin llegadas tarde registradas ese día" />
        )}
      </Card>

      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected ? courseLabel(selected.course) : ''}
        maxWidth={560}
        footer={<Button variant="secondary" onClick={() => setSelected(null)}>Cerrar</Button>}
      >
        {selected && (
          <div className="flex flex-col gap-1.5 max-h-96 overflow-y-auto">
            {selected.records.map(r => (
              <div key={r.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-neutral-100/60 text-[13px]">
                <div>
                  <span className="font-medium text-brand-700">{r.lastName} {r.firstName}</span>
                  <div className="text-[11px] text-neutral-500">{r.arrivalTime} · {r.minutesLate} min de atraso</div>
                </div>
                <div className="flex items-center gap-1.5">
                  {r.enteredClass
                    ? <Badge tone="success"><CheckCircle2 size={11} className="inline mr-1" />Entró a clase</Badge>
                    : <Badge tone="danger"><XCircle size={11} className="inline mr-1" />No entró</Badge>}
                  {r.notified && <Badge tone="brand">Notificado</Badge>}
                </div>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </div>
  )
}
