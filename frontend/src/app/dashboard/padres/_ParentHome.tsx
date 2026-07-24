'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Users, DollarSign, BookOpen, Bell, CheckCircle } from 'lucide-react'
import Card from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

interface Student {
  id: number; firstName: string; lastName: string
  ci?: string; rude?: string; gender?: string
  assignments: {
    course: { id: number; grade: string; parallel: string; level: string; shift: string }
    academicYear: { isActive: boolean; year: number }
  }[]
}

interface Charge {
  id: number; amount: number; paidAmount: number
  status: string; type: string; description?: string; dueDate?: string
}

interface Notification {
  id: number; title: string; message: string
  type: string; isRead: boolean; createdAt: string
}

interface ParentData {
  id: number; firstName: string; lastName: string
  students: { isTutor: boolean; student: Student }[]
  charges:  Charge[]
}

const GRADES: Record<string,string> = { PRIMERO:'1°', SEGUNDO:'2°', TERCERO:'3°', CUARTO:'4°', QUINTO:'5°', SEXTO:'6°' }
const SHIFTS: Record<string,string> = { MORNING:'Mañana', AFTERNOON:'Tarde', NIGHT:'Noche' }
const LEVELS: Record<string,string> = { INICIAL:'Inicial', PRIMARIA:'Primaria', SECUNDARIA:'Secundaria' }
const TYPE_LABELS: Record<string,string> = {
  CUOTA_INICIAL:'Cuota Inicial', DEUDA_ANTERIOR:'Deuda Anterior',
  MULTA_ASAMBLEA:'Multa Asamblea', MINGA:'Minga',
  MULTA_REUNION:'Multa Reunión', ACTIVIDAD:'Actividad',
  MATERIAL_ESCOLAR:'Material Escolar', OTRO:'Otro',
}
const CHARGE_TONE: Record<string, 'danger' | 'warning' | 'success'> = { PENDIENTE: 'danger', PARCIAL: 'warning', PAGADO: 'success' }

const fmt     = (n: number) => `Bs. ${n.toFixed(2)}`
const fmtDate = (d: string) => new Date(d).toLocaleDateString('es-BO', { day:'2-digit', month:'short', year:'numeric' })

export default function ParentDashboard() {
  const router = useRouter()
  const [parent,        setParent]        = useState<ParentData | null>(null)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading,       setLoading]       = useState(true)
  const [error,         setError]         = useState('')

  useEffect(() => {
    const fetchData = async () => {
      const token = localStorage.getItem('token')
      if (!token) { setError('No autenticado'); setLoading(false); return }
      setLoading(true)
      try {
        const [pRes, nRes] = await Promise.all([
          fetch(`${API_URL}/api/parents/me`,       { headers: { Authorization: `Bearer ${token}` } }),
          fetch(`${API_URL}/api/notifications`,    { headers: { Authorization: `Bearer ${token}` } }),
        ])
        const [pData, nData] = await Promise.all([pRes.json(), nRes.json()])
        if (pRes.ok) setParent(pData)
        else setError(pData.message || 'Error al cargar datos')
        if (nRes.ok) setNotifications(Array.isArray(nData) ? nData.slice(0, 5) : [])
      } catch { setError('Error de conexión') }
      finally  { setLoading(false) }
    }
    fetchData()
  }, [])

  if (loading) return <div className="flex justify-center py-16"><p className="text-sm text-neutral-500">Cargando...</p></div>
  if (error)   return <div className="flex justify-center py-16"><p className="text-sm text-danger-600">{error}</p></div>
  if (!parent) return null

  const myStudents = parent.students.filter(ps => ps.isTutor).map(ps => ps.student)
  const totalDebt  = parent.charges.reduce((s, c) => s + (c.amount - c.paidAmount), 0)
  const totalPaid  = parent.charges.reduce((s, c) => s + c.paidAmount, 0)
  const withDebt   = parent.charges.filter(c => c.status === 'PENDIENTE' || c.status === 'PARCIAL')
  const unread     = notifications.filter(n => !n.isRead).length

  const getActiveAssignment = (s: Student) => s.assignments?.find(a => a.academicYear?.isActive)

  return (
    <div>
      <Card className="flex items-center gap-4 mb-6">
        <div className="w-14 h-14 rounded-2xl bg-brand-700 text-white flex items-center justify-center text-xl font-extrabold shrink-0">
          {parent.lastName.charAt(0)}
        </div>
        <div>
          <h1 className="text-lg font-bold text-brand-700 mb-1">Bienvenido/a, {parent.firstName} {parent.lastName}</h1>
          <p className="text-[13px] text-neutral-500">Panel de seguimiento escolar — U.E. Naciones Unidas</p>
        </div>
      </Card>

      <div className="grid gap-3 mb-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
        <Card className="flex items-center gap-3">
          <div className="p-2.5 rounded-[10px] bg-success-100 text-success-700"><Users size={20} /></div>
          <div><div className="text-[11px] text-neutral-500 uppercase tracking-wide mb-0.5">Mis hijos</div><div className="text-lg font-bold text-brand-700">{myStudents.length}</div></div>
        </Card>
        <Card className="flex items-center gap-3 cursor-pointer" onClick={() => router.push('/dashboard/padres/tesoreria')}>
          <div className={`p-2.5 rounded-[10px] ${totalDebt > 0 ? 'bg-danger-100 text-danger-600' : 'bg-success-100 text-success-700'}`}><DollarSign size={20} /></div>
          <div>
            <div className="text-[11px] text-neutral-500 uppercase tracking-wide mb-0.5">Deuda pendiente</div>
            <div className={`text-lg font-bold ${totalDebt > 0 ? 'text-danger-600' : 'text-success-700'}`}>{fmt(totalDebt)}</div>
          </div>
        </Card>
        <Card className="flex items-center gap-3 cursor-pointer" onClick={() => router.push('/dashboard/padres/tesoreria')}>
          <div className="p-2.5 rounded-[10px] bg-success-100 text-success-700"><CheckCircle size={20} /></div>
          <div><div className="text-[11px] text-neutral-500 uppercase tracking-wide mb-0.5">Total pagado</div><div className="text-lg font-bold text-brand-700">{fmt(totalPaid)}</div></div>
        </Card>
        <Card className="flex items-center gap-3 cursor-pointer" onClick={() => router.push('/dashboard/padres/notificaciones')}>
          <div className={`p-2.5 rounded-[10px] ${unread > 0 ? 'bg-warning-100 text-[#8A6116]' : 'bg-brand-100 text-brand-700'}`}><Bell size={20} /></div>
          <div>
            <div className="text-[11px] text-neutral-500 uppercase tracking-wide mb-0.5">Notificaciones</div>
            <div className="text-lg font-bold text-brand-700">{unread > 0 ? `${unread} nuevas` : 'Al día'}</div>
          </div>
        </Card>
      </div>

      {/* Mis hijos */}
      <Card padded={false} className="overflow-hidden mb-4">
        <div className="flex items-center gap-2 px-4.5 py-3.5 border-b border-neutral-100 text-[13px] font-bold text-brand-700">
          <Users size={15} /> Mis hijos
        </div>
        {myStudents.length === 0 ? (
          <p className="px-4.5 py-5 text-[13px] text-neutral-500 italic">No tienes hijos registrados como tutor legal</p>
        ) : (
          <div className="grid gap-3 p-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
            {myStudents.map(s => {
              const assignment = getActiveAssignment(s)
              return (
                <div
                  key={s.id}
                  onClick={() => router.push(`/dashboard/padres/calificaciones?studentId=${s.id}`)}
                  className="flex items-center gap-3 p-3.5 bg-neutral-100/60 border border-neutral-300 rounded-[10px] cursor-pointer hover:shadow-md hover:border-info-500 transition-shadow"
                >
                  <div className="text-3xl shrink-0">{s.gender === 'MASCULINO' ? '👦' : '👧'}</div>
                  <div className="flex-1">
                    <div className="text-sm font-semibold text-brand-700 mb-0.5">{s.lastName} {s.firstName}</div>
                    {s.ci && <div className="text-[11px] text-neutral-500 mb-1">CI: {s.ci}</div>}
                    {assignment ? (
                      <Badge tone="success">📚 {LEVELS[assignment.course.level]} — {GRADES[assignment.course.grade]} &quot;{assignment.course.parallel}&quot; {SHIFTS[assignment.course.shift]}</Badge>
                    ) : <span className="text-[11px] text-danger-600 italic">Sin curso inscrito</span>}
                  </div>
                  <div className="text-neutral-500">→</div>
                </div>
              )
            })}
          </div>
        )}
      </Card>

      <div className="grid gap-4" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <Card padded={false} className="overflow-hidden">
          <div className="flex items-center gap-2 px-4.5 py-3.5 border-b border-neutral-100 text-[13px] font-bold text-brand-700">
            <DollarSign size={15} /> Estado de cuenta
            <button onClick={() => router.push('/dashboard/padres/tesoreria')} className="ml-auto text-xs font-semibold text-brand-600 hover:underline">Ver todo →</button>
          </div>
          {withDebt.length === 0 ? (
            <p className="px-4.5 py-5 text-[13px] text-neutral-500 italic">🎉 ¡Estás al día con todos los pagos!</p>
          ) : (
            <div className="flex flex-col">
              {withDebt.slice(0, 4).map(c => (
                <div key={c.id} className="flex items-center justify-between gap-3 px-4.5 py-3 border-t border-neutral-100 first:border-t-0">
                  <div className="flex-1">
                    <div className="text-[13px] font-medium text-brand-700">{TYPE_LABELS[c.type] || c.type}</div>
                    {c.description && <div className="text-[11px] text-neutral-500 mt-0.5">{c.description}</div>}
                    {c.dueDate && <div className="text-[11px] text-[#BA7517] mt-0.5">Vence: {fmtDate(c.dueDate)}</div>}
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm font-bold text-danger-600">{fmt(c.amount - c.paidAmount)}</div>
                    <Badge tone={CHARGE_TONE[c.status] || 'neutral'}>{c.status}</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card padded={false} className="overflow-hidden">
          <div className="flex items-center gap-2 px-4.5 py-3.5 border-b border-neutral-100 text-[13px] font-bold text-brand-700">
            <Bell size={15} /> Notificaciones recientes
            <button onClick={() => router.push('/dashboard/padres/notificaciones')} className="ml-auto text-xs font-semibold text-brand-600 hover:underline">Ver todas →</button>
          </div>
          {notifications.length === 0 ? (
            <p className="px-4.5 py-5 text-[13px] text-neutral-500 italic">No tienes notificaciones</p>
          ) : (
            <div className="flex flex-col">
              {notifications.map(n => (
                <div key={n.id} className={`px-4.5 py-3 border-t border-neutral-100 first:border-t-0 ${!n.isRead ? 'bg-brand-100/40 border-l-2 border-l-brand-700' : ''}`}>
                  <div className="text-[13px] font-semibold text-brand-700 mb-0.5">{n.title}</div>
                  <div className="text-xs text-neutral-500 leading-relaxed mb-1">{n.message}</div>
                  <div className="text-[11px] text-neutral-500">{fmtDate(n.createdAt)}</div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
