import { z } from 'zod'

// Solicitud del padre (12-sep-2026) — a diferencia del alta directa de
// Dirección/Secretaría/Regente (reason opcional, ya verificaron en persona),
// acá el motivo es obligatorio: nadie más está validando en el momento.
export const createLicenseRequestSchema = z.object({
  studentId: z.coerce.number().int(),
  startDate: z.string(), // YYYY-MM-DD
  endDate:   z.string(), // YYYY-MM-DD
  reason:    z.string().trim().min(1, 'El motivo es requerido').max(300),
}).refine((data) => data.endDate >= data.startDate, {
  message: 'La fecha de fin no puede ser anterior a la fecha de inicio',
  path: ['endDate'],
})

// Aprobar — nota opcional (ej. una aclaración para el padre).
export const approveLicenseRequestSchema = z.object({
  note: z.string().trim().max(300).optional(),
})

// Rechazar — nota obligatoria, mismo criterio que cancelLicenseSchema: nunca
// resolver sin dejar rastro de por qué.
export const rejectLicenseRequestSchema = z.object({
  note: z.string().trim().min(1, 'El motivo del rechazo es requerido').max(300),
})

export type CreateLicenseRequestInput = z.infer<typeof createLicenseRequestSchema>
export type ApproveLicenseRequestInput = z.infer<typeof approveLicenseRequestSchema>
export type RejectLicenseRequestInput = z.infer<typeof rejectLicenseRequestSchema>
