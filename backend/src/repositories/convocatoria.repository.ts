import prisma from '../lib/prisma'
import { getTenantContext } from '../lib/tenant-context'

const withAttendances = { include: { attendances: { include: { user: { select: { id: true, email: true, role: true } } } } } }

export const convocatoriaRepository = {
  findMany() {
    return prisma.convocatoria.findMany({
      ...withAttendances,
      orderBy: { date: 'desc' },
    })
  },

  findById(id: number) {
    return prisma.convocatoria.findUnique({ where: { id }, ...withAttendances })
  },

  create(data: {
    title: string; description: string | null; kind: string; audience: string
    date: Date; location: string | null; multaAmount: number | null
    createdById: number; userIds: number[]
  }) {
    // schoolId lo fuerza el motor de tenant-scoping (lib/prisma.ts) para quien crea.
    return prisma.convocatoria.create({
      data: {
        title: data.title,
        description: data.description,
        kind: data.kind as any,
        audience: data.audience as any,
        date: data.date,
        location: data.location,
        multaAmount: data.multaAmount,
        createdById: data.createdById,
        schoolId: getTenantContext()?.schoolId ?? 0,
        attendances: { create: data.userIds.map((userId) => ({ userId, present: false })) },
      },
      ...withAttendances,
    })
  },

  update(id: number, data: { title?: string; description?: string | null; date?: Date; location?: string | null; multaAmount?: number | null }) {
    return prisma.convocatoria.update({ where: { id }, data })
  },

  setCancelled(id: number, isCancelled: boolean) {
    return prisma.convocatoria.update({ where: { id }, data: { isCancelled } })
  },

  setClosed(id: number) {
    return prisma.convocatoria.update({ where: { id }, data: { isClosed: true } })
  },

  updateAttendance(convocatoriaId: number, userId: number, present: boolean, note?: string) {
    return prisma.convocatoriaAttendance.updateMany({ where: { convocatoriaId, userId }, data: { present, note: note || null } })
  },

  markAttendanceCharged(attendanceIds: number[]) {
    return prisma.convocatoriaAttendance.updateMany({ where: { id: { in: attendanceIds } }, data: { charged: true } })
  },

  // Resolución de audiencia — mismo espíritu que delegateService.getEligibleParents,
  // pero a nivel colegio completo (no un solo curso) y con 3 fuentes distintas.
  findDelegateUserIds(schoolId: number) {
    return prisma.parent.findMany({
      where: { schoolId, delegateUserId: { not: null } },
      select: { delegateUserId: true },
    })
  },

  findDirectorioUserIds(schoolId: number) {
    return prisma.juntaMember.findMany({
      where: { schoolId, isActive: true },
      select: { userId: true },
    })
  },

  findAllParentUserIds(schoolId: number) {
    return prisma.parent.findMany({
      where: { schoolId, userId: { not: null }, students: { some: { isTutor: true } } },
      select: { userId: true },
    })
  },

  // Resuelve el Parent detrás de un userId sin importar si es un login de
  // PARENT, DELEGATE (Parent.delegateUserId) o JUNTA_ESCOLAR (JuntaMember.parentId)
  // — un directivo puede no tener Parent vinculado (dato legado), en cuyo caso
  // devuelve null y quien llama debe saltarlo, no romper el lote.
  async findParentByUserId(userId: number) {
    const direct = await prisma.parent.findFirst({ where: { OR: [{ userId }, { delegateUserId: userId }] } })
    if (direct) return direct

    const member = await prisma.juntaMember.findFirst({ where: { userId }, select: { parentId: true } })
    if (member?.parentId) return prisma.parent.findUnique({ where: { id: member.parentId } })

    return null
  },

  // Check-in por QR/código: convocatoria de hoy donde alguno de los userId
  // posibles del tutor (login de padre y/o de delegado) está invitado.
  // Lectura simple — el escaneo escribe vía updateAttendance de arriba, no
  // pasa por convocatoriaService (así evita el candado de Presidente).
  findOpenTodayForUser(userIds: number[], start: Date, end: Date) {
    return prisma.convocatoriaAttendance.findFirst({
      where: { userId: { in: userIds }, convocatoria: { isClosed: false, isCancelled: false, date: { gte: start, lt: end } } },
      include: { convocatoria: true },
    })
  },
}
