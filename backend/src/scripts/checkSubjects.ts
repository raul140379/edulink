import { PrismaClient } from '@prisma/client'
const p = new PrismaClient()
p.subject.findMany({ select: { id: true, name: true, campo: true } })
  .then(data => {
    data.forEach(s => console.log(s.id, '|', s.name, '|', s.campo))
  })
  .catch(e => console.error(e))
  .finally(() => p.$disconnect())
