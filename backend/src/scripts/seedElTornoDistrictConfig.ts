/**
 * seedElTornoDistrictConfig.ts
 * Puebla los nuevos campos de branding del Distrito El Torno (districtId=1)
 * con sus valores reales actuales, para que no haya regresión visual al
 * conectar el branding dinámico (useDistrictConfig) en el frontend.
 *
 * Uso: npx ts-node src/scripts/seedElTornoDistrictConfig.ts
 */
import * as fs from 'fs'
import * as path from 'path'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DISTRICT_ID = 1

async function main() {
  const escudoPath = path.join(__dirname, '../../../frontend/public/escudo-el-torno.png')
  const buffer = fs.readFileSync(escudoPath)
  const logoUrl = `data:image/png;base64,${buffer.toString('base64')}`

  const district = await prisma.district.update({
    where: { id: DISTRICT_ID },
    data: {
      location:    'El Torno, 4ta. Sección Municipal, Provincia Andrés Ibáñez, Santa Cruz',
      emailDomain: '@nnuu.edu.bo',
      logoUrl,
    },
  })

  console.log(`✅ Distrito actualizado: ${district.name} (id=${district.id})`)
  console.log(`   location: ${district.location}`)
  console.log(`   emailDomain: ${district.emailDomain}`)
  console.log(`   logoUrl: ${logoUrl.length} caracteres (base64)`)
}

main()
  .catch(e => { console.error('❌ Error:', e.message); process.exit(1) })
  .finally(() => prisma.$disconnect())
