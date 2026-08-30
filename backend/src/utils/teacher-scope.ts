import { Role } from '@prisma/client'
import { studentRepository } from '../repositories/student.repository'
import { getTenantContext } from '../lib/tenant-context'
import { HttpError } from './http-error'

// Candado de alcance para TEACHER/TEACHER_TUTOR — un maestro solo puede
// notificar a padres con al menos un hijo matriculado (gestión activa) en
// alguno de sus propios cursos (donde da clase o es tutor). No hace nada
// para otros roles. Mismo patrón que assertDelegateOwnsParent
// (delegate-scope.ts), dedupe parentIds antes de comparar para no fallar
// por duplicados en el lote.
export async function assertTeacherOwnsParent(parentIds: number[], actionErrorMessage: string) {
  const ctx = getTenantContext()
  if (ctx?.role !== Role.TEACHER && ctx?.role !== Role.TEACHER_TUTOR) return

  const courseIds = await studentRepository.findTeacherCourseIds(ctx.userId)
  if (courseIds.length === 0) throw new HttpError(403, actionErrorMessage)

  const activeYear = await studentRepository.findActiveAcademicYear()
  if (!activeYear) throw new HttpError(404, 'No hay gestión académica activa')

  const uniqueParentIds = Array.from(new Set(parentIds))
  const owned = await studentRepository.countParentsWithChildInCourses(uniqueParentIds, courseIds, activeYear.id)
  if (owned !== uniqueParentIds.length) throw new HttpError(403, actionErrorMessage)
}
