import { Router } from 'express'
import { verifyToken, requirePermission } from '../middlewares/auth.middleware'
import { validateBody } from '../middlewares/validate.middleware'
import { Permission } from '../config/permissions'
import { sendNotificationSchema, sendBulkNotificationSchema } from '../schemas/notification.schema'
import {
  getMyNotifications,
  markAsRead,
  sendNotification,
  sendBulkNotification,
  getSentNotifications,
} from '../controllers/notification.controller'

const router = Router()

router.use(verifyToken)

router.get('/',            requirePermission(Permission.NOTIFICATION_VIEW), getMyNotifications)
router.get('/sent',        requirePermission(Permission.NOTIFICATION_SEND), getSentNotifications)
router.post('/send',       requirePermission(Permission.NOTIFICATION_SEND), validateBody(sendNotificationSchema), sendNotification)
router.post('/send-bulk',  requirePermission(Permission.NOTIFICATION_SEND), validateBody(sendBulkNotificationSchema), sendBulkNotification)
router.patch('/:id/read',  requirePermission(Permission.NOTIFICATION_VIEW), markAsRead)

export default router
