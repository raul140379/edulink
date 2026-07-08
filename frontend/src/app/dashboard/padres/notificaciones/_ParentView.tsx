'use client'

import { useEffect, useState } from 'react'
import { Bell, Check, CheckCheck } from 'lucide-react'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

interface Notification {
  id:        number
  title:     string
  message:   string
  type:      string
  isRead:    boolean
  createdAt: string
}

const TYPE_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  ACADEMICA: { label: '📚 Académica',      color: '#1A3A7C', bg: '#E0ECF8' },
  REUNION:   { label: '👥 Reunión',        color: '#0F6E56', bg: '#E1F5EE' },
  GENERAL:   { label: '⚠️ Conducta',      color: '#633806', bg: '#FDF0E6' },
  ACTIVIDAD: { label: '📋 Trabajo/Examen', color: '#6B21A8', bg: '#F3E8FF' },
  DEUDA:     { label: '💰 Tesorería',      color: '#C0392B', bg: '#FFF0F0' },
}

const fmtDate = (d: string) => new Date(d).toLocaleDateString('es-BO', {
  day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
})

export default function ParentNotificacionesPage() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading,       setLoading]       = useState(true)
  const [filter,        setFilter]        = useState<'all' | 'unread' | 'read'>('all')
  const [markingAll,    setMarkingAll]    = useState(false)
  const [success,       setSuccess]       = useState('')

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : ''

  const fetchNotifications = async () => {
    setLoading(true)
    try {
      const res  = await fetch(`${API_URL}/api/notifications`, { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      if (res.ok) setNotifications(Array.isArray(data) ? data : [])
    } catch { console.error('Error al cargar notificaciones') }
    finally  { setLoading(false) }
  }

  useEffect(() => { fetchNotifications() }, [])

  const markAsRead = async (id: number) => {
    try {
      await fetch(`${API_URL}/api/notifications/${id}/read`, {
        method: 'PATCH', headers: { Authorization: `Bearer ${token}` }
      })
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n))
    } catch { console.error('Error al marcar como leída') }
  }

  const markAllAsRead = async () => {
    setMarkingAll(true)
    try {
      const unread = notifications.filter(n => !n.isRead)
      await Promise.all(unread.map(n =>
        fetch(`${API_URL}/api/notifications/${n.id}/read`, {
          method: 'PATCH', headers: { Authorization: `Bearer ${token}` }
        })
      ))
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })))
      setSuccess('Todas marcadas como leídas')
      setTimeout(() => setSuccess(''), 3000)
    } catch { console.error('Error') }
    finally  { setMarkingAll(false) }
  }

  const filtered = notifications.filter(n => {
    if (filter === 'unread') return !n.isRead
    if (filter === 'read')   return n.isRead
    return true
  })

  const unreadCount = notifications.filter(n => !n.isRead).length

  const getType = (type: string) =>
    TYPE_LABELS[type] || { label: '📢 General', color: '#6B8BB0', bg: '#F0F6FC' }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Notificaciones</h1>
          <p>Comunicados recibidos del colegio</p>
        </div>
        {unreadCount > 0 && (
          <button className="btn-outline" onClick={markAllAsRead} disabled={markingAll}>
            <CheckCheck size={14}/>
            {markingAll ? 'Marcando...' : `Marcar todas como leídas (${unreadCount})`}
          </button>
        )}
      </div>

      {success && <div className="alert suc">{success}</div>}

      {/* Filtros */}
      <div className="filter-bar">
        <button className={`filter-btn ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>
          Todas ({notifications.length})
        </button>
        <button className={`filter-btn ${filter === 'unread' ? 'active' : ''}`} onClick={() => setFilter('unread')}>
          No leídas ({unreadCount})
        </button>
        <button className={`filter-btn ${filter === 'read' ? 'active' : ''}`} onClick={() => setFilter('read')}>
          Leídas ({notifications.length - unreadCount})
        </button>
      </div>

      {loading ? (
        <div className="center"><div className="spinner"/></div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <Bell size={40} color="#CBE0F0"/>
          <p>{filter === 'unread' ? 'No tienes notificaciones sin leer' : 'No hay notificaciones'}</p>
        </div>
      ) : (
        <div className="notif-list">
          {filtered.map(n => {
            const t = getType(n.type)
            return (
              <div key={n.id} className={`notif-card ${!n.isRead ? 'unread' : ''}`}>
                <div className="notif-left">
                  <span className="type-badge" style={{ background: t.bg, color: t.color }}>{t.label}</span>
                  <div className="notif-title">{n.title}</div>
                  <div className="notif-msg">{n.message}</div>
                  <div className="notif-date">{fmtDate(n.createdAt)}</div>
                </div>
                <div className="notif-right">
                  {!n.isRead ? (
                    <button className="btn-read" onClick={() => markAsRead(n.id)}>
                      <Check size={13}/> Leída
                    </button>
                  ) : (
                    <span className="read-badge"><CheckCheck size={12}/> Leída</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <style>{`
        .page-header{display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:24px;gap:16px;flex-wrap:wrap}
        .page-header h1{font-size:20px;font-weight:700;color:#00838F;margin-bottom:4px}
        .page-header p{font-size:13px;color:#6B8BB0}
        .alert.suc{padding:10px 14px;border-radius:8px;font-size:13px;margin-bottom:16px;background:#E1F5EE;border:1px solid #9FE1CB;color:#0F6E56;display:flex}
        .filter-bar{display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap}
        .filter-btn{padding:7px 16px;border:1.5px solid #CBE0F0;border-radius:20px;background:#fff;color:#6B8BB0;font-size:12px;font-weight:500;cursor:pointer;transition:all .15s}
        .filter-btn:hover{border-color:#00838F;color:#00838F}
        .filter-btn.active{background:#00838F;color:#fff;border-color:#00838F}
        .center{display:flex;justify-content:center;padding:48px}
        .empty-state{display:flex;flex-direction:column;align-items:center;gap:12px;padding:60px;color:#6B8BB0;font-size:13px;background:#fff;border:1px solid #CBE0F0;border-radius:12px}
        .notif-list{display:flex;flex-direction:column;gap:10px}
        .notif-card{background:#fff;border:1px solid #CBE0F0;border-radius:12px;padding:16px;display:flex;align-items:flex-start;justify-content:space-between;gap:16px}
        .notif-card.unread{border-left:4px solid #00838F;background:#E0F7FA}
        .notif-left{flex:1;display:flex;flex-direction:column;gap:6px}
        .type-badge{padding:3px 10px;border-radius:20px;font-size:11px;font-weight:600;width:fit-content}
        .notif-title{font-size:14px;font-weight:600;color:#1A3A7C}
        .notif-msg{font-size:13px;color:#6B8BB0;line-height:1.5;white-space:pre-line}
        .notif-date{font-size:11px;color:#6B8BB0}
        .notif-right{flex-shrink:0}
        .btn-read{display:flex;align-items:center;gap:5px;padding:6px 12px;background:#E0F7FA;color:#00838F;border:1px solid #9FE1CB;border-radius:8px;font-size:12px;cursor:pointer;font-weight:500;white-space:nowrap}
        .btn-read:hover{background:#00838F;color:#fff}
        .btn-outline{display:flex;align-items:center;gap:6px;padding:8px 14px;background:#fff;color:#00838F;border:1.5px solid #9FE1CB;border-radius:8px;font-size:13px;cursor:pointer;white-space:nowrap}
        .btn-outline:hover{background:#E0F7FA}
        .btn-outline:disabled{opacity:.6;cursor:not-allowed}
        .read-badge{display:flex;align-items:center;gap:4px;font-size:11px;color:#6B8BB0}
        .spinner{width:24px;height:24px;border:2px solid rgba(0,131,143,.2);border-top-color:#00838F;border-radius:50%;animation:spin .7s linear infinite}
        @keyframes spin{to{transform:rotate(360deg)}}
      `}</style>
    </div>
  )
}