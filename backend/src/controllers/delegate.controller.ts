import { Response } from 'express'
import { AuthRequest } from '../middlewares/auth.middleware'
import prisma from '../lib/prisma'
import bcrypt from 'bcryptjs'

// ─────────────────────────────────────────────
// GET /api/delegates — Listar cursos con su delegado
// ─────────────────────────────────────────────
export const getDelegates = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const courses = await prisma.course.findMany({
      include: {
        delegate: {
          select: {
            id: true, firstName: true, lastName: true, ci: true, phone: true,
            delegateUserId: true,
            delegateUser: { select: { id: true, email: true, role: true, isActive: true } },
            user: { select: { id: true, email: true, role: true, isActive: true } },
            students: {
              include: {
                student: { select: { id: true, firstName: true, lastName: true } }
              }
            }
          }
        },
        tutor: {
          include: {
            teacher: { select: { id: true, firstName: true, lastName: true } }
          }
        },
        _count: { select: { assignments: true } }
      },
      orderBy: [{ level: 'asc' }, { grade: 'asc' }, { parallel: 'asc' }]
    })

    res.json(courses)
  } catch (error) {
    console.error('getDelegates error:', error)
    res.status(500).json({ message: 'Error al obtener delegados' })
  }
}

// ─────────────────────────────────────────────
// GET /api/delegates/course/:courseId/eligible-parents
// ─────────────────────────────────────────────
export const getEligibleParents = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { courseId } = req.params

    const activeYear = await prisma.academicYear.findFirst({ where: { isActive: true } })
    if (!activeYear) {
      res.status(404).json({ message: 'No hay gestión académica activa' })
      return
    }

    const assignments = await prisma.studentAcademicAssignment.findMany({
      where: { courseId: parseInt(courseId), academicYearId: activeYear.id },
      include: {
        student: {
          include: {
            parents: {
              include: {
                parent: {
                  select: {
                    id: true, firstName: true, lastName: true, ci: true, phone: true,
                    delegateUserId: true,
                    delegateUser: { select: { id: true, email: true, role: true } },
                    user: { select: { id: true, email: true, role: true } }
                  }
                }
              }
            }
          }
        }
      }
    })

    const parentsMap = new Map()
    for (const assignment of assignments) {
      for (const ps of assignment.student.parents) {
        if (ps.isTutor && !parentsMap.has(ps.parent.id)) {
          parentsMap.set(ps.parent.id, {
            ...ps.parent,
            relationType: ps.relationType,
            studentName: `${assignment.student.lastName} ${assignment.student.firstName}`
          })
        }
      }
    }

    res.json(Array.from(parentsMap.values()))
  } catch (error) {
    console.error('getEligibleParents error:', error)
    res.status(500).json({ message: 'Error al obtener padres elegibles' })
  }
}

// ─────────────────────────────────────────────
// POST /api/delegates/course/:courseId/assign
// ─────────────────────────────────────────────
export const assignDelegate = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { courseId } = req.params
    const { parentId } = req.body

    if (!parentId) {
      res.status(400).json({ message: 'El ID del padre es requerido' })
      return
    }

    const course = await prisma.course.findUnique({ where: { id: parseInt(courseId) } })
    if (!course) {
      res.status(404).json({ message: 'Curso no encontrado' })
      return
    }

    const parent = await prisma.parent.findUnique({
      where: { id: parseInt(parentId) },
    })
    if (!parent) {
      res.status(404).json({ message: 'Padre no encontrado' })
      return
    }

    const activeYear = await prisma.academicYear.findFirst({ where: { isActive: true } })
    if (!activeYear) {
      res.status(404).json({ message: 'No hay gestión académica activa' })
      return
    }

    const hasStudentInCourse = await prisma.studentAcademicAssignment.findFirst({
      where: {
        courseId:       parseInt(courseId),
        academicYearId: activeYear.id,
        student: {
          parents: { some: { parentId: parseInt(parentId) } }
        }
      }
    })

    if (!hasStudentInCourse) {
      res.status(400).json({ message: 'El padre no tiene estudiantes en este curso' })
      return
    }

    // Verificar si ya tiene usuario delegado para este curso
    if (parent.delegateUserId) {
      res.status(409).json({ message: 'Este padre ya tiene un usuario delegado creado' })
      return
    }

    // Crear usuario delegado nuevo separado
    const gradeMap: Record<string, string> = {
      PRIMERO: '1', SEGUNDO: '2', TERCERO: '3',
      CUARTO: '4', QUINTO: '5', SEXTO: '6'
    }
    const gradeNum  = gradeMap[course.grade] || course.grade.toLowerCase()
    const parallel  = course.parallel.toLowerCase()
    let delegateEmail = `delegado.${gradeNum}${parallel}@nnuu.edu.bo`
    let counter = 2
    while (await prisma.user.findUnique({ where: { email: delegateEmail } })) {
      delegateEmail = `delegado.${gradeNum}${parallel}${counter}@nnuu.edu.bo`
      counter++
    }

    const rawPassword = `delegado${new Date().getFullYear()}`
    const hashed      = await bcrypt.hash(rawPassword, 10)

    const delegateUser = await prisma.user.create({
      data: { email: delegateEmail, password: hashed, role: 'DELEGATE', isActive: true }
    })

    // Vincular usuario delegado al padre
    await prisma.parent.update({
      where: { id: parseInt(parentId) },
      data:  { delegateUserId: delegateUser.id }
    })

    // Asignar delegado al curso
    const updatedCourse = await prisma.course.update({
      where: { id: parseInt(courseId) },
      data:  { delegateId: parseInt(parentId) },
      include: {
        delegate: { select: { id: true, firstName: true, lastName: true } }
      }
    })

    res.json({
      message:         `${parent.lastName} ${parent.firstName} asignado como delegado del curso`,
      course:          updatedCourse,
      accessEmail:     delegateEmail,
      defaultPassword: rawPassword,
      delegateName:    `${parent.lastName} ${parent.firstName}`,
    })
  } catch (error) {
    console.error('assignDelegate error:', error)
    res.status(500).json({ message: 'Error al asignar delegado' })
  }
}

// ─────────────────────────────────────────────
// DELETE /api/delegates/course/:courseId/remove
// ─────────────────────────────────────────────
export const removeDelegate = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { courseId } = req.params

    const course = await prisma.course.findUnique({
      where:   { id: parseInt(courseId) },
      include: { delegate: true }
    })

    if (!course) {
      res.status(404).json({ message: 'Curso no encontrado' })
      return
    }

    if (!course.delegateId) {
      res.status(400).json({ message: 'Este curso no tiene delegado asignado' })
      return
    }

    // Eliminar usuario delegado si existe
    if (course.delegate?.delegateUserId) {
      await prisma.parent.update({
        where: { id: course.delegate.id },
        data:  { delegateUserId: null }
      })
      await prisma.user.delete({
        where: { id: course.delegate.delegateUserId }
      })
    }

    // Quitar delegado del curso
    await prisma.course.update({
      where: { id: parseInt(courseId) },
      data:  { delegateId: null }
    })

    res.json({ message: 'Delegado removido correctamente' })
  } catch (error) {
    console.error('removeDelegate error:', error)
    res.status(500).json({ message: 'Error al remover delegado' })
  }
}

// ─────────────────────────────────────────────
// GET /api/delegates/my-course
// ─────────────────────────────────────────────
export const getMyCourse = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId

    // Buscar por delegateUserId (usuario delegado separado)
    const parent = await prisma.parent.findFirst({
      where: { delegateUserId: userId },
      include: {
        delegateCourse: {
          include: {
            assignments: {
              where: { academicYear: { isActive: true } },
              include: {
                student: {
                  select: {
                    id: true, firstName: true, lastName: true, ci: true, rude: true, isActive: true,
                    parents: {
                      include: {
                        parent: {
                          select: {
                            id: true, firstName: true, lastName: true, phone: true,
                            charges: {
                              where: { status: { not: 'ANULADO' } },
                              select: { amount: true, paidAmount: true, status: true }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            },
            tutor: {
              include: {
                teacher: { select: { firstName: true, lastName: true } }
              }
            }
          }
        }
      }
    })

    if (!parent || !parent.delegateCourse) {
      res.status(404).json({ message: 'No tienes un curso asignado como delegado' })
      return
    }

    res.json(parent.delegateCourse)
  } catch (error) {
    console.error('getMyCourse error:', error)
    res.status(500).json({ message: 'Error al obtener curso' })
  }
}