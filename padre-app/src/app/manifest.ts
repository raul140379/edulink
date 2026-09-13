import type { MetadataRoute } from 'next'

// Misma decisión de branding que maestro-app (ver su manifest.ts para el
// razonamiento completo): marca a nivel DISTRITO, no de una UE específica —
// un padre de cualquier UE del distrito instala la misma app con el mismo
// ícono (escudo del Distrito/Municipio, re-derivado en PNG — mismos archivos
// que ya usa maestro-app, copiados tal cual). Nombre fijo "EduLink Padres"
// por la misma razón de consistencia de marca. No implementar branding por
// UE hasta que haya más de una UE usando esta app activamente (misma nota
// que maestro-app).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'EduLink Padres',
    short_name: 'EduLink Padres',
    description: 'Asistencia y notificaciones de tus hijos, desde el celular',
    start_url: '/',
    display: 'standalone',
    background_color: '#F4FAFB',
    theme_color: '#136272',
    orientation: 'portrait',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
