import { studentLicenseRequestRepository } from '../repositories/studentLicenseRequest.repository'
import { studentLicenseRepository } from '../repositories/studentLicense.repository'
import { notificationRepository } from '../repositories/notification.repository'
import { HttpError } from '../utils/http-error'
import { dayRange } from './studentAttendance.service'
import {
  CreateLicenseRequestInput, ApproveLicenseRequestInput, RejectLicenseRequestInput,
} from '../schemas/studentLicenseRequest.schema'

function actorName(user: { email: string; staff: { firstName: string; lastName: string } | null; schoolDirector: { firstName: string; lastName: string } | null } | null): string | null {
  if (!user) return null
  const profile = user.staff ?? user.schoolDirector
  return profile ? `${profile.firstName} ${profile.lastName}` : user.email
}

function formatOutput(r: Awaited<ReturnType<typeof studentLicenseRequestRepository.findById>>) {
  if (!r) return null
  return {
    id: r.id, status: r.status, startDate: r.startDate, endDate: r.endDate, reason: r.reason,
    createdAt: r.createdAt,
    student: r.student,
    requestedBy: r.requestedBy,
    reviewedAt: r.reviewedAt, reviewNote: r.reviewNote, reviewedByName: actorName(r.reviewedBy),
  }
}

const fmtDate = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('es-BO', { day: '2-digit', month: 'long', year: 'numeric' })

export const studentLicenseRequestService = {
  // padre-app — POST /api/student-license-requests
  async createRequest(input: CreateLicenseRequestInput, userId: number | undefined) {
    const parent = await studentLicenseRequestRepository.findParentByUserId(userId)
    if (!parent) throw new HttpError(404, 'Perfil de padre no encontrado')

    const student = await studentLicenseRequestRepository.findStudentById(input.studentId)
    if (!student) throw new HttpError(404, 'Estudiante no encontrado')

    // Cualquier padre vinculado al estudiante puede solicitar — no solo el
    // tutor legal (confirmado con Raul, mismo criterio amplio que
    // /api/parents/my-students).
    const link = await studentLicenseRequestRepository.findParentStudentLink(parent.id, input.studentId)
    if (!link) throw new HttpError(403, 'No podés solicitar una licencia para un estudiante que no es tu hijo/a')

    const { base: startDate } = dayRange(input.startDate)
    const { base: endDate } = dayRange(input.endDate)

    const request = await studentLicenseRequestRepository.create({
      studentId: input.studentId, requestedById: parent.id, startDate, endDate, reason: input.reason,
    })

    return {
      message: `Solicitud enviada para ${student.lastName} ${student.firstName}, del ${input.startDate} al ${input.endDate}. Te avisamos cuando Dirección la resuelva.`,
      request: formatOutput(request),
    }
  },

  // padre-app — GET /api/student-license-requests/mine
  async getMine(userId: number | undefined) {
    const parent = await studentLicenseRequestRepository.findParentByUserId(userId)
    if (!parent) throw new HttpError(404, 'Perfil de padre no encontrado')

    const requests = await studentLicenseRequestRepository.findAllForParent(parent.id)
    return requests.map(formatOutput)
  },

  // admin/licencias (DIRECTOR) — GET /api/student-license-requests
  async getAll() {
    const requests = await studentLicenseRequestRepository.findAll()
    return requests.map(formatOutput)
  },

  // Aviso liviano en la tarjeta de admin/estudiantes/[id]
  async countPendingForStudent(studentId: number) {
    return studentLicenseRequestRepository.countPendingForStudent(studentId)
  },

  // POST /api/student-license-requests/:id/approve (DIRECTOR)
  async approve(id: number, input: ApproveLicenseRequestInput, reviewedById: number) {
    const request = await studentLicenseRequestRepository.findById(id)
    if (!request) throw new HttpError(404, 'Solicitud no encontrada')
    if (request.status !== 'PENDIENTE') throw new HttpError(400, 'Esta solicitud ya fue resuelta')

    // Crea el StudentLicense real — el mismo que ya activa el overlay en
    // getAttendanceByCourse/closeAttendance/reportes/matriz, sin tocar nada
    // de esos 4 puntos de lectura.
    const license = await studentLicenseRepository.create({
      studentId: request.studentId, startDate: request.startDate, endDate: request.endDate,
      reason: request.reason, createdById: reviewedById,
    })

    const updated = await studentLicenseRequestRepository.approve(id, reviewedById, input.note, license.id)

    await notificationRepository.createNotification({
      title: 'Licencia aprobada', type: 'ACADEMICA', sentById: reviewedById, parentId: request.requestedById,
      message: `Tu solicitud de licencia para ${request.student.lastName} ${request.student.firstName} del ${fmtDate(request.startDate.toISOString().slice(0, 10))} al ${fmtDate(request.endDate.toISOString().slice(0, 10))} fue aprobada.${input.note ? ` ${input.note}` : ''}`,
    })

    return { message: 'Solicitud aprobada — la licencia ya está activa.', request: formatOutput(updated) }
  },

  // POST /api/student-license-requests/:id/reject (DIRECTOR)
  async reject(id: number, input: RejectLicenseRequestInput, reviewedById: number) {
    const request = await studentLicenseRequestRepository.findById(id)
    if (!request) throw new HttpError(404, 'Solicitud no encontrada')
    if (request.status !== 'PENDIENTE') throw new HttpError(400, 'Esta solicitud ya fue resuelta')

    const updated = await studentLicenseRequestRepository.reject(id, reviewedById, input.note)

    await notificationRepository.createNotification({
      title: 'Licencia rechazada', type: 'ACADEMICA', sentById: reviewedById, parentId: request.requestedById,
      message: `Tu solicitud de licencia para ${request.student.lastName} ${request.student.firstName} del ${fmtDate(request.startDate.toISOString().slice(0, 10))} al ${fmtDate(request.endDate.toISOString().slice(0, 10))} fue rechazada. Motivo: ${input.note}`,
    })

    return { message: 'Solicitud rechazada.', request: formatOutput(updated) }
  },
}
