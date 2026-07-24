'use client'

import { useEffect, useState } from 'react'
import { ReactNode } from 'react'
import { Bell, CheckCheck, BookOpen, Users, DollarSign, Calendar, Info } from 'lucide-react'
import Card from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

interface Notification {
  id:        number
  title:     string
  message:   string
  type:      string
  isRead:    boolean
  createdAt: string
  sentBy:    { teacher: { firstName: string; lastName: string } | null } | null
}

type Tone = 'brand' | 'warning' | 'danger' | 'success' | 'neutral'

const TYPE_CONFIG: Record<string, { label: string; tone: Tone; icon: ReactNode }> = {
  REUNION:   { label:'Reunión',    tone:'brand',   icon: <Users size={16}/> },
  ACTIVIDAD: { label:'Actividad',  tone:'warning', icon: <Calendar size={16}/> },
  DEUDA:     { label:'Deuda',      tone:'danger',  icon: <DollarSign size={16}/> },
  ACADEMICA: { label:'Académica',  tone:'success', icon: <BookOpen size={16}/> },
  GENERAL:   { label:'General',    tone:'neutral', icon: <Info size={16}/> },
}

export default function NotificacionesPage() {
  const [notifs,      setNotifs]      = useState<Notification[]>([])
  const [loading,     setLoading]     = useState(true)
  const [filterType,  setFilterType]  = useState<string>('todos')
  const [filterRead,  setFilterRead]  = useState<'todos' | 'unread' | 'read'>('todos')

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) return
    fetch(`${API_URL}/api/students/my-notifications`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(d => { setNotifs(Array.isArray(d) ? d : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const markRead = async (id: number) => {
    const token = localStorage.getItem('token')
    if (!token) return
    try {
      await fetch(`${API_URL}/api/students/my-notifications/${id}/read`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      })
      setNotifs(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n))
    } catch {}
  }

  const markAllRead = async () => {
    const unread = notifs.filter(n => !n.isRead)
    for (const n of unread) await markRead(n.id)
  }

  const unreadCount = notifs.filter(n => !n.isRead).length
  const tipos = [...new Set(notifs.map(n => n.type))]

  const filtradas = notifs.filter(n => {
    if (filterType !== 'todos' && n.type !== filterType) return false
    if (filterRead === 'unread' && n.isRead)  return false
    if (filterRead === 'read'   && !n.isRead) return false
    return true
  })

  const formatDate = (d: string) => {
    const date = new Date(d)
    const now  = new Date()
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000)
    if (diff < 60)   return 'Hace un momento'
    if (diff < 3600) return `Hace ${Math.floor(diff / 60)} min`
    if (diff < 86400) return `Hace ${Math.floor(diff / 3600)} h`
    return date.toLocaleDateString('es-BO', { day:'2-digit', month:'short', year:'numeric' })
  }

  if (loading) return <div className="flex justify-center py-16"><p className="text-sm text-neutral-500">Cargando...</p></div>

  return (
    <div>
      {/* Header */}
      <div
        className="rounded-xl px-6 py-5 mb-6 text-white flex items-center justify-between flex-wrap gap-3"
        style={{ background: 'linear-gradient(135deg, var(--color-brand-700), var(--color-brand-500))' }}
      >
        <div>
          <div className="flex items-center gap-1.5 text-[13px] text-white/75 mb-1"><Bell size={14}/> Notificaciones</div>
          <div className="text-xl font-extrabold">Mis Notificaciones</div>
          {unreadCount > 0 && (
            <div className="text-[13px] text-white/80 mt-1">
              {unreadCount} notificación{unreadCount > 1 ? 'es' : ''} sin leer
            </div>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            onClick={markAllRead}
            className="flex items-center gap-1.5 bg-white/15 border border-white/30 text-white px-4 py-2 rounded-lg text-[13px] font-semibold hover:bg-white/25 transition-colors"
          >
            <CheckCheck size={16}/> Marcar todas como leídas
          </button>
        )}
      </div>

      {/* Filtros */}
      <Card className="flex flex-wrap gap-4 items-center mb-5">
        <div className="flex gap-1.5 items-center">
          <span className="text-[11px] text-neutral-500">Mostrar:</span>
          {[
            { label:'Todas',    value:'todos'  },
            { label:'Sin leer', value:'unread' },
            { label:'Leídas',   value:'read'   },
          ].map(opt => (
            <button
              key={opt.value} onClick={() => setFilterRead(opt.value as 'todos' | 'unread' | 'read')}
              className={`px-3 py-1 rounded-full text-xs transition-colors ${filterRead === opt.value ? 'bg-brand-700 text-white font-semibold' : 'bg-neutral-100 text-brand-700 hover:bg-brand-100'}`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {tipos.length > 1 && (
          <div className="flex gap-1.5 items-center flex-wrap">
            <span className="text-[11px] text-neutral-500">Tipo:</span>
            <button
              onClick={() => setFilterType('todos')}
              className={`px-3 py-1 rounded-full text-xs transition-colors ${filterType === 'todos' ? 'bg-brand-700 text-white font-semibold' : 'bg-neutral-100 text-brand-700 hover:bg-brand-100'}`}
            >
              Todos
            </button>
            {tipos.map(t => {
              const cfg = TYPE_CONFIG[t] || TYPE_CONFIG.GENERAL
              return (
                <button
                  key={t} onClick={() => setFilterType(t)}
                  className={`px-3 py-1 rounded-full text-xs transition-colors ${filterType === t ? 'bg-brand-700 text-white font-semibold' : 'bg-neutral-100 text-brand-700 hover:bg-brand-100'}`}
                >
                  {cfg.label}
                </button>
              )
            })}
          </div>
        )}
      </Card>

      {/* Lista */}
      {filtradas.length === 0 ? (
        <Card className="text-center py-12">
          <Bell size={40} className="mx-auto mb-3 opacity-40"/>
          <div className="text-[15px] text-neutral-500">No hay notificaciones.</div>
        </Card>
      ) : (
        <div className="flex flex-col gap-2.5">
          {filtradas.map(n => {
            const cfg = TYPE_CONFIG[n.type] || TYPE_CONFIG.GENERAL
            return (
              <Card
                key={n.id} padded={false}
                onClick={() => !n.isRead && markRead(n.id)}
                className={`overflow-hidden ${!n.isRead ? 'cursor-pointer !border-brand-300' : ''}`}
              >
                <div className="flex items-stretch">
                  <div className={`w-1 shrink-0 ${!n.isRead ? 'bg-brand-700' : 'bg-neutral-300'}`}/>
                  <div className="flex-1 px-4.5 py-3.5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1.5">
                          <Badge tone={cfg.tone}>{cfg.icon} {cfg.label}</Badge>
                          {!n.isRead && <span className="w-2 h-2 rounded-full bg-brand-700 inline-block"/>}
                        </div>
                        <div className={`text-sm mb-1.5 text-brand-700 ${!n.isRead ? 'font-bold' : 'font-medium'}`}>{n.title}</div>
                        <div className="text-[13px] text-neutral-700 leading-relaxed">{n.message}</div>
                        {n.sentBy?.teacher && (
                          <div className="text-[11px] text-neutral-500 mt-2">
                            Enviado por: {n.sentBy.teacher.firstName} {n.sentBy.teacher.lastName}
                          </div>
                        )}
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="text-[11px] text-neutral-500 whitespace-nowrap">{formatDate(n.createdAt)}</div>
                        {n.isRead && (
                          <div className="text-[10px] text-neutral-500 mt-1 flex items-center gap-1 justify-end">
                            <CheckCheck size={11}/> Leída
                          </div>
                        )}
                        {!n.isRead && <div className="text-[10px] text-brand-700 mt-1 font-semibold">Toca para leer</div>}
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
