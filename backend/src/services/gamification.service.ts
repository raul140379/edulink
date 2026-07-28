import { gamificationRepository } from '../repositories/gamification.repository'
import { studentRepository } from '../repositories/student.repository'
import { studentAttendanceRepository } from '../repositories/studentAttendance.repository'
import { academicRepository } from '../repositories/academic.repository'

const XP_TASK_ON_TIME    = 40
const XP_ATTENDANCE_DAY  = 10
const XP_PER_LEVEL       = 500
const XP_TRIMESTER_BONUS = 60
const AVERAGE_BONUS_THRESHOLD = 80

const DAY_MS = 24 * 60 * 60 * 1000

function toDateKey(d: Date): string {
  return d.toISOString().split('T')[0]
}

function levelFromXp(xp: number) {
  const level          = Math.floor(xp / XP_PER_LEVEL) + 1
  const xpIntoLevel    = xp % XP_PER_LEVEL
  const xpForNextLevel = XP_PER_LEVEL
  const progressPct    = Math.round((xpIntoLevel / xpForNextLevel) * 100)
  return { xp, level, xpIntoLevel, xpForNextLevel, progressPct }
}

export const gamificationService = {
  XP_TASK_ON_TIME,
  XP_ATTENDANCE_DAY,

  async awardXp(studentId: number, amount: number) {
    const row = await gamificationRepository.incrementXp(studentId, amount)
    return levelFromXp(row.xp)
  },

  async getCurrentGamification(studentId: number) {
    const row = await gamificationRepository.findByStudentId(studentId)
    return levelFromXp(row?.xp ?? 0)
  },

  async calculateGeneralAverage(studentId: number): Promise<number | null> {
    const assignment = await gamificationRepository.findActiveAssignment(studentId)
    if (!assignment) return null

    const trimestres = await studentRepository.findTrimestersByAcademicYear(assignment.academicYearId)
    const notas = await studentRepository.findNotasLean(studentId, assignment.courseId, trimestres.map((t) => t.id))

    const bySubject: Record<number, number[]> = {}
    for (const n of notas) {
      if (n.total === null) continue
      if (!bySubject[n.subjectId]) bySubject[n.subjectId] = []
      bySubject[n.subjectId].push(n.total)
    }

    const subjectAverages = Object.values(bySubject).map((vals) => vals.reduce((a, b) => a + b, 0) / vals.length)
    if (subjectAverages.length === 0) return null
    return subjectAverages.reduce((a, b) => a + b, 0) / subjectAverages.length
  },

  // Un mes cuenta como "perfecto" si, de los días escolares con asistencia
  // registrada este mes calendario, ninguno es AUSENTE ni LICENCIA (RETRASO sí
  // cuenta como "asistió" — confirmado con el usuario), y hubo al menos 15
  // registros (heurístico MVP para evitar que un mes recién empezado, con 2
  // registros, ya cuente como "perfecto").
  async hasPerfectAttendanceThisMonth(studentId: number, academicYearId: number): Promise<boolean> {
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const history = await studentAttendanceRepository.findStudentHistory(studentId, academicYearId, undefined, {
      gte: monthStart, lt: now,
    })
    if (history.length < 15) return false
    return history.every((a) => a.status === 'PRESENTE' || a.status === 'RETRASO')
  },

  async evaluateAchievements(studentId: number) {
    const [definitions, unlocked, gam, average] = await Promise.all([
      gamificationRepository.findAllAchievementDefinitions(),
      gamificationRepository.findUnlockedForStudent(studentId),
      gamificationRepository.findByStudentId(studentId),
      gamificationService.calculateGeneralAverage(studentId),
    ])

    const unlockedIds = new Set(unlocked.map((u) => u.achievementId))
    const pending = definitions.filter((d) => !unlockedIds.has(d.id))
    if (pending.length === 0) return

    const assignment = await gamificationRepository.findActiveAssignment(studentId)
    const perfectMonth = assignment
      ? await gamificationService.hasPerfectAttendanceThisMonth(studentId, assignment.academicYearId)
      : false

    for (const def of pending) {
      let meets = false
      if (def.criteriaKey === 'STREAK') {
        meets = (gam?.longestStreak ?? 0) >= (def.criteriaValue ?? Infinity)
      } else if (def.criteriaKey === 'AVERAGE') {
        meets = average !== null && average >= (def.criteriaValue ?? Infinity)
      } else if (def.criteriaKey === 'PERFECT_ATTENDANCE_MONTH') {
        meets = perfectMonth
      }
      if (meets) await gamificationRepository.unlockAchievement(studentId, def.id)
    }
  },

  // Camina hacia atrás desde el día más reciente con registro (no necesariamente
  // "hoy": si el profesor todavía no pasó lista hoy, no queremos que la racha se
  // vea rota por eso). Sábados, domingos y feriados se saltan sin cortar la racha.
  async recalculateStreak(studentId: number) {
    const assignment = await gamificationRepository.findActiveAssignment(studentId)
    if (!assignment) return

    const history = await studentAttendanceRepository.findStudentHistory(studentId, assignment.academicYearId)
    if (history.length === 0) return

    const holidays = await academicRepository.findHolidaysByYear(assignment.academicYearId)
    const holidaySet = new Set(holidays.map((h) => toDateKey(h.date)))
    const attendanceByDate = new Map(history.map((a) => [toDateKey(a.date), a.status]))

    let cursor = new Date(history[0].date)
    let streak = 0
    for (let i = 0; i < 400; i++) {
      const day = cursor.getDay()
      const key = toDateKey(cursor)
      const isWeekend = day === 0 || day === 6
      const isHoliday = holidaySet.has(key)

      if (isWeekend || isHoliday) {
        cursor = new Date(cursor.getTime() - DAY_MS)
        continue
      }

      const status = attendanceByDate.get(key)
      if (status === 'PRESENTE' || status === 'RETRASO') {
        streak++
        cursor = new Date(cursor.getTime() - DAY_MS)
      } else {
        break
      }
    }

    const gam = await gamificationRepository.findByStudentId(studentId)
    await gamificationRepository.updateStreak(studentId, {
      currentStreak: streak,
      longestStreak: Math.max(gam?.longestStreak ?? 0, streak),
      lastStreakDate: new Date(history[0].date),
    })

    await gamificationService.evaluateAchievements(studentId)
  },

  async getWeekCalendar(studentId: number) {
    const labels = ['L', 'M', 'M', 'J', 'V', 'S', 'D']
    const now = new Date()
    const dayIdx = (now.getDay() + 6) % 7 // lunes = 0
    const monday = new Date(now)
    monday.setHours(0, 0, 0, 0)
    monday.setDate(now.getDate() - dayIdx)

    const assignment = await gamificationRepository.findActiveAssignment(studentId)
    if (!assignment) {
      return labels.map((label, i) => ({ date: toDateKey(new Date(monday.getTime() + i * DAY_MS)), label, status: null as string | null }))
    }

    const sundayEnd = new Date(monday.getTime() + 7 * DAY_MS)
    const history = await studentAttendanceRepository.findStudentHistory(studentId, assignment.academicYearId, undefined, {
      gte: monday, lt: sundayEnd,
    })
    const byDate = new Map(history.map((a) => [toDateKey(a.date), a.status]))

    return labels.map((label, i) => {
      const d = new Date(monday.getTime() + i * DAY_MS)
      const key = toDateKey(d)
      return { date: key, label, status: d > now ? null : (byDate.get(key) ?? null) }
    })
  },

  // % de días con PRESENTE/RETRASO sobre el total de días con registro, dentro
  // del trimestre abierto actual (no toda la gestión) — null si no hay curso o
  // todavía no hay ningún registro este trimestre.
  async getAttendancePercentThisTrimester(studentId: number): Promise<number | null> {
    const assignment = await gamificationRepository.findActiveAssignment(studentId)
    if (!assignment) return null

    const trimestre = await gamificationRepository.findOpenTrimester(assignment.academicYearId)
    if (!trimestre) return null

    const history = await studentAttendanceRepository.findStudentHistory(studentId, assignment.academicYearId, undefined, {
      gte: trimestre.startDate, lt: new Date(),
    })
    if (history.length === 0) return null

    const presentes = history.filter((a) => a.status === 'PRESENTE' || a.status === 'RETRASO').length
    return Math.round((presentes / history.length) * 100)
  },

  async getSummary(studentId: number) {
    const gam = await gamificationRepository.findByStudentId(studentId)
    const level = levelFromXp(gam?.xp ?? 0)
    const [weekCalendar, attendancePct] = await Promise.all([
      gamificationService.getWeekCalendar(studentId),
      gamificationService.getAttendancePercentThisTrimester(studentId),
    ])
    return {
      ...level,
      currentStreak: gam?.currentStreak ?? 0,
      longestStreak: gam?.longestStreak ?? 0,
      weekCalendar,
      attendancePct,
    }
  },

  async getAchievementsList(studentId: number) {
    const [definitions, unlocked] = await Promise.all([
      gamificationRepository.findAllAchievementDefinitions(),
      gamificationRepository.findUnlockedForStudent(studentId),
    ])
    const unlockedMap = new Map(unlocked.map((u) => [u.achievementId, u.unlockedAt]))
    return definitions.map((d) => ({
      code: d.code, name: d.name, description: d.description, icon: d.icon,
      unlocked: unlockedMap.has(d.id), unlockedAt: unlockedMap.get(d.id) ?? null,
    }))
  },

  async awardTrimesterBonusIfEligible(trimesterId: number) {
    const notas = await gamificationRepository.findNotasForTrimester(trimesterId)

    const byStudent: Record<number, number[]> = {}
    for (const n of notas) {
      if (n.total === null) continue
      if (!byStudent[n.studentId]) byStudent[n.studentId] = []
      byStudent[n.studentId].push(n.total)
    }

    for (const [studentIdStr, totals] of Object.entries(byStudent)) {
      const studentId = parseInt(studentIdStr)
      const already = await gamificationRepository.findTrimesterBonus(studentId, trimesterId)
      if (already) continue

      const promedio = totals.reduce((a, b) => a + b, 0) / totals.length
      if (promedio >= AVERAGE_BONUS_THRESHOLD) {
        await gamificationRepository.createTrimesterBonus(studentId, trimesterId, XP_TRIMESTER_BONUS)
        await gamificationService.awardXp(studentId, XP_TRIMESTER_BONUS)
      }
    }
  },
}
