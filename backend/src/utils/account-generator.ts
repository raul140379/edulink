import prisma from '../lib/prisma'
import { getTenantContext } from '../lib/tenant-context'
import { userRepository } from '../repositories/user.repository'

// Dominio de correo institucional por defecto - usado cuando el distrito activo
// todavia no configuro el suyo propio en el asistente (Configuracion).
const DEFAULT_EMAIL_DOMAIN = '@nnuu.edu.bo'

export async function resolveEmailDomain(): Promise<string> {
  const ctx = getTenantContext()
  if (ctx?.districtId == null) return DEFAULT_EMAIL_DOMAIN
  const district = await prisma.district.findUnique({ where: { id: ctx.districtId }, select: { emailDomain: true } })
  return district?.emailDomain || DEFAULT_EMAIL_DOMAIN
}

export const normalizeLetters = (str: string) =>
  str.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Z]/g, '')

const normalizeEmailPart = (str: string) =>
  str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '.').replace(/[^a-z0-9.]/g, '')

export function generateParentPassword(lastName: string, ci?: string | null): string {
  const year = new Date().getFullYear()
  if (ci && ci.trim().length >= 4) return `padre${ci.trim().slice(-4)}${year}`
  return `padre${normalizeLetters(lastName.split(' ')[0]).slice(0, 3)}${year}`
}

// Reseteo de contraseña — a diferencia de generateParentPassword (determinística
// a partir de apellido/CI, siempre la misma), acá hace falta un valor nuevo cada
// vez que se resetea, así que se usa un número aleatorio en vez del CI.
export function generateResetPassword(): string {
  const year = new Date().getFullYear()
  const rand = Math.floor(1000 + Math.random() * 9000)
  return `padre${rand}${year}`
}

// Usada al elevar a un Parent/tutor ya existente a un cargo de Junta Escolar
// (segunda cuenta, mismo patrón que generateParentPassword pero con prefijo
// "junta" para distinguirla a simple vista).
export function generateJuntaPassword(lastName: string, ci?: string | null): string {
  const year = new Date().getFullYear()
  if (ci && ci.trim().length >= 4) return `junta${ci.trim().slice(-4)}${year}`
  return `junta${normalizeLetters(lastName.split(' ')[0]).slice(0, 3)}${year}`
}

// excludeUserId: al REGENERAR el correo de una cuenta ya existente, esa misma
// cuenta no debe contar como "duplicado" de sí misma (si no, regenerar un
// correo que ya sigue el patrón institucional le agregaría un sufijo
// numérico innecesario).
export async function generateUniqueEmail(firstName: string, lastName: string, domain?: string, excludeUserId?: number): Promise<string> {
  const resolvedDomain = domain ?? await resolveEmailDomain()
  const first = normalizeEmailPart(firstName.split(' ')[0])
  const last  = normalizeEmailPart(lastName.split(' ')[0])
  const base  = `${first}.${last}${resolvedDomain}`

  const existing = await userRepository.findByEmail(base)
  if (!existing || existing.id === excludeUserId) return base

  let counter = 2
  while (true) {
    const candidate = `${first}.${last}${counter}${resolvedDomain}`
    const dup = await userRepository.findByEmail(candidate)
    if (!dup || dup.id === excludeUserId) return candidate
    counter++
  }
}
