import { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Estudiante — U.E. Naciones Unidas',
    short_name: 'Estudiante NNUU',
    description: 'Portal del estudiante — U.E. Naciones Unidas El Torno',
    start_url: '/dashboard/estudiantes',
    display: 'standalone',
    background_color: '#1A7DB8',
    theme_color: '#1A7DB8',
    icons: [
      { src: '/logo-nnuu.jpeg', sizes: '192x192', type: 'image/jpeg' },
      { src: '/logo-nnuu.jpeg', sizes: '512x512', type: 'image/jpeg' },
    ],
  }
}