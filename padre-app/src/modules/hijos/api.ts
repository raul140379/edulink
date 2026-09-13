import { apiFetch } from '@/lib/api'

export interface Course {
  id: number
  grade: string
  parallel: string
  shift: string
  level: string
}

export interface MyChild {
  id: number
  firstName: string
  lastName: string
  isTutor: boolean
  course: Course | null
}

export const hijosApi = {
  getMyChildren: () => apiFetch<MyChild[]>('/api/parents/my-students'),
}
