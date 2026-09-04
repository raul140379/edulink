// Algoritmo de agrupación en bloques (diseño aprobado 4-sep-2026, construido
// 5-sep). Dado el conjunto de períodos de UN maestro para UN curso en UN
// día de la semana (ya viene filtrado así desde el repositorio), agrupa los
// períodos NUMÉRICAMENTE consecutivos Y de la MISMA materia en un solo
// bloque — "seguidos" es por número de período, no por reloj real: un
// recreo entre el período 2 (termina 09:25) y el 3 (empieza 09:35) no rompe
// el bloque, siguen siendo períodos consecutivos. Un corte en la
// numeración (porque en el medio el maestro tiene OTRO curso, por ejemplo)
// sí parte el bloque — así sale el caso de "1°,2° y luego 5°,6°" como dos
// bloques, sin lógica especial: el período 3-4 de otro curso simplemente no
// aparece en la lista de entrada.
//
// subjectId como segundo criterio de corte (5-sep-2026): un maestro puede
// dar 2 materias distintas al mismo curso (4 casos reales confirmados en
// producción) — investigado con datos reales antes de asumir: hoy el
// generador de horarios NUNCA pone las 2 materias de un mismo maestro+curso
// el mismo día, así que en la práctica esto nunca se dispara. Pero no está
// garantizado por el modelo (nada impide un horario editado a mano que sí
// lo haga), así que se corta por las dudas — más seguro estructuralmente,
// sin costo real hoy.
//
// Un bloque de un solo período sale del mismo bucle, sin caso aparte.

export interface SchedulePeriodInput {
  period: number
  startTime: string
  endTime: string
  subjectId: number
}

export interface AttendanceBlockRange {
  periodStart: number
  periodEnd: number
  startTime: string
  endTime: string
  // number para cualquier bloque real (siempre viene de un período real con
  // materia asignada) — null solo lo usa el bloque sentinela "sin período"
  // del camino DIRECTOR/SECRETARY (ver NO_PERIOD_BLOCK en el servicio).
  subjectId: number | null
}

export function groupIntoBlocks(periods: SchedulePeriodInput[]): AttendanceBlockRange[] {
  const sorted = [...periods].sort((a, b) => a.period - b.period)
  const blocks: AttendanceBlockRange[] = []

  for (const p of sorted) {
    const last = blocks[blocks.length - 1]
    if (last && p.period === last.periodEnd + 1 && p.subjectId === last.subjectId) {
      last.periodEnd = p.period
      last.endTime = p.endTime
    } else {
      blocks.push({ periodStart: p.period, periodEnd: p.period, startTime: p.startTime, endTime: p.endTime, subjectId: p.subjectId })
    }
  }

  return blocks
}
