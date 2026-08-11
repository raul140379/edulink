'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import QRCode from 'qrcode'
import { UserPlus, UserMinus, ArrowLeftRight, Search, Pencil, RefreshCw, Download, XCircle, Trash2 } from 'lucide-react'
import Card from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import Table, { Column } from '@/components/ui/Table'
import { useConfirm } from '@/components/ui/ConfirmProvider'
import { useToast } from '@/components/ui/ToastProvider'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

const GRADE_LABELS: Record<string, string> = {
  PRIMERO: '1°', SEGUNDO: '2°', TERCERO: '3°', CUARTO: '4°', QUINTO: '5°', SEXTO: '6°',
}
const SHIFT_LABELS: Record<string, string> = { MORNING: 'Mañana', AFTERNOON: 'Tarde', NIGHT: 'Noche' }
const RELATION_LABELS: Record<string, string> = {
  PADRE: 'Padre', MADRE: 'Madre', TUTOR_LEGAL: 'Tutor legal', OTRO: 'Otro',
}

interface CourseOption { id: number; level: string; grade: string; parallel: string; shift: string }

function courseLabel(c: CourseOption) {
  return `${GRADE_LABELS[c.grade] || c.grade} "${c.parallel}" · ${SHIFT_LABELS[c.shift] || c.shift}`
}

interface ParentInfo {
  id: number; firstName: string; lastName: string
  ci: string | null; phone: string | null; email: string | null; address: string | null
  kardex: string | null; attendanceCode: string | null
  relationType: string; isTutor: boolean
  user: { id: number; email: string; isActive: boolean } | null
}

interface TutorInfo extends ParentInfo { studentId: number; studentName: string }

// "Todos los tutores": listado PLANO (una fila por tutor, sin agrupar por
// curso), con todos sus estudiantes tutelados juntos — a diferencia de
// "Tutores por curso" donde el mismo tutor aparece una vez por cada curso.
interface FlatTutor extends ParentInfo {
  students: { relationType: string; isTutor: boolean; student: { id: number; firstName: string; lastName: string } }[]
}

// "Padres por curso" se agrupa por ESTUDIANTE (no por padre) — un estudiante
// con padre y madre queda en una sola fila con ambos, en vez de una fila por
// cada uno repitiendo el nombre del estudiante.
interface StudentGroup {
  studentId: number
  studentName: string
  parents: ParentInfo[]
}

interface CourseGroup {
  course: CourseOption
  padres: StudentGroup[]
  tutores: TutorInfo[]
}

const emptyEditForm = { firstName: '', lastName: '', ci: '', phone: '', email: '', address: '', kardex: '' }

// Listado de familias registradas por Junta Escolar/Delegado, agrupado por
// curso — dos vistas: "Padres" (cualquier padre/madre/tercero vinculado) y
// "Tutores" (los únicos que pueden recibir cargos, generar QR de asistencia,
// o ser parte del directorio/delegados).
export default function FamiliasPage() {
  const toast   = useToast()
  const confirm = useConfirm()

  const [viewMode, setViewMode] = useState<'padres' | 'tutores' | 'todos'>('tutores')
  const [byCourse, setByCourse] = useState<CourseGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const [allTutors, setAllTutors] = useState<FlatTutor[]>([])
  const [loadingAllTutors, setLoadingAllTutors] = useState(true)

  const [editingRow, setEditingRow] = useState<ParentInfo | null>(null)
  const [editForm, setEditForm] = useState(emptyEditForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const token = () => (typeof window !== 'undefined' ? localStorage.getItem('token') : '') || ''
  const auth  = () => ({ Authorization: `Bearer ${token()}` })

  const fetchByCourse = () => {
    setLoading(true)
    fetch(`${API_URL}/api/parents/by-course`, { headers: auth() })
      .then(r => r.ok ? r.json() : [])
      .then(setByCourse)
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(fetchByCourse, [])

  const fetchAllTutors = () => {
    setLoadingAllTutors(true)
    fetch(`${API_URL}/api/parents?isTutor=true`, { headers: auth() })
      .then(r => r.ok ? r.json() : [])
      .then(setAllTutors)
      .catch(() => toast('Error de conexión', 'error'))
      .finally(() => setLoadingAllTutors(false))
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (viewMode === 'todos') fetchAllTutors() }, [viewMode])

  const q = search.trim().toLowerCase()
  const matchesSearch = (m: ParentInfo) =>
    !q || `${m.firstName} ${m.lastName}`.toLowerCase().includes(q) || (m.ci || '').toLowerCase().includes(q)

  const byCourseFiltered = byCourse.map(g => ({
    ...g,
    padres: g.padres
      .map(sg => ({ ...sg, parents: sg.parents.filter(matchesSearch) }))
      .filter(sg => sg.parents.length > 0),
    tutores: g.tutores.filter(matchesSearch),
  }))

  const openEdit = (row: ParentInfo) => {
    setEditingRow(row)
    setEditForm({
      firstName: row.firstName, lastName: row.lastName, ci: row.ci || '',
      // Correo personal (Parent.email) — distinto y editable, separado del
      // correo de acceso (User.email, se muestra aparte y no se edita acá).
      phone: row.phone || '', email: row.email || '', address: row.address || '', kardex: row.kardex || '',
    })
    setError('')
  }

  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [regenerating, setRegenerating] = useState(false)

  const handleRegenerateEmail = async () => {
    if (!editingRow) return
    if (!await confirm(`¿Regenerar el correo de acceso institucional de ${editingRow.firstName} ${editingRow.lastName}? El correo con el que inicia sesión hoy dejará de funcionar.`, { danger: true })) return
    setRegenerating(true)
    try {
      const res  = await fetch(`${API_URL}/api/parents/${editingRow.id}/regenerate-email`, { method: 'POST', headers: auth() })
      const data = await res.json()
      if (!res.ok) { toast(data.message, 'error'); return }
      toast(`Nuevo correo de acceso: ${data.email}`, 'success')
      setEditingRow(r => r && r.user ? { ...r, user: { ...r.user, email: data.email } } : r)
      fetchByCourse()
      if (viewMode === 'todos') fetchAllTutors()
    } catch { toast('Error de conexión', 'error') }
    finally { setRegenerating(false) }
  }

  // Solo para el caso de un duplicado creado por error (ej. registro manual
  // repetido) — borra el Parent por completo (relaciones, cuenta de acceso si
  // tiene, y el registro). El backend ya bloquea el borrado si dejaría a un
  // estudiante sin ningún tutor legal.
  const handleDelete = async (row: ParentInfo) => {
    if (!await confirm(
      `¿Eliminar definitivamente a ${row.lastName} ${row.firstName}? Usá esto solo si es un registro duplicado por error — se borra su cuenta de acceso (si tiene) y todos sus vínculos. No se puede deshacer.`,
      { danger: true }
    )) return
    setDeletingId(row.id)
    try {
      const res  = await fetch(`${API_URL}/api/parents/${row.id}`, { method: 'DELETE', headers: auth() })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { toast(data.message || 'No se pudo eliminar', 'error'); return }
      toast('Registro eliminado', 'success')
      fetchByCourse()
      if (viewMode === 'todos') fetchAllTutors()
    } catch { toast('Error de conexión', 'error') }
    finally { setDeletingId(null) }
  }

  // Quita SOLO el vínculo con un estudiante puntual — a diferencia de
  // "Eliminar" no toca la cuenta del tutor ni sus otros vínculos. Pensado
  // para el caso común: dos tutores cargados por error para el mismo
  // estudiante, y hay que sacar uno sin borrar a la persona. El backend ya
  // rechaza si dejaría al estudiante sin ningún tutor legal.
  const [unlinkingKey, setUnlinkingKey] = useState<string | null>(null)
  const handleUnlink = async (parentId: number, studentId: number, studentLabel: string) => {
    if (!await confirm(`¿Desvincular a este tutor de ${studentLabel}? Su cuenta y sus otros vínculos no se ven afectados.`, { danger: true, confirmLabel: 'Desvincular' })) return
    const key = `${parentId}-${studentId}`
    setUnlinkingKey(key)
    try {
      const res  = await fetch(`${API_URL}/api/parents/${parentId}/unlink/${studentId}`, { method: 'DELETE', headers: auth() })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { toast(data.message || 'No se pudo desvincular', 'error'); return }
      toast('Vínculo eliminado', 'success')
      fetchByCourse()
      if (viewMode === 'todos') fetchAllTutors()
    } catch { toast('Error de conexión', 'error') }
    finally { setUnlinkingKey(null) }
  }

  // Todos los demás padres/tutores ya vinculados a ese estudiante — se busca
  // en "byCourse" (siempre cargado, independiente de qué vista esté activa)
  // porque ahí "padres" ya trae, por estudiante, la lista completa. Sirve
  // para decidir si tiene sentido ofrecer "Cambiar tutor" (necesita a alguien
  // más ya vinculado para promoverlo) — si el estudiante solo tiene UN padre
  // registrado, no hay a quién cambiar y esa acción no se muestra.
  const findParentsForStudent = (studentId: number): ParentInfo[] => {
    for (const g of byCourse) {
      const sg = g.padres.find(p => p.studentId === studentId)
      if (sg) return sg.parents
    }
    return []
  }

  // Cambiar tutor — promueve a OTRO padre/tutor ya vinculado a ser el tutor
  // legal, en un solo paso (a diferencia de Desvincular + Vincular por
  // separado). Requiere que el candidato ya esté vinculado al estudiante —
  // mismo candado que ya tiene el backend.
  const [changingTutorFor, setChangingTutorFor] = useState<{ studentId: number; label: string; candidates: ParentInfo[] } | null>(null)
  const [changingTutor, setChangingTutor] = useState(false)

  const openChangeTutor = (studentId: number, currentTutorId: number, studentLabel: string) => {
    const candidates = findParentsForStudent(studentId).filter(p => p.id !== currentTutorId)
    setChangingTutorFor({ studentId, label: studentLabel, candidates })
  }

  const handleChangeTutor = async (newTutorId: number) => {
    if (!changingTutorFor) return
    setChangingTutor(true)
    try {
      const res  = await fetch(`${API_URL}/api/parents/student/${changingTutorFor.studentId}/change-tutor`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json', ...auth() },
        body: JSON.stringify({ newTutorId }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { toast(data.message || 'No se pudo cambiar el tutor', 'error'); return }
      toast(data.note ? `${data.message} — ${data.note}` : data.message, 'success')
      setChangingTutorFor(null)
      fetchByCourse()
      if (viewMode === 'todos') fetchAllTutors()
    } catch { toast('Error de conexión', 'error') }
    finally { setChangingTutor(false) }
  }

  const handleSaveEdit = async () => {
    if (!editingRow) return
    if (!editForm.firstName || !editForm.lastName) { setError('Nombre y apellido son requeridos'); return }
    setError(''); setSaving(true)
    try {
      const res = await fetch(`${API_URL}/api/parents/${editingRow.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...auth() },
        body: JSON.stringify(editForm),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.message || 'Error al guardar'); return }
      toast('Tutor/padre actualizado correctamente', 'success')
      setEditingRow(null)
      fetchByCourse()
      if (viewMode === 'todos') fetchAllTutors()
    } catch { setError('Error de conexión') }
    finally { setSaving(false) }
  }

  // ---- QR / kardex de tutor ----
  const [generatingCodes, setGeneratingCodes] = useState(false)
  const [selectedTutor, setSelectedTutor] = useState<TutorInfo | null>(null)
  const [qrDataUrl, setQrDataUrl] = useState('')

  useEffect(() => {
    if (selectedTutor?.attendanceCode) {
      QRCode.toDataURL(selectedTutor.attendanceCode, {
        width: 300, margin: 2, color: { dark: '#0F172A', light: '#FFFFFF' }
      }).then(setQrDataUrl).catch(() => setQrDataUrl(''))
    } else {
      setQrDataUrl('')
    }
  }, [selectedTutor])

  const handleGenerateAllCodes = async () => {
    if (!await confirm('¿Generar códigos para los tutores que no tienen? Los existentes no se modifican.')) return
    setGeneratingCodes(true)
    try {
      const res  = await fetch(`${API_URL}/api/parents/generate-codes`, { method: 'POST', headers: auth() })
      const data = await res.json()
      if (!res.ok) { toast(data.message, 'error'); return }
      toast(data.message, 'success')
      fetchByCourse()
    } catch { toast('Error de conexión', 'error') }
    finally  { setGeneratingCodes(false) }
  }

  const handleRegenerateCode = async (tutor: TutorInfo) => {
    if (!await confirm(`¿Generar/regenerar el código de ${tutor.firstName} ${tutor.lastName}? El código anterior dejará de funcionar.`, { danger: !!tutor.attendanceCode })) return
    try {
      const res  = await fetch(`${API_URL}/api/parents/regenerate-code/${tutor.id}`, { method: 'POST', headers: auth() })
      const data = await res.json()
      if (!res.ok) { toast(data.message, 'error'); return }
      toast(`Código generado: ${data.attendanceCode}`, 'success')
      fetchByCourse()
      if (selectedTutor?.id === tutor.id) setSelectedTutor({ ...tutor, attendanceCode: data.attendanceCode })
    } catch { toast('Error de conexión', 'error') }
  }

  const handleReleaseKardex = async (tutor: TutorInfo) => {
    if (!await confirm(`¿Liberar el kardex de ${tutor.firstName} ${tutor.lastName}? Usá esto solo si la familia ya no tiene ningún estudiante en la UE. Su código QR actual dejará de funcionar y el número quedará disponible para asignarlo a otro tutor.`, { danger: true })) return
    try {
      const res  = await fetch(`${API_URL}/api/parents/${tutor.id}/release-kardex`, { method: 'POST', headers: auth() })
      const data = await res.json()
      if (!res.ok) { toast(data.message, 'error'); return }
      toast(data.message, 'success')
      fetchByCourse()
      if (selectedTutor?.id === tutor.id) setSelectedTutor({ ...tutor, kardex: null, attendanceCode: null })
    } catch { toast('Error de conexión', 'error') }
  }

  const handlePrintCode = () => {
    if (!selectedTutor || !qrDataUrl) return
    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(`
      <html><head><title>QR - ${selectedTutor.lastName} ${selectedTutor.firstName}</title>
      <style>
        body { font-family: Arial, sans-serif; display: flex; flex-direction: column; align-items: center; padding: 40px; }
        .card { border: 2px solid #0A5A45; border-radius: 12px; padding: 24px; text-align: center; max-width: 280px; }
        .name { font-size: 16px; font-weight: 700; color: #0A5A45; margin: 12px 0 4px; }
        .role { font-size: 12px; color: #6B8F7F; margin-bottom: 8px; }
        .code { font-size: 20px; font-weight: 800; letter-spacing: 4px; color: #0F172A; font-family: monospace; }
        img { width: 220px; height: 220px; }
      </style></head><body>
      <div class="card">
        <img src="${qrDataUrl}" alt="QR"/>
        <div class="name">${selectedTutor.lastName} ${selectedTutor.firstName}</div>
        <div class="role">Tutor de familia</div>
        <div class="code">${selectedTutor.attendanceCode}</div>
      </div>
      <script>window.onload=()=>{window.print();window.close()}<\/script>
      </body></html>
    `)
    win.document.close()
  }

  // "Padres por curso": una fila por ESTUDIANTE, con todos sus padres/tutores
  // agrupados en una sola columna — cada uno con su relación (Padre/Madre/...),
  // badge "Tutor" si corresponde, estado de acceso, y su propia acción Editar.
  const studentGroupColumns: Column<StudentGroup>[] = [
    { key: 'student', header: 'Estudiante', render: g => (
      <span className="font-semibold text-brand-700 text-[12.5px]">{g.studentName}</span>
    ) },
    { key: 'parents', header: 'Padres / Tutores', render: g => (
      <div className="flex flex-col gap-1">
        {g.parents.map((p, i) => (
          <div
            key={p.id}
            className={`flex items-center justify-between gap-4 flex-wrap py-1.5 ${i > 0 ? 'border-t border-neutral-100' : ''}`}
          >
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-brand-700 text-[12.5px]">{p.lastName} {p.firstName}</span>
              {p.ci && <span className="text-[11px] text-neutral-500">CI {p.ci}</span>}
              <Badge tone="neutral">{RELATION_LABELS[p.relationType] || p.relationType}</Badge>
              {p.isTutor && <Badge tone="success">Tutor</Badge>}
            </div>
            <div className="flex items-center gap-2.5 shrink-0">
              {p.user
                ? <Badge tone={p.user.isActive ? 'success' : 'danger'}>{p.user.isActive ? 'Activo' : 'Inactivo'}</Badge>
                : <span className="text-[11px] text-neutral-400 italic">Sin cuenta</span>}
              <Button size="sm" variant="secondary" onClick={() => openEdit(p)}><Pencil size={11}/> Editar</Button>
              <Button size="sm" variant="secondary" className="text-danger-600" onClick={() => handleDelete(p)} loading={deletingId === p.id}>
                <Trash2 size={11}/> Eliminar
              </Button>
            </div>
          </div>
        ))}
      </div>
    ) },
  ]

  const nameColumn: Column<TutorInfo> = { key: 'name', header: 'Nombre', render: r => (
    <div>
      <div className="font-semibold text-brand-700">{r.lastName} {r.firstName}</div>
      {r.ci && <div className="text-[11px] text-neutral-500">CI {r.ci}</div>}
    </div>
  ) }

  const accessColumn: Column<TutorInfo> = { key: 'access', header: 'Acceso', render: r => r.user
    ? <Badge tone={r.user.isActive ? 'success' : 'danger'}>{r.user.isActive ? 'Activo' : 'Inactivo'}</Badge>
    : <span className="text-[12px] text-neutral-500 italic">Sin cuenta</span>
  }

  const tutoresColumns: Column<TutorInfo>[] = [
    nameColumn,
    { key: 'student', header: 'Estudiante', render: r => <span className="text-[12.5px]">{r.studentName}</span> },
    accessColumn,
    { key: 'kardex', header: 'Kardex', render: r => r.kardex
      ? <span className="font-mono text-sm font-bold text-brand-700">{r.kardex}</span>
      : <span className="text-[11px] text-danger-600">Sin kardex</span>
    },
    { key: 'accion', header: 'Acción', render: r => (
      <div className="flex gap-1.5 flex-wrap">
        <Button size="sm" variant="secondary" onClick={() => openEdit(r)}><Pencil size={12}/> Editar</Button>
        <Button size="sm" variant="secondary" onClick={() => setSelectedTutor(r)}>Ver QR</Button>
        <Button size="sm" onClick={() => handleRegenerateCode(r)}>
          <RefreshCw size={11}/> {r.attendanceCode ? 'Regenerar' : 'Generar'}
        </Button>
        <Button
          size="sm" variant="secondary" onClick={() => handleUnlink(r.id, r.studentId, r.studentName)}
          loading={unlinkingKey === `${r.id}-${r.studentId}`}
        >
          <UserMinus size={11}/> Desvincular
        </Button>
        {findParentsForStudent(r.studentId).some(p => p.id !== r.id) && (
          <Button size="sm" variant="secondary" onClick={() => openChangeTutor(r.studentId, r.id, r.studentName)}>
            <ArrowLeftRight size={11}/> Cambiar tutor
          </Button>
        )}
        <Button size="sm" variant="secondary" className="text-danger-600" onClick={() => handleDelete(r)} loading={deletingId === r.id}>
          <Trash2 size={11}/> Eliminar
        </Button>
      </div>
    ) },
  ]

  // "Todos los tutores": una fila por tutor (sin repetir por curso), con
  // todos sus estudiantes tutelados juntos en una sola columna.
  const allTutorsFiltered = allTutors.filter(matchesSearch)
  const allTutorsColumns: Column<FlatTutor>[] = [
    { key: 'tutor', header: 'Tutor', render: t => (
      <div>
        <div className="font-medium text-brand-700">{t.lastName} {t.firstName}</div>
        {t.ci && <div className="text-[11px] text-neutral-500">CI {t.ci}</div>}
      </div>
    ) },
    { key: 'estudiantes', header: 'Estudiantes tutelados', render: t => {
      const tutored = t.students.filter(s => s.isTutor)
      return tutored.length === 0
        ? <span className="text-[11px] text-neutral-400 italic">—</span>
        : (
          <div className="flex flex-col gap-0.5">
            {tutored.map((s, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <span className="text-[12px] text-neutral-600">{s.student.lastName} {s.student.firstName}</span>
                {findParentsForStudent(s.student.id).some(p => p.id !== t.id) && (
                  <button
                    title="Cambiar tutor" onClick={() => openChangeTutor(s.student.id, t.id, `${s.student.lastName} ${s.student.firstName}`)}
                    className="text-neutral-400 hover:text-neutral-600"
                  >
                    <ArrowLeftRight size={11}/>
                  </button>
                )}
                <button
                  title="Desvincular" onClick={() => handleUnlink(t.id, s.student.id, `${s.student.lastName} ${s.student.firstName}`)}
                  disabled={unlinkingKey === `${t.id}-${s.student.id}`}
                  className="text-neutral-400 hover:text-neutral-600 text-[13px] leading-none px-0.5 disabled:opacity-40"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )
    } },
    { key: 'kardex', header: 'Kardex', render: t => t.kardex
      ? <span className="font-mono text-[12.5px] font-bold text-brand-700">{t.kardex}</span>
      : <span className="text-[11px] text-danger-600">Sin kardex</span>
    },
    { key: 'telefono', header: 'Teléfono', render: t => <span className="text-[12.5px] text-neutral-500">{t.phone || '—'}</span> },
    { key: 'cuenta', header: 'Cuenta', render: t => t.user
      ? <Badge tone={t.user.isActive ? 'success' : 'danger'}>{t.user.isActive ? 'Activa' : 'Inactiva'}</Badge>
      : <span className="text-[11px] text-neutral-400 italic">Sin cuenta</span>
    },
    { key: 'accion', header: 'Acción', render: t => (
      <div className="flex gap-1.5 flex-wrap">
        <Button size="sm" variant="secondary" onClick={() => openEdit(t)}><Pencil size={12}/> Editar</Button>
        <Button size="sm" variant="secondary" className="text-danger-600" onClick={() => handleDelete(t)} loading={deletingId === t.id}>
          <Trash2 size={11}/> Eliminar
        </Button>
      </div>
    ) },
  ]

  return (
    <div>
      <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-brand-700 mb-1">Familias registradas</h1>
          <p className="text-[13px] text-neutral-500">Padres, madres y tutores registrados, agrupados por curso</p>
        </div>
        <Link href="/dashboard/padres/familias/nueva">
          <Button><UserPlus size={16}/> Registrar Padre</Button>
        </Link>
      </div>

      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="flex gap-1 bg-neutral-100 rounded-lg p-1">
          <button
            onClick={() => setViewMode('padres')}
            className={`px-3 py-1.5 rounded-md text-[12.5px] font-semibold transition-colors ${viewMode === 'padres' ? 'bg-white text-brand-700 shadow-sm' : 'text-neutral-500'}`}
          >
            Padres por curso
          </button>
          <button
            onClick={() => setViewMode('tutores')}
            className={`px-3 py-1.5 rounded-md text-[12.5px] font-semibold transition-colors ${viewMode === 'tutores' ? 'bg-white text-brand-700 shadow-sm' : 'text-neutral-500'}`}
          >
            Tutores por curso
          </button>
          <button
            onClick={() => setViewMode('todos')}
            className={`px-3 py-1.5 rounded-md text-[12.5px] font-semibold transition-colors ${viewMode === 'todos' ? 'bg-white text-brand-700 shadow-sm' : 'text-neutral-500'}`}
          >
            Todos los tutores
          </button>
        </div>
        <div className="flex gap-2 flex-1 min-w-[220px]">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-info-500 pointer-events-none"/>
            <Input label="" placeholder="Buscar por nombre o CI" value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
        </div>
        {viewMode === 'tutores' && (
          <Button variant="secondary" onClick={handleGenerateAllCodes} disabled={generatingCodes} loading={generatingCodes}>
            {!generatingCodes && <RefreshCw size={14}/>} {generatingCodes ? 'Generando...' : 'Generar códigos faltantes'}
          </Button>
        )}
      </div>

      <div className="grid gap-4" style={viewMode === 'tutores' ? { gridTemplateColumns: '1fr 300px' } : undefined}>
        <div className="flex flex-col gap-3">
          {viewMode === 'todos' ? (
            <Card padded={false} className="overflow-hidden">
              {loadingAllTutors ? (
                <div className="flex justify-center py-16"><p className="text-sm text-neutral-500">Cargando...</p></div>
              ) : allTutorsFiltered.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-16 text-neutral-500">
                  <p className="text-[13px]">{search ? 'Nadie coincide con la búsqueda.' : 'No se encontraron tutores'}</p>
                </div>
              ) : (
                <div className="p-4">
                  <Table columns={allTutorsColumns} rows={allTutorsFiltered} rowKey={t => t.id} />
                </div>
              )}
            </Card>
          ) : loading ? (
            <Card className="text-center py-12 text-neutral-500">Cargando...</Card>
          ) : byCourseFiltered.every(g => (viewMode === 'padres' ? g.padres : g.tutores).length === 0) ? (
            <Card className="text-center py-12 text-neutral-500">
              {search ? 'Nadie coincide con la búsqueda.' : 'No hay familias registradas todavía.'}
            </Card>
          ) : byCourseFiltered
              .filter(g => (viewMode === 'padres' ? g.padres : g.tutores).length > 0 || !search)
              .map(g => {
                const parentsCount = g.padres.reduce((sum, sg) => sum + sg.parents.length, 0)
                const countLabel = viewMode === 'padres'
                  ? `${g.padres.length} estudiante(s) · ${parentsCount} padre(s)`
                  : `${g.tutores.length} tutor(es)`
                const isEmpty = viewMode === 'padres' ? g.padres.length === 0 : g.tutores.length === 0
                return (
                  <Card key={g.course.id} padded={false} className="overflow-hidden">
                    <div className="flex items-center justify-between px-4.5 py-3 border-b border-neutral-100">
                      <span className="text-[13.5px] font-bold text-brand-700">{courseLabel(g.course)}</span>
                      <span className="text-[11px] text-neutral-500">{countLabel}</span>
                    </div>
                    {isEmpty ? (
                      <p className="text-[13px] text-neutral-500 italic px-4.5 py-4">
                        Sin {viewMode === 'padres' ? 'padres' : 'tutores'} registrados en este curso
                      </p>
                    ) : (
                      <div className="p-4">
                        {viewMode === 'padres' ? (
                          <Table columns={studentGroupColumns} rows={g.padres} rowKey={sg => sg.studentId} />
                        ) : (
                          <Table columns={tutoresColumns} rows={g.tutores} rowKey={t => t.id} />
                        )}
                      </div>
                    )}
                  </Card>
                )
              })
          }
        </div>

        {viewMode === 'tutores' && (
          <Card className="sticky top-5 h-fit">
            {!selectedTutor ? (
              <div className="text-center py-10 px-4 text-neutral-500 text-[13px]">Selecciona &quot;Ver QR&quot; para ver el código de un tutor.</div>
            ) : (
              <div className="text-center">
                {qrDataUrl ? (
                  <img src={qrDataUrl} alt="QR" className="w-[200px] h-[200px] rounded-lg mx-auto"/>
                ) : (
                  <div className="w-[200px] h-[200px] bg-neutral-100 rounded-lg flex items-center justify-center mx-auto text-neutral-500 text-[13px]">
                    Sin código generado
                  </div>
                )}
                <div className="text-base font-bold text-brand-700 mt-3">{selectedTutor.lastName} {selectedTutor.firstName}</div>
                {selectedTutor.attendanceCode && (
                  <div className="text-[20px] font-extrabold tracking-[4px] text-[#0F172A] font-mono mb-4">{selectedTutor.attendanceCode}</div>
                )}
                <div className="flex gap-2 mt-2">
                  <Button variant="secondary" onClick={() => handleRegenerateCode(selectedTutor)} className="flex-1 justify-center">
                    <RefreshCw size={13}/> Regenerar
                  </Button>
                  {selectedTutor.attendanceCode && (
                    <Button onClick={handlePrintCode} className="flex-1 justify-center">
                      <Download size={13}/> Imprimir
                    </Button>
                  )}
                </div>
                {selectedTutor.kardex && (
                  <button
                    onClick={() => handleReleaseKardex(selectedTutor)}
                    className="mt-3 text-[11.5px] text-danger-600 hover:underline flex items-center gap-1 mx-auto"
                  >
                    <XCircle size={12}/> Liberar kardex
                  </button>
                )}
              </div>
            )}
          </Card>
        )}
      </div>

      <Modal
        open={!!editingRow} onClose={() => setEditingRow(null)} title="Editar Padre/Tutor"
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditingRow(null)}>Cancelar</Button>
            <Button onClick={handleSaveEdit} loading={saving}>Guardar</Button>
          </>
        }
      >
        <div className="flex flex-col gap-3.5">
          {error && <p className="text-[13px] text-danger-600 bg-danger-100 rounded-lg px-3 py-2">{error}</p>}
          <div className="grid grid-cols-2 gap-3">
            <Input label="Nombres" required value={editForm.firstName} onChange={e => setEditForm({ ...editForm, firstName: e.target.value })} />
            <Input label="Apellidos" required value={editForm.lastName} onChange={e => setEditForm({ ...editForm, lastName: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="CI" value={editForm.ci} onChange={e => setEditForm({ ...editForm, ci: e.target.value })} />
            <Input label="Teléfono" value={editForm.phone} onChange={e => setEditForm({ ...editForm, phone: e.target.value })} />
          </div>
          <Input label="Correo personal (opcional)" type="email" value={editForm.email} onChange={e => setEditForm({ ...editForm, email: e.target.value })} />
          <Input label="Dirección" value={editForm.address} onChange={e => setEditForm({ ...editForm, address: e.target.value })} />
          <Input label="N° Kardex" value={editForm.kardex} onChange={e => setEditForm({ ...editForm, kardex: e.target.value })} />

          <div className="border-t border-neutral-100 pt-3 flex flex-col gap-2">
            <span className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wide">Correo de acceso al sistema</span>
            {editingRow?.user ? (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[13px] font-mono text-brand-700 bg-neutral-100 border border-neutral-300 rounded-lg px-3 py-2 break-all">{editingRow.user.email}</span>
                <Button size="sm" variant="secondary" onClick={handleRegenerateEmail} loading={regenerating}>
                  <RefreshCw size={12}/> Regenerar correo institucional
                </Button>
              </div>
            ) : (
              <span className="text-[12px] text-neutral-500 italic">Sin cuenta de acceso</span>
            )}
          </div>
        </div>
      </Modal>

      <Modal
        open={!!changingTutorFor} onClose={() => setChangingTutorFor(null)}
        title={changingTutorFor ? `Cambiar tutor legal — ${changingTutorFor.label}` : 'Cambiar tutor legal'}
      >
        <div className="flex flex-col gap-2">
          <p className="text-[12.5px] text-neutral-500 mb-1">
            Elegí a quién promover como tutor legal. El tutor actual deja de serlo, pero sigue vinculado como antes.
          </p>
          {changingTutorFor?.candidates.map(p => (
            <div key={p.id} className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-neutral-200">
              <div>
                <div className="text-[13px] font-medium text-brand-700">{p.lastName} {p.firstName}</div>
                <div className="text-[11px] text-neutral-500">
                  {RELATION_LABELS[p.relationType] || p.relationType}{p.ci ? ` · CI ${p.ci}` : ''}
                </div>
              </div>
              <Button size="sm" onClick={() => handleChangeTutor(p.id)} loading={changingTutor}>Hacer tutor legal</Button>
            </div>
          ))}
        </div>
      </Modal>
    </div>
  )
}
