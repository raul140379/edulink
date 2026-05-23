import { Router } from 'express'
import { verifyToken } from '../middlewares/auth.middleware'
import {
  getMyNotifications,
  markAsRead,
  sendNotification,
  sendBulkNotification,
  getSentNotifications,
} from '../controllers/notification.controller'

const router = Router()

router.use(verifyToken)

router.get('/',            getMyNotifications)
router.get('/sent',        getSentNotifications)
router.post('/send',       sendNotification)
router.post('/send-bulk',  sendBulkNotification)
router.patch('/:id/read',  markAsRead)

export default router