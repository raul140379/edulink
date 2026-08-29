// Paginación opt-in: si el caller no manda page/pageSize, undefined —
// el repositorio no agrega take/skip y el comportamiento queda idéntico al
// que ya existía (compatibilidad total con los consumidores actuales, que
// todavía no piden páginas). Ver CLAUDE.md, corrección de rendimiento.
export interface Pagination {
  page: number
  pageSize: number
}

export function parsePagination(page?: string, pageSize?: string): Pagination | undefined {
  if (page === undefined && pageSize === undefined) return undefined
  const p  = Math.max(1, parseInt(page ?? '1', 10) || 1)
  const ps = Math.min(200, Math.max(1, parseInt(pageSize ?? '30', 10) || 30))
  return { page: p, pageSize: ps }
}

export function paginationArgs(pagination?: Pagination) {
  return pagination ? { take: pagination.pageSize, skip: (pagination.page - 1) * pagination.pageSize } : {}
}

export interface PaginatedResult<T> {
  data: T[]
  total: number
  page: number
  pageSize: number
}

// Mismo criterio opt-in que el resto: sin pagination, la respuesta queda
// idéntica a como era antes (array plano) — con pagination, se envuelve con
// el total real (misma condición `where` que la lista) para que el frontend
// pueda calcular cuántas páginas hay. `countFn` se evalúa solo si hace falta.
export async function withTotal<T>(
  data: T[],
  pagination: Pagination | undefined,
  countFn: () => Promise<number>,
): Promise<T[] | PaginatedResult<T>> {
  if (!pagination) return data
  const total = await countFn()
  return { data, total, page: pagination.page, pageSize: pagination.pageSize }
}
