import bcrypt from 'bcryptjs'
import { delegateRepository } from '../repositories/delegate.repository'
import { HttpError } from '../utils/http-error'
import { AssignDelegateInput } from '../schemas/delegate.schema'

const GRADE_MAP: Record<string, string> = {
  PRIMERO: '1', SEGUNDO: '2', TERCERO: '3', CUARTO: '4', QUINTO: '5', SEXTO: '6',
}

export const delegateService = {
  getDelegates() {
    return delegateRepository.findAllCoursesWithDelegateInfo()
  },

  async getEligibleParents(courseId: number) {
    const activeYear = await delegateRepository.findActiveAcademicYear()
    if (!activeYear) throw new HttpError(404, 'No hay gestión académica activa')

    const assignments = await delegateRepository.findAssignmentsWithTutorParents(courseId, activeYear.id)

    const parentsMap = new Map<number, any>()
    for (const assignment of assignments) {
      for (const ps of assignment.student.parents) {
        if (ps.isTutor && !parentsMap.has(ps.parent.id)) {
          parentsMap.set(ps.parent.id, {
            ...ps.parent,
            relationType: ps.relationType,
            studentName: `${assignment.student.lastName} ${assignment.student.firstName}`,
          })
        }
      }
    }

    return Array.from(parentsMap.values())
  },

  async assignDelegate(courseId: number, input: AssignDelegateInput) {
    const course = await delegateRepository.findCourseById(courseId)
    if (!course) throw new HttpError(404, 'Curso no encontrado')

    const parent = await delegateRepository.findParentById(input.parentId)
    if (!parent) throw new HttpError(404, 'Padre no encontrado')

    const activeYear = await delegateRepository.findActiveAcademicYear()
    if (!activeYear) throw new HttpError(404, 'No hay gestión académica activa')

    const hasStudentInCourse = await delegateRepository.findStudentInCourseForParent(courseId, activeYear.id, input.parentId)
    if (!hasStudentInCourse) throw new HttpError(400, 'El padre no tiene estudiantes en este curso')

    if (parent.delegateUserId) throw new HttpError(409, 'Este padre ya tiene un usuario delegado creado')

    const gradeNum = GRADE_MAP[course.grade] || course.grade.toLowerCase()
    const parallel = course.parallel.toLowerCase()
    let delegateEmail = `delegado.${gradeNum}${parallel}@nnuu.edu.bo`
    let counter = 2
    while (await delegateRepository.findUserByEmail(delegateEmail)) {
      delegateEmail = `delegado.${gradeNum}${parallel}${counter}@nnuu.edu.bo`
      counter++
    }

    const rawPassword = `delegado${new Date().getFullYear()}`
    const hashed = await bcrypt.hash(rawPassword, 10)

    const delegateUser = await delegateRepository.createDelegateUser(delegateEmail, hashed)
    await delegateRepository.linkDelegateUserToParent(input.parentId, delegateUser.id)
    const updatedCourse = await delegateRepository.assignDelegateToCourse(courseId, input.parentId)

    return {
      message: `${parent.lastName} ${parent.firstName} asignado como delegado del curso`,
      course: updatedCourse,
      accessEmail: delegateEmail,
      defaultPassword: rawPassword,
      delegateName: `${parent.lastName} ${parent.firstName}`,
    }
  },

  async removeDelegate(courseId: number) {
    const course = await delegateRepository.findCourseWithDelegate(courseId)
    if (!course) throw new HttpError(404, 'Curso no encontrado')
    if (!course.delegateId) throw new HttpError(400, 'Este curso no tiene delegado asignado')

    if (course.delegate?.delegateUserId) {
      await delegateRepository.unlinkDelegateUser(course.delegate.id)
      await delegateRepository.deleteUser(course.delegate.delegateUserId)
    }

    await delegateRepository.removeDelegateFromCourse(courseId)
  },

  async getMyCourse(userId: number | undefined) {
    const parent = await delegateRepository.findParentByDelegateUserId(userId)
    if (!parent || !parent.delegateCourse) throw new HttpError(404, 'No tienes un curso asignado como delegado')

    const courseData = JSON.parse(JSON.stringify(parent.delegateCourse))

    return {
      ...courseData,
      tutor: courseData.tutor ?? null,
      delegate: { id: parent.id, firstName: parent.firstName, lastName: parent.lastName, phone: parent.phone, ci: parent.ci },
    }
  },
}
