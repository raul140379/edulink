import type { Metadata, Viewport } from 'next'
import RegisterServiceWorker from '@/components/RegisterServiceWorker'
import './globals.css'

export const metadata: Metadata = {
  title: 'EduLink Maestro',
  description: 'Asistencia y notificaciones para el docente, desde el celular',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Maestro',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#1F3B34',
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
