import { staffAttendanceRepository } from '../repositories/staffAttendance.repository'

const startOfDay = (date: Date) => { const d = new Date(date); d.setHours(0, 0, 0, 0); return d }
const endOfDay   = (date: Date) => { const d = new Date(date); d.setHours(23, 59, 59, 999); return d }

export const staffAttendanceService = {
  // Mismo cálculo de período que teacherAttendanceService.getReport (mes/año,
  // semana ISO-simple lunes-domingo, o día puntual) — se calca literal para
  // que la pestaña "Personal" del reporte comparta exactamente el mismo
  // selector de período que la pestaña "Maestros".
  async getReport(query: { month?: number; year?: number; week?: number; date?: string; staffId?: number }) {
    const month = query.month || new Date().getMonth() + 1
    const year  = query.year  || new Date().getFullYear()
    const week  = query.week  || null
    const { date, staffId } = query

    let start: Date, end: Date

    if (date) {
      const d = new Date(date)
      start = startOfDay(d); end = endOfDay(d)
    } else if (week) {
      const firstDay = new Date(year, month - 1, 1)
      const dayOfWeek = firstDay.getDay()
      const firstMonday = new Date(firstDay)
      firstMonday.setDate(firstDay.getDate() + (dayOfWeek === 0 ? 1 : 8 - dayOfWeek) % 7)
      start = new Date(firstMonday)
      start.setDate(firstMonday.getDate() + (week - 1) * 7)
      end = new Date(start)
      end.setDate(start.getDate() + 6)
      end.setHours(23, 59, 59)
    } else {
      start = new Date(year, month - 1, 1)
      end = new Date(year, month, 0, 23, 59, 59)
    }

    const records = await staffAttendanceRepository.findReport({ date: { gte: start, lte: end }, ...(staffId ? { staffId } : {}) })

    const byStaff: Record<number, any> = {}
    records.forEach((r) => {
      const sid = r.staffId
      if (!byStaff[sid]) {
        byStaff[sid] = { staff: r.staff, records: [], summary: { presente: 0, retraso: 0, ausente: 0, licencia: 0, total: 0 } }
      }
      byStaff[sid].records.push(r)
      const key = r.status.toLowerCase() as keyof (typeof byStaff)[typeof sid]['summary']
      if (key in byStaff[sid].summary) byStaff[sid].summary[key]++
      byStaff[sid].summary.total++
    })

    return { period: { start, end, month, year, week, date }, staff: Object.values(byStaff), totalRecords: records.length }
  },
}
