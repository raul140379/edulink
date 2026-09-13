import prisma from '../lib/prisma'
import { getTenantContext } from '../lib/tenant-context'

const actorNameSelect = {
  select: {
    id: true, email: true,
    staff: { select: { firstName: true, lastName: true } },
    schoolDirector: { select: { firstName: true, lastName: true } },
  },
}

const requestInclude = {
  student: { select: { id: true, firstName: true, lastName: true } },
  requestedBy: { select: { id: true, firstName: true, lastName: true, phone: true } },
  reviewedBy: actorNameSelect,
}

export const studentLicenseRequestRepository = {
  findParentByUserId(userId: number | undefined) {
    return prisma.parent.findUnique({ where: { userId } })
  },

  // Confirma que el padre logueado esté realmente vinculado al estudiante —
  // "cualquier padre vinculado" (no solo isTutor), mismo criterio amplio que
  // /api/parents/my-students, confirmado con Raul.
  findParentStudentLink(parentId: number, studentId: number) {
    return prisma.parentStudent.findFirst({ where: { parentId, studentId } })
  },

  findStudentById(id: number) {
    return prisma.student.findUnique({ where: { id }, select: { id: true, firstName: true, lastName: true } })
  },

  create(data: { studentId: number; requestedById: number; startDate: Date; endDate: Date; reason: string }) {
    return prisma.studentLicenseRequest.create({
      data: { ...data, schoolId: getTenantContext()?.schoolId ?? 0 },
      include: requestInclude,
    })
  },

  findById(id: number) {
    return prisma.studentLicenseRequest.findUnique({ where: { id }, include: requestInclude })
  },

  // "Mis solicitudes" (padre-app) — todas las del padre logueado, sin
  // importar el estado.
  findAllForParent(parentId: number) {
    return prisma.studentLicenseRequest.findMany({
      where: { requestedById: parentId },
      include: requestInclude,
      orderBy: { createdAt: 'desc' },
    })
  },

  // Pantalla centralizada del Director — todas, más recientes primero
  // (pendientes se distinguen por status en el frontend, no hace falta una
  // consulta separada).
  findAll() {
    return prisma.studentLicenseRequest.findMany({
      include: requestInclude,
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    })
  },

  countPendingForStudent(studentId: number) {
    return prisma.studentLicenseRequest.count({ where: { studentId, status: 'PENDIENTE' } })
  },

  approve(id: number, reviewedById: number, note: string | undefined, licenseId: number) {
    return prisma.studentLicenseRequest.update({
      where: { id },
      data: { status: 'APROBADA', reviewedById, reviewedAt: new Date(), reviewNote: note || null, licenseId },
      include: requestInclude,
    })
  },

  reject(id: number, reviewedById: number, note: string) {
    return prisma.studentLicenseRequest.update({
      where: { id },
      data: { status: 'RECHAZADA', reviewedById, reviewedAt: new Date(), reviewNote: note },
      include: requestInclude,
    })
  },
}
