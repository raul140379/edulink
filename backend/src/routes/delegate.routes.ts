import { Router } from 'express'
import { verifyToken } from '../middlewares/auth.middleware'
import {
  getDelegates,
  getEligibleParents,
  assignDelegate,
  removeDelegate,
  getMyCourse,
} from '../controllers/delegate.controller'

const router = Router()

router.use(verifyToken)

// Gestión de delegados (Junta Escolar / Admin)
router.get('/',                                    getDelegates)
router.get('/course/:courseId/eligible-parents',   getEligibleParents)
router.post('/course/:courseId/assign',            assignDelegate)
router.delete('/course/:courseId/remove',          removeDelegate)

// Para el delegado logueado
router.get('/my-course',                           getMyCourse)

export default router