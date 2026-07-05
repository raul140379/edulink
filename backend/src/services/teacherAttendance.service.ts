import { teacherAttendanceRepository } from '../repositories/teacherAttendance.repository'
import { HttpError } from '../utils/http-error'
import { UpdateTeacherAttendanceInput } from '../schemas/teacherAttendance.schema'

const startOfDay = (date: Date) => { const d = new Date(date); d.setHours(0, 0, 0, 0); return d }
const endOfDay   = (date: Date) => { const d = new Date(date); d.setHours(23, 59, 59, 999); return d }
const fmtTime    = (d: string) => new Date(d).toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' })

async function checkIsRetraso(teacherId: number, now: Date): Promise<boolean> {
  const teacher = await teacherAttendanceRepository.findEntryConfig(teacherId)

  if (teacher?.entryTime) {
    const [entryHour, entryMin] = teacher.entryTime.split(':').map(Number)
    const tolerance = teacher.toleranceMin ?? 10
    const entryLimit = new Date(now)
    entryLimit.setHours(entryHour, entryMin + tolerance, 0, 0)
    return now > entryLimit
  }

  const hour = now.getHours()
  const minute = now.getMinutes()
  return hour > 8 || (hour === 8 && minute > 10)
}

export const teacherAttendanceService = {
  async checkIn(userId: number | undefined) {
    const teacher = await teacherAttendanceRepository.findTeacherByUserId(userId)
    if (!teacher) throw new HttpError(404, 'Perfil de maestro no encontrado')

    const today = new Date()
    const existing = await teacherAttendanceRepository.findTodayFor(teacher.id, startOfDay(today), endOfDay(today))

    if (existing?.checkIn) throw new HttpError(400, 'Ya registraste tu entrada hoy')

    const isRetraso = await checkIsRetraso(teacher.id, today)
    const status = isRetraso ? 'RETRASO' : 'PRESENTE'

    const attendance = existing
      ? await teacherAttendanceRepository.updateCheckIn(existing.id, today, status)
      : await teacherAttendanceRepository.create(teacher.id, today, today, status)

    return { message: isRetraso ? 'Entrada registrada con retraso' : 'Entrada registrada correctamente', attendance, isNew: !existing }
  },

  async checkOut(userId: number | undefined) {
    const teacher = await teacherAttendanceRepository.findTeacherByUserId(userId)
    if (!teacher) throw new HttpError(404, 'Perfil de maestro no encontrado')

    const today = new Date()
    const existing = await teacherAttendanceRepository.findTodayFor(teacher.id, startOfDay(today), endOfDay(today))

    if (!existing?.checkIn) throw new HttpError(400, 'No has registrado tu entrada hoy. Marca entrada primero.')
    if (existing.checkOut) throw new HttpError(400, 'Ya registraste tu salida hoy')

    const attendance = await teacherAttendanceRepository.updateCheckOut(existing.id, today)
    return { message: 'Salida registrada correctamente', attendance }
  },

  async getMyToday(userId: number | undefined) {
    const teacher = await teacherAttendanceRepository.findTeacherByUserId(userId)
    if (!teacher) throw new HttpError(404, 'Perfil no encontrado')

    const today = new Date()
    return teacherAttendanceRepository.findTodayFor(teacher.id, startOfDay(today), endOfDay(today))
  },

  async getMyHistory(userId: number | undefined, month?: number, year?: number) {
    const teacher = await teacherAttendanceRepository.findTeacherByUserId(userId)
    if (!teacher) throw new HttpError(404, 'Perfil no encontrado')

    const m = month || new Date().getMonth() + 1
    const y = year || new Date().getFullYear()

    const records = await teacherAttendanceRepository.findHistoryFor(teacher.id, new Date(y, m - 1, 1), new Date(y, m, 0, 23, 59, 59))

    const summary = {
      presente: records.filter((r) => r.status === 'PRESENTE').length,
      retraso:  records.filter((r) => r.status === 'RETRASO').length,
      ausente:  records.filter((r) => r.status === 'AUSENTE').length,
      licencia: records.filter((r) => r.status === 'LICENCIA').length,
      total:    records.length,
    }

    return { records, summary, month: m, year: y }
  },

  async getReport(query: { month?: number; year?: number; week?: number; date?: string; teacherId?: number }) {
    const month = query.month || new Date().getMonth() + 1
    const year  = query.year  || new Date().getFullYear()
    const week  = query.week  || null
    const { date, teacherId } = query

    let start: Date, end: Date

    if (date) {
      const d = new Date(date)
      start = startOfDay(d); end = endOfDay(d)
    } else if (week) {
      const firstDay = new Date(year, month - 1, 1)
      const dayOfWeek = firstDay.getDay()
      const firstMonday = new Date(firstDay)
      firstMonday.setDate(firstDay.getDate() + (dayOfWeek === 0 ? 1 : 8 - dayOfWeek) % 7)
      start = new Date(firstMonday)
      start.setDate(firstMonday.getDate() + (week - 1) * 7)
      end = new Date(start)
      end.setDate(start.getDate() + 6)
      end.setHours(23, 59, 59)
    } else {
      start = new Date(year, month - 1, 1)
      end = new Date(year, month, 0, 23, 59, 59)
    }

    const records = await teacherAttendanceRepository.findReport({ date: { gte: start, lte: end }, ...(teacherId ? { teacherId } : {}) })

    const byTeacher: Record<number, any> = {}
    records.forEach((r) => {
      const tid = r.teacherId
      if (!byTeacher[tid]) {
        byTeacher[tid] = { teacher: r.teacher, records: [], summary: { presente: 0, retraso: 0, ausente: 0, licencia: 0, total: 0 } }
      }
      byTeacher[tid].records.push(r)
      const key = r.status.toLowerCase() as keyof (typeof byTeacher)[typeof tid]['summary']
      if (key in byTeacher[tid].summary) byTeacher[tid].summary[key]++
      byTeacher[tid].summary.total++
    })

    return { period: { start, end, month, year, week, date }, teachers: Object.values(byTeacher), totalRecords: records.length }
  },

  async updateAttendance(id: number, input: UpdateTeacherAttendanceInput) {
    const attendance = await teacherAttendanceRepository.update(id, {
      status: input.status,
      note: input.note,
      checkIn: input.checkIn ? new Date(input.checkIn) : undefined,
      checkOut: input.checkOut ? new Date(input.checkOut) : undefined,
    })
    return attendance
  },

  async markAbsent() {
    const today = new Date()
    const teachers = await teacherAttendanceRepository.findActiveTeachers()
    const existing = await teacherAttendanceRepository.findTeacherIdsWithAttendanceToday(startOfDay(today), endOfDay(today))
    const existingIds = new Set(existing.map((e) => e.teacherId))
    const absentTeachers = teachers.filter((t) => !existingIds.has(t.id))

    if (absentTeachers.length === 0) return { message: 'Todos los maestros ya tienen registro hoy', marked: 0 }

    await teacherAttendanceRepository.createManyAbsent(absentTeachers.map((t) => t.id), today)
    return { message: `${absentTeachers.length} maestros marcados como ausentes`, marked: absentTeachers.length }
  },

  async publicCheckIn(code: string) {
    const teacher = await teacherAttendanceRepository.findTeacherByAttendanceCode(code.trim().toUpperCase())
    if (!teacher) throw new HttpError(404, 'Código inválido')

    const today = new Date()
    const existing = await teacherAttendanceRepository.findTodayFor(teacher.id, startOfDay(today), endOfDay(today))

    if (existing?.checkIn) {
      throw new HttpError(400, `${teacher.lastName} ${teacher.firstName} — ya registraste tu entrada hoy a las ${fmtTime(existing.checkIn.toISOString())}`)
    }

    const isRetraso = await checkIsRetraso(teacher.id, today)
    const status = isRetraso ? 'RETRASO' : 'PRESENTE'

    const attendance = existing
      ? await teacherAttendanceRepository.updateCheckIn(existing.id, today, status)
      : await teacherAttendanceRepository.create(teacher.id, today, today, status)

    return {
      message: `✅ ${teacher.lastName} ${teacher.firstName} — ${isRetraso ? 'Entrada con retraso' : 'Entrada registrada'} a las ${fmtTime(today.toISOString())}`,
      teacher, attendance,
    }
  },

  async publicCheckOut(code: string) {
    const teacher = await teacherAttendanceRepository.findTeacherByAttendanceCode(code.trim().toUpperCase())
    if (!teacher) throw new HttpError(404, 'Código inválido')

    const today = new Date()
    const existing = await teacherAttendanceRepository.findTodayFor(teacher.id, startOfDay(today), endOfDay(today))

    if (!existing?.checkIn) throw new HttpError(400, 'No has registrado tu entrada hoy')
    if (existing.checkOut) {
      throw new HttpError(400, `${teacher.lastName} ${teacher.firstName} — ya registraste tu salida hoy a las ${fmtTime(existing.checkOut.toISOString())}`)
    }

    const attendance = await teacherAttendanceRepository.updateCheckOut(existing.id, today)

    return {
      message: `✅ ${teacher.lastName} ${teacher.firstName} — Salida registrada a las ${fmtTime(today.toISOString())}`,
      teacher, attendance,
    }
  },
}
