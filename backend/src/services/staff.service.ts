import bcrypt from 'bcryptjs'
import { Prisma, Role, StaffRole } from '@prisma/client'
import prisma from '../lib/prisma'
import { staffRepository } from '../repositories/staff.repository'
import { userRepository } from '../repositories/user.repository'
import { HttpError } from '../utils/http-error'
import { normalizeLetters, generateUniqueEmail } from '../utils/account-generator'
import { CreateStaffInput, UpdateStaffInput } from '../schemas/staff.schema'

// Cargo elegido en el formulario -> Role de la cuenta de acceso. Inverso
// exacto de STAFF_ROLE_BY_USER_ROLE en user.service.ts (que resuelve el
// camino contrario, para el alta rápida vía admin/usuarios). AUXILIAR no
// tiene selector en el frontend hoy (código muerto, ver CLAUDE.md) — mapea
// a STAFF igual que OTRO para no romper el tipo si se habilita después.
const USER_ROLE_BY_STAFF_ROLE: Record<StaffRole, Role> = {
  REGENTE:    Role.REGENTE,
  SECRETARIA: Role.SECRETARY,
  PSICOLOGO:  Role.PSICOLOGO,
  PORTERO:    Role.PORTERO,
  OTRO:       Role.STAFF,
  AUXILIAR:   Role.STAFF,
}

function generateStaffPassword(lastName: string, ci?: string): string {
  const year = new Date().getFullYear()
  if (ci && ci.trim().length >= 4) return `staff${ci.trim().slice(-4)}${year}`
  return `staff${normalizeLetters(lastName.split(' ')[0]).slice(0, 4)}${year}`
}

function passwordHint(ci?: string): string {
  return ci
    ? 'Contraseña = staff + últimos 4 dígitos del CI + año'
    : 'Contraseña = staff + primeras 4 letras del apellido + año'
}

export const staffService = {
  listStaff(search?: string, isActive?: string) {
    const where: Prisma.StaffWhereInput = {
      ...(isActive !== undefined ? { isActive: isActive === 'true' } : {}),
      ...(search ? {
        OR: [
          { firstName: { contains: search, mode: 'insensitive' as const } },
          { lastName:  { contains: search, mode: 'insensitive' as const } },
          { ci:        { contains: search, mode: 'insensitive' as const } },
        ],
      } : {}),
    }
    return staffRepository.findMany(where)
  },

  async getStaffById(id: number) {
    const staff = await staffRepository.findById(id)
    if (!staff) throw new HttpError(404, 'Personal no encontrado')
    return staff
  },

  async createStaff(input: CreateStaffInput) {
    const { firstName, lastName, ci, phone, email, gender, staffRole, shift } = input

    if (ci) {
      const existingCI = await staffRepository.findByCI(ci)
      if (existingCI) throw new HttpError(409, `Ya existe personal administrativo con el CI ${ci}`)
    }

    let accessEmail: string
    if (email && email.trim() !== '') {
      const existing = await userRepository.findByEmail(email.trim())
      if (existing) throw new HttpError(409, `El correo ${email} ya está en uso`)
      accessEmail = email.trim()
    } else {
      accessEmail = await generateUniqueEmail(firstName, lastName)
    }

    const defaultPassword = generateStaffPassword(lastName, ci)
    const hashedPassword  = await bcrypt.hash(defaultPassword, 10)
    const role = USER_ROLE_BY_STAFF_ROLE[staffRole]

    // Transacción única (mismo patrón que teacherService.createTeacher): si
    // staffRepository.createTx falla, el User creado acá también se revierte
    // — nunca queda un User huérfano sin su Staff.
    const { staff } = await prisma.$transaction(async (tx) => {
      const user = await userRepository.createTx(tx, { email: accessEmail, password: hashedPassword, role })

      const staff = await staffRepository.createTx(tx, {
        firstName, lastName,
        ci:       ci     || null,
        phone:    phone  || null,
        email:    email  || null,
        gender:   gender || null,
        staffRole,
        shift:    shift  || null,
        isActive: true,
        userId:   user.id,
        schoolId: user.schoolId!,
      })

      return { user, staff }
    })

    return { staff, accessEmail, defaultPassword, passwordHint: passwordHint(ci) }
  },

  async updateStaff(id: number, input: UpdateStaffInput) {
    const existing = await staffRepository.findRaw(id)
    if (!existing) throw new HttpError(404, 'Personal no encontrado')

    const { firstName, lastName, ci, phone, email, gender, staffRole, shift } = input

    if (ci && ci !== existing.ci) {
      const dup = await staffRepository.findByCI(ci)
      if (dup) throw new HttpError(409, `Ya existe personal administrativo con el CI ${ci}`)
    }

    // Si cambia el Cargo, la cuenta de acceso tiene que reflejar el Role
    // correspondiente (ej. de Secretaria a Regente) — sin esto quedaría con
    // permisos del cargo viejo pese a que la ficha ya dice el nuevo.
    if (staffRole !== undefined && staffRole !== existing.staffRole) {
      await userRepository.update(existing.userId, { role: USER_ROLE_BY_STAFF_ROLE[staffRole] })
    }

    const data: Prisma.StaffUpdateInput = {
      ...(firstName !== undefined ? { firstName } : {}),
      ...(lastName  !== undefined ? { lastName  } : {}),
      ...(ci        !== undefined ? { ci:        ci        || null } : {}),
      ...(phone     !== undefined ? { phone:     phone     || null } : {}),
      ...(email     !== undefined ? { email:     email     || null } : {}),
      ...(gender    !== undefined ? { gender:    gender    || null } : {}),
      ...(staffRole !== undefined ? { staffRole } : {}),
      ...(shift     !== undefined ? { shift:     shift     || null } : {}),
    }

    return staffRepository.update(id, data)
  },

  async toggleStaffStatus(id: number) {
    const staff = await staffRepository.findRaw(id)
    if (!staff) throw new HttpError(404, 'Personal no encontrado')

    const newStatus = !staff.isActive
    await staffRepository.setActive(id, newStatus)
    if (staff.userId) await userRepository.update(staff.userId, { isActive: newStatus })

    return newStatus
  },
}
