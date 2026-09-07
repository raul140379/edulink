'use client'

import { useEffect, useMemo, useState } from 'react'
import { CalendarRange, ChevronLeft, ChevronRight, Download } from 'lucide-react'
import Card from '@/components/ui/Card'
import PageHeader from '@/components/ui/PageHeader'
import Button from '@/components/ui/Button'
import { Select } from '@/components/ui/Input'
import LoadingState from '@/components/ui/LoadingState'
import { useToast } from '@/components/ui/ToastProvider'
import { useDistrictConfig } from '@/hooks/useDistrictConfig'
import { useSchoolConfig } from '@/hooks/useSchoolConfig'
import API_URL from '@/lib/api'
import { todayLocalStr, addDaysLocalStr } from '@/lib/localDate'
import { pivotWeeklyMatrix, DAY_NAMES, WeeklyMatrixResponse, CellStatus, abbreviateSubject } from '@/lib/weeklyAttendanceMatrix'
import { exportWeeklyAttendancePdf } from '@/lib/weeklyAttendancePdf'

const GRADE_LABELS: Record<string, string> = { PRIMERO: '1°', SEGUNDO: '2°', TERCERO: '3°', CUARTO: '4°', QUINTO: '5°', SEXTO: '6°' }

interface CourseOption { id: number; grade: string; parallel: string; level: string; shift: string }
const courseLabel = (c: CourseOption) => `${GRADE_LABELS[c.grade] || c.grade} "${c.parallel}"`

const CELL_STYLE: Record<CellStatus, string> = {
  PRESENTE:      'bg-success-100 text-success-700',
  AUSENTE:       'bg-danger-100 text-danger-600',
  RETRASO:       'bg-warning-100 text-warning-600',
  LICENCIA:      'bg-info-100 text-info-500',
  SIN_REGISTRAR: 'bg-neutral-100 text-neutral-400',
  SIN_HORARIO:   'bg-neutral-50',
}
const CELL_LETTER: Record<CellStatus, string> = {
  PRESENTE: 'P', AUSENTE: 'F', RETRASO: 'R', LICENCIA: 'L', SIN_REGISTRAR: '·', SIN_HORARIO: '',
}

function formatShortDate(iso: string): string {
  const [, m, d] = iso.split('-')
  return `${d}/${m}`
}

export default function AsistenciaSemanalPage() {
  const toast = useToast()
  const district = useDistrictConfig()
  const school = useSchoolConfig()

  const [courses, setCourses] = useState<CourseOption[]>([])
  const [courseId, setCourseId] = useState<number | null>(null)
  const [anchorDate, setAnchorDate] = useState(todayLocalStr())
  const [data, setData] = useState<WeeklyMatrixResponse | null>(null)
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
    setData(null);
    (async () => {
      try {
        const res = await fetch(`${API_URL}/api/reports/attendance-weekly/${courseId}?date=${anchorDate}`, { headers: { Authorization: `Bearer ${token}` } })
        const json = await res.json()
        if (!res.ok) { toast(json.message || 'Error al cargar la matriz', 'error'); return }
        setData(json)
      } catch { toast('Error de conexión', 'error') }
      finally { setLoading(false) }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    })()
  }, [courseId, anchorDate])

  const matrix = useMemo(() => (data ? pivotWeeklyMatrix(data) : null), [data])

  const selectedCourse = courses.find((c) => c.id === courseId) || null

  const handleExport = async () => {
    if (!data || !matrix || !selectedCourse) return
    await exportWeeklyAttendancePdf({
      districtName: district.name,
      districtLocation: district.location,
      schoolName: school.name,
      courseLevel: data.course.level,
      courseLabel: courseLabel(selectedCourse),
      weekStart: data.weekStart,
      weekEnd: data.weekEnd,
      matrix,
    })
  }

  // Agrupar columnas por día para el colspan del encabezado superior.
  const dayGroups = useMemo(() => {
    if (!matrix) return []
    const groups: { dayOfWeek: number; date: string; span: number }[] = []
    for (const col of matrix.columns) {
      const last = groups[groups.length - 1]
      if (last && last.dayOfWeek === col.dayOfWeek) last.span += 1
      else groups.push({ dayOfWeek: col.dayOfWeek, date: col.date, span: 1 })
    }
    return groups
  }, [matrix])

  return (
    <div>
      <PageHeader
        icon={CalendarRange}
        title="Matriz Semanal de Asistencia"
        description="Estado día por período de cada estudiante, toda la semana de un vistazo"
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
              {data ? `${formatShortDate(data.weekStart)} al ${formatShortDate(data.weekEnd)}` : '—'}
            </span>
            <Button variant="ghost" size="sm" onClick={() => setAnchorDate((d) => addDaysLocalStr(d, 7))}>
              <ChevronRight size={16} />
            </Button>
          </div>
          <div className="ml-auto">
            <Button variant="secondary" onClick={handleExport} disabled={!matrix || loading}>
              <Download size={14} /> Exportar PDF
            </Button>
          </div>
        </div>
      </Card>

      <Card>
        {loading || loadingCourses ? (
          <LoadingState />
        ) : !matrix || matrix.rows.length === 0 ? (
          <p className="text-sm text-neutral-500 text-center py-8">Sin horario ni estudiantes para este curso esta semana.</p>
        ) : (
          <>
            <div className="overflow-auto max-h-[70vh] border border-neutral-200 rounded-lg">
              <table className="border-collapse text-[12px] w-max">
                <thead>
                  <tr>
                    <th rowSpan={2} className="sticky left-0 top-0 z-30 bg-white border-b border-r border-neutral-200 px-3 py-2 text-left font-semibold text-brand-700 min-w-[180px]">
                      Apellidos y Nombres
                    </th>
                    {dayGroups.map((g, i) => (
                      <th key={i} colSpan={g.span} className="sticky top-0 z-20 bg-brand-100 border-b border-r border-neutral-200 px-2 py-1.5 text-center font-semibold text-brand-700 whitespace-nowrap">
                        {DAY_NAMES[g.dayOfWeek]} <span className="font-normal text-[11px] text-neutral-500">{formatShortDate(g.date)}</span>
                      </th>
                    ))}
                  </tr>
                  <tr>
                    {matrix.columns.map((c, i) => (
                      <th
                        key={i}
                        className={`sticky top-[33px] z-20 border-b border-r border-neutral-200 px-1.5 py-1 text-center font-medium whitespace-nowrap ${
                          c.hasSchedule ? 'bg-bg-soft text-brand-700' : 'bg-neutral-50 text-neutral-300'
                        }`}
                        title={c.hasSchedule ? `${c.subjectName} · ${c.teacherName}` : 'Sin período programado'}
                      >
                        <div>{c.periodStart === c.periodEnd ? `P${c.periodStart}` : `P${c.periodStart}-${c.periodEnd}`}</div>
                        {c.hasSchedule && <div className="text-[10px] font-normal whitespace-nowrap">{abbreviateSubject(c.subjectName)}</div>}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {matrix.rows.map((r) => (
                    <tr key={r.studentId} className="odd:bg-white even:bg-neutral-50/60">
                      <td className="sticky left-0 z-10 bg-inherit border-b border-r border-neutral-200 px-3 py-1.5 font-medium text-brand-900 whitespace-nowrap">
                        {r.lastName} {r.firstName}
                      </td>
                      {r.cells.map((cell, i) => (
                        <td
                          key={i}
                          title={cell.onLicense ? 'Licencia' : undefined}
                          className={`border-b border-r border-neutral-200 text-center font-semibold px-1.5 py-1.5 ${CELL_STYLE[cell.status]}`}
                        >
                          {CELL_LETTER[cell.status]}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-[11px] text-neutral-500 mt-2">
              P = Presente · F = Falta · R = Retraso · L = Licencia · <span className="text-neutral-400">·</span> = Sin registrar · celda vacía = sin período programado ese día
            </p>
          </>
        )}
      </Card>
    </div>
  )
}
