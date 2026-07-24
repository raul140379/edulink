import { Router, Request, Response } from 'express'
import prisma from '../lib/prisma'
import { comunicadoRepository } from '../repositories/comunicado.repository'
import { handleControllerError } from '../utils/http-error'

// Rutas públicas del portal del distrito — sin verifyToken. No hay contexto de
// tenant activo en estos requests, así que la extensión de lib/prisma.ts no
// inyecta ningún filtro de colegio/distrito: los counts/listados son globales,
// que es justo lo que necesita el portal público.
const router = Router()

router.get('/schools', async (req: Request, res: Response) => {
  try {
    const schools = await prisma.school.findMany({
      where:   { isActive: true },
      select:  { id: true, name: true, tipo: true, area: true, nucleo: { select: { id: true, name: true } } },
      orderBy: { name: 'asc' },
    })
    res.json(schools)
  } catch (error) {
    handleControllerError(res, error)
  }
})

router.get('/stats', async (req: Request, res: Response) => {
  try {
    const [schools, nucleos, students, teachers] = await Promise.all([
      prisma.school.count({ where: { isActive: true } }),
      prisma.nucleo.count(),
      prisma.student.count({ where: { isActive: true } }),
      prisma.teacher.count({ where: { isActive: true } }),
    ])
    res.json({ schools, nucleos, students, teachers })
  } catch (error) {
    handleControllerError(res, error)
  }
})

router.get('/comunicados', async (req: Request, res: Response) => {
  try {
    res.json(await comunicadoRepository.findPublished())
  } catch (error) {
    handleControllerError(res, error)
  }
})

export default router
