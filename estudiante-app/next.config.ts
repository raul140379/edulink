const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },

  // Mismo fix ya validado en maestro-app/padre-app/regente-app: sin esto, el
  // ícono/manifest se re-descargan en cada apertura de la app (default de
  // Vercel para estáticos sin hash es max-age=0). 1 día de caché + revalidación
  // hasta 1 semana.
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
