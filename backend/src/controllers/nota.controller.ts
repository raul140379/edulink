import { Request, Response } from 'express'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// ──────────────────────────────────────────
// GET /notas/trimestres?year=2025
// Devuelve los trimestres del año activo (o el año pedido)
// ──────────────────────────────────────────
export const getTrimestres = async (req: Request, res: Response) => {
  try {
    const year = req.query.year ? parseInt(req.query.year as string) : new Date().getFullYear()

    const academicYear = await prisma.academicYear.findFirst({
      where: { year },
      include: { trimesters: { orderBy: { number: 'asc' } } },
    })

    if (!academicYear) {
      return res.status(404).json({ error: `No existe gestión académica para el año ${year}` })
    }

    res.json(academicYear.trimesters)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Error al obtener trimestres' })
  }
}

// ──────────────────────────────────────────
// GET /notas/course/:courseId?trimesterId=1&year=2025
// Notas de todo un curso para un trimestre
// ──────────────────────────────────────────
export const getNotasByCourse = async (req: Request, res: Response) => {
  try {
    const courseId = parseInt(req.params.courseId)
    const trimesterId = req.query.trimesterId ? parseInt(req.query.trimesterId as string) : undefined
    const year = req.query.year ? parseInt(req.query.year as string) : new Date().getFullYear()

    const notas = await prisma.nota.findMany({
      where: {
        courseId,
        ...(trimesterId && { trimesterId }),
        trimester: { academicYear: { year } },
      },
      include: {
        student: { select: { id: true, firstName: true, lastName: true, kardex: true } },
        subject: { select: { id: true, name: true } },
        teacher: { select: { id: true, firstName: true, lastName: true } },
        trimester: { select: { id: true, number: true, name: true } },
      },
      orderBy: [{ subject: { name: 'asc' } }, { student: { lastName: 'asc' } }],
    })

    res.json(notas)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Error al obtener notas del curso' })
  }
}

// ──────────────────────────────────────────
// GET /notas/student/:studentId?year=2025
// Todas las notas de un estudiante agrupadas por materia
// ──────────────────────────────────────────
export const getNotasByStudent = async (req: Request, res: Response) => {
  try {
    const studentId = parseInt(req.params.studentId)
    const year = req.query.year ? parseInt(req.query.year as string) : new Date().getFullYear()

    const notas = await prisma.nota.findMany({
      where: {
        studentId,
        trimester: { academicYear: { year } },
      },
      include: {
        subject: { select: { id: true, name: true } },
        trimester: { select: { id: true, number: true, name: true } },
        course: { select: { id: true, grade: true, parallel: true, level: true } },
      },
      orderBy: [{ subject: { name: 'asc' } }, { trimester: { number: 'asc' } }],
    })

    // Agrupar por materia
    const grouped: Record<number, any> = {}

    notas.forEach((n) => {
      if (!grouped[n.subjectId]) {
        grouped[n.subjectId] = {
          subject: n.subject,
          course: n.course,
          t1: null, t2: null, t3: null,
          promedio: 0,
        }
      }
      grouped[n.subjectId][`t${n.trimester.number}`] = n.value
    })

    // Calcular promedios
    Object.values(grouped).forEach((item: any) => {
      const vals = [item.t1, item.t2, item.t3].filter((v) => v !== null) as number[]
      item.promedio = vals.length > 0
        ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100) / 100
        : 0
    })

    res.json(Object.values(grouped))
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Error al obtener notas del estudiante' })
  }
}

// ──────────────────────────────────────────
// POST /notas/bulk — guardar lote de notas (upsert)
// Body: { notas: [{ studentId, subjectId, courseId, teacherId, trimesterId, value }] }
// ──────────────────────────────────────────
export const upsertNotasBulk = async (req: Request, res: Response) => {
  try {
    const { notas } = req.body

    if (!Array.isArray(notas) || notas.length === 0) {
      return res.status(400).json({ error: 'Se requiere un array de notas' })
    }

    // Validar rango 0–100
    for (const n of notas) {
      if (n.value < 0 || n.value > 100) {
        return res.status(400).json({ error: `Nota fuera de rango para estudiante ${n.studentId}` })
      }
    }

    const results = await Promise.all(
      notas.map((n) =>
        prisma.nota.upsert({
          where: {
            studentId_subjectId_courseId_trimesterId: {
              studentId: parseInt(n.studentId),
              subjectId: parseInt(n.subjectId),
              courseId: parseInt(n.courseId),
              trimesterId: parseInt(n.trimesterId),
            },
          },
          update: { value: n.value, teacherId: parseInt(n.teacherId) },
          create: {
            studentId: parseInt(n.studentId),
            subjectId: parseInt(n.subjectId),
            courseId: parseInt(n.courseId),
            teacherId: parseInt(n.teacherId),
            trimesterId: parseInt(n.trimesterId),
            value: n.value,
          },
        })
      )
    )

    res.json({ saved: results.length })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Error al guardar notas' })
  }
}

// ──────────────────────────────────────────
// GET /notas/summary/:courseId?year=2025
// Tabla resumen: estudiantes × materias × 3 trimestres
// ──────────────────────────────────────────
export const getCourseSummary = async (req: Request, res: Response) => {
  try {
    const courseId = parseInt(req.params.courseId)
    const year = req.query.year ? parseInt(req.query.year as string) : new Date().getFullYear()

    // Año académico activo (o el pedido)
    const academicYear = await prisma.academicYear.findFirst({
      where: { year },
      include: { trimesters: { orderBy: { number: 'asc' } } },
    })

    if (!academicYear) {
      return res.status(404).json({ error: `No existe gestión para el año ${year}` })
    }

    // Estudiantes inscritos en el curso ese año
    const assignments = await prisma.studentAcademicAssignment.findMany({
      where: { courseId, academicYearId: academicYear.id },
      include: {
        student: { select: { id: true, firstName: true, lastName: true, kardex: true } },
      },
      orderBy: { student: { lastName: 'asc' } },
    })

    // Materias asignadas al curso
    const teacherSubjects = await prisma.teacherSubjectCourse.findMany({
      where: { courseId },
      include: { subject: true },
    })
    const subjects = teacherSubjects.map((ts) => ts.subject)

    // Todas las notas del curso ese año
    const notas = await prisma.nota.findMany({
      where: {
        courseId,
        trimester: { academicYearId: academicYear.id },
      },
      include: { trimester: { select: { number: true } } },
    })

    // Mapa rápido: studentId-subjectId-trimNumber → value
    const notaMap: Record<string, number> = {}
    notas.forEach((n) => {
      notaMap[`${n.studentId}-${n.subjectId}-${n.trimester.number}`] = n.value
    })

    const summary = assignments.map(({ student }) => {
      const row: any = { student, subjects: {}, promedioGeneral: 0 }
      let sumProm = 0, countMaterias = 0

      subjects.forEach((s) => {
        const t1 = notaMap[`${student.id}-${s.id}-1`]
        const t2 = notaMap[`${student.id}-${s.id}-2`]
        const t3 = notaMap[`${student.id}-${s.id}-3`]
        const vals = [t1, t2, t3].filter((v) => v !== undefined) as number[]
        const promedio = vals.length > 0
          ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100) / 100
          : 0
        row.subjects[s.id] = { t1, t2, t3, promedio }
        if (vals.length > 0) { sumProm += promedio; countMaterias++ }
      })

      row.promedioGeneral = countMaterias > 0
        ? Math.round((sumProm / countMaterias) * 100) / 100
        : 0

      return row
    })

    res.json({
      academicYear: { id: academicYear.id, year: academicYear.year },
      trimesters: academicYear.trimesters,
      subjects,
      students: summary,
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Error al generar resumen' })
  }
}

// ──────────────────────────────────────────
// GET /notas/teacher-subjects/:teacherId
// Materias+cursos asignados a un maestro (para el select del formulario)
// ──────────────────────────────────────────
export const getTeacherSubjects = async (req: Request, res: Response) => {
  try {
    const teacherId = parseInt(req.params.teacherId)

    const assignments = await prisma.teacherSubjectCourse.findMany({
      where: { teacherId },
      include: {
        subject: true,
        course: true,
      },
    })

    res.json(assignments)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Error al obtener materias del maestro' })
  }
}

// ──────────────────────────────────────────
// GET /notas/course-students/:courseId?year=2025
// Estudiantes inscritos en un curso para el año dado
// ──────────────────────────────────────────
export const getCourseStudents = async (req: Request, res: Response) => {
  try {
    const courseId = parseInt(req.params.courseId)
    const year = req.query.year ? parseInt(req.query.year as string) : new Date().getFullYear()

    const academicYear = await prisma.academicYear.findFirst({ where: { year } })
    if (!academicYear) {
      return res.status(404).json({ error: `No existe gestión para ${year}` })
    }

    const assignments = await prisma.studentAcademicAssignment.findMany({
      where: { courseId, academicYearId: academicYear.id },
      include: {
        student: { select: { id: true, firstName: true, lastName: true, kardex: true } },
      },
      orderBy: { student: { lastName: 'asc' } },
    })

    res.json(assignments.map((a) => a.student))
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Error al obtener estudiantes del curso' })
  }
}