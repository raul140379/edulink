import { Router } from 'express'
import { login, me, changePassword } from '../controllers/auth.controller'
import { verifyToken } from '../middlewares/auth.middleware'
import { validateBody } from '../middlewares/validate.middleware'
import { loginSchema, changePasswordSchema } from '../schemas/auth.schema'

const router = Router()

router.post('/login',           validateBody(loginSchema), login)
router.get('/me',               verifyToken, me)
router.put('/change-password',  verifyToken, validateBody(changePasswordSchema), changePassword)

export default router