'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { DollarSign, Users, AlertCircle, CheckCircle, TrendingUp, Plus, ArrowRight, RefreshCw, Trash2, Copy, Check } from 'lucide-react'
import Card from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import Table, { Column } from '@/components/ui/Table'
import { useConfirm } from '@/components/ui/ConfirmProvider'
import { useToast } from '@/components/ui/ToastProvider'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

interface SummaryBreakdown {
  totalCharged:   number
  totalCollected: number
  totalPending:   number
}

interface Summary {
  totalCharged:   number
  totalCollected: number
  totalPending:   number
  byStatus: { PENDIENTE: number; PARCIAL: number; PAGADO: number }
  byType:   Record<string, { count: number; amount: number; collected: number }>
  gestionActual:   SummaryBreakdown
  deudaTrasladada: SummaryBreakdown
}

interface ParentBalance {
  id:        number
  firstName: string
  lastName:  string
  ci?:       string
  phone?:    string
  students:  { student: { id: number; firstName: string; lastName: string } }[]
  summary: {
    totalDebt: number; totalPaid: number; totalPending: number
    hasDebt: boolean; chargesCount: number
  }
}

interface Delegate {
  id:             number
  firstName:      string
  lastName:       string
  ci?:            string
  phone?:         string
  delegateUserId?: number
  delegateUser?:  { id: number; email: string; isActive: boolean }
  delegateCourse?: {
    id: number; grade: string; parallel: string; level: string; shift: string
  }
}

interface Credentials {
  accessEmail:     string
  defaultPassword: string
  delegateName:    string
  courseLabel:     string
}

const GRADE_LABELS: Record<string, string> = {
  PRIMERO: '1°', SEGUNDO: '2°', TERCERO: '3°', CUARTO: '4°', QUINTO: '5°', SEXTO: '6°'
}
const SHIFT_LABELS: Record<string, string> = {
  MORNING: 'Mañana', AFTERNOON: 'Tarde', NIGHT: 'Noche'
}

const TYPE_LABELS: Record<string, string> = {
  CUOTA_INICIAL: 'Cuota Inicial', DEUDA_ANTERIOR: 'Deuda Anterior',
  MULTA_ASAMBLEA: 'Multa Asamblea', MINGA: 'Minga',
  MULTA_REUNION: 'Multa Reunión', ACTIVIDAD: 'Actividad',
  MATERIAL_ESCOLAR: 'Material Escolar', OTRO: 'Otro',
}

const fmt = (n: number) => `Bs. ${n.toFixed(2)}`

export default function JuntaDashboard() {
  const router  = useRouter()
  const confirm = useConfirm()
  const toast   = useToast()
  const [summary,   setSummary]   = useState<Summary | null>(null)
  const [parents,   setParents]   = useState<ParentBalance[]>([])
  const [delegates, setDelegates] = useState<Delegate[]>([])
  const [loading,   setLoading]   = useState(true)
  const [working,   setWorking]   = useState<number | null>(null)
  const [creds,     setCreds]     = useState<Credentials | null>(null)
  const [copied,    setCopied]    = useState(false)

  const fetchData = async () => {
    const token = localStorage.getItem('token')
    setLoading(true)
    try {
      const [sRes, pRes, dRes] = await Promise.all([
        fetch(`${API_URL}/api/treasury/summary`,                  { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_URL}/api/treasury/parents?status=CON_DEUDA`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_URL}/api/delegates`,                         { headers: { Authorization: `Bearer ${token}` } }),
      ])
      const [sData, pData, dData] = await Promise.all([sRes.json(), pRes.json(), dRes.json()])
      if (sRes.ok) setSummary(sData)
      if (pRes.ok) setParents(pData.slice(0, 5))
      if (dRes.ok) {
        const withDelegate = dData
          .filter((c: any) => c.delegate)
          .map((c: any) => ({
            ...c.delegate,
            delegateCourse: { id: c.id, grade: c.grade, parallel: c.parallel, level: c.level, shift: c.shift }
          }))
        setDelegates(withDelegate)
      }
    } catch { console.error('Error cargando datos') }
    finally  { setLoading(false) }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchData() }, [])

  const handleResetPassword = async (courseId: number, delegate: Delegate) => {
    if (!await confirm(`¿Resetear la contraseña de ${delegate.lastName} ${delegate.firstName}?`)) return
    const token = localStorage.getItem('token')
    setWorking(delegate.id)
    try {
      const res  = await fetch(`${API_URL}/api/courses/${courseId}/delegate-user/reset`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}` }
      })
      const data = await res.json()
      if (!res.ok) { toast(data.message, 'error'); return }
      setCreds({
        accessEmail:     delegate.delegateUser?.email || '',
        defaultPassword: data.defaultPassword,
        delegateName:    `${delegate.lastName} ${delegate.firstName}`,
        courseLabel:     `${GRADE_LABELS[delegate.delegateCourse?.grade || '']} "${delegate.delegateCourse?.parallel}" ${SHIFT_LABELS[delegate.delegateCourse?.shift || '']}`,
      })
    } catch { toast('Error de conexión', 'error') }
    finally  { setWorking(null) }
  }

  const handleRemoveDelegate = async (courseId: number, name: string) => {
    if (!await confirm(`¿Quitar a ${name} como delegado?`, { danger: true })) return
    const token = localStorage.getItem('token')
    setWorking(courseId)
    try {
      const res  = await fetch(`${API_URL}/api/delegates/course/${courseId}/remove`, {
        method: 'DELETE', headers: { Authorization: `Bearer ${token}` }
      })
      const data = await res.json()
      if (res.ok) { toast(data.message, 'success'); fetchData() }
      else toast(data.message, 'error')
    } catch { toast('Error de conexión', 'error') }
    finally  { setWorking(null) }
  }

  const copyCreds = () => {
    if (!creds) return
    navigator.clipboard.writeText(`Delegado: ${creds.delegateName}\nCurso: ${creds.courseLabel}\nEmail: ${creds.accessEmail}\nContraseña: ${creds.defaultPassword}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const porcentaje = summary
    ? summary.totalCharged > 0
      ? Math.round((summary.totalCollected / summary.totalCharged) * 100)
      : 0
    : 0

  const debtorColumns: Column<ParentBalance>[] = [
    {
      key: 'tutor', header: 'Tutor', render: p => (
        <div>
          <div className="font-medium text-brand-700">{p.lastName} {p.firstName}</div>
          {p.ci && <div className="text-[11px] text-neutral-500 mt-0.5">CI: {p.ci}</div>}
        </div>
      )
    },
    {
      key: 'students', header: 'Estudiantes', render: p => (
        <div className="flex flex-wrap gap-1">
          {p.students.map(ps => (
            <span key={ps.student.id} className="text-[11px] bg-brand-100 text-brand-700 px-2 py-0.5 rounded-full">
              {ps.student.lastName} {ps.student.firstName}
            </span>
          ))}
        </div>
      )
    },
    { key: 'pendiente', header: 'Pendiente', render: p => <span className="font-semibold text-danger-600 whitespace-nowrap">{fmt(p.summary.totalPending)}</span> },
    {
      key: 'accion', header: 'Acción', render: p => (
        <Button size="sm" onClick={() => router.push(`/dashboard/padres/tesoreria/${p.id}`)}>Ver cuenta</Button>
      )
    },
  ]

  const delegateColumns: Column<Delegate>[] = [
    { key: 'delegado', header: 'Delegado', render: d => <div className="font-medium text-brand-700">{d.lastName} {d.firstName}</div> },
    {
      key: 'contacto', header: 'CI / Teléfono', render: d => (
        <>
          {d.ci && <div className="text-[11px] text-neutral-500">CI: {d.ci}</div>}
          {d.phone && <div className="text-[11px] text-neutral-500">📱 {d.phone}</div>}
          {!d.ci && !d.phone && <span className="text-xs text-neutral-500">—</span>}
        </>
      )
    },
    {
      key: 'curso', header: 'Curso', render: d => {
        const label = d.delegateCourse
          ? `${GRADE_LABELS[d.delegateCourse.grade]} "${d.delegateCourse.parallel}" ${SHIFT_LABELS[d.delegateCourse.shift]}`
          : '—'
        return <Badge tone="success">{label}</Badge>
      }
    },
    {
      key: 'usuario', header: 'Usuario', render: d => d.delegateUser ? (
        <div>
          <div className="text-[11px] text-success-700">✅ Activo</div>
          <div className="text-[10px] text-neutral-500 font-mono">{d.delegateUser.email}</div>
        </div>
      ) : <span className="text-[11px] text-danger-600">❌ Sin usuario</span>
    },
    {
      key: 'acciones', header: 'Acciones', render: d => {
        const isWorking = working === d.id
        const courseId  = d.delegateCourse?.id
        return (
          <div className="flex gap-1.5">
            {d.delegateUser && courseId && (
              <button
                title="Resetear contraseña" disabled={isWorking}
                onClick={() => handleResetPassword(courseId, d)}
                className="w-7 h-7 rounded-md bg-brand-100 text-brand-700 hover:bg-info-500 hover:text-white transition-colors flex items-center justify-center disabled:opacity-50"
              >
                {isWorking ? <span className="w-3 h-3 border-2 border-white/40 border-t-current rounded-full animate-spin"/> : <RefreshCw size={13}/>}
              </button>
            )}
            {courseId && (
              <button
                title="Quitar delegado" disabled={isWorking}
                onClick={() => handleRemoveDelegate(courseId, `${d.lastName} ${d.firstName}`)}
                className="w-7 h-7 rounded-md bg-danger-100 text-danger-600 hover:bg-danger-500 hover:text-white transition-colors flex items-center justify-center disabled:opacity-50"
              >
                <Trash2 size={13}/>
              </button>
            )}
          </div>
        )
      }
    },
  ]

  return (
    <div>
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-bold text-brand-700 mb-1">Panel de Junta Escolar</h1>
          <p className="text-[13px] text-neutral-500">Gestión económica y delegados — U.E. Naciones Unidas</p>
        </div>
        <Button onClick={() => router.push('/dashboard/padres/cargos/nuevo')}>
          <Plus size={16}/> Nuevo cargo
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><p className="text-sm text-neutral-500">Cargando...</p></div>
      ) : (
        <>
          {/* Tarjetas resumen */}
          <div className="grid gap-3 mb-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
            <Card className="flex items-center gap-3">
              <div className="p-2.5 rounded-[10px] bg-brand-100 text-brand-700"><DollarSign size={22} /></div>
              <div><div className="text-[11px] text-neutral-500 uppercase tracking-wide mb-0.5">Total cobrado</div><div className="text-lg font-bold text-brand-700">{fmt(summary?.totalCharged || 0)}</div></div>
            </Card>
            <Card className="flex items-center gap-3">
              <div className="p-2.5 rounded-[10px] bg-success-100 text-success-700"><CheckCircle size={22} /></div>
              <div><div className="text-[11px] text-neutral-500 uppercase tracking-wide mb-0.5">Recaudado</div><div className="text-lg font-bold text-brand-700">{fmt(summary?.totalCollected || 0)}</div></div>
            </Card>
            <Card className="flex items-center gap-3">
              <div className="p-2.5 rounded-[10px] bg-danger-100 text-danger-600"><AlertCircle size={22} /></div>
              <div>
                <div className="text-[11px] text-neutral-500 uppercase tracking-wide mb-0.5">Pendiente</div>
                <div className="text-lg font-bold text-brand-700">{fmt(summary?.totalPending || 0)}</div>
                {summary && (
                  <div className="text-[10px] text-neutral-500 mt-0.5">
                    Gestión: {fmt(summary.gestionActual.totalPending)} · Trasladada: {fmt(summary.deudaTrasladada.totalPending)}
                  </div>
                )}
              </div>
            </Card>
            <Card className="flex items-center gap-3">
              <div className="p-2.5 rounded-[10px] bg-warning-100 text-[#8A6116]"><TrendingUp size={22} /></div>
              <div><div className="text-[11px] text-neutral-500 uppercase tracking-wide mb-0.5">% Recaudado</div><div className="text-lg font-bold text-brand-700">{porcentaje}%</div></div>
            </Card>
          </div>

          {/* Barra de progreso */}
          <Card className="mb-4">
            <div className="flex justify-between text-[13px] font-semibold text-brand-700 mb-2.5">
              <span>Progreso de recaudación</span>
              <span className="text-success-700">{porcentaje}%</span>
            </div>
            <div className="h-3 bg-neutral-100 rounded-full overflow-hidden mb-2">
              <div
                className="h-full rounded-full transition-[width] duration-500"
                style={{ width: `${porcentaje}%`, background: 'linear-gradient(90deg, var(--color-success-500), var(--color-info-500))' }}
              />
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-success-700">{fmt(summary?.totalCollected || 0)} recaudado</span>
              <span className="text-danger-600">{fmt(summary?.totalPending || 0)} pendiente</span>
            </div>
          </Card>

          <div className="grid gap-4 mb-4" style={{ gridTemplateColumns: '1fr 1fr' }}>
            {/* Estado por tipo de cargo */}
            <Card padded={false} className="overflow-hidden">
              <div className="px-4.5 py-3.5 border-b border-neutral-100 text-[13px] font-bold text-brand-700">📊 Por tipo de cargo</div>
              {summary && Object.keys(summary.byType).length === 0 ? (
                <p className="px-4.5 py-5 text-[13px] text-neutral-500 italic">Sin cargos registrados</p>
              ) : (
                <div className="flex flex-col px-4.5 pb-3.5">
                  {summary && Object.entries(summary.byType).map(([type, data]) => (
                    <div key={type} className="flex items-center justify-between py-2.5 border-b border-neutral-100 last:border-b-0">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[13px] font-medium text-brand-700">{TYPE_LABELS[type] || type}</span>
                        <span className="text-[11px] text-neutral-500">{data.count} cargos</span>
                      </div>
                      <div className="flex items-center gap-1 text-[13px] font-semibold">
                        <span className="text-success-700">{fmt(data.collected)}</span>
                        <span className="text-neutral-300">/</span>
                        <span className="text-neutral-500">{fmt(data.amount)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* Estado de cargos */}
            <Card padded={false} className="overflow-hidden">
              <div className="px-4.5 py-3.5 border-b border-neutral-100 text-[13px] font-bold text-brand-700">📋 Estado de cargos</div>
              <div className="flex flex-col px-4.5 pb-3.5">
                <div className="flex items-center justify-between py-3 border-b border-neutral-100">
                  <div className="flex items-center gap-2 text-[13px] font-medium text-danger-600"><AlertCircle size={16}/><span>Pendientes</span></div>
                  <span className="text-lg font-bold text-brand-700">{summary?.byStatus.PENDIENTE || 0}</span>
                </div>
                <div className="flex items-center justify-between py-3 border-b border-neutral-100">
                  <div className="flex items-center gap-2 text-[13px] font-medium text-[#7A6000]"><TrendingUp size={16}/><span>Parciales</span></div>
                  <span className="text-lg font-bold text-brand-700">{summary?.byStatus.PARCIAL || 0}</span>
                </div>
                <div className="flex items-center justify-between py-3">
                  <div className="flex items-center gap-2 text-[13px] font-medium text-success-700"><CheckCircle size={16}/><span>Pagados</span></div>
                  <span className="text-lg font-bold text-brand-700">{summary?.byStatus.PAGADO || 0}</span>
                </div>
              </div>
            </Card>
          </div>

          {/* Tutores con deuda */}
          <Card padded={false} className="overflow-hidden mb-4">
            <div className="flex items-center justify-between px-4.5 py-3.5 border-b border-neutral-100">
              <div className="flex items-center gap-2 text-[13px] font-bold text-brand-700"><Users size={15}/> Tutores con deuda pendiente</div>
              <button onClick={() => router.push('/dashboard/padres/tesoreria')} className="flex items-center gap-1 text-xs font-semibold text-brand-600 hover:underline">
                Ver todos <ArrowRight size={13}/>
              </button>
            </div>
            {parents.length === 0 ? (
              <p className="px-4.5 py-5 text-[13px] text-neutral-500 italic">🎉 ¡Todos los tutores están al día!</p>
            ) : (
              <div className="p-4">
                <Table columns={debtorColumns} rows={parents} rowKey={p => p.id} />
              </div>
            )}
          </Card>

          {/* Delegados */}
          <Card padded={false} className="overflow-hidden">
            <div className="flex items-center justify-between px-4.5 py-3.5 border-b border-neutral-100">
              <div className="flex items-center gap-2 text-[13px] font-bold text-brand-700"><Users size={15}/> Delegados de curso ({delegates.length})</div>
              <button onClick={() => router.push('/dashboard/padres/delegados')} className="flex items-center gap-1 text-xs font-semibold text-brand-600 hover:underline">
                Gestionar <ArrowRight size={13}/>
              </button>
            </div>
            {delegates.length === 0 ? (
              <p className="px-4.5 py-5 text-[13px] text-neutral-500 italic">No hay delegados asignados aún</p>
            ) : (
              <div className="p-4">
                <Table columns={delegateColumns} rows={delegates} rowKey={d => d.id} />
              </div>
            )}
          </Card>
        </>
      )}

      {/* Modal credenciales */}
      <Modal
        open={!!creds}
        onClose={() => setCreds(null)}
        title="✅ Contraseña reseteada"
        footer={
          <>
            <Button variant="secondary" onClick={copyCreds}>
              {copied ? <Check size={14}/> : <Copy size={14}/>}
              {copied ? 'Copiado' : 'Copiar'}
            </Button>
            <Button onClick={() => setCreds(null)}>Entendido</Button>
          </>
        }
      >
        {creds && (
          <div className="flex flex-col gap-3">
            <div className="bg-neutral-100 border border-neutral-300 rounded-lg p-3 text-sm text-brand-700">
              <strong>{creds.delegateName}</strong> — {creds.courseLabel}
            </div>
            <div className="flex items-center gap-2.5 bg-neutral-100 border border-neutral-300 rounded-lg px-3.5 py-2.5">
              <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wide min-w-[80px]">Email:</span>
              <span className="text-[13px] font-semibold text-brand-700 font-mono break-all">{creds.accessEmail}</span>
            </div>
            <div className="flex items-center gap-2.5 bg-neutral-100 border border-neutral-300 rounded-lg px-3.5 py-2.5">
              <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wide min-w-[80px]">Contraseña:</span>
              <span className="text-[13px] font-semibold text-brand-700 font-mono break-all">{creds.defaultPassword}</span>
            </div>
            <div className="text-xs text-[#BA7517] bg-warning-100 border border-warning-500 rounded-lg p-2.5">
              ⚠️ Entrega estas credenciales al delegado.
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
