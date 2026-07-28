import { Router } from 'express'
import {
  getUsers,
  getUserById,
  createUser,
  updateUser,
  toggleUserStatus,
  resetPassword,
  resetByEmail,
  deleteUser,
  getJuntaParents,
  generateEmail,
} from '../controllers/user.controller'
import { verifyToken, requirePermission } from '../middlewares/auth.middleware'
import { validateBody } from '../middlewares/validate.middleware'
import { createUserSchema, updateUserSchema, resetByEmailSchema } from '../schemas/user.schema'
import { Permission } from '../config/permissions'

const router = Router()

router.use(verifyToken)

router.get('/',                    requirePermission(Permission.USER_VIEW_ALL), getUsers)
router.get('/junta-parents',       requirePermission(Permission.USER_VIEW_ALL), getJuntaParents)
router.post('/reset-by-email', requirePermission(Permission.USER_CREATE), validateBody(resetByEmailSchema), resetByEmail)
router.post('/generate-email', requirePermission(Permission.USER_CREATE), generateEmail)
router.get('/:id',                 requirePermission(Permission.USER_VIEW_ALL), getUserById)
router.post('/',                   requirePermission(Permission.USER_CREATE),   validateBody(createUserSchema), createUser)
router.put('/:id',                 requirePermission(Permission.USER_CREATE),   validateBody(updateUserSchema), updateUser)
router.patch('/:id/toggle',       requirePermission(Permission.USER_CREATE),   toggleUserStatus)
router.post('/:id/reset-password', requirePermission(Permission.USER_CREATE),   resetPassword)
router.delete('/:id', requirePermission(Permission.USER_CREATE), deleteUser)

export default router