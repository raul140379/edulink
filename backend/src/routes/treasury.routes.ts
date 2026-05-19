import { Router } from 'express'
import { verifyToken } from '../middlewares/auth.middleware'
import {
  getCharges,
  getChargeById,
  getParentAccount,
  createCharge,
  createBulkCharges,
  updateCharge,
  cancelCharge,
  registerPayment,
  getTreasurySummary,
  getParentsWithBalance,
} from '../controllers/treasury.controller'

const router = Router()

// Todas las rutas requieren autenticación
router.use(verifyToken)

// ── Resumen general ──────────────────────────
router.get('/summary',          getTreasurySummary)

// ── Tutores con estado de cuenta ─────────────
router.get('/parents',          getParentsWithBalance)
router.get('/parents/:parentId/account', getParentAccount)

// ── Cargos ───────────────────────────────────
router.get('/',                 getCharges)
router.get('/:id',              getChargeById)
router.post('/',                createCharge)
router.post('/bulk',            createBulkCharges)
router.put('/:id',              updateCharge)
router.patch('/:id/cancel',     cancelCharge)

// ── Pagos ────────────────────────────────────
router.post('/:id/payments',    registerPayment)

export default router