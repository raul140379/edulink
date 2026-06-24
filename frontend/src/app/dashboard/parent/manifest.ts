import { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Padre — U.E. Naciones Unidas',
    short_name: 'Padre NNUU',
    description: 'Portal del padre — U.E. Naciones Unidas El Torno',
    start_url: '/dashboard/parent',
    display: 'standalone',
    background_color: '#27500A',
    theme_color: '#27500A',
    icons: [
      { src: '/logo-nnuu.jpeg', sizes: '192x192', type: 'image/jpeg' },
      { src: '/logo-nnuu.jpeg', sizes: '512x512', type: 'image/jpeg' },
    ],
  }
}