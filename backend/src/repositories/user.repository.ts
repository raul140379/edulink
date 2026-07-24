import { Prisma, Role } from '@prisma/client'
import prisma from '../lib/prisma'

// Roles de gestión/administración visibles para un DIRECTOR_DISTRITAL, además de
// los usuarios que él mismo haya creado (ver `managementOrCreatedBy` abajo).
const MANAGEMENT_ROLES: Role[] = [Role.DIRECTOR, Role.REGENTE, Role.SECRETARY, Role.DIRECTOR_DISTRITAL]

export interface UserListFilters {
  role?:     Role
  isActive?: boolean
  search?:   string
  // Cuando se pasa (id del Director Distrital), la lista se restringe a roles de
  // gestión + usuarios creados por él — no ve el detalle de cada estudiante/padre
  // de todos los colegios del distrito.
  managementOrCreatedBy?: number
}

const buildListWhere = ({ role, isActive, search, managementOrCreatedBy }: UserListFilters): Prisma.UserWhereInput => {
  const clauses: Prisma.UserWhereInput[] = []

  if (role)                   clauses.push({ role })
  if (isActive !== undefined) clauses.push({ isActive })

  if (search) {
    clauses.push({
      OR: [
        { email:   { contains: search, mode: 'insensitive' } },
        { parent:  { OR: [
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName:  { contains: search, mode: 'insensitive' } },
        ]}},
        { teacher: { OR: [
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName:  { contains: search, mode: 'insensitive' } },
        ]}},
        { student: { OR: [
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName:  { contains: search, mode: 'insensitive' } },
        ]}},
      ],
    })
  }

  if (managementOrCreatedBy != null) {
    clauses.push({
      OR: [
        { createdByUserId: managementOrCreatedBy },
        { role: { in: MANAGEMENT_ROLES } },
      ],
    })
  }

  return clauses.length > 0 ? { AND: clauses } : {}
}

export const userRepository = {
  findByEmail(email: string) {
    return prisma.user.findUnique({ where: { email } })
  },

  findById(id: number) {
    return prisma.user.findUnique({ where: { id } })
  },

  findMany(filters: UserListFilters) {
    return prisma.user.findMany({
      where: buildListWhere(filters),
      select: {
        id:        true,
        email:     true,
        role:      true,
        isActive:  true,
        createdAt: true,
        parent:  { select: { id: true, firstName: true, lastName: true, ci: true, phone: true } },
        teacher: { select: { id: true, firstName: true, lastName: true, ci: true } },
        student: { select: { id: true, firstName: true, lastName: true, rude: true } },
        staff:   { select: { id: true, firstName: true, lastName: true, staffRole: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
  },

  findByIdDetailed(id: number) {
    return prisma.user.findUnique({
      where: { id },
      select: {
        id:        true,
        email:     true,
        role:      true,
        isActive:  true,
        createdAt: true,
        parent:  { select: { id: true, firstName: true, lastName: true, ci: true, phone: true, address: true } },
        teacher: { select: { id: true, firstName: true, lastName: true, ci: true, specialty: true } },
        student: { select: { id: true, firstName: true, lastName: true, rude: true, ci: true } },
        staff:   { select: { id: true, firstName: true, lastName: true, staffRole: true } },
      },
    })
  },

  create(data: { email: string; password: string; role: Role; schoolId?: number; districtId?: number; createdByUserId?: number }) {
    return prisma.user.create({
      data:   { ...data, isActive: true },
      select: { id: true, email: true, role: true, isActive: true, createdAt: true },
    })
  },

  update(id: number, data: Partial<{ email: string; role: Role; password: string; isActive: boolean }>) {
    return prisma.user.update({
      where:  { id },
      data,
      select: { id: true, email: true, role: true, isActive: true },
    })
  },

  updatePasswordByEmail(email: string, hashedPassword: string) {
    return prisma.user.update({
      where: { email },
      data:  { password: hashedPassword },
    })
  },

  setActive(id: number, isActive: boolean) {
    return prisma.user.update({
      where:  { id },
      data:   { isActive },
      select: { id: true, email: true, role: true, isActive: true },
    })
  },

  async detachRelations(userId: number) {
    await prisma.parent.updateMany({ where: { userId },              data: { userId: null } })
    await prisma.parent.updateMany({ where: { delegateUserId: userId }, data: { delegateUserId: null } })
    await prisma.teacher.updateMany({ where: { tutorUserId: userId }, data: { tutorUserId: null } })
    await prisma.student.updateMany({ where: { userId },              data: { userId: null } })
  },

  delete(id: number) {
    return prisma.user.delete({ where: { id } })
  },

  findJuntaParents() {
    return prisma.user.findMany({
      where:  { role: Role.JUNTA_ESCOLAR, isActive: true },
      select: { parent: { select: { id: true, firstName: true, lastName: true } } },
    })
  },

  findByIdWithProfile(id: number) {
    return prisma.user.findUnique({
      where: { id },
      select: {
        id:       true,
        email:    true,
        role:     true,
        isActive: true,
        parent: {
          select: { id: true, firstName: true, lastName: true, phone: true },
        },
        teacher: {
          select: { id: true, firstName: true, lastName: true },
        },
        teacherTutor: {
          select: { id: true, firstName: true, lastName: true },
        },
        student: {
          select: { id: true, firstName: true, lastName: true, rude: true },
        },
        staff: {
          select: { id: true, firstName: true, lastName: true, staffRole: true },
        },
      },
    })
  },

  updatePassword(id: number, hashedPassword: string) {
    return prisma.user.update({
      where: { id },
      data:  { password: hashedPassword },
    })
  },
}
