'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { DollarSign, Users, AlertCircle, CheckCircle, Search, Plus, TrendingUp, Filter, FileText, Upload } from 'lucide-react'
import Card, { CardHeader, CardTitle } from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Table, { Column } from '@/components/ui/Table'
import { Input, Select, Textarea } from '@/components/ui/Input'
import { useToast } from '@/components/ui/ToastProvider'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

interface ParentBalance {
  id:        number
  firstName: string
  lastName:  string
  ci?:       string
  phone?:    string
  students:  { student: { id: number; firstName: string; lastName: string } }[]
  summary: {
    totalDebt:    number
    totalPaid:    number
    totalPending: number
    hasDebt:      boolean
    chargesCount: number
  }
}

interface Summary {
  totalCharged:   number
  totalCollected: number
  totalPending:   number
  byStatus: {
    PENDIENTE: number
    PARCIAL:   number
    PAGADO:    number
  }
}

export default function TesoreriaPage() {
  const router = useRouter()
  const toast  = useToast()
  const [parents,  setParents]  = useState<ParentBalance[]>([])
  const [summary,  setSummary]  = useState<Summary | null>(null)
  const [loading,  setLoading]  = useState(true)
  const [search,   setSearch]   = useState('')
  const [filter,   setFilter]   = useState('')
  const userRole = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('user') || '{}').role : ''
  const canEdit  = userRole === 'SUPER_ADMIN' || userRole === 'JUNTA_ESCOLAR'

  const fetchData = async () => {
    const token = localStorage.getItem('token')
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      if (filter) params.set('status', filter)

      const [pRes, sRes] = await Promise.all([
        fetch(`${API_URL}/api/treasury/parents?${params}`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_URL}/api/treasury/summary`,           { headers: { Authorization: `Bearer ${token}` } }),
      ])
      const [pData, sData] = await Promise.all([pRes.json(), sRes.json()])
      if (pRes.ok) setParents(pData)
      if (sRes.ok) setSummary(sData)
    } catch { toast('Error de conexión', 'error') }
    finally  { setLoading(false) }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchData() }, [])

  const fmt = (n: number) => `Bs. ${n.toFixed(2)}`

  const deudores  = parents.filter(p => p.summary.hasDebt).length
  const alDia     = parents.filter(p => !p.summary.hasDebt && p.summary.chargesCount > 0).length
  const sinCargos = parents.filter(p => p.summary.chargesCount === 0).length

  const columns: Column<ParentBalance>[] = [
    { key: 'num', header: '#', render: (p) => <span className="text-xs text-neutral-500">{parents.indexOf(p) + 1}</span> },
    {
      key: 'tutor', header: 'Tutor legal', render: p => (
        <div>
          <div className="font-medium text-brand-700">{p.lastName} {p.firstName}</div>
          {p.ci && <div className="text-[11px] text-neutral-500 mt-0.5">CI: {p.ci}</div>}
          {p.phone && <div className="text-[11px] text-neutral-500">{p.phone}</div>}
        </div>
      )
    },
    {
      key: 'estudiantes', header: 'Estudiantes', render: p => (
        <div className="flex flex-col gap-1">
          {p.students.length === 0
            ? <span className="text-[11px] text-neutral-500 italic">Sin estudiantes</span>
            : p.students.map(ps => (
                <span key={ps.student.id} className="text-[11px] bg-brand-100 text-brand-700 px-2 py-0.5 rounded-full w-fit">
                  {ps.student.lastName} {ps.student.firstName}
                </span>
              ))
          }
        </div>
      )
    },
    { key: 'cargado', header: 'Total cargado', render: p => <span className="font-semibold text-[13px] text-brand-700 whitespace-nowrap">{fmt(p.summary.totalDebt)}</span> },
    { key: 'pagado', header: 'Pagado', render: p => <span className="font-semibold text-[13px] text-success-700 whitespace-nowrap">{fmt(p.summary.totalPaid)}</span> },
    { key: 'pendiente', header: 'Pendiente', render: p => <span className={`font-semibold text-[13px] whitespace-nowrap ${p.summary.totalPending > 0 ? 'text-danger-600' : 'text-success-700'}`}>{fmt(p.summary.totalPending)}</span> },
    {
      key: 'estado', header: 'Estado', render: p => p.summary.chargesCount === 0
        ? <Badge tone="neutral">Sin cargos</Badge>
        : p.summary.hasDebt ? <Badge tone="danger">Con deuda</Badge> : <Badge tone="success">Al día</Badge>
    },
    {
      key: 'accion', header: 'Acción', render: p => (
        <Button size="sm" onClick={() => router.push(`/dashboard/padres/tesoreria/${p.id}`)}>Ver cuenta</Button>
      )
    },
  ]

  return (
    <div>
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-bold text-brand-700 mb-1">Tesorería</h1>
          <p className="text-[13px] text-neutral-500">Gestión económica de padres y tutores legales</p>
        </div>
        {canEdit && (
          <Button onClick={() => router.push('/dashboard/padres/cargos/nuevo')}>
            <Plus size={16}/> Nuevo cargo
          </Button>
        )}
      </div>

      {summary && (
        <div className="grid gap-3 mb-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
          <Card className="flex items-center gap-3">
            <div className="p-2.5 rounded-[10px] bg-brand-100 text-brand-700"><DollarSign size={20}/></div>
            <div><div className="text-[11px] text-neutral-500 uppercase tracking-wide mb-0.5">Total cobrado</div><div className="text-lg font-bold text-brand-700">{fmt(summary.totalCharged)}</div></div>
          </Card>
          <Card className="flex items-center gap-3">
            <div className="p-2.5 rounded-[10px] bg-success-100 text-success-700"><CheckCircle size={20}/></div>
            <div><div className="text-[11px] text-neutral-500 uppercase tracking-wide mb-0.5">Total recaudado</div><div className="text-lg font-bold text-brand-700">{fmt(summary.totalCollected)}</div></div>
          </Card>
          <Card className="flex items-center gap-3">
            <div className="p-2.5 rounded-[10px] bg-danger-100 text-danger-600"><AlertCircle size={20}/></div>
            <div><div className="text-[11px] text-neutral-500 uppercase tracking-wide mb-0.5">Total pendiente</div><div className="text-lg font-bold text-brand-700">{fmt(summary.totalPending)}</div></div>
          </Card>
          <Card className="flex items-center gap-3">
            <div className="p-2.5 rounded-[10px] bg-neutral-100 text-neutral-500"><Users size={20}/></div>
            <div><div className="text-[11px] text-neutral-500 uppercase tracking-wide mb-0.5">Tutores con deuda</div><div className="text-lg font-bold text-brand-700">{deudores} de {parents.length}</div></div>
          </Card>
        </div>
      )}

      {summary && (
        <div className="flex gap-2 flex-wrap mb-4">
          <Badge tone="danger"><AlertCircle size={13}/> {summary.byStatus.PENDIENTE} pendientes</Badge>
          <Badge tone="warning"><TrendingUp size={13}/> {summary.byStatus.PARCIAL} parciales</Badge>
          <Badge tone="success"><CheckCircle size={13}/> {summary.byStatus.PAGADO} pagados</Badge>
          <Badge tone="neutral"><Users size={13}/> {sinCargos} sin cargos</Badge>
        </div>
      )}

      <Card className="flex gap-2.5 flex-wrap items-center mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-info-500 pointer-events-none"/>
          <Input
            placeholder="Buscar tutor por nombre o CI..." value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && fetchData()}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-1.5">
          <Filter size={14} className="text-neutral-500"/>
          <Select value={filter} onChange={e => setFilter(e.target.value)} className="w-auto">
            <option value="">Todos los tutores</option>
            <option value="CON_DEUDA">Con deuda</option>
            <option value="AL_DIA">Al día</option>
          </Select>
        </div>
        <Button variant="secondary" onClick={fetchData}>Buscar</Button>
      </Card>

      <Card padded={false} className="overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16"><p className="text-sm text-neutral-500">Cargando...</p></div>
        ) : parents.length === 0 ? (
          <div className="flex justify-center py-16"><p className="text-sm text-neutral-500">No se encontraron tutores</p></div>
        ) : (
          <div className="p-4">
            <Table columns={columns} rows={parents} rowKey={p => p.id} />
          </div>
        )}
      </Card>

      <div className="px-3.5 py-2.5 text-xs text-neutral-500">
        Total: <strong>{parents.length}</strong> tutores · <strong>{deudores}</strong> con deuda · <strong>{alDia}</strong> al día
      </div>

      {userRole === 'JUNTA_ESCOLAR' && <PoaActaSection/>}
    </div>
  )
}

interface PoaActa {
  id: number
  academicYear: number
  actaFileUrl: string
  assemblyDate: string
  montoGlobal: number
  montoIndividual: number | null
  items: string
}

// Acta de aprobación del POA — sustento legal exigido por el Director Distrital
// para que la Junta Escolar pueda cobrar a los padres. Puramente informativo:
// se guarda como respaldo, no bloquea la creación de cobros de arriba.
function PoaActaSection() {
  const toast = useToast()
  const currentYear = new Date().getFullYear()
  const [acta, setActa] = useState<PoaActa | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [form, setForm] = useState({
    assemblyDate: '', montoGlobal: '', montoIndividual: '', items: '',
  })

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : ''

  const fetchActa = async () => {
    setLoading(true)
    try {
      const res  = await fetch(`${API_URL}/api/poa-acta`, { headers: { Authorization: `Bearer ${token}` } })
      const data: PoaActa[] = await res.json()
      const mine = Array.isArray(data) ? data.find(a => a.academicYear === currentYear) : null
      setActa(mine || null)
      if (mine) {
        setForm({
          assemblyDate: mine.assemblyDate.slice(0, 10),
          montoGlobal: String(mine.montoGlobal),
          montoIndividual: mine.montoIndividual != null ? String(mine.montoIndividual) : '',
          items: mine.items,
        })
      }
    } catch { /* silencioso — sección informativa */ }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchActa() }, [])

  const handleSubmit = async () => {
    if (!form.assemblyDate || !form.montoGlobal || !form.items) {
      setError('Completa fecha de asamblea, monto global e ítems del POA'); return
    }
    if (!acta && !file) { setError('Adjunta el archivo escaneado del acta'); return }
    setError(''); setSaving(true)
    try {
      const body = new FormData()
      body.append('academicYear', String(currentYear))
      body.append('assemblyDate', form.assemblyDate)
      body.append('montoGlobal', form.montoGlobal)
      if (form.montoIndividual) body.append('montoIndividual', form.montoIndividual)
      body.append('items', form.items)
      if (file) body.append('file', file)

      const res  = await fetch(`${API_URL}/api/poa-acta`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}` }, body,
      })
      const data = await res.json()
      if (!res.ok) { setError(data.message || 'Error al guardar'); return }
      toast('Acta de POA guardada correctamente', 'success')
      setEditing(false); setFile(null)
      fetchActa()
    } catch { setError('Error de conexión') }
    finally  { setSaving(false) }
  }

  if (loading) return null

  return (
    <Card className="mt-4">
      <CardHeader><CardTitle className="flex items-center gap-2"><FileText size={16}/> Acta de aprobación del POA — Gestión {currentYear}</CardTitle></CardHeader>

      {!editing && acta && (
        <div className="flex flex-col gap-2">
          <p className="text-[12px] text-neutral-500">Sustento legal de la recaudación, aprobado en asamblea. Solo informativo.</p>
          <div className="flex flex-wrap gap-2 text-[13px]">
            <Badge tone="brand">Asamblea: {new Date(acta.assemblyDate).toLocaleDateString('es-BO')}</Badge>
            <Badge tone="neutral">Monto global: Bs. {acta.montoGlobal.toFixed(2)}</Badge>
            {acta.montoIndividual != null && <Badge tone="neutral">Monto individual: Bs. {acta.montoIndividual.toFixed(2)}</Badge>}
          </div>
          <p className="text-[12.5px] text-neutral-700 whitespace-pre-wrap">{acta.items}</p>
          <div className="flex items-center gap-3 mt-1">
            <a href={acta.actaFileUrl} target="_blank" rel="noreferrer" className="text-[12.5px] font-semibold text-brand-600 hover:text-brand-700">Ver archivo del acta →</a>
            <button onClick={() => setEditing(true)} className="text-[12.5px] font-semibold text-info-500 hover:underline">Actualizar</button>
          </div>
        </div>
      )}

      {!editing && !acta && (
        <div className="flex flex-col items-start gap-2">
          <p className="text-[13px] text-neutral-500">Todavía no cargaste el acta de aprobación del POA de esta gestión.</p>
          <Button size="sm" onClick={() => setEditing(true)}><Plus size={14}/> Cargar acta de POA</Button>
        </div>
      )}

      {editing && (
        <div className="flex flex-col gap-3">
          {error && <p className="text-[13px] text-danger-600 bg-danger-100 rounded-lg px-3 py-2">{error}</p>}
          <div className="grid grid-cols-2 gap-3">
            <Input label="Fecha de la asamblea" required type="date" value={form.assemblyDate}
              onChange={e => setForm({ ...form, assemblyDate: e.target.value })} />
            <Input label="Monto global aprobado (Bs.)" required type="number" value={form.montoGlobal}
              onChange={e => setForm({ ...form, montoGlobal: e.target.value })} />
          </div>
          <Input label="Monto individual por familia (Bs.)" type="number" value={form.montoIndividual}
            onChange={e => setForm({ ...form, montoIndividual: e.target.value })} />
          <Textarea label="Ítems del POA" required rows={4} placeholder="Detalle de los ítems aprobados"
            value={form.items} onChange={e => setForm({ ...form, items: e.target.value })} />
          <div className="flex flex-col gap-1.5">
            <span className="text-[13px] font-semibold text-neutral-700">Archivo escaneado del acta{!acta && <span className="text-danger-500"> *</span>}</span>
            <label className="flex items-center gap-2 border border-dashed border-neutral-300 rounded-lg px-3 py-2.5 text-[12.5px] text-neutral-500 cursor-pointer hover:border-info-500 w-fit">
              <Upload size={14}/> {file ? file.name : 'Seleccionar archivo (PDF o imagen)'}
              <input type="file" accept="application/pdf,image/*" className="hidden" onChange={e => setFile(e.target.files?.[0] || null)} />
            </label>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleSubmit} loading={saving}>Guardar</Button>
            <Button variant="secondary" onClick={() => { setEditing(false); setFile(null); setError('') }}>Cancelar</Button>
          </div>
        </div>
      )}
    </Card>
  )
}
