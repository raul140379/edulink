# Proyecto: EduLink

## Descripción
EduLink es un sistema web integral para la gestión administrativa y académica de un **distrito educativo completo**: desde el Director Distrital y los directores de cada unidad educativa, hasta docentes, personal administrativo, portería, padres de familia y estudiantes. Cubre matriculación, gestión académica (cursos, materias, notas, asistencia), tesorería de la Junta de Padres, comunicación institucional, control de acceso en portería mediante biometría/QR, y la representación completa de la Junta de Padres de Familia y el Gobierno Estudiantil en los tres niveles de la estructura educativa boliviana: **Distrito → Núcleo → Unidad Educativa**.

El nombre original del proyecto era "SGJE" cuando era exclusivo para U.E. Naciones Unidas (El Torno, Santa Cruz). Desde ahí evolucionó a EduLink, el sistema distrital completo actual. Hoy opera en producción para esa UE, con arquitectura preparada para escalar a un distrito real (multi-núcleo, multi-colegio) sin reprogramación — solo configuración.

## Stack tecnológico

**Backend**
- Runtime/lenguaje: Node.js + Express + TypeScript
- ORM: Prisma 6.7.0 (**fijo, no subir a v7**)
- Base de datos: PostgreSQL — una instancia por distrito desplegado
- Auth: JWT (expiración 8h, incluye el alcance del usuario — colegio/núcleo/distrito — en el token) + bcrypt
- Otros: `xlsx` (import masivo desde Excel), `multer` (upload de archivos), `jsPDF` (reportes PDF), `html5-qrcode` (lectura de QR)

**Frontend**
- Framework: Next.js 16 (App Router) + React 19
- Lenguaje: TypeScript en todo el código
- Estilos: Tailwind CSS v4 — sistema de diseño compartido (botones, tablas, modales, tarjetas, notificaciones)
- Paneles independientes por rol bajo `/dashboard/<rol>` (admin, planteldocente, padres, estudiantes, portero) — no una app monolítica. Cada uno con su propio menú y tema de color, pero reutilizando el mismo `DashboardShell`.
- Portal público sin autenticación: comunicados, directorio de UEs, directorio de autoridades electas

**Infraestructura / despliegue**
- Backend en Railway (API + PostgreSQL)
- Frontend en Vercel
- Dominio propio vía Cloudflare (`radosoft.tecnologia.bo` y subdominios)
- Despliegue continuo: cada cambio integrado al repo se publica automáticamente

## Arquitectura

**Cliente-servidor de 3 capas + motor de tenant-scoping transversal:**

```
Cliente web (Next.js, paneles por rol)
  ↓ HTTPS / JSON
API REST (Express)
  Rutas → Middlewares (auth, permisos) → Controladores → Servicios → Repositorios
  ↓
Motor de tenant-scoping (extensión de Prisma, backend/src/lib/prisma.ts)
  Inyecta y valida automáticamente el alcance (colegio/núcleo/distrito)
  ↓ SQL
PostgreSQL
```

Cada capa tiene responsabilidad única: rutas solo declaran endpoints + middlewares; controladores traducen HTTP ↔ funciones de servicio; servicios concentran toda la lógica de negocio; repositorios son la única capa que habla con Prisma. Este orden evita que la lógica de negocio se disperse.

### Multi-tenancy y aislamiento de datos

El desafío central: garantizar que cada actor (Director Distrital, director de colegio, juntas de distrito/núcleo/colegio, familias) vea únicamente los datos de su propio alcance, sin repetir esa lógica en cada uno de los +40 módulos.

**Contexto de tenant:** en cada request autenticado, `verifyToken` decodifica el JWT y construye `{ userId, role, schoolId, districtId, nucleoId }`, propagado con `AsyncLocalStorage` — no se pasa manualmente entre funciones.

**Dos clasificaciones de modelos:**
- **Alcance directo** (`DIRECT_SCHOOL_SCOPED_MODELS` en `scoped-models.ts`): Charge, Payment, notas, asistencia, tareas, horarios, etc. — todos con `schoolId` obligatorio. La extensión inyecta el filtro `WHERE` automáticamente en toda lectura, y valida/fuerza el `schoolId` en cada create/upsert.
- **Alcance de tenant** (3 modelos): `User`, `JuntaMember`, `GobiernoMember` — llevan `schoolId`/`nucleoId`/`districtId` opcionales y mutuamente excluyentes, según en qué nivel vive la cuenta.

**Excepción de diseño — `Comunicado`:** no es "una fila que pertenece a un tenant" sino un mensaje que se difunde hacia abajo en la jerarquía. Su filtrado se resuelve a mano en el servicio, no en la extensión genérica.

**Regla de oro:** si un modelo nuevo maneja datos de un colegio específico, agregarlo a `DIRECT_SCHOOL_SCOPED_MODELS` desde el día uno — no depender de filtrado manual disperso en repositorios (`MandatoryCharge` quedó fuera de la lista por construirse antes de que el patrón estuviera consolidado; es deuda técnica menor pendiente).

### Invariante de aislamiento — nunca se cruza una Unidad Educativa

**Cada Unidad Educativa es completamente independiente.** Ningún actor que opera *dentro* de una UE (Padre, Estudiante, Docente, **Director**, Regente/Secretaría, Junta Escolar, Delegado, Staff/Portero) puede ver, editar, ni cruzarse con datos de **otra** UE — esto incluye explícitamente al `DIRECTOR` de una UE: un director de U.E. Naciones Unidas nunca debe ver ni administrar nada de U.E. La Santa Cruz, y viceversa, pese a ser el rol de mayor autoridad dentro de su propia UE. Ejemplo concreto: un padre de U.E. Naciones Unidas nunca debe aparecer, ni poder verse, desde U.E. La Santa Cruz, y viceversa.

Los niveles superiores SÍ agregan dentro de su propio alcance, pero nunca más allá:
- **Junta/Gobierno de Núcleo** ve padres, estudiantes y maestros de **todas las UE de su propio núcleo** — nunca de otro núcleo ni de otro distrito.
- **Junta/Gobierno/Director Distrital** ve dentro de **todo su propio distrito** — nunca de otro distrito.

Este invariante ya está protegido en el modelo por el `schoolId` obligatorio en los modelos de alcance directo + la extensión de tenant-scoping. **Pendiente de verificar explícitamente** (ver Pendientes / Roadmap) que ningún endpoint construido "rápido" para un actor de UE haya heredado el mismo patrón de fuga que se encontró en DELEGATE a nivel de curso (permiso compartido sin filtro adicional).

**Única excepción al invariante — `DIRECTOR_DISTRITAL`:** es el único rol que puede ver **todas las UE del distrito**, pero **solo la parte académica** (notas, asistencia, matrícula), **y únicamente en modo lectura** — puede ver, nunca crear/editar/eliminar datos académicos de una UE que no sea la propia. Sus acciones de escritura reales se limitan a sus propias funciones administrativas (designar directores, designar Junta/Gobierno de Distrito), no a procesar el contenido académico interno de cada UE. **Nunca debe tener acceso a Tesorería de ninguna UE**, ni siquiera de solo lectura — el dinero de cada Junta Escolar es exclusivo de esa UE, sin excepción, ni para el Distrital de Educación. Cualquier endpoint de Tesorería debe rechazar explícitamente a `DIRECTOR_DISTRITAL`, no solo omitir otorgarle el permiso por descuido.

### Invariante general — cada nivel gestiona SOLO lo suyo (aplica a Junta y a Gobierno Estudiantil por igual)

El mismo patrón de aislamiento no es exclusivo de Tesorería — aplica a **toda función** que gestionen Junta de Padres y Gobierno Estudiantil en cualquiera de sus 3 niveles (UE / Núcleo / Distrito):

- Cada nivel tiene su **propia área de gestión** (comunicados, reuniones, miembros, tesorería) — separada de la de los demás niveles.
- **Nunca hay visibilidad cruzada entre niveles**: ni hacia arriba (UE viendo Núcleo/Distrito), ni hacia abajo (Distrito viendo el detalle interno de una UE específica), ni entre pares del mismo nivel (un núcleo viendo otro núcleo del mismo distrito).
- Esto aplica **igual para Junta que para Gobierno Estudiantil en cuanto al aislamiento por nivel** — son dos ramas paralelas, cada una con el mismo patrón de "cada nivel ve/gestiona solo lo suyo". **No son simétricas en autonomía:** Junta es un órgano completamente independiente (no depende de nadie); Gobierno Estudiantil opera bajo supervisión del Director/Junta Escolar de su nivel, pero sus decisiones son autónomas y no pueden vetarse salvo violación de normas internas/municipales (ver sección "Reglas de negocio por actor").

**Ejemplo concreto con Tesorería** (el caso ya detallado abajo): `JUNTA_ESCOLAR` de una UE nunca ve la Tesorería de su Núcleo/Distrito, ni viceversa. El mismo principio debe aplicar cuando se construya cualquier funcionalidad de Gobierno Estudiantil a nivel Núcleo/Distrito (comunicados propios, gestión de miembros propia, etc.) — nunca cruzando hacia el detalle interno de una UE específica ni hacia otro núcleo/distrito.

**Nota de diseño para verificar en la auditoría (ver Pendientes / Roadmap):** este principio de "áreas estancas por nivel" debe aplicarse consistentemente a medida que se construyan las funcionalidades pendientes de Gobierno Estudiantil (CRUD de miembros, ver sección de Roadmap) — no asumir que basta con copiar el patrón de Junta sin revisar que el aislamiento por nivel también se replique.

### Invariante de Tesorería — cada nivel tiene su propia área, aislada de las demás

Tesorería no es un solo espacio compartido — **cada nivel de la jerarquía de padres tiene su propia área de tesorería independiente**, con sus propios cargos y fondos, sin relación con la de otro nivel:

- **Tesorería de UE** (`JUNTA_ESCOLAR`/`DELEGATE`) — los cargos y fondos de esa Junta Escolar específica.
- **Tesorería de Núcleo** (`JUNTA_NUCLEO`) — sus propios cargos/fondos a nivel núcleo, cuando se construya (hoy bloqueada como "en construcción").
- **Tesorería de Distrito** (`JUNTA_DISTRITO`) — sus propios cargos/fondos a nivel distrito, cuando se construya.

**Regla de acceso:** cada rol ve **únicamente el área de tesorería de su propio nivel** — nunca la de un nivel distinto, ni hacia arriba ni hacia abajo. `JUNTA_NUCLEO` no ve la Tesorería de ninguna UE de su núcleo, ni `JUNTA_DISTRITO` ve la de ningún núcleo o UE de su distrito. Tampoco al revés: `JUNTA_ESCOLAR` no ve la Tesorería de su Núcleo/Distrito. Tres áreas completamente estancas, no una jerarquía de visibilidad creciente.

Además, dentro de cada área:
- **`PARENT`** ve solo su propia deuda (nunca la de otro tutor, ni siquiera dentro de la misma UE).
- **`JUNTA_ESCOLAR`/`DELEGATE`** administran (Junta ve todo su nivel; Delegado solo su curso).
- **Excepción confirmada (10-ago):** `DIRECTOR`/`REGENTE`/`SECRETARY` de una UE **sí pueden ver Tesorería en modo solo lectura, únicamente de su propia UE** — decisión de diseño consciente, útil para su gestión. Incluye el **resumen general** (estado agregado de cobros/pendientes) y, para un padre específico, **solo un estado simple: "al día" o "con deuda pendiente"** — no el detalle completo de cargos/pagos/recibos de ese padre. Para cualquier detalle más allá del estado simple, Director debe coordinar directamente con Junta Escolar (quien sí administra Tesorería completa). Nunca pueden crear/editar/eliminar cargos ni pagos, en ningún caso.
- **Ningún otro rol** (Docentes, Staff, `DIRECTOR_DISTRITAL`, Gobierno Estudiantil en cualquier nivel) tiene acceso a ninguna de las tres áreas de Tesorería, ni de solo lectura.

Este invariante debe verificarse en la misma auditoría que la de aislamiento entre UE (ver Pendientes / Roadmap) — cualquier permiso de Tesorería que cruce entre niveles o áreas, o que se salga de esta lista de excepciones, es un hallazgo tan grave como los ya encontrados en DELEGATE.

### Jerarquía organizacional

```
DISTRITO EDUCATIVO
  Director Distrital · Junta de Distrito · Gob. Estudiantil Distrito
    │
NÚCLEO ESCOLAR
  Junta de Núcleo · Gob. Estudiantil Núcleo
    │
UNIDAD EDUCATIVA
  Director/Regente/Secretaría · Junta Escolar · Gob. Estudiantil (colegio)
```

**Jerarquía de designación de cuentas** (quién nombra a quién):
- Director Distrital designa Director de cada UE + Junta/Gobierno Estudiantil de Distrito
- Junta de Distrito designa Junta de Núcleo + Junta Escolar de cada colegio
- Gobierno Estudiantil de Distrito designa Gobierno de Núcleo + de cada colegio

Cada nivel puede, dentro de su propio alcance: convocar reuniones, publicar comunicados, y gestionar tesorería. **Estado real (ago-2026): la Tesorería de Núcleo/Distrito está bloqueada intencionalmente en el frontend** ("en construcción") — el permiso ya existe (`CHARGE_CREATE`/`CHARGE_VIEW_ALL` otorgados a `JUNTA_NUCLEO`/`JUNTA_DISTRITO`), pero el modelo `Charge` solo soporta `schoolId` (no `nucleoId`/`districtId`), y el dominio de negocio de "qué significa un cargo de núcleo" aún no está definido.

**Respaldo legal de cobros:** `PoaActa` registra el acta de aprobación del Plan Operativo Anual — respaldo legal exigido por el Director Distrital para que una Junta cobre cuotas. Es una constancia global por `{schoolId, academicYear}` (informativa, no bloquea la creación de cobros), **no una relación cargo-por-cargo** — decisión de diseño consciente, documentada en el propio código.

## Reglas de negocio por actor educativo

Contexto real boliviano (para entender el diseño, no todo se modela en EduLink): la jerarquía completa es Ministerio → Departamental → Distrital → Núcleo → UE. **EduLink modela hasta Distrito como techo** — el nivel Departamental (Junta Departamental, Gobierno Estudiantil Departamental) existe en la realidad pero no se construye en el sistema por ahora.

### 1. Estudiantes
- Obligación principal: asistir a clase, presentar trabajos, rendir exámenes, obtener calificación final (aprueba/reprueba el curso).
- Se organizan en **Gobierno Estudiantil** (Presidente, Tesorero, Vice, Srta. Deporte, Srta. Académico), elegido voluntariamente por los propios estudiantes.
- 3 niveles: UE → Núcleo → Distrito, cada uno con su propio representante.
- **Autonomía real:** el Gobierno Estudiantil opera bajo supervisión del Director y la Junta Escolar, pero sus decisiones son autónomas y deben respetarse — **el Director NO puede vetar** una decisión del Gobierno Estudiantil, salvo que viole normas internas o municipales.
- La designación en el sistema (registro) es solo un "visto bueno" de lo que los estudiantes ya decidieron por elección — no es que la autoridad elige, solo formaliza/registra. Idealmente lo hace el Distrital de Educación (máxima autoridad educativa del distrito), aunque puede hacerlo otro actor si es necesario.

### 2. Docentes
- Obligación principal: impartir enseñanza según horario asignado — tareas, evaluaciones, avance de temas.
- **Cada docente es independiente de los demás** (no hay jerarquía entre pares).
- **Dependen de la parte administrativa, nunca de los padres/Junta.**
- Designación real: viene de nivel departamental/nacional (docentes como servidores públicos). En el sistema, el **Distrital de Educación registra y asigna a qué UE va cada docente**; el **Director organiza internamente** (qué curso/materia/horario) según la necesidad de su UE — esto ya está cubierto por `TeacherSubjectCourse`/`Schedule`.

### 3. Padres de Familia / Junta
- Labor principal: apoyar a sus hijos en sus estudios.
- Se organizan igual que los estudiantes: **Junta Escolar (UE) → Junta de Núcleo → Junta de Distrito**.
- **Es un órgano independiente — no depende de nadie** (a diferencia de Gobierno Estudiantil, que sí está bajo supervisión del Director/Junta Escolar).
- **Jerarquía de pertenencia:** cada padre pertenece a la Junta Escolar de la UE donde tiene un hijo matriculado (base raíz); la Junta Escolar coordina con Junta de Núcleo y Junta de Distrito. Para ser miembro de una directiva se requiere tener hijo(s) matriculado(s) en el alcance correspondiente (UE para Junta Escolar, Núcleo para Junta de Núcleo, cualquier UE del distrito para Junta de Distrito).
- **Flujo técnico de designación (importante):** al designar un miembro de Junta de Núcleo/Distrito, la autoridad que designa (ej. Distrital) **NO crea una persona nueva** — debe **seleccionar un registro de `Parent` ya existente** en la base de datos, y el sistema debe **validar** que ese padre tenga efectivamente un hijo matriculado (o sea tutor de un estudiante vía `ParentStudent`) en alguna UE dentro del alcance correspondiente (cualquier UE del distrito para Junta de Distrito, cualquier UE del núcleo para Junta de Núcleo) antes de aceptar la designación. Mismo criterio aplica para Gobierno Estudiantil, seleccionando un `Student` existente en vez de un `Parent`.
- **Exclusividad económica:** los padres aportan voluntariamente para mejoras de la UE (infraestructura, material académico) — por eso la parte económica es exclusividad total de ellos. **Ningún otro actor puede tomar decisiones sobre Tesorería** (ver invariantes de Tesorería más abajo).
- **Límite claro de alcance académico:** ninguna Junta Escolar puede gestionar (crear/editar) datos de estudiantes — solo puede **visualizar algunos datos**, según su rol. La parte académica es **exclusividad de la parte administrativa** (Director/Docentes), nunca de Junta.

### 4. Parte administrativa (Director, Regente, Secretaría, Staff)
- Depende del Distrital de Educación: el Distrital asigna Director a cada UE, asigna Docentes a cada UE, y es responsable de cualquier miembro administrativo.
- El Director, una vez asignado, organiza su propia UE según necesidad (dentro de su alcance — ver invariante de aislamiento entre UE).

### 5. Portero / Regente (control de acceso)
- Función exclusiva: **control de ingreso a la Unidad Educativa** — registra el ingreso/salida de **todas las personas** que entran (docentes, personal administrativo, estudiantes, y visitantes), no solo estudiantes. Ya cubierto por el módulo `gate` (`GateRecord` con `type` distinguiendo teacher/staff/student/visitante, `BiometricTemplate`, QR/lector USB).

## Roles y permisos

18 roles, más de 40 permisos granulares (`student:view:all`, `charge:create`, `comunicado:create`, etc.), verificados por middleware en cada endpoint.

| Rol | Nivel | Descripción |
|---|---|---|
| SUPER_ADMIN | Sistema | Acceso total, sin restricción de tenant |
| DIRECTOR_DISTRITAL | Distrito | Designa directores y Junta/Gobierno de Distrito (sus propias funciones). **Ve** lo académico de todas las UE (notas/asistencia/matrícula) **en modo solo lectura** — nunca procesa/edita datos internos de una UE ajena. **Nunca Tesorería de ninguna UE** |
| JUNTA_DISTRITO | Distrito | Representa a los padres del distrito; designa Junta de Núcleo y Escolar |
| GOBIERNO_DISTRITO | Distrito | Representa al estudiantado del distrito |
| JUNTA_NUCLEO | Núcleo | Representa a los padres de los colegios de su núcleo |
| GOBIERNO_NUCLEO | Núcleo | Representa al estudiantado de los colegios de su núcleo |
| DIRECTOR | Colegio | Matriculación, cursos, personal, reportes. **Tesorería: solo lectura de su propia UE** (nunca crea/edita) |
| REGENTE / SECRETARY | Colegio | Apoyo administrativo y académico |
| TEACHER / TEACHER_TUTOR | Colegio | Notas, asistencia, tareas |
| JUNTA_ESCOLAR | Colegio | Tesorería, delegados, comunicados |
| DELEGATE | Colegio | Padre delegado — **debe estar limitado a su propio curso** (ver Notas de trabajo — auditoría de seguridad en curso) |
| PARENT | Colegio | Ve información de sus propios hijos |
| STUDENT | Colegio | Ve su propia información académica |
| STUDENT_GOV | Colegio | Gobierno Estudiantil del colegio |
| STAFF / PORTERO | Colegio | Verificación de identidad, ingreso/salida |

**Regla de oro:** la asignación de un rol nuevo está sujeta a la jerarquía de designación — validar siempre en el servicio de creación de usuarios que quien asigna tenga autoridad sobre el rol/nivel que está otorgando.

## Estructura del backend (patrón fijo por módulo)

```
backend/
├── src/
│   ├── config/
│   │   └── permissions.ts
│   ├── lib/
│   │   └── prisma.ts              (motor de tenant-scoping)
│   ├── middlewares/
│   ├── controllers/
│   ├── services/
│   ├── repositories/
│   ├── schemas/
│   ├── routes/
│   ├── scripts/                    (imports, backfills — corren FUERA del contexto de tenant, sin la extensión de Prisma)
│   └── utils/                      (funciones puras compartidas, ej. charge-balance.ts)
├── prisma/
│   └── schema.prisma
└── main.ts
```

Cada módulo sigue: `routes.ts` → middlewares → `<modulo>.controller.ts` → `<modulo>.service.ts` → `<modulo>.repository.ts`, más `schemas/` para validación.

30 módulos de rutas agrupados por dominio: identidad y acceso (auth, users, district, nucleo, schools, junta, gobierno), académico (academic, courses, students, teachers, parents, subjects, schedule, planificacion, classroom), evaluación (nota, task, teacherAttendance, studentAttendance), **tesorería** (treasury, delegate, poa-acta), comunicación (notification, comunicado, meeting), portería (gate), reportes/admin (report, admin), portal público (public — sin auth).

## Módulos construidos y su funcionalidad

| Módulo | Estado | Funcionalidad principal |
|---|---|---|
| **Auth / Usuarios** | ✅ Completo | Login JWT, jerarquía de designación de cuentas, reseteo masivo de credenciales por rol |
| **Distrito / Núcleo / Colegios** | ✅ Completo (datos), 🟡 UI parcial | Modelo territorial completo; corrección de 16 núcleos cruzados con Plan de Ordenamiento Territorial; asignación de director por colegio; asistente de configuración de 5 pasos para poner en marcha un distrito nuevo |
| **Junta de Padres (3 niveles)** | 🟡 UI completa, Tesorería Núcleo/Distrito bloqueada | Núcleos+colegios, gestión de Junta, perfil propio, cascada de designación — todo construido en `/padres/junta` (Directorio, CRUD completo). **Tesorería a nivel Núcleo/Distrito explícitamente bloqueada** ("en construcción") — el permiso ya existe, el modelo de negocio no |
| **Gobierno Estudiantil (3 niveles)** | 🔴 Muy atrás respecto a Junta | Backend soporta listar/editar (`GET /`, `PUT /:id` en `gobierno.routes.ts`, gateados por `GOBIERNO_MANAGE`) — pero **no existe pantalla de gestión/listado de miembros en ningún nivel**. `GOBIERNO_NUCLEO` solo tiene "Inicio" + "Comunicados" (vista); `GOBIERNO_DISTRITO` solo agrega "Designar Gobierno" (alta, sin poder ver/editar/reasignar después). Tampoco existe `estudiantes/nucleos/` (sí existe `padres/nucleos/`). Es deuda de frontend, no de backend — la capacidad ya está en la API |
| **Matrícula / Académico** | ✅ Completo | Cursos por nivel/grado/paralelo/turno, `StudentAcademicAssignment` (matrícula por año), materias por Campo del Saber, `TeacherSubjectCourse` |
| **Horarios** | ✅ Completo | Generación de horario con algoritmo de dos fases (Fisher-Yates shuffle, base 60–90%), asignación de aulas, `SchedulePlan` para prototipos A/B antes de promover a horario oficial |
| **Evaluación (Notas/Tareas)** | ✅ Completo | 4 dimensiones (Ser/Saber/Hacer/Decidir) por materia/curso/trimestre, `Task`/`TaskSubmission` |
| **Asistencia (académica)** | 🟡 Funcional, con deuda de arquitectura conocida | Asistencia de estudiantes y docentes por día/curso. **Un curso solo admite UN registro compartido por día** (no por maestro/período) — mitigación urgente contra pisado silencioso ya desplegada, rediseño completo por bloques de períodos ya diseñado y aprobado, pendiente de construir (ver Pendientes / Roadmap) |
| **Portero / Control de acceso** | ✅ Completo | QR (`html5-qrcode`), lector USB, códigos formato `INITIALS-NNNN`, `GateRecord`, `BiometricTemplate`, banner de cuenta regresiva a cierre de portal |
| **Panel Docente** | ✅ Completo + rediseño motivacional | Notas, asistencia, tareas, horario; rediseño de UX (clases de hoy, trabajos pendientes de revisar) — **no es gamificación real** (sin XP/niveles/rachas), a diferencia del panel Estudiante |
| **Panel Estudiante** | ✅ Completo + gamificación real | Materias, notas, tareas, horario, comunicados; XP/nivel/racha/insignias confirmado real (`_gamification/`, `GamificationContext`), mensajes en lenguaje juvenil urbano boliviano |
| **Panel Padres/Tutor (PARENT puro)** | ✅ Completo | Notas, horario, calificaciones, maestros, tesorería propia, comunicados — de sus propios hijos. (Designación de juntas subordinadas es capacidad de JUNTA_NUCLEO/JUNTA_DISTRITO, ver fila "Junta de Padres") |
| **Tesorería (Junta Escolar, nivel Colegio)** | ✅ Completo, detalle en `tesoreria-respaldo.md` | Cargos/pagos, carryover automático y manual entre gestiones, backfill histórico 2025, Verificación por Curso, Deuda Trasladada, desglose gestión actual/trasladada. **Auditoría de seguridad DELEGATE en curso** (ver Pendientes / Roadmap) |
| **Delegado de curso** | ✅ Auditoría de seguridad cerrada (10-ago) | Gestión de cobros/reuniones de su propio curso — 13 hallazgos originales + `updatePayment` (encontrado en el camino), todos corregidos con `assertDelegateOwnsParent`/`assertDelegateOwnsCourse` (`delegate-scope.ts`), probados contra API real, sin regresión en `JUNTA_ESCOLAR` |
| **Convocatoria + multa automática** | ✅ Completo (reciente, 01-ago) | Vincula asistencia a asambleas con generación automática de `Charge` — puente entre gobernanza y tesorería |
| **Registro de padres autoservicio** | ✅ Completo (reciente) | Vía Junta/Delegado, asistencia por curso con QR/check-in de tutores |
| **Attendance Check-in** | ✅ Completo | Módulo propio (`attendance-checkin.routes.ts`, separado de `gate` y `meeting`) — escaneo de código de tutor en portería/puerta, marca presente en la convocatoria/reunión activa del día. Opera sobre el tutor escaneado, no sobre un ID arbitrario — no hereda los problemas de alcance de DELEGATE |
| **Comunicación (Notification/Meeting/Comunicado)** | ✅ Completo | Notificación puntual a padre, reunión que convoca a un curso con asistencia, comunicado como broadcast por Distrito/Núcleo/Colegio |
| **Reportes** | 🟡 Parcial (alcance verificado) | 5 endpoints en `/api/reports`, todos consumidos sin roto: Maestros (docentes + asignaciones), Delegados (curso→delegado→tutor→conteo), Asistencia-de-reuniones (% por curso, **no** es asistencia diaria de estudiantes — módulo distinto), Tesorería y Deuda Trasladada (ver módulo Tesorería). **No existe** reporte de calificaciones, matrícula/inscripciones, ni asistencia diaria agregada |
| **Portal público** | ✅ Completo | Comunicados, directorio de UEs, directorio de autoridades electas — sin autenticación |
| **PoaActa** | ✅ Completo (por diseño, alcance limitado) | Constancia global de acta aprobada por colegio/gestión — informativa, no vinculada cargo-por-cargo |
| **Sistema de Gestión Comercial** (proyecto RadoSoft separado, no EduLink) | 🟡 Bloque 1 completo | Ver proyecto aparte — no confundir con EduLink |

**Leyenda:** ✅ Completo y probado · 🟡 Parcial / con huecos conocidos · 🔴 Con problema activo sin resolver

## Modelo de datos base

41 modelos, 27 enumeraciones, organizados por dominio. Los más relevantes para trabajo activo:

```
Organización territorial:  District → Nucleo → School (School = ancla de aislamiento, schoolId)
Identidad:                 User ←1:1(opcional)→ Parent | Student | Teacher | Staff | JuntaMember | GobiernoMember
Familias:                  Parent ←→(ParentStudent, N:M)→ Student
Académico:                 AcademicYear → Trimester; Course; StudentAcademicAssignment (matrícula por año)
Tesorería:                 Charge (parentId, studentId opcional, academicYearId, sourceChargeId self-relation
                            para carryover) ← Payment (múltiples pagos parciales por Charge)
                            PoaActa (constancia global, NO vinculada cargo-por-cargo)
Comunicación:               Notification (puntual, a un padre) · Meeting (convoca a un curso, registra
                            Attendance) · Comunicado (broadcast por Distrito/Núcleo/Colegio)
```

**Enumeraciones clave:** `Role` (18 valores), `Subsistema` (Regular / Alternativa y Especial / Superior de Formación Profesional), `SchoolType` (Fiscal/Convenio/Privada), `JuntaRole` (Presidente, Vicepresidente, Secretaria, Tesorero, Vocal — reutilizado para Junta de Padres y Gobierno Estudiantil en los 3 niveles).

## Convenciones y lecciones aprendidas

- **Prisma fijo en 6.7.0** — no subir a v7.
- En Express, rutas específicas ANTES que rutas paramétricas `/:id`.
- **Nunca reutilizar un endpoint existente si el cambio debilitaría protecciones del flujo diario** (ej. no relajar los guards de `updateCharge`/`registerPayment` para casos de corrección histórica — crear un endpoint nuevo dedicado en su lugar).
- **El histórico nunca se pierde**: preferir "crear registro histórico + trasladar" sobre "crear dato nuevo sin origen", para mantener trazabilidad completa (patrón `sourceChargeId`).
- **Todo cambio destructivo o masivo se investiga primero en modo diagnóstico/dry-run** antes de ejecutar — nunca borrar/migrar en el mismo paso que se detecta el problema.
- **Preferencia de Raul:** regeneración completa de archivos sobre parches/diffs parciales; explicaciones de trade-offs antes de decisiones arquitectónicas; confirmación explícita antes de cualquier paso que toque datos reales.
- Scripts en `scripts/` corren fuera de un request HTTP — **no tienen contexto de tenant**, por lo que el filtrado por `schoolId` ahí debe hacerse explícito a mano, no asumir que la extensión de Prisma los protege.
- **Orden fijo para cualquier corrección de datos que toque múltiples entornos: LOCAL primero → CLON (validación) → PRODUCCIÓN al final.** Nunca saltar directo de clon a producción dejando local sin aplicar. Motivo (incidente real, 29-ago-2026): tras aplicar y verificar la corrección de `Student.kardex` en clon+producción, Raul vio en pantalla la mayoría de los tutores con kardex discrepante y pensó que la corrección había fallado o se había revertido — la investigación completa (reconteo en vivo, comparación local/producción) confirmó que producción estaba intacta; la pantalla que Raul veía apuntaba a `localhost:3000`, es decir a la base local, que nunca se había tocado. Aplicar también en local desde el principio evita esta falsa alarma y mantiene los 3 entornos consistentes para cualquier prueba futura en pantalla.

## Pendientes / Roadmap (priorizado, agosto 2026)

### 🔖 Próximos pasos (consolidado 4-sep-2026, madrugada — para retomar en frío)

**URGENTE-ALTA (no bloquea el uso de mañana — la mitigación + fix de fondo de esta noche ya cerraron el riesgo real):**
- Diseño completo por bloques de períodos (ya aprobado) — construir lo que quedó pendiente de esta noche: reporte diario con detalle/selector por bloque, PDF con selector de bloque, y el caso de un mismo maestro con períodos NO consecutivos el mismo curso/día (ej. 1°,2° y luego 5°,6° — hoy sigue siendo una sola fila para ambos tramos, no dos). Detalle completo, con qué partes ya están resueltas, en "Prioridad 1.5" más abajo.

**MEDIA:**
- Sincronización automática offline en `maestro-app` — cola local (IndexedDB) + reenvío automático al volver la señal, sin que el maestro tenga que darse cuenta y reintentar a mano. Detalle en el ítem 5.1.
- Conectar Calificaciones/Reportes/Notificaciones del panel Admin — backend ya listo, falta solo el frontend (hallazgo de auditoría, sin más detalle registrado todavía).
- Pantalla admin para que el Director corrija asistencia vencida (fuera de la ventana horaria normal del maestro).
- Botón "Hoy no hay clases" de un clic, para suspensión de emergencia (feriado no planificado, corte de agua/luz, etc.).
- Funciones 3 y 4 del módulo Maestro: dar práctico/calificar, programar evaluación/calificar.
- Familia de apps livianas para Padre, Portería, Junta Escolar, Estudiante — mismo patrón que `maestro-app` (login con JWT real, gate de rol, instalable sin tienda de apps). Orden y detalle ya definidos en "Prioridad 5" más abajo — no empezar ninguna sin que el usuario lo pida explícitamente.

**BAJA / SIN APURO:**
- Caso de Maitane Hurtado Herrera (2 tutores activos, invariante roto — solo en local, producción sana). Detalle en el ítem 17.3.
- Definir el dominio de negocio de Tesorería a nivel Núcleo/Distrito antes de destrabar esa UI. Detalle en el ítem 18.
- Revisar el checklist completo de `docs/reporte-pre-produccion-tesoreria-2025.md`. Detalle en el ítem 21.
- PgBouncer (evaluar cuando hagan falta más de ~8 instancias del backend) y licencia comercial propia de EduLink (archivo `LICENSE`, postura sobre copyleft débil transitivo). Detalle en los ítems 26 y 27.
- Limitación conocida del export Sub-14 de Juegos Estudiantiles: apellidos compuestos de 3+ palabras no se separan bien en Apellido Paterno/Materno (se infiere por la primera palabra, no exacto para esos casos) — documentada en el commit del módulo, no oculta, sin corregir todavía.

### 🔴 Prioridad 1 — Seguridad de datos ✅ COMPLETA (10-ago-2026)

**Resumen de la sesión de seguridad (7 commits, 21 hallazgos corregidos y probados contra API real):**
1. `a8f6096` — Auditoría DELEGATE completa (13 hallazgos) + Track 1 Tesorería
2. `90fd0b7` — Mensaje claro para JUNTA_NUCLEO/JUNTA_DISTRITO en escritura de Tesorería
3. `ef13e94` — 4 fugas de aislamiento entre UE (DIRECTOR_DISTRITAL, Gobierno Estudiantil, TEACHER, DIRECTOR/REGENTE/SECRETARY)
4. `3dbfed1` — Bloqueo simétrico de lectura Núcleo/Distrito + fix bug SUPER_ADMIN
5. `513b6bb` — `import`/`import-tutors` sin protección, abierto a cualquier usuario logueado
6. Meeting: `JUNTA_NUCLEO`/`JUNTA_DISTRITO` no pueden gestionar reuniones de curso ajenas dentro de su alcance
7. `createJuntaMember`/`createGobiernoMember`: validación de alcance faltante en creación (existía en edición)

Los 7 puntos originales del roadmap de seguridad quedan cerrados. Próxima prioridad: Tesorería en curso (BTH 2026, buscador de recibos, import CSV) o Gobierno Estudiantil.
1. ✅ **Corregir alcance de DELEGATE** — CERRADO 10-ago-2026. 13 hallazgos originales + `updatePayment` (encontrado en el camino, no estaba en la lista original). Helpers reutilizables en `backend/src/utils/delegate-scope.ts` (`assertDelegateOwnsParent`, `assertDelegateOwnsCourse`). Los 4 bloques (Familias 🔴, Tesorería escritura 🟠, Tesorería lectura 🟠, Asistencia 🟠) probados contra la API real, sin regresión en `JUNTA_ESCOLAR`.
2. ✅ Verificado (10-ago): sin evidencia de uso indebido en `registerPayment` (0 pagos por DELEGATE) ni Meeting (0 reuniones creadas por DELEGATE). **Riesgo residual real sin poder auditarse**: `Charge` sin campo de autoría, `deleteParent` sin soft-delete, `regenerateTutorCode` sin historial — ver ítem 17.1 (auditoría/trazabilidad) para la mejora pendiente.
3. ✅ Fix menor cerrado (10-ago): `createCharge`/`createBulkCharges` ahora rechazan con 400 y mensaje claro ("Tesorería a nivel Núcleo/Distrito todavía no está disponible") en vez del 403 confuso. Probado con `JUNTA_NUCLEO` real, sin regresión en `JUNTA_ESCOLAR`.
4. ✅ **Aislamiento entre UE — CERRADO 10-ago.** 4 hallazgos, todos corregidos y probados:
    - `DIRECTOR_DISTRITAL` tenía `CHARGE_VIEW_ALL` (violaba el invariante) → permiso removido.
    - Gobierno Estudiantil (`GOBIERNO_NUCLEO`, `GOBIERNO_DISTRITO`, `STUDENT_GOV`) tenía `CHARGE_CREATE`+`CHARGE_VIEW_ALL` (el más grave, incluía escritura) → ambos permisos removidos de los 3 roles.
    - `TEACHER`/`TEACHER_TUTOR` sin filtro real de curso en `listStudents`/`getStudentById` (mismo patrón que DELEGATE) → filtrado por curso real vía `findTeacherCourseIds` (`TeacherSubjectCourse` + `CourseTutor`).
    - `DIRECTOR`/`REGENTE`/`SECRETARY` con `CHARGE_VIEW_ALL` → **confirmado como diseño válido**, pero acotado: solo resumen general + estado simple (`AL_DIA`/`CON_DEUDA`) de un padre específico en su propia UE, nunca el detalle completo de cargos/pagos. Ver invariante de Tesorería actualizado arriba.
5. ✅ **Aislamiento de Tesorería por nivel — CERRADO 10-ago.** Hallazgo más grave de la sesión: `JUNTA_NUCLEO`/`JUNTA_DISTRITO` podían **leer** (no solo escribir) la Tesorería completa de cualquier UE de su alcance — resumen agregado, listado de tutores, y **detalle individual con números de recibo** — porque el motor genérico de tenant-scoping (`NUCLEO_WIDE_ROLES`/`DISTRICT_WIDE_ROLES`) aplicaba a `Charge` sin excepción. Corregido con `assertHasOwnSchool()` (chequeo explícito por rol, no por `schoolId == null`) en `getSummary`, `getParentsWithBalance`, `getParentAccount`, `getVerificationReportByCourse`. **Bonus:** de paso se corrigió un bug colateral del fix anterior de `createCharge`/`createBulkCharges` que bloqueaba accidentalmente a `SUPER_ADMIN` (sus usuarios reales tienen `schoolId: null`, igual que Núcleo/Distrito) — ahora usa el mismo helper por rol explícito. Todo probado contra la API real, sin regresión en `JUNTA_ESCOLAR`.
6. ✅ **Aislamiento general por nivel — CERRADO 10-ago.** Auditoría del panel Junta Núcleo/Distrito, 3 hallazgos:
    - **Comunicados** → sin bugs, el mejor implementado de los 4 revisados (aislamiento correcto por distrito/núcleo/colegio, `assertOwnedByScope` bloquea edición/eliminación ajena).
    - **Meeting (gestión, no lectura)** → 🔴 bug real: `JUNTA_NUCLEO`/`JUNTA_DISTRITO` podían editar/eliminar/tomar asistencia/multar reuniones de un curso específico dentro de su alcance (intromisión, no jerarquía legítima — mismo criterio que Tesorería). Corregido: `assertCanManage()` extendido para rechazar explícitamente a ambos roles en los 5 métodos afectados. Probado sin regresión en `JUNTA_ESCOLAR`.
    - **createJuntaMember/createGobiernoMember** → 🔴 bug más grave de los 4: `JUNTA_NUCLEO` podía designar un `JUNTA_ESCOLAR` en **cualquier colegio del sistema**, de cualquier núcleo/distrito — la validación de alcance existía en `updateJuntaMember` pero nunca se replicó en el create. Corregido en `createUser`, probado de punta a punta con datos ficticios.
    - Aclaración importante resuelta en el camino: existe un caso legítimo real (Junta de Distrito/Núcleo convocando una asamblea de audiencia amplia) que **no se ve afectado** por estos fixes — se confirmó que el sistema no tiene hoy ninguna vía funcional para eso (`Meeting.courseId` obligatorio, `Convocatoria.schoolId` obligatorio + permiso solo de `JUNTA_ESCOLAR`, `Comunicado` sin filtro de audiencia por rol) — anotado como funcionalidad futura, no bug (ver "Fuera de alcance por ahora").
7. ✅ **Junta/Delegado sin escritura académica — CERRADO 10-ago.** Confirmado correcto en los 6 módulos revisados (Student CRUD/matrícula, Nota, Task, StudentAcademicAssignment, AcademicYear/Trimestre) — ninguno acepta escritura desde `JUNTA_ESCOLAR`/`DELEGATE`. `STUDENT_TOGGLE_STATUS` de `JUNTA_ESCOLAR` es angosto a propósito (solo activo/retirado, ya documentado).
7.1. 🔴 **Hallazgo colateral, más grave — CERRADO 10-ago:** `POST /api/students/import` e `/import-tutors` no tenían **ningún** permiso — accesibles para cualquier usuario logueado (`PARENT`, `STUDENT`, cualquiera), no específico de Junta/Delegado. Permitía crear estudiantes/asignar tutores en bloque vía Excel sin ningún control de rol. Corregido: `requirePermission(Permission.STUDENT_CREATE)` agregado a ambas rutas, probado (403 para rol sin permiso, 200 sin cambio para rol con `STUDENT_CREATE`).

### 🟠 Prioridad 1.5 — Asistencia: rediseño por bloques de períodos (mitigación + fix de fondo cerrados 4-sep-2026; diseño completo por bloques aprobado, parcialmente construido)

**Hallazgo real (4-sep-2026):** `StudentAttendance` solo permite UN registro por estudiante+curso+día (`@@unique([studentId, courseId, date])`) — pero un curso típico tiene 10-12 maestros distintos (uno por materia, horarios sin cruzarse entre sí). Confirmado empíricamente (prueba real, no teórica) que si un segundo maestro guarda después de otro, pisa en silencio lo ya guardado — sin error, sin fusión, y sin `AuditLog` sobre esta tabla, así que no hay forma de saber cuánto de esto ya pasó antes de detectarlo. Origen del hallazgo: Oscar Villagómez exportó el PDF de asistencia de un curso compartido con Aide Menacho y apareció el nombre de ella en la firma — investigado a fondo, no era un bug de "el código elige mal entre varios" (`attendances[0]` sin `ORDER BY`, sí corregido de paso) sino el síntoma real de que el modelo no soporta múltiples maestros por curso/día en absoluto.

**Números reales del colegio (medidos 4-sep-2026, solo lectura, sin tocar nada):**
- **18 de 18 cursos (100%) tienen múltiples maestros asignados** (10 a 12 cada uno) — no es un caso raro como 6°C, es la estructura normal de todos los cursos.
- El uso real a escala completa (los 18 cursos el mismo día) **recién arrancó el 3-sep-2026** (564 filas, 18 cursos, 11 maestros distintos ese día — antes de eso solo 3 fechas sueltas de prueba: 2 aisladas en junio + un arranque parcial de 2 cursos el 1-sep). Sin evidencia de colisión real ya ocurrida en los datos (cada curso/día tiene un solo `teacherId` homogéneo en todas sus filas).
- **Lectura honesta:** no es una emergencia de esta semana (la mitigación ya cierra el riesgo de pérdida de datos), pero con el 100% de los cursos estructuralmente expuestos y el uso recién empezando a escalar a diario, esto se va a volver fricción rutinaria pronto — no dejarlo en el backlog indefinidamente.

**Paso 1 — mitigación urgente (4-sep-2026, noche, commit `58f80d2`), luego reemplazada por el paso 2:** `saveAttendance` rechazaba con `409` (nombrando al maestro que ya registró) si otro maestro intentaba guardar sobre el registro de un tercero, salvo `force: true` tras confirmación en pantalla. Probada contra producción real (Oscar/Aide, datos descartables) — funcionó, pero solo avisaba antes de pisar, no resolvía el problema de fondo.

**Paso 2 — FIX DE FONDO, ya construido y desplegado (4-sep-2026, madrugada, commit `edbd0e3`):** cambio de plan sobre la marcha — en vez de esperar al diseño completo por bloques, se acotó un alcance mínimo que resuelve el problema real (Oscar y Aide pisándose) sin todavía cubrir el modelo de bloques completo. `StudentAttendance.@@unique` pasa a `[studentId, courseId, date, teacherId]` — cada maestro tiene su propia fila, nunca compite por la de otro. Con esto, **el candado 409 del paso 1 ya no hace falta y se sacó del código** (ya no puede haber conflicto real). Cambios acompañantes, todos necesarios para que nada se rompiera con el nuevo modelo (varias filas posibles por estudiante/día en vez de una sola):
- `getAttendanceByCourse`: cada maestro real ve/edita solo sus propias filas; DIRECTOR/SECRETARY siguen viendo el agregado del curso.
- `closeAttendance`: "quién falta" pasa a mirarse por maestro — de paso arregla que uno no pudiera cerrar su propia parte si otro ya había completado el curso entero.
- Notificaciones a padres: deduplicadas contra el día real (no la fecha de la asistencia) — bug real encontrado y corregido en la primera prueba de esa noche antes de desplegar.
- Reporte diario del Director: deduplicado por estudiante antes de contar (si no, un curso con 2 maestros mostraba el doble de presentes/ausentes).
- Gamificación (`hasPerfectAttendanceThisMonth`, `recalculateStreak`, `getWeekCalendar`, `getAttendancePercentThisTrimester`): las 4 asumían 1 fila = 1 día y se rompían de verdad con el modelo nuevo — corregidas con un helper compartido (`collapseToDailyStatus`) que aplica la regla ya confirmada (presente en cualquier fila del día cuenta).

Probado de punta a punta contra producción real con Oscar y Aide (los mismos del caso original): las 2 filas coexisten intactas, cada pantalla de maestro muestra solo lo propio, XP una sola vez, notificación una sola vez, reporte del Director sin duplicar. Un incidente real en el camino (500 por una instancia vieja del contenedor todavía sirviendo tráfico durante el rollover del deploy, con el Prisma Client generado contra el schema anterior) se resolvió solo al reintentar — no era un bug del código. Clon sincronizado (3 migraciones pendientes aplicadas, verificado índice por índice).

**Lo que el paso 2 NO cubre todavía** (queda para el diseño completo por bloques, ver "Próximos pasos" al principio de este documento — URGENTE-ALTA, no bloquea el uso diario pero no debe quedar indefinido): un mismo maestro con períodos NO consecutivos el mismo curso/día (ej. 1°,2° y luego 5°,6°) sigue siendo una sola fila para ambos tramos, no dos — el modelo por `teacherId` no distingue eso. Tampoco están construidos el reporte diario con detalle/selector por bloque ni el PDF con selector de bloque (ambos siguen funcionando en modo simple/agregado, sin romperse, tal como se pidió).

**Diseño completo por bloques, aprobado, parcialmente construido — retomar con calma cuando corresponda:**

Regla de agrupación confirmada: si un maestro tiene varios períodos SEGUIDOS (números de período consecutivos — un recreo entre período 2 y 3 no rompe el bloque, se interpreta por número, no por reloj real) con el mismo curso el mismo día, es UNA sola asistencia para todo el bloque. Períodos no consecutivos del mismo maestro/curso/día = bloques separados. Un solo período = bloque de tamaño 1, mismo algoritmo, sin caso especial.

1. ⏳ **Algoritmo de bloques** (pendiente — el fix de esta noche por `teacherId` no lo necesitó): traer `Schedule` de (teacherId vía `teacherSubjectCourse`, courseId, dayOfWeek), ordenar por `period`, cortar donde `period[i+1] != period[i]+1`. Cada corte = un bloque (`periodStart`/`periodEnd`/`startTime`/`endTime`). Es lo único que falta para cubrir el caso de un mismo maestro con períodos NO consecutivos el mismo curso/día.
2. ⏳ **Modelo de datos — Opción B aprobada, pendiente** (esta noche se usó la Opción A simplificada, solo `teacherId` en la clave, sin tabla nueva): tabla `AttendanceBlock` (`courseId, teacherId, date, periodStart, periodEnd, startTime, endTime, schoolId`) + `StudentAttendance.blockId` FK nullable (`NULL` = registro histórico o del fix de esta noche, sin bloque — el pasado no se reconstruye, ya confirmado). El bloque se resuelve y se **congela en el momento de guardar** con el horario vigente ese día — nunca se recalcula en vivo si el horario se edita después.
3. ⏳ **Reporte diario — pendiente, hoy sigue en modo simple/agregado** (deduplicado, no roto, pero sin desglose por bloque): "cumplimiento" pasaría de ✓/✗ a fracción ("3 de 5 bloques") — bloques esperados (derivados del `Schedule` completo agrupado) vs bloques reales guardados. Pantalla de detalle: selector de bloque dentro del curso — **maqueta a revisar junto con Raul antes de construir, no armar a ciegas**.
4. ⏳ **PDF con firma — pendiente, hoy exporta simple** (el bloque actual del maestro que exporta, sin selector): un PDF por bloque — un maestro con 3 períodos seguidos tendría una sola firma para todo el bloque. Encabezado agregaría el rango ("Períodos 3°-5° · 09:35-11:30").
5. ✅ **Ventana de horario del Maestro** — ya estaba bien antes de esta noche (confirmado en el diagnóstico: no junta de más huecos entre tramos no seguidos) y no necesitó cambios; el guardado/lectura sí quedó resuelto esta noche, aunque por `teacherId` y no por bloque real.
6. ✅ **Gamificación — RESUELTO esta noche.** XP/racha 1 vez por día, alcanza con PRESENTE en al menos una fila del día (`collapseToDailyStatus`).
7. ✅ **Notificación a padres — RESUELTO esta noche.** Máximo 1 por día, deduplicada contra el día real.
8. ✅ **`closeAttendance` — RESUELTO esta noche**, scopeado por maestro (no por bloque real, pero ya no se bloquea entre maestros distintos del mismo curso).

**Con esto, de los 8 puntos originales solo quedan 4 pendientes de fondo: el algoritmo de agrupación (1), la tabla `AttendanceBlock` real (2), y las 2 piezas de UI (3 reporte, 4 PDF) — los puntos 5-8 ya están resueltos en la práctica, aunque no exactamente con el modelo de bloques todavía.**

### 🟡 Prioridad 2 — Funcionalidad de Tesorería en curso
8. ✅ Cerrado sin acción (10-ago): el "Aporte BTH 2026" mal asignado no existía en la base — Raul ya lo había eliminado manualmente antes de esta verificación. Confirmado: no existe ningún `Charge`/`MandatoryCharge` así en el sistema; lo único con "BTH" en 2026 es `Deuda Anterior — Aporte BTH 2025` (84 registros, traslado legítimo del cierre económico), sin relación con este pendiente. No confundir con "Cuota Inicial de Inscripción" 2026 (425 cargos reales, 145 pagados) — esos NO se tocan.
9. ✅ Cerrado (10-ago): el buscador ya existía en la pantalla Historial — cumple los 3 requisitos (búsqueda por recibo, detalle completo, "no encontrado" claro). Hallazgo colateral corregido de paso: `getPaymentsHistory` no tenía el candado `assertHasOwnSchool()` que sí se aplicó a los otros 4 endpoints de lectura en el punto 5 — `JUNTA_NUCLEO`/`JUNTA_DISTRITO` veían el historial de pagos de todo su núcleo/distrito. Corregido con el mismo patrón, probado contra API real.
10. ✅ Cerrado (10-ago): agrupado por curso implementado (101 casos reales, no los 57 originales — la base creció durante la sesión). Manejo del caso "tutor con hijos en cursos distintos" (16 de 101 casos, 16%): se muestra bajo cada curso correspondiente con etiqueta "🔗 Compartido con hermano/a en {curso}", sin duplicar en los totales generales. **Pendiente: Raul debe probarlo en pantalla** — Claude Code solo verificó por API/tipos, no lo vio renderizado.
11. 🟡 Import CSV por curso — implementado y verificado por API/tipos (10-ago). Botón "Importar" por bloque de curso en Verificación por Curso, preview obligatorio, dedupe por tutor, validación de curso/tutor. **2 bugs colaterales corregidos**: (a) pérdida de contexto de tenant en las 6 rutas con multer (`AsyncLocalStorage` no sobrevivía el parsing de `multer 2.x` — afectaba `/students/import`, `/students/import-tutors`, `/parents/import`, `/schools/import`, `/district/logo`, `/poa-acta`; corregido con middleware que reconstruye el contexto desde `req.userId/userRole/userSchoolId`; **producción verificada sin filas `schoolId: 0`**, no se vio afectada); (b) mangling UTF-8 en el parseo de CSV. **Pendiente: Raul debe probarlo en pantalla antes de commitear** — Claude Code solo verificó por API/DB, nunca lo vio renderizado. Limitación conocida: el CSV no puede representar un pago parcial real contra el monto completo (solo "monto reducido pagado" o "monto completo sin pagar") — para esos casos, importar como no pagado y corregir después con "Editar".
12. 🟡 Cuota Inicial 2026 de Elsa Tito Cabrera — **decisión tomada (10-ago): queda registrada como NO PAGADA/pendiente**, sin asumir nada sin respaldo. Se le va a pedir al padre/tutor el comprobante físico; una vez presentado, se registra el pago usando "Editar" (Verificación por Curso). No requiere ninguna acción de Claude Code hasta que el respaldo se presente.

### 🔵 Prioridad 4 — Gobierno Estudiantil: CRUD completo (deuda de frontend, backend parcial)

Backend confirmado: `GET /` y `PUT /:id` en `gobierno.routes.ts` (gateados por `GOBIERNO_MANAGE`). **Falta confirmar si existen `POST` (crear/designar más allá del alta inicial de Distrito) y `DELETE`/reasignación** — verificar antes de construir frontend, para no descubrirlo a mitad de camino.

12.1. 🔴 **Verificar el flujo real de designación de Junta ya construido** — el informe técnico original decía que el módulo `junta` "crea, en una sola transacción, tanto la cuenta de usuario como el registro de miembro de junta directiva", lo cual suena a que podría estar **creando una persona nueva** en vez de **seleccionar un `Parent` ya existente** en la base con validación de que tenga hijo/sea tutor en el alcance correspondiente (ver regla de negocio en "Reglas de negocio por actor → Padres"). Confirmar cuál de los dos comportamientos tiene hoy — si crea nuevo sin validar contra `ParentStudent`, es un hallazgo que corregir antes de construir lo mismo para Gobierno Estudiantil (para no replicar el mismo error).

Espejo exacto de lo que ya existe y funciona para Junta de Padres (`/padres/junta`, `/padres/nucleos`):

13. ⏳ **Backend — completar CRUD si falta:**
    - [ ] Confirmar/crear `POST /api/gobierno` (designar miembro nuevo en cualquier nivel, no solo alta inicial de Distrito)
    - [ ] Confirmar/crear `DELETE /api/gobierno/:id` o mecanismo de reasignación (remover a alguien del cargo)
    - [ ] Validar que la jerarquía de designación se respete igual que en Junta (Distrito designa Núcleo/Colegio, etc.)

14. ⏳ **Frontend — Directorio de Gobierno Estudiantil** (espejo de `/padres/junta`):
    - [ ] Pantalla de listado de miembros actuales por nivel (hoy `GOBIERNO_NUCLEO` solo tiene "Inicio"+"Comunicados", sin listado)
    - [ ] Ver detalle de un miembro (cargo, gestión, datos personales)
    - [ ] Editar un miembro existente (usando el `PUT /:id` que ya existe)
    - [ ] Designar/dar de baja un miembro (una vez confirmado el backend en el punto 11)
    - [ ] Aplicar a los 3 niveles: Colegio, Núcleo, Distrito (hoy Distrito solo tiene el formulario de alta, sin gestión posterior)

15. ⏳ **Frontend — Estructura territorial para Gobierno:**
    - [ ] Crear `estudiantes/nucleos/` (espejo de `padres/nucleos/` que ya existe) — vista de núcleos y colegios para navegar y designar

16. ⏳ **Consistencia de permisos:**
    - [ ] Confirmar que `GOBIERNO_MANAGE` distingue correctamente el nivel de quien opera (un `GOBIERNO_NUCLEO` no debería poder gestionar miembros de otro núcleo ni de Distrito) — aplicar la misma lógica de tenant-scoping que ya protege Junta
    - [ ] **Nota de diseño — autonomía sin veto:** cuando se construyan pantallas de Director/Junta Escolar relacionadas con Gobierno Estudiantil (ej. aprobar actividades, ver decisiones), no incluir ningún mecanismo técnico de "veto" o bloqueo sobre decisiones ya tomadas por Gobierno Estudiantil — solo pueden supervisar, nunca anular, salvo que una decisión viole explícitamente una norma (fuera del alcance del sistema decidir eso automáticamente)

### 🟢 Prioridad 3 — Deuda técnica de arquitectura (no urgente, aprovechar ventana de bajo riesgo)
17. Agregar `MandatoryCharge` a `DIRECT_SCHOOL_SCOPED_MODELS` (hoy depende 100% de filtrado manual, por construirse antes de que el patrón estuviera consolidado).
17.1. ✅ **RESUELTO (27-ago-2026) — `AuditLog` genérico agregado, 4 puntos instrumentados.** Hallazgo original de la verificación retroactiva del bug de DELEGATE (10-ago). Diseño: `AuditLog` genérico (no soft-delete — decisión explícita, ver razonamiento abajo) con `action` (`DELETE`/`OVERWRITE`), `entityType`, `entityId`, `before`/`after` (Json, snapshot de campos relevantes, no el registro completo), `actorUserId`, `schoolId` — mismo patrón que `Refund` (agregado a `DIRECT_SCHOOL_SCOPED_MODELS`). **Por qué `AuditLog` y no soft-delete**: `regenerateTutorCode` no borra, sobrescribe — un soft-delete no puede cubrir ese caso en absoluto, mientras que un log de acciones cubre `DELETE` y `OVERWRITE` con el mismo mecanismo; además el soft-delete tiene blast radius alto (cada query de cada modelo tocado necesita excluir filas soft-borradas) y choca con `@@unique([ci, schoolId])` de `Parent` (una fila "borrada" seguiría ocupando el CI). **4 puntos instrumentados** (los mismos priorizados en el diseño, más un hallazgo nuevo más grave que los 3 originales):
  - 🔴 `mandatoryChargeService.remove` — el más grave: borraba `Payment`+`Charge` reales (dinero) con un guard "blando" saltéable (`force=true`) sin dejar ningún rastro. Ahora loguea un snapshot completo (plantilla + cada `Charge` + cada `Payment` que se pierde) antes de borrar, dentro de la misma transacción.
  - `deleteParent` — snapshot (nombre/CI/kardex/contacto) logueado dentro de la transacción ya existente.
  - `deleteStudent` — **cerrada la inconsistencia real con `deleteParent`**: ahora tiene el mismo guard de `Charge` (rechaza con 409 si el estudiante tiene cargos propios, antes no lo verificaba) y quedó envuelta en transacción por primera vez (antes no lo estaba — necesario para que el log sea atómico con el borrado).
  - `regenerateTutorCode` — loguea `before`/`after` del código de asistencia sobrescrito.
  - Probado contra el clon con un backend real levantado en un puerto temporal (no solo scripts sueltos) — los 6 escenarios (incluidos los 2 casos que deben rechazar) respondieron correctamente vía HTTP, verificado que lo borrado se borró de verdad y lo bloqueado quedó intacto, limpiado sin rastro (incluidos los propios `AuditLog` de prueba).
  - Sin pantalla de consulta en este alcance — se lee directo por DB cuando haga falta, mismo criterio que `ParentKardexHistory`.
17.2. **2 `Charge` "Deuda Anterior — Aporte BTH 2025" (ids 4963 y 4967) marcados `PAGADO` sin ningún `Payment` asociado** — hallazgo de la validación cruzada del sub-lote 5.3 de la migración a producción (23/24-ago-2026): `sum(Charge.paidAmount)` no coincide exacto con `sum(Payment.amount)` (diferencia de Bs. 200 = Bs. 100 × 2). Confirmado que la diferencia es **idéntica en local y en producción** — preexistente, no introducida por la migración. Probable origen: ajuste manual o backfill histórico que marcó el cargo como pagado sin generar el `Payment` correspondiente. Sin urgencia, revisar en algún momento futuro — no se toca por ahora.
17.3. 🟢 **`Student.id` 482 "Maitane Hurtado Herrera" tiene 2 `ParentStudent` con `isTutor:true` — pero solo en LOCAL, no en producción.** Rompe el invariante "un solo tutor por estudiante" únicamente en `edulink_dev` (Jenniffer Herrera, Parent 1085, y María Fátima Herrera Revollo, Parent 771, ambos `isTutor:true`). **Verificado en producción real (28-ago-2026): solo Jenniffer Herrera tiene `isTutor:true` ahí** — el invariante está sano en producción, la anomalía es ruido exclusivo de local, nunca se aplicó. De cualquier forma no afecta la corrección de `Student.kardex` del ítem 17.4 — Jenniffer tiene `Parent.kardex: null`, así que Maitane cae en "tutor sin kardex" (sin tocar) en ambos entornos, por razones distintas. Deuda técnica menor: limpiar el vínculo duplicado en local para que quede igual que producción — sin urgencia.
17.3. ✅ **RESUELTO (25-ago-2026) — "Buscar y aplicar a faltantes" de Cargos Obligatorios no verificaba matrícula activa.** Hallazgo real (no solo teórico): un clic accidental en producción disparó el botón y generó 16 `Charge` nuevos — investigados uno por uno, los 16 resultaron legítimos (los 16 tutores tienen hijo con matrícula 2026 activa, coincidencia porque son justo los tutores recién vinculados en la migración de estudiantes/padres de esta sesión), pero el criterio real de `findTutorsMissingCharge` (`mandatoryCharge.repository.ts`) solo chequeaba `isTutor:true` + no tener ya el cargo — **sin verificar que el estudiante tuviera matrícula activa en la gestión de la plantilla**. Riesgo real: un tutor cuyo único hijo ya no está inscrito (ej. casos "Grupo C", ver 19.2.3) hubiera recibido el cargo por error. Corregido agregando `student: { assignments: { some: { academicYearId } } }` al criterio, con el `academicYearId` de la propia plantilla (no hardcodeado, sirve para cualquier gestión futura) — probado contra el clon con un caso sintético tipo Grupo C: el criterio viejo lo incluía por error, el nuevo lo excluye correctamente; sanity check confirmó que sigue encontrando a los tutores legítimamente faltantes (307 en el clon). Desplegado a producción, commit ver git log.
18. Definir el dominio de negocio de "Tesorería a nivel Núcleo/Distrito" antes de destrabar esa UI (qué significa un cargo de núcleo, cómo se reparte entre colegios, quién lo cobra).
18.1. ✅ **RESUELTO (25-ago-2026) — `select` explícito agregado en los 2 `findActiveAcademicYear`.** Hallazgo del incidente de producción del 22-ago-2026 (ver Notas de trabajo): `prisma.academicYear.findFirst()` sin `select` pide TODAS las columnas del modelo tal como está en el `schema.prisma` desplegado — si ese schema ya tiene una columna que la migración correspondiente todavía no aplicó en producción, la lectura completa revienta con `P2022`, aunque la columna nueva no tenga nada que ver con lo que la función necesita. Corregido leyendo primero el código consumidor real (no asumido): `report.repository.ts` → `select: { id, year, startDate, endDate }` (usado por `getAttendanceReport` y `getTreasuryReport`, este último devuelve `year` tal cual al frontend); `parent.repository.ts` → `select: { id, year }` (usado por `buildAttendanceCode`, `getAllWithStatus`, `getParentsGroupedByCourse`). Verificado con `tsc --noEmit` limpio (habría marcado error si algún caller usara un campo fuera de lo seleccionado) + prueba real contra los 3 endpoints afectados (`/api/reports/attendance`, `/api/parents/registered-status`, `/api/reports/treasury`) contra el backend local. `findAcademicYearById` (mismo repositorio, sin `select`) queda fuera de este fix a propósito — no fue parte del hallazgo original.

### 🟢 Rendimiento y escala — preparación para nivel municipal (auditoría + corrección 22-ago-2026)

Contexto: EduLink hoy opera 1 sola UE (cientos de familias); el objetivo es poder escalar a un municipio completo (~16,000 estudiantes, ~33,500 padres/tutores, ~1,500 maestros/administrativos, +1,000 estudiantes netos/año). Auditoría completa de infraestructura/consultas/índices + corrección de los 4 hallazgos de Prioridad 1-2, **probada contra el clon local, sin aplicar todavía a producción real**:

22. ✅ **RESUELTO (contra el clon) — 18 índices agregados** (`schoolId`/`parentId`/`studentId`/`academicYearId` en `Charge`, `Student`, `Parent`, `ParentStudent`, `User`, `Payment`, `Notification`, `Nota`, `StudentAttendance`, `StudentAcademicAssignment`, `TeacherAttendance` — ninguno tenía índice propio antes, solo cobertura parcial vía `@@unique` compuestos con esos campos en posición secundaria, inútil para filtrar por sí solos). Migración `20260823024340_add_performance_indexes`, 100% aditiva (`CREATE INDEX`), aplicada en local + clon, verificada con `EXPLAIN ANALYZE` (Postgres ya usa el índice nuevo). **Pendiente aplicar a producción real** — se junta con el despliegue de código de los ítems 24/25 para un solo reinicio del servicio.
23. ✅ **RESUELTO (comportamiento probado contra el clon) — `connection_limit=10`** para el `DATABASE_URL` de producción (Postgres real: `max_connections=100`; el valor deja margen para ~8 instancias del backend antes de necesitar tocarlo de nuevo). Probado con 20 queries concurrentes contra un pool de 10: 0 errores, encola en vez de fallar (dos oleadas de ~1s cada una). **Pendiente aplicar la variable en producción real** — junto con el despliegue de código de 24/25, mismo motivo que el ítem 22.
24. ✅ **RESUELTO (contra el clon) — paginación opt-in en 7 endpoints** (`GET /api/students`, `GET /api/parents`, `GET /api/parents/attendance-codes`, `GET /api/parents/registered-status`, `GET /api/treasury`, `GET /api/reports/treasury` [el array `morosos`], y el listado básico de estudiantes) vía `page`/`pageSize` query params opcionales. **Diseño clave: "lista pero no activa"** — sin esos parámetros, comportamiento 100% idéntico al actual (mismo array plano, mismo total, sin límite), porque hoy el frontend real ya muestra 638 estudiantes/935 padres/347 tutores sin paginar en la única UE real — activar un límite por default hubiera sido una regresión silenciosa, no una mejora. La capacidad de pedir páginas queda lista en el backend, pero **no reduce ninguna carga real hasta que el frontend la use** — ver ítem 24.1. De paso, se corrigió un bug de correctitud en el listado general de padres (`parent.repository.ts`, `listParents`): el filtro `isActive` se aplicaba con `.filter()` de JavaScript *después* de traer la página completa, lo que hubiera dado páginas con conteos inconsistentes — movido a la cláusula `where` de Prisma, verificado contra SQL directo (935 activos / 0 inactivos / 0 sin cuenta, coincide exacto). **Excluidos de este plan a propósito** (paginar rompería su lógica real, no es una mejora): `report.repository.ts` `findChargesForYear`/`findCarriedChargesForYear` (fuentes de agregación/agrupamiento en memoria sobre el set completo) y las 3 de `credentials.repository.ts` (operaciones de reseteo masivo que necesitan procesar todo el conjunto, no una página) — mismo criterio que llevó a excluir también `findTutorsWithoutCode` (operación de fondo que asigna código a *todos* los tutores sin código; paginar solo procesaría la primera página en silencio).
24.1. ✅ **RESUELTO (29-ago-2026) — las 5 pantallas reales que consumían los endpoints paginables del ítem 24 ya piden páginas.** La protección contra el crecimiento a escala municipal queda activa, no solo disponible: `Pagination.tsx` reutilizado en las 5, cada una probada en pantalla por Raul y verificada en vivo contra producción real antes de darla por cerrada:
    1. **Tutores** (`padres/tutores`) — commit `7baa00e`.
    2. **Estudiantes** (`admin/estudiantes`) — filtros género/curso movidos al backend (se hubieran roto paginados) — commit `7baa00e`.
    3. **Padres/Tutores admin** (`admin/padres`) — orden alfabético/kardex movido al backend (orden numérico correcto vía comparación natural en JS, evita el orden lexicográfico de Postgres sobre `kardex` como string) — commit `7baa00e`.
    4. **Reportes Financieros — tabla de morosos** (`padres/tesoreria/reportes`) — paginada aparte de las stat cards/"Por tipo de cargo" (que siguen sobre el set completo); Exportar PDF/Excel pide la lista completa aparte al hacer clic, sin `page`/`pageSize`, para no truncar el reporte a la página visible — commit `fe2f450`.
    5. **Padres registrados** (`padres/personas/registrados`) — cierra también el hallazgo de usabilidad del ítem 20.1 (buscador ya server-side, no solo agregado); filtro Activo/Inactivo movido al backend (matrícula en la gestión activa, en SQL) por el mismo motivo que los filtros de Estudiantes; stat cards (Total/Activos/Inactivos) via `summary` calculado sobre el universo completo, ignora el filtro/búsqueda actual — commit `b32e622`.

    Cada commit aislado (`git stash` del resto del working tree antes de probar `tsc --noEmit`), pusheado, y confirmado sirviendo el formato paginado `{data,total,page,pageSize}` con una llamada real a la API de producción antes de pasar a la siguiente pantalla. Con esto, el ítem 24 completo (backend + frontend) queda cerrado — la paginación reduce carga real, no solo existe como capacidad sin usar.
25. ✅ **RESUELTO (contra el clon, incluido el camino de `DELEGATE`) — N+1 de `treasury.service.ts` `createBulkCharges`.** Antes: 3 queries secuenciales por cada `parentId` del lote (chequeo de tutor, estudiantes vinculados, insert) — un lote de 500 tutores eran 1,500 round-trips a la DB en una sola request. Ahora: 2-4 queries totales sin importar el tamaño del lote — 1 query batch para validar tutoría de todo el lote (`findTutorParentIds`), reutiliza `delegateRepository.findTutorParentIdsForCourse` (ya existía) para resolver el alcance de `DELEGATE` una sola vez en vez de por cada padre, e inserta todo con `createMany` en un solo `INSERT`. Probado contra el clon con datos reales (5 tutores + 2 no-tutores → `created:5, errors:2` exacto) y con el camino de `DELEGATE` real (3 tutores del curso propio + 1 tutor de otro curso + 1 no-tutor → `created:3, errors:2`, solo entraron los del curso correcto) — limpiado sin rastro después de cada prueba.
26. ⏳ **PgBouncer — investigado, queda en evaluación, no activado.** Railway lo ofrece nativo desde junio-2026 (dashboard del Postgres → Connection Pooling → Add PgBouncer, un clic, migra automáticamente las variables de conexión de los servicios del proyecto al endpoint pooled, escalable de 1 a 6 réplicas). Es la respuesta natural para cuando hagan falta más de las ~8 instancias que ya cubre el `connection_limit=10` del ítem 23 — no antes.
27. ⏳ **Decisiones de licenciamiento pendientes, de negocio/legal, no técnicas** (auditoría de licencias 22-ago-2026):
    - **Definir los términos de licencia propia de EduLink** (archivo `LICENSE`, o equivalente) antes de licenciar el sistema a otros municipios — confirmado que hoy **no existe ningún archivo `LICENSE` ni campo `license` en ningún `package.json` del proyecto** (`license-checker` marca el propio proyecto como `UNLICENSED`/`UNKNOWN`). Sin esto, no hay marco legal formal para definir bajo qué términos un tercero podría usar/modificar/redistribuir el código.
    - **Decidir si vale la pena eliminar las dependencias con copyleft débil** (LGPL-3.0/MPL-2.0, todas transitivas, ninguna declarada directamente: `sharp` vía `next`, `lightningcss` vía Tailwind, `axe-core` vía `eslint-config-next` [solo dev, nunca llega a producción], `dompurify` vía `jspdf` [licencia dual, se puede elegir Apache-2.0 sin cambiar de paquete]) — el riesgo técnico real es bajo/nulo (ninguna se modifica, solo se usan tal cual), pero podría valer la pena por política contractual si algún municipio exige cero copyleft en el contrato de licenciamiento. **No hay GPL/AGPL fuerte en ningún lado del árbol**, directo ni transitivo.
28. ✅ **RESUELTO (25-ago-2026) — diagnóstico completo del resto de módulos, comparando conteos local vs producción tabla por tabla.** Cubiertos: Académico (Course, Subject, Schedule, SchedulePlan, Nota, NotaItem, Task, TaskSubmission, TeacherSubjectCourse, CourseTutor), Asistencia (StudentAttendance, TeacherAttendance), Portería (GateRecord, BiometricTemplate), Comunicación (Meeting, Comunicado, Notification, Attendance de reuniones), Gobernanza (JuntaMember, GobiernoMember, PoaActa), Docentes/Staff (Teacher, Staff, TeacherSpecialty), Gamificación (StudentGamification, StudentAchievement, StudentTrimesterBonus). **Resultado: ningún módulo tiene un volumen de datos sin migrar** — la diferencia máxima entre local y producción en cualquier tabla fue de 2 filas, y la mayoría coincide exacto o está vacía en ambos lados. Tiene sentido: a diferencia de Estudiantes/Padres/Tesorería (datos históricos que necesitaban reconciliación), estas tablas reflejan mayormente actividad operativa generada en cada entorno por separado. Único caso investigado a fondo — `JuntaMember` (local=3, prod=1 a nivel Colegio) — resuelto sin acción, ver 28.1. **No queda ningún trabajo de migración de datos pendiente en todo el sistema.**

28.1. ✅ **RESUELTO (25-ago-2026) — caso `JuntaMember`, sin acción: son artefactos de prueba, no directivos reales sin migrar.** De los 3 registros locales a nivel Colegio (`schoolId=1`): "Raul Martinez Aguanta" (Presidente) ya existe en producción, match exacto por CI. Los otros 2 — "Paulina Sandoval Gonzales" (Vocal) y "Evelin Balderrama Rojas" (Secretaria) — **no se migran**: sus `Parent` sí existen en producción (ids 502 y 21), pero el `JuntaMember` de cada una usa una cuenta `JUNTA_ESCOLAR` completamente aparte (`paulina.sandoval3@nnuu.edu.bo` id 2390, `evelin.balderrama2@nnuu.edu.bo` id 2391) creada por Raul mismo (`createdByUserId=2387`) el 1-ago-2026, con 7 minutos de diferencia entre ambas — mismo patrón de sufijos "2"/"3" de prueba ya visto en `paulina.sandoval2@nnuu.edu.bo` (ver ítem 17, `economicClosedById` dejado en `null`). El roster real de `JUNTA_ESCOLAR` en producción hoy (3 cuentas: `raul.martinez@`, `raul.martinezA@`, `junta@sgje.com`) confirma que ninguna de las dos fue designada en producción. **Si en algún momento Raul quiere designarlas realmente**, la vía correcta es usar sus cuentas `PARENT` reales ya existentes en producción (Paulina id 1138, Evelin id 657) — nunca crear una cuenta nueva aparte.

28.2. ✅ **RESUELTO (29-ago-2026) — las 4 cuentas `JUNTA_ESCOLAR` de prueba borradas en los 3 entornos.** Antes de tocar nada se auditó cada una (mismo criterio que el fixture "Padre DePrueba Curso": Charge, Payment, JuntaMember activo, ConvocatoriaAttendance) — 2 de las 3 locales sí tenían algo real enganchado, no era limpieza trivial:
  - `raul.martinezA@eltorno.edu.bo` (id 2311, clon+producción) — confirmada 100% limpia (sin JuntaMember/Parent/actividad). Borrada en clon, verificada, luego dump fresco de producción y borrada en producción real, verificada desde cero.
  - `paulina.sandoval3@nnuu.edu.bo` (local id 2390) y `evelin.balderrama2@nnuu.edu.bo` (local id 2391) — tenían un `JuntaMember` **activo** (VOCAL/SECRETARIA) apuntando a los `Parent` reales de Paulina (502) y Evelin (21), en vez de a sus cuentas reales (userId 1138/657) — o sea, en local ejercían el rol de Junta a través de la cuenta de prueba. Raul confirmó que nunca fueron designaciones reales (coincide con 28.1: en producción nunca se les dio de alta) — se borró el `JuntaMember` junto con el `User`, y de paso una `ConvocatoriaAttendance` huérfana de cada una (`charged:true` pero sin ningún `Charge` real detrás, verificado) que bloqueaba el borrado por FK.
  - `paulina.sandoval2@nnuu.edu.bo` (local id 2389) — era la responsable registrada del cierre económico de la gestión 2025 (`AcademicYear.id=4`). Raul confirmó que fue él quien cerró la gestión (desde esta cuenta de prueba por error) — se reasignó `economicClosedById` a su cuenta real (`raul.martinez@eltorno.edu.bo`, id 2387) antes de borrar la de prueba, en vez de dejarlo en `null`. Campo puramente de auditoría/visualización (no alimenta ninguna lógica condicional, confirmado por código) — sin riesgo técnico de que quede distinto del `null` que ya tiene producción (ese campo ya era divergente desde antes, por el mismo motivo: producción nunca tuvo cómo atribuírselo a nadie en la migración).
  - Verificado desde cero en cada entorno tras cada borrado: 0 rastro de las 4 cuentas, los 2 `Parent` reales (502, 21) intactos, el cierre 2025 con el responsable correcto.

### ⚪ Despliegue a producción — plan de migración en curso (10-ago)

**Descubrimiento clave:** producción NO está vacía — ya tiene datos reales de U.E. Naciones Unidas (schoolId 1) de un import de mayo-junio 2026, más otras 82 UE del distrito (no tocar). Es la MISMA gente que en local (match 93-95% por RUDE/CI), así que la migración es una **reconciliación con remapeo de IDs**, no un import limpio ni un reemplazo completo.

**Orden de trabajo decidido:** terminar primero los pendientes locales (import CSV, recibo Elsa, prueba en pantalla) para migrar una sola vez con los datos en su versión final — no migrar y luego repetir. La Fase 1 (mapeo, solo lectura) ya se adelantó en paralelo por no tener riesgo ni dependencia.

19. ✅ Fase 1 del plan de migración (mapeo de IDs local↔producción) — completa, guardada en scratchpad (`phase1-id-mapping.json`, no versionado). Resultado: Estudiantes 602/647 match exacto RUDE + 35 match por nombre con RUDE-typo + 10 sin match. Padres 778/937 match exacto CI + 127 match indirecto (vía estudiante vinculado) + 32 sin match.
19.1. ✅ **RESUELTO** — `Student` id 964 "Prueba Estudiante" y `Parent` id 1193 "Padre DePrueba Curso" confirmados eliminados de local (verificado 22-ago-2026, ninguno de los dos existe ya en `edulink_dev`).
19.2. ✅ **RESUELTO (22-ago-2026) — verificación física/SIE de los 5 RUDE-typo restantes.** Nota importante: al re-generar el mapeo (ver Notas de trabajo, sesión 22-ago) resultó que de los 35 casos originales, solo 5 seguían con RUDE distinto entre local y producción — los otros 30 ya no son comparables (ver hallazgo aparte, 19.2.2, sin relación con estos 5). Los 5 restantes se verificaron uno por uno contra documento físico/SIE — **en los 5, gana el RUDE de LOCAL, producción tiene el dígito mal**:
  | Estudiante | RUDE correcto (= local) | RUDE incorrecto (producción) |
  |---|---|---|
  | Luis Gerardo Gonzales Mojica | `419800712016018` | `419800212016018` |
  | Carlos Denilson Lopez Zambrana | `419800712016045` | `419800212016045` |
  | Angel Neimar Poiqui Farel | `419800312016068` | `419800212016068` |
  | Leonides Alberto Carballo Ortiz | `819814432016070` | `819714432016070` |
  | Keily Michelly Carrillo Leiva | `4198002120158785` | `4198002120158780` |

  Origen del RUDE correcto: ya habían sido corregidos en local el 8-ago-2026 por `backend/src/scripts/sync-students-2026.js` (Paso 0 del plan `piped-weaving-wadler.md`), cruzando contra la matrícula oficial 2026 del Ministerio (`ministerio-2026.json`, SIE código `41980023`) — el 22-ago se confirmó además contra el documento físico, doble verificación.

19.2.1. ⏳ **Ajuste a Fase 3 (actualizar registros existentes) para estos 5 casos específicos** — el matching automático por RUDE exacto de la Fase 3 NO va a encontrarlos (el RUDE de producción está mal, no coincide con ningún local). Regla especial: resolver estos 5 por **nombre** (ya identificados uno a uno arriba, por `id` local/producción — ver detalle completo en Notas de trabajo, sesión 22-ago) y, al migrar, **actualizar el campo `rude` de producción con el valor de local** para esos 5 `Student.id` puntuales — nunca dejar el RUDE viejo de producción activo después de la migración.

19.2.2. ✅ **RESUELTO (22-ago-2026) — 31 estudiantes con `rude: NULL` en local, origen distinto al de 19.2.** Investigado el 22-ago: NO tiene relación con `sync-students-2026.js` ni con el 8-ago (esa pista quedó cerrada, ver 19.2 arriba). Los 31 registros (30 con `createdAt` de mayo-2026, estudiantes reales pre-existentes) tienen su `rude` vaciado con `updatedAt` en una ventana de ~40 minutos el **21-jun-2026 (19:28–20:06 UTC)**. Se descartaron dos candidatos como causa: el commit `b3b110c` de esa misma tarde ("anular inscripción de estudiante") solo borra `StudentAcademicAssignment`, nunca toca `Student.rude`; `delete-duplicate-students.ts` tampoco vacía el RUDE del registro que conserva al deduplicar. Candidato sin confirmar y sin resolver más allá de este punto: `migrarEstudiantes.ts` (upsert `source→target` que sobrescribe el objeto completo, incluido `rude`) — no hay log ni commit que lo confirme con certeza, pero no bloquea la decisión de negocio (ver 19.2.3). Raul verificó los 31 a mano contra su planilla física — decisión completa en **19.2.3**.

19.2.3. ✅ **RESUELTO (22-ago-2026) — decisión de negocio para los 31 de 19.2.2, verificados por Raul contra planilla física.** Los 31 se dividen en 3 grupos:
  - **"Grupo C" (26 estudiantes)** — confirmado: NO continuaron en la gestión 2026 (consistente con lo ya observado: `isActive: false`, sin `StudentAcademicAssignment` 2026, ninguno aparece en `ministerio-2026.json`). **No migran como estudiantes activos.** Excepción explícita: si alguno tiene historial financiero real de 2025 (`Charge`/`Payment`), ese historial SÍ debe migrar igual — el `Student` en sí queda tratado como inactivo en producción, pero no se pierde el rastro de cargos/pagos ya hechos.
  - **4 con tutor placeholder** (`Student.id` 567, 572, 601, 623 — vinculados a un `Parent` con nombre "SIN NOMBRE PACO" o "NREG/NOMBRE PEREZ", datos de origen incompletos desde el import original) — **excluidos de la Fase 4 hasta investigación aparte**, no se tratan igual que el Grupo C ni se migran todavía en ningún sentido.
  - **`Student.id` 982 (Anabel Perez Perez)** — caso especial por tener `createdAt` de 9-ago (no 21-jun, como el resto) — **confirmado por Raul: ya no está en la unidad educativa**. Mismo tratamiento que el Grupo C (no migra como activa), pese al origen distinto.

  **Resumen**: 26 (Grupo C) + 1 (982) = **27 no continúan, mismo tratamiento** (inactivo en producción, historial financiero si existe sí migra) · **4 excluidos** de la Fase 4 por datos incompletos, pendientes de investigación aparte. Los 31 quedan completamente resueltos — no bloquean más la Fase 2/3.

19.3. ✅ **RESUELTO (23-ago-2026) — los 45 padres originales quedan completamente cerrados.** Al regenerar el 23-ago salieron 47 (no 45 — mismo fenómeno de siempre, los datos se movieron un poco desde el 22-ago), pero cuadran exacto con las categorías de abajo. Desglose completo:
  - **11 verificados por Raul contra planilla física original** (sesión 22-ago) — **completamente resueltos**:
    - **6 vinculados y aplicados a producción real**: `JULIO FERNANDO VARGAS VARGAS` → Samir Said Vargas Condori, `JUAN ROCHA LIMON` → Gerardo Jese Rocha Guzman, `BERNO FLORES SERRUTO` → Luciana Nicol Flores Martinez, `FERNANDO CABELLO VALLEJO` → Fernanda Cabello Ortiz, `WILSON CABRERA CALLEJAS` → Wilson Cabrera Cruz (curso 4°B→5°C confirmado real, no error — verificado en SIE), `MARGARITA AVARIPA CRUZ` → Benjamin Hurtado Avaripa (vía esposo Darwin, este caso ya estaba bien en producción, sin acción). En 4 de los 6 la madre tampoco estaba vinculada en producción — se agregó también.
    - **4 sin ninguna acción, casos cerrados por motivo real**: `SEVERINO MIRANDA MAMANI`, `WILSON ARAUZ RODRIGUEZ`, `ANIVAL VIDAL CABALLERO` (madre existe, sin ningún estudiante vinculado) y `FERNADO SILES HURTADO` (estudiante ya graduado, no inscrito en 2026).
    - **1 movido a Fase 4**: `WINDER VIZA CHOQUE` (ver detalle junto a los otros 3 de Fase 4 más abajo).
  - **8 placeholders descartados** (nombre basura del import original — `SIN NOMBRE`/`SIN REGISTRO`/`N/R`/`NREG`): ids de `Parent` 44, 130, 136, 137, 142, 199, 236, 237.
  - **17 vinculados y aplicados a producción real (23-ago), criterio "match indirecto vía hijo"** — mismo criterio ya aprobado para los 127 indirectos de la Fase 1: el RUDE del hijo ya matchea contra producción, así que no hace falta verificación física de cada uno. En los 17, el estudiante existía en producción **sin ningún tutor vinculado** — se creó el primer vínculo. Protocolo completo: dump fresco → cero cambios manuales detectados → dry-run contra el clon → dry-run final contra producción real (coincidió exacto) → apply → invariante "un solo `isTutor: true`" verificado desde cero en producción real, OK en los 17. `Henry Orellana Arispe, Richard Erwin Carrisales Gutierrez, Luis Antonio Heredia Aramayo, Fabio Jimenez Vargas, Gladimir Garcia Muñoz, Noel Arevalo Jordan, Emilio Veizaga Claros, Yhonny Claure Vargas, Dustin Henrry Cabrera Rocha, Juan Carlos Yampara Yucra, Margarita Abalos, Cesar Iver Leaños Delgadillo, Daniela Peña Pachi, Camilo Galarza Mariscal, Gilver Calla Acuña, Calixto Peralta Severiche, Nagay Rina Romero Acho`.
  - **3 aplicados a producción real (23-ago), Fase 4 genuina** (el `Parent` local no existía en producción, se creó `User`+`Parent` nuevo con los mismos datos/hash de local, `createdByUserId` remapeado de 2387 local → 2310 producción por coincidencia de email): `Jorge Mejia Tello` → Emerson Noel Mejia Ayhuasi (759), `Karina Fernandez Contreras` → Julio Leandro Pinto Fernandez (762), `Lina Soliz Garnica` → Fernanda Juan de Dios Soliz (408). Los 3 hijos ya existían en producción sin ningún tutor vinculado, RUDE verificado contra `ministerio-2026.json` antes de aplicar.
  - **`Winder Viza Choque` — RESUELTO, no era Fase 4.** Al recalcular se encontró que `Parent` id 66 ya existía en producción desde el import original de mayo-2026 (mismo `createdAt` al milisegundo) — la nota anterior estaba desactualizada. Ver más abajo (caso "Libny Luani Viza Apaza") el detalle completo de cómo se resolvió su vínculo real.
  - **8 resueltos sin ninguna acción** — sus hijos vinculados resultaron ser, verificado por `Student.id` exacto (no por parecido de nombre), los mismos 8 del "Grupo C" ya cerrado en 19.2.3 (no continuaron en la gestión 2026): `Rafael Pardo Reinaga` (→ Kethering Rafaela Pardo Estrada, id 511), `Mario Condori Acuña` (→ Luis Daniel Condori Vargas, id 517), `Luciano Condori Aguilar` (→ Rebeca Condori Martinez, id 574), `Laura Aracely Gomez Hidalgo` (→ Edil Neyher Veizaga Flores, id 596), `Ludvig Braner Pesoa` (→ Solange Yhuleizy Braner Andrade, id 599), `Jorge Ivan Dutra Mendoza` (→ Yeico Yamil Dutra Asillo, id 600), `Maurio Miguel Campo Montilla` (→ Jhuleydi Vedia Robledo, id 615), `Celso Quelca Villca` (→ Dilan Luis Quelca Cruz, id 625). No necesitaban revisión física — al no haber matrícula 2026 activa para esos hijos, no hay nada que vincular en producción.

  **Cuenta completa**: 11 (físico) + 8 (placeholders) + 17 (aplicados 23-ago) + 3 (Fase 4 genuina, aplicados 23-ago) + 8 (Grupo C, sin acción) = **47**, sin duplicar a Winder (ya contado en los 11, resuelto como "ya existía", no como alta). **Los 45/47 padres originales quedan 100% cerrados y aplicados a producción real** — no queda ningún padre de este lote pendiente.

19.3.2. ✅ **RESUELTO (23-ago-2026) — los "8 estudiantes nuevos" del mapeo original NO eran altas nuevas: eran duplicados de estudiantes ya activos, con fila huérfana sin RUDE.** Al ir a construir la Fase 4 de estudiantes (los 8 `NUEVO` del mapeo, incluida Luani Viza Apaza) se descubrió que los 8 ya existían en local Y en producción bajo otro `id`, con el RUDE oficial, activos y con matrícula 2026 — la fila que veníamos rastreando (creada 9-ago-2026, sin RUDE, `isActive: false`) era una captura duplicada/huérfana, probablemente de re-registrar a la familia sin darse cuenta de que el estudiante ya estaba cargado. Confirmado con los RUDE oficiales que Raul verificó a mano:
  - `Valeria Campos Arroyo` (huérfana 973) = `Valeria Campo Arroyo` (id 747, RUDE 419800212017007)
  - `Luani Viza Apaza` (huérfana 975) = **`Libny Luani Viza Apaza`** (id 806, RUDE 819800832017030) — el sistema local truncaba el nombre completo, no era otra persona
  - `Daril Mariel Cespedez Vedia` (huérfana 976) = `Daril Mariel Cespedes Vedia` (id 809, RUDE 419800212017009)
  - `Ernesto Said Acho Gomez` (huérfana 977) = sin duplicado real, no inscrito 2026 — descartado
  - `Jhuliana Yelma Huayhua` (huérfana 978) = `Jhuliana Nicol Yelma Huayhua` (id 838, RUDE 419800272018027)
  - `Yaritza Gamboa Hualilla` (huérfana 979) = `Yaritza Gamboa Huailla` (id 816, RUDE 419800312017044)
  - `Jose Ariel Ramos Avalos` (huérfana 980) = **`Jose Ariel Ramos Abalos`** (id 846, RUDE 819803212016017) — apellido mal transcrito, no otra persona
  - `Camila Campos Arroyo` (huérfana 981) = `Camila Campo Arroyo` (id 866, RUDE 4198007120155156)

  **Las 7 filas correctas (todas activas en local y producción) tenían CERO tutores vinculados en producción** — ese era el problema real, no la falta de altas. 3 tenían además conflicto de tutor entre la fila correcta y la huérfana, resueltos por Raul contra su documento oficial: `Valeria` — la fila correcta tenía a Judith Veizaga Pinto (equivocada, corregida en local), tutora real Maribel Arroyo Escobar; `Jhuliana` — la huérfana tenía a Nilda Huayhua Arenas (persona real pero tutora equivocada), tutora real confirmada Maribel Huayhua Arenas (ya estaba bien en la fila correcta); `Jose Ariel` — ninguna fila tenía tutor, confirmado después por Raul directamente: Margarita Abalos (mismo apellido). Además se agregó a Winder Viza Choque como `PADRE` (no tutor principal) de Libny Luani, confirmado por el documento oficial junto con Ana Isabel Apaza Mamani como madre/tutora.

  **Aplicado a producción real (23-ago), mismo protocolo de siempre** (dump fresco → verificar sin cambios manuales → dry-run final vía transacción con `ROLLBACK` contra producción real, ejecutando las escrituras reales dentro de la transacción para probarlas de punta a punta sin dejar nada escrito → commit real → reajuste de secuencias → verificación desde cero con consulta independiente): 8 vínculos `ParentStudent` creados (los 7 de arriba + Jose Ariel), invariante "un solo `isTutor: true`" OK en los 7 con tutor principal, Libny Luani con 2 vínculos (madre tutora + padre no-tutor) como se diseñó.

  **Limpieza de las 8 filas huérfanas en local** (973, 975, 976, 977, 978, 979, 980, 981) — antes de borrar se auditó qué tenían enganchado: cada una tenía exactamente 1 `ParentStudent` + 1 `StudentAcademicAssignment` de la **gestión 2025** (curso real de ese año) que NO existía en la fila correcta (que solo tenía matrícula 2026) — de haberse borrado sin más, se perdía el historial de curso 2025. Procedimiento de 3 pasos aplicado a las 8: reasignar el `StudentAcademicAssignment` 2025 a la fila correcta (`UPDATE studentId`) → borrar el `ParentStudent` de la huérfana → borrar el `Student` huérfano. Para Ernesto (sin fila correcta) el `StudentAcademicAssignment` se eliminó directamente, sin destino. Verificado desde cero: las 8 filas huérfanas ya no existen en local, los 7 `Student` correctos ahora tienen 2 asignaciones (2025 + 2026) cada uno. Producción nunca se tocó por esta limpieza — las filas huérfanas nunca llegaron ahí.

19.3.1. 🟢 **Hallazgo de calidad de datos, NO bloqueante, para investigar a futuro** — el CI `6336530` (asociado originalmente a "Maiber Pessoa Garcia", tutora legal sin parentesco de un estudiante ya graduado, caso Fernado Siles Hurtado en 19.3) pertenece hoy en el sistema a una familia completamente distinta ("Jesika Bonilla Galviz" / hijo "Jhon Dealer Pereira Bonilla"). Dos personas distintas asociadas al mismo CI en algún punto del historial — no se investiga ni se resuelve ahora porque ese CI no se usa para nada en la migración actual, pero queda anotado como deuda técnica de calidad de datos (ver también 17.1, auditoría/trazabilidad).

19.4. ✅ **Clon local levantado y probado (22-ago-2026)** — PostgreSQL 18 aislado (mismo binario instalado en 18.1, puerto 5544, `edulink_clon`, credenciales en scratchpad de sesión), dump de hoy restaurado + las mismas 4 migraciones aplicadas para igualar el estado real de producción. **2 hallazgos reales durante la primera prueba de escritura, ambos corregidos antes de escribir cualquier dato de negocio**:
  - **Bug de infraestructura del clon**: las secuencias de autoincremento no se sincronizaron tras el `pg_restore` (`P2002` al primer intento de `create()`) — corregido con un `setval()` genérico contra el `MAX(id)` real de cada tabla del clon, antes de cualquier escritura. Sin este fix, cualquier `create()` posterior del script de Fase 2/3 hubiera fallado de la misma forma.
  - **3 estudiantes quedaban sin ningún tutor legal en producción**: al vincular a los padres (Rocha Guzman, Vargas Condori, Cabello Ortiz) se detectó que sus madres — que sí existen como `Parent` en producción con el mismo `id` que en local — **nunca estaban vinculadas a esos hijos allá**, a diferencia de local donde sí lo están (`TUTOR_LEGAL`, `isTutor: true`). Corregido replicando exacto el vínculo de local en el clon. Verificado el invariante "un solo `isTutor: true` por estudiante" en los 4 casos completos (los 3 + Berno/Luciana, que sí estaba bien desde el principio).
  - **Primer resultado real del script de Fase 2/3 contra el clon**: 4 vínculos padre↔hijo creados (casos 2, 3, 5, 7) + 3 vínculos madre↔hijo agregados de más (el hallazgo) — los 7 verificados leyendo de vuelta desde el clon después de escribir. **Después extendido a 6 padres (sumando el caso 8) y aplicado también contra producción real — ver 19.7.**
19.5. ⏳ Regla no negociable para la Fase 3 (actualizar registros existentes): tocar SOLO campos de reconciliación (kardex, vínculo de tutor, nombre, isActive, datos académicos) — NUNCA `password`/`email`/campos de autenticación de `User` en producción, son cuentas reales en uso.
19.6. ✅ **RESUELTO** — dump fresco de producción generado el 22-ago-2026 (`railway_export_20260822_084233.dump`, verificado con `pg_restore -l`, ver sesión 22-ago en Notas de trabajo) — reemplaza al de más de un mes.

19.7. ✅ **PRIMER LOTE REAL DE MIGRACIÓN APLICADO A PRODUCCIÓN (22-ago-2026, noche) — CERRADO.** Dry-run contra producción real coincidió exacto con lo validado en el clon (0 sorpresas, 0 cambios manuales detectados desde el dump de la mañana). Aplicado y verificado desde cero:
  - **6 `Student.isActive` corregidos** (local prevalece, respaldado por matrícula oficial del Ministerio).
  - **5 `Student.rude` corregidos** (los RUDE-typo de 19.2, verificados contra físico/SIE).
  - **9 `ParentStudent` creados** (5 padre + 4 madre) para los 6 casos de padres confirmados (2, 3, 5, 7, 8, 11 de 19.3) — invariante "un solo `isTutor: true` por estudiante" verificado en los 6 estudiantes afectados.
  - Grupos 3 y 4: confirmado sin ninguna escritura necesaria, tal como se esperaba.
  - **🔴 Incidente encontrado y resuelto en el camino — ver detalle completo en Notas de trabajo, sesión 22-ago (noche): secuencias de autoincremento desincronizadas en 17 tablas de producción**, bug preexistente (no causado por esta sesión) que probablemente afectaba a usuarios reales ahora mismo antes del fix. Corregido con `setval()` en las 17, verificado con una prueba real de `POST /api/students` contra producción (limpiada sin rastro después).
  - `prisma migrate status` confirmado sano después de todo lo anterior.
  - **Pendiente para un segundo lote**: los 34 de los 45 padres sin match que Raul todavía no revisó — ✅ resuelto en 19.3 (23-ago), ver más abajo.

19.8. ✅ **FASE 5 — MIGRACIÓN COMPLETA DE TESORERÍA A PRODUCCIÓN (23/24-ago-2026) — CERRADA.** Última pieza del plan de migración: `Charge`, `Payment`, `Refund`, `ParentKardexHistory`, `MandatoryCharge` — dinero real de cientos de familias, tratado en 5 sub-lotes con confirmación explícita entre cada uno, mismo protocolo repetido 5 veces (dump fresco → verificar sin cambios manuales → dry-run vía transacción con `ROLLBACK` contra producción real, ejecutando las escrituras reales dentro de la transacción para probarlas de punta a punta sin dejar nada escrito → confirmación → commit real → reajuste de secuencias → verificación desde cero con consulta independiente):
  - **5.0** — `AcademicYear` 2025 (id=4, no existía en producción pese a que una nota anterior decía que sí) + 3 `MandatoryCharge` (ids 5, 8, 9). `economicClosedById` dejado en `null` en producción (el usuario local 2389 no tiene contraparte clara — cuenta `JUNTA_ESCOLAR` sin `Parent` ni `JuntaMember` asociado, probablemente de prueba — anotado como deuda de calidad de datos, sin investigar más).
  - **5.1** — 839 `Charge` de la gestión 2025 (incluidos los 101 `ANULADO`, migrados tal cual por ser el origen real de la cadena de traslado).
  - **5.2** — 529 `Charge` de la gestión 2026, incluidos los 101 `DEUDA_ANTERIOR` — cadena `sourceChargeId` verificada 101/101 resuelta contra los cargos 2025 recién migrados, 0 rotos.
  - **5.3** — 1010 `Payment`. Validación cruzada `sum(Charge.paidAmount)` vs `sum(Payment.amount)`: diferencia de Bs. 200, investigada y confirmada **idéntica en local y producción** (preexistente, no introducida por la migración) — ver hallazgo 17.2 (2 `Charge` "Deuda Anterior — Aporte BTH 2025", ids 4963/4967, `PAGADO` sin `Payment` asociado).
  - **5.4** — 1 `Refund` (`handledById` remapeado de 2387 local → 2310 producción, mismo patrón que el resto de la migración) + 328 `ParentKardexHistory`.
  - **Todos los `parentId`/`chargeId`/`studentId` referenciados resolvieron sin ningún remapeo** — la reconciliación de `Parent`/`Student` de las Fases 3/4 (mismo `id` en local y producción) hizo que Tesorería migrara sin fricción. `Charge.id` sí se preservó explícito (nunca había sido reconciliado, tabla vacía en producción) para no romper la cadena `sourceChargeId` ni las referencias de `Payment`/`Refund`.
  - **Verificación final 1:1 contra los números originales de local — todo coincide exacto**: `Charge` count=1368 sum(amount)=184400 sum(paidAmount)=139435; `Payment` count=1010 sum(amount)=139235; `Refund` count=1 sum(amount)=145; `ParentKardexHistory` count=328; `MandatoryCharge` count=3.
  - **Con esto, toda la migración local→producción queda cerrada**: estudiantes, padres, tutores, y ahora tesorería completa (2025+2026). No queda ningún dato pendiente de migrar de este plan.

20. ✅ **RESUELTO (24/25-ago-2026) — validación visual completa en producción real, hecha por Raul, 10 puntos confirmados**, con 2 hallazgos reales encontrados y corregidos en el camino (ambos desplegados y reverificados en producción):
    1. Cuenta de tutor con devolución (Chumacero Mamani Veronica, kardex 215) — cargos, pago, badge de devolución, todo correcto. **Hallazgo corregido**: faltaba `refunds` en el `include` de `findChargesByParent` (`treasury.repository.ts`) — el endpoint nunca mandaba el dato — y el badge de devolución nunca se había implementado en la pantalla de cuenta del tutor (`[parentId]/page.tsx`), solo existía en Verificación por Curso e Historial. Commit `349e09e`.
    2. Verificación por Curso — confirmado en pantalla. **Hallazgo corregido**: el botón del menú en "Reportes Financieros" que enlaza a Verificación por Curso y Deuda Trasladada nunca se había commiteado (código vivía sin pushear en el working tree desde una sesión anterior) — las páginas de destino sí estaban desplegadas, solo faltaba el link para llegar ahí. Commit `3a0177c`.
    3. Dashboard de Tesorería — totales coinciden exacto con la migración de Fase 5 (Bs. 73,265 cargado / Bs. 39,305 recaudado, gestión 2026).
    4. Historial de pagos — indicador de devolución visible.
    5. Libny Luani Viza Apaza — Ana Isabel Apaza Mamani (tutora) + Winder Viza Choque (padre), confirmado.
    6. Valeria y Camila Campo Arroyo — Maribel Arroyo Escobar, confirmado.
    7. Jose Ariel Ramos Abalos — Margarita Abalos, confirmado.
    8. Kardex — confirmado ok.
    9. Cargos Obligatorios — las 3 plantillas con conteos correctos (420/419/428 tutores).
    10. Login/navegación general — confirmado funcionando en todo el recorrido.

    **Con esto, toda la migración local→producción (estudiantes, padres, rendimiento, tesorería) queda verificada visualmente además de por API/DB — no solo cerrada en la base de datos.**
20.1. ✅ **RESUELTO (25-ago-2026) — buscador agregado a "Padres registrados".** Mismo componente `Toolbar` del sistema de diseño compartido que ya usa Tesorería (prop `search`) — filtro 100% cliente por nombre completo o CI, combinable con el filtro Activo/Inactivo existente, sin tocar backend (la pantalla ya trae todos los padres en una sola llamada). Probado en pantalla local antes de desplegar.
21. Revisar checklist completo de `docs/reporte-pre-produccion-tesoreria-2025.md`.

### 🔵 Prioridad 5 — Familia de apps livianas por rol (sin apuro, después del martes)

`maestro-app` (Asistencia + Notificación puntual para TEACHER/TEACHER_TUTOR, ver sesión 31-ago/1-sep-2026) es la primera de una familia planeada de PWAs livianas, una por rol — mismo patrón: login con el JWT real, gate de rol en el login (solo entra el rol dueño de esa app), instalable desde el navegador sin tiendas de apps. **Ninguna de las siguientes está construida todavía — es solo el orden de prioridad ya definido para cuando se retome**, decidido a propósito así:

1. **Padre** — el actor con más volumen de uso diario (notas, horario, tesorería, comunicados de sus hijos), primer candidato después de Maestro.
2. **Portería** — control de ingreso/salida (QR, lector USB), ya es una pantalla acotada y de uso muy puntual/repetitivo, encaja bien en el patrón liviano.
3. **Junta Escolar** — tesorería + delegados + comunicados de su UE.
4. **Estudiante** — notas, tareas, horario, gamificación.
5. **Administración** (Director/Regente/Secretaría) — **antes de construir una app liviana para este rol, completar primero el panel web existente** (hoy tiene huecos conocidos, ver resto del Roadmap) — no vale la pena una versión liviana de un panel todavía incompleto.

No implementar ninguna hasta que el usuario lo pida explícitamente — este ítem es solo el plan anotado, no una autorización para empezar.

5.1. ⏳ **Sincronización automática offline en `maestro-app`** (sin apuro, después del martes) — investigado y probado a fondo el 1-sep-2026 (offline real vía bloqueo de red a nivel de resolución de Chrome, no solo la emulación de DevTools que da falsos positivos con Service Worker de por medio). Estado actual, ya confirmado en pantalla: si se corta la señal a mitad de tomar asistencia, **el trabajo no se pierde** — las marcas por estudiante quedan en memoria, "Guardar asistencia" falla con un mensaje claro ("Error de conexión"), y reintentar manualmente al volver la señal guarda bien. La limitación real es que ese reintento es **manual** — el maestro tiene que darse cuenta de que falló y volver a tocar "Guardar". Mejora futura: cola local en IndexedDB + reenvío automático al detectar que volvió la conexión, sin intervención del maestro — requiere Background Sync API (o un detector de reconexión tipo `online`/`offline` event + cola persistente como respaldo, ya que Background Sync no está disponible en todos los navegadores). No se construye ahora.

### Fuera de alcance por ahora (posible v2)
- Reportes de calificaciones, matrícula/inscripciones, asistencia diaria agregada (hoy solo existen Maestros, Delegados, Asistencia-de-reuniones)
- Consolidación financiera hacia arriba (Núcleo/Distrito viendo tesorería agregada de sus colegios) — depende del punto 18
- **Branding por UE en `maestro-app` (decisión de arquitectura pendiente, 1-sep-2026):** `maestro-app` (PWA liviana para el módulo Maestro — Asistencia + Notificación puntual, primera de una familia planeada de apps por rol) usa el ícono/nombre a nivel DISTRITO (escudo real de `District.logoUrl`, vía `/api/public/district`), a propósito — sirve a maestros de cualquier UE del distrito por igual, ninguna UE tiene ícono propio. Si en el futuro una UE específica pide su propio ícono/branding distinto al del distrito, la solución correcta es una **app separada por colegio**, no intentar servir íconos distintos por usuario logueado desde la misma PWA (rompería el manifest, que es estático por origen/build, no por sesión). **No implementar hasta que haya más de una UE usando `maestro-app` activamente** — hoy solo la tiene U.E. Naciones Unidas.
- **Convocatoria de audiencia amplia para Junta de Núcleo/Distrito** (hallazgo 10-ago, durante auditoría del punto 6): ni `Comunicado` (sin campo de audiencia por rol dentro de un nivel — solo "maestros", solo "directores"), ni `Meeting` (`courseId` obligatorio, no soporta convocatoria sin curso), ni `Convocatoria` (`schoolId` obligatorio + permiso solo otorgado a `JUNTA_ESCOLAR`) permiten hoy que Núcleo/Distrito convoque una asamblea/aviso amplio (ej. "todos los padres del distrito", "solo maestros"). Es una necesidad real de negocio confirmada, no urgente, pero a diseñar cuando se aborde Tesorería/gobernanza de Núcleo/Distrito en general.
- **"Cambiar tutor" con persona sin relación previa** (11-ago): hoy "Cambiar tutor" solo permite elegir entre las personas YA vinculadas al estudiante (ej. madre/padre). Regla de negocio confirmada: en la realidad, cualquier persona registrada — incluso alguien que ya es tutor de OTRO estudiante sin ningún parentesco — puede convertirse en tutor de un estudiante distinto (`relationType: 'OTRO'` es justamente para esto: tutor sin parentesco, no "el que dejó de ser tutor legal"). Ampliar "Cambiar tutor" para permitir vincular a alguien sin relación previa (buscar cualquier `Parent` del sistema, no solo los ya conectados a ese estudiante) queda para una iteración futura.

## Notas de trabajo (prácticas generales)

- **Módulo de Tesorería**: documentado en detalle aparte (`tesoreria-respaldo.md`).
- **Ventana de bajo riesgo activa**: el sistema tiene pocos datos reales en juego (1 sola UE operando). Mientras dure esta ventana, corregir cualquier problema estructural de raíz (no parchear), aunque implique tocar código o datos ya cargados — antes de que haya múltiples UEs/familias reales donde el costo de corrección estructural sea mucho mayor. Ver "Pendientes / Roadmap" arriba para el estado actual priorizado.
- Avanzar módulo por módulo; revisar el schema antes de generar código; probar contra datos reales (no solo `tsc --noEmit`) antes de dar por cerrado un cambio; commits por unidad de trabajo terminada.

### Sesión 11-ago-2026 — "Cambiar tutor" y "Desvincular tutor" (completo, pusheado)

- **"Cambiar tutor" — bug de fondo corregido, 5 lugares:**
  1. `changeTutor` usaba `clearTutorForStudent` (filtraba por `relationType: 'TUTOR_LEGAL'` exacto) en vez de por `isTutor: true` — dejaba a dos personas con `isTutor: true` simultáneamente si el desplazado tenía `relationType` distinto (ej. "MADRE"). Corregido con `clearTutorFlagForStudent` (método nuevo dedicado, no toca `relationType`); `clearTutorForStudent` (el viejo, buggy) eliminado del código.
  2. El tutor promovido se forzaba a `relationType: 'TUTOR_LEGAL'`, perdiendo su etiqueta real ("Padre"/"Madre") — corregido, ahora conserva su `relationType` real, solo cambia `isTutor`.
  3. `generateCredentials` usaba `relationType === 'TUTOR_LEGAL'` como condición en vez de `isTutor` — corregido, mismo patrón.
  4-5. `admin/verificacion/page.tsx` y `admin/estudiantes/[id]/page.tsx` mostraban el ícono "🔑 Tutor Legal" comparando `relationType` en vez de `isTutor` — corregidos (mismo patrón que ya usaba bien `admin/padres/page.tsx`).
  Búsqueda completa en el repo confirmó que no quedan más casos del mismo bug (11 usos restantes de `relationType` son legítimos — intención inicial al crear un vínculo, no proxy de estado actual).
  **Regla de negocio confirmada:** `relationType` (Madre/Padre/Otro) describe quién es la persona — nunca cambia por su estado de tutor legal. `isTutor` es el único campo operativo para "es tutor legal actual". `ParentStudent` nunca se elimina al cambiar de tutor, solo se actualiza `isTutor`. "Otro" es exclusivamente para tutores sin parentesco (no para "el que dejó de ser tutor").
- **"Desvincular tutor" — construido:** acción de bajo riesgo (elimina solo el `ParentStudent` de un vínculo puntual, sin tocar la cuenta/historial del tutor), separada de "Eliminar" (destructivo, borra al tutor completo). Backend ya existía (`DELETE /api/parents/:id/unlink/:studentId`). Agregado en "Padres por curso" y "Tutores por curso" (este último requirió exponer `studentId` real en `/api/parents/by-course`, antes solo tenía `studentName`). "Todos los tutores" queda sin este botón por decisión explícita.
- **Pendiente:** Raul probar en pantalla, luego commit.
- **Fixture "Padre DePrueba Curso" (Parent 1193) limpiado por completo** — estaba causando un tutor duplicado real en Said Casiano Coronado Vargas (443) + un Charge huérfano de Cuota Inicial 2026 duplicando el aporte real de la familia (la tutora real, Sheila Vargas Tito, ya tenía su propio Charge correcto). Encontrado y corregido en el camino: `deleteParent` chocaba con actividad de usuario (`ConvocatoriaAttendance`) sin mensaje claro — mismo patrón que el candado de historial financiero, ahora también cubierto. Confirmado sin rastro en Parent/User/ParentStudent/Charge/ConvocatoriaAttendance.
- **4 commits de la sesión, todos probados en pantalla y pusheados a `main`** (`b903e62..0ab008b`): fix multer/AsyncLocalStorage, Tesorería (cierre económico + import CSV), Familias (Desvincular/Cambiar tutor + fixes), deleteParent (candado de actividad de usuario).

### Sesión 11-ago-2026 (continuación) — Registro de pago duplicado / devolución interna

**Caso de negocio:** cuando un tutor paga el mismo aporte dos veces por error (dos recibos distintos para el mismo cargo), el segundo recibo es rechazado por el import CSV (dedupe correcto — el Charge es por tutor, no se duplica). Pero la familia sí pagó dos veces en la realidad, y recibe una devolución interna — Raul quería que quedara documentado en el sistema, no solo de palabra.

- **Modelo nuevo `Refund`** (no una nota en `Charge`): `amount`, `date`, `reason`, `chargeId`, `handledById` (poblado con el usuario real — a diferencia de la columna muerta preexistente `Payment.receivedById`, que se detectó de paso y no se tocó). Atado a `Charge`, no a un `Payment` específico, porque el segundo recibo real generalmente ni siquiera llegó a crear un `Payment` (`registerPayment` ya rechaza pagos sobre un cargo `PAGADO`).
- **`Charge.status`/`paidAmount` nunca se tocan** — la devolución es 100% aditiva/informativa, verificado en cada paso de la prueba real.
- **Validación de monto**: rechaza si la devolución excede `paidAmount` menos devoluciones previas, con mensaje explícito incluyendo los números.
- **Permiso**: mismo candado que "Editar"/"Trasladar" (`TREASURY_CLOSE_PERIOD`).
- **Backend completo y probado** contra un cargo real (rechazo por exceso, devolución parcial, devolución exacta del resto) — limpiado sin rastro.
- **Expuesto en 2 pantallas**: Verificación por Curso (badge secundario "🔙 Bs. X devuelto — {motivo}" bajo el cargo, botón "Registrar devolución" junto a "Editar"), Historial (indicador "🔙 Devuelto" junto al pago original).
- **Pendiente:** frontend (backend ya dio luz verde), luego prueba visual + commit.

### Sesión 13-ago-2026 — Refund completo, kardex visible, build roto resuelto

- **"Registrar devolución" (Refund) — completo y confirmado en pantalla con caso real** (kardex 215, Chumacero Mamani Veronica, Bs. 145 devuelto por pago duplicado — recibo 1117386 quedó registrado, 1117182 se devolvió). Verificación por Curso muestra el badge con el motivo completo, estado sigue "Pagado" intacto. Historial muestra el indicador "🔙 Devuelto" junto al comprobante. De paso se corrigió un bug de estilo (`text-info-600` no existe en el sistema de diseño, el badge "🏦 Pendiente verificar" se renderizaba sin color).
- **Kardex visible en la pantalla de cuenta del tutor** (`/dashboard/padres/tesoreria/[parentId]`) — antes solo mostraba CI y teléfono. Agregado solo al lado completo (Junta Escolar), sin tocar la respuesta reducida de `DIRECTOR`/`REGENTE`/`SECRETARY` (mantiene el invariante de Tesorería ya definido). Confirmado en pantalla con caso real.

**🔴 Incidente resuelto: `main` estuvo con el build roto ~2 días.** El commit `71c3c31` (Tesorería, sesión del 11-ago) quedó incompleto — al armar el commit manualmente con `git add <lista>`, se clasificaron mal 5 archivos (`treasury.schema.ts`, `treasury.controller.ts`, `mandatoryCharge.controller/service/repository.ts`) como "no relacionados", cuando en realidad el código sí commiteado los necesitaba. La falla fue de método (nunca se verificó el commit de forma aislada antes de pushear), no del código en sí — `tsc --noEmit` siempre se corrió contra el disco completo, que sí tenía todo. Resuelto en 2 commits separados y pusheados:
  - `2644f42` — hotfix con los 5 archivos faltantes, **verificado de forma aislada** (`git stash` del resto del working tree antes de probar) antes de commitear — la práctica que faltó la primera vez.
  - `e138e8e` — Refund + kardex (el trabajo de esta sesión).
  
  **Lección de proceso para adelante:** antes de commitear manualmente con `git add <lista>` (no `git add .`), verificar `tsc --noEmit` sobre el estado aislado que va a quedar commiteado (vía `git stash` del resto), no solo sobre el disco completo — el disco completo puede compilar bien aunque el commit específico quede incompleto.

### Sesión 22-ago-2026 — Incidente resuelto: 500 en producción por desfase de migraciones

**Síntoma:** `/dashboard/padres/reportes/asistencia` devolvía 500 en producción.

**Causa raíz confirmada por logs reales de Railway** (`P2022`, `PrismaClientKnownRequestError`): la columna `AcademicYear.economicClosedAt` no existía en la DB de producción — el código de la sesión del 11-ago (`71c3c31`, cierre económico) ya estaba desplegado, pero sus 4 migraciones (`20260808170818`…`20260812151409`) nunca se habían aplicado con `prisma migrate deploy` en producción. El mismo error tumbaba de paso un endpoint no relacionado (`getRegisteredStatus`), porque cualquier lectura sin `select` de `AcademicYear` revienta si el schema desplegado tiene una columna que la DB real todavía no tiene (ver ítem 18.1 de deuda técnica).

**Resuelto en producción, sin pérdida de datos:**
1. Instalado cliente de PostgreSQL 18 local (`winget install PostgreSQL.PostgreSQL.17`, coincide con la versión de prod 18.4) — Railway no ofrece backup nativo en el plan actual (solo Pro).
2. Dump fresco vía proxy público (`pg_dump -Fc`), verificado con `pg_restore -l` (561 objetos, sin errores) antes de tocar nada.
3. `prisma migrate deploy` contra producción (proxy público) — las 4 migraciones aplicadas sin error, todas aditivas (`ADD COLUMN`/`CREATE TABLE`, ninguna destructiva).
4. Verificado end-to-end contra la API real de producción (token de diagnóstico de corta duración, firmado con el `JWT_SECRET` real, sin pertenecer a ningún usuario real — `verifyToken` no hace lookup a DB, confía en el payload del JWT): `/api/reports/attendance` y `/api/parents/registered-status` devuelven 200 con datos reales. Se revisó también que Tesorería (`/treasury/academic-years`, `/treasury/summary`) y el módulo Refund no se rompieron — summary en cero es esperado (dato ya documentado: prod quedó en cero tras limpiar cargos de prueba).

**Pendiente de arquitectura anotado, sin tocar todavía** (ver ítem 18.1): agregar `select` explícito en `findActiveAcademicYear`/`getAllWithStatus` para que no dependan de que el schema completo esté siempre sincronizado con la DB real — si no se corrige, cualquier columna nueva futura en `AcademicYear` va a romper estas dos lecturas otra vez hasta correr la migración en producción.

### Sesión 22-ago-2026 (continuación) — Fase 1 regenerada + investigación forense de RUDE (ver ítems 19.2/19.2.1/19.2.2)

- **`phase1-id-mapping.json` (Fase 1 original) irrecuperable** — confirmado con búsqueda exhaustiva (repo, todas las sesiones de scratchpad del proyecto, Documentos/Desktop/Downloads, unidad D:): era un archivo de scratchpad de sesión, efímero, ya limpiado por el sistema. No se inventó ningún dato — se regeneró desde cero, en modo solo lectura, comparando `Student` local (`edulink_dev`) vs. producción (proxy público) por RUDE exacto + similitud de nombre (Levenshtein, no solo igualdad exacta).
- **Resultado de la regeneración: 602 match exacto (igual que el original), pero solo 5 RUDE-typo (no 35) y 39 sin match (no 10).** La diferencia no es un bug del script — es que los datos cambiaron desde el mapeo original. Investigación forense de por qué:
  - **Los 5 RUDE-typo restantes — CERRADO, ver 19.2.** Explicados con rastro completo: `backend/src/scripts/sync-students-2026.js` (guardado 8-ago 23:52 UTC, corrido ~6 min después) trae un diccionario `RUDE_CORRECTIONS` hardcodeado con exactamente estos 5 pares, comentado como "verificado a mano contra la matrícula oficial... confirmado con el usuario antes de aplicar" — el plan de esa sesión (`C:\Users\Raul\.claude\plans\piped-weaving-wadler.md`, Paso 0) confirma el contexto. Fuente de la corrección: `ministerio-2026.json`, la matrícula oficial 2026 del Ministerio (SIE código `41980023`), no una comparación contra producción. El 22-ago se verificaron los 5 contra documento físico — local gana en los 5 (detalle en 19.2).
  - **Los 39 "sin match" son dos cosas distintas, no una sola categoría** — 8 son altas nuevas genuinas (`createdAt`≈`updatedAt`, 9-ago-2026, consistente con "altas reales" ya documentado). Los otros 31 tienen `createdAt` de mayo-2026 (estudiantes reales pre-existentes) pero `rude: null` con `updatedAt` del **21-jun-2026, 19:28–20:06 UTC** — un evento completamente distinto, sin relación con el 8-ago. **Investigación no concluyente pero con candidatos descartados**: no fue el commit `b3b110c` de esa misma tarde (`cancelEnrollment` solo borra `StudentAcademicAssignment`, nunca toca `rude` — coincidencia de horario, no causa), no fue `delete-duplicate-students.ts` (nunca vacía el RUDE del registro que conserva al deduplicar). Candidato sin confirmar: `migrarEstudiantes.ts` corrido con un `SOURCE_DATABASE_URL` desactualizado (hace upsert de objeto completo, sobrescribiría `rude` con lo que tuviera esa fuente) — sin log que lo confirme. Ninguno de una muestra de 6 de los 31 nombres aparece en `ministerio-2026.json` — a diferencia de los 5 de 19.2, no hay de dónde recuperar el RUDE correcto con la misma confianza. Queda anotado en 19.2.2 como pendiente de decisión de Raul, explícitamente separado de 19.2 para no mezclar los dos hallazgos.
- **Regla de proceso confirmada en el camino**: ante una discrepancia entre lo que dice memoria/documentación y lo que muestran los datos en vivo, investigar la causa raíz con evidencia (timestamps, git log, contenido real de scripts) antes de presentar cualquier lista como definitiva — no reportar "35 casos" cuando la realidad son 5, ni asumir sin evidencia a qué proceso corresponde una modificación en la base.

### Sesión 22-ago-2026 (noche) — Clon local + primer lote real de migración a producción + 🔴 incidente de secuencias

**Clon local levantado y usado como red de seguridad real, tal como se planeó**: Postgres 18 aislado (puerto 5544, `edulink_clon`), dump del mismo día + las 4 migraciones de la mañana aplicadas. Ahí se validó de punta a punta, con dry-run primero y aplicación después, todo el alcance de este lote: Grupos 1-4 de estudiantes (ver 19.2/19.2.2) + 6 de los 11 padres verificados por Raul contra planilla física (ver 19.3) — incluyendo un hallazgo real en el camino (3, luego 4, estudiantes que quedaban sin ningún tutor legal en producción porque la madre nunca había sido vinculada ahí, aunque sí lo estaba en local — corregido replicando el vínculo de local).

**Antes de tocar producción real, mismo protocolo que a la mañana**: dump fresco (`railway_export_20260822_214117.dump`, verificado con `pg_restore -l`), chequeo de que nadie tocó producción manualmente desde el dump anterior (cero filas modificadas), y un dry-run final contra producción real que coincidió **exacto, sin ninguna diferencia**, con lo ya validado en el clon.

**🔴 Incidente encontrado durante el `--apply` real — CERRADO.** Al intentar crear el primer `ParentStudent` en producción: `P2002 — Unique constraint failed on (id)`. Investigado de inmediato: **las secuencias de autoincremento de Postgres estaban desincronizadas en 17 tablas de producción** (`ParentStudent` en `2` con `MAX(id)=2507`; `Parent` en `1` con `MAX(id)=1192`; `Student` en `1` con `MAX(id)=960`; y 14 tablas más — lista completa verificada antes del fix). **No fue causado por esta sesión ni por la migración** — es un bug preexistente, probablemente heredado de cargas masivas anteriores del proyecto que insertaron filas con `id` explícito (necesario para que los IDs coincidan entre local y producción, patrón que esta misma migración depende de que exista) sin nunca avanzar la secuencia de Postgres, que solo avanza con `nextval()`. El clon había heredado exactamente el mismo problema al restaurar el dump de producción — lo que en el clon parecía "un artefacto del `pg_restore`" (ver 19.4) en realidad ya estaba roto en el origen.

**Gravedad real, no solo un bloqueo de nuestra migración**: con `Student` en secuencia `1` y 960 filas reales, cualquier intento real de `POST /api/students` (o cualquier otra de las 17 tablas) en producción — de cualquiera de las 83 UE del distrito, no solo U.E. Naciones Unidas — probablemente ya estaba fallando con el mismo `P2002` antes de este fix, sin relación con nuestra migración.

**Resuelto**: mismo `setval()` genérico contra el `MAX(id)` real de cada tabla, ya probado antes en el clon — no toca ningún dato, solo corrige el contador interno de Postgres. Verificado en las 17 (`last_value = MAX(id)`, `is_called = true` en las 17). **Confirmado con una prueba real de extremo a extremo**: `POST /api/students` contra la API real de producción (token de diagnóstico de corta duración, no ligado a ningún usuario real, rol `DIRECTOR`) creó un estudiante desechable con `id: 961` — exactamente `MAX(id)+1`, confirmando que el problema real (no solo el de la migración) quedó resuelto. Limpiado sin rastro (`Student` + `User` que se autogenera con el registro) inmediatamente después.

**Con las secuencias corregidas, se reintentaron y completaron los 9 `ParentStudent`** (5 padre + 4 madre) — verificados desde cero, invariante "un solo `isTutor: true`" confirmado en los 6 estudiantes. Los 6 `isActive` y 5 `rude` de Grupo 1/2 (que no dependían de secuencias, son `UPDATE`) ya se habían aplicado correctamente antes del incidente. `prisma migrate status` confirmado sano al final. Detalle completo del alcance aplicado en 19.7.

**Pendiente para investigar más adelante, no bloqueante**: confirmar con certeza qué script(s) históricos causaron el desfase de secuencias (candidato más probable: los imports de mayo-2026 que preservaron IDs explícitos), y considerar agregar un paso de `setval()` de rutina después de cualquier import futuro con IDs explícitos, para que esto no vuelva a pasar en silencio.

### Sesión 22-ago-2026 (continuación) — Auditoría de rendimiento para escala municipal + auditoría de licencias

**Rendimiento**: auditoría completa a pedido de Raul, de cara a escalar de 1 UE a un municipio completo (~16,000 estudiantes, ~33,500 padres/tutores, ~1,500 maestros/administrativos). Hallazgos concretos con archivo:línea y números reales — cero índices explícitos en todo `schema.prisma` (solo `@@unique`, que no cubre filtros por un solo campo), 125 `findMany()` en `repositories/` sin paginación (25 de 32 archivos sin ninguna), `connection_limit` ausente del `DATABASE_URL` de producción real, y N+1 reales confirmados en Tesorería/Convocatoria/Cierre económico. Cálculo de capacidad con los números reales de producción (`max_connections=100`, sin pooler, sin límite de pool) — el sistema empieza a agotar conexiones entre 10-15 instancias del backend corriendo a la vez, mucho antes de lo necesario para 33,500 usuarios reales.

**Plan de corrección aprobado y ejecutado en 4 pasos, cada uno probado contra el clon antes del siguiente, con confirmación explícita entre pasos** (ver ítems 22-26 del Roadmap para el detalle técnico completo de cada uno): índices (18, migración aditiva, `EXPLAIN ANALYZE` confirma que Postgres ya los usa) → `connection_limit=10` (comportamiento de cola probado con 20 queries concurrentes contra un pool de 10, cero errores) → paginación opt-in en 7 endpoints (diseño "lista pero no activa" a propósito, para no romper al frontend actual que hoy muestra todo sin límite — 3 endpoints quedaron excluidos a propósito por romper agregación/operaciones de fondo si se paginaran) → N+1 de `createBulkCharges` (de 3N queries a 2-4 totales, probado con datos reales incluido el camino de `DELEGATE`). **Nada de esto se aplicó a producción real todavía** — los índices y el `connection_limit` quedan pendientes de un solo despliegue conjunto (la migración de índices + el env var + el código de paginación/N+1), para no reiniciar el servicio más de una vez.

**Hallazgo colateral corregido en el camino**: el listado general de padres (`parent.repository.ts` `findMany`, usado por `listParents`) filtraba `isActive` con `.filter()` de JavaScript después de traer todo — hubiera dado páginas con conteos inconsistentes al activar la paginación. Movido a la cláusula `where`, verificado contra una consulta SQL directa (no solo contra sí mismo).

**Licencias**: auditoría completa con `license-checker` sobre los 155 (backend) + 519 (frontend) paquetes, incluyendo transitivos. **Sin GPL/AGPL en ningún lado.** 4 paquetes con copyleft débil (LGPL/MPL), todos transitivos y de bajo riesgo real (`sharp` vía `next`, `lightningcss` vía Tailwind, `axe-core` solo dev, `dompurify` con licencia dual Apache-2.0 disponible). El hallazgo real no fue de dependencias — **el propio código de EduLink no tiene ningún archivo `LICENSE`**, algo a resolver (decisión de negocio, no técnica) antes de licenciar el sistema a otros municipios. Ambos temas (LICENSE propio + postura sobre el copyleft débil transitivo) quedan anotados como pendientes en el ítem 27 del Roadmap.

---

## 🔖 CIERRE DE SESIÓN 25-ago-2026 — estado exacto para retomar

**MIGRACIÓN LOCAL→PRODUCCIÓN: ✅ 100% COMPLETA, cerrada en base de datos Y verificada visualmente en pantalla.** Los 4 componentes del plan original:
- **Estudiantes** (Grupos 1-5, 19.7, más los 8 duplicados resueltos el 23-ago, 19.3.2) — cerrado.
- **Padres/tutores** (los 45/47 originales, 19.3) — cerrado, 17 + 3 aplicados a producción real el 23-ago.
- **Índices/rendimiento** (connection_limit, paginación opt-in, fix N+1) — desplegado, commit `85b0b3c`.
- **Tesorería completa** (`Charge`/`Payment`/`Refund`/`ParentKardexHistory`/`MandatoryCharge`, 19.8) — cerrado el 24-ago en 5 sub-lotes, todos los totales financieros coinciden exacto contra local.
- **Validación visual en producción real** (ítem 20, 24/25-ago) — 10 puntos confirmados por Raul, 2 hallazgos reales encontrados y corregidos en el camino (badge de devolución faltante en cuenta del tutor, commit `349e09e`; link de menú a Verificación por Curso/Deuda Trasladada nunca pusheado, commit `3a0177c`) — ambos desplegados y reverificados.

**No queda ningún dato real de local sin su contraparte en producción, y lo migrado ya se confirmó visualmente, no solo por API/DB.**

**Pendientes de fondo, sin urgencia, ya anotados en el Roadmap** (ninguno bloquea nada, se retoman cuando haga falta): **21** (checklist `docs/reporte-pre-produccion-tesoreria-2025.md`), **26** (evaluar PgBouncer cuando haga falta más de ~8 instancias), **27** (LICENSE propio + postura sobre copyleft débil, decisión de negocio), **28** (diagnóstico de conteos local vs producción para el resto de módulos — Académico/Asistencia/Portería/Comunicación/Gobernanza/Docentes — siguiente paso lógico, no ejecutado todavía), **17.1** (auditoría/trazabilidad de acciones destructivas), **17.2** (2 `Charge` PAGADO sin `Payment`, Bs. 200, deuda de datos preexistente), **18** (dominio de negocio de Tesorería Núcleo/Distrito), **19.2.2** (root cause del evento 21-jun que vació 31 `rude`, sin confirmar), **4 excluidos de Fase 4 por tutor placeholder** (`Student.id` 567, 572, 601, 623, ver 19.2.3), **4 casos de Fase 4 sin crear todavía** (Winder no aplica — ver 19.3 — pero Jorge/Karina/Lina de padres ya se crearon el 23-ago; los estudiantes genuinamente nuevos — los 8 de Fase 1 — resultaron ser duplicados, no altas, ver 19.3.2, así que no queda ninguna alta pendiente de Fase 4 real).

**También sigue pendiente, sin relación con la migración** (trabajo de otra sesión, nunca tocado en esta): el resto de archivos modificados/sin commitear en el working tree (`backend/src/routes/report.routes.ts`, `frontend/src/app/dashboard/padres/{estudiantes,layout,tesoreria/obligatorios}`, eliminación de `personas/tutores/page.tsx`, scripts sueltos en `backend/src/scripts/`, `docs/`, `frontend/.../tesoreria/cierre/`) — se dejaron intactos a propósito en cada commit aislado de esta sesión, no forman parte de este trabajo.
