import { z } from 'zod'

// Alta de licencia (5-sep-2026).
export const createLicenseSchema = z.object({
  studentId: z.coerce.number().int(),
  startDate: z.string(), // YYYY-MM-DD
  endDate:   z.string(), // YYYY-MM-DD
  reason:    z.string().trim().max(300).optional(),
}).refine((data) => data.endDate >= data.startDate, {
  message: 'La fecha de fin no puede ser anterior a la fecha de inicio',
  path: ['endDate'],
})

// Anulación (12-sep-2026) — nota obligatoria, queda como rastro de POR QUÉ
// se anuló (no solo quién/cuándo).
export const cancelLicenseSchema = z.object({
  note: z.string().trim().min(1, 'La nota de anulación es requerida').max(300),
})

export type CreateLicenseInput = z.infer<typeof createLicenseSchema>
export type CancelLicenseInput = z.infer<typeof cancelLicenseSchema>
