import { PrismaClient, AcademicLevel, CampoSaber, EducationType } from '@prisma/client'

const prisma = new PrismaClient()

// ─── Plan de Estudios SECUNDARIA ────────────────────────────────────────────
// Basado en el Plan de Estudios oficial - Carga Horaria
// grade: PRIMERO=1°, SEGUNDO=2°, TERCERO=3°, CUARTO=4°, QUINTO=5°, SEXTO=6°

const planEstudios = [

  // ── VIDA TIERRA Y TERRITORIO ──────────────────────────────────────────────
  {
    name: 'Ciencias Naturales: Biología',
    campo: CampoSaber.VIDA_TIERRA_TERRITORIO,
    level: AcademicLevel.SECUNDARIA,
    grades: [
      { grade: 'PRIMERO', hours: 16 },
      { grade: 'SEGUNDO', hours: 16 },
      { grade: 'TERCERO', hours: 16 },
      { grade: 'CUARTO',  hours: 16 },
      { grade: 'QUINTO',  hours: 16 },
      { grade: 'SEXTO',   hours: 16 },
    ],
  },
  {
    name: 'Física',
    campo: CampoSaber.VIDA_TIERRA_TERRITORIO,
    level: AcademicLevel.SECUNDARIA,
    grades: [
      { grade: 'CUARTO', hours: 8 },
      { grade: 'QUINTO', hours: 8 },
      { grade: 'SEXTO',  hours: 8 },
    ],
  },
  {
    name: 'Química',
    campo: CampoSaber.VIDA_TIERRA_TERRITORIO,
    level: AcademicLevel.SECUNDARIA,
    grades: [
      { grade: 'CUARTO', hours: 8 },
      { grade: 'QUINTO', hours: 8 },
      { grade: 'SEXTO',  hours: 8 },
    ],
  },

  // ── COMUNIDAD Y SOCIEDAD ──────────────────────────────────────────────────
  {
    name: 'Lenguas Castellana y Originaria',
    campo: CampoSaber.COMUNIDAD_SOCIEDAD,
    level: AcademicLevel.SECUNDARIA,
    grades: [
      { grade: 'PRIMERO', hours: 24 },
      { grade: 'SEGUNDO', hours: 24 },
      { grade: 'TERCERO', hours: 24 },
      { grade: 'CUARTO',  hours: 16 },
      { grade: 'QUINTO',  hours: 12 },
      { grade: 'SEXTO',   hours: 12 },
    ],
  },
  {
    name: 'Lengua Extranjera',
    campo: CampoSaber.COMUNIDAD_SOCIEDAD,
    level: AcademicLevel.SECUNDARIA,
    grades: [
      { grade: 'PRIMERO', hours: 8 },
      { grade: 'SEGUNDO', hours: 8 },
      { grade: 'TERCERO', hours: 8 },
      { grade: 'CUARTO',  hours: 8 },
      { grade: 'QUINTO',  hours: 8 },
      { grade: 'SEXTO',   hours: 8 },
    ],
  },
  {
    name: 'Ciencias Sociales',
    campo: CampoSaber.COMUNIDAD_SOCIEDAD,
    level: AcademicLevel.SECUNDARIA,
    grades: [
      { grade: 'PRIMERO', hours: 12 },
      { grade: 'SEGUNDO', hours: 12 },
      { grade: 'TERCERO', hours: 20 },
      { grade: 'CUARTO',  hours: 20 },
    ],
  },
  {
    name: 'Historia',
    campo: CampoSaber.COMUNIDAD_SOCIEDAD,
    level: AcademicLevel.SECUNDARIA,
    grades: [
      { grade: 'QUINTO', hours: 12 },
      { grade: 'SEXTO',  hours: 12 },
    ],
  },
  {
    name: 'Geografía',
    campo: CampoSaber.COMUNIDAD_SOCIEDAD,
    level: AcademicLevel.SECUNDARIA,
    grades: [
      { grade: 'QUINTO', hours: 12 },
      { grade: 'SEXTO',  hours: 12 },
    ],
  },
  {
    name: 'Educación Cívica',
    campo: CampoSaber.COMUNIDAD_SOCIEDAD,
    level: AcademicLevel.SECUNDARIA,
    grades: [
      { grade: 'CUARTO', hours: 8 },
      { grade: 'QUINTO', hours: 8 },
    ],
  },
  {
    name: 'Artes Plásticas y Visuales',
    campo: CampoSaber.COMUNIDAD_SOCIEDAD,
    level: AcademicLevel.SECUNDARIA,
    grades: [
      { grade: 'PRIMERO', hours: 8 },
      { grade: 'SEGUNDO', hours: 8 },
      { grade: 'TERCERO', hours: 8 },
      { grade: 'CUARTO',  hours: 8 },
      { grade: 'QUINTO',  hours: 8 },
      { grade: 'SEXTO',   hours: 8 },
    ],
  },
  {
    name: 'Educación Musical',
    campo: CampoSaber.COMUNIDAD_SOCIEDAD,
    level: AcademicLevel.SECUNDARIA,
    grades: [
      { grade: 'PRIMERO', hours: 8 },
      { grade: 'SEGUNDO', hours: 8 },
      { grade: 'TERCERO', hours: 8 },
      { grade: 'CUARTO',  hours: 8 },
      { grade: 'QUINTO',  hours: 8 },
      { grade: 'SEXTO',   hours: 8 },
    ],
  },
  {
    name: 'Educación Física y Deportes',
    campo: CampoSaber.COMUNIDAD_SOCIEDAD,
    level: AcademicLevel.SECUNDARIA,
    grades: [
      { grade: 'PRIMERO', hours: 8 },
      { grade: 'SEGUNDO', hours: 8 },
      { grade: 'TERCERO', hours: 8 },
      { grade: 'CUARTO',  hours: 8 },
      { grade: 'QUINTO',  hours: 8 },
      { grade: 'SEXTO',   hours: 8 },
    ],
  },

  // ── COSMOS Y PENSAMIENTO ──────────────────────────────────────────────────
  {
    name: 'Cosmovisiones y Filosofía',
    campo: CampoSaber.COSMOS_PENSAMIENTO,
    level: AcademicLevel.SECUNDARIA,
    grades: [
      { grade: 'TERCERO', hours: 8 },
      { grade: 'CUARTO',  hours: 8 },
      { grade: 'QUINTO',  hours: 8 },
      { grade: 'SEXTO',   hours: 8 },
    ],
  },
  {
    name: 'Psicología',
    campo: CampoSaber.COSMOS_PENSAMIENTO,
    level: AcademicLevel.SECUNDARIA,
    grades: [
      { grade: 'PRIMERO', hours: 8 },
      { grade: 'SEGUNDO', hours: 8 },
    ],
  },
  {
    name: 'Valores, Espiritualidad y Religiones',
    campo: CampoSaber.COSMOS_PENSAMIENTO,
    level: AcademicLevel.SECUNDARIA,
    grades: [
      { grade: 'PRIMERO', hours: 8 },
      { grade: 'SEGUNDO', hours: 8 },
      { grade: 'TERCERO', hours: 8 },
      { grade: 'CUARTO',  hours: 8 },
      { grade: 'QUINTO',  hours: 8 },
      { grade: 'SEXTO',   hours: 8 },
    ],
  },

  // ── CIENCIA TECNOLOGÍA Y PRODUCCIÓN ──────────────────────────────────────
  {
    name: 'Matemática',
    campo: CampoSaber.CIENCIA_TECNOLOGIA_PRODUCCION,
    level: AcademicLevel.SECUNDARIA,
    grades: [
      { grade: 'PRIMERO', hours: 20 },
      { grade: 'SEGUNDO', hours: 20 },
      { grade: 'TERCERO', hours: 20 },
      { grade: 'CUARTO',  hours: 20 },
      { grade: 'QUINTO',  hours: 20 },
      { grade: 'SEXTO',   hours: 20 },
    ],
  },
  {
    name: 'Técnica Tecnológica General',
    campo: CampoSaber.CIENCIA_TECNOLOGIA_PRODUCCION,
    level: AcademicLevel.SECUNDARIA,
    grades: [
      { grade: 'PRIMERO', hours: 16, educationType: EducationType.REGULAR },
      { grade: 'SEGUNDO', hours: 16, educationType: EducationType.REGULAR },
    ],
  },
  {
    name: 'Técnica Tecnológica General y Especializada',
    campo: CampoSaber.CIENCIA_TECNOLOGIA_PRODUCCION,
    level: AcademicLevel.SECUNDARIA,
    grades: [
      { grade: 'TERCERO', hours: 32, educationType: EducationType.BTH },
      { grade: 'CUARTO',  hours: 32, educationType: EducationType.BTH },
      { grade: 'QUINTO',  hours: 48, educationType: EducationType.BTH },
      { grade: 'SEXTO',   hours: 48, educationType: EducationType.BTH },
    ],
  },
]

async function main() {
  console.log('🌱 Iniciando seed de materias SECUNDARIA...\n')
  let created = 0
  let updated = 0
  let configsCreated = 0

  for (const item of planEstudios) {
    // Upsert de la materia
    const subject = await prisma.subject.upsert({
      where: { name_level: { name: item.name, level: item.level } },
      update: { campo: item.campo },
      create: {
        name: item.name,
        level: item.level,
        campo: item.campo,
        hoursPerWeek: item.grades[0]?.hours ?? 4,
        isActive: true,
      },
    })

    if (subject) {
      console.log(`  ✅ ${item.name}`)
    }

    // Upsert de configs por grado
    for (const gc of item.grades) {
      const educationType = (gc as any).educationType ?? EducationType.REGULAR
      await prisma.subjectGradeConfig.upsert({
        where: {
          subjectId_grade_educationType: {
            subjectId: subject.id,
            grade: gc.grade as any,
            educationType,
          },
        },
        update: { hoursPerWeek: gc.hours },
        create: {
          subjectId: subject.id,
          grade: gc.grade as any,
          hoursPerWeek: gc.hours,
          educationType,
        },
      })
      configsCreated++
    }
  }

  console.log(`\n✅ Seed completado:`)
  console.log(`   ${planEstudios.length} materias procesadas`)
  console.log(`   ${configsCreated} configuraciones de grado creadas`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())