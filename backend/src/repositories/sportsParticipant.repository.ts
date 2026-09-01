import prisma from '../lib/prisma'

export const sportsParticipantRepository = {
  findActiveAcademicYear() {
    return prisma.academicYear.findFirst({ where: { isActive: true }, select: { id: true, year: true } })
  },

  // skipDuplicates: re-agregar un estudiante que ya está en esa disciplina
  // (mismo studentId+discipline+academicYearId) no rompe el lote entero —
  // simplemente no duplica esa fila, el resto del lote sí se crea.
  createMany(rows: { studentId: number; discipline: string; modality: string | null; academicYearId: number; schoolId: number; createdById: number | undefined }[]) {
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
            assignments: {
              where: { academicYear: { isActive: true } },
              include: { course: true },
              take: 1,
            },
          },
        },
      },
      orderBy: [{ discipline: 'asc' }, { student: { lastName: 'asc' } }],
    })
  },

  findById(id: number) {
    return prisma.sportsParticipant.findUnique({ where: { id } })
  },

  delete(id: number) {
    return prisma.sportsParticipant.delete({ where: { id } })
  },
}
