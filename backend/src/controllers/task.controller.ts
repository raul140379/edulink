import { Response } from 'express'
import { AuthRequest } from '../middlewares/auth.middleware'
import prisma from '../lib/prisma'

// ─────────────────────────────────────────────
// GET /api/tasks/by-course/:courseId
// Tareas de un curso (para maestro)
// ─────────────────────────────────────────────
export const getTasksByCourse = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { courseId } = req.params
    const { subjectId, trimesterId } = req.query

    const tasks = await prisma.task.findMany({
      where: {
        courseId: parseInt(courseId),
        ...(subjectId   ? { subjectId:   parseInt(subjectId   as string) } : {}),
        ...(trimesterId ? { trimesterId: parseInt(trimesterId as string) } : {}),
      },
      include: {
        subject:  { select: { id: true, name: true, campo: true } },
        teacher:  { select: { id: true, firstName: true, lastName: true } },
        trimester:{ select: { id: true, number: true, name: true } },
        _count:   { select: { submissions: true } },
      },
      orderBy: { createdAt: 'desc' }
    })

    res.json(tasks)
  } catch (error) {
    console.error('getTasksByCourse error:', error)
    res.status(500).json({ message: 'Error al obtener tareas' })
  }
}

// ─────────────────────────────────────────────
// GET /api/tasks/by-student/:studentId
// Tareas y calificaciones del estudiante
// ─────────────────────────────────────────────
export const getTasksByStudent = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { studentId } = req.params
    const { trimesterId, subjectId } = req.query

    // Obtener el curso activo del estudiante
    const assignment = await prisma.studentAcademicAssignment.findFirst({
      where: {
        studentId:   parseInt(studentId),
        academicYear: { isActive: true },
      },
      include: { course: true }
    })

    if (!assignment) {
      res.json([])
      return
    }

    const tasks = await prisma.task.findMany({
      where: {
        courseId: assignment.courseId,
        ...(subjectId   ? { subjectId:   parseInt(subjectId   as string) } : {}),
        ...(trimesterId ? { trimesterId: parseInt(trimesterId as string) } : {}),
      },
      include: {
        subject:  { select: { id: true, name: true, campo: true } },
        teacher:  { select: { id: true, firstName: true, lastName: true } },
        trimester:{ select: { id: true, number: true, name: true } },
        submissions: {
          where: { studentId: parseInt(studentId) },
          select: { id: true, score: true, note: true, status: true, createdAt: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    res.json(tasks)
  } catch (error) {
    console.error('getTasksByStudent error:', error)
    res.status(500).json({ message: 'Error al obtener tareas del estudiante' })
  }
}

// ─────────────────────────────────────────────
// GET /api/tasks/my-tasks
// Tareas del estudiante logueado
// ─────────────────────────────────────────────
export const getMyTasks = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const student = await prisma.student.findUnique({
      where: { userId: req.userId }
    })

    if (!student) {
      res.status(404).json({ message: 'Perfil de estudiante no encontrado' })
      return
    }

    const assignment = await prisma.studentAcademicAssignment.findFirst({
      where: { studentId: student.id, academicYear: { isActive: true } },
      include: { course: true }
    })

    if (!assignment) {
      res.json([])
      return
    }

    const tasks = await prisma.task.findMany({
      where: { courseId: assignment.courseId },
      include: {
        subject:  { select: { id: true, name: true, campo: true } },
        teacher:  { select: { id: true, firstName: true, lastName: true } },
        trimester:{ select: { id: true, number: true, name: true } },
        submissions: {
          where: { studentId: student.id },
          select: { id: true, score: true, note: true, status: true, createdAt: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    res.json(tasks)
  } catch (error) {
    console.error('getMyTasks error:', error)
    res.status(500).json({ message: 'Error al obtener tareas' })
  }
}

// ─────────────────────────────────────────────
// POST /api/tasks
// Crear tarea (maestro)
// ─────────────────────────────────────────────
export const createTask = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { title, description, type, maxScore, dueDate, courseId, subjectId, trimesterId } = req.body

    if (!title || !type || !courseId || !subjectId) {
      res.status(400).json({ message: 'Título, tipo, curso y materia son requeridos' })
      return
    }

    // Obtener teacherId del usuario logueado
    const teacher = await prisma.teacher.findFirst({
      where: {
        OR: [
          { userId:      req.userId },
          { tutorUserId: req.userId },
        ]
      }
    })

    if (!teacher) {
      res.status(403).json({ message: 'No tienes perfil de maestro' })
      return
    }

    const task = await prisma.task.create({
      data: {
        title,
        description: description || null,
        type,
        maxScore:    parseFloat(maxScore) || 100,
        dueDate:     dueDate ? new Date(dueDate) : null,
        courseId:    parseInt(courseId),
        subjectId:   parseInt(subjectId),
        teacherId:   teacher.id,
        trimesterId: trimesterId ? parseInt(trimesterId) : null,
      },
      include: {
        subject:  { select: { id: true, name: true, campo: true } },
        teacher:  { select: { id: true, firstName: true, lastName: true } },
        trimester:{ select: { id: true, number: true, name: true } },
      }
    })

    // Crear submissions pendientes para todos los estudiantes del curso
    const assignments = await prisma.studentAcademicAssignment.findMany({
      where: { courseId: parseInt(courseId), academicYear: { isActive: true } }
    })

    if (assignments.length > 0) {
      await prisma.taskSubmission.createMany({
        data: assignments.map(a => ({
          taskId:    task.id,
          studentId: a.studentId,
          status:    'PENDIENTE' as any,
        })),
        skipDuplicates: true,
      })
    }

    res.status(201).json({ message: 'Tarea creada correctamente', task })
  } catch (error) {
    console.error('createTask error:', error)
    res.status(500).json({ message: 'Error al crear tarea' })
  }
}

// ─────────────────────────────────────────────
// PUT /api/tasks/:id
// Actualizar tarea
// ─────────────────────────────────────────────
export const updateTask = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params
    const { title, description, type, maxScore, dueDate, trimesterId } = req.body

    const task = await prisma.task.update({
      where: { id: parseInt(id) },
      data: {
        ...(title       !== undefined ? { title }                                    : {}),
        ...(description !== undefined ? { description: description || null }         : {}),
        ...(type        !== undefined ? { type }                                     : {}),
        ...(maxScore    !== undefined ? { maxScore: parseFloat(maxScore) }           : {}),
        ...(dueDate     !== undefined ? { dueDate: dueDate ? new Date(dueDate) : null } : {}),
        ...(trimesterId !== undefined ? { trimesterId: trimesterId ? parseInt(trimesterId) : null } : {}),
      },
      include: {
        subject:  { select: { id: true, name: true } },
        teacher:  { select: { id: true, firstName: true, lastName: true } },
        trimester:{ select: { id: true, number: true, name: true } },
      }
    })

    res.json({ message: 'Tarea actualizada correctamente', task })
  } catch (error) {
    console.error('updateTask error:', error)
    res.status(500).json({ message: 'Error al actualizar tarea' })
  }
}

// ─────────────────────────────────────────────
// DELETE /api/tasks/:id
// Eliminar tarea
// ─────────────────────────────────────────────
export const deleteTask = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params
    await prisma.task.delete({ where: { id: parseInt(id) } })
    res.json({ message: 'Tarea eliminada correctamente' })
  } catch (error) {
    console.error('deleteTask error:', error)
    res.status(500).json({ message: 'Error al eliminar tarea' })
  }
}

// ─────────────────────────────────────────────
// GET /api/tasks/:id/submissions
// Ver calificaciones de una tarea (maestro)
// ─────────────────────────────────────────────
export const getTaskSubmissions = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params

    const submissions = await prisma.taskSubmission.findMany({
      where: { taskId: parseInt(id) },
      include: {
        student: { select: { id: true, firstName: true, lastName: true, ci: true } }
      },
      orderBy: { student: { lastName: 'asc' } }
    })

    res.json(submissions)
  } catch (error) {
    console.error('getTaskSubmissions error:', error)
    res.status(500).json({ message: 'Error al obtener calificaciones' })
  }
}

// ─────────────────────────────────────────────
// PATCH /api/tasks/:id/submissions/bulk
// Calificar múltiples estudiantes a la vez
// ─────────────────────────────────────────────
export const gradeSubmissions = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params
    const { submissions } = req.body // [{ studentId, score, note }]

    if (!Array.isArray(submissions) || submissions.length === 0) {
      res.status(400).json({ message: 'Se requiere un array de calificaciones' })
      return
    }

    const task = await prisma.task.findUnique({ where: { id: parseInt(id) } })
    if (!task) { res.status(404).json({ message: 'Tarea no encontrada' }); return }

    const results = await Promise.all(
      submissions.map(s =>
        prisma.taskSubmission.upsert({
          where: { taskId_studentId: { taskId: parseInt(id), studentId: s.studentId } },
          update: {
            score:  s.score !== undefined ? parseFloat(s.score) : null,
            note:   s.note  || null,
            status: s.score !== undefined ? 'CALIFICADO' as any : 'PENDIENTE' as any,
          },
          create: {
            taskId:    parseInt(id),
            studentId: s.studentId,
            score:     s.score !== undefined ? parseFloat(s.score) : null,
            note:      s.note  || null,
            status:    s.score !== undefined ? 'CALIFICADO' as any : 'PENDIENTE' as any,
          }
        })
      )
    )

    res.json({ message: `${results.length} calificaciones guardadas`, saved: results.length })
  } catch (error) {
    console.error('gradeSubmissions error:', error)
    res.status(500).json({ message: 'Error al guardar calificaciones' })
  }
}

// ─────────────────────────────────────────────
// GET /api/tasks/summary/by-student/:studentId
// Resumen por dimensión (Ser, Saber, Hacer, Decidir)
// ─────────────────────────────────────────────
export const getStudentTaskSummary = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { studentId } = req.params
    const { trimesterId } = req.query

    const submissions = await prisma.taskSubmission.findMany({
      where: {
        studentId: parseInt(studentId),
        status:    'CALIFICADO',
        task: {
          ...(trimesterId ? { trimesterId: parseInt(trimesterId as string) } : {}),
        }
      },
      include: {
        task: {
          select: { type: true, maxScore: true, subject: { select: { id: true, name: true } } }
        }
      }
    })

    // Agrupar por materia y tipo
    const bySubject: Record<number, any> = {}

    submissions.forEach(s => {
      const sid = s.task.subject.id
      if (!bySubject[sid]) {
        bySubject[sid] = {
          subject:   s.task.subject,
          SABER:     { total: 0, max: 0 },
          HACER:     { total: 0, max: 0 },
          SER:       { total: 0, max: 0 },
          DECIDIR:   { total: 0, max: 0 },
        }
      }
      const type = s.task.type as string
      if (bySubject[sid][type]) {
        bySubject[sid][type].total += s.score || 0
        bySubject[sid][type].max   += s.task.maxScore
      }
    })

    res.json(Object.values(bySubject))
  } catch (error) {
    console.error('getStudentTaskSummary error:', error)
    res.status(500).json({ message: 'Error al obtener resumen' })
  }
}