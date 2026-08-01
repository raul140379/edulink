import { z } from 'zod'

// Los 3 niveles de Junta de Padres que este endpoint puede crear — JUNTA_ESCOLAR
// (colegio) ya existía como rol; JUNTA_NUCLEO/JUNTA_DISTRITO son nuevos.
export const juntaRoleLevelSchema = z.enum(['JUNTA_ESCOLAR', 'JUNTA_NUCLEO', 'JUNTA_DISTRITO'])
export const juntaCargoSchema = z.enum(['PRESIDENTE', 'VICEPRESIDENTE', 'SECRETARIA', 'TESORERO', 'VOCAL'])

export const createJuntaMemberSchema = z.object({
  role:         juntaRoleLevelSchema,
  // Requerido según el rol: schoolId para JUNTA_ESCOLAR, nucleoId para JUNTA_NUCLEO.
  // JUNTA_DISTRITO no necesita ninguno (hereda el distrito de quien lo crea).
  schoolId:     z.coerce.number().int().optional(),
  nucleoId:     z.coerce.number().int().optional(),
  // JUNTA_ESCOLAR: la persona tiene que ser ya un Parent/tutor existente — se
  // manda parentId y el resto (nombre/CI/email/contraseña) se resuelve en el
  // servicio a partir de ese Parent, igual que ya hace delegateService.assignDelegate.
  // JUNTA_NUCLEO/JUNTA_DISTRITO: sigue el alta "en blanco" de siempre (sin parentId).
  parentId:     z.coerce.number().int().optional(),
  email:        z.string().email('Email inválido').optional(),
  password:     z.string().min(6, 'La contraseña debe tener al menos 6 caracteres').optional(),
  firstName:    z.string().min(1).optional(),
  lastName:     z.string().min(1).optional(),
  ci:           z.string().optional(),
  phone:        z.string().optional(),
  cargo:        juntaCargoSchema.default('VOCAL'),
  academicYear: z.coerce.number().int(),
}).superRefine((data, ctx) => {
  if (data.role === 'JUNTA_ESCOLAR') {
    if (!data.parentId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['parentId'], message: 'Selecciona un padre/tutor ya registrado' })
    }
  } else {
    if (!data.email)     ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['email'],     message: 'Email inválido' })
    if (!data.password)  ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['password'],  message: 'La contraseña debe tener al menos 6 caracteres' })
    if (!data.firstName) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['firstName'], message: 'El nombre es requerido' })
    if (!data.lastName)  ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['lastName'],  message: 'El apellido es requerido' })
  }
})

export const updateJuntaMemberSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName:  z.string().min(1).optional(),
  ci:        z.string().optional(),
  phone:     z.string().optional(),
  cargo:     juntaCargoSchema.optional(),
  isActive:  z.boolean().optional(),
  // Reasignación de nivel/alcance — opcional, solo se resuelve en el servicio
  // cuando alguno de estos 3 viene en el body (ver junta.service.ts:updateJuntaMember).
  role:      juntaRoleLevelSchema.optional(),
  schoolId:  z.coerce.number().int().optional(),
  nucleoId:  z.coerce.number().int().optional(),
})

// Auto-perfil: un miembro de junta editando sus propios datos — a propósito NO
// incluye cargo/isActive, eso solo lo puede tocar quien lo gestiona (updateJuntaMemberSchema).
export const updateOwnJuntaProfileSchema = updateJuntaMemberSchema.pick({
  firstName: true, lastName: true, ci: true, phone: true,
})

export type CreateJuntaMemberInput = z.infer<typeof createJuntaMemberSchema>
export type UpdateJuntaMemberInput = z.infer<typeof updateJuntaMemberSchema>
export type UpdateOwnJuntaProfileInput = z.infer<typeof updateOwnJuntaProfileSchema>
