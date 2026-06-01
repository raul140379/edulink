/**
 * createMissingCourses.ts
 * Crea los cursos faltantes de Secundaria Mañana
 *
 * Uso LOCAL:   npx ts-node src/scripts/createMissingCourses.ts
 * Uso PROD:    $env:DATABASE_URL="..."; npx ts-node src/scripts/createMissingCourses.ts
 */
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

const MISSING_COURSES = [
  { grade: 'PRIMERO',  parallel: 'C', name: '1°C' },
  { grade: 'SEGUNDO',  parallel: 'B', name: '2°B' },
  { grade: 'SEGUNDO',  parallel: 'C', name: '2°C' },
  { grade: 'TERCERO',  parallel: 'B', name: '3°B' },
  { grade: 'TERCERO',  parallel: 'C', name: '3°C' },
  { grade: 'CUARTO',   parallel: 'B', name: '4°B' },
  { grade: 'CUARTO',   parallel: 'C', name: '4°C' },
  { grade: 'QUINTO',   parallel: 'B', name: '5°B' },
  { grade: 'SEXTO',    parallel: 'C', name: '6°C' },
]

async function main() {
  console.log('\n🚀 Creando 9 cursos faltantes de Secundaria Mañana...\n')

  let created = 0, skipped = 0

  for (const c of MISSING_COURSES) {
    const existing = await prisma.course.findFirst({
      where: {
        level:         'SECUNDARIA' as any,
        grade:         c.grade      as any,
        parallel:      c.parallel   as any,
        shift:         'MORNING'    as any,
        educationType: 'REGULAR'    as any,
      }
    })

    if (existing) {
      console.log(`  ⏭️  Ya existe: ${c.name} (ID=${existing.id})`)
      skipped++
      continue
    }

    const newCourse = await prisma.course.create({
      data: {
        level:         'SECUNDARIA' as any,
        grade:         c.grade      as any,
        parallel:      c.parallel   as any,
        shift:         'MORNING'    as any,
        educationType: 'REGULAR'    as any,
      }
    })
    console.log(`  ✅ Creado: ${c.name} (ID=${newCourse.id})`)
    created++
  }

  console.log('\n' + '═'.repeat(50))
  console.log(`✅ Creados:      ${created}`)
  console.log(`⏭️  Ya existían: ${skipped}`)
  console.log('═'.repeat(50))
  console.log('\n⚡ Ahora re-ejecuta: npx ts-node src/scripts/syncStudents.ts')
}

main()
  .catch(e => { console.error('❌ Error:', e.message); process.exit(1) })
  .finally(() => prisma.$disconnect())