import { z } from 'zod'

export const assignDelegateSchema = z.object({
  parentId: z.coerce.number().int(),
})

export type AssignDelegateInput = z.infer<typeof assignDelegateSchema>
