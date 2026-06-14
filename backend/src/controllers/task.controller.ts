import { Response } from 'express'
import { AuthRequest } from '../middlewares/auth.middleware'
import prisma from '../lib/prisma'

// ── Helper: dimensión según tipo de tarea ──────────────────────────
function getDimension(type: string): 'SABER' | 'HACER' | null {
  if (type === 'EVALUACION') return 'SABER'
  if (type === 'TRABAJO')    return 'HACER'
  return null
}

// ── Helper: recalcular nota después de calificar ───────────────────
async function recalcularNotaDesdeTask(notaId: number) {
  const items = await prisma.notaItem.findMany({ where: { notaId } })
  const itemsSaber = items.filter(i => i.dimension === 'SABER')
  const itemsHacer = items.filter(i => i.dimension === 'HACER')

  const calcProm = (arr: typeof items, maxPts: number) => {
    if (arr.length === 0) return null
    const sumPorc = arr.reduce((acc, i) => acc + (i.puntaje / i.maxPuntaje), 0)
    return Math.round((sumPorc / arr.length) * maxPts * 100) / 100
  }

  const saber = calcProm(itemsSaber, 45)
  const hacer = calcProm(itemsHacer, 40)
  const nota  = await prisma.nota.findUnique({ where: { id: notaId } })
  const ser       = nota?.ser           ?? null
  const autoEval  = nota?.autoEvaluacion ?? null
  const vals  = [saber, hacer, ser, autoEval].filter(v => v !== null) as number[]
  const total = vals.length > 0 ? Math.round(vals.reduce((a, b) => a + b, 0) * 100) / 100 : null

  return prisma.nota.update({ where: { id: notaId }, data: { saber, hacer, total } })
}

// ─────────────────────────────────────────────
// GET /api/tasks/by-course/:courseId
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
// ─────────────────────────────────────────────
export const getTasksByStudent = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { studentId } = req.params
    const { trimesterId, subjectId } = req.query

    const assignment = await prisma.studentAcademicAssignment.findFirst({
      where: { studentId: parseInt(studentId), academicYear: { isActive: true } },
      include: { course: true }
    })
    if (!assignment) { res.json([]); return }

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
// ─────────────────────────────────────────────
export const getMyTasks = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const student = await prisma.student.findUnique({ where: { userId: req.userId } })
    if (!student) { res.status(404).json({ message: 'Perfil no encontrado' }); return }

    const assignment = await prisma.studentAcademicAssignment.findFirst({
      where: { studentId: student.id, academicYear: { isActive: true } },
      include: { course: true }
    })
    if (!assignment) { res.json([]); return }

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
    res.status(500).json({ message: 'Error al obtener tareas' })
  }
}

// ─────────────────────────────────────────────
// POST /api/tasks
// Crear tarea — asigna a todo el curso o estudiantes específicos
// Body: { title, description, type, maxScore, dueDate, attachmentUrl,
//         courseId, subjectId, trimesterId, studentIds? }
// ─────────────────────────────────────────────
export const createTask = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const {
      title, description, type, maxScore, dueDate,
      attachmentUrl, courseId, subjectId, trimesterId,
      studentIds  // array opcional — si viene, solo esos estudiantes
    } = req.body

    if (!title || !type || !courseId || !subjectId) {
      res.status(400).json({ message: 'Título, tipo, curso y materia son requeridos' })
      return
    }

    const teacher = await prisma.teacher.findFirst({
      where: { OR: [{ userId: req.userId }, { tutorUserId: req.userId }] }
    })
    if (!teacher) { res.status(403).json({ message: 'No tienes perfil de maestro' }); return }

    const task = await prisma.task.create({
      data: {
        title,
        description:   description   || null,
        type,
        maxScore:      parseFloat(maxScore) || 100,
        dueDate:       dueDate       ? new Date(dueDate)       : null,
        attachmentUrl: attachmentUrl || null,
        courseId:      parseInt(courseId),
        subjectId:     parseInt(subjectId),
        teacherId:     teacher.id,
        trimesterId:   trimesterId   ? parseInt(trimesterId)   : null,
      },
      include: {
        subject:  { select: { id: true, name: true } },
        teacher:  { select: { id: true, firstName: true, lastName: true } },
        trimester:{ select: { id: true, number: true, name: true } },
      }
    })

    // Determinar estudiantes destino
    let targetStudentIds: number[] = []

    if (Array.isArray(studentIds) && studentIds.length > 0) {
      // Asignación individual
      targetStudentIds = studentIds.map(Number)
    } else {
      // Todo el curso
      const assignments = await prisma.studentAcademicAssignment.findMany({
        where: { courseId: parseInt(courseId), academicYear: { isActive: true } }
      })
      targetStudentIds = assignments.map(a => a.studentId)
    }

    if (targetStudentIds.length > 0) {
      await prisma.taskSubmission.createMany({
        data: targetStudentIds.map(sid => ({
          taskId:    task.id,
          studentId: sid,
          status:    'PENDIENTE' as any,
        })),
        skipDuplicates: true,
      })
    }

    res.status(201).json({
      message: `Tarea creada y asignada a ${targetStudentIds.length} estudiante(s)`,
      task
    })
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
    const { title, description, type, maxScore, dueDate, attachmentUrl, trimesterId } = req.body

    const task = await prisma.task.update({
      where: { id: parseInt(id) },
      data: {
        ...(title         !== undefined ? { title }                                          : {}),
        ...(description   !== undefined ? { description: description || null }               : {}),
        ...(type          !== undefined ? { type }                                           : {}),
        ...(maxScore      !== undefined ? { maxScore: parseFloat(maxScore) }                 : {}),
        ...(dueDate       !== undefined ? { dueDate: dueDate ? new Date(dueDate) : null }   : {}),
        ...(attachmentUrl !== undefined ? { attachmentUrl: attachmentUrl || null }           : {}),
        ...(trimesterId   !== undefined ? { trimesterId: trimesterId ? parseInt(trimesterId) : null } : {}),
      },
      include: {
        subject:  { select: { id: true, name: true } },
        teacher:  { select: { id: true, firstName: true, lastName: true } },
        trimester:{ select: { id: true, number: true, name: true } },
      }
    })

    res.json({ message: 'Tarea actualizada', task })
  } catch (error) {
    res.status(500).json({ message: 'Error al actualizar tarea' })
  }
}

// ─────────────────────────────────────────────
// DELETE /api/tasks/:id
// ─────────────────────────────────────────────
export const deleteTask = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params
    await prisma.task.delete({ where: { id: parseInt(id) } })
    res.json({ message: 'Tarea eliminada correctamente' })
  } catch (error) {
    res.status(500).json({ message: 'Error al eliminar tarea' })
  }
}

// ─────────────────────────────────────────────
// GET /api/tasks/:id/submissions
// Ver entregas/calificaciones de una tarea
// ─────────────────────────────────────────────
export const getTaskSubmissions = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params
    const submissions = await prisma.taskSubmission.findMany({
      where: { taskId: parseInt(id) },
      include: {
        student: { select: { id: true, firstName: true, lastName: true, kardex: true } }
      },
      orderBy: { student: { lastName: 'asc' } }
    })
    res.json(submissions)
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener entregas' })
  }
}

// ─────────────────────────────────────────────
// PATCH /api/tasks/:id/submissions/bulk
// Calificar múltiples estudiantes + crear NotaItem automáticamente
// Body: { submissions: [{ studentId, score, note }], courseId, subjectId, teacherId, trimesterId }
// ─────────────────────────────────────────────
export const gradeSubmissions = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params
    const { submissions, courseId, subjectId, teacherId, trimesterId } = req.body

    if (!Array.isArray(submissions) || submissions.length === 0) {
      res.status(400).json({ message: 'Se requiere un array de calificaciones' }); return
    }

    const task = await prisma.task.findUnique({ where: { id: parseInt(id) } })
    if (!task) { res.status(404).json({ message: 'Tarea no encontrada' }); return }

    const dimension = getDimension(task.type)

    for (const s of submissions) {
      if (s.score === undefined || s.score === null) continue

      // 1. Actualizar TaskSubmission
      await prisma.taskSubmission.upsert({
        where: { taskId_studentId: { taskId: parseInt(id), studentId: s.studentId } },
        update: { score: parseFloat(s.score), note: s.note || null, status: 'CALIFICADO' as any },
        create: { taskId: parseInt(id), studentId: s.studentId, score: parseFloat(s.score), note: s.note || null, status: 'CALIFICADO' as any }
      })

      // 2. Si tiene dimensión SABER o HACER → crear/actualizar NotaItem
      if (dimension && courseId && subjectId && trimesterId) {
        // Obtener o crear la Nota del estudiante
        const nota = await prisma.nota.upsert({
          where: {
            studentId_subjectId_courseId_trimesterId: {
              studentId:   s.studentId,
              subjectId:   parseInt(subjectId),
              courseId:    parseInt(courseId),
              trimesterId: parseInt(trimesterId),
            }
          },
          update: {},
          create: {
            studentId:   s.studentId,
            subjectId:   parseInt(subjectId),
            courseId:    parseInt(courseId),
            teacherId:   parseInt(teacherId),
            trimesterId: parseInt(trimesterId),
          }
        })

        // Crear o actualizar el NotaItem vinculado a esta tarea
        const existingItem = await prisma.notaItem.findFirst({
          where: { notaId: nota.id, taskId: parseInt(id) }
        })

        if (existingItem) {
          await prisma.notaItem.update({
            where: { id: existingItem.id },
            data: { puntaje: parseFloat(s.score), maxPuntaje: task.maxScore }
          })
        } else {
          await prisma.notaItem.create({
            data: {
              notaId:     nota.id,
              dimension,
              titulo:     task.title,
              puntaje:    parseFloat(s.score),
              maxPuntaje: task.maxScore,
              fecha:      task.dueDate,
              taskId:     parseInt(id),
            }
          })
        }

        // Recalcular totales
        await recalcularNotaDesdeTask(nota.id)
      }
    }

    res.json({ message: 'Calificaciones guardadas y notas actualizadas' })
  } catch (error) {
    console.error('gradeSubmissions error:', error)
    res.status(500).json({ message: 'Error al guardar calificaciones' })
  }
}

// ─────────────────────────────────────────────
// PATCH /api/tasks/submissions/:submissionId/mark-delivered
// Estudiante marca su tarea como entregada
// ─────────────────────────────────────────────
export const markDelivered = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { submissionId } = req.params

    const submission = await prisma.taskSubmission.findUnique({
      where: { id: parseInt(submissionId) }
    })
    if (!submission) { res.status(404).json({ message: 'Entrega no encontrada' }); return }

    // Verificar que el estudiante logueado es el dueño
    const student = await prisma.student.findUnique({ where: { userId: req.userId } })
    if (!student || student.id !== submission.studentId) {
      res.status(403).json({ message: 'No tienes permiso' }); return
    }

    if (submission.status === 'CALIFICADO') {
      res.status(400).json({ message: 'Esta tarea ya fue calificada' }); return
    }

    const updated = await prisma.taskSubmission.update({
      where: { id: parseInt(submissionId) },
      data:  { status: 'PENDIENTE' as any } // mantiene PENDIENTE hasta que maestro califique
    })

    res.json({ message: 'Tarea marcada como entregada', submission: updated })
  } catch (error) {
    res.status(500).json({ message: 'Error al marcar entrega' })
  }
}

// ─────────────────────────────────────────────
// GET /api/tasks/summary/by-student/:studentId
// ─────────────────────────────────────────────
export const getStudentTaskSummary = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { studentId } = req.params
    const { trimesterId } = req.query

    const submissions = await prisma.taskSubmission.findMany({
      where: {
        studentId: parseInt(studentId),
        status:    'CALIFICADO',
        task: { ...(trimesterId ? { trimesterId: parseInt(trimesterId as string) } : {}) }
      },
      include: {
        task: { select: { type: true, maxScore: true, subject: { select: { id: true, name: true } } } }
      }
    })

    const bySubject: Record<number, any> = {}
    submissions.forEach(s => {
      const sid = s.task.subject.id
      if (!bySubject[sid]) {
        bySubject[sid] = { subject: s.task.subject, SABER: { total:0, max:0 }, HACER: { total:0, max:0 } }
      }
      const type = s.task.type as string
      if (bySubject[sid][type]) {
        bySubject[sid][type].total += s.score || 0
        bySubject[sid][type].max   += s.task.maxScore
      }
    })

    res.json(Object.values(bySubject))
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener resumen' })
  }
}