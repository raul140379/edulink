import { Prisma } from '@prisma/client'
import { classroomRepository } from '../repositories/classroom.repository'
import { HttpError } from '../utils/http-error'
import { CreateClassroomInput, UpdateClassroomInput, AssignClassroomInput } from '../schemas/classroom.schema'

function mapPrismaUniqueError(error: unknown, message: string): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    throw new HttpError(400, message)
  }
  throw error
}

export const classroomService = {
  getClassrooms() {
    return classroomRepository.findAllActive()
  },

  async createClassroom(input: CreateClassroomInput) {
    try {
      return await classroomRepository.create(input.name, input.capacity ?? null)
    } catch (error) {
      mapPrismaUniqueError(error, 'Ya existe un aula con ese nombre')
    }
  },

  async updateClassroom(id: number, input: UpdateClassroomInput) {
    try {
      return await classroomRepository.update(id, input)
    } catch (error) {
      mapPrismaUniqueError(error, 'Ya existe un aula con ese nombre')
    }
  },

  async deleteClassroom(id: number) {
    await classroomRepository.deactivate(id)
  },

  async assignClassroomToPeriod(scheduleId: number, input: AssignClassroomInput) {
    return classroomRepository.assignToPeriod(scheduleId, input.classroomId ?? null)
  },

  async assignClassroomToCourse(courseId: number, input: AssignClassroomInput) {
    const activeYear = await classroomRepository.findActiveAcademicYear()
    if (!activeYear) throw new HttpError(400, 'No hay gestión activa')

    const updated = await classroomRepository.assignToCourse(courseId, activeYear.id, input.classroomId ?? null)
    return updated.count
  },
}
