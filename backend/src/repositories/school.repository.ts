import { Prisma } from '@prisma/client'
import prisma from '../lib/prisma'

export const schoolRepository = {
  findMany(where: Prisma.SchoolWhereInput) {
    return prisma.school.findMany({
      where,
      include: {
        district:  { select: { id: true, name: true } },
        nucleo:    { select: { id: true, name: true, location: true } },
        _count:    { select: { students: true, teachers: true, parents: true } },
        directors: {
          where:  { isActive: true },
          select: { id: true, firstName: true, lastName: true, user: { select: { id: true, email: true } } },
          take:   1,
        },
      },
      orderBy: { name: 'asc' },
    })
  },

  findById(id: number) {
    return prisma.school.findUnique({
      where: { id },
      include: {
        district:  { select: { id: true, name: true } },
        nucleo:    { select: { id: true, name: true, location: true } },
        directors: {
          where:  { isActive: true },
          select: { id: true, firstName: true, lastName: true, user: { select: { id: true, email: true } } },
          take:   1,
        },
      },
    })
  },

  findBySieCode(sieCode: string) {
    return prisma.school.findUnique({ where: { sieCode } })
  },

  create(data: Prisma.SchoolCreateInput) {
    return prisma.school.create({ data })
  },

  update(id: number, data: Prisma.SchoolUncheckedUpdateInput) {
    return prisma.school.update({ where: { id }, data })
  },

  findDistrictById(id: number) {
    return prisma.district.findUnique({ where: { id } })
  },
}
