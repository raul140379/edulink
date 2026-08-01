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

// Registrar/editar/dar de baja un padre — responsabilidad exclusiva de Junta
// Escolar/Delegado (Director/Regente/Secretaria ya NO tienen este permiso,
// solo PARENT_ASSIGN_TUTOR más abajo).
router.post('/',                          requirePermission(Permission.PARENT_CREATE),   validateBody(createParentSchema), createParent)
router.put('/:id',                        requirePermission(Permission.PARENT_CREATE),   validateBody(updateParentSchema), updateParent)
router.patch('/:id/toggle',              requirePermission(Permission.PARENT_CREATE),   toggleParentStatus)
router.delete('/:id',                    requirePermission(Permission.PARENT_CREATE),   deleteParent)
router.post('/:id/generate-credentials', requirePermission(Permission.PARENT_CREATE),   generateParentCredentials)
router.post('/import', requirePermission(Permission.PARENT_CREATE), upload.single('file'), importParents)

// Vincular un padre YA EXISTENTE a un estudiante / cambiar tutor — esto sí lo
// conserva el administrador del colegio (matrícula, cambio de gestión), además
// de Junta Escolar/Delegado.
router.post('/:id/link-students',        requirePermission(Permission.PARENT_ASSIGN_TUTOR), validateBody(linkStudentsSchema), linkStudents)
router.delete('/:id/unlink/:studentId',  requirePermission(Permission.PARENT_ASSIGN_TUTOR), unlinkStudent)
router.patch('/student/:id/change-tutor', requirePermission(Permission.PARENT_ASSIGN_TUTOR), validateBody(changeTutorSchema), changeTutor)
router.patch('/:id/change-relation/:studentId', requirePermission(Permission.PARENT_ASSIGN_TUTOR), validateBody(changeRelationSchema), changeRelation)


export default router