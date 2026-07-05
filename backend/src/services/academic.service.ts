import { academicRepository } from '../repositories/academic.repository'
import { HttpError } from '../utils/http-error'
import { CreateAcademicYearInput, UpdateAcademicYearInput, CreateTrimesterInput, CreateHolidayInput } from '../schemas/academic.schema'

export const academicService = {
  getAcademicYears() {
    return academicRepository.findAllYears()
  },

  async getActiveYear() {
    const year = await academicRepository.findActiveYear()
    if (!year) throw new HttpError(404, 'No hay gestión activa')
    return year
  },

  async createAcademicYear(input: CreateAcademicYearInput) {
    const existing = await academicRepository.findYearByYear(input.year)
    if (existing) throw new HttpError(409, `Ya existe la gestión ${input.year}`)

    return academicRepository.createYear({ year: input.year, startDate: new Date(input.startDate), endDate: new Date(input.endDate) })
  },

  async updateAcademicYear(id: number, input: UpdateAcademicYearInput) {
    const existing = await academicRepository.findYearById(id)
    if (!existing) throw new HttpError(404, 'Gestión no encontrada')

    return academicRepository.updateYear(id, {
      startDate: input.startDate ? new Date(input.startDate) : undefined,
      endDate: input.endDate ? new Date(input.endDate) : undefined,
    })
  },

  async toggleAcademicYear(id: number) {
    const year = await academicRepository.findYearById(id)
    if (!year) throw new HttpError(404, 'Gestión no encontrada')

    if (!year.isActive) await academicRepository.deactivateAllYears()

    const updated = await academicRepository.setYearActive(id, !year.isActive)
    return { message: updated.isActive ? `Gestión ${updated.year} activada` : `Gestión ${updated.year} desactivada`, academicYear: updated }
  },

  getTrimesters(yearId: number) {
    return academicRepository.findTrimestersByYear(yearId)
  },

  async createTrimester(yearId: number, input: CreateTrimesterInput) {
    const existing = await academicRepository.findTrimesterByYearAndNumber(yearId, input.number)
    if (existing) throw new HttpError(409, `El trimestre ${input.number} ya existe en esta gestión`)

    return academicRepository.createTrimester({
      number: input.number,
      name: input.name || `Trimestre ${input.number}`,
      startDate: new Date(input.startDate),
      endDate: new Date(input.endDate),
      academicYearId: yearId,
      isClosed: input.number > 1, // T2 y T3 nacen cerrados
    })
  },

  getHolidays(yearId: number) {
    return academicRepository.findHolidaysByYear(yearId)
  },

  createHoliday(yearId: number, input: CreateHolidayInput) {
    return academicRepository.createHoliday({ date: new Date(input.date), description: input.description, academicYearId: yearId })
  },

  async deleteHoliday(id: number) {
    await academicRepository.deleteHoliday(id)
  },

  async toggleCloseTrimester(id: number) {
    const trimestre = await academicRepository.findTrimesterById(id)
    if (!trimestre) throw new HttpError(404, 'Trimestre no encontrado')

    const todosTrimesters = trimestre.academicYear.trimesters
    const nombreTrimestre = trimestre.name || `${trimestre.number}° Trimestre`

    if (trimestre.isClosed) {
      // ── REABRIR ── Solo se puede reabrir si el siguiente está cerrado o no existe
      const siguiente = todosTrimesters.find((t) => t.number === trimestre.number + 1)
      if (siguiente && !siguiente.isClosed) {
        throw new HttpError(400, `El ${trimestre.number + 1}° Trimestre está abierto. Ciérralo antes de reabrir este.`)
      }

      await academicRepository.updateTrimesterClosed(id, false)
      return { message: `${nombreTrimestre} reabierto` }
    }

    // ── CERRAR ── Verificar que el trimestre anterior esté cerrado (excepto el 1°)
    if (trimestre.number > 1) {
      const anterior = todosTrimesters.find((t) => t.number === trimestre.number - 1)
      if (anterior && !anterior.isClosed) {
        throw new HttpError(400, `Debes cerrar el ${trimestre.number - 1}° Trimestre antes.`)
      }
    }

    await academicRepository.updateTrimesterClosed(id, true)

    const siguiente = todosTrimesters.find((t) => t.number === trimestre.number + 1)
    if (siguiente) {
      const siguienteActualizado = await academicRepository.updateTrimesterClosed(siguiente.id, false)
      return {
        message: `${nombreTrimestre} cerrado. Se abrió automáticamente el ${siguiente.number}° Trimestre.`,
        trimestre,
        siguiente: siguienteActualizado,
      }
    }

    return { message: `${nombreTrimestre} cerrado. Fin de la gestión académica.` }
  },
}
