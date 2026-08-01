'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Plus, Edit, KeyRound, UserCheck, UserX, UserCog, Copy, Check } from 'lucide-react'
import Card from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import { Input, Select } from '@/components/ui/Input'
import Table, { Column } from '@/components/ui/Table'
import { useToast } from '@/components/ui/ToastProvider'
import { useConfirm } from '@/components/ui/ConfirmProvider'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

interface JuntaMember {
  id: number; firstName: string; lastName: string; ci: string | null; phone: string | null
  juntaRole: string; isActive: boolean
  userId: number
  user: { id: number; email: string; isActive: boolean; role: string }
  school: { id: number; name: string; nucleo: { id: number; name: string } | null } | null
  nucleo: { id: number; name: string } | null
}

const ROLE_LABELS: Record<string, string> = {
  JUNTA_DISTRITO: 'Junta de Distrito', JUNTA_NUCLEO: 'Junta de Núcleo', JUNTA_ESCOLAR: 'Junta Escolar',
}
const CARGO_LABELS: Record<string, string> = {
  PRESIDENTE: 'Presidente', VICEPRESIDENTE: 'Vicepresidente',
  SECRETARIA: 'Secretaria', TESORERO: 'Tesorero', VOCAL: 'Vocal',
}

// Espejo de CREATABLE_ROLES en backend/src/config/permissions.ts — determina a
// qué roles puede reasignar un miembro quien está editando (el backend valida
// lo mismo, esto solo evita ofrecer opciones que igual serían rechazadas).
const CREATABLE_BY_ROLE: Record<string, string[]> = {
  JUNTA_DISTRITO: ['JUNTA_DISTRITO', 'JUNTA_NUCLEO', 'JUNTA_ESCOLAR'],
  JUNTA_NUCLEO:   ['JUNTA_ESCOLAR'],
  JUNTA_ESCOLAR:  ['JUNTA_ESCOLAR'],
}

function CredRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-2.5 bg-neutral-100 border border-neutral-300 rounded-lg px-3.5 py-2.5">
      <span className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wide min-w-[80px]">{label}:</span>
      <span className="text-sm font-semibold text-brand-700 font-mono break-all">{value}</span>
    </div>
  )
}

export default function GestionarJuntaPage() {
  const toast   = useToast()
  const confirm = useConfirm()
  const [members, setMembers] = useState<JuntaMember[]>([])
  const [loading, setLoading] = useState(true)
  const [nucleos, setNucleos] = useState<{ id: number; name: string }[]>([])
  const [schools, setSchools] = useState<{ id: number; name: string; nucleo: { id: number; name: string } | null }[]>([])

  const [showEditModal, setShowEditModal] = useState(false)
  const [editForm, setEditForm] = useState({ id: 0, firstName: '', lastName: '', ci: '', phone: '', cargo: 'VOCAL', role: '', nucleoId: '', schoolId: '' })
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState('')

  const [showCreds, setShowCreds]   = useState(false)
  const [creds, setCreds]           = useState<{ email: string; password: string } | null>(null)
  const [copied, setCopied]         = useState(false)

  const myUser   = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('user') || '{}') : {}
  const myUserId = myUser?.id ?? null
  const myRole   = myUser?.role || ''
  const creatableRoles = CREATABLE_BY_ROLE[myRole] || []
  const auth = () => ({ Authorization: `Bearer ${localStorage.getItem('token') || ''}` })

  // El localStorage 'user' no trae nucleoId — igual que en junta/nueva, hace
  // falta el propio perfil para saber el núcleo implícito de un Junta de Núcleo.
  const [myNucleoId, setMyNucleoId] = useState<number | null>(null)
  // Solo el Presidente de Junta Escolar puede gestionar el directorio — el
  // backend ya lo exige (assertIsPresidente), acá solo se refleja en la UI.
  const [myCargo, setMyCargo] = useState<string | null>(null)
  const [loadingCargo, setLoadingCargo] = useState(myRole === 'JUNTA_ESCOLAR')

  const effectiveNucleoId = myRole === 'JUNTA_NUCLEO' ? myNucleoId : (editForm.nucleoId ? Number(editForm.nucleoId) : null)
  const schoolsInNucleo = effectiveNucleoId != null
    ? schools.filter(s => s.nucleo?.id === effectiveNucleoId)
    : []

  const fetchMembers = () => {
    setLoading(true)
    fetch(`${API_URL}/api/junta`, { headers: auth() })
      .then(r => r.ok ? r.json() : [])
      .then(setMembers)
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchMembers()
    const headers = auth()
    // Junta Escolar no tiene permiso de colegio/núcleo (SCHOOL_VIEW_ALL) ni le
    // hace falta — su cascada núcleo→colegio del modal de edición nunca se
    // muestra para ese rol (solo aplica a Núcleo/Distrito).
    if (myRole !== 'JUNTA_ESCOLAR') {
      fetch(`${API_URL}/api/nucleos`, { headers }).then(r => r.ok ? r.json() : []).then(setNucleos).catch(() => {})
      fetch(`${API_URL}/api/schools`, { headers }).then(r => r.ok ? r.json() : []).then(setSchools).catch(() => {})
    }
    if (myRole === 'JUNTA_NUCLEO') {
      fetch(`${API_URL}/api/junta/me`, { headers })
        .then(r => r.ok ? r.json() : null)
        .then(data => { if (data?.nucleoId != null) setMyNucleoId(data.nucleoId) })
        .catch(() => {})
    }
    if (myRole === 'JUNTA_ESCOLAR') {
      fetch(`${API_URL}/api/junta/me`, { headers })
        .then(r => r.ok ? r.json() : null)
        .then(data => setMyCargo(data?.juntaRole ?? null))
        .catch(() => setMyCargo(null))
        .finally(() => setLoadingCargo(false))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const groupKey = (m: JuntaMember) => m.nucleo?.name ?? m.school?.nucleo?.name ?? 'Sin núcleo'
  const groups = new Map<string, JuntaMember[]>()
  for (const m of members) {
    const key = groupKey(m)
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(m)
  }
  const sortedGroups = [...groups.entries()].sort(([a], [b]) => {
    if (a === 'Sin núcleo') return 1
    if (b === 'Sin núcleo') return -1
    return a.localeCompare(b)
  })

  const openEdit = (m: JuntaMember) => {
    const nucleoId = m.nucleo?.id ?? m.school?.nucleo?.id ?? ''
    setEditForm({
      id: m.id, firstName: m.firstName, lastName: m.lastName, ci: m.ci || '', phone: m.phone || '', cargo: m.juntaRole,
      role: m.user.role, nucleoId: nucleoId ? String(nucleoId) : '', schoolId: m.school?.id ? String(m.school.id) : '',
    })
    setEditError(''); setShowEditModal(true)
  }

  const handleEditSave = async () => {
    if (!editForm.firstName || !editForm.lastName) { setEditError('Nombre y apellido son requeridos'); return }
    if (editForm.role === 'JUNTA_NUCLEO' && !editForm.nucleoId) { setEditError('Selecciona el núcleo'); return }
    if (editForm.role === 'JUNTA_ESCOLAR' && myRole === 'JUNTA_DISTRITO' && !editForm.nucleoId) { setEditError('Selecciona el núcleo'); return }
    if (editForm.role === 'JUNTA_ESCOLAR' && !editForm.schoolId) { setEditError('Selecciona el colegio'); return }

    setEditError(''); setEditSaving(true)
    try {
      const body: Record<string, unknown> = {
        firstName: editForm.firstName, lastName: editForm.lastName,
        ci: editForm.ci || undefined, phone: editForm.phone || undefined, cargo: editForm.cargo,
      }
      if (editForm.role) body.role = editForm.role
      if (editForm.role === 'JUNTA_NUCLEO') body.nucleoId = effectiveNucleoId ?? undefined
      if (editForm.role === 'JUNTA_ESCOLAR') {
        body.schoolId = editForm.schoolId ? parseInt(editForm.schoolId) : undefined
        body.nucleoId = effectiveNucleoId ?? undefined
      }
      const res  = await fetch(`${API_URL}/api/junta/${editForm.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...auth() },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) { setEditError(data.message || 'Error al guardar'); return }
      toast('Miembro actualizado correctamente', 'success')
      setShowEditModal(false)
      fetchMembers()
    } catch { setEditError('Error de conexión') }
    finally  { setEditSaving(false) }
  }

  const handleResetPassword = async (m: JuntaMember) => {
    try {
      const res  = await fetch(`${API_URL}/api/users/${m.user.id}/reset-password`, { method: 'POST', headers: auth() })
      const data = await res.json()
      if (!res.ok) { toast(data.message || 'Error al resetear', 'error'); return }
      setCreds({ email: data.userEmail ?? m.user.email, password: data.newPassword })
      setCopied(false); setShowCreds(true)
    } catch { toast('Error de conexión', 'error') }
  }

  const handleToggle = async (m: JuntaMember) => {
    if (!m.isActive) {
      // Reactivar no necesita confirmación de "peligro".
    } else if (!await confirm(`¿Desactivar a ${m.firstName} ${m.lastName}? No podrá iniciar sesión hasta que lo reactives.`, { danger: true, confirmLabel: 'Desactivar' })) {
      return
    }
    try {
      const res  = await fetch(`${API_URL}/api/junta/${m.id}/toggle`, { method: 'PATCH', headers: auth() })
      const data = await res.json()
      if (!res.ok) { toast(data.message || 'Error al actualizar', 'error'); return }
      toast(data.message, 'success')
      fetchMembers()
    } catch { toast('Error de conexión', 'error') }
  }

  const copyCreds = () => {
    if (!creds) return
    navigator.clipboard.writeText(`Email: ${creds.email}\nContraseña: ${creds.password}`)
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }

  const columns: Column<JuntaMember>[] = [
    { key: 'name', header: 'Nombre', render: m => (
      <div>
        <div className="font-semibold text-brand-700">{m.lastName} {m.firstName}</div>
        <div className="text-[11px] text-neutral-500">{m.user.email}</div>
      </div>
    ) },
    { key: 'role', header: 'Rol', render: m => <Badge tone="brand">{ROLE_LABELS[m.user.role] || m.user.role}</Badge> },
    { key: 'cargo', header: 'Cargo', render: m => CARGO_LABELS[m.juntaRole] || m.juntaRole },
    { key: 'scope', header: 'Colegio/Núcleo', render: m => m.school?.name || m.nucleo?.name || '—' },
    { key: 'status', header: 'Estado', render: m => <Badge tone={m.isActive ? 'success' : 'danger'}>{m.isActive ? 'Activo' : 'Inactivo'}</Badge> },
    { key: 'actions', header: 'Acciones', render: m => (
      <div className="flex items-center gap-1.5">
        <button title="Editar" onClick={() => openEdit(m)} className="w-8 h-8 rounded-md bg-brand-100 text-brand-700 hover:bg-brand-700 hover:text-white transition-colors flex items-center justify-center"><Edit size={14}/></button>
        <button title="Resetear contraseña" onClick={() => handleResetPassword(m)} className="w-8 h-8 rounded-md bg-info-500/15 text-info-500 hover:bg-info-500 hover:text-white transition-colors flex items-center justify-center"><KeyRound size={14}/></button>
        <button
          title={m.isActive ? 'Desactivar' : 'Activar'}
          onClick={() => handleToggle(m)}
          disabled={m.user.id === myUserId}
          className={`w-8 h-8 rounded-md flex items-center justify-center transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${m.isActive ? 'bg-danger-100 text-danger-600 hover:bg-danger-500 hover:text-white' : 'bg-success-100 text-success-700 hover:bg-success-500 hover:text-white'}`}
        >
          {m.isActive ? <UserX size={14}/> : <UserCheck size={14}/>}
        </button>
      </div>
    ) },
  ]

  if (myRole === 'JUNTA_ESCOLAR' && loadingCargo) {
    return <div className="flex justify-center py-16"><p className="text-sm text-neutral-500">Cargando...</p></div>
  }

  if (myRole === 'JUNTA_ESCOLAR' && myCargo !== 'PRESIDENTE') {
    return (
      <Card className="text-center py-16 text-neutral-500">
        <UserCog size={40} className="mx-auto mb-3 text-neutral-300"/>
        <p className="font-semibold text-brand-700 mb-1">Acceso restringido</p>
        <p className="text-[13px]">Solo el Presidente de la Junta Escolar puede gestionar el directorio.</p>
      </Card>
    )
  }

  return (
    <div>
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-bold text-brand-700 mb-1">Gestionar Junta</h1>
          <p className="text-[13px] text-neutral-500">Junta de Núcleo y Escolar, agrupadas por núcleo</p>
        </div>
        <Link href="/dashboard/padres/junta/nueva">
          <Button><Plus size={16}/> Nuevo miembro</Button>
        </Link>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><p className="text-sm text-neutral-500">Cargando...</p></div>
      ) : members.length === 0 ? (
        <Card className="text-center py-12 text-neutral-500">
          <UserCog size={40} className="mx-auto mb-3 text-neutral-300"/>
          <p>Todavía no designaste ningún miembro de Junta</p>
        </Card>
      ) : (
        <div className="flex flex-col gap-5">
          {sortedGroups.map(([nucleoName, group]) => (
            <div key={nucleoName}>
              <div className="text-[11px] font-bold text-neutral-500 uppercase tracking-wide mb-2">
                Núcleo {nucleoName} <span className="font-normal normal-case">({group.length})</span>
              </div>
              <Table columns={columns} rows={group} rowKey={m => m.id} />
            </div>
          ))}
        </div>
      )}

      {/* Modal editar */}
      <Modal
        open={showEditModal} onClose={() => setShowEditModal(false)} title="Editar miembro de Junta"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowEditModal(false)}>Cancelar</Button>
            <Button onClick={handleEditSave} loading={editSaving}>Guardar</Button>
          </>
        }
      >
        <div className="flex flex-col gap-3.5">
          {editError && <p className="text-[13px] text-danger-600 bg-danger-100 rounded-lg px-3 py-2">{editError}</p>}
          <div className="grid grid-cols-2 gap-3">
            <Input label="Nombres" required value={editForm.firstName} onChange={e => setEditForm({ ...editForm, firstName: e.target.value })} />
            <Input label="Apellidos" required value={editForm.lastName} onChange={e => setEditForm({ ...editForm, lastName: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="CI" value={editForm.ci} onChange={e => setEditForm({ ...editForm, ci: e.target.value })} />
            <Input label="Teléfono" value={editForm.phone} onChange={e => setEditForm({ ...editForm, phone: e.target.value })} />
          </div>

          <Select
            label="Rol" required value={editForm.role}
            onChange={e => setEditForm({ ...editForm, role: e.target.value, nucleoId: '', schoolId: '' })}
          >
            {(creatableRoles.includes(editForm.role) ? creatableRoles : [editForm.role, ...creatableRoles]).map(r => (
              <option key={r} value={r}>{ROLE_LABELS[r] || r}</option>
            ))}
          </Select>

          {editForm.role === 'JUNTA_NUCLEO' && (
            <Select label="Núcleo" required value={editForm.nucleoId} onChange={e => setEditForm({ ...editForm, nucleoId: e.target.value })}>
              <option value="">Selecciona un núcleo</option>
              {nucleos.map(n => <option key={n.id} value={n.id}>{n.name}</option>)}
            </Select>
          )}
          {editForm.role === 'JUNTA_ESCOLAR' && myRole === 'JUNTA_DISTRITO' && (
            <Select
              label="Núcleo" required value={editForm.nucleoId}
              onChange={e => setEditForm({ ...editForm, nucleoId: e.target.value, schoolId: '' })}
            >
              <option value="">Selecciona un núcleo</option>
              {nucleos.map(n => <option key={n.id} value={n.id}>{n.name}</option>)}
            </Select>
          )}
          {editForm.role === 'JUNTA_ESCOLAR' && (
            <Select
              label="Colegio" required value={editForm.schoolId}
              disabled={effectiveNucleoId == null}
              onChange={e => setEditForm({ ...editForm, schoolId: e.target.value })}
            >
              <option value="">{effectiveNucleoId == null ? 'Selecciona primero un núcleo' : 'Selecciona un colegio'}</option>
              {schoolsInNucleo.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
          )}

          <Select label="Cargo" value={editForm.cargo} onChange={e => setEditForm({ ...editForm, cargo: e.target.value })}>
            {Object.entries(CARGO_LABELS)
              .filter(([k]) => myRole !== 'JUNTA_ESCOLAR' || k !== 'PRESIDENTE')
              .map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Select>
        </div>
      </Modal>

      {/* Modal credenciales tras resetear */}
      <Modal
        open={showCreds && !!creds} onClose={() => setShowCreds(false)} title="✅ Contraseña restablecida"
        footer={
          <>
            <Button variant="secondary" onClick={copyCreds}>{copied ? <Check size={14}/> : <Copy size={14}/>} {copied ? 'Copiado' : 'Copiar'}</Button>
            <Button onClick={() => setShowCreds(false)}>Entendido</Button>
          </>
        }
      >
        {creds && (
          <div className="flex flex-col gap-2.5">
            <p className="text-[12px] text-success-700 bg-success-100 rounded-lg px-3 py-2.5">✅ Contraseña restablecida. Anota estas credenciales.</p>
            <CredRow label="Email" value={creds.email} />
            <CredRow label="Contraseña" value={creds.password} />
            <p className="text-[12px] text-[#8A6116] bg-warning-100 rounded-lg px-3 py-2.5">⚠️ Esta es la única vez que verás la contraseña.</p>
          </div>
        )}
      </Modal>
    </div>
  )
}
