'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, RefreshCw, ClipboardCheck, ArrowRightLeft, Pencil, Send, CheckCircle2, UserPlus, Search, Upload, FileSpreadsheet, RotateCcw } from 'lucide-react'
import Card from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import { Input, Select } from '@/components/ui/Input'
import Table, { Column } from '@/components/ui/Table'
import PageHeader from '@/components/ui/PageHeader'
import Toolbar from '@/components/ui/Toolbar'
import StatCard from '@/components/ui/StatCard'
import LoadingState from '@/components/ui/LoadingState'
import EmptyState from '@/components/ui/EmptyState'
import { useToast } from '@/components/ui/ToastProvider'
import { useConfirm } from '@/components/ui/ConfirmProvider'
import { useModuleFilters } from '@/hooks/useModuleFilters'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

const GRADE_LABELS: Record<string, string> = {
  PRIMERO: '1°', SEGUNDO: '2°', TERCERO: '3°', CUARTO: '4°', QUINTO: '5°', SEXTO: '6°',
}
const SHIFT_LABELS: Record<string, string> = { MORNING: 'Mañana', AFTERNOON: 'Tarde', NIGHT: 'Noche' }

const ESTADO_LABELS: Record<string, string> = {
  PAGADO: 'Pagado', PARCIAL: 'Parcial', PENDIENTE: 'Pendiente', NO_CARGADO: 'Sin registrar', TRASLADADO: 'Trasladado',
}
const ESTADO_TONES: Record<string, 'success' | 'warning' | 'danger' | 'neutral' | 'info'> = {
  PAGADO: 'success', PARCIAL: 'warning', PENDIENTE: 'danger', NO_CARGADO: 'neutral', TRASLADADO: 'info',
}

const fmt = (n: number) => `Bs. ${n.toFixed(2)}`

const IMPORT_ROW_LABELS: Record<string, string> = {
  would_create: 'Se creará', created: 'Creado', would_update: 'Se actualizará', updated: 'Actualizado',
  already_exists: 'Ya existía', rejected: 'Rechazado', skipped: 'Sin datos',
}
const IMPORT_ROW_TONES: Record<string, 'success' | 'warning' | 'danger' | 'neutral' | 'info'> = {
  would_create: 'info', created: 'success', would_update: 'warning', updated: 'warning',
  already_exists: 'neutral', rejected: 'danger', skipped: 'neutral',
}

interface AcademicYear { id: number; year: number; isActive: boolean; economicClosedAt: string | null }
interface CourseOption { id: number; level: string; grade: string; parallel: string; shift: string }

interface AporteType { mandatoryChargeId: number; title: string; type: string; amount: number }
interface AporteEstado {
  chargeId?: number; estado: string; monto: number; pagado: number; pendiente: number; referencia?: string
  pendingVerificationNote?: string
  refunded?: number; refundReason?: string
  destino?: { chargeId: number; year: number; status: string }
}

interface TutorInfo { id: number; firstName: string; lastName: string; ci: string | null; kardex: string | null }

interface StudentRow {
  student: { id: number; firstName: string; lastName: string; isActive: boolean }
  tutor: TutorInfo | null
  byType: Record<number, AporteEstado>
}

interface ParentOption { id: number; firstName: string; lastName: string; ci: string | null; kardex: string | null }

// Contexto de la celda sobre la que se abrió una acción (editar/trasladar) —
// suficiente para saber a qué curso/estudiante/tipo aplicarle el resultado
// sin tener que refrescar toda la tabla.
interface CellContext {
  courseId: number; studentId: number; mandatoryChargeId: number
  tutorId: number | null; estado: string; chargeId?: number
}

interface CourseBlock {
  course: { id: number; level: string; grade: string; parallel: string; shift: string }
  students: StudentRow[]
}

interface Report {
  academicYearId: number
  totalStudents: number
  types: AporteType[]
  summary: { mandatoryChargeId: number; title: string; type: string; amount: number; pagadoCompleto: number; parcial: number; trasladado: number; noPagado: number }[]
  courses: CourseBlock[]
}

const courseLabel = (c: { grade: string; parallel: string; shift: string }) =>
  `${GRADE_LABELS[c.grade] || c.grade} "${c.parallel}" · ${SHIFT_LABELS[c.shift] || c.shift}`

interface ImportRowResult {
  row: number; position?: number
  status: 'would_create' | 'created' | 'would_update' | 'updated' | 'already_exists' | 'rejected' | 'skipped'
  student?: string; tutor?: string; amount?: number; paid?: boolean
  pendingVerification?: boolean; note?: string | null; reason?: string
}
interface ImportResult {
  tipoAporte?: string
  totalRows: number
  summary: Record<string, number>
  results: ImportRowResult[]
}

export default function VerificacionPorCursoPage() {
  const router  = useRouter()
  const toast   = useToast()
  const confirm = useConfirm()
  const { filters, update } = useModuleFilters('tesoreria', { academicYearId: '', courseId: '', search: '' })

  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([])
  const [courses,       setCourses]       = useState<CourseOption[]>([])
  const [report,        setReport]        = useState<Report | null>(null)
  const [loading,       setLoading]       = useState(true)

  // Editar (corrección histórica) — modal
  const [editing, setEditing] = useState<CellContext | null>(null)
  const [editForm, setEditForm] = useState({ amount: '', paid: false, paidAmount: '', date: '', reference: '' })
  const [saving, setSaving] = useState(false)

  // Registrar devolución (pago duplicado) — modal. Guarda también el estado
  // actual de la celda para poder mergear refunded/refundReason al confirmar
  // sin tener que recargar toda la tabla.
  const [refunding, setRefunding] = useState<(CellContext & { current: AporteEstado }) | null>(null)
  const [refundForm, setRefundForm] = useState({ amount: '', reason: '', date: '' })
  const [refundSaving, setRefundSaving] = useState(false)

  // Trasladar a 2026 (cargo existente o "Sin registrar") — por celda, para
  // deshabilitar solo el botón que está en curso
  const [carryingKey, setCarryingKey] = useState<string | null>(null)

  // Filtro "al día" / "con deuda pendiente" — se calcula en el cliente sobre
  // lo ya cargado, no es un parámetro que vaya al backend.
  const [estadoFilter, setEstadoFilter] = useState<'' | 'al_dia' | 'pendiente'>('')

  // Vincular/registrar tutor — para estudiantes "Sin tutor vinculado"
  const [linkingTutorFor, setLinkingTutorFor] = useState<{ courseId: number; studentId: number; label: string } | null>(null)
  const [tutorTab, setTutorTab] = useState<'buscar' | 'nuevo'>('buscar')
  const [parentSearch, setParentSearch] = useState('')
  const [parentOptions, setParentOptions] = useState<ParentOption[]>([])
  const [searchingParents, setSearchingParents] = useState(false)
  const [assigningTutorId, setAssigningTutorId] = useState<number | null>(null)
  const [newTutorForm, setNewTutorForm] = useState({ firstName: '', lastName: '', ci: '', phone: '' })
  const [creatingTutor, setCreatingTutor] = useState(false)

  // Importar CSV de aportes — por bloque de curso. Un tipo de aporte por
  // import (no por fila), elegido acá una sola vez antes de subir el archivo.
  const [importingFor, setImportingFor] = useState<{ courseId: number; label: string } | null>(null)
  const [importMandatoryChargeId, setImportMandatoryChargeId] = useState('')
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importPreview, setImportPreview] = useState<ImportResult | null>(null)
  const [previewingImport, setPreviewingImport] = useState(false)
  const [applyingImport, setApplyingImport] = useState(false)

  const token = () => (typeof window !== 'undefined' ? localStorage.getItem('token') : '') || ''
  const auth  = () => ({ Authorization: `Bearer ${token()}` })
  const authJson = () => ({ 'Content-Type': 'application/json', ...auth() })

  const selectedYear = academicYears.find(y => String(y.id) === filters.academicYearId)
  const isSelectedYearClosed = !!selectedYear?.economicClosedAt

  const fetchOptions = async () => {
    try {
      const [yRes, cRes] = await Promise.all([
        fetch(`${API_URL}/api/treasury/academic-years`, { headers: auth() }),
        fetch(`${API_URL}/api/courses`,  { headers: auth() }),
      ])
      const [yData, cData] = await Promise.all([yRes.json(), cRes.json()])
      if (yRes.ok) {
        setAcademicYears(yData)
        if (!filters.academicYearId) {
          const active = yData.find((y: AcademicYear) => y.isActive)
          if (active) update({ academicYearId: String(active.id) })
        }
      }
      if (cRes.ok) setCourses(cData)
    } catch { toast('Error de conexión', 'error') }
  }

  const fetchReport = () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (filters.academicYearId) params.set('academicYearId', filters.academicYearId)
    if (filters.courseId)       params.set('courseId', filters.courseId)
    fetch(`${API_URL}/api/treasury/verification-by-course?${params}`, { headers: auth() })
      .then(async r => {
        const data = await r.json()
        if (!r.ok) { toast(data.message, 'error'); setReport(null); return }
        setReport(data)
      })
      .catch(() => toast('Error de conexión', 'error'))
      .finally(() => setLoading(false))
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchOptions() }, [])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (filters.academicYearId) fetchReport() }, [filters.academicYearId, filters.courseId])

  // Actualiza la celda editada Y cualquier otra fila del MISMO tutor (un
  // hermano en otro curso) para el mismo tipo de aporte — el cargo es por
  // tutor, no por estudiante, así que ambas filas comparten el mismo Charge
  // y deben reflejar el mismo estado sin esperar a un "Actualizar" manual.
  // El resumen de arriba sí puede quedar desactualizado hasta entonces, es un
  // costo aceptado a cambio de no recargar toda la tabla.
  const patchCell = (ctx: CellContext, next: AporteEstado) => {
    setReport(prev => {
      if (!prev) return prev
      return {
        ...prev,
        courses: prev.courses.map(block => ({
          ...block,
          students: block.students.map(s => {
            const isEditedCell = block.course.id === ctx.courseId && s.student.id === ctx.studentId
            const isSiblingSameTutor = ctx.tutorId != null && s.tutor?.id === ctx.tutorId
            if (!isEditedCell && !isSiblingSameTutor) return s
            return { ...s, byType: { ...s.byType, [ctx.mandatoryChargeId]: next } }
          }),
        })),
      }
    })
  }

  const openEdit = (ctx: CellContext, current: AporteEstado) => {
    setEditing(ctx)
    setEditForm({
      amount: String(current.monto), paid: current.pagado > 0,
      paidAmount: current.pagado > 0 ? String(current.pagado) : '', date: '', reference: current.referencia || '',
    })
  }

  const handleSaveEdit = async () => {
    if (!editing || !report) return
    setSaving(true)
    try {
      const isNew = !editing.chargeId
      const url = isNew
        ? `${API_URL}/api/treasury/create-historical-charge`
        : `${API_URL}/api/treasury/${editing.chargeId}/historical-correction`
      const body = isNew
        ? {
            parentId: editing.tutorId, academicYearId: report.academicYearId, mandatoryChargeId: editing.mandatoryChargeId,
            amount: editForm.amount ? parseFloat(editForm.amount) : undefined,
            paid: editForm.paid,
            paidAmount: editForm.paid && editForm.paidAmount ? parseFloat(editForm.paidAmount) : undefined,
            date: editForm.date || undefined,
            reference: editForm.reference || undefined,
          }
        : {
            amount: editForm.amount ? parseFloat(editForm.amount) : undefined,
            paid: editForm.paid,
            paidAmount: editForm.paid && editForm.paidAmount ? parseFloat(editForm.paidAmount) : undefined,
            date: editForm.date || undefined,
            reference: editForm.reference || undefined,
          }
      const res = await fetch(url, { method: isNew ? 'POST' : 'PUT', headers: authJson(), body: JSON.stringify(body) })
      const data = await res.json()
      if (!res.ok) { toast(data.message, 'error'); return }

      if (isNew) {
        patchCell(editing, {
          chargeId: data.charge.id, estado: data.charge.status,
          monto: data.charge.amount, pagado: data.charge.paidAmount, pendiente: data.charge.amount - data.charge.paidAmount,
          referencia: editForm.reference || undefined,
        })
      } else {
        patchCell(editing, {
          chargeId: editing.chargeId,
          estado: data.status === 'ANULADO' ? 'TRASLADADO' : data.status,
          monto: data.amount, pagado: data.paidAmount, pendiente: data.amount - data.paidAmount,
          referencia: editForm.reference || undefined, destino: data.destino,
        })
        if (data.syncWarning) toast(data.syncWarning, 'error')
      }
      toast(isNew ? 'Cargo registrado correctamente' : 'Cargo corregido correctamente', 'success')
      setEditing(null)
    } catch { toast('Error de conexión', 'error') }
    finally { setSaving(false) }
  }

  const openRefund = (ctx: CellContext, current: AporteEstado) => {
    setRefunding({ ...ctx, current })
    setRefundForm({ amount: '', reason: '', date: '' })
  }

  const handleSaveRefund = async () => {
    if (!refunding || !refunding.chargeId) return
    if (!refundForm.amount || !refundForm.reason.trim()) {
      toast('Monto y motivo son requeridos', 'error'); return
    }
    setRefundSaving(true)
    try {
      const res = await fetch(`${API_URL}/api/treasury/${refunding.chargeId}/refund`, {
        method: 'POST', headers: authJson(),
        body: JSON.stringify({
          amount: parseFloat(refundForm.amount), reason: refundForm.reason.trim(),
          date: refundForm.date || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) { toast(data.message, 'error'); return }
      patchCell(refunding, {
        ...refunding.current,
        refunded: data.totalRefunded,
        refundReason: refunding.current.refundReason
          ? `${refunding.current.refundReason}; ${refundForm.reason.trim()}`
          : refundForm.reason.trim(),
      })
      toast('Devolución registrada correctamente', 'success')
      setRefunding(null)
    } catch { toast('Error de conexión', 'error') }
    finally { setRefundSaving(false) }
  }

  const cellKey = (ctx: { courseId: number; studentId: number; mandatoryChargeId: number }) =>
    `${ctx.courseId}-${ctx.studentId}-${ctx.mandatoryChargeId}`

  // Traslado manual de un cargo PENDIENTE/PARCIAL que ya existe — reusa la
  // misma lógica de carryover que el cierre de gestión, para un solo cargo.
  const handleCarryForwardExisting = async (ctx: CellContext) => {
    if (!ctx.chargeId) return
    if (!await confirm(`¿Trasladar este cargo pendiente a la gestión activa como Deuda Anterior? El original quedará anulado.`, { danger: false })) return
    setCarryingKey(cellKey(ctx))
    try {
      const res = await fetch(`${API_URL}/api/treasury/${ctx.chargeId}/carry-forward`, { method: 'POST', headers: auth() })
      const data = await res.json()
      if (!res.ok) { toast(data.message, 'error'); return }
      const type = report?.types.find(t => t.mandatoryChargeId === ctx.mandatoryChargeId)
      const monto = type?.amount ?? 0
      patchCell(ctx, { chargeId: ctx.chargeId, estado: 'TRASLADADO', monto, pagado: 0, pendiente: monto, destino: data.destino })
      toast('Cargo trasladado correctamente', 'success')
    } catch { toast('Error de conexión', 'error') }
    finally { setCarryingKey(null) }
  }

  // "Sin registrar" -> crea el cargo histórico y lo traslada en el mismo paso.
  const handleCreateAndCarryForward = async (ctx: CellContext) => {
    if (!ctx.tutorId || !report) return
    if (!await confirm('¿Registrar este aporte 2025 como no pagado y trasladar de inmediato su saldo a la gestión activa? Esta acción crea el cargo histórico y lo traslada en un solo paso.', { danger: false })) return
    setCarryingKey(cellKey(ctx))
    try {
      const res = await fetch(`${API_URL}/api/treasury/create-and-carry-forward`, {
        method: 'POST', headers: authJson(),
        body: JSON.stringify({ parentId: ctx.tutorId, academicYearId: report.academicYearId, mandatoryChargeId: ctx.mandatoryChargeId }),
      })
      const data = await res.json()
      if (!res.ok) { toast(data.message, 'error'); return }
      if (data.carried) {
        patchCell(ctx, {
          chargeId: data.charge.id, estado: 'TRASLADADO', monto: data.charge.amount, pagado: 0,
          pendiente: data.charge.amount, destino: data.destino,
        })
      } else {
        patchCell(ctx, { chargeId: data.charge.id, estado: 'PAGADO', monto: data.charge.amount, pagado: data.charge.paidAmount, pendiente: 0 })
      }
      toast(data.message, 'success')
    } catch { toast('Error de conexión', 'error') }
    finally { setCarryingKey(null) }
  }

  // Actualiza el tutor de una fila puntual — no hace falta propagar a
  // hermanos acá (cada estudiante tiene su propio vínculo de tutor).
  const patchTutor = (courseId: number, studentId: number, tutor: TutorInfo) => {
    setReport(prev => {
      if (!prev) return prev
      return {
        ...prev,
        courses: prev.courses.map(block => block.course.id !== courseId ? block : {
          ...block,
          students: block.students.map(s => s.student.id !== studentId ? s : { ...s, tutor }),
        }),
      }
    })
  }

  const [togglingStudentId, setTogglingStudentId] = useState<number | null>(null)

  // "Retirado" es puramente informativo acá — reusa el isActive de Student,
  // sin tocar ningún Charge. Si el estudiante tiene deuda pendiente real, esa
  // deuda queda exactamente igual (no se anula ni se traslada sola).
  const handleToggleActive = async (courseId: number, studentId: number, currentlyActive: boolean) => {
    const msg = currentlyActive
      ? '¿Marcar a este estudiante como retirado? Es solo informativo — cualquier cargo pendiente que tenga sigue igual, no se anula ni se traslada.'
      : '¿Reactivar a este estudiante?'
    if (!await confirm(msg, { danger: currentlyActive })) return
    setTogglingStudentId(studentId)
    try {
      const res = await fetch(`${API_URL}/api/students/${studentId}/toggle`, { method: 'PATCH', headers: auth() })
      const data = await res.json()
      if (!res.ok) { toast(data.message, 'error'); return }
      setReport(prev => {
        if (!prev) return prev
        return {
          ...prev,
          courses: prev.courses.map(block => block.course.id !== courseId ? block : {
            ...block,
            students: block.students.map(s => s.student.id !== studentId ? s : { ...s, student: { ...s.student, isActive: data.student.isActive } }),
          }),
        }
      })
      toast(data.message, 'success')
    } catch { toast('Error de conexión', 'error') }
    finally { setTogglingStudentId(null) }
  }

  const openImport = (courseId: number, label: string) => {
    setImportingFor({ courseId, label })
    setImportMandatoryChargeId('')
    setImportFile(null)
    setImportPreview(null)
  }

  const handlePickImportFile = async (file: File) => {
    if (!importingFor || !importMandatoryChargeId) return
    setImportFile(file)
    setImportPreview(null)
    setPreviewingImport(true)
    try {
      const body = new FormData()
      body.append('mandatoryChargeId', importMandatoryChargeId)
      body.append('file', file)
      const res = await fetch(`${API_URL}/api/treasury/course/${importingFor.courseId}/import-aportes/preview`, {
        method: 'POST', headers: auth(), body,
      })
      const data = await res.json()
      if (!res.ok) { toast(data.message, 'error'); return }
      setImportPreview(data)
    } catch { toast('Error de conexión', 'error') }
    finally { setPreviewingImport(false) }
  }

  const handleConfirmImport = async () => {
    if (!importingFor || !importFile || !importMandatoryChargeId) return
    setApplyingImport(true)
    try {
      const body = new FormData()
      body.append('mandatoryChargeId', importMandatoryChargeId)
      body.append('file', importFile)
      const res = await fetch(`${API_URL}/api/treasury/course/${importingFor.courseId}/import-aportes/apply`, {
        method: 'POST', headers: auth(), body,
      })
      const data: ImportResult = await res.json()
      if (!res.ok) { toast((data as any).message, 'error'); return }
      toast(`Importación completa: ${data.summary.created ?? 0} creado(s), ${data.summary.updated ?? 0} actualizado(s), ${data.summary.alreadyExists ?? 0} ya existían, ${data.summary.rejected ?? 0} rechazado(s), ${data.summary.skipped ?? 0} sin datos`, 'success')
      setImportingFor(null)
      fetchReport()
    } catch { toast('Error de conexión', 'error') }
    finally { setApplyingImport(false) }
  }

  const openLinkTutor = (courseId: number, studentId: number, label: string) => {
    setLinkingTutorFor({ courseId, studentId, label })
    setTutorTab('buscar')
    setParentSearch(''); setParentOptions([])
    setNewTutorForm({ firstName: '', lastName: '', ci: '', phone: '' })
  }

  const searchParents = async () => {
    if (!parentSearch.trim()) { setParentOptions([]); return }
    setSearchingParents(true)
    try {
      const res = await fetch(`${API_URL}/api/parents?search=${encodeURIComponent(parentSearch.trim())}`, { headers: auth() })
      const data = await res.json()
      if (res.ok) setParentOptions(data)
    } catch { toast('Error de conexión', 'error') }
    finally { setSearchingParents(false) }
  }

  // Vincular un tutor ya existente en el sistema — si el padre/madre ya
  // estaba vinculado a este estudiante con otro rol (ej. como contacto
  // secundario, el caso más común de los casos que venimos corrigiendo),
  // link-students no hace nada (lo detecta por `relations` vacío) y hay que
  // forzarlo con change-relation en su lugar.
  const handleAssignExistingTutor = async (parent: ParentOption) => {
    if (!linkingTutorFor) return
    setAssigningTutorId(parent.id)
    try {
      let res = await fetch(`${API_URL}/api/parents/${parent.id}/link-students`, {
        method: 'POST', headers: authJson(),
        body: JSON.stringify({ studentIds: [linkingTutorFor.studentId], relationType: 'TUTOR_LEGAL' }),
      })
      let data = await res.json()
      if (!res.ok) { toast(data.message, 'error'); return }

      if (Array.isArray(data.relations) && data.relations.length === 0) {
        res = await fetch(`${API_URL}/api/parents/${parent.id}/change-relation/${linkingTutorFor.studentId}`, {
          method: 'PATCH', headers: authJson(), body: JSON.stringify({ relationType: 'TUTOR_LEGAL', isTutor: true }),
        })
        data = await res.json()
        if (!res.ok) { toast(data.message, 'error'); return }
      }

      patchTutor(linkingTutorFor.courseId, linkingTutorFor.studentId, {
        id: parent.id, firstName: parent.firstName, lastName: parent.lastName, ci: parent.ci, kardex: parent.kardex,
      })
      toast(`${parent.firstName} ${parent.lastName} vinculado como tutor`, 'success')
      setLinkingTutorFor(null)
    } catch { toast('Error de conexión', 'error') }
    finally { setAssigningTutorId(null) }
  }

  // Registrar un tutor que todavía no existe en el sistema — lo crea y lo
  // vincula como tutor legal en un solo paso (createParent ya acepta
  // studentIds + relationType).
  const handleCreateNewTutor = async () => {
    if (!linkingTutorFor) return
    if (!newTutorForm.firstName.trim() || !newTutorForm.lastName.trim()) {
      toast('Nombres y apellidos son requeridos', 'error'); return
    }
    setCreatingTutor(true)
    try {
      const res = await fetch(`${API_URL}/api/parents`, {
        method: 'POST', headers: authJson(),
        body: JSON.stringify({
          firstName: newTutorForm.firstName, lastName: newTutorForm.lastName,
          ci: newTutorForm.ci || undefined, phone: newTutorForm.phone || undefined,
          relationType: 'TUTOR_LEGAL', studentIds: [linkingTutorFor.studentId],
        }),
      })
      const data = await res.json()
      if (!res.ok) { toast(data.message, 'error'); return }
      patchTutor(linkingTutorFor.courseId, linkingTutorFor.studentId, {
        id: data.parent.id, firstName: data.parent.firstName, lastName: data.parent.lastName, ci: data.parent.ci, kardex: data.parent.kardex,
      })
      toast('Tutor registrado y vinculado correctamente', 'success')
      setLinkingTutorFor(null)
    } catch { toast('Error de conexión', 'error') }
    finally { setCreatingTutor(false) }
  }

  // "Al día" = todos los tipos de aporte están PAGADO, o TRASLADADO pero ya
  // resuelto en la gestión activa. Cualquier otra cosa (pendiente, parcial,
  // sin registrar, o trasladado todavía sin pagar) cuenta como "con deuda".
  const isRowAlDia = (row: StudentRow) => {
    if (!report) return false
    return report.types.every(t => {
      const e = row.byType[t.mandatoryChargeId]
      if (!e) return false
      if (e.estado === 'PAGADO') return true
      if (e.estado === 'TRASLADADO') return e.destino?.status === 'PAGADO'
      return false
    })
  }

  const filterRows = (students: StudentRow[]) => {
    if (!estadoFilter) return students
    return students.filter(s => estadoFilter === 'al_dia' ? isRowAlDia(s) : !isRowAlDia(s))
  }

  const summaryColumns: Column<Report['summary'][0]>[] = [
    { key: 'tipo',      header: 'Tipo de aporte', render: r => <span className="font-medium text-brand-700">{r.title}</span> },
    { key: 'monto',     header: 'Monto', render: r => fmt(r.amount) },
    { key: 'completo',   header: 'Pagado completo', render: r => <Badge tone="success">{r.pagadoCompleto}</Badge> },
    { key: 'parcial',    header: 'Parcial',         render: r => <Badge tone="warning">{r.parcial}</Badge> },
    { key: 'trasladado', header: 'Trasladado',      render: r => <Badge tone="info">{r.trasladado}</Badge> },
    { key: 'nopagado',   header: 'Sin registrar / pendiente', render: r => <Badge tone="danger">{r.noPagado}</Badge> },
  ]

  const buildCourseColumns = (courseId: number): Column<StudentRow>[] => {
    if (!report) return []
    const base: Column<StudentRow>[] = [
      { key: 'estudiante', header: 'Estudiante', render: r => (
        <div className="flex flex-col gap-0.5 items-start">
          <span className="font-medium text-brand-700">{r.student.lastName} {r.student.firstName}</span>
          {!r.student.isActive && <Badge tone="neutral">Retirado</Badge>}
          <button
            onClick={() => handleToggleActive(courseId, r.student.id, r.student.isActive)}
            disabled={togglingStudentId === r.student.id}
            className="text-[10.5px] text-neutral-400 hover:text-brand-700 hover:underline disabled:opacity-50"
          >
            {r.student.isActive ? 'Marcar retirado' : 'Reactivar'}
          </button>
        </div>
      ) },
      { key: 'tutor', header: 'Tutor', render: r => r.tutor ? (
        <div>
          <div className="text-[13px]">{r.tutor.lastName} {r.tutor.firstName}</div>
          <div className="text-[11px] text-neutral-500">
            {r.tutor.kardex ? `Kardex ${r.tutor.kardex}` : 'Sin kardex'}{r.tutor.ci ? ` · CI ${r.tutor.ci}` : ''}
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-1 items-start">
          <span className="text-[12px] text-danger-600 italic">Sin tutor vinculado</span>
          <button
            onClick={() => openLinkTutor(courseId, r.student.id, `${r.student.lastName} ${r.student.firstName}`)}
            className="flex items-center gap-1 text-[10.5px] text-brand-700 hover:underline"
          >
            <UserPlus size={10}/> Vincular / registrar tutor
          </button>
        </div>
      ) },
    ]
    const typeColumns: Column<StudentRow>[] = report.types.map(t => ({
      key: `tipo-${t.mandatoryChargeId}`,
      header: t.title,
      render: (r) => {
        const e = r.byType[t.mandatoryChargeId]
        if (!e) return '—'
        const ctx: CellContext = {
          courseId, studentId: r.student.id, mandatoryChargeId: t.mandatoryChargeId,
          tutorId: r.tutor?.id ?? null, estado: e.estado, chargeId: e.chargeId,
        }
        const busy = carryingKey === cellKey(ctx)
        return (
          <div className="flex flex-col gap-0.5">
            {e.estado === 'NO_CARGADO' ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11.5px] font-semibold bg-warm-gold/25 text-[#7a5f13] border border-warm-gold w-fit">
                {ESTADO_LABELS[e.estado]}
              </span>
            ) : e.estado === 'PENDIENTE' && e.pendingVerificationNote ? (
              <span
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11.5px] font-semibold bg-info-500/15 text-info-700 border border-info-500/40 w-fit"
                title={e.pendingVerificationNote}
              >
                🏦 Pendiente verificar
              </span>
            ) : (
              <Badge tone={ESTADO_TONES[e.estado] || 'neutral'}>{ESTADO_LABELS[e.estado] || e.estado}</Badge>
            )}
            <span className="text-[11px] text-neutral-500">{fmt(e.pagado)} / {fmt(e.monto)}</span>
            {e.referencia && <span className="text-[10.5px] text-neutral-400">Recibo {e.referencia}</span>}
            {e.pendingVerificationNote && <span className="text-[10.5px] text-info-500">{e.pendingVerificationNote}</span>}
            {!!e.refunded && (
              <span className="text-[10.5px] text-warning-500" title={e.refundReason}>
                🔙 {fmt(e.refunded)} devuelto{e.refundReason ? ` — ${e.refundReason}` : ''}
              </span>
            )}
            {e.destino && e.destino.status === 'PAGADO' ? (
              <span className="flex items-center gap-1 text-[10.5px] text-success-700 font-semibold">
                <CheckCircle2 size={11}/> Resuelto en {e.destino.year}
              </span>
            ) : e.destino && (
              <span className="flex items-center gap-1 text-[10.5px] text-info-500">
                <ArrowRightLeft size={10}/> a {e.destino.year} · {ESTADO_LABELS[e.destino.status] || e.destino.status}
              </span>
            )}
            {(e.estado === 'PAGADO' || e.estado === 'PARCIAL' || e.estado === 'TRASLADADO' || (e.estado === 'PENDIENTE' && e.chargeId)) && (
              <button onClick={() => openEdit(ctx, e)} className="flex items-center gap-1 text-[10.5px] text-brand-700 hover:underline mt-0.5">
                <Pencil size={10}/> Editar
              </button>
            )}
            {(e.estado === 'PAGADO' || e.estado === 'PARCIAL') && (
              <button onClick={() => openRefund(ctx, e)} className="flex items-center gap-1 text-[10.5px] text-neutral-500 hover:underline">
                <RotateCcw size={10}/> Registrar devolución
              </button>
            )}
            {e.estado === 'PENDIENTE' && isSelectedYearClosed && (
              <button onClick={() => handleCarryForwardExisting(ctx)} disabled={busy} className="flex items-center gap-1 text-[10.5px] text-info-500 hover:underline mt-0.5 disabled:opacity-50">
                <Send size={10}/> {busy ? 'Trasladando...' : 'Trasladar a 2026'}
              </button>
            )}
            {e.estado === 'NO_CARGADO' && isSelectedYearClosed && r.tutor && (
              <>
                <button onClick={() => openEdit(ctx, e)} className="flex items-center gap-1 text-[10.5px] text-brand-700 hover:underline mt-0.5">
                  <Pencil size={10}/> Editar
                </button>
                <button onClick={() => handleCreateAndCarryForward(ctx)} disabled={busy} className="flex items-center gap-1 text-[10.5px] text-info-500 hover:underline disabled:opacity-50">
                  <Send size={10}/> {busy ? 'Trasladando...' : 'Trasladar a 2026'}
                </button>
              </>
            )}
          </div>
        )
      },
    }))
    return [...base, ...typeColumns]
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-1">
        <button onClick={() => router.push('/dashboard/padres/tesoreria/reportes')} className="flex items-center gap-1.5 text-neutral-500 hover:text-brand-700 text-[13px]">
          <ArrowLeft size={16}/> Volver a Reportes Financieros
        </button>
      </div>
      <PageHeader title="Verificación por Curso" description="Cruza los aportes registrados en el sistema contra tu planilla, curso por curso" />

      <Toolbar
        className="mb-4"
        filters={[
          {
            key: 'gestion', label: 'Gestión', value: filters.academicYearId,
            onChange: v => update({ academicYearId: v }),
            options: academicYears.map(y => ({ value: String(y.id), label: `${y.year}${y.isActive ? ' (Activa)' : ''}` })),
          },
          {
            key: 'curso', label: 'Curso', value: filters.courseId,
            onChange: v => update({ courseId: v }),
            options: courses.map(c => ({ value: String(c.id), label: courseLabel(c) })),
          },
          {
            key: 'estado', label: 'Estado de cuenta', value: estadoFilter,
            onChange: v => setEstadoFilter(v as '' | 'al_dia' | 'pendiente'),
            options: [
              { value: 'al_dia', label: 'Al día (sin deuda)' },
              { value: 'pendiente', label: 'Con deuda pendiente' },
            ],
          },
        ]}
        actions={[{ key: 'refresh', label: 'Actualizar', icon: RefreshCw, onClick: fetchReport }]}
      />

      {loading ? (
        <Card><LoadingState /></Card>
      ) : !report ? (
        <Card className="text-center py-12 text-neutral-500">No hay datos para la gestión seleccionada</Card>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
            <StatCard label="Total estudiantes" value={report.totalStudents} />
            <StatCard label="Tipos de aporte" value={report.types.length} />
            <StatCard label="Cursos" value={report.courses.length} />
          </div>

          <Card padded={false} className="overflow-hidden">
            <div className="flex items-center gap-2 px-4.5 py-3.5 border-b border-neutral-100 text-[13px] font-bold text-brand-700">
              <ClipboardCheck size={15}/> Resumen por tipo de aporte
            </div>
            <div className="p-4">
              {report.summary.length === 0 ? (
                <EmptyState icon={ClipboardCheck} message="No hay cargos obligatorios definidos para esta gestión" />
              ) : (
                <Table columns={summaryColumns} rows={report.summary} rowKey={s => s.mandatoryChargeId} />
              )}
            </div>
          </Card>

          {report.courses.map(block => {
            const visibleStudents = filterRows(block.students)
            return (
              <Card key={block.course.id} padded={false} className="overflow-hidden">
                <div className="flex items-center justify-between px-4.5 py-3.5 border-b border-neutral-100">
                  <span className="text-[13px] font-bold text-brand-700">{courseLabel(block.course)}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-[12px] text-neutral-500">
                      {visibleStudents.length}{estadoFilter ? ` de ${block.students.length}` : ''} estudiante(s)
                    </span>
                    <button
                      onClick={() => openImport(block.course.id, courseLabel(block.course))}
                      className="flex items-center gap-1 text-[11.5px] text-brand-700 hover:underline"
                    >
                      <Upload size={12}/> Importar
                    </button>
                  </div>
                </div>
                <div className="p-4">
                  {block.students.length === 0 ? (
                    <EmptyState icon={ClipboardCheck} message="Sin estudiantes matriculados en este curso para la gestión elegida" />
                  ) : visibleStudents.length === 0 ? (
                    <EmptyState icon={ClipboardCheck} message="Ningún estudiante de este curso coincide con el filtro elegido" />
                  ) : (
                    <Table columns={buildCourseColumns(block.course.id)} rows={visibleStudents} rowKey={r => r.student.id} />
                  )}
                </div>
              </Card>
            )
          })}
        </div>
      )}

      <Modal
        open={!!editing} onClose={() => setEditing(null)}
        title={editing?.chargeId ? 'Corregir cargo histórico' : 'Registrar cargo histórico'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button onClick={handleSaveEdit} loading={saving}>Guardar</Button>
          </>
        }
      >
        {editing && (
          <div className="flex flex-col gap-3">
            <Input
              label="Monto del cargo (Bs.)" type="number" step="0.01" min="0" required
              value={editForm.amount} onChange={e => setEditForm({ ...editForm, amount: e.target.value })}
            />
            <label className="flex items-center gap-2 text-[13px] text-neutral-700 cursor-pointer">
              <input
                type="checkbox" className="w-4 h-4 accent-[var(--color-brand-700)] cursor-pointer"
                checked={editForm.paid} onChange={e => setEditForm({ ...editForm, paid: e.target.checked })}
              />
              Este cargo está pagado
            </label>
            {editForm.paid && (
              <>
                <Input
                  label="Monto pagado (Bs.)" type="number" step="0.01" min="0"
                  placeholder={editForm.amount || '0.00'}
                  value={editForm.paidAmount} onChange={e => setEditForm({ ...editForm, paidAmount: e.target.value })}
                  hint="Dejalo vacío para pago completo"
                />
                <Input
                  label="Fecha de pago" type="date"
                  value={editForm.date} onChange={e => setEditForm({ ...editForm, date: e.target.value })}
                />
                <Input
                  label="N° de recibo" value={editForm.reference}
                  onChange={e => setEditForm({ ...editForm, reference: e.target.value })}
                />
              </>
            )}
            {editing.estado === 'TRASLADADO' && (
              <div className="bg-info-500/10 border border-info-500/30 rounded-lg p-3 text-[12px] text-neutral-700">
                Este cargo ya se trasladó a la gestión activa como Deuda Anterior. Si el cargo derivado todavía no tiene pagos propios, la corrección se sincroniza automáticamente ahí también.
              </div>
            )}
          </div>
        )}
      </Modal>

      <Modal
        open={!!refunding} onClose={() => setRefunding(null)}
        title="Registrar devolución"
        footer={
          <>
            <Button variant="secondary" onClick={() => setRefunding(null)}>Cancelar</Button>
            <Button onClick={handleSaveRefund} loading={refundSaving}>Registrar</Button>
          </>
        }
      >
        {refunding && (
          <div className="flex flex-col gap-3">
            <div className="bg-neutral-100 border border-neutral-200 rounded-lg p-3 text-[12px] text-neutral-600">
              Este cargo se queda <strong>{ESTADO_LABELS[refunding.current.estado] || refunding.current.estado}</strong>, con {fmt(refunding.current.pagado)} pagados — la devolución es solo un registro informativo, no cambia el estado del cargo.
              {!!refunding.current.refunded && (
                <div className="mt-1">Ya se devolvió {fmt(refunding.current.refunded)} antes sobre este mismo cargo.</div>
              )}
            </div>
            <Input
              label="Monto devuelto (Bs.)" type="number" step="0.01" min="0" required
              value={refundForm.amount} onChange={e => setRefundForm({ ...refundForm, amount: e.target.value })}
            />
            <Input
              label="Fecha de la devolución" type="date"
              value={refundForm.date} onChange={e => setRefundForm({ ...refundForm, date: e.target.value })}
              hint="Dejalo vacío para usar la fecha de hoy"
            />
            <Input
              label="Motivo" required
              placeholder='Ej. "Pago duplicado, recibo 82627 ya cubría el mismo aporte"'
              value={refundForm.reason} onChange={e => setRefundForm({ ...refundForm, reason: e.target.value })}
            />
          </div>
        )}
      </Modal>

      <Modal
        open={!!linkingTutorFor} onClose={() => setLinkingTutorFor(null)}
        title={linkingTutorFor ? `Vincular tutor — ${linkingTutorFor.label}` : 'Vincular tutor'}
      >
        <div className="flex flex-col gap-3">
          <div className="flex bg-neutral-100 rounded-[10px] p-1 gap-1">
            <button
              onClick={() => setTutorTab('buscar')}
              className={`flex-1 py-2 rounded-lg text-[13px] transition-colors ${tutorTab === 'buscar' ? 'bg-white text-brand-700 font-semibold shadow-sm' : 'text-neutral-500'}`}
            >
              Buscar tutor existente
            </button>
            <button
              onClick={() => setTutorTab('nuevo')}
              className={`flex-1 py-2 rounded-lg text-[13px] transition-colors ${tutorTab === 'nuevo' ? 'bg-white text-brand-700 font-semibold shadow-sm' : 'text-neutral-500'}`}
            >
              Registrar tutor nuevo
            </button>
          </div>

          {tutorTab === 'buscar' ? (
            <>
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-info-500 pointer-events-none"/>
                <Input
                  placeholder="Buscar padre/madre por nombre o CI..." value={parentSearch} autoFocus
                  onChange={e => setParentSearch(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && searchParents()}
                  className="pl-9"
                />
              </div>
              <Button variant="secondary" onClick={searchParents} loading={searchingParents}>Buscar</Button>

              {parentOptions.length === 0 ? (
                <p className="text-[12px] text-neutral-400 italic py-2">
                  {parentSearch ? 'Sin resultados — probá con otro nombre o CI' : 'Escribí un nombre o CI y buscá'}
                </p>
              ) : (
                <div className="flex flex-col gap-1.5 max-h-72 overflow-y-auto">
                  {parentOptions.map(p => (
                    <div key={p.id} className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-neutral-200">
                      <div>
                        <div className="text-[13px] font-medium text-brand-700">{p.lastName} {p.firstName}</div>
                        <div className="text-[11px] text-neutral-500">
                          {p.ci ? `CI ${p.ci}` : 'Sin CI'}{p.kardex ? ` · Kardex ${p.kardex}` : ''}
                        </div>
                      </div>
                      <Button size="sm" onClick={() => handleAssignExistingTutor(p)} loading={assigningTutorId === p.id}>Asignar</Button>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <Input label="Nombres" required value={newTutorForm.firstName} onChange={e => setNewTutorForm({ ...newTutorForm, firstName: e.target.value })} />
                <Input label="Apellidos" required value={newTutorForm.lastName} onChange={e => setNewTutorForm({ ...newTutorForm, lastName: e.target.value })} />
                <Input label="CI" value={newTutorForm.ci} onChange={e => setNewTutorForm({ ...newTutorForm, ci: e.target.value })} />
                <Input label="Teléfono" value={newTutorForm.phone} onChange={e => setNewTutorForm({ ...newTutorForm, phone: e.target.value })} />
              </div>
              <Button onClick={handleCreateNewTutor} loading={creatingTutor}>
                <UserPlus size={14}/> Registrar y vincular como tutor
              </Button>
            </>
          )}
        </div>
      </Modal>

      <Modal
        open={!!importingFor} onClose={() => setImportingFor(null)}
        title={importingFor ? `Importar aportes — ${importingFor.label}` : 'Importar aportes'}
        footer={importPreview ? (
          <>
            <Button variant="secondary" onClick={() => setImportingFor(null)}>Cancelar</Button>
            <Button
              onClick={handleConfirmImport} loading={applyingImport}
              disabled={(importPreview.summary.wouldCreate ?? 0) === 0 && (importPreview.summary.wouldUpdate ?? 0) === 0}
            >
              Confirmar importación
            </Button>
          </>
        ) : (
          <Button variant="secondary" onClick={() => setImportingFor(null)}>Cerrar</Button>
        )}
      >
        <div className="flex flex-col gap-3">
          <p className="text-[12.5px] text-neutral-500">
            Columnas esperadas: <code className="text-[11px]">kardex_tutor, monto, recibo, fecha_pago</code>.
            La fila N corresponde al estudiante en la posición N de este curso (mismo orden que la tabla) — el kardex se
            valida contra el tutor real de esa posición. <code className="text-[11px]">recibo</code> vacío = no pagó,
            número = pagado, texto (ej. &quot;banca móvil&quot;) = transferencia sin confirmar todavía.
            <code className="text-[11px]"> fecha_pago</code> es siempre opcional.
          </p>

          <Select
            label="Tipo de aporte" required value={importMandatoryChargeId}
            onChange={e => { setImportMandatoryChargeId(e.target.value); setImportFile(null); setImportPreview(null) }}
          >
            <option value="">Seleccioná un tipo de aporte...</option>
            {report?.types.map(t => (
              <option key={t.mandatoryChargeId} value={t.mandatoryChargeId}>{t.title}</option>
            ))}
          </Select>

          <label className={`flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-xl py-6 transition-colors ${
            importMandatoryChargeId ? 'border-neutral-200 cursor-pointer hover:border-brand-300' : 'border-neutral-100 cursor-not-allowed opacity-50'
          }`}>
            <FileSpreadsheet size={22} className="text-neutral-400"/>
            <span className="text-[12.5px] text-neutral-600">
              {importFile ? importFile.name : importMandatoryChargeId ? 'Hacé clic para elegir el archivo CSV' : 'Elegí primero el tipo de aporte'}
            </span>
            <input
              type="file" accept=".csv" className="hidden" disabled={!importMandatoryChargeId}
              onChange={e => e.target.files?.[0] && handlePickImportFile(e.target.files[0])}
            />
          </label>

          {previewingImport && <LoadingState />}

          {importPreview && !previewingImport && (
            <>
              <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))' }}>
                <StatCard label="Se crearán" value={importPreview.summary.wouldCreate ?? importPreview.summary.created ?? 0} tone="success" />
                <StatCard label="Se actualizarán" value={importPreview.summary.wouldUpdate ?? importPreview.summary.updated ?? 0} tone="warning" />
                <StatCard label="Ya existían" value={importPreview.summary.alreadyExists ?? 0} tone="neutral" />
                <StatCard label="Rechazados" value={importPreview.summary.rejected ?? 0} tone="danger" />
                <StatCard label="Sin datos" value={importPreview.summary.skipped ?? 0} tone="neutral" />
              </div>

              <div className="flex flex-col gap-1.5 max-h-80 overflow-y-auto">
                {importPreview.results.map(r => (
                  <div key={r.row} className="flex items-start justify-between gap-2 px-3 py-2 rounded-lg border border-neutral-200">
                    <div className="min-w-0">
                      <div className="text-[11px] text-neutral-400">Fila {r.row}{r.position != null ? ` · posición ${r.position}` : ''}</div>
                      {r.status === 'rejected' ? (
                        <div className="text-[12px] text-danger-600">{r.reason}</div>
                      ) : r.status === 'skipped' ? (
                        <div className="text-[12px] text-neutral-400 italic">{r.reason}</div>
                      ) : (
                        <>
                          <div className="text-[13px] font-medium text-brand-700 truncate">{r.student} — {importPreview.tipoAporte}</div>
                          <div className="text-[11px] text-neutral-500 truncate">
                            Tutor: {r.tutor}{r.amount != null ? ` · ${fmt(r.amount)}${r.paid ? ' (pagado)' : ''}` : ''}
                          </div>
                          {r.pendingVerification && <div className="text-[11px] text-info-500 mt-0.5">🏦 {r.note}</div>}
                          {r.reason && <div className="text-[11px] text-neutral-400 mt-0.5">{r.reason}</div>}
                        </>
                      )}
                    </div>
                    <Badge tone={IMPORT_ROW_TONES[r.status]}>{IMPORT_ROW_LABELS[r.status]}</Badge>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </Modal>
    </div>
  )
}
