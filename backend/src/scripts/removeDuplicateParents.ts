import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function removeDuplicateParents() {
  console.log('🔍 Buscando padres duplicados...')

  const parents = await prisma.parent.findMany({
    orderBy: { id: 'asc' },
    include: {
      user:     true,
      students: true,
      charges:  true,
      payments: true,
    }
  })

  // Agrupar por firstName + lastName
  const groups: Record<string, typeof parents> = {}

  for (const parent of parents) {
    const key = `${parent.firstName.trim().toUpperCase()}_${parent.lastName.trim().toUpperCase()}`
    if (!groups[key]) groups[key] = []
    groups[key].push(parent)
  }

  let deleted = 0
  let kept    = 0

  for (const [key, group] of Object.entries(groups)) {
    if (group.length <= 1) { kept++; continue }

    console.log(`\n📋 Duplicados: ${key} (${group.length} registros)`)

    // Mantener el que tiene más vinculaciones o el de menor ID
    const toKeep = group.reduce((best, current) => 
      current.students.length > best.students.length ? current : best
    , group[0])

    const toDelete = group.filter(p => p.id !== toKeep.id)

    for (const dup of toDelete) {
      console.log(`  ❌ Eliminando ID ${dup.id} — ${dup.lastName} ${dup.firstName}`)

      // Mover vinculaciones de estudiantes al padre que se mantiene
      for (const ps of dup.students) {
        const existingLink = await prisma.parentStudent.findUnique({
          where: { parentId_studentId: { parentId: toKeep.id, studentId: ps.studentId } }
        })
        if (!existingLink) {
          await prisma.parentStudent.create({
            data: {
              parentId:    toKeep.id,
              studentId:   ps.studentId,
              relationType: ps.relationType,
              isTutor:     ps.isTutor,
            }
          })
          console.log(`    ↗️ Vinculación movida al padre ID ${toKeep.id}`)
        }
        await prisma.parentStudent.delete({
          where: { parentId_studentId: { parentId: dup.id, studentId: ps.studentId } }
        })
      }

      // Eliminar cargos y pagos del duplicado
      await prisma.payment.deleteMany({ where: { parentId: dup.id } })
      await prisma.charge.deleteMany({  where: { parentId: dup.id } })

      // Eliminar notificaciones
      await prisma.notification.deleteMany({ where: { parentId: dup.id } })

      // Eliminar padre duplicado
      await prisma.parent.delete({ where: { id: dup.id } })

      // Eliminar usuario si existe
      if (dup.userId) {
        await prisma.user.delete({ where: { id: dup.userId } })
      }

      deleted++
    }

    console.log(`  ✅ Manteniendo ID ${toKeep.id} — ${toKeep.lastName} ${toKeep.firstName} (${toKeep.students.length} vinculaciones)`)
    kept++
  }

  console.log(`\n✅ Proceso completado:`)
  console.log(`   Eliminados: ${deleted} padres duplicados`)
  console.log(`   Mantenidos: ${kept} padres únicos`)
}

removeDuplicateParents()
  .catch(e => { console.error('❌ Error:', e); process.exit(1) })
  .finally(() => prisma.$disconnect())