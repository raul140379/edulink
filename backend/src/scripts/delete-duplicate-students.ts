// ─────────────────────────────────────────────────────────────
// Script: delete-duplicate-students.ts
// Uso: npx ts-node src/scripts/delete-duplicate-students.ts
// Detecta estudiantes duplicados por nombre+apellido
// Conserva el que tenga más datos completos
// Elimina el duplicado con todas sus relaciones
// ─────────────────────────────────────────────────────────────

import prisma from '../lib/prisma'

// Puntaje de completitud — más campos = más puntaje
const scoreStudent = (s: any): number => {
  let score = 0
  if (s.rude)      score += 3  // RUDE es el más importante
  if (s.ci)        score += 2
  if (s.kardex)    score += 2
  if (s.birthDate) score += 1
  if (s.phone)     score += 1
  if (s.email)     score += 1
  if (s.address)   score += 1
  if (s.userId)    score += 2  // tiene usuario creado
  if (s.isActive)  score += 1
  return score
}

const normalize = (str: string) =>
  str.trim().toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')

async function deleteStudent(id: number, name: string) {
  console.log(`     🗑️  Eliminando: ${name} (id: ${id})`)

  const student = await prisma.student.findUnique({ where: { id }, select: { userId: true } })

  await prisma.taskSubmission.deleteMany({ where: { studentId: id } })
  await prisma.nota.deleteMany({ where: { studentId: id } })
  await prisma.charge.deleteMany({ where: { studentId: id } })
  await prisma.studentAcademicAssignment.deleteMany({ where: { studentId: id } })
  await prisma.parentStudent.deleteMany({ where: { studentId: id } })

  if (student?.userId) {
    await prisma.$executeRaw`UPDATE "Student" SET "userId" = NULL WHERE id = ${id}`
    await prisma.student.delete({ where: { id } })
    await prisma.user.delete({ where: { id: student.userId } })
  } else {
    await prisma.student.delete({ where: { id } })
  }
}

async function main() {
  console.log('🔍 Buscando estudiantes duplicados por nombre y apellido...\n')

  const students = await prisma.student.findMany({
    select: {
      id: true, firstName: true, lastName: true,
      ci: true, rude: true, kardex: true,
      birthDate: true, phone: true, email: true,
      address: true, userId: true, isActive: true,
    },
    orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
  })

  // Agrupar por nombre normalizado
  const groups = new Map<string, typeof students>()

  for (const s of students) {
    const key = `${normalize(s.lastName)}||${normalize(s.firstName)}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(s)
  }

  // Filtrar solo grupos con duplicados
  const duplicateGroups = Array.from(groups.entries()).filter(([, g]) => g.length > 1)

  if (duplicateGroups.length === 0) {
    console.log('✅ No se encontraron estudiantes duplicados.')
    await prisma.$disconnect()
    return
  }

  console.log(`⚠️  Se encontraron ${duplicateGroups.length} grupos de duplicados:\n`)

  let totalDeleted = 0
  let totalErrors  = 0

  for (const [key, group] of duplicateGroups) {
    const [lastName, firstName] = key.split('||')
    console.log(`👤 ${lastName} ${firstName} — ${group.length} registros`)

    // Ordenar por puntaje descendente — el primero se conserva
    const sorted = group.sort((a, b) => scoreStudent(b) - scoreStudent(a))

    const keeper  = sorted[0]
    const toDelete = sorted.slice(1)

    console.log(`   ✅ Conservar: id=${keeper.id} | RUDE=${keeper.rude || '—'} | CI=${keeper.ci || '—'} | Kardex=${keeper.kardex || '—'} | Score=${scoreStudent(keeper)}`)

    for (const dup of toDelete) {
      console.log(`   ❌ Eliminar:  id=${dup.id} | RUDE=${dup.rude || '—'} | CI=${dup.ci || '—'} | Kardex=${dup.kardex || '—'} | Score=${scoreStudent(dup)}`)
      try {
        await deleteStudent(dup.id, `${dup.lastName} ${dup.firstName}`)
        totalDeleted++
        console.log(`     ✅ Eliminado correctamente`)
      } catch (err: any) {
        console.error(`     ❌ Error: ${err.message}`)
        totalErrors++
      }
    }
    console.log()
  }

  console.log('─────────────────────────────────────')
  console.log(`👥 Grupos duplicados: ${duplicateGroups.length}`)
  console.log(`✅ Eliminados:        ${totalDeleted}`)
  console.log(`❌ Errores:           ${totalErrors}`)
  console.log('─────────────────────────────────────')
  console.log('\n🎉 Script completado!')

  await prisma.$disconnect()
}

main().catch(async err => {
  console.error('Error fatal:', err)
  await prisma.$disconnect()
  process.exit(1)
})