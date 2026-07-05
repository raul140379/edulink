import { z } from 'zod'
import { GateAction } from '@prisma/client'

export const registerStudentSchema = z.object({
  studentId: z.coerce.number().int(),
  action:    z.nativeEnum(GateAction),
  method:    z.string().optional(),
  note:      z.string().optional(),
})

export const registerTeacherSchema = z.object({
  teacherId: z.coerce.number().int(),
  action:    z.nativeEnum(GateAction),
  method:    z.string().optional(),
  note:      z.string().optional(),
})

export const registerStaffSchema = z.object({
  staffId: z.coerce.number().int(),
  action:  z.nativeEnum(GateAction),
  method:  z.string().optional(),
  note:    z.string().optional(),
})

export const registerVisitorSchema = z.object({
  visitorName: z.string().min(1, 'El nombre es requerido'),
  visitorCI:   z.string().optional(),
  reason:      z.string().optional(),
  destination: z.string().optional(),
  action:      z.nativeEnum(GateAction),
  note:        z.string().optional(),
})

export type RegisterStudentInput = z.infer<typeof registerStudentSchema>
export type RegisterTeacherInput = z.infer<typeof registerTeacherSchema>
export type RegisterStaffInput   = z.infer<typeof registerStaffSchema>
export type RegisterVisitorInput = z.infer<typeof registerVisitorSchema>
