import { z } from 'zod'

// Alta de licencia (5-sep-2026) — alcance de esta primera versión: SOLO
// crear. Listado/anulación queda pendiente a propósito (ver Próximos pasos
// en CLAUDE.md).
export const createLicenseSchema = z.object({
  studentId: z.coerce.number().int(),
  startDate: z.string(), // YYYY-MM-DD
  endDate:   z.string(), // YYYY-MM-DD
  reason:    z.string().trim().max(300).optional(),
}).refine((data) => data.endDate >= data.startDate, {
  message: 'La fecha de fin no puede ser anterior a la fecha de inicio',
  path: ['endDate'],
})

export type CreateLicenseInput = z.infer<typeof createLicenseSchema>
