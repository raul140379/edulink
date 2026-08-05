'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import QRCode from 'qrcode'
import { UserPlus, Search, Pencil, RefreshCw, Download, XCircle } from 'lucide-react'
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

interface TutorInfo extends ParentInfo { studentName: string }

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

  const [viewMode, setViewMode] = useState<'padres' | 'tutores'>('tutores')
  const [byCourse, setByCourse] = useState<CourseGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

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
          {loading ? (
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
          <Input
            label="Correo de acceso al sistema" disabled
            value={editingRow?.user?.email || 'Sin cuenta de acceso'}
            onChange={() => {}}
          />
          <Input label="Correo personal (opcional)" type="email" value={editForm.email} onChange={e => setEditForm({ ...editForm, email: e.target.value })} />
          <Input label="Dirección" value={editForm.address} onChange={e => setEditForm({ ...editForm, address: e.target.value })} />
          <Input label="N° Kardex" value={editForm.kardex} onChange={e => setEditForm({ ...editForm, kardex: e.target.value })} />
        </div>
      </Modal>
    </div>
  )
}
