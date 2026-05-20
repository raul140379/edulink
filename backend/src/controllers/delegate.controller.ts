import { Response } from 'express'
import { AuthRequest } from '../middlewares/auth.middleware'
import prisma from '../lib/prisma'

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
// Padres elegibles para ser delegados de un curso
// ─────────────────────────────────────────────
export const getEligibleParents = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { courseId } = req.params

    // Obtener la gestión activa
    const activeYear = await prisma.academicYear.findFirst({ where: { isActive: true } })
    if (!activeYear) {
      res.status(404).json({ message: 'No hay gestión académica activa' })
      return
    }

    // Obtener estudiantes inscritos en este curso en la gestión activa
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
                    user: { select: { id: true, email: true, role: true } }
                  }
                }
              }
            }
          }
        }
      }
    })

    // Extraer padres únicos de los estudiantes del curso
    const parentsMap = new Map()
    for (const assignment of assignments) {
      for (const ps of assignment.student.parents) {
        if (!parentsMap.has(ps.parent.id)) {
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
// Asignar delegado a un curso
// ─────────────────────────────────────────────
export const assignDelegate = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { courseId } = req.params
    const { parentId } = req.body

    if (!parentId) {
      res.status(400).json({ message: 'El ID del padre es requerido' })
      return
    }

    // Verificar que el curso existe
    const course = await prisma.course.findUnique({ where: { id: parseInt(courseId) } })
    if (!course) {
      res.status(404).json({ message: 'Curso no encontrado' })
      return
    }

    // Verificar que el padre existe
    const parent = await prisma.parent.findUnique({
      where: { id: parseInt(parentId) },
      include: { user: true }
    })
    if (!parent) {
      res.status(404).json({ message: 'Padre no encontrado' })
      return
    }

    // Verificar que el padre tiene un hijo en este curso
    const activeYear = await prisma.academicYear.findFirst({ where: { isActive: true } })
    if (!activeYear) {
      res.status(404).json({ message: 'No hay gestión académica activa' })
      return
    }

    const hasStudentInCourse = await prisma.studentAcademicAssignment.findFirst({
      where: {
        courseId:      parseInt(courseId),
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

    // Si el padre ya tiene un usuario con rol DELEGATE, actualizar
    // Si no tiene usuario, crear uno
    let userId = parent.userId

    if (!userId) {
      // Crear usuario para el padre con rol DELEGATE
      const email    = parent.email || `delegado.${parent.lastName.toLowerCase()}.${parent.firstName.toLowerCase()}@nnuu.edu.bo`
      const bcrypt   = require('bcryptjs')
      const password = await bcrypt.hash(`delegado${new Date().getFullYear()}`, 10)

      const newUser = await prisma.user.create({
        data: { email, password, role: 'DELEGATE', isActive: true }
      })

      // Vincular usuario al padre
      await prisma.parent.update({
        where: { id: parseInt(parentId) },
        data:  { userId: newUser.id }
      })

      userId = newUser.id
    } else {
      // Actualizar rol del usuario existente a DELEGATE
      await prisma.user.update({
        where: { id: userId },
        data:  { role: 'DELEGATE' }
      })
    }

    // Asignar delegado al curso
    const updatedCourse = await prisma.course.update({
      where: { id: parseInt(courseId) },
      data:  { delegateId: parseInt(parentId) },
      include: {
        delegate: { select: { id: true, firstName: true, lastName: true } }
      }
    })

    res.json({
      message:  `${parent.firstName} ${parent.lastName} asignado como delegado del curso`,
      course:   updatedCourse,
    })
  } catch (error) {
    console.error('assignDelegate error:', error)
    res.status(500).json({ message: 'Error al asignar delegado' })
  }
}

// ─────────────────────────────────────────────
// DELETE /api/delegates/course/:courseId/remove
// Quitar delegado de un curso
// ─────────────────────────────────────────────
export const removeDelegate = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { courseId } = req.params

    const course = await prisma.course.findUnique({
      where:   { id: parseInt(courseId) },
      include: { delegate: { include: { user: true } } }
    })

    if (!course) {
      res.status(404).json({ message: 'Curso no encontrado' })
      return
    }

    if (!course.delegateId) {
      res.status(400).json({ message: 'Este curso no tiene delegado asignado' })
      return
    }

    // Quitar delegado del curso
    await prisma.course.update({
      where: { id: parseInt(courseId) },
      data:  { delegateId: null }
    })

    // Cambiar rol del usuario de DELEGATE a PARENT
    if (course.delegate?.user) {
      await prisma.user.update({
        where: { id: course.delegate.user.id },
        data:  { role: 'PARENT' }
      })
    }

    res.json({ message: 'Delegado removido correctamente' })
  } catch (error) {
    console.error('removeDelegate error:', error)
    res.status(500).json({ message: 'Error al remover delegado' })
  }
}

// ─────────────────────────────────────────────
// GET /api/delegates/my-course
// Obtener el curso asignado al delegado logueado
// ─────────────────────────────────────────────
export const getMyCourse = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId

    // Obtener el padre vinculado a este usuario
    const parent = await prisma.parent.findUnique({
      where: { userId },
      include: {
        delegateCourse: {
          include: {
            assignments: {
              where: {
                academicYear: { isActive: true }
              },
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