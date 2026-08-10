'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ArrowRightLeft, RefreshCw } from 'lucide-react'
import Card from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import Table, { Column } from '@/components/ui/Table'
import PageHeader from '@/components/ui/PageHeader'
import Toolbar from '@/components/ui/Toolbar'
import StatCard from '@/components/ui/StatCard'
import LoadingState from '@/components/ui/LoadingState'
import EmptyState from '@/components/ui/EmptyState'
import { useToast } from '@/components/ui/ToastProvider'
import { useModuleFilters } from '@/hooks/useModuleFilters'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

const ESTADO_LABELS: Record<string, string> = { PAGADO: 'Pagado', PARCIAL: 'Parcial', PENDIENTE: 'Pendiente' }
const ESTADO_TONES: Record<string, 'success' | 'warning' | 'danger'> = { PAGADO: 'success', PARCIAL: 'warning', PENDIENTE: 'danger' }
const GRADE_LABELS: Record<string, string> = { PRIMERO: '1°', SEGUNDO: '2°', TERCERO: '3°', CUARTO: '4°', QUINTO: '5°', SEXTO: '6°' }
const SHIFT_LABELS: Record<string, string> = { MORNING: 'Mañana', AFTERNOON: 'Tarde', NIGHT: 'Noche' }

const fmt = (n: number) => `Bs. ${n.toFixed(2)}`
const courseLabel = (c: { grade: string; parallel: string; shift: string }) =>
  `${GRADE_LABELS[c.grade] || c.grade} "${c.parallel}" · ${SHIFT_LABELS[c.shift] || c.shift}`

interface AcademicYearClosure { id: number; year: number; isActive: boolean; economicClosedAt: string | null }

interface Row {
  chargeId: number; title: string; type: string; amount: number; paidAmount: number
  tutor: { id: number; firstName: string; lastName: string; ci: string | null; kardex: string | null }
  student: { firstName: string; lastName: string } | null
  destino: { chargeId: number; academicYearId: number; year: number; amount: number; paidAmount: number; status: string } | null
  // Presente solo si este tutor tiene otro(s) hijo(s) con este mismo cargo
  // trasladado, matriculado(s) en curso(s) distinto(s) — el caso se repite
  // bajo cada curso, esta lista apunta a los OTROS cursos donde también aparece.
  sharedWith?: { grade: string; parallel: string; shift: string }[]
}

interface CourseGroup {
  course: { id: number; level: string; grade: string; parallel: string; shift: string } | null
  rows: Row[]
}

interface Report {
  sourceAcademicYear: { id: number; year: number }
  totalCasos: number; totalTrasladado: number; totalYaResuelto: number; totalAunPendiente: number
  courses: CourseGroup[]
}

// Auditoría de deuda trasladada — el Charge original de una gestión cerrada
// queda ANULADO al trasladarse (ver academicClosure.repository.ts), así que
// las pantallas de deuda "activa" (Deudas, Por curso) ya no lo muestran. Esta
// vista existe específicamente para consultar ese historial: qué no se pagó
// en la gestión de origen y a qué cargo de la gestión siguiente se movió.
export default function TrasladosPage() {
  const router = useRouter()
  const toast  = useToast()
  const { filters, update } = useModuleFilters('tesoreria', { academicYearId: '', courseId: '', search: '' })

  const [closedYears, setClosedYears] = useState<AcademicYearClosure[]>([])
  const [report, setReport] = useState<Report | null>(null)
  const [loading, setLoading] = useState(true)

  const token = () => (typeof window !== 'undefined' ? localStorage.getItem('token') : '') || ''
  const auth  = () => ({ Authorization: `Bearer ${token()}` })

  const fetchClosedYears = async () => {
    try {
      const res  = await fetch(`${API_URL}/api/treasury/academic-years`, { headers: auth() })
      const data = await res.json()
      if (res.ok) setClosedYears(data.filter((y: AcademicYearClosure) => y.economicClosedAt))
    } catch { toast('Error de conexión', 'error') }
  }

  const fetchReport = () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (filters.academicYearId) params.set('academicYearId', filters.academicYearId)
    fetch(`${API_URL}/api/reports/carried-debt?${params}`, { headers: auth() })
      .then(async r => {
        const data = await r.json()
        if (!r.ok) { toast(data.message, 'error'); setReport(null); return }
        setReport(data)
        if (!filters.academicYearId) update({ academicYearId: String(data.sourceAcademicYear.id) })
      })
      .catch(() => toast('Error de conexión', 'error'))
      .finally(() => setLoading(false))
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchClosedYears() }, [])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchReport() }, [filters.academicYearId])

  const columns: Column<Row>[] = [
    { key: 'tutor', header: 'Tutor', render: r => (
      <div>
        <div className="font-medium text-brand-700">{r.tutor.lastName} {r.tutor.firstName}</div>
        <div className="text-[11px] text-neutral-500">
          {r.tutor.kardex ? `Kardex ${r.tutor.kardex}` : 'Sin kardex'}{r.tutor.ci ? ` · CI ${r.tutor.ci}` : ''}
        </div>
      </div>
    ) },
    { key: 'estudiante', header: 'Estudiante', render: r => r.student ? (
      <div>
        <span className="text-[12.5px]">{r.student.lastName} {r.student.firstName}</span>
        {r.sharedWith && r.sharedWith.length > 0 && (
          <div className="text-[10.5px] text-info-500 mt-0.5">
            🔗 Compartido con hermano/a en {r.sharedWith.map(c => courseLabel(c)).join(', ')}
          </div>
        )}
      </div>
    ) : <span className="text-neutral-400">—</span> },
    { key: 'concepto', header: 'Concepto', render: r => <span className="text-[12.5px]">{r.title}</span> },
    { key: 'monto', header: 'Monto trasladado', render: r => <span className="font-semibold">{fmt(r.amount - r.paidAmount)}</span> },
    { key: 'traslado', header: 'Traslado', render: r => r.destino ? (
      <span className="flex items-center gap-1.5 text-[12.5px] text-neutral-700">
        {report?.sourceAcademicYear.year} <ArrowRightLeft size={12} className="text-neutral-400"/> {r.destino.year}
      </span>
    ) : <span className="text-neutral-400">—</span> },
    { key: 'estadoDestino', header: 'Estado actual en destino', render: r => r.destino
      ? <Badge tone={ESTADO_TONES[r.destino.status] || 'neutral'}>{ESTADO_LABELS[r.destino.status] || r.destino.status}</Badge>
      : <span className="text-neutral-400">—</span>
    },
  ]

  return (
    <div>
      <div className="flex items-center gap-3 mb-1">
        <button onClick={() => router.push('/dashboard/padres/tesoreria/reportes')} className="flex items-center gap-1.5 text-neutral-500 hover:text-brand-700 text-[13px]">
          <ArrowLeft size={16}/> Volver a Reportes Financieros
        </button>
      </div>
      <PageHeader title="Deuda Trasladada" description="Aportes no pagados en una gestión cerrada y el cargo de la gestión siguiente al que se movieron" />

      <Toolbar
        className="mb-4"
        filters={[{
          key: 'gestion', label: 'Gestión de origen', value: filters.academicYearId, onChange: v => update({ academicYearId: v }),
          options: closedYears.map(y => ({ value: String(y.id), label: String(y.year) })),
        }]}
        actions={[{ key: 'refresh', label: 'Actualizar', icon: RefreshCw, onClick: fetchReport }]}
      />

      {loading ? (
        <Card><LoadingState /></Card>
      ) : !report ? (
        <Card className="text-center py-12 text-neutral-500">No hay ninguna gestión cerrada económicamente todavía</Card>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
            <StatCard label={`Casos trasladados (${report.sourceAcademicYear.year})`} value={report.totalCasos} />
            <StatCard label="Monto trasladado" value={fmt(report.totalTrasladado)} tone="danger" />
            <StatCard label="Ya resueltos" value={report.totalYaResuelto} tone="success" />
            <StatCard label="Aún pendientes" value={report.totalAunPendiente} tone="warning" />
          </div>

          {report.courses.length === 0 ? (
            <Card><EmptyState icon={ArrowRightLeft} message="No hubo deuda trasladada desde esta gestión" /></Card>
          ) : (
            report.courses.map((group, i) => (
              <Card key={group.course?.id ?? `sin-curso-${i}`} padded={false} className="overflow-hidden">
                <div className="flex items-center justify-between px-4.5 py-3 border-b border-neutral-100">
                  <span className="text-[13.5px] font-bold text-brand-700">
                    {group.course ? courseLabel(group.course) : 'Sin curso registrado en la gestión de origen'}
                  </span>
                  <span className="text-[11px] text-neutral-500">{group.rows.length} caso(s)</span>
                </div>
                <div className="p-4">
                  <Table columns={columns} rows={group.rows} rowKey={r => `${r.chargeId}-${r.student?.firstName ?? 'sin-curso'}`} />
                </div>
              </Card>
            ))
          )}
        </div>
      )}
    </div>
  )
}
