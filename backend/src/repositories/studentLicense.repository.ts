import prisma from '../lib/prisma'
import { getTenantContext } from '../lib/tenant-context'

// Mismo truco que parent.repository.ts para tipar el cliente transaccional
// sin importarlo directo (no es asignable al tipo generico de @prisma/client).
type TxClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]

export const studentLicenseRepository = {
  // `client` opcional: por defecto el prisma de siempre (alta directa de
  // Dirección/Secretaría/Regente, sin transacción); studentLicenseRequest.service.ts
  // pasa el `tx` de su propia transacción al aprobar una solicitud, para que
  // la creación de la licencia y la actualización de la solicitud sean
  // atómicas (si una falla, ninguna queda escrita a medias).
  create(data: { studentId: number; startDate: Date; endDate: Date; reason: string | null; createdById: number }, client: TxClient | typeof prisma = prisma) {
    return client.studentLicense.create({
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
