import { AuthRequest } from '../middlewares/auth.middleware'
import { HttpError } from './http-error'
import { Role } from '../config/permissions'
import prisma from '../lib/prisma'
import { studentRepository } from '../repositories/student.repository'
import { parentRepository } from '../repositories/parent.repository'

// Rutas protegidas solo con un permiso "own" (grade:view:own, course:view:own, charge:view:own)
// reciben el id del recurso por parámetro de ruta, que no es confiable por sí solo — estas
// funciones verifican que el recurso pedido realmente pertenezca al usuario autenticado
// (o a uno de sus hijos, si es un PARENT) antes de dejar pasar la petición.

export async function assertOwnStudent(req: AuthRequest, studentId: number): Promise<void> {
  if (req.userRole === Role.STUDENT || req.userRole === Role.STUDENT_GOV) {
    const student = await studentRepository.findByUserId(req.userId)
    if (student?.id === studentId) return
  }
  if (req.userRole === Role.PARENT) {
    const parent = await parentRepository.findRawByUserId(req.userId)
    if (parent) {
      const link = await prisma.parentStudent.findFirst({ where: { parentId: parent.id, studentId } })
      if (link) return
    }
  }
  throw new HttpError(403, 'No tienes acceso a este estudiante')
}

async function findMyTutorCourseId(userId: number | undefined): Promise<number | null> {
  const teacher = await prisma.teacher.findFirst({ where: { OR: [{ userId }, { tutorUserId: userId }] }, select: { id: true } })
  if (!teacher) return null
  const tutorCourse = await prisma.courseTutor.findFirst({ where: { teacherId: teacher.id }, select: { courseId: true } })
  return tutorCourse?.courseId ?? null
}

export async function assertOwnCourse(req: AuthRequest, courseId: number): Promise<void> {
  if (req.userRole === Role.STUDENT || req.userRole === Role.STUDENT_GOV) {
    const student = await studentRepository.findByUserId(req.userId)
    if (student) {
      const assignment = await prisma.studentAcademicAssignment.findFirst({ where: { studentId: student.id, courseId } })
      if (assignment) return
    }
  }
  if (req.userRole === Role.PARENT) {
    const parent = await parentRepository.findRawByUserId(req.userId)
    if (parent) {
      const assignment = await prisma.studentAcademicAssignment.findFirst({
        where: { courseId, student: { parents: { some: { parentId: parent.id } } } },
      })
      if (assignment) return
    }
  }
  if (req.userRole === Role.TEACHER_TUTOR) {
    const myCourseId = await findMyTutorCourseId(req.userId)
    if (myCourseId === courseId) return
  }
  throw new HttpError(403, 'No tienes acceso a este curso')
}

export async function assertOwnParentAccount(req: AuthRequest, parentId: number): Promise<void> {
  if (req.userRole === Role.PARENT) {
    const parent = await parentRepository.findRawByUserId(req.userId)
    if (parent?.id === parentId) return
  }
  if (req.userRole === Role.TEACHER_TUTOR) {
    const myCourseId = await findMyTutorCourseId(req.userId)
    if (myCourseId != null) {
      const link = await prisma.parentStudent.findFirst({
        where: {
          parentId,
          isTutor: true,
          student: { assignments: { some: { courseId: myCourseId } } },
        },
      })
      if (link) return
    }
  }
  throw new HttpError(403, 'No tienes acceso a este estado de cuenta')
}
