import { Router } from 'express'
import {
  getUsers,
  getUserById,
  createUser,
  updateUser,
  toggleUserStatus,
  resetPassword,
} from '../controllers/user.controller'
import { verifyToken, requirePermission } from '../middlewares/auth.middleware'
import { Permission } from '../config/permissions'

const router = Router()

router.use(verifyToken)

router.get('/',                    requirePermission(Permission.USER_VIEW_ALL), getUsers)
router.get('/:id',                 requirePermission(Permission.USER_VIEW_ALL), getUserById)
router.post('/',                   requirePermission(Permission.USER_CREATE),   createUser)
router.put('/:id',                 requirePermission(Permission.USER_CREATE),   updateUser)
router.patch('/:id/toggle',       requirePermission(Permission.USER_CREATE),   toggleUserStatus)
router.post('/:id/reset-password', requirePermission(Permission.USER_CREATE),   resetPassword)

export default router