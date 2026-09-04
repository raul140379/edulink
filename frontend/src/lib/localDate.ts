// Fecha calendario de HOY en hora LOCAL del navegador — new Date().toISOString()
// da la fecha en UTC, que se corre un día entre las 20:00 y 23:59 hora
// Bolivia (ya es "mañana" en UTC). getFullYear/getMonth/getDate leen los
// componentes en la zona horaria real del dispositivo del usuario, sin
// necesidad de ningún cálculo de offset. Mismo criterio que dayRange()/
// todayDateStrBolivia() del lado backend, para el mismo bug del lado servidor.
export function todayLocalStr(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}
