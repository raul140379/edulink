import { Role } from '@prisma/client'
import { meetingRepository } from '../repositories/meeting.repository'
import { juntaService } from './junta.service'
import { HttpError } from '../utils/http-error'
import { getTenantContext } from '../lib/tenant-context'
import { assertDelegateOwnsCourse } from '../utils/delegate-scope'
import {
  CreateMeetingInput, CreateMeetingAsTeacherInput, UpdateMeetingInput, UpdateAttendanceInput, ChargeAbsencesInput,
} from '../schemas/meeting.schema'

function collectTutorIds(assignments: { student: { parents: { parent: { id: number } }[] } }[]) {
  const tutorIds = new Set<number>()
  for (const a of assignments) {
    for (const ps of a.student.parents) tutorIds.add(ps.parent.id)
  }
  return Array.from(tutorIds)
}

// Gestionar reuniones de un curso arbitrario (crear/tomar asistencia/multar/
// eliminar) es exclusivo del Presidente cuando quien actúa es Junta Escolar —
// igual candado que convocatoria.service.ts. No afecta a Profesor/Profesor
// Tutor, que gestionan su propio curso sin este candado — DELEGATE tiene su
// propio candado de curso (assertDelegateOwnsCourse), aplicado por separado
// en cada método de abajo que recibe un :id de reunión arbitrario.
async function assertCanManage() {
  const ctx = getTenantContext()
  if (ctx?.role === Role.JUNTA_ESCOLAR) await juntaService.assertIsPresidente(ctx.userId)
}

export const meetingService = {
  async getMyMeetings(userId: number | undefined) {
    const parent = await meetingRepository.findParentByUserId(userId)
    if (!parent || !parent.delegateCourse) throw new HttpError(404, 'No tienes un curso asignado como delegado')
    return meetingRepository.findMeetingsByCourse(parent.delegateCourse.id)
  },

  async createMeeting(userId: number | undefined, input: CreateMeetingInput) {
    const parent = await meetingRepository.findParentWithDelegateCourseAssignments(userId)
    if (!parent || !parent.delegateCourse) throw new HttpError(404, 'No tienes un curso asignado como delegado')

    const parentIds = collectTutorIds(parent.delegateCourse.assignments)
    return meetingRepository.createMeeting({
      title: input.title, date: new Date(input.date), courseId: parent.delegateCourse.id, createdById: userId!, parentIds,
    })
  },

  async getMyMeetingsAsTutor(userId: number | undefined) {
    const teacher = await meetingRepository.findTeacherTutorByUserId(userId)
    if (!teacher || !teacher.tutorCourse) throw new HttpError(404, 'No tienes un curso asignado como tutor')
    return meetingRepository.findMeetingsByCourse(teacher.tutorCourse.courseId)
  },

  async createMeetingAsTutor(userId: number | undefined, input: CreateMeetingInput) {
    const teacher = await meetingRepository.findTeacherTutorWithCourseAssignments(userId)
    if (!teacher || !teacher.tutorCourse) throw new HttpError(404, 'No tienes un curso asignado como tutor')

    const parentIds = collectTutorIds(teacher.tutorCourse.course.assignments)
    return meetingRepository.createMeeting({
      title: input.title, date: new Date(input.date), courseId: teacher.tutorCourse.courseId, createdById: userId!, parentIds,
    })
  },

  async createMeetingAsTeacher(userId: number | undefined, input: CreateMeetingAsTeacherInput) {
    await assertCanManage()
    const assignments = await meetingRepository.findAssignmentsForCourse(input.courseId)
    const parentIds = collectTutorIds(assignments)
    return meetingRepository.createMeeting({
      title: input.title, date: new Date(input.date), courseId: input.courseId, createdById: userId!, parentIds,
    })
  },

  getMeetingsByCourse(courseId: number) {
    return meetingRepository.findMeetingsByCourse(courseId)
  },

  async updateMeeting(id: number, input: UpdateMeetingInput) {
    await assertCanManage()
    const meeting = await meetingRepository.findById(id)
    if (!meeting) throw new HttpError(404, 'Reunión no encontrada')
    await assertDelegateOwnsCourse(meeting.courseId, 'Solo podés editar reuniones de tu propio curso')

    return meetingRepository.updateMeeting(id, { title: input.title, date: new Date(input.date) })
  },

  async updateAttendance(meetingId: number, input: UpdateAttendanceInput) {
    await assertCanManage()
    const meeting = await meetingRepository.findById(meetingId)
    if (!meeting) throw new HttpError(404, 'Reunión no encontrada')
    await assertDelegateOwnsCourse(meeting.courseId, 'Solo podés tomar asistencia de reuniones de tu propio curso')

    await Promise.all(
      input.attendances.map((a) => meetingRepository.updateAttendance(meetingId, a.parentId, a.present, a.note))
    )
  },

  async chargeAbsences(meetingId: number, input: ChargeAbsencesInput) {
    await assertCanManage()
    const meeting = await meetingRepository.findMeetingWithAbsentAttendances(meetingId)
    if (!meeting) throw new HttpError(404, 'Reunión no encontrada')
    await assertDelegateOwnsCourse(meeting.courseId, 'Solo podés multar ausentes de reuniones de tu propio curso')

    const absentes = meeting.attendances
    if (absentes.length === 0) return { message: 'No hay ausentes en esta reunión', charged: 0 }

    await meetingRepository.createCharges(
      absentes.map((a) => ({
        title: `Multa reunión: ${meeting.title}`,
        description: `Ausente en reunión del ${new Date(meeting.date).toLocaleDateString('es-BO')}`,
        amount: input.amount,
        parentId: a.parentId,
        academicYearId: input.academicYearId,
      }))
    )

    return { message: `Multa creada para ${absentes.length} ausentes`, charged: absentes.length }
  },

  async deleteMeeting(id: number) {
    await assertCanManage()
    const meeting = await meetingRepository.findById(id)
    if (!meeting) throw new HttpError(404, 'Reunión no encontrada')
    await assertDelegateOwnsCourse(meeting.courseId, 'Solo podés eliminar reuniones de tu propio curso')

    await meetingRepository.deleteMeetingAttendances(id)
    await meetingRepository.deleteMeeting(id)
  },
}
