import { Router } from 'express'
import { verifyToken, requirePermission } from '../middlewares/auth.middleware'
import { validateBody } from '../middlewares/validate.middleware'
import { Permission } from '../config/permissions'
import {
  createChargeSchema, createBulkChargesSchema, updateChargeSchema, registerPaymentSchema,
} from '../schemas/treasury.schema'
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
router.get('/summary',          requirePermission(Permission.CHARGE_VIEW_ALL), getTreasurySummary)

// ── Tutores con estado de cuenta ─────────────
router.get('/parents',          requirePermission(Permission.CHARGE_VIEW_ALL), getParentsWithBalance)
router.get('/parents/:parentId/account', requirePermission(Permission.CHARGE_VIEW_ALL), getParentAccount)

// ── Cargos ───────────────────────────────────
router.get('/',                 requirePermission(Permission.CHARGE_VIEW_ALL), getCharges)
router.get('/:id',              requirePermission(Permission.CHARGE_VIEW_ALL), getChargeById)
router.post('/',                requirePermission(Permission.CHARGE_CREATE), validateBody(createChargeSchema), createCharge)
router.post('/bulk',            requirePermission(Permission.CHARGE_CREATE), validateBody(createBulkChargesSchema), createBulkCharges)
router.put('/:id',              requirePermission(Permission.CHARGE_CREATE), validateBody(updateChargeSchema), updateCharge)
router.patch('/:id/cancel',     requirePermission(Permission.CHARGE_CREATE), cancelCharge)

// ── Pagos ────────────────────────────────────
router.post('/:id/payments',    requirePermission(Permission.CHARGE_CREATE), validateBody(registerPaymentSchema), registerPayment)

export default router