import { z } from 'zod'

export const checkInSchema = z.object({
  code: z.string().min(1, 'El código es requerido'),
})

export type CheckInInput = z.infer<typeof checkInSchema>
