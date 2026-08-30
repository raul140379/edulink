import bcrypt from 'bcryptjs'
import * as XLSX from 'xlsx'
import { Prisma, Role, RelationType } from '@prisma/client'
import prisma from '../lib/prisma'
import { parentRepository } from '../repositories/parent.repository'
import { studentRepository } from '../repositories/student.repository'
import { userRepository } from '../repositories/user.repository'
import { delegateRepository } from '../repositories/delegate.repository'
import { auditLogRepository } from '../repositories/auditLog.repository'
import { mandatoryChargeService } from './mandatoryCharge.service'
import { HttpError } from '../utils/http-error'
import { assertDelegateOwnsParent } from '../utils/delegate-scope'
import { generateUniqueEmail, generateParentPassword, generateResetPassword } from '../utils/account-generator'
import { getTenantContext } from '../lib/tenant-context'
import {
  CreateParentInput, UpdateParentInput, UpdateMeInput,
  LinkStudentsInput, ChangeTutorInput, ChangeRelationInput,
} from '../schemas/parent.schema'
import { Pagination, withTotal } from '../utils/pagination'

function makeInitials(firstName: string, lastName: string): string {
  const parts = [...firstName.trim().split(' '), ...lastName.trim().split(' ')]
  return parts.filter((p) => p.length > 0).slice(0, 3).map((p) => p[0].toUpperCase()).join('')
}

// Kardex de tutor — atributo propio del Parent (no del Student, campo distinto
// y no relacionado). Se asigna una sola vez, de forma permanente, la primera
// vez que se necesita (mostrarlo en Tesorería o generar el código QR).
async function ensureTutorKardex(parent: { id: number; kardex: string | null }): Promise<string> {
  if (parent.kardex) return parent.kardex

  const existing = await parentRepository.findAllKardexValues()
  const maxExistente = existing.reduce((max, p) => {
    const n = parseInt(p.kardex || '', 10)
    return !isNaN(n) && n > max ? n : max
  }, 0)

  let candidate = Math.max(1000, maxExistente + 1)
  let clash = await parentRepository.findByKardex(String(candidate))
  while (clash) {
    candidate++
    clash = await parentRepository.findByKardex(String(candidate))
  }

  await parentRepository.updateKardex(parent.id, String(candidate))
  return String(candidate)
}

// Código QR = iniciales del tutor + gestión activa + kardex del tutor. Al ser
// el kardex único por colegio, el código es determinístico — no hace falta
// reintentar en bucle si choca (a diferencia del generador aleatorio
// anterior), solo confirmar que no colisiona con OTRO tutor.
async function buildAttendanceCode(parent: { id: number; firstName: string; lastName: string; kardex: string | null }): Promise<string> {
  const kardex      = await ensureTutorKardex(parent)
  const activeYear  = await parentRepository.findActiveAcademicYear()
  if (!activeYear) throw new HttpError(404, 'No hay gestión académica activa')

  const code  = `${makeInitials(parent.firstName, parent.lastName)}-${activeYear.year}-${kardex}`
  const clash = await parentRepository.findByAttendanceCode(code)
  if (clash && clash.id !== parent.id) {
    throw new HttpError(409, `Ya existe un código idéntico (${code}) para otro tutor — revisá el kardex asignado`)
  }
  return code
}

// El correo de acceso SIEMPRE sigue el patrón institucional
// (primer_nombre.primer_apellido@dominio) — el correo personal del tutor
// (si lo hay) se guarda aparte en Parent.email, nunca se usa como login.
async function createTutorUser(firstName: string, lastName: string, ci?: string | null) {
  const accessEmail = await generateUniqueEmail(firstName, lastName)

  const defaultPassword = generateParentPassword(lastName, ci)
  const hashed = await bcrypt.hash(defaultPassword, 10)
  // createdByUserId: quién registró a este padre/tutor — hoy solo se usa para
  // trazabilidad (Junta Escolar/Delegado son ahora los únicos que registran
  // padres nuevos), no gatea nada por sí solo.
  const user = await userRepository.create({
    email: accessEmail, password: hashed, role: Role.PARENT, createdByUserId: getTenantContext()?.userId,
  })

  return { user, accessEmail, defaultPassword }
}

export const parentService = {
  async listParents(search?: string, isActive?: string, isTutor?: string, pagination?: Pagination, orderBy?: 'alfabetico' | 'kardex') {
    // AND de condiciones en vez de spread plano — search ya usa su propio OR,
    // así que un segundo OR (el de isActive) al mismo nivel lo pisaría en vez
    // de combinarse. Antes isActive se aplicaba con un .filter() de JS después
    // de traer TODO — movido acá para que la paginación cuente bien.
    const conditions: Prisma.ParentWhereInput[] = []

    if (search) {
      conditions.push({
        OR: [
          { firstName: { contains: search, mode: 'insensitive' as const } },
          { lastName:  { contains: search, mode: 'insensitive' as const } },
          { ci:        { contains: search, mode: 'insensitive' as const } },
          { phone:     { contains: search, mode: 'insensitive' as const } },
          { AND: [
            { firstName: { contains: search.split(' ')[0], mode: 'insensitive' as const } },
            { lastName:  { contains: search.split(' ')[1] || '', mode: 'insensitive' as const } },
          ]},
          { AND: [
            { lastName:  { contains: search.split(' ')[0], mode: 'insensitive' as const } },
            { firstName: { contains: search.split(' ')[1] || '', mode: 'insensitive' as const } },
          ]},
        ],
      })
    }
    if (isTutor === 'true')         conditions.push({ students: { some: { isTutor: true } } })
    if (isTutor === 'SIN_VINCULAR') conditions.push({ students: { none: {} } })
    if (isTutor === 'NO_TUTOR')     conditions.push({ AND: [{ students: { some: {} } }, { students: { none: { isTutor: true } } }] })
    // Mismo criterio que el .filter() original: sin user o con user.isActive
    // false cuenta como "inactivo" (p.user?.isActive ?? false).
    if (isActive === 'true')  conditions.push({ user: { isActive: true } })
    if (isActive === 'false') conditions.push({ OR: [{ userId: null }, { user: { isActive: false } }] })

    const where: Prisma.ParentWhereInput = conditions.length > 0 ? { AND: conditions } : {}

    const data = await parentRepository.findMany(where, pagination, orderBy)
    return withTotal(data, pagination, () => parentRepository.count(where))
  },

  async getParentById(id: number) {
    const parent = await parentRepository.findById(id)
    if (!parent) throw new HttpError(404, 'Padre/tutor no encontrado')
    return parent
  },

  getParentStudents(id: number) {
    return parentRepository.findStudentRelations(id)
  },

  async createParent(input: CreateParentInput) {
    const { firstName, lastName, ci, phone, email, address, kardex, relationType, studentIds } = input

    if (ci) {
      const existingCI = await parentRepository.findByCI(ci)
      if (existingCI) throw new HttpError(409, `Ya existe un padre/tutor con el CI ${ci}`)
    }

    if (kardex) {
      const existingKardex = await parentRepository.findByKardex(kardex)
      if (existingKardex) throw new HttpError(409, `Ya existe un tutor con el kardex ${kardex}`)
    }

    if (studentIds && studentIds.length > 0) {
      for (const sid of studentIds) {
        const student = await studentRepository.findRaw(sid)
        if (!student) throw new HttpError(404, `Estudiante con ID ${sid} no encontrado`)
      }
    }

    // Un Delegado solo puede registrar padres de estudiantes de SU propio
    // curso — no hay ninguna otra restricción de curso hoy (Junta Escolar ya
    // queda acotada a su colegio por el motor de tenant-scoping).
    const ctx = getTenantContext()
    if (ctx?.role === Role.DELEGATE && studentIds && studentIds.length > 0) {
      const delegateParent = await delegateRepository.findParentByDelegateUserId(ctx.userId)
      const myCourseId = delegateParent?.delegateCourse?.id
      if (!myCourseId) throw new HttpError(400, 'No tenés un curso asignado como delegado')

      const activeYear = await delegateRepository.findActiveAcademicYear()
      if (!activeYear) throw new HttpError(404, 'No hay gestión académica activa')

      for (const sid of studentIds) {
        const inMyCourse = await prisma.studentAcademicAssignment.findFirst({
          where: { studentId: sid, courseId: myCourseId, academicYearId: activeYear.id },
        })
        if (!inMyCourse) throw new HttpError(403, 'Solo podés registrar padres de estudiantes de tu propio curso')
      }
    }

    let accessEmail: string | undefined
    let defaultPassword: string | undefined
    let userId: number | undefined

    if (relationType === 'TUTOR_LEGAL') {
      const result = await createTutorUser(firstName, lastName, ci)
      userId = result.user.id
      accessEmail = result.accessEmail
      defaultPassword = result.defaultPassword
    }

    const parent = await parentRepository.create({
      firstName, lastName,
      ci: ci || null, phone: phone || null, email: email || null, address: address || null,
      kardex: kardex || null,
      userId: userId ?? undefined,
      schoolId: getTenantContext()?.schoolId ?? 0,
    })

    if (studentIds && studentIds.length > 0) {
      for (const sid of studentIds) {
        await parentRepository.createRelationSimple(parent.id, sid, relationType, relationType === 'TUTOR_LEGAL')
      }
    }

    // Todo tutor nuevo recibe automáticamente los cargos obligatorios
    // vigentes de la gestión activa (ver mandatoryCharge.service.ts).
    if (relationType === 'TUTOR_LEGAL') {
      await mandatoryChargeService.applyActiveTemplatesToTutor(parent.id)
    }

    const parentFull = await parentRepository.findWithFullDetail(parent.id)

    return {
      parent: parentFull,
      ...(relationType === 'TUTOR_LEGAL' ? { accessEmail, defaultPassword } : {}),
    }
  },

  async updateParent(id: number, input: UpdateParentInput) {
    const existing = await parentRepository.findRaw(id)
    if (!existing) throw new HttpError(404, 'Padre/tutor no encontrado')

    // Mismo candado que createParent: un Delegado solo puede editar tutores de
    // estudiantes de su propio curso.
    const ctx = getTenantContext()
    if (ctx?.role === Role.DELEGATE) {
      const delegateParent = await delegateRepository.findParentByDelegateUserId(ctx.userId)
      const myCourseId = delegateParent?.delegateCourse?.id
      if (!myCourseId) throw new HttpError(400, 'No tenés un curso asignado como delegado')

      const activeYear = await delegateRepository.findActiveAcademicYear()
      if (!activeYear) throw new HttpError(404, 'No hay gestión académica activa')

      const relations = await parentRepository.findStudentRelations(id)
      const inMyCourse = relations.length > 0 && await prisma.studentAcademicAssignment.findFirst({
        where: { studentId: { in: relations.map((r) => r.studentId) }, courseId: myCourseId, academicYearId: activeYear.id },
      })
      if (!inMyCourse) throw new HttpError(403, 'Solo podés editar tutores de estudiantes de tu propio curso')
    }

    const { firstName, lastName, ci, phone, email, address, kardex } = input

    if (ci && ci !== existing.ci) {
      const dup = await parentRepository.findByCI(ci)
      if (dup) throw new HttpError(409, `Ya existe un padre/tutor con el CI ${ci}`)
    }

    if (kardex && kardex !== existing.kardex) {
      const dup = await parentRepository.findByKardex(kardex)
      if (dup) throw new HttpError(409, `Ya existe un tutor con el kardex ${kardex}`)
    }

    const data: Prisma.ParentUpdateInput = {
      ...(firstName !== undefined ? { firstName } : {}),
      ...(lastName  !== undefined ? { lastName  } : {}),
      ...(ci        !== undefined ? { ci:      ci      || null } : {}),
      ...(phone     !== undefined ? { phone:   phone   || null } : {}),
      ...(email     !== undefined ? { email:   email   || null } : {}),
      ...(address   !== undefined ? { address: address || null } : {}),
      ...(kardex    !== undefined ? { kardex:  kardex  || null } : {}),
    }

    return parentRepository.update(id, data)
  },

  async releaseTutorKardex(id: number) {
    const parent = await parentRepository.findRaw(id)
    if (!parent) throw new HttpError(404, 'Padre/tutor no encontrado')
    await parentRepository.releaseKardex(id)
    return { message: 'Kardex liberado correctamente' }
  },

  async toggleParentStatus(id: number) {
    const parent = await parentRepository.findById(id)
    if (!parent) throw new HttpError(404, 'Padre/tutor no encontrado')
    if (!parent.userId) throw new HttpError(400, 'Este padre/tutor no tiene acceso al sistema.')

    await parentRepository.setUserActive(parent.userId, !parent.user?.isActive)
    return parentRepository.findById(id)
  },

  async deleteParent(id: number) {
    const parent = await parentRepository.findWithStudentsCount(id)
    if (!parent) throw new HttpError(404, 'Padre/tutor no encontrado')

    const relations = await parentRepository.findStudentRelations(id)
    await assertDelegateOwnsParent(relations.map((r) => r.studentId), 'Solo podés eliminar tutores de estudiantes de tu propio curso')

    if (parent._count.students > 0) {
      for (const rel of relations) {
        if (!rel.isTutor) continue
        const otherTutors = await parentRepository.countOtherTutorsFor(rel.studentId, id)
        if (otherTutors === 0) {
          throw new HttpError(400, `No se puede eliminar: ${rel.student.firstName} ${rel.student.lastName} se quedaría sin tutor legal.`)
        }
      }
    }

    // Antes de tocar nada: un tutor con historial financiero (Charge/Payment/
    // ParentKardexHistory) no se puede borrar sin perder trazabilidad real de
    // pagos — se rechaza explícito acá, en vez de dejar que el DELETE final
    // choque contra la restricción de clave foránea y devuelva un 500
    // genérico sin explicación (bug encontrado 11-ago: el registro de un
    // tutor real con pagos reales no se borra nunca por este camino).
    const financial = await parentRepository.countFinancialRecords(id)
    if (financial.charges > 0 || financial.payments > 0 || financial.kardexHistory > 0) {
      throw new HttpError(409, 'Este tutor tiene historial financiero (cargos, pagos o kardex histórico) — no se puede eliminar directamente. Contactá soporte si necesitás reasignar o depurar sus datos.')
    }

    // Mismo criterio, un nivel más abajo: si la cuenta del tutor participó en
    // algo del sistema (asistencia a convocatoria, notificación/reunión/
    // convocatoria/comunicado que envió o creó, un cierre económico que
    // firmó, u otras cuentas que dio de alta), borrar el User choca contra
    // una restricción de clave foránea propia — se rechaza acá con el mismo
    // tipo de mensaje claro en vez de un 500 (encontrado 12-ago con un
    // fixture que tenía asistencia de prueba registrada).
    if (parent.userId) {
      const activity = await userRepository.countActivityRecords(parent.userId)
      if (Object.values(activity).some((n) => n > 0)) {
        throw new HttpError(409, 'La cuenta de este tutor participó en otras acciones del sistema (asistencia, notificaciones, reuniones, convocatorias o comunicados) — no se puede eliminar directamente. Contactá soporte si necesitás depurar esos datos primero.')
      }
    }

    // Atómico: si cualquier paso falla, no debe quedar un borrado a medias
    // (antes, un fallo en el DELETE final del Parent podía dejar ya
    // eliminadas sus relaciones ParentStudent, aunque el Parent sobreviviera).
    const ctx = getTenantContext()
    await prisma.$transaction(async (tx) => {
      await parentRepository.deleteRelations(tx, id)
      if (parent.userId) {
        await parentRepository.unlinkUser(tx, id)
        await userRepository.deleteTx(tx, parent.userId)
      }
      await parentRepository.delete(tx, id)
      await auditLogRepository.create({
        action: 'DELETE', entityType: 'Parent', entityId: id,
        before: { firstName: parent.firstName, lastName: parent.lastName, ci: parent.ci, kardex: parent.kardex, email: parent.email, phone: parent.phone },
        actorUserId: ctx?.userId ?? null, schoolId: parent.schoolId,
      }, tx)
    })
  },

  async linkStudents(id: number, input: LinkStudentsInput) {
    const parent = await parentRepository.findRaw(id)
    if (!parent) throw new HttpError(404, 'Padre/tutor no encontrado')

    const results = []
    for (const sid of input.studentIds) {
      const existing = await parentRepository.findRelation(id, sid)
      if (!existing) {
        const relationType = input.relationType || 'OTRO'
        const rel = await parentRepository.createRelation(id, sid, relationType, relationType === 'TUTOR_LEGAL')
        results.push(rel)
      }
    }

    return results
  },

  async unlinkStudent(id: number, studentId: number) {
    const relation = await parentRepository.findRelation(id, studentId)
    if (relation?.isTutor) {
      const otherTutors = await parentRepository.countOtherTutorsFor(studentId, id)
      if (otherTutors === 0) throw new HttpError(400, 'No se puede desvincular: el estudiante se quedaría sin tutor legal.')
    }

    await parentRepository.deleteRelation(id, studentId)
  },

  async generateCredentials(id: number) {
    const parent = await parentRepository.findById(id)
    if (!parent) throw new HttpError(404, 'Padre/tutor no encontrado')
    if (parent.userId) throw new HttpError(400, 'Este padre/tutor ya tiene acceso al sistema')

    const isTutorLegal = parent.students.some((s) => s.isTutor)
    if (!isTutorLegal) throw new HttpError(400, 'Solo se puede generar acceso para tutores legales')

    const result = await createTutorUser(parent.firstName, parent.lastName, parent.ci)
    await parentRepository.linkUser(id, result.user.id)

    return { accessEmail: result.accessEmail, defaultPassword: result.defaultPassword }
  },

  // Recalcula el correo de acceso al patrón institucional vigente con el
  // nombre/apellido ACTUALES del tutor — para corregir cuentas viejas que
  // quedaron con un correo personal como login (ver account-generator.ts).
  async regenerateAccountEmail(id: number) {
    const parent = await parentRepository.findById(id)
    if (!parent) throw new HttpError(404, 'Padre/tutor no encontrado')
    if (!parent.userId) throw new HttpError(400, 'Este padre/tutor no tiene una cuenta de acceso')

    const newEmail = await generateUniqueEmail(parent.firstName, parent.lastName, undefined, parent.userId)
    await userRepository.update(parent.userId, { email: newEmail })

    return { email: newEmail }
  },

  async resetTutorPassword(id: number) {
    const parent = await parentRepository.findById(id)
    if (!parent) throw new HttpError(404, 'Padre/tutor no encontrado')
    if (!parent.userId) throw new HttpError(400, 'Este padre/tutor no tiene acceso al sistema')

    const newPassword = generateResetPassword()
    const hashed = await bcrypt.hash(newPassword, 10)
    await userRepository.update(parent.userId, { password: hashed })

    return { accessEmail: parent.user?.email, newPassword }
  },

  async changeTutor(studentId: number, input: ChangeTutorInput) {
    const rawTutor = await parentRepository.findRaw(input.newTutorId)
    if (!rawTutor) throw new HttpError(404, 'El nuevo tutor no fue encontrado')

    const link = await parentRepository.findRelation(input.newTutorId, studentId)
    if (!link) throw new HttpError(400, 'El nuevo tutor no está vinculado a este estudiante')

    await parentRepository.clearTutorFlagForStudent(studentId)
    // Sin forzar relationType — sigue siendo "Padre"/"Madre"/etc., lo único
    // que cambia al promoverlo es isTutor (mismo principio que el lado que
    // se desplaza, ver clearTutorFlagForStudent).
    await parentRepository.updateRelation(input.newTutorId, studentId, { isTutor: true })

    let accessEmail: string | undefined
    let defaultPassword: string | undefined

    if (!rawTutor.userId) {
      try {
        const result = await createTutorUser(rawTutor.firstName, rawTutor.lastName, rawTutor.ci)
        await parentRepository.linkUser(input.newTutorId, result.user.id)
        accessEmail = result.accessEmail
        defaultPassword = result.defaultPassword
      } catch (err) {
        console.error('Error generando credenciales para nuevo tutor:', err)
      }
    }

    return { accessEmail, defaultPassword }
  },

  async changeRelation(id: number, studentId: number, input: ChangeRelationInput) {
    if (input.isTutor) {
      await parentRepository.clearAnyTutorForStudent(studentId)
    }

    await parentRepository.updateRelation(id, studentId, {
      relationType: input.relationType,
      isTutor: input.isTutor || false,
    })

    const parent = await parentRepository.findRaw(id)

    let accessEmail: string | undefined
    let defaultPassword: string | undefined

    if (input.isTutor && parent && !parent.userId) {
      try {
        const result = await createTutorUser(parent.firstName, parent.lastName, parent.ci)
        await parentRepository.linkUser(id, result.user.id)
        accessEmail = result.accessEmail
        defaultPassword = result.defaultPassword
      } catch (err) {
        console.error('Error generando credenciales:', err)
      }
    }

    return { accessEmail, defaultPassword }
  },

  async getMe(userId: number | undefined) {
    const parent = await parentRepository.findByUserId(userId)
    if (!parent) throw new HttpError(404, 'Perfil no encontrado')
    return parent
  },

  async updateMe(userId: number | undefined, input: UpdateMeInput) {
    const parent = await parentRepository.findRawByUserId(userId)
    if (!parent) throw new HttpError(404, 'Perfil no encontrado')

    return parentRepository.updateProfile(parent.id, {
      phone: input.phone || null,
      email: input.email || null,
      address: input.address || null,
    })
  },

  async getMyStudents(userId: number | undefined) {
    const parent = await parentRepository.findMyStudentsByUserId(userId)
    if (!parent) throw new HttpError(404, 'Perfil de padre no encontrado')

    return parent.students.map((ps) => ({
      id: ps.student.id, firstName: ps.student.firstName, lastName: ps.student.lastName,
      isTutor: ps.isTutor, course: ps.student.assignments[0]?.course ?? null,
    }))
  },

  async importParents(fileBuffer: Buffer) {
    const workbook = XLSX.read(fileBuffer, { type: 'buffer' })
    const sheet     = workbook.Sheets[workbook.SheetNames[0]]
    const rows      = XLSX.utils.sheet_to_json(sheet, { defval: '' }) as any[]

    const created: any[] = []
    const errors:  any[] = []
    const skipped: any[] = []

    const registerParent = async (
      nombre: string, apellido: string, cedula: string, telefono: string,
      relationType: RelationType, students: { id: number }[], sinVincular: boolean
    ) => {
      let persona = cedula ? await parentRepository.findByCI(cedula) : null
      if (!persona) persona = await parentRepository.findByNameFragment(nombre, apellido)

      if (!persona) {
        // Sin usuario/login aquí: el acceso solo se genera para quien quede designado
        // como tutor legal (ver students/import-tutors o generateCredentials).
        persona = await parentRepository.create_simple({
          firstName: nombre, lastName: apellido, ci: cedula || null, phone: telefono || null,
        })

        created.push({ name: `${apellido} ${nombre}`, type: relationType === 'PADRE' ? 'PADRE' : 'MADRE' })
      }

      if (!sinVincular) {
        for (const student of students) {
          const existing = await parentRepository.findRelation(persona.id, student.id)
          if (!existing) await parentRepository.createRelationSimple(persona.id, student.id, relationType, false)
        }
      }
    }

    for (const row of rows) {
      try {
        const kardex = String(row['NROKARDEX'] || '').trim()
        if (!kardex) { errors.push({ kardex: '', reason: 'Sin kardex' }); continue }

        const students = await parentRepository.findStudentsByKardex(kardex)
        const sinVincular = students.length === 0
        if (sinVincular) skipped.push({ kardex, reason: 'Sin kardex — se registrará sin vinculación' })

        const nombrePadre   = String(row['NOMBREPADRE']   || '').trim()
        const apellidoPadre = String(row['APELLIDOPADRE'] || '').trim()
        if (nombrePadre && apellidoPadre) {
          await registerParent(
            nombrePadre, apellidoPadre,
            String(row['NROCIPADRE'] || '').trim(), String(row['TELEFONOPADRE'] || '').trim(),
            'PADRE', students, sinVincular
          )
        }

        const nombreMadre   = String(row['NOMBRESMADRE']   || '').trim()
        const apellidoMadre = String(row['APELLIDOSMADRE'] || '').trim()
        if (nombreMadre && apellidoMadre) {
          await registerParent(
            nombreMadre, apellidoMadre,
            String(row['NROCIMADRE'] || '').trim(), String(row['TELEFONOMADRE'] || '').trim(),
            'MADRE', students, sinVincular
          )
        }
      } catch (e: any) {
        errors.push({ kardex: String(row['NROKARDEX'] || ''), reason: e.message || 'Error desconocido' })
      }
    }

    return { created, skipped, errors, total: rows.length }
  },

  // ── Código/QR de asistencia (solo tutores) ────
  async generateTutorAttendanceCodes() {
    const tutors = await parentRepository.findTutorsWithoutCode()

    let count = 0
    for (const t of tutors) {
      const code = await buildAttendanceCode(t)
      await parentRepository.updateAttendanceCode(t.id, code)
      count++
    }

    return { message: `Códigos generados: ${count} tutores`, count }
  },

  async regenerateTutorCode(id: number) {
    const parent = await parentRepository.findWithFullDetail(id)
    if (!parent) throw new HttpError(404, 'Padre/tutor no encontrado')
    if (!parent.students.some((s) => s.isTutor)) throw new HttpError(400, 'Solo se puede generar un código de asistencia para el tutor designado')

    await assertDelegateOwnsParent(parent.students.map((s) => s.studentId), 'Solo podés generar el código de tutores de estudiantes de tu propio curso')

    const code = await buildAttendanceCode(parent)
    await parentRepository.updateAttendanceCode(id, code)
    await auditLogRepository.create({
      action: 'OVERWRITE', entityType: 'Parent', entityId: id,
      before: { attendanceCode: parent.attendanceCode }, after: { attendanceCode: code },
      actorUserId: getTenantContext()?.userId ?? null, schoolId: parent.schoolId,
    })
    return { message: 'Código regenerado', attendanceCode: code }
  },

  getTutorAttendanceCodes(pagination?: Pagination) {
    return parentRepository.findAllTutorsWithCodes(pagination)
  },

  // Todos los padres del colegio (cualquier relación) con estado
  // Activo/Inactivo según tengan o no un hijo matriculado en la gestión
  // activa — "matriculado" = tiene una StudentAcademicAssignment ese año, no
  // el interruptor manual Student.isActive (que no distingue año).
  // search/active se mueven al backend porque, paginado, el filtrado en
  // cliente sobre solo la página visible dejaría de reflejar los 935+
  // padres reales (mismo criterio ya aplicado en listParents/listStudents).
  async getAllWithStatus(pagination?: Pagination, search?: string, active?: string) {
    const activeYear = await parentRepository.findActiveAcademicYear()
    if (!activeYear) throw new HttpError(404, 'No hay gestión académica activa')

    const conditions: Prisma.ParentWhereInput[] = []

    if (search) {
      conditions.push({
        OR: [
          { firstName: { contains: search, mode: 'insensitive' as const } },
          { lastName:  { contains: search, mode: 'insensitive' as const } },
          { ci:        { contains: search, mode: 'insensitive' as const } },
          { AND: [
            { firstName: { contains: search.split(' ')[0], mode: 'insensitive' as const } },
            { lastName:  { contains: search.split(' ')[1] || '', mode: 'insensitive' as const } },
          ]},
          { AND: [
            { lastName:  { contains: search.split(' ')[0], mode: 'insensitive' as const } },
            { firstName: { contains: search.split(' ')[1] || '', mode: 'insensitive' as const } },
          ]},
        ],
      })
    }

    // "Activo" = tiene al menos un hijo con matrícula en la gestión activa —
    // mismo criterio que el "active" calculado más abajo, solo que acá se
    // evalúa en SQL para poder filtrar antes de paginar.
    const hasActiveEnrollment: Prisma.ParentWhereInput = {
      students: { some: { student: { assignments: { some: { academicYearId: activeYear.id } } } } },
    }
    if (active === 'true')  conditions.push(hasActiveEnrollment)
    if (active === 'false') conditions.push({ NOT: hasActiveEnrollment })

    const where: Prisma.ParentWhereInput = conditions.length > 0 ? { AND: conditions } : {}

    const parents = await parentRepository.findAllWithEnrollmentStatus(activeYear.id, pagination, where)

    const mapped = parents.map((p) => ({
      id: p.id, firstName: p.firstName, lastName: p.lastName, ci: p.ci, phone: p.phone,
      user: p.user,
      students: p.students.map((ps) => ({
        relationType: ps.relationType, isTutor: ps.isTutor,
        student: { id: ps.student.id, firstName: ps.student.firstName, lastName: ps.student.lastName },
      })),
      active: p.students.some((ps) => ps.student.assignments.length > 0),
    }))

    if (!pagination) return mapped

    // Stat cards del encabezado — totales globales, ignoran search/active
    // (mismo criterio que la pantalla ya tenía: reflejan a TODOS los padres,
    // no solo la página o el filtro actual).
    const [total, totalCount, totalActivosCount] = await Promise.all([
      parentRepository.countWithEnrollmentStatus(where),
      parentRepository.countWithEnrollmentStatus({}),
      parentRepository.countWithEnrollmentStatus(hasActiveEnrollment),
    ])

    return {
      data: mapped, total, page: pagination.page, pageSize: pagination.pageSize,
      summary: { total: totalCount, activos: totalActivosCount, inactivos: totalCount - totalActivosCount },
    }
  },

  // Padres/tutores agrupados por curso — misma consulta de base para ambas
  // listas (findAssignmentsWithTutorParents-equivalente para todos los
  // cursos). "Tutores" sigue siendo una fila por tutor (filtrando isTutor).
  // "Padres" ahora se agrupa por ESTUDIANTE (no por padre) — un estudiante con
  // padre y madre queda en una sola fila con ambos, en vez de una fila por
  // cada uno repitiendo el nombre del estudiante.
  async getParentsGroupedByCourse() {
    const activeYear = await parentRepository.findActiveAcademicYear()
    if (!activeYear) throw new HttpError(404, 'No hay gestión académica activa')

    const ctx = getTenantContext()
    const schoolId = ctx?.schoolId ?? 0

    // DELEGATE solo ve su propio curso — sin esto traía TODOS los cursos del
    // colegio (fuga confirmada en la pantalla "Familias").
    let courseId: number | undefined
    if (ctx?.role === Role.DELEGATE) {
      const delegateParent = await delegateRepository.findParentByDelegateUserId(ctx.userId)
      courseId = delegateParent?.delegateCourse?.id
      if (!courseId) throw new HttpError(400, 'No tenés un curso asignado como delegado')
    }

    const courses = await parentRepository.findAllGroupedByCourse(schoolId, activeYear.id, courseId)

    return courses.map((course) => {
      const studentsMap = new Map<number, any>()
      const tutoresMap  = new Map<number, any>()

      for (const assignment of course.assignments) {
        const student = assignment.student
        const studentName = `${student.lastName} ${student.firstName}`

        if (!studentsMap.has(student.id)) {
          studentsMap.set(student.id, { studentId: student.id, studentName, parents: [] })
        }

        for (const ps of student.parents) {
          const p = ps.parent
          const entry = { ...p, relationType: ps.relationType, isTutor: ps.isTutor }
          studentsMap.get(student.id).parents.push(entry)

          if (ps.isTutor && !tutoresMap.has(p.id)) {
            tutoresMap.set(p.id, { ...entry, studentId: student.id, studentName })
          }
        }
      }

      // Ordenado por apellido del estudiante (studentName ya viene armado como
      // "Apellido Nombre") — no por el nombre del padre/tutor.
      const byStudentName = (a: any, b: any) => a.studentName.localeCompare(b.studentName, 'es')

      return {
        course: { id: course.id, level: course.level, grade: course.grade, parallel: course.parallel, shift: course.shift },
        padres: Array.from(studentsMap.values()).sort(byStudentName),
        tutores: Array.from(tutoresMap.values()).sort(byStudentName),
      }
    })
  },
}
