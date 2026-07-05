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

export type CreateChargeInput       = z.infer<typeof createChargeSchema>
export type CreateBulkChargesInput  = z.infer<typeof createBulkChargesSchema>
export type UpdateChargeInput       = z.infer<typeof updateChargeSchema>
export type RegisterPaymentInput    = z.infer<typeof registerPaymentSchema>
