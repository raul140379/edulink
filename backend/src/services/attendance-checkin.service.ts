import { parentRepository } from '../repositories/parent.repository'
import { meetingRepository } from '../repositories/meeting.repository'
import { convocatoriaRepository } from '../repositories/convocatoria.repository'
import { HttpError } from '../utils/http-error'

function startOfDay(d: Date) { const s = new Date(d); s.setHours(0, 0, 0, 0); return s }

export const attendanceCheckinService = {
  // Escaneo de código de tutor → marca presente de inmediato (sin paso de
  // confirmación) en la convocatoria o reunión de curso activa hoy. Escribe
  // directo por repositorio (meetingRepository/convocatoriaRepository), nunca
  // por meetingService/convocatoriaService — así el candado de "solo
  // Presidente" (que rige la GESTIÓN manual) no aplica a esta acción, que
  // cualquier miembro de Junta Escolar debe poder operar en la puerta. Un
  // escaneo erróneo sigue siendo corregible después con el modal manual de
  // asistencia de cada sistema, que no se toca.
  async checkIn(code: string) {
    const parent = await parentRepository.findByAttendanceCode(code.toUpperCase())
    if (!parent) throw new HttpError(404, 'Código no encontrado')

    const today = startOfDay(new Date())
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    const tutorName = `${parent.lastName} ${parent.firstName}`

    // Prioridad 1 — Convocatoria (evento menos frecuente/más significativo).
    const possibleUserIds = [parent.userId, parent.delegateUserId].filter((id): id is number => id != null)
    if (possibleUserIds.length > 0) {
      const match = await convocatoriaRepository.findOpenTodayForUser(possibleUserIds, today, tomorrow)
      if (match) {
        await convocatoriaRepository.updateAttendance(match.convocatoriaId, match.userId, true)
        return { system: 'CONVOCATORIA' as const, event: match.convocatoria.title, tutor: tutorName }
      }
    }

    // Prioridad 2 — Reunión de curso.
    const meetingMatch = await meetingRepository.findOpenTodayForTutor(parent.id, today, tomorrow)
    if (meetingMatch) {
      await meetingRepository.updateAttendance(meetingMatch.meetingId, parent.id, true)
      return { system: 'MEETING' as const, event: meetingMatch.meeting.title, tutor: tutorName }
    }

    throw new HttpError(404, `No hay ninguna reunión o convocatoria activa hoy para ${tutorName}`)
  },
}
