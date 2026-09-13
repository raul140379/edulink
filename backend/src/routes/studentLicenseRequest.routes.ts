import { Router } from 'express'
import { verifyToken, requireRole } from '../middlewares/auth.middleware'
import { validateBody } from '../middlewares/validate.middleware'
import { Role } from '../config/permissions'
import {
  createLicenseRequestSchema, approveLicenseRequestSchema, rejectLicenseRequestSchema,
} from '../schemas/studentLicenseRequest.schema'
import {
  createLicenseRequest, getMyLicenseRequests, getAllLicenseRequests,
  getPendingCountForStudent, approveLicenseRequest, rejectLicenseRequest,
} from '../controllers/studentLicenseRequest.controller'

const router = Router()
router.use(verifyToken)

// padre-app — cualquier padre vinculado al estudiante puede solicitar (no
// solo el tutor legal), validado en el servicio, no acá.
router.post('/', requireRole(Role.PARENT), validateBody(createLicenseRequestSchema), createLicenseRequest)
router.get('/mine', requireRole(Role.PARENT), getMyLicenseRequests)

// Aviso liviano en la tarjeta de admin/estudiantes/[id] — mismos 3 roles que
// ya ven esa pantalla (ADMIN_ROLES), solo lectura.
router.get('/student/:studentId/pending-count', requireRole(Role.DIRECTOR, Role.SECRETARY, Role.REGENTE), getPendingCountForStudent)

// Pantalla centralizada admin/licencias + resolución — SOLO Director, más
// restrictivo que el alta directa de licencias (DIRECTOR/SECRETARY/REGENTE),
// confirmado con Raul (12-sep-2026).
router.get('/', requireRole(Role.DIRECTOR), getAllLicenseRequests)
router.post('/:id/approve', requireRole(Role.DIRECTOR), validateBody(approveLicenseRequestSchema), approveLicenseRequest)
router.post('/:id/reject', requireRole(Role.DIRECTOR), validateBody(rejectLicenseRequestSchema), rejectLicenseRequest)

export default router
