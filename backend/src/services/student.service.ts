import bcrypt from 'bcryptjs'
import * as XLSX from 'xlsx'
import { Prisma, Role } from '@prisma/client'
import { studentRepository } from '../repositories/student.repository'
import { userRepository } from '../repositories/user.repository'
import { parentRepository } from '../repositories/parent.repository'
import { taskRepository } from '../repositories/task.repository'
import { gamificationService } from './gamification.service'
import { HttpError } from '../utils/http-error'
import { getTenantContext } from '../lib/tenant-context'
import { Permission, hasPermission } from '../config/permissions'
import { normalizeLetters, generateUniqueEmail, generateParentPassword } from '../utils/account-generator'
import {
  CreateStudentInput, UpdateStudentInput, EnrollInput, AutoEvaluacionInput,
} from '../schemas/student.schema'
import { Pagination } from '../utils/pagination'

const BTH_GRADES = ['TERCERO', 'CUARTO', 'QUINTO', 'SEXTO']

const generateEmail = generateUniqueEmail

function generateStudentPassword(lastName: string, rude?: string | null): string {
  if (rude && rude.trim() !== '') return rude.trim()
  const year = new Date().getFullYear()
  return `${normalizeLetters(lastName.split(' ')[0]).slice(0, 4)}${year}`
}

function passwordHint(rude?: string | null): string {
  return rude ? 'Contraseña = RUDE del estudiante' : 'Contraseña = primeras 4 letras del apellido + año'
}

function calcTotal(saber: number | null, hacer: number | null, ser: number | null, autoEval: number | null): number | null {
  const vals = [saber, hacer, ser, autoEval].filter((v) => v !== null) as number[]
  return vals.length > 0 ? Math.round(vals.reduce((a, b) => a + b, 0) * 100) / 100 : null
}

export const studentService = {
  async listStudents(search?: string, isActive?: string, pagination?: Pagination) {
    const searchWords = search ? search.split(' ').filter((w) => w.trim().length > 0) : []

    const where: Prisma.StudentWhereInput = {
      ...(isActive !== undefined ? { isActive: isActive === 'true' } : {}),
      ...(searchWords.length > 0 ? {
        OR: searchWords.flatMap((word) => [
          { firstName: { contains: word, mode: 'insensitive' as const } },
          { lastName:  { contains: word, mode: 'insensitive' as const } },
          { ci:        { contains: word, mode: 'insensitive' as const } },
          { rude:      { contains: word, mode: 'insensitive' as const } },
        ]),
      } : {}),
    }

    // Junta de Núcleo/Distrito solo tiene STUDENT_VIEW_BASIC (no STUDENT_VIEW_ALL) —
    // ve nombre/colegio/padre/dirección, nunca notas/asistencia/kardex.
    if (studentService.isBasicViewOnly()) return studentRepository.findManyBasic(where, pagination)

    // TEACHER/TEACHER_TUTOR: STUDENT_VIEW_ALL acá significa "todos los
    // estudiantes de SUS cursos", no de todo el colegio — antes no había
    // ningún filtro y devolvía el colegio entero (mismo patrón de fuga que
    // DELEGATE, ver auditoría de seguridad).
    const ctx = getTenantContext()
    if (ctx?.role === Role.TEACHER || ctx?.role === Role.TEACHER_TUTOR) {
      const courseIds = await studentRepository.findTeacherCourseIds(ctx.userId)
      if (courseIds.length === 0) return []
      where.assignments = { some: { courseId: { in: courseIds } } }
    }

    return studentRepository.findMany(where, pagination)
  },

  async getStudentById(id: number) {
    if (studentService.isBasicViewOnly()) {
      const student = await studentRepository.findByIdBasic(id)
      if (!student) throw new HttpError(404, 'Estudiante no encontrado')
      return student
    }
    const student = await studentRepository.findById(id)
    if (!student) throw new HttpError(404, 'Estudiante no encontrado')

    // Mismo candado que listStudents — un TEACHER/TEACHER_TUTOR solo puede
    // ver el detalle de estudiantes de sus propios cursos.
    const ctx = getTenantContext()
    if (ctx?.role === Role.TEACHER || ctx?.role === Role.TEACHER_TUTOR) {
      const courseIds = await studentRepository.findTeacherCourseIds(ctx.userId)
      const inMyCourse = student.assignments.some((a) => courseIds.includes(a.courseId))
      if (!inMyCourse) throw new HttpError(403, 'Solo podés ver estudiantes de tus propios cursos')
    }

    return student
  },

  isBasicViewOnly() {
    const ctx = getTenantContext()
    if (!ctx) return false
    return hasPermission(ctx.role, Permission.STUDENT_VIEW_BASIC) && !hasPermission(ctx.role, Permission.STUDENT_VIEW_ALL)
  },

  getStudentEnrollments(id: number) {
    return studentRepository.findEnrollments(id)
  },

  async createStudent(input: CreateStudentInput) {
    const { firstName, lastName, ci, rude, birthDate, phone, email, address, gender } = input

    if (ci) {
      const existingCI = await studentRepository.findByCI(ci)
      if (existingCI) throw new HttpError(409, `Ya existe un estudiante con el CI ${ci}`)
    }
    if (rude) {
      const existingRUDE = await studentRepository.findByRude(rude)
      if (existingRUDE) throw new HttpError(409, `Ya existe un estudiante con el RUDE ${rude}`)
    }

    const generatedEmail  = await generateEmail(firstName, lastName)
    const defaultPassword = generateStudentPassword(lastName, rude)
    const hashedPassword  = await bcrypt.hash(defaultPassword, 10)

    const user = await userRepository.create({ email: generatedEmail, password: hashedPassword, role: Role.STUDENT })

    const student = await studentRepository.create({
      firstName, lastName, gender,
      ci:        ci        || null,
      rude:      rude      || null,
      birthDate: birthDate ? new Date(birthDate) : null,
      phone:     phone     || null,
      email:     email     || null,
      address:   address   || null,
      userId:    user.id,
    })

    return {
      student,
      accessEmail:  generatedEmail,
      defaultPassword,
      passwordHint: passwordHint(rude),
    }
  },

  async updateStudent(id: number, input: UpdateStudentInput) {
    const existing = await studentRepository.findRaw(id)
    if (!existing) throw new HttpError(404, 'Estudiante no encontrado')

    const { firstName, lastName, ci, rude, birthDate, phone, email, address, gender } = input

    if (ci && ci !== existing.ci) {
      const dup = await studentRepository.findByCI(ci)
      if (dup) throw new HttpError(409, `Ya existe un estudiante con el CI ${ci}`)
    }
    if (rude && rude !== existing.rude) {
      const dup = await studentRepository.findByRude(rude)
      if (dup) throw new HttpError(409, `Ya existe un estudiante con el RUDE ${rude}`)
    }

    const data: Prisma.StudentUpdateInput = {
      ...(firstName !== undefined ? { firstName } : {}),
      ...(lastName  !== undefined ? { lastName  } : {}),
      ...(ci        !== undefined ? { ci:      ci      || null } : {}),
      ...(rude      !== undefined ? { rude:    rude    || null } : {}),
      ...(birthDate !== undefined ? { birthDate: birthDate ? new Date(birthDate) : null } : {}),
      ...(phone     !== undefined ? { phone:   phone   || null } : {}),
      ...(email     !== undefined ? { email:   email   || null } : {}),
      ...(address   !== undefined ? { address: address || null } : {}),
      ...(gender    !== undefined ? { gender } : {}),
    }

    return studentRepository.update(id, data)
  },

  async toggleStudentStatus(id: number) {
    const student = await studentRepository.findRaw(id)
    if (!student) throw new HttpError(404, 'Estudiante no encontrado')
    return studentRepository.setActive(id, !student.isActive)
  },

  async deleteStudent(id: number) {
    const student = await studentRepository.countAssignments(id)
    if (!student) throw new HttpError(404, 'Estudiante no encontrado')

    if (student._count.assignments > 0) {
      throw new HttpError(400, `No se puede eliminar porque tiene ${student._count.assignments} inscripción(es). Desactívalo en su lugar.`)
    }

    await studentRepository.deleteRelatedRecords(id)

    if (student.userId) {
      const savedUserId = student.userId
      await studentRepository.unlinkUser(id)
      await userRepository.delete(savedUserId)
    }

    await studentRepository.delete(id)
  },

  async generateCredentials(id: number) {
    const student = await studentRepository.findRaw(id)
    if (!student) throw new HttpError(404, 'Estudiante no encontrado')
    if (student.userId) throw new HttpError(400, 'El estudiante ya tiene un usuario asignado')

    const generatedEmail  = await generateEmail(student.firstName, student.lastName)
    const defaultPassword = generateStudentPassword(student.lastName, student.rude)
    const hashedPassword  = await bcrypt.hash(defaultPassword, 10)

    const user = await userRepository.create({ email: generatedEmail, password: hashedPassword, role: Role.STUDENT })
    await studentRepository.linkUser(id, user.id)

    return { accessEmail: generatedEmail, defaultPassword, passwordHint: passwordHint(student.rude) }
  },

  async enrollStudent(id: number, input: EnrollInput) {
    const student = await studentRepository.findRaw(id)
    if (!student) throw new HttpError(404, 'Estudiante no encontrado')

    const activeYear = await studentRepository.findActiveAcademicYear()
    if (!activeYear) throw new HttpError(400, 'No hay gestión académica activa')

    const course = await studentRepository.findCourseById(input.courseId)
    if (!course) throw new HttpError(404, 'Curso no encontrado')

    const eduType = input.educationType || course.educationType

    const existingEnrollment = await studentRepository.findEnrollment(id, activeYear.id, eduType)
    if (existingEnrollment) {
      throw new HttpError(409, `El estudiante ya está inscrito en un curso ${eduType} en la gestión ${activeYear.year}`)
    }

    if (eduType === 'BTH' && (course.level !== 'SECUNDARIA' || !BTH_GRADES.includes(course.grade))) {
      throw new HttpError(400, 'El curso BTH solo aplica en Secundaria desde 3° grado')
    }

    const enrollment = await studentRepository.createEnrollment({
      studentId: id, courseId: input.courseId, academicYearId: activeYear.id,
      educationType: eduType, year: activeYear.year,
    })

    return { enrollment, year: activeYear.year }
  },

  async changeEnrollment(id: number, courseId: number) {
    const activeYear = await studentRepository.findActiveAcademicYear()
    if (!activeYear) throw new HttpError(400, 'No hay gestión académica activa')

    const course = await studentRepository.findCourseById(courseId)
    if (!course) throw new HttpError(404, 'Curso no encontrado')

    await studentRepository.deleteEnrollmentsForYear(id, activeYear.id)

    return studentRepository.createEnrollment({
      studentId: id, courseId, academicYearId: activeYear.id,
      educationType: course.educationType, year: activeYear.year,
    })
  },

  async cancelEnrollment(id: number) {
    const activeYear = await studentRepository.findActiveAcademicYear()
    if (!activeYear) throw new HttpError(400, 'No hay gestión académica activa')

    const existing = await studentRepository.findEnrollmentForYear(id, activeYear.id)
    if (!existing) throw new HttpError(404, 'El estudiante no tiene inscripción activa en esta gestión')

    await studentRepository.deleteEnrollmentById(existing.id)
    return existing.course
  },

  getStudentsByCourse: async (courseId: number) => {
    const activeYear = await studentRepository.findActiveAcademicYear()
    if (!activeYear) throw new HttpError(400, 'No hay gestión académica activa')
    return studentRepository.findByCourseInYear(courseId, activeYear.id)
  },

  // ── Autoservicio ──────────────────────────────
  async getMyProfile(userId: number | undefined) {
    const student = await studentRepository.findProfileByUserId(userId)
    if (!student) throw new HttpError(404, 'Estudiante no encontrado')

    const assignment = student.assignments[0]
    return {
      id: student.id, firstName: student.firstName, lastName: student.lastName,
      ci: student.ci, rude: student.rude, kardex: student.kardex,
      birthDate: student.birthDate, gender: student.gender, phone: student.phone,
      email: student.email, address: student.address,
      course:       assignment?.course       ?? null,
      academicYear: assignment?.academicYear ?? null,
      tutor:        student.parents[0]?.parent ?? null,
    }
  },

  async getMyGrades(userId: number | undefined) {
    const student = await studentRepository.findActiveAssignmentByUserId(userId)
    if (!student) throw new HttpError(404, 'Estudiante no encontrado')

    const assignment = student.assignments[0]
    if (!assignment) return { notas: [], course: null, academicYear: null, trimestres: [] }

    const trimestres = await studentRepository.findTrimestersByAcademicYear(assignment.academicYearId)
    const notas = await studentRepository.findNotasDetailed(student.id, assignment.courseId, trimestres.map((t) => t.id))

    const bySubject: Record<number, {
      subjectId: number; subjectName: string; campo: string | null
      teacher: string; trimestres: Record<number, number>; avg: number | null
    }> = {}

    for (const n of notas) {
      if (!bySubject[n.subjectId]) {
        bySubject[n.subjectId] = {
          subjectId: n.subjectId, subjectName: n.subject.name, campo: n.subject.campo,
          teacher: `${n.teacher.firstName} ${n.teacher.lastName}`, trimestres: {}, avg: null,
        }
      }
      bySubject[n.subjectId].trimestres[n.trimesterId] = n.total ?? 0
    }

    for (const s of Object.values(bySubject)) {
      const vals = Object.values(s.trimestres)
      if (vals.length > 0) s.avg = parseFloat((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2))
    }

    return { course: assignment.course, academicYear: assignment.academicYear, trimestres, notas: Object.values(bySubject) }
  },

  async getMyTasks(userId: number | undefined) {
    const student = await studentRepository.findActiveAssignmentByUserId(userId)
    if (!student) throw new HttpError(404, 'Estudiante no encontrado')

    const assignment = student.assignments[0]
    if (!assignment) return []

    const tasks = await studentRepository.findTasksForCourse(assignment.courseId, assignment.academicYearId, student.id)

    return tasks.map((t) => ({
      id: t.id, title: t.title, description: t.description, type: t.type,
      maxScore: t.maxScore, dueDate: t.dueDate, subject: t.subject,
      teacher: `${t.teacher.firstName} ${t.teacher.lastName}`, trimester: t.trimester,
      submissionId: t.submissions[0]?.id         ?? null,
      score:        t.submissions[0]?.score      ?? null,
      status:       t.submissions[0]?.status     ?? 'PENDIENTE',
      note:         t.submissions[0]?.note       ?? null,
      submittedAt:  t.submissions[0]?.submittedAt ?? null,
      gradedAt:     t.submissions[0]?.updatedAt   ?? null,
    }))
  },

  async getMySubjects(userId: number | undefined) {
    const student = await studentRepository.findActiveAssignmentByUserId(userId)
    if (!student) throw new HttpError(404, 'Estudiante no encontrado')

    const assignment = student.assignments[0]
    if (!assignment) return []

    const teacherSubjects = await studentRepository.findTeacherSubjectsByCourse(
      assignment.courseId, assignment.course.grade, assignment.course.educationType
    )
    const trimestres = await studentRepository.findTrimestersByAcademicYear(assignment.academicYearId)
    const notas = await studentRepository.findNotasLean(student.id, assignment.courseId, trimestres.map((t) => t.id))

    const notasBySubject: Record<number, Record<number, number>> = {}
    for (const n of notas) {
      if (!notasBySubject[n.subjectId]) notasBySubject[n.subjectId] = {}
      notasBySubject[n.subjectId][n.trimesterId] = n.total ?? 0
    }

    return teacherSubjects.map((ts) => {
      const subjectNotas = notasBySubject[ts.subjectId] || {}
      const vals = Object.values(subjectNotas)
      const avg  = vals.length ? parseFloat((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2)) : null

      return {
        subjectId: ts.subjectId, subjectName: ts.subject.name, campo: ts.subject.campo,
        hoursPerWeek: ts.subject.gradeConfigs[0]?.hoursPerWeek ?? 0,
        teacher: { id: ts.teacher.id, firstName: ts.teacher.firstName, lastName: ts.teacher.lastName, specialty: ts.teacher.specialty },
        trimestres, notas: subjectNotas, avg,
        aprobado: avg !== null ? avg >= 51 : null,
      }
    })
  },

  async getMyNotifications(userId: number | undefined) {
    const student = await studentRepository.findTutorIdByUserId(userId)
    if (!student) throw new HttpError(404, 'Estudiante no encontrado')

    const tutorId = student.parents[0]?.parentId
    if (!tutorId) return []

    return studentRepository.findNotificationsByParentId(tutorId)
  },

  async markNotificationRead(userId: number | undefined, notificationId: number) {
    const student = await studentRepository.findTutorIdByUserId(userId)
    if (!student) throw new HttpError(404, 'Estudiante no encontrado')

    const tutorId = student.parents[0]?.parentId
    if (!tutorId) throw new HttpError(403, 'Sin tutor asignado')

    const notif = await studentRepository.findNotificationForParent(notificationId, tutorId)
    if (!notif) throw new HttpError(404, 'Notificación no encontrada')

    return studentRepository.markNotificationRead(notificationId)
  },

  async saveMyAutoEvaluacion(userId: number | undefined, input: AutoEvaluacionInput) {
    const student = await studentRepository.findByUserId(userId)
    if (!student) throw new HttpError(404, 'Estudiante no encontrado')

    const nota = await studentRepository.findNotaById(input.notaId)
    if (!nota) throw new HttpError(404, 'Nota no encontrada')
    if (nota.studentId !== student.id) throw new HttpError(403, 'No tienes permiso')
    if (nota.cerrado) throw new HttpError(400, 'El trimestre está cerrado')

    const trimestre = await studentRepository.findTrimesterById(nota.trimesterId)
    if (trimestre?.isClosed) throw new HttpError(400, 'El trimestre fue cerrado por la dirección')

    const total = calcTotal(nota.saber, nota.hacer, nota.ser, input.autoEvaluacion)
    const updated = await studentRepository.updateNotaAutoEvaluacion(input.notaId, input.autoEvaluacion, total)
    await gamificationService.evaluateAchievements(student.id)
    return updated
  },

  async getMyGamification(userId: number | undefined, role: string) {
    if (role === 'GOBIERNO_NUCLEO' || role === 'GOBIERNO_DISTRITO') {
      return {
        enabled: false, xp: 0, level: 1, xpIntoLevel: 0, xpForNextLevel: 500, progressPct: 0,
        currentStreak: 0, longestStreak: 0, weekCalendar: [], attendancePct: null,
      }
    }

    const student = await studentRepository.findByUserId(userId)
    if (!student) throw new HttpError(404, 'Estudiante no encontrado')

    const summary = await gamificationService.getSummary(student.id)
    return { enabled: true, ...summary }
  },

  async getMyAchievements(userId: number | undefined) {
    const student = await studentRepository.findByUserId(userId)
    if (!student) throw new HttpError(404, 'Estudiante no encontrado')

    return gamificationService.getAchievementsList(student.id)
  },

  async deliverTask(userId: number | undefined, submissionId: number) {
    const submission = await taskRepository.findSubmissionById(submissionId)
    if (!submission) throw new HttpError(404, 'Entrega no encontrada')

    const student = await studentRepository.findByUserId(userId)
    if (!student || student.id !== submission.studentId) throw new HttpError(403, 'No tienes permiso')

    if (submission.status === 'CALIFICADO') throw new HttpError(400, 'Esta tarea ya fue calificada')
    if (submission.status === 'ENTREGADO')  throw new HttpError(400, 'Ya marcaste esta tarea como entregada')

    const now = new Date()
    const onTime = !submission.task.dueDate || now <= submission.task.dueDate

    const updated = await taskRepository.markSubmissionDelivered(submissionId, now)

    const gam = onTime
      ? await gamificationService.awardXp(student.id, gamificationService.XP_TASK_ON_TIME)
      : await gamificationService.getCurrentGamification(student.id)

    return { submission: updated, ...gam, onTime }
  },

  // ── Importación masiva ────────────────────────
  async importStudents(fileBuffer: Buffer) {
    const workbook = XLSX.read(fileBuffer, { type: 'buffer' })
    const sheet     = workbook.Sheets[workbook.SheetNames[0]]
    const rows      = XLSX.utils.sheet_to_json(sheet, { defval: '' }) as any[]

    const created: any[] = []
    const errors:  any[] = []
    const skipped: any[] = []

    for (const row of rows) {
      try {
        const firstName  = String(row['NOMBRESCOMPLETO'] || row['NOMBRES'] || row['NOMBRECOMPLETO'] || '').trim()
        const lastName   = String(row['APELLIDOS'] || '').trim()
        const rude       = String(row['RUDE'] || '').trim()
        const kardex     = String(row['NROKARDEX'] || '').trim()
        const generoRaw  = String(row['GENERO'] || '').trim().toUpperCase()
        const gender     = generoRaw === 'F' ? 'FEMENINO' : 'MASCULINO'

        if (!firstName || !lastName) {
          errors.push({ rude, reason: 'Nombre o apellido vacío' })
          continue
        }

        if (rude) {
          const existing = await studentRepository.findByRude(rude)
          if (existing) { skipped.push({ rude, name: `${lastName} ${firstName}`, reason: 'RUDE ya registrado' }); continue }
        }

        if (kardex) {
          const existing = await studentRepository.findByKardexAndName(kardex, firstName, lastName)
          if (existing) { skipped.push({ rude, name: `${lastName} ${firstName}`, reason: 'Estudiante ya registrado' }); continue }
        }

        const generatedEmail  = await generateEmail(firstName, lastName)
        const defaultPassword = generateStudentPassword(lastName, rude)
        const hashed = await bcrypt.hash(defaultPassword, 10)

        const user = await userRepository.create({ email: generatedEmail, password: hashed, role: Role.STUDENT })
        await studentRepository.create({
          firstName, lastName, gender: gender as any,
          rude: rude || null, kardex: kardex || null, userId: user.id,
        })

        created.push({ name: `${lastName} ${firstName}`, rude, email: generatedEmail, password: defaultPassword, gender })
      } catch (e: any) {
        errors.push({ rude: String(row['RUDE'] || ''), name: `${row['APELLIDOS'] || ''} ${row['NOMBRECOMPLETO'] || ''}`, reason: e.message || 'Error desconocido' })
      }
    }

    return { created, skipped, errors, total: rows.length }
  },

  async importTutors(fileBuffer: Buffer) {
    const workbook = XLSX.read(fileBuffer, { type: 'buffer' })
    const sheet     = workbook.Sheets[workbook.SheetNames[0]]
    const rows      = XLSX.utils.sheet_to_json(sheet, { defval: '' }) as any[]

    const assigned: any[] = []
    const skipped:  any[] = []
    const errors:   any[] = []

    for (const row of rows) {
      try {
        const rude        = String(row['RUDE'] || '').trim()
        const kardex      = String(row['NROKARDEX'] || '').trim()
        const tutorNombre = String(row['TUTORLEGAL'] || '').trim()

        if (!tutorNombre || tutorNombre.toUpperCase() === 'SIN REGISTRO') {
          skipped.push({ rude, kardex, reason: 'Sin tutor legal registrado' })
          continue
        }

        let student = rude ? await studentRepository.findByRude(rude) : null
        if (!student && kardex) student = await studentRepository.findByKardex(kardex)

        if (!student) {
          skipped.push({ rude, kardex, reason: 'Estudiante no encontrado' })
          continue
        }

        const palabras = tutorNombre.split(' ').filter((p) => p.length > 0)
        const tutores  = await studentRepository.findParentsByNameFragment(palabras[0])

        let tutor = tutores.find((t) => {
          const fullName  = `${t.firstName} ${t.lastName}`.toUpperCase()
          const fullName2 = `${t.lastName} ${t.firstName}`.toUpperCase()
          return fullName.includes(palabras[0].toUpperCase()) || fullName2.includes(palabras[0].toUpperCase())
        })

        if (tutores.length > 1 && palabras.length > 1) {
          const mejor = tutores.find((t) => {
            const fullName = `${t.firstName} ${t.lastName}`.toUpperCase()
            return palabras.every((p) => fullName.includes(p.toUpperCase()))
          })
          if (mejor) tutor = mejor
        }

        if (!tutor) {
          errors.push({ rude, kardex, tutorNombre, reason: 'Tutor no encontrado en el sistema' })
          continue
        }

        await studentRepository.clearTutorFlag(student.id)

        const existingLink = await studentRepository.findParentStudentLink(tutor.id, student.id)
        if (existingLink) {
          await studentRepository.setTutorFlag(tutor.id, student.id)
        } else {
          await studentRepository.createTutorLink(tutor.id, student.id)
        }

        let accessEmail: string | undefined
        let defaultPassword: string | undefined

        if (tutor.userId) {
          await userRepository.update(tutor.userId, { role: Role.PARENT, isActive: true })
        } else {
          // El tutor recién queda designado ahora — este es el único punto donde se le crea acceso al sistema.
          accessEmail = await generateUniqueEmail(tutor.firstName, tutor.lastName)
          defaultPassword = generateParentPassword(tutor.lastName, tutor.ci)
          const hashed = await bcrypt.hash(defaultPassword, 10)
          const user = await userRepository.create({ email: accessEmail, password: hashed, role: Role.PARENT })
          await parentRepository.linkUser(tutor.id, user.id)
        }

        assigned.push({
          student: `${student.lastName} ${student.firstName}`, tutor: `${tutor.lastName} ${tutor.firstName}`, kardex, rude,
          ...(accessEmail ? { accessEmail, defaultPassword } : {}),
        })
      } catch (e: any) {
        errors.push({ rude: String(row['RUDE'] || ''), kardex: String(row['NROKARDEX'] || ''), tutorNombre: String(row['TUTORLEGAL'] || ''), reason: e.message || 'Error desconocido' })
      }
    }

    return { assigned, skipped, errors, total: rows.length }
  },
}
