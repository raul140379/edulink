import { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Maestro — U.E. Naciones Unidas',
    short_name: 'Maestro NNUU',
    description: 'Portal del maestro — U.E. Naciones Unidas El Torno',
    start_url: '/dashboard/teacher',
    display: 'standalone',
    background_color: '#633806',
    theme_color: '#633806',
    icons: [
      { src: '/logo-nnuu.jpeg', sizes: '192x192', type: 'image/jpeg' },
      { src: '/logo-nnuu.jpeg', sizes: '512x512', type: 'image/jpeg' },
    ],
  }
}