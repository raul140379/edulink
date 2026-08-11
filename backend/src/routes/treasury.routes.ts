import { Router } from 'express'
import multer from 'multer'
import { verifyToken, requirePermission, requireAnyPermission, restoreTenantContext } from '../middlewares/auth.middleware'
import { validateBody } from '../middlewares/validate.middleware'
import { Permission } from '../config/permissions'
import {
  createChargeSchema, createBulkChargesSchema, updateChargeSchema, registerPaymentSchema, updatePaymentSchema,
  createMandatoryChargeSchema, updateMandatoryChargeSchema, historicalCorrectionSchema, createAndCarryForwardSchema,
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
  updatePayment,
  getTreasurySummary,
  getParentsWithBalance,
  getTreasuryByCourse,
  getVerificationReportByCourse,
  getPaymentsHistory,
} from '../controllers/treasury.controller'
import {
  getMandatoryCharges, createMandatoryCharge, updateMandatoryCharge, toggleMandatoryCharge, applyMandatoryChargeToMissing,
  deleteMandatoryCharge,
} from '../controllers/mandatoryCharge.controller'
import {
  getAcademicYearsClosureStatus, closeEconomicPeriod, reopenEconomicPeriod,
  correctHistoricalCharge, carryForwardSingleCharge, createAndCarryForwardCharge, createHistoricalCharge,
  previewCourseImport, applyCourseImport,
} from '../controllers/academicClosure.controller'

const router = Router()
const upload = multer({ storage: multer.memoryStorage() })

// Todas las rutas requieren autenticación
router.use(verifyToken)

// ── Resumen general ──────────────────────────
router.get('/summary',          requirePermission(Permission.CHARGE_VIEW_ALL), getTreasurySummary)

// ── Cierre de gestión económica (Junta Escolar) — ANTES que /:id genérico ──
router.get('/academic-years',                              requirePermission(Permission.CHARGE_VIEW_ALL), getAcademicYearsClosureStatus)
router.post('/academic-years/:id/close-economic-period',   requirePermission(Permission.TREASURY_CLOSE_PERIOD), closeEconomicPeriod)
router.post('/academic-years/:id/reopen-economic-period',  requirePermission(Permission.TREASURY_CLOSE_PERIOD), reopenEconomicPeriod)

// ── Corrección histórica y traslado manual (Junta Escolar) — mismo permiso
// que el cierre de gestión, porque reescriben historial financiero ya
// protegido por status PAGADO/ANULADO en los endpoints de uso diario ──
router.put('/:id/historical-correction',    requirePermission(Permission.TREASURY_CLOSE_PERIOD), validateBody(historicalCorrectionSchema), correctHistoricalCharge)
router.post('/:id/carry-forward',           requirePermission(Permission.TREASURY_CLOSE_PERIOD), carryForwardSingleCharge)
router.post('/create-and-carry-forward',    requirePermission(Permission.TREASURY_CLOSE_PERIOD), validateBody(createAndCarryForwardSchema), createAndCarryForwardCharge)
router.post('/create-historical-charge',    requirePermission(Permission.TREASURY_CLOSE_PERIOD), validateBody(createAndCarryForwardSchema), createHistoricalCharge)

// ── Import CSV de aportes por curso (gestión activa) — mismo permiso, crea
// cargos históricos igual que las acciones de arriba. Preview es solo
// lectura; apply escribe. Antes de /:id genérico. ──
router.post('/course/:courseId/import-aportes/preview', requirePermission(Permission.TREASURY_CLOSE_PERIOD), upload.single('file'), restoreTenantContext, previewCourseImport)
router.post('/course/:courseId/import-aportes/apply',   requirePermission(Permission.TREASURY_CLOSE_PERIOD), upload.single('file'), restoreTenantContext, applyCourseImport)

// ── Tutores con estado de cuenta ─────────────
// /by-course ANTES que /:id genérico más abajo, si no Express matchearía
// "by-course" como el :id de una ruta de cargo.
router.get('/by-course',        requirePermission(Permission.CHARGE_VIEW_ALL), getTreasuryByCourse)
router.get('/verification-by-course', requirePermission(Permission.CHARGE_VIEW_ALL), getVerificationReportByCourse)
router.get('/parents',          requirePermission(Permission.CHARGE_VIEW_ALL), getParentsWithBalance)
router.get('/parents/:parentId/account', requireAnyPermission(Permission.CHARGE_VIEW_ALL, Permission.CHARGE_VIEW_OWN), getParentAccount)
router.get('/payments',         requirePermission(Permission.CHARGE_VIEW_ALL), getPaymentsHistory)

// ── Cargos obligatorios (plantillas) — ANTES que /:id genérico ──
router.get('/mandatory-charges',                    requirePermission(Permission.CHARGE_VIEW_ALL), getMandatoryCharges)
router.post('/mandatory-charges',                   requirePermission(Permission.CHARGE_CREATE), validateBody(createMandatoryChargeSchema), createMandatoryCharge)
router.put('/mandatory-charges/:id',                requirePermission(Permission.CHARGE_CREATE), validateBody(updateMandatoryChargeSchema), updateMandatoryCharge)
router.patch('/mandatory-charges/:id/toggle',       requirePermission(Permission.CHARGE_CREATE), toggleMandatoryCharge)
router.post('/mandatory-charges/:id/apply-missing', requirePermission(Permission.CHARGE_CREATE), applyMandatoryChargeToMissing)
router.delete('/mandatory-charges/:id',              requirePermission(Permission.CHARGE_CREATE), deleteMandatoryCharge)

// ── Cargos ───────────────────────────────────
router.get('/',                 requirePermission(Permission.CHARGE_VIEW_ALL), getCharges)
router.get('/:id',              requirePermission(Permission.CHARGE_VIEW_ALL), getChargeById)
router.post('/',                requirePermission(Permission.CHARGE_CREATE), validateBody(createChargeSchema), createCharge)
router.post('/bulk',            requirePermission(Permission.CHARGE_CREATE), validateBody(createBulkChargesSchema), createBulkCharges)
router.put('/:id',              requirePermission(Permission.CHARGE_CREATE), validateBody(updateChargeSchema), updateCharge)
router.patch('/:id/cancel',     requirePermission(Permission.CHARGE_CREATE), cancelCharge)

// ── Pagos ────────────────────────────────────
router.post('/:id/payments',           requirePermission(Permission.CHARGE_CREATE), validateBody(registerPaymentSchema), registerPayment)
router.put('/payments/:paymentId',     requirePermission(Permission.CHARGE_CREATE), validateBody(updatePaymentSchema), updatePayment)

export default router