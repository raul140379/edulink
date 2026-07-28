import { notaRepository } from '../repositories/nota.repository'
import { HttpError } from '../utils/http-error'
import {
  InitNotaInput, AddNotaItemInput, UpdateNotaItemInput, UpdateSerInput, UpdateAutoEvaluacionInput,
} from '../schemas/nota.schema'
import { gamificationService } from './gamification.service'

function calcularTotal(saber: number | null, hacer: number | null, ser: number | null, autoEval: number | null): number | null {
  const vals = [saber, hacer, ser, autoEval].filter((v) => v !== null) as number[]
  return vals.length > 0 ? Math.round(vals.reduce((a, b) => a + b, 0) * 100) / 100 : null
}

async function verificarTrimestresAnteriores(trimesterId: number, courseId: number, subjectId: number): Promise<string | null> {
  const trimestre = await notaRepository.findTrimesterWithYear(trimesterId)
  if (!trimestre) return 'Trimestre no encontrado'
  if (trimestre.number === 1) return null

  const trimAnterior = trimestre.academicYear.trimesters.find((t) => t.number === trimestre.number - 1)
  if (!trimAnterior) return null

  const notasAnteriores = await notaRepository.findNotasForTrimesterCourseSubject(trimAnterior.id, courseId, subjectId)

  if (notasAnteriores.length === 0) {
    return `Debes registrar y cerrar el ${trimestre.number - 1}° Trimestre antes de ingresar notas del ${trimestre.number}° Trimestre`
  }

  const todasCerradas = notasAnteriores.every((n) => n.cerrado)
  if (!todasCerradas) {
    return `El ${trimestre.number - 1}° Trimestre no está completamente cerrado. Ciérralo antes de continuar con el ${trimestre.number}° Trimestre`
  }

  return null
}

async function verificarTrimesterNoCerrado(trimesterId: number): Promise<string | null> {
  const trimestre = await notaRepository.findTrimesterRaw(trimesterId)
  if (!trimestre) return 'Trimestre no encontrado'
  if (trimestre.isClosed) return `El ${trimestre.number}° Trimestre fue cerrado por la dirección. No se pueden modificar notas.`
  return null
}

async function recalcularNota(notaId: number) {
  const items = await notaRepository.findNotaItemsByNota(notaId)

  const itemsSaber = items.filter((i) => i.dimension === 'SABER')
  const itemsHacer = items.filter((i) => i.dimension === 'HACER')

  const calcProm = (arr: typeof items, maxPts: number) => {
    if (arr.length === 0) return null
    const sumPorc = arr.reduce((acc, i) => acc + i.puntaje / i.maxPuntaje, 0)
    return Math.round((sumPorc / arr.length) * maxPts * 100) / 100
  }

  const saber = calcProm(itemsSaber, 45)
  const hacer = calcProm(itemsHacer, 40)

  const nota = await notaRepository.findNotaRaw(notaId)
  const ser      = nota?.ser ?? null
  const autoEval = nota?.autoEvaluacion ?? null
  const total    = calcularTotal(saber, hacer, ser, autoEval)

  const updated = await notaRepository.updateNotaCalculated(notaId, { saber, hacer, total })
  if (nota) await gamificationService.evaluateAchievements(nota.studentId)
  return updated
}

export const notaService = {
  async getTrimestres(year: number) {
    const academicYear = await notaRepository.findAcademicYearByYear(year)
    if (!academicYear) throw new HttpError(404, `No existe gestión para ${year}`)
    return academicYear.trimesters
  },

  getTeacherSubjects(teacherId: number) {
    return notaRepository.findTeacherSubjects(teacherId)
  },

  async getCourseStudents(courseId: number, year: number) {
    const academicYear = await notaRepository.findAcademicYearByYear(year)
    if (!academicYear) throw new HttpError(404, `No existe gestión para ${year}`)

    const assignments = await notaRepository.findCourseAssignments(courseId, academicYear.id)
    return assignments.map((a) => a.student)
  },

  getNotasByCourse(courseId: number, trimesterId: number | undefined, year: number) {
    return notaRepository.findNotasByCourse(courseId, trimesterId, year)
  },

  async getNotasByStudent(studentId: number, year: number) {
    const notas = await notaRepository.findNotasByStudent(studentId, year)

    const grouped: Record<number, any> = {}
    notas.forEach((n) => {
      if (!grouped[n.subjectId]) {
        grouped[n.subjectId] = { subject: n.subject, course: n.course, t1: null, t2: null, t3: null, promedio: 0 }
      }
      grouped[n.subjectId][`t${n.trimester.number}`] = {
        notaId: n.id, saber: n.saber, hacer: n.hacer, ser: n.ser,
        autoEvaluacion: n.autoEvaluacion, total: n.total, cerrado: n.cerrado,
      }
    })

    Object.values(grouped).forEach((item: any) => {
      const vals = [item.t1?.total, item.t2?.total, item.t3?.total].filter((v) => v != null) as number[]
      item.promedio = vals.length > 0 ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100) / 100 : 0
    })

    return Object.values(grouped)
  },

  async getNotaDetalle(notaId: number) {
    const nota = await notaRepository.findNotaDetalle(notaId)
    if (!nota) throw new HttpError(404, 'Nota no encontrada')
    return nota
  },

  async initNota(input: InitNotaInput) {
    const error = await verificarTrimestresAnteriores(input.trimesterId, input.courseId, input.subjectId)
    if (error) throw new HttpError(400, error)

    const errorTrimCerrado = await verificarTrimesterNoCerrado(input.trimesterId)
    if (errorTrimCerrado) throw new HttpError(400, errorTrimCerrado)

    return notaRepository.upsertNota(input.studentId, input.subjectId, input.courseId, input.teacherId, input.trimesterId)
  },

  async addNotaItem(input: AddNotaItemInput) {
    const nota = await notaRepository.findNotaRaw(input.notaId)
    if (!nota) throw new HttpError(404, 'Nota no encontrada')
    if (nota.cerrado) throw new HttpError(400, 'El trimestre está cerrado, no se puede editar')

    const errorTrimCerrado = await verificarTrimesterNoCerrado(nota.trimesterId)
    if (errorTrimCerrado) throw new HttpError(400, errorTrimCerrado)

    const errorTrim = await verificarTrimestresAnteriores(nota.trimesterId, nota.courseId, nota.subjectId)
    if (errorTrim) throw new HttpError(400, errorTrim)

    if (input.puntaje < 0 || input.puntaje > input.maxPuntaje) {
      throw new HttpError(400, `Puntaje fuera de rango (0 - ${input.maxPuntaje})`)
    }

    const item = await notaRepository.createNotaItem({
      notaId: input.notaId, dimension: input.dimension, titulo: input.titulo,
      puntaje: input.puntaje, maxPuntaje: input.maxPuntaje,
      fecha: input.fecha ? new Date(input.fecha) : null,
      taskId: input.taskId ?? null,
    })

    const notaActualizada = await recalcularNota(input.notaId)
    return { item, nota: notaActualizada }
  },

  async updateNotaItem(itemId: number, input: UpdateNotaItemInput) {
    const item = await notaRepository.findNotaItemById(itemId)
    if (!item) throw new HttpError(404, 'Ítem no encontrado')

    const nota = await notaRepository.findNotaRaw(item.notaId)
    if (nota?.cerrado) throw new HttpError(400, 'El trimestre está cerrado')

    const errorTrimCerrado = await verificarTrimesterNoCerrado(nota!.trimesterId)
    if (errorTrimCerrado) throw new HttpError(400, errorTrimCerrado)

    if (input.puntaje < 0 || input.puntaje > input.maxPuntaje) {
      throw new HttpError(400, `Puntaje fuera de rango (0 - ${input.maxPuntaje})`)
    }

    await notaRepository.updateNotaItem(itemId, {
      titulo: input.titulo, puntaje: input.puntaje, maxPuntaje: input.maxPuntaje,
      fecha: input.fecha ? new Date(input.fecha) : null,
    })

    return recalcularNota(item.notaId)
  },

  async deleteNotaItem(itemId: number) {
    const item = await notaRepository.findNotaItemById(itemId)
    if (!item) throw new HttpError(404, 'Ítem no encontrado')

    const nota = await notaRepository.findNotaRaw(item.notaId)
    if (nota?.cerrado) throw new HttpError(400, 'El trimestre está cerrado')

    const errorTrimCerrado = await verificarTrimesterNoCerrado(nota!.trimesterId)
    if (errorTrimCerrado) throw new HttpError(400, errorTrimCerrado)

    await notaRepository.deleteNotaItem(itemId)
    return recalcularNota(item.notaId)
  },

  async updateSer(notaId: number, input: UpdateSerInput) {
    const nota = await notaRepository.findNotaRaw(notaId)
    if (!nota) throw new HttpError(404, 'Nota no encontrada')
    if (nota.cerrado) throw new HttpError(400, 'El trimestre está cerrado')

    const errorTrimCerrado = await verificarTrimesterNoCerrado(nota.trimesterId)
    if (errorTrimCerrado) throw new HttpError(400, errorTrimCerrado)

    const total = calcularTotal(nota.saber, nota.hacer, input.ser, nota.autoEvaluacion)
    const updated = await notaRepository.updateSer(notaId, input.ser, total)
    await gamificationService.evaluateAchievements(nota.studentId)
    return updated
  },

  async updateAutoEvaluacion(notaId: number, input: UpdateAutoEvaluacionInput) {
    const nota = await notaRepository.findNotaRaw(notaId)
    if (!nota) throw new HttpError(404, 'Nota no encontrada')
    if (nota.cerrado) throw new HttpError(400, 'El trimestre está cerrado')

    const total = calcularTotal(nota.saber, nota.hacer, nota.ser, input.autoEvaluacion)
    const updated = await notaRepository.updateAutoEvaluacion(notaId, input.autoEvaluacion, total)
    await gamificationService.evaluateAchievements(nota.studentId)
    return updated
  },

  async cerrarNota(notaId: number) {
    const nota = await notaRepository.findNotaRaw(notaId)
    if (!nota) throw new HttpError(404, 'Nota no encontrada')
    if (nota.cerrado) throw new HttpError(400, 'Ya está cerrada')

    return notaRepository.cerrarNota(notaId)
  },

  async getCourseSummary(courseId: number, year: number) {
    const academicYear = await notaRepository.findAcademicYearByYear(year)
    if (!academicYear) throw new HttpError(404, `No existe gestión para ${year}`)

    const assignments = await notaRepository.findCourseAssignments(courseId, academicYear.id)
    const teacherSubjects = await notaRepository.findTeacherSubjectsForSummary(courseId)
    const subjects = teacherSubjects.map((ts) => ts.subject)

    const notas = await notaRepository.findNotasForSummary(courseId, academicYear.id)

    const notaMap: Record<string, any> = {}
    notas.forEach((n) => {
      notaMap[`${n.studentId}-${n.subjectId}-${n.trimester.number}`] = {
        notaId: n.id, saber: n.saber, hacer: n.hacer,
        ser: n.ser, autoEvaluacion: n.autoEvaluacion,
        total: n.total, cerrado: n.cerrado,
      }
    })

    const summary = assignments.map(({ student }) => {
      const row: any = { student, subjects: {}, promedioGeneral: 0 }
      let sumProm = 0
      let countMaterias = 0

      subjects.forEach((s) => {
        const t1 = notaMap[`${student.id}-${s.id}-1`]
        const t2 = notaMap[`${student.id}-${s.id}-2`]
        const t3 = notaMap[`${student.id}-${s.id}-3`]
        const vals = [t1?.total, t2?.total, t3?.total].filter((v) => v != null) as number[]
        const promedio = vals.length > 0 ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100) / 100 : 0
        row.subjects[s.id] = { t1, t2, t3, promedio }
        if (vals.length > 0) { sumProm += promedio; countMaterias++ }
      })

      row.promedioGeneral = countMaterias > 0 ? Math.round((sumProm / countMaterias) * 100) / 100 : 0
      return row
    })

    return { academicYear: { id: academicYear.id, year: academicYear.year }, trimesters: academicYear.trimesters, subjects, students: summary }
  },
}
