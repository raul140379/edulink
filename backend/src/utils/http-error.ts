import { Response } from 'express'

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}

export const handleControllerError = (res: Response, error: unknown): void => {
  if (error instanceof HttpError) {
    res.status(error.status).json({ message: error.message })
    return
  }
  console.error(error)
  res.status(500).json({ message: 'Error interno del servidor' })
}
