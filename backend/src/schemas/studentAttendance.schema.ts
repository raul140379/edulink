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
  // Mitigación urgente (4-sep-2026) contra pisado silencioso: un curso puede
  // tener varios maestros (uno por materia) y hoy solo existe un registro
  // compartido por curso/día — si el maestro que guarda es distinto al que
  // ya registró, el servicio rechaza con 409 salvo que venga force:true
  // (el usuario ya confirmó en pantalla que quiere reemplazar). No resuelve
  // el modelo de fondo (eso queda para el rediseño con scheduleId) — solo
  // saca el "en silencio" del problema.
  force: z.boolean().optional(),
})

export const closeAttendanceSchema = z.object({
  date: z.string().optional(),
})

export type SaveAttendanceInput  = z.infer<typeof saveAttendanceSchema>
export type CloseAttendanceInput = z.infer<typeof closeAttendanceSchema>
