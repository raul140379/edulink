import type { Metadata } from 'next'
import PorteroHeaderLoc from './PorteroHeaderLoc'

export const metadata: Metadata = {
  title: 'Control de Acceso — NNUU',
  description: 'Control de entrada y salida U.E. Naciones Unidas',
  manifest: '/manifest-portero.json',
  themeColor: '#1A3A7C',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Portero NNUU',
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
      background: '#0F172A',
      display: 'flex',
      flexDirection: 'column',
    }}>
      <div style={{
        background: '#1E293B',
        borderBottom: '1px solid #334155',
        padding: '12px 20px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
      }}>
        <div style={{
          width: 36, height: 36, borderRadius: 8,
          background: '#1A3A7C',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 18,
        }}>🚪</div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#F1F5F9' }}>
            Control de Acceso
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