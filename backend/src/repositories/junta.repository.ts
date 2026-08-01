import { Prisma } from '@prisma/client'
import prisma from '../lib/prisma'

export const juntaRepository = {
  findMany() {
    return prisma.juntaMember.findMany({
      include: {
        user:     { select: { id: true, email: true, isActive: true, role: true } },
        // school.nucleo es el fallback de agrupamiento: hoy un JuntaMember de tipo
        // JUNTA_ESCOLAR no siempre trae nucleoId propio seteado, pero su colegio sí.
        school:   { select: { id: true, name: true, nucleo: { select: { id: true, name: true } } } },
        nucleo:   { select: { id: true, name: true } },
        district: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
  },

  findById(id: number) {
    // El `user.role` se usa en updateJuntaMember para saber si el body está
    // pidiendo un cambio de rol (comparándolo contra el rol actual) y para
    // resolver el alcance nuevo — no hace falta un fetch aparte.
    return prisma.juntaMember.findUnique({
      where: { id },
      include: { user: { select: { id: true, role: true } } },
    })
  },

  findByUserId(userId: number) {
    return prisma.juntaMember.findFirst({ where: { userId } })
  },

  // Elegibilidad para Junta Escolar: el Parent tiene que ser tutor
  // (ParentStudent.isTutor=true) de al menos un estudiante activo de ESE
  // colegio — no alcanza con figurar como padre/madre sin ese rol.
  findEligibleParentForBoard(parentId: number, schoolId: number) {
    return prisma.parent.findFirst({
      where: {
        id: parentId,
        schoolId,
        students: { some: { isTutor: true, student: { isActive: true } } },
      },
    })
  },

  // Unchecked (FKs escalares, no sintaxis de relación `{connect}}`) a propósito:
  // el motor de tenant-scoping (lib/prisma.ts) fuerza `data.schoolId` como
  // escalar para un actor de alcance colegio (ej. Presidente de Junta Escolar
  // creando su directorio) — mezclar eso con `school: {connect}}` hace que
  // Prisma rechace el create ("Unknown argument schoolId"). Con Unchecked,
  // esa asignación solo pisa el mismo campo escalar, sin conflicto.
  create(data: Prisma.JuntaMemberUncheckedCreateInput) {
    return prisma.juntaMember.create({ data })
  },

  update(id: number, data: Prisma.JuntaMemberUpdateInput) {
    return prisma.juntaMember.update({ where: { id }, data })
  },
}
