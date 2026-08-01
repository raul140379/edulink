'use client'

import { useEffect, useState } from 'react'
import { Plus, CalendarClock, MapPin, Users, Lock } from 'lucide-react'
import Card, { CardHeader, CardTitle } from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import { Input, Select, Textarea } from '@/components/ui/Input'
import { useToast } from '@/components/ui/ToastProvider'
import { useConfirm } from '@/components/ui/ConfirmProvider'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

const KIND_LABELS: Record<string, string> = { ORDINARIA: 'Asamblea ordinaria', EMERGENCIA: 'Asamblea de emergencia', ACTIVIDAD: 'Actividad' }
const KIND_TONE: Record<string, 'brand' | 'danger' | 'warning'> = { ORDINARIA: 'brand', EMERGENCIA: 'danger', ACTIVIDAD: 'warning' }
const AUDIENCE_LABELS: Record<string, string> = { DELEGADOS: 'Delegados', DIRECTORIO: 'Directorio', TODOS_LOS_PADRES: 'Todos los padres' }
const ROLE_LABELS: Record<string, string> = { DELEGATE: 'Delegado', JUNTA_ESCOLAR: 'Directorio', PARENT: 'Padre de familia' }

interface Attendance {
  id: number; userId: number; present: boolean; charged: boolean; note: string | null
  user: { id: number; email: string; role: string }
}

interface Convocatoria {
  id: number; title: string; description: string | null; kind: string; audience: string
  date: string; location: string | null; multaAmount: number | null
  isCancelled: boolean; isClosed: boolean
  attendances: Attendance[]
}

const emptyForm = {
  title: '', description: '', kind: 'ORDINARIA', audience: 'TODOS_LOS_PADRES',
  date: '', location: '', multaAmount: '',
}

export default function ConvocatoriaPage() {
  const toast   = useToast()
  const confirm = useConfirm()
  const [items, setItems] = useState<Convocatoria[]>([])
  const [loading, setLoading] = useState(true)

  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [attendanceFor, setAttendanceFor] = useState<Convocatoria | null>(null)
  const [attendanceDraft, setAttendanceDraft] = useState<Record<number, boolean>>({})
  const [savingAttendance, setSavingAttendance] = useState(false)

  const [academicYears, setAcademicYears] = useState<{ id: number; year: number; isActive: boolean }[]>([])
  const [closing, setClosing] = useState<number | null>(null)
  // "El Presidente debe poder convocar" — el resto de la directiva solo
  // consulta (mismo candado que ya aplica el backend en assertCanManage).
  const [isPresidente, setIsPresidente] = useState(false)

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : ''
  const auth = () => ({ Authorization: `Bearer ${token}` })

  const fetchItems = () => {
    setLoading(true)
    fetch(`${API_URL}/api/convocatorias`, { headers: auth() })
      .then(r => r.ok ? r.json() : [])
      .then(setItems)
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchItems()
    fetch(`${API_URL}/api/academic`, { headers: auth() }).then(r => r.ok ? r.json() : []).then(setAcademicYears).catch(() => {})
    fetch(`${API_URL}/api/junta/me`, { headers: auth() })
      .then(r => r.ok ? r.json() : null)
      .then(data => setIsPresidente(data?.juntaRole === 'PRESIDENTE'))
      .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleCreate = async () => {
    if (!form.title || !form.date) { setError('Título y fecha son requeridos'); return }
    setError(''); setSaving(true)
    try {
      const res  = await fetch(`${API_URL}/api/convocatorias`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...auth() },
        body: JSON.stringify({
          ...form,
          description: form.description || undefined,
          location: form.location || undefined,
          multaAmount: form.multaAmount ? parseFloat(form.multaAmount) : undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.message || 'Error al crear'); return }
      toast('Convocatoria creada correctamente', 'success')
      setShowCreate(false); setForm(emptyForm); fetchItems()
    } catch { setError('Error de conexión') }
    finally  { setSaving(false) }
  }

  const handleCancel = async (c: Convocatoria) => {
    if (!await confirm(`¿Cancelar "${c.title}"?`, { danger: true, confirmLabel: 'Cancelar convocatoria' })) return
    try {
      const res  = await fetch(`${API_URL}/api/convocatorias/${c.id}/cancel`, { method: 'PATCH', headers: auth() })
      const data = await res.json()
      if (!res.ok) { toast(data.message || 'Error al cancelar', 'error'); return }
      toast('Convocatoria cancelada', 'success'); fetchItems()
    } catch { toast('Error de conexión', 'error') }
  }

  const openAttendance = (c: Convocatoria) => {
    setAttendanceFor(c)
    const draft: Record<number, boolean> = {}
    for (const a of c.attendances) draft[a.userId] = a.present
    setAttendanceDraft(draft)
  }

  const handleSaveAttendance = async () => {
    if (!attendanceFor) return
    setSavingAttendance(true)
    try {
      const attendances = Object.entries(attendanceDraft).map(([userId, present]) => ({ userId: Number(userId), present }))
      const res  = await fetch(`${API_URL}/api/convocatorias/${attendanceFor.id}/attendance`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...auth() },
        body: JSON.stringify({ attendances }),
      })
      const data = await res.json()
      if (!res.ok) { toast(data.message || 'Error al guardar', 'error'); return }
      toast('Asistencia actualizada correctamente', 'success')
      setAttendanceFor(null); fetchItems()
    } catch { toast('Error de conexión', 'error') }
    finally  { setSavingAttendance(false) }
  }

  const handleClose = async (c: Convocatoria) => {
    const activeYear = academicYears.find(y => y.isActive)
    if (!activeYear) { toast('No hay gestión académica activa', 'error'); return }
    const msg = c.multaAmount != null
      ? `¿Cerrar "${c.title}"? Se generará una multa de Bs. ${c.multaAmount.toFixed(2)} a cada ausente.`
      : `¿Cerrar "${c.title}"? No se generarán multas (no se definió un monto).`
    if (!await confirm(msg, { danger: true, confirmLabel: 'Cerrar y generar multas' })) return
    setClosing(c.id)
    try {
      const res  = await fetch(`${API_URL}/api/convocatorias/${c.id}/close`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...auth() },
        body: JSON.stringify({ academicYearId: activeYear.id }),
      })
      const data = await res.json()
      if (!res.ok) { toast(data.message || 'Error al cerrar', 'error'); return }
      toast(data.message, 'success')
      if (data.skipped?.length > 0) {
        toast(`${data.skipped.length} ausente(s) sin padre vinculado no fueron multados`, 'error')
      }
      fetchItems()
    } catch { toast('Error de conexión', 'error') }
    finally  { setClosing(null) }
  }

  return (
    <div>
      <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-brand-700 mb-1">Convocatoria</h1>
          <p className="text-[13px] text-neutral-500">Asambleas, reuniones de delegados/directorio y actividades — con asistencia y multa automática</p>
        </div>
        {isPresidente && (
          <Button onClick={() => { setForm(emptyForm); setError(''); setShowCreate(true) }}><Plus size={16}/> Nueva convocatoria</Button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><p className="text-sm text-neutral-500">Cargando...</p></div>
      ) : items.length === 0 ? (
        <Card className="text-center py-16 text-neutral-500">
          <CalendarClock size={40} className="mx-auto mb-3 text-neutral-300"/>
          <p>Todavía no creaste ninguna convocatoria</p>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {items.map(c => {
            const absentCount = c.attendances.filter(a => !a.present).length
            return (
              <Card key={c.id}>
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex-1 min-w-[220px]">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <Badge tone={KIND_TONE[c.kind]}>{KIND_LABELS[c.kind]}</Badge>
                      <Badge tone="neutral">{AUDIENCE_LABELS[c.audience]}</Badge>
                      {c.isCancelled && <Badge tone="danger">Cancelada</Badge>}
                      {c.isClosed && <Badge tone="success"><Lock size={11}/> Cerrada</Badge>}
                    </div>
                    <div className="text-[15px] font-bold text-brand-700">{c.title}</div>
                    {c.description && <p className="text-[13px] text-neutral-500 mt-0.5">{c.description}</p>}
                    <div className="flex items-center gap-3 text-[12px] text-neutral-500 mt-1.5 flex-wrap">
                      <span className="flex items-center gap-1"><CalendarClock size={12}/> {new Date(c.date).toLocaleString('es-BO')}</span>
                      {c.location && <span className="flex items-center gap-1"><MapPin size={12}/> {c.location}</span>}
                      <span className="flex items-center gap-1"><Users size={12}/> {c.attendances.length} convocados{absentCount > 0 ? `, ${absentCount} ausente(s)` : ''}</span>
                      {c.multaAmount != null && <span className="text-[#BA7517]">Multa: Bs. {c.multaAmount.toFixed(2)}</span>}
                    </div>
                  </div>
                  {!c.isCancelled && isPresidente && (
                    <div className="flex gap-2 shrink-0">
                      <Button variant="secondary" size="sm" onClick={() => openAttendance(c)} disabled={c.isClosed}>Tomar asistencia</Button>
                      {!c.isClosed && (
                        <>
                          <Button size="sm" onClick={() => handleClose(c)} loading={closing === c.id}>Cerrar y generar multas</Button>
                          <Button variant="danger" size="sm" onClick={() => handleCancel(c)}>Cancelar</Button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {/* Modal crear */}
      <Modal
        open={showCreate} onClose={() => setShowCreate(false)} title="Nueva convocatoria"
        footer={<>
          <Button variant="secondary" onClick={() => setShowCreate(false)}>Cancelar</Button>
          <Button onClick={handleCreate} loading={saving}>Crear</Button>
        </>}
      >
        <div className="flex flex-col gap-3.5">
          {error && <p className="text-[13px] text-danger-600 bg-danger-100 rounded-lg px-3 py-2">{error}</p>}
          <Input label="Título" required value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
          <Textarea label="Descripción" rows={3} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
          <div className="grid grid-cols-2 gap-3">
            <Select label="Tipo" required value={form.kind} onChange={e => setForm({ ...form, kind: e.target.value })}>
              {Object.entries(KIND_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </Select>
            <Select label="Convocados" required value={form.audience} onChange={e => setForm({ ...form, audience: e.target.value })}>
              {Object.entries(AUDIENCE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Fecha y hora" required type="datetime-local" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
            <Input label="Lugar" value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} />
          </div>
          <Input
            label="Multa por inasistencia (Bs., opcional)" type="number" step="0.01" min="0"
            value={form.multaAmount} onChange={e => setForm({ ...form, multaAmount: e.target.value })}
          />
          <p className="text-[12px] text-neutral-500">
            Si definís un monto, al cerrar la convocatoria se genera automáticamente el cargo a cada ausente que tenga un padre/tutor vinculado.
          </p>
        </div>
      </Modal>

      {/* Modal asistencia */}
      <Modal
        open={!!attendanceFor} onClose={() => setAttendanceFor(null)} title="Tomar asistencia"
        footer={<>
          <Button variant="secondary" onClick={() => setAttendanceFor(null)}>Cancelar</Button>
          <Button onClick={handleSaveAttendance} loading={savingAttendance}>Guardar asistencia</Button>
        </>}
      >
        {attendanceFor && (
          <div className="flex flex-col gap-1.5 max-h-[380px] overflow-y-auto">
            {attendanceFor.attendances.map(a => (
              <label key={a.userId} className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg bg-neutral-100/60 cursor-pointer">
                <div>
                  <div className="text-[13px] font-medium text-brand-700">{a.user.email}</div>
                  <div className="text-[11px] text-neutral-500">{ROLE_LABELS[a.user.role] || a.user.role}{a.charged && ' · ya multado'}</div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-[11px] font-semibold ${attendanceDraft[a.userId] ? 'text-success-700' : 'text-danger-600'}`}>
                    {attendanceDraft[a.userId] ? 'Presente' : 'Ausente'}
                  </span>
                  <input
                    type="checkbox" className="w-4 h-4 accent-[var(--color-success-500)]"
                    checked={!!attendanceDraft[a.userId]}
                    onChange={e => setAttendanceDraft(prev => ({ ...prev, [a.userId]: e.target.checked }))}
                  />
                </div>
              </label>
            ))}
          </div>
        )}
      </Modal>
    </div>
  )
}
