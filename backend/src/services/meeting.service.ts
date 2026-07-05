import { meetingRepository } from '../repositories/meeting.repository'
import { HttpError } from '../utils/http-error'
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
    return meetingRepository.updateMeeting(id, { title: input.title, date: new Date(input.date) })
  },

  async updateAttendance(meetingId: number, input: UpdateAttendanceInput) {
    await Promise.all(
      input.attendances.map((a) => meetingRepository.updateAttendance(meetingId, a.parentId, a.present, a.note))
    )
  },

  async chargeAbsences(meetingId: number, input: ChargeAbsencesInput) {
    const meeting = await meetingRepository.findMeetingWithAbsentAttendances(meetingId)
    if (!meeting) throw new HttpError(404, 'Reunión no encontrada')

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
    await meetingRepository.deleteMeetingAttendances(id)
    await meetingRepository.deleteMeeting(id)
  },
}
