import { z } from 'zod'
import { AcademicLevel, Grade, EducationType } from '@prisma/client'

export const createSubjectSchema = z.object({
  name:         z.string().min(1, 'El nombre es requerido'),
  code:         z.string().optional(),
  level:        z.nativeEnum(AcademicLevel),
  hoursPerWeek: z.coerce.number().int().optional(),
})

export const updateSubjectSchema = z.object({
  name:         z.string().min(1).optional(),
  code:         z.string().optional(),
  level:        z.nativeEnum(AcademicLevel).optional(),
  hoursPerWeek: z.coerce.number().int().optional(),
})

export const assignSubjectSchema = z.object({
  subjectId: z.coerce.number().int(),
  teacherId: z.coerce.number().int(),
  courseId:  z.coerce.number().int(),
})

export const assignSubjectBulkSchema = z.object({
  subjectId: z.coerce.number().int(),
  teacherId: z.coerce.number().int(),
  courseIds: z.array(z.coerce.number().int()).min(1, 'Debe indicar al menos un curso'),
})

export const addGradeConfigSchema = z.object({
  subjectId:     z.coerce.number().int(),
  grade:         z.nativeEnum(Grade),
  educationType: z.nativeEnum(EducationType),
  hoursPerWeek:  z.coerce.number().int().optional(),
})

export const updateGradeConfigSchema = z.object({
  hoursPerWeek: z.coerce.number().int().min(1, 'Las horas deben ser mayor a 0'),
})

export type CreateSubjectInput      = z.infer<typeof createSubjectSchema>
export type UpdateSubjectInput      = z.infer<typeof updateSubjectSchema>
export type AssignSubjectInput      = z.infer<typeof assignSubjectSchema>
export type AssignSubjectBulkInput  = z.infer<typeof assignSubjectBulkSchema>
export type AddGradeConfigInput     = z.infer<typeof addGradeConfigSchema>
export type UpdateGradeConfigInput  = z.infer<typeof updateGradeConfigSchema>
