import bcrypt from 'bcryptjs'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import dotenv from 'dotenv'

dotenv.config()

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL as string
})

const prisma = new PrismaClient({ adapter })

async function main() {
  const hashedPassword = await bcrypt.hash('admin123', 10)

  const user = await prisma.user.create({
    data: {
      email: 'admin@sgje.com',
      password: hashedPassword,
      role: 'SUPER_ADMIN',
      isActive: true
    }
  })

  console.log('✅ Usuario administrador creado:')
  console.log(`   Email: ${user.email}`)
  console.log(`   Role:  ${user.role}`)
  console.log(`   ID:    ${user.id}`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())