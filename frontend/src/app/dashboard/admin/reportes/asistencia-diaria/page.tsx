'use client'

import { useEffect, useState } from 'react'
import { ClipboardCheck, CheckCircle2, XCircle, Download, Eye } from 'lucide-react'
import Card from '@/components/ui/Card'
import Table, { Column } from '@/components/ui/Table'
import PageHeader from '@/components/ui/PageHeader'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import Input from '@/components/ui/Input'
import LoadingState from '@/components/ui/LoadingState'
import { useToast } from '@/components/ui/ToastProvider'
import { useDistrictConfig } from '@/hooks/useDistrictConfig'
import { exportAttendancePdf } from '@/lib/attendancePdf'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

const GRADE_LABELS: Record<string, string> = { PRIMERO: '1°', SEGUNDO: '2°', TERCERO: '3°', CUARTO: '4°', QUINTO: '5°', SEXTO: '6°' }
const STATUS_LABELS: Record<string, string> = { PRESENTE: 'Presente', AUSENTE: 'Ausente', RETRASO: 'Retraso', LICENCIA: 'Licencia' }

interface CourseRow {
  course: { id: number; grade: string; parallel: string; level: string; shift: string }
  registrado: boolean
  totalEstudiantes: number
  presentes: number
  ausentes: number
  retrasos: number
  licencias: number
}

interface DetailStudent { studentId: number; firstName: string; lastName: string; gender: string; status: string | null }

interface Detail {
  date: string
  course: CourseRow['course']
  teacherName: string | null
  registrado: boolean
  students: DetailStudent[]
}

const courseLabel = (c: CourseRow['course']) => `${GRADE_LABELS[c.grade] || c.grade} "${c.parallel}"`
const todayStr = () => new Date().toISOString().split('T')[0]

export default function AsistenciaDiariaPage() {
  const toast = useToast()
  const district = useDistrictConfig()

  const [date, setDate] = useState(todayStr())
  const [courses, setCourses] = useState<CourseRow[]>([])
  const [loading, setLoading] = useState(true)

  const [selected, setSelected] = useState<CourseRow | null>(null)
  const [detail, setDetail] = useState<Detail | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : ''

  const fetchCompliance = async (d: string) => {
    setLoading(true)
    try {
      const res = await fetch(`${API_URL}/api/reports/attendance-daily?date=${d}`, { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      if (!res.ok) { toast(data.message || 'Error al cargar', 'error'); return }
      setCourses(data.courses)
    } catch { toast('Error de conexión', 'error') }
    finally { setLoading(false) }
  }

  useEffect(() => {
    fetchCompliance(date)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date])

  const openDetail = async (row: CourseRow) => {
    setSelected(row)
    setDetail(null)
    setLoadingDetail(true)
    try {
      const res = await fetch(`${API_URL}/api/reports/attendance-daily/${row.course.id}?date=${date}`, { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      if (!res.ok) { toast(data.message || 'Error al cargar el detalle', 'error'); return }
      setDetail(data)
    } catch { toast('Error de conexión', 'error') }
    finally { setLoadingDetail(false) }
  }

  const handleExport = async () => {
    if (!detail) return
    await exportAttendancePdf({
      districtName: district.name || 'U.E. Naciones Unidas',
      districtLocation: district.location,
      courseLabel: courseLabel(detail.course),
      date: detail.date,
      teacherName: detail.teacherName,
      students: detail.students,
    })
  }

  const columns: Column<CourseRow>[] = [
    { key: 'course', header: 'Curso', render: r => <span className="font-semibold text-brand-700">{courseLabel(r.course)}</span> },
    {
      key: 'registrado', header: 'Cumplimiento',
      render: r => r.registrado
        ? <Badge tone="success"><CheckCircle2 size={12} className="inline mr-1" />Registrado</Badge>
        : <Badge tone="danger"><XCircle size={12} className="inline mr-1" />Sin registrar</Badge>,
    },
    { key: 'total', header: 'Estudiantes', render: r => r.registrado ? r.totalEstudiantes : '—' },
    { key: 'presentes', header: 'Presentes', render: r => r.registrado ? r.presentes : '—' },
    { key: 'ausentes', header: 'Ausentes', render: r => r.registrado ? r.ausentes : '—' },
    {
      key: 'actions', header: '', className: 'text-right',
      render: r => (
        <Button variant="ghost" size="sm" onClick={() => openDetail(r)}>
          <Eye size={14} /> Ver detalle
        </Button>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        icon={ClipboardCheck}
        title="Asistencia Diaria por Curso"
        description="Qué cursos registraron asistencia en el día elegido, y el detalle por estudiante"
      />

      <Card className="mb-4">
        <div className="flex items-center gap-3">
          <div className="w-52">
            <Input type="date" label="Fecha" value={date} max={todayStr()} onChange={e => setDate(e.target.value)} />
          </div>
        </div>
      </Card>

      <Card>
        {loading ? <LoadingState /> : (
          <Table columns={columns} rows={courses} rowKey={r => r.course.id} emptyLabel="No hay cursos" />
        )}
      </Card>

      <Modal
        open={!!selected}
        onClose={() => { setSelected(null); setDetail(null) }}
        title={selected ? courseLabel(selected.course) : ''}
        maxWidth={560}
        footer={
          <>
            <Button variant="secondary" onClick={() => { setSelected(null); setDetail(null) }}>Cerrar</Button>
            <Button onClick={handleExport} disabled={!detail}><Download size={14} /> Exportar PDF</Button>
          </>
        }
      >
        {loadingDetail || !detail ? <LoadingState /> : (
          <div className="flex flex-col gap-3">
            <p className="text-[13px] text-neutral-500">
              Maestro responsable: <span className="font-semibold text-brand-700">{detail.teacherName || 'Sin registrar'}</span>
            </p>
            {!detail.registrado && (
              <p className="text-[13px] bg-danger-100 text-danger-600 rounded-lg px-3 py-2.5">
                No se registró asistencia para este curso en la fecha elegida.
              </p>
            )}
            <div className="flex flex-col gap-1.5 max-h-96 overflow-y-auto">
              {detail.students.map(s => (
                <div key={s.studentId} className="flex items-center justify-between px-3 py-2 rounded-lg bg-neutral-100/60 text-[13px]">
                  <span className="font-medium text-brand-700">{s.lastName} {s.firstName}</span>
                  {s.status ? (
                    <Badge tone={s.status === 'PRESENTE' ? 'success' : s.status === 'AUSENTE' ? 'danger' : s.status === 'RETRASO' ? 'warning' : 'brand'}>
                      {STATUS_LABELS[s.status] || s.status}
                    </Badge>
                  ) : (
                    <Badge tone="neutral">Sin registrar</Badge>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
