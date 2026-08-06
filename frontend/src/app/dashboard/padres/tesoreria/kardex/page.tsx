'use client'

import { useEffect, useState } from 'react'
import { Hash, Pencil, RefreshCw } from 'lucide-react'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import Table, { Column } from '@/components/ui/Table'
import PageHeader from '@/components/ui/PageHeader'
import Toolbar from '@/components/ui/Toolbar'
import EmptyState from '@/components/ui/EmptyState'
import LoadingState from '@/components/ui/LoadingState'
import { useConfirm } from '@/components/ui/ConfirmProvider'
import { useToast } from '@/components/ui/ToastProvider'
import { useModuleFilters } from '@/hooks/useModuleFilters'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

interface Tutor {
  id: number; firstName: string; lastName: string; ci?: string; phone?: string
  email?: string; address?: string; kardex: string | null
  user: { id: number; email: string; isActive: boolean } | null
}

const emptyEditForm = { firstName: '', lastName: '', ci: '', phone: '', email: '', address: '', kardex: '' }

// Listado de tutores con su N° de kardex (el identificador propio del tutor,
// no del estudiante — ver [[junta-escolar-asistencia-qr]]).
export default function KardexPage() {
  const toast   = useToast()
  const confirm = useConfirm()
  const { filters, update } = useModuleFilters('tesoreria', { academicYearId: '', courseId: '', search: '' })
  const [tutors, setTutors]   = useState<Tutor[]>([])
  const [loading, setLoading] = useState(true)

  const [editingRow, setEditingRow] = useState<Tutor | null>(null)
  const [editForm, setEditForm] = useState(emptyEditForm)
  const [saving, setSaving] = useState(false)
  const [regenerating, setRegenerating] = useState(false)

  const token = () => (typeof window !== 'undefined' ? localStorage.getItem('token') : '') || ''
  const auth  = () => ({ Authorization: `Bearer ${token()}` })

  const fetchTutors = () => {
    setLoading(true)
    fetch(`${API_URL}/api/parents?isTutor=true`, { headers: auth() })
      .then(r => r.ok ? r.json() : [])
      .then((data: Tutor[]) => setTutors(
        [...data].sort((a, b) => {
          if (!a.kardex && !b.kardex) return 0
          if (!a.kardex) return 1
          if (!b.kardex) return -1
          return parseInt(a.kardex) - parseInt(b.kardex)
        })
      ))
      .catch(() => toast('Error de conexión', 'error'))
      .finally(() => setLoading(false))
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(fetchTutors, [])

  const search = filters.search.trim().toLowerCase()
  const visibleTutors = !search ? tutors : tutors.filter(t =>
    `${t.firstName} ${t.lastName} ${t.ci || ''}`.toLowerCase().includes(search),
  )

  const openEdit = (t: Tutor) => {
    setEditingRow(t)
    setEditForm({
      firstName: t.firstName, lastName: t.lastName, ci: t.ci || '', phone: t.phone || '',
      email: t.email || '', address: t.address || '', kardex: t.kardex || '',
    })
  }

  const handleSaveEdit = async () => {
    if (!editingRow) return
    if (!editForm.firstName.trim() || !editForm.lastName.trim()) {
      toast('Nombres y apellidos son requeridos', 'error'); return
    }
    setSaving(true)
    try {
      const res  = await fetch(`${API_URL}/api/parents/${editingRow.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json', ...auth() }, body: JSON.stringify(editForm),
      })
      const data = await res.json()
      if (!res.ok) { toast(data.message, 'error'); return }
      toast('Datos actualizados correctamente', 'success')
      setEditingRow(null)
      fetchTutors()
    } catch { toast('Error de conexión', 'error') }
    finally { setSaving(false) }
  }

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
      fetchTutors()
    } catch { toast('Error de conexión', 'error') }
    finally { setRegenerating(false) }
  }

  const columns: Column<Tutor>[] = [
    { key: 'kardex', header: 'Kardex', render: t => t.kardex
      ? <span className="font-mono text-sm font-bold text-brand-700">{t.kardex}</span>
      : <span className="text-[11px] text-danger-600">Sin kardex</span>
    },
    { key: 'tutor', header: 'Tutor', render: t => (
      <div>
        <div className="font-medium text-brand-700">{t.lastName} {t.firstName}</div>
        {t.ci && <div className="text-[11px] text-neutral-500">CI {t.ci}</div>}
      </div>
    ) },
    { key: 'telefono', header: 'Teléfono', render: t => <span className="text-[12.5px] text-neutral-500">{t.phone || '—'}</span> },
    { key: 'accion', header: 'Acción', render: t => (
      <Button size="sm" variant="secondary" onClick={() => openEdit(t)}><Pencil size={12}/> Editar tutor</Button>
    ) },
  ]

  return (
    <div>
      <PageHeader title="Kardex" description="Tutores ordenados por su número de kardex" />

      <Toolbar
        className="mb-4"
        search={{ value: filters.search, onChange: v => update({ search: v }), placeholder: 'Buscar tutor por nombre o CI...' }}
        actions={[{ key: 'refresh', label: 'Actualizar', icon: RefreshCw, onClick: fetchTutors }]}
      />

      <Card padded={false} className="overflow-hidden">
        {loading ? (
          <LoadingState />
        ) : visibleTutors.length === 0 ? (
          <EmptyState icon={Hash} message="No hay tutores registrados" />
        ) : (
          <div className="p-4">
            <Table columns={columns} rows={visibleTutors} rowKey={t => t.id} />
          </div>
        )}
      </Card>

      <Modal
        open={!!editingRow} onClose={() => setEditingRow(null)} title="Editar tutor"
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditingRow(null)}>Cancelar</Button>
            <Button onClick={handleSaveEdit} loading={saving}>Guardar</Button>
          </>
        }
      >
        {editingRow && (
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              <Input label="Nombres" required value={editForm.firstName} onChange={e => setEditForm({ ...editForm, firstName: e.target.value })} />
              <Input label="Apellidos" required value={editForm.lastName} onChange={e => setEditForm({ ...editForm, lastName: e.target.value })} />
              <Input label="CI" value={editForm.ci} onChange={e => setEditForm({ ...editForm, ci: e.target.value })} />
              <Input label="Teléfono" value={editForm.phone} onChange={e => setEditForm({ ...editForm, phone: e.target.value })} />
            </div>
            <Input label="Correo personal (opcional)" value={editForm.email} onChange={e => setEditForm({ ...editForm, email: e.target.value })} />
            <Input label="Dirección" value={editForm.address} onChange={e => setEditForm({ ...editForm, address: e.target.value })} />
            <Input label="N° Kardex" value={editForm.kardex} onChange={e => setEditForm({ ...editForm, kardex: e.target.value })} />

            <div className="border-t border-neutral-100 pt-3 flex flex-col gap-2">
              <span className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wide">Correo de acceso al sistema</span>
              {editingRow.user ? (
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
        )}
      </Modal>
    </div>
  )
}
