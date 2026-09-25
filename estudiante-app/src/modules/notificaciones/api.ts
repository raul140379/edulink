import { apiFetch } from '@/lib/api'

// OJO: a diferencia de padre-app, esto NO pega contra /api/notifications
// (ese modelo es 100% de PARENT -- parentId obligatorio, siempre devuelve []
// para un STUDENT, ver notification.service.ts:getMyNotifications). El
// backend ya tiene un mecanismo propio para estudiantes: resuelve el tutor
// del estudiante y devuelve las notificaciones reales que le llegaron a ESE
// tutor (ver student.service.ts:getMyNotifications) -- mismo endpoint que ya
// usa el panel web (dashboard/estudiantes/notificaciones).
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
  sentBy: { teacher: { firstName: string; lastName: string } | null } | null
}

export const notificacionesApi = {
  getMine: () => apiFetch<MyNotification[]>('/api/students/my-notifications'),
  markAsRead: (id: number) => apiFetch<void>(`/api/students/my-notifications/${id}/read`, { method: 'PATCH' }),
}
