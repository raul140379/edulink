import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'
import * as path from 'path'

const prisma = new PrismaClient()

interface SchoolRow {
  sieCode: string
  name: string
  tipo: 'FISCAL' | 'CONVENIO' | 'PRIVADA'
  area: 'RURAL' | 'URBANA'
  levels: ('INICIAL' | 'PRIMARIA' | 'SECUNDARIA')[]
  shifts: ('MORNING' | 'AFTERNOON' | 'NIGHT')[]
  nucleo: string | null
}

async function main() {
  const raw = fs.readFileSync(path.join(__dirname, 'el-torno-schools.json'), 'utf-8')
  const data = JSON.parse(raw) as { schools: SchoolRow[] }

  const district = await prisma.district.findFirst({ where: { name: { contains: 'El Torno' } } })
  if (!district) throw new Error('No se encontró el Distrito Educativo El Torno')

  const nucleos = await prisma.nucleo.findMany({ where: { districtId: district.id } })
  const nucleoByName = new Map(nucleos.map(n => [n.name, n.id]))

  // Paso 0: limpiar espacios en blanco en sieCode de filas ya existentes, para
  // que el upsert por sieCode "limpio" no cree duplicados (encontramos SIE con
  // espacios finales en 41980030/41980031 al inspeccionar la base).
  const existing = await prisma.school.findMany({ select: { id: true, sieCode: true } })
  for (const s of existing) {
    const trimmed = s.sieCode.trim()
    if (trimmed !== s.sieCode) {
      await prisma.school.update({ where: { id: s.id }, data: { sieCode: trimmed } })
    }
  }

  let created = 0
  let updated = 0
  const skippedNucleo: string[] = []

  for (const row of data.schools) {
    const sieCode = row.sieCode.trim()
    const nucleoId = row.nucleo ? nucleoByName.get(row.nucleo) : undefined
    if (row.nucleo && nucleoId === undefined) skippedNucleo.push(`${row.name} (${row.nucleo})`)

    const found = await prisma.school.findUnique({ where: { sieCode } })

    if (found) {
      await prisma.school.update({
        where: { id: found.id },
        data: {
          name: row.name,
          tipo: row.tipo,
          area: row.area,
          levels: row.levels,
          shifts: row.shifts,
          ...(nucleoId != null ? { nucleoId } : {}),
        },
      })
      updated++
    } else {
      await prisma.school.create({
        data: {
          name: row.name,
          sieCode,
          tipo: row.tipo,
          area: row.area,
          levels: row.levels,
          shifts: row.shifts,
          subsistema: 'REGULAR',
          offersBTH: false,
          district: { connect: { id: district.id } },
          ...(nucleoId != null ? { nucleo: { connect: { id: nucleoId } } } : {}),
        },
      })
      created++
    }
  }

  console.log(`Creados: ${created}`)
  console.log(`Actualizados: ${updated}`)
  if (skippedNucleo.length) console.log('Núcleo no resuelto (revisar nombre):', skippedNucleo)
}

main().catch(console.error).finally(() => prisma.$disconnect())
