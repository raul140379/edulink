'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { RefreshCw, Search, Check } from 'lucide-react'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import { Input, Select } from '@/components/ui/Input'
import { useToast } from '@/components/ui/ToastProvider'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

const CARGO_LABELS: Record<string, string> = {
  PRESIDENTE: 'Presidente', VICEPRESIDENTE: 'Vicepresidente',
  SECRETARIA: 'Secretaria', TESORERO: 'Tesorero', VOCAL: 'Vocal',
}

const ROLE_LABELS: Record<string, string> = {
  JUNTA_DISTRITO: 'Junta de Distrito',
  JUNTA_NUCLEO:   'Junta de Núcleo',
  JUNTA_ESCOLAR:  'Junta Escolar (colegio)',
}

// Espejo de CREATABLE_ROLES en backend/src/config/permissions.ts — el backend
// ya rechaza cualquier combinación fuera de esto.
const CREATABLE_BY_ROLE: Record<string, string[]> = {
  JUNTA_DISTRITO: ['JUNTA_DISTRITO', 'JUNTA_NUCLEO', 'JUNTA_ESCOLAR'],
  JUNTA_NUCLEO:   ['JUNTA_ESCOLAR'],
  JUNTA_ESCOLAR:  ['JUNTA_ESCOLAR'],
}

const generatePassword = (lastName: string): string => {
  const year  = new Date().getFullYear()
  const last4 = (lastName || 'junta').replace(/\s+/g, '').slice(0, 4).toLowerCase()
  return `junta${last4}${year}`
}

interface ParentHit { id: number; firstName: string; lastName: string; ci: string | null; phone: string | null }

const emptyForm = {
  role: '' as 'JUNTA_DISTRITO' | 'JUNTA_NUCLEO' | 'JUNTA_ESCOLAR' | '',
  nucleoId: '', schoolId: '',
  firstName: '', lastName: '', ci: '', phone: '',
  cargo: 'VOCAL', academicYear: new Date().getFullYear(),
  email: '', password: '',
}

// Usado por JUNTA_DISTRITO (designa Junta de Distrito, Núcleo o Escolar),
// JUNTA_NUCLEO (solo Junta Escolar de su núcleo) y ahora también por el
// Presidente de JUNTA_ESCOLAR (solo directorio de su propio colegio — nunca
// cargo Presidente, eso queda reservado para Núcleo/Distrito).
// Para nivel JUNTA_ESCOLAR, la persona tiene que ser ya un padre/tutor
// registrado — se busca y se elige, no se tipean datos nuevos (el backend
// genera la segunda cuenta a partir de ese Parent, igual que un Delegado).
export default function NuevaJuntaPage() {
  const router = useRouter()
  const toast  = useToast()
  const [form, setForm] = useState(emptyForm)
  const [nucleos, setNucleos] = useState<{ id: number; name: string }[]>([])
  const [schools, setSchools] = useState<{ id: number; name: string; nucleo: { id: number; name: string } | null }[]>([])
  const [saving, setSaving]   = useState(false)
  const [error,  setError]    = useState('')
  const [generatingEmail, setGeneratingEmail] = useState(false)

  // ---- Búsqueda de padre/tutor existente (solo para nivel JUNTA_ESCOLAR) ----
  const [parentSearch,  setParentSearch]  = useState('')
  const [parentResults, setParentResults] = useState<ParentHit[]>([])
  const [searchingParents, setSearchingParents] = useState(false)
  const [selectedParent, setSelectedParent] = useState<ParentHit | null>(null)

  const [showCreds, setShowCreds] = useState(false)
  const [creds, setCreds] = useState<{ email: string; password: string } | null>(null)

  const token   = typeof window !== 'undefined' ? localStorage.getItem('token') : ''
  const myUser  = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('user') || '{}') : {}
  const myRole  = myUser?.role || ''
  const creatableRoles = CREATABLE_BY_ROLE[myRole] || []
  const cargoOptions = myRole === 'JUNTA_ESCOLAR'
    ? Object.entries(CARGO_LABELS).filter(([k]) => k !== 'PRESIDENTE')
    : Object.entries(CARGO_LABELS)

  // El localStorage 'user' no trae nucleoId (solo id/email/role/permissions) —
  // para JUNTA_NUCLEO hace falta el propio perfil de junta para saber cuál es
  // su núcleo implícito al designar Junta Escolar.
  const [myNucleoId, setMyNucleoId] = useState<number | null>(null)

  // Cuando el que crea es JUNTA_NUCLEO designando Junta Escolar, el núcleo es
  // implícito (el suyo); cuando es JUNTA_DISTRITO, elige el núcleo primero.
  const effectiveNucleoId = myRole === 'JUNTA_NUCLEO' ? myNucleoId : (form.nucleoId ? Number(form.nucleoId) : null)
  const schoolsInNucleo = effectiveNucleoId != null
    ? schools.filter(s => s.nucleo?.id === effectiveNucleoId)
    : []

  useEffect(() => {
    if (creatableRoles.length > 0) setForm(f => ({ ...f, role: creatableRoles[0] as any }))
    const headers = { Authorization: `Bearer ${token}` }
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleGenerateEmail = async () => {
    if (!form.firstName || !form.lastName) { setError('Escribe el nombre y apellido primero'); return }
    setGeneratingEmail(true)
    try {
      const res  = await fetch(`${API_URL}/api/users/generate-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ firstName: form.firstName, lastName: form.lastName }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.message || 'No se pudo generar el correo'); return }
      setForm(f => ({ ...f, email: data.email })); setError('')
    } catch { setError('Error de conexión') }
    finally  { setGeneratingEmail(false) }
  }

  const handleSearchParents = async () => {
    if (!parentSearch.trim()) return
    setSearchingParents(true)
    try {
      const res  = await fetch(`${API_URL}/api/parents?search=${encodeURIComponent(parentSearch)}&isTutor=true`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      setParentResults(res.ok ? data : [])
    } catch { setParentResults([]) }
    finally { setSearchingParents(false) }
  }

  const handleSubmit = async () => {
    if (myRole === 'JUNTA_ESCOLAR') {
      if (!selectedParent) { setError('Buscá y seleccioná un padre/tutor ya registrado'); return }
      setError(''); setSaving(true)
      try {
        const res  = await fetch(`${API_URL}/api/junta`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            role: 'JUNTA_ESCOLAR', parentId: selectedParent.id,
            cargo: form.cargo, academicYear: form.academicYear,
          }),
        })
        const data = await res.json()
        if (!res.ok) { setError(data.message || 'Error al crear'); return }
        toast('Miembro de junta creado correctamente', 'success')
        if (data.member?.accessEmail) {
          setCreds({ email: data.member.accessEmail, password: data.member.defaultPassword })
          setShowCreds(true)
        } else {
          router.push('/dashboard/padres')
        }
      } catch { setError('Error de conexión') }
      finally  { setSaving(false) }
      return
    }

    if (!form.email || !form.password || !form.firstName || !form.lastName) {
      setError('Completa correo, contraseña, nombre y apellido'); return
    }
    if (form.role === 'JUNTA_NUCLEO' && !form.nucleoId) { setError('Selecciona el núcleo'); return }
    if (form.role === 'JUNTA_ESCOLAR' && myRole === 'JUNTA_DISTRITO' && !form.nucleoId) { setError('Selecciona el núcleo'); return }
    if (form.role === 'JUNTA_ESCOLAR' && !form.schoolId) { setError('Selecciona el colegio'); return }

    setError(''); setSaving(true)
    try {
      const body = {
        ...form,
        nucleoId: form.role === 'JUNTA_NUCLEO' || form.role === 'JUNTA_ESCOLAR'
          ? (effectiveNucleoId ?? undefined)
          : undefined,
        schoolId: form.role === 'JUNTA_ESCOLAR' ? parseInt(form.schoolId) : undefined,
      }
      const res  = await fetch(`${API_URL}/api/junta`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.message || 'Error al crear'); return }
      toast('Miembro de junta creado correctamente', 'success')
      router.push('/dashboard/padres')
    } catch { setError('Error de conexión') }
    finally  { setSaving(false) }
  }

  return (
    <div className="max-w-xl">
      <h1 className="text-xl font-bold text-brand-700 mb-1">Designar Junta</h1>
      <p className="text-[13px] text-neutral-500 mb-6">
        {myRole === 'JUNTA_ESCOLAR'
          ? 'Elegí un padre/tutor ya registrado y asignale un cargo en el directorio'
          : 'Crea la cuenta y el cargo de un nuevo miembro de junta'}
      </p>

      <Card>
        <div className="flex flex-col gap-3.5">
          {error && <p className="text-[13px] text-danger-600 bg-danger-100 rounded-lg px-3 py-2">{error}</p>}

          {myRole !== 'JUNTA_ESCOLAR' && (
            <Select label="Nivel" required value={form.role} onChange={e => setForm({ ...form, role: e.target.value as any })}>
              {creatableRoles.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
            </Select>
          )}

          {myRole !== 'JUNTA_ESCOLAR' && form.role === 'JUNTA_NUCLEO' && (
            <Select label="Núcleo" required value={form.nucleoId} onChange={e => setForm({ ...form, nucleoId: e.target.value })}>
              <option value="">Selecciona un núcleo</option>
              {nucleos.map(n => <option key={n.id} value={n.id}>{n.name}</option>)}
            </Select>
          )}
          {myRole !== 'JUNTA_ESCOLAR' && form.role === 'JUNTA_ESCOLAR' && myRole === 'JUNTA_DISTRITO' && (
            <Select
              label="Núcleo" required value={form.nucleoId}
              onChange={e => setForm({ ...form, nucleoId: e.target.value, schoolId: '' })}
            >
              <option value="">Selecciona un núcleo</option>
              {nucleos.map(n => <option key={n.id} value={n.id}>{n.name}</option>)}
            </Select>
          )}
          {myRole !== 'JUNTA_ESCOLAR' && form.role === 'JUNTA_ESCOLAR' && (
            <Select
              label="Colegio" required value={form.schoolId}
              disabled={effectiveNucleoId == null}
              onChange={e => setForm({ ...form, schoolId: e.target.value })}
            >
              <option value="">{effectiveNucleoId == null ? 'Selecciona primero un núcleo' : 'Selecciona un colegio'}</option>
              {schoolsInNucleo.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
          )}

          {myRole === 'JUNTA_ESCOLAR' ? (
            <>
              {!selectedParent ? (
                <div>
                  <div className="flex gap-2">
                    <Input
                      label="Buscar padre/tutor (nombre o CI)" value={parentSearch}
                      onChange={e => setParentSearch(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleSearchParents() } }}
                    />
                    <Button variant="secondary" onClick={handleSearchParents} loading={searchingParents} className="mt-6 shrink-0">
                      <Search size={14}/>
                    </Button>
                  </div>
                  {parentResults.length > 0 && (
                    <div className="flex flex-col gap-1.5 mt-2 max-h-52 overflow-y-auto">
                      {parentResults.map(p => (
                        <button
                          key={p.id} type="button"
                          onClick={() => { setSelectedParent(p); setParentResults([]) }}
                          className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-neutral-100/60 hover:bg-brand-100 text-left text-[13px]"
                        >
                          <span className="font-semibold text-brand-700">{p.lastName} {p.firstName}</span>
                          {p.ci && <span className="text-neutral-500 text-[11px]">CI {p.ci}</span>}
                        </button>
                      ))}
                    </div>
                  )}
                  {parentResults.length === 0 && parentSearch && !searchingParents && (
                    <p className="text-[12px] text-neutral-500 mt-1.5">
                      Sin resultados — solo se muestran tutores (isTutor) ya registrados en tu colegio.
                    </p>
                  )}
                </div>
              ) : (
                <div className="flex items-center justify-between gap-3 px-3.5 py-3 rounded-lg bg-success-100 border border-success-500/30">
                  <div>
                    <div className="text-[13.5px] font-semibold text-brand-700">{selectedParent.lastName} {selectedParent.firstName}</div>
                    {selectedParent.ci && <div className="text-[11px] text-neutral-500">CI {selectedParent.ci}</div>}
                  </div>
                  <button type="button" onClick={() => setSelectedParent(null)} className="text-[12px] text-brand-600 font-semibold hover:underline">
                    Cambiar
                  </button>
                </div>
              )}
            </>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <Input label="Nombres" required value={form.firstName} onChange={e => setForm({ ...form, firstName: e.target.value })} />
                <Input label="Apellidos" required value={form.lastName} onChange={e => setForm({ ...form, lastName: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input label="CI" value={form.ci} onChange={e => setForm({ ...form, ci: e.target.value })} />
                <Input label="Teléfono" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
              </div>
            </>
          )}

          <Select label="Cargo" required value={form.cargo} onChange={e => setForm({ ...form, cargo: e.target.value })}>
            {cargoOptions.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Select>

          {myRole !== 'JUNTA_ESCOLAR' && (
            <>
              <div>
                <Input label="Correo electrónico" required type="email" value={form.email}
                  onChange={e => setForm({ ...form, email: e.target.value })} />
                <button
                  type="button" onClick={handleGenerateEmail} disabled={generatingEmail}
                  className="flex items-center gap-1.5 border border-dashed border-neutral-300 text-info-500 rounded-md px-2.5 py-1.5 text-[11px] w-fit mt-1.5 hover:bg-neutral-100 hover:border-info-500"
                >
                  <RefreshCw size={12} /> {generatingEmail ? 'Generando...' : 'Generar correo automático'}
                </button>
              </div>
              <div>
                <Input label="Contraseña" required type="password" value={form.password}
                  onChange={e => setForm({ ...form, password: e.target.value })} />
                <button
                  type="button"
                  onClick={() => setForm(f => ({ ...f, password: generatePassword(f.lastName) }))}
                  className="flex items-center gap-1.5 border border-dashed border-neutral-300 text-info-500 rounded-md px-2.5 py-1.5 text-[11px] w-fit mt-1.5 hover:bg-neutral-100 hover:border-info-500"
                >
                  <RefreshCw size={12} /> Generar contraseña automática
                </button>
              </div>
            </>
          )}

          <Button onClick={handleSubmit} loading={saving} className="justify-center">Crear miembro de junta</Button>
        </div>
      </Card>

      <Modal
        open={showCreds} onClose={() => { setShowCreds(false); router.push('/dashboard/padres') }}
        title="✅ Miembro creado"
        footer={<Button onClick={() => { setShowCreds(false); router.push('/dashboard/padres') }}>Entendido</Button>}
      >
        {creds && (
          <div className="flex flex-col gap-2.5">
            <p className="text-[12px] text-success-700 bg-success-100 rounded-lg px-3 py-2.5">
              <Check size={13} className="inline mr-1"/> Se generó una nueva cuenta de acceso. Anota estas credenciales.
            </p>
            <div className="flex items-center gap-2.5 bg-neutral-100 border border-neutral-300 rounded-lg px-3.5 py-2.5">
              <span className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wide min-w-[80px]">Email:</span>
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
    </div>
  )
}
