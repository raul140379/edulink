import type { Metadata } from 'next'
import PorteroHeaderLoc from './PorteroHeaderLoc'

export const metadata: Metadata = {
  title: 'Seguridad y Control — NNUU',
  description: 'Seguridad y control de entrada y salida U.E. Naciones Unidas',
  manifest: '/manifest-portero.json',
  themeColor: '#344551',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Seguridad NNUU',
  },
  viewport: {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
  },
}

export default function PorteroLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      minHeight: '100vh',
      background: '#1F2B33',
      display: 'flex',
      flexDirection: 'column',
    }}>
      <div style={{
        background: '#2A3439',
        borderBottom: '1px solid #3D5B71',
        padding: '12px 20px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
      }}>
        <div style={{
          width: 36, height: 36, borderRadius: 8,
          background: '#3D5B71',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 18,
        }}>🚪</div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#F1F5F9' }}>
            Seguridad y Control
          </div>
          <PorteroHeaderLoc/>
        </div>
        <div style={{ marginLeft: 'auto', fontSize: 12, color: '#94A3B8' }}>
          {new Date().toLocaleDateString('es-BO', { weekday: 'long', day: 'numeric', month: 'long' })}
        </div>
      </div>
      <div style={{ flex: 1, padding: '20px 16px', maxWidth: 600, margin: '0 auto', width: '100%' }}>
        {children}
      </div>
    </div>
  )
}