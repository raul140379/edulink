import { z } from 'zod'
import { Role } from '@prisma/client'

export const createUserSchema = z.object({
  email:    z.string().email('Email inválido'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
  role:     z.nativeEnum(Role),
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
