import { z } from 'zod'
import { AttendanceStatus } from '@prisma/client'

export const updateTeacherAttendanceSchema = z.object({
  status:   z.nativeEnum(AttendanceStatus).optional(),
  note:     z.string().optional(),
  checkIn:  z.string().optional(),
  checkOut: z.string().optional(),
})

export const publicCodeSchema = z.object({
  code: z.string().min(1, 'Código requerido'),
})

export type UpdateTeacherAttendanceInput = z.infer<typeof updateTeacherAttendanceSchema>
export type PublicCodeInput              = z.infer<typeof publicCodeSchema>
