// ─────────────────────────────────────────────────────────────
// Script: migrate-real-data-to-prod.ts
//
// Copia los datos reales de la U.E. Naciones Unidas (schoolId=1)
// desde la BD local de desarrollo hacia producción (Railway).
//
// Reglas de seguridad:
//   - Solo upsert (create/update), NUNCA delete/truncate.
//   - NUNCA toca la tabla User (ya existe correcta en producción).
//   - Filtra explícitamente por schoolId=1 (o su relación padre) en
//     cada tabla, para excluir el colegio de prueba (id=2, Simon Bolivar)
//     creado durante las pruebas de multi-tenencia.
//   - Re-ejecutable: si se corta a mitad de camino, se puede volver a
//     correr sin duplicar nada (upsert por id).
//
// Uso:
//   1. $env:SOURCE_DATABASE_URL="postgresql://...local dev..."
//   2. $env:TARGET_DATABASE_URL="postgresql://...railway proxy..."
//   3. npx ts-node src/scripts/migrate-real-data-to-prod.ts
// ─────────────────────────────────────────────────────────────

import { PrismaClient } from '@prisma/client'

const source = new PrismaClient({ datasources: { db: { url: process.env.SOURCE_DATABASE_URL } } })
const target = new PrismaClient({ datasources: { db: { url: process.env.TARGET_DATABASE_URL } } })

const SCHOOL_ID = 1

async function copy<T extends { id: number }>(
  label: string,
  rows: T[],
  upsert: (row: T) => Promise<unknown>,
) {
  console.log(`📋 ${label}: ${rows.length} filas...`)
  for (const row of rows) await upsert(row)
  console.log(`   ✅ ${label} listo (${rows.length})`)
}

async function migrate() {
  console.log('🚀 Migrando datos reales de U.E. Naciones Unidas (schoolId=1) a producción...\n')

  try {
    const academicYears = await source.academicYear.findMany({ where: { schoolId: SCHOOL_ID } })
    await copy('AcademicYear', academicYears, y => target.academicYear.upsert({ where: { id: y.id }, update: y, create: y }))

    const trimesters = await source.trimester.findMany({ where: { academicYear: { schoolId: SCHOOL_ID } } })
    await copy('Trimester', trimesters, t => target.trimester.upsert({ where: { id: t.id }, update: t, create: t }))

    const holidays = await source.holiday.findMany({ where: { academicYear: { schoolId: SCHOOL_ID } } })
    await copy('Holiday', holidays, h => target.holiday.upsert({ where: { id: h.id }, update: h, create: h }))

    const shiftDirectors = await source.shiftDirector.findMany({ where: { schoolId: SCHOOL_ID } })
    await copy('ShiftDirector', shiftDirectors, d => target.shiftDirector.upsert({ where: { id: d.id }, update: d, create: d }))

    const subjects = await source.subject.findMany({ where: { schoolId: SCHOOL_ID } })
    await copy('Subject', subjects, s => target.subject.upsert({ where: { id: s.id }, update: s, create: s }))

    const sgcs = await source.subjectGradeConfig.findMany({ where: { subject: { schoolId: SCHOOL_ID } } })
    await copy('SubjectGradeConfig', sgcs, s => target.subjectGradeConfig.upsert({ where: { id: s.id }, update: s, create: s }))

    const classrooms = await source.classroom.findMany({ where: { schoolId: SCHOOL_ID } })
    await copy('Classroom', classrooms, c => target.classroom.upsert({ where: { id: c.id }, update: c, create: c }))

    const courses = await source.course.findMany({ where: { schoolId: SCHOOL_ID } })
    await copy('Course (sin delegateId)', courses, c => {
      const { delegateId, ...rest } = c
      return target.course.upsert({ where: { id: c.id }, update: { ...rest, delegateId: null }, create: { ...rest, delegateId: null } })
    })

    const staff = await source.staff.findMany({ where: { schoolId: SCHOOL_ID } })
    await copy('Staff', staff, s => target.staff.upsert({ where: { id: s.id }, update: s, create: s }))

    const teachers = await source.teacher.findMany({ where: { schoolId: SCHOOL_ID } })
    await copy('Teacher', teachers, t => target.teacher.upsert({ where: { id: t.id }, update: t, create: t }))

    const specialties = await source.teacherSpecialty.findMany({ where: { teacher: { schoolId: SCHOOL_ID } } })
    await copy('TeacherSpecialty', specialties, s => target.teacherSpecialty.upsert({ where: { id: s.id }, update: s, create: s }))

    const courseTutors = await source.courseTutor.findMany({ where: { course: { schoolId: SCHOOL_ID } } })
    await copy('CourseTutor', courseTutors, t => target.courseTutor.upsert({ where: { id: t.id }, update: t, create: t }))

    const tscs = await source.teacherSubjectCourse.findMany({ where: { teacher: { schoolId: SCHOOL_ID } } })
    await copy('TeacherSubjectCourse', tscs, t => target.teacherSubjectCourse.upsert({ where: { id: t.id }, update: t, create: t }))

    const schedules = await source.schedule.findMany({ where: { schoolId: SCHOOL_ID } })
    await copy('Schedule', schedules, s => target.schedule.upsert({ where: { id: s.id }, update: s, create: s }))

    const schedulePlans = await source.schedulePlan.findMany({ where: { schoolId: SCHOOL_ID } })
    await copy('SchedulePlan', schedulePlans, s => target.schedulePlan.upsert({ where: { id: s.id }, update: s, create: s }))

    const parents = await source.parent.findMany({ where: { schoolId: SCHOOL_ID } })
    await copy('Parent', parents, p => target.parent.upsert({ where: { id: p.id }, update: p, create: p }))

    const students = await source.student.findMany({ where: { schoolId: SCHOOL_ID } })
    await copy('Student', students, s => target.student.upsert({ where: { id: s.id }, update: s, create: s }))

    const parentStudents = await source.parentStudent.findMany({ where: { parent: { schoolId: SCHOOL_ID }, student: { schoolId: SCHOOL_ID } } })
    await copy('ParentStudent', parentStudents, p => target.parentStudent.upsert({ where: { id: p.id }, update: p, create: p }))

    const assignments = await source.studentAcademicAssignment.findMany({ where: { student: { schoolId: SCHOOL_ID } } })
    await copy('StudentAcademicAssignment', assignments, a => target.studentAcademicAssignment.upsert({ where: { id: a.id }, update: a, create: a }))

    console.log('📋 Restaurando delegateId en Course...')
    let delegatesRestored = 0
    for (const c of courses) {
      if (c.delegateId) {
        await target.course.update({ where: { id: c.id }, data: { delegateId: c.delegateId } })
        delegatesRestored++
      }
    }
    console.log(`   ✅ ${delegatesRestored} delegados restaurados`)

    const juntaMembers = await source.juntaMember.findMany({ where: { schoolId: SCHOOL_ID } })
    await copy('JuntaMember', juntaMembers, j => target.juntaMember.upsert({ where: { id: j.id }, update: j, create: j }))

    const charges = await source.charge.findMany({ where: { schoolId: SCHOOL_ID } })
    await copy('Charge', charges, c => target.charge.upsert({ where: { id: c.id }, update: c, create: c }))

    const payments = await source.payment.findMany({ where: { schoolId: SCHOOL_ID } })
    await copy('Payment', payments, p => target.payment.upsert({ where: { id: p.id }, update: p, create: p }))

    const notifications = await source.notification.findMany({ where: { schoolId: SCHOOL_ID } })
    await copy('Notification', notifications, n => target.notification.upsert({ where: { id: n.id }, update: n, create: n }))

    const meetings = await source.meeting.findMany({ where: { schoolId: SCHOOL_ID } })
    await copy('Meeting', meetings, m => target.meeting.upsert({ where: { id: m.id }, update: m, create: m }))

    const attendances = await source.attendance.findMany({ where: { meeting: { schoolId: SCHOOL_ID } } })
    await copy('Attendance', attendances, a => target.attendance.upsert({ where: { id: a.id }, update: a, create: a }))

    const tasks = await source.task.findMany({ where: { schoolId: SCHOOL_ID } })
    await copy('Task', tasks, t => target.task.upsert({ where: { id: t.id }, update: t, create: t }))

    const notas = await source.nota.findMany({ where: { schoolId: SCHOOL_ID } })
    await copy('Nota', notas, n => target.nota.upsert({ where: { id: n.id }, update: n, create: n }))

    const notaItems = await source.notaItem.findMany({ where: { nota: { schoolId: SCHOOL_ID } } })
    await copy('NotaItem', notaItems, n => target.notaItem.upsert({ where: { id: n.id }, update: n, create: n }))

    const submissions = await source.taskSubmission.findMany({ where: { task: { schoolId: SCHOOL_ID } } })
    await copy('TaskSubmission', submissions, s => target.taskSubmission.upsert({ where: { id: s.id }, update: s, create: s }))

    const gateRecords = await source.gateRecord.findMany({ where: { schoolId: SCHOOL_ID } })
    await copy('GateRecord', gateRecords, g => target.gateRecord.upsert({ where: { id: g.id }, update: g, create: g }))

    const teacherAttendances = await source.teacherAttendance.findMany({ where: { schoolId: SCHOOL_ID } })
    await copy('TeacherAttendance', teacherAttendances, t => target.teacherAttendance.upsert({ where: { id: t.id }, update: t, create: t }))

    const studentAttendances = await source.studentAttendance.findMany({ where: { schoolId: SCHOOL_ID } })
    await copy('StudentAttendance', studentAttendances, s => target.studentAttendance.upsert({ where: { id: s.id }, update: s, create: s }))

    const biometrics = await source.biometricTemplate.findMany({ where: { schoolId: SCHOOL_ID } })
    await copy('BiometricTemplate', biometrics, b => target.biometricTemplate.upsert({ where: { id: b.id }, update: b, create: b }))

    console.log('\n─────────────────────────────────────')
    console.log('🎉 Migración completada exitosamente!')
    console.log('─────────────────────────────────────')
  } catch (err) {
    console.error('\n❌ Error durante la migración:', err)
    process.exitCode = 1
  } finally {
    await source.$disconnect()
    await target.$disconnect()
  }
}

migrate()
