import { Response } from 'express'
import { AuthRequest } from '../middlewares/auth.middleware'
import prisma from '../lib/prisma'

// ─────────────────────────────────────────────
// GET /api/academic — Listar gestiones
// ─────────────────────────────────────────────
export const getAcademicYears = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const years = await prisma.academicYear.findMany({
      include: {
        _count: {
          select: {
            trimesters:  true,
            assignments: true,
            holidays:    true,
          }
        }
      },
      orderBy: { year: 'desc' },
    })
    res.json(years)
  } catch (error) {
    console.error('getAcademicYears error:', error)
    res.status(500).json({ message: 'Error al obtener gestiones' })
  }
}

// ─────────────────────────────────────────────
// GET /api/academic/active — Gestión activa
// ─────────────────────────────────────────────
export const getActiveYear = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const year = await prisma.academicYear.findFirst({
      where: { isActive: true },
      include: {
        trimesters: { orderBy: { number: 'asc' } },
        holidays:   { orderBy: { date:   'asc' } },
      }
    })

    if (!year) {
      res.status(404).json({ message: 'No hay gestión activa' })
      return
    }

    res.json(year)
  } catch (error) {
    console.error('getActiveYear error:', error)
    res.status(500).json({ message: 'Error al obtener gestión activa' })
  }
}

// ─────────────────────────────────────────────
// POST /api/academic — Crear gestión
// ─────────────────────────────────────────────
export const createAcademicYear = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { year, startDate, endDate } = req.body

    if (!year || !startDate || !endDate) {
      res.status(400).json({ message: 'Año, fecha inicio y fecha fin son requeridos' })
      return
    }

    // Verificar que no exista ya esa gestión
    const existing = await prisma.academicYear.findUnique({ where: { year: parseInt(year) } })
    if (existing) {
      res.status(409).json({ message: `Ya existe la gestión ${year}` })
      return
    }

    const academicYear = await prisma.academicYear.create({
      data: {
        year:      parseInt(year),
        startDate: new Date(startDate),
        endDate:   new Date(endDate),
        isActive:  false,
      }
    })

    res.status(201).json({ message: 'Gestión creada correctamente', academicYear })
  } catch (error) {
    console.error('createAcademicYear error:', error)
    res.status(500).json({ message: 'Error al crear gestión' })
  }
}

// ─────────────────────────────────────────────
// PUT /api/academic/:id — Actualizar gestión
// ─────────────────────────────────────────────
export const updateAcademicYear = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params
    const { startDate, endDate } = req.body

    const existing = await prisma.academicYear.findUnique({ where: { id: parseInt(id) } })
    if (!existing) {
      res.status(404).json({ message: 'Gestión no encontrada' })
      return
    }

    const academicYear = await prisma.academicYear.update({
      where: { id: parseInt(id) },
      data: {
        ...(startDate ? { startDate: new Date(startDate) } : {}),
        ...(endDate   ? { endDate:   new Date(endDate)   } : {}),
      }
    })

    res.json({ message: 'Gestión actualizada', academicYear })
  } catch (error) {
    console.error('updateAcademicYear error:', error)
    res.status(500).json({ message: 'Error al actualizar gestión' })
  }
}

// ─────────────────────────────────────────────
// PATCH /api/academic/:id/toggle — Activar gestión
// Solo puede haber una gestión activa a la vez
// ─────────────────────────────────────────────
export const toggleAcademicYear = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params

    const year = await prisma.academicYear.findUnique({ where: { id: parseInt(id) } })
    if (!year) {
      res.status(404).json({ message: 'Gestión no encontrada' })
      return
    }

    if (!year.isActive) {
      // Desactivar todas las demás
      await prisma.academicYear.updateMany({
        where: { isActive: true },
        data:  { isActive: false },
      })
    }

    const updated = await prisma.academicYear.update({
      where: { id: parseInt(id) },
      data:  { isActive: !year.isActive },
    })

    res.json({
      message: updated.isActive ? `Gestión ${updated.year} activada` : `Gestión ${updated.year} desactivada`,
      academicYear: updated,
    })
  } catch (error) {
    console.error('toggleAcademicYear error:', error)
    res.status(500).json({ message: 'Error al cambiar estado de la gestión' })
  }
}

// ─────────────────────────────────────────────
// GET /api/academic/:yearId/trimesters
// ─────────────────────────────────────────────
export const getTrimesters = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { yearId } = req.params
    const trimesters = await prisma.trimester.findMany({
      where:   { academicYearId: parseInt(yearId) },
      orderBy: { number: 'asc' },
    })
    res.json(trimesters)
  } catch (error) {
    console.error('getTrimesters error:', error)
    res.status(500).json({ message: 'Error al obtener trimestres' })
  }
}

// ─────────────────────────────────────────────
// POST /api/academic/:yearId/trimesters
// ─────────────────────────────────────────────
export const createTrimester = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { yearId } = req.params
    const { number, name, startDate, endDate } = req.body

    if (!number || !startDate || !endDate) {
      res.status(400).json({ message: 'Número, fecha inicio y fecha fin son requeridos' })
      return
    }

    const existing = await prisma.trimester.findUnique({
      where: { academicYearId_number: { academicYearId: parseInt(yearId), number: parseInt(number) } }
    })

    if (existing) {
      res.status(409).json({ message: `El trimestre ${number} ya existe en esta gestión` })
      return
    }

    const trimester = await prisma.trimester.create({
      data: {
        number:        parseInt(number),
        name:          name || `Trimestre ${number}`,
        startDate:     new Date(startDate),
        endDate:       new Date(endDate),
        academicYearId: parseInt(yearId),
      }
    })

    res.status(201).json({ message: 'Trimestre creado', trimester })
  } catch (error) {
    console.error('createTrimester error:', error)
    res.status(500).json({ message: 'Error al crear trimestre' })
  }
}

// ─────────────────────────────────────────────
// GET /api/academic/:yearId/holidays
// ─────────────────────────────────────────────
export const getHolidays = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { yearId } = req.params
    const holidays = await prisma.holiday.findMany({
      where:   { academicYearId: parseInt(yearId) },
      orderBy: { date: 'asc' },
    })
    res.json(holidays)
  } catch (error) {
    console.error('getHolidays error:', error)
    res.status(500).json({ message: 'Error al obtener feriados' })
  }
}

// ─────────────────────────────────────────────
// POST /api/academic/:yearId/holidays
// ─────────────────────────────────────────────
export const createHoliday = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { yearId } = req.params
    const { date, description } = req.body

    if (!date || !description) {
      res.status(400).json({ message: 'Fecha y descripción son requeridos' })
      return
    }

    const holiday = await prisma.holiday.create({
      data: {
        date:          new Date(date),
        description,
        academicYearId: parseInt(yearId),
      }
    })

    res.status(201).json({ message: 'Feriado registrado', holiday })
  } catch (error) {
    console.error('createHoliday error:', error)
    res.status(500).json({ message: 'Error al registrar feriado' })
  }
}

// ─────────────────────────────────────────────
// DELETE /api/academic/:yearId/holidays/:id
// ─────────────────────────────────────────────
export const deleteHoliday = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params
    await prisma.holiday.delete({ where: { id: parseInt(id) } })
    res.json({ message: 'Feriado eliminado' })
  } catch (error) {
    console.error('deleteHoliday error:', error)
    res.status(500).json({ message: 'Error al eliminar feriado' })
  }
}