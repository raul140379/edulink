import bcrypt from 'bcryptjs'
import * as XLSX from 'xlsx'
import { Prisma, Role, RelationType } from '@prisma/client'
import { parentRepository } from '../repositories/parent.repository'
import { studentRepository } from '../repositories/student.repository'
import { userRepository } from '../repositories/user.repository'
import { HttpError } from '../utils/http-error'
import { generateUniqueEmail, generateParentPassword } from '../utils/account-generator'
import { getTenantContext } from '../lib/tenant-context'
import {
  CreateParentInput, UpdateParentInput, UpdateMeInput,
  LinkStudentsInput, ChangeTutorInput, ChangeRelationInput,
} from '../schemas/parent.schema'

async function createTutorUser(firstName: string, lastName: string, ci?: string | null, personalEmail?: string | null) {
  let accessEmail: string
  if (personalEmail && personalEmail.trim() !== '') {
    const existing = await userRepository.findByEmail(personalEmail.trim())
    if (existing) throw new HttpError(409, `El correo ${personalEmail} ya está en uso por otro usuario`)
    accessEmail = personalEmail.trim()
  } else {
    accessEmail = await generateUniqueEmail(firstName, lastName)
  }

  const defaultPassword = generateParentPassword(lastName, ci)
  const hashed = await bcrypt.hash(defaultPassword, 10)
  const user = await userRepository.create({ email: accessEmail, password: hashed, role: Role.PARENT })

  return { user, accessEmail, defaultPassword }
}

export const parentService = {
  listParents(search?: string, isActive?: string, isTutor?: string) {
    const where: Prisma.ParentWhereInput = {
      ...(search ? {
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
      } : {}),
      ...(isTutor === 'true'         ? { students: { some: { isTutor: true } } } : {}),
      ...(isTutor === 'SIN_VINCULAR' ? { students: { none: {} } }                : {}),
      ...(isTutor === 'NO_TUTOR'     ? { AND: [{ students: { some: {} } }, { students: { none: { isTutor: true } } }] } : {}),
    }

    return parentRepository.findMany(where).then((parents) =>
      isActive !== undefined
        ? parents.filter((p) => (p.user?.isActive ?? false) === (isActive === 'true'))
        : parents
    )
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
    const { firstName, lastName, ci, phone, email, address, relationType, studentIds } = input

    if (ci) {
      const existingCI = await parentRepository.findByCI(ci)
      if (existingCI) throw new HttpError(409, `Ya existe un padre/tutor con el CI ${ci}`)
    }

    if (studentIds && studentIds.length > 0) {
      for (const sid of studentIds) {
        const student = await studentRepository.findRaw(sid)
        if (!student) throw new HttpError(404, `Estudiante con ID ${sid} no encontrado`)
      }
    }

    let accessEmail: string | undefined
    let defaultPassword: string | undefined
    let userId: number | undefined

    if (relationType === 'TUTOR_LEGAL') {
      const result = await createTutorUser(firstName, lastName, ci, email)
      userId = result.user.id
      accessEmail = result.accessEmail
      defaultPassword = result.defaultPassword
    }

    const parent = await parentRepository.create({
      firstName, lastName,
      ci: ci || null, phone: phone || null, email: email || null, address: address || null,
      ...(userId ? { user: { connect: { id: userId } } } : {}),
      school: { connect: { id: getTenantContext()?.schoolId ?? 0 } },
    })

    if (studentIds && studentIds.length > 0) {
      for (const sid of studentIds) {
        await parentRepository.createRelationSimple(parent.id, sid, relationType, relationType === 'TUTOR_LEGAL')
      }
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

    const { firstName, lastName, ci, phone, email, address } = input

    if (ci && ci !== existing.ci) {
      const dup = await parentRepository.findByCI(ci)
      if (dup) throw new HttpError(409, `Ya existe un padre/tutor con el CI ${ci}`)
    }

    const data: Prisma.ParentUpdateInput = {
      ...(firstName !== undefined ? { firstName } : {}),
      ...(lastName  !== undefined ? { lastName  } : {}),
      ...(ci        !== undefined ? { ci:      ci      || null } : {}),
      ...(phone     !== undefined ? { phone:   phone   || null } : {}),
      ...(email     !== undefined ? { email:   email   || null } : {}),
      ...(address   !== undefined ? { address: address || null } : {}),
    }

    return parentRepository.update(id, data)
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

    if (parent._count.students > 0) {
      const relations = await parentRepository.findStudentRelations(id)
      for (const rel of relations) {
        if (!rel.isTutor) continue
        const otherTutors = await parentRepository.countOtherTutorsFor(rel.studentId, id)
        if (otherTutors === 0) {
          throw new HttpError(400, `No se puede eliminar: ${rel.student.firstName} ${rel.student.lastName} se quedaría sin tutor legal.`)
        }
      }
    }

    await parentRepository.deleteRelations(id)

    if (parent.userId) {
      const savedUserId = parent.userId
      await parentRepository.unlinkUser(id)
      await userRepository.delete(savedUserId)
    }

    await parentRepository.delete(id)
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

    const isTutorLegal = parent.students.some((s) => s.relationType === 'TUTOR_LEGAL')
    if (!isTutorLegal) throw new HttpError(400, 'Solo se puede generar acceso para tutores legales')

    const result = await createTutorUser(parent.firstName, parent.lastName, parent.ci, parent.email)
    await parentRepository.linkUser(id, result.user.id)

    return { accessEmail: result.accessEmail, defaultPassword: result.defaultPassword }
  },

  async changeTutor(studentId: number, input: ChangeTutorInput) {
    const rawTutor = await parentRepository.findRaw(input.newTutorId)
    if (!rawTutor) throw new HttpError(404, 'El nuevo tutor no fue encontrado')

    const link = await parentRepository.findRelation(input.newTutorId, studentId)
    if (!link) throw new HttpError(400, 'El nuevo tutor no está vinculado a este estudiante')

    await parentRepository.clearTutorForStudent(studentId)
    await parentRepository.updateRelation(input.newTutorId, studentId, { relationType: 'TUTOR_LEGAL', isTutor: true })

    let accessEmail: string | undefined
    let defaultPassword: string | undefined

    if (!rawTutor.userId) {
      try {
        const result = await createTutorUser(rawTutor.firstName, rawTutor.lastName, rawTutor.ci, rawTutor.email)
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
        const result = await createTutorUser(parent.firstName, parent.lastName, parent.ci, parent.email)
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
}
