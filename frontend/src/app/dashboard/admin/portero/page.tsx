'use client'

import { useEffect, useState } from 'react'
import { Plus, X, Save, RefreshCw, Shield, Eye, EyeOff, QrCode } from 'lucide-react'
import Button from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Input'
import Card from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import Modal from '@/components/ui/Modal'
import Table, { Column } from '@/components/ui/Table'
import { useToast } from '@/components/ui/ToastProvider'
import { useConfirm } from '@/components/ui/ConfirmProvider'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

interface PorteroUser {
  id:        number
  email:     string
  role:      string
  isActive:  boolean
  createdAt: string
  staff?:    { id: number; firstName: string; lastName: string; staffRole: string }
}

export default function PorteroAdminPage() {
  const toast = useToast()
  const confirm = useConfirm()
  const [users,       setUsers]       = useState<PorteroUser[]>([])
  const [loading,     setLoading]     = useState(true)
  const [showModal,   setShowModal]   = useState(false)
  const [saving,      setSaving]      = useState(false)
  const [formError,   setFormError]   = useState('')
  const [showPass,    setShowPass]    = useState(false)
  const [resetResult, setResetResult] = useState<{email:string; password:string} | null>(null)

  const [form, setForm] = useState({
    firstName: '', lastName: '', ci: '', phone: '',
    email: '', password: '', shift: 'MORNING',
  })

  const token = () => localStorage.getItem('token') || ''
  const auth  = () => ({ Authorization: `Bearer ${token()}` })

  const diacriticsRe = new RegExp('[' + String.fromCharCode(0x0300) + '-' + String.fromCharCode(0x036f) + ']', 'g')
  const normalize = (str: string) =>
    str.toLowerCase().normalize('NFD').replace(diacriticsRe, '').replace(/\s+/g, '').replace(/[^a-z0-9]/g, '')

  const getAutoEmail = () => {
    if (!form.firstName || !form.lastName) return ''
    const first = normalize(form.firstName.split(' ')[0])
    const last  = normalize(form.lastName.split(' ')[0])
    return `${first}.${last}@nnuu.edu.bo`
  }

  const getAutoPassword = () => {
    if (form.ci && form.ci.trim()) return `port${form.ci.trim()}`
    return 'port123'
  }

  const loadUsers = async () => {
    setLoading(true)
    try {
      const res  = await fetch(`${API}/api/users?role=PORTERO`, { headers: auth() })
      const data = await res.json()
      if (res.ok) setUsers(Array.isArray(data) ? data : [])
    } catch { toast('Error de conexión', 'error') }
    finally { setLoading(false) }
  }

  useEffect(() => { loadUsers() }, [])

  const handleCreate = async () => {
    if (!form.firstName || !form.lastName) { setFormError('Nombre y apellido son requeridos'); return }

    const finalEmail    = form.email.trim()    || getAutoEmail()
    const finalPassword = form.password.trim() || getAutoPassword()

    if (!finalEmail) { setFormError('No se pudo generar el email'); return }
    if (finalPassword.length < 6) { setFormError('La contraseña debe tener al menos 6 caracteres'); return }

    setSaving(true); setFormError('')
    try {
      const resU  = await fetch(`${API}/api/users`, {
        method: 'POST',
        headers: { ...auth(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: finalEmail, password: finalPassword, role: 'PORTERO' })
      })
      const dataU = await resU.json()
      if (!resU.ok) { setFormError(dataU.message); return }

      await fetch(`${API}/api/users/${dataU.user.id}/staff`, {
        method: 'POST',
        headers: { ...auth(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: form.firstName,
          lastName:  form.lastName,
          ci:        form.ci    || null,
          phone:     form.phone || null,
          staffRole: 'PORTERO',
          shift:     form.shift,
        })
      }).catch(() => null)

      toast(`✅ Personal de seguridad creado — Email: ${finalEmail} · Contraseña: ${finalPassword}`, 'success')
      setShowModal(false)
      setForm({ firstName:'', lastName:'', ci:'', phone:'', email:'', password:'', shift:'MORNING' })
      loadUsers()
    } catch { setFormError('Error de conexión') }
    finally { setSaving(false) }
  }

  const handleToggle = async (user: PorteroUser) => {
    try {
      const res  = await fetch(`${API}/api/users/${user.id}/toggle`, { method: 'PATCH', headers: auth() })
      const data = await res.json()
      if (!res.ok) { toast(data.message, 'error'); return }
      toast(data.message, 'success')
      loadUsers()
    } catch { toast('Error de conexión', 'error') }
  }

  const handleResetPassword = async (user: PorteroUser) => {
    const ok = await confirm(`¿Restablecer contraseña de ${user.email}?`, { confirmLabel: 'Restablecer' })
    if (!ok) return
    try {
      const res  = await fetch(`${API}/api/users/${user.id}/reset-password`, { method: 'POST', headers: auth() })
      const data = await res.json()
      if (!res.ok) { toast(data.message, 'error'); return }
      setResetResult({ email: data.userEmail, password: data.newPassword })
    } catch { toast('Error de conexión', 'error') }
  }

  const autoEmail    = getAutoEmail()
  const autoPassword = getAutoPassword()

  const columns: Column<PorteroUser>[] = [
    {
      key: 'name', header: 'Nombre', render: (u) => (
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-brand-100 flex items-center justify-center text-lg shrink-0">🚪</div>
          <div>
            <div className="text-[13px] font-semibold text-brand-700">
              {u.staff ? `${u.staff.lastName} ${u.staff.firstName}` : `Seguridad #${u.id}`}
            </div>
            <div className="text-[11px] text-neutral-500">{u.email}</div>
          </div>
        </div>
      ),
    },
    { key: 'email', header: 'Email', render: (u) => <span className="text-neutral-500 text-xs">{u.email}</span> },
    { key: 'role', header: 'Rol', render: (u) => <span className="text-neutral-500 text-xs">{u.staff?.staffRole || 'PORTERO'}</span> },
    { key: 'status', header: 'Estado', render: (u) => <Badge tone={u.isActive ? 'success' : 'danger'}>{u.isActive ? '✅ Activo' : '❌ Inactivo'}</Badge> },
    {
      key: 'actions', header: 'Acciones', render: (u) => (
        <div className="flex gap-1.5">
          <Button size="sm" variant={u.isActive ? 'danger' : 'primary'} onClick={() => handleToggle(u)}>
            {u.isActive ? 'Desactivar' : 'Activar'}
          </Button>
          <Button size="sm" variant="secondary" onClick={() => handleResetPassword(u)}>
            <RefreshCw size={11} /> Reset pass
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div>
      <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-brand-700 mb-1">Usuarios de Seguridad y Control</h1>
          <p className="text-[13px] text-neutral-500">Gestiona el acceso al módulo de control de entrada</p>
        </div>
        <div className="flex gap-2.5">
          <Button variant="secondary" onClick={() => window.location.href = '/dashboard/admin/portero/codigoQR'}>
            <QrCode size={15} /> Códigos QR
          </Button>
          <Button onClick={() => setShowModal(true)}><Plus size={15} /> Nuevo personal de seguridad</Button>
        </div>
      </div>

      {resetResult && (
        <div className="bg-warning-100 border border-accent-500 rounded-[10px] px-4.5 py-3.5 mb-4">
          <div className="flex justify-between items-center mb-2">
            <span className="text-[13px] font-bold text-[#7A6000]">🔑 Nueva contraseña generada</span>
            <button onClick={() => setResetResult(null)} className="text-neutral-500 hover:text-brand-700"><X size={16} /></button>
          </div>
          <div className="text-[13px] text-brand-700"><strong>Email:</strong> {resetResult.email}</div>
          <div className="text-lg font-extrabold text-brand-700 tracking-wide mt-1 font-mono">{resetResult.password}</div>
          <div className="text-[11px] text-neutral-500 mt-1">Comparte esta contraseña con el portero.</div>
        </div>
      )}

      {users.length === 0 && !loading ? (
        <Card className="flex flex-col items-center gap-3 py-12 text-neutral-500 text-sm">
          <div className="text-4xl mb-1">🚪</div>
          <p>No hay usuarios portero registrados.</p>
          <Button onClick={() => setShowModal(true)}>Crear primer portero</Button>
        </Card>
      ) : (
        <Table columns={columns} rows={users} rowKey={(u) => u.id} loading={loading} emptyLabel="No hay usuarios portero registrados" />
      )}

      <div className="bg-info-500/10 border border-neutral-300 rounded-[10px] px-4 py-3 mt-4 text-xs">
        <div className="font-bold text-brand-700 mb-1">🔗 Acceso al módulo de portero</div>
        <div className="text-neutral-500">
          El portero accede en: <strong className="text-brand-700">{typeof window !== 'undefined' ? window.location.origin : ''}/dashboard/portero</strong>
        </div>
      </div>

      {/* Modal crear portero */}
      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title="Nuevo personal de seguridad"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowModal(false)}>Cancelar</Button>
            <Button onClick={handleCreate} loading={saving}><Save size={14} /> Crear usuario</Button>
          </>
        }
      >
        <div className="flex flex-col gap-3.5">
          <p className="text-xs text-neutral-500 -mt-2">Crear acceso al módulo de control de entrada</p>
          {formError && <p className="text-[13px] text-danger-600 bg-danger-100 rounded-lg px-3 py-2">{formError}</p>}
          <div className="grid grid-cols-2 gap-3">
            <Input label="Nombre" required placeholder="Nombre" value={form.firstName} onChange={e => setForm(p => ({ ...p, firstName: e.target.value }))} />
            <Input label="Apellido" required placeholder="Apellido" value={form.lastName} onChange={e => setForm(p => ({ ...p, lastName: e.target.value }))} />
            <Input label="CI" placeholder="Cédula de identidad" value={form.ci} onChange={e => setForm(p => ({ ...p, ci: e.target.value }))} />
            <Input label="Teléfono" placeholder="Celular" value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} />
          </div>
          <Select label="Turno" value={form.shift} onChange={e => setForm(p => ({ ...p, shift: e.target.value }))}>
            <option value="MORNING">Mañana</option>
            <option value="AFTERNOON">Tarde</option>
          </Select>

          <div className="border-t border-neutral-100 pt-3.5">
            <div className="text-[11px] font-bold text-brand-700 uppercase tracking-wide mb-2.5 flex items-center gap-1.5">
              <Shield size={13} /> Credenciales de acceso
            </div>
            <div className="flex flex-col gap-3">
              <div>
                <Input
                  label="Email (opcional)" type="email" placeholder="Se generará automáticamente si está vacío"
                  value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                />
                {!form.email && autoEmail && (
                  <p className="text-[11px] text-success-700 bg-success-100 px-2.5 py-1.5 rounded-md mt-1.5">📧 Se usará: <strong>{autoEmail}</strong></p>
                )}
              </div>
              <div>
                <span className="text-[13px] font-semibold text-neutral-700 block mb-1.5">Contraseña (opcional)</span>
                <div className="relative flex items-center">
                  <input
                    value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                    placeholder="Se generará automáticamente si está vacío"
                    type={showPass ? 'text' : 'password'}
                    className="w-full h-10 pl-3 pr-10 rounded-lg border border-neutral-300 text-sm outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/15"
                  />
                  <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 text-neutral-500 hover:text-brand-700">
                    {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {!form.password && (
                  <p className="text-[11px] text-[#633806] bg-warning-100 px-2.5 py-1.5 rounded-md mt-1.5">
                    🔑 Se usará: <strong>{autoPassword}</strong>{form.ci ? ` (port + CI: ${form.ci})` : ' (port123 — sin CI)'}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  )
}
