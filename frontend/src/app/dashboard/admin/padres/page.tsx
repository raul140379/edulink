'use client'

import { useEffect, useState } from 'react'
import { Search, Eye, Copy, Check, Link as LinkIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import Button from '@/components/ui/Button'
import { Select } from '@/components/ui/Input'
import Badge from '@/components/ui/Badge'
import Modal from '@/components/ui/Modal'
import Table, { Column } from '@/components/ui/Table'
import Pagination from '@/components/ui/Pagination'
import { useToast } from '@/components/ui/ToastProvider'
import { useConfirm } from '@/components/ui/ConfirmProvider'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'
const PAGE_SIZE = 30

interface Student {
  id: number; firstName: string; lastName: string; ci?: string; rude?: string; kardex?: string
}

interface ParentStudent {
  relationType: string
  isTutor:      boolean
  student:      Student
}

interface Parent {
  id:        number
  firstName: string
  lastName:  string
  ci?:       string
  phone?:    string
  email?:    string
  address?:  string
  kardex?:   string | null
  user?:     { id: number; email: string; isActive: boolean }
  students:  ParentStudent[]
  _count:    { students: number }
}

interface Credentials {
  accessEmail: string; defaultPassword: string; name: string
}

const RELATION_TYPES = [
  { value: 'PADRE',       label: 'Padre' },
  { value: 'MADRE',       label: 'Madre' },
  { value: 'TUTOR_LEGAL', label: 'Tutor Legal' },
  { value: 'OTRO',        label: 'Otro' },
]

const relLabel = (v: string, isTutor?: boolean) => {
  if (isTutor) {
    if (v === 'PADRE')  return 'Padre · Tutor Legal'
    if (v === 'MADRE')  return 'Madre · Tutora Legal'
    return 'Tutor Legal'
  }
  return RELATION_TYPES.find(r => r.value === v)?.label || v
}
const relTone: Record<string, 'brand' | 'success' | 'danger' | 'neutral'> = {
  PADRE: 'brand', MADRE: 'success', TUTOR_LEGAL: 'danger', OTRO: 'neutral'
}

// El registro (alta/edición/baja) de padres es responsabilidad exclusiva de
// Junta Escolar/Delegado desde ahora (ver /dashboard/padres/familias) — esta
// pantalla de administración conserva solo lo que Director/Regente/Secretaria
// siguen necesitando para la matrícula: buscar un padre ya existente y
// vincularlo/cambiarle el tipo de relación con un estudiante.
export default function PadresPage() {
  const router = useRouter()
  const toast = useToast()
  const confirm = useConfirm()
  const [parents,    setParents]    = useState<Parent[]>([])
  const [students,   setStudents]   = useState<Student[]>([])
  const [loading,    setLoading]    = useState(true)
  const [search,     setSearch]     = useState('')
  const [showLinkModal,       setShowLinkModal]       = useState(false)
  const [showCredentials,     setShowCredentials]     = useState(false)
  const [showChangeRelModal,  setShowChangeRelModal]  = useState(false)
  const [linkId,     setLinkId]     = useState<number | null>(null)
  const [saving,     setSaving]     = useState(false)
  const [linkError,  setLinkError]  = useState('')
  const [relError,   setRelError]   = useState('')
  const [creds,      setCreds]      = useState<Credentials | null>(null)
  const [copied,     setCopied]     = useState(false)
  const [linkStudentIds,  setLinkStudentIds]  = useState<number[]>([])
  const [linkRelType,     setLinkRelType]     = useState('PADRE')
  const [changeRelParentId,  setChangeRelParentId]  = useState<number | null>(null)
  const [changeRelStudentId, setChangeRelStudentId] = useState<number | null>(null)
  const [changeRelType,      setChangeRelType]      = useState('PADRE')
  const [currentRelType,     setCurrentRelType]     = useState('')
  const [linkSearch, setLinkSearch] = useState('')
  const [changeIsTutor, setChangeIsTutor] = useState(false)
  const [filterTutor, setFilterTutor] = useState('')
  const [orderBy, setOrderBy] = useState('alfabetico')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : ''

  const fetchParents = async (targetPage = page, targetOrderBy = orderBy) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(targetPage), pageSize: String(PAGE_SIZE), orderBy: targetOrderBy })
      if (search) params.set('search', search)
      if (filterTutor === 'TUTOR')        params.set('isTutor', 'true')
      if (filterTutor === 'SIN_VINCULAR') params.set('isTutor', 'SIN_VINCULAR')
      if (filterTutor === 'NO_TUTOR')     params.set('isTutor', 'NO_TUTOR')
      const res  = await fetch(`${API_URL}/api/parents?${params}`, { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      if (res.ok) { setParents(data.data); setTotal(data.total); setPage(targetPage) }
      else toast('Error al cargar padres', 'error')
    } catch { toast('Error de conexión', 'error') }
    finally  { setLoading(false) }
  }

  const handleFilterChange = () => fetchParents(1)

  const handleOrderChange = (value: string) => { setOrderBy(value); fetchParents(1, value) }

  // Picker de "vincular estudiante" — trae todos a propósito, es una
  // búsqueda de selección, no una lista a paginar (ver ítem 24.1).
  const fetchStudents = async () => {
    try {
      const res  = await fetch(`${API_URL}/api/students`, { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      if (res.ok) setStudents(data)
    } catch { console.error('Error') }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchParents(1); fetchStudents() }, [])

  const openLink = (id: number) => { setLinkId(id); setLinkStudentIds([]); setLinkRelType('PADRE'); setLinkError(''); setShowLinkModal(true) }

  const openChangeRel = (parentId: number, studentId: number, currentRel: string, isTutor: boolean) => {
    setChangeRelParentId(parentId)
    setChangeRelStudentId(studentId)
    setCurrentRelType(currentRel)
    setChangeRelType(currentRel)
    setChangeIsTutor(isTutor)
    setRelError('')
    setShowChangeRelModal(true)
  }

  const handleLink = async () => {
    if (linkStudentIds.length === 0) { setLinkError('Selecciona al menos un estudiante'); return }
    setLinkError(''); setSaving(true)
    try {
      const res  = await fetch(`${API_URL}/api/parents/${linkId}/link-students`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ studentIds: linkStudentIds, relationType: linkRelType }),
      })
      const data = await res.json()
      if (!res.ok) { setLinkError(data.message); return }
      toast(data.message, 'success'); setShowLinkModal(false); fetchParents()
    } catch { setLinkError('Error de conexión') }
    finally  { setSaving(false) }
  }

  const handleChangeRel = async () => {
    if (!changeRelParentId || !changeRelStudentId) return
    setRelError(''); setSaving(true)
    try {
      const res  = await fetch(`${API_URL}/api/parents/${changeRelParentId}/change-relation/${changeRelStudentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ relationType: changeRelType, isTutor: changeIsTutor }),
      })
      const data = await res.json()
      if (!res.ok) { setRelError(data.message); return }
      setShowChangeRelModal(false)
      fetchParents()
      if (data.accessEmail) {
        setCreds({ accessEmail: data.accessEmail, defaultPassword: data.defaultPassword, name: '' })
        setShowCredentials(true)
      } else {
        toast(data.message, 'success')
      }
    } catch { setRelError('Error de conexión') }
    finally  { setSaving(false) }
  }

  const handleUnlink = async (parentId: number, studentId: number) => {
    const ok = await confirm('¿Desvincular este estudiante?', { danger: true, confirmLabel: 'Desvincular' })
    if (!ok) return
    try {
      const res  = await fetch(`${API_URL}/api/parents/${parentId}/unlink/${studentId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      if (res.ok) { toast(data.message, 'success'); fetchParents() }
      else toast(data.message, 'error')
    } catch { toast('Error al desvincular', 'error') }
  }

  const copyCreds = () => {
    if (!creds) return
    navigator.clipboard.writeText(`Nombre: ${creds.name}\nEmail: ${creds.accessEmail}\nContraseña: ${creds.defaultPassword}`)
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }

  const toggleLink = (id: number) => setLinkStudentIds(p => p.includes(id) ? p.filter(s => s !== id) : [...p, id])

  const columns: Column<Parent>[] = [
    { key: 'idx', header: '#', render: (p) => <span className="text-neutral-500">{parents.indexOf(p) + 1}</span> },
    {
      key: 'name', header: 'Nombre completo', render: (p) => (
        <div>
          <div className="font-medium text-brand-700">{p.lastName} {p.firstName}</div>
          {p.user && <div className="text-[11px] text-neutral-500 mt-0.5">{p.user.email}</div>}
        </div>
      ),
    },
    { key: 'ci', header: 'CI', render: (p) => <span className="text-neutral-500 text-xs">{p.ci || '—'}</span> },
    { key: 'kardex', header: 'Kardex tutor', render: (p) => p.kardex
      ? <span className="text-xs font-mono text-brand-700 font-semibold">{p.kardex}</span>
      : <span className="text-[11px] text-neutral-400 italic">Sin kardex</span>,
    },
    { key: 'phone', header: 'Teléfono', render: (p) => <span className="text-neutral-500 text-xs">{p.phone || '—'}</span> },
    {
      key: 'students', header: 'Hijos vinculados', render: (p) => p.students.length === 0
        ? <span className="text-[11px] text-neutral-500 italic">Sin vincular</span>
        : (
          <div className="flex flex-col gap-1">
            {p.students.map(ps => (
              <div key={ps.student.id} className="flex items-center gap-1.5 text-xs">
                <button
                  title="Click para cambiar tipo de relación"
                  onClick={() => openChangeRel(p.id, ps.student.id, ps.relationType, ps.isTutor)}
                >
                  <Badge tone={relTone[ps.relationType]}>{relLabel(ps.relationType, ps.isTutor)} ✏️</Badge>
                </button>
                <span className="text-brand-700">{ps.student.lastName} {ps.student.firstName}</span>
                {ps.student.kardex && <span className="text-[11px] text-neutral-500">K:{ps.student.kardex}</span>}
                <button onClick={() => handleUnlink(p.id, ps.student.id)} title="Desvincular" className="text-danger-600 hover:opacity-75 text-base leading-none px-0.5">×</button>
              </div>
            ))}
          </div>
        ),
    },
    {
      key: 'access', header: 'Acceso', render: (p) => p.user
        ? <Badge tone={p.user.isActive ? 'success' : 'danger'}>{p.user.isActive ? 'Activo' : 'Inactivo'}</Badge>
        : <span className="text-[11px] text-neutral-500 italic">Sin acceso</span>,
    },
    {
      key: 'actions', header: 'Acciones', render: (p) => (
        <div className="flex gap-1.5">
          <button title="Ver detalle" onClick={() => router.push(`/dashboard/admin/padres/${p.id}`)} className="w-7 h-7 rounded-md bg-info-500/15 text-info-500 flex items-center justify-center hover:opacity-75">
            <Eye size={13} />
          </button>
          <button title="Vincular estudiante" onClick={() => openLink(p.id)} className="w-7 h-7 rounded-md bg-success-100 text-success-700 flex items-center justify-center hover:opacity-75">
            <LinkIcon size={13} />
          </button>
        </div>
      ),
    },
  ]

  return (
    <div>
      <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-brand-700 mb-1">Padres y Tutores</h1>
          <p className="text-[13px] text-neutral-500">
            Consulta y vinculación con estudiantes — el registro de nuevos padres lo gestiona la Junta Escolar
          </p>
        </div>
      </div>

      <div className="flex gap-2.5 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-info-500 pointer-events-none" />
          <input
            placeholder="Buscar por nombre, CI o teléfono..." value={search}
            onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleFilterChange()}
            className="w-full h-10 pl-9 pr-3 rounded-lg border border-neutral-300 text-sm outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/15"
          />
        </div>
        <Select value={filterTutor} onChange={e => setFilterTutor(e.target.value)} className="w-auto min-w-[170px]">
          <option value="">Todos</option>
          <option value="TUTOR">Solo tutores legales</option>
          <option value="SIN_VINCULAR">Sin vincular</option>
          <option value="NO_TUTOR">Vinculados no tutores</option>
        </Select>
        <Select
          value={orderBy}
          onChange={e => handleOrderChange(e.target.value)}
          className="w-auto min-w-[170px]"
        >
          <option value="alfabetico">Ordenar: Alfabético</option>
          <option value="kardex">Ordenar: Por Kardex</option>
        </Select>
        <Button variant="secondary" onClick={handleFilterChange}>Buscar</Button>
      </div>

      <Table columns={columns} rows={parents} rowKey={(p) => p.id} loading={loading} emptyLabel="No se encontraron padres/tutores" />
      <Pagination page={page} pageCount={Math.ceil(total / PAGE_SIZE)} onPageChange={fetchParents} />
      <div className="px-3.5 py-2.5 text-xs text-neutral-500">Mostrando <strong>{parents.length}</strong> de <strong>{total}</strong> padres/tutores (página {page})</div>

      {/* Modal cambiar relación */}
      <Modal
        open={showChangeRelModal}
        onClose={() => setShowChangeRelModal(false)}
        title="Cambiar tipo de relación"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowChangeRelModal(false)}>Cancelar</Button>
            <Button onClick={handleChangeRel} loading={saving}>Confirmar cambio</Button>
          </>
        }
      >
        <div className="flex flex-col gap-3.5">
          {relError && <p className="text-[13px] text-danger-600 bg-danger-100 rounded-lg px-3 py-2">{relError}</p>}
          <p className="bg-neutral-100 border border-neutral-300 rounded-lg px-3 py-2.5 text-xs text-neutral-500">
            Relación actual: <strong className={
              relTone[currentRelType] === 'brand' ? 'text-brand-700' :
              relTone[currentRelType] === 'success' ? 'text-success-700' :
              relTone[currentRelType] === 'danger' ? 'text-danger-600' : 'text-neutral-700'
            }>{relLabel(currentRelType)}</strong>
          </p>
          <div className="text-xs font-bold text-brand-700 uppercase tracking-wide pb-1 border-b border-neutral-300/60">Nuevo tipo de relación</div>
          <div className="grid grid-cols-4 gap-2">
            {RELATION_TYPES.filter(r => r.value !== currentRelType).map(r => (
              <button
                key={r.value} type="button"
                onClick={() => setChangeRelType(r.value)}
                className={`px-1 py-2 rounded-lg text-xs text-center border transition-colors ${
                  changeRelType === r.value ? 'border-brand-700 bg-brand-700 text-white' : 'border-neutral-300 text-brand-700 hover:border-info-500 hover:bg-neutral-100'
                }`}
              >
                {r.value === 'TUTOR_LEGAL' ? '🔑 ' : ''}{r.label}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2 text-[13px] text-brand-700">
            <input type="checkbox" checked={changeIsTutor} onChange={e => setChangeIsTutor(e.target.checked)} className="accent-brand-700" />
            <span>🔑 Designar como Tutor Legal</span>
          </label>
          {changeRelType === 'TUTOR_LEGAL' && (
            <p className="bg-warning-100 border border-accent-500 rounded-lg px-3 py-2.5 text-xs text-[#7A6000] leading-relaxed">
              ⚠️ Al asignar como <strong>Tutor Legal</strong>:<br />
              • Se le generará acceso al sistema si no tiene<br />
              • Los otros tutores legales serán cambiados a &quot;Otro&quot;
            </p>
          )}
        </div>
      </Modal>

      {/* Modal vincular estudiantes */}
      <Modal
        open={showLinkModal}
        onClose={() => setShowLinkModal(false)}
        title="Vincular Estudiantes"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowLinkModal(false)}>Cancelar</Button>
            <Button onClick={handleLink} loading={saving}><LinkIcon size={14} /> Vincular</Button>
          </>
        }
      >
        <div className="flex flex-col gap-3.5">
          {linkError && <p className="text-[13px] text-danger-600 bg-danger-100 rounded-lg px-3 py-2">{linkError}</p>}
          <Select label="Tipo de relación" required value={linkRelType} onChange={e => setLinkRelType(e.target.value)}>
            {RELATION_TYPES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
          </Select>
          <div>
            <span className="text-[13px] font-semibold text-neutral-700 block mb-1.5">Estudiantes<span className="text-danger-500"> *</span></span>
            <input
              type="text" placeholder="Buscar por nombre, CI o RUDE..."
              value={linkSearch} onChange={e => setLinkSearch(e.target.value)}
              className="w-full h-9 px-3 rounded-lg border border-neutral-300 text-sm outline-none focus:border-brand-600 mb-2"
            />
            <div className="flex flex-col gap-1.5 max-h-[200px] overflow-y-auto border border-neutral-300 rounded-lg p-2">
              {students.filter(s =>
                linkSearch === '' ||
                `${s.firstName} ${s.lastName}`.toLowerCase().includes(linkSearch.toLowerCase()) ||
                (s.ci   && s.ci.includes(linkSearch)) ||
                (s.rude && s.rude.includes(linkSearch))
              ).map(s => (
                <label key={s.id} className={`flex items-center gap-2 p-2 rounded-md cursor-pointer text-[13px] text-brand-700 ${linkStudentIds.includes(s.id) ? 'bg-brand-100' : 'hover:bg-neutral-100'}`}>
                  <input type="checkbox" checked={linkStudentIds.includes(s.id)} onChange={() => toggleLink(s.id)} className="accent-brand-700" />
                  <span>{s.lastName} {s.firstName}</span>
                  {s.ci && <span className="text-[11px] text-neutral-500">CI: {s.ci}</span>}
                </label>
              ))}
            </div>
          </div>
        </div>
      </Modal>

      {/* Modal credenciales (solo puede disparar esto un cambio de relación a Tutor Legal) */}
      <Modal
        open={showCredentials && !!creds}
        onClose={() => setShowCredentials(false)}
        title="✅ Acceso generado"
        footer={
          <>
            <Button variant="secondary" onClick={copyCreds}>{copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'Copiado' : 'Copiar'}</Button>
            <Button onClick={() => setShowCredentials(false)}>Entendido</Button>
          </>
        }
      >
        {creds && (
          <div className="bg-neutral-100 border border-neutral-300 rounded-xl p-4 flex flex-col gap-2.5">
            <div className="flex items-center gap-2.5 bg-white border border-neutral-300 rounded-lg px-3.5 py-2.5">
              <span className="text-[12px] font-semibold text-neutral-500 uppercase tracking-wide min-w-[80px]">Email:</span>
              <span className="text-sm font-semibold text-brand-700 font-mono">{creds.accessEmail}</span>
            </div>
            <div className="flex items-center gap-2.5 bg-white border border-neutral-300 rounded-lg px-3.5 py-2.5">
              <span className="text-[12px] font-semibold text-neutral-500 uppercase tracking-wide min-w-[80px]">Contraseña:</span>
              <span className="text-sm font-semibold text-brand-700 font-mono">{creds.defaultPassword}</span>
            </div>
            <p className="text-[12px] text-[#8A6116] bg-warning-100 rounded-lg px-3 py-2.5">⚠️ Anota estas credenciales. No se podrán ver de nuevo.</p>
          </div>
        )}
      </Modal>
    </div>
  )
}
