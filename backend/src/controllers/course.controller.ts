import { Response } from 'express'
import { AuthRequest } from '../middlewares/auth.middleware'
import prisma from '../lib/prisma'

const BTH_GRADES = ['TERCERO', 'CUARTO', 'QUINTO', 'SEXTO']

// ─────────────────────────────────────────────
// GET /api/courses — Listar cursos
// ─────────────────────────────────────────────
export const getCourses = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { level, shift, educationType } = req.query

    const courses = await prisma.course.findMany({
      where: {
        ...(level         ? { level:         level         as any } : {}),
        ...(shift         ? { shift:         shift         as any } : {}),
        ...(educationType ? { educationType: educationType as any } : {}),
      },
      include: {
          shiftDirector: { include: { user: { select: { id: true, email: true } } }},
          tutor: {include: { teacher: { select: { id: true, firstName: true, lastName: true } } } },
          _count: { select: { assignments: true, schedules: true } },
         // 
        },
      orderBy: [{ level: 'asc' }, { grade: 'asc' }, { parallel: 'asc' }, { shift: 'asc' }]
    })
//orderBy: [{ level: 'asc' }, { grade: 'asc' }, { parallel: 'asc' }, { shift: 'asc' }]
    res.json(courses)
  } catch (error) {
    console.error('getCourses error:', error)
    res.status(500).json({ message: 'Error al obtener cursos' })
  }
}

// ─────────────────────────────────────────────
// GET /api/courses/:id — Obtener un curso
// ─────────────────────────────────────────────
export const getCourseById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params

    const course = await prisma.course.findUnique({
      where: { id: parseInt(id) },
      include: {
        shiftDirector: {
          include: { user: { select: { id: true, email: true } } }
        },
        teacherSubjects: {
          include: {
            teacher: { select: { id: true, firstName: true, lastName: true } },
            subject: { select: { id: true, name: true, code: true } },
          }
        },
       tutor: {
  include: {
    teacher: { 
      select: { 
        id: true, firstName: true, lastName: true,
        tutorUserId: true,
        tutorUser: { select: { email: true, isActive: true } }
      } 
    }
  }
},
        _count: { select: { assignments: true } }
      }
    })

    if (!course) {
      res.status(404).json({ message: 'Curso no encontrado' })
      return
    }

    res.json(course)
  } catch (error) {
    console.error('getCourseById error:', error)
    res.status(500).json({ message: 'Error al obtener curso' })
  }
}

// ─────────────────────────────────────────────
// GET /api/courses/:id/students — Estudiantes
// ─────────────────────────────────────────────
export const getCourseStudents = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id }   = req.params
    const { year } = req.query

    let academicYear = year ? parseInt(year as string) : null
    if (!academicYear) {
      const active = await prisma.academicYear.findFirst({ where: { isActive: true } })
      if (active) academicYear = active.year
    }

    const assignments = await prisma.studentAcademicAssignment.findMany({
      where: {
        courseId: parseInt(id),
        ...(academicYear ? { year: academicYear } : {}),
      },
      include: {
        student: {
          select: { id: true, firstName: true, lastName: true, ci: true, rude: true, birthDate: true }
        }
      },
      orderBy: { student: { lastName: 'asc' } }
    })

    res.json(assignments)
  } catch (error) {
    console.error('getCourseStudents error:', error)
    res.status(500).json({ message: 'Error al obtener estudiantes del curso' })
  }
}

// ─────────────────────────────────────────────
// POST /api/courses — Crear curso
// ─────────────────────────────────────────────
export const createCourse = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { level, grade, parallel, educationType, shift } = req.body
    const eduType = educationType || 'REGULAR'

    if (!level || !grade || !parallel || !shift) {
      res.status(400).json({ message: 'Nivel, grado, paralelo y turno son requeridos' })
      return
    }

    // BTH solo en Secundaria desde 3°
    if (eduType === 'BTH') {
      if (level !== 'SECUNDARIA') {
        res.status(400).json({ message: 'El tipo BTH solo aplica en el nivel Secundaria' })
        return
      }
      if (!BTH_GRADES.includes(grade)) {
        res.status(400).json({ message: 'El tipo BTH solo aplica desde 3° grado de Secundaria' })
        return
      }
    }

    // Verificar duplicado exacto
    const existing = await prisma.course.findUnique({
      where: { level_grade_parallel_educationType_shift: { level, grade, parallel, educationType: eduType, shift } }
    })
    if (existing) {
      res.status(409).json({ message: 'Ya existe un curso con esas características en ese turno' })
      return
    }

    // BTH no puede compartir turno con Regular del mismo grado/paralelo
    if (eduType === 'BTH') {
      const regularSameTurn = await prisma.course.findFirst({
        where: { level, grade, parallel, educationType: 'REGULAR', shift }
      })
      if (regularSameTurn) {
        res.status(409).json({ message: 'El curso BTH no puede estar en el mismo turno que el Regular del mismo grado y paralelo' })
        return
      }
    }

    // Regular no puede compartir turno con BTH del mismo grado/paralelo
    if (eduType === 'REGULAR') {
      const bthSameTurn = await prisma.course.findFirst({
        where: { level, grade, parallel, educationType: 'BTH', shift }
      })
      if (bthSameTurn) {
        res.status(409).json({ message: 'El curso Regular no puede estar en el mismo turno que el BTH del mismo grado y paralelo' })
        return
      }
    }

    const course = await prisma.course.create({
      data: { level, grade, parallel, educationType: eduType, shift },
      include: { _count: { select: { assignments: true } } }
    })

    res.status(201).json({ message: 'Curso creado correctamente', course })
  } catch (error) {
    console.error('createCourse error:', error)
    res.status(500).json({ message: 'Error al crear curso' })
  }
}

// ─────────────────────────────────────────────
// PUT /api/courses/:id — Editar curso
// ─────────────────────────────────────────────
export const updateCourse = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params
    const { level, grade, parallel, educationType, shift, shiftDirectorId } = req.body

    const existing = await prisma.course.findUnique({ where: { id: parseInt(id) } })
    if (!existing) {
      res.status(404).json({ message: 'Curso no encontrado' })
      return
    }

    const newLevel    = level         || existing.level
    const newGrade    = grade         || existing.grade
    const newParallel = parallel      || existing.parallel
    const newEduType  = educationType || existing.educationType
    const newShift    = shift         || existing.shift

    // Validar BTH
    if (newEduType === 'BTH') {
      if (newLevel !== 'SECUNDARIA') {
        res.status(400).json({ message: 'El tipo BTH solo aplica en el nivel Secundaria' })
        return
      }
      if (!BTH_GRADES.includes(newGrade)) {
        res.status(400).json({ message: 'El tipo BTH solo aplica desde 3° grado de Secundaria' })
        return
      }
    }

    // Verificar duplicado (excluyendo el actual)
    const duplicate = await prisma.course.findFirst({
      where: {
        level: newLevel, grade: newGrade, parallel: newParallel,
        educationType: newEduType, shift: newShift,
        NOT: { id: parseInt(id) }
      }
    })
    if (duplicate) {
      res.status(409).json({ message: 'Ya existe un curso con esas características' })
      return
    }

    const course = await prisma.course.update({
      where: { id: parseInt(id) },
      data: {
        level: newLevel, grade: newGrade, parallel: newParallel,
        educationType: newEduType, shift: newShift,
        ...(shiftDirectorId !== undefined ? { shiftDirectorId } : {}),
      },
      include: { _count: { select: { assignments: true } } }
    })

    res.json({ message: 'Curso actualizado correctamente', course })
  } catch (error) {
    console.error('updateCourse error:', error)
    res.status(500).json({ message: 'Error al actualizar curso' })
  }
}

// ─────────────────────────────────────────────
// DELETE /api/courses/:id — Eliminar curso
// ─────────────────────────────────────────────
export const deleteCourse = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params

    const count = await prisma.studentAcademicAssignment.count({
      where: { courseId: parseInt(id) }
    })

    if (count > 0) {
      res.status(400).json({
        message: `No se puede eliminar el curso porque tiene ${count} estudiante(s) inscrito(s)`
      })
      return
    }

    await prisma.course.delete({ where: { id: parseInt(id) } })
    res.json({ message: 'Curso eliminado correctamente' })
  } catch (error) {
    console.error('deleteCourse error:', error)
    res.status(500).json({ message: 'Error al eliminar curso' })
  }
}
// ─────────────────────────────────────────────
// POST /api/courses/:id/assign-tutor — Asignar maestro tutor
// ─────────────────────────────────────────────
export const assignCourseTutor = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id }        = req.params
    const { teacherId } = req.body

    if (!teacherId) {
      res.status(400).json({ message: 'El ID del maestro es requerido' })
      return
    }

    // Verificar que el curso existe
    const course = await prisma.course.findUnique({ where: { id: parseInt(id) } })
    if (!course) {
      res.status(404).json({ message: 'Curso no encontrado' })
      return
    }

    // Verificar que el maestro existe
    const teacher = await prisma.teacher.findUnique({
      where: { id: parseInt(teacherId) },
      include: { tutorCourse: true }
    })
    if (!teacher) {
      res.status(404).json({ message: 'Maestro no encontrado' })
      return
    }

    // Verificar que el maestro no es tutor de otro curso
    if (teacher.tutorCourse && teacher.tutorCourse.courseId !== parseInt(id)) {
      res.status(400).json({ message: 'Este maestro ya es tutor de otro curso' })
      return
    }

    // Eliminar tutor anterior si existe
    await prisma.courseTutor.deleteMany({ where: { courseId: parseInt(id) } })

    // Asignar nuevo tutor
    await prisma.courseTutor.create({
      data: {
        courseId:  parseInt(id),
        teacherId: parseInt(teacherId),
      }
    })

    // Actualizar rol del usuario del maestro a TEACHER si no lo tiene
    if (teacher.userId) {
      await prisma.user.update({
        where: { id: teacher.userId },
        data:  { role: 'TEACHER' }
      })
    }

    res.json({ message: `${teacher.lastName} ${teacher.firstName} asignado como tutor del curso` })
  } catch (error) {
    console.error('assignCourseTutor error:', error)
    res.status(500).json({ message: 'Error al asignar tutor' })
  }
}

// ─────────────────────────────────────────────
// DELETE /api/courses/:id/assign-tutor — Quitar maestro tutor
// ─────────────────────────────────────────────
export const removeCourseTutor = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params

    const tutor = await prisma.courseTutor.findUnique({
      where: { courseId: parseInt(id) }
    })

    if (!tutor) {
      res.status(400).json({ message: 'Este curso no tiene maestro tutor asignado' })
      return
    }

    await prisma.courseTutor.delete({ where: { courseId: parseInt(id) } })

    res.json({ message: 'Maestro tutor removido correctamente' })
  } catch (error) {
    console.error('removeCourseTutor error:', error)
    res.status(500).json({ message: 'Error al remover tutor' })
  }
}
import bcrypt from 'bcryptjs'

// POST /api/courses/:id/delegate-user
export const createDelegateUser = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params
    const course = await prisma.course.findUnique({
      where: { id: parseInt(id) },
      include: { delegate: true }
    })
    if (!course) { res.status(404).json({ message: 'Curso no encontrado' }); return }
    if (!course.delegate) { res.status(400).json({ message: 'Este curso no tiene delegado asignado' }); return }
    if (course.delegate.delegateUserId) { res.status(409).json({ message: 'Este delegado ya tiene usuario creado' }); return }

    const gradeMap: Record<string, string> = {
      PRIMERO: '1', SEGUNDO: '2', TERCERO: '3', CUARTO: '4', QUINTO: '5', SEXTO: '6'
    }
    const gradeNum = gradeMap[course.grade] || course.grade.toLowerCase()
    const parallel = course.parallel.toLowerCase()
    let email = `delegado.${gradeNum}${parallel}@nnuu.edu.bo`
    let counter = 2
    while (await prisma.user.findUnique({ where: { email } })) {
      email = `delegado.${gradeNum}${parallel}${counter}@nnuu.edu.bo`
      counter++
    }

    const rawPassword = `delegado${new Date().getFullYear()}`
    const hashed = await bcrypt.hash(rawPassword, 10)
    const user = await prisma.user.create({
      data: { email, password: hashed, role: 'DELEGATE', isActive: true }
    })
    await prisma.parent.update({
      where: { id: course.delegate.id },
      data: { delegateUserId: user.id }
    })
    res.status(201).json({
      message: 'Usuario delegado creado correctamente',
      accessEmail: email,
      defaultPassword: rawPassword,
      delegateName: `${course.delegate.lastName} ${course.delegate.firstName}`,
    })
  } catch (error) {
    res.status(500).json({ message: 'Error al crear usuario delegado' })
  }
}

// POST /api/courses/:id/delegate-user/reset
export const resetDelegatePassword = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params
    const course = await prisma.course.findUnique({
      where: { id: parseInt(id) },
      include: { delegate: true }
    })
    if (!course) { res.status(404).json({ message: 'Curso no encontrado' }); return }
    if (!course.delegate) { res.status(400).json({ message: 'Este curso no tiene delegado asignado' }); return }
    if (!course.delegate.delegateUserId) { res.status(400).json({ message: 'El delegado no tiene usuario creado aún' }); return }

    const rawPassword = `delegado${new Date().getFullYear()}`
    const hashed = await bcrypt.hash(rawPassword, 10)
    await prisma.user.update({
      where: { id: course.delegate.delegateUserId },
      data: { password: hashed }
    })
    res.json({
      message: 'Contraseña reseteada correctamente',
      defaultPassword: rawPassword,
      delegateName: `${course.delegate.lastName} ${course.delegate.firstName}`,
    })
  } catch (error) {
    res.status(500).json({ message: 'Error al resetear contraseña' })
  }
}
// POST /api/courses/:id/tutor-user
export const createTutorUser = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params
    const course = await prisma.course.findUnique({
      where: { id: parseInt(id) },
      include: { tutor: { include: { teacher: true } } }
    })
    if (!course) { res.status(404).json({ message: 'Curso no encontrado' }); return }
    if (!course.tutor) { res.status(400).json({ message: 'Este curso no tiene maestro tutor asignado' }); return }
    if (course.tutor.teacher.tutorUserId) { res.status(409).json({ message: 'Este maestro tutor ya tiene usuario creado' }); return }

    const gradeMap: Record<string, string> = {
      PRIMERO: '1', SEGUNDO: '2', TERCERO: '3', CUARTO: '4', QUINTO: '5', SEXTO: '6'
    }
    const gradeNum  = gradeMap[course.grade] || course.grade.toLowerCase()
    const parallel  = course.parallel.toLowerCase()
    let email       = `tutor.${gradeNum}${parallel}@nnuu.edu.bo`
    let counter     = 2
    while (await prisma.user.findUnique({ where: { email } })) {
      email = `tutor.${gradeNum}${parallel}${counter}@nnuu.edu.bo`
      counter++
    }

    const rawPassword = `tutor${gradeNum}${course.parallel.toUpperCase()}${new Date().getFullYear()}`
    const hashed      = await bcrypt.hash(rawPassword, 10)
    const user        = await prisma.user.create({
      data: { email, password: hashed, role: 'TEACHER_TUTOR', isActive: true }
    })

    await prisma.teacher.update({
      where: { id: course.tutor.teacher.id },
      data:  { tutorUserId: user.id }
    })

    res.status(201).json({
      message:         'Usuario tutor creado correctamente',
      accessEmail:     email,
      defaultPassword: rawPassword,
      tutorName:       `${course.tutor.teacher.lastName} ${course.tutor.teacher.firstName}`,
    })
  } catch (error) {
    res.status(500).json({ message: 'Error al crear usuario tutor' })
  }
}

// POST /api/courses/:id/tutor-user/reset
export const resetTutorPassword = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params
    const course = await prisma.course.findUnique({
      where: { id: parseInt(id) },
      include: { tutor: { include: { teacher: true } } }
    })
    if (!course) { res.status(404).json({ message: 'Curso no encontrado' }); return }
    if (!course.tutor) { res.status(400).json({ message: 'Este curso no tiene maestro tutor' }); return }
    if (!course.tutor.teacher.tutorUserId) { res.status(400).json({ message: 'El tutor no tiene usuario creado aún' }); return }

    const gradeMap: Record<string, string> = {
      PRIMERO: '1', SEGUNDO: '2', TERCERO: '3', CUARTO: '4', QUINTO: '5', SEXTO: '6'
    }
    const gradeNum    = gradeMap[course.grade] || course.grade.toLowerCase()
    const parallel    = course.parallel.toLowerCase()
    const rawPassword = `tutor${gradeNum}${course.parallel.toUpperCase()}${new Date().getFullYear()}`
    const hashed      = await bcrypt.hash(rawPassword, 10)

    await prisma.user.update({
      where: { id: course.tutor.teacher.tutorUserId },
      data:  { password: hashed }
    })

    res.json({
      message:         'Contraseña reseteada correctamente',
      defaultPassword: rawPassword,
      tutorName:       `${course.tutor.teacher.lastName} ${course.tutor.teacher.firstName}`,
    })
  } catch (error) {
    res.status(500).json({ message: 'Error al resetear contraseña' })
  }
}