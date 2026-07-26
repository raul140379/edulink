import { PrismaClient } from '@prisma/client'
import * as XLSX from 'xlsx'
import * as fs from 'fs'
import * as path from 'path'

const prisma = new PrismaClient()

async function restoreLinks() {
  console.log('🔍 Restaurando vinculaciones padre-estudiante...')

  // Lee el archivo Excel — ajusta la ruta si es necesario
  const excelPath = path.join(__dirname, '../../PADRES.xlsx')
  
  if (!fs.existsSync(excelPath)) {
    console.error('❌ No se encontró el archivo PADRES.xlsx en la raíz del backend')
    process.exit(1)
  }

  const workbook = XLSX.readFile(excelPath)
  const sheet    = workbook.Sheets[workbook.SheetNames[0]]
  const rows     = XLSX.utils.sheet_to_json(sheet, { defval: '' }) as any[]

  let restored = 0
  let skipped  = 0
  let errors   = 0

  for (const row of rows) {
    const kardex = String(row['NROKARDEX'] || row['#KARDEX'] || '').trim()

    if (!kardex) continue

    // Buscar estudiantes con este kardex
    const students = await prisma.student.findMany({ where: { kardex } })
    if (students.length === 0) { skipped++; continue }

    // ── Restaurar vinculación PADRE ──
    const nombrePadre   = String(row['NOMBREPADRE']   || row['NOMBRES']   || '').trim()
    const apellidoPadre = String(row['APELLIDOPADRE'] || row['APELLIDOS'] || '').trim()
    const ciPadre       = String(row['NROCIPADRE']    || row['NROCI']     || '').trim()

    if (nombrePadre && apellidoPadre) {
      let padre = null
      if (ciPadre) {
        padre = await prisma.parent.findFirst({ where: { ci: ciPadre } })
      }
      if (!padre) {
        padre = await prisma.parent.findFirst({
          where: {
            firstName: { contains: nombrePadre, mode: 'insensitive' },
            lastName:  { contains: apellidoPadre, mode: 'insensitive' },
          }
        })
      }

      if (padre) {
        for (const student of students) {
          try {
            const existing = await prisma.parentStudent.findUnique({
              where: { parentId_studentId: { parentId: padre.id, studentId: student.id } }
            })
            if (!existing) {
              await prisma.parentStudent.create({
                data: {
                  parentId:    padre.id,
                  studentId:   student.id,
                  relationType: 'PADRE',
                  isTutor:     false,
                }
              })
              restored++
              console.log(`✅ Vinculado: ${apellidoPadre} ${nombrePadre} → ${student.lastName} ${student.firstName}`)
            }
          } catch (e: any) {
            errors++
            console.error(`❌ Error vinculando padre: ${e.message}`)
          }
        }
      }
    }

    // ── Restaurar vinculación MADRE ──
    const nombreMadre   = String(row['NOMBRESMADRE']   || row['NOMBRES2']   || '').trim()
    const apellidoMadre = String(row['APELLIDOSMADRE'] || row['APELLIDOS2'] || '').trim()
    const ciMadre       = String(row['NROCIMADRE']     || row['NROCI2']     || '').trim()

    if (nombreMadre && apellidoMadre) {
      let madre = null
      if (ciMadre) {
        madre = await prisma.parent.findFirst({ where: { ci: ciMadre } })
      }
      if (!madre) {
        madre = await prisma.parent.findFirst({
          where: {
            firstName: { contains: nombreMadre, mode: 'insensitive' },
            lastName:  { contains: apellidoMadre, mode: 'insensitive' },
          }
        })
      }

      if (madre) {
        for (const student of students) {
          try {
            const existing = await prisma.parentStudent.findUnique({
              where: { parentId_studentId: { parentId: madre.id, studentId: student.id } }
            })
            if (!existing) {
              await prisma.parentStudent.create({
                data: {
                  parentId:    madre.id,
                  studentId:   student.id,
                  relationType: 'MADRE',
                  isTutor:     false,
                }
              })
              restored++
              console.log(`✅ Vinculada: ${apellidoMadre} ${nombreMadre} → ${student.lastName} ${student.firstName}`)
            }
          } catch (e: any) {
            errors++
            console.error(`❌ Error vinculando madre: ${e.message}`)
          }
        }
      }
    }
  }

  console.log(`\n✅ Proceso completado:`)
  console.log(`   Vinculaciones restauradas: ${restored}`)
  console.log(`   Omitidos sin kardex:       ${skipped}`)
  console.log(`   Errores:                   ${errors}`)
}

restoreLinks()
  .catch(e => { console.error('❌ Error:', e); process.exit(1) })
  .finally(() => prisma.$disconnect())
  