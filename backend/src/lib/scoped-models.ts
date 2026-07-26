import { Role } from '../config/permissions'

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
  'PoaActa',
])

/**
 * Models that carry `schoolId`/`nucleoId`/`districtId`, all nullable and
 * mutually exclusive — used for users/roles that can live at the school,
 * núcleo, or district level (User, JuntaMember, GobiernoMember).
 */
export const TENANT_SCOPED_MODELS = new Set(['User', 'JuntaMember', 'GobiernoMember'])

// Nota: tipados como Set<string> (no Set<Role>) a propósito — este set se consulta
// tanto con el `Role` de config/permissions.ts (usado por TenantContext) como con el
// `Role` generado por Prisma (@prisma/client) en algunos servicios; ambos enums tienen
// los mismos valores de string pero son tipos nominales distintos para TypeScript.

/** Roles whose own account lives at district scope, and who read/write across their whole district. */
export const DISTRICT_WIDE_ROLES: Set<string> = new Set([Role.DIRECTOR_DISTRITAL, Role.JUNTA_DISTRITO, Role.GOBIERNO_DISTRITO])

/** Roles whose own account lives at núcleo scope, and who read/write across their whole núcleo. */
export const NUCLEO_WIDE_ROLES: Set<string> = new Set([Role.JUNTA_NUCLEO, Role.GOBIERNO_NUCLEO])
