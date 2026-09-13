// prueba descartable de auto-deploy (13-sep-2026) — se revierte enseguida
import type { Metadata, Viewport } from 'next'
import RegisterServiceWorker from '@/components/RegisterServiceWorker'
import './globals.css'

export const metadata: Metadata = {
  title: 'EduLink Padres',
  description: 'Asistencia y notificaciones de tus hijos, desde el celular',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Padres',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#136272',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        <RegisterServiceWorker />
        {children}
      </body>
    </html>
  )
}
