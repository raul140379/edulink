/**
 * migrateTeachers.ts
 * Lee maestros de la DB LOCAL y los crea en PRODUCCIÓN
 * 
 * Uso:
 *   $env:DATABASE_URL="postgresql://local..."; $env:PROD_DATABASE_URL="postgresql://prod..."; npx ts-node src/scripts/migrateTeachers.ts
 */

import { PrismaClient } from '@prisma/client'
import * as bcrypt from 'bcryptjs'

// ── Conexión LOCAL ────────────────────────────────────────────────────────────
const localPrisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } }
})

// ── Conexión PRODUCCIÓN ───────────────────────────────────────────────────────
const prodPrisma = new PrismaClient({
  datasources: { db: { url: process.env.PROD_DATABASE_URL } }
})

// ── Generar email único ───────────────────────────────────────────────────────
function normalizeStr(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '')
}

async function generateEmail(firstName: string, lastName: string): Promise<string> {
  const first = normalizeStr(firstName.split(' ')[0])
  const last  = normalizeStr(lastName.split(' ')[0])
  let email   = `${first}.${last}@nnuu.edu.bo`
  let counter = 1

  while (true) {
    const exists = await prodPrisma.user.findUnique({ where: { email } })
    if (!exists) break
    email = `${first}.${last}${counter}@nnuu.edu.bo`
    counter++
  }

  return email
}

// ── Generar contraseña ────────────────────────────────────────────────────────
function generatePassword(lastName: string, ci?: string | null): string {
  if (ci && ci.length >= 4) {
    return `maestro${ci.slice(-4)}${new Date().getFullYear()}`
  }
  const part = normalizeStr(lastName).substring(0, 4)
  return `maestro${part}${new Date().getFullYear()}`
}

// ── Script principal ──────────────────────────────────────────────────────────
async function main() {
  console.log('🚀 Iniciando migración de maestros LOCAL → PRODUCCIÓN\n')

  // Leer todos los maestros de local
  const localTeachers = await localPrisma.teacher.findMany({
    orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }]
  })

  console.log(`📋 Encontrados ${localTeachers.length} maestros en DB local\n`)

  let created   = 0
  let skipped   = 0
  let errors    = 0
  const log: string[] = []

  for (const t of localTeachers) {
    try {
      // Verificar si ya existe en producción por CI
      if (t.ci) {
        const exists = await prodPrisma.teacher.findUnique({ where: { ci: t.ci } })
        if (exists) {
          console.log(`  ⏭  Omitido (ya existe): ${t.lastName} ${t.firstName} — CI: ${t.ci}`)
          skipped++
          continue
        }
      }

      // Generar email y contraseña
      const accessEmail = await generateEmail(t.firstName, t.lastName)
      const password    = generatePassword(t.lastName, t.ci)
      const hashed      = await bcrypt.hash(password, 10)

      // Crear usuario en producción
      const user = await prodPrisma.user.create({
        data: {
          email:    accessEmail,
          password: hashed,
          role:     'TEACHER',
          isActive: true,
        }
      })

      // Crear maestro en producción
      await prodPrisma.teacher.create({
        data: {
          firstName: t.firstName,
          lastName:  t.lastName,
          ci:        t.ci        || null,
          phone:     t.phone     || null,
          email:     t.email     || null,
          specialty: t.specialty || null,
          birthDate: t.birthDate || null,
          hoursLoad: t.hoursLoad || null,
          gender:    t.gender    || null,
          isActive:  t.isActive,
          userId:    user.id,
        }
      })

      console.log(`  ✅ Creado: ${t.lastName} ${t.firstName} → ${accessEmail} / ${password}`)
      log.push(`${t.lastName} ${t.firstName}\t${accessEmail}\t${password}`)
      created++

    } catch (err: any) {
      console.error(`  ❌ Error con ${t.lastName} ${t.firstName}: ${err.message}`)
      errors++
    }
  }

  // ── Resumen ───────────────────────────────────────────────────────────────
  console.log('\n' + '═'.repeat(60))
  console.log(`✅ Creados:  ${created}`)
  console.log(`⏭  Omitidos: ${skipped} (ya existían)`)
  console.log(`❌ Errores:  ${errors}`)
  console.log('═'.repeat(60))

  if (log.length > 0) {
    console.log('\n📄 CREDENCIALES GENERADAS:')
    console.log('Nombre\t\t\t\tEmail\t\t\t\tContraseña')
    console.log('─'.repeat(80))
    log.forEach(l => console.log(l))
    console.log('\n⚠️  Guarda estas credenciales antes de cerrar la terminal.')
  }
}

main()
  .catch(e => { console.error('Error fatal:', e); process.exit(1) })
  .finally(async () => {
    await localPrisma.$disconnect()
    await prodPrisma.$disconnect()
  })