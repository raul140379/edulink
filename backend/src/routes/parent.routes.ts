import { Router } from 'express'
import {
  getParents,
  getParentById,
  getParentStudents,
  createParent,
  updateParent,
  toggleParentStatus,
  deleteParent,
  linkStudents,
  unlinkStudent,
  generateParentCredentials,
  changeTutor,
} from '../controllers/parent.controller'
import { verifyToken, requirePermission } from '../middlewares/auth.middleware'
import { Permission } from '../config/permissions'

const router = Router()

router.use(verifyToken)

router.get('/',                           requirePermission(Permission.PARENT_VIEW_ALL), getParents)
router.get('/:id',                        requirePermission(Permission.PARENT_VIEW_ALL), getParentById)
router.get('/:id/students',               requirePermission(Permission.PARENT_VIEW_ALL), getParentStudents)
router.post('/',                          requirePermission(Permission.PARENT_CREATE),   createParent)
router.put('/:id',                        requirePermission(Permission.PARENT_CREATE),   updateParent)
router.patch('/:id/toggle',              requirePermission(Permission.PARENT_CREATE),   toggleParentStatus)
router.delete('/:id',                    requirePermission(Permission.PARENT_CREATE),   deleteParent)
router.post('/:id/link-students',        requirePermission(Permission.PARENT_CREATE),   linkStudents)
router.delete('/:id/unlink/:studentId',  requirePermission(Permission.PARENT_CREATE),   unlinkStudent)
router.post('/:id/generate-credentials', requirePermission(Permission.PARENT_CREATE),   generateParentCredentials)
router.patch('/student/:id/change-tutor', requirePermission(Permission.PARENT_CREATE),  changeTutor)

export default router