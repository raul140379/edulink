const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Permite abrir el dev server desde el celular por IP de red local — sin
  // esto, Next bloquea (403) sus propios recursos internos (JS/HMR) cuando
  // se piden desde un origen que no reconoce como el suyo.
  allowedDevOrigins: ['192.168.100.202'],

  // El ícono (public/icons/*.png, no tiene nombre de archivo con hash) y el
  // manifest quedaban con el default de Vercel para archivos estáticos
  // (max-age=0, must-revalidate) — se re-descargaban en CADA apertura de la
  // app (~39KB solo por el ícono), confirmado real midiendo tráfico contra
  // producción el 1-sep-2026. No tan largo como el 1 año "immutable" que sí
  // usan los chunks con hash de _next/static (ahí un cambio de contenido
  // siempre trae nombre de archivo nuevo; acá no, así que un valor muy largo
  // dejaría a un usuario con un ícono desactualizado hasta que expire) — 1
  // día de caché dura + revalidación en segundo plano hasta 1 semana:
  // suficiente para eliminar la re-descarga dentro del mismo día de uso, sin
  // arriesgarse a que un cambio de ícono tarde demasiado en propagarse.
  async headers() {
    return [
      {
        source: '/icons/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=86400, stale-while-revalidate=604800' }],
      },
      {
        source: '/manifest.webmanifest',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=86400, stale-while-revalidate=604800' }],
      },
    ]
  },
}

export default nextConfig
