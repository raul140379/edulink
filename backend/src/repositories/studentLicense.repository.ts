import prisma from '../lib/prisma'
import { getTenantContext } from '../lib/tenant-context'

export const studentLicenseRepository = {
  create(data: { studentId: number; startDate: Date; endDate: Date; reason: string | null; createdById: number }) {
    return prisma.studentLicense.create({
      data: {
        studentId: data.studentId, startDate: data.startDate, endDate: data.endDate,
        reason: data.reason, createdById: data.createdById,
        schoolId: getTenantContext()?.schoolId ?? 0,
      },
    })
  },

  findStudentById(id: number) {
    return prisma.student.findUnique({ where: { id }, select: { id: true, firstName: true, lastName: true } })
  },

  // Historial completo de licencias de UN estudiante (activas, vencidas y
  // canceladas) — para la pantalla nueva en admin/estudiantes/[id]. A
  // diferencia de findActiveLicensesForStudents/findLicensesOverlappingRange
  // (que tapan la vista de asistencia), esta trae TODO, sin filtrar por
  // cancelledAt ni por fecha — es la pantalla de gestión, no un overlay.
  findAllForStudent(studentId: number) {
    // El creador/anulador siempre es DIRECTOR/SECRETARY/REGENTE — DIRECTOR
    // resuelve su nombre vía User.schoolDirector (modelo Director, no
    // Staff), SECRETARY/REGENTE vía User.staff. Se traen ambos y el
    // servicio elige cuál está presente (nunca los dos a la vez).
    const nameSelect = {
      select: {
        id: true, email: true,
        staff: { select: { firstName: true, lastName: true } },
        schoolDirector: { select: { firstName: true, lastName: true } },
      },
    }
    return prisma.studentLicense.findMany({
      where: { studentId },
      include: { createdBy: nameSelect, cancelledBy: nameSelect },
      orderBy: { startDate: 'desc' },
    })
  },

  findById(id: number) {
    return prisma.studentLicense.findUnique({ where: { id } })
  },

  cancel(id: number, cancelledById: number, cancelledNote: string) {
    return prisma.studentLicense.update({
      where: { id },
      data: { cancelledAt: new Date(), cancelledById, cancelledNote },
    })
  },
}
