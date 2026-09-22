// Normaliza un título de cargo para comparar "es el mismo concepto" entre 2
// flujos que lo escriben a mano por separado (Nuevo Cargo vs Cargos
// Obligatorios) -- sin esto, "Aporte BTH2026" y "Aporte BTH 2026" (mismo
// concepto, solo un espacio de diferencia) no matchean con una comparación
// exacta. Suficientemente estricto para no confundir 2 conceptos
// legítimamente distintos con el mismo type (ej. "Cuota Inicial de
// Inscripción" vs "Aporte BTH 2026", ambos CUOTA_INICIAL en la práctica).
export function normalizeChargeTitle(title: string): string {
  return title.replace(/\s+/g, '').toLowerCase()
}
