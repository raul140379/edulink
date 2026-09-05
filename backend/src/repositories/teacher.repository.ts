import { Prisma } from '@prisma/client'
import prisma from '../lib/prisma'

type TxClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]

export const teacherRepository = {
  findMany(where: Prisma.TeacherWhereInput) {
    return prisma.teacher.findMany({
      where,
      include: {
        user: { select: { id: true, email: true, role: true, isActive: true } },
        assignments: {
          include: {
            subject: { select: { id: true, name: true, code: true } },
            course:  { select: { id: true, level: true, grade: true, parallel: true, shift: true } },
          },
          take: 5,
        },
        _count: { select: { assignments: true } },
        specialties: { include: { subject: { select: { id: true, name: true, campo: true } } } },
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    })
  },

  findById(id: number) {
    return prisma.teacher.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, email: true, role: true, isActive: true } },
        assignments: {
          include: {
            subject: { select: { id: true, name: true, code: true, campo: true } },
            course:  { select: { id: true, level: true, grade: true, parallel: true, shift: true, educationType: true } },
          },
        },
      },
    })
  },

  findRaw(id: number) {
    return prisma.teacher.findUnique({ where: { id } })
  },

  findByCI(ci: string) {
    return prisma.teacher.findFirst({ where: { ci } })
  },

  findWithWorkloadById(id: number) {
    return prisma.teacher.findUnique({
      where: { id },
      include: {
        assignments: {
          include: {
            subject: { include: { gradeConfigs: true } },
            course:  true,
            schedules: { include: { academicYear: { select: { isActive: true } } } },
          },
        },
      },
    })
  },

  findWithWorkloadByUserId(userId: number | undefined) {
    return prisma.teacher.findUnique({
      where: { userId },
      include: {
        assignments: {
          include: {
            subject: { include: { gradeConfigs: true } },
            course:  true,
            schedules: { include: { academicYear: { select: { isActive: true } } } },
          },
        },
      },
    })
  },

  findActiveSchoolSchedules() {
    return prisma.schoolSchedule.findMany({ where: { isActive: true }, orderBy: { isWinter: 'asc' } })
  },

  findMyCourseByUserId(userId: number | undefined) {
    return prisma.teacher.findFirst({
      where: { OR: [{ userId }, { tutorUserId: userId }] },
      include: {
        tutorCourse: {
          include: {
            course: {
              include: {
                tutor: { include: { teacher: { select: { id: true, firstName: true, lastName: true } } } },
                assignments: {
                  where: { academicYear: { isActive: true } },
                  include: {
                    student: {
                      select: {
                        id: true, firstName: true, lastName: true,
                        ci: true, rude: true, isActive: true, gender: true,
                        parents: {
                          include: {
                            parent: {
                              select: {
                                id: true, firstName: true, lastName: true, phone: true, ci: true,
                                charges: {
                                  where: { status: { not: 'ANULADO' } },
                                  select: { amount: true, paidAmount: true, status: true },
                                },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
                delegate: { select: { id: true, firstName: true, lastName: true, phone: true, ci: true } },
                meetings: {
                  orderBy: { date: 'desc' },
                  take: 5,
                  include: { attendances: { include: { parent: { select: { id: true, firstName: true, lastName: true } } } } },
                },
              },
            },
          },
        },
      },
    })
  },

  // Forma "unchecked" (schoolId/userId planos) a propósito — el motor de
  // tenant-scoping (applyWriteScope, lib/prisma.ts) inyecta `data.schoolId`
  // directo sobre cualquier create de un modelo DIRECT_SCHOOL_SCOPED_MODELS;
  // con la forma "checked" (school: {connect}) eso choca con Prisma
  // ("Unknown argument schoolId") porque no se pueden mezclar las dos formas
  // en el mismo create — bug real que dejaba el Teacher sin crear el 100% de
  // las veces (ver CLAUDE.md, incidente Silvia/Patricia Torrico 4-sep-2026).
  create(data: Prisma.TeacherUncheckedCreateInput) {
    return prisma.teacher.create({ data, include: { user: { select: { id: true, email: true, role: true } } } })
  },

  // Misma forma, dentro de una transacción — usado por teacherService.createTeacher
  // junto con userRepository.createTx, para que un User nunca quede huérfano
  // sin su Teacher si algo falla (mismo patrón que staffRepository.createTx).
  createTx(tx: TxClient, data: Prisma.TeacherUncheckedCreateInput) {
    return tx.teacher.create({ data, include: { user: { select: { id: true, email: true, role: true } } } })
  },

  update(id: number, data: Prisma.TeacherUpdateInput) {
    return prisma.teacher.update({ where: { id }, data, include: { user: { select: { id: true, email: true, role: true } } } })
  },

  setActive(id: number, isActive: boolean) {
    return prisma.teacher.update({ where: { id }, data: { isActive } })
  },

  countAssignments(id: number) {
    return prisma.teacher.findUnique({ where: { id }, include: { _count: { select: { assignments: true } } } })
  },

  delete(id: number) {
    return prisma.teacher.delete({ where: { id } })
  },

  findByAttendanceCodeExcluding(code: string, excludeId: number) {
    return prisma.teacher.findFirst({ where: { attendanceCode: code, NOT: { id: excludeId } } })
  },

  findByAttendanceCode(code: string) {
    return prisma.teacher.findFirst({ where: { attendanceCode: code } })
  },

  updateAttendanceCode(id: number, code: string) {
    return prisma.teacher.update({
      where: { id }, data: { attendanceCode: code },
      select: { id: true, firstName: true, lastName: true, attendanceCode: true },
    })
  },

  updateSchedule(id: number, data: Partial<{ entryTime: string; exitTime: string; toleranceMin: number }>) {
    return prisma.teacher.update({
      where: { id }, data,
      select: { id: true, firstName: true, lastName: true, entryTime: true, exitTime: true, toleranceMin: true },
    })
  },
}
