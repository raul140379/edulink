import { Router } from 'express'
import {
  getStaff,
  getStaffById,
  createStaff,
  updateStaff,
  toggleStaffStatus,
} from '../controllers/staff.controller'
import { verifyToken, requirePermission } from '../middlewares/auth.middleware'
import { validateBody } from '../middlewares/validate.middleware'
import { createStaffSchema, updateStaffSchema } from '../schemas/staff.schema'
import { Permission } from '../config/permissions'

const router = Router()

router.use(verifyToken)

router.get('/',              requirePermission(Permission.STAFF_VIEW_ALL), getStaff)
router.get('/:id',           requirePermission(Permission.STAFF_VIEW_ALL), getStaffById)
router.post('/',             requirePermission(Permission.STAFF_CREATE),   validateBody(createStaffSchema), createStaff)
router.put('/:id',           requirePermission(Permission.STAFF_CREATE),   validateBody(updateStaffSchema), updateStaff)
router.patch('/:id/toggle',  requirePermission(Permission.STAFF_CREATE),   toggleStaffStatus)

export default router
