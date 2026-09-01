'use client'

import { useEffect, useState } from 'react'
import { Plus, Search, RefreshCw, UserCheck, UserX, Eye, EyeOff, KeyRound, Copy, Check, Edit, Trash2, Download, AlertTriangle } from 'lucide-react'
import Button from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Input'
import Badge from '@/components/ui/Badge'
import Modal from '@/components/ui/Modal'
import Table, { Column } from '@/components/ui/Table'
import { useToast } from '@/components/ui/ToastProvider'
import { useConfirm } from '@/components/ui/ConfirmProvider'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

interface User {
  id:        number
  email:     string
  role:      string
  isActive:  boolean
  createdAt: string
  parent?:   { firstName: string; lastName: string }
  teacher?:  { firstName: string; lastName: string }
  student?:  { firstName: string; lastName: string }
  staff?:    { firstName: string; lastName: string; staffRole: string }
}

const roleLabels: Record<string, string> = {
  SUPER_ADMIN: 'Super Admin', DIRECTOR_DISTRITAL: 'Director Distrital', DIRECTOR: 'Director', REGENTE: 'Regente',
  SECRETARY: 'Secretaria', PSICOLOGO: 'Psicóloga/o', TEACHER: 'Maestro', DELEGATE: 'Delegado',
  JUNTA_ESCOLAR: 'Junta Escolar', TEACHER_TUTOR: 'Maestro Tutor',
  PARENT: 'Padre / Tutor', STUDENT: 'Estudiante', STUDENT_GOV: 'Gob. Estudiantil', STAFF: 'Personal',
  JUNTA_NUCLEO: 'Junta de Núcleo', JUNTA_DISTRITO: 'Junta de Distrito',
  GOBIERNO_NUCLEO: 'Gob. Est. de Núcleo', GOBIERNO_DISTRITO: 'Gob. Est. de Distrito',
}

// La Junta/Gobierno de Núcleo y Distrito NO se crean desde "Nuevo usuario" (ese
// endpoint genérico solo crea el User) — tienen su propio flujo (ver modal
// "Designar Junta/Gobierno de Distrito" más abajo, y las páginas dedicadas en
// dashboard/padres/junta/nueva y dashboard/estudiantes/gobierno/nueva) porque
// además del User necesitan un JuntaMember/GobiernoMember con nombre/cargo.
const BOARD_ROLES = new Set(['JUNTA_NUCLEO', 'JUNTA_DISTRITO', 'GOBIERNO_NUCLEO', 'GOBIERNO_DISTRITO'])

// Espejo de CREATABLE_ROLES en backend/src/config/permissions.ts — el backend
// ya rechaza (403) cualquier rol fuera de esta lista, esto es solo para no
// mostrarle a cada rol opciones que igual le van a ser rechazadas. SUPER_ADMIN
// no tiene restricción (ver getCreatableRoles).
const CREATABLE_ROLES: Record<string, string[]> = {
  DIRECTOR_DISTRITAL: ['DIRECTOR', 'REGENTE', 'SECRETARY', 'JUNTA_DISTRITO', 'GOBIERNO_DISTRITO'],
  DIRECTOR: ['REGENTE', 'SECRETARY', 'PSICOLOGO', 'TEACHER', 'TEACHER_TUTOR', 'STAFF', 'PORTERO', 'PARENT', 'STUDENT', 'DELEGATE', 'JUNTA_ESCOLAR', 'STUDENT_GOV'],
  JUNTA_DISTRITO: ['JUNTA_DISTRITO', 'JUNTA_NUCLEO', 'JUNTA_ESCOLAR'],
  JUNTA_NUCLEO: ['JUNTA_ESCOLAR'],
  GOBIERNO_DISTRITO: ['GOBIERNO_NUCLEO', 'STUDENT_GOV'],
}

function getCreatableRoleLabels(currentRole: string): Record<string, string> {
  const base = Object.fromEntries(Object.entries(roleLabels).filter(([k]) => !BOARD_ROLES.has(k)))
  if (currentRole === 'SUPER_ADMIN') return base
  const allowed = new Set(CREATABLE_ROLES[currentRole] || [])
  return Object.fromEntries(Object.entries(base).filter(([k]) => allowed.has(k)))
}

// Espejo de MANAGEMENT_ROLES en backend/src/repositories/user.repository.ts — un
// DIRECTOR_DISTRITAL solo VE (en la lista/filtro) estos roles de gestión más los
// que él mismo puede crear (CREATABLE_ROLES) — cualquier otro rol siempre da
// resultado vacío para él, así que ni tiene sentido ofrecerlo como filtro.
const MANAGEMENT_ROLES_FRONT = ['DIRECTOR', 'REGENTE', 'SECRETARY', 'DIRECTOR_DISTRITAL']

function getFilterRoleLabels(currentRole: string): Record<string, string> {
  if (currentRole !== 'DIRECTOR_DISTRITAL') return roleLabels
  const allowed = new Set([...MANAGEMENT_ROLES_FRONT, ...(CREATABLE_ROLES[currentRole] || [])])
  return Object.fromEntries(Object.entries(roleLabels).filter(([k]) => allowed.has(k)))
}

const CARGO_LABELS: Record<string, string> = {
  PRESIDENTE: 'Presidente', VICEPRESIDENTE: 'Vicepresidente',
  SECRETARIA: 'Secretaria', TESORERO: 'Tesorero', VOCAL: 'Vocal',
}

// Roles que necesitan que se indique explícitamente a qué colegio pertenecen
// cuando quien crea el usuario ve/administra más de un colegio (Super Admin / Director Distrital).
const SCHOOL_SCOPED_ROLES = new Set([
  'DIRECTOR', 'REGENTE', 'SECRETARY', 'PSICOLOGO', 'TEACHER', 'TEACHER_TUTOR', 'DELEGATE',
  'JUNTA_ESCOLAR', 'PARENT', 'STUDENT', 'STUDENT_GOV', 'STAFF',
])

// Espejo de STAFF_ROLE_BY_USER_ROLE en backend/src/services/user.service.ts —
// estos roles además de la cuenta de login quedan registrados en portería
// (control de ingreso/salida), así que el backend exige nombre/apellido para
// ellos. Se valida acá también para no hacer ida y vuelta al servidor.
const STAFF_LINKED_ROLES = new Set(['REGENTE', 'SECRETARY', 'PSICOLOGO', 'STAFF', 'PORTERO'])

const RESET_OPTIONS = [
  { key: 'ALL',       label: 'Todos',          desc: 'Todos los roles permitidos' },
  { key: 'STUDENT',   label: 'Estudiantes',    desc: 'RUDE o 4 letras apellido + año' },
  { key: 'PARENT',    label: 'Padres/Tutores', desc: 'CI o 4 letras apellido + año' },
  { key: 'TEACHER',   label: 'Maestros',       desc: 'CI o 4 letras apellido + año' },
  { key: 'SECRETARY', label: 'Secretaria',     desc: 'CI o 4 letras apellido + año' },
  { key: 'REGENTE',   label: 'Regente',        desc: 'CI o 4 letras apellido + año' },
  { key: 'DELEGATE',  label: 'Delegados',      desc: 'CI o 4 letras apellido + año' },
  { key: 'STAFF',     label: 'Personal',       desc: 'CI o 4 letras apellido + año' },
]

const getUserName = (u: User): string => {
  if (u.parent)  return `${u.parent.firstName} ${u.parent.lastName}`
  if (u.teacher) return `${u.teacher.firstName} ${u.teacher.lastName}`
  if (u.student) return `${u.student.firstName} ${u.student.lastName}`
  if (u.staff)   return `${u.staff.firstName} ${u.staff.lastName}`
  return u.email.split('@')[0]
}

const generatePassword = (email: string, role: string): string => {
  const year      = new Date().getFullYear()
  const localPart = email.split('@')[0] || ''
  const last4     = localPart.slice(-4).toLowerCase()
  const prefixes: Record<string, string> = {
    PARENT: 'padre', TEACHER: 'maestro', TEACHER_TUTOR: 'maestro',
    SECRETARY: 'secretaria', PSICOLOGO: 'psicologo', STAFF: 'portero', DIRECTOR: 'director',
    REGENTE: 'regente', STUDENT: 'estudiante', DELEGATE: 'delegado',
    JUNTA_ESCOLAR: 'junta', SUPER_ADMIN: 'admin',
    JUNTA_DISTRITO: 'junta', GOBIERNO_DISTRITO: 'gobierno',
  }
  return `${prefixes[role] || 'usuario'}${last4}${year}`
}

export default function UsuariosPage() {
  const [users,          setUsers]          = useState<User[]>([])
  const [loading,        setLoading]        = useState(true)
  const [search,         setSearch]         = useState('')
  const [roleFilter,     setRoleFilter]     = useState('')
  const [showModal,      setShowModal]      = useState(false)
  const [showEditModal,  setShowEditModal]  = useState(false)
  const [saving,         setSaving]         = useState(false)
  const [formError,      setFormError]      = useState('')
  const [editError,      setEditError]      = useState('')
  const [showPass,       setShowPass]       = useState(false)
  const [duplicateEmail, setDuplicateEmail] = useState<string | null>(null)
  const [form,           setForm]           = useState({ firstName: '', lastName: '', email: '', password: '', role: 'PARENT', schoolId: '' })
  const [generatingEmail, setGeneratingEmail] = useState(false)
  const [schools,        setSchools]        = useState<{ id: number; name: string }[]>([])
  const [currentRole,    setCurrentRole]     = useState('')
  const [editForm,       setEditForm]       = useState({ id: 0, email: '', role: '' })
  const [showResetModal,   setShowResetModal]   = useState(false)
  const [resetCredentials, setResetCredentials] = useState<{ email: string; password: string } | null>(null)
  const [copied,           setCopied]           = useState(false)
  const [showNewCreds,     setShowNewCreds]     = useState(false)
  const [newCredentials,   setNewCredentials]   = useState<{ email: string; password: string } | null>(null)
  const [copiedNew,        setCopiedNew]        = useState(false)

  // ── Designar Junta/Gobierno de Distrito (solo DIRECTOR_DISTRITAL/SUPER_ADMIN) ──
  const emptyBoardForm = {
    type: 'JUNTA_DISTRITO' as 'JUNTA_DISTRITO' | 'GOBIERNO_DISTRITO',
    firstName: '', lastName: '', ci: '', phone: '',
    cargo: 'PRESIDENTE', academicYear: new Date().getFullYear(),
    email: '', password: '',
  }
  const [showBoardModal, setShowBoardModal] = useState(false)
  const [boardForm,      setBoardForm]      = useState(emptyBoardForm)
  const [boardSaving,    setBoardSaving]    = useState(false)
  const [boardError,     setBoardError]     = useState('')
  const [generatingBoardEmail, setGeneratingBoardEmail] = useState(false)

  // ── Reset masivo ──
  const [showMassReset, setShowMassReset] = useState(false)
  const [massResetting, setMassResetting] = useState(false)
  const [massSuccess,   setMassSuccess]   = useState(false)
  const [massError,     setMassError]     = useState('')
  const [confirmMass,   setConfirmMass]   = useState(false)
  const [selectedRole,  setSelectedRole]  = useState<string | null>(null)

  const toast = useToast()
  const confirm = useConfirm()
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : ''

  const fetchUsers = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (search)     params.set('search', search)
      if (roleFilter) params.set('role', roleFilter)
      const res  = await fetch(`${API_URL}/api/users?${params}`, { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      if (res.ok) setUsers(data)
    } catch { toast('Error al cargar usuarios', 'error') }
    finally  { setLoading(false) }
  }

  useEffect(() => { fetchUsers() }, [])

  useEffect(() => {
    const raw = localStorage.getItem('user')
    const role = raw ? JSON.parse(raw).role : ''
    setCurrentRole(role)
    if (role === 'SUPER_ADMIN' || role === 'DIRECTOR_DISTRITAL') {
      fetch(`${API_URL}/api/schools`, { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.ok ? r.json() : [])
        .then(setSchools)
        .catch(() => {})
    }
  }, [])

  const needsSchoolPicker = (currentRole === 'SUPER_ADMIN' || currentRole === 'DIRECTOR_DISTRITAL') && SCHOOL_SCOPED_ROLES.has(form.role)
  const creatableRoleLabels = getCreatableRoleLabels(currentRole)
  const filterRoleLabels    = getFilterRoleLabels(currentRole)

  const openCreate = () => {
    const defaultRole = 'PARENT' in creatableRoleLabels ? 'PARENT' : Object.keys(creatableRoleLabels)[0] || 'PARENT'
    setForm({ firstName: '', lastName: '', email: '', password: '', role: defaultRole, schoolId: '' })
    setShowPass(false); setFormError(''); setDuplicateEmail(null); setShowModal(true)
  }

  const handleGenerateEmail = async () => {
    if (!form.firstName || !form.lastName) { setFormError('Escribe el nombre y apellido primero'); return }
    setGeneratingEmail(true)
    try {
      const res  = await fetch(`${API_URL}/api/users/generate-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ firstName: form.firstName, lastName: form.lastName }),
      })
      const data = await res.json()
      if (!res.ok) { setFormError(data.message || 'No se pudo generar el correo'); return }
      setForm(f => ({ ...f, email: data.email })); setDuplicateEmail(null)
    } catch { setFormError('Error de conexión') }
    finally  { setGeneratingEmail(false) }
  }

  const handleGenerateBoardEmail = async () => {
    if (!boardForm.firstName || !boardForm.lastName) { setBoardError('Escribe el nombre y apellido primero'); return }
    setGeneratingBoardEmail(true)
    try {
      const res  = await fetch(`${API_URL}/api/users/generate-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ firstName: boardForm.firstName, lastName: boardForm.lastName }),
      })
      const data = await res.json()
      if (!res.ok) { setBoardError(data.message || 'No se pudo generar el correo'); return }
      setBoardForm(f => ({ ...f, email: data.email })); setBoardError('')
    } catch { setBoardError('Error de conexión') }
    finally  { setGeneratingBoardEmail(false) }
  }

  const openEdit = (u: User) => {
    setEditForm({ id: u.id, email: u.email, role: u.role })
    setEditError(''); setShowEditModal(true)
  }

  const handleCreate = async () => {
    if (!form.email || !form.password) { setFormError('El correo y la contraseña son requeridos'); return }
    if (needsSchoolPicker && !form.schoolId) { setFormError('Selecciona a qué colegio pertenece este usuario'); return }
    if (STAFF_LINKED_ROLES.has(form.role) && (!form.firstName.trim() || !form.lastName.trim())) {
      setFormError('Nombre y apellido son requeridos para este rol — queda registrado en el control de ingreso/salida de portería')
      return
    }
    setFormError(''); setSaving(true)
    try {
      const body = { ...form, schoolId: form.schoolId ? parseInt(form.schoolId) : undefined }
      const res  = await fetch(`${API_URL}/api/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) {
        setFormError(data.message)
        if (res.status === 409) setDuplicateEmail(form.email)
        return
      }
      setShowModal(false)
      setNewCredentials({ email: form.email, password: form.password })
      setShowNewCreds(true)
      setForm({ firstName: '', lastName: '', email: '', password: '', role: 'PARENT', schoolId: '' })
      fetchUsers()
    } catch { setFormError('Error de conexión') }
    finally  { setSaving(false) }
  }

  const openBoardModal = () => {
    setBoardForm(emptyBoardForm)
    setBoardError(''); setShowBoardModal(true)
  }

  const handleCreateBoard = async () => {
    if (!boardForm.email || !boardForm.password || !boardForm.firstName || !boardForm.lastName) {
      setBoardError('Completa correo, contraseña, nombre y apellido'); return
    }
    setBoardError(''); setBoardSaving(true)
    try {
      const endpoint = boardForm.type === 'JUNTA_DISTRITO' ? 'junta' : 'gobierno'
      const { type, ...body } = boardForm
      const res  = await fetch(`${API_URL}/api/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...body, role: type }),
      })
      const data = await res.json()
      if (!res.ok) { setBoardError(data.message || 'Error al crear'); return }
      setShowBoardModal(false)
      setNewCredentials({ email: boardForm.email, password: boardForm.password })
      setShowNewCreds(true)
      fetchUsers()
    } catch { setBoardError('Error de conexión') }
    finally  { setBoardSaving(false) }
  }

  const handleEdit = async () => {
    if (!editForm.email) { setEditError('El correo es requerido'); return }
    setEditError(''); setSaving(true)
    try {
      const res  = await fetch(`${API_URL}/api/users/${editForm.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ email: editForm.email, role: editForm.role }),
      })
      const data = await res.json()
      if (!res.ok) { setEditError(data.message); return }
      toast('Usuario actualizado correctamente', 'success')
      setShowEditModal(false)
      fetchUsers()
    } catch { setEditError('Error de conexión') }
    finally  { setSaving(false) }
  }

  const handleDelete = async (u: User) => {
    const ok = await confirm(`¿Eliminar el usuario ${u.email}? Esta acción no se puede deshacer.`, { danger: true, confirmLabel: 'Eliminar' })
    if (!ok) return
    try {
      const res  = await fetch(`${API_URL}/api/users/${u.id}`, {
        method: 'DELETE', headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (res.ok) { toast(data.message, 'success'); fetchUsers() }
      else toast(data.message, 'error')
    } catch { toast('Error al eliminar usuario', 'error') }
  }

  const handleResetByEmail = async () => {
    if (!duplicateEmail || !form.password) { setFormError('Ingresa una contraseña'); return }
    try {
      const res  = await fetch(`${API_URL}/api/users/reset-by-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ email: duplicateEmail, password: form.password }),
      })
      const data = await res.json()
      if (!res.ok) { setFormError(data.message); return }
      setShowModal(false); setDuplicateEmail(null)
      setNewCredentials({ email: duplicateEmail, password: form.password })
      setShowNewCreds(true)
    } catch { setFormError('Error de conexión') }
  }

  const handleToggle = async (u: User) => {
    try {
      const res  = await fetch(`${API_URL}/api/users/${u.id}/toggle`, { method: 'PATCH', headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      if (res.ok) { toast(data.message, 'success'); fetchUsers() }
      else toast(data.message, 'error')
    } catch { toast('Error al cambiar estado', 'error') }
  }

  const handleResetPassword = async (u: User) => {
    try {
      const res  = await fetch(`${API_URL}/api/users/${u.id}/reset-password`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      if (!res.ok) { toast(data.message, 'error'); return }
      setResetCredentials({ email: data.userEmail, password: data.newPassword })
      setShowResetModal(true)
    } catch { toast('Error al restablecer contraseña', 'error') }
  }

  const handleMassReset = async () => {
    if (!selectedRole) return
    setMassResetting(true); setMassError(''); setMassSuccess(false)
    try {
      const body = selectedRole === 'ALL' ? { roles: 'ALL' } : { roles: [selectedRole] }
      const res  = await fetch(`${API_URL}/api/admin/reset-credentials`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body:    JSON.stringify(body),
      })
      if (!res.ok) {
        const d = await res.json()
        setMassError(d.message || 'Error al resetear'); return
      }
      const blob = await res.blob()
      const url  = window.URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = `credenciales_${selectedRole.toLowerCase()}_${new Date().getFullYear()}.xlsx`
      document.body.appendChild(a); a.click()
      document.body.removeChild(a); window.URL.revokeObjectURL(url)
      setMassSuccess(true); setConfirmMass(false)
    } catch {
      setMassError('Error de conexión')
    } finally {
      setMassResetting(false)
    }
  }

  const copyReset = () => {
    if (!resetCredentials) return
    navigator.clipboard.writeText(`Email: ${resetCredentials.email}\nContraseña: ${resetCredentials.password}`)
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }
  const copyNew = () => {
    if (!newCredentials) return
    navigator.clipboard.writeText(`Email: ${newCredentials.email}\nContraseña: ${newCredentials.password}`)
    setCopiedNew(true); setTimeout(() => setCopiedNew(false), 2000)
  }

  const filtered = users.filter(u => {
    const name = getUserName(u).toLowerCase()
    const q    = search.toLowerCase()
    return name.includes(q) || u.email.toLowerCase().includes(q)
  })

  const selectedOpt = RESET_OPTIONS.find(o => o.key === selectedRole)

  const columns: Column<User>[] = [
    { key: 'idx',    header: '#',       render: (u) => <span className="text-neutral-500">{filtered.indexOf(u) + 1}</span> },
    { key: 'name',   header: 'Nombre',  render: (u) => <span className="font-semibold">{getUserName(u)}</span> },
    { key: 'email',  header: 'Correo',  render: (u) => <span className="text-neutral-500">{u.email}</span> },
    { key: 'role',   header: 'Rol',     render: (u) => <Badge tone="brand">{roleLabels[u.role] || u.role}</Badge> },
    { key: 'status', header: 'Estado',  render: (u) => <Badge tone={u.isActive ? 'success' : 'danger'}>{u.isActive ? 'Activo' : 'Inactivo'}</Badge> },
    { key: 'date',   header: 'Fecha',   render: (u) => <span className="text-neutral-500">{new Date(u.createdAt).toLocaleDateString('es-BO')}</span> },
    {
      key: 'actions', header: 'Acciones', render: (u) => (
        <div className="flex gap-1.5">
          <button title="Editar" onClick={() => openEdit(u)} className="w-8 h-8 rounded-md bg-accent-500/15 text-accent-600 flex items-center justify-center hover:opacity-75">
            <Edit size={14} />
          </button>
          <button title="Restablecer contraseña" onClick={() => handleResetPassword(u)} className="w-8 h-8 rounded-md bg-brand-100 text-brand-700 flex items-center justify-center hover:opacity-75">
            <KeyRound size={14} />
          </button>
          <button title={u.isActive ? 'Desactivar' : 'Activar'} onClick={() => handleToggle(u)}
            className={`w-8 h-8 rounded-md flex items-center justify-center hover:opacity-75 ${u.isActive ? 'bg-danger-100 text-danger-600' : 'bg-success-100 text-success-700'}`}>
            {u.isActive ? <UserX size={14} /> : <UserCheck size={14} />}
          </button>
          <button title="Eliminar" onClick={() => handleDelete(u)} className="w-8 h-8 rounded-md bg-danger-100 text-danger-600 flex items-center justify-center hover:opacity-75">
            <Trash2 size={14} />
          </button>
        </div>
      ),
    },
  ]

  return (
    <div>
      <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-brand-700 mb-1">Gestión de Usuarios</h1>
          <p className="text-[13px] text-neutral-500">Administra los usuarios y roles del sistema</p>
        </div>
        <div className="flex gap-2.5">
          {(currentRole === 'DIRECTOR_DISTRITAL' || currentRole === 'SUPER_ADMIN') && (
            <Button variant="secondary" onClick={openBoardModal}>
              <Plus size={16} /> Junta / Gobierno de Distrito
            </Button>
          )}
          <Button variant="secondary" onClick={() => { setShowMassReset(true); setConfirmMass(false); setMassSuccess(false); setMassError(''); setSelectedRole(null) }}>
            <Download size={16} /> Resetear Credenciales
          </Button>
          <Button onClick={openCreate}><Plus size={16} /> Nuevo usuario</Button>
        </div>
      </div>

      <div className="flex gap-2.5 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-info-500 pointer-events-none" />
          <input
            placeholder="Buscar por nombre o correo..." value={search}
            onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && fetchUsers()}
            className="w-full h-10 pl-9 pr-3 rounded-lg border border-neutral-300 text-sm outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/15"
          />
        </div>
        <Select value={roleFilter} onChange={e => setRoleFilter(e.target.value)} className="w-auto min-w-[160px]">
          <option value="">Todos los roles</option>
          {Object.entries(filterRoleLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </Select>
        <Button variant="secondary" onClick={fetchUsers}><RefreshCw size={15} /> Buscar</Button>
      </div>

      <Table
        columns={columns}
        rows={filtered}
        rowKey={(u) => u.id}
        loading={loading}
        emptyLabel="No se encontraron usuarios"
      />
      <div className="px-3.5 py-2.5 text-xs text-neutral-500">Total: <strong>{filtered.length}</strong> usuarios</div>

      {/* ── Modal Reset Masivo ── */}
      <Modal
        open={showMassReset}
        onClose={() => !massResetting && setShowMassReset(false)}
        title="🔄 Resetear Credenciales"
        maxWidth={480}
        footer={massSuccess ? <Button onClick={() => setShowMassReset(false)}>Cerrar</Button> : undefined}
      >
        {massSuccess ? (
          <p className="text-[13px] text-success-700 bg-success-100 rounded-lg px-3 py-2.5">
            ✅ Credenciales reseteadas. El Excel se descargó automáticamente.
          </p>
        ) : (
          <div className="flex flex-col gap-3.5">
            <p className="text-[13px] font-semibold text-brand-700">¿A qué usuarios deseas resetear la contraseña?</p>

            <div className="grid grid-cols-2 gap-2">
              {RESET_OPTIONS.map(opt => (
                <button
                  key={opt.key}
                  onClick={() => { setSelectedRole(opt.key); setConfirmMass(false) }}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-left border-2 transition-colors ${
                    selectedRole === opt.key ? 'border-brand-700 bg-brand-100' : 'border-neutral-300 bg-white hover:bg-neutral-100'
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-[12px] font-bold text-brand-700">{opt.label}</div>
                    <div className="text-[10px] text-neutral-500 truncate">{opt.desc}</div>
                  </div>
                  {selectedRole === opt.key && <Check size={14} className="text-brand-700 shrink-0" />}
                </button>
              ))}
            </div>

            <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-warning-100 text-[12px] text-[#8A6116] leading-relaxed">
              <AlertTriangle size={14} className="shrink-0 mt-0.5" />
              <span><strong>Super Admin, Director y Junta Escolar NO serán afectados.</strong></span>
            </div>

            {massError && <p className="text-[13px] text-danger-600 bg-danger-100 rounded-lg px-3 py-2">{massError}</p>}

            {selectedRole && !confirmMass && (
              <Button className="w-full justify-center" onClick={() => setConfirmMass(true)}>
                <Download size={16} /> Resetear &quot;{selectedOpt?.label}&quot; y Descargar Excel
              </Button>
            )}

            {confirmMass && selectedRole && (
              <div className="flex flex-col gap-2.5">
                <p className="text-[13px] font-semibold text-danger-600 text-center bg-danger-100 rounded-lg px-3 py-2">
                  ⚠️ ¿Confirmas resetear contraseñas de <strong>{selectedOpt?.label}</strong>?
                </p>
                <div className="flex gap-2.5">
                  <Button variant="danger" loading={massResetting} onClick={handleMassReset} className="flex-1 justify-center">
                    <Download size={15} /> Sí, confirmar
                  </Button>
                  <Button variant="secondary" disabled={massResetting} onClick={() => setConfirmMass(false)} className="flex-1 justify-center">
                    Cancelar
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* ── Modal Junta/Gobierno de Distrito ── */}
      <Modal
        open={showBoardModal}
        onClose={() => setShowBoardModal(false)}
        title="Designar Junta / Gobierno de Distrito"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowBoardModal(false)}>Cancelar</Button>
            <Button onClick={handleCreateBoard} loading={boardSaving}>Crear</Button>
          </>
        }
      >
        <div className="flex flex-col gap-3.5">
          {boardError && <p className="text-[13px] text-danger-600 bg-danger-100 rounded-lg px-3 py-2">{boardError}</p>}
          <Select label="Tipo" required value={boardForm.type} onChange={e => setBoardForm({ ...boardForm, type: e.target.value as any })}>
            <option value="JUNTA_DISTRITO">Junta de Distrito</option>
            <option value="GOBIERNO_DISTRITO">Gobierno Estudiantil de Distrito</option>
          </Select>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Nombres" required value={boardForm.firstName} onChange={e => setBoardForm({ ...boardForm, firstName: e.target.value })} />
            <Input label="Apellidos" required value={boardForm.lastName} onChange={e => setBoardForm({ ...boardForm, lastName: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="CI" value={boardForm.ci} onChange={e => setBoardForm({ ...boardForm, ci: e.target.value })} />
            <Input label="Teléfono" value={boardForm.phone} onChange={e => setBoardForm({ ...boardForm, phone: e.target.value })} />
          </div>
          <Select label="Cargo" required value={boardForm.cargo} onChange={e => setBoardForm({ ...boardForm, cargo: e.target.value })}>
            {Object.entries(CARGO_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Select>
          <div>
            <Input label="Correo electrónico" required type="email" value={boardForm.email}
              onChange={e => setBoardForm({ ...boardForm, email: e.target.value })} />
            <button
              type="button" onClick={handleGenerateBoardEmail} disabled={generatingBoardEmail}
              className="flex items-center gap-1.5 border border-dashed border-neutral-300 text-info-500 rounded-md px-2.5 py-1.5 text-[11px] w-fit mt-1.5 hover:bg-neutral-100 hover:border-info-500"
            >
              <RefreshCw size={12} /> {generatingBoardEmail ? 'Generando...' : 'Generar correo automático'}
            </button>
          </div>
          <div>
            <Input label="Contraseña" required type="password" value={boardForm.password}
              onChange={e => setBoardForm({ ...boardForm, password: e.target.value })} />
            <button
              type="button"
              onClick={() => {
                if (!boardForm.email) { setBoardError('Ingresa el correo primero'); return }
                setBoardForm(f => ({ ...f, password: generatePassword(f.email, f.type) }))
              }}
              className="flex items-center gap-1.5 border border-dashed border-neutral-300 text-info-500 rounded-md px-2.5 py-1.5 text-[11px] w-fit mt-1.5 hover:bg-neutral-100 hover:border-info-500"
            >
              <RefreshCw size={12} /> Generar contraseña automática
            </button>
          </div>
        </div>
      </Modal>

      {/* ── Modal nuevo usuario ── */}
      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title="Nuevo Usuario"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowModal(false)}>Cancelar</Button>
            <Button onClick={handleCreate} loading={saving} disabled={!form.email || !form.password}>Crear usuario</Button>
          </>
        }
      >
        <div className="flex flex-col gap-3.5">
          {formError && <p className="text-[13px] text-danger-600 bg-danger-100 rounded-lg px-3 py-2">{formError}</p>}
          <div className="grid grid-cols-2 gap-3">
            <Input label="Nombres" placeholder="Para generar el correo" value={form.firstName}
              onChange={e => setForm({ ...form, firstName: e.target.value })} />
            <Input label="Apellidos" placeholder="Para generar el correo" value={form.lastName}
              onChange={e => setForm({ ...form, lastName: e.target.value })} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Input label="Correo electrónico" required type="email" placeholder="usuario@nnuu.edu.bo" value={form.email}
              onChange={e => { setForm({ ...form, email: e.target.value }); setDuplicateEmail(null) }} />
            <button
              type="button" onClick={handleGenerateEmail} disabled={generatingEmail}
              className="flex items-center gap-1.5 border border-dashed border-neutral-300 text-info-500 rounded-md px-2.5 py-1.5 text-[11px] w-fit hover:bg-neutral-100 hover:border-info-500 disabled:opacity-50"
            >
              <RefreshCw size={12} /> {generatingEmail ? 'Generando...' : 'Generar correo automático'}
            </button>
          </div>
          <Select label="Rol" required value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>
            {Object.entries(creatableRoleLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Select>
          {needsSchoolPicker && (
            <Select label="Colegio" required value={form.schoolId} onChange={e => setForm({ ...form, schoolId: e.target.value })}>
              <option value="">Selecciona un colegio</option>
              {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
          )}
          <div className="flex flex-col gap-1.5">
            <span className="text-[13px] font-semibold text-neutral-700">Contraseña<span className="text-danger-500"> *</span></span>
            <div className="relative flex items-center">
              <input
                type={showPass ? 'text' : 'password'} placeholder="Escribe o genera automáticamente"
                value={form.password} onChange={e => setForm({ ...form, password: e.target.value })}
                className="w-full h-10 pl-3 pr-10 rounded-lg border border-neutral-300 text-sm outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/15"
              />
              <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 text-neutral-500 hover:text-brand-700">
                {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
            <button
              type="button"
              onClick={() => {
                if (!form.email) { setFormError('Ingresa el correo primero'); return }
                setForm({ ...form, password: generatePassword(form.email, form.role) }); setShowPass(true)
              }}
              className="flex items-center gap-1.5 border border-dashed border-neutral-300 text-info-500 rounded-md px-2.5 py-1.5 text-[11px] w-fit hover:bg-neutral-100 hover:border-info-500"
            >
              <RefreshCw size={12} /> Generar contraseña automática
            </button>
            {form.password && (
              <div className="flex items-center gap-2 mt-0.5">
                <span className={`h-1 w-16 rounded-full ${form.password.length >= 8 ? 'bg-success-500' : 'bg-accent-500'}`} />
                <span className="text-[11px] text-neutral-500">{form.password.length < 6 ? 'Muy corta' : form.password.length < 8 ? 'Aceptable' : 'Segura'}</span>
              </div>
            )}
          </div>
          {duplicateEmail && (
            <div className="bg-warning-100 border border-accent-500 rounded-lg px-3.5 py-3 text-[13px] text-[#8A6116] leading-relaxed flex flex-col gap-2">
              ⚠️ Este correo ya está registrado. ¿Deseas resetear su contraseña?
              <button onClick={handleResetByEmail} className="bg-brand-700 text-white rounded-md px-3 py-1.5 text-xs font-semibold w-fit hover:bg-brand-600">
                Sí, resetear contraseña →
              </button>
            </div>
          )}
          <p className="bg-neutral-100 border border-neutral-300 rounded-lg px-3 py-2.5 text-xs text-neutral-500 leading-relaxed">
            💡 Después de crear el usuario podrás vincularle el perfil desde el módulo respectivo.
          </p>
        </div>
      </Modal>

      {/* ── Modal editar usuario ── */}
      <Modal
        open={showEditModal}
        onClose={() => setShowEditModal(false)}
        title="Editar Usuario"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowEditModal(false)}>Cancelar</Button>
            <Button onClick={handleEdit} loading={saving}>Actualizar</Button>
          </>
        }
      >
        <div className="flex flex-col gap-3.5">
          {editError && <p className="text-[13px] text-danger-600 bg-danger-100 rounded-lg px-3 py-2">{editError}</p>}
          <Input label="Correo electrónico" required type="email" value={editForm.email}
            onChange={e => setEditForm({ ...editForm, email: e.target.value })} />
          <Select label="Rol" required value={editForm.role} onChange={e => setEditForm({ ...editForm, role: e.target.value })}>
            {Object.entries(roleLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Select>
          <p className="bg-neutral-100 border border-neutral-300 rounded-lg px-3 py-2.5 text-xs text-neutral-500 leading-relaxed">
            💡 Para cambiar la contraseña usa el botón de restablecer en la lista.
          </p>
        </div>
      </Modal>

      {/* ── Modal credenciales nuevo usuario ── */}
      <Modal
        open={showNewCreds && !!newCredentials}
        onClose={() => setShowNewCreds(false)}
        title="✅ Credenciales del usuario"
        footer={
          <>
            <Button variant="secondary" onClick={copyNew}>{copiedNew ? <Check size={14} /> : <Copy size={14} />} {copiedNew ? 'Copiado' : 'Copiar'}</Button>
            <Button onClick={() => setShowNewCreds(false)}>Entendido</Button>
          </>
        }
      >
        {newCredentials && (
          <div className="flex flex-col gap-2.5">
            <p className="text-[12px] text-success-700 bg-success-100 rounded-lg px-3 py-2.5">✅ Operación realizada. Anota estas credenciales.</p>
            <CredRow label="Email" value={newCredentials.email} />
            <CredRow label="Contraseña" value={newCredentials.password} />
            <p className="text-[12px] text-[#8A6116] bg-warning-100 rounded-lg px-3 py-2.5">⚠️ Esta es la única vez que verás la contraseña.</p>
          </div>
        )}
      </Modal>

      {/* ── Modal resetear contraseña individual ── */}
      <Modal
        open={showResetModal && !!resetCredentials}
        onClose={() => setShowResetModal(false)}
        title="🔑 Nueva contraseña generada"
        footer={
          <>
            <Button variant="secondary" onClick={copyReset}>{copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'Copiado' : 'Copiar'}</Button>
            <Button onClick={() => setShowResetModal(false)}>Entendido</Button>
          </>
        }
      >
        {resetCredentials && (
          <div className="flex flex-col gap-2.5">
            <CredRow label="Email" value={resetCredentials.email} />
            <CredRow label="Contraseña" value={resetCredentials.password} />
            <p className="text-[12px] text-[#8A6116] bg-warning-100 rounded-lg px-3 py-2.5">⚠️ Comunica esta contraseña al usuario.</p>
          </div>
        )}
      </Modal>
    </div>
  )
}

function CredRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-2.5 bg-neutral-100 border border-neutral-300 rounded-lg px-3.5 py-2.5">
      <span className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wide min-w-[80px]">{label}:</span>
      <span className="text-sm font-semibold text-brand-700 font-mono break-all">{value}</span>
    </div>
  )
}
