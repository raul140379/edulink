import { studentLicenseRepository } from '../repositories/studentLicense.repository'
import { HttpError } from '../utils/http-error'
import { dayRange } from './studentAttendance.service'
import { CreateLicenseInput } from '../schemas/studentLicense.schema'

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
}
