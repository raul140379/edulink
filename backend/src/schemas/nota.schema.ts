import { z } from 'zod'
import { NotaDimension } from '@prisma/client'

export const initNotaSchema = z.object({
  studentId:   z.coerce.number().int(),
  subjectId:   z.coerce.number().int(),
  courseId:    z.coerce.number().int(),
  teacherId:   z.coerce.number().int(),
  trimesterId: z.coerce.number().int(),
})

export const addNotaItemSchema = z.object({
  notaId:     z.coerce.number().int(),
  dimension:  z.nativeEnum(NotaDimension),
  titulo:     z.string().min(1, 'El título es requerido'),
  puntaje:    z.coerce.number(),
  maxPuntaje: z.coerce.number(),
  fecha:      z.string().optional(),
  taskId:     z.coerce.number().int().optional(),
})

export const updateNotaItemSchema = z.object({
  titulo:     z.string().min(1, 'El título es requerido'),
  puntaje:    z.coerce.number(),
  maxPuntaje: z.coerce.number(),
  fecha:      z.string().optional(),
})

export const updateSerSchema = z.object({
  ser: z.coerce.number().min(0, 'Ser debe estar entre 0 y 10').max(10, 'Ser debe estar entre 0 y 10'),
})

export const updateAutoEvaluacionSchema = z.object({
  autoEvaluacion: z.coerce.number().min(0, 'Autoevaluación debe estar entre 0 y 5').max(5, 'Autoevaluación debe estar entre 0 y 5'),
})

export type InitNotaInput              = z.infer<typeof initNotaSchema>
export type AddNotaItemInput           = z.infer<typeof addNotaItemSchema>
export type UpdateNotaItemInput        = z.infer<typeof updateNotaItemSchema>
export type UpdateSerInput             = z.infer<typeof updateSerSchema>
export type UpdateAutoEvaluacionInput  = z.infer<typeof updateAutoEvaluacionSchema>
