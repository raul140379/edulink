import { PrismaClient } from '@prisma/client'

const source = new PrismaClient({
  datasources: { db: { url: process.env.SOURCE_DATABASE_URL } }
})
const target = new PrismaClient({
  datasources: { db: { url: process.env.TARGET_DATABASE_URL } }
})

async function main() {
  console.log('📋 Migrando Students...')
  const students = await source.student.findMany()
  console.log(`   Total: ${students.length}`)
  
  let ok = 0, err = 0
  for (const s of students) {
    try {
      await target.student.upsert({ where: { id: s.id }, update: s, create: s })
      ok++
      if (ok % 50 === 0) console.log(`   ✅ ${ok}/${students.length}`)
    } catch (e: any) {
      err++
      console.log(`   ❌ Error student ${s.id}: ${e.message}`)
    }
  }

  console.log(`\n✅ Completado: ${ok} migrados, ${err} errores`)
  await source.$disconnect()
  await target.$disconnect()
}

main().catch(console.error)