import { Prisma } from '@prisma/client'
import { teacherSpecialtyRepository } from '../repositories/teacherSpecialty.repository'
import { teacherRepository } from '../repositories/teacher.repository'
import { subjectRepository } from '../repositories/subject.repository'
import { HttpError } from '../utils/http-error'
import { AddTeacherSpecialtyInput } from '../schemas/teacherSpecialty.schema'

function mapPrismaUniqueError(error: unknown, message: string): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    throw new HttpError(409, message)
  }
  throw error
}

export const teacherSpecialtyService = {
  getTeacherSpecialties(teacherId: number) {
    return teacherSpecialtyRepository.findByTeacher(teacherId)
  },

  async addTeacherSpecialty(teacherId: number, input: AddTeacherSpecialtyInput) {
    // findRaw/findRaw are already school-scoped by the tenant-scoping extension,
    // so this also guarantees the teacher and subject belong to the same school.
    const teacher = await teacherRepository.findRaw(teacherId)
    if (!teacher) throw new HttpError(404, 'Maestro no encontrado')
    const subject = await subjectRepository.findRaw(input.subjectId)
    if (!subject) throw new HttpError(404, 'Materia no encontrada')

    try {
      return await teacherSpecialtyRepository.create(teacherId, input.subjectId)
    } catch (error) {
      mapPrismaUniqueError(error, 'El maestro ya tiene esa especialidad')
    }
  },

  async removeTeacherSpecialty(specialtyId: number) {
    await teacherSpecialtyRepository.delete(specialtyId)
  },
}
