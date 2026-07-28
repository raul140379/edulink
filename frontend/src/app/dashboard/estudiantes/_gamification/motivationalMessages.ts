// Textos del banner motivacional de "Inicio" — separados del componente para
// poder editarlos sin tocar la lógica de la pantalla. Tono urbano/juvenil
// boliviano, corto y natural; nunca condescendiente, punitivo ni comparativo
// con otros estudiantes.

export interface MotivoMessage { emoji: string; text: string }

export type PerformanceCategoria = 'alto' | 'medio' | 'bajo' | 'sinNotas'

export const PERFORMANCE_MESSAGES: Record<PerformanceCategoria, MotivoMessage[]> = {
  sinNotas: [
    { emoji: '🚀', text: 'Arrancá esta gestión con toda la energía' },
    { emoji: '✨', text: 'Recién empezando — este trimestre lo hacés tuyo' },
    { emoji: '💪', text: 'Todavía no hay notas cargadas, aprovechá para arrancar fuerte' },
  ],
  alto: [
    { emoji: '🔥', text: 'Sos un crack, vas con todo este trimestre' },
    { emoji: '💪', text: 'La estás rompiendo, ni un bajón' },
    { emoji: '🚀', text: 'Nivel máximo, seguí así de firme' },
    { emoji: '✨', text: 'Todo en orden, causa — dale que vas al mango' },
    { emoji: '🏆', text: 'Con ese ritmo cerrás el trimestre a todo dar' },
  ],
  medio: [
    { emoji: '💪', text: 'Vas bien, causa, no aflojes' },
    { emoji: '✨', text: "Ta' cerca el próximo nivel, un empujón más" },
    { emoji: '📈', text: 'De a poco se sube, seguí firme' },
    { emoji: '👊', text: 'Vas encaminado, no bajes el ritmo' },
  ],
  bajo: [
    { emoji: '☁️', text: 'Todos tenemos días grises — esto se puede dar vuelta' },
    { emoji: '🌱', text: 'Todavía hay tiempo de agarrar vuelo, vamos con calma' },
    { emoji: '🤝', text: 'Un paso a la vez, así se remonta' },
  ],
}

export interface SeasonalContext {
  academicYearStart?: Date | null
  trimesterEnd?:      Date | null
}

interface SeasonalDef {
  code:    string
  matches: (today: Date, ctx: SeasonalContext) => boolean
  texts:   MotivoMessage[]
}

const DAY_MS = 24 * 60 * 60 * 1000

function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / DAY_MS)
}

// Fecha fija de calendario, comparando solo mes/día del año actual.
function fixedDate(today: Date, month: number, day: number): Date {
  return new Date(today.getFullYear(), month - 1, day)
}

// Prioridad: primero los hitos con datos reales del sistema (gestión/
// trimestre), después las fechas fijas de calendario — como pide el plan.
export const SEASONAL_MESSAGES: SeasonalDef[] = [
  {
    code: 'INICIO_GESTION',
    matches: (today, ctx) => {
      if (!ctx.academicYearStart) return false
      const d = daysBetween(ctx.academicYearStart, today)
      return d >= 0 && d <= 10
    },
    texts: [
      { emoji: '🚀', text: 'Arrancamos gestión nueva — toda la energía desde el día uno' },
      { emoji: '✨', text: 'Empezamos con todo, este trimestre es tuyo' },
    ],
  },
  {
    code: 'FIN_TRIMESTRE',
    matches: (today, ctx) => {
      if (!ctx.trimesterEnd) return false
      const d = daysBetween(today, ctx.trimesterEnd)
      return d >= 0 && d <= 7
    },
    texts: [
      { emoji: '🔥', text: 'Se cierra el trimestre — dale con todo esta última semana' },
      { emoji: '💪', text: 'Recta final del trimestre, no aflojes ahora' },
    ],
  },
  {
    code: 'FIESTAS_PATRIAS',
    matches: (today) => Math.abs(daysBetween(today, fixedDate(today, 8, 6))) <= 5,
    texts: [
      { emoji: '🇧🇴', text: 'Faltan pocos días para Fiestas Patrias — cerrá fuerte antes del feriado' },
      { emoji: '🎉', text: 'Se viene el 6 de agosto, un empujón más y llegás al día cívico con todo' },
    ],
  },
  {
    code: 'VACACION_INVIERNO',
    matches: (today) => {
      const d = daysBetween(today, fixedDate(today, 6, 23))
      return d >= 0 && d <= 5
    },
    texts: [
      { emoji: '❄️', text: 'Ya casi llegan las vacaciones de invierno — aguantá esta última semana' },
    ],
  },
  {
    code: 'DIA_ESTUDIANTE',
    matches: (today) => Math.abs(daysBetween(today, fixedDate(today, 9, 21))) <= 3,
    texts: [
      { emoji: '🌸', text: 'Feliz Día del Estudiante — seguí disfrutando de aprender' },
    ],
  },
]

export function pickMotivo(categoria: PerformanceCategoria, ctx: SeasonalContext = {}): MotivoMessage {
  const today = new Date()
  for (const def of SEASONAL_MESSAGES) {
    if (def.matches(today, ctx)) return def.texts[Math.floor(Math.random() * def.texts.length)]
  }
  const set = PERFORMANCE_MESSAGES[categoria]
  return set[Math.floor(Math.random() * set.length)]
}
