import { z } from 'zod'
import { AcademicLevel, Grade, Parallel, Shift, EducationType } from '@prisma/client'

export const createCourseSchema = z.object({
  level:         z.nativeEnum(AcademicLevel),
  grade:         z.nativeEnum(Grade),
  parallel:      z.nativeEnum(Parallel),
  shift:         z.nativeEnum(Shift),
  educationType: z.nativeEnum(EducationType).optional(),
})

export const updateCourseSchema = z.object({
  level:           z.nativeEnum(AcademicLevel).optional(),
  grade:           z.nativeEnum(Grade).optional(),
  parallel:        z.nativeEnum(Parallel).optional(),
  shift:           z.nativeEnum(Shift).optional(),
  educationType:   z.nativeEnum(EducationType).optional(),
  shiftDirectorId: z.coerce.number().int().nullable().optional(),
})

export const assignTutorSchema = z.object({
  teacherId: z.coerce.number().int(),
})

export type CreateCourseInput = z.infer<typeof createCourseSchema>
export type UpdateCourseInput = z.infer<typeof updateCourseSchema>
export type AssignTutorInput  = z.infer<typeof assignTutorSchema>
