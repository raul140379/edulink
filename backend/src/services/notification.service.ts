import { notificationRepository } from '../repositories/notification.repository'
import { HttpError } from '../utils/http-error'
import { SendNotificationInput, SendBulkNotificationInput } from '../schemas/notification.schema'

export const notificationService = {
  async getMyNotifications(userId: number | undefined) {
    const parent = await notificationRepository.findParentByUserId(userId)
    if (!parent) throw new HttpError(404, 'Perfil de padre no encontrado')
    return notificationRepository.findNotificationsByParent(parent.id)
  },

  async markAsRead(userId: number | undefined, id: number) {
    const parent = await notificationRepository.findParentByUserId(userId)
    if (!parent) throw new HttpError(404, 'Perfil de padre no encontrado')

    const notification = await notificationRepository.findById(id)
    if (!notification) throw new HttpError(404, 'Notificación no encontrada')
    if (notification.parentId !== parent.id) throw new HttpError(403, 'Esta notificación no te pertenece')

    await notificationRepository.markAsRead(id)
  },

  async sendNotification(userId: number | undefined, input: SendNotificationInput) {
    const notification = await notificationRepository.createNotification({
      title: input.title, message: input.message, type: input.type, parentId: input.parentId, sentById: userId!,
    })

    return {
      notification,
      whatsapp: notification.parent.phone
        ? `https://wa.me/591${notification.parent.phone.replace(/\D/g, '')}?text=${encodeURIComponent(`*${input.title}*\n\n${input.message}`)}`
        : null,
    }
  },

  async sendBulkNotification(userId: number | undefined, input: SendBulkNotificationInput) {
    await notificationRepository.createManyNotifications(
      input.parentIds.map((parentId) => ({ title: input.title, message: input.message, type: input.type, parentId, sentById: userId! }))
    )
    return { count: input.parentIds.length }
  },

  getSentNotifications(userId: number | undefined) {
    return notificationRepository.findSentByUser(userId)
  },
}
