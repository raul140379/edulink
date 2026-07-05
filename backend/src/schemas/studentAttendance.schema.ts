import { z } from 'zod'
import { StudentAttendanceStatus } from '@prisma/client'

export const attendanceRecordSchema = z.object({
  studentId: z.coerce.number().int(),
  status:    z.nativeEnum(StudentAttendanceStatus),
  note:      z.string().optional(),
})

export const saveAttendanceSchema = z.object({
  date:        z.string().optional(),
  attendances: z.array(attendanceRecordSchema).min(1, 'attendances es requerido'),
})

export const closeAttendanceSchema = z.object({
  date: z.string().optional(),
})

export type SaveAttendanceInput  = z.infer<typeof saveAttendanceSchema>
export type CloseAttendanceInput = z.infer<typeof closeAttendanceSchema>
