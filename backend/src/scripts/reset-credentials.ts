// ─────────────────────────────────────────────────────────────
// Script: reset-credentials.ts
// Uso: npx ts-node src/scripts/reset-credentials.ts
// Resetea contraseñas de estudiantes y padres, exporta Excel
// ─────────────────────────────────────────────────────────────

import prisma from '../lib/prisma'
import bcrypt from 'bcryptjs'
import * as XLSX from 'xlsx'
import * as path from 'path'
import * as fs from 'fs'

const year = new Date().getFullYear()

const normalize = (str: string) =>
  str.toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z]/g, '')

const studentPassword = (lastName: string, rude?: string | null): string => {
  if (rude && rude.trim()) return rude.trim()
  return `${normalize(lastName.split(' ')[0]).slice(0, 4)}${year}`
}

const parentPassword = (lastName: string, ci?: string | null): string => {
  if (ci && ci.trim()) return ci.trim()
  return `${normalize(lastName.split(' ')[0]).slice(0, 4)}${year}`
}

const GRADE: Record<string, string> = {
  PRIMERO:'1°', SEGUNDO:'2°', TERCERO:'3°', CUARTO:'4°', QUINTO:'5°', SEXTO:'6°',
}
const SHIFT: Record<string, string> = {
  MORNING:'Mañana', AFTERNOON:'Tarde', NIGHT:'Noche',
}

async function main() {
  console.log('🔄 Iniciando reset de credenciales...\n')

  const estudiantesData: any[] = []
  const padresData:      any[] = []

  // ────────────────────────────────
  // ESTUDIANTES (excluye SUPER_ADMIN)
  // ────────────────────────────────
  console.log('📚 Procesando estudiantes...')

  const students = await prisma.student.findMany({
    where: {
      isActive: true,
      userId:   { not: null },
      user:     { role: { notIn: ['SUPER_ADMIN', 'DIRECTOR', 'REGENTE', 'SECRETARY'] } },
    },
    include: {
      user: { select: { id: true, email: true, role: true } },
      assignments: {
        where:   { academicYear: { isActive: true } },
        include: { course: { select: { grade: true, parallel: true, level: true, shift: true } } },
        take:    1,
        orderBy: { createdAt: 'desc' },
      },
    },
    orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
  })

  let stuOk = 0, stuErr = 0

  for (const s of students) {
    try {
      const pwd    = studentPassword(s.lastName, s.rude)
      const hashed = await bcrypt.hash(pwd, 10)

      await prisma.user.update({
        where: { id: s.userId! },
        data:  { password: hashed },
      })

      const course = s.assignments[0]?.course
      estudiantesData.push({
        'Apellidos':       s.lastName,
        'Nombres':         s.firstName,
        'CI':              s.ci     || '',
        'RUDE':            s.rude   || '',
        'Kardex':          s.kardex || '',
        'Curso':           course ? `${GRADE[course.grade] || course.grade} "${course.parallel}"` : '',
        'Nivel':           course?.level || '',
        'Turno':           course ? SHIFT[course.shift] || course.shift : '',
        'Email':           s.user?.email || '',
        'Contraseña':      pwd,
        'Hint':            s.rude ? 'RUDE del estudiante' : `4 letras apellido + ${year}`,
      })
      stuOk++
    } catch (err) {
      console.error(`  ❌ Error con ${s.lastName} ${s.firstName}:`, err)
      stuErr++
    }
  }

  console.log(`  ✅ ${stuOk} estudiantes reseteados, ${stuErr} errores\n`)

  // ────────────────────────────────
  // PADRES (excluye SUPER_ADMIN)
  // ────────────────────────────────
  console.log('👨‍👩‍👧 Procesando padres...')

  const parents = await prisma.parent.findMany({
    where: {
      userId: { not: null },
      user:   { role: { notIn: ['SUPER_ADMIN', 'DIRECTOR', 'REGENTE', 'SECRETARY'] } },
    },
    include: {
      user: { select: { id: true, email: true, role: true } },
      students: {
        where:   { isTutor: true },
        include: {
          student: {
            select: {
              firstName: true, lastName: true,
              assignments: {
                where:   { academicYear: { isActive: true } },
                include: { course: { select: { grade: true, parallel: true } } },
                take:    1,
                orderBy: { createdAt: 'desc' },
              },
            },
          },
        },
        take: 5,
      },
    },
    orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
  })

  let parOk = 0, parErr = 0

  for (const p of parents) {
    try {
      const pwd    = parentPassword(p.lastName, p.ci)
      const hashed = await bcrypt.hash(pwd, 10)

      await prisma.user.update({
        where: { id: p.userId! },
        data:  { password: hashed },
      })

      const hijos = p.students.map(ps => {
        const course = ps.student.assignments[0]?.course
        return `${ps.student.lastName} ${ps.student.firstName}${course ? ` (${GRADE[course.grade] || course.grade} "${course.parallel}")` : ''}`
      }).join(' | ')

      padresData.push({
        'Apellidos':  p.lastName,
        'Nombres':    p.firstName,
        'CI':         p.ci    || '',
        'Teléfono':   p.phone || '',
        'Email':      p.user?.email || '',
        'Contraseña': pwd,
        'Hint':       p.ci ? 'CI del tutor' : `4 letras apellido + ${year}`,
        'Estudiante(s)': hijos || '',
      })
      parOk++
    } catch (err) {
      console.error(`  ❌ Error con ${p.lastName} ${p.firstName}:`, err)
      parErr++
    }
  }

  console.log(`  ✅ ${parOk} padres reseteados, ${parErr} errores\n`)

  // ────────────────────────────────
  // MAESTROS (excluye SUPER_ADMIN)
  // ────────────────────────────────
  console.log('👨‍🏫 Procesando maestros...')

  const maestrosData: any[] = []

  const teachers = await prisma.teacher.findMany({
    where: {
      isActive: true,
      userId:   { not: null },
      user:     { role: { notIn: ['SUPER_ADMIN'] } },
    },
    include: {
      user: { select: { id: true, email: true, role: true } },
    },
    orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
  })

  let teaOk = 0, teaErr = 0

  for (const t of teachers) {
    try {
      // Contraseña: CI si tiene, sino 4 letras apellido + año
      const pwd    = t.ci && t.ci.trim()
        ? t.ci.trim()
        : `${normalize(t.lastName.split(' ')[0]).slice(0, 4)}${year}`
      const hashed = await bcrypt.hash(pwd, 10)

      await prisma.user.update({
        where: { id: t.userId },
        data:  { password: hashed },
      })

      maestrosData.push({
        'Apellidos':  t.lastName,
        'Nombres':    t.firstName,
        'CI':         t.ci    || '',
        'Teléfono':   t.phone || '',
        'Email':      t.user?.email || '',
        'Contraseña': pwd,
        'Hint':       t.ci ? 'CI del maestro' : `4 letras apellido + ${year}`,
      })
      teaOk++
    } catch (err) {
      console.error(`  ❌ Error con ${t.lastName} ${t.firstName}:`, err)
      teaErr++
    }
  }

  console.log(`  ✅ ${teaOk} maestros reseteados, ${teaErr} errores\n`)

  // ────────────────────────────────
  // EXPORTAR EXCEL
  // ────────────────────────────────
  console.log('📊 Generando Excel...')

  const wb = XLSX.utils.book_new()

  const wsEstu = XLSX.utils.json_to_sheet(estudiantesData)
  wsEstu['!cols'] = [
    {wch:20},{wch:20},{wch:12},{wch:16},{wch:10},
    {wch:10},{wch:12},{wch:10},{wch:30},{wch:20},{wch:25},
  ]
  XLSX.utils.book_append_sheet(wb, wsEstu, 'Estudiantes')

  const wsPad = XLSX.utils.json_to_sheet(padresData)
  wsPad['!cols'] = [
    {wch:20},{wch:20},{wch:12},{wch:14},{wch:30},{wch:20},{wch:25},{wch:50},
  ]
  XLSX.utils.book_append_sheet(wb, wsPad, 'Padres')

  const wsTea = XLSX.utils.json_to_sheet(maestrosData)
  wsTea['!cols'] = [
    {wch:20},{wch:20},{wch:12},{wch:14},{wch:30},{wch:20},{wch:25},
  ]
  XLSX.utils.book_append_sheet(wb, wsTea, 'Maestros')

  const outputDir  = path.join(__dirname, '../../exports')
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true })

  const fileName   = `credenciales_${year}_${Date.now()}.xlsx`
  const outputPath = path.join(outputDir, fileName)
  XLSX.writeFile(wb, outputPath)

  console.log(`\n✅ Excel generado: exports/${fileName}`)
  console.log(`   📚 Estudiantes: ${stuOk}`)
  console.log(`   👨‍👩‍👧 Padres:       ${parOk}`)
  console.log(`   👨‍🏫 Maestros:     ${teaOk}`)
  console.log('\n🎉 Reset completado!')

  await prisma.$disconnect()
}

main().catch(async err => {
  console.error('Error fatal:', err)
  await prisma.$disconnect()
  process.exit(1)
})