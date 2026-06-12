// backend/src/controllers/credentials.controller.ts

import { Response } from 'express'
import { AuthRequest } from '../middlewares/auth.middleware'
import prisma from '../lib/prisma'
import bcrypt from 'bcryptjs'
import * as XLSX from 'xlsx'

const year = new Date().getFullYear()

const normalize = (str: string) =>
  str.toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z]/g, '')

const studentPwd = (lastName: string, rude?: string | null) =>
  rude?.trim() || `${normalize(lastName.split(' ')[0]).slice(0, 4)}${year}`

const parentPwd = (lastName: string, ci?: string | null) =>
  ci?.trim() || `${normalize(lastName.split(' ')[0]).slice(0, 4)}${year}`

const teacherPwd = (lastName: string, ci?: string | null) =>
  ci?.trim() || `${normalize(lastName.split(' ')[0]).slice(0, 4)}${year}`

const GRADE_ORDER: Record<string, number> = {
  PRIMERO:1, SEGUNDO:2, TERCERO:3, CUARTO:4, QUINTO:5, SEXTO:6,
}
const GRADE_LABEL: Record<string, string> = {
  PRIMERO:'1°', SEGUNDO:'2°', TERCERO:'3°', CUARTO:'4°', QUINTO:'5°', SEXTO:'6°',
}
const PARALLEL_ORDER: Record<string, number> = { A:1, B:2, C:3 }
const SHIFT_LABEL: Record<string, string> = {
  MORNING:'Mañana', AFTERNOON:'Tarde', NIGHT:'Noche',
}
const EXCLUDED = ['SUPER_ADMIN', 'DIRECTOR', 'REGENTE', 'SECRETARY']

export const resetCredentials = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
     console.log('Body recibido:', req.body)  // ← agrega aquí
    const { roles } = req.body as { roles: string[] | 'ALL' }
    const resetAll  = roles === 'ALL' || !roles

    const doStudents = resetAll || (Array.isArray(roles) && roles.includes('STUDENT'))
    const doParents  = resetAll || (Array.isArray(roles) && roles.includes('PARENT'))
    const doTeachers = resetAll || (Array.isArray(roles) && roles.includes('TEACHER'))

    const estudiantesData: any[] = []
    const padresData:      any[] = []
    const maestrosData:    any[] = []

    // ── ESTUDIANTES ──
    if (doStudents) {
      const students = await prisma.student.findMany({
        where: {
          isActive: true,
          userId:   { not: null },
          user:     { role: { notIn: EXCLUDED as any } },
        },
        include: {
          user: { select: { id: true, email: true } },
          assignments: {
            where:   { academicYear: { isActive: true } },
            include: { course: { select: { grade: true, parallel: true, level: true, shift: true } } },
            take:    1,
            orderBy: { createdAt: 'desc' },
          },
        },
      })

      students.sort((a, b) => {
        const cA = a.assignments[0]?.course
        const cB = b.assignments[0]?.course
        const gA = GRADE_ORDER[cA?.grade || ''] || 99
        const gB = GRADE_ORDER[cB?.grade || ''] || 99
        if (gA !== gB) return gA - gB
        const pA = PARALLEL_ORDER[cA?.parallel || ''] || 99
        const pB = PARALLEL_ORDER[cB?.parallel || ''] || 99
        if (pA !== pB) return pA - pB
        return a.lastName.localeCompare(b.lastName)
      })

      for (const s of students) {
        const pwd    = studentPwd(s.lastName, s.rude)
        const hashed = await bcrypt.hash(pwd, 10)
        await prisma.user.update({ where: { id: s.userId! }, data: { password: hashed } })
        const course = s.assignments[0]?.course
        estudiantesData.push({
          'Grado':      course ? GRADE_LABEL[course.grade] || course.grade : 'Sin curso',
          'Paralelo':   course?.parallel || '',
          'Turno':      course ? SHIFT_LABEL[course.shift] || course.shift : '',
          'Nivel':      course?.level || '',
          'Apellidos':  s.lastName,
          'Nombres':    s.firstName,
          'CI':         s.ci     || '',
          'RUDE':       s.rude   || '',
          'Kardex':     s.kardex || '',
          'Email':      s.user?.email || '',
          'Contraseña': pwd,
          'Hint':       s.rude ? 'RUDE' : `4 letras apellido + ${year}`,
        })
      }
    }

    // ── PADRES ──
    if (doParents) {
      const parents = await prisma.parent.findMany({
        where: {
          userId: { not: null },
          user:   { role: { notIn: EXCLUDED as any } },
        },
        include: {
          user: { select: { id: true, email: true } },
          students: {
            where:   { isTutor: true },
            include: {
              student: {
                select: {
                  firstName: true, lastName: true,
                  assignments: {
                    where:   { academicYear: { isActive: true } },
                    include: { course: { select: { grade: true, parallel: true, shift: true } } },
                    take:    1,
                    orderBy: { createdAt: 'desc' },
                  },
                },
              },
            },
            take: 5,
          },
        },
      })

      parents.sort((a, b) => {
        const cA = a.students[0]?.student?.assignments[0]?.course
        const cB = b.students[0]?.student?.assignments[0]?.course
        const gA = GRADE_ORDER[cA?.grade || ''] || 99
        const gB = GRADE_ORDER[cB?.grade || ''] || 99
        if (gA !== gB) return gA - gB
        const pA = PARALLEL_ORDER[cA?.parallel || ''] || 99
        const pB = PARALLEL_ORDER[cB?.parallel || ''] || 99
        if (pA !== pB) return pA - pB
        return a.lastName.localeCompare(b.lastName)
      })

      for (const p of parents) {
        const pwd    = parentPwd(p.lastName, p.ci)
        const hashed = await bcrypt.hash(pwd, 10)
        await prisma.user.update({ where: { id: p.userId! }, data: { password: hashed } })

        const hijos = p.students.map(ps => {
          const course = ps.student.assignments[0]?.course
          return `${ps.student.lastName} ${ps.student.firstName}${course ? ` (${GRADE_LABEL[course.grade] || course.grade} "${course.parallel}")` : ''}`
        }).join(' | ')

        const primerCurso = p.students[0]?.student?.assignments[0]?.course
        padresData.push({
          'Grado':         primerCurso ? GRADE_LABEL[primerCurso.grade] || primerCurso.grade : 'Sin curso',
          'Paralelo':      primerCurso?.parallel || '',
          'Apellidos':     p.lastName,
          'Nombres':       p.firstName,
          'CI':            p.ci    || '',
          'Teléfono':      p.phone || '',
          'Email':         p.user?.email || '',
          'Contraseña':    pwd,
          'Hint':          p.ci ? 'CI del tutor' : `4 letras apellido + ${year}`,
          'Estudiante(s)': hijos || '',
        })
      }
    }

    // ── MAESTROS ──
    if (doTeachers) {
      const teachers = await prisma.teacher.findMany({
        where: {
          isActive: true,
          user:     { role: { notIn: ['SUPER_ADMIN'] as any } },
        },
        include: {
          user: { select: { id: true, email: true } },
        },
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      })

      for (const t of teachers) {
        const pwd    = teacherPwd(t.lastName, t.ci)
        const hashed = await bcrypt.hash(pwd, 10)
        await prisma.user.update({ where: { id: t.userId }, data: { password: hashed } })
        maestrosData.push({
          'Apellidos':  t.lastName,
          'Nombres':    t.firstName,
          'CI':         t.ci    || '',
          'Teléfono':   t.phone || '',
          'Email':      t.user?.email || '',
          'Contraseña': pwd,
          'Hint':       t.ci ? 'CI del maestro' : `4 letras apellido + ${year}`,
        })
      }
    }

    // ── GENERAR EXCEL ──
    const wb = XLSX.utils.book_new()

    if (estudiantesData.length > 0) {
      const ws = XLSX.utils.json_to_sheet(estudiantesData)
      ws['!cols'] = [{wch:8},{wch:10},{wch:10},{wch:12},{wch:20},{wch:20},{wch:12},{wch:16},{wch:10},{wch:30},{wch:20},{wch:25}]
      XLSX.utils.book_append_sheet(wb, ws, 'Estudiantes')
    }
    if (padresData.length > 0) {
      const ws = XLSX.utils.json_to_sheet(padresData)
      ws['!cols'] = [{wch:8},{wch:10},{wch:20},{wch:20},{wch:12},{wch:14},{wch:30},{wch:20},{wch:25},{wch:50}]
      XLSX.utils.book_append_sheet(wb, ws, 'Padres')
    }
    if (maestrosData.length > 0) {
      const ws = XLSX.utils.json_to_sheet(maestrosData)
      ws['!cols'] = [{wch:20},{wch:20},{wch:12},{wch:14},{wch:30},{wch:20},{wch:25}]
      XLSX.utils.book_append_sheet(wb, ws, 'Maestros')
    }

    if (wb.SheetNames.length === 0) {
      res.status(400).json({ message: 'No se encontraron usuarios para resetear' })
      return
    }

    const buffer     = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
    const rolesLabel = roles === 'ALL' || !roles ? 'todos' : (roles as string[]).join('-').toLowerCase()

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', `attachment; filename=credenciales_${rolesLabel}_${year}.xlsx`)
    res.send(buffer)

  } catch (err) {
    console.error('resetCredentials error:', err)
    res.status(500).json({ message: 'Error al resetear credenciales' })
  }
}