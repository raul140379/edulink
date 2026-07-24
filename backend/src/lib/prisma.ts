import { PrismaClient } from '@prisma/client'
import { getTenantContext } from './tenant-context'
import { DIRECT_SCHOOL_SCOPED_MODELS, DUAL_SCOPED_MODELS } from './scoped-models'
import { Role } from '../config/permissions'
import { HttpError } from '../utils/http-error'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

const rawPrisma = globalForPrisma.prisma ?? new PrismaClient({
  log: ['error'],
})

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = rawPrisma

const READ_OPS = new Set([
  'findMany', 'findFirst', 'findFirstOrThrow', 'findUnique', 'findUniqueOrThrow',
  'count', 'aggregate', 'groupBy', 'update', 'updateMany', 'delete', 'deleteMany',
])

// findUnique/update/delete (singular ops) take a `WhereUniqueInput`, which
// requires the unique identifier (id/email/...) to sit directly at the top
// level — wrapping the whole thing in `AND` (fine for findMany/findFirst/
// updateMany/deleteMany, which take the general `WhereInput`) makes Prisma
// reject it ("needs at least one of id or email"). For these we merge the
// filter as sibling keys instead, which Prisma still ANDs with the unique lookup.
const UNIQUE_OPS = new Set(['findUnique', 'findUniqueOrThrow', 'update', 'delete'])

function mergeWhere(where: any, filter: Record<string, unknown>, operation: string) {
  if (UNIQUE_OPS.has(operation)) return { ...where, ...filter }
  if (!where || Object.keys(where).length === 0) return filter
  return { AND: [where, filter] }
}

/** Builds the read-side scoping filter for the acting context, or `null` if nothing to add. */
function buildReadFilter(ctx: NonNullable<ReturnType<typeof getTenantContext>>, isDirect: boolean, isDual: boolean) {
  if (ctx.role === Role.DIRECTOR_DISTRITAL) {
    if (ctx.districtId == null) return null
    return isDirect
      ? { school: { districtId: ctx.districtId } }
      : { OR: [{ districtId: ctx.districtId }, { school: { districtId: ctx.districtId } }] }
  }
  if (isDirect && ctx.schoolId != null) return { schoolId: ctx.schoolId }
  if (isDual) {
    if (ctx.schoolId != null) return { schoolId: ctx.schoolId }
    if (ctx.districtId != null) return { districtId: ctx.districtId }
  }
  return null
}

const prisma = rawPrisma.$extends({
  name: 'tenant-scoping',
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        const ctx = getTenantContext()
        if (!ctx) return query(args) // no request context (login, scripts, etc.) -> unscoped

        const isDirect = DIRECT_SCHOOL_SCOPED_MODELS.has(model)
        const isDual   = DUAL_SCOPED_MODELS.has(model)
        if (!isDirect && !isDual) return query(args)

        // ---- SUPER_ADMIN: full bypass, no injection at all ----
        if (ctx.role === Role.SUPER_ADMIN) return query(args)

        // `a` is an untyped view onto the same object as `args` — mutate through
        // `a`, but always call `query(args)` (not `query(a)`) so TypeScript keeps
        // inferring the operation's real return type (include/select shape) from
        // the original typed `args` instead of collapsing it to `any`.
        const a: any = args

        // ---- Reads / in-place mutations: inject a where filter ----
        if (READ_OPS.has(operation)) {
          const filter = buildReadFilter(ctx, isDirect, isDual)
          if (filter) a.where = mergeWhere(a.where, filter, operation)
          return query(args)
        }

        // ---- Creates: force/validate the tenant columns on the row being written ----
        if (operation === 'create' || operation === 'upsert') {
          if (operation === 'upsert') {
            // upsert's `where` is a WhereUniqueInput just like update/findUnique.
            const filter = buildReadFilter(ctx, isDirect, isDual)
            if (filter) a.where = mergeWhere(a.where, filter, 'update')
          }
          const data = operation === 'upsert' ? a.create : a.data
          if (data) await applyWriteScope(model, isDirect, ctx, data)
          if (operation === 'upsert' && a.update) await applyWriteScope(model, isDirect, ctx, a.update, /*isUpdate*/ true)
          return query(args)
        }

        if (operation === 'createMany' && Array.isArray(a.data)) {
          for (const row of a.data) await applyWriteScope(model, isDirect, ctx, row)
          return query(args)
        }

        return query(args)
      },
    },
  },
})

async function applyWriteScope(
  model: string,
  isDirect: boolean,
  ctx: NonNullable<ReturnType<typeof getTenantContext>>,
  data: Record<string, unknown>,
  isUpdate = false,
) {
  if (ctx.role === Role.DIRECTOR_DISTRITAL) {
    // District-level actor must explicitly say which school a row belongs to;
    // we only validate it's actually inside their district.
    const targetSchoolId = data.schoolId as number | undefined
    if (targetSchoolId != null) {
      const school = await rawPrisma.school.findUnique({ where: { id: targetSchoolId }, select: { districtId: true } })
      if (!school || school.districtId !== ctx.districtId) {
        throw new HttpError(403, 'No autorizado: el colegio indicado no pertenece a tu distrito')
      }
    } else if (isDirect && !isUpdate) {
      throw new HttpError(400, 'Falta indicar el colegio (schoolId) para crear este registro')
    }
    return
  }

  // Ordinary school-scoped actor: always force their own school, ignore/override whatever was passed.
  if (ctx.schoolId != null) {
    data.schoolId = ctx.schoolId
  } else if (ctx.districtId != null && !isDirect) {
    // District-scoped Secretary/JuntaMember creating another district-level record.
    data.districtId = ctx.districtId
  }
}

export default prisma
