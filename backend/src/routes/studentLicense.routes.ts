import { Router } from 'express'
import { verifyToken, requireRole } from '../middlewares/auth.middleware'
import { validateBody } from '../middlewares/validate.middleware'
import { Role } from '../config/permissions'
import { createLicenseSchema } from '../schemas/studentLicense.schema'
import { createLicense } from '../controllers/studentLicense.controller'

const router = Router()
router.use(verifyToken)

// Solo DIRECTOR/SECRETARY — mismo alcance que la corrección de asistencia
// sin ventana horaria (ver studentAttendance.service.ts). REGENTE queda
// afuera a propósito (no tiene ATTENDANCE_CREATE tampoco).
router.post('/', requireRole(Role.DIRECTOR, Role.SECRETARY), validateBody(createLicenseSchema), createLicense)

export default router
