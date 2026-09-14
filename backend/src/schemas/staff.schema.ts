import { z } from 'zod'
import { StaffRole, Shift, Gender } from '@prisma/client'

export const createStaffSchema = z.object({
  firstName: z.string().min(1, 'El nombre es requerido'),
  lastName:  z.string().min(1, 'El apellido es requerido'),
  ci:        z.string().optional(),
  phone:     z.string().optional(),
  email:     z.string().email('Email inválido').optional().or(z.literal('')),
  gender:    z.nativeEnum(Gender).optional(),
  staffRole: z.nativeEnum(StaffRole),
  shift:     z.nativeEnum(Shift).optional(),
})

export const updateStaffSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName:  z.string().min(1).optional(),
  ci:        z.string().optional(),
  phone:     z.string().optional(),
  email:     z.string().email('Email inválido').optional().or(z.literal('')),
  gender:    z.nativeEnum(Gender).optional(),
  staffRole: z.nativeEnum(StaffRole).optional(),
  shift:     z.nativeEnum(Shift).optional(),
})

export type CreateStaffInput = z.infer<typeof createStaffSchema>
export type UpdateStaffInput = z.infer<typeof updateStaffSchema>
