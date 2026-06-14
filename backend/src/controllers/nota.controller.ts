import { Request, Response } from 'express'
import { PrismaClient, NotaDimension } from '@prisma/client'

const prisma = new PrismaClient()


// ── Helper: verificar que el trimestre anterior esté cerrado ────────
async function verificarTrimestresAnteriores(trimesterId: number, courseId: number, subjectId: number): Promise<string | null> {
  const trimestre = await prisma.trimester.findUnique({
    where: { id: trimesterId },
    include: { academicYear: { include: { trimesters: { orderBy: { number: 'asc' } } } } }
  })
  if (!trimestre) return 'Trimestre no encontrado'
  if (trimestre.number === 1) return null // Sin restricción

  // Buscar el trimestre anterior
  const trimAnterior = trimestre.academicYear.trimesters.find(t => t.number === trimestre.number - 1)
  if (!trimAnterior) return null

  // Verificar si hay notas cerradas del trimestre anterior en este curso/materia
  const notasAnteriores = await prisma.nota.findMany({
    where: { trimesterId: trimAnterior.id, courseId, subjectId }
  })

  if (notasAnteriores.length === 0) {
    return `Debes registrar y cerrar el ${trimestre.number - 1}° Trimestre antes de ingresar notas del ${trimestre.number}° Trimestre`
  }

  const todasCerradas = notasAnteriores.every(n => n.cerrado)
  if (!todasCerradas) {
    return `El ${trimestre.number - 1}° Trimestre no está completamente cerrado. Ciérralo antes de continuar con el ${trimestre.number}° Trimestre`
  }

  return null
}
// ── Helper: verificar que el trimestre no esté cerrado por el director ──
async function verificarTrimesterNoCerrado(trimesterId: number): Promise<string | null> {
  const trimestre = await prisma.trimester.findUnique({ where: { id: trimesterId } })
  if (!trimestre) return 'Trimestre no encontrado'
  if (trimestre.isClosed) return `El ${trimestre.number}° Trimestre fue cerrado por la dirección. No se pueden modificar notas.`
  return null
}
// ── Helper: recalcula saber, hacer y total de una Nota ──────────────
async function recalcularNota(notaId: number) {
  const items = await prisma.notaItem.findMany({ where: { notaId } })

  const itemsSaber = items.filter(i => i.dimension === 'SABER')
  const itemsHacer = items.filter(i => i.dimension === 'HACER')

  // Promedio ponderado → escala a 45 pts (SABER) y 40 pts (HACER)
  const calcProm = (arr: typeof items, maxPts: number) => {
    if (arr.length === 0) return null
    const sumPorc = arr.reduce((acc, i) => acc + (i.puntaje / i.maxPuntaje), 0)
    return Math.round((sumPorc / arr.length) * maxPts * 100) / 100
  }

  const saber = calcProm(itemsSaber, 45)
  const hacer = calcProm(itemsHacer, 40)

  const nota = await prisma.nota.findUnique({ where: { id: notaId } })
  const ser          = nota?.ser          ?? null
  const autoEval     = nota?.autoEvaluacion ?? null

  const vals = [saber, hacer, ser, autoEval].filter(v => v !== null) as number[]
  const total = vals.length > 0 ? Math.round(vals.reduce((a, b) => a + b, 0) * 100) / 100 : null

  return prisma.nota.update({
    where: { id: notaId },
    data: { saber, hacer, total },
  })
}

// ──────────────────────────────────────────────────────────────────────
// GET /notas/trimestres?year=2026
// ──────────────────────────────────────────────────────────────────────
export const getTrimestres = async (req: Request, res: Response) => {
  try {
    const year = req.query.year ? parseInt(req.query.year as string) : new Date().getFullYear()
    const academicYear = await prisma.academicYear.findFirst({
      where: { year },
      include: { trimesters: { orderBy: { number: 'asc' } } },
    })
    if (!academicYear) return res.status(404).json({ error: `No existe gestión para ${year}` })
    res.json(academicYear.trimesters)
  } catch (e) {
    res.status(500).json({ error: 'Error al obtener trimestres' })
  }
}

// ──────────────────────────────────────────────────────────────────────
// GET /notas/teacher-subjects/:teacherId
// ──────────────────────────────────────────────────────────────────────
export const getTeacherSubjects = async (req: Request, res: Response) => {
  try {
    const teacherId = parseInt(req.params.teacherId)
    const assignments = await prisma.teacherSubjectCourse.findMany({
      where: { teacherId },
      include: { subject: true, course: true },
    })
    res.json(assignments)
  } catch (e) {
    res.status(500).json({ error: 'Error al obtener materias del maestro' })
  }
}

// ──────────────────────────────────────────────────────────────────────
// GET /notas/course-students/:courseId?year=2026
// ──────────────────────────────────────────────────────────────────────
export const getCourseStudents = async (req: Request, res: Response) => {
  try {
    const courseId = parseInt(req.params.courseId)
    const year = req.query.year ? parseInt(req.query.year as string) : new Date().getFullYear()
    const academicYear = await prisma.academicYear.findFirst({ where: { year } })
    if (!academicYear) return res.status(404).json({ error: `No existe gestión para ${year}` })

    const assignments = await prisma.studentAcademicAssignment.findMany({
      where: { courseId, academicYearId: academicYear.id },
      include: { student: { select: { id: true, firstName: true, lastName: true, kardex: true } } },
      orderBy: { student: { lastName: 'asc' } },
    })
    res.json(assignments.map(a => a.student))
  } catch (e) {
    res.status(500).json({ error: 'Error al obtener estudiantes' })
  }
}

// ──────────────────────────────────────────────────────────────────────
// GET /notas/course/:courseId?trimesterId=1&year=2026
// Notas completas de un curso (con dimensiones)
// ──────────────────────────────────────────────────────────────────────
export const getNotasByCourse = async (req: Request, res: Response) => {
  try {
    const courseId    = parseInt(req.params.courseId)
    const trimesterId = req.query.trimesterId ? parseInt(req.query.trimesterId as string) : undefined
    const year        = req.query.year ? parseInt(req.query.year as string) : new Date().getFullYear()

    const notas = await prisma.nota.findMany({
      where: {
        courseId,
        ...(trimesterId && { trimesterId }),
        trimester: { academicYear: { year } },
      },
      include: {
        student:  { select: { id: true, firstName: true, lastName: true, kardex: true } },
        subject:  { select: { id: true, name: true } },
        teacher:  { select: { id: true, firstName: true, lastName: true } },
        trimester:{ select: { id: true, number: true, name: true } },
        items:    true,
      },
      orderBy: [{ subject: { name: 'asc' } }, { student: { lastName: 'asc' } }],
    })
    res.json(notas)
  } catch (e) {
    res.status(500).json({ error: 'Error al obtener notas del curso' })
  }
}

// ──────────────────────────────────────────────────────────────────────
// GET /notas/student/:studentId?year=2026
// Todas las notas de un estudiante agrupadas por materia
// ──────────────────────────────────────────────────────────────────────
export const getNotasByStudent = async (req: Request, res: Response) => {
  try {
    const studentId = parseInt(req.params.studentId)
    const year = req.query.year ? parseInt(req.query.year as string) : new Date().getFullYear()

    const notas = await prisma.nota.findMany({
      where: { studentId, trimester: { academicYear: { year } } },
      include: {
        subject:  { select: { id: true, name: true } },
        trimester:{ select: { id: true, number: true, name: true } },
        course:   { select: { id: true, grade: true, parallel: true, level: true } },
        items:    true,
      },
      orderBy: [{ subject: { name: 'asc' } }, { trimester: { number: 'asc' } }],
    })

    // Agrupar por materia
    const grouped: Record<number, any> = {}
    notas.forEach(n => {
      if (!grouped[n.subjectId]) {
        grouped[n.subjectId] = { subject: n.subject, course: n.course, t1: null, t2: null, t3: null, promedio: 0 }
      }
      grouped[n.subjectId][`t${n.trimester.number}`] = {
        notaId: n.id, saber: n.saber, hacer: n.hacer, ser: n.ser,
        autoEvaluacion: n.autoEvaluacion, total: n.total, cerrado: n.cerrado
      }
    })

    // Promedios anuales por materia
    Object.values(grouped).forEach((item: any) => {
      const vals = [item.t1?.total, item.t2?.total, item.t3?.total].filter(v => v != null) as number[]
      item.promedio = vals.length > 0
        ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100) / 100
        : 0
    })

    res.json(Object.values(grouped))
  } catch (e) {
    res.status(500).json({ error: 'Error al obtener notas del estudiante' })
  }
}

// ──────────────────────────────────────────────────────────────────────
// GET /notas/detalle/:notaId
// Ítems detallados de una nota (exámenes y trabajos)
// ──────────────────────────────────────────────────────────────────────
export const getNotaDetalle = async (req: Request, res: Response) => {
  try {
    const notaId = parseInt(req.params.notaId)
    const nota = await prisma.nota.findUnique({
      where: { id: notaId },
      include: {
        student:  { select: { id: true, firstName: true, lastName: true } },
        subject:  { select: { id: true, name: true } },
        trimester:{ select: { id: true, number: true, name: true } },
        items:    { orderBy: { createdAt: 'asc' } },
      },
    })
    if (!nota) return res.status(404).json({ error: 'Nota no encontrada' })
    res.json(nota)
  } catch (e) {
    res.status(500).json({ error: 'Error al obtener detalle de nota' })
  }
}

// ──────────────────────────────────────────────────────────────────────
// POST /notas/init
// Inicializar una Nota vacía para student+subject+course+trimestre
// Body: { studentId, subjectId, courseId, teacherId, trimesterId }
// ──────────────────────────────────────────────────────────────────────
export const initNota = async (req: Request, res: Response) => {
  try {
    const { studentId, subjectId, courseId, teacherId, trimesterId } = req.body

      // Validar trimestre anterior
    const error = await verificarTrimestresAnteriores(parseInt(trimesterId), parseInt(courseId), parseInt(subjectId))
    if (error) return res.status(400).json({ error })

      const errorTrimCerrado = await verificarTrimesterNoCerrado(parseInt(trimesterId))
    if (errorTrimCerrado) return res.status(400).json({ error: errorTrimCerrado })

    const nota = await prisma.nota.upsert({
      where: {
        studentId_subjectId_courseId_trimesterId: {
          studentId: parseInt(studentId),
          subjectId: parseInt(subjectId),
          courseId:  parseInt(courseId),
          trimesterId: parseInt(trimesterId),
        }
      },
      update: {},
      create: {
        studentId:   parseInt(studentId),
        subjectId:   parseInt(subjectId),
        courseId:    parseInt(courseId),
        teacherId:   parseInt(teacherId),
        trimesterId: parseInt(trimesterId),
      },
    })
    res.json(nota)
  } catch (e) {
    res.status(500).json({ error: 'Error al inicializar nota' })
  }
}

// ──────────────────────────────────────────────────────────────────────
// POST /notas/items
// Agregar ítem de Saber o Hacer
// Body: { notaId, dimension, titulo, puntaje, maxPuntaje, fecha?, taskId? }
// ──────────────────────────────────────────────────────────────────────
export const addNotaItem = async (req: Request, res: Response) => {
  try {
    const { notaId, dimension, titulo, puntaje, maxPuntaje, fecha, taskId } = req.body

    // Verificar que la nota no esté cerrada
    const nota = await prisma.nota.findUnique({ where: { id: parseInt(notaId) } })
    if (!nota) return res.status(404).json({ error: 'Nota no encontrada' })
    if (nota.cerrado) return res.status(400).json({ error: 'El trimestre está cerrado, no se puede editar' })

    const errorTrimCerrado = await verificarTrimesterNoCerrado(nota.trimesterId)
    if (errorTrimCerrado) return res.status(400).json({ error: errorTrimCerrado })

       // Verificar trimestres anteriores
    const errorTrim = await verificarTrimestresAnteriores(nota.trimesterId, nota.courseId, nota.subjectId)
    if (errorTrim) return res.status(400).json({ error: errorTrim })

    // Validar dimensión
    if (!['SABER', 'HACER'].includes(dimension)) {
      return res.status(400).json({ error: 'Dimensión inválida. Debe ser SABER o HACER' })
    }

    // Validar puntaje
    if (puntaje < 0 || puntaje > maxPuntaje) {
      return res.status(400).json({ error: `Puntaje fuera de rango (0 - ${maxPuntaje})` })
    }

    const item = await prisma.notaItem.create({
      data: {
        notaId:     parseInt(notaId),
        dimension:  dimension as NotaDimension,
        titulo,
        puntaje:    parseFloat(puntaje),
        maxPuntaje: parseFloat(maxPuntaje),
        fecha:      fecha ? new Date(fecha) : null,
        taskId:     taskId ? parseInt(taskId) : null,
      },
    })

    // Recalcular saber/hacer/total
    const notaActualizada = await recalcularNota(parseInt(notaId))
    res.json({ item, nota: notaActualizada })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Error al agregar ítem' })
  }
}

// ──────────────────────────────────────────────────────────────────────
// PUT /notas/items/:id
// Editar un ítem existente
// ──────────────────────────────────────────────────────────────────────
export const updateNotaItem = async (req: Request, res: Response) => {
  try {
    const itemId = parseInt(req.params.id)
    const { titulo, puntaje, maxPuntaje, fecha } = req.body

    const item = await prisma.notaItem.findUnique({ where: { id: itemId } })
    if (!item) return res.status(404).json({ error: 'Ítem no encontrado' })

    
    // Verificar que la nota no esté cerrada
    const nota = await prisma.nota.findUnique({ where: { id: item.notaId } })
    if (nota?.cerrado) return res.status(400).json({ error: 'El trimestre está cerrado' })
    
        const errorTrimCerrado = await verificarTrimesterNoCerrado(nota!.trimesterId)
    if (errorTrimCerrado) return res.status(400).json({ error: errorTrimCerrado })


    if (puntaje < 0 || puntaje > maxPuntaje) {
      return res.status(400).json({ error: `Puntaje fuera de rango (0 - ${maxPuntaje})` })
    }

    await prisma.notaItem.update({
      where: { id: itemId },
      data: {
        titulo,
        puntaje:    parseFloat(puntaje),
        maxPuntaje: parseFloat(maxPuntaje),
        fecha:      fecha ? new Date(fecha) : null,
      },
    })

    const notaActualizada = await recalcularNota(item.notaId)
    res.json({ message: 'Ítem actualizado', nota: notaActualizada })
  } catch (e) {
    res.status(500).json({ error: 'Error al actualizar ítem' })
  }
}

// ──────────────────────────────────────────────────────────────────────
// DELETE /notas/items/:id
// Eliminar un ítem
// ──────────────────────────────────────────────────────────────────────
export const deleteNotaItem = async (req: Request, res: Response) => {
  try {
    const itemId = parseInt(req.params.id)
    const item = await prisma.notaItem.findUnique({ where: { id: itemId } })
    if (!item) return res.status(404).json({ error: 'Ítem no encontrado' })

    const nota = await prisma.nota.findUnique({ where: { id: item.notaId } })
    if (nota?.cerrado) return res.status(400).json({ error: 'El trimestre está cerrado' })

  const errorTrimCerrado = await verificarTrimesterNoCerrado(nota!.trimesterId)
    if (errorTrimCerrado) return res.status(400).json({ error: errorTrimCerrado })

    await prisma.notaItem.delete({ where: { id: itemId } })
    const notaActualizada = await recalcularNota(item.notaId)
    res.json({ message: 'Ítem eliminado', nota: notaActualizada })
  } catch (e) {
    res.status(500).json({ error: 'Error al eliminar ítem' })
  }
}

// ──────────────────────────────────────────────────────────────────────
// PUT /notas/:id/ser
// Maestro ingresa nota Ser (0-10) al cerrar el trimestre
// ──────────────────────────────────────────────────────────────────────
export const updateSer = async (req: Request, res: Response) => {
  try {
    const notaId = parseInt(req.params.id)
    const { ser } = req.body

    if (ser < 0 || ser > 10) return res.status(400).json({ error: 'Ser debe estar entre 0 y 10' })

    const nota = await prisma.nota.findUnique({ where: { id: notaId } })
    if (!nota) return res.status(404).json({ error: 'Nota no encontrada' })
    if (nota.cerrado) return res.status(400).json({ error: 'El trimestre está cerrado' })

      const errorTrimCerrado = await verificarTrimesterNoCerrado(nota!.trimesterId)
    if (errorTrimCerrado) return res.status(400).json({ error: errorTrimCerrado })

    const updated = await prisma.nota.update({
      where: { id: notaId },
      data: {
        ser: parseFloat(ser),
        total: calcularTotal(nota.saber, nota.hacer, parseFloat(ser), nota.autoEvaluacion),
      },
    })
    res.json(updated)
  } catch (e) {
    res.status(500).json({ error: 'Error al actualizar Ser' })
  }
}

// ──────────────────────────────────────────────────────────────────────
// PUT /notas/:id/autoevaluacion
// Estudiante ingresa su autoevaluación (0-5)
// ──────────────────────────────────────────────────────────────────────
export const updateAutoEvaluacion = async (req: Request, res: Response) => {
  try {
    const notaId = parseInt(req.params.id)
    const { autoEvaluacion } = req.body

    if (autoEvaluacion < 0 || autoEvaluacion > 5) {
      return res.status(400).json({ error: 'Autoevaluación debe estar entre 0 y 5' })
    }

    const nota = await prisma.nota.findUnique({ where: { id: notaId } })
    if (!nota) return res.status(404).json({ error: 'Nota no encontrada' })
    if (nota.cerrado) return res.status(400).json({ error: 'El trimestre está cerrado' })

    const updated = await prisma.nota.update({
      where: { id: notaId },
      data: {
        autoEvaluacion: parseFloat(autoEvaluacion),
        total: calcularTotal(nota.saber, nota.hacer, nota.ser, parseFloat(autoEvaluacion)),
      },
    })
    res.json(updated)
  } catch (e) {
    res.status(500).json({ error: 'Error al actualizar autoevaluación' })
  }
}

// ──────────────────────────────────────────────────────────────────────
// PUT /notas/:id/cerrar
// Maestro cierra el trimestre — ya no se puede editar
// ──────────────────────────────────────────────────────────────────────
export const cerrarNota = async (req: Request, res: Response) => {
  try {
    const notaId = parseInt(req.params.id)
    const nota = await prisma.nota.findUnique({ where: { id: notaId } })
    if (!nota) return res.status(404).json({ error: 'Nota no encontrada' })
    if (nota.cerrado) return res.status(400).json({ error: 'Ya está cerrada' })

    const updated = await prisma.nota.update({
      where: { id: notaId },
      data: { cerrado: true },
    })
    res.json({ message: 'Trimestre cerrado correctamente', nota: updated })
  } catch (e) {
    res.status(500).json({ error: 'Error al cerrar nota' })
  }
}

// ──────────────────────────────────────────────────────────────────────
// GET /notas/summary/:courseId?year=2026
// Resumen por curso: estudiante × materia × trimestre (con total)
// ──────────────────────────────────────────────────────────────────────
export const getCourseSummary = async (req: Request, res: Response) => {
  try {
    const courseId = parseInt(req.params.courseId)
    const year = req.query.year ? parseInt(req.query.year as string) : new Date().getFullYear()

    const academicYear = await prisma.academicYear.findFirst({
      where: { year },
      include: { trimesters: { orderBy: { number: 'asc' } } },
    })
    if (!academicYear) return res.status(404).json({ error: `No existe gestión para ${year}` })

    const assignments = await prisma.studentAcademicAssignment.findMany({
      where: { courseId, academicYearId: academicYear.id },
      include: { student: { select: { id: true, firstName: true, lastName: true, kardex: true } } },
      orderBy: { student: { lastName: 'asc' } },
    })

    const teacherSubjects = await prisma.teacherSubjectCourse.findMany({
      where: { courseId },
      include: { subject: true },
    })
    const subjects = teacherSubjects.map(ts => ts.subject)

    const notas = await prisma.nota.findMany({
      where: { courseId, trimester: { academicYearId: academicYear.id } },
      include: { trimester: { select: { number: true } } },
    })

    // Mapa: studentId-subjectId-trimNumber → { saber, hacer, ser, autoEval, total }
    const notaMap: Record<string, any> = {}
    notas.forEach(n => {
      notaMap[`${n.studentId}-${n.subjectId}-${n.trimester.number}`] = {
        notaId: n.id, saber: n.saber, hacer: n.hacer,
        ser: n.ser, autoEvaluacion: n.autoEvaluacion,
        total: n.total, cerrado: n.cerrado,
      }
    })

    const summary = assignments.map(({ student }) => {
      const row: any = { student, subjects: {}, promedioGeneral: 0 }
      let sumProm = 0, countMaterias = 0

      subjects.forEach(s => {
        const t1 = notaMap[`${student.id}-${s.id}-1`]
        const t2 = notaMap[`${student.id}-${s.id}-2`]
        const t3 = notaMap[`${student.id}-${s.id}-3`]
        const vals = [t1?.total, t2?.total, t3?.total].filter(v => v != null) as number[]
        const promedio = vals.length > 0
          ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100) / 100
          : 0
        row.subjects[s.id] = { t1, t2, t3, promedio }
        if (vals.length > 0) { sumProm += promedio; countMaterias++ }
      })

      row.promedioGeneral = countMaterias > 0
        ? Math.round((sumProm / countMaterias) * 100) / 100 : 0
      return row
    })

    res.json({ academicYear: { id: academicYear.id, year: academicYear.year }, trimesters: academicYear.trimesters, subjects, students: summary })
  } catch (e) {
    res.status(500).json({ error: 'Error al generar resumen' })
  }
}

// ── Helper interno para recalcular total ────────────────────────────
function calcularTotal(saber: number|null, hacer: number|null, ser: number|null, autoEval: number|null): number|null {
  const vals = [saber, hacer, ser, autoEval].filter(v => v !== null) as number[]
  return vals.length > 0 ? Math.round(vals.reduce((a, b) => a + b, 0) * 100) / 100 : null
}

// Mantener compatibilidad con el endpoint bulk anterior (deprecated)
export const upsertNotasBulk = async (req: Request, res: Response) => {
  res.status(410).json({ error: 'Este endpoint fue reemplazado. Usar POST /notas/init + POST /notas/items' })
}