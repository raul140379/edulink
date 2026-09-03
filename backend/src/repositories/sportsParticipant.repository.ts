import { SportsCategory, SportsRole } from '@prisma/client'
import prisma from '../lib/prisma'

export const sportsParticipantRepository = {
  findActiveAcademicYear() {
    return prisma.academicYear.findFirst({ where: { isActive: true }, select: { id: true, year: true } })
  },

  // skipDuplicates: re-agregar un estudiante que ya está en esa disciplina
  // (mismo studentId+discipline+academicYearId) no rompe el lote entero —
  // simplemente no duplica esa fila, el resto del lote sí se crea.
  createMany(rows: {
    studentId: number; discipline: string; modality: string | null
    categoria: SportsCategory; rolFuncion: SportsRole | null; contactPhone: string | null
    academicYearId: number; schoolId: number; createdById: number | undefined
  }[]) {
    return prisma.sportsParticipant.createMany({ data: rows, skipDuplicates: true })
  },

  findMany(academicYearId: number) {
    return prisma.sportsParticipant.findMany({
      where: { academicYearId },
      include: {
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            ci: true,
            rude: true,
            birthDate: true,
            gender: true,
            assignments: {
              where: { academicYear: { isActive: true } },
              include: { course: true },
              take: 1,
            },
          },
        },
      },
      // Solo por disciplina acá — el orden por género (mujeres primero) se
      // hace en el servicio, no vía Prisma: `orderBy` sobre un campo enum
      // ordena por la posición de DECLARACIÓN del enum en el schema (no
      // alfabéticamente), así que un 'asc' aparentaba estar mal (MASCULINO
      // salía primero por estar declarado antes que FEMENINO) — confirmado
      // real contra la API local, no solo teórico.
      orderBy: [{ discipline: 'asc' }],
    })
  },

  findById(id: number) {
    return prisma.sportsParticipant.findUnique({ where: { id } })
  },

  delete(id: number) {
    return prisma.sportsParticipant.delete({ where: { id } })
  },
}
