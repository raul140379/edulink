import bcrypt from 'bcryptjs'
import { Prisma, Role } from '@prisma/client'
import { courseRepository } from '../repositories/course.repository'
import { userRepository } from '../repositories/user.repository'
import { HttpError } from '../utils/http-error'
import { CreateCourseInput, UpdateCourseInput, AssignTutorInput } from '../schemas/course.schema'
import { getTenantContext } from '../lib/tenant-context'
import { resolveEmailDomain } from '../utils/account-generator'

const BTH_GRADES = ['TERCERO', 'CUARTO', 'QUINTO', 'SEXTO']

const GRADE_MAP: Record<string, string> = {
  PRIMERO: '1', SEGUNDO: '2', TERCERO: '3', CUARTO: '4', QUINTO: '5', SEXTO: '6',
}

async function generateSequentialEmail(base: string): Promise<string> {
  const domain = await resolveEmailDomain()
  let email = `${base}${domain}`
  let counter = 2
  while (await userRepository.findByEmail(email)) {
    email = `${base}${counter}${domain}`
    counter++
  }
  return email
}

function validateBTH(level: string, grade: string, educationType: string) {
  if (educationType !== 'BTH') return
  if (level !== 'SECUNDARIA') throw new HttpError(400, 'El tipo BTH solo aplica en el nivel Secundaria')
  if (!BTH_GRADES.includes(grade)) throw new HttpError(400, 'El tipo BTH solo aplica desde 3° grado de Secundaria')
}

export const courseService = {
  listCourses(level?: string, shift?: string, educationType?: string) {
    const where: Prisma.CourseWhereInput = {
      ...(level ? { level: level as any } : {}),
      ...(shift ? { shift: shift as any } : {}),
      ...(educationType ? { educationType: educationType as any } : {}),
    }
    return courseRepository.findMany(where)
  },

  async getCourseById(id: number) {
    const course = await courseRepository.findById(id)
    if (!course) throw new HttpError(404, 'Curso no encontrado')
    return course
  },

  async getCourseStudents(id: number, year?: string) {
    let academicYear = year ? parseInt(year) : null
    if (!academicYear) {
      const active = await courseRepository.findActiveAcademicYear()
      if (active) academicYear = active.year
    }
    return courseRepository.findAssignments(id, academicYear)
  },

  async createCourse(input: CreateCourseInput) {
    const { level, grade, parallel, shift } = input
    const eduType = input.educationType || 'REGULAR'

    validateBTH(level, grade, eduType)

    const existing = await courseRepository.findExact(level, grade, parallel, eduType, shift)
    if (existing) throw new HttpError(409, 'Ya existe un curso con esas características en ese turno')

    if (eduType === 'BTH') {
      const regularSameTurn = await courseRepository.findConflicting(level, grade, parallel, 'REGULAR', shift)
      if (regularSameTurn) throw new HttpError(409, 'El curso BTH no puede estar en el mismo turno que el Regular del mismo grado y paralelo')
    }
    if (eduType === 'REGULAR') {
      const bthSameTurn = await courseRepository.findConflicting(level, grade, parallel, 'BTH', shift)
      if (bthSameTurn) throw new HttpError(409, 'El curso Regular no puede estar en el mismo turno que el BTH del mismo grado y paralelo')
    }

    return courseRepository.create({
      level, grade, parallel, educationType: eduType, shift,
      school: { connect: { id: getTenantContext()?.schoolId ?? 0 } },
    })
  },

  async updateCourse(id: number, input: UpdateCourseInput) {
    const existing = await courseRepository.findRaw(id)
    if (!existing) throw new HttpError(404, 'Curso no encontrado')

    const newLevel    = input.level         || existing.level
    const newGrade    = input.grade         || existing.grade
    const newParallel = input.parallel      || existing.parallel
    const newEduType  = input.educationType || existing.educationType
    const newShift    = input.shift         || existing.shift

    validateBTH(newLevel, newGrade, newEduType)

    const duplicate = await courseRepository.findConflicting(newLevel, newGrade, newParallel, newEduType, newShift, id)
    if (duplicate) throw new HttpError(409, 'Ya existe un curso con esas características')

    return courseRepository.update(id, {
      level: newLevel, grade: newGrade, parallel: newParallel,
      educationType: newEduType, shift: newShift,
      ...(input.shiftDirectorId !== undefined ? { shiftDirector: input.shiftDirectorId ? { connect: { id: input.shiftDirectorId } } : { disconnect: true } } : {}),
    })
  },

  async deleteCourse(id: number) {
    const count = await courseRepository.countAssignments(id)
    if (count > 0) throw new HttpError(400, `No se puede eliminar el curso porque tiene ${count} estudiante(s) inscrito(s)`)
    await courseRepository.delete(id)
  },

  async assignTutor(id: number, input: AssignTutorInput) {
    const course = await courseRepository.findRaw(id)
    if (!course) throw new HttpError(404, 'Curso no encontrado')

    const teacher = await courseRepository.findTeacherWithTutorCourse(input.teacherId)
    if (!teacher) throw new HttpError(404, 'Maestro no encontrado')

    if (teacher.tutorCourse && teacher.tutorCourse.courseId !== id) {
      throw new HttpError(400, 'Este maestro ya es tutor de otro curso')
    }

    await courseRepository.deleteTutorForCourse(id)
    await courseRepository.createTutor(id, input.teacherId)

    if (teacher.userId) await userRepository.update(teacher.userId, { role: Role.TEACHER })

    return `${teacher.lastName} ${teacher.firstName} asignado como tutor del curso`
  },

  async removeTutor(id: number) {
    const tutor = await courseRepository.findTutorByCourse(id)
    if (!tutor) throw new HttpError(400, 'Este curso no tiene maestro tutor asignado')
    await courseRepository.deleteTutorByCourse(id)
  },

  async createDelegateUser(id: number) {
    const course = await courseRepository.findWithDelegate(id)
    if (!course) throw new HttpError(404, 'Curso no encontrado')
    if (!course.delegate) throw new HttpError(400, 'Este curso no tiene delegado asignado')
    if (course.delegate.delegateUserId) throw new HttpError(409, 'Este delegado ya tiene usuario creado')

    const gradeNum = GRADE_MAP[course.grade] || course.grade.toLowerCase()
    const parallel = course.parallel.toLowerCase()
    const email = await generateSequentialEmail(`delegado.${gradeNum}${parallel}`)

    const rawPassword = `delegado${new Date().getFullYear()}`
    const hashed = await bcrypt.hash(rawPassword, 10)
    const user = await userRepository.create({ email, password: hashed, role: Role.DELEGATE })
    await courseRepository.linkDelegateUser(course.delegate.id, user.id)

    return {
      accessEmail: email, defaultPassword: rawPassword,
      delegateName: `${course.delegate.lastName} ${course.delegate.firstName}`,
    }
  },

  async resetDelegatePassword(id: number) {
    const course = await courseRepository.findWithDelegate(id)
    if (!course) throw new HttpError(404, 'Curso no encontrado')
    if (!course.delegate) throw new HttpError(400, 'Este curso no tiene delegado asignado')
    if (!course.delegate.delegateUserId) throw new HttpError(400, 'El delegado no tiene usuario creado aún')

    const rawPassword = `delegado${new Date().getFullYear()}`
    const hashed = await bcrypt.hash(rawPassword, 10)
    await userRepository.update(course.delegate.delegateUserId, { password: hashed })

    return { defaultPassword: rawPassword, delegateName: `${course.delegate.lastName} ${course.delegate.firstName}` }
  },

  async createTutorUser(id: number) {
    const course = await courseRepository.findWithTutorTeacher(id)
    if (!course) throw new HttpError(404, 'Curso no encontrado')
    if (!course.tutor) throw new HttpError(400, 'Este curso no tiene maestro tutor asignado')
    if (course.tutor.teacher.tutorUserId) throw new HttpError(409, 'Este maestro tutor ya tiene usuario creado')

    const gradeNum = GRADE_MAP[course.grade] || course.grade.toLowerCase()
    const parallel = course.parallel.toLowerCase()
    const email = await generateSequentialEmail(`tutor.${gradeNum}${parallel}`)

    const rawPassword = `tutor${gradeNum}${course.parallel.toUpperCase()}${new Date().getFullYear()}`
    const hashed = await bcrypt.hash(rawPassword, 10)
    const user = await userRepository.create({ email, password: hashed, role: Role.TEACHER_TUTOR })
    await courseRepository.linkTutorUser(course.tutor.teacher.id, user.id)

    return {
      accessEmail: email, defaultPassword: rawPassword,
      tutorName: `${course.tutor.teacher.lastName} ${course.tutor.teacher.firstName}`,
    }
  },

  async resetTutorPassword(id: number) {
    const course = await courseRepository.findWithTutorTeacher(id)
    if (!course) throw new HttpError(404, 'Curso no encontrado')
    if (!course.tutor) throw new HttpError(400, 'Este curso no tiene maestro tutor')
    if (!course.tutor.teacher.tutorUserId) throw new HttpError(400, 'El tutor no tiene usuario creado aún')

    const gradeNum = GRADE_MAP[course.grade] || course.grade.toLowerCase()
    const rawPassword = `tutor${gradeNum}${course.parallel.toUpperCase()}${new Date().getFullYear()}`
    const hashed = await bcrypt.hash(rawPassword, 10)
    await userRepository.update(course.tutor.teacher.tutorUserId, { password: hashed })

    return { defaultPassword: rawPassword, tutorName: `${course.tutor.teacher.lastName} ${course.tutor.teacher.firstName}` }
  },
}
