import { z } from 'zod'
import { Role } from '@prisma/client'

export const createUserSchema = z.object({
  email:    z.string().email('Email inválido'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
  role:     z.nativeEnum(Role),
  // Solo lo usa un DIRECTOR_DISTRITAL/SUPER_ADMIN para indicar a qué unidad educativa
  // pertenece el nuevo usuario — un Director de colegio no lo necesita, su propio
  // schoolId se autoinyecta en lib/prisma.ts.
  schoolId:   z.coerce.number().int().optional(),
  // Solo lo usa SUPER_ADMIN al crear un DIRECTOR_DISTRITAL/rol de distrito.
  districtId: z.coerce.number().int().optional(),
  // Solo para JUNTA_NUCLEO/GOBIERNO_NUCLEO — a qué núcleo pertenece el nuevo usuario.
  nucleoId:   z.coerce.number().int().optional(),
})

export const updateUserSchema = z.object({
  email:    z.string().email('Email inválido').optional(),
  role:     z.nativeEnum(Role).optional(),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres').optional(),
})

export const resetByEmailSchema = z.object({
  email:    z.string().email('Email inválido'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
})

export type CreateUserInput   = z.infer<typeof createUserSchema>
export type UpdateUserInput   = z.infer<typeof updateUserSchema>
export type ResetByEmailInput = z.infer<typeof resetByEmailSchema>
