import { studentLateArrivalRepository } from '../repositories/studentLateArrival.repository'
import { HttpError } from '../utils/http-error'
import { dayRange } from './studentAttendance.service'
import { parseTimeToMinutes } from '../utils/bolivia-time'
import { CreateLateArrivalInput } from '../schemas/studentLateArrival.schema'

const GRADES: Record<string, string> = { PRIMERO: '1°', SEGUNDO: '2°', TERCERO: '3°', CUARTO: '4°', QUINTO: '5°', SEXTO: '6°' }

export const studentLateArrivalService = {
  // Independiente de GateRecord (Portería) a propósito — arranca recién
  // cuando Portería ya cerró la puerta, la Regente carga la hora a mano.
  // minutesLate se calcula y CONGELA acá contra el SchoolSchedule vigente
  // en este momento — mismo criterio que AttendanceBlock, nunca se
  // recalcula después si el horario cambia.
  async registerLateArrival(input: CreateLateArrivalInput, registeredById: number) {
    const student = await studentLateArrivalRepository.findStudentById(input.studentId)
    if (!student) throw new HttpError(404, 'Estudiante no encontrado')
    if (!student.isActive) throw new HttpError(400, 'Este estudiante no tiene matrícula activa.')

    const course = await studentLateArrivalRepository.findCourseById(input.courseId)
    if (!course) throw new HttpError(404, 'Curso no encontrado')

    const schedule = await studentLateArrivalRepository.findActiveSchoolScheduleStartTime(course.shift)
    if (!schedule) throw new HttpError(400, `No hay un horario de turno activo (${course.shift}) configurado — no se puede calcular el atraso.`)

    const arrivalMin = parseTimeToMinutes(input.arrivalTime)
    const startMin = parseTimeToMinutes(schedule.startTime)
    const minutesLate = Math.max(0, arrivalMin - startMin)

    const { base } = dayRange()
    const lateArrival = await studentLateArrivalRepository.create({
      studentId: input.studentId, courseId: input.courseId, date: base,
      arrivalTime: input.arrivalTime, minutesLate, enteredClass: input.enteredClass,
      registeredById,
    })

    return {
      message: `Llegada tardía registrada: ${student.lastName} ${student.firstName}, ${minutesLate} min de atraso.`,
      lateArrival,
    }
  },

  async notifyParent(id: number, sentById: number) {
    const record = await studentLateArrivalRepository.findById(id)
    if (!record) throw new HttpError(404, 'Registro no encontrado')
    if (record.notifiedAt) throw new HttpError(409, 'Ya se notificó al padre de este registro.')

    const parentLink = await studentLateArrivalRepository.findTutorLink(record.studentId)
    if (!parentLink?.parent) throw new HttpError(400, 'Este estudiante no tiene un tutor registrado — no se puede notificar.')

    const cursoLabel = `${GRADES[record.course.grade] || record.course.grade} "${record.course.parallel}"`
    const title = `⏰ Llegada tardía — ${cursoLabel}`
    const message = `Su hijo/a (${record.student.lastName} ${record.student.firstName}) llegó tarde al colegio hoy a las ${record.arrivalTime} (${record.minutesLate} min de atraso).${record.enteredClass ? '' : ' No llegó a entrar a clases.'}`

    await studentLateArrivalRepository.createNotification({ title, message, sentById, parentId: parentLink.parent.id })
    await studentLateArrivalRepository.markNotified(id)

    return { message: 'Notificación enviada al padre/tutor.' }
  },

  async getTodayForCourse(courseId: number) {
    const { base } = dayRange()
    return studentLateArrivalRepository.findForCourseDate(courseId, base)
  },
}
