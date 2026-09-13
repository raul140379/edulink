import { apiFetch } from '@/lib/api'

export type NotificationType = 'ACADEMICA' | 'REUNION' | 'GENERAL' | 'ACTIVIDAD' | 'DEUDA'

export const TIPO_LABEL: Record<NotificationType, string> = {
  ACADEMICA: '📚 Académica',
  REUNION:   '📅 Reunión',
  GENERAL:   '⚠️ Conducta',
  ACTIVIDAD: '📋 Trabajo/Examen',
  DEUDA:     '💰 Tesorería',
}

export interface MyNotification {
  id: number
  title: string
  message: string
  type: NotificationType
  isRead: boolean
  createdAt: string
  sentBy: { id: number; email: string; role: string }
}

export const notificacionesApi = {
  getMine: () => apiFetch<MyNotification[]>('/api/notifications'),
  markAsRead: (id: number) => apiFetch<void>(`/api/notifications/${id}/read`, { method: 'PATCH' }),
}
