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
  importParents,
  changeRelation,
  getMe,
  updateMe,
  getMyStudents,
} from '../controllers/parent.controller'
import { verifyToken, requirePermission } from '../middlewares/auth.middleware'
import { validateBody } from '../middlewares/validate.middleware'
import {
  createParentSchema, updateParentSchema, updateMeSchema,
  linkStudentsSchema, changeTutorSchema, changeRelationSchema,
} from '../schemas/parent.schema'
import { Permission } from '../config/permissions'
import multer from 'multer'
const upload = multer({ storage: multer.memoryStorage() })

const router = Router()

router.use(verifyToken)

router.get('/my-students', getMyStudents)
router.get('/',                           requirePermission(Permission.PARENT_VIEW_ALL), getParents)
router.get('/me', getMe)
router.put('/me', validateBody(updateMeSchema), updateMe)
router.get('/:id',                        requirePermission(Permission.PARENT_VIEW_ALL), getParentById)
router.get('/:id/students',               requirePermission(Permission.PARENT_VIEW_ALL), getParentStudents)
router.post('/',                          requirePermission(Permission.PARENT_CREATE),   validateBody(createParentSchema), createParent)
router.put('/:id',                        requirePermission(Permission.PARENT_CREATE),   validateBody(updateParentSchema), updateParent)
router.patch('/:id/toggle',              requirePermission(Permission.PARENT_CREATE),   toggleParentStatus)
router.delete('/:id',                    requirePermission(Permission.PARENT_CREATE),   deleteParent)
router.post('/:id/link-students',        requirePermission(Permission.PARENT_CREATE),   validateBody(linkStudentsSchema), linkStudents)
router.delete('/:id/unlink/:studentId',  requirePermission(Permission.PARENT_CREATE),   unlinkStudent)
router.post('/:id/generate-credentials', requirePermission(Permission.PARENT_CREATE),   generateParentCredentials)
router.patch('/student/:id/change-tutor', requirePermission(Permission.PARENT_CREATE),  validateBody(changeTutorSchema), changeTutor)
router.post('/import', requirePermission(Permission.PARENT_CREATE), upload.single('file'), importParents)
router.patch('/:id/change-relation/:studentId', requirePermission(Permission.PARENT_CREATE), validateBody(changeRelationSchema), changeRelation)


export default router