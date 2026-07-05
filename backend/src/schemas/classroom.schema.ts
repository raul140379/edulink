import { z } from 'zod'

export const createClassroomSchema = z.object({
  name:     z.string().min(1, 'El nombre del aula es requerido'),
  capacity: z.coerce.number().int().optional(),
})

export const updateClassroomSchema = z.object({
  name:     z.string().min(1).optional(),
  capacity: z.coerce.number().int().optional(),
  isActive: z.boolean().optional(),
})

export const assignClassroomSchema = z.object({
  classroomId: z.coerce.number().int().nullable().optional(),
})

export type CreateClassroomInput  = z.infer<typeof createClassroomSchema>
export type UpdateClassroomInput  = z.infer<typeof updateClassroomSchema>
export type AssignClassroomInput  = z.infer<typeof assignClassroomSchema>
