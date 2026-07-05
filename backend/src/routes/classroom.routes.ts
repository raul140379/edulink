import { Router } from 'express'
import { verifyToken, requirePermission } from '../middlewares/auth.middleware'
import { validateBody } from '../middlewares/validate.middleware'
import { Permission } from '../config/permissions'
import { createClassroomSchema, updateClassroomSchema, assignClassroomSchema } from '../schemas/classroom.schema'
import {
  getClassrooms,
  createClassroom,
  updateClassroom,
  deleteClassroom,
  assignClassroomToPeriod,
  assignClassroomToCourse,
} from '../controllers/classroom.controller'

const router = Router()
router.use(verifyToken)

router.get('/',          requirePermission(Permission.SCHEDULE_VIEW_ALL), getClassrooms)
router.post('/',         requirePermission(Permission.SCHEDULE_CREATE), validateBody(createClassroomSchema), createClassroom)
router.put('/:id',       requirePermission(Permission.SCHEDULE_CREATE), validateBody(updateClassroomSchema), updateClassroom)
router.delete('/:id',    requirePermission(Permission.SCHEDULE_CREATE), deleteClassroom)

// Este va en schedules pero lo manejamos aquí por conveniencia
router.patch('/course/:courseId/all', requirePermission(Permission.SCHEDULE_CREATE), validateBody(assignClassroomSchema), assignClassroomToCourse)
router.patch('/:id/classroom',        requirePermission(Permission.SCHEDULE_CREATE), validateBody(assignClassroomSchema), assignClassroomToPeriod)

export default router
