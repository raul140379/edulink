import { gateRepository } from '../repositories/gate.repository'
import { HttpError } from '../utils/http-error'
import {
  RegisterStudentInput, RegisterTeacherInput, RegisterStaffInput, RegisterVisitorInput,
} from '../schemas/gate.schema'

function startOfDay(d: Date) { const s = new Date(d); s.setHours(0, 0, 0, 0); return s }
function endOfDay(d: Date) { const e = new Date(d); e.setHours(23, 59, 59, 999); return e }
function parseTime(t: string) { const [h, m] = t.split(':').map(Number); return h * 60 + m }

// El contenedor de producción no tiene TZ configurada (Node corre en UTC,
// confirmado 29-ago-2026: el servidor calculaba ~4h adelantado de la hora
// real de Bolivia) — todas las comparaciones contra horas de reloj
// (startTime/exitTime/tolerancia/ventana del portal) deben convertir a hora
// de Bolivia explícitamente (UTC-4 fijo, el país no usa horario de verano)
// en vez de usar getHours()/getMinutes() del proceso, que reflejan la hora
// del servidor, no la del colegio.
const BOLIVIA_UTC_OFFSET_MIN = -4 * 60
function nowMinutesBolivia(now: Date): number {
  const utcMin = now.getUTCHours() * 60 + now.getUTCMinutes()
  return ((utcMin + BOLIVIA_UTC_OFFSET_MIN) % 1440 + 1440) % 1440
}

// Horario fijo del módulo de portería (abierto para registrar entradas/
// salidas), independiente del horario real de turnos (SchoolSchedule.
// startTime/exitTime, que sigue usándose tal cual para generar el horario de
// clases y para el aviso de "turno por finalizar" de maestros) — a pedido de
// Raul, 29-ago-2026: dejar el reloj de asistencia abierto de 7:00 a 23:00
// (hora de Bolivia).
const GATE_OPEN_MIN  = 7 * 60
const GATE_CLOSE_MIN = 23 * 60
function isGateClosedNow(now: Date): boolean {
  const nowMin = nowMinutesBolivia(now)
  return nowMin < GATE_OPEN_MIN || nowMin > GATE_CLOSE_MIN
}

function makeCode(firstName: string, lastName: string): string {
  const parts = [...firstName.trim().split(' '), ...lastName.trim().split(' ')]
  const initials = parts.filter((p) => p.length > 0).slice(0, 3).map((p) => p[0].toUpperCase()).join('')
  const nums = Math.floor(1000 + Math.random() * 9000)
  return `${initials}-${nums}`
}

export const gateService = {
  async getTeacherByCode(code: string) {
    const teacher = await gateRepository.findTeacherByAttendanceCode(code.toUpperCase())
    if (!teacher) throw new HttpError(404, 'Código no encontrado')
    if (!teacher.isActive) throw new HttpError(400, 'Maestro inactivo')

    const today = startOfDay(new Date())
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1)

    const lastRecord = await gateRepository.findLastGateRecord({ teacherId: teacher.id, type: 'MAESTRO', createdAt: { gte: today, lt: tomorrow } })
    const nextAction = !lastRecord || lastRecord.action === 'SALIDA' ? 'ENTRADA' : 'SALIDA'
    return { teacher, nextAction, lastRecord }
  },

  async getStudentByCode(code: string) {
    const student = await gateRepository.findStudentByRude(code.toUpperCase())
    if (!student) throw new HttpError(404, 'RUDE no encontrado')
    if (!student.isActive) throw new HttpError(400, 'Estudiante inactivo')

    const today = startOfDay(new Date())
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1)

    const lastRecord = await gateRepository.findLastGateRecord({ studentId: student.id, type: 'ESTUDIANTE', createdAt: { gte: today, lt: tomorrow } })
    const nextAction = !lastRecord || lastRecord.action === 'SALIDA' ? 'ENTRADA' : 'SALIDA'
    return { student, nextAction, lastRecord }
  },

  async registerStudent(userId: number | undefined, input: RegisterStudentInput) {
    const student = await gateRepository.findStudentById(input.studentId)
    if (!student) throw new HttpError(404, 'Estudiante no encontrado')

    const record = await gateRepository.createGateRecordWithInclude(
      { type: 'ESTUDIANTE', action: input.action, method: input.method || 'MANUAL', studentId: input.studentId, registeredById: userId, note: input.note || null },
      { student: { select: { id: true, firstName: true, lastName: true, rude: true } } }
    )

    return { message: `${input.action} de ${student.lastName} ${student.firstName} registrada`, record }
  },

  async getStaffByCode(code: string) {
    const staff = await gateRepository.findStaffByAttendanceCode(code.toUpperCase())
    if (!staff) throw new HttpError(404, 'Código no encontrado')
    if (!staff.isActive) throw new HttpError(400, 'Personal inactivo')

    const today = startOfDay(new Date())
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1)

    const lastRecord = await gateRepository.findLastGateRecord({ staffId: staff.id, type: 'ADMINISTRATIVO', createdAt: { gte: today, lt: tomorrow } })
    const nextAction = !lastRecord || lastRecord.action === 'SALIDA' ? 'ENTRADA' : 'SALIDA'
    return { staff, nextAction, lastRecord }
  },

  async getExpectedToday() {
    const now = new Date()
    const todayDow = now.getDay()
    const today = startOfDay(now)
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1)

    const schedule = await gateRepository.findActiveSchoolSchedule()
    if (!schedule) throw new HttpError(404, 'No hay horario activo')

    const exitMin = parseTime(schedule.exitTime)
    const nowMin = nowMinutesBolivia(now)
    const diffToExit = exitMin - nowMin
    const windowOpen = diffToExit >= 0 && diffToExit <= 30
    const isClosed = isGateClosedNow(now)

    const schedulesToday = await gateRepository.findSchedulesForDay(todayDow)

    const teacherMap = new Map<number, any>()
    for (const s of schedulesToday) {
      const t = s.teacherSubjectCourse?.teacher
      if (t && !teacherMap.has(t.id)) teacherMap.set(t.id, t)
    }
    const teachersToday = Array.from(teacherMap.values())
    const teacherIds = teachersToday.map((t) => t.id)

    const teacherRecords = await gateRepository.findGateRecordsByCriteria({ teacherId: { in: teacherIds }, type: 'MAESTRO', action: 'ENTRADA', createdAt: { gte: today, lt: tomorrow } })
    const teacherRecordMap = new Map(teacherRecords.map((r) => [r.teacherId, r]))

    const teacherAttendances = await gateRepository.findTeacherAttendances(teacherIds, today, endOfDay(now))
    const attendanceMap = new Map(teacherAttendances.map((a) => [a.teacherId, a]))

    const teachers = teachersToday.map((t) => ({
      id: t.id, firstName: t.firstName, lastName: t.lastName, ci: t.ci, attendanceCode: t.attendanceCode,
      category: 'MAESTRO',
      gateRecord: teacherRecordMap.get(t.id) || null,
      attendance: attendanceMap.get(t.id) || null,
      registered: teacherRecordMap.has(t.id),
      isAbsent: attendanceMap.get(t.id)?.status === 'AUSENTE',
    }))

    const allTeachers = await gateRepository.findActiveTeachers()

    const visitorRecords = await gateRepository.findGateRecordsByCriteria({ type: 'VISITANTE', action: 'ENTRADA', reason: 'Maestro - Sin clases hoy', createdAt: { gte: today, lt: tomorrow } })
    const visitorNameSet = new Set(visitorRecords.map((r) => r.visitorName))

    const teachersWithoutPeriods = allTeachers
      .filter((t) => !teacherIds.includes(t.id))
      .map((t) => ({
        id: t.id, firstName: t.firstName, lastName: t.lastName, ci: t.ci, attendanceCode: t.attendanceCode,
        category: 'MAESTRO_VISITANTE',
        gateRecord: visitorRecords.find((r) => r.visitorName === `${t.lastName} ${t.firstName}`) || null,
        attendance: null,
        registered: visitorNameSet.has(`${t.lastName} ${t.firstName}`),
        isAbsent: false,
      }))

    const staffList = await gateRepository.findActiveStaff()
    const staffIds = staffList.map((s) => s.id)
    const staffRecords = await gateRepository.findGateRecordsByCriteria({ staffId: { in: staffIds }, type: 'ADMINISTRATIVO', action: 'ENTRADA', createdAt: { gte: today, lt: tomorrow } })
    const staffRecordMap = new Map(staffRecords.map((r) => [r.staffId, r]))

    const staff = staffList.map((s) => ({
      id: s.id, firstName: s.firstName, lastName: s.lastName, ci: s.ci, attendanceCode: s.attendanceCode,
      category: s.staffRole,
      gateRecord: staffRecordMap.get(s.id) || null,
      registered: staffRecordMap.has(s.id),
      isAbsent: false,
    }))

    return {
      schedule: { startTime: schedule.startTime, exitTime: schedule.exitTime, windowOpen, isClosed, minutesBeforeExit: Math.max(0, diffToExit) },
      teachers, teachersWithoutPeriods, staff,
      summary: {
        teachersExpected: teachers.length,
        teachersRegistered: teachers.filter((t) => t.registered).length,
        teachersWithoutPeriods: teachersWithoutPeriods.length,
        teachersVisitorRegistered: teachersWithoutPeriods.filter((t) => t.registered).length,
        staffExpected: staff.length,
        staffRegistered: staff.filter((s) => s.registered).length,
      },
    }
  },

  async registerTeacher(userId: number | undefined, input: RegisterTeacherInput) {
    const teacher = await gateRepository.findTeacherById(input.teacherId)
    if (!teacher) throw new HttpError(404, 'Maestro no encontrado')

    if (input.action === 'ENTRADA') {
      const now = new Date()
      if (isGateClosedNow(now)) throw new HttpError(400, 'El módulo de portería está cerrado.')

      const schedule = await gateRepository.findActiveSchoolSchedule()
      if (schedule) {
        const exitMin = parseTime(schedule.exitTime)
        const nowMin = nowMinutesBolivia(now)
        if (nowMin > exitMin) throw new HttpError(400, 'El turno ya finalizó. No se puede registrar entrada.')
      }

      const todayDow = new Date().getDay()
      const hasPeriodsToday = await gateRepository.hasPeriodsToday(input.teacherId, todayDow)

      if (!hasPeriodsToday) {
        const record = await gateRepository.createGateRecord({
          type: 'VISITANTE', action: 'ENTRADA', method: input.method || 'MANUAL',
          visitorName: `${teacher.lastName} ${teacher.firstName}`, reason: 'Maestro - Sin clases hoy',
          registeredById: userId, note: `Código: ${teacher.attendanceCode || ''}`,
        })
        return { message: `${teacher.firstName} ${teacher.lastName} no tiene clases hoy — registrado como visitante`, record, asVisitor: true }
      }

      const todayAtt = await gateRepository.findTeacherAttendanceForDay(input.teacherId, startOfDay(now), endOfDay(now))
      if (todayAtt?.status === 'AUSENTE') throw new HttpError(400, `${teacher.firstName} ${teacher.lastName} ya fue marcado como AUSENTE para hoy`)
    }

    const record = await gateRepository.createGateRecordWithInclude(
      { type: 'MAESTRO', action: input.action, method: input.method || 'MANUAL', teacherId: input.teacherId, registeredById: userId, note: input.note || null },
      { teacher: { select: { id: true, firstName: true, lastName: true, attendanceCode: true } } }
    )

    if (input.action === 'ENTRADA') {
      const now = new Date()
      const schedule = await gateRepository.findActiveSchoolSchedule()
      const startMin = schedule ? parseTime(schedule.startTime) : 8 * 60
      const nowMin = nowMinutesBolivia(now)
      const tolerance = teacher.toleranceMin ?? 10
      const isRetraso = nowMin > startMin + tolerance

      const existing = await gateRepository.findTeacherAttendanceForDay(input.teacherId, startOfDay(now), endOfDay(now))

      if (existing) {
        await gateRepository.updateTeacherAttendance(existing.id, { checkIn: now, status: isRetraso ? 'RETRASO' : 'PRESENTE' })
      } else {
        await gateRepository.createTeacherAttendance({ teacherId: input.teacherId, date: now, checkIn: now, status: isRetraso ? 'RETRASO' : 'PRESENTE' })
      }
    }

    return { message: `${input.action} de ${teacher.lastName} ${teacher.firstName} registrada`, record }
  },

  async registerStaff(userId: number | undefined, input: RegisterStaffInput) {
    const staff = await gateRepository.findStaffById(input.staffId)
    if (!staff) throw new HttpError(404, 'Personal no encontrado')

    if (input.action === 'ENTRADA' && isGateClosedNow(new Date())) {
      throw new HttpError(400, 'El módulo de portería está cerrado.')
    }

    const record = await gateRepository.createGateRecordWithInclude(
      { type: 'ADMINISTRATIVO', action: input.action, method: input.method || 'MANUAL', staffId: input.staffId, registeredById: userId, note: input.note || null },
      { staff: { select: { id: true, firstName: true, lastName: true, staffRole: true } } }
    )

    return { message: `${input.action} de ${staff.lastName} ${staff.firstName} registrada`, record }
  },

  async registerVisitor(userId: number | undefined, input: RegisterVisitorInput) {
    if (input.action === 'ENTRADA' && isGateClosedNow(new Date())) {
      throw new HttpError(400, 'El módulo de portería está cerrado.')
    }

    const record = await gateRepository.createGateRecord({
      type: 'VISITANTE', action: input.action, method: 'MANUAL',
      visitorName: input.visitorName, visitorCI: input.visitorCI || null, reason: input.reason || null,
      destination: input.destination || null, registeredById: userId, note: input.note || null,
    })

    return { message: `${input.action} de visitante "${input.visitorName}" registrada`, record }
  },

  async markAbsentTeachers() {
    const now = new Date()
    const todayDow = now.getDay()
    const today = startOfDay(now)
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1)

    const schedulesToday = await gateRepository.findSchedulesForDaySimple(todayDow)
    const teacherIds = [...new Set(schedulesToday.map((s) => s.teacherSubjectCourse?.teacherId).filter(Boolean) as number[])]

    const withEntry = await gateRepository.findGateRecordsByCriteria({ teacherId: { in: teacherIds }, type: 'MAESTRO', action: 'ENTRADA', createdAt: { gte: today, lt: tomorrow } })
    const withEntryIds = new Set(withEntry.map((r) => r.teacherId))
    const absentIds = teacherIds.filter((id) => !withEntryIds.has(id))

    let count = 0
    for (const teacherId of absentIds) {
      const existing = await gateRepository.findTeacherAttendanceForDay(teacherId, today, endOfDay(now))
      if (!existing) {
        await gateRepository.createTeacherAttendance({ teacherId, date: now, status: 'AUSENTE' })
        count++
      } else if (existing.status !== 'AUSENTE' && !existing.checkIn) {
        await gateRepository.updateTeacherAttendance(existing.id, { status: 'AUSENTE' })
        count++
      }
    }

    return { message: `${count} maestros marcados como AUSENTE`, count }
  },

  async getRecords(date: string | undefined, type: string | undefined, action: string | undefined) {
    const base = date ? new Date(date) : new Date()
    base.setHours(0, 0, 0, 0)
    const next = new Date(base); next.setDate(next.getDate() + 1)

    const records = await gateRepository.findGateRecords(
      { createdAt: { gte: base, lt: next }, ...(type ? { type } : {}), ...(action ? { action } : {}) },
      { teacher: { select: { id: true, firstName: true, lastName: true } }, staff: { select: { id: true, firstName: true, lastName: true, staffRole: true } } },
      { createdAt: 'desc' }
    )

    const summary = {
      total: records.length,
      maestros: records.filter((r) => r.type === 'MAESTRO').length,
      administrativos: records.filter((r) => r.type === 'ADMINISTRATIVO').length,
      visitantes: records.filter((r) => r.type === 'VISITANTE').length,
      entradas: records.filter((r) => r.action === 'ENTRADA').length,
      salidas: records.filter((r) => r.action === 'SALIDA').length,
    }

    return { records, summary }
  },

  async getTodayTeachers() {
    const today = startOfDay(new Date())
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1)

    const records = await gateRepository.findGateRecords(
      { type: 'MAESTRO', createdAt: { gte: today, lt: tomorrow } },
      { teacher: { select: { id: true, firstName: true, lastName: true } } },
      { createdAt: 'desc' }
    )

    const byTeacher: Record<number, any> = {}
    for (const r of records) {
      if (r.teacherId && !byTeacher[r.teacherId]) byTeacher[r.teacherId] = r
    }

    return Object.values(byTeacher)
  },

  async generateAttendanceCodes() {
    const teachers = await gateRepository.findTeachersWithoutCode()

    let teacherCount = 0
    for (const t of teachers) {
      let code = makeCode(t.firstName, t.lastName)
      let exists = await gateRepository.findTeacherByCode(code)
      while (exists) {
        code = makeCode(t.firstName, t.lastName)
        exists = await gateRepository.findTeacherByCode(code)
      }
      await gateRepository.updateTeacherCode(t.id, code)
      teacherCount++
    }

    const staffList = await gateRepository.findStaffWithoutCode()

    let staffCount = 0
    for (const s of staffList) {
      let code = makeCode(s.firstName, s.lastName)
      let exists = await gateRepository.findStaffByCode(code)
      while (exists) {
        code = makeCode(s.firstName, s.lastName)
        exists = await gateRepository.findStaffByCode(code)
      }
      await gateRepository.updateStaffCode(s.id, code)
      staffCount++
    }

    return { message: `Códigos generados: ${teacherCount} maestros, ${staffCount} personal`, teacherCount, staffCount }
  },

  async getAttendanceCodes() {
    const teachers = await gateRepository.findAllActiveTeachersWithCodes()
    const staff = await gateRepository.findAllActiveStaffWithCodes()
    return { teachers, staff }
  },

  async regenerateCode(type: string, id: number) {
    if (type === 'teacher') {
      const teacher = await gateRepository.findTeacherById(id)
      if (!teacher) throw new HttpError(404, 'Maestro no encontrado')

      let code = makeCode(teacher.firstName, teacher.lastName)
      let exists = await gateRepository.findTeacherByCode(code)
      while (exists) {
        code = makeCode(teacher.firstName, teacher.lastName)
        exists = await gateRepository.findTeacherByCode(code)
      }
      await gateRepository.updateTeacherCode(id, code)
      return { message: 'Código regenerado', attendanceCode: code }
    }

    if (type === 'staff') {
      const staff = await gateRepository.findStaffById(id)
      if (!staff) throw new HttpError(404, 'Personal no encontrado')

      let code = makeCode(staff.firstName, staff.lastName)
      let exists = await gateRepository.findStaffByCode(code)
      while (exists) {
        code = makeCode(staff.firstName, staff.lastName)
        exists = await gateRepository.findStaffByCode(code)
      }
      await gateRepository.updateStaffCode(id, code)
      return { message: 'Código regenerado', attendanceCode: code }
    }

    throw new HttpError(400, 'Tipo inválido')
  },
}
