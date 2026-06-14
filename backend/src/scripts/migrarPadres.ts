import { PrismaClient } from '@prisma/client'

const source = new PrismaClient({
  datasources: { db: { url: process.env.SOURCE_DATABASE_URL } }
})
const target = new PrismaClient({
  datasources: { db: { url: process.env.TARGET_DATABASE_URL } }
})

async function main() {
  console.log('📋 Migrando Parents...')
  const parents = await source.parent.findMany()
  console.log(`   Total: ${parents.length}`)
  
  let ok = 0, err = 0
  for (const p of parents) {
    try {
      await target.parent.upsert({ where: { id: p.id }, update: p, create: p })
      ok++
      if (ok % 50 === 0) console.log(`   ✅ ${ok}/${parents.length}`)
    } catch (e: any) {
      err++
      console.log(`   ❌ Error parent ${p.id}: ${e.message}`)
    }
  }

  console.log(`\n✅ Completado: ${ok} migrados, ${err} errores`)
  await source.$disconnect()
  await target.$disconnect()
}

main().catch(console.error)