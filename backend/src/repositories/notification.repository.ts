import prisma from '../lib/prisma'
import { getTenantContext } from '../lib/tenant-context'

export const notificationRepository = {
  findParentByUserId(userId: number | undefined) {
    return prisma.parent.findUnique({ where: { userId } })
  },

  findNotificationsByParent(parentId: number) {
    return prisma.notification.findMany({
      where: { parentId },
      include: { sentBy: { select: { id: true, email: true, role: true } } },
      orderBy: { createdAt: 'desc' },
    })
  },

  findById(id: number) {
    return prisma.notification.findUnique({ where: { id } })
  },

  markAsRead(id: number) {
    return prisma.notification.update({ where: { id }, data: { isRead: true } })
  },

  createNotification(data: { title: string; message: string; type: string; parentId: number; sentById: number }) {
    // schoolId below is overwritten by the tenant-scoping extension in lib/prisma.ts for the acting user's school.
    return prisma.notification.create({
      data: { title: data.title, message: data.message, type: data.type as any, parentId: data.parentId, sentById: data.sentById, schoolId: getTenantContext()?.schoolId ?? 0 },
      include: {
        parent: { select: { firstName: true, lastName: true, phone: true } },
        sentBy: { select: { email: true, role: true } },
      },
    })
  },

  createManyNotifications(items: { title: string; message: string; type: string; parentId: number; sentById: number }[]) {
    const schoolId = getTenantContext()?.schoolId ?? 0
    return prisma.notification.createMany({
      data: items.map((n) => ({ title: n.title, message: n.message, type: n.type as any, parentId: n.parentId, sentById: n.sentById, schoolId })),
    })
  },

  findSentByUser(userId: number | undefined) {
    return prisma.notification.findMany({
      where: { sentById: userId },
      include: { parent: { select: { id: true, firstName: true, lastName: true, phone: true } } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })
  },
}
