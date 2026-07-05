import { Prisma } from '@prisma/client'
import { subjectRepository } from '../repositories/subject.repository'
import { HttpError } from '../utils/http-error'
import {
  CreateSubjectInput, UpdateSubjectInput, AssignSubjectInput,
  AssignSubjectBulkInput, AddGradeConfigInput,
} from '../schemas/subject.schema'

const CAMPO_ORDER = [
  'VIDA_TIERRA_TERRITORIO',
  'COMUNIDAD_SOCIEDAD',
  'COSMOS_PENSAMIENTO',
  'CIENCIA_TECNOLOGIA_PRODUCCION',
]

function mapPrismaUniqueError(error: unknown, message: string): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    throw new HttpError(409, message)
  }
  throw error
}

export const subjectService = {
  listSubjects(level?: string, grade?: string) {
    const where: Prisma.SubjectWhereInput = {
      ...(level ? { level: level as any } : {}),
      ...(grade ? { gradeConfigs: { some: { grade: grade as any } } } : {}),
    }
    return subjectRepository.findMany(where, grade)
  },

  async getCoursePlan(courseId: number) {
    const course = await subjectRepository.findCourseWithAssignments(courseId)
    if (!course) throw new HttpError(404, 'Curso no encontrado')

    const gradeConfigs = await subjectRepository.findGradeConfigsForCourse(course.grade, course.educationType)

    const plan = gradeConfigs.map((gc) => {
      const assigned = course.teacherSubjects.find((ts) => ts.subjectId === gc.subjectId)
      return {
        gradeConfigId: gc.id, subjectId: gc.subjectId, subject: gc.subject,
        hoursPerWeek: gc.hoursPerWeek,
        teacher: assigned ? assigned.teacher : null,
        assignmentId: assigned ? assigned.id : null,
      }
    })

    const grouped: Record<string, typeof plan> = {}
    for (const item of plan) {
      const campo = item.subject.campo || 'SIN_CAMPO'
      if (!grouped[campo]) grouped[campo] = []
      grouped[campo].push(item)
    }

    const totalHours    = plan.reduce((s, p) => s + p.hoursPerWeek, 0)
    const assignedCount = plan.filter((p) => p.teacher !== null).length

    return {
      course: { id: course.id, grade: course.grade, parallel: course.parallel, level: course.level, educationType: course.educationType },
      totalHours, totalSubjects: plan.length, assignedCount,
      pendingCount: plan.length - assignedCount,
      grouped, campoOrder: CAMPO_ORDER,
    }
  },

  async createSubject(input: CreateSubjectInput) {
    try {
      return await subjectRepository.create({
        name: input.name, code: input.code || null, level: input.level, hoursPerWeek: input.hoursPerWeek || 4,
      })
    } catch (error) {
      mapPrismaUniqueError(error, 'Ya existe una materia con ese nombre en ese nivel')
    }
  },

  updateSubject(id: number, input: UpdateSubjectInput) {
    const { name, code, level, hoursPerWeek } = input
    return subjectRepository.update(id, {
      ...(name         !== undefined ? { name } : {}),
      ...(code         !== undefined ? { code: code || null } : {}),
      ...(level        !== undefined ? { level } : {}),
      ...(hoursPerWeek !== undefined ? { hoursPerWeek } : {}),
    })
  },

  async deleteSubject(id: number) {
    const subject = await subjectRepository.findWithAssignmentCount(id)
    if (!subject) throw new HttpError(404, 'Materia no encontrada')
    if (subject._count.teacherSubjects > 0) {
      throw new HttpError(400, `No se puede eliminar: tiene ${subject._count.teacherSubjects} asignación(es)`)
    }
    await subjectRepository.delete(id)
  },

  async assignSubjectToCourse(input: AssignSubjectInput) {
    const course = await subjectRepository.findCourseById(input.courseId)
    if (!course) throw new HttpError(404, 'Curso no encontrado')

    const gradeConfig = await subjectRepository.findGradeConfig(input.subjectId, course.grade, course.educationType)
    if (!gradeConfig) throw new HttpError(400, 'Esta materia no pertenece al plan de estudios de este grado')

    const existing = await subjectRepository.findAssignment(input.subjectId, input.courseId)
    if (existing) {
      if (existing.teacherId === input.teacherId) {
        throw new HttpError(409, 'Este maestro ya está asignado a esa materia en ese curso')
      }
      const updated = await subjectRepository.updateAssignmentTeacher(existing.id, input.teacherId)
      return { assignment: updated, updated: true }
    }

    try {
      const assignment = await subjectRepository.createAssignment(input.subjectId, input.teacherId, input.courseId)
      return { assignment, updated: false }
    } catch (error) {
      mapPrismaUniqueError(error, 'Esta materia ya está asignada en ese curso')
    }
  },

  removeSubjectFromCourse(id: number) {
    return subjectRepository.deleteAssignment(id)
  },

  async assignSubjectToMultipleCourses(input: AssignSubjectBulkInput) {
    const assigned: any[] = []
    const skipped: { courseId: number; reason: string }[] = []

    for (const courseId of input.courseIds) {
      const course = await subjectRepository.findCourseById(courseId)
      if (!course) { skipped.push({ courseId, reason: 'Curso no encontrado' }); continue }

      const gradeConfig = await subjectRepository.findGradeConfig(input.subjectId, course.grade, course.educationType)
      if (!gradeConfig) { skipped.push({ courseId, reason: 'No pertenece al plan de este grado' }); continue }

      const existing = await subjectRepository.findAssignment(input.subjectId, courseId)
      if (existing) {
        skipped.push({ courseId, reason: existing.teacherId === input.teacherId ? 'Ya estaba asignado a este maestro' : 'Ya asignado a otro maestro' })
        continue
      }

      const created = await subjectRepository.createAssignmentLean(input.subjectId, input.teacherId, courseId)
      assigned.push(created)
    }

    return { assigned, skipped }
  },

  getOccupiedCourses(subjectId: number) {
    return subjectRepository.findOccupiedCourses(subjectId)
  },

  async addToGradePlan(input: AddGradeConfigInput) {
    const existing = await subjectRepository.findGradeConfig(input.subjectId, input.grade, input.educationType)
    if (existing) throw new HttpError(409, 'Esta materia ya está en el plan de este grado')

    try {
      return await subjectRepository.createGradeConfig(input.subjectId, input.grade, input.educationType, input.hoursPerWeek || 4)
    } catch (error) {
      mapPrismaUniqueError(error, 'Esta materia ya está en el plan de este grado')
    }
  },

  async removeFromGradePlan(id: number) {
    const config = await subjectRepository.findGradeConfigById(id)
    if (!config) throw new HttpError(404, 'Configuración no encontrada')

    await subjectRepository.deleteAssignmentsForGrade(config.subjectId, config.grade, config.educationType)
    await subjectRepository.deleteGradeConfig(id)
  },

  updateGradeConfigHours(id: number, hoursPerWeek: number) {
    return subjectRepository.updateGradeConfigHours(id, hoursPerWeek)
  },

  getGradeConfigs(subjectId: number) {
    return subjectRepository.findGradeConfigsBySubject(subjectId)
  },
}
