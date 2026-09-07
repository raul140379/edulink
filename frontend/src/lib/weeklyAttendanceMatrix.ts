// Transforma la respuesta de GET /api/reports/attendance-weekly/:courseId
// (días → bloques → estudiantes) en una matriz estudiante×período — una
// sola función pura, reusada tanto por la pantalla como por el PDF, para
// que ambos siempre muestren exactamente lo mismo.
//
// 4 estados posibles por celda (no 3): además de PRESENTE/AUSENTE/RETRASO/
// LICENCIA, una celda puede no tener NINGÚN período programado ese día para
// este curso ('SIN_HORARIO', gris/vacía) — distinto de "tenía clase pero
// nadie tomó asistencia todavía" (status: null sobre un bloque real,
// 'SIN_REGISTRAR'). Mezclar ambos como "vacío" confundiría "no hay clase
// acá" con "faltó tomar asistencia acá".

export type CellStatus = 'PRESENTE' | 'AUSENTE' | 'RETRASO' | 'LICENCIA' | 'SIN_REGISTRAR' | 'SIN_HORARIO'

// Abreviación por materia (no truncado mecánico) — catálogo real de 18
// materias (Subject.name, confirmado contra la DB), a propósito con un
// diccionario en vez de cortar los primeros N caracteres: varias materias
// comparten la primera palabra ("Educación Física..." / "Educación
// Musical", "Lengua Extranjera" / "Lenguas Castellana...") y un corte
// mecánico las deja indistinguibles en la columna angosta (bug real
// encontrado en el primer PDF de prueba, 5-sep-2026). Cualquier materia
// nueva que no esté en esta lista cae al truncado genérico (abbreviateSubject).
const SUBJECT_ABBREV: Record<string, string> = {
  'Artes Plásticas y Visuales': 'Artes Plást.',
  'Biología': 'Biología',
  'Ciencias Sociales': 'C. Sociales',
  'Cosmovisiones y Filosofía': 'Cosmovisiones',
  'Educación Cívica': 'Educ. Cívica',
  'Educación Física y Deportes': 'Educ. Física',
  'Educación Musical': 'Educ. Musical',
  'Física': 'Física',
  'Geografía': 'Geografía',
  'Historia': 'Historia',
  'Lengua Extranjera': 'Leng.Extranj.',
  'Lenguas Castellana y Originaria': 'Leng.Castell.',
  'Matemática': 'Matemática',
  'Psicología': 'Psicología',
  'Química': 'Química',
  'Técnica Tecnológica General': 'Téc.Tecnológ.',
  'Técnica Tecnológica General y Especializada': 'Téc.Tecnol.Esp.',
  'Valores, Espiritualidad y Religiones': 'Valores Relig.',
}

export function abbreviateSubject(name: string | null): string {
  if (!name) return ''
  const known = SUBJECT_ABBREV[name]
  if (known) return known
  // Fallback genérico para una materia nueva no catalogada arriba —
  // truncado simple, no garantiza que no colisione con otra, pero es mejor
  // que romper la palabra a la mitad.
  return name.length > 12 ? `${name.slice(0, 11).trimEnd()}…` : name
}

export interface WeeklyMatrixBlock {
  periodStart: number
  periodEnd: number
  startTime: string
  endTime: string
  teacherId: number
  teacherName: string
  subjectId: number | null
  subjectName: string | null
  registrado: boolean
  students: { studentId: number; firstName: string; lastName: string; status: string | null; onLicense: boolean }[]
}

export interface WeeklyMatrixDay {
  dayOfWeek: number
  date: string
  blocks: WeeklyMatrixBlock[]
}

export interface WeeklyMatrixResponse {
  course: { id: number; grade: string; parallel: string; level: string; shift: string }
  weekStart: string
  weekEnd: string
  maxPeriods: number
  days: WeeklyMatrixDay[]
}

// Una columna = un bloque real (puede cubrir varios períodos, colspan) o un
// hueco sin ningún período programado ese día (columna de 1 período, gris).
export interface MatrixColumn {
  dayOfWeek: number
  date: string
  periodStart: number
  periodEnd: number
  span: number
  subjectName: string | null
  teacherName: string | null
  hasSchedule: boolean
}

export interface MatrixRow {
  studentId: number
  firstName: string
  lastName: string
  cells: { status: CellStatus; onLicense: boolean }[] // mismo orden que columns
}

export interface PivotedMatrix {
  columns: MatrixColumn[]
  rows: MatrixRow[]
}

const DAY_NAMES: Record<number, string> = { 1: 'Lunes', 2: 'Martes', 3: 'Miércoles', 4: 'Jueves', 5: 'Viernes', 6: 'Sábado' }
export { DAY_NAMES }

export function pivotWeeklyMatrix(data: WeeklyMatrixResponse): PivotedMatrix {
  // Paso 1: el roster completo (mismo en TODOS los bloques, por construcción
  // del backend) — se toma de cualquier bloque real que exista esta semana.
  const rosterMeta = new Map<number, { firstName: string; lastName: string }>()
  for (const day of data.days) {
    for (const block of day.blocks) {
      for (const s of block.students) {
        if (!rosterMeta.has(s.studentId)) rosterMeta.set(s.studentId, { firstName: s.firstName, lastName: s.lastName })
      }
    }
  }

  // Paso 2: columnas + celdas en lockstep — con el roster ya conocido, cada
  // columna (bloque real o hueco sin horario) aporta exactamente una celda
  // por estudiante, sin necesidad de rellenar hacia atrás después.
  const columns: MatrixColumn[] = []
  const cellsByStudent = new Map<number, { status: CellStatus; onLicense: boolean }[]>()
  for (const studentId of rosterMeta.keys()) cellsByStudent.set(studentId, [])

  for (const day of data.days) {
    const blocksByStart = new Map(day.blocks.map((b) => [b.periodStart, b]))
    let p = 1
    while (p <= data.maxPeriods) {
      const block = blocksByStart.get(p)
      if (block) {
        columns.push({
          dayOfWeek: day.dayOfWeek, date: day.date,
          periodStart: block.periodStart, periodEnd: block.periodEnd, span: block.periodEnd - block.periodStart + 1,
          subjectName: block.subjectName, teacherName: block.teacherName, hasSchedule: true,
        })
        const byStudentId = new Map(block.students.map((s) => [s.studentId, s]))
        for (const studentId of rosterMeta.keys()) {
          const s = byStudentId.get(studentId)
          const status: CellStatus = !s ? 'SIN_REGISTRAR' : s.status ? (s.status as CellStatus) : 'SIN_REGISTRAR'
          cellsByStudent.get(studentId)!.push({ status, onLicense: s?.onLicense ?? false })
        }
        p = block.periodEnd + 1
      } else {
        columns.push({ dayOfWeek: day.dayOfWeek, date: day.date, periodStart: p, periodEnd: p, span: 1, subjectName: null, teacherName: null, hasSchedule: false })
        for (const studentId of rosterMeta.keys()) {
          cellsByStudent.get(studentId)!.push({ status: 'SIN_HORARIO', onLicense: false })
        }
        p += 1
      }
    }
  }

  const rows: MatrixRow[] = [...rosterMeta.entries()]
    .sort((a, b) => a[1].lastName.localeCompare(b[1].lastName, 'es'))
    .map(([studentId, meta]) => ({
      studentId, firstName: meta.firstName, lastName: meta.lastName,
      cells: cellsByStudent.get(studentId)!,
    }))

  return { columns, rows }
}
