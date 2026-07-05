import { z } from 'zod'

export const addTeacherSpecialtySchema = z.object({
  subjectId: z.coerce.number().int(),
})

export type AddTeacherSpecialtyInput = z.infer<typeof addTeacherSpecialtySchema>
