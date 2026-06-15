import { Response } from 'express'
import bcrypt from 'bcryptjs'
import { AuthRequest } from '../middlewares/auth.middleware'
import prisma from '../lib/prisma'

// ─────────────────────────────────────────────
// Función: generar email único
// ─────────────────────────────────────────────
const generateEmail = async (firstName: string, lastName: string): Promise<string> => {
  const normalize = (str: string) =>
    str.toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, '.')
      .replace(/[^a-z0-9.]/g, '')

  const first = normalize(firstName.split(' ')[0])
  const last  = normalize(lastName.split(' ')[0])
  const base  = `${first}.${last}@nnuu.edu.bo`

  const existing = await prisma.user.findUnique({ where: { email: base } })
  if (!existing) return base

  let counter = 2
  while (true) {
    const candidate = `${first}.${last}${counter}@nnuu.edu.bo`
    const dup = await prisma.user.findUnique({ where: { email: candidate } })
    if (!dup) return candidate
    counter++
  }
}

// ─────────────────────────────────────────────
// Función: generar contraseña identificable
// maestro + últimos 4 dígitos CI + año
// Sin CI: maestro + primeras 4 letras apellido + año
// ─────────────────────────────────────────────
const generateTeacherPassword = (lastName: string, ci?: string): string => {
  const year = new Date().getFullYear()
  if (ci && ci.trim().length >= 4) {
    return `maestro${ci.trim().slice(-4)}${year}`
  }
  const normalize = (str: string) =>
    str.toUpperCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^A-Z]/g, '')
  const letters = normalize(lastName.split(' ')[0]).slice(0, 4)
  return `maestro${letters}${year}`
}

// ─────────────────────────────────────────────
// GET /api/teachers — Listar maestros
// ─────────────────────────────────────────────
export const getTeachers = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { search, isActive, subjectId, campo } = req.query

    const teachers = await prisma.teacher.findMany({
      where: {
        isActive: true,
        ...(isActive !== undefined ? { isActive: isActive === 'true' } : {}),
        ...(search ? {
          OR: [
            { firstName: { contains: search as string, mode: 'insensitive' } },
            { lastName:  { contains: search as string, mode: 'insensitive' } },
            { ci:        { contains: search as string, mode: 'insensitive' } },
            { specialty: { contains: search as string, mode: 'insensitive' } },
          ]
        } : {}),
        // Filtrar por materia específica O por campo del saber
        ...((subjectId || campo) ? {
          specialties: {
            some: {
              ...(subjectId ? { subjectId: parseInt(subjectId as string) } : {}),
              ...(campo && !subjectId ? {
                subject: { campo: campo as any }
              } : {}),
            }
          }
        } : {}),
      },
      include: {
        user: { select: { id: true, email: true, role: true, isActive: true } },
        assignments: {
          include: {
            subject: { select: { id: true, name: true, code: true } },
            course:  { select: { id: true, level: true, grade: true, parallel: true, shift: true } },
          },
          take: 5
        },
        _count: { select: { assignments: true } },
        // ← AGREGAR specialties
        specialties: {
          include: {
            subject: { select: { id: true, name: true, campo: true } }
          }
        }
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }]
    })

    res.json(teachers)
  } catch (error) {
    console.error('getTeachers error:', error)
    res.status(500).json({ message: 'Error al obtener maestros' })
  }
}

// ─────────────────────────────────────────────
// GET /api/teachers/:id
// ─────────────────────────────────────────────
export const getTeacherById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params

    const teacher = await prisma.teacher.findUnique({
      where: { id: parseInt(id) },
      include: {
        user: { select: { id: true, email: true, role: true, isActive: true } },
        assignments: {
          include: {
            subject:      { select: { id: true, name: true, code: true, campo: true } },
            
            course:       { select: { id: true, level: true, grade: true, parallel: true, shift: true, educationType: true } }, 
          }
        }
      }
    })

    if (!teacher) {
      res.status(404).json({ message: 'Maestro no encontrado' })
      return
    }

    res.json(teacher)
  } catch (error) {
    console.error('getTeacherById error:', error)
    res.status(500).json({ message: 'Error al obtener maestro' })
  }
}
// GET /api/teachers/:id/workload - carga de horas por semana y detalle de asignaciones para un maestro específico
export const getTeacherWorkloadById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const teacherId = parseInt(req.params.id);

    const teacher = await prisma.teacher.findUnique({
      where: { id: teacherId },
      include: {
        assignments: {
          include: {
            subject: {
              include: {
                gradeConfigs: true,
              },
            },
            course: true,
          },
        },
      },
    });

    if (!teacher) { res.status(404).json({ error: 'Maestro no encontrado' }); return }
    let totalHours = 0;

    const detail = teacher.assignments.map((a) => {
      const config = a.subject.gradeConfigs.find(
        (gc) => gc.grade === a.course.grade && gc.educationType === a.course.educationType
      );
      const hours = config?.hoursPerWeek ?? a.subject.hoursPerWeek;
      totalHours += hours;

      return {
        subjectId: a.subjectId,
        subjectName: a.subject.name,
        campo: a.subject.campo,
        courseId: a.courseId,
        courseLabel: `${a.course.grade} "${a.course.parallel}" ${a.course.shift === 'MORNING' ? 'Mañana' : 'Tarde'}`,
        grade: a.course.grade,
        parallel: a.course.parallel,
        shift: a.course.shift,
        educationType: a.course.educationType,
        hoursPerWeek: hours,
      };
    });

    res.json({
      teacher: {
        id: teacher.id,
        firstName: teacher.firstName,
        lastName: teacher.lastName,
        specialty: teacher.specialty,
      },
      totalHoursPerWeek: totalHours,
      assignments: detail,
    });
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener carga horaria' });
  }
};
// ─────────────────────────────────────────────
// POST /api/teachers — Crear maestro
// ─────────────────────────────────────────────
export const createTeacher = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
   const { firstName, lastName, ci, phone, email, specialty, birthDate, hoursLoad, gender } = req.body

    if (!firstName || !lastName) {
      res.status(400).json({ message: 'Nombre y apellido son requeridos' })
      return
    }

    // Verificar CI único
    if (ci) {
      const existingCI = await prisma.teacher.findUnique({ where: { ci } })
      if (existingCI) {
        res.status(409).json({ message: `Ya existe un maestro con el CI ${ci}` })
        return
      }
    }

    // Generar email
    let accessEmail: string
    if (email && email.trim() !== '') {
      const existing = await prisma.user.findUnique({ where: { email: email.trim() } })
      if (existing) {
        res.status(409).json({ message: `El correo ${email} ya está en uso` })
        return
      }
      accessEmail = email.trim()
    } else {
      accessEmail = await generateEmail(firstName, lastName)
    }

    // Generar contraseña identificable
    const defaultPassword = generateTeacherPassword(lastName, ci)
    const hashedPassword  = await bcrypt.hash(defaultPassword, 10)

    // Crear usuario
    const user = await prisma.user.create({
      data: { email: accessEmail, password: hashedPassword, role: 'TEACHER', isActive: true }
    })

    // Crear maestro
    const teacher = await prisma.teacher.create({
      data: {
        firstName,
        lastName,
        ci:        ci        || null,
        phone:     phone     || null,
        email:     email     || null,
        specialty: specialty || null,
        birthDate: birthDate ? new Date(birthDate) : null,
        hoursLoad: hoursLoad ? parseInt(hoursLoad) : null,
        gender:    gender    || null,
        isActive:  true,
        userId:    user.id,
      },  
      include: {
        user: { select: { id: true, email: true, role: true } }
      }
    })

    res.status(201).json({
      message:         'Maestro registrado correctamente',
      teacher,
      accessEmail,
      defaultPassword,
      passwordHint:    ci
        ? `Contraseña = maestro + últimos 4 dígitos del CI + año`
        : `Contraseña = maestro + primeras 4 letras del apellido + año`,
    })
  } catch (error) {
    console.error('createTeacher error:', error)
    res.status(500).json({ message: 'Error al registrar maestro' })
  }
}

// ─────────────────────────────────────────────
// PUT /api/teachers/:id — Actualizar
// ─────────────────────────────────────────────
export const updateTeacher = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params
    const { firstName, lastName, ci, phone, email, specialty, birthDate, hoursLoad, gender } = req.body

    const existing = await prisma.teacher.findUnique({ where: { id: parseInt(id) } })
    if (!existing) {
      res.status(404).json({ message: 'Maestro no encontrado' })
      return
    }

    if (ci && ci !== existing.ci) {
      const dup = await prisma.teacher.findUnique({ where: { ci } })
      if (dup) {
        res.status(409).json({ message: `Ya existe un maestro con el CI ${ci}` })
        return
      }
    }

    const teacher = await prisma.teacher.update({
      where: { id: parseInt(id) },
      data: {
        ...(firstName !== undefined ? { firstName }                  : {}),
        ...(lastName  !== undefined ? { lastName  }                  : {}),
        ...(ci        !== undefined ? { ci:        ci       || null } : {}),
        ...(phone     !== undefined ? { phone:     phone    || null } : {}),
        ...(email     !== undefined ? { email:     email    || null } : {}),
        ...(specialty !== undefined ? { specialty: specialty || null } : {}),
        ...(birthDate !== undefined ? { birthDate: birthDate ? new Date(birthDate) : null } : {}),
        ...(hoursLoad !== undefined ? { hoursLoad: hoursLoad ? parseInt(hoursLoad) : null }  : {}),
        ...(gender    !== undefined ? { gender:    gender    || null }                        : {}),
      },
      include: { user: { select: { id: true, email: true, role: true } } }
    })

    res.json({ message: 'Maestro actualizado correctamente', teacher })
  } catch (error) {
    console.error('updateTeacher error:', error)
    res.status(500).json({ message: 'Error al actualizar maestro' })
  }
}

// ─────────────────────────────────────────────
// PATCH /api/teachers/:id/toggle
// ─────────────────────────────────────────────
export const toggleTeacherStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params

    const teacher = await prisma.teacher.findUnique({
      where: { id: parseInt(id) },
      include: { user: true }
    })

    if (!teacher) {
      res.status(404).json({ message: 'Maestro no encontrado' })
      return
    }

    const newStatus = !teacher.isActive

    await prisma.teacher.update({ where: { id: parseInt(id) }, data: { isActive: newStatus } })

    if (teacher.userId) {
      await prisma.user.update({ where: { id: teacher.userId }, data: { isActive: newStatus } })
    }

    res.json({ message: newStatus ? 'Maestro activado' : 'Maestro desactivado' })
  } catch (error) {
    console.error('toggleTeacherStatus error:', error)
    res.status(500).json({ message: 'Error al cambiar estado' })
  }
}

// ─────────────────────────────────────────────
// DELETE /api/teachers/:id — Eliminar
// ─────────────────────────────────────────────
export const deleteTeacher = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params

    const teacher = await prisma.teacher.findUnique({
      where: { id: parseInt(id) },
      include: { _count: { select: { assignments: true } } }
    })

    if (!teacher) {
      res.status(404).json({ message: 'Maestro no encontrado' })
      return
    }

    if (teacher._count.assignments > 0) {
      res.status(400).json({
        message: `No se puede eliminar: tiene ${teacher._count.assignments} asignación(es) de materia. Desactívalo en su lugar.`
      })
      return
    }

    if (teacher.userId) {
      const savedUserId = teacher.userId
      await prisma.$executeRaw`UPDATE "Teacher" SET "userId" = NULL WHERE id = ${parseInt(id)}`
      await prisma.user.delete({ where: { id: savedUserId } })
    }

    await prisma.teacher.delete({ where: { id: parseInt(id) } })
    res.json({ message: 'Maestro eliminado correctamente' })
  } catch (error) {
    console.error('deleteTeacher error:', error)
    res.status(500).json({ message: 'Error al eliminar maestro' })
  }
}// GET /api/teachers/Mi Carga Horaria — Total de horas por semana y detalle de asignaciones
export const getTeacherWorkload = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
  const userId = req.userId;

    const teacher = await prisma.teacher.findUnique({
      where: { userId },
      include: {
        assignments: {
          include: {
            subject: {
              include: {
                gradeConfigs: true,
              },
            },
            course: true,
          },
        },
      },
    });

    if (!teacher) { res.status(404).json({ error: 'Maestro no encontrado' }); return }

    let totalHours = 0;

    const detail = teacher.assignments.map((a) => {
      const config = a.subject.gradeConfigs.find(
        (gc) => gc.grade === a.course.grade && gc.educationType === a.course.educationType
      );
      const hours = config?.hoursPerWeek ?? a.subject.hoursPerWeek;
      totalHours += hours;

      return {
        subjectId: a.subjectId,
        subjectName: a.subject.name,
        campo: a.subject.campo,
        courseId: a.courseId,
        courseLabel: `${a.course.grade} "${a.course.parallel}" ${a.course.shift === 'MORNING' ? 'Mañana' : 'Tarde'}`,
        grade: a.course.grade,
        parallel: a.course.parallel,
        shift: a.course.shift,
        educationType: a.course.educationType,
        hoursPerWeek: hours,
      };
    });

    res.json({ totalHoursPerWeek: totalHours, assignments: detail });
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener carga horaria' });
  }
};

// ─────────────────────────────────────────────
// GET /api/teachers/my-course — Curso asignado al maestro tutor
// ─────────────────────────────────────────────
export const getTeacherMyCourse = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId
    console.log('Buscando maestro con userId:', userId)
    const teacher = await prisma.teacher.findFirst({
      where: {
        OR: [
          { userId },
          { tutorUserId: userId }
        ]
      },
      include: {
        tutorCourse: {
          include: {
            course: {
              include: {
                tutor: {
                   include: {
                        teacher: { select: { id: true, firstName: true, lastName: true } }
                   }
              },
                assignments: {
                  where: { academicYear: { isActive: true } },
                  include: {
                    student: {
                      select: {
                        id: true, firstName: true, lastName: true,
                        ci: true, rude: true, isActive: true, gender: true,
                        parents: {
                          include: {
                            parent: {
                              select: {
                                id: true, firstName: true, lastName: true,
                                phone: true, ci: true,
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
                delegate: {
                  select: {
                    id: true, firstName: true, lastName: true, phone: true, ci: true
                  }
                },
                meetings: {
                  orderBy: { date: 'desc' },
                  take: 5,
                  include: {
                    attendances: {
                      include: {
                        parent: { select: { id: true, firstName: true, lastName: true } }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    })

    if (!teacher) {
      res.status(404).json({ message: 'Maestro no encontrado' })
      return
    }

    if (!teacher.tutorCourse) {
      res.status(404).json({ message: 'No tienes un curso asignado como tutor' })
      return
    }

    res.json(teacher.tutorCourse.course)
  } catch (error) {
    console.error('getTeacherMyCourse error:', error)
    res.status(500).json({ message: 'Error al obtener curso' })
  }
}

// ─────────────────────────────────────────────
// PATCH /api/teachers/:id/attendance-code
// Asignar o resetear código de asistencia
// ─────────────────────────────────────────────
export const setAttendanceCode = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id }   = req.params
    const { code } = req.body

    if (!code || code.trim().length < 3) {
      res.status(400).json({ message: 'El código debe tener al menos 3 caracteres' }); return
    }

    const codeUpper = code.trim().toUpperCase()

    // Verificar que no esté en uso por otro maestro
    const existing = await prisma.teacher.findFirst({
      where: { attendanceCode: codeUpper, NOT: { id: parseInt(id) } }
    })
    if (existing) {
      res.status(409).json({ message: `El código ${codeUpper} ya está en uso por otro maestro` }); return
    }

    const teacher = await prisma.teacher.update({
      where: { id: parseInt(id) },
      data:  { attendanceCode: codeUpper },
      select: { id: true, firstName: true, lastName: true, attendanceCode: true }
    })

    res.json({ message: 'Código asignado correctamente', teacher })
  } catch (error) {
    console.error('setAttendanceCode error:', error)
    res.status(500).json({ message: 'Error al asignar código' })
  }
}