import type { MetadataRoute } from 'next'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

// La marca de esta app es a nivel DISTRITO (la unidad real por despliegue —
// "una instancia por distrito", con muchos colegios adentro), nunca de un
// colegio específico: un maestro de cualquier UE del distrito instala la
// misma app. El NOMBRE se pide en vivo a /api/public/district (público, sin
// auth). El ÍCONO usa siempre el archivo liviano propio (public/icons/
// fallback.svg) — el logo real del distrito llega como un data: URI de
// ~1.3MB (el distrito lo cargó así), y un manifest de esa magnitud es
// exactamente la clase de cosa que puede hacer fallar la instalación PWA en
// el celular (confirmado real, ver corrección 1-sep-2026) — no vale el
// riesgo por una mejora cosmética. Retomar el logo real más adelante,
// re-servido como archivo propio ya optimizado, no como data: URI inline.
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  let name = 'EduLink Maestro'

  try {
    const res = await fetch(`${API_URL}/api/public/district`, { next: { revalidate: 3600 } })
    if (res.ok) {
      const district = await res.json()
      if (district?.name) name = `Maestro — ${district.name}`
    }
  } catch {
    // Sin conexión al backend al momento de generar el manifest — se usa el nombre genérico.
  }

  return {
    name,
    short_name: 'Maestro',
    description: 'Asistencia y notificaciones para el docente, desde el celular',
    start_url: '/',
    display: 'standalone',
    background_color: '#F6F2E7',
    theme_color: '#1F3B34',
    orientation: 'portrait',
    icons: [
      { src: '/icons/fallback.svg', sizes: '192x192', type: 'image/svg+xml', purpose: 'any' },
      { src: '/icons/fallback.svg', sizes: '512x512', type: 'image/svg+xml', purpose: 'any' },
      { src: '/icons/fallback.svg', sizes: '512x512', type: 'image/svg+xml', purpose: 'maskable' },
    ],
  }
}
