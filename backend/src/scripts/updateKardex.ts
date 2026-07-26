import { PrismaClient } from '@prisma/client'
import * as XLSX from 'xlsx'
import * as fs from 'fs'
import * as path from 'path'

const prisma = new PrismaClient()

async function updateKardex() {
  console.log('🔍 Actualizando kardex de estudiantes...')

  const excelPath = path.join(__dirname, '../../alumnos.xlsx')

  if (!fs.existsSync(excelPath)) {
    console.error('❌ No se encontró el archivo alumnos.xlsx en la carpeta backend/')
    process.exit(1)
  }

  const workbook = XLSX.readFile(excelPath)
  const sheet    = workbook.Sheets[workbook.SheetNames[0]]
  const rows     = XLSX.utils.sheet_to_json(sheet, { defval: '' }) as any[]

  let updated = 0
  let skipped = 0
  let errors  = 0

  for (const row of rows) {
    try {
      const rude      = String(row['RUDE']           || '').trim()
      const kardex    = String(row['NROKARDEX']      || '').trim()
      const firstName = String(row['NOMBRESCOMPLETO']|| row['NOMBRES'] || '').trim()
      const lastName  = String(row['APELLIDOS']      || '').trim()

      if (!kardex) { skipped++; continue }

      let student = null

      // Buscar por RUDE primero
      if (rude) {
        student = await prisma.student.findFirst({ where: { rude } })
      }

      // Si no encontró por RUDE, buscar por nombre y apellido
      if (!student && firstName && lastName) {
        student = await prisma.student.findFirst({
          where: {
            firstName: { contains: firstName, mode: 'insensitive' },
            lastName:  { contains: lastName,  mode: 'insensitive' },
          }
        })
      }

      if (!student) {
        skipped++
        continue
      }

      // Actualizar kardex si no lo tiene o es diferente
      if (student.kardex !== kardex) {
        await prisma.student.update({
          where: { id: student.id },
          data:  { kardex }
        })
        updated++
        console.log(`✅ Kardex actualizado: ${student.lastName} ${student.firstName} → ${kardex}`)
      } else {
        skipped++
      }

    } catch (e: any) {
      errors++
      console.error(`❌ Error: ${e.message}`)
    }
  }

  console.log(`\n✅ Proceso completado:`)
  console.log(`   Actualizados: ${updated}`)
  console.log(`   Omitidos:     ${skipped}`)
  console.log(`   Errores:      ${errors}`)
}

updateKardex()
  .catch(e => { console.error('❌ Error:', e); process.exit(1) })
  .finally(() => prisma.$disconnect())