import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function removeDuplicateStudents() {
  console.log('🔍 Buscando estudiantes duplicados...')

  const students = await prisma.student.findMany({
    where: { rude: null },
    orderBy: { id: 'asc' },
    include: {
      user:        true,
      parents:     true,
      assignments: true,
      charges:     true,
    }
  })

  // Agrupar por firstName + lastName (sin importar kardex)
  const groups: Record<string, typeof students> = {}

  for (const student of students) {
    const key = `${student.firstName.trim().toUpperCase()}_${student.lastName.trim().toUpperCase()}`
    if (!groups[key]) groups[key] = []
    groups[key].push(student)
  }

  let deleted = 0
  let kept    = 0

  for (const [key, group] of Object.entries(groups)) {
    if (group.length <= 1) { kept++; continue }

    console.log(`\n📋 Duplicados: ${key} (${group.length} registros)`)

    // Mantener el que tiene más vinculaciones o el de menor ID
    const toKeep = group.reduce((best, current) =>
      current.parents.length > best.parents.length ? current : best
    , group[0])

    const toDelete = group.filter(s => s.id !== toKeep.id)

    for (const dup of toDelete) {
      console.log(`  ❌ Eliminando ID ${dup.id} — ${dup.lastName} ${dup.firstName}`)

      // Eliminar vinculaciones con padres
      await prisma.parentStudent.deleteMany({ where: { studentId: dup.id } })

      // Eliminar inscripciones académicas
      await prisma.studentAcademicAssignment.deleteMany({ where: { studentId: dup.id } })

      // Eliminar cargos
      await prisma.charge.deleteMany({ where: { studentId: dup.id } })

      // Eliminar estudiante
      await prisma.student.delete({ where: { id: dup.id } })

      // Eliminar usuario si existe
      if (dup.userId) {
        try {
          await prisma.user.delete({ where: { id: dup.userId } })
        } catch (e) {
          console.log(`  ⚠️ No se pudo eliminar usuario ID ${dup.userId}`)
        }
      }

      deleted++
    }

    console.log(`  ✅ Manteniendo ID ${toKeep.id} — ${toKeep.lastName} ${toKeep.firstName}`)
    kept++
  }

  console.log(`\n✅ Proceso completado:`)
  console.log(`   Eliminados: ${deleted} estudiantes duplicados`)
  console.log(`   Mantenidos: ${kept} estudiantes únicos`)
}

removeDuplicateStudents()
  .catch(e => { console.error('❌ Error:', e); process.exit(1) })
  .finally(() => prisma.$disconnect())