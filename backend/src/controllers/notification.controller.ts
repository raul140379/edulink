import { Response } from 'express'
import { AuthRequest } from '../middlewares/auth.middleware'
import prisma from '../lib/prisma'

// ─────────────────────────────────────────────
// GET /api/notifications — Notificaciones del padre logueado
// ─────────────────────────────────────────────
export const getMyNotifications = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId

    const parent = await prisma.parent.findUnique({ where: { userId } })
    if (!parent) {
      res.status(404).json({ message: 'Perfil de padre no encontrado' })
      return
    }

    const notifications = await prisma.notification.findMany({
      where: { parentId: parent.id },
      include: {
        sentBy: { select: { id: true, email: true, role: true } }
      },
      orderBy: { createdAt: 'desc' }
    })

    res.json(notifications)
  } catch (error) {
    console.error('getMyNotifications error:', error)
    res.status(500).json({ message: 'Error al obtener notificaciones' })
  }
}

// ─────────────────────────────────────────────
// PATCH /api/notifications/:id/read — Marcar como leída
// ─────────────────────────────────────────────
export const markAsRead = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params

    await prisma.notification.update({
      where: { id: parseInt(id) },
      data:  { isRead: true }
    })

    res.json({ message: 'Notificación marcada como leída' })
  } catch (error) {
    console.error('markAsRead error:', error)
    res.status(500).json({ message: 'Error al marcar notificación' })
  }
}

// ─────────────────────────────────────────────
// POST /api/notifications/send — Enviar notificación a un padre
// ─────────────────────────────────────────────
export const sendNotification = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId
    const { parentId, title, message, type } = req.body

    if (!parentId || !title || !message || !type) {
      res.status(400).json({ message: 'parentId, título, mensaje y tipo son requeridos' })
      return
    }

    const notification = await prisma.notification.create({
      data: {
        title,
        message,
        type:     type as any,
        parentId: parseInt(parentId),
        sentById: userId!,
      },
      include: {
        parent: { select: { firstName: true, lastName: true, phone: true } },
        sentBy: { select: { email: true, role: true } }
      }
    })

    res.status(201).json({
      message: 'Notificación enviada correctamente',
      notification,
      whatsapp: notification.parent.phone
        ? `https://wa.me/591${notification.parent.phone.replace(/\D/g, '')}?text=${encodeURIComponent(`*${title}*\n\n${message}`)}`
        : null
    })
  } catch (error) {
    console.error('sendNotification error:', error)
    res.status(500).json({ message: 'Error al enviar notificación' })
  }
}

// ─────────────────────────────────────────────
// POST /api/notifications/send-bulk — Enviar a múltiples padres
// ─────────────────────────────────────────────
export const sendBulkNotification = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId
    const { parentIds, title, message, type } = req.body

    if (!parentIds || !Array.isArray(parentIds) || parentIds.length === 0) {
      res.status(400).json({ message: 'parentIds es requerido' })
      return
    }

    await prisma.notification.createMany({
      data: parentIds.map((parentId: number) => ({
        title,
        message,
        type:     type as any,
        parentId: parseInt(String(parentId)),
        sentById: userId!,
      }))
    })

    res.status(201).json({
      message: `Notificación enviada a ${parentIds.length} tutores correctamente`,
      count:   parentIds.length
    })
  } catch (error) {
    console.error('sendBulkNotification error:', error)
    res.status(500).json({ message: 'Error al enviar notificaciones' })
  }
}

// ─────────────────────────────────────────────
// GET /api/notifications/sent — Notificaciones enviadas (maestro/junta)
// ─────────────────────────────────────────────
export const getSentNotifications = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId

    const notifications = await prisma.notification.findMany({
      where: { sentById: userId },
      include: {
        parent: { select: { id: true, firstName: true, lastName: true, phone: true } }
      },
      orderBy: { createdAt: 'desc' },
      take: 50
    })

    res.json(notifications)
  } catch (error) {
    console.error('getSentNotifications error:', error)
    res.status(500).json({ message: 'Error al obtener notificaciones enviadas' })
  }
}