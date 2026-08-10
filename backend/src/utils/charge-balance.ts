// Fuente única de verdad para "cuánto falta pagar de un cargo" — antes se
// repetía `amount - paidAmount` (o su versión agregada) en 11 lugares
// distintos entre treasury.service.ts y report.service.ts. amount/paidAmount
// son Float en Prisma (mapean directo a number de JS), no hay Decimal de por
// medio, así que la aritmética simple alcanza.

export interface ChargeAmounts {
  amount: number
  paidAmount: number
}

export function chargeBalance(charge: ChargeAmounts): number {
  return charge.amount - charge.paidAmount
}

export function aggregateChargeBalances(charges: ChargeAmounts[]) {
  const totalDebt    = charges.reduce((sum, c) => sum + c.amount, 0)
  const totalPaid    = charges.reduce((sum, c) => sum + c.paidAmount, 0)
  const totalPending = totalDebt - totalPaid
  return { totalDebt, totalPaid, totalPending }
}
