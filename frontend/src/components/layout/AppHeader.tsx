import Link from 'next/link'
import Image from 'next/image'
import { Menu, X, Bell, UserCircle, Settings } from 'lucide-react'

interface AppHeaderProps {
  brandName: string
  brandLoc: string
  logoSrc?: string
  mobileOpen: boolean
  onToggleMobile: () => void
  notificationsHref?: string
  hasUnread: boolean
  profileHref: string
  displayName: string
  onLogout: () => void
}

// Nivel 1 (parte fija): logo/marca + acciones de la esquina derecha
// (notificaciones/perfil/salir). Extracción 1:1 de DashboardShell — mismas
// clases CSS (definidas en el <style> de DashboardShell), sin cambio visual.
// Uso interno de DashboardShell, no pensado para usarse suelto en una página.
export default function AppHeader({
  brandName, brandLoc, logoSrc, mobileOpen, onToggleMobile,
  notificationsHref, hasUnread, profileHref, displayName, onLogout,
}: AppHeaderProps) {
  return (
    <header className="topbar">
      <div className="topbar-brand">
        {logoSrc && (
          <div className="brand-logo">
            <Image src={logoSrc} alt="Logo" width={32} height={32} style={{ objectFit: 'contain', borderRadius: '50%' }} unoptimized/>
          </div>
        )}
        <div className="brand-info">
          <span className="brand-name">{brandName}</span>
          <span className="brand-loc">{brandLoc}</span>
        </div>
      </div>

      <button className="mobile-menu-btn" onClick={onToggleMobile}>
        {mobileOpen ? <X size={20}/> : <Menu size={20}/>}
      </button>

      <div className="topbar-actions">
        {notificationsHref && (
          <Link href={notificationsHref} className="action-pill" title="Notificaciones">
            <Bell size={17}/>
            {hasUnread && <span className="notif-dot"/>}
          </Link>
        )}
        <Link href={profileHref} className="action-pill" title="Mi perfil">
          <UserCircle size={17}/>
          <span className="action-label">{displayName}</span>
        </Link>
        <button className="action-pill logout" onClick={onLogout} title="Cerrar sesión">
          <Settings size={17}/>
          <span className="action-label">Salir</span>
        </button>
      </div>
    </header>
  )
}
