import { taskRepository } from '../repositories/task.repository'
import { HttpError } from '../utils/http-error'
import { CreateTaskInput, UpdateTaskInput, GradeSubmissionsInput } from '../schemas/task.schema'
import { getTenantContext } from '../lib/tenant-context'

function getDimension(type: string): 'SABER' | 'HACER' | null {
  if (type === 'EVALUACION') return 'SABER'
  if (type === 'TRABAJO') return 'HACER'
  return null
}

async function recalcularNotaDesdeTask(notaId: number) {
  const items = await taskRepository.findNotaItemsByNota(notaId)
  const itemsSaber = items.filter((i) => i.dimension === 'SABER')
  const itemsHacer = items.filter((i) => i.dimension === 'HACER')

  const calcProm = (arr: typeof items, maxPts: number) => {
    if (arr.length === 0) return null
    const sumPorc = arr.reduce((acc, i) => acc + i.puntaje / i.maxPuntaje, 0)
    return Math.round((sumPorc / arr.length) * maxPts * 100) / 100
  }

  const saber = calcProm(itemsSaber, 45)
  const hacer = calcProm(itemsHacer, 40)
  const nota = await taskRepository.findNotaRaw(notaId)
  const ser = nota?.ser ?? null
  const autoEval = nota?.autoEvaluacion ?? null
  const vals = [saber, hacer, ser, autoEval].filter((v) => v !== null) as number[]
  const total = vals.length > 0 ? Math.round(vals.reduce((a, b) => a + b, 0) * 100) / 100 : null

  return taskRepository.updateNotaCalculated(notaId, { saber, hacer, total })
}

export const taskService = {
  getTasksByCourse(courseId: number, subjectId?: string, trimesterId?: string) {
    return taskRepository.findByCourse(
      courseId, subjectId ? parseInt(subjectId) : undefined, trimesterId ? parseInt(trimesterId) : undefined
    )
  },

  async getTasksByStudent(studentId: number, subjectId?: string, trimesterId?: string) {
    const assignment = await taskRepository.findActiveAssignmentForStudent(studentId)
    if (!assignment) return []

    return taskRepository.findByCourseForStudent(
      assignment.courseId, studentId, subjectId ? parseInt(subjectId) : undefined, trimesterId ? parseInt(trimesterId) : undefined
    )
  },

  async getMyTasks(userId: number | undefined) {
    const student = await taskRepository.findStudentByUserId(userId)
    if (!student) throw new HttpError(404, 'Perfil no encontrado')

    const assignment = await taskRepository.findActiveAssignmentForStudent(student.id)
    if (!assignment) return []

    return taskRepository.findByCourseForStudent(assignment.courseId, student.id)
  },

  async createTask(userId: number | undefined, input: CreateTaskInput) {
    const teacher = await taskRepository.findTeacherByUserId(userId)
    if (!teacher) throw new HttpError(403, 'No tienes perfil de maestro')

    const task = await taskRepository.createTask({
      title: input.title,
      description: input.description || null,
      type: input.type,
      maxScore: input.maxScore || 100,
      dueDate: input.dueDate ? new Date(input.dueDate) : null,
      attachmentUrl: input.attachmentUrl || null,
      course: { connect: { id: input.courseId } },
      subject: { connect: { id: input.subjectId } },
      teacher: { connect: { id: teacher.id } },
      ...(input.trimesterId ? { trimester: { connect: { id: input.trimesterId } } } : {}),
      school: { connect: { id: getTenantContext()?.schoolId ?? 0 } },
    })

    let targetStudentIds: number[]
    if (input.studentIds && input.studentIds.length > 0) {
      targetStudentIds = input.studentIds
    } else {
      const assignments = await taskRepository.findAssignmentsForCourse(input.courseId)
      targetStudentIds = assignments.map((a) => a.studentId)
    }

    if (targetStudentIds.length > 0) {
      await taskRepository.createSubmissions(task.id, targetStudentIds)
    }

    return { task, assignedCount: targetStudentIds.length }
  },

  updateTask(id: number, input: UpdateTaskInput) {
    const { title, description, type, maxScore, dueDate, attachmentUrl, trimesterId } = input
    return taskRepository.updateTask(id, {
      ...(title         !== undefined ? { title } : {}),
      ...(description   !== undefined ? { description: description || null } : {}),
      ...(type          !== undefined ? { type } : {}),
      ...(maxScore      !== undefined ? { maxScore } : {}),
      ...(dueDate       !== undefined ? { dueDate: dueDate ? new Date(dueDate) : null } : {}),
      ...(attachmentUrl !== undefined ? { attachmentUrl: attachmentUrl || null } : {}),
      ...(trimesterId   !== undefined ? { trimester: trimesterId ? { connect: { id: trimesterId } } : { disconnect: true } } : {}),
    })
  },

  async deleteTask(id: number) {
    await taskRepository.deleteTask(id)
  },

  getTaskSubmissions(taskId: number) {
    return taskRepository.findSubmissionsByTask(taskId)
  },

  async gradeSubmissions(taskId: number, input: GradeSubmissionsInput) {
    const task = await taskRepository.findTaskRaw(taskId)
    if (!task) throw new HttpError(404, 'Tarea no encontrada')

    const dimension = getDimension(task.type)

    for (const s of input.submissions) {
      if (s.score === undefined || s.score === null) continue

      await taskRepository.upsertSubmission(taskId, s.studentId, s.score, s.note || null)

      if (dimension && input.courseId && input.subjectId && input.trimesterId) {
        const nota = await taskRepository.upsertNota(s.studentId, input.subjectId, input.courseId, input.teacherId ?? task.teacherId, input.trimesterId)

        const existingItem = await taskRepository.findNotaItemForTask(nota.id, taskId)

        if (existingItem) {
          await taskRepository.updateNotaItemScore(existingItem.id, s.score, task.maxScore)
        } else {
          await taskRepository.createNotaItem({
            notaId: nota.id, dimension, titulo: task.title,
            puntaje: s.score, maxPuntaje: task.maxScore, fecha: task.dueDate, taskId,
          })
        }

        await recalcularNotaDesdeTask(nota.id)
      }
    }
  },

  async markDelivered(userId: number | undefined, submissionId: number) {
    const submission = await taskRepository.findSubmissionById(submissionId)
    if (!submission) throw new HttpError(404, 'Entrega no encontrada')

    const student = await taskRepository.findStudentByUserId(userId)
    if (!student || student.id !== submission.studentId) throw new HttpError(403, 'No tienes permiso')

    if (submission.status === 'CALIFICADO') throw new HttpError(400, 'Esta tarea ya fue calificada')

    return taskRepository.updateSubmissionStatus(submissionId, 'PENDIENTE')
  },

  async getStudentTaskSummary(studentId: number, trimesterId?: string) {
    const submissions = await taskRepository.findGradedSubmissionsForStudent(
      studentId, trimesterId ? parseInt(trimesterId) : undefined
    )

    const bySubject: Record<number, any> = {}
    submissions.forEach((s) => {
      const sid = s.task.subject.id
      if (!bySubject[sid]) bySubject[sid] = { subject: s.task.subject, SABER: { total: 0, max: 0 }, HACER: { total: 0, max: 0 } }
      const type = s.task.type as string
      if (bySubject[sid][type]) {
        bySubject[sid][type].total += s.score || 0
        bySubject[sid][type].max += s.task.maxScore
      }
    })

    return Object.values(bySubject)
  },
}
