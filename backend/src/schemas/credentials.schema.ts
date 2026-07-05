import { z } from 'zod'

export const resetCredentialsSchema = z.object({
  roles: z.union([z.literal('ALL'), z.array(z.string())]).optional(),
})

export type ResetCredentialsInput = z.infer<typeof resetCredentialsSchema>
