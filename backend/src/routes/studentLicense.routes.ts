import { Router } from 'express'
import { verifyToken, requireRole } from '../middlewares/auth.middleware'
import { validateBody } from '../middlewares/validate.middleware'
import { Role } from '../config/permissions'
import { createLicenseSchema, cancelLicenseSchema } from '../schemas/studentLicense.schema'
import { createLicense, getStudentLicenses, cancelLicense } from '../controllers/studentLicense.controller'

const router = Router()
router.use(verifyToken)

// DIRECTOR/SECRETARY, y desde 8-sep-2026 también REGENTE (confirmado con
// Raul, para el flujo de llegada tardía — ver studentLateArrival.service.ts,
// registra tardanzas y puede registrar Licencia desde la misma pantalla).
// Mismo criterio para listar/anular (12-sep-2026, confirmado con Raul).
router.post('/', requireRole(Role.DIRECTOR, Role.SECRETARY, Role.REGENTE), validateBody(createLicenseSchema), createLicense)
router.get('/student/:studentId', requireRole(Role.DIRECTOR, Role.SECRETARY, Role.REGENTE), getStudentLicenses)
router.post('/:id/cancel', requireRole(Role.DIRECTOR, Role.SECRETARY, Role.REGENTE), validateBody(cancelLicenseSchema), cancelLicense)

export default router
