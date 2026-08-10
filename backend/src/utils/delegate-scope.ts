import { Role } from '@prisma/client'
import { delegateRepository } from '../repositories/delegate.repository'
import { getTenantContext } from '../lib/tenant-context'
import { HttpError } from './http-error'

// Candado de alcance para DELEGATE — un Delegado solo puede actuar sobre
// tutores de estudiantes de SU PROPIO curso. No hace nada para otros roles
// (ctx?.role !== DELEGATE). Compartido entre parent.service.ts y
// treasury.service.ts (y meeting.service.ts a futuro) para no repetir la
// resolución de curso+gestión activa en cada endpoint.
export async function assertDelegateOwnsParent(studentIds: number[], actionErrorMessage: string) {
  const ctx = getTenantContext()
  if (ctx?.role !== Role.DELEGATE) return

  const delegateParent = await delegateRepository.findParentByDelegateUserId(ctx.userId)
  const myCourseId = delegateParent?.delegateCourse?.id
  if (!myCourseId) throw new HttpError(400, 'No tenés un curso asignado como delegado')

  const activeYear = await delegateRepository.findActiveAcademicYear()
  if (!activeYear) throw new HttpError(404, 'No hay gestión académica activa')

  const inMyCourse = studentIds.length > 0 && await delegateRepository.findAssignmentInCourse(studentIds, myCourseId, activeYear.id)
  if (!inMyCourse) throw new HttpError(403, actionErrorMessage)
}

// Resuelve el curso propio de un DELEGATE, o `undefined` para cualquier otro
// rol (sin restricción). Usado por las lecturas agregadas de Tesorería
// (summary/by-course/verification-by-course/parents) para acotar el
// resultado al curso del delegado en vez de traer todo el colegio.
export async function resolveDelegateCourseId(): Promise<number | undefined> {
  const ctx = getTenantContext()
  if (ctx?.role !== Role.DELEGATE) return undefined

  const delegateParent = await delegateRepository.findParentByDelegateUserId(ctx.userId)
  const courseId = delegateParent?.delegateCourse?.id
  if (!courseId) throw new HttpError(400, 'No tenés un curso asignado como delegado')
  return courseId
}

// Candado de alcance para DELEGATE sobre un recurso que ya trae su propio
// `courseId` directo (ej. Meeting) — más simple que assertDelegateOwnsParent
// porque no hace falta resolver estudiantes/gestión, solo comparar cursos.
export async function assertDelegateOwnsCourse(courseId: number, actionErrorMessage: string) {
  const myCourseId = await resolveDelegateCourseId()
  if (myCourseId !== undefined && myCourseId !== courseId) throw new HttpError(403, actionErrorMessage)
}
