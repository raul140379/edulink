import { Role } from '@prisma/client'
import { notificationRepository } from '../repositories/notification.repository'
import { HttpError } from '../utils/http-error'
import { assertTeacherOwnsParent } from '../utils/teacher-scope'
import { getTenantContext } from '../lib/tenant-context'
import { SendNotificationInput, SendBulkNotificationInput } from '../schemas/notification.schema'

// Antepone "Notificación de {colegio real} — {maestro real}:" al mensaje
// (guardado y WhatsApp por igual) cuando quien envía es TEACHER/TEACHER_TUTOR
// — nunca hardcodeado a una UE específica, para que funcione igual en
// cualquier colegio del distrito. Otros roles (JUNTA_ESCOLAR desde el panel
// viejo) no se tocan — "profesor" no aplicaría ahí.
async function withTeacherHeader(userId: number | undefined, message: string): Promise<string> {
  const ctx = getTenantContext()
  if (ctx?.role !== Role.TEACHER && ctx?.role !== Role.TEACHER_TUTOR) return message
  if (!ctx.schoolId) return message

  const [teacher, school] = await Promise.all([
    notificationRepository.findTeacherNameByUserId(userId),
    notificationRepository.findSchoolName(ctx.schoolId),
  ])
  if (!teacher || !school) return message

  return `Notificación de ${school.name} — ${teacher.firstName} ${teacher.lastName}:\n${message}`
}

export const notificationService = {
  async getMyNotifications(userId: number | undefined) {
    // Notification es un modelo exclusivo de PARENT (destinatario = padre) —
    // cualquier otro rol (Teacher, Student, Director, Junta, etc.) nunca
    // tiene un Parent vinculado a su cuenta. Eso no es un error, es la
    // campanita preguntando "¿este usuario tiene notificaciones de tipo
    // padre?" — la respuesta correcta para ellos es "ninguna", no un 404.
    const parent = await notificationRepository.findParentByUserId(userId)
    if (!parent) return []
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
    await assertTeacherOwnsParent([input.parentId], 'Solo podés notificar a padres de estudiantes de tus propios cursos')

    const message = await withTeacherHeader(userId, input.message)

    const notification = await notificationRepository.createNotification({
      title: input.title, message, type: input.type, parentId: input.parentId, sentById: userId!,
    })

    return {
      notification,
      whatsapp: notification.parent.phone
        ? `https://wa.me/591${notification.parent.phone.replace(/\D/g, '')}?text=${encodeURIComponent(`*${input.title}*\n\n${message}`)}`
        : null,
    }
  },

  async sendBulkNotification(userId: number | undefined, input: SendBulkNotificationInput) {
    await assertTeacherOwnsParent(input.parentIds, 'Solo podés notificar a padres de estudiantes de tus propios cursos')

    const message = await withTeacherHeader(userId, input.message)

    await notificationRepository.createManyNotifications(
      input.parentIds.map((parentId) => ({ title: input.title, message, type: input.type, parentId, sentById: userId! }))
    )
    return { count: input.parentIds.length }
  },

  getSentNotifications(userId: number | undefined) {
    // Director/Secretaría/Regente comparten un único historial por colegio
    // (varias cuentas admin pueden enviar) — Maestro/Junta/Delegado siguen
    // viendo solo lo que ellos mismos enviaron, sin cambios.
    const ctx = getTenantContext()
    const isAdminRole = ctx?.role === Role.DIRECTOR || ctx?.role === Role.SECRETARY || ctx?.role === Role.REGENTE
    if (isAdminRole && ctx.schoolId) return notificationRepository.findSentBySchool(ctx.schoolId)
    return notificationRepository.findSentByUser(userId)
  },
}
