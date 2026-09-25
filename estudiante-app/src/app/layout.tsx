import type { Metadata, Viewport } from 'next'
import RegisterServiceWorker from '@/components/RegisterServiceWorker'
import './globals.css'

export const metadata: Metadata = {
  title: 'EduLink Estudiantes',
  description: 'Tu asistencia y notificaciones, desde el celular',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Estudiantes',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#3B5BDB',
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
