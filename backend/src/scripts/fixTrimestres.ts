import prisma from '../lib/prisma'

async function main() {
  const trimestres = await prisma.trimester.findMany({
    orderBy: [{ academicYearId: 'asc' }, { number: 'asc' }]
  })

  for (const t of trimestres) {
    if (t.number > 1) {
      await prisma.trimester.update({
        where: { id: t.id },
        data:  { isClosed: true }
      })
      console.log(`✅ Cerrado: Trimestre ${t.number} (id: ${t.id})`)
    } else {
      await prisma.trimester.update({
        where: { id: t.id },
        data:  { isClosed: false }
      })
      console.log(`🟢 Abierto: Trimestre ${t.number} (id: ${t.id})`)
    }
  }

  console.log('\n✅ Proceso completado')
  await prisma.$disconnect()
}

main().catch(console.error)