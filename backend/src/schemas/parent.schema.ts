import { z } from 'zod'
import { RelationType } from '@prisma/client'

export const createParentSchema = z.object({
  firstName:    z.string().min(1, 'El nombre es requerido'),
  lastName:     z.string().min(1, 'El apellido es requerido'),
  ci:           z.string().optional(),
  phone:        z.string().optional(),
  email:        z.string().email('Email inválido').optional(),
  address:      z.string().optional(),
  relationType: z.nativeEnum(RelationType),
  studentIds:   z.array(z.coerce.number().int()).optional(),
})

export const updateParentSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName:  z.string().min(1).optional(),
  ci:        z.string().optional(),
  phone:     z.string().optional(),
  email:     z.string().email('Email inválido').optional(),
  address:   z.string().optional(),
})

export const updateMeSchema = z.object({
  phone:   z.string().optional(),
  email:   z.string().email('Email inválido').optional(),
  address: z.string().optional(),
})

export const linkStudentsSchema = z.object({
  studentIds:   z.array(z.coerce.number().int()).min(1, 'Debe proporcionar al menos un estudiante'),
  relationType: z.nativeEnum(RelationType).optional(),
})

export const changeTutorSchema = z.object({
  newTutorId: z.coerce.number().int(),
})

export const changeRelationSchema = z.object({
  relationType: z.nativeEnum(RelationType),
  isTutor:      z.boolean().optional(),
})

export type CreateParentInput    = z.infer<typeof createParentSchema>
export type UpdateParentInput    = z.infer<typeof updateParentSchema>
export type UpdateMeInput        = z.infer<typeof updateMeSchema>
export type LinkStudentsInput    = z.infer<typeof linkStudentsSchema>
export type ChangeTutorInput     = z.infer<typeof changeTutorSchema>
export type ChangeRelationInput  = z.infer<typeof changeRelationSchema>
