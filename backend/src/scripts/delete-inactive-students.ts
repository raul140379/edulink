// ─────────────────────────────────────────────────────────────
// Script: delete-inactive-students.ts
// Uso: npx ts-node src/scripts/delete-inactive-students.ts
// Elimina estudiantes inactivos y todas sus relaciones
// ─────────────────────────────────────────────────────────────

import prisma from '../lib/prisma'

async function main() {
  console.log('🔍 Buscando estudiantes inactivos...\n')

  // Obtener todos los estudiantes inactivos
  const inactiveStudents = await prisma.student.findMany({
    where: { isActive: false },
    select: {
      id:        true,
      firstName: true,
      lastName:  true,
      ci:        true,
      rude:      true,
      userId:    true,
    },
    orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
  })

  if (inactiveStudents.length === 0) {
    console.log('✅ No hay estudiantes inactivos para eliminar.')
    await prisma.$disconnect()
    return
  }

  console.log(`⚠️  Se encontraron ${inactiveStudents.length} estudiantes inactivos:`)
  inactiveStudents.forEach((s, i) => {
    console.log(`  ${i + 1}. ${s.lastName} ${s.firstName} | CI: ${s.ci || '—'} | RUDE: ${s.rude || '—'}`)
  })

  console.log('\n🗑️  Iniciando eliminación...\n')

  let deleted = 0
  let errors  = 0

  for (const student of inactiveStudents) {
    try {
      console.log(`  Eliminando: ${student.lastName} ${student.firstName}...`)

      // Eliminar todas las relaciones en orden
      await prisma.taskSubmission.deleteMany({ where: { studentId: student.id } })
      await prisma.nota.deleteMany({ where: { studentId: student.id } })
      await prisma.charge.deleteMany({ where: { studentId: student.id } })
      await prisma.studentAcademicAssignment.deleteMany({ where: { studentId: student.id } })
      await prisma.parentStudent.deleteMany({ where: { studentId: student.id } })

      if (student.userId) {
        await prisma.$executeRaw`UPDATE "Student" SET "userId" = NULL WHERE id = ${student.id}`
        await prisma.student.delete({ where: { id: student.id } })
        await prisma.user.delete({ where: { id: student.userId } })
        console.log(`     ✅ Eliminado con usuario`)
      } else {
        await prisma.student.delete({ where: { id: student.id } })
        console.log(`     ✅ Eliminado sin usuario`)
      }

      deleted++
    } catch (err: any) {
      console.error(`     ❌ Error: ${err.message}`)
      errors++
    }
  }

  console.log('\n─────────────────────────────────────')
  console.log(`✅ Eliminados: ${deleted}`)
  console.log(`❌ Errores:    ${errors}`)
  console.log(`📊 Total:      ${inactiveStudents.length}`)
  console.log('─────────────────────────────────────')
  console.log('\n🎉 Script completado!')

  await prisma.$disconnect()
}

main().catch(async err => {
  console.error('Error fatal:', err)
  await prisma.$disconnect()
  process.exit(1)
})