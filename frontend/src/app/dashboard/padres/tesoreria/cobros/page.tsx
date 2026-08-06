'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { DollarSign, Layers, RefreshCw } from 'lucide-react'
import Card from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import PageHeader from '@/components/ui/PageHeader'
import Toolbar from '@/components/ui/Toolbar'
import EmptyState from '@/components/ui/EmptyState'
import LoadingState from '@/components/ui/LoadingState'
import { useToast } from '@/components/ui/ToastProvider'
import { useModuleFilters } from '@/hooks/useModuleFilters'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

const TYPE_LABELS: Record<string, string> = {
  CUOTA_INICIAL: 'Cuota Inicial', DEUDA_ANTERIOR: 'Deuda Anterior', MULTA_ASAMBLEA: 'Multa Asamblea',
  MINGA: 'Minga', MULTA_REUNION: 'Multa Reunión', ACTIVIDAD: 'Actividad',
  MATERIAL_ESCOLAR: 'Material Escolar', OTRO: 'Otro',
}
const GRADE_LABELS: Record<string, string> = { PRIMERO: '1°', SEGUNDO: '2°', TERCERO: '3°', CUARTO: '4°', QUINTO: '5°', SEXTO: '6°' }
const SHIFT_LABELS: Record<string, string> = { MORNING: 'Mañana', AFTERNOON: 'Tarde', NIGHT: 'Noche' }
const LEVEL_LABELS: Record<string, string> = { INICIAL: 'Inicial', PRIMARIA: 'Primaria', SECUNDARIA: 'Secundaria' }
const ESTADO_TONE: Record<string, 'success' | 'warning' | 'danger'> = { AL_DIA: 'success', DEUDOR: 'warning', VENCIDO: 'danger' }
const ESTADO_LABEL: Record<string, string> = { AL_DIA: 'Al día', DEUDOR: 'Deudor', VENCIDO: 'Vencido' }

interface ChargeDetail { id: number; title: string; type: string; amount: number; paidAmount: number; status: string }
interface Tutor {
  id: number; firstName: string; lastName: string; ci?: string; kardex: string | null
  studentName: string; estado: string; charges: ChargeDetail[]
}
interface CourseGroup {
  course: { id: number; level: string; grade: string; parallel: string; shift: string }
  tutores: Tutor[]
}
interface AcademicYear { id: number; year: number; isActive: boolean }
interface CourseOption { id: number; level: string; grade: string; parallel: string; shift: string }

const fmt = (n: number) => `Bs. ${n.toFixed(2)}`

// Por curso, tutores ordenados alfabéticamente por estudiante (ya vienen así
// del backend) — se muestran los cargos con algún pago (Pagado/Parcial) de
// cada tutor, junto a su kardex y su estado real de cuenta (Al día/Deudor/
// Vencido) en vez del estado del cargo individual. Módulo de referencia del
// Design System: filtros persistentes compartidos con Deudas/Kardex/etc.
// (ver useModuleFilters('tesoreria', ...)).
export default function CobrosPage() {
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

  // Solo tutores con al menos un cargo pagado/parcial son relevantes para
  // "Cobros" — más el filtro de curso y la búsqueda por tutor/estudiante,
  // ambos en cliente sobre lo ya traído.
  const search = filters.search.trim().toLowerCase()
  const visibleGroups = groups
    .filter(g => !filters.courseId || String(g.course.id) === filters.courseId)
    .map(g => ({
      course: g.course,
      tutores: g.tutores.filter(t =>
        t.charges.some(c => c.paidAmount > 0) &&
        (!search || `${t.firstName} ${t.lastName} ${t.studentName}`.toLowerCase().includes(search)),
      ),
    }))
    .filter(g => g.tutores.length > 0)

  return (
    <div>
      <PageHeader title="Cobros" description="Tutores con algún pago registrado, agrupados por curso" />

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
        <Card><EmptyState icon={DollarSign} message="Todavía no hay cobros registrados" /></Card>
      ) : (
        <div className="flex flex-col gap-4">
          {visibleGroups.map(g => (
            <Card key={g.course.id} padded={false} className="overflow-hidden">
              <div className="flex items-center gap-2 px-4.5 py-3.5 border-b border-neutral-100 text-[13px] font-bold text-brand-700">
                <Layers size={15}/>
                {LEVEL_LABELS[g.course.level] || g.course.level} — {GRADE_LABELS[g.course.grade] || g.course.grade} &quot;{g.course.parallel}&quot;
                <Badge tone="neutral">{SHIFT_LABELS[g.course.shift] || g.course.shift}</Badge>
              </div>
              <div className="flex flex-col divide-y divide-neutral-100">
                {g.tutores.map(t => {
                  const pagados = t.charges.filter(c => c.paidAmount > 0)
                  return (
                    <div key={t.id} className="p-4 flex flex-col gap-2.5">
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <div>
                          <div className="font-medium text-brand-700">{t.lastName} {t.firstName}</div>
                          <div className="text-[11px] text-neutral-500">
                            Estudiante: {t.studentName}{t.ci ? ` · CI ${t.ci}` : ''}
                          </div>
                        </div>
                        <div className="flex items-center gap-2.5">
                          {t.kardex
                            ? <span className="font-mono text-[12px] font-bold text-brand-700 bg-neutral-100 border border-neutral-300 rounded-lg px-2.5 py-1">Kardex {t.kardex}</span>
                            : <span className="text-[11px] text-danger-600">Sin kardex</span>
                          }
                          <Badge tone={ESTADO_TONE[t.estado]}>{ESTADO_LABEL[t.estado]}</Badge>
                          <Button size="sm" variant="secondary" onClick={() => router.push(`/dashboard/padres/tesoreria/${t.id}`)}>Ver cuenta</Button>
                        </div>
                      </div>
                      <div className="flex flex-col gap-1">
                        {pagados.map(c => (
                          <div key={c.id} className="flex items-center gap-2.5 text-[12.5px] bg-neutral-100/60 rounded-lg px-3 py-1.5 flex-wrap">
                            <span className="font-medium text-brand-700">{c.title}</span>
                            <Badge tone="neutral">{TYPE_LABELS[c.type] || c.type}</Badge>
                            <span className="text-neutral-500 ml-auto">Monto: {fmt(c.amount)}</span>
                            <span className="text-success-700 font-semibold">Pagado: {fmt(c.paidAmount)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
