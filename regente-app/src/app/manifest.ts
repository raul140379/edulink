import type { MetadataRoute } from 'next'

// Mismo criterio de branding que maestro-app (ver ese manifest.ts para el
// razonamiento completo): ícono/nombre a nivel DISTRITO, fijo, sin pedirlo
// en vivo a la red — reusa los mismos PNG ya derivados del logo real.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'EduLink Regente',
    short_name: 'EduLink Regente',
    description: 'Registro de llegada tardía y notificación a padres, desde el celular',
    start_url: '/',
    display: 'standalone',
    background_color: '#F6F2E7',
    theme_color: '#1F3B34',
    orientation: 'portrait',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
