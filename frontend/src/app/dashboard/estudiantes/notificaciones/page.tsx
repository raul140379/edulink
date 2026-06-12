'use client'

import { useEffect, useState } from 'react'
import { Bell, CheckCheck, BookOpen, Users, DollarSign, Calendar, Info } from 'lucide-react'

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

const TYPE_CONFIG: Record<string, { label: string; color: string; bg: string; icon: JSX.Element }> = {
  REUNION:   { label:'Reunión',    color:'#1A3A7C', bg:'#EEF4FF', icon: <Users size={16}/> },
  ACTIVIDAD: { label:'Actividad',  color:'#633806', bg:'#FFF3E8', icon: <Calendar size={16}/> },
  DEUDA:     { label:'Deuda',      color:'#c0392b', bg:'#FDE8E8', icon: <DollarSign size={16}/> },
  ACADEMICA: { label:'Académica',  color:'#0F6E56', bg:'#E8F8F2', icon: <BookOpen size={16}/> },
  GENERAL:   { label:'General',    color:'#444441', bg:'#F5F5F4', icon: <Info size={16}/> },
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

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:300 }}>
      <div className="spinner"/>
    </div>
  )

  return (
    <div>
      {/* Header */}
      <div style={{
        background:'linear-gradient(135deg,#1A3A7C,#2756B8)',
        borderRadius:12, padding:'20px 24px', marginBottom:24, color:'#fff',
        display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:12,
      }}>
        <div>
          <div style={{ fontSize:13, opacity:.75, marginBottom:4, display:'flex', alignItems:'center', gap:6 }}>
            <Bell size={14}/> Notificaciones
          </div>
          <div style={{ fontSize:20, fontWeight:800 }}>Mis Notificaciones</div>
          {unreadCount > 0 && (
            <div style={{ fontSize:13, opacity:.8, marginTop:4 }}>
              {unreadCount} notificación{unreadCount > 1 ? 'es' : ''} sin leer
            </div>
          )}
        </div>
        {unreadCount > 0 && (
          <button onClick={markAllRead} style={{
            display:'flex', alignItems:'center', gap:6,
            backgroundColor:'rgba(255,255,255,0.15)', border:'1px solid rgba(255,255,255,0.3)',
            color:'#fff', padding:'8px 16px', borderRadius:8, cursor:'pointer', fontSize:13, fontWeight:600,
          }}>
            <CheckCheck size={16}/> Marcar todas como leídas
          </button>
        )}
      </div>

      {/* Filtros */}
      <div style={{
        backgroundColor:'#fff', borderRadius:10, padding:'14px 18px',
        boxShadow:'0 1px 4px rgba(26,58,124,.08)', marginBottom:20,
        display:'flex', flexWrap:'wrap', gap:16, alignItems:'center',
      }}>
        {/* Leídas/No leídas */}
        <div style={{ display:'flex', gap:6, alignItems:'center' }}>
          <span style={{ fontSize:11, color:'#6B8BB0' }}>Mostrar:</span>
          {[
            { label:'Todas',      value:'todos'  },
            { label:'Sin leer',   value:'unread' },
            { label:'Leídas',     value:'read'   },
          ].map(opt => (
            <button key={opt.value} onClick={() => setFilterRead(opt.value as any)}
              style={{
                padding:'4px 12px', borderRadius:20, border:'none', cursor:'pointer', fontSize:12,
                backgroundColor: filterRead === opt.value ? '#1A3A7C' : '#F0F6FC',
                color:           filterRead === opt.value ? '#fff'    : '#1A3A7C',
                fontWeight:      filterRead === opt.value ? 600       : 400,
              }}>
              {opt.label}
            </button>
          ))}
        </div>

        {/* Tipo */}
        {tipos.length > 1 && (
          <div style={{ display:'flex', gap:6, alignItems:'center', flexWrap:'wrap' }}>
            <span style={{ fontSize:11, color:'#6B8BB0' }}>Tipo:</span>
            <button onClick={() => setFilterType('todos')}
              style={{
                padding:'4px 12px', borderRadius:20, border:'none', cursor:'pointer', fontSize:12,
                backgroundColor: filterType === 'todos' ? '#1A3A7C' : '#F0F6FC',
                color:           filterType === 'todos' ? '#fff'    : '#1A3A7C',
                fontWeight:      filterType === 'todos' ? 600       : 400,
              }}>Todos</button>
            {tipos.map(t => {
              const cfg = TYPE_CONFIG[t] || TYPE_CONFIG.GENERAL
              return (
                <button key={t} onClick={() => setFilterType(t)}
                  style={{
                    padding:'4px 12px', borderRadius:20, border:'none', cursor:'pointer', fontSize:12,
                    backgroundColor: filterType === t ? cfg.color : '#F0F6FC',
                    color:           filterType === t ? '#fff'    : '#1A3A7C',
                    fontWeight:      filterType === t ? 600       : 400,
                  }}>
                  {cfg.label}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Lista */}
      {filtradas.length === 0 ? (
        <div style={{
          backgroundColor:'#fff', borderRadius:10, padding:48,
          textAlign:'center', color:'#6B8BB0',
          boxShadow:'0 1px 4px rgba(26,58,124,.08)',
        }}>
          <Bell size={40} style={{ marginBottom:12, opacity:.4 }}/>
          <div style={{ fontSize:15 }}>No hay notificaciones.</div>
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {filtradas.map(n => {
            const cfg = TYPE_CONFIG[n.type] || TYPE_CONFIG.GENERAL
            return (
              <div key={n.id}
                onClick={() => !n.isRead && markRead(n.id)}
                style={{
                  backgroundColor:'#fff', borderRadius:10,
                  boxShadow:'0 1px 4px rgba(26,58,124,.08)',
                  border: !n.isRead ? `1px solid ${cfg.color}30` : '1px solid transparent',
                  cursor: !n.isRead ? 'pointer' : 'default',
                  overflow:'hidden', transition:'box-shadow .15s',
                }}>
                <div style={{ display:'flex', alignItems:'stretch' }}>
                  {/* Barra lateral */}
                  <div style={{
                    width:4, flexShrink:0,
                    backgroundColor: !n.isRead ? cfg.color : '#E5E7EB',
                  }}/>

                  <div style={{ flex:1, padding:'14px 18px' }}>
                    <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:12 }}>
                      <div style={{ flex:1 }}>
                        {/* Tipo badge */}
                        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
                          <span style={{
                            display:'flex', alignItems:'center', gap:4,
                            fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:20,
                            backgroundColor: cfg.bg, color: cfg.color,
                          }}>
                            {cfg.icon} {cfg.label}
                          </span>
                          {!n.isRead && (
                            <span style={{
                              width:8, height:8, borderRadius:'50%',
                              backgroundColor: cfg.color, display:'inline-block',
                            }}/>
                          )}
                        </div>

                        {/* Título */}
                        <div style={{
                          fontSize:14, fontWeight: !n.isRead ? 700 : 500,
                          color:'#1A3A7C', marginBottom:6,
                        }}>
                          {n.title}
                        </div>

                        {/* Mensaje */}
                        <div style={{ fontSize:13, color:'#444', lineHeight:1.6 }}>
                          {n.message}
                        </div>

                        {/* Remitente */}
                        {n.sentBy?.teacher && (
                          <div style={{ fontSize:11, color:'#6B8BB0', marginTop:8 }}>
                            Enviado por: {n.sentBy.teacher.firstName} {n.sentBy.teacher.lastName}
                          </div>
                        )}
                      </div>

                      {/* Fecha y estado */}
                      <div style={{ flexShrink:0, textAlign:'right' }}>
                        <div style={{ fontSize:11, color:'#6B8BB0', whiteSpace:'nowrap' }}>
                          {formatDate(n.createdAt)}
                        </div>
                        {n.isRead && (
                          <div style={{ fontSize:10, color:'#6B8BB0', marginTop:4, display:'flex', alignItems:'center', gap:3, justifyContent:'flex-end' }}>
                            <CheckCheck size={11}/> Leída
                          </div>
                        )}
                        {!n.isRead && (
                          <div style={{ fontSize:10, color: cfg.color, marginTop:4, fontWeight:600 }}>
                            Toca para leer
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <style>{`
        .spinner{width:24px;height:24px;border:2px solid rgba(26,58,124,.2);border-top-color:#1A3A7C;border-radius:50%;animation:spin .7s linear infinite}
        @keyframes spin{to{transform:rotate(360deg)}}
      `}</style>
    </div>
  )
}