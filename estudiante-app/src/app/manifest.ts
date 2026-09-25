import type { MetadataRoute } from 'next'

// Misma decisión de branding que maestro-app/padre-app/regente-app: marca a
// nivel DISTRITO, no de una UE específica — un estudiante de cualquier UE
// del distrito instala la misma app con el mismo ícono (escudo del
// Distrito/Municipio, mismos archivos ya usados por las otras 3 apps,
// copiados tal cual). Nombre fijo "EduLink Estudiantes". No implementar
// branding por UE hasta que haya más de una UE usando esta app activamente
// (misma nota que las 3 apps anteriores).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'EduLink Estudiantes',
    short_name: 'EduLink',
    description: 'Tu asistencia y notificaciones, desde el celular',
    start_url: '/',
    display: 'standalone',
    background_color: '#EDF1FE',
    theme_color: '#3B5BDB',
    orientation: 'portrait',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
