import { z } from 'zod'

export const createMeetingSchema = z.object({
  title: z.string().min(1, 'El título es requerido'),
  date:  z.string().min(1, 'La fecha es requerida'),
})

export const createMeetingAsTeacherSchema = z.object({
  title:    z.string().min(1, 'El título es requerido'),
  date:     z.string().min(1, 'La fecha es requerida'),
  courseId: z.coerce.number().int(),
})

export const updateMeetingSchema = z.object({
  title: z.string().min(1, 'El título es requerido'),
  date:  z.string().min(1, 'La fecha es requerida'),
})

export const attendanceItemSchema = z.object({
  parentId: z.coerce.number().int(),
  present:  z.boolean(),
  note:     z.string().optional(),
})

export const updateAttendanceSchema = z.object({
  attendances: z.array(attendanceItemSchema).min(1, 'Datos de asistencia requeridos'),
})

export const chargeAbsencesSchema = z.object({
  amount:         z.coerce.number().positive('El monto debe ser mayor a 0'),
  academicYearId: z.coerce.number().int(),
})

export type CreateMeetingInput           = z.infer<typeof createMeetingSchema>
export type CreateMeetingAsTeacherInput  = z.infer<typeof createMeetingAsTeacherSchema>
export type UpdateMeetingInput           = z.infer<typeof updateMeetingSchema>
export type UpdateAttendanceInput        = z.infer<typeof updateAttendanceSchema>
export type ChargeAbsencesInput          = z.infer<typeof chargeAbsencesSchema>
