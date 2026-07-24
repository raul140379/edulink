/**
 * Models that carry a required `schoolId` column — every request scoped to a
 * single school gets that value auto-injected into `where`/`data` by the
 * Prisma extension in `lib/prisma.ts`.
 */
export const DIRECT_SCHOOL_SCOPED_MODELS = new Set([
  'SchoolSchedule',
  'ShiftDirector',
  'AcademicYear',
  'Parent',
  'Student',
  'Teacher',
  'Staff',
  'Course',
  'Classroom',
  'Subject',
  'Charge',
  'Payment',
  'Notification',
  'Meeting',
  'Task',
  'Nota',
  'Schedule',
  'SchedulePlan',
  'GateRecord',
  'TeacherAttendance',
  'StudentAttendance',
  'BiometricTemplate',
])

/**
 * Models that carry BOTH a nullable `schoolId` and a nullable `districtId`
 * (mutually exclusive) — used for users/roles that can live at either the
 * school level or the district level (User, JuntaMember).
 */
export const DUAL_SCOPED_MODELS = new Set(['User', 'JuntaMember'])
