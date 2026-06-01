/**
 * diagCursos.ts — Diagnóstico: muestra todos los cursos SECUNDARIA en la DB
 * npx ts-node src/scripts/diagCursos.ts
 */
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const courses = await prisma.course.findMany({
    where: { level: 'SECUNDARIA' as any },
    orderBy: [{ grade: 'asc' }, { parallel: 'asc' }],
    select: { id:true, grade:true, parallel:true, level:true, shift:true, educationType:true }
  })

  console.log(`\n📚 Cursos SECUNDARIA en la DB (${courses.length} total):\n`)
  courses.forEach(c =>
    console.log(`  ID=${c.id} | ${c.grade} ${c.parallel} | shift=${c.shift} | educationType=${c.educationType}`)
  )

  // También mostrar si hay cursos con shift diferente
  const all = await prisma.course.findMany({
    select: { shift: true },
    distinct: ['shift']
  })
  console.log('\n🔍 Valores de shift en la DB:', all.map(c => c.shift))
}

main().finally(() => prisma.$disconnect())