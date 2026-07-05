// backend/src/routes/admin.routes.ts

import { Router } from 'express'
import { resetCredentials } from '../controllers/credentials.controller'
import { verifyToken, requireRole } from '../middlewares/auth.middleware'
import { validateBody } from '../middlewares/validate.middleware'
import { resetCredentialsSchema } from '../schemas/credentials.schema'
import { Role } from '../config/permissions'

const router = Router()

router.use(verifyToken)

router.post('/reset-credentials', requireRole(Role.SUPER_ADMIN), validateBody(resetCredentialsSchema), resetCredentials)

export default router
