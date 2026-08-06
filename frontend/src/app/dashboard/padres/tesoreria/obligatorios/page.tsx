'use client'

import { useEffect, useState } from 'react'
import { Plus, RefreshCw, ClipboardList } from 'lucide-react'
import Card from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import { Input, Select } from '@/components/ui/Input'
import Table, { Column } from '@/components/ui/Table'
import PageHeader from '@/components/ui/PageHeader'
import Toolbar from '@/components/ui/Toolbar'
import EmptyState from '@/components/ui/EmptyState'
import LoadingState from '@/components/ui/LoadingState'
import { useConfirm } from '@/components/ui/ConfirmProvider'
import { useToast } from '@/components/ui/ToastProvider'
import { useModuleFilters } from '@/hooks/useModuleFilters'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

const TYPE_OPTIONS = [
  { value: 'CUOTA_INICIAL',  label: 'Cuota Inicial' },
  { value: 'DEUDA_ANTERIOR', label: 'Deuda Anterior' },
  { value: 'MULTA_ASAMBLEA', label: 'Multa Asamblea' },
  { value: 'MINGA',          label: 'Minga' },
  { value: 'OTRO',           label: 'Otro' },
]
const TYPE_LABELS: Record<string, string> = Object.fromEntries(TYPE_OPTIONS.map(o => [o.value, o.label]))

interface MandatoryCharge {
  id: number; title: string; description?: string; amount: number; type: string
  dueDate: string | null; isActive: boolean; createdAt: string
  academicYear: { id: number; year: number }
  _count: { charges: number }
}

interface AcademicYear { id: number; year: number; isActive: boolean }

const fmt = (n: number) => `Bs. ${n.toFixed(2)}`

// Plantillas de cargo obligatorio — al crearse se aplican de inmediato a
// todos los tutores actuales que aún no las tengan, y automáticamente a todo
// tutor nuevo que se registre mientras estén activas (parentService.createParent).
// El botón "Buscar y aplicar a faltantes" cubre a quien se haya quedado sin
// el cargo por cualquier otro motivo (cambio de tutor, etc).
export default function CargosObligatoriosPage() {
  const toast   = useToast()
  const confirm = useConfirm()
  const { filters, update } = useModuleFilters('tesoreria', { academicYearId: '', courseId: '', search: '' })

  const [items, setItems] = useState<MandatoryCharge[]>([])
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [applyingId, setApplyingId] = useState<number | null>(null)

  const [form, setForm] = useState({ title: '', description: '', amount: '', type: 'CUOTA_INICIAL', dueDate: '', academicYearId: '' })

  const token = () => (typeof window !== 'undefined' ? localStorage.getItem('token') : '') || ''
  const auth  = () => ({ Authorization: `Bearer ${token()}` })

  const fetchData = async () => {
    setLoading(true)
    try {
      const [mRes, yRes] = await Promise.all([
        fetch(`${API_URL}/api/treasury/mandatory-charges`, { headers: auth() }),
        fetch(`${API_URL}/api/academic`, { headers: auth() }),
      ])
      const [mData, yData] = await Promise.all([mRes.json(), yRes.json()])
      if (mRes.ok) setItems(mData)
      if (yRes.ok) {
        setAcademicYears(yData)
        const active = yData.find((y: AcademicYear) => y.isActive)
        if (active) setForm(f => ({ ...f, academicYearId: String(active.id) }))
      }
    } catch { toast('Error de conexión', 'error') }
    finally { setLoading(false) }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchData() }, [])

  const handleCreate = async () => {
    if (!form.title.trim() || !form.amount || !form.academicYearId) {
      toast('Título, monto y gestión son requeridos', 'error'); return
    }
    setSaving(true)
    try {
      const res  = await fetch(`${API_URL}/api/treasury/mandatory-charges`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...auth() },
        body: JSON.stringify({
          title: form.title, description: form.description || undefined, amount: parseFloat(form.amount),
          type: form.type, dueDate: form.dueDate || undefined, academicYearId: parseInt(form.academicYearId),
        }),
      })
      const data = await res.json()
      if (!res.ok) { toast(data.message, 'error'); return }
      toast(data.message, 'success')
      setShowForm(false)
      setForm({ title: '', description: '', amount: '', type: 'CUOTA_INICIAL', dueDate: '', academicYearId: form.academicYearId })
      fetchData()
    } catch { toast('Error de conexión', 'error') }
    finally { setSaving(false) }
  }

  const handleToggle = async (m: MandatoryCharge) => {
    const activar = !m.isActive
    if (!await confirm(`¿${activar ? 'Activar' : 'Desactivar'} el cargo obligatorio "${m.title}"? ${activar ? 'Volverá a aplicarse a tutores nuevos.' : 'Ya no se aplicará a tutores nuevos (los cargos ya generados no se eliminan).'}`)) return
    try {
      const res  = await fetch(`${API_URL}/api/treasury/mandatory-charges/${m.id}/toggle`, { method: 'PATCH', headers: auth() })
      const data = await res.json()
      if (!res.ok) { toast(data.message, 'error'); return }
      toast(data.message, 'success')
      fetchData()
    } catch { toast('Error de conexión', 'error') }
  }

  const handleApplyMissing = async (m: MandatoryCharge) => {
    setApplyingId(m.id)
    try {
      const res  = await fetch(`${API_URL}/api/treasury/mandatory-charges/${m.id}/apply-missing`, { method: 'POST', headers: auth() })
      const data = await res.json()
      if (!res.ok) { toast(data.message, 'error'); return }
      toast(data.message, 'success')
      fetchData()
    } catch { toast('Error de conexión', 'error') }
    finally { setApplyingId(null) }
  }

  const search = filters.search.trim().toLowerCase()
  const visibleItems = !search ? items : items.filter(m => m.title.toLowerCase().includes(search))

  const columns: Column<MandatoryCharge>[] = [
    { key: 'titulo', header: 'Cargo', render: m => (
      <div>
        <div className="font-medium text-brand-700">{m.title}</div>
        <Badge tone="neutral" className="mt-0.5">{TYPE_LABELS[m.type] || m.type}</Badge>
      </div>
    ) },
    { key: 'monto', header: 'Monto', render: m => <span className="font-semibold text-brand-700">{fmt(m.amount)}</span> },
    { key: 'gestion', header: 'Gestión', render: m => <span className="text-[12px] text-neutral-500">{m.academicYear.year}</span> },
    { key: 'aplicados', header: 'Tutores con el cargo', render: m => <span className="text-[12.5px] text-neutral-500">{m._count.charges}</span> },
    { key: 'estado', header: 'Estado', render: m => <Badge tone={m.isActive ? 'success' : 'neutral'}>{m.isActive ? 'Activo' : 'Inactivo'}</Badge> },
    { key: 'accion', header: 'Acción', render: m => (
      <div className="flex gap-1.5 flex-wrap">
        <Button size="sm" onClick={() => handleApplyMissing(m)} loading={applyingId === m.id}>
          <RefreshCw size={12}/> Buscar y aplicar a faltantes
        </Button>
        <Button size="sm" variant="secondary" onClick={() => handleToggle(m)}>{m.isActive ? 'Desactivar' : 'Activar'}</Button>
      </div>
    ) },
  ]

  return (
    <div>
      <PageHeader
        title="Cargos Obligatorios" description="Cargos que todo tutor recibe automáticamente al registrarse"
        action={<Button onClick={() => setShowForm(true)}><Plus size={16}/> Nueva plantilla obligatoria</Button>}
      />

      <Toolbar
        className="mb-4"
        search={{ value: filters.search, onChange: v => update({ search: v }), placeholder: 'Buscar por título...' }}
        actions={[{ key: 'refresh', label: 'Actualizar', icon: RefreshCw, onClick: fetchData }]}
      />

      <Card padded={false} className="overflow-hidden">
        {loading ? (
          <LoadingState />
        ) : visibleItems.length === 0 ? (
          <EmptyState icon={ClipboardList} message="Todavía no hay cargos obligatorios" />
        ) : (
          <div className="p-4">
            <Table columns={columns} rows={visibleItems} rowKey={m => m.id} />
          </div>
        )}
      </Card>

      <Modal
        open={showForm} onClose={() => setShowForm(false)} title="Nueva plantilla obligatoria"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowForm(false)}>Cancelar</Button>
            <Button onClick={handleCreate} loading={saving}>Crear y aplicar a tutores actuales</Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <Input label="Título" required placeholder="Ej: Cuota inicial 2026" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
          <div className="grid grid-cols-2 gap-3">
            <Select label="Tipo" value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
              {TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </Select>
            <Input label="Monto (Bs.)" required type="number" step="0.01" min="0" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} />
            <Select label="Gestión" required value={form.academicYearId} onChange={e => setForm({ ...form, academicYearId: e.target.value })}>
              <option value="">Selecciona gestión</option>
              {academicYears.map(y => <option key={y.id} value={y.id}>{y.year}{y.isActive ? ' (Activa)' : ''}</option>)}
            </Select>
            <Input label="Fecha de vencimiento" type="date" value={form.dueDate} onChange={e => setForm({ ...form, dueDate: e.target.value })} />
          </div>
          <Input label="Descripción (opcional)" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
          <p className="text-[11px] text-neutral-500 bg-neutral-100 border border-neutral-300 rounded-lg p-2.5">
            💡 Al crear esta plantilla se aplicará de inmediato a todos los tutores que aún no la tengan, y de ahí en más a todo tutor nuevo que se registre.
          </p>
        </div>
      </Modal>
    </div>
  )
}
