// Definición de roles del sistema
export enum Role {
  SUPER_ADMIN        = 'SUPER_ADMIN',
  DIRECTOR_DISTRITAL = 'DIRECTOR_DISTRITAL',
  DIRECTOR     = 'DIRECTOR',
  REGENTE      = 'REGENTE',
  SECRETARY    = 'SECRETARY',
  TEACHER      = 'TEACHER',
  TEACHER_TUTOR = 'TEACHER_TUTOR',
  DELEGATE     = 'DELEGATE',
  JUNTA_ESCOLAR = 'JUNTA_ESCOLAR',
  JUNTA_NUCLEO  = 'JUNTA_NUCLEO',
  JUNTA_DISTRITO = 'JUNTA_DISTRITO',
  GOBIERNO_NUCLEO   = 'GOBIERNO_NUCLEO',
  GOBIERNO_DISTRITO = 'GOBIERNO_DISTRITO',
  PARENT       = 'PARENT',
  STUDENT      = 'STUDENT',
  STUDENT_GOV  = 'STUDENT_GOV',
  STAFF        = 'STAFF',
  PORTERO      = 'PORTERO',
  PSICOLOGO    = 'PSICOLOGO',
}

// Definición de todos los permisos del sistema
export enum Permission {
  // Usuarios
  USER_CREATE        = 'user:create',
  USER_VIEW_ALL      = 'user:view:all',
  USER_EDIT_OWN      = 'user:edit:own',

  // Estudiantes
  STUDENT_CREATE        = 'student:create',
  STUDENT_VIEW_ALL      = 'student:view:all',
  STUDENT_VIEW_BASIC    = 'student:view:basic',   // Vista reducida (nombre, colegio, padre, dirección) — Junta de Núcleo/Distrito
  STUDENT_VIEW_OWN      = 'student:view:own',
  STUDENT_VERIFY        = 'student:verify',       // Solo portero
  STUDENT_TOGGLE_STATUS = 'student:toggle-status', // Activar/desactivar (ej. "retirado") sin crear/editar/borrar — Junta Escolar, desde Verificación por Curso

  // Juegos Estudiantiles Municipales — registro de estudiantes por disciplina
  SPORTS_MANAGE = 'sports:manage',

  // Maestros
  TEACHER_CREATE     = 'teacher:create',
  TEACHER_VIEW_ALL   = 'teacher:view:all',

  // Padres y tutores
  PARENT_CREATE       = 'parent:create',
  // Vincular un padre YA EXISTENTE a un estudiante / cambiar tutor (matrícula,
  // cambio de gestión) — separado de PARENT_CREATE porque Director/Regente/
  // Secretaria conservan esta capacidad aunque ya no puedan registrar padres
  // nuevos (eso pasa a ser responsabilidad exclusiva de Junta Escolar/Delegado).
  PARENT_ASSIGN_TUTOR = 'parent:assign-tutor',
  PARENT_VIEW_ALL     = 'parent:view:all',
  PARENT_VERIFY       = 'parent:verify',        // Solo portero

  // Portería
  GATE_REGISTER      = 'gate:register',        // Registrar ingreso/salida (maestro, administrativo, visitante/padre)
  GATE_VIEW          = 'gate:view',            // Ver esperados del día, historial de registros, buscar por código
  GATE_CODES_MANAGE  = 'gate:codes:manage',    // Generar/ver/regenerar códigos de asistencia (maestro, personal)

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
  ATTENDANCE_CREATE       = 'attendance:create',
  ATTENDANCE_VIEW         = 'attendance:view',
  TEACHER_ATTENDANCE_MANAGE = 'teacher-attendance:manage', // Corregir/marcar ausente asistencia de maestros (admin)

  // Horarios
  SCHEDULE_CREATE    = 'schedule:create',
  SCHEDULE_VIEW_ALL  = 'schedule:view:all',
  SCHEDULE_VIEW_OWN  = 'schedule:view:own',    // Maestro/padre/estudiante

  // Tesorería
  CHARGE_CREATE      = 'charge:create',
  CHARGE_VIEW_ALL    = 'charge:view:all',
  CHARGE_VIEW_OWN    = 'charge:view:own',      // Padre ve sus propios cobros
  TREASURY_CLOSE_PERIOD = 'treasury:close-period', // Cerrar/reabrir económicamente una gestión — solo Junta Escolar

  // Notificaciones
  NOTIFICATION_SEND  = 'notification:send',
  NOTIFICATION_VIEW  = 'notification:view',

  // Reuniones
  MEETING_CREATE     = 'meeting:create',       // Crear/editar/eliminar reuniones y su asistencia
  MEETING_VIEW       = 'meeting:view',

  // Delegados de curso
  DELEGATE_MANAGE    = 'delegate:manage',      // Asignar/remover delegado, ver lista (Junta Escolar)
  DELEGATE_VIEW_OWN  = 'delegate:view:own',    // El propio delegado ve su curso asignado

  // Gestión académica (años, trimestres, feriados)
  ACADEMIC_VIEW           = 'academic:view',
  ACADEMIC_MANAGE         = 'academic:manage',          // Crear/editar gestión, trimestres, feriados
  ACADEMIC_TRIMESTER_CLOSE = 'academic:trimester:close', // Cerrar/reabrir trimestre — solo Director

  // Reportes
  REPORT_VIEW        = 'report:view',
  REPORT_GENERATE    = 'report:generate',

  // Distrito / unidades educativas
  SCHOOL_CREATE      = 'school:create',
  SCHOOL_VIEW_ALL    = 'school:view:all',
  DISTRICT_MANAGE    = 'district:manage',      // Editar datos/marca del distrito (asistente de configuración)

  // Comunicados del distrito (portal público)
  COMUNICADO_CREATE  = 'comunicado:create',
  COMUNICADO_VIEW    = 'comunicado:view',

  // Junta de Padres / Gobierno Estudiantil (Núcleo, Distrito y ahora también
  // Escolar) — alta/edición de los miembros de la junta directiva
  JUNTA_MANAGE       = 'junta:manage',
  GOBIERNO_MANAGE    = 'gobierno:manage',

  // Convocatoria (Junta Escolar) — asamblea ordinaria/emergencia o actividad
  // planificada, con asistencia y multa automática
  CONVOCATORIA_CREATE = 'convocatoria:create',
  CONVOCATORIA_VIEW   = 'convocatoria:view',
}

// Mapa de permisos por rol
export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {

  [Role.SUPER_ADMIN]: Object.values(Permission), // Acceso total

  [Role.DIRECTOR_DISTRITAL]: [
    // Administra todas las unidades educativas del distrito
    Permission.SCHOOL_CREATE,
    Permission.SCHOOL_VIEW_ALL,
    Permission.USER_CREATE,
    Permission.USER_VIEW_ALL,
    Permission.USER_EDIT_OWN,
    Permission.STUDENT_VIEW_ALL,
    Permission.TEACHER_VIEW_ALL,
    Permission.PARENT_VIEW_ALL,
    Permission.COURSE_VIEW_ALL,
    Permission.GRADE_VIEW_ALL,
    Permission.ATTENDANCE_VIEW,
    Permission.SCHEDULE_VIEW_ALL,
    // Sin CHARGE_VIEW_ALL a propósito: la Tesorería de cada Junta Escolar es
    // exclusiva de esa UE — el Director Distrital nunca debe verla, ni
    // siquiera de solo lectura (ver invariante de Tesorería en CLAUDE.md).
    Permission.NOTIFICATION_SEND,
    Permission.NOTIFICATION_VIEW,
    Permission.REPORT_VIEW,
    Permission.REPORT_GENERATE,
    Permission.ACADEMIC_VIEW,
    Permission.COMUNICADO_CREATE,
    Permission.COMUNICADO_VIEW,
    Permission.DISTRICT_MANAGE,
    Permission.JUNTA_MANAGE,
    Permission.GOBIERNO_MANAGE,
  ],

  [Role.DIRECTOR]: [
    Permission.USER_CREATE,
    Permission.USER_VIEW_ALL,
    Permission.USER_EDIT_OWN,
    Permission.STUDENT_CREATE,
    Permission.STUDENT_VIEW_ALL,
    Permission.SPORTS_MANAGE,
    Permission.TEACHER_CREATE,
    Permission.TEACHER_VIEW_ALL,
    // Sin PARENT_CREATE: registrar un padre nuevo es responsabilidad exclusiva
    // de Junta Escolar/Delegado. Director conserva solo asignar/cambiar tutor
    // (matrícula, cambio de gestión) usando un padre ya registrado.
    Permission.PARENT_ASSIGN_TUTOR,
    Permission.PARENT_VIEW_ALL,
    Permission.COURSE_CREATE,
    Permission.COURSE_VIEW_ALL,
    Permission.ENROLLMENT_CREATE,
    Permission.ENROLLMENT_VIEW,
    Permission.GRADE_VIEW_ALL,
    Permission.ATTENDANCE_VIEW,
    // Único rol admin con autoridad para registrar/corregir asistencia sin
    // la ventana horaria estricta que sí aplica a TEACHER/TEACHER_TUTOR (ver
    // studentAttendance.service.ts) — pantalla dedicada pendiente, backend
    // ya preparado.
    Permission.ATTENDANCE_CREATE,
    Permission.SCHEDULE_CREATE,
    Permission.SCHEDULE_VIEW_ALL,
    // Sin CHARGE_CREATE: la parte administrativa no maneja recursos, eso lo administra
    // la Junta Escolar de padres. Director solo puede ver el estado de tesorería.
    Permission.CHARGE_VIEW_ALL,
    Permission.NOTIFICATION_SEND,
    Permission.NOTIFICATION_VIEW,
    Permission.REPORT_VIEW,
    Permission.REPORT_GENERATE,
    // Portería — requireStaff ya lo autoriza, estos permisos lo alinean
    Permission.GATE_REGISTER,
    Permission.GATE_VIEW,
    Permission.GATE_CODES_MANAGE,
    Permission.STUDENT_VERIFY,
    Permission.PARENT_VERIFY,
    Permission.TEACHER_ATTENDANCE_MANAGE,
    // Gestión académica: única con permiso para cerrar/reabrir trimestres
    Permission.ACADEMIC_VIEW,
    Permission.ACADEMIC_MANAGE,
    Permission.ACADEMIC_TRIMESTER_CLOSE,
  ],

  [Role.REGENTE]: [
    Permission.USER_EDIT_OWN,
    Permission.STUDENT_CREATE,
    Permission.STUDENT_VIEW_ALL,
    Permission.SPORTS_MANAGE,
    // Sin TEACHER_CREATE: contratar/registrar un maestro nuevo queda como decisión de Dirección.
    Permission.TEACHER_VIEW_ALL,
    // Sin PARENT_CREATE: ver DIRECTOR arriba — Regente solo asigna/cambia tutor.
    Permission.PARENT_ASSIGN_TUTOR,
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
    Permission.TEACHER_ATTENDANCE_MANAGE,
    // Solo ver tesorería — administrarla es función de la Junta Escolar de padres.
    Permission.CHARGE_VIEW_ALL,
  ],

  // Personal administrativo de apoyo psicopedagógico — alcance de solo
  // lectura (ficha del estudiante, asistencia, notas) + notificación puntual
  // a padres. Sin CHARGE_VIEW_ALL a propósito: no está en la lista de
  // excepciones del invariante de Tesorería (ver CLAUDE.md), así que no
  // tiene ningún acceso a esa área, ni de solo lectura. Tampoco
  // STUDENT_CREATE/PARENT_ASSIGN_TUTOR/COURSE_*/ATTENDANCE_CREATE — no
  // gestiona matrícula, tutores, cursos ni registra asistencia.
  [Role.PSICOLOGO]: [
    Permission.USER_EDIT_OWN,
    Permission.STUDENT_VIEW_ALL,
    Permission.ATTENDANCE_VIEW,
    Permission.GRADE_VIEW_ALL,
    Permission.NOTIFICATION_SEND,
    Permission.NOTIFICATION_VIEW,
  ],

  [Role.SECRETARY]: [
    // Sin USER_CREATE ni TEACHER_CREATE: crear cuentas de sistema (maestros, staff, otros roles) queda solo para Director/Admin.
    // STUDENT_CREATE ya cubre el flujo de matrícula (crea su propio User internamente) — el
    // padre/tutor ya tiene que existir de antemano (lo registra Junta Escolar/Delegado).
    Permission.USER_VIEW_ALL,
    Permission.USER_EDIT_OWN,
    Permission.STUDENT_CREATE,
    Permission.STUDENT_VIEW_ALL,
    Permission.SPORTS_MANAGE,
    Permission.TEACHER_VIEW_ALL,
    // Sin PARENT_CREATE: ver DIRECTOR arriba — Secretaria solo asigna/cambia tutor.
    Permission.PARENT_ASSIGN_TUTOR,
    Permission.PARENT_VIEW_ALL,
    Permission.COURSE_CREATE,
    Permission.COURSE_VIEW_ALL,
    Permission.ENROLLMENT_CREATE,
    Permission.ENROLLMENT_VIEW,
    Permission.GRADE_VIEW_ALL,
    Permission.ATTENDANCE_VIEW,
    // Mismo criterio que Director — exenta de la ventana horaria estricta.
    Permission.ATTENDANCE_CREATE,
    Permission.SCHEDULE_VIEW_ALL,
    // Sin CHARGE_CREATE: la administración de recursos es función exclusiva de la
    // Junta Escolar de padres. Secretaría solo puede ver el estado de tesorería.
    Permission.CHARGE_VIEW_ALL,
    Permission.NOTIFICATION_SEND,
    Permission.NOTIFICATION_VIEW,
    Permission.REPORT_VIEW,
    // Sin REPORT_GENERATE: reportes oficiales quedan para Director/Regente.
    Permission.TEACHER_ATTENDANCE_MANAGE,
    // Gestión académica: puede crear/editar año, trimestres y feriados, pero no cerrar trimestres (solo Director).
    Permission.ACADEMIC_VIEW,
    Permission.ACADEMIC_MANAGE,
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
    Permission.MEETING_CREATE,
    Permission.MEETING_VIEW,
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
  Permission.MEETING_CREATE,
  Permission.MEETING_VIEW,
  Permission.CHARGE_VIEW_OWN,     // Solo lectura del estado de cuenta de los tutores de su curso
],
  [Role.DELEGATE]: [
    Permission.USER_EDIT_OWN,
    Permission.PARENT_CREATE,
    Permission.PARENT_ASSIGN_TUTOR,
    Permission.PARENT_VIEW_ALL,
    Permission.COURSE_VIEW_ALL,
    Permission.ENROLLMENT_VIEW,
    Permission.CHARGE_CREATE,
    Permission.CHARGE_VIEW_ALL,
    Permission.NOTIFICATION_VIEW,
    Permission.REPORT_VIEW,
    Permission.MEETING_CREATE,
    Permission.MEETING_VIEW,
    Permission.DELEGATE_VIEW_OWN,
    Permission.ACADEMIC_VIEW,
  ],
  [Role.JUNTA_ESCOLAR]: [
  Permission.USER_EDIT_OWN,
  // Ver maestros, estudiantes y padres (representa al colectivo de padres de familia)
  Permission.TEACHER_VIEW_ALL,
  Permission.STUDENT_VIEW_ALL,
  // Marcar retirado/reactivar un estudiante desde Verificación por Curso —
  // angosto a propósito, no incluye crear/editar/borrar (eso sigue siendo de
  // Dirección/Regente/Secretaría vía STUDENT_CREATE).
  Permission.STUDENT_TOGGLE_STATUS,
  Permission.PARENT_CREATE,
  Permission.PARENT_ASSIGN_TUTOR,
  Permission.PARENT_VIEW_ALL,
  // Asistencia de maestros: ver reporte + corregir/marcar ausente
  Permission.ATTENDANCE_VIEW,
  Permission.TEACHER_ATTENDANCE_MANAGE,
  Permission.COURSE_VIEW_ALL,
  Permission.ENROLLMENT_VIEW,
  Permission.CHARGE_CREATE,
  Permission.CHARGE_VIEW_ALL,
  // Cerrar/reabrir económicamente una gestión (traslado de deuda pendiente a la
  // gestión activa) — exclusivo de Junta Escolar, independiente del cierre
  // académico (ACADEMIC_TRIMESTER_CLOSE, que es solo de Director).
  Permission.TREASURY_CLOSE_PERIOD,
  Permission.NOTIFICATION_SEND,
  Permission.NOTIFICATION_VIEW,
  Permission.COMUNICADO_CREATE,
  Permission.COMUNICADO_VIEW,
  Permission.REPORT_VIEW,
  Permission.REPORT_GENERATE,
  // Todas las acciones de un padre de familia (los miembros de junta son padres también)
  Permission.STUDENT_VIEW_OWN,
  Permission.GRADE_VIEW_OWN,
  Permission.SCHEDULE_VIEW_OWN,
  // Asignar/remover delegados de curso
  Permission.DELEGATE_MANAGE,
  Permission.ACADEMIC_VIEW,
  // Gestionar el directorio (Vicepresidente/Secretaria/Tesorero/Vocal) de su
  // propio colegio — acotado en junta.service.ts a solo el Presidente.
  Permission.JUNTA_MANAGE,
  // Convocar asamblea/actividad con asistencia y multa automática.
  Permission.CONVOCATORIA_CREATE,
  Permission.CONVOCATORIA_VIEW,
  // Crear/tomar asistencia de reuniones de cualquier curso del colegio —
  // acotado en meeting.service.ts a solo el Presidente.
  Permission.MEETING_CREATE,
  Permission.MEETING_VIEW,
],

  // Junta de Núcleo y de Distrito: mismo espíritu que JUNTA_ESCOLAR (ven a todos los
  // padres, pueden recaudar/convocar/comunicar), pero de estudiantes solo ven datos
  // básicos (nombre, colegio, padre, dirección) — STUDENT_VIEW_BASIC en vez de ALL,
  // dado el volumen de estudiantes que abarca un núcleo o un distrito entero.
  [Role.JUNTA_NUCLEO]: [
    Permission.USER_EDIT_OWN,
    Permission.USER_CREATE,      // Designa a la Junta Escolar de cada colegio de su núcleo
    Permission.SCHOOL_VIEW_ALL,
    Permission.PARENT_VIEW_ALL,
    Permission.STUDENT_VIEW_BASIC,
    Permission.CHARGE_CREATE,
    Permission.CHARGE_VIEW_ALL,
    Permission.MEETING_CREATE,
    Permission.MEETING_VIEW,
    Permission.NOTIFICATION_SEND,
    Permission.NOTIFICATION_VIEW,
    Permission.COMUNICADO_CREATE,
    Permission.COMUNICADO_VIEW,
    Permission.REPORT_VIEW,
    Permission.JUNTA_MANAGE,
  ],
  [Role.JUNTA_DISTRITO]: [
    Permission.USER_EDIT_OWN,
    Permission.USER_CREATE,      // Designa Junta de Núcleo y Junta Escolar
    Permission.SCHOOL_VIEW_ALL,
    Permission.PARENT_VIEW_ALL,
    Permission.STUDENT_VIEW_BASIC,
    Permission.CHARGE_CREATE,
    Permission.CHARGE_VIEW_ALL,
    Permission.MEETING_CREATE,
    Permission.MEETING_VIEW,
    Permission.NOTIFICATION_SEND,
    Permission.NOTIFICATION_VIEW,
    Permission.COMUNICADO_CREATE,
    Permission.COMUNICADO_VIEW,
    Permission.REPORT_VIEW,
    Permission.JUNTA_MANAGE,
  ],

  // Gobierno Estudiantil de Núcleo y de Distrito: contraparte estudiantil, ven a los
  // estudiantes completos (son su propia representación) pero no datos de padres.
  [Role.GOBIERNO_NUCLEO]: [
    Permission.USER_EDIT_OWN,
    Permission.USER_CREATE,      // Designa el Gobierno Estudiantil de cada colegio de su núcleo
    Permission.SCHOOL_VIEW_ALL,
    Permission.STUDENT_VIEW_ALL,
    // Sin CHARGE_CREATE/CHARGE_VIEW_ALL: la Tesorería es exclusividad total de
    // la Junta de Padres en sus 3 niveles — Gobierno Estudiantil nunca tiene
    // acceso a ninguna de las tres áreas de Tesorería, ni para crear ni para
    // ver (ver invariante de Tesorería en CLAUDE.md).
    Permission.MEETING_CREATE,
    Permission.MEETING_VIEW,
    Permission.NOTIFICATION_SEND,
    Permission.NOTIFICATION_VIEW,
    Permission.COMUNICADO_CREATE,
    Permission.COMUNICADO_VIEW,
    Permission.REPORT_VIEW,
    Permission.GOBIERNO_MANAGE,
  ],
  [Role.GOBIERNO_DISTRITO]: [
    Permission.USER_EDIT_OWN,
    Permission.USER_CREATE,      // Designa Gobierno de Núcleo y Gobierno Estudiantil de colegio
    Permission.SCHOOL_VIEW_ALL,
    Permission.STUDENT_VIEW_ALL,
    // Sin CHARGE_CREATE/CHARGE_VIEW_ALL — ver GOBIERNO_NUCLEO arriba.
    Permission.MEETING_CREATE,
    Permission.MEETING_VIEW,
    Permission.NOTIFICATION_SEND,
    Permission.NOTIFICATION_VIEW,
    Permission.COMUNICADO_CREATE,
    Permission.COMUNICADO_VIEW,
    Permission.REPORT_VIEW,
    Permission.GOBIERNO_MANAGE,
  ],

  [Role.PARENT]: [
    Permission.USER_EDIT_OWN,
    Permission.STUDENT_VIEW_OWN,    // Solo sus hijos
    Permission.GRADE_VIEW_OWN,      // Solo notas de sus hijos
    Permission.COURSE_VIEW_OWN,     // Solo el/los curso(s) de sus hijos (plan de materias/maestros)
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
    Permission.COMUNICADO_VIEW,     // Solo lectura — ve los comunicados de su colegio en Inicio
  ],

  [Role.STUDENT_GOV]: [
    Permission.USER_EDIT_OWN,
    Permission.STUDENT_VIEW_OWN,
    Permission.STUDENT_VIEW_ALL,    // Representa a todo el estudiantado (análogo a JUNTA_ESCOLAR con PARENT_VIEW_ALL)
    Permission.GRADE_VIEW_OWN,
    Permission.SCHEDULE_VIEW_OWN,
    Permission.NOTIFICATION_VIEW,
    Permission.NOTIFICATION_SEND,
    Permission.COMUNICADO_CREATE,
    Permission.COMUNICADO_VIEW,
    // Sin CHARGE_CREATE/CHARGE_VIEW_ALL — ver GOBIERNO_NUCLEO arriba (mismo
    // invariante: Tesorería es exclusiva de Junta de Padres, ningún nivel de
    // Gobierno Estudiantil tiene acceso).
    Permission.MEETING_CREATE,
    Permission.MEETING_VIEW,
  ],

  [Role.STAFF]: [
    Permission.STUDENT_VERIFY,      // Solo verificar si es estudiante de la UE
    Permission.PARENT_VERIFY,       // Solo verificar si es padre de la UE
  ],

  [Role.PORTERO]: [
    // Visualización de los 4 actores que controla en el ingreso
    Permission.USER_VIEW_ALL,       // ver estudiantes, maestros, padres y administrativos
    Permission.STUDENT_VIEW_ALL,
    Permission.TEACHER_VIEW_ALL,
    Permission.PARENT_VIEW_ALL,
    // Verificación de identidad en portería
    Permission.STUDENT_VERIFY,
    Permission.PARENT_VERIFY,
    // Registro de ingresos/salidas
    Permission.GATE_REGISTER,
    // Ver esperados del día e historial (no gestiona códigos: eso es solo Director)
    Permission.GATE_VIEW,
  ],
}

// Función helper para verificar si un rol tiene un permiso
export const hasPermission = (role: Role, permission: Permission): boolean => {
  const permissions = ROLE_PERMISSIONS[role]
  if (!permissions) return false
  return permissions.includes(permission)
}

// Jerarquía de designación: qué roles puede asignar cada rol al crear un usuario.
// Antes de esto, cualquiera con USER_CREATE podía asignar cualquier rol (incluido
// SUPER_ADMIN) — ver user.service.ts:createUser, que valida contra este mapa.
// SUPER_ADMIN queda fuera del mapa a propósito: sigue sin restricción (bypass total).
// Tipado como Partial<Record<string, string[]>> (no Role/Role[]) porque se consulta
// también con el Role generado por Prisma (@prisma/client), un tipo nominal distinto
// con los mismos valores de string.
export const CREATABLE_ROLES: Partial<Record<string, string[]>> = {
  [Role.DIRECTOR_DISTRITAL]: [
    Role.DIRECTOR, Role.REGENTE, Role.SECRETARY,
    Role.JUNTA_DISTRITO, Role.GOBIERNO_DISTRITO,
  ],
  [Role.DIRECTOR]: [
    Role.REGENTE, Role.SECRETARY, Role.PSICOLOGO, Role.TEACHER, Role.TEACHER_TUTOR,
    Role.STAFF, Role.PORTERO, Role.PARENT, Role.STUDENT,
    Role.DELEGATE, Role.JUNTA_ESCOLAR, Role.STUDENT_GOV,
  ],
  [Role.JUNTA_DISTRITO]:    [Role.JUNTA_DISTRITO, Role.JUNTA_NUCLEO, Role.JUNTA_ESCOLAR],
  [Role.JUNTA_NUCLEO]:      [Role.JUNTA_ESCOLAR],
  // Auto-referencia: el Presidente de Junta Escolar puede designar al resto del
  // directorio de su propio colegio (Vicepresidente/Secretaria/Tesorero/Vocal —
  // nunca Presidente, eso se valida aparte en junta.service.ts).
  [Role.JUNTA_ESCOLAR]:     [Role.JUNTA_ESCOLAR],
  [Role.GOBIERNO_DISTRITO]: [Role.GOBIERNO_NUCLEO, Role.STUDENT_GOV],
}