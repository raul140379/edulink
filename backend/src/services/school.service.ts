import bcrypt from 'bcryptjs'
import * as XLSX from 'xlsx'
import { Prisma, Role, SchoolType, SchoolArea } from '@prisma/client'
import { schoolRepository } from '../repositories/school.repository'
import { nucleoRepository } from '../repositories/nucleo.repository'
import { directorRepository } from '../repositories/director.repository'
import { userRepository } from '../repositories/user.repository'
import { getTenantContext } from '../lib/tenant-context'
import { DISTRICT_WIDE_ROLES, NUCLEO_WIDE_ROLES } from '../lib/scoped-models'
import { CREATABLE_ROLES } from '../config/permissions'
import { HttpError } from '../utils/http-error'
import { generateUniqueEmail } from '../utils/account-generator'
import { CreateSchoolInput, UpdateSchoolInput, AssignDirectorInput } from '../schemas/school.schema'

const VALID_TIPOS: SchoolType[] = ['FISCAL', 'CONVENIO', 'PRIVADA']
const VALID_AREAS: SchoolArea[] = ['URBANA', 'RURAL']

export const schoolService = {
  async listSchools() {
    const ctx = getTenantContext()
    const where: Prisma.SchoolWhereInput = {}

    // SUPER_ADMIN sees every school in every district. Actores de alcance distrital
    // (Director Distrital, Junta/Gobierno de Distrito) ven solo los colegios de su
    // distrito; los de alcance de núcleo (Junta/Gobierno de Núcleo) solo los de su
    // núcleo. (Cualquier otro rol nunca llega a este servicio — la ruta está gateada
    // por SCHOOL_VIEW_ALL.)
    if (DISTRICT_WIDE_ROLES.has(ctx?.role as Role) && ctx?.districtId != null) {
      where.districtId = ctx.districtId
    } else if (NUCLEO_WIDE_ROLES.has(ctx?.role as Role) && ctx?.nucleoId != null) {
      where.nucleoId = ctx.nucleoId
    }

    return schoolRepository.findMany(where)
  },

  async getSchoolById(id: number) {
    const school = await schoolRepository.findById(id)
    if (!school) throw new HttpError(404, 'Unidad educativa no encontrada')

    const ctx = getTenantContext()
    if (DISTRICT_WIDE_ROLES.has(ctx?.role as Role) && school.districtId !== ctx?.districtId) {
      throw new HttpError(403, 'Esta unidad educativa no pertenece a tu distrito')
    }
    if (NUCLEO_WIDE_ROLES.has(ctx?.role as Role) && school.nucleoId !== ctx?.nucleoId) {
      throw new HttpError(403, 'Esta unidad educativa no pertenece a tu núcleo')
    }
    return school
  },

  async createSchool(input: CreateSchoolInput) {
    const existing = await schoolRepository.findBySieCode(input.sieCode)
    if (existing) throw new HttpError(409, `Ya existe una unidad educativa con el SIE ${input.sieCode}`)

    const ctx = getTenantContext()
    const districtId = ctx?.role === Role.DIRECTOR_DISTRITAL ? ctx.districtId : input.districtId
    if (!districtId) throw new HttpError(400, 'Falta indicar el distrito')

    const district = await schoolRepository.findDistrictById(districtId)
    if (!district) throw new HttpError(404, 'Distrito no encontrado')

    return schoolRepository.create({
      name:       input.name,
      sieCode:    input.sieCode,
      tipo:       input.tipo,
      area:       input.area,
      subsistema: input.subsistema,
      address:    input.address || null,
      district: { connect: { id: districtId } },
      ...(input.nucleoId != null ? { nucleo: { connect: { id: input.nucleoId } } } : {}),
    })
  },

  async updateSchool(id: number, input: UpdateSchoolInput) {
    await schoolService.getSchoolById(id) // 404/403 guard, respects district scope
    return schoolRepository.update(id, input)
  },

  // Crea (o reemplaza) el Director de una unidad educativa: un User nuevo con
  // rol DIRECTOR + su perfil (nombre/apellido). Si ya había un director activo
  // en este colegio, queda desactivado (isActive: false) — no se borra, para no
  // perder el historial de quién ocupó el cargo antes.
  async assignDirector(schoolId: number, input: AssignDirectorInput) {
    await schoolService.getSchoolById(schoolId) // 404/403 guard, respeta el alcance de distrito

    // Misma jerarquía de designación que userService.createUser: solo puede
    // asignar un Director quien tenga Role.DIRECTOR dentro de su propio
    // CREATABLE_ROLES (hoy: SUPER_ADMIN sin restricción, DIRECTOR_DISTRITAL sí).
    const ctx = getTenantContext()
    if (ctx && ctx.role !== Role.SUPER_ADMIN) {
      const allowed = CREATABLE_ROLES[ctx.role]
      if (!allowed || !allowed.includes(Role.DIRECTOR)) {
        throw new HttpError(403, 'Tu rol no tiene permitido asignar directores')
      }
    }

    const { firstName, lastName, ci, phone, email, password } = input

    let accessEmail: string
    if (email && email.trim() !== '') {
      const existing = await userRepository.findByEmail(email.trim())
      if (existing) throw new HttpError(409, `El correo ${email} ya está en uso`)
      accessEmail = email.trim()
    } else {
      accessEmail = await generateUniqueEmail(firstName, lastName)
    }

    const hashedPassword = await bcrypt.hash(password, 10)
    const user = await userRepository.create({ email: accessEmail, password: hashedPassword, role: Role.DIRECTOR, schoolId })

    await directorRepository.deactivateAllForSchool(schoolId)
    const director = await directorRepository.create({
      firstName, lastName, ci: ci || null, phone: phone || null, schoolId, userId: user.id,
    })

    return { director, accessEmail, password }
  },

  // Importación masiva de colegios desde planilla — mismo patrón que
  // parentService.importParents/studentService.importStudents.
  // Columnas esperadas (case-insensitive): SIE, NOMBRE, DEPENDENCIA
  // (FISCAL/CONVENIO/PRIVADA), AREA (URBANA/RURAL), NUCLEO (opcional, por nombre).
  //
  // Nota: recibe districtId explícito (leído en el controller de req.userDistrictId,
  // NO de getTenantContext()) porque el AsyncLocalStorage del contexto de tenant no
  // se propaga de forma confiable a través del middleware de multer en rutas con
  // upload de archivos — a diferencia de req.userDistrictId, que auth.middleware ya
  // deja seteado directamente en el request y sí persiste en toda la cadena.
  async importSchools(fileBuffer: Buffer, districtId: number | null | undefined) {
    if (districtId == null) throw new HttpError(400, 'Tu usuario no está vinculado a un distrito')

    const workbook = XLSX.read(fileBuffer, { type: 'buffer' })
    const sheet     = workbook.Sheets[workbook.SheetNames[0]]
    const rows      = XLSX.utils.sheet_to_json(sheet, { defval: '' }) as any[]

    const created: any[] = []
    const skipped: any[] = []
    const errors:  any[] = []

    for (const row of rows) {
      const sieCode = String(row['SIE'] || '').trim()
      try {
        const name       = String(row['NOMBRE'] || row['UNIDAD EDUCATIVA'] || '').trim()
        const tipoRaw    = String(row['DEPENDENCIA'] || '').trim().toUpperCase()
        const areaRaw    = String(row['AREA'] || row['ÁREA'] || '').trim().toUpperCase()
        const nucleoName = String(row['NUCLEO'] || row['NÚCLEO'] || '').trim()

        if (!sieCode || !name) { errors.push({ sieCode, reason: 'Falta SIE o nombre' }); continue }
        if (!VALID_TIPOS.includes(tipoRaw as SchoolType)) { errors.push({ sieCode, reason: `Dependencia inválida: "${tipoRaw}"` }); continue }
        if (!VALID_AREAS.includes(areaRaw as SchoolArea)) { errors.push({ sieCode, reason: `Área inválida: "${areaRaw}"` }); continue }

        const existing = await schoolRepository.findBySieCode(sieCode)
        if (existing) { skipped.push({ sieCode, reason: 'Ya existe una unidad educativa con este SIE' }); continue }

        const nucleo = nucleoName ? await nucleoRepository.findByName(nucleoName, districtId) : null
        if (nucleoName && !nucleo) errors.push({ sieCode, reason: `Núcleo "${nucleoName}" no encontrado — colegio creado sin núcleo asignado` })

        await schoolRepository.create({
          name, sieCode,
          tipo: tipoRaw as SchoolType,
          area: areaRaw as SchoolArea,
          district: { connect: { id: districtId } },
          ...(nucleo ? { nucleo: { connect: { id: nucleo.id } } } : {}),
        })
        created.push({ sieCode, name })
      } catch (e: any) {
        errors.push({ sieCode, reason: e.message || 'Error desconocido' })
      }
    }

    return { created, skipped, errors, total: rows.length }
  },
}
