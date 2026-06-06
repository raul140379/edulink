// Definición de roles del sistema
export enum Role {
  SUPER_ADMIN  = 'SUPER_ADMIN',
  DIRECTOR     = 'DIRECTOR',
  REGENTE      = 'REGENTE',
  SECRETARY    = 'SECRETARY',
  TEACHER      = 'TEACHER',
  TEACHER_TUTOR = 'TEACHER_TUTOR', 
  DELEGATE     = 'DELEGATE',
   JUNTA_ESCOLAR = 'JUNTA_ESCOLAR',  // ← AGREGA
  PARENT       = 'PARENT',
  STUDENT      = 'STUDENT',
  STUDENT_GOV  = 'STUDENT_GOV',
  STAFF        = 'STAFF',
}

// Definición de todos los permisos del sistema
export enum Permission {
  // Usuarios
  USER_CREATE        = 'user:create',
  USER_VIEW_ALL      = 'user:view:all',
  USER_EDIT_OWN      = 'user:edit:own',

  // Estudiantes
  STUDENT_CREATE     = 'student:create',
  STUDENT_VIEW_ALL   = 'student:view:all',
  STUDENT_VIEW_OWN   = 'student:view:own',
  STUDENT_VERIFY     = 'student:verify',       // Solo portero

  // Padres y tutores
  PARENT_CREATE      = 'parent:create',
  PARENT_VIEW_ALL    = 'parent:view:all',
  PARENT_VERIFY      = 'parent:verify',        // Solo portero

  // Cursos
  COURSE_CREATE      = 'course:create',
  COURSE_VIEW_ALL    = 'course:view:all',
  COURSE_VIEW_OWN    = 'course:view:own',      // Maestro ve solo sus cursos

  // Inscripciones
  ENROLLMENT_CREATE  = 'enrollment:create',
  ENROLLMENT_VIEW    = 'enrollment:view',

  // Notas
  GRADE_CREATE       = 'grade:create',
  GRADE_VIEW_ALL     = 'grade:view:all',
  GRADE_VIEW_OWN     = 'grade:view:own',       // Padre/estudiante ven las propias

  // Asistencia
  ATTENDANCE_CREATE  = 'attendance:create',
  ATTENDANCE_VIEW    = 'attendance:view',

  // Horarios
  SCHEDULE_CREATE    = 'schedule:create',
  SCHEDULE_VIEW_ALL  = 'schedule:view:all',
  SCHEDULE_VIEW_OWN  = 'schedule:view:own',    // Maestro/padre/estudiante

  // Tesorería
  CHARGE_CREATE      = 'charge:create',
  CHARGE_VIEW_ALL    = 'charge:view:all',
  CHARGE_VIEW_OWN    = 'charge:view:own',      // Padre ve sus propios cobros

  // Notificaciones
  NOTIFICATION_SEND  = 'notification:send',
  NOTIFICATION_VIEW  = 'notification:view',

  // Reportes
  REPORT_VIEW        = 'report:view',
  REPORT_GENERATE    = 'report:generate',
}

// Mapa de permisos por rol
export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {

  [Role.SUPER_ADMIN]: Object.values(Permission), // Acceso total

  [Role.DIRECTOR]: [
    Permission.USER_CREATE,
    Permission.USER_VIEW_ALL,
    Permission.USER_EDIT_OWN,
    Permission.STUDENT_CREATE,
    Permission.STUDENT_VIEW_ALL,
    Permission.PARENT_CREATE,
    Permission.PARENT_VIEW_ALL,
    Permission.COURSE_CREATE,
    Permission.COURSE_VIEW_ALL,
    Permission.ENROLLMENT_CREATE,
    Permission.ENROLLMENT_VIEW,
    Permission.GRADE_VIEW_ALL,
    Permission.ATTENDANCE_VIEW,
    Permission.SCHEDULE_CREATE,
    Permission.SCHEDULE_VIEW_ALL,
    Permission.CHARGE_CREATE,
    Permission.CHARGE_VIEW_ALL,
    Permission.NOTIFICATION_SEND,
    Permission.NOTIFICATION_VIEW,
    Permission.REPORT_VIEW,
    Permission.REPORT_GENERATE,
  ],

  [Role.REGENTE]: [
    Permission.USER_EDIT_OWN,
    Permission.STUDENT_CREATE,
    Permission.STUDENT_VIEW_ALL,
    Permission.PARENT_CREATE,
    Permission.PARENT_VIEW_ALL,
    Permission.COURSE_VIEW_ALL,
    Permission.ENROLLMENT_CREATE,
    Permission.ENROLLMENT_VIEW,
    Permission.GRADE_VIEW_ALL,
    Permission.ATTENDANCE_VIEW,
    Permission.SCHEDULE_VIEW_ALL,
    Permission.NOTIFICATION_SEND,
    Permission.NOTIFICATION_VIEW,
    Permission.REPORT_VIEW,
  ],

  [Role.SECRETARY]: [
    Permission.USER_CREATE,
    Permission.USER_VIEW_ALL,
    Permission.USER_EDIT_OWN,
    Permission.STUDENT_CREATE,
    Permission.STUDENT_VIEW_ALL,
    Permission.PARENT_CREATE,
    Permission.PARENT_VIEW_ALL,
    Permission.COURSE_CREATE,
    Permission.COURSE_VIEW_ALL,
    Permission.ENROLLMENT_CREATE,
    Permission.ENROLLMENT_VIEW,
    Permission.GRADE_VIEW_ALL,
    Permission.ATTENDANCE_VIEW,
    Permission.SCHEDULE_VIEW_ALL,
    Permission.CHARGE_CREATE,
    Permission.CHARGE_VIEW_ALL,
    Permission.NOTIFICATION_SEND,
    Permission.NOTIFICATION_VIEW,
    Permission.REPORT_VIEW,
    Permission.REPORT_GENERATE,
  ],

  [Role.TEACHER]: [
    Permission.USER_EDIT_OWN,
    Permission.STUDENT_VIEW_ALL,    // Solo estudiantes de sus cursos (filtrado en servicio)
    Permission.COURSE_VIEW_OWN,     // Solo sus cursos asignados
    Permission.ENROLLMENT_VIEW,
    Permission.GRADE_CREATE,
    Permission.GRADE_VIEW_ALL,
    Permission.ATTENDANCE_CREATE,
    Permission.ATTENDANCE_VIEW,
    Permission.SCHEDULE_VIEW_OWN,
    Permission.NOTIFICATION_SEND,
    Permission.NOTIFICATION_VIEW,
    Permission.REPORT_VIEW,
  ],
  [Role.TEACHER_TUTOR]: [
  Permission.USER_EDIT_OWN,
  Permission.STUDENT_VIEW_ALL,    // Estudiantes de su curso
  Permission.COURSE_VIEW_OWN,     // Solo su curso asignado
  Permission.ENROLLMENT_VIEW,
  Permission.GRADE_CREATE,
  Permission.GRADE_VIEW_ALL,
  Permission.ATTENDANCE_CREATE,
  Permission.ATTENDANCE_VIEW,
  Permission.SCHEDULE_VIEW_OWN,
  Permission.NOTIFICATION_SEND,
  Permission.NOTIFICATION_VIEW,
  Permission.REPORT_VIEW,
],
  [Role.DELEGATE]: [
    Permission.USER_EDIT_OWN,
    Permission.PARENT_CREATE,
    Permission.PARENT_VIEW_ALL,
    Permission.COURSE_VIEW_ALL,
    Permission.ENROLLMENT_VIEW,
    Permission.CHARGE_CREATE,
    Permission.CHARGE_VIEW_ALL,
    Permission.NOTIFICATION_VIEW,
    Permission.REPORT_VIEW,
  ],
  [Role.JUNTA_ESCOLAR]: [
  Permission.USER_EDIT_OWN,
  Permission.PARENT_CREATE,
  Permission.PARENT_VIEW_ALL,
  Permission.COURSE_VIEW_ALL,
  Permission.ENROLLMENT_VIEW,
  Permission.CHARGE_CREATE,
  Permission.CHARGE_VIEW_ALL,
  Permission.NOTIFICATION_SEND,
  Permission.NOTIFICATION_VIEW,
  Permission.REPORT_VIEW,
  Permission.REPORT_GENERATE,
],
  [Role.PARENT]: [
    Permission.USER_EDIT_OWN,
    Permission.STUDENT_VIEW_OWN,    // Solo sus hijos
    Permission.GRADE_VIEW_OWN,      // Solo notas de sus hijos
    Permission.SCHEDULE_VIEW_OWN,   // Solo horario de sus hijos
    Permission.CHARGE_VIEW_OWN,     // Solo sus propios cobros
    Permission.NOTIFICATION_VIEW,
  ],

  [Role.STUDENT]: [
    Permission.USER_EDIT_OWN,
    Permission.STUDENT_VIEW_OWN,    // Solo su propia ficha
    Permission.GRADE_VIEW_OWN,      // Solo sus propias notas
    Permission.SCHEDULE_VIEW_OWN,   // Solo su propio horario
    Permission.NOTIFICATION_VIEW,
  ],

  [Role.STUDENT_GOV]: [
    Permission.USER_EDIT_OWN,
    Permission.STUDENT_VIEW_OWN,
    Permission.GRADE_VIEW_OWN,
    Permission.SCHEDULE_VIEW_OWN,
    Permission.NOTIFICATION_VIEW,
    Permission.NOTIFICATION_SEND,
  ],

  [Role.STAFF]: [
    Permission.STUDENT_VERIFY,      // Solo verificar si es estudiante de la UE
    Permission.PARENT_VERIFY,       // Solo verificar si es padre de la UE
  ],
}

// Función helper para verificar si un rol tiene un permiso
export const hasPermission = (role: Role, permission: Permission): boolean => {
  const permissions = ROLE_PERMISSIONS[role]
  if (!permissions) return false
  return permissions.includes(permission)
}