'use client'

import { useEffect, useState } from 'react'
import { ReactNode } from 'react'
import { Bell, Check, CheckCheck } from 'lucide-react'
import Card from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import { useToast } from '@/components/ui/ToastProvider'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

interface Notification {
  id:        number
  title:     string
  message:   string
  type:      string
  isRead:    boolean
  createdAt: string
}

type Tone = 'brand' | 'success' | 'warning' | 'info' | 'danger' | 'neutral'

const TYPE_LABELS: Record<string, { label: string; tone: Tone }> = {
  ACADEMICA: { label: '📚 Académica',      tone: 'brand' },
  REUNION:   { label: '👥 Reunión',        tone: 'success' },
  GENERAL:   { label: '⚠️ Conducta',      tone: 'warning' },
  ACTIVIDAD: { label: '📋 Trabajo/Examen', tone: 'info' },
  DEUDA:     { label: '💰 Tesorería',      tone: 'danger' },
}

const fmtDate = (d: string) => new Date(d).toLocaleDateString('es-BO', {
  day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
})

export default function ParentNotificacionesPage() {
  const toast = useToast()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading,       setLoading]       = useState(true)
  const [filter,        setFilter]        = useState<'all' | 'unread' | 'read'>('all')
  const [markingAll,    setMarkingAll]    = useState(false)

  const fetchNotifications = async () => {
    const token = localStorage.getItem('token')
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
    const token = localStorage.getItem('token')
    try {
      await fetch(`${API_URL}/api/notifications/${id}/read`, {
        method: 'PATCH', headers: { Authorization: `Bearer ${token}` }
      })
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n))
    } catch { console.error('Error al marcar como leída') }
  }

  const markAllAsRead = async () => {
    const token = localStorage.getItem('token')
    setMarkingAll(true)
    try {
      const unread = notifications.filter(n => !n.isRead)
      await Promise.all(unread.map(n =>
        fetch(`${API_URL}/api/notifications/${n.id}/read`, {
          method: 'PATCH', headers: { Authorization: `Bearer ${token}` }
        })
      ))
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })))
      toast('Todas marcadas como leídas', 'success')
    } catch { console.error('Error') }
    finally  { setMarkingAll(false) }
  }

  const filtered = notifications.filter(n => {
    if (filter === 'unread') return !n.isRead
    if (filter === 'read')   return n.isRead
    return true
  })

  const unreadCount = notifications.filter(n => !n.isRead).length

  const getType = (type: string): { label: ReactNode; tone: Tone } =>
    TYPE_LABELS[type] || { label: '📢 General', tone: 'neutral' }

  return (
    <div>
      <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-brand-700 mb-1">Notificaciones</h1>
          <p className="text-[13px] text-neutral-500">Comunicados recibidos del colegio</p>
        </div>
        {unreadCount > 0 && (
          <Button variant="secondary" onClick={markAllAsRead} loading={markingAll}>
            {!markingAll && <CheckCheck size={14}/>}
            {markingAll ? 'Marcando...' : `Marcar todas como leídas (${unreadCount})`}
          </Button>
        )}
      </div>

      <div className="flex gap-2 flex-wrap mb-4">
        <button
          onClick={() => setFilter('all')}
          className={`px-4 py-1.5 rounded-full text-xs font-medium border transition-colors ${filter === 'all' ? 'bg-brand-700 text-white border-brand-700' : 'bg-white text-neutral-500 border-neutral-300 hover:border-brand-500 hover:text-brand-700'}`}
        >
          Todas ({notifications.length})
        </button>
        <button
          onClick={() => setFilter('unread')}
          className={`px-4 py-1.5 rounded-full text-xs font-medium border transition-colors ${filter === 'unread' ? 'bg-brand-700 text-white border-brand-700' : 'bg-white text-neutral-500 border-neutral-300 hover:border-brand-500 hover:text-brand-700'}`}
        >
          No leídas ({unreadCount})
        </button>
        <button
          onClick={() => setFilter('read')}
          className={`px-4 py-1.5 rounded-full text-xs font-medium border transition-colors ${filter === 'read' ? 'bg-brand-700 text-white border-brand-700' : 'bg-white text-neutral-500 border-neutral-300 hover:border-brand-500 hover:text-brand-700'}`}
        >
          Leídas ({notifications.length - unreadCount})
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><p className="text-sm text-neutral-500">Cargando...</p></div>
      ) : filtered.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 py-14 text-neutral-500">
          <Bell size={40} className="text-neutral-300"/>
          <p className="text-[13px]">{filter === 'unread' ? 'No tienes notificaciones sin leer' : 'No hay notificaciones'}</p>
        </Card>
      ) : (
        <div className="flex flex-col gap-2.5">
          {filtered.map(n => {
            const t = getType(n.type)
            return (
              <Card key={n.id} className={`flex items-start justify-between gap-4 ${!n.isRead ? '!bg-brand-100/40 !border-l-4 !border-l-brand-700' : ''}`}>
                <div className="flex-1 flex flex-col gap-1.5">
                  <Badge tone={t.tone}>{t.label}</Badge>
                  <div className="text-sm font-semibold text-brand-700">{n.title}</div>
                  <div className="text-[13px] text-neutral-500 leading-relaxed whitespace-pre-line">{n.message}</div>
                  <div className="text-[11px] text-neutral-500">{fmtDate(n.createdAt)}</div>
                </div>
                <div className="shrink-0">
                  {!n.isRead ? (
                    <Button variant="secondary" size="sm" onClick={() => markAsRead(n.id)}>
                      <Check size={13}/> Leída
                    </Button>
                  ) : (
                    <span className="flex items-center gap-1 text-[11px] text-neutral-500"><CheckCheck size={12}/> Leída</span>
                  )}
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
