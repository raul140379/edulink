import { Router } from 'express'
import { verifyToken, requireRole } from '../middlewares/auth.middleware'
import { validateBody } from '../middlewares/validate.middleware'
import { Role } from '../config/permissions'
import { createLicenseSchema } from '../schemas/studentLicense.schema'
import { createLicense } from '../controllers/studentLicense.controller'

const router = Router()
router.use(verifyToken)

// DIRECTOR/SECRETARY, y desde 8-sep-2026 también REGENTE (confirmado con
// Raul, para el flujo de llegada tardía — ver studentLateArrival.service.ts,
// registra tardanzas y puede registrar Licencia desde la misma pantalla).
router.post('/', requireRole(Role.DIRECTOR, Role.SECRETARY, Role.REGENTE), validateBody(createLicenseSchema), createLicense)

export default router
