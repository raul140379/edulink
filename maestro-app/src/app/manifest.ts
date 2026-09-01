import type { MetadataRoute } from 'next'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

// La marca de esta app es a nivel DISTRITO (la unidad real por despliegue —
// "una instancia por distrito", con muchos colegios adentro), nunca de un
// colegio específico: un maestro de cualquier UE del distrito instala la
// misma app. Se pide en vivo a /api/public/district (público, sin auth) en
// vez de fijar un logo/nombre de colegio a mano. Si el distrito todavía no
// cargó su logo, cae a un ícono genérico propio (public/icons/fallback.svg).
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  let name = 'EduLink Maestro'
  let logoUrl: string | null = null

  try {
    const res = await fetch(`${API_URL}/api/public/district`, { next: { revalidate: 3600 } })
    if (res.ok) {
      const district = await res.json()
      if (district?.name) name = `Maestro — ${district.name}`
      logoUrl = district?.logoUrl || null
    }
  } catch {
    // Sin conexión al backend al momento de generar el manifest — se usa el fallback.
  }

  const icons: MetadataRoute.Manifest['icons'] = logoUrl
    ? [{ src: logoUrl, sizes: '512x512', type: 'image/png', purpose: 'any' }]
    : [{ src: '/icons/fallback.svg', sizes: '512x512', type: 'image/svg+xml', purpose: 'any' }]

  return {
    name,
    short_name: 'Maestro',
    description: 'Asistencia y notificaciones para el docente, desde el celular',
    start_url: '/',
    display: 'standalone',
    background_color: '#F6F2E7',
    theme_color: '#1F3B34',
    orientation: 'portrait',
    icons,
  }
}
