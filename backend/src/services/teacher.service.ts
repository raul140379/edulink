import bcrypt from 'bcryptjs'
import { Prisma, Role } from '@prisma/client'
import prisma from '../lib/prisma'
import { teacherRepository } from '../repositories/teacher.repository'
import { userRepository } from '../repositories/user.repository'
import { HttpError } from '../utils/http-error'
import { normalizeLetters, generateUniqueEmail } from '../utils/account-generator'
import { CreateTeacherInput, UpdateTeacherInput, AttendanceCodeInput, TeacherScheduleInput } from '../schemas/teacher.schema'

function generateTeacherPassword(lastName: string, ci?: string): string {
  const year = new Date().getFullYear()
  if (ci && ci.trim().length >= 4) return `maestro${ci.trim().slice(-4)}${year}`
  return `maestro${normalizeLetters(lastName.split(' ')[0]).slice(0, 4)}${year}`
}

function passwordHint(ci?: string): string {
  return ci
    ? 'Contraseña = maestro + últimos 4 dígitos del CI + año'
    : 'Contraseña = maestro + primeras 4 letras del apellido + año'
}

async function buildAttendanceCode(lastName: string): Promise<string> {
  const parts    = lastName.trim().split(/\s+/)
  const initial1 = normalizeLetters(parts[0]?.[0] || 'X')
  const initial2 = normalizeLetters(parts[1]?.[0] || parts[0]?.[1] || 'X')
  const month    = String(new Date().getMonth() + 1).padStart(2, '0')

  let code = ''
  let attempts = 0
  while (attempts < 20) {
    const digits = String(Math.floor(10 + Math.random() * 90))
    code = `${initial1}${initial2}${digits}${month}`
    const existing = await teacherRepository.findByAttendanceCode(code)
    if (!existing) break
    attempts++
  }
  return code
}

function buildWorkloadDetail(assignments: any[], includeHorasPorHorario: boolean, schoolSchedules: any[]) {
  let totalHoursPerWeek = 0

  const detail = assignments.map((a) => {
    const config = a.subject.gradeConfigs.find(
      (gc: any) => gc.grade === a.course.grade && gc.educationType === a.course.educationType
    )
    const hours = config?.hoursPerWeek ?? a.subject.hoursPerWeek
    totalHoursPerWeek += hours

    const periodosAsignados = a.schedules.filter((s: any) => s.academicYear?.isActive).length

    const base = {
      subjectId: a.subjectId, subjectName: a.subject.name, campo: a.subject.campo,
      courseId: a.courseId,
      courseLabel: `${a.course.grade} "${a.course.parallel}" ${a.course.shift === 'MORNING' ? 'Mañana' : 'Tarde'}`,
      grade: a.course.grade, parallel: a.course.parallel, shift: a.course.shift,
      educationType: a.course.educationType, hoursPerWeek: hours, periodosAsignados,
    }

    if (!includeHorasPorHorario) return base

    // 1 periodo (40 min) = 1 hora académica — sin convertir a minutos.
    const horasPorHorario = schoolSchedules.map((sh) => {
      const horasSemana = periodosAsignados
      const horasMes    = horasSemana * 4
      return { horarioId: sh.id, nombre: sh.name, turno: sh.shift, isWinter: sh.isWinter, minPeriodo: sh.periodDuration, horasSemana, horasMes }
    })

    return { ...base, horasPorHorario }
  })

  // 1 periodo (40 min) = 1 hora académica — sin convertir a minutos.
  const totalesPorHorario = schoolSchedules.map((sh) => {
    const totalPeriodos = detail.reduce((s, d) => s + d.periodosAsignados, 0)
    const horasSemana    = totalPeriodos
    const horasMes       = horasSemana * 4
    return { horarioId: sh.id, nombre: sh.name, turno: sh.shift, isWinter: sh.isWinter, minPeriodo: sh.periodDuration, totalPeriodos, horasSemana, horasMes }
  })

  return { totalHoursPerWeek, detail, totalesPorHorario }
}

export const teacherService = {
  listTeachers(search?: string, isActive?: string, subjectId?: string, campo?: string) {
    const where: Prisma.TeacherWhereInput = {
      isActive: true,
      ...(isActive !== undefined ? { isActive: isActive === 'true' } : {}),
      ...(search ? {
        OR: [
          { firstName: { contains: search, mode: 'insensitive' as const } },
          { lastName:  { contains: search, mode: 'insensitive' as const } },
          { ci:        { contains: search, mode: 'insensitive' as const } },
          { specialty: { contains: search, mode: 'insensitive' as const } },
        ],
      } : {}),
      ...((subjectId || campo) ? {
        specialties: {
          some: {
            ...(subjectId ? { subjectId: parseInt(subjectId) } : {}),
            ...(campo && !subjectId ? { subject: { campo: campo as any } } : {}),
          },
        },
      } : {}),
    }
    return teacherRepository.findMany(where)
  },

  async getTeacherById(id: number) {
    const teacher = await teacherRepository.findById(id)
    if (!teacher) throw new HttpError(404, 'Maestro no encontrado')
    return teacher
  },

  async getWorkloadById(id: number) {
    const teacher = await teacherRepository.findWithWorkloadById(id)
    if (!teacher) throw new HttpError(404, 'Maestro no encontrado')

    const schoolSchedules = await teacherRepository.findActiveSchoolSchedules()
    const { totalHoursPerWeek, detail, totalesPorHorario } = buildWorkloadDetail(teacher.assignments, false, schoolSchedules)

    return {
      teacher: { id: teacher.id, firstName: teacher.firstName, lastName: teacher.lastName, specialty: teacher.specialty },
      totalHoursPerWeek,
      horasContratadaMes: teacher.hoursLoad || 0,
      totalesPorHorario,
      assignments: detail,
    }
  },

  async getMyWorkload(userId: number | undefined) {
    const teacher = await teacherRepository.findWithWorkloadByUserId(userId)
    if (!teacher) throw new HttpError(404, 'Maestro no encontrado')

    const schoolSchedules = await teacherRepository.findActiveSchoolSchedules()
    const { totalHoursPerWeek, detail, totalesPorHorario } = buildWorkloadDetail(teacher.assignments, true, schoolSchedules)

    return { totalHoursPerWeek, horasContratadaMes: teacher.hoursLoad || 0, totalesPorHorario, assignments: detail }
  },

  async createTeacher(input: CreateTeacherInput) {
    const { firstName, lastName, ci, phone, email, specialty, birthDate, hoursLoad, gender } = input

    if (ci) {
      const existingCI = await teacherRepository.findByCI(ci)
      if (existingCI) throw new HttpError(409, `Ya existe un maestro con el CI ${ci}`)
    }

    let accessEmail: string
    if (email && email.trim() !== '') {
      const existing = await userRepository.findByEmail(email.trim())
      if (existing) throw new HttpError(409, `El correo ${email} ya está en uso`)
      accessEmail = email.trim()
    } else {
      accessEmail = await generateUniqueEmail(firstName, lastName)
    }

    const defaultPassword = generateTeacherPassword(lastName, ci)
    const hashedPassword  = await bcrypt.hash(defaultPassword, 10)

    // Transacción única (mismo patrón que userService.createUser con Staff):
    // si teacherRepository.createTx falla por cualquier motivo, el User
    // creado acá también se revierte — nunca queda un User huérfano sin su
    // Teacher (ver CLAUDE.md, incidente Silvia/Patricia Torrico 4-sep-2026).
    const { user, teacher } = await prisma.$transaction(async (tx) => {
      const user = await userRepository.createTx(tx, { email: accessEmail, password: hashedPassword, role: Role.TEACHER })

      const teacher = await teacherRepository.createTx(tx, {
        firstName, lastName,
        ci:        ci        || null,
        phone:     phone     || null,
        email:     email     || null,
        specialty: specialty || null,
        birthDate: birthDate ? new Date(birthDate) : null,
        hoursLoad: hoursLoad ?? null,
        gender:    gender    || null,
        isActive:  true,
        userId:    user.id,
        schoolId:  user.schoolId!,
      })

      return { user, teacher }
    })

    return { teacher, accessEmail, defaultPassword, passwordHint: passwordHint(ci) }
  },

  async updateTeacher(id: number, input: UpdateTeacherInput) {
    const existing = await teacherRepository.findRaw(id)
    if (!existing) throw new HttpError(404, 'Maestro no encontrado')

    const { firstName, lastName, ci, phone, email, specialty, birthDate, hoursLoad, gender } = input

    if (ci && ci !== existing.ci) {
      const dup = await teacherRepository.findByCI(ci)
      if (dup) throw new HttpError(409, `Ya existe un maestro con el CI ${ci}`)
    }

    const data: Prisma.TeacherUpdateInput = {
      ...(firstName !== undefined ? { firstName } : {}),
      ...(lastName  !== undefined ? { lastName  } : {}),
      ...(ci        !== undefined ? { ci:        ci        || null } : {}),
      ...(phone     !== undefined ? { phone:     phone     || null } : {}),
      ...(email     !== undefined ? { email:     email     || null } : {}),
      ...(specialty !== undefined ? { specialty: specialty || null } : {}),
      ...(birthDate !== undefined ? { birthDate: birthDate ? new Date(birthDate) : null } : {}),
      ...(hoursLoad !== undefined ? { hoursLoad: hoursLoad ?? null } : {}),
      ...(gender    !== undefined ? { gender:    gender    || null } : {}),
    }

    return teacherRepository.update(id, data)
  },

  async toggleTeacherStatus(id: number) {
    const teacher = await teacherRepository.findRaw(id)
    if (!teacher) throw new HttpError(404, 'Maestro no encontrado')

    const newStatus = !teacher.isActive
    await teacherRepository.setActive(id, newStatus)
    if (teacher.userId) await userRepository.update(teacher.userId, { isActive: newStatus })

    return newStatus
  },

  async deleteTeacher(id: number) {
    const teacher = await teacherRepository.countAssignments(id)
    if (!teacher) throw new HttpError(404, 'Maestro no encontrado')

    if (teacher._count.assignments > 0) {
      throw new HttpError(400, `No se puede eliminar: tiene ${teacher._count.assignments} asignación(es) de materia. Desactívalo en su lugar.`)
    }

    // Teacher.userId es obligatorio (NOT NULL) — a diferencia de Student, no se puede
    // desvincular antes de borrar. Hay que borrar el Teacher primero y el User después.
    const savedUserId = teacher.userId
    await teacherRepository.delete(id)
    await userRepository.delete(savedUserId)
  },

  async getMyCourse(userId: number | undefined) {
    const teacher = await teacherRepository.findMyCourseByUserId(userId)
    if (!teacher) throw new HttpError(404, 'Maestro no encontrado')
    if (!teacher.tutorCourse) throw new HttpError(404, 'No tienes un curso asignado como tutor')
    return teacher.tutorCourse.course
  },

  async setAttendanceCode(id: number, input: AttendanceCodeInput) {
    const codeUpper = input.code.trim().toUpperCase()

    const existing = await teacherRepository.findByAttendanceCodeExcluding(codeUpper, id)
    if (existing) throw new HttpError(409, `El código ${codeUpper} ya está en uso por otro maestro`)

    return teacherRepository.updateAttendanceCode(id, codeUpper)
  },

  async generateAttendanceCode(id: number) {
    const teacher = await teacherRepository.findRaw(id)
    if (!teacher) throw new HttpError(404, 'Maestro no encontrado')

    const code = await buildAttendanceCode(teacher.lastName)
    return teacherRepository.updateAttendanceCode(id, code)
  },

  setTeacherSchedule(id: number, input: TeacherScheduleInput) {
    return teacherRepository.updateSchedule(id, input)
  },
}
