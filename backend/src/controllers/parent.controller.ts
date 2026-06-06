import { Response } from 'express'
import bcrypt from 'bcryptjs'
import { AuthRequest } from '../middlewares/auth.middleware'
import prisma from '../lib/prisma'

// ─────────────────────────────────────────────
// Función: generar email único automáticamente
// ─────────────────────────────────────────────
const generateEmail = async (firstName: string, lastName: string): Promise<string> => {
  const normalize = (str: string) =>
    str.toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, '.')
      .replace(/[^a-z0-9.]/g, '')

  const first = normalize(firstName.split(' ')[0])
  const last  = normalize(lastName.split(' ')[0])
  const base  = `${first}.${last}@nnuu.edu.bo`

  const existing = await prisma.user.findUnique({ where: { email: base } })
  if (!existing) return base

  let counter = 2
  while (true) {
    const candidate = `${first}.${last}${counter}@nnuu.edu.bo`
    const dup = await prisma.user.findUnique({ where: { email: candidate } })
    if (!dup) return candidate
    counter++
  }
}

// ─────────────────────────────────────────────
// Función: generar contraseña identificable para padre
// padre + últimos 4 dígitos CI + año
// Si no tiene CI: padre + primeras 3 letras apellido + año
// ─────────────────────────────────────────────
const generateParentPassword = (lastName: string, ci?: string): string => {
  const year = new Date().getFullYear()
  if (ci && ci.trim().length >= 4) {
    const last4 = ci.trim().slice(-4)
    return `padre${last4}${year}`
  }
  const normalize = (str: string) =>
    str.toUpperCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^A-Z]/g, '')
  const letters = normalize(lastName.split(' ')[0]).slice(0, 3)
  return `padre${letters}${year}`
}

// ─────────────────────────────────────────────
// Función: crear usuario para tutor legal
// ─────────────────────────────────────────────
const createTutorUser = async (
  firstName: string,
  lastName: string,
  ci?: string,
  personalEmail?: string
) => {
  let accessEmail: string

  if (personalEmail && personalEmail.trim() !== '') {
    const existing = await prisma.user.findUnique({ where: { email: personalEmail.trim() } })
    if (existing) throw new Error(`El correo ${personalEmail} ya está en uso por otro usuario`)
    accessEmail = personalEmail.trim()
  } else {
    accessEmail = await generateEmail(firstName, lastName)
  }

  const defaultPass = generateParentPassword(lastName, ci)
  const hashed      = await bcrypt.hash(defaultPass, 10)

  const user = await prisma.user.create({
    data: { email: accessEmail, password: hashed, role: 'PARENT', isActive: true }
  })

  return { user, accessEmail, defaultPassword: defaultPass }
}

// ─────────────────────────────────────────────
// GET /api/parents — Listar
// ─────────────────────────────────────────────
export const getParents = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { search, isActive, isTutor } = req.query
    console.log('Filtro isTutor:', isTutor)
    const parents = await prisma.parent.findMany({
      where: {
        ...(search ? {
         OR: [
  { firstName: { contains: search as string, mode: 'insensitive' } },
  { lastName:  { contains: search as string, mode: 'insensitive' } },
  { ci:        { contains: search as string, mode: 'insensitive' } },
  { phone:     { contains: search as string, mode: 'insensitive' } },
  { AND: [
    { firstName: { contains: (search as string).split(' ')[0], mode: 'insensitive' } },
    { lastName:  { contains: (search as string).split(' ')[1] || '', mode: 'insensitive' } },
  ]},
  { AND: [
    { lastName:  { contains: (search as string).split(' ')[0], mode: 'insensitive' } },
    { firstName: { contains: (search as string).split(' ')[1] || '', mode: 'insensitive' } },
  ]},
]
} : {}),
       ...(isTutor === 'true'         ? { students: { some: { isTutor: true } } } : {}),
      ...(isTutor === 'SIN_VINCULAR' ? { students: { none: {} } }                : {}),
      ...(isTutor === 'NO_TUTOR'     ? { AND: [
          { students: { some: {} } },
            { students: { none: { isTutor: true } } }
      ]} : {}),
      },
      include: {
        user: { select: { id: true, email: true, role: true, isActive: true } },
       students: {
        select: {
          relationType: true,
          isTutor:      true,
            student: { select: { id: true, firstName: true, lastName: true, ci: true, rude: true, kardex: true } }
          }
        },
        _count: { select: { students: true } }
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }]
    })

    const filtered = isActive !== undefined
      ? parents.filter(p => (p.user?.isActive ?? false) === (isActive === 'true'))
      : parents

    res.json(filtered)
  } catch (error) {
    console.error('getParents error:', error)
    res.status(500).json({ message: 'Error al obtener padres' })
  }
}

// ─────────────────────────────────────────────
// GET /api/parents/:id
// ─────────────────────────────────────────────
export const getParentById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params

    const parent = await prisma.parent.findUnique({
      where: { id: parseInt(id) },
      include: {
        user: { select: { id: true, email: true, role: true, isActive: true } },
        students: {
          include: {
            student: {
              select: {
                id: true, firstName: true, lastName: true, ci: true, rude: true, birthDate: true,
                assignments: {
                  include: { course: true, academicYear: { select: { year: true, isActive: true } } },
                  orderBy: { year: 'desc' }, take: 1
                }
              }
            }
          }
        },
        charges: { orderBy: { createdAt: 'desc' }, take: 5 },
      }
    })

    if (!parent) {
      res.status(404).json({ message: 'Padre/tutor no encontrado' })
      return
    }

    res.json(parent)
  } catch (error) {
    console.error('getParentById error:', error)
    res.status(500).json({ message: 'Error al obtener padre/tutor' })
  }
}

// ─────────────────────────────────────────────
// GET /api/parents/:id/students
// ─────────────────────────────────────────────
export const getParentStudents = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params

    const relations = await prisma.parentStudent.findMany({
      where: { parentId: parseInt(id) },
      include: {
        student: {
          select: {
            id: true, firstName: true, lastName: true, ci: true, rude: true, isActive: true,
            assignments: {
              include: { course: true, academicYear: { select: { year: true, isActive: true } } },
              orderBy: { year: 'desc' }, take: 1
            }
          }
        }
      }
    })

    res.json(relations)
  } catch (error) {
    console.error('getParentStudents error:', error)
    res.status(500).json({ message: 'Error al obtener estudiantes del padre' })
  }
}

// ─────────────────────────────────────────────
// POST /api/parents — Crear padre/tutor
// ─────────────────────────────────────────────
export const createParent = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { firstName, lastName, ci, phone, email, address, relationType, studentIds } = req.body

    if (!firstName || !lastName) {
      res.status(400).json({ message: 'Nombre y apellido son requeridos' })
      return
    }

    if (!relationType) {
      res.status(400).json({ message: 'El tipo de relación es requerido' })
      return
    }

    if (ci) {
      const existingCI = await prisma.parent.findUnique({ where: { ci } })
      if (existingCI) {
        res.status(409).json({ message: `Ya existe un padre/tutor con el CI ${ci}` })
        return
      }
    }

    if (studentIds && studentIds.length > 0) {
      for (const sid of studentIds) {
        const student = await prisma.student.findUnique({ where: { id: parseInt(sid) } })
        if (!student) {
          res.status(404).json({ message: `Estudiante con ID ${sid} no encontrado` })
          return
        }
      }
    }

    let accessEmail:     string | undefined
    let defaultPassword: string | undefined
    let userId:          number | undefined

    // Solo TUTOR_LEGAL recibe acceso
    if (relationType === 'TUTOR_LEGAL') {
      try {
        const result = await createTutorUser(firstName, lastName, ci, email)
        userId          = result.user.id
        accessEmail     = result.accessEmail
        defaultPassword = result.defaultPassword
      } catch (err: any) {
        res.status(409).json({ message: err.message })
        return
      }
    }

    // Crear padre — separar casos con y sin userId
    const parent = userId
      ? await prisma.parent.create({
          data: { firstName, lastName, ci: ci || null, phone: phone || null, email: email || null, address: address || null, userId }
        })
      : await prisma.parent.create({
          data: { firstName, lastName, ci: ci || null, phone: phone || null, email: email || null, address: address || null } as any
        })

    // Vincular estudiantes
    if (studentIds && studentIds.length > 0) {
      await prisma.parentStudent.createMany({
        data: studentIds.map((sid: any) => ({
          parentId:     parent.id,
          studentId:    parseInt(sid),
          relationType: relationType,
          isTutor:      relationType === 'TUTOR_LEGAL',
        }))
      })
    }

    const parentFull = await prisma.parent.findUnique({
      where: { id: parent.id },
      include: {
        user: { select: { id: true, email: true, role: true } },
        students: { include: { student: { select: { id: true, firstName: true, lastName: true } } } }
      }
    })

    res.status(201).json({
      message: 'Padre/tutor registrado correctamente',
      parent:  parentFull,
      ...(relationType === 'TUTOR_LEGAL' ? { accessEmail, defaultPassword } : {}),
    })
  } catch (error) {
    console.error('createParent error:', error)
    res.status(500).json({ message: 'Error al registrar padre/tutor' })
  }
}

// ─────────────────────────────────────────────
// PUT /api/parents/:id — Actualizar
// ─────────────────────────────────────────────
export const updateParent = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params
    const { firstName, lastName, ci, phone, email, address } = req.body

    const existing = await prisma.parent.findUnique({ where: { id: parseInt(id) } })
    if (!existing) {
      res.status(404).json({ message: 'Padre/tutor no encontrado' })
      return
    }

    if (ci && ci !== existing.ci) {
      const dup = await prisma.parent.findUnique({ where: { ci } })
      if (dup) {
        res.status(409).json({ message: `Ya existe un padre/tutor con el CI ${ci}` })
        return
      }
    }

    const parent = await prisma.parent.update({
      where: { id: parseInt(id) },
      data: {
        ...(firstName !== undefined ? { firstName }                : {}),
        ...(lastName  !== undefined ? { lastName  }                : {}),
        ...(ci        !== undefined ? { ci:      ci      || null } : {}),
        ...(phone     !== undefined ? { phone:   phone   || null } : {}),
        ...(email     !== undefined ? { email:   email   || null } : {}),
        ...(address   !== undefined ? { address: address || null } : {}),
      },
      include: { user: { select: { id: true, email: true, role: true } } }
    })

    res.json({ message: 'Padre/tutor actualizado correctamente', parent })
  } catch (error) {
    console.error('updateParent error:', error)
    res.status(500).json({ message: 'Error al actualizar padre/tutor' })
  }
}

// ─────────────────────────────────────────────
// PATCH /api/parents/:id/toggle
// ─────────────────────────────────────────────
export const toggleParentStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params

    const parent = await prisma.parent.findUnique({
      where: { id: parseInt(id) },
      include: { user: true }
    })

    if (!parent) {
      res.status(404).json({ message: 'Padre/tutor no encontrado' })
      return
    }

    if (!parent.userId) {
      res.status(400).json({ message: 'Este padre/tutor no tiene acceso al sistema.' })
      return
    }

    await prisma.user.update({
      where: { id: parent.userId },
      data:  { isActive: !parent.user?.isActive }
    })

    const updated = await prisma.parent.findUnique({
      where: { id: parseInt(id) },
      include: { user: { select: { isActive: true } } }
    })

    res.json({
      message: updated?.user?.isActive ? 'Tutor activado' : 'Tutor desactivado',
      parent:  updated
    })
  } catch (error) {
    console.error('toggleParentStatus error:', error)
    res.status(500).json({ message: 'Error al cambiar estado' })
  }
}

// ─────────────────────────────────────────────
// DELETE /api/parents/:id — Eliminar
// ─────────────────────────────────────────────
export const deleteParent = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params

    const parent = await prisma.parent.findUnique({
      where: { id: parseInt(id) },
      include: { _count: { select: { students: true } } }
    })

    if (!parent) {
      res.status(404).json({ message: 'Padre/tutor no encontrado' })
      return
    }

    if (parent._count.students > 0) {
      for (const rel of await prisma.parentStudent.findMany({ where: { parentId: parseInt(id) } })) {
        const otherTutors = await prisma.parentStudent.count({
          where: { studentId: rel.studentId, NOT: { parentId: parseInt(id) } }
        })
        if (otherTutors === 0) {
          const student = await prisma.student.findUnique({
            where: { id: rel.studentId }, select: { firstName: true, lastName: true }
          })
          res.status(400).json({
            message: `No se puede eliminar: ${student?.firstName} ${student?.lastName} no tendría ningún tutor.`
          })
          return
        }
      }
    }

    await prisma.parentStudent.deleteMany({ where: { parentId: parseInt(id) } })

    if (parent.userId) {
      const savedUserId = parent.userId
      await prisma.$executeRaw`UPDATE "Parent" SET "userId" = NULL WHERE id = ${parseInt(id)}`
      await prisma.user.delete({ where: { id: savedUserId } })
    }

    await prisma.parent.delete({ where: { id: parseInt(id) } })
    res.json({ message: 'Padre/tutor eliminado correctamente' })
  } catch (error) {
    console.error('deleteParent error:', error)
    res.status(500).json({ message: 'Error al eliminar padre/tutor' })
  }
}

// ─────────────────────────────────────────────
// POST /api/parents/:id/link-students
// ─────────────────────────────────────────────
export const linkStudents = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params
    const { studentIds, relationType } = req.body

    if (!studentIds || studentIds.length === 0) {
      res.status(400).json({ message: 'Debe proporcionar al menos un estudiante' })
      return
    }

    const parent = await prisma.parent.findUnique({ where: { id: parseInt(id) } })
    if (!parent) {
      res.status(404).json({ message: 'Padre/tutor no encontrado' })
      return
    }

    const results = []
    for (const sid of studentIds) {
      const existing = await prisma.parentStudent.findUnique({
        where: { parentId_studentId: { parentId: parseInt(id), studentId: parseInt(sid) } }
      })
      if (!existing) {
        const rel = await prisma.parentStudent.create({
          data: {
            parentId:     parseInt(id),
            studentId:    parseInt(sid),
            relationType: relationType || 'OTRO',
            isTutor:      relationType === 'TUTOR_LEGAL',
          },
          include: { student: { select: { firstName: true, lastName: true } } }
        })
        results.push(rel)
      }
    }

    res.json({ message: `${results.length} estudiante(s) vinculado(s)`, relations: results })
  } catch (error) {
    console.error('linkStudents error:', error)
    res.status(500).json({ message: 'Error al vincular estudiantes' })
  }
}

// ─────────────────────────────────────────────
// DELETE /api/parents/:id/unlink/:studentId
// ─────────────────────────────────────────────
export const unlinkStudent = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id, studentId } = req.params

    const otherTutors = await prisma.parentStudent.count({
      where: { studentId: parseInt(studentId), NOT: { parentId: parseInt(id) } }
    })

    if (otherTutors === 0) {
      res.status(400).json({ message: 'No se puede desvincular: el estudiante no tendría ningún tutor.' })
      return
    }

    await prisma.parentStudent.delete({
      where: { parentId_studentId: { parentId: parseInt(id), studentId: parseInt(studentId) } }
    })

    res.json({ message: 'Estudiante desvinculado correctamente' })
  } catch (error) {
    console.error('unlinkStudent error:', error)
    res.status(500).json({ message: 'Error al desvincular estudiante' })
  }
}

// ─────────────────────────────────────────────
// POST /api/parents/:id/generate-credentials
// ─────────────────────────────────────────────
export const generateParentCredentials = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params

    const parent = await prisma.parent.findUnique({
      where: { id: parseInt(id) },
      include: { user: true, students: { select: { relationType: true } } }
    })

    if (!parent) {
      res.status(404).json({ message: 'Padre/tutor no encontrado' })
      return
    }

    if (parent.userId) {
      res.status(400).json({ message: 'Este padre/tutor ya tiene acceso al sistema' })
      return
    }

    const isTutorLegal = parent.students.some(s => s.relationType === 'TUTOR_LEGAL')
    if (!isTutorLegal) {
      res.status(400).json({ message: 'Solo se puede generar acceso para tutores legales' })
      return
    }

    let result
    try {
      result = await createTutorUser(parent.firstName, parent.lastName, parent.ci || undefined, parent.email || undefined)
    } catch (err: any) {
      res.status(409).json({ message: err.message })
      return
    }

    await prisma.parent.update({ where: { id: parseInt(id) }, data: { userId: result.user.id } })

    res.json({
      message:         'Credenciales generadas correctamente',
      accessEmail:     result.accessEmail,
      defaultPassword: result.defaultPassword,
    })
  } catch (error) {
    console.error('generateParentCredentials error:', error)
    res.status(500).json({ message: 'Error al generar credenciales' })
  }
}

// ─────────────────────────────────────────────
// PATCH /api/parents/:id/change-tutor
// Cambia el tutor legal — puede ser un padre ya
// registrado o uno nuevo designado como tutor
// ─────────────────────────────────────────────
export const changeTutor = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params          // ID del estudiante
    const { newTutorId } = req.body    // ID del nuevo tutor legal (ya registrado como padre)

    if (!newTutorId) {
      res.status(400).json({ message: 'El ID del nuevo tutor es requerido' })
      return
    }

    // Verificar que el nuevo tutor existe
    const newTutor = await prisma.parent.findUnique({
      where: { id: parseInt(newTutorId) },
      include: { students: { where: { studentId: parseInt(id) } } }
    })

    if (!newTutor) {
      res.status(404).json({ message: 'El nuevo tutor no fue encontrado' })
      return
    }

    // Verificar que el nuevo tutor está vinculado al estudiante
    if (newTutor.students.length === 0) {
      res.status(400).json({ message: 'El nuevo tutor no está vinculado a este estudiante' })
      return
    }

    // Quitar TUTOR_LEGAL anterior para este estudiante
    await prisma.parentStudent.updateMany({
      where: { studentId: parseInt(id), relationType: 'TUTOR_LEGAL' },
      data:  { relationType: 'OTRO', isTutor: false }
    })

    // Asignar nuevo TUTOR_LEGAL
    await prisma.parentStudent.update({
      where: { parentId_studentId: { parentId: parseInt(newTutorId), studentId: parseInt(id) } },
      data:  { relationType: 'TUTOR_LEGAL', isTutor: true }
    })

    // Si el nuevo tutor no tiene usuario, generarle acceso
    let accessEmail:     string | undefined
    let defaultPassword: string | undefined

    if (!newTutor.userId) {
      try {
        const result = await createTutorUser(newTutor.firstName, newTutor.lastName, newTutor.ci || undefined, newTutor.email || undefined)
        await prisma.parent.update({ where: { id: parseInt(newTutorId) }, data: { userId: result.user.id } })
        accessEmail     = result.accessEmail
        defaultPassword = result.defaultPassword
      } catch (err: any) {
        // Si falla la generación de credenciales no bloqueamos el cambio
        console.error('Error generando credenciales para nuevo tutor:', err.message)
      }
    }

    res.json({
      message: 'Tutor legal cambiado correctamente',
      ...(accessEmail ? { accessEmail, defaultPassword, note: 'Se generaron credenciales para el nuevo tutor' } : {}),
    })
  } catch (error) {
    console.error('changeTutor error:', error)
    res.status(500).json({ message: 'Error al cambiar tutor legal' })
  }
}
// ─────────────────────────────────────────────
// POST /api/parents/import — Importar padres desde Excel
// ─────────────────────────────────────────────
export const importParents = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.file) {
      res.status(400).json({ message: 'No se subió ningún archivo' })
      return
    }

    const XLSX     = require('xlsx')
    const bcrypt   = require('bcryptjs')
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' })
    const sheet    = workbook.Sheets[workbook.SheetNames[0]]
    const rows     = XLSX.utils.sheet_to_json(sheet, { defval: '' })

    const created = []
    const errors  = []
    const skipped = []

    for (const row of rows as any[]) {
      ///console.log('Fila:', JSON.stringify(row))
      try {
        const kardex = String(row['NROKARDEX'] || '').trim()

        if (!kardex) {
          errors.push({ kardex: '', reason: 'Sin kardex' })
          continue
        }

        // Buscar estudiantes con este kardex
        const students = await prisma.student.findMany({
          where: { kardex }
        })

        const sinVincular = students.length === 0
if (sinVincular) {
  skipped.push({ kardex, reason: 'Sin kardex — se registrará sin vinculación' })
}

        // ── Registrar PADRE ──────────────────────────
        const nombrePadre   = String(row['NOMBREPADRE']   || '').trim()
        const apellidoPadre = String(row['APELLIDOPADRE'] || '').trim()
        const ciPadre       = String(row['NROCIPADRE']    || '').trim()
        const telPadre      = String(row['TELEFONOPADRE'] || '').trim()

        if (nombrePadre && apellidoPadre) {
          let padre = null
if (ciPadre) {
  padre = await prisma.parent.findUnique({ where: { ci: ciPadre } })
}
if (!padre && nombrePadre && apellidoPadre) {
  padre = await prisma.parent.findFirst({
    where: {
      firstName: { contains: nombrePadre, mode: 'insensitive' },
      lastName:  { contains: apellidoPadre, mode: 'insensitive' },
    }
  })
}
          if (!padre) {
            // Crear usuario para el padre
            const baseEmail = `${nombrePadre.split(' ')[0].toLowerCase()}.${apellidoPadre.split(' ')[0].toLowerCase()}@nnuu.edu.bo`
              .normalize('NFD').replace(/[\u0300-\u036f]/g, '')

            let email = baseEmail
            let emailExists = await prisma.user.findUnique({ where: { email } })
            let counter = 1
            while (emailExists) {
              email = baseEmail.replace('@', `${counter}@`)
              emailExists = await prisma.user.findUnique({ where: { email } })
              counter++
            }

            const year     = new Date().getFullYear()
            const ci4      = ciPadre ? ciPadre.slice(-4) : apellidoPadre.substring(0, 3).toLowerCase()
            const password = `padre${ci4}${year}`
            const hashed   = await bcrypt.hash(password, 10)

            const user = await prisma.user.create({
              data: { email, password: hashed, role: 'PARENT', isActive: true }
            })

            padre = await prisma.parent.create({
              data: {
                firstName: nombrePadre,
                lastName:  apellidoPadre,
                ci:        ciPadre   || null,
                phone:     telPadre  || null,
                userId:    user.id,
              }
            })

            created.push({ name: `${apellidoPadre} ${nombrePadre}`, type: 'PADRE', email, password })
          }

          // Vincular padre con todos los estudiantes del kardex
          if (!sinVincular) {
          for (const student of students) {
            const existing = await prisma.parentStudent.findUnique({
              where: { parentId_studentId: { parentId: padre!.id, studentId: student.id } }
            })
            if (!existing) {
              await prisma.parentStudent.create({
                data: {
                  parentId:    padre!.id,
                  studentId:   student.id,
                  relationType: 'PADRE',
                  isTutor:     false,
                }
              })
            }
          }
          }
        }

        // ── Registrar MADRE ──────────────────────────
        const nombreMadre   = String(row['NOMBRESMADRE']   || '').trim()
        const apellidoMadre = String(row['APELLIDOSMADRE'] || '').trim()
        const ciMadre       = String(row['NROCIMADRE']     || '').trim()
        const telMadre      = String(row['TELEFONOMADRE']  || '').trim()

        if (nombreMadre && apellidoMadre) {
          let madre = null
if (ciMadre) {
  madre = await prisma.parent.findUnique({ where: { ci: ciMadre } })
}
if (!madre && nombreMadre && apellidoMadre) {
  madre = await prisma.parent.findFirst({
    where: {
      firstName: { contains: nombreMadre, mode: 'insensitive' },
      lastName:  { contains: apellidoMadre, mode: 'insensitive' },
    }
  })
}
          if (!madre) {
            const baseEmail = `${nombreMadre.split(' ')[0].toLowerCase()}.${apellidoMadre.split(' ')[0].toLowerCase()}@nnuu.edu.bo`
              .normalize('NFD').replace(/[\u0300-\u036f]/g, '')

            let email = baseEmail
            let emailExists = await prisma.user.findUnique({ where: { email } })
            let counter = 1
            while (emailExists) {
              email = baseEmail.replace('@', `${counter}@`)
              emailExists = await prisma.user.findUnique({ where: { email } })
              counter++
            }

            const year     = new Date().getFullYear()
            const ci4      = ciMadre ? ciMadre.slice(-4) : apellidoMadre.substring(0, 3).toLowerCase()
            const password = `padre${ci4}${year}`
            const hashed   = await bcrypt.hash(password, 10)

            const user = await prisma.user.create({
              data: { email, password: hashed, role: 'PARENT', isActive: true }
            })

            madre = await prisma.parent.create({
              data: {
                firstName: nombreMadre,
                lastName:  apellidoMadre,
                ci:        ciMadre  || null,
                phone:     telMadre || null,
                userId:    user.id,
              }
            })

            created.push({ name: `${apellidoMadre} ${nombreMadre}`, type: 'MADRE', email, password })
          }

          // Vincular madre con todos los estudiantes del kardex
           if (!sinVincular) {
          for (const student of students) {
            const existing = await prisma.parentStudent.findUnique({
              where: { parentId_studentId: { parentId: madre!.id, studentId: student.id } }
            })
            if (!existing) {
              await prisma.parentStudent.create({
                data: {
                  parentId:    madre!.id,
                  studentId:   student.id,
                  relationType: 'MADRE',
                  isTutor:     false,
                }
              })
            }
          }
          }
        }

      } catch (e: any) {
        errors.push({
          kardex: String(row['NROKARDEX'] || ''),
          reason: e.message || 'Error desconocido'
        })
      }
    }

    res.status(201).json({
      message: `Importación completada: ${created.length} registros creados, ${skipped.length} omitidos, ${errors.length} errores`,
      created,
      skipped,
      errors,
      total: rows.length,
    })
  } catch (error) {
    console.error('importParents error:', error)
    res.status(500).json({ message: 'Error al importar padres' })
  }
}
// ─────────────────────────────────────────────
// PATCH /api/parents/:id/changeRelation
// asigna untutor legal — puede ser un padre ya
// registrado o uno nuevo designado como tutor
// ─────────────────────────────────────────────
export const changeRelation = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id, studentId } = req.params
    const { relationType, isTutor } = req.body

    // Si se marca como tutor legal, quitar tutor anterior de este estudiante
    if (isTutor) {
      await prisma.parentStudent.updateMany({
        where:  { studentId: parseInt(studentId), isTutor: true },
        data:   { isTutor: false, relationType: 'OTRO' }
      })
    }

    // Actualizar la relación
    await prisma.parentStudent.update({
      where: { parentId_studentId: { parentId: parseInt(id), studentId: parseInt(studentId) } },
      data:  { 
        relationType: relationType as any,
        isTutor:      isTutor || false 
      }
    })

    // Si es tutor legal y no tiene usuario, generarle acceso
    const parent = await prisma.parent.findUnique({
      where: { id: parseInt(id) },
      include: { user: true }
    })

    let accessEmail:     string | undefined
    let defaultPassword: string | undefined

    if (isTutor && parent && !parent.userId) {
      try {
        const result = await createTutorUser(parent.firstName, parent.lastName, parent.ci || undefined, parent.email || undefined)
        await prisma.parent.update({ where: { id: parseInt(id) }, data: { userId: result.user.id } })
        accessEmail     = result.accessEmail
        defaultPassword = result.defaultPassword
      } catch (err: any) {
        console.error('Error generando credenciales:', err.message)
      }
    }

    res.json({
      message: 'Relación actualizada correctamente',
      ...(accessEmail ? { accessEmail, defaultPassword } : {}),
    })
  } catch (error) {
    console.error('changeRelation error:', error)
    res.status(500).json({ message: 'Error al actualizar relación' })
  }
}
///padre logeado
export const getMe = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const parent = await prisma.parent.findUnique({
      where: { userId: req.userId },
      include: {
        students: {
          include: {
            student: {
              include: {
                assignments: {
                  include: { course: true, academicYear: { select: { isActive: true, year: true } } }
                }
              }
            }
          }
        },
        charges: { where: { status: { not: 'ANULADO' } }, orderBy: { createdAt: 'desc' } }
      }
    })
    if (!parent) { res.status(404).json({ message: 'Perfil no encontrado' }); return }
    res.json(parent)
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener perfil' })
  }
}