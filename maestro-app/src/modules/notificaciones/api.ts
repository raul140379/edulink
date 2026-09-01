import { apiFetch } from '@/lib/api'

export type NotificationType = 'ACADEMICA' | 'REUNION' | 'GENERAL' | 'ACTIVIDAD' | 'DEUDA'

export const TIPOS: { value: NotificationType; label: string }[] = [
  { value: 'ACADEMICA', label: '📚 Académica' },
  { value: 'GENERAL',   label: '⚠️ Conducta' },
  { value: 'ACTIVIDAD', label: '📋 Trabajo/Examen' },
  { value: 'DEUDA',     label: '📢 General' },
]

export interface SendResult {
  message: string
  whatsapp: string | null // link para abrir WhatsApp manualmente — null si el tutor no tiene teléfono registrado. Nunca es un envío automático.
}

export const notificacionesApi = {
  send: (parentId: number, title: string, message: string, type: NotificationType) =>
    apiFetch<SendResult>('/api/notifications/send', {
      method: 'POST',
      body: JSON.stringify({ parentId, title, message, type }),
    }),
}
