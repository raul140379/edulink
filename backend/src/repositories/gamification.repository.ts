import prisma from '../lib/prisma'
import { getTenantContext } from '../lib/tenant-context'

export const gamificationRepository = {
  findByStudentId(studentId: number) {
    return prisma.studentGamification.findUnique({ where: { studentId } })
  },

  async incrementXp(studentId: number, amount: number) {
    return prisma.studentGamification.upsert({
      where: { studentId },
      update: { xp: { increment: amount } },
      create: { studentId, xp: amount, schoolId: getTenantContext()?.schoolId ?? 0 },
    })
  },

  async updateStreak(studentId: number, data: { currentStreak: number; longestStreak: number; lastStreakDate: Date }) {
    return prisma.studentGamification.upsert({
      where: { studentId },
      update: data,
      create: { studentId, ...data, schoolId: getTenantContext()?.schoolId ?? 0 },
    })
  },

  findActiveAssignment(studentId: number) {
    return prisma.studentAcademicAssignment.findFirst({
      where: { studentId, academicYear: { isActive: true } },
      select: { courseId: true, academicYearId: true },
    })
  },

  findAllAchievementDefinitions() {
    return prisma.achievementDefinition.findMany({ orderBy: { id: 'asc' } })
  },

  findUnlockedForStudent(studentId: number) {
    return prisma.studentAchievement.findMany({ where: { studentId } })
  },

  async unlockAchievement(studentId: number, achievementId: number) {
    return prisma.studentAchievement.upsert({
      where: { studentId_achievementId: { studentId, achievementId } },
      update: {},
      create: { studentId, achievementId, schoolId: getTenantContext()?.schoolId ?? 0 },
    })
  },

  findTrimesterBonus(studentId: number, trimesterId: number) {
    return prisma.studentTrimesterBonus.findUnique({ where: { studentId_trimesterId: { studentId, trimesterId } } })
  },

  createTrimesterBonus(studentId: number, trimesterId: number, xpAwarded: number) {
    return prisma.studentTrimesterBonus.create({
      data: { studentId, trimesterId, xpAwarded, schoolId: getTenantContext()?.schoolId ?? 0 },
    })
  },

  findNotasForTrimester(trimesterId: number) {
    return prisma.nota.findMany({ where: { trimesterId }, select: { studentId: true, total: true } })
  },

  findOpenTrimester(academicYearId: number) {
    return prisma.trimester.findFirst({ where: { academicYearId, isClosed: false }, orderBy: { number: 'desc' } })
  },
}
