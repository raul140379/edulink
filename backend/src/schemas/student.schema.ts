import { z } from 'zod'
import { Gender, EducationType, WithdrawalReason } from '@prisma/client'

export const createStudentSchema = z.object({
  firstName: z.string().min(1, 'El nombre es requerido'),
  lastName:  z.string().min(1, 'El apellido es requerido'),
  ci:        z.string().optional(),
  rude:      z.string().optional(),
  birthDate: z.string().optional(),
  phone:     z.string().optional(),
  email:     z.string().email('Email inválido').optional().or(z.literal('')),
  address:   z.string().optional(),
  gender:    z.nativeEnum(Gender).optional(),
})

export const updateStudentSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName:  z.string().min(1).optional(),
  ci:        z.string().optional(),
  rude:      z.string().optional(),
  birthDate: z.string().optional(),
  phone:     z.string().optional(),
  email:     z.string().email('Email inválido').optional().or(z.literal('')),
  address:   z.string().optional(),
  gender:    z.nativeEnum(Gender).optional(),
})

export const enrollSchema = z.object({
  courseId:      z.coerce.number().int(),
  educationType: z.nativeEnum(EducationType).optional(),
})

export const autoEvaluacionSchema = z.object({
  notaId:         z.coerce.number().int(),
  autoEvaluacion: z.coerce.number().min(0, 'Autoevaluación debe estar entre 0 y 5').max(5, 'Autoevaluación debe estar entre 0 y 5'),
})

export const changeCourseSchema = z.object({
  courseId: z.coerce.number().int(),
})

export const withdrawStudentSchema = z.object({
  reason: z.nativeEnum(WithdrawalReason),
  note:   z.string().optional(),
})

export type CreateStudentInput   = z.infer<typeof createStudentSchema>
export type UpdateStudentInput   = z.infer<typeof updateStudentSchema>
export type EnrollInput          = z.infer<typeof enrollSchema>
export type AutoEvaluacionInput  = z.infer<typeof autoEvaluacionSchema>
export type ChangeCourseInput    = z.infer<typeof changeCourseSchema>
export type WithdrawStudentInput = z.infer<typeof withdrawStudentSchema>
