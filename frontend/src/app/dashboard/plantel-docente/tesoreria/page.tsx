'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, DollarSign, AlertCircle, CheckCircle, Users, MessageCircle } from 'lucide-react'
import Card from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import { Input } from '@/components/ui/Input'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

interface Charge {
  id:          number
  title:       string
  amount:      number
  paidAmount:  number
  type:        string
  status:      string
  dueDate?:    string
  academicYear: { year: number }
}

interface Parent {
  id:        number
  firstName: string
  lastName:  string
  ci?:       string
  phone?:    string
  charges:   Charge[]
  summary:   { totalDebt: number; totalPaid: number; totalPending: number }
}

const TYPE_LABELS: Record<string, string> = {
  CUOTA_INICIAL: 'Cuota Inicial', DEUDA_ANTERIOR: 'Deuda Anterior',
  MULTA_ASAMBLEA: 'Multa Asamblea', MINGA: 'Minga', MULTA_REUNION: 'Multa Reunión',
  ACTIVIDAD: 'Actividad', MATERIAL_ESCOLAR: 'Material Escolar', OTRO: 'Otro',
}

const STATUS_TONE: Record<string, 'danger' | 'warning' | 'success' | 'neutral'> = {
  PENDIENTE: 'danger', PARCIAL: 'warning', PAGADO: 'success', ANULADO: 'neutral',
}

const fmt = (n: number) => `Bs. ${n.toFixed(2)}`

export default function TeacherTesoreriaPage() {
  const router  = useRouter()
  const [parents,  setParents]  = useState<Parent[]>([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState('')
  const [search,   setSearch]   = useState('')

  useEffect(() => {
    const fetchData = async () => {
      const token = localStorage.getItem('token')
      setLoading(true)
      try {
        const res  = await fetch(`${API_URL}/api/teachers/my-course`, {
          headers: { Authorization: `Bearer ${token}` }
        })
        const data = await res.json()
        if (!res.ok) { setError(data.message); return }

        const parentMap = new Map<number, any>()
        for (const a of data.assignments) {
          for (const ps of a.student.parents) {
            if (ps.isTutor && !parentMap.has(ps.parent.id)) {
              parentMap.set(ps.parent.id, ps.parent)
            }
          }
        }

        const tutorIds = Array.from(parentMap.keys())
        const parentsWithAccount = await Promise.all(
          tutorIds.map(async (parentId) => {
            const r = await fetch(`${API_URL}/api/treasury/parents/${parentId}/account`, {
              headers: { Authorization: `Bearer ${token}` }
            })
            const d = await r.json()
            if (r.ok) return { ...d.parent, charges: d.charges, summary: d.summary }
            return null
          })
        )
        setParents(parentsWithAccount.filter(Boolean))
      } catch { setError('Error de conexión') }
      finally  { setLoading(false) }
    }
    fetchData()
  }, [])

  const filtered = search
    ? parents.filter(p =>
        `${p.firstName} ${p.lastName}`.toLowerCase().includes(search.toLowerCase()) ||
        (p.ci && p.ci.includes(search))
      )
    : parents

  const totalDebt    = parents.reduce((s, p) => s + p.summary.totalDebt, 0)
  const totalPaid    = parents.reduce((s, p) => s + p.summary.totalPaid, 0)
  const totalPending = parents.reduce((s, p) => s + p.summary.totalPending, 0)
  const withDebt     = parents.filter(p => p.summary.totalPending > 0).length

  if (loading) return <div className="flex justify-center py-16"><p className="text-sm text-neutral-500">Cargando...</p></div>
  if (error)   return <div className="flex justify-center py-16"><p className="text-sm text-danger-600">{error}</p></div>

  return (
    <div>
      <div className="flex items-center gap-4 mb-6 flex-wrap">
        <button onClick={() => router.back()} className="flex items-center gap-1.5 text-neutral-500 hover:text-brand-700 text-[13px]">
          <ArrowLeft size={16}/> Volver
        </button>
        <div>
          <h1 className="text-xl font-bold text-brand-700 mb-1">Estado de Cuentas</h1>
          <p className="text-xs text-neutral-500">Vista de solo lectura — gestiona pagos desde el panel de Junta Escolar</p>
        </div>
      </div>

      <div className="grid gap-3 mb-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
        <Card className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-brand-100 text-brand-700"><DollarSign size={18}/></div>
          <div><div className="text-[10px] text-neutral-500 uppercase tracking-wide mb-0.5">Total cargado</div><div className="text-base font-bold text-brand-700">{fmt(totalDebt)}</div></div>
        </Card>
        <Card className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-success-100 text-success-700"><CheckCircle size={18}/></div>
          <div><div className="text-[10px] text-neutral-500 uppercase tracking-wide mb-0.5">Recaudado</div><div className="text-base font-bold text-brand-700">{fmt(totalPaid)}</div></div>
        </Card>
        <Card className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-danger-100 text-danger-600"><AlertCircle size={18}/></div>
          <div><div className="text-[10px] text-neutral-500 uppercase tracking-wide mb-0.5">Pendiente</div><div className="text-base font-bold text-brand-700">{fmt(totalPending)}</div></div>
        </Card>
        <Card className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-neutral-100 text-neutral-500"><Users size={18}/></div>
          <div><div className="text-[10px] text-neutral-500 uppercase tracking-wide mb-0.5">Con deuda</div><div className="text-base font-bold text-brand-700">{withDebt} de {parents.length}</div></div>
        </Card>
      </div>

      <div className="mb-4">
        <Input placeholder="Buscar tutor por nombre o CI..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {filtered.map(parent => (
        <Card key={parent.id} padded={false} className="overflow-hidden mb-3">
          <div className="flex items-center justify-between gap-2 px-4.5 py-3.5 border-b border-neutral-100 flex-wrap">
            <div>
              <div className="text-[15px] font-bold text-brand-700 mb-1">{parent.lastName} {parent.firstName}</div>
              <div className="flex items-center gap-3 text-xs text-neutral-500 flex-wrap">
                {parent.ci    && <span>CI: {parent.ci}</span>}
                {parent.phone && (
                  <a
                    href={`https://wa.me/591${parent.phone.replace(/\D/g,'')}?text=Estimado tutor, le contactamos de la U.E. Naciones Unidas.`}
                    target="_blank" rel="noreferrer"
                    className="flex items-center gap-1 bg-[#25D366] text-white px-2 py-0.5 rounded-[10px] text-[11px] hover:bg-[#1DA851] transition-colors"
                  >
                    <MessageCircle size={11}/> {parent.phone}
                  </a>
                )}
              </div>
            </div>
            <Badge tone={parent.summary.totalPending > 0 ? 'danger' : 'success'}>
              {parent.summary.totalPending > 0 ? `Debe: ${fmt(parent.summary.totalPending)}` : '✅ Al día'}
            </Badge>
          </div>

          {parent.charges.filter(c => c.status !== 'ANULADO').length > 0 && (
            <div className="flex flex-col">
              {parent.charges.filter(c => c.status !== 'ANULADO').map(c => (
                <div key={c.id} className="flex items-center justify-between gap-3 px-4.5 py-2.5 border-t border-neutral-100">
                  <div className="flex items-center gap-2 flex-wrap flex-1">
                    <Badge tone="brand">{TYPE_LABELS[c.type] || c.type}</Badge>
                    <span className="text-[13px] font-medium text-brand-700">{c.title}</span>
                    <span className="text-[11px] text-neutral-500">{c.academicYear.year}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-bold text-brand-700">{fmt(c.amount)}</span>
                    <Badge tone={STATUS_TONE[c.status] || 'neutral'}>{c.status}</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      ))}

      {filtered.length === 0 && (
        <div className="flex justify-center py-12"><p className="text-sm text-neutral-500">No se encontraron tutores</p></div>
      )}

      <div className="text-center text-xs text-neutral-500 p-4 bg-neutral-100/60 border border-neutral-300 rounded-lg mt-2">
        🔒 Vista de solo lectura. Para registrar pagos, contacta a la Junta Escolar.
      </div>
    </div>
  )
}
