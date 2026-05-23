import { Router } from 'express'
import { verifyToken } from '../middlewares/auth.middleware'
import {
  getTeachersReport,
  getDelegatesReport,
  getTreasuryReport,
} from '../controllers/report.controller'

const router = Router()

router.use(verifyToken)

router.get('/teachers',  getTeachersReport)
router.get('/delegates', getDelegatesReport)
router.get('/treasury',  getTreasuryReport)

export default router