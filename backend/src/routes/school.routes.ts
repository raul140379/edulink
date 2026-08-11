import { Router } from 'express'
import multer from 'multer'
import { verifyToken, requirePermission, restoreTenantContext } from '../middlewares/auth.middleware'
import { validateBody } from '../middlewares/validate.middleware'
import { Permission } from '../config/permissions'
import { createSchoolSchema, updateSchoolSchema, assignDirectorSchema } from '../schemas/school.schema'
import { getSchools, getSchoolById, createSchool, updateSchool, assignDirector, importSchools } from '../controllers/school.controller'

const upload = multer({ storage: multer.memoryStorage() })

const router = Router()
router.use(verifyToken)

router.get('/',      requirePermission(Permission.SCHOOL_VIEW_ALL), getSchools)
router.get('/:id',   requirePermission(Permission.SCHOOL_VIEW_ALL), getSchoolById)
router.post('/',     requirePermission(Permission.SCHOOL_CREATE), validateBody(createSchoolSchema), createSchool)
router.put('/:id',   requirePermission(Permission.SCHOOL_CREATE), validateBody(updateSchoolSchema), updateSchool)
router.post('/:id/director', requirePermission(Permission.USER_CREATE), validateBody(assignDirectorSchema), assignDirector)
router.post('/import', requirePermission(Permission.SCHOOL_CREATE), upload.single('file'), restoreTenantContext, importSchools)

export default router
