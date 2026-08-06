'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle, Layers, RefreshCw } from 'lucide-react'
import Card from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Table, { Column } from '@/components/ui/Table'
import PageHeader from '@/components/ui/PageHeader'
import Toolbar from '@/components/ui/Toolbar'
import StatCard from '@/components/ui/StatCard'
import EmptyState from '@/components/ui/EmptyState'
import LoadingState from '@/components/ui/LoadingState'
import { useToast } from '@/components/ui/ToastProvider'
import { useModuleFilters } from '@/hooks/useModuleFilters'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

const GRADE_LABELS: Record<string, string> = { PRIMERO: '1°', SEGUNDO: '2°', TERCERO: '3°', CUARTO: '4°', QUINTO: '5°', SEXTO: '6°' }
const SHIFT_LABELS: Record<string, string> = { MORNING: 'Mañana', AFTERNOON: 'Tarde', NIGHT: 'Noche' }
const LEVEL_LABELS: Record<string, string> = { INICIAL: 'Inicial', PRIMARIA: 'Primaria', SECUNDARIA: 'Secundaria' }
const ESTADO_TONE: Record<string, 'warning' | 'danger'> = { DEUDOR: 'warning', VENCIDO: 'danger' }
const ESTADO_LABEL: Record<string, string> = { DEUDOR: 'Deudor', VENCIDO: 'Vencido' }

interface Tutor {
  id: number; firstName: string; lastName: string; ci?: string; kardex: string | null
  studentName: string; estado: string
  summary: { totalDebt: number; totalPaid: number; totalPending: number; hasDebt: boolean }
}
interface CourseGroup {
  course: { id: number; level: string; grade: string; parallel: string; shift: string }
  tutores: Tutor[]
}
interface AcademicYear { id: number; year: number; isActive: boolean }
interface CourseOption { id: number; level: string; grade: string; parallel: string; shift: string }

const fmt = (n: number) => `Bs. ${n.toFixed(2)}`

// Tutores con deuda pendiente, agrupados por curso y ordenados alfabéticamente
// por estudiante (ya viene así del backend) — muestra el kardex del tutor y
// distingue Deudor (a tiempo) de Vencido (algún cargo con fecha ya pasada).
// Comparte moduleKey 'tesoreria' con Cobros/Kardex/etc. (useModuleFilters).
export default function DeudasPage() {
  const router = useRouter()
  const toast  = useToast()
  const { filters, update } = useModuleFilters('tesoreria', { academicYearId: '', courseId: '', search: '' })

  const [groups, setGroups] = useState<CourseGroup[]>([])
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([])
  const [courses, setCourses] = useState<CourseOption[]>([])
  const [loading, setLoading] = useState(true)

  const token = () => (typeof window !== 'undefined' ? localStorage.getItem('token') : '') || ''
  const auth  = () => ({ Authorization: `Bearer ${token()}` })

  const fetchGroups = () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (filters.academicYearId) params.set('academicYearId', filters.academicYearId)
    fetch(`${API_URL}/api/treasury/by-course?${params}`, { headers: auth() })
      .then(async r => {
        const data = await r.json()
        if (!r.ok) { toast(data.message, 'error'); return }
        setGroups(data)
      })
      .catch(() => toast('Error de conexión', 'error'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    Promise.all([
      fetch(`${API_URL}/api/academic`, { headers: auth() }).then(r => r.ok ? r.json() : []),
      fetch(`${API_URL}/api/courses`, { headers: auth() }).then(r => r.ok ? r.json() : []),
    ]).then(([years, cs]) => { setAcademicYears(years); setCourses(cs) })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(fetchGroups, [filters.academicYearId])

  const search = filters.search.trim().toLowerCase()
  const visibleGroups = groups
    .filter(g => !filters.courseId || String(g.course.id) === filters.courseId)
    .map(g => ({
      course: g.course,
      tutores: g.tutores.filter(t =>
        t.summary.hasDebt &&
        (!search || `${t.firstName} ${t.lastName} ${t.studentName}`.toLowerCase().includes(search)),
      ),
    }))
    .filter(g => g.tutores.length > 0)

  const totalDeuda = visibleGroups.reduce((sum, g) => sum + g.tutores.reduce((s, t) => s + t.summary.totalPending, 0), 0)

  const columns: Column<Tutor>[] = [
    { key: 'estudiante', header: 'Estudiante', render: t => <span className="text-[12.5px] font-medium text-brand-700">{t.studentName}</span> },
    { key: 'tutor', header: 'Tutor', render: t => (
      <div>
        <div className="font-medium text-brand-700">{t.lastName} {t.firstName}</div>
        {t.ci && <div className="text-[11px] text-neutral-500">CI {t.ci}</div>}
      </div>
    ) },
    { key: 'kardex', header: 'Kardex', render: t => t.kardex
      ? <span className="font-mono text-[12px] font-bold text-brand-700">{t.kardex}</span>
      : <span className="text-[11px] text-danger-600">Sin kardex</span>
    },
    { key: 'cargado', header: 'Cargado', render: t => fmt(t.summary.totalDebt) },
    { key: 'pagado', header: 'Pagado', render: t => <span className="text-success-700">{fmt(t.summary.totalPaid)}</span> },
    { key: 'pendiente', header: 'Pendiente', render: t => <span className="text-danger-600 font-semibold">{fmt(t.summary.totalPending)}</span> },
    { key: 'estado', header: 'Estado', render: t => <Badge tone={ESTADO_TONE[t.estado] || 'warning'}>{ESTADO_LABEL[t.estado] || t.estado}</Badge> },
    { key: 'accion', header: 'Acción', render: t => (
      <Button size="sm" variant="secondary" onClick={() => router.push(`/dashboard/padres/tesoreria/${t.id}`)}>Ver cuenta</Button>
    ) },
  ]

  return (
    <div>
      <PageHeader
        title="Deudas" description="Tutores con saldo pendiente, agrupados por curso"
        action={<StatCard label="Total pendiente" value={fmt(totalDeuda)} tone="danger" />}
      />

      <Toolbar
        className="mb-4"
        search={{ value: filters.search, onChange: v => update({ search: v }), placeholder: 'Buscar tutor o estudiante...' }}
        filters={[
          {
            key: 'academicYearId', label: 'Gestión', value: filters.academicYearId, onChange: v => update({ academicYearId: v }),
            options: academicYears.map(y => ({ value: String(y.id), label: `${y.year}${y.isActive ? ' (Activa)' : ''}` })),
          },
          {
            key: 'courseId', label: 'Curso', value: filters.courseId, onChange: v => update({ courseId: v }),
            options: courses.map(c => ({ value: String(c.id), label: `${GRADE_LABELS[c.grade] || c.grade} "${c.parallel}" · ${SHIFT_LABELS[c.shift] || c.shift}` })),
          },
        ]}
        actions={[{ key: 'refresh', label: 'Actualizar', icon: RefreshCw, onClick: fetchGroups }]}
      />

      {loading ? (
        <Card><LoadingState /></Card>
      ) : visibleGroups.length === 0 ? (
        <Card><EmptyState icon={AlertCircle} message="Ningún tutor tiene deuda pendiente" /></Card>
      ) : (
        <div className="flex flex-col gap-4">
          {visibleGroups.map(g => (
            <Card key={g.course.id} padded={false} className="overflow-hidden">
              <div className="flex items-center gap-2 px-4.5 py-3.5 border-b border-neutral-100 text-[13px] font-bold text-brand-700">
                <Layers size={15}/>
                {LEVEL_LABELS[g.course.level] || g.course.level} — {GRADE_LABELS[g.course.grade] || g.course.grade} &quot;{g.course.parallel}&quot;
                <Badge tone="neutral">{SHIFT_LABELS[g.course.shift] || g.course.shift}</Badge>
              </div>
              <div className="p-4">
                <Table columns={columns} rows={g.tutores} rowKey={t => t.id} />
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
