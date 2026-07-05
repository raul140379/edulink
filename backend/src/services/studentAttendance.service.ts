import { studentAttendanceRepository } from '../repositories/studentAttendance.repository'
import { HttpError } from '../utils/http-error'
import { SaveAttendanceInput, CloseAttendanceInput } from '../schemas/studentAttendance.schema'

const GRADES: Record<string, string> = { PRIMERO: '1°', SEGUNDO: '2°', TERCERO: '3°', CUARTO: '4°', QUINTO: '5°', SEXTO: '6°' }

function dayRange(dateStr?: string) {
  const base = dateStr ? new Date(dateStr) : new Date()
  base.setHours(0, 0, 0, 0)
  const next = new Date(base)
  next.setDate(next.getDate() + 1)
  return { base, next }
}

export const studentAttendanceService = {
  async getAttendanceByCourse(courseId: number, date?: string) {
    const activeYear = await studentAttendanceRepository.findActiveAcademicYear()
    if (!activeYear) throw new HttpError(400, 'No hay gestión activa')

    const { base, next } = dayRange(date)

    const assignments = await studentAttendanceRepository.findAssignmentsForCourse(courseId, activeYear.id)
    const attendances = await studentAttendanceRepository.findAttendancesForCourseDate(courseId, activeYear.id, base, next)

    const attendanceMap: Record<number, any> = {}
    attendances.forEach((a) => { attendanceMap[a.studentId] = a })

    const students = assignments.map((a) => ({
      studentId: a.student.id,
      firstName: a.student.firstName,
      lastName:  a.student.lastName,
      gender:    a.student.gender,
      attendance: attendanceMap[a.student.id] || null,
      status:    attendanceMap[a.student.id]?.status || 'PRESENTE',
      note:      attendanceMap[a.student.id]?.note || '',
    }))

    const summary = {
      total:      students.length,
      presentes:  attendances.filter((a) => a.status === 'PRESENTE').length,
      ausentes:   attendances.filter((a) => a.status === 'AUSENTE').length,
      retrasos:   attendances.filter((a) => a.status === 'RETRASO').length,
      licencias:  attendances.filter((a) => a.status === 'LICENCIA').length,
      registrado: attendances.length > 0,
    }

    return { date: base.toISOString().split('T')[0], students, summary }
  },

  async saveAttendance(userId: number | undefined, courseId: number, input: SaveAttendanceInput) {
    const activeYear = await studentAttendanceRepository.findActiveAcademicYear()
    if (!activeYear) throw new HttpError(400, 'No hay gestión activa')

    const teacher = await studentAttendanceRepository.findTeacherByUserId(userId)
    if (!teacher) throw new HttpError(404, 'Maestro no encontrado')

    const course = await studentAttendanceRepository.findCourseById(courseId)
    if (!course) throw new HttpError(404, 'Curso no encontrado')

    const { base } = dayRange(input.date)
    const dateStr = base.toLocaleDateString('es-BO', { weekday: 'long', day: 'numeric', month: 'long' })
    const cursoLabel = `${GRADES[course.grade]} "${course.parallel}"`

    let count = 0
    let notifCount = 0

    for (const att of input.attendances) {
      await studentAttendanceRepository.upsertAttendance({
        studentId: att.studentId, courseId, teacherId: teacher.id, academicYearId: activeYear.id,
        date: base, status: att.status, note: att.note || null,
      })
      count++

      if (att.status === 'AUSENTE' || att.status === 'RETRASO') {
        const statusLabel = att.status === 'AUSENTE' ? 'ausente' : 'con retraso'
        const emoji = att.status === 'AUSENTE' ? '❌' : '⏰'
        const title = `${emoji} Inasistencia — ${cursoLabel}`
        const message = `Su hijo/a estuvo ${statusLabel} el ${dateStr} en el curso ${cursoLabel}. Maestro: ${teacher.lastName} ${teacher.firstName}.${att.note ? ` Observación: ${att.note}` : ''}`

        const parentLink = await studentAttendanceRepository.findTutorLink(att.studentId)
        if (parentLink?.parent) {
          await studentAttendanceRepository.createNotification({ title, message, sentById: teacher.userId, parentId: parentLink.parent.id })
          notifCount++
        }
      }
    }

    return {
      message: `Asistencia guardada: ${count} registros${notifCount > 0 ? ` · ${notifCount} notificación(es) enviada(s)` : ''}`,
      count, notifications: notifCount,
    }
  },

  async getMyCourses(userId: number | undefined) {
    const teacher = await studentAttendanceRepository.findTeacherByUserId(userId)
    if (!teacher) throw new HttpError(404, 'Maestro no encontrado')

    const assignments = await studentAttendanceRepository.findMyCourses(teacher.id)
    return assignments.map((a) => a.course)
  },

  async getStudentHistory(studentId: number, courseId?: number, month?: string) {
    const activeYear = await studentAttendanceRepository.findActiveAcademicYear()
    if (!activeYear) throw new HttpError(400, 'No hay gestión activa')

    let dateFilter: { gte: Date; lt: Date } | undefined
    if (month) {
      const [year, m] = month.split('-').map(Number)
      dateFilter = { gte: new Date(year, m - 1, 1), lt: new Date(year, m, 1) }
    }

    const attendances = await studentAttendanceRepository.findStudentHistory(studentId, activeYear.id, courseId, dateFilter)

    const summary = {
      total:     attendances.length,
      presentes: attendances.filter((a) => a.status === 'PRESENTE').length,
      ausentes:  attendances.filter((a) => a.status === 'AUSENTE').length,
      retrasos:  attendances.filter((a) => a.status === 'RETRASO').length,
      licencias: attendances.filter((a) => a.status === 'LICENCIA').length,
    }

    return { attendances, summary }
  },

  async closeAttendance(userId: number | undefined, courseId: number, input: CloseAttendanceInput) {
    const activeYear = await studentAttendanceRepository.findActiveAcademicYear()
    if (!activeYear) throw new HttpError(400, 'No hay gestión activa')

    const teacher = await studentAttendanceRepository.findTeacherByUserId(userId)
    if (!teacher) throw new HttpError(404, 'Maestro no encontrado')

    const course = await studentAttendanceRepository.findCourseById(courseId)
    if (!course) throw new HttpError(404, 'Curso no encontrado')

    const { base, next } = dayRange(input.date)
    const dateStr = base.toLocaleDateString('es-BO', { weekday: 'long', day: 'numeric', month: 'long' })
    const cursoLabel = `${GRADES[course.grade]} "${course.parallel}"`

    const assignments = await studentAttendanceRepository.findAssignmentsForCourse(courseId, activeYear.id)
    const existing = await studentAttendanceRepository.findAttendancesForCourseDate(courseId, activeYear.id, base, next)

    const registeredIds = new Set(existing.map((e) => e.studentId))
    const sinRegistro = assignments.filter((a) => !registeredIds.has(a.student.id))

    if (sinRegistro.length === 0) return { message: 'Todos los estudiantes ya tienen asistencia registrada', count: 0, notifications: 0 }

    let notifCount = 0
    for (const a of sinRegistro) {
      await studentAttendanceRepository.upsertAttendance({
        studentId: a.student.id, courseId, teacherId: teacher.id, academicYearId: activeYear.id,
        date: base, status: 'AUSENTE', note: 'Registrado automáticamente al cerrar asistencia',
      })

      const parentLink = await studentAttendanceRepository.findTutorLink(a.student.id)
      if (parentLink?.parent) {
        await studentAttendanceRepository.createNotification({
          title: `❌ Inasistencia — ${cursoLabel}`,
          message: `Su hijo/a estuvo ausente el ${dateStr} en el curso ${cursoLabel}. Maestro: ${teacher.lastName} ${teacher.firstName}.`,
          sentById: teacher.userId, parentId: parentLink.parent.id,
        })
        notifCount++
      }
    }

    return {
      message: `Asistencia cerrada: ${sinRegistro.length} estudiante(s) marcado(s) como ausente · ${notifCount} notificación(es) enviada(s)`,
      count: sinRegistro.length, notifications: notifCount,
    }
  },
}
