import { z } from 'zod'
import { NotificationType } from '@prisma/client'

export const sendNotificationSchema = z.object({
  parentId: z.coerce.number().int(),
  title:    z.string().min(1, 'El título es requerido'),
  message:  z.string().min(1, 'El mensaje es requerido'),
  type:     z.nativeEnum(NotificationType),
})

export const sendBulkNotificationSchema = z.object({
  parentIds: z.array(z.coerce.number().int()).min(1, 'parentIds es requerido'),
  title:     z.string().min(1, 'El título es requerido'),
  message:   z.string().min(1, 'El mensaje es requerido'),
  type:      z.nativeEnum(NotificationType),
})

export type SendNotificationInput     = z.infer<typeof sendNotificationSchema>
export type SendBulkNotificationInput = z.infer<typeof sendBulkNotificationSchema>
