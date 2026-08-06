'use client'

import { useEffect, useState } from 'react'
import { Search, Users2, Pencil, RefreshCw } from 'lucide-react'
import Card from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import Table, { Column } from '@/components/ui/Table'
import { useConfirm } from '@/components/ui/ConfirmProvider'
import { useToast } from '@/components/ui/ToastProvider'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

interface Tutor {
  id: number; firstName: string; lastName: string; ci?: string; phone?: string
  email?: string; address?: string; kardex: string | null
  user: { id: number; email: string; isActive: boolean } | null
  students: { relationType: string; isTutor: boolean; student: { id: number; firstName: string; lastName: string } }[]
}

const emptyEditForm = { firstName: '', lastName: '', ci: '', phone: '', email: '', address: '', kardex: '' }

// Listado PLANO de todos los tutores del colegio (una fila por tutor, con
// todos sus estudiantes tutelados) — a diferencia de "Familias → Tutores por
// curso", acá no se agrupa por curso.
export default function TodosLosTutoresPage() {
  const toast   = useToast()
  const confirm = useConfirm()
  const [tutors, setTutors]   = useState<Tutor[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch]   = useState('')

  const [editingRow, setEditingRow] = useState<Tutor | null>(null)
  const [editForm, setEditForm] = useState(emptyEditForm)
  const [saving, setSaving] = useState(false)
  const [regenerating, setRegenerating] = useState(false)

  const token = () => (typeof window !== 'undefined' ? localStorage.getItem('token') : '') || ''
  const auth  = () => ({ Authorization: `Bearer ${token()}` })

  const fetchTutors = () => {
    setLoading(true)
    const params = new URLSearchParams({ isTutor: 'true' })
    if (search) params.set('search', search)
    fetch(`${API_URL}/api/parents?${params}`, { headers: auth() })
      .then(r => r.ok ? r.json() : [])
      .then(setTutors)
      .catch(() => toast('Error de conexión', 'error'))
      .finally(() => setLoading(false))
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(fetchTutors, [])

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
            {tutored.map((s, i) => <span key={i} className="text-[12px] text-neutral-600">{s.student.lastName} {s.student.firstName}</span>)}
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
      <Button size="sm" variant="secondary" onClick={() => openEdit(t)}><Pencil size={12}/> Editar</Button>
    ) },
  ]

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-brand-700 mb-1">Todos los tutores</h1>
        <p className="text-[13px] text-neutral-500">Listado plano de tutores del colegio, sin agrupar por curso</p>
      </div>

      <Card className="flex gap-2.5 flex-wrap items-center mb-4">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-info-500 pointer-events-none"/>
          <Input placeholder="Buscar por nombre o CI..." value={search} onChange={e => setSearch(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && fetchTutors()} className="pl-9" />
        </div>
        <Button variant="secondary" onClick={fetchTutors}>Buscar</Button>
      </Card>

      <Card padded={false} className="overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16"><p className="text-sm text-neutral-500">Cargando...</p></div>
        ) : tutors.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-neutral-500">
            <Users2 size={40} className="text-neutral-300"/>
            <p className="text-[13px]">No se encontraron tutores</p>
          </div>
        ) : (
          <div className="p-4">
            <Table columns={columns} rows={tutors} rowKey={t => t.id} />
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
