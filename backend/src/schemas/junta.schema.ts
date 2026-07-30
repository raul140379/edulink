import { z } from 'zod'

// Los 3 niveles de Junta de Padres que este endpoint puede crear — JUNTA_ESCOLAR
// (colegio) ya existía como rol; JUNTA_NUCLEO/JUNTA_DISTRITO son nuevos.
export const juntaRoleLevelSchema = z.enum(['JUNTA_ESCOLAR', 'JUNTA_NUCLEO', 'JUNTA_DISTRITO'])
export const juntaCargoSchema = z.enum(['PRESIDENTE', 'VICEPRESIDENTE', 'SECRETARIA', 'TESORERO', 'VOCAL'])

export const createJuntaMemberSchema = z.object({
  email:        z.string().email('Email inválido'),
  password:     z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
  role:         juntaRoleLevelSchema,
  // Requerido según el rol: schoolId para JUNTA_ESCOLAR, nucleoId para JUNTA_NUCLEO.
  // JUNTA_DISTRITO no necesita ninguno (hereda el distrito de quien lo crea).
  schoolId:     z.coerce.number().int().optional(),
  nucleoId:     z.coerce.number().int().optional(),
  firstName:    z.string().min(1, 'El nombre es requerido'),
  lastName:     z.string().min(1, 'El apellido es requerido'),
  ci:           z.string().optional(),
  phone:        z.string().optional(),
  cargo:        juntaCargoSchema.default('VOCAL'),
  academicYear: z.coerce.number().int(),
})

export const updateJuntaMemberSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName:  z.string().min(1).optional(),
  ci:        z.string().optional(),
  phone:     z.string().optional(),
  cargo:     juntaCargoSchema.optional(),
  isActive:  z.boolean().optional(),
})

// Auto-perfil: un miembro de junta editando sus propios datos — a propósito NO
// incluye cargo/isActive, eso solo lo puede tocar quien lo gestiona (updateJuntaMemberSchema).
export const updateOwnJuntaProfileSchema = updateJuntaMemberSchema.pick({
  firstName: true, lastName: true, ci: true, phone: true,
})

export type CreateJuntaMemberInput = z.infer<typeof createJuntaMemberSchema>
export type UpdateJuntaMemberInput = z.infer<typeof updateJuntaMemberSchema>
export type UpdateOwnJuntaProfileInput = z.infer<typeof updateOwnJuntaProfileSchema>
