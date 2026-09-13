'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Circle } from 'lucide-react'
import { notificacionesApi, MyNotification, TIPO_LABEL } from '@/modules/notificaciones/api'

function formatDateTime(iso: string): string {
  const date = new Date(iso)
  return date.toLocaleDateString('es-BO', { day: 'numeric', month: 'short' }) + ' · ' +
    date.toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' })
}

export default function NotificacionesPage() {
  const router = useRouter()
  const [items, setItems] = useState<MyNotification[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [openId, setOpenId] = useState<number | null>(null)

  useEffect(() => {
    notificacionesApi.getMine()
      .then(setItems)
      .catch(() => setError('No se pudieron cargar las notificaciones'))
      .finally(() => setLoading(false))
  }, [])

  const handleOpen = async (n: MyNotification) => {
    setOpenId(openId === n.id ? null : n.id)
    if (!n.isRead) {
      try {
        await notificacionesApi.markAsRead(n.id)
        setItems(prev => prev.map(x => x.id === n.id ? { ...x, isRead: true } : x))
      } catch {
        // si falla marcar como leída, no rompe la lectura del mensaje
      }
    }
  }

  return (
    <div className="flex flex-col max-w-lg mx-auto">
      <div className="px-4 pt-4 pb-2 flex items-center gap-2">
        <button onClick={() => router.push('/')} className="p-1 -ml-1 text-brand-700 active:opacity-60">
          <ArrowLeft size={22} />
        </button>
        <h1 className="text-[17px] font-bold text-brand-700">Notificaciones</h1>
      </div>

      <div className="px-4 py-2 flex flex-col gap-2 pb-8">
        {error ? (
          <p className="text-sm text-danger-600 bg-danger-100 rounded-lg px-3 py-2.5">{error}</p>
        ) : loading ? (
          <p className="text-sm text-text-secondary text-center py-8">Cargando...</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-text-secondary text-center py-8">No tenés notificaciones todavía.</p>
        ) : (
          items.map(n => (
            <button
              key={n.id}
              onClick={() => handleOpen(n)}
              className={`text-left bg-white rounded-xl border px-4 py-3 flex flex-col gap-1 ${
                n.isRead ? 'border-border' : 'border-brand-500'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[13px] font-semibold text-brand-700">{TIPO_LABEL[n.type]}</span>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[11px] text-text-secondary">{formatDateTime(n.createdAt)}</span>
                  {!n.isRead && <Circle size={8} className="text-brand-500 fill-brand-500" />}
                </div>
              </div>
              <div className="text-[14px] font-semibold text-brand-900">{n.title}</div>
              <div className={`text-[13px] text-text-secondary ${openId === n.id ? '' : 'line-clamp-2'}`}>{n.message}</div>
            </button>
          ))
        )}
      </div>
    </div>
  )
}
