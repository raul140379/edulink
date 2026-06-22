import { Response } from 'express'
import { AuthRequest } from '../middlewares/auth.middleware'
import prisma from '../lib/prisma'

// ─────────────────────────────────────────────
// GET /api/subjects — Listar materias
// ─────────────────────────────────────────────
export const getSubjects = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { level, grade } = req.query

    const subjects = await prisma.subject.findMany({
      where: {
        ...(level ? { level: level as any } : {}),
        ...(grade ? { gradeConfigs: { some: { grade: grade as any } } } : {}),
      },
      include: {
        _count: { select: { teacherSubjects: true } },
        ...(grade ? { gradeConfigs: { where: { grade: grade as any } } } : {}),
      },
      orderBy: [{ campo: 'asc' }, { name: 'asc' }]
    })

    res.json(subjects)
  } catch (error) {
    console.error('getSubjects error:', error)
    res.status(500).json({ message: 'Error al obtener materias' })
  }
}

// ─────────────────────────────────────────────
// GET /api/subjects/plan/:courseId
// ─────────────────────────────────────────────
export const getCoursePlan = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { courseId } = req.params

    const course = await prisma.course.findUnique({
      where: { id: parseInt(courseId) },
      include: {
        teacherSubjects: {
          include: {
            subject: { select: { id: true, name: true, code: true, campo: true } },
            teacher: { select: { id: true, firstName: true, lastName: true, phone: true } },
          }
        }
      }
    })

    if (!course) {
      res.status(404).json({ message: 'Curso no encontrado' })
      return
    }

    const gradeConfigs = await prisma.subjectGradeConfig.findMany({
      where: {
        grade:         course.grade         as any,
        educationType: course.educationType as any,
      },
      include: {
        subject: {
          select: { id: true, name: true, code: true, campo: true, isActive: true }
        }
      },
      orderBy: [
        { subject: { campo: 'asc' } },
        { subject: { name:  'asc' } }
      ]
    })

    const plan = gradeConfigs.map(gc => {
      const assigned = course.teacherSubjects.find(ts => ts.subjectId === gc.subjectId)
      return {
        gradeConfigId: gc.id,
        subjectId:     gc.subjectId,
        subject:       gc.subject,
        hoursPerWeek:  gc.hoursPerWeek,
        teacher:       assigned ? assigned.teacher : null,
        assignmentId:  assigned ? assigned.id      : null,
      }
    })

    const campoOrder = [
      'VIDA_TIERRA_TERRITORIO',
      'COMUNIDAD_SOCIEDAD',
      'COSMOS_PENSAMIENTO',
      'CIENCIA_TECNOLOGIA_PRODUCCION',
    ]

    const grouped: Record<string, typeof plan> = {}
    for (const item of plan) {
      const campo = item.subject.campo || 'SIN_CAMPO'
      if (!grouped[campo]) grouped[campo] = []
      grouped[campo].push(item)
    }

    const totalHours    = plan.reduce((s, p) => s + p.hoursPerWeek, 0)
    const assignedCount = plan.filter(p => p.teacher !== null).length

    res.json({
      course: {
        id:            course.id,
        grade:         course.grade,
        parallel:      course.parallel,
        level:         course.level,
        educationType: course.educationType,
      },
      totalHours,
      totalSubjects:  plan.length,
      assignedCount,
      pendingCount:   plan.length - assignedCount,
      grouped,
      campoOrder,
    })
  } catch (error) {
    console.error('getCoursePlan error:', error)
    res.status(500).json({ message: 'Error al obtener plan del curso' })
  }
}

// ─────────────────────────────────────────────
// POST /api/subjects — Crear materia
// ─────────────────────────────────────────────
export const createSubject = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, code, level, hoursPerWeek } = req.body

    if (!name || !level) {
      res.status(400).json({ message: 'Nombre y nivel son requeridos' })
      return
    }

    const subject = await prisma.subject.create({
      data: {
        name,
        code:         code         || null,
        level:        level        as any,
        hoursPerWeek: hoursPerWeek || 4,
      }
    })

    res.status(201).json({ message: 'Materia creada correctamente', subject })
  } catch (error: any) {
    if (error.code === 'P2002') {
      res.status(409).json({ message: 'Ya existe una materia con ese nombre en ese nivel' })
      return
    }
    console.error('createSubject error:', error)
    res.status(500).json({ message: 'Error al crear materia' })
  }
}

// ─────────────────────────────────────────────
// PUT /api/subjects/:id — Actualizar materia
// ─────────────────────────────────────────────
export const updateSubject = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params
    const { name, code, level, hoursPerWeek } = req.body

    const subject = await prisma.subject.update({
      where: { id: parseInt(id) },
      data: {
        ...(name         !== undefined ? { name }                : {}),
        ...(code         !== undefined ? { code: code || null }  : {}),
        ...(level        !== undefined ? { level: level as any } : {}),
        ...(hoursPerWeek !== undefined ? { hoursPerWeek }        : {}),
      },
    })

    res.json({ message: 'Materia actualizada correctamente', subject })
  } catch (error) {
    console.error('updateSubject error:', error)
    res.status(500).json({ message: 'Error al actualizar materia' })
  }
}

// ─────────────────────────────────────────────
// DELETE /api/subjects/:id — Eliminar materia global
// ─────────────────────────────────────────────
export const deleteSubject = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params

    const subject = await prisma.subject.findUnique({
      where: { id: parseInt(id) },
      include: { _count: { select: { teacherSubjects: true } } }
    })

    if (!subject) {
      res.status(404).json({ message: 'Materia no encontrada' })
      return
    }

    if (subject._count.teacherSubjects > 0) {
      res.status(400).json({ message: `No se puede eliminar: tiene ${subject._count.teacherSubjects} asignación(es)` })
      return
    }

    await prisma.subject.delete({ where: { id: parseInt(id) } })
    res.json({ message: 'Materia eliminada correctamente' })
  } catch (error) {
    console.error('deleteSubject error:', error)
    res.status(500).json({ message: 'Error al eliminar materia' })
  }
}

// ─────────────────────────────────────────────
// POST /api/subjects/assign — Asignar materia + maestro a curso
// ─────────────────────────────────────────────
export const assignSubjectToCourse = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { subjectId, teacherId, courseId } = req.body

    if (!subjectId || !teacherId || !courseId) {
      res.status(400).json({ message: 'Materia, maestro y curso son requeridos' })
      return
    }

    const course = await prisma.course.findUnique({ where: { id: parseInt(courseId) } })
    if (!course) {
      res.status(404).json({ message: 'Curso no encontrado' })
      return
    }

    const gradeConfig = await prisma.subjectGradeConfig.findFirst({
      where: {
        subjectId:     parseInt(subjectId),
        grade:         course.grade         as any,
        educationType: course.educationType as any,
      }
    })

    if (!gradeConfig) {
      res.status(400).json({ message: 'Esta materia no pertenece al plan de estudios de este grado' })
      return
    }

    const existing = await prisma.teacherSubjectCourse.findFirst({
      where: { subjectId: parseInt(subjectId), courseId: parseInt(courseId) }
    })

    if (existing) {
      if (existing.teacherId === parseInt(teacherId)) {
        res.status(409).json({ message: 'Este maestro ya está asignado a esa materia en ese curso' })
        return
      }
      const updated = await prisma.teacherSubjectCourse.update({
        where: { id: existing.id },
        data:  { teacherId: parseInt(teacherId) },
        include: {
          subject: { select: { id: true, name: true, code: true, campo: true } },
          teacher: { select: { id: true, firstName: true, lastName: true } },
          course:  { select: { id: true, level: true, grade: true, parallel: true } },
        }
      })
      res.json({ message: 'Maestro actualizado correctamente', assignment: updated })
      return
    }

    const assignment = await prisma.teacherSubjectCourse.create({
      data: {
        subjectId: parseInt(subjectId),
        teacherId: parseInt(teacherId),
        courseId:  parseInt(courseId),
      },
      include: {
        subject: { select: { id: true, name: true, code: true, campo: true } },
        teacher: { select: { id: true, firstName: true, lastName: true } },
        course:  { select: { id: true, level: true, grade: true, parallel: true } },
      }
    })

    res.status(201).json({ message: 'Materia asignada correctamente', assignment })
  } catch (error: any) {
    if (error.code === 'P2002') {
      res.status(409).json({ message: 'Esta materia ya está asignada en ese curso' })
      return
    }
    console.error('assignSubjectToCourse error:', error)
    res.status(500).json({ message: 'Error al asignar materia' })
  }
}

// ─────────────────────────────────────────────
// DELETE /api/subjects/assign/:id — Quitar maestro de materia
// ─────────────────────────────────────────────
export const removeSubjectFromCourse = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params
    await prisma.teacherSubjectCourse.delete({ where: { id: parseInt(id) } })
    res.json({ message: 'Asignación eliminada correctamente' })
  } catch (error) {
    console.error('removeSubjectFromCourse error:', error)
    res.status(500).json({ message: 'Error al eliminar asignación' })
  }
}

// ─────────────────────────────────────────────
// POST /api/subjects/grade-config — Agregar materia al plan del grado
// ─────────────────────────────────────────────
export const addSubjectToGradePlan = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { subjectId, grade, educationType, hoursPerWeek } = req.body

    if (!subjectId || !grade || !educationType) {
      res.status(400).json({ message: 'Materia, grado y tipo de educación son requeridos' })
      return
    }

    const existing = await prisma.subjectGradeConfig.findFirst({
      where: {
        subjectId:     parseInt(subjectId),
        grade:         grade         as any,
        educationType: educationType as any,
      }
    })

    if (existing) {
      res.status(409).json({ message: 'Esta materia ya está en el plan de este grado' })
      return
    }

    const config = await prisma.subjectGradeConfig.create({
      data: {
        subjectId:     parseInt(subjectId),
        grade:         grade         as any,
        educationType: educationType as any,
        hoursPerWeek:  hoursPerWeek ? parseInt(hoursPerWeek) : 4,
      },
      include: {
        subject: { select: { id: true, name: true, campo: true } }
      }
    })

    res.status(201).json({ message: 'Materia agregada al plan correctamente', config })
  } catch (error: any) {
    if (error.code === 'P2002') {
      res.status(409).json({ message: 'Esta materia ya está en el plan de este grado' })
      return
    }
    console.error('addSubjectToGradePlan error:', error)
    res.status(500).json({ message: 'Error al agregar materia al plan' })
  }
}

// ─────────────────────────────────────────────
// DELETE /api/subjects/grade-config/:id — Quitar materia del plan del grado
// ─────────────────────────────────────────────
export const removeSubjectFromGradePlan = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params

    const config = await prisma.subjectGradeConfig.findUnique({
      where: { id: parseInt(id) }
    })

    if (!config) {
      res.status(404).json({ message: 'Configuración no encontrada' })
      return
    }

    // Eliminar asignaciones de maestros en cursos de ese grado primero
    await prisma.teacherSubjectCourse.deleteMany({
      where: {
        subjectId: config.subjectId,
        course: {
          grade:         config.grade,
          educationType: config.educationType,
        }
      }
    })

    // Eliminar del plan del grado
    await prisma.subjectGradeConfig.delete({ where: { id: parseInt(id) } })

    res.json({ message: 'Materia eliminada del plan correctamente' })
  } catch (error) {
    console.error('removeSubjectFromGradePlan error:', error)
    res.status(500).json({ message: 'Error al eliminar materia del plan' })
  }
}
// ─────────────────────────────────────────────
// POST /api/subjects/assign-bulk
// Asignar una materia + maestro a VARIOS cursos a la vez
// ─────────────────────────────────────────────
export const assignSubjectToMultipleCourses = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { subjectId, teacherId, courseIds } = req.body

    if (!subjectId || !teacherId || !Array.isArray(courseIds) || courseIds.length === 0) {
      res.status(400).json({ message: 'Materia, maestro y al menos un curso son requeridos' })
      return
    }

    const assigned: any[] = []
    const skipped:  { courseId: number; reason: string }[] = []

    for (const courseId of courseIds) {
      const course = await prisma.course.findUnique({ where: { id: parseInt(courseId) } })
      if (!course) {
        skipped.push({ courseId, reason: 'Curso no encontrado' })
        continue
      }

      // Validar que la materia pertenezca al plan de ese grado
      const gradeConfig = await prisma.subjectGradeConfig.findFirst({
        where: {
          subjectId:     parseInt(subjectId),
          grade:         course.grade         as any,
          educationType: course.educationType as any,
        }
      })
      if (!gradeConfig) {
        skipped.push({ courseId, reason: 'No pertenece al plan de este grado' })
        continue
      }

      // Validar si ya está ocupada por OTRO maestro
      const existing = await prisma.teacherSubjectCourse.findFirst({
        where: { subjectId: parseInt(subjectId), courseId: parseInt(courseId) }
      })

      if (existing) {
        if (existing.teacherId === parseInt(teacherId)) {
          skipped.push({ courseId, reason: 'Ya estaba asignado a este maestro' })
        } else {
          skipped.push({ courseId, reason: 'Ya asignado a otro maestro' })
        }
        continue
      }

      const created = await prisma.teacherSubjectCourse.create({
        data: {
          subjectId: parseInt(subjectId),
          teacherId: parseInt(teacherId),
          courseId:  parseInt(courseId),
        },
        include: {
          subject: { select: { id: true, name: true, code: true, campo: true } },
          course:  { select: { id: true, level: true, grade: true, parallel: true, shift: true } },
        }
      })
      assigned.push(created)
    }

    res.status(201).json({
      message:  `${assigned.length} curso(s) asignado(s)${skipped.length ? `, ${skipped.length} omitido(s)` : ''}`,
      assigned,
      skipped,
    })
  } catch (error) {
    console.error('assignSubjectToMultipleCourses error:', error)
    res.status(500).json({ message: 'Error al asignar materia a múltiples cursos' })
  }
}
// ─────────────────────────────────────────────
// GET /api/subjects/:id/occupied-courses
// Cursos donde esta materia ya está asignada (a cualquier maestro)
// ─────────────────────────────────────────────
export const getOccupiedCoursesForSubject = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params

    const assignments = await prisma.teacherSubjectCourse.findMany({
      where: { subjectId: parseInt(id) },
      select: {
        courseId: true,
        teacher: { select: { id: true, firstName: true, lastName: true } }
      }
    })

    res.json(assignments)
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener cursos ocupados' })
  }
}