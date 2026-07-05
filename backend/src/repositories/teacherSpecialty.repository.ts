import prisma from '../lib/prisma'

export const teacherSpecialtyRepository = {
  findByTeacher(teacherId: number) {
    return prisma.teacherSpecialty.findMany({
      where: { teacherId },
      include: { subject: { select: { id: true, name: true, campo: true, level: true } } },
      orderBy: { subject: { name: 'asc' } },
    })
  },

  create(teacherId: number, subjectId: number) {
    return prisma.teacherSpecialty.create({
      data: { teacherId, subjectId },
      include: { subject: { select: { id: true, name: true, campo: true } } },
    })
  },

  delete(id: number) {
    return prisma.teacherSpecialty.delete({ where: { id } })
  },
}
