import { PrismaClient } from '@prisma/client'
import * as XLSX from 'xlsx'
import * as fs from 'fs'
import * as path from 'path'

const prisma = new PrismaClient()

async function assignTutors() {
  console.log('🔍 Asignando tutores legales...')

  const excelPath = path.join(__dirname, '../../alumnos.xlsx')

  if (!fs.existsSync(excelPath)) {
    console.error('❌ No se encontró el archivo alumnos.xlsx en la carpeta backend/')
    process.exit(1)
  }

  const workbook = XLSX.readFile(excelPath)
  const sheet    = workbook.Sheets[workbook.SheetNames[0]]
  const rows     = XLSX.utils.sheet_to_json(sheet, { defval: '' }) as any[]

  let assigned = 0
  let skipped  = 0
  let errors   = 0

  for (const row of rows) {
    try {
      const rude        = String(row['RUDE']           || '').trim()
      const kardex      = String(row['NROKARDEX']      || '').trim()
      const tutorNombre = String(row['TUTORLEGAL']     || '').trim()

      // Ignorar si no tiene tutor o es SIN REGISTRO
      if (!tutorNombre || tutorNombre.toUpperCase() === 'SIN REGISTRO' || tutorNombre === '') {
        skipped++
        continue
      }

      // Buscar estudiante
      let student = null
      if (rude) {
        student = await prisma.student.findUnique({ where: { rude } })
      }
      if (!student && kardex) {
        student = await prisma.student.findFirst({ where: { kardex } })
      }

      if (!student) {
        skipped++
        continue
      }

      // Buscar tutor entre los padres ya vinculados al estudiante
      const palabras = tutorNombre.split(' ').filter((p: string) => p.length > 0)

      const vinculados = await prisma.parentStudent.findMany({
        where:   { studentId: student.id },
        include: { parent: true }
      })

      let tutor = vinculados
        .map(v => v.parent)
        .find(p => {
          const fullName = `${p.firstName} ${p.lastName}`.toUpperCase()
          return palabras.every((palabra: string) => fullName.includes(palabra.toUpperCase()))
        })

      // Si no encontró con todas las palabras, intenta con las primeras dos
      if (!tutor && palabras.length > 1) {
        tutor = vinculados
          .map(v => v.parent)
          .find(p => {
            const fullName = `${p.firstName} ${p.lastName}`.toUpperCase()
            return palabras.slice(0, 2).some((palabra: string) => fullName.includes(palabra.toUpperCase()))
          })
      }

      if (!tutor) {
        // Buscar en todos los padres del sistema
        const allParents = await prisma.parent.findMany({
          where: {
            OR: palabras.slice(0, 2).map((p: string) => ({
              OR: [
                { firstName: { contains: p, mode: 'insensitive' as any } },
                { lastName:  { contains: p, mode: 'insensitive' as any } },
              ]
            }))
          }
        })

        tutor = allParents.find(p => {
          const fullName = `${p.firstName} ${p.lastName}`.toUpperCase()
          return palabras.slice(0, 2).every((palabra: string) => fullName.includes(palabra.toUpperCase()))
        })

        if (tutor) {
          // Verificar si está vinculado al estudiante
          const linked = await prisma.parentStudent.findUnique({
            where: { parentId_studentId: { parentId: tutor.id, studentId: student.id } }
          })
          if (!linked) tutor = undefined as any
        }
      }

      if (!tutor) {
        errors++
        console.log(`⚠️ Tutor no encontrado: ${tutorNombre} para ${student.lastName} ${student.firstName}`)
        continue
      }

      // Quitar tutor legal anterior
      await prisma.parentStudent.updateMany({
        where: { studentId: student.id, isTutor: true },
        data:  { isTutor: false }
      })

      // Marcar como tutor legal
      await prisma.parentStudent.update({
        where: { parentId_studentId: { parentId: tutor.id, studentId: student.id } },
        data:  { isTutor: true }
      })

      assigned++
      console.log(`✅ Tutor asignado: ${tutor.lastName} ${tutor.firstName} → ${student.lastName} ${student.firstName}`)

    } catch (e: any) {
      errors++
      console.error(`❌ Error: ${e.message}`)
    }
  }

  console.log(`\n✅ Proceso completado:`)
  console.log(`   Tutores asignados: ${assigned}`)
  console.log(`   Omitidos:          ${skipped}`)
  console.log(`   No encontrados:    ${errors}`)
}

assignTutors()
  .catch(e => { console.error('❌ Error:', e); process.exit(1) })
  .finally(() => prisma.$disconnect())