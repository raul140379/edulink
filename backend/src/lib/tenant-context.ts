import { AsyncLocalStorage } from 'node:async_hooks'
import { Role } from '../config/permissions'

export interface TenantContext {
  userId:     number
  role:       Role
  schoolId:   number | null
  districtId: number | null
  nucleoId:   number | null
}

const storage = new AsyncLocalStorage<TenantContext>()

export function runWithTenantContext<T>(ctx: TenantContext, fn: () => T): T {
  return storage.run(ctx, fn)
}

export function getTenantContext(): TenantContext | undefined {
  return storage.getStore()
}
