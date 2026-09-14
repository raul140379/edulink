'use client'

import { useEffect, useState } from 'react'
import { Plus, Search, Edit, UserCheck, UserX, Copy, Check } from 'lucide-react'
import Button from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Input'
import Badge from '@/components/ui/Badge'
import Modal from '@/components/ui/Modal'
import Table, { Column } from '@/components/ui/Table'
import { useToast } from '@/components/ui/ToastProvider'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

interface Staff {
  id:        number
  firstName: string
  lastName:  string
  ci?:       string
  phone?:    string
  email?:    string
  gender?:   string
  staffRole: string
  isActive:  boolean
  user?:     { id: number; email: string; role: string; isActive: boolean }
}

interface Credentials {
  accessEmail: string; defaultPassword: string; hint: string; name: string
}

const emptyForm = {
  firstName: '', lastName: '', ci: '', phone: '', email: '', gender: '', staffRole: '',
}

// AUXILIAR queda fuera a propósito — código muerto hoy (ningún servicio lo
// escribe), se agrega al selector si en algún momento hace falta.
const STAFF_ROLES = [
  { value: 'REGENTE',    label: 'Regente' },
  { value: 'SECRETARIA', label: 'Secretaria' },
  { value: 'PSICOLOGO',  label: 'Psicólogo/a' },
  { value: 'PORTERO',    label: 'Portero/a' },
  { value: 'OTRO',       label: 'Otro' },
]

const STAFF_ROLE_LABELS: Record<string, string> = {
  REGENTE: 'Regente', SECRETARIA: 'Secretaria', PSICOLOGO: 'Psicólogo/a', PORTERO: 'Portero/a', OTRO: 'Otro', AUXILIAR: 'Auxiliar',
}

export default function PersonalAdministrativoPage() {
  const toast = useToast()

  const [staff,        setStaff]        = useState<Staff[]>([])
  const [loading,      setLoading]      = useState(true)
  const [search,       setSearch]       = useState('')
  const [filterActive, setFilterActive] = useState('')
  const [showModal,       setShowModal]       = useState(false)
  const [showCredentials, setShowCredentials] = useState(false)
  const [editMode,     setEditMode]     = useState(false)
  const [editId,       setEditId]       = useState<number | null>(null)
  const [saving,       setSaving]       = useState(false)
  const [formError,    setFormError]    = useState('')
  const [form,         setForm]         = useState(emptyForm)
  const [creds,        setCreds]        = useState<Credentials | null>(null)
  const [copied,       setCopied]       = useState(false)

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : ''

  const fetchStaff = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (search)       params.set('search',   search)
      if (filterActive) params.set('isActive', filterActive)
      const res  = await fetch(`${API_URL}/api/staff?${params}`, { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      if (res.ok) setStaff(data)
      else toast('Error al cargar personal administrativo', 'error')
    } catch { toast('Error de conexión', 'error') }
    finally  { setLoading(false) }
  }

  useEffect(() => { fetchStaff() }, [])

  const openCreate = () => {
    setEditMode(false); setEditId(null); setForm(emptyForm); setFormError(''); setShowModal(true)
  }

  const openEdit = (s: Staff) => {
    setEditMode(true); setEditId(s.id); setFormError('')
    setForm({
      firstName: s.firstName, lastName: s.lastName, ci: s.ci || '', phone: s.phone || '',
      email: s.email || '', gender: s.gender || '', staffRole: s.staffRole,
    })
    setShowModal(true)
  }

  const handleSave = async () => {
    setFormError(''); setSaving(true)
    try {
      const url    = editMode ? `${API_URL}/api/staff/${editId}` : `${API_URL}/api/staff`
      const method = editMode ? 'PUT' : 'POST'
      const res    = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          firstName: form.firstName, lastName: form.lastName, ci: form.ci,
          phone: form.phone, email: form.email, gender: form.gender || undefined,
          staffRole: form.staffRole || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setFormError(data.message); return }

      setShowModal(false); fetchStaff()
      if (!editMode && data.accessEmail) {
        setCreds({ accessEmail: data.accessEmail, defaultPassword: data.defaultPassword, hint: data.passwordHint, name: `${form.firstName} ${form.lastName}` })
        setShowCredentials(true)
      } else {
        toast(editMode ? 'Personal actualizado correctamente' : 'Personal registrado correctamente', 'success')
      }
    } catch { setFormError('Error de conexión') }
    finally  { setSaving(false) }
  }

  const handleToggle = async (id: number) => {
    try {
      const res  = await fetch(`${API_URL}/api/staff/${id}/toggle`, { method: 'PATCH', headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      if (res.ok) { toast(data.message, 'success'); fetchStaff() }
      else toast(data.message, 'error')
    } catch { toast('Error al cambiar estado', 'error') }
  }

  const copyCreds = () => {
    if (!creds) return
    navigator.clipboard.writeText(`Personal: ${creds.name}\nEmail: ${creds.accessEmail}\nContraseña: ${creds.defaultPassword}`)
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }

  const columns: Column<Staff>[] = [
    { key: 'idx', header: '#', render: (s) => <span className="text-neutral-500">{staff.indexOf(s) + 1}</span> },
    {
      key: 'name', header: 'Nombre completo', render: (s) => (
        <div>
          <div className="font-medium text-brand-700">{s.lastName} {s.firstName}</div>
          {s.user && <div className="text-[11px] text-neutral-500 mt-0.5">{s.user.email}</div>}
          {s.email && <div className="text-[11px] text-neutral-500 mt-0.5">✉️ {s.email}</div>}
        </div>
      ),
    },
    { key: 'ci', header: 'CI', render: (s) => <span className="text-neutral-500 text-xs">{s.ci || '—'}</span> },
    { key: 'phone', header: 'Teléfono', render: (s) => <span className="text-neutral-500 text-xs">{s.phone || '—'}</span> },
    {
      key: 'gender', header: 'Género', render: (s) => s.gender
        ? <Badge tone={s.gender === 'MASCULINO' ? 'info' : 'danger'}>{s.gender === 'MASCULINO' ? '♂ Masculino' : '♀ Femenino'}</Badge>
        : <span className="text-neutral-500 text-xs">—</span>,
    },
    { key: 'role', header: 'Cargo', render: (s) => <Badge tone="brand">{STAFF_ROLE_LABELS[s.staffRole] || s.staffRole}</Badge> },
    { key: 'status', header: 'Estado', render: (s) => <Badge tone={s.isActive ? 'success' : 'danger'}>{s.isActive ? 'Activo' : 'Inactivo'}</Badge> },
    {
      key: 'actions', header: 'Acciones', render: (s) => (
        <div className="flex gap-1.5">
          <button title="Editar" onClick={() => openEdit(s)} className="w-7 h-7 rounded-md bg-accent-500/15 text-accent-600 flex items-center justify-center hover:opacity-75">
            <Edit size={13} />
          </button>
          <button title={s.isActive ? 'Desactivar' : 'Activar'} onClick={() => handleToggle(s.id)}
            className={`w-7 h-7 rounded-md flex items-center justify-center hover:opacity-75 ${s.isActive ? 'bg-danger-100 text-danger-600' : 'bg-success-100 text-success-700'}`}>
            {s.isActive ? <UserX size={13} /> : <UserCheck size={13} />}
          </button>
        </div>
      ),
    },
  ]

  return (
    <div>
      <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-brand-700 mb-1">Personal Administrativo</h1>
          <p className="text-[13px] text-neutral-500">Regente, Secretaría, Psicología, Portería y otros cargos administrativos</p>
        </div>
        <Button onClick={openCreate}><Plus size={16} /> Nuevo personal</Button>
      </div>

      <div className="flex gap-2.5 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-info-500 pointer-events-none" />
          <input
            placeholder="Buscar por nombre o CI..." value={search}
            onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && fetchStaff()}
            className="w-full h-10 pl-9 pr-3 rounded-lg border border-neutral-300 text-sm outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/15"
          />
        </div>
        <Select value={filterActive} onChange={e => setFilterActive(e.target.value)} className="w-auto min-w-[120px]">
          <option value="">Todos</option>
          <option value="true">Activos</option>
          <option value="false">Inactivos</option>
        </Select>
        <Button variant="secondary" onClick={fetchStaff}>Buscar</Button>
      </div>

      <Table columns={columns} rows={staff} rowKey={(s) => s.id} loading={loading} emptyLabel="No se encontró personal administrativo" />

      <div className="px-3.5 py-2.5 flex gap-4 text-xs text-neutral-500">
        <span>Total: <strong>{staff.length}</strong> personas</span>
      </div>

      {/* ── Modal crear/editar ── */}
      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title={editMode ? 'Editar Personal' : 'Nuevo Personal Administrativo'}
        maxWidth={560}
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowModal(false)}>Cancelar</Button>
            <Button onClick={handleSave} loading={saving}>{editMode ? 'Actualizar' : 'Registrar'}</Button>
          </>
        }
      >
        {formError && <p className="text-[13px] text-danger-600 bg-danger-100 rounded-lg px-3 py-2 mb-3.5">{formError}</p>}
        <div className="flex flex-col gap-3.5">
          {!editMode && (
            <p className="bg-neutral-100 border border-neutral-300 rounded-lg px-3 py-2.5 text-xs text-neutral-500 leading-relaxed">
              🔑 El sistema generará automáticamente un email institucional y contraseña de acceso.
            </p>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Input label="Nombres" required placeholder="Ej: Ana María" value={form.firstName} onChange={e => setForm({ ...form, firstName: e.target.value })} />
            <Input label="Apellidos" required placeholder="Ej: Flores Quispe" value={form.lastName} onChange={e => setForm({ ...form, lastName: e.target.value })} />
            <Input label="CI" placeholder="Ej: 12345678" value={form.ci} onChange={e => setForm({ ...form, ci: e.target.value })} />
            <Input label="Teléfono" placeholder="Ej: 70012345" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
            <Input label="Correo personal" type="email" placeholder="(opcional)" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
            <Select label="Género" value={form.gender} onChange={e => setForm({ ...form, gender: e.target.value })}>
              <option value="">— Seleccionar —</option>
              <option value="MASCULINO">Masculino</option>
              <option value="FEMENINO">Femenino</option>
            </Select>
            <Select label="Cargo" required value={form.staffRole} onChange={e => setForm({ ...form, staffRole: e.target.value })}>
              <option value="">— Seleccionar —</option>
              {STAFF_ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </Select>
          </div>
        </div>
      </Modal>

      {/* ── Modal credenciales ── */}
      <Modal
        open={showCredentials && !!creds}
        onClose={() => setShowCredentials(false)}
        title="✅ Personal registrado"
        footer={
          <>
            <Button variant="secondary" onClick={copyCreds}>{copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'Copiado' : 'Copiar credenciales'}</Button>
            <Button onClick={() => setShowCredentials(false)}>Entendido</Button>
          </>
        }
      >
        {creds && (
          <div className="bg-neutral-100 border border-neutral-300 rounded-xl p-4 flex flex-col gap-2.5">
            <p className="text-[13px] text-neutral-500">Credenciales de acceso para:</p>
            <p className="text-base font-bold text-brand-700">{creds.name}</p>
            <div className="flex items-center gap-2.5 bg-white border border-neutral-300 rounded-lg px-3.5 py-2.5">
              <span className="text-[12px] font-semibold text-neutral-500 uppercase tracking-wide min-w-[80px]">Email:</span>
              <span className="text-sm font-semibold text-brand-700 font-mono">{creds.accessEmail}</span>
            </div>
            <div className="flex items-center gap-2.5 bg-white border border-neutral-300 rounded-lg px-3.5 py-2.5">
              <span className="text-[12px] font-semibold text-neutral-500 uppercase tracking-wide min-w-[80px]">Contraseña:</span>
              <span className="text-sm font-semibold text-brand-700 font-mono">{creds.defaultPassword}</span>
            </div>
            <p className="text-[12px] text-success-700 bg-success-100 rounded-lg px-3 py-2.5">💡 {creds.hint}</p>
            <p className="text-[12px] text-[#8A6116] bg-warning-100 rounded-lg px-3 py-2.5">⚠️ Anota estas credenciales. La contraseña no se podrá ver de nuevo.</p>
          </div>
        )}
      </Modal>
    </div>
  )
}
