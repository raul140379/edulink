import { studentLicenseRepository } from '../repositories/studentLicense.repository'
import { HttpError } from '../utils/http-error'
import { dayRange } from './studentAttendance.service'
import { CreateLicenseInput, CancelLicenseInput } from '../schemas/studentLicense.schema'

// DIRECTOR resuelve su nombre vía schoolDirector (modelo Director), SECRETARY/
// REGENTE vía staff — nunca los dos a la vez. Sin ninguno de los dos (no
// debería pasar dado el permiso de este módulo), cae al email.
function actorName(user: { email: string; staff: { firstName: string; lastName: string } | null; schoolDirector: { firstName: string; lastName: string } | null } | null): string | null {
  if (!user) return null
  const profile = user.staff ?? user.schoolDirector
  return profile ? `${profile.firstName} ${profile.lastName}` : user.email
}

export const studentLicenseService = {
  // Opción A (aprobada 5-sep-2026): esto NUNCA toca StudentAttendance — solo
  // crea el registro de licencia. Los puntos de lectura (pantalla del
  // maestro, closeAttendance, reportes/matriz) la consultan y "tapan" la
  // vista, sin borrar ni editar nada de lo que el maestro ya hubiera
  // registrado por debajo.
  async createLicense(input: CreateLicenseInput, createdById: number) {
    const student = await studentLicenseRepository.findStudentById(input.studentId)
    if (!student) throw new HttpError(404, 'Estudiante no encontrado')

    // Mismo anclaje TZ-independiente que ya usa asistencia (dayRange) — para
    // que "del 5 al 9 de septiembre" signifique exactamente el mismo rango
    // de días acá que en el resto del módulo, sin depender de la zona
    // horaria del servidor.
    const { base: startDate } = dayRange(input.startDate)
    const { base: endDate } = dayRange(input.endDate)

    const license = await studentLicenseRepository.create({
      studentId: input.studentId, startDate, endDate,
      reason: input.reason || null, createdById,
    })

    return {
      message: `Licencia registrada para ${student.lastName} ${student.firstName}, del ${input.startDate} al ${input.endDate}.`,
      license,
    }
  },

  // Historial completo para la pantalla nueva en admin/estudiantes/[id] —
  // activas, vencidas y canceladas, todas juntas (el estado se deriva en el
  // frontend a partir de startDate/endDate/cancelledAt, no hace falta un
  // campo aparte acá).
  async getLicensesForStudent(studentId: number) {
    const student = await studentLicenseRepository.findStudentById(studentId)
    if (!student) throw new HttpError(404, 'Estudiante no encontrado')

    const licenses = await studentLicenseRepository.findAllForStudent(studentId)
    return licenses.map((l) => ({
      id: l.id, startDate: l.startDate, endDate: l.endDate, reason: l.reason,
      createdAt: l.createdAt, createdByName: actorName(l.createdBy),
      cancelledAt: l.cancelledAt, cancelledNote: l.cancelledNote, cancelledByName: actorName(l.cancelledBy),
    }))
  },

  // Anular — nunca borra la fila (mismo criterio de "nunca perder el
  // histórico" ya usado en todo el proyecto). El overlay de lectura
  // (getAttendanceByCourse/closeAttendance/matriz semanal/historial del
  // estudiante) ya filtra cancelledAt: null, así que esto destapa el estado
  // real de inmediato en la siguiente lectura — sin nada más que tocar.
  async cancelLicense(id: number, input: CancelLicenseInput, cancelledById: number) {
    const license = await studentLicenseRepository.findById(id)
    if (!license) throw new HttpError(404, 'Licencia no encontrada')
    if (license.cancelledAt) throw new HttpError(400, 'Esta licencia ya está anulada')

    const updated = await studentLicenseRepository.cancel(id, cancelledById, input.note)
    return { message: 'Licencia anulada correctamente.', license: updated }
  },
}
