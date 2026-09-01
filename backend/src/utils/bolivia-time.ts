// El contenedor de producción no tiene TZ configurada (Node corre en UTC,
// confirmado 29-ago-2026 al depurar el reloj de portería) — cualquier
// comparación contra horas de reloj (startTime/exitTime/ventanas horarias)
// debe convertir a hora de Bolivia explícitamente (UTC-4 fijo, el país no
// usa horario de verano) en vez de usar getHours()/getMinutes() del
// proceso, que reflejan la hora del servidor, no la del colegio.
const BOLIVIA_UTC_OFFSET_MIN = -4 * 60

export function nowMinutesBolivia(now: Date): number {
  const utcMin = now.getUTCHours() * 60 + now.getUTCMinutes()
  return ((utcMin + BOLIVIA_UTC_OFFSET_MIN) % 1440 + 1440) % 1440
}

export function parseTimeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

// Día de la semana en hora de Bolivia (1=lunes..7=domingo, mismo criterio
// que Schedule.dayOfWeek) — necesario cerca de la medianoche: el proceso en
// UTC puede pensar que ya es "mañana" cuando en Bolivia todavía es hoy (o
// viceversa) si se usa Date.getDay() directo. Se desplaza el timestamp por
// el offset y se lee en UTC — los componentes UTC del timestamp desplazado
// son exactamente la hora de pared de Bolivia.
export function todayDayOfWeekBolivia(now: Date): number {
  const bolivia = new Date(now.getTime() + BOLIVIA_UTC_OFFSET_MIN * 60 * 1000)
  const dow = bolivia.getUTCDay() // 0=domingo..6=sábado, ya en día de Bolivia
  return dow === 0 ? 7 : dow
}

// Rango [inicio, fin) del día calendario de HOY en Bolivia, expresado en
// instantes UTC reales — para comparar contra columnas DateTime tipo
// Holiday.date sin el mismo desfase de medianoche que ya afectó otras partes
// del sistema. Medianoche Bolivia (00:00) = 04:00 UTC ese mismo día
// calendario de Bolivia.
export function todayDateRangeBolivia(now: Date): { start: Date; next: Date } {
  const bolivia = new Date(now.getTime() + BOLIVIA_UTC_OFFSET_MIN * 60 * 1000)
  const y = bolivia.getUTCFullYear(), m = bolivia.getUTCMonth(), d = bolivia.getUTCDate()
  const start = new Date(Date.UTC(y, m, d, -BOLIVIA_UTC_OFFSET_MIN / 60, 0, 0, 0))
  const next = new Date(start.getTime() + 24 * 60 * 60 * 1000)
  return { start, next }
}
