import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Catálogo global de logros del panel Estudiante — no lleva schoolId (es de
// referencia, no un dato de un colegio). AVERAGE está en la misma escala 0-100
// que ya usa el sistema para notas (aprobado ≥ 51).
const achievements = [
  { code: 'STREAK_7',      name: 'Racha de 7 días',              description: '7 días seguidos con asistencia registrada.',          icon: 'Flame',         criteriaKey: 'STREAK',                   criteriaValue: 7 },
  { code: 'STREAK_30',     name: 'Racha de 30 días',              description: '30 días seguidos con asistencia registrada.',         icon: 'Flame',         criteriaKey: 'STREAK',                   criteriaValue: 30 },
  { code: 'AVG_80',        name: 'Buen Promedio',                 description: 'Promedio general arriba de 80/100.',                  icon: 'Star',          criteriaKey: 'AVERAGE',                  criteriaValue: 80 },
  { code: 'AVG_95',        name: 'Promedio de Excelencia',        description: 'Promedio general arriba de 95/100.',                  icon: 'Award',         criteriaKey: 'AVERAGE',                  criteriaValue: 95 },
  { code: 'PERFECT_MONTH', name: 'Asistencia perfecta del mes',   description: 'Un mes entero sin ninguna falta.',                    icon: 'CalendarCheck', criteriaKey: 'PERFECT_ATTENDANCE_MONTH', criteriaValue: null },
]

async function main() {
  for (const a of achievements) {
    await prisma.achievementDefinition.upsert({
      where: { code: a.code },
      update: { name: a.name, description: a.description, icon: a.icon, criteriaKey: a.criteriaKey, criteriaValue: a.criteriaValue },
      create: a,
    })
  }
  console.log(`✅ Seed completado: ${achievements.length} logros sembrados/actualizados`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
