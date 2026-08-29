import { z } from 'zod'

export const createTeacherSchema = z.object({
  firstName: z.string().min(1, 'El nombre es requerido'),
  lastName:  z.string().min(1, 'El apellido es requerido'),
  ci:        z.string().optional(),
  phone:     z.string().optional(),
  email:     z.string().email('Email inválido').optional().or(z.literal('')),
  specialty: z.string().optional(),
  birthDate: z.string().nullable().optional(),
  hoursLoad: z.coerce.number().int().nullable().optional(),
  gender:    z.string().nullable().optional(),
})

export const updateTeacherSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName:  z.string().min(1).optional(),
  ci:        z.string().optional(),
  phone:     z.string().optional(),
  email:     z.string().email('Email inválido').optional().or(z.literal('')),
  specialty: z.string().optional(),
  birthDate: z.string().nullable().optional(),
  hoursLoad: z.coerce.number().int().nullable().optional(),
  gender:    z.string().nullable().optional(),
})

export const attendanceCodeSchema = z.object({
  code: z.string().min(3, 'El código debe tener al menos 3 caracteres'),
})

export const teacherScheduleSchema = z.object({
  entryTime:    z.string().optional(),
  exitTime:     z.string().optional(),
  toleranceMin: z.coerce.number().int().optional(),
})

export type CreateTeacherInput   = z.infer<typeof createTeacherSchema>
export type UpdateTeacherInput   = z.infer<typeof updateTeacherSchema>
export type AttendanceCodeInput  = z.infer<typeof attendanceCodeSchema>
export type TeacherScheduleInput = z.infer<typeof teacherScheduleSchema>
