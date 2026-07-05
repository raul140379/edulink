import { z } from 'zod'
import { Shift } from '@prisma/client'

export const createSchoolScheduleSchema = z.object({
  shift:          z.nativeEnum(Shift),
  name:           z.string().min(1, 'El nombre es requerido'),
  startTime:      z.string().min(1, 'La hora de inicio es requerida'),
  exitTime:       z.string().min(1, 'La hora de salida es requerida'),
  periods:        z.coerce.number().int().optional(),
  periodDuration: z.coerce.number().int().optional(),
  breakDuration:  z.coerce.number().int().optional(),
  breakAfter:     z.string().optional(),
  isWinter:       z.boolean().optional(),
})

export const updateSchoolScheduleSchema = z.object({
  shift:          z.nativeEnum(Shift).optional(),
  name:           z.string().min(1).optional(),
  startTime:      z.string().optional(),
  exitTime:       z.string().optional(),
  periods:        z.coerce.number().int().optional(),
  periodDuration: z.coerce.number().int().optional(),
  breakDuration:  z.coerce.number().int().optional(),
  breakAfter:     z.string().optional(),
  isWinter:       z.boolean().optional(),
  isActive:       z.boolean().optional(),
})

export const assignPeriodSchema = z.object({
  dayOfWeek:              z.coerce.number().int().min(1).max(6),
  period:                 z.coerce.number().int().min(1),
  startTime:              z.string().min(1, 'La hora de inicio es requerida'),
  endTime:                z.string().min(1, 'La hora de fin es requerida'),
  teacherSubjectCourseId: z.coerce.number().int(),
  academicYearId:         z.coerce.number().int().optional(),
})

export type CreateSchoolScheduleInput = z.infer<typeof createSchoolScheduleSchema>
export type UpdateSchoolScheduleInput = z.infer<typeof updateSchoolScheduleSchema>
export type AssignPeriodInput         = z.infer<typeof assignPeriodSchema>
