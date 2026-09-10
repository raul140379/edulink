import { z } from 'zod'

// Alta de llegada tardía — Regente/Dirección/Secretaría, ver
// studentLateArrival.service.ts. minutesLate se calcula en el servicio, no
// viene del cliente (evita que un valor manipulado en el front rompa el
// dato real).
export const createLateArrivalSchema = z.object({
  studentId:    z.coerce.number().int(),
  courseId:     z.coerce.number().int(),
  arrivalTime:  z.string().regex(/^\d{2}:\d{2}$/, 'Formato de hora inválido (HH:MM)'),
  enteredClass: z.boolean(),
})

export type CreateLateArrivalInput = z.infer<typeof createLateArrivalSchema>
