import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const email    = 'admin@sgje.com'
  const password = 'admin123'

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    console.log('✅ El usuario admin ya existe:', email)
    return
  }

  const hashed = await bcrypt.hash(password, 10)
  const user   = await prisma.user.create({
    data: { email, password: hashed, role: 'SUPER_ADMIN', isActive: true }
  })

  console.log('✅ Usuario admin creado correctamente')
  console.log('   Email:    ', user.email)
  console.log('   Password: ', password)
  console.log('   Role:     ', user.role)
}

main()
  .catch(e => { console.error('❌ Error:', e); process.exit(1) })
  .finally(() => prisma.$disconnect())