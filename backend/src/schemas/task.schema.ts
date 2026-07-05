import { z } from 'zod'
import { TaskType } from '@prisma/client'

export const createTaskSchema = z.object({
  title:         z.string().min(1, 'El título es requerido'),
  description:   z.string().optional(),
  type:          z.nativeEnum(TaskType),
  maxScore:      z.coerce.number().optional(),
  dueDate:       z.string().optional(),
  attachmentUrl: z.string().optional(),
  courseId:      z.coerce.number().int(),
  subjectId:     z.coerce.number().int(),
  trimesterId:   z.coerce.number().int().optional(),
  studentIds:    z.array(z.coerce.number().int()).optional(),
})

export const updateTaskSchema = z.object({
  title:         z.string().min(1).optional(),
  description:   z.string().optional(),
  type:          z.nativeEnum(TaskType).optional(),
  maxScore:      z.coerce.number().optional(),
  dueDate:       z.string().optional(),
  attachmentUrl: z.string().optional(),
  trimesterId:   z.coerce.number().int().nullable().optional(),
})

export const gradeSubmissionsSchema = z.object({
  submissions: z.array(z.object({
    studentId: z.coerce.number().int(),
    score:     z.coerce.number().optional().nullable(),
    note:      z.string().optional(),
  })).min(1, 'Se requiere un array de calificaciones'),
  courseId:    z.coerce.number().int().optional(),
  subjectId:   z.coerce.number().int().optional(),
  teacherId:   z.coerce.number().int().optional(),
  trimesterId: z.coerce.number().int().optional(),
})

export type CreateTaskInput          = z.infer<typeof createTaskSchema>
export type UpdateTaskInput          = z.infer<typeof updateTaskSchema>
export type GradeSubmissionsInput    = z.infer<typeof gradeSubmissionsSchema>
