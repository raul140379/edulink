import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function removeDuplicateStudents() {
  console.log('🔍 Buscando estudiantes duplicados...')

  // Obtener todos los estudiantes sin RUDE agrupados por kardex + nombre + apellido
  const students = await prisma.student.findMany({
    where: { rude: null },
    orderBy: { id: 'asc' },
    include: {
      user:    true,
      parents: true,
      assignments: true,
    }
  })

  // Agrupar por kardex + firstName + lastName
  const groups: Record<string, typeof students> = {}

  for (const student of students) {
    const key = `${student.kardex || 'sin-kardex'}_${student.firstName}_${student.lastName}`
    if (!groups[key]) groups[key] = []
    groups[key].push(student)
  }

  let deleted = 0
  let kept    = 0

  for (const [key, group] of Object.entries(groups)) {
    if (group.length <= 1) { kept++; continue }

    console.log(`\n📋 Duplicados encontrados: ${key} (${group.length} registros)`)

    // Mantener el primero (menor ID), eliminar los demás
    const toKeep   = group[0]
    const toDelete = group.slice(1)

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
        await prisma.user.delete({ where: { id: dup.userId } })
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