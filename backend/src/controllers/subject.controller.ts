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
        // Si viene grade, solo mostrar materias que tengan config para ese grado
        ...(grade ? {
          gradeConfigs: {
            some: { grade: grade as any }
          }
        } : {}),
      },
      include: {
        _count: { select: { teacherSubjects: true } },
        // Incluir horas del grado específico si se pide
        ...(grade ? {
          gradeConfigs: { where: { grade: grade as any } }
        } : {}),
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
// POST /api/subjects — Crear materia
// ─────────────────────────────────────────────
export const createSubject = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, code, level, hoursPerWeek, academicYearId } = req.body

    if (!name || !level  ) {
      res.status(400).json({ message: 'Nombre, nivel  son requeridos' })
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
      res.status(409).json({ message: 'Ya existe una materia con ese nombre en ese nivel y gestión' })
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
        ...(name         !== undefined ? { name }                             : {}),
        ...(code         !== undefined ? { code:         code || null }       : {}),
        ...(level        !== undefined ? { level:        level as any }       : {}),
        ...(hoursPerWeek !== undefined ? { hoursPerWeek: hoursPerWeek }       : {}),
      }, 
    })

    res.json({ message: 'Materia actualizada correctamente', subject })
  } catch (error) {
    console.error('updateSubject error:', error)
    res.status(500).json({ message: 'Error al actualizar materia' })
  }
}

// ─────────────────────────────────────────────
// DELETE /api/subjects/:id — Eliminar materia
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
      res.status(400).json({ message: `No se puede eliminar: tiene ${subject._count.teacherSubjects} asignación(es). Elimina las asignaciones primero.` })
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

    const assignment = await prisma.teacherSubjectCourse.create({
      data: {
        subjectId: parseInt(subjectId),
        teacherId: parseInt(teacherId),
        courseId:  parseInt(courseId),
      },
      include: {
        subject: { select: { id: true, name: true, code: true } },
        teacher: { select: { id: true, firstName: true, lastName: true } },
        course:  { select: { id: true, level: true, grade: true, parallel: true } },
      }
    })

    res.status(201).json({ message: 'Materia asignada correctamente', assignment })
  } catch (error: any) {
    if (error.code === 'P2002') {
      res.status(409).json({ message: 'Esta materia ya está asignada a ese maestro en ese curso' })
      return
    }
    console.error('assignSubjectToCourse error:', error)
    res.status(500).json({ message: 'Error al asignar materia' })
  }
}

// ─────────────────────────────────────────────
// DELETE /api/subjects/assign/:id — Quitar asignación
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