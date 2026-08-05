import { Response } from 'express'
import { Prisma } from '@prisma/client'

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}

// Nombres amigables para los campos con restricción @@unique en el esquema —
// usados solo para el mensaje de la carrera de concurrencia (ver abajo), no
// reemplazan las validaciones explícitas ya hechas en cada servicio.
const UNIQUE_FIELD_LABELS: Record<string, string> = {
  ci: 'CI', email: 'correo', kardex: 'kardex', attendanceCode: 'código de asistencia',
  reference: 'número de comprobante', rude: 'RUDE', code: 'código',
}

export const handleControllerError = (res: Response, error: unknown): void => {
  if (error instanceof HttpError) {
    res.status(error.status).json({ message: error.message })
    return
  }

  // Choque de unicidad a nivel de base de datos — normalmente ya lo evita el
  // chequeo explícito en el servicio (findByX antes de guardar), pero si dos
  // solicitudes llegan casi al mismo instante (carrera de concurrencia),
  // ninguna alcanza a ver el conflicto antes de escribir; la base de datos es
  // la última línea de defensa. Sin este manejo, el usuario vería un genérico
  // "Error interno del servidor" en vez de un mensaje que explique qué pasó.
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    const target = Array.isArray(error.meta?.target) ? (error.meta.target as string[]) : []
    const field = target.find((f) => f !== 'schoolId') || target[0]
    const label = UNIQUE_FIELD_LABELS[field] || field || 'dato'
    res.status(409).json({ message: `Ya existe un registro con ese ${label} — alguien lo guardó justo antes. Intentá de nuevo.` })
    return
  }

  console.error(error)
  res.status(500).json({ message: 'Error interno del servidor' })
}
