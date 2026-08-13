import { z } from 'zod'
import { ChargeType, ChargeTarget, PaymentMethod } from '@prisma/client'

export const createChargeSchema = z.object({
  title:          z.string().min(1, 'El título es requerido'),
  description:    z.string().optional(),
  amount:         z.coerce.number().positive('El monto debe ser mayor a 0'),
  type:           z.nativeEnum(ChargeType),
  target:         z.nativeEnum(ChargeTarget).optional(),
  dueDate:        z.string().optional(),
  parentId:       z.coerce.number().int(),
  studentId:      z.coerce.number().int().optional(),
  academicYearId: z.coerce.number().int(),
  tolerance:      z.boolean().optional(),
  toleranceNote:  z.string().optional(),
})

export const createBulkChargesSchema = z.object({
  title:          z.string().min(1, 'El título es requerido'),
  description:    z.string().optional(),
  amount:         z.coerce.number().positive('El monto debe ser mayor a 0'),
  type:           z.nativeEnum(ChargeType),
  dueDate:        z.string().optional(),
  academicYearId: z.coerce.number().int(),
  parentIds:      z.array(z.coerce.number().int()).min(1, 'Debe indicar al menos un tutor'),
})

export const updateChargeSchema = z.object({
  title:         z.string().min(1).optional(),
  description:   z.string().optional(),
  amount:        z.coerce.number().positive('El monto debe ser mayor a 0').optional(),
  dueDate:       z.string().optional(),
  tolerance:     z.boolean().optional(),
  toleranceNote: z.string().optional(),
})

export const registerPaymentSchema = z.object({
  amount:    z.coerce.number().positive('El monto debe ser mayor a 0'),
  method:    z.nativeEnum(PaymentMethod),
  reference: z.string().optional(),
  note:      z.string().optional(),
  date:      z.string().optional(),
})

export const updatePaymentSchema = z.object({
  amount:    z.coerce.number().positive('El monto debe ser mayor a 0').optional(),
  method:    z.nativeEnum(PaymentMethod).optional(),
  reference: z.string().optional(),
  note:      z.string().optional(),
  date:      z.string().optional(),
})

export const createMandatoryChargeSchema = z.object({
  title:          z.string().min(1, 'El título es requerido'),
  description:    z.string().optional(),
  amount:         z.coerce.number().positive('El monto debe ser mayor a 0'),
  type:           z.nativeEnum(ChargeType),
  dueDate:        z.string().optional(),
  academicYearId: z.coerce.number().int(),
})

export const updateMandatoryChargeSchema = z.object({
  title:       z.string().min(1, 'El título es requerido').optional(),
  description: z.string().optional(),
  amount:      z.coerce.number().positive('El monto debe ser mayor a 0').optional(),
  type:        z.nativeEnum(ChargeType).optional(),
  dueDate:     z.string().optional(),
})

// Corrección histórica de un cargo ya PAGADO/PARCIAL/TRASLADADO — a diferencia
// de updateChargeSchema/registerPaymentSchema, acá `paid` decide explícitamente
// si queda con pago o no, en vez de sumar sobre lo existente.
export const historicalCorrectionSchema = z.object({
  amount:     z.coerce.number().positive('El monto debe ser mayor a 0').optional(),
  paid:       z.boolean(),
  paidAmount: z.coerce.number().min(0).optional(),
  date:       z.string().optional(),
  reference:  z.string().optional(),
  method:     z.nativeEnum(PaymentMethod).optional(),
})

// "Sin registrar" -> crea el Charge histórico y, si queda con saldo, lo
// traslada de inmediato a la gestión activa, en una sola acción.
export const createAndCarryForwardSchema = z.object({
  parentId:          z.coerce.number().int(),
  academicYearId:    z.coerce.number().int(),
  mandatoryChargeId: z.coerce.number().int(),
  amount:            z.coerce.number().positive('El monto debe ser mayor a 0').optional(),
  paid:              z.boolean().optional(),
  paidAmount:        z.coerce.number().min(0).optional(),
  date:              z.string().optional(),
  reference:         z.string().optional(),
  method:            z.nativeEnum(PaymentMethod).optional(),
})

// Devolución interna de un pago duplicado — nunca toca Charge.status ni
// Charge.paidAmount, es puramente un registro adicional (ver Refund en el
// schema de Prisma).
export const registerRefundSchema = z.object({
  amount: z.coerce.number().positive('El monto debe ser mayor a 0'),
  reason: z.string().min(1, 'El motivo es requerido'),
  date:   z.string().optional(),
})

export type CreateChargeInput             = z.infer<typeof createChargeSchema>
export type CreateBulkChargesInput        = z.infer<typeof createBulkChargesSchema>
export type UpdateChargeInput             = z.infer<typeof updateChargeSchema>
export type RegisterPaymentInput          = z.infer<typeof registerPaymentSchema>
export type UpdatePaymentInput            = z.infer<typeof updatePaymentSchema>
export type CreateMandatoryChargeInput    = z.infer<typeof createMandatoryChargeSchema>
export type UpdateMandatoryChargeInput    = z.infer<typeof updateMandatoryChargeSchema>
export type HistoricalCorrectionInput     = z.infer<typeof historicalCorrectionSchema>
export type CreateAndCarryForwardInput    = z.infer<typeof createAndCarryForwardSchema>
export type RegisterRefundInput           = z.infer<typeof registerRefundSchema>
