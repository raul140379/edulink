import { userRepository } from '../repositories/user.repository'

export const normalizeLetters = (str: string) =>
  str.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Z]/g, '')

const normalizeEmailPart = (str: string) =>
  str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '.').replace(/[^a-z0-9.]/g, '')

export function generateParentPassword(lastName: string, ci?: string | null): string {
  const year = new Date().getFullYear()
  if (ci && ci.trim().length >= 4) return `padre${ci.trim().slice(-4)}${year}`
  return `padre${normalizeLetters(lastName.split(' ')[0]).slice(0, 3)}${year}`
}

export async function generateUniqueEmail(firstName: string, lastName: string, domain = '@nnuu.edu.bo'): Promise<string> {
  const first = normalizeEmailPart(firstName.split(' ')[0])
  const last  = normalizeEmailPart(lastName.split(' ')[0])
  const base  = `${first}.${last}${domain}`

  const existing = await userRepository.findByEmail(base)
  if (!existing) return base

  let counter = 2
  while (true) {
    const candidate = `${first}.${last}${counter}${domain}`
    const dup = await userRepository.findByEmail(candidate)
    if (!dup) return candidate
    counter++
  }
}
