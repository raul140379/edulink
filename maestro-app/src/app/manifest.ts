import type { MetadataRoute } from 'next'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

// La marca de esta app es a nivel DISTRITO (la unidad real por despliegue —
// "una instancia por distrito", con muchos colegios adentro), nunca de un
// colegio específico: un maestro de cualquier UE del distrito instala la
// misma app, con el mismo ícono — el escudo del Distrito/Municipio El
// Torno, no el de ninguna UE en particular. El NOMBRE se pide en vivo a
// /api/public/district (público, sin auth). El ÍCONO usa PNG propios
// (public/icons/icon-192.png, icon-512.png) re-derivados una sola vez del
// logo real del distrito (recortado el margen blanco + reescalado con
// padding de zona segura para maskable) — no el data: URI de ~1.3MB que
// expone /api/public/district.logoUrl tal cual: ese peso es exactamente la
// clase de cosa que puede hacer fallar la instalación PWA en el celular
// (confirmado real, ver corrección 1-sep-2026). PNG y no SVG a propósito:
// el soporte de íconos SVG en el manifest varía entre versiones de
// Chrome/Android (se agregó recién en Chrome ~116), mientras que PNG es
// universalmente soportado.
//
// Nota de arquitectura (1-sep-2026): si en el futuro cada UE del distrito
// quiere su propio ícono/branding distinto al del distrito en general, la
// solución real es una app separada por colegio — no intentar que esta
// misma app sirva íconos distintos por usuario logueado. No implementar
// hasta que haya más de una UE usando maestro-app activamente.
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
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
