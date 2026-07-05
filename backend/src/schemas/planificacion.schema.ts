import { z } from 'zod'

export const generatePlanificacionSchema = z.object({
  periodosConsecutivos: z.coerce.number().int().optional(),
  maxPorDia:            z.coerce.number().int().optional(),
  maxPeriodo:           z.coerce.number().int().optional(),
  porcentajeBase:       z.coerce.number().int().optional(),
})

export const saveSlotSchema = z.object({
  slot: z.enum(['A', 'B']),
})

export const assignPlanPeriodSchema = z.object({
  dayOfWeek:              z.coerce.number().int(),
  period:                 z.coerce.number().int(),
  startTime:              z.string().min(1),
  endTime:                z.string().min(1),
  teacherSubjectCourseId: z.coerce.number().int(),
  slot:                   z.string().optional(),
})

export const promotePlanificacionSchema = z.object({
  slot: z.string().optional(),
})

export type GeneratePlanificacionInput = z.infer<typeof generatePlanificacionSchema>
export type SaveSlotInput              = z.infer<typeof saveSlotSchema>
export type AssignPlanPeriodInput      = z.infer<typeof assignPlanPeriodSchema>
export type PromotePlanificacionInput  = z.infer<typeof promotePlanificacionSchema>
