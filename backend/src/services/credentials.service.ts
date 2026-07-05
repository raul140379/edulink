import bcrypt from 'bcryptjs'
import * as XLSX from 'xlsx'
import { credentialsRepository } from '../repositories/credentials.repository'
import { HttpError } from '../utils/http-error'
import { ResetCredentialsInput } from '../schemas/credentials.schema'

const year = new Date().getFullYear()

const normalize = (str: string) =>
  str.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Z]/g, '')

const defaultPwd = (lastName: string, ci?: string | null) =>
  ci?.trim() || `${normalize(lastName.split(' ')[0]).slice(0, 4)}${year}`

const studentPwd = (lastName: string, rude?: string | null) =>
  rude?.trim() || `${normalize(lastName.split(' ')[0]).slice(0, 4)}${year}`

const GRADE_ORDER: Record<string, number> = { PRIMERO: 1, SEGUNDO: 2, TERCERO: 3, CUARTO: 4, QUINTO: 5, SEXTO: 6 }
const GRADE_LABEL: Record<string, string> = { PRIMERO: '1°', SEGUNDO: '2°', TERCERO: '3°', CUARTO: '4°', QUINTO: '5°', SEXTO: '6°' }
const PARALLEL_ORDER: Record<string, number> = { A: 1, B: 2, C: 3 }
const SHIFT_LABEL: Record<string, string> = { MORNING: 'Mañana', AFTERNOON: 'Tarde', NIGHT: 'Noche' }

export const credentialsService = {
  async resetCredentials(input: ResetCredentialsInput) {
    const roles = input.roles
    const resetAll = roles === 'ALL' || !roles

    const doStudents  = resetAll || (Array.isArray(roles) && roles.includes('STUDENT'))
    const doParents   = resetAll || (Array.isArray(roles) && roles.includes('PARENT'))
    const doTeachers  = resetAll || (Array.isArray(roles) && roles.includes('TEACHER'))
    const doSecretary = resetAll || (Array.isArray(roles) && roles.includes('SECRETARY'))
    const doRegente   = resetAll || (Array.isArray(roles) && roles.includes('REGENTE'))
    const doDelegate  = resetAll || (Array.isArray(roles) && roles.includes('DELEGATE'))
    const doStaff     = resetAll || (Array.isArray(roles) && roles.includes('STAFF'))

    const estudiantesData: any[] = []
    const padresData: any[] = []
    const maestrosData: any[] = []
    const otrosData: any[] = []

    // ── ESTUDIANTES ──
    if (doStudents) {
      const students = await credentialsRepository.findActiveStudentsForReset()

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
        const pwd = studentPwd(s.lastName, s.rude)
        const hashed = await bcrypt.hash(pwd, 10)
        await credentialsRepository.updateUserPassword(s.userId!, hashed)
        const course = s.assignments[0]?.course
        estudiantesData.push({
          'Grado': course ? GRADE_LABEL[course.grade] || course.grade : 'Sin curso',
          'Paralelo': course?.parallel || '',
          'Turno': course ? SHIFT_LABEL[course.shift] || course.shift : '',
          'Nivel': course?.level || '',
          'Apellidos': s.lastName,
          'Nombres': s.firstName,
          'CI': s.ci || '',
          'RUDE': s.rude || '',
          'Kardex': s.kardex || '',
          'Email': s.user?.email || '',
          'Contraseña': pwd,
          'Hint': s.rude ? 'RUDE' : `4 letras apellido + ${year}`,
        })
      }
    }

    // ── PADRES ──
    if (doParents) {
      const parents = await credentialsRepository.findParentsForReset()

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
        const pwd = defaultPwd(p.lastName, p.ci)
        const hashed = await bcrypt.hash(pwd, 10)
        await credentialsRepository.updateUserPassword(p.userId!, hashed)
        const hijos = p.students.map((ps) => {
          const course = ps.student.assignments[0]?.course
          return `${ps.student.lastName} ${ps.student.firstName}${course ? ` (${GRADE_LABEL[course.grade] || course.grade} "${course.parallel}")` : ''}`
        }).join(' | ')
        const primerCurso = p.students[0]?.student?.assignments[0]?.course
        padresData.push({
          'Grado': primerCurso ? GRADE_LABEL[primerCurso.grade] || primerCurso.grade : 'Sin curso',
          'Paralelo': primerCurso?.parallel || '',
          'Apellidos': p.lastName,
          'Nombres': p.firstName,
          'CI': p.ci || '',
          'Teléfono': p.phone || '',
          'Email': p.user?.email || '',
          'Contraseña': pwd,
          'Hint': p.ci ? 'CI del tutor' : `4 letras apellido + ${year}`,
          'Estudiante(s)': hijos || '',
        })
      }
    }

    // ── MAESTROS ──
    if (doTeachers) {
      const teachers = await credentialsRepository.findActiveTeachersForReset()
      const processedUserIds = new Set<number>()

      for (const t of teachers) {
        if (t.userId && !processedUserIds.has(t.userId)) {
          const pwd = defaultPwd(t.lastName, t.ci)
          const hashed = await bcrypt.hash(pwd, 10)
          await credentialsRepository.updateUserPassword(t.userId, hashed)
          processedUserIds.add(t.userId)
          maestrosData.push({
            'Rol': 'Maestro',
            'Apellidos': t.lastName,
            'Nombres': t.firstName,
            'CI': t.ci || '',
            'Teléfono': t.phone || '',
            'Email': t.user?.email || '',
            'Contraseña': pwd,
            'Hint': t.ci ? 'CI del maestro' : `4 letras apellido + ${year}`,
          })
        }

        if (t.tutorUserId && t.tutorUser && !processedUserIds.has(t.tutorUserId)) {
          const pwd = defaultPwd(t.lastName, t.ci)
          const hashed = await bcrypt.hash(pwd, 10)
          await credentialsRepository.updateUserPassword(t.tutorUserId, hashed)
          processedUserIds.add(t.tutorUserId)
          maestrosData.push({
            'Rol': 'Maestro Tutor',
            'Apellidos': t.lastName,
            'Nombres': t.firstName,
            'CI': t.ci || '',
            'Teléfono': t.phone || '',
            'Email': t.tutorUser.email || '',
            'Contraseña': pwd,
            'Hint': t.ci ? 'CI del maestro' : `4 letras apellido + ${year}`,
          })
        }
      }
    }

    // ── OTROS ROLES (Secretaria, Regente, Delegado, Staff) ──
    const otherRoles: string[] = []
    if (doSecretary) otherRoles.push('SECRETARY')
    if (doRegente) otherRoles.push('REGENTE')
    if (doDelegate) otherRoles.push('DELEGATE')
    if (doStaff) otherRoles.push('STAFF')

    if (otherRoles.length > 0) {
      const otherUsers = await credentialsRepository.findOtherRoleUsersForReset(otherRoles)

      const ROLE_LABEL: Record<string, string> = { SECRETARY: 'Secretaria', REGENTE: 'Regente', DELEGATE: 'Delegado', STAFF: 'Personal' }

      for (const u of otherUsers) {
        const profile = u.parent || (u as any).parentDelegate || u.staff
        const lastName = (profile as any)?.lastName || u.email.split('@')[0]
        const firstName = (profile as any)?.firstName || ''
        const ci = (profile as any)?.ci || null
        const phone = (profile as any)?.phone || ''

        const pwd = defaultPwd(lastName, ci)
        const hashed = await bcrypt.hash(pwd, 10)
        await credentialsRepository.updateUserPassword(u.id, hashed)

        otrosData.push({
          'Rol': ROLE_LABEL[u.role] || u.role,
          'Apellidos': lastName,
          'Nombres': firstName,
          'CI': ci || '',
          'Teléfono': phone || '',
          'Email': u.email,
          'Contraseña': pwd,
          'Hint': ci ? 'CI del usuario' : `4 letras apellido + ${year}`,
        })
      }
    }

    // ── GENERAR EXCEL ──
    const wb = XLSX.utils.book_new()

    if (estudiantesData.length > 0) {
      const ws = XLSX.utils.json_to_sheet(estudiantesData)
      ws['!cols'] = [{ wch: 8 }, { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 20 }, { wch: 20 }, { wch: 12 }, { wch: 16 }, { wch: 10 }, { wch: 30 }, { wch: 20 }, { wch: 25 }]
      XLSX.utils.book_append_sheet(wb, ws, 'Estudiantes')
    }
    if (padresData.length > 0) {
      const ws = XLSX.utils.json_to_sheet(padresData)
      ws['!cols'] = [{ wch: 8 }, { wch: 10 }, { wch: 20 }, { wch: 20 }, { wch: 12 }, { wch: 14 }, { wch: 30 }, { wch: 20 }, { wch: 25 }, { wch: 50 }]
      XLSX.utils.book_append_sheet(wb, ws, 'Padres')
    }
    if (maestrosData.length > 0) {
      const ws = XLSX.utils.json_to_sheet(maestrosData)
      ws['!cols'] = [{ wch: 14 }, { wch: 20 }, { wch: 20 }, { wch: 12 }, { wch: 14 }, { wch: 30 }, { wch: 20 }, { wch: 25 }]
      XLSX.utils.book_append_sheet(wb, ws, 'Maestros')
    }
    if (otrosData.length > 0) {
      const ws = XLSX.utils.json_to_sheet(otrosData)
      ws['!cols'] = [{ wch: 14 }, { wch: 20 }, { wch: 20 }, { wch: 12 }, { wch: 14 }, { wch: 30 }, { wch: 20 }, { wch: 25 }]
      XLSX.utils.book_append_sheet(wb, ws, 'Otros')
    }

    if (wb.SheetNames.length === 0) throw new HttpError(400, 'No se encontraron usuarios para resetear')

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
    const rolesLabel = resetAll ? 'todos' : (roles as string[]).join('-').toLowerCase()
    const filename = `credenciales_${rolesLabel}_${year}.xlsx`

    return { buffer, filename }
  },
}
