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
// Función: generar contraseña identificable
// Con RUDE: rude completo
// Sin RUDE: primeras 4 letras apellido + año
// ─────────────────────────────────────────────
const generateStudentPassword = (lastName: string, rude?: string): string => {
  const year = new Date().getFullYear()

  if (rude && rude.trim() !== '') {
    return rude.trim()
  }

  const normalize = (str: string) =>
    str.toUpperCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^A-Z]/g, '')

  const letters = normalize(lastName.split(' ')[0]).slice(0, 4)
  return `${letters}${year}`
}

// ─────────────────────────────────────────────
// GET /api/students — Listar estudiantes
// Búsqueda por palabras individuales
// ─────────────────────────────────────────────
export const getStudents = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { search, isActive } = req.query

    // Dividir búsqueda en palabras individuales
    const searchWords = search
      ? (search as string).split(' ').filter(w => w.trim().length > 0)
      : []

    const students = await prisma.student.findMany({
      where: {
        ...(isActive !== undefined ? { isActive: isActive === 'true' } : {}),
        ...(searchWords.length > 0 ? {
          OR: searchWords.flatMap(word => [
            { firstName: { contains: word, mode: 'insensitive' as const } },
            { lastName:  { contains: word, mode: 'insensitive' as const } },
            { ci:        { contains: word, mode: 'insensitive' as const } },
            { rude:      { contains: word, mode: 'insensitive' as const } },
          ])
        } : {})
      },
      include: {
        user: { select: { id: true, email: true, role: true, isActive: true } },
        parents: {
          include: {
            parent: { select: { id: true, firstName: true, lastName: true, phone: true } }
          }
        },
        assignments: {
          include: {
            course: true,
            academicYear: { select: { year: true, isActive: true } }
          },
          orderBy: { year: 'desc' },
          take: 1
        },
        _count: { select: { assignments: true } }
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }]
    })

    res.json(students)
  } catch (error) {
    console.error('getStudents error:', error)
    res.status(500).json({ message: 'Error al obtener estudiantes' })
  }
}

// ─────────────────────────────────────────────
// GET /api/students/:id — Obtener un estudiante
// ─────────────────────────────────────────────
export const getStudentById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params

    const student = await prisma.student.findUnique({
      where: { id: parseInt(id) },
      include: {
        user: { select: { id: true, email: true, role: true, isActive: true } },
        parents: {
          include: {
            parent: {
              select: {
                id: true, firstName: true, lastName: true,
                ci: true, phone: true, email: true, address: true
              }
            }
          }
        },
        assignments: {
          include: {
            course: true,
            academicYear: { select: { id: true, year: true, isActive: true } }
          },
          orderBy: { year: 'desc' }
        }
      }
    })

    if (!student) {
      res.status(404).json({ message: 'Estudiante no encontrado' })
      return
    }

    res.json(student)
  } catch (error) {
    console.error('getStudentById error:', error)
    res.status(500).json({ message: 'Error al obtener estudiante' })
  }
}

// ─────────────────────────────────────────────
// GET /api/students/:id/enrollments
// ─────────────────────────────────────────────
export const getStudentEnrollments = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params

    const enrollments = await prisma.studentAcademicAssignment.findMany({
      where: { studentId: parseInt(id) },
      include: {
        course: true,
        academicYear: { select: { year: true, isActive: true } }
      },
      orderBy: { year: 'desc' }
    })

    res.json(enrollments)
  } catch (error) {
    console.error('getStudentEnrollments error:', error)
    res.status(500).json({ message: 'Error al obtener inscripciones' })
  }
}

// ─────────────────────────────────────────────
// POST /api/students — Crear estudiante
// ─────────────────────────────────────────────
export const createStudent = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { firstName, lastName, ci, rude, birthDate, phone, email, address,gender } = req.body

    if (!firstName || !lastName) {
      res.status(400).json({ message: 'Nombre y apellido son requeridos' })
      return
    }

    if (ci) {
      const existingCI = await prisma.student.findUnique({ where: { ci } })
      if (existingCI) {
        res.status(409).json({ message: `Ya existe un estudiante con el CI ${ci}` })
        return
      }
    }

    if (rude) {
      const existingRUDE = await prisma.student.findUnique({ where: { rude } })
      if (existingRUDE) {
        res.status(409).json({ message: `Ya existe un estudiante con el RUDE ${rude}` })
        return
      }
    }

    const generatedEmail  = await generateEmail(firstName, lastName)
    const defaultPassword = generateStudentPassword(lastName, rude)
    const hashedPassword  = await bcrypt.hash(defaultPassword, 10)

    const user = await prisma.user.create({
      data: { email: generatedEmail, password: hashedPassword, role: 'STUDENT', isActive: true }
    })

    const student = await prisma.student.create({
      data: {
        firstName,
        lastName,
        gender,
        ci:        ci        || null,
        rude:      rude      || null,
        birthDate: birthDate ? new Date(birthDate) : null,
        phone:     phone     || null,
        email:     email     || null,
        address:   address   || null,
        isActive:  true,
        userId:    user.id,
      },
      include: {
        user: { select: { id: true, email: true, role: true } }
      }
    })

    res.status(201).json({
      message:         'Estudiante registrado correctamente',
      student,
      accessEmail:     generatedEmail,
      defaultPassword,
      passwordHint:    rude
        ? `Contraseña = RUDE del estudiante`
        : `Contraseña = primeras 4 letras del apellido + año`,
    })
  } catch (error) {
    console.error('createStudent error:', error)
    res.status(500).json({ message: 'Error al registrar estudiante' })
  }
}

// ─────────────────────────────────────────────
// PUT /api/students/:id — Actualizar
// ─────────────────────────────────────────────
export const updateStudent = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params
    const { firstName, lastName, ci, rude, birthDate, phone, email, address,gender } = req.body

    const existing = await prisma.student.findUnique({ where: { id: parseInt(id) } })
    if (!existing) {
      res.status(404).json({ message: 'Estudiante no encontrado' })
      return
    }

    if (ci && ci !== existing.ci) {
      const dup = await prisma.student.findUnique({ where: { ci } })
      if (dup) {
        res.status(409).json({ message: `Ya existe un estudiante con el CI ${ci}` })
        return
      }
    }

    if (rude && rude !== existing.rude) {
      const dup = await prisma.student.findUnique({ where: { rude } })
      if (dup) {
        res.status(409).json({ message: `Ya existe un estudiante con el RUDE ${rude}` })
        return
      }
    }

    const student = await prisma.student.update({
      where: { id: parseInt(id) },
      data: {
        ...(firstName !== undefined ? { firstName }                    : {}),
        ...(lastName  !== undefined ? { lastName  }                    : {}),
        ...(ci        !== undefined ? { ci:      ci      || null }     : {}),
        ...(rude      !== undefined ? { rude:    rude    || null }     : {}),
        ...(birthDate !== undefined ? { birthDate: birthDate ? new Date(birthDate) : null } : {}),
        ...(phone     !== undefined ? { phone:   phone   || null }     : {}),
        ...(email     !== undefined ? { email:   email   || null }     : {}),
        ...(address   !== undefined ? { address: address || null }     : {}),
        ...(gender   !== undefined ? { gender}     : {}),
      },
      include: {
        user: { select: { id: true, email: true, role: true } }
      }
    })

    res.json({ message: 'Estudiante actualizado correctamente', student })
  } catch (error) {
    console.error('updateStudent error:', error)
    res.status(500).json({ message: 'Error al actualizar estudiante' })
  }
}

// ─────────────────────────────────────────────
// PATCH /api/students/:id/toggle
// ─────────────────────────────────────────────
export const toggleStudentStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params

    const student = await prisma.student.findUnique({ where: { id: parseInt(id) } })
    if (!student) {
      res.status(404).json({ message: 'Estudiante no encontrado' })
      return
    }

    const updated = await prisma.student.update({
      where: { id: parseInt(id) },
      data:  { isActive: !student.isActive }
    })

    res.json({
      message: updated.isActive ? 'Estudiante activado' : 'Estudiante desactivado',
      student: updated
    })
  } catch (error) {
    console.error('toggleStudentStatus error:', error)
    res.status(500).json({ message: 'Error al cambiar estado' })
  }
}

// ─────────────────────────────────────────────
// DELETE /api/students/:id
// ─────────────────────────────────────────────
export const deleteStudent = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params

    const student = await prisma.student.findUnique({
      where: { id: parseInt(id) },
      include: { _count: { select: { assignments: true } } }
    })

    if (!student) {
      res.status(404).json({ message: 'Estudiante no encontrado' })
      return
    }

    // Bloquear si tiene inscripciones
    if (student._count.assignments > 0) {
      res.status(400).json({
        message: `No se puede eliminar porque tiene ${student._count.assignments} inscripción(es). Desactívalo en su lugar.`
      })
      return
    }

    // Sin inscripciones — eliminar todas las relaciones
    await prisma.taskSubmission.deleteMany({ where: { studentId: parseInt(id) } })
    await prisma.nota.deleteMany({ where: { studentId: parseInt(id) } })
    await prisma.charge.deleteMany({ where: { studentId: parseInt(id) } })
    await prisma.parentStudent.deleteMany({ where: { studentId: parseInt(id) } })

    // Desvincular y eliminar usuario
    if (student.userId) {
      const savedUserId = student.userId
      await prisma.$executeRaw`UPDATE "Student" SET "userId" = NULL WHERE id = ${parseInt(id)}`
      await prisma.user.delete({ where: { id: savedUserId } })
    }

    await prisma.student.delete({ where: { id: parseInt(id) } })
    res.json({ message: 'Estudiante eliminado correctamente' })
  } catch (error) {
    console.error('deleteStudent error:', error)
    res.status(500).json({ message: 'Error al eliminar estudiante' })
  }
}

// ─────────────────────────────────────────────
// POST /api/students/:id/generate-credentials
// ─────────────────────────────────────────────
export const generateCredentials = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params

    const student = await prisma.student.findUnique({
      where: { id: parseInt(id) },
      include: { user: true }
    })

    if (!student) {
      res.status(404).json({ message: 'Estudiante no encontrado' })
      return
    }

    if (student.userId) {
      res.status(400).json({ message: 'El estudiante ya tiene un usuario asignado' })
      return
    }

    const generatedEmail  = await generateEmail(student.firstName, student.lastName)
    const defaultPassword = generateStudentPassword(student.lastName, student.rude || undefined)
    const hashedPassword  = await bcrypt.hash(defaultPassword, 10)

    const user = await prisma.user.create({
      data: { email: generatedEmail, password: hashedPassword, role: 'STUDENT', isActive: true }
    })

    await prisma.student.update({ where: { id: parseInt(id) }, data: { userId: user.id } })

    res.json({
      message:         'Credenciales generadas correctamente',
      accessEmail:     generatedEmail,
      defaultPassword,
      passwordHint:    student.rude
        ? `Contraseña = RUDE del estudiante`
        : `Contraseña = primeras 4 letras del apellido + año`,
    })
  } catch (error) {
    console.error('generateCredentials error:', error)
    res.status(500).json({ message: 'Error al generar credenciales' })
  }
}

// ─────────────────────────────────────────────
// POST /api/students/:id/enroll — Inscribir
// ─────────────────────────────────────────────
export const enrollStudent = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id }      = req.params
    const { courseId, educationType } = req.body

    if (!courseId) {
      res.status(400).json({ message: 'El curso es requerido' })
      return
    }

    const student = await prisma.student.findUnique({ where: { id: parseInt(id) } })
    if (!student) {
      res.status(404).json({ message: 'Estudiante no encontrado' })
      return
    }

    const activeYear = await prisma.academicYear.findFirst({ where: { isActive: true } })
    if (!activeYear) {
      res.status(400).json({ message: 'No hay gestión académica activa' })
      return
    }

    const course = await prisma.course.findUnique({ where: { id: parseInt(courseId) } })
    if (!course) {
      res.status(404).json({ message: 'Curso no encontrado' })
      return
    }

    const eduType = educationType || course.educationType

    const existingEnrollment = await prisma.studentAcademicAssignment.findUnique({
      where: {
        studentId_academicYearId_educationType: {
          studentId:      parseInt(id),
          academicYearId: activeYear.id,
          educationType:  eduType,
        }
      }
    })

    if (existingEnrollment) {
      res.status(409).json({
        message: `El estudiante ya está inscrito en un curso ${eduType} en la gestión ${activeYear.year}`
      })
      return
    }

    const BTH_GRADES = ['TERCERO', 'CUARTO', 'QUINTO', 'SEXTO']
    if (eduType === 'BTH') {
      if (course.level !== 'SECUNDARIA' || !BTH_GRADES.includes(course.grade)) {
        res.status(400).json({ message: 'El curso BTH solo aplica en Secundaria desde 3° grado' })
        return
      }
    }

    const enrollment = await prisma.studentAcademicAssignment.create({
      data: {
        studentId:      parseInt(id),
        courseId:       parseInt(courseId),
        academicYearId: activeYear.id,
        educationType:  eduType,
        year:           activeYear.year,
      },
      include: {
        course:       true,
        academicYear: { select: { year: true } }
      }
    })

    res.status(201).json({
      message:    `Estudiante inscrito en ${activeYear.year} correctamente`,
      enrollment
    })
  } catch (error) {
    console.error('enrollStudent error:', error)
    res.status(500).json({ message: 'Error al inscribir estudiante' })
  }
}
// ─────────────────────────────────────────────
// POST /api/students/import — Importar estudiantes desde Excel
// ─────────────────────────────────────────────
export const importStudents = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.file) {
      res.status(400).json({ message: 'No se subió ningún archivo' })
      return
    }
 
    const XLSX    = require('xlsx')
    const bcrypt  = require('bcryptjs')
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' })
    const sheet    = workbook.Sheets[workbook.SheetNames[0]]
    const rows     = XLSX.utils.sheet_to_json(sheet, { defval: '' })
   console.log('Primera fila:', JSON.stringify(rows[0]))
    const created = []
    const errors  = []
    const skipped = []
 
    for (const row of rows as any[]) {
      try {
       const firstName   = String(row['NOMBRESCOMPLETO'] || row['NOMBRES'] || row['NOMBRECOMPLETO'] || '').trim()
          const lastName    = String(row['APELLIDOS']  || '').trim()
          const rude        = String(row['RUDE']       || '').trim()
          const kardex      = String(row['NROKARDEX']  || '').trim()
          const tutorLegal  = String(row['TUTORLEGAL'] || '').trim()
          const generoRaw   = String(row['GENERO']     || '').trim().toUpperCase()
          const gender      = generoRaw === 'F' ? 'FEMENINO' : 'MASCULINO'
 
        if (!firstName || !lastName) {
          errors.push({ rude, reason: 'Nombre o apellido vacío' })
          continue
        }
 
        // Verificar si ya existe por RUDE
if (rude) {
  const existing = await prisma.student.findUnique({ where: { rude } })
  if (existing) {
    skipped.push({ rude, name: `${lastName} ${firstName}`, reason: 'RUDE ya registrado' })
    continue
  }
}

// Verificar si ya existe por kardex + nombre + apellido
if (kardex) {
  const existing = await prisma.student.findFirst({
    where: { kardex, firstName, lastName }
  })
  if (existing) {
    skipped.push({ rude, name: `${lastName} ${firstName}`, reason: 'Estudiante ya registrado' })
    continue
  }
}
 
        // Generar email único
        const baseEmail = `${firstName.split(' ')[0].toLowerCase()}.${lastName.split(' ')[0].toLowerCase()}@nnuu.edu.bo`
          .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        
        let email = baseEmail
        let emailExists = await prisma.user.findUnique({ where: { email } })
        let counter = 1
        while (emailExists) {
          email = `${baseEmail.replace('@', `${counter}@`)}`
          emailExists = await prisma.user.findUnique({ where: { email } })
          counter++
        }
 
        // Generar contraseña
        const year     = new Date().getFullYear()
        const password = rude
          ? rude
          : `${lastName.substring(0, 4).toLowerCase()}${year}`
        const hashed   = await bcrypt.hash(password, 10)
 
        // Crear usuario
        const user = await prisma.user.create({
          data: { email, password: hashed, role: 'STUDENT', isActive: true }
        })
 
        // Crear estudiante
        const student = await prisma.student.create({
          data: {
            firstName,
            lastName,
            gender:   gender as any,
            rude:     rude || null,
            kardex:   kardex  || null,
            isActive: true,
            userId:   user.id,
          }
        })
 
        created.push({
          name:     `${lastName} ${firstName}`,
          rude,
          email,
          password,
          gender,
        })
      } catch (e: any) {
        errors.push({
          rude: String(row['RUDE'] || ''),
          name: `${row['APELLIDOS'] || ''} ${row['NOMBRECOMPLETO'] || ''}`,
          reason: e.message || 'Error desconocido'
        })
      }
    }
 
    res.status(201).json({
      message: `Importación completada: ${created.length} creados, ${skipped.length} omitidos, ${errors.length} errores`,
      created,
      skipped,
      errors,
      total: rows.length,
    })
  } catch (error) {
    console.error('importStudents error:', error)
    res.status(500).json({ message: 'Error al importar estudiantes' })
  }
}
// ─────────────────────────────────────────────
// POST /api/students/import-tutors — Importar tutores legales desde Excel
// ─────────────────────────────────────────────
export const importTutors = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.file) {
      res.status(400).json({ message: 'No se subió ningún archivo' })
      return
    }

    const XLSX     = require('xlsx')
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' })
    const sheet    = workbook.Sheets[workbook.SheetNames[0]]
    const rows     = XLSX.utils.sheet_to_json(sheet, { defval: '' })

    const assigned = []
    const skipped  = []
    const errors   = []

    for (const row of rows as any[]) {
      try {
        const rude        = String(row['RUDE']          || '').trim()
        const kardex      = String(row['NROKARDEX']      || '').trim()
        const tutorNombre = String(row['TUTORLEGAL']     || '').trim()

        // Ignorar filas sin tutor o con SIN REGISTRO
        if (!tutorNombre || tutorNombre.toUpperCase() === 'SIN REGISTRO') {
          skipped.push({ rude, kardex, reason: 'Sin tutor legal registrado' })
          continue
        }

        // Buscar estudiante por RUDE o kardex
        let student = null
        if (rude) {
          student = await prisma.student.findUnique({ where: { rude } })
        }
        if (!student && kardex) {
          student = await prisma.student.findFirst({ where: { kardex } })
        }

        if (!student) {
          skipped.push({ rude, kardex, reason: 'Estudiante no encontrado' })
          continue
        }

        // Buscar tutor por nombre completo
        // El nombre puede venir como "APELLIDO1 APELLIDO2 NOMBRE" o "NOMBRE APELLIDO"
        const palabras   = tutorNombre.split(' ').filter(p => p.length > 0)
        const tutores    = await prisma.parent.findMany({
          where: {
            OR: [
              { lastName:  { contains: palabras[0], mode: 'insensitive' } },
              { firstName: { contains: palabras[0], mode: 'insensitive' } },
            ]
          },
          include: { students: { where: { studentId: student.id } } }
        })

        // Filtrar el tutor que mejor coincida
        let tutor = tutores.find(t => {
          const fullName = `${t.firstName} ${t.lastName}`.toUpperCase()
          const fullName2 = `${t.lastName} ${t.firstName}`.toUpperCase()
          return fullName.includes(palabras[0].toUpperCase()) ||
                 fullName2.includes(palabras[0].toUpperCase())
        })

        // Si tiene más palabras, filtrar más
        if (tutores.length > 1 && palabras.length > 1) {
          const mejor = tutores.find(t => {
            const fullName = `${t.firstName} ${t.lastName}`.toUpperCase()
            return palabras.every(p => fullName.includes(p.toUpperCase()))
          })
          if (mejor) tutor = mejor
        }

        if (!tutor) {
          errors.push({ rude, kardex, tutorNombre, reason: 'Tutor no encontrado en el sistema' })
          continue
        }

        // Quitar tutor legal anterior de este estudiante
        await prisma.parentStudent.updateMany({
          where: { studentId: student.id, isTutor: true },
          data:  { isTutor: false }
        })

        // Verificar si el tutor ya está vinculado al estudiante
        const existingLink = await prisma.parentStudent.findUnique({
          where: { parentId_studentId: { parentId: tutor.id, studentId: student.id } }
        })

        if (existingLink) {
  await prisma.parentStudent.update({
    where: { parentId_studentId: { parentId: tutor.id, studentId: student.id } },
    data:  { isTutor: true }
  })
} else {
          // Crear nueva vinculación como tutor legal
          await prisma.parentStudent.create({
            data: {
              parentId:    tutor.id,
              studentId:   student.id,
              relationType: 'TUTOR_LEGAL',
              isTutor:     true,
            }
          })
        }

        // Actualizar rol del usuario a PARENT si no lo tiene
        if (tutor.userId) {
          await prisma.user.update({
            where: { id: tutor.userId },
            data:  { role: 'PARENT', isActive: true }
          })
        }

        assigned.push({
          student:  `${student.lastName} ${student.firstName}`,
          tutor:    `${tutor.lastName} ${tutor.firstName}`,
          kardex,
          rude,
        })

      } catch (e: any) {
        errors.push({
          rude:    String(row['RUDE']      || ''),
          kardex:  String(row['NROKARDEX'] || ''),
          tutorNombre: String(row['TUTORLEGAL'] || ''),
          reason:  e.message || 'Error desconocido'
        })
      }
    }

    res.status(200).json({
      message:  `Importación completada: ${assigned.length} tutores asignados, ${skipped.length} omitidos, ${errors.length} errores`,
      assigned,
      skipped,
      errors,
      total: rows.length,
    })
  } catch (error) {
    console.error('importTutors error:', error)
    res.status(500).json({ message: 'Error al importar tutores' })
  }



}
// GET /api/students/by-course/:courseId — Estudiantes de un curso
export const getStudentsByCourse = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { courseId } = req.params

    const activeYear = await prisma.academicYear.findFirst({ where: { isActive: true } })
    if (!activeYear) {
      res.status(400).json({ message: 'No hay gestión académica activa' })
      return
    }

    const assignments = await prisma.studentAcademicAssignment.findMany({
      where: {
        courseId:      parseInt(courseId),
        academicYearId: activeYear.id,
      },
      include: {
        student: {
          select: {
            id: true, firstName: true, lastName: true,
            ci: true, rude: true, gender: true, isActive: true,
            parents: {
              where: { isTutor: true },
              include: {
                parent: {
                  select: {
                    id: true, firstName: true, lastName: true, phone: true, ci: true
                  }
                }
              }
            }
          }
        }
      },
      orderBy: { student: { lastName: 'asc' } }
    })

    res.json(assignments)
  } catch (error) {
    console.error('getStudentsByCourse error:', error)
    res.status(500).json({ message: 'Error al obtener estudiantes del curso' })
  }
}
// PUT /api/students/:id/enroll — Cambiar inscripción
export const changeEnrollment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id }      = req.params
    const { courseId } = req.body

    if (!courseId) {
      res.status(400).json({ message: 'El curso es requerido' }); return
    }

    const activeYear = await prisma.academicYear.findFirst({ where: { isActive: true } })
    if (!activeYear) {
      res.status(400).json({ message: 'No hay gestión académica activa' }); return
    }

    // Eliminar inscripción actual
    await prisma.studentAcademicAssignment.deleteMany({
      where: { studentId: parseInt(id), academicYearId: activeYear.id }
    })

    // Crear nueva inscripción
    const course = await prisma.course.findUnique({ where: { id: parseInt(courseId) } })
    if (!course) {
      res.status(404).json({ message: 'Curso no encontrado' }); return
    }

    const enrollment = await prisma.studentAcademicAssignment.create({
      data: {
        studentId:      parseInt(id),
        courseId:       parseInt(courseId),
        academicYearId: activeYear.id,
        educationType:  course.educationType,
        year:           activeYear.year,
      },
      include: {
        course:       true,
        academicYear: { select: { year: true } }
      }
    })

    res.json({ message: 'Inscripción actualizada correctamente', enrollment })
  } catch (error) {
    console.error('changeEnrollment error:', error)
    res.status(500).json({ message: 'Error al cambiar inscripción' })
  }
}
// GET /api/students/me
export const getMyProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId

    const student = await prisma.student.findUnique({
      where: { userId },
      include: {
        assignments: {
          where: { academicYear: { isActive: true } },
          include: {
            course:       { select: { id: true, grade: true, parallel: true, level: true, shift: true } },
            academicYear: { select: { id: true, year: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        parents: {
          where: { isTutor: true },
          include: {
            parent: { select: { firstName: true, lastName: true, phone: true } },
          },
          take: 1,
        },
      },
    })

    if (!student) { res.status(404).json({ message: 'Estudiante no encontrado' }); return }

    const assignment = student.assignments[0]

    res.json({
      id:           student.id,
      firstName:    student.firstName,
      lastName:     student.lastName,
      ci:           student.ci,
      rude:         student.rude,
      kardex:       student.kardex,
      birthDate:    student.birthDate,
      gender:       student.gender,
      phone:        student.phone,
      email:        student.email,
      address:      student.address,
      course:       assignment?.course       ?? null,
      academicYear: assignment?.academicYear ?? null,
      tutor:        student.parents[0]?.parent ?? null,
    })
  } catch (err) {
    console.error('getMyProfile:', err)
    res.status(500).json({ message: 'Error al obtener perfil' })
  }
}

// GET /api/students/my-grades
export const getMyGrades = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId 

    const student = await prisma.student.findUnique({
      where: { userId },
      include: {
        assignments: {
          where: { academicYear: { isActive: true } },
          include: {
            course:       { select: { id: true, grade: true, parallel: true, level: true, shift: true } },
            academicYear: { select: { id: true, year: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    })

    if (!student) { res.status(404).json({ message: 'Estudiante no encontrado' }); return }

    const assignment = student.assignments[0]
    if (!assignment) { res.json({ notas: [], course: null, academicYear: null, trimestres: [] }); return }

    const trimestres = await prisma.trimester.findMany({
      where: { academicYearId: assignment.academicYearId },
      orderBy: { number: 'asc' },
    })

    const notas = await prisma.nota.findMany({
      where: {
        studentId:   student.id,
        courseId:    assignment.courseId,
        trimesterId: { in: trimestres.map(t => t.id) },
      },
      include: {
        subject:   { select: { id: true, name: true, campo: true } },
        trimester: { select: { id: true, number: true, name: true } },
        teacher:   { select: { firstName: true, lastName: true } },
      },
      orderBy: [{ subject: { name: 'asc' } }, { trimester: { number: 'asc' } }],
    })

    const bySubject: Record<number, {
      subjectId:   number
      subjectName: string
      campo:       string | null
      teacher:     string
      trimestres:  Record<number, number>
      avg:         number | null
    }> = {}

    for (const n of notas) {
      if (!bySubject[n.subjectId]) {
        bySubject[n.subjectId] = {
          subjectId:   n.subjectId,
          subjectName: n.subject.name,
          campo:       n.subject.campo,
          teacher:     `${n.teacher.firstName} ${n.teacher.lastName}`,
          trimestres:  {},
          avg:         null,
        }
      }
      bySubject[n.subjectId].trimestres[n.trimesterId] = n.total ?? 0
    }

    for (const s of Object.values(bySubject)) {
      const vals = Object.values(s.trimestres)
      if (vals.length > 0) {
        s.avg = parseFloat((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2))
      }
    }

    res.json({
      course:       assignment.course,
      academicYear: assignment.academicYear,
      trimestres,
      notas:        Object.values(bySubject),
    })
  } catch (err) {
    console.error('getMyGrades:', err)
    res.status(500).json({ message: 'Error al obtener calificaciones' })
  }
}
// ─────────────────────────────────────────────────────────────
// Agregar al final de: backend/src/controllers/student.controller.ts
// ─────────────────────────────────────────────────────────────

// GET /api/students/my-tasks
// Retorna las tareas del curso del estudiante con su calificación
export const getMyTasks = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId

    const student = await prisma.student.findUnique({
      where: { userId },
      include: {
        assignments: {
          where: { academicYear: { isActive: true } },
          include: {
            academicYear: { select: { id: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    })

    if (!student) { res.status(404).json({ message: 'Estudiante no encontrado' }); return }

    const assignment = student.assignments[0]
    if (!assignment) { res.json([]); return }

    // Obtener todas las tareas del curso activo
    const tasks = await prisma.task.findMany({
      where: {
        courseId: assignment.courseId,
        trimester: { academicYearId: assignment.academicYearId },
      },
      include: {
        subject:  { select: { id: true, name: true } },
        teacher:  { select: { firstName: true, lastName: true } },
        trimester: { select: { id: true, number: true, name: true } },
        submissions: {
          where: { studentId: student.id },
          select: { score: true, status: true, note: true, updatedAt: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    // Aplanar submissions al nivel de la tarea
    const result = tasks.map(t => ({
      id:          t.id,
      title:       t.title,
      description: t.description,
      type:        t.type,
      maxScore:    t.maxScore,
      dueDate:     t.dueDate,
      subject:     t.subject,
      teacher:     `${t.teacher.firstName} ${t.teacher.lastName}`,
      trimester:   t.trimester,
      score:       t.submissions[0]?.score   ?? null,
      status:      t.submissions[0]?.status  ?? 'PENDIENTE',
      note:        t.submissions[0]?.note    ?? null,
      gradedAt:    t.submissions[0]?.updatedAt ?? null,
    }))

    res.json(result)
  } catch (err) {
    console.error('getMyTasks:', err)
    res.status(500).json({ message: 'Error al obtener tareas' })
  }
}

// ─────────────────────────────────────────────────────────────
// Agregar al final de: backend/src/controllers/student.controller.ts
// ─────────────────────────────────────────────────────────────

// GET /api/students/my-notifications
// Retorna las notificaciones del tutor legal del estudiante autenticado
export const getMyNotifications = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId

    const student = await prisma.student.findUnique({
      where: { userId },
      include: {
        parents: {
          where: { isTutor: true },
          select: { parentId: true },
          take: 1,
        },
      },
    })

    if (!student) { res.status(404).json({ message: 'Estudiante no encontrado' }); return }

    const tutorId = student.parents[0]?.parentId
    if (!tutorId) { res.json([]); return }

    const notifications = await prisma.notification.findMany({
      where: { parentId: tutorId },
      include: {
        sentBy: { select: { teacher: { select: { firstName: true, lastName: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    })

    res.json(notifications)
  } catch (err) {
    console.error('getMyNotifications:', err)
    res.status(500).json({ message: 'Error al obtener notificaciones' })
  }
}

// PATCH /api/students/my-notifications/:id/read
// Marca una notificación como leída
export const markNotificationRead = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId
    const { id } = req.params

    const student = await prisma.student.findUnique({
      where: { userId },
      include: {
        parents: { where: { isTutor: true }, select: { parentId: true }, take: 1 },
      },
    })

    if (!student) { res.status(404).json({ message: 'Estudiante no encontrado' }); return }

    const tutorId = student.parents[0]?.parentId
    if (!tutorId) { res.status(403).json({ message: 'Sin tutor asignado' }); return }

    // Verificar que la notificación pertenece al tutor
    const notif = await prisma.notification.findFirst({
      where: { id: parseInt(id), parentId: tutorId },
    })

    if (!notif) { res.status(404).json({ message: 'Notificación no encontrada' }); return }

    const updated = await prisma.notification.update({
      where: { id: parseInt(id) },
      data:  { isRead: true },
    })

    res.json(updated)
  } catch (err) {
    console.error('markNotificationRead:', err)
    res.status(500).json({ message: 'Error al marcar notificación' })
  }
}
// ─────────────────────────────────────────────────────────────
// Agregar al final de: backend/src/controllers/student.controller.ts
// ─────────────────────────────────────────────────────────────

// GET /api/students/my-subjects
// Retorna las materias del curso del estudiante con maestro, horas y notas
export const getMySubjects = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId

    const student = await prisma.student.findUnique({
      where: { userId },
      include: {
        assignments: {
          where: { academicYear: { isActive: true } },
          include: {
            course:       { select: { id: true, grade: true, parallel: true, level: true, shift: true, educationType: true } },
            academicYear: { select: { id: true, year: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    })

    if (!student) { res.status(404).json({ message: 'Estudiante no encontrado' }); return }

    const assignment = student.assignments[0]
    if (!assignment) { res.json([]); return }

    // Obtener materias asignadas al curso con sus maestros
    const teacherSubjects = await prisma.teacherSubjectCourse.findMany({
      where: { courseId: assignment.courseId },
      include: {
        subject: {
          select: {
            id: true, name: true, campo: true,
            gradeConfigs: {
              where: { grade: assignment.course.grade, educationType: assignment.course.educationType },
              select: { hoursPerWeek: true },
            },
          },
        },
        teacher: { select: { id: true, firstName: true, lastName: true, specialty: true } },
      },
      orderBy: { subject: { name: 'asc' } },
    })

    // Obtener trimestres del año activo
    const trimestres = await prisma.trimester.findMany({
      where: { academicYearId: assignment.academicYearId },
      orderBy: { number: 'asc' },
    })

    // Obtener notas del estudiante
    const notas = await prisma.nota.findMany({
      where: {
        studentId:   student.id,
        courseId:    assignment.courseId,
        trimesterId: { in: trimestres.map(t => t.id) },
      },
      select: { subjectId: true, trimesterId: true, total: true },
    })

    // Agrupar notas por materia
    const notasBySubject: Record<number, Record<number, number>> = {}
    for (const n of notas) {
      if (!notasBySubject[n.subjectId]) notasBySubject[n.subjectId] = {}
      notasBySubject[n.subjectId][n.trimesterId] = n.total ?? 0
    }

    // Construir respuesta
    const result = teacherSubjects.map(ts => {
      const subjectNotas = notasBySubject[ts.subjectId] || {}
      const vals = Object.values(subjectNotas)
      const avg  = vals.length ? parseFloat((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2)) : null

      return {
        subjectId:   ts.subjectId,
        subjectName: ts.subject.name,
        campo:       ts.subject.campo,
        hoursPerWeek: ts.subject.gradeConfigs[0]?.hoursPerWeek ?? ts.subject.gradeConfigs[0]?.hoursPerWeek ?? 0,
        teacher: {
          id:        ts.teacher.id,
          firstName: ts.teacher.firstName,
          lastName:  ts.teacher.lastName,
          specialty: ts.teacher.specialty,
        },
        trimestres,
        notas:     subjectNotas,
        avg,
        aprobado:  avg !== null ? avg >= 51 : null,
      }
    })

    res.json(result)
  } catch (err) {
    console.error('getMySubjects:', err)
    res.status(500).json({ message: 'Error al obtener materias' })
  }
}

// ─────────────────────────────────────────────────────────────
// Agregar en: backend/src/routes/student.routes.ts
// ─────────────────────────────────────────────────────────────
// import { ..., getMySubjects } from '../controllers/student.controller'
// router.get('/my-subjects', getMySubjects)


