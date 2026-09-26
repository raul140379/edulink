'use client'

import { useEffect, useState } from 'react'
import { Users, GraduationCap, BookOpen, DollarSign, Bell, TrendingUp, AlertCircle, AlertTriangle } from 'lucide-react'
import NextLink from 'next/link'
import { useDistrictConfig } from '@/hooks/useDistrictConfig'
import { ROLE_LABELS } from '@/constants/roleLabels'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

interface Stats {
  students:  number
  parents:   number
  courses:   number
  pending:   number
}

interface RecentNotification {
  id:        number
  title:     string
  message:   string
  createdAt: string
  parent:    { firstName: string; lastName: string } | null
  sentBy?:   { role: string } | null
}

// DD/MM HH:mm en 24h siempre (independiente del locale del navegador) --
// toLocaleDateString con es-BO deja el mes/día sin cero a la izquierda y usa
// formato 12h con "a. m."/"p. m.", no lo que se pidió acá.
const fmtShort = (d: string) => {
  const dt = new Date(d)
  const dd = String(dt.getDate()).padStart(2, '0')
  const mm = String(dt.getMonth() + 1).padStart(2, '0')
  const hh = String(dt.getHours()).padStart(2, '0')
  const mi = String(dt.getMinutes()).padStart(2, '0')
  return `${dd}/${mm} ${hh}:${mi}`
}

// Corta en el último espacio antes de `n` caracteres, nunca parte una
// palabra a la mitad -- si no hay ningún espacio antes de `n` (una palabra
// sola muy larga), corta duro como último recurso.
const truncate = (s: string, n: number) => {
  if (s.length <= n) return s
  const cut = s.slice(0, n)
  const lastSpace = cut.lastIndexOf(' ')
  return (lastSpace > 0 ? cut.slice(0, lastSpace) : cut) + '…'
}

export default function SchoolHome() {
  const district = useDistrictConfig()
  const [user,    setUser]    = useState<any>(null)
  const [stats,   setStats]   = useState<Stats>({ students: 0, parents: 0, courses: 0, pending: 0 })
  const [loading, setLoading] = useState(true)
  const [recentNotifs,        setRecentNotifs]        = useState<RecentNotification[]>([])
  const [loadingNotifs,       setLoadingNotifs]        = useState(true)
  const [notifsError,         setNotifsError]         = useState(false)

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : ''

  useEffect(() => {
    const userData = localStorage.getItem('user')
    if (userData) setUser(JSON.parse(userData))
    fetchStats()
    fetchRecentNotifications()
  }, [])

  const fetchRecentNotifications = async () => {
    setLoadingNotifs(true)
    setNotifsError(false)
    try {
      const res  = await fetch(`${API_URL}/api/notifications/sent?limit=5`, { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      if (res.ok && Array.isArray(data)) {
        setRecentNotifs(data)
      } else {
        setRecentNotifs([])
        setNotifsError(true)
      }
    } catch {
      setRecentNotifs([])
      setNotifsError(true)
    } finally { setLoadingNotifs(false) }
  }

  const fetchStats = async () => {
    setLoading(true)
    try {
      const [sRes, pRes, cRes, tRes] = await Promise.all([
        fetch(`${API_URL}/api/students`,                          { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_URL}/api/parents`,                           { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_URL}/api/courses`,                           { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_URL}/api/treasury/summary`,                  { headers: { Authorization: `Bearer ${token}` } }),
      ])
      const [sData, pData, cData, tData] = await Promise.all([
        sRes.json(), pRes.json(), cRes.json(), tRes.json()
      ])
      setStats({
        students: sRes.ok ? sData.length              : 0,
        parents:  pRes.ok ? pData.length              : 0,
        courses:  cRes.ok ? cData.length              : 0,
        pending:  tRes.ok ? tData.totalPending || 0   : 0,
      })
    } catch { console.error('Error cargando stats') }
    finally  { setLoading(false) }
  }

  const greeting = () => {
    const h = new Date().getHours()
    if (h < 12) return 'Buenos días'
    if (h < 18) return 'Buenas tardes'
    return 'Buenas noches'
  }

  const fmt = (n: number) => `Bs. ${n.toFixed(2)}`

  return (
    <div>
      {/* Saludo */}
      <div className="welcome-card">
        <div>
          <h1>{greeting()}, {user?.email?.split('@')[0]} 👋</h1>
          <p>Bienvenido al Sistema de Gestión de la U.E. Naciones Unidas{district.location ? ` — ${district.location}` : ''}</p>
        </div>
        <div className="welcome-badge">Gestión {new Date().getFullYear()}</div>
      </div>

      {/* Estadísticas */}
      <div className="stats-grid">
        <div className="stat-card" onClick={() => window.location.href='/dashboard/admin/estudiantes'} style={{cursor:'pointer'}}>
          <div className="stat-icon" style={{ background:'#0A5A4515', color:'#0A5A45' }}>
            <GraduationCap size={22}/>
          </div>
          <div className="stat-info">
            <span className="stat-value">{loading ? '...' : stats.students}</span>
            <span className="stat-label">Estudiantes</span>
            <span className="stat-sub">registrados</span>
          </div>
        </div>

        <div className="stat-card" onClick={() => window.location.href='/dashboard/admin/padres'} style={{cursor:'pointer'}}>
          <div className="stat-icon" style={{ background:'#4A9FD415', color:'#4A9FD4' }}>
            <Users size={22}/>
          </div>
          <div className="stat-info">
            <span className="stat-value">{loading ? '...' : stats.parents}</span>
            <span className="stat-label">Padres / Tutores</span>
            <span className="stat-sub">registrados</span>
          </div>
        </div>

        <div className="stat-card" onClick={() => window.location.href='/dashboard/admin/cursos'} style={{cursor:'pointer'}}>
          <div className="stat-icon" style={{ background:'#0F6E5615', color:'#0F6E56' }}>
            <BookOpen size={22}/>
          </div>
          <div className="stat-info">
            <span className="stat-value">{loading ? '...' : stats.courses}</span>
            <span className="stat-label">Cursos activos</span>
            <span className="stat-sub">esta gestión</span>
          </div>
        </div>

        <div className="stat-card" onClick={() => window.location.href='/dashboard/admin/tesoreria'} style={{cursor:'pointer'}}>
          <div className="stat-icon" style={{ background:'#BA751715', color:'#BA7517' }}>
            <DollarSign size={22}/>
          </div>
          <div className="stat-info">
            <span className="stat-value" style={{color: stats.pending > 0 ? '#C0392B' : '#0F6E56'}}>
              {loading ? '...' : fmt(stats.pending)}
            </span>
            <span className="stat-label">Cobros pendientes</span>
            <span className="stat-sub">por cobrar</span>
          </div>
        </div>
      </div>

      {/* Alertas y accesos rápidos */}
      <div className="bottom-grid">
        <div className="panel">
          <div className="panel-header" style={{ justifyContent: 'space-between' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Bell size={16}/> Notificaciones recientes</span>
            <NextLink href="/dashboard/admin/notificaciones" className="see-all-link">Ver todas →</NextLink>
          </div>
          {loadingNotifs ? (
            <div className="empty-state"><div className="spinner"/></div>
          ) : notifsError ? (
            <div className="empty-state error-state">
              <AlertTriangle size={26} color="#D9B45A"/>
              <p>No se pudieron cargar las notificaciones</p>
            </div>
          ) : recentNotifs.length === 0 ? (
            <div className="empty-state">
              <AlertCircle size={32} color="#DCEEE6"/>
              <p>No hay notificaciones</p>
            </div>
          ) : (
            <div className="notif-list">
              {recentNotifs.map(n => (
                <NextLink key={n.id} href="/dashboard/admin/notificaciones" className="notif-row">
                  <div className="notif-top">
                    <span className="notif-recipient">
                      {n.parent ? `${n.parent.lastName} ${n.parent.firstName}` : 'Padre eliminado'}
                    </span>
                    <span className="notif-date">{fmtShort(n.createdAt)}</span>
                  </div>
                  <p className="notif-title">{n.title}</p>
                  <p className="notif-message">{truncate(n.message, 70)}</p>
                  <span className="notif-sentby">
                    Enviada por {n.sentBy ? (ROLE_LABELS[n.sentBy.role] || n.sentBy.role) : 'el sistema'}
                  </span>
                </NextLink>
              ))}
            </div>
          )}
        </div>

        <div className="panel">
          <div className="panel-header">
            <TrendingUp size={16}/> <span>Accesos rápidos</span>
          </div>
          <div className="quick-links">
            <a href="/dashboard/admin/estudiantes" className="quick-link">
              <GraduationCap size={16}/> Registrar estudiante
            </a>
            <a href="/dashboard/admin/padres" className="quick-link">
              <Users size={16}/> Registrar padre
            </a>
            <a href="/dashboard/admin/cursos" className="quick-link">
              <BookOpen size={16}/> Ver cursos
            </a>
            <a href="/dashboard/admin/inscripciones" className="quick-link">
              <GraduationCap size={16}/> Inscripciones
            </a>
            <a href="/dashboard/admin/usuarios" className="quick-link">
              <Users size={16}/> Gestionar usuarios
            </a>
          </div>
        </div>
      </div>

      <style>{`
        h1{font-size:20px;font-weight:700;color:#0A5A45;margin-bottom:6px}
        .welcome-card{background:#0A5A45;border-radius:14px;padding:24px 28px;display:flex;align-items:center;justify-content:space-between;margin-bottom:24px;gap:16px}
        .welcome-card h1{color:#fff;font-size:20px;margin-bottom:6px}
        .welcome-card p{color:#7BBFE8;font-size:13px}
        .welcome-badge{background:#F5C518;color:#3A2F00;font-size:12px;font-weight:700;padding:6px 14px;border-radius:20px;white-space:nowrap;flex-shrink:0}
        .stats-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px;margin-bottom:24px}
        .stat-card{background:#fff;border:1px solid #DCEEE6;border-radius:12px;padding:20px;display:flex;align-items:center;gap:16px;transition:box-shadow .2s}
        .stat-card:hover{box-shadow:0 2px 12px rgba(10,90,69,.1)}
        .stat-icon{width:48px;height:48px;border-radius:12px;display:flex;align-items:center;justify-content:center;flex-shrink:0}
        .stat-info{display:flex;flex-direction:column;gap:2px}
        .stat-value{font-size:22px;font-weight:700;color:#0A5A45}
        .stat-label{font-size:13px;font-weight:500;color:#0A5A45}
        .stat-sub{font-size:11px;color:#6B8F7F}
        .bottom-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}
        .panel{background:#fff;border:1px solid #DCEEE6;border-radius:12px;overflow:hidden}
        .panel-header{display:flex;align-items:center;gap:8px;padding:14px 18px;border-bottom:1px solid #DCEEE6;font-size:13px;font-weight:600;color:#0A5A45}
        .empty-state{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:40px;gap:10px}
        .empty-state p{font-size:13px;color:#6B8F7F}
        .error-state p{color:#8A6116}
        .see-all-link{font-size:12px;font-weight:600;color:#4A9FD4;text-decoration:none}
        .see-all-link:hover{text-decoration:underline}
        .notif-list{display:flex;flex-direction:column}
        .notif-row{display:flex;flex-direction:column;gap:3px;padding:12px 18px;text-decoration:none;border-bottom:1px solid #F5FAF7;transition:background .15s}
        .notif-row:last-child{border-bottom:none}
        .notif-row:hover{background:#F5FAF7}
        .notif-top{display:flex;align-items:center;justify-content:space-between;gap:8px}
        .notif-recipient{font-size:13px;font-weight:600;color:#0A5A45}
        .notif-date{font-size:11px;color:#6B8F7F;white-space:nowrap}
        .notif-title{font-size:12px;font-weight:600;color:#0F6E56;margin:0}
        .notif-message{font-size:12px;color:#44605A;margin:0}
        .notif-sentby{font-size:11px;color:#6B8F7F;font-style:italic}
        .spinner{width:24px;height:24px;border:2px solid rgba(10,90,69,.2);border-top-color:#0A5A45;border-radius:50%;animation:spin .7s linear infinite}
        @keyframes spin{to{transform:rotate(360deg)}}
        .quick-links{display:flex;flex-direction:column;padding:8px;gap:4px}
        .quick-link{display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:8px;font-size:13px;color:#0A5A45;text-decoration:none;transition:background .15s}
        .quick-link:hover{background:#F5FAF7}
        @media(max-width:600px){.bottom-grid{grid-template-columns:1fr}.welcome-badge{display:none}}
      `}</style>
    </div>
  )
}
