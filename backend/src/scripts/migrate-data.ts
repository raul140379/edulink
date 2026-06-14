// ─────────────────────────────────────────────────────────────
// Script: migrate-data.ts
// Copia todos los datos de Railway a Supabase
// Uso:
//   1. $env:SOURCE_DATABASE_URL="postgresql://postgres:...railway..."
//   2. $env:TARGET_DATABASE_URL="postgresql://postgres:...supabase..."
//   3. npx ts-node src/scripts/migrate-data.ts
// ─────────────────────────────────────────────────────────────

import { PrismaClient } from '@prisma/client'

const source = new PrismaClient({
  datasources: { db: { url: process.env.SOURCE_DATABASE_URL } }
})

const target = new PrismaClient({
  datasources: { db: { url: process.env.TARGET_DATABASE_URL } }
})

async function migrate() {
  console.log('🚀 Iniciando migración de datos...\n')

  try {
    // ── 1. Users ──
    console.log('📋 Migrando Users...')
    const users = await source.user.findMany()
    for (const u of users) {
      await target.user.upsert({ where: { id: u.id }, update: u, create: u })
    }
    console.log(`   ✅ ${users.length} usuarios`)

    // ── 2. AcademicYear ──
    console.log('📋 Migrando AcademicYears...')
    const years = await source.academicYear.findMany()
    for (const y of years) {
      await target.academicYear.upsert({ where: { id: y.id }, update: y, create: y })
    }
    console.log(`   ✅ ${years.length} gestiones`)

    // ── 3. Trimester ──
    console.log('📋 Migrando Trimesters...')
    const trimesters = await source.trimester.findMany()
    for (const t of trimesters) {
      await target.trimester.upsert({ where: { id: t.id }, update: t, create: t })
    }
    console.log(`   ✅ ${trimesters.length} trimestres`)

    // ── 4. Holiday ──
    console.log('📋 Migrando Holidays...')
    const holidays = await source.holiday.findMany()
    for (const h of holidays) {
      await target.holiday.upsert({ where: { id: h.id }, update: h, create: h })
    }
    console.log(`   ✅ ${holidays.length} feriados`)

    // ── 5. ShiftDirector ──
    console.log('📋 Migrando ShiftDirectors...')
    const directors = await source.shiftDirector.findMany()
    for (const d of directors) {
      await target.shiftDirector.upsert({ where: { id: d.id }, update: d, create: d })
    }
    console.log(`   ✅ ${directors.length} directores`)

    // ── 6. Course ──
    console.log('📋 Migrando Courses...')
    const courses = await source.course.findMany()
    // Primero sin delegateId para evitar FK
    for (const c of courses) {
      const { delegateId, ...rest } = c
      await target.course.upsert({ where: { id: c.id }, update: { ...rest, delegateId: null }, create: { ...rest, delegateId: null } })
    }
    console.log(`   ✅ ${courses.length} cursos`)

    // ── 7. Subject ──
    console.log('📋 Migrando Subjects...')
    const subjects = await source.subject.findMany()
    for (const s of subjects) {
      await target.subject.upsert({ where: { id: s.id }, update: s, create: s })
    }
    console.log(`   ✅ ${subjects.length} materias`)

    // ── 8. SubjectGradeConfig ──
    console.log('📋 Migrando SubjectGradeConfigs...')
    const sgcs = await source.subjectGradeConfig.findMany()
    for (const s of sgcs) {
      await target.subjectGradeConfig.upsert({ where: { id: s.id }, update: s, create: s })
    }
    console.log(`   ✅ ${sgcs.length} configuraciones`)

    // ── 9. Staff ──
    console.log('📋 Migrando Staff...')
    const staff = await source.staff.findMany()
    for (const s of staff) {
      await target.staff.upsert({ where: { id: s.id }, update: s, create: s })
    }
    console.log(`   ✅ ${staff.length} personal`)

    // ── 10. Teacher ──
    console.log('📋 Migrando Teachers...')
    const teachers = await source.teacher.findMany()
    for (const t of teachers) {
      await target.teacher.upsert({ where: { id: t.id }, update: t, create: t })
    }
    console.log(`   ✅ ${teachers.length} maestros`)

    // ── 11. TeacherSpecialty ──
    console.log('📋 Migrando TeacherSpecialties...')
    const specs = await source.teacherSpecialty.findMany()
    for (const s of specs) {
      await target.teacherSpecialty.upsert({ where: { id: s.id }, update: s, create: s })
    }
    console.log(`   ✅ ${specs.length} especialidades`)

    // ── 12. TeacherSubjectCourse ──
    console.log('📋 Migrando TeacherSubjectCourses...')
    const tscs = await source.teacherSubjectCourse.findMany()
    for (const t of tscs) {
      await target.teacherSubjectCourse.upsert({ where: { id: t.id }, update: t, create: t })
    }
    console.log(`   ✅ ${tscs.length} asignaciones maestro-materia-curso`)

    // ── 13. CourseTutor ──
    console.log('📋 Migrando CourseTutors...')
    const tutors = await source.courseTutor.findMany()
    for (const t of tutors) {
      await target.courseTutor.upsert({ where: { id: t.id }, update: t, create: t })
    }
    console.log(`   ✅ ${tutors.length} tutores de curso`)

    // ── 14. Schedule ──
    console.log('📋 Migrando Schedules...')
    const schedules = await source.schedule.findMany()
    for (const s of schedules) {
      await target.schedule.upsert({ where: { id: s.id }, update: s, create: s })
    }
    console.log(`   ✅ ${schedules.length} horarios`)

    // ── 15. Parent ──
    console.log('📋 Migrando Parents...')
    const parents = await source.parent.findMany()
    for (const p of parents) {
      await target.parent.upsert({ where: { id: p.id }, update: p, create: p })
    }
    console.log(`   ✅ ${parents.length} padres`)

    // ── 16. Student ──
    console.log('📋 Migrando Students...')
    const students = await source.student.findMany()
    for (const s of students) {
      await target.student.upsert({ where: { id: s.id }, update: s, create: s })
    }
    console.log(`   ✅ ${students.length} estudiantes`)

    // ── 17. ParentStudent ──
    console.log('📋 Migrando ParentStudents...')
    const pss = await source.parentStudent.findMany()
    for (const p of pss) {
      await target.parentStudent.upsert({ where: { id: p.id }, update: p, create: p })
    }
    console.log(`   ✅ ${pss.length} relaciones padre-estudiante`)

    // ── 18. StudentAcademicAssignment ──
    console.log('📋 Migrando StudentAcademicAssignments...')
    const assignments = await source.studentAcademicAssignment.findMany()
    for (const a of assignments) {
      await target.studentAcademicAssignment.upsert({ where: { id: a.id }, update: a, create: a })
    }
    console.log(`   ✅ ${assignments.length} inscripciones`)

    // ── 19. Actualizar delegateId en courses ──
    console.log('📋 Actualizando delegados en cursos...')
    for (const c of courses) {
      if (c.delegateId) {
        await target.course.update({ where: { id: c.id }, data: { delegateId: c.delegateId } })
      }
    }
    console.log(`   ✅ Delegados actualizados`)

    // ── 20. JuntaMember ──
    console.log('📋 Migrando JuntaMembers...')
    const juntas = await source.juntaMember.findMany()
    for (const j of juntas) {
      await target.juntaMember.upsert({ where: { id: j.id }, update: j, create: j })
    }
    console.log(`   ✅ ${juntas.length} miembros junta`)

    // ── 21. Charge ──
    console.log('📋 Migrando Charges...')
    const charges = await source.charge.findMany()
    for (const c of charges) {
      await target.charge.upsert({ where: { id: c.id }, update: c, create: c })
    }
    console.log(`   ✅ ${charges.length} cargos`)

    // ── 22. Payment ──
    console.log('📋 Migrando Payments...')
    const payments = await source.payment.findMany()
    for (const p of payments) {
      await target.payment.upsert({ where: { id: p.id }, update: p, create: p })
    }
    console.log(`   ✅ ${payments.length} pagos`)

    // ── 23. Notification ──
    console.log('📋 Migrando Notifications...')
    const notifs = await source.notification.findMany()
    for (const n of notifs) {
      await target.notification.upsert({ where: { id: n.id }, update: n, create: n })
    }
    console.log(`   ✅ ${notifs.length} notificaciones`)

    // ── 24. Meeting ──
    console.log('📋 Migrando Meetings...')
    const meetings = await source.meeting.findMany()
    for (const m of meetings) {
      await target.meeting.upsert({ where: { id: m.id }, update: m, create: m })
    }
    console.log(`   ✅ ${meetings.length} reuniones`)

    // ── 25. Attendance ──
    console.log('📋 Migrando Attendances...')
    const attendances = await source.attendance.findMany()
    for (const a of attendances) {
      await target.attendance.upsert({ where: { id: a.id }, update: a, create: a })
    }
    console.log(`   ✅ ${attendances.length} asistencias`)

    // ── 26. Nota ──
    console.log('📋 Migrando Notas...')
    const notas = await source.nota.findMany()
    for (const n of notas) {
      await target.nota.upsert({ where: { id: n.id }, update: n, create: n })
    }
    console.log(`   ✅ ${notas.length} notas`)

    // ── 27. Task ──
    console.log('📋 Migrando Tasks...')
    const tasks = await source.task.findMany()
    for (const t of tasks) {
      await target.task.upsert({ where: { id: t.id }, update: t, create: t })
    }
    console.log(`   ✅ ${tasks.length} tareas`)

    // ── 28. TaskSubmission ──
    console.log('📋 Migrando TaskSubmissions...')
    const submissions = await source.taskSubmission.findMany()
    for (const s of submissions) {
      await target.taskSubmission.upsert({ where: { id: s.id }, update: s, create: s })
    }
    console.log(`   ✅ ${submissions.length} entregas`)

    console.log('\n─────────────────────────────────────')
    console.log('🎉 Migración completada exitosamente!')
    console.log('─────────────────────────────────────')

  } catch (err) {
    console.error('\n❌ Error durante la migración:', err)
  } finally {
    await source.$disconnect()
    await target.$disconnect()
  }
}

migrate()