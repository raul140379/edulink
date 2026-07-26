import { Router, Request, Response } from 'express'
import prisma from '../lib/prisma'
import { comunicadoRepository } from '../repositories/comunicado.repository'
import { handleControllerError } from '../utils/http-error'

// Rutas públicas del portal del distrito — sin verifyToken. No hay contexto de
// tenant activo en estos requests, así que la extensión de lib/prisma.ts no
// inyecta ningún filtro de colegio/distrito: los counts/listados son globales,
// que es justo lo que necesita el portal público.
const router = Router()

router.get('/district', async (req: Request, res: Response) => {
  try {
    // Un solo distrito activo por despliegue — no hace falta parámetro alguno.
    const district = await prisma.district.findFirst({
      select: { name: true, location: true, logoUrl: true },
    })
    res.json(district)
  } catch (error) {
    handleControllerError(res, error)
  }
})

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

// Directorio de presidentes de Junta de Padres / Gobierno Estudiantil de Distrito
// y de cada Núcleo — transparencia institucional en el portal público.
router.get('/directorio', async (req: Request, res: Response) => {
  try {
    const nameOf = (m: { firstName: string; lastName: string } | null | undefined) =>
      m ? `${m.firstName} ${m.lastName}` : null

    const [juntaDistrito, gobiernoDistrito, nucleos] = await Promise.all([
      prisma.juntaMember.findFirst({
        where:  { juntaRole: 'PRESIDENTE', isActive: true, districtId: { not: null } },
        select: { firstName: true, lastName: true },
      }),
      prisma.gobiernoMember.findFirst({
        where:  { cargo: 'PRESIDENTE', isActive: true, districtId: { not: null } },
        select: { firstName: true, lastName: true },
      }),
      prisma.nucleo.findMany({
        select: {
          id: true,
          name: true,
          juntaMembers:    { where: { juntaRole: 'PRESIDENTE', isActive: true }, select: { firstName: true, lastName: true }, take: 1 },
          gobiernoMembers: { where: { cargo: 'PRESIDENTE', isActive: true },    select: { firstName: true, lastName: true }, take: 1 },
        },
        orderBy: { name: 'asc' },
      }),
    ])

    res.json({
      juntaDistrito:    nameOf(juntaDistrito),
      gobiernoDistrito: nameOf(gobiernoDistrito),
      nucleos: nucleos.map((n) => ({
        id: n.id,
        name: n.name,
        juntaPresidente:    nameOf(n.juntaMembers[0]),
        gobiernoPresidente: nameOf(n.gobiernoMembers[0]),
      })),
    })
  } catch (error) {
    handleControllerError(res, error)
  }
})

export default router
