import { Router } from 'express'
import { login, me, changePassword } from '../controllers/auth.controller'
import { verifyToken } from '../middlewares/auth.middleware'

const router = Router()

router.post('/login',           login)
router.get('/me',               verifyToken, me)
router.put('/change-password',  verifyToken, changePassword) 

export default router