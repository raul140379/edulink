'use client'

import { useEffect, useState } from 'react'
import { Plus, Building2, Users, GraduationCap, Upload, UserCog, RefreshCw, Copy, Check, Eye, EyeOff, Pencil } from 'lucide-react'
import Button from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Input'
import Card from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import Modal from '@/components/ui/Modal'
import { useToast } from '@/components/ui/ToastProvider'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

const TIPO_LABELS: Record<string, string> = { FISCAL: 'Fiscal', CONVENIO: 'Convenio', PRIVADA: 'Privada' }
const SUBSISTEMA_LABELS: Record<string, string> = {
  REGULAR: 'Regular',
  ALTERNATIVA_ESPECIAL: 'Alternativa y Especial',
  SUPERIOR_FORMACION_PROFESIONAL: 'Superior de Formación Profesional',
}
const LEVEL_LABELS: Record<string, string> = { INICIAL: 'Inicial', PRIMARIA: 'Primaria', SECUNDARIA: 'Secundaria' }
const LEVEL_OPTIONS = ['INICIAL', 'PRIMARIA', 'SECUNDARIA'] as const
const SHIFT_LABELS: Record<string, string> = { MORNING: 'Mañana', AFTERNOON: 'Tarde', NIGHT: 'Noche' }
const SHIFT_OPTIONS = ['MORNING', 'AFTERNOON', 'NIGHT'] as const

interface Nucleo {
  id:       number
  name:     string
  location: string | null
}

interface Director {
  id: number; firstName: string; lastName: string
  user: { id: number; email: string }
}

interface School {
  id:         number
  name:       string
  sieCode:    string
  tipo:       'FISCAL' | 'CONVENIO' | 'PRIVADA'
  area:       'URBANA' | 'RURAL'
  subsistema: string
  levels:     string[]
  offersBTH:  boolean
  shifts:     string[]
  address:    string | null
  isActive:   boolean
  district:   { id: number; name: string }
  nucleo:     Nucleo | null
  directors:  Director[]
  _count:     { students: number; teachers: number; parents: number }
}

const emptyForm = { name: '', sieCode: '', tipo: 'FISCAL', area: 'URBANA', subsistema: 'REGULAR', levels: [] as string[], offersBTH: false, shifts: [] as string[], address: '', nucleoId: '' }

const emptyDirectorForm = { firstName: '', lastName: '', ci: '', phone: '', email: '', password: '' }

const generateDirectorPassword = (lastName: string): string => {
  const year = new Date().getFullYear()
  const last4 = (lastName || 'dir').replace(/\s+/g, '').slice(0, 4).toLowerCase()
  return `director${last4}${year}`
}

export default function ColegiosPage() {
  const [schools, setSchools] = useState<School[]>([])
  const [nucleos, setNucleos] = useState<Nucleo[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [form, setForm] = useState(emptyForm)
  const [showImport, setShowImport] = useState(false)
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importing, setImporting] = useState(false)

  // ── Editar Colegio ──
  const [showEditModal, setShowEditModal] = useState(false)
  const [editSchoolId,  setEditSchoolId]  = useState<number | null>(null)
  const [editForm,      setEditForm]      = useState({ ...emptyForm, isActive: true })
  const [editSaving,    setEditSaving]    = useState(false)
  const [editError,     setEditError]     = useState('')

  // ── Asignar Director ──
  const [showDirectorModal, setShowDirectorModal] = useState(false)
  const [directorSchool,    setDirectorSchool]    = useState<School | null>(null)
  const [directorForm,      setDirectorForm]      = useState(emptyDirectorForm)
  const [directorSaving,    setDirectorSaving]    = useState(false)
  const [directorError,     setDirectorError]     = useState('')
  const [generatingEmail,   setGeneratingEmail]   = useState(false)
  const [showDirectorPass,  setShowDirectorPass]  = useState(false)
  const [newDirectorCreds,  setNewDirectorCreds]  = useState<{ email: string; password: string } | null>(null)
  const [copiedDirectorCreds, setCopiedDirectorCreds] = useState(false)

  const toast = useToast()

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : ''

  const fetchSchools = async () => {
    setLoading(true)
    try {
      const res  = await fetch(`${API_URL}/api/schools`, { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      if (res.ok) setSchools(data)
    } catch { toast('Error al cargar las unidades educativas', 'error') }
    finally  { setLoading(false) }
  }

  const fetchNucleos = async () => {
    try {
      const res  = await fetch(`${API_URL}/api/nucleos`, { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      if (res.ok) setNucleos(data)
    } catch { /* selector opcional, no bloquea la pantalla */ }
  }

  useEffect(() => { fetchSchools(); fetchNucleos() }, [])

  const openCreate = () => {
    setForm(emptyForm)
    setFormError(''); setShowModal(true)
  }

  const toggleLevel = (level: string) => {
    setForm(f => {
      const has = f.levels.includes(level)
      const levels = has ? f.levels.filter(l => l !== level) : [...f.levels, level]
      return { ...f, levels, offersBTH: levels.includes('SECUNDARIA') ? f.offersBTH : false }
    })
  }

  const toggleShift = (shift: string) => {
    setForm(f => ({ ...f, shifts: f.shifts.includes(shift) ? f.shifts.filter(s => s !== shift) : [...f.shifts, shift] }))
  }

  const handleCreate = async () => {
    if (!form.name || !form.sieCode) { setFormError('El nombre y el código SIE son requeridos'); return }
    if (form.levels.length === 0) { setFormError('Selecciona al menos un nivel (Inicial/Primaria/Secundaria)'); return }
    if (form.shifts.length === 0) { setFormError('Selecciona al menos un turno (Mañana/Tarde/Noche)'); return }
    setFormError(''); setSaving(true)
    try {
      const res  = await fetch(`${API_URL}/api/schools`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...form, nucleoId: form.nucleoId ? Number(form.nucleoId) : undefined }),
      })
      const data = await res.json()
      if (!res.ok) { setFormError(data.message); return }
      toast('Unidad educativa creada correctamente', 'success')
      setShowModal(false)
      fetchSchools()
    } catch { setFormError('Error de conexión') }
    finally  { setSaving(false) }
  }

  const handleImport = async () => {
    if (!importFile) return
    setImporting(true)
    try {
      const formData = new FormData()
      formData.append('file', importFile)
      const res  = await fetch(`${API_URL}/api/schools/import`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      })
      const data = await res.json()
      if (!res.ok) { toast(data.message, 'error'); return }
      toast(data.message, 'success')
      setShowImport(false)
      setImportFile(null)
      fetchSchools()
    } catch { toast('Error de conexión', 'error') }
    finally  { setImporting(false) }
  }

  const openEdit = (school: School) => {
    setEditSchoolId(school.id)
    setEditForm({
      name: school.name, sieCode: school.sieCode, tipo: school.tipo, area: school.area,
      subsistema: school.subsistema, levels: [...school.levels], offersBTH: school.offersBTH,
      shifts: [...school.shifts], address: school.address || '', nucleoId: school.nucleo ? String(school.nucleo.id) : '',
      isActive: school.isActive,
    })
    setEditError(''); setShowEditModal(true)
  }

  const toggleEditLevel = (level: string) => {
    setEditForm(f => {
      const has = f.levels.includes(level)
      const levels = has ? f.levels.filter(l => l !== level) : [...f.levels, level]
      return { ...f, levels, offersBTH: levels.includes('SECUNDARIA') ? f.offersBTH : false }
    })
  }

  const toggleEditShift = (shift: string) => {
    setEditForm(f => ({ ...f, shifts: f.shifts.includes(shift) ? f.shifts.filter(s => s !== shift) : [...f.shifts, shift] }))
  }

  const handleEditSave = async () => {
    if (!editSchoolId) return
    if (!editForm.name || !editForm.sieCode) { setEditError('El nombre y el código SIE son requeridos'); return }
    if (editForm.levels.length === 0) { setEditError('Selecciona al menos un nivel (Inicial/Primaria/Secundaria)'); return }
    if (editForm.shifts.length === 0) { setEditError('Selecciona al menos un turno (Mañana/Tarde/Noche)'); return }
    setEditError(''); setEditSaving(true)
    try {
      const res  = await fetch(`${API_URL}/api/schools/${editSchoolId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...editForm, nucleoId: editForm.nucleoId ? Number(editForm.nucleoId) : null }),
      })
      const data = await res.json()
      if (!res.ok) { setEditError(data.message); return }
      toast('Unidad educativa actualizada correctamente', 'success')
      setShowEditModal(false)
      fetchSchools()
    } catch { setEditError('Error de conexión') }
    finally  { setEditSaving(false) }
  }

  const openDirectorModal = (school: School) => {
    setDirectorSchool(school)
    setDirectorForm(emptyDirectorForm)
    setDirectorError(''); setShowDirectorPass(false); setShowDirectorModal(true)
  }

  const handleGenerateDirectorEmail = async () => {
    if (!directorForm.firstName || !directorForm.lastName) {
      setDirectorError('Escribe el nombre y apellido primero'); return
    }
    setGeneratingEmail(true)
    try {
      const res  = await fetch(`${API_URL}/api/users/generate-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ firstName: directorForm.firstName, lastName: directorForm.lastName }),
      })
      const data = await res.json()
      if (!res.ok) { setDirectorError(data.message || 'No se pudo generar el correo'); return }
      setDirectorForm(f => ({ ...f, email: data.email }))
    } catch { setDirectorError('Error de conexión') }
    finally  { setGeneratingEmail(false) }
  }

  const handleAssignDirector = async () => {
    if (!directorSchool) return
    const { firstName, lastName, password } = directorForm
    if (!firstName || !lastName || !password) { setDirectorError('Nombre, apellido y contraseña son requeridos'); return }
    setDirectorError(''); setDirectorSaving(true)
    try {
      const res  = await fetch(`${API_URL}/api/schools/${directorSchool.id}/director`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(directorForm),
      })
      const data = await res.json()
      if (!res.ok) { setDirectorError(data.message); return }
      setShowDirectorModal(false)
      setNewDirectorCreds({ email: data.accessEmail, password: data.password })
      fetchSchools()
    } catch { setDirectorError('Error de conexión') }
    finally  { setDirectorSaving(false) }
  }

  const copyDirectorCreds = () => {
    if (!newDirectorCreds) return
    navigator.clipboard.writeText(`Email: ${newDirectorCreds.email}\nContraseña: ${newDirectorCreds.password}`)
    setCopiedDirectorCreds(true); setTimeout(() => setCopiedDirectorCreds(false), 2000)
  }

  // Orden por núcleo (alfabético, "Sin núcleo" al final) y dentro de cada
  // núcleo por turno (Mañana → Tarde → Noche, según el primero que tenga cada
  // colegio) y de ahí por nombre.
  const SHIFT_ORDER: Record<string, number> = { MORNING: 0, AFTERNOON: 1, NIGHT: 2 }
  const shiftRank = (s: School) => Math.min(...(s.shifts.length ? s.shifts.map(t => SHIFT_ORDER[t] ?? 9) : [9]))

  const groupedSchools = (() => {
    const groups = new Map<string, School[]>()
    for (const s of schools) {
      const key = s.nucleo?.name || 'Sin núcleo'
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key)!.push(s)
    }
    for (const list of groups.values()) {
      list.sort((a, b) => shiftRank(a) - shiftRank(b) || a.name.localeCompare(b.name))
    }
    return [...groups.entries()].sort(([a], [b]) => {
      if (a === 'Sin núcleo') return 1
      if (b === 'Sin núcleo') return -1
      return a.localeCompare(b)
    })
  })()

  return (
    <div>
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-bold text-brand-700 mb-1">Unidades Educativas</h1>
          <p className="text-[13px] text-neutral-500">Colegios del distrito</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => { setImportFile(null); setShowImport(true) }}><Upload size={16} /> Importar planilla</Button>
          <Button onClick={openCreate}><Plus size={16} /> Nuevo colegio</Button>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-sm text-neutral-500">
          Cargando...
        </div>
      ) : schools.length === 0 ? (
        <div className="flex items-center justify-center py-16 text-sm text-neutral-500">
          No hay unidades educativas registradas todavía
        </div>
      ) : (
        <div className="flex flex-col gap-6">
        {groupedSchools.map(([nucleoName, group]) => (
          <div key={nucleoName}>
            <div className="flex items-center gap-2 mb-3">
              <h2 className="text-sm font-bold text-brand-700">Núcleo {nucleoName}</h2>
              <span className="text-[11px] text-neutral-500">({group.length})</span>
            </div>
            <div className="grid gap-3.5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
          {group.map((s) => (
            <Card key={s.id} className="flex gap-3">
              <div className="w-10 h-10 rounded-[10px] bg-brand-100 text-brand-700 flex items-center justify-center shrink-0">
                <Building2 size={20} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <div className="text-sm font-bold text-brand-700">{s.name}</div>
                  <button
                    onClick={() => openEdit(s)} title="Editar colegio"
                    className="shrink-0 w-6 h-6 rounded-md bg-neutral-100 text-neutral-500 flex items-center justify-center hover:bg-brand-100 hover:text-brand-700"
                  >
                    <Pencil size={12} />
                  </button>
                </div>
                <div className="flex gap-1.5 flex-wrap mb-1.5">
                  <Badge tone="info">SIE: {s.sieCode}</Badge>
                  <Badge tone="info">{TIPO_LABELS[s.tipo] || s.tipo}</Badge>
                  <Badge tone="info">{s.area === 'URBANA' ? 'Urbana' : 'Rural'}</Badge>
                  {s.subsistema !== 'REGULAR' && <Badge tone="warning">{SUBSISTEMA_LABELS[s.subsistema] || s.subsistema}</Badge>}
                  {!s.isActive && <Badge tone="danger">Inactiva</Badge>}
                </div>
                <div className="flex gap-1.5 flex-wrap mb-1.5">
                  {s.levels.length > 0 ? s.levels.map(l => <Badge key={l} tone="brand">{LEVEL_LABELS[l] || l}</Badge>) : <Badge tone="warning">Sin nivel registrado</Badge>}
                  {s.offersBTH && <Badge tone="success">BTH</Badge>}
                </div>
                <div className="flex gap-1.5 flex-wrap mb-1.5">
                  {s.shifts.length > 0 ? s.shifts.map(t => <Badge key={t} tone="neutral">{SHIFT_LABELS[t] || t}</Badge>) : <Badge tone="warning">Sin turno registrado</Badge>}
                </div>
                <div className="text-[11px] text-neutral-500 mb-2">
                  {s.district.name}{s.nucleo ? ` · Núcleo ${s.nucleo.name}` : ''}
                </div>
                <div className="flex flex-col gap-1 text-[11px] text-neutral-500 mb-2.5">
                  <span className="flex items-center gap-1.5"><GraduationCap size={13} /> {s._count.students} estudiantes</span>
                  <span className="flex items-center gap-1.5"><Users size={13} /> {s._count.teachers} maestros · {s._count.parents} padres</span>
                </div>
                <div className="flex items-center justify-between gap-2 border-t border-neutral-100 pt-2.5">
                  {s.directors.length > 0 ? (
                    <div className="min-w-0">
                      <div className="text-[10px] text-neutral-500 uppercase tracking-wide">Director</div>
                      <div className="text-[12.5px] font-semibold text-brand-700 truncate">
                        {s.directors[0].firstName} {s.directors[0].lastName}
                      </div>
                    </div>
                  ) : (
                    <Badge tone="warning">Sin director asignado</Badge>
                  )}
                  <button
                    onClick={() => openDirectorModal(s)}
                    title={s.directors.length > 0 ? 'Reemplazar director' : 'Asignar director'}
                    className="shrink-0 flex items-center gap-1 text-[11px] font-semibold text-brand-700 bg-brand-100 hover:bg-brand-100/70 rounded-md px-2.5 py-1.5"
                  >
                    <UserCog size={13} /> {s.directors.length > 0 ? 'Reemplazar' : 'Asignar'}
                  </button>
                </div>
              </div>
            </Card>
          ))}
            </div>
          </div>
        ))}
        </div>
      )}

      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title="Nuevo Colegio"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowModal(false)}>Cancelar</Button>
            <Button onClick={handleCreate} loading={saving}>Crear colegio</Button>
          </>
        }
      >
        <div className="flex flex-col gap-3.5">
          {formError && <p className="text-[13px] text-danger-600 bg-danger-100 rounded-lg px-3 py-2">{formError}</p>}
          <Input label="Nombre" required placeholder="U.E. ..." value={form.name}
            onChange={e => setForm({ ...form, name: e.target.value })} />
          <Input label="Código SIE" required placeholder="41980023" value={form.sieCode}
            onChange={e => setForm({ ...form, sieCode: e.target.value })} />
          <div className="grid grid-cols-2 gap-3">
            <Select label="Tipo" required value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value })}>
              <option value="FISCAL">Fiscal</option>
              <option value="CONVENIO">Convenio</option>
              <option value="PRIVADA">Privada</option>
            </Select>
            <Select label="Área" required value={form.area} onChange={e => setForm({ ...form, area: e.target.value })}>
              <option value="URBANA">Urbana</option>
              <option value="RURAL">Rural</option>
            </Select>
          </div>
          <Select label="Subsistema" value={form.subsistema} onChange={e => setForm({ ...form, subsistema: e.target.value })}
            hint="Educación Regular es el único subsistema con flujo académico propio en el sistema hoy">
            <option value="REGULAR">Regular</option>
            <option value="ALTERNATIVA_ESPECIAL">Alternativa y Especial</option>
            <option value="SUPERIOR_FORMACION_PROFESIONAL">Superior de Formación Profesional</option>
          </Select>
          <div className="flex flex-col gap-1.5">
            <span className="text-[13px] font-semibold text-neutral-700">Niveles que ofrece<span className="text-danger-500"> *</span></span>
            <div className="flex gap-2 flex-wrap">
              {LEVEL_OPTIONS.map(level => (
                <button
                  key={level} type="button" onClick={() => toggleLevel(level)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border-2 transition-colors ${
                    form.levels.includes(level) ? 'border-brand-700 bg-brand-100 text-brand-700' : 'border-neutral-300 bg-white text-neutral-500 hover:bg-neutral-100'
                  }`}
                >
                  {LEVEL_LABELS[level]}
                </button>
              ))}
            </div>
            {form.levels.includes('SECUNDARIA') && (
              <label className="flex items-center gap-2 mt-1 text-[13px] text-neutral-700">
                <input type="checkbox" checked={form.offersBTH} onChange={e => setForm({ ...form, offersBTH: e.target.checked })} />
                También ofrece Bachillerato Técnico Humanístico (BTH)
              </label>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-[13px] font-semibold text-neutral-700">Turno(s) en que funciona<span className="text-danger-500"> *</span></span>
            <div className="flex gap-2 flex-wrap">
              {SHIFT_OPTIONS.map(shift => (
                <button
                  key={shift} type="button" onClick={() => toggleShift(shift)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border-2 transition-colors ${
                    form.shifts.includes(shift) ? 'border-brand-700 bg-brand-100 text-brand-700' : 'border-neutral-300 bg-white text-neutral-500 hover:bg-neutral-100'
                  }`}
                >
                  {SHIFT_LABELS[shift]}
                </button>
              ))}
            </div>
          </div>
          <Input label="Dirección" placeholder="Opcional" value={form.address}
            onChange={e => setForm({ ...form, address: e.target.value })} />
          <Select label="Núcleo" value={form.nucleoId} onChange={e => setForm({ ...form, nucleoId: e.target.value })}>
            <option value="">Sin asignar</option>
            {nucleos.map(n => (
              <option key={n.id} value={n.id}>{n.name}{n.location ? ` (${n.location})` : ''}</option>
            ))}
          </Select>
        </div>
      </Modal>

      {/* ── Modal Editar Colegio ── */}
      <Modal
        open={showEditModal}
        onClose={() => setShowEditModal(false)}
        title="Editar Colegio"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowEditModal(false)}>Cancelar</Button>
            <Button onClick={handleEditSave} loading={editSaving}>Guardar cambios</Button>
          </>
        }
      >
        <div className="flex flex-col gap-3.5">
          {editError && <p className="text-[13px] text-danger-600 bg-danger-100 rounded-lg px-3 py-2">{editError}</p>}
          <Input label="Nombre" required value={editForm.name}
            onChange={e => setEditForm({ ...editForm, name: e.target.value })} />
          <Input label="Código SIE" required value={editForm.sieCode}
            onChange={e => setEditForm({ ...editForm, sieCode: e.target.value })} />
          <div className="grid grid-cols-2 gap-3">
            <Select label="Tipo" required value={editForm.tipo} onChange={e => setEditForm({ ...editForm, tipo: e.target.value })}>
              <option value="FISCAL">Fiscal</option>
              <option value="CONVENIO">Convenio</option>
              <option value="PRIVADA">Privada</option>
            </Select>
            <Select label="Área" required value={editForm.area} onChange={e => setEditForm({ ...editForm, area: e.target.value })}>
              <option value="URBANA">Urbana</option>
              <option value="RURAL">Rural</option>
            </Select>
          </div>
          <Select label="Subsistema" value={editForm.subsistema} onChange={e => setEditForm({ ...editForm, subsistema: e.target.value })}>
            <option value="REGULAR">Regular</option>
            <option value="ALTERNATIVA_ESPECIAL">Alternativa y Especial</option>
            <option value="SUPERIOR_FORMACION_PROFESIONAL">Superior de Formación Profesional</option>
          </Select>
          <div className="flex flex-col gap-1.5">
            <span className="text-[13px] font-semibold text-neutral-700">Niveles que ofrece<span className="text-danger-500"> *</span></span>
            <div className="flex gap-2 flex-wrap">
              {LEVEL_OPTIONS.map(level => (
                <button
                  key={level} type="button" onClick={() => toggleEditLevel(level)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border-2 transition-colors ${
                    editForm.levels.includes(level) ? 'border-brand-700 bg-brand-100 text-brand-700' : 'border-neutral-300 bg-white text-neutral-500 hover:bg-neutral-100'
                  }`}
                >
                  {LEVEL_LABELS[level]}
                </button>
              ))}
            </div>
            {editForm.levels.includes('SECUNDARIA') && (
              <label className="flex items-center gap-2 mt-1 text-[13px] text-neutral-700">
                <input type="checkbox" checked={editForm.offersBTH} onChange={e => setEditForm({ ...editForm, offersBTH: e.target.checked })} />
                También ofrece Bachillerato Técnico Humanístico (BTH)
              </label>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-[13px] font-semibold text-neutral-700">Turno(s) en que funciona<span className="text-danger-500"> *</span></span>
            <div className="flex gap-2 flex-wrap">
              {SHIFT_OPTIONS.map(shift => (
                <button
                  key={shift} type="button" onClick={() => toggleEditShift(shift)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border-2 transition-colors ${
                    editForm.shifts.includes(shift) ? 'border-brand-700 bg-brand-100 text-brand-700' : 'border-neutral-300 bg-white text-neutral-500 hover:bg-neutral-100'
                  }`}
                >
                  {SHIFT_LABELS[shift]}
                </button>
              ))}
            </div>
          </div>
          <Input label="Dirección" placeholder="Opcional" value={editForm.address}
            onChange={e => setEditForm({ ...editForm, address: e.target.value })} />
          <Select label="Núcleo" value={editForm.nucleoId} onChange={e => setEditForm({ ...editForm, nucleoId: e.target.value })}>
            <option value="">Sin asignar</option>
            {nucleos.map(n => (
              <option key={n.id} value={n.id}>{n.name}{n.location ? ` (${n.location})` : ''}</option>
            ))}
          </Select>
          <label className="flex items-center gap-2 text-[13px] text-neutral-700">
            <input type="checkbox" checked={editForm.isActive} onChange={e => setEditForm({ ...editForm, isActive: e.target.checked })} />
            Colegio activo
          </label>
        </div>
      </Modal>

      <Modal
        open={showImport}
        onClose={() => setShowImport(false)}
        title="Importar colegios desde planilla"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowImport(false)}>Cancelar</Button>
            <Button onClick={handleImport} disabled={!importFile} loading={importing}>Importar</Button>
          </>
        }
      >
        <div className="flex flex-col gap-3.5">
          <p className="text-[13px] text-neutral-500">
            Sube un archivo Excel con las columnas <b>SIE</b>, <b>NOMBRE</b>, <b>DEPENDENCIA</b> (Fiscal/Convenio/Privada),
            <b> AREA</b> (Urbana/Rural) y opcionalmente <b>NUCLEO</b> (por nombre).
          </p>
          <input
            type="file" accept=".xlsx,.xls"
            onChange={e => setImportFile(e.target.files?.[0] || null)}
            className="block w-full text-sm text-neutral-700 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-brand-100 file:text-brand-700 file:text-sm file:font-semibold"
          />
        </div>
      </Modal>

      {/* ── Modal Asignar/Reemplazar Director ── */}
      <Modal
        open={showDirectorModal}
        onClose={() => setShowDirectorModal(false)}
        title={directorSchool?.directors.length ? `Reemplazar director — ${directorSchool.name}` : `Asignar director — ${directorSchool?.name}`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowDirectorModal(false)}>Cancelar</Button>
            <Button onClick={handleAssignDirector} loading={directorSaving}>Guardar</Button>
          </>
        }
      >
        <div className="flex flex-col gap-3.5">
          {directorError && <p className="text-[13px] text-danger-600 bg-danger-100 rounded-lg px-3 py-2">{directorError}</p>}
          {directorSchool && directorSchool.directors.length > 0 && (
            <p className="text-[12px] text-[#8A6116] bg-warning-100 rounded-lg px-3 py-2.5 leading-relaxed">
              ⚠️ Este colegio ya tiene director ({directorSchool.directors[0].firstName} {directorSchool.directors[0].lastName}).
              Al guardar, ese usuario queda desactivado y este pasa a ser el nuevo responsable.
            </p>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Input label="Nombres" required value={directorForm.firstName}
              onChange={e => setDirectorForm({ ...directorForm, firstName: e.target.value })} />
            <Input label="Apellidos" required value={directorForm.lastName}
              onChange={e => setDirectorForm({ ...directorForm, lastName: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="CI" placeholder="Opcional" value={directorForm.ci}
              onChange={e => setDirectorForm({ ...directorForm, ci: e.target.value })} />
            <Input label="Teléfono" placeholder="Opcional" value={directorForm.phone}
              onChange={e => setDirectorForm({ ...directorForm, phone: e.target.value })} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Input label="Correo electrónico" type="email" placeholder="Deja vacío para generar uno automático" value={directorForm.email}
              onChange={e => setDirectorForm({ ...directorForm, email: e.target.value })} />
            <button
              type="button" onClick={handleGenerateDirectorEmail} disabled={generatingEmail}
              className="flex items-center gap-1.5 border border-dashed border-neutral-300 text-info-500 rounded-md px-2.5 py-1.5 text-[11px] w-fit hover:bg-neutral-100 hover:border-info-500 disabled:opacity-50"
            >
              <RefreshCw size={12} /> {generatingEmail ? 'Generando...' : 'Generar correo automático'}
            </button>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-[13px] font-semibold text-neutral-700">Contraseña<span className="text-danger-500"> *</span></span>
            <div className="relative flex items-center">
              <input
                type={showDirectorPass ? 'text' : 'password'} placeholder="Escribe o genera automáticamente"
                value={directorForm.password} onChange={e => setDirectorForm({ ...directorForm, password: e.target.value })}
                className="w-full h-10 pl-3 pr-10 rounded-lg border border-neutral-300 text-sm outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/15"
              />
              <button type="button" onClick={() => setShowDirectorPass(!showDirectorPass)} className="absolute right-3 text-neutral-500 hover:text-brand-700">
                {showDirectorPass ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
            <button
              type="button"
              onClick={() => { setDirectorForm(f => ({ ...f, password: generateDirectorPassword(f.lastName) })); setShowDirectorPass(true) }}
              className="flex items-center gap-1.5 border border-dashed border-neutral-300 text-info-500 rounded-md px-2.5 py-1.5 text-[11px] w-fit hover:bg-neutral-100 hover:border-info-500"
            >
              <RefreshCw size={12} /> Generar contraseña automática
            </button>
          </div>
        </div>
      </Modal>

      {/* ── Modal credenciales del director ── */}
      <Modal
        open={!!newDirectorCreds}
        onClose={() => setNewDirectorCreds(null)}
        title="✅ Director asignado"
        footer={
          <>
            <Button variant="secondary" onClick={copyDirectorCreds}>
              {copiedDirectorCreds ? <Check size={14} /> : <Copy size={14} />} {copiedDirectorCreds ? 'Copiado' : 'Copiar'}
            </Button>
            <Button onClick={() => setNewDirectorCreds(null)}>Entendido</Button>
          </>
        }
      >
        {newDirectorCreds && (
          <div className="flex flex-col gap-2.5">
            <p className="text-[12px] text-success-700 bg-success-100 rounded-lg px-3 py-2.5">
              ✅ El director ya puede ingresar con estas credenciales.
            </p>
            <div className="flex items-center gap-2.5 bg-neutral-100 border border-neutral-300 rounded-lg px-3.5 py-2.5">
              <span className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wide min-w-[80px]">Email:</span>
              <span className="text-sm font-semibold text-brand-700 font-mono break-all">{newDirectorCreds.email}</span>
            </div>
            <div className="flex items-center gap-2.5 bg-neutral-100 border border-neutral-300 rounded-lg px-3.5 py-2.5">
              <span className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wide min-w-[80px]">Contraseña:</span>
              <span className="text-sm font-semibold text-brand-700 font-mono break-all">{newDirectorCreds.password}</span>
            </div>
            <p className="text-[12px] text-[#8A6116] bg-warning-100 rounded-lg px-3 py-2.5">⚠️ Esta es la única vez que verás la contraseña.</p>
          </div>
        )}
      </Modal>
    </div>
  )
}
