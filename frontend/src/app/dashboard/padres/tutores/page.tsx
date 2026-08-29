'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { UserPlus, Search, KeyRound, Power, Check, Pencil, RefreshCw } from 'lucide-react'
import Card from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import Table, { Column } from '@/components/ui/Table'
import Pagination from '@/components/ui/Pagination'
import { useConfirm } from '@/components/ui/ConfirmProvider'
import { useToast } from '@/components/ui/ToastProvider'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'
const PAGE_SIZE = 30

interface Tutor {
  id: number; firstName: string; lastName: string; ci: string | null
  phone: string | null; email: string | null; address: string | null; kardex: string | null
  user: { id: number; email: string; isActive: boolean } | null
  students: { isTutor: boolean; student: { id: number; firstName: string; lastName: string } }[]
}

const emptyEditForm = { firstName: '', lastName: '', ci: '', phone: '', email: '', address: '', kardex: '' }

// Cuentas de acceso de los tutores — separado de "Familias" (datos
// personales/kardex/QR): acá solo se gestiona el LOGIN — generar acceso si
// no tiene, resetear contraseña, dar de alta/baja.
export default function TutoresPage() {
  const toast   = useToast()
  const confirm = useConfirm()

  const [tutors, setTutors] = useState<Tutor[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)

  const [creds, setCreds] = useState<{ email: string; password: string; title: string } | null>(null)

  const [editingRow, setEditingRow] = useState<Tutor | null>(null)
  const [editForm, setEditForm] = useState(emptyEditForm)
  const [saving, setSaving] = useState(false)
  const [regenerating, setRegenerating] = useState(false)

  const token = () => (typeof window !== 'undefined' ? localStorage.getItem('token') : '') || ''
  const auth  = () => ({ Authorization: `Bearer ${token()}` })

  const fetchTutors = (targetPage = page) => {
    setLoading(true)
    const params = new URLSearchParams({ isTutor: 'true', page: String(targetPage), pageSize: String(PAGE_SIZE) })
    if (search) params.set('search', search)
    fetch(`${API_URL}/api/parents?${params}`, { headers: auth() })
      .then(r => r.ok ? r.json() : { data: [], total: 0 })
      .then(res => { setTutors(res.data); setTotal(res.total); setPage(targetPage) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => fetchTutors(1), [])

  const handleSearch = () => fetchTutors(1)

  const handleGenerateAccess = async (t: Tutor) => {
    if (!await confirm(`¿Generar acceso al sistema para ${t.firstName} ${t.lastName}?`)) return
    try {
      const res  = await fetch(`${API_URL}/api/parents/${t.id}/generate-credentials`, { method: 'POST', headers: auth() })
      const data = await res.json()
      if (!res.ok) { toast(data.message, 'error'); return }
      setCreds({ email: data.accessEmail, password: data.defaultPassword, title: 'Acceso generado' })
      fetchTutors()
    } catch { toast('Error de conexión', 'error') }
  }

  const handleResetPassword = async (t: Tutor) => {
    if (!await confirm(`¿Resetear la contraseña de ${t.firstName} ${t.lastName}? La contraseña anterior dejará de funcionar.`, { danger: true })) return
    try {
      const res  = await fetch(`${API_URL}/api/parents/${t.id}/reset-password`, { method: 'POST', headers: auth() })
      const data = await res.json()
      if (!res.ok) { toast(data.message, 'error'); return }
      setCreds({ email: data.accessEmail, password: data.newPassword, title: 'Contraseña reseteada' })
    } catch { toast('Error de conexión', 'error') }
  }

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

  const handleToggle = async (t: Tutor) => {
    const activar = !t.user?.isActive
    if (!await confirm(`¿${activar ? 'Dar de alta' : 'Dar de baja'} a ${t.firstName} ${t.lastName}?`, { danger: !activar })) return
    try {
      const res  = await fetch(`${API_URL}/api/parents/${t.id}/toggle`, { method: 'PATCH', headers: auth() })
      const data = await res.json()
      if (!res.ok) { toast(data.message, 'error'); return }
      toast(data.message, 'success')
      fetchTutors()
    } catch { toast('Error de conexión', 'error') }
  }

  const columns: Column<Tutor>[] = [
    { key: 'name', header: 'Nombre', render: r => (
      <div>
        <div className="font-semibold text-brand-700">{r.lastName} {r.firstName}</div>
        {r.ci && <div className="text-[11px] text-neutral-500">CI {r.ci}</div>}
      </div>
    ) },
    { key: 'students', header: 'Estudiante(s)', render: r => (
      <div className="flex flex-col gap-0.5">
        {r.students.filter(s => s.isTutor).map(s => (
          <span key={s.student.id} className="text-[12.5px]">{s.student.lastName} {s.student.firstName}</span>
        ))}
      </div>
    ) },
    { key: 'access', header: 'Acceso', render: r => r.user
      ? <Badge tone={r.user.isActive ? 'success' : 'danger'}>{r.user.isActive ? 'Activo' : 'Inactivo'}</Badge>
      : <span className="text-[12px] text-neutral-500 italic">Sin cuenta</span>
    },
    { key: 'email', header: 'Usuario', render: r => r.user
      ? <span className="text-[12px] font-mono text-neutral-700">{r.user.email}</span>
      : <span className="text-[12px] text-neutral-400">—</span>
    },
    { key: 'accion', header: 'Acción', render: r => (
      <div className="flex gap-1.5 flex-wrap">
        <Button size="sm" variant="secondary" onClick={() => openEdit(r)}><Pencil size={12}/> Editar</Button>
        {!r.user ? (
          <Button size="sm" onClick={() => handleGenerateAccess(r)}><UserPlus size={12}/> Generar acceso</Button>
        ) : (
          <>
            <Button size="sm" variant="secondary" onClick={() => handleResetPassword(r)}><KeyRound size={12}/> Resetear contraseña</Button>
            <Button size="sm" variant={r.user.isActive ? 'danger' : 'secondary'} onClick={() => handleToggle(r)}>
              <Power size={12}/> {r.user.isActive ? 'Dar de baja' : 'Dar de alta'}
            </Button>
          </>
        )}
      </div>
    ) },
  ]

  return (
    <div>
      <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-brand-700 mb-1">Cuentas de Tutor</h1>
          <p className="text-[13px] text-neutral-500">Generar acceso, resetear contraseña y dar de alta/baja a los tutores</p>
        </div>
        <Link href="/dashboard/padres/familias/nueva">
          <Button variant="secondary"><UserPlus size={16}/> Registrar Padre</Button>
        </Link>
      </div>

      <Card className="flex gap-2.5 flex-wrap items-center mb-4">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-info-500 pointer-events-none"/>
          <Input
            placeholder="Buscar tutor por nombre o CI..." value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            className="pl-9"
          />
        </div>
        <Button variant="secondary" onClick={handleSearch}>Buscar</Button>
      </Card>

      <Card padded={false} className="overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16"><p className="text-sm text-neutral-500">Cargando...</p></div>
        ) : tutors.length === 0 ? (
          <div className="flex justify-center py-16"><p className="text-sm text-neutral-500">No se encontraron tutores</p></div>
        ) : (
          <div className="p-4">
            <Table columns={columns} rows={tutors} rowKey={r => r.id} />
            <Pagination page={page} pageCount={Math.ceil(total / PAGE_SIZE)} onPageChange={fetchTutors} />
          </div>
        )}
      </Card>

      <Modal
        open={!!creds} onClose={() => setCreds(null)} title={creds?.title}
        footer={<Button onClick={() => setCreds(null)}>Entendido</Button>}
      >
        {creds && (
          <div className="flex flex-col gap-2.5">
            <p className="text-[12px] text-success-700 bg-success-100 rounded-lg px-3 py-2.5">
              <Check size={13} className="inline mr-1"/> Anota estas credenciales.
            </p>
            <div className="flex items-center gap-2.5 bg-neutral-100 border border-neutral-300 rounded-lg px-3.5 py-2.5">
              <span className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wide min-w-[80px]">Usuario:</span>
              <span className="text-sm font-semibold text-brand-700 font-mono break-all">{creds.email}</span>
            </div>
            <div className="flex items-center gap-2.5 bg-neutral-100 border border-neutral-300 rounded-lg px-3.5 py-2.5">
              <span className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wide min-w-[80px]">Contraseña:</span>
              <span className="text-sm font-semibold text-brand-700 font-mono break-all">{creds.password}</span>
            </div>
            <p className="text-[12px] text-[#8A6116] bg-warning-100 rounded-lg px-3 py-2.5">⚠️ Esta es la única vez que verás la contraseña.</p>
          </div>
        )}
      </Modal>

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
