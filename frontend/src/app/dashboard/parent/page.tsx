'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Users, DollarSign, BookOpen, Bell, AlertCircle, CheckCircle, MessageCircle } from 'lucide-react'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

interface Student {
  id:        number
  firstName: string
  lastName:  string
  ci?:       string
  rude?:     string
  gender?:   string
  assignments: {
    course: {
      id:       number
      grade:    string
      parallel: string
      level:    string
      shift:    string
    }
    academicYear: { isActive: boolean; year: number }
  }[]
}

interface Charge {
  id:        number
  amount:    number
  paidAmount:number
  status:    string
  type:      string
  description?: string
  dueDate?:  string
}

interface Notification {
  id:        number
  title:     string
  message:   string
  type:      string
  isRead:    boolean
  createdAt: string
}

interface ParentData {
  id:        number
  firstName: string
  lastName:  string
  students:  { isTutor: boolean; student: Student }[]
  charges:   Charge[]
}

const GRADES: Record<string, string> = {
  PRIMERO: '1°', SEGUNDO: '2°', TERCERO: '3°',
  CUARTO: '4°', QUINTO: '5°', SEXTO: '6°',
}
const SHIFTS: Record<string, string> = {
  MORNING: 'Mañana', AFTERNOON: 'Tarde', NIGHT: 'Noche',
}
const LEVELS: Record<string, string> = {
  INICIAL: 'Inicial', PRIMARIA: 'Primaria', SECUNDARIA: 'Secundaria',
}
const TYPE_LABELS: Record<string, string> = {
  CUOTA_INICIAL: 'Cuota Inicial', DEUDA_ANTERIOR: 'Deuda Anterior',
  MULTA_ASAMBLEA: 'Multa Asamblea', MINGA: 'Minga',
  MULTA_REUNION: 'Multa Reunión', ACTIVIDAD: 'Actividad',
  MATERIAL_ESCOLAR: 'Material Escolar', OTRO: 'Otro',
}

const fmt     = (n: number) => `Bs. ${n.toFixed(2)}`
const fmtDate = (d: string) => new Date(d).toLocaleDateString('es-BO', {
  day: '2-digit', month: 'short', year: 'numeric'
})

export default function ParentDashboard() {
  const router  = useRouter()
  const [parent,        setParent]        = useState<ParentData | null>(null)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading,       setLoading]       = useState(true)
  const [error,         setError]         = useState('')

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : ''

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      try {
        const [pRes, nRes] = await Promise.all([
          fetch(`${API_URL}/api/parents/me`,            { headers: { Authorization: `Bearer ${token}` } }),
          fetch(`${API_URL}/api/notifications/received`,{ headers: { Authorization: `Bearer ${token}` } }),
        ])
        const [pData, nData] = await Promise.all([pRes.json(), nRes.json()])
        if (pRes.ok) setParent(pData)
        else setError(pData.message || 'Error al cargar datos')
        if (nRes.ok) setNotifications(nData.slice(0, 5))
      } catch { setError('Error de conexión') }
      finally  { setLoading(false) }
    }
    fetchData()
  }, [])

  if (loading) return <div className="center"><div className="spinner"/></div>
  if (error)   return <div className="center"><p className="err">{error}</p></div>
  if (!parent) return null

  const myStudents  = parent.students.filter(ps => ps.isTutor).map(ps => ps.student)
  const totalDebt   = parent.charges.reduce((s, c) => s + (c.amount - c.paidAmount), 0)
  const totalPaid   = parent.charges.reduce((s, c) => s + c.paidAmount, 0)
  const withDebt    = parent.charges.filter(c => c.status === 'PENDIENTE' || c.status === 'PARCIAL')
  const unread      = notifications.filter(n => !n.isRead).length

  const getActiveAssignment = (s: Student) =>
    s.assignments?.find(a => a.academicYear?.isActive)

  return (
    <div>
      {/* Header */}
      <div className="welcome-header">
        <div className="welcome-avatar">{parent.lastName.charAt(0)}</div>
        <div>
          <h1>Bienvenido/a, {parent.firstName} {parent.lastName}</h1>
          <p>Panel de seguimiento escolar — U.E. Naciones Unidas</p>
        </div>
      </div>

      {/* Stats */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon green"><Users size={20}/></div>
          <div>
            <div className="stat-label">Mis hijos</div>
            <div className="stat-value">{myStudents.length}</div>
          </div>
        </div>
        <div className="stat-card" style={{cursor:'pointer'}} onClick={() => router.push('/dashboard/parent/tesoreria')}>
          <div className={`stat-icon ${totalDebt > 0 ? 'red' : 'green'}`}>
            <DollarSign size={20}/>
          </div>
          <div>
            <div className="stat-label">Deuda pendiente</div>
            <div className="stat-value" style={{color: totalDebt > 0 ? '#C0392B' : '#0F6E56'}}>
              {fmt(totalDebt)}
            </div>
          </div>
        </div>
        <div className="stat-card" style={{cursor:'pointer'}} onClick={() => router.push('/dashboard/parent/tesoreria')}>
          <div className="stat-icon green"><CheckCircle size={20}/></div>
          <div>
            <div className="stat-label">Total pagado</div>
            <div className="stat-value">{fmt(totalPaid)}</div>
          </div>
        </div>
        <div className="stat-card" style={{cursor:'pointer'}} onClick={() => router.push('/dashboard/parent/notificaciones')}>
          <div className={`stat-icon ${unread > 0 ? 'yellow' : 'blue'}`}><Bell size={20}/></div>
          <div>
            <div className="stat-label">Notificaciones</div>
            <div className="stat-value">{unread > 0 ? `${unread} nuevas` : 'Al día'}</div>
          </div>
        </div>
      </div>

      {/* Mis hijos */}
      <div className="section-card">
        <div className="section-title"><Users size={15}/> Mis hijos</div>
        {myStudents.length === 0 ? (
          <div className="no-data">No tienes hijos registrados como tutor legal</div>
        ) : (
          <div className="students-grid">
            {myStudents.map(s => {
              const assignment = getActiveAssignment(s)
              return (
                <div key={s.id} className="student-card"
                  onClick={() => assignment && router.push(`/dashboard/parent/calificaciones?studentId=${s.id}`)}>
                  <div className="student-avatar">
                    {s.gender === 'MASCULINO' ? '👦' : '👧'}
                  </div>
                  <div className="student-info">
                    <div className="student-name">{s.lastName} {s.firstName}</div>
                    {s.ci && <div className="student-sub">CI: {s.ci}</div>}
                    {assignment ? (
                      <div className="course-pill">
                        📚 {LEVELS[assignment.course.level]} — {GRADES[assignment.course.grade]} &quot;{assignment.course.parallel}&quot; {SHIFTS[assignment.course.shift]}
                      </div>
                    ) : (
                      <div className="no-course">Sin curso inscrito</div>
                    )}
                  </div>
                  <div className="student-arrow">→</div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div className="two-cols">
        {/* Deudas pendientes */}
        <div className="section-card">
          <div className="section-title">
            <DollarSign size={15}/> Estado de cuenta
            <button className="ver-mas" onClick={() => router.push('/dashboard/parent/tesoreria')}>
              Ver todo →
            </button>
          </div>
          {withDebt.length === 0 ? (
            <div className="no-data">🎉 ¡Estás al día con todos los pagos!</div>
          ) : (
            <div className="charges-list">
              {withDebt.slice(0, 4).map(c => (
                <div key={c.id} className="charge-item">
                  <div className="charge-info">
                    <div className="charge-type">{TYPE_LABELS[c.type] || c.type}</div>
                    {c.description && <div className="charge-desc">{c.description}</div>}
                    {c.dueDate && <div className="charge-date">Vence: {fmtDate(c.dueDate)}</div>}
                  </div>
                  <div className="charge-amounts">
                    <div className="charge-pending">{fmt(c.amount - c.paidAmount)}</div>
                    <div className={`charge-status ${c.status.toLowerCase()}`}>{c.status}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Notificaciones recientes */}
        <div className="section-card">
          <div className="section-title">
            <Bell size={15}/> Notificaciones recientes
            <button className="ver-mas" onClick={() => router.push('/dashboard/parent/notificaciones')}>
              Ver todas →
            </button>
          </div>
          {notifications.length === 0 ? (
            <div className="no-data">No tienes notificaciones</div>
          ) : (
            <div className="notif-list">
              {notifications.map(n => (
                <div key={n.id} className={`notif-item ${!n.isRead ? 'unread' : ''}`}>
                  <div className="notif-title">{n.title}</div>
                  <div className="notif-msg">{n.message}</div>
                  <div className="notif-date">{fmtDate(n.createdAt)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <style>{`
        .center{display:flex;justify-content:center;align-items:center;padding:48px;color:#6B8BB0}
        .err{color:#C0392B;font-size:14px}
        .welcome-header{display:flex;align-items:center;gap:16px;margin-bottom:24px;background:#fff;border:1px solid #CBE0F0;border-radius:14px;padding:20px}
        .welcome-avatar{width:56px;height:56px;border-radius:14px;background:#27500A;color:#fff;display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:800;flex-shrink:0}
        .welcome-header h1{font-size:18px;font-weight:700;color:#1A3A7C;margin-bottom:4px}
        .welcome-header p{font-size:13px;color:#6B8BB0}
        .stats-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;margin-bottom:16px}
        .stat-card{background:#fff;border:1px solid #CBE0F0;border-radius:12px;padding:16px;display:flex;align-items:center;gap:12px}
        .stat-icon{padding:10px;border-radius:10px;display:flex}
        .stat-icon.green{background:#E1F5EE;color:#0F6E56}
        .stat-icon.red{background:#FFF0F0;color:#C0392B}
        .stat-icon.blue{background:#E0ECF8;color:#1A3A7C}
        .stat-icon.yellow{background:#FFFBEA;color:#7A6000}
        .stat-label{font-size:11px;color:#6B8BB0;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px}
        .stat-value{font-size:18px;font-weight:700;color:#1A3A7C}
        .section-card{background:#fff;border:1px solid #CBE0F0;border-radius:12px;overflow:hidden;margin-bottom:16px}
        .section-title{display:flex;align-items:center;gap:8px;padding:14px 18px;border-bottom:1px solid #F0F6FC;font-size:13px;font-weight:700;color:#1A3A7C}
        .ver-mas{margin-left:auto;background:none;border:none;color:#27500A;font-size:12px;font-weight:600;cursor:pointer}
        .ver-mas:hover{text-decoration:underline}
        .no-data{padding:20px 18px;font-size:13px;color:#6B8BB0;font-style:italic}
        .students-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px;padding:16px}
        .student-card{display:flex;align-items:center;gap:12px;padding:14px;background:#F8FBFF;border:1px solid #CBE0F0;border-radius:10px;cursor:pointer;transition:box-shadow .2s}
        .student-card:hover{box-shadow:0 2px 12px rgba(26,58,124,.1);border-color:#4A9FD4}
        .student-avatar{font-size:32px;flex-shrink:0}
        .student-info{flex:1}
        .student-name{font-size:14px;font-weight:600;color:#1A3A7C;margin-bottom:2px}
        .student-sub{font-size:11px;color:#6B8BB0;margin-bottom:4px}
        .course-pill{font-size:11px;background:#E1F5EE;color:#27500A;padding:3px 10px;border-radius:20px;display:inline-block;font-weight:500}
        .no-course{font-size:11px;color:#C0392B;font-style:italic}
        .student-arrow{color:#6B8BB0;font-size:16px}
        .two-cols{display:grid;grid-template-columns:1fr 1fr;gap:16px}
        .charges-list{display:flex;flex-direction:column}
        .charge-item{display:flex;align-items:center;justify-content:space-between;padding:12px 18px;border-bottom:1px solid #F0F6FC;gap:12px}
        .charge-item:last-child{border-bottom:none}
        .charge-info{flex:1}
        .charge-type{font-size:13px;font-weight:500;color:#1A3A7C}
        .charge-desc{font-size:11px;color:#6B8BB0;margin-top:2px}
        .charge-date{font-size:11px;color:#BA7517;margin-top:2px}
        .charge-amounts{text-align:right}
        .charge-pending{font-size:14px;font-weight:700;color:#C0392B}
        .charge-status{font-size:10px;font-weight:600;padding:2px 8px;border-radius:20px;margin-top:3px;display:inline-block}
        .charge-status.pendiente{background:#FFF0F0;color:#C0392B}
        .charge-status.parcial{background:#FFFBEA;color:#7A6000}
        .charge-status.pagado{background:#E1F5EE;color:#0F6E56}
        .notif-list{display:flex;flex-direction:column}
        .notif-item{padding:12px 18px;border-bottom:1px solid #F0F6FC}
        .notif-item:last-child{border-bottom:none}
        .notif-item.unread{background:#FAFFF8;border-left:3px solid #27500A}
        .notif-title{font-size:13px;font-weight:600;color:#1A3A7C;margin-bottom:2px}
        .notif-msg{font-size:12px;color:#6B8BB0;line-height:1.4;margin-bottom:4px}
        .notif-date{font-size:11px;color:#6B8BB0}
        .spinner{width:24px;height:24px;border:2px solid rgba(39,80,10,.2);border-top-color:#27500A;border-radius:50%;animation:spin .7s linear infinite}
        @keyframes spin{to{transform:rotate(360deg)}}
        @media(max-width:768px){.two-cols{grid-template-columns:1fr}.stats-grid{grid-template-columns:1fr 1fr}}
      `}</style>
    </div>
  )
}