import { z } from 'zod'

export const createAcademicYearSchema = z.object({
  year:      z.coerce.number().int(),
  startDate: z.string().min(1, 'La fecha de inicio es requerida'),
  endDate:   z.string().min(1, 'La fecha de fin es requerida'),
})

export const updateAcademicYearSchema = z.object({
  startDate: z.string().optional(),
  endDate:   z.string().optional(),
})

export const createTrimesterSchema = z.object({
  number:    z.coerce.number().int(),
  name:      z.string().optional(),
  startDate: z.string().min(1, 'La fecha de inicio es requerida'),
  endDate:   z.string().min(1, 'La fecha de fin es requerida'),
})

export const createHolidaySchema = z.object({
  date:        z.string().min(1, 'La fecha es requerida'),
  description: z.string().min(1, 'La descripción es requerida'),
})

export type CreateAcademicYearInput = z.infer<typeof createAcademicYearSchema>
export type UpdateAcademicYearInput = z.infer<typeof updateAcademicYearSchema>
export type CreateTrimesterInput    = z.infer<typeof createTrimesterSchema>
export type CreateHolidayInput      = z.infer<typeof createHolidaySchema>
