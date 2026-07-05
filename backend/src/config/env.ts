const isProd = process.env.NODE_ENV === 'production'

if (isProd && !process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET debe estar configurado explícitamente en producción')
}

export const env = {
  port:      parseInt(process.env.PORT || '4000', 10),
  isProd,
  jwtSecret: process.env.JWT_SECRET || 'sgje_secret_key',
}
