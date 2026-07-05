import { Prisma } from '@prisma/client'
import { teacherSpecialtyRepository } from '../repositories/teacherSpecialty.repository'
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
