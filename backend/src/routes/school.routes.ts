import { Router } from 'express'
import { verifyToken, requirePermission } from '../middlewares/auth.middleware'
import { validateBody } from '../middlewares/validate.middleware'
import { Permission } from '../config/permissions'
import { createSchoolSchema, updateSchoolSchema } from '../schemas/school.schema'
import { getSchools, getSchoolById, createSchool, updateSchool } from '../controllers/school.controller'

const router = Router()
router.use(verifyToken)

router.get('/',      requirePermission(Permission.SCHOOL_VIEW_ALL), getSchools)
router.get('/:id',   requirePermission(Permission.SCHOOL_VIEW_ALL), getSchoolById)
router.post('/',     requirePermission(Permission.SCHOOL_CREATE), validateBody(createSchoolSchema), createSchool)
router.put('/:id',   requirePermission(Permission.SCHOOL_CREATE), validateBody(updateSchoolSchema), updateSchool)

export default router
