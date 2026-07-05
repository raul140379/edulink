import { Response } from 'express'
import { AuthRequest } from '../middlewares/auth.middleware'
import { handleControllerError } from '../utils/http-error'
import { notificationService } from '../services/notification.service'

// ─────────────────────────────────────────────
// GET /api/notifications — Notificaciones del padre logueado
// ─────────────────────────────────────────────
export const getMyNotifications = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    res.json(await notificationService.getMyNotifications(req.userId))
  } catch (error) {
    handleControllerError(res, error)
  }
}

// ─────────────────────────────────────────────
// PATCH /api/notifications/:id/read — Marcar como leída
// ─────────────────────────────────────────────
export const markAsRead = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await notificationService.markAsRead(req.userId, parseInt(req.params.id))
    res.json({ message: 'Notificación marcada como leída' })
  } catch (error) {
    handleControllerError(res, error)
  }
}

// ─────────────────────────────────────────────
// POST /api/notifications/send — Enviar notificación a un padre
// ─────────────────────────────────────────────
export const sendNotification = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { notification, whatsapp } = await notificationService.sendNotification(req.userId, req.body)
    res.status(201).json({ message: 'Notificación enviada correctamente', notification, whatsapp })
  } catch (error) {
    handleControllerError(res, error)
  }
}

// ─────────────────────────────────────────────
// POST /api/notifications/send-bulk — Enviar a múltiples padres
// ─────────────────────────────────────────────
export const sendBulkNotification = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { count } = await notificationService.sendBulkNotification(req.userId, req.body)
    res.status(201).json({ message: `Notificación enviada a ${count} tutores correctamente`, count })
  } catch (error) {
    handleControllerError(res, error)
  }
}

// ─────────────────────────────────────────────
// GET /api/notifications/sent — Notificaciones enviadas (maestro/junta)
// ─────────────────────────────────────────────
export const getSentNotifications = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    res.json(await notificationService.getSentNotifications(req.userId))
  } catch (error) {
    handleControllerError(res, error)
  }
}
