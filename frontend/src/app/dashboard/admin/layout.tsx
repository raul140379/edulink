'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import {
  LayoutDashboard, Users, GraduationCap, BookOpen,
  ClipboardList, Clock, DollarSign, Bell, FileBarChart,
  Settings, LogOut, Menu, X, ShieldCheck, ChevronRight, Calendar
} from 'lucide-react' 

// ─── Tipos ───────────────────────────────────────
interface MenuItem {
  label:   string
  href:    string
  icon:    React.ReactNode
  roles:   string[]
  badge?:  number
}

interface User {
  id:          number
  email:       string
  role:        string
  permissions: string[]
}

// ─── Menú completo del sistema ───────────────────
const menuItems: MenuItem[] = [
  {
    label: 'Inicio',
    href:  '/dashboard/admin',
    icon:  <LayoutDashboard size={18} />,
    roles: ['SUPER_ADMIN','DIRECTOR','REGENTE','SECRETARY','TEACHER','DELEGATE','PARENT','STUDENT'],
  },
  {
  label: 'Gestión Académica',
  href:  '/dashboard/admin/gestion',
  icon:  <Calendar size={18} />,
  roles: ['SUPER_ADMIN','DIRECTOR','SECRETARY'],
  },
  {
    label: 'Usuarios',
    href:  '/dashboard/admin/usuarios',
    icon:  <Users size={18} />,
    roles: ['SUPER_ADMIN','DIRECTOR','SECRETARY'],
  },
  {
    label: 'Estudiantes',
    href:  '/dashboard/admin/estudiantes',
    icon:  <GraduationCap size={18} />,
    roles: ['SUPER_ADMIN','DIRECTOR','REGENTE','SECRETARY','TEACHER','DELEGATE'],
  },
  {
    label: 'Padres / Tutores',
    href:  '/dashboard/admin/padres',
    icon:  <Users size={18} />,
    roles: ['SUPER_ADMIN','DIRECTOR','REGENTE','SECRETARY','DELEGATE'],
  },
  {
    label: 'Cursos',
    href:  '/dashboard/admin/cursos',
    icon:  <BookOpen size={18} />,
    roles: ['SUPER_ADMIN','DIRECTOR','REGENTE','SECRETARY','TEACHER','DELEGATE'],
  },
  {
    label: 'Notas',
    href:  '/dashboard/admin/notas',
    icon:  <ClipboardList size={18} />,
    roles: ['SUPER_ADMIN','DIRECTOR','REGENTE','SECRETARY','TEACHER','PARENT','STUDENT'],
  },
  {
    label: 'Horarios',
    href:  '/dashboard/admin/horarios',
    icon:  <Clock size={18} />,
    roles: ['SUPER_ADMIN','DIRECTOR','REGENTE','SECRETARY','TEACHER','PARENT','STUDENT'],
  },
  {
    label: 'Tesorería',
    href:  '/dashboard/admin/tesoreria',
    icon:  <DollarSign size={18} />,
    roles: ['SUPER_ADMIN','DIRECTOR','SECRETARY','DELEGATE','PARENT'],
  },
  {
    label: 'Notificaciones',
    href:  '/dashboard/admin/notificaciones',
    icon:  <Bell size={18} />,
    roles: ['SUPER_ADMIN','DIRECTOR','REGENTE','SECRETARY','TEACHER','DELEGATE','PARENT','STUDENT'],
  },
  {
    label: 'Reportes',
    href:  '/dashboard/admin/reportes',
    icon:  <FileBarChart size={18} />,
    roles: ['SUPER_ADMIN','DIRECTOR','REGENTE','SECRETARY','TEACHER','DELEGATE'],
  },
  {
    label: 'Verificación',
    href:  '/dashboard/portero',
    icon:  <ShieldCheck size={18} />,
    roles: ['STAFF','SUPER_ADMIN'],
  },
  {
    label: 'Configuración',
    href:  '/dashboard/admin/configuracion',
    icon:  <Settings size={18} />,
    roles: ['SUPER_ADMIN'],
  },
]

// ─── Etiquetas de roles ───────────────────────────
const roleLabels: Record<string, string> = {
  SUPER_ADMIN:  'Super Administrador',
  DIRECTOR:     'Director',
  REGENTE:      'Regente',
  SECRETARY:    'Secretaria',
  TEACHER:      'Maestro',
  DELEGATE:     'Delegado',
  PARENT:       'Padre / Tutor',
  STUDENT:      'Estudiante',
  STUDENT_GOV:  'Gobierno Estudiantil',
  STAFF:        'Personal',
}

// ─── Colores de badge por rol ─────────────────────
const roleBadgeStyle: Record<string, string> = {
  SUPER_ADMIN: 'background:#1A3A7C;color:#fff',
  DIRECTOR:    'background:#0F6E56;color:#fff',
  REGENTE:     'background:#3C3489;color:#fff',
  SECRETARY:   'background:#712B13;color:#fff',
  TEACHER:     'background:#633806;color:#fff',
  DELEGATE:    'background:#444441;color:#fff',
  PARENT:      'background:#27500A;color:#fff',
  STUDENT:     'background:#791F1F;color:#fff',
  STAFF:       'background:#185FA5;color:#fff',
}

// ─── Componente principal ─────────────────────────
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router   = useRouter()
  const pathname = usePathname()
  const [user, setUser]           = useState<User | null>(null)
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    const userData = localStorage.getItem('user')
    const token    = localStorage.getItem('token')
    if (!userData || !token) {
      router.push('/login')
      return
    }
    setUser(JSON.parse(userData))
  }, [])

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    router.push('/login')
  }

  if (!user) return null

  // Filtrar menú según rol
  const visibleMenu = menuItems.filter(item => item.roles.includes(user.role))

  const sidebarContent = (
    <div className="sidebar-inner">
      {/* Logo y toggle */}
      <div className="sidebar-header">
        <div className="sidebar-brand">
          <div className="brand-logo">
            <Image src="/logo-nnuu.jpeg" alt="Logo UE" width={36} height={36} style={{ objectFit:'contain', borderRadius:'50%' }} />
          </div>
          {!collapsed && (
            <div className="brand-info">
              <span className="brand-name">U.E. Naciones Unidas</span>
              <span className="brand-loc">El Torno · Santa Cruz</span>
            </div>
          )}
        </div>
        <button className="collapse-btn" onClick={() => setCollapsed(!collapsed)} aria-label="Colapsar menú">
          {collapsed ? <ChevronRight size={16}/> : <X size={16}/>}
        </button>
      </div>

      {/* Perfil del usuario */}
      <div className="user-profile">
        <div className="user-avatar">
          {user.email.charAt(0).toUpperCase()}
        </div>
        {!collapsed && (
          <div className="user-info">
            <span className="user-email">{user.email}</span>
            <span className="user-role-badge" style={{ ...(roleBadgeStyle[user.role] ? Object.fromEntries(roleBadgeStyle[user.role].split(';').map(s => s.split(':').map(x => x.trim()))) : {}) }}>
              {roleLabels[user.role] || user.role}
            </span>
          </div>
        )}
      </div>

      {/* Menú navegación */}
      <nav className="sidebar-nav">
        {!collapsed && <span className="nav-section-label">Menú principal</span>}
        {visibleMenu.map(item => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`nav-item ${isActive ? 'active' : ''} ${collapsed ? 'collapsed' : ''}`}
              onClick={() => setMobileOpen(false)}
              title={collapsed ? item.label : undefined}
            >
              <span className="nav-icon">{item.icon}</span>
              {!collapsed && <span className="nav-label">{item.label}</span>}
              {!collapsed && item.badge && (
                <span className="nav-badge">{item.badge}</span>
              )}
            </Link>
          )
        })}
      </nav>

      {/* Cerrar sesión */}
      <div className="sidebar-footer">
        <button className={`nav-item logout-btn ${collapsed ? 'collapsed' : ''}`} onClick={handleLogout}>
          <span className="nav-icon"><LogOut size={18}/></span>
          {!collapsed && <span className="nav-label">Cerrar sesión</span>}
        </button>
      </div>
    </div>
  )

  return (
    <div className="dashboard-root">

      {/* Overlay móvil */}
      {mobileOpen && (
        <div className="mobile-overlay" onClick={() => setMobileOpen(false)} />
      )}

      {/* Barra lateral desktop */}
      <aside className={`sidebar ${collapsed ? 'sidebar-collapsed' : ''}`}>
        {sidebarContent}
      </aside>

      {/* Barra lateral móvil */}
      <aside className={`sidebar-mobile ${mobileOpen ? 'open' : ''}`}>
        {sidebarContent}
      </aside>

      {/* Contenido principal */}
      <div className="main-wrapper">

        {/* Header */}
        <header className="main-header">
          <button className="mobile-menu-btn" onClick={() => setMobileOpen(true)} aria-label="Abrir menú">
            <Menu size={20}/>
          </button>
          <div className="header-title">
            {visibleMenu.find(i => pathname === i.href || pathname.startsWith(i.href + '/'))?.label || 'Dashboard'}
          </div>
          <div className="header-actions">
            <button className="header-icon-btn" aria-label="Notificaciones">
              <Bell size={18}/>
              <span className="notif-dot"/>
            </button>
          </div>
        </header>

        {/* Página */}
        <main className="main-content">
          {children}
        </main>
      </div>

      <style>{`
        *, *::before, *::after { margin:0; padding:0; box-sizing:border-box; }
        :root {
          --azul:    #1A3A7C;
          --celeste: #4A9FD4;
          --amarillo:#F5C518;
          --sidebar-w: 240px;
          --sidebar-collapsed: 64px;
          --header-h: 56px;
        }

        .dashboard-root {
          display: flex;
          min-height: 100vh;
          background: #F0F6FC;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        }

        /* ── SIDEBAR ── */
        .sidebar {
          width: var(--sidebar-w);
          background: var(--azul);
          display: flex;
          flex-direction: column;
          position: fixed;
          top: 0; left: 0; bottom: 0;
          z-index: 100;
          transition: width 0.2s ease;
          overflow: hidden;
        }

        .sidebar-collapsed { width: var(--sidebar-collapsed); }

        .sidebar-inner {
          display: flex;
          flex-direction: column;
          height: 100%;
          overflow: hidden;
        }

        /* Header del sidebar */
        .sidebar-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 12px;
          border-bottom: 1px solid rgba(255,255,255,0.08);
          min-height: 64px;
          gap: 8px;
        }

        .sidebar-brand {
          display: flex;
          align-items: center;
          gap: 10px;
          overflow: hidden;
        }

        .brand-logo {
          width: 36px;
          height: 36px;
          flex-shrink: 0;
          background: #fff;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
        }

        .brand-info {
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        .brand-name {
          font-size: 12px;
          font-weight: 600;
          color: #fff;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .brand-loc {
          font-size: 10px;
          color: #7BBFE8;
          white-space: nowrap;
        }

        .collapse-btn {
          background: rgba(255,255,255,0.1);
          border: none;
          color: #fff;
          width: 28px;
          height: 28px;
          border-radius: 6px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          transition: background 0.2s;
        }

        .collapse-btn:hover { background: rgba(255,255,255,0.2); }

        /* Perfil */
        .user-profile {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 14px 12px;
          border-bottom: 1px solid rgba(255,255,255,0.08);
        }

        .user-avatar {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          background: var(--amarillo);
          color: #3A2F00;
          font-size: 14px;
          font-weight: 700;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .user-info {
          display: flex;
          flex-direction: column;
          gap: 4px;
          overflow: hidden;
        }

        .user-email {
          font-size: 11px;
          color: #7BBFE8;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .user-role-badge {
          font-size: 10px;
          font-weight: 500;
          padding: 2px 7px;
          border-radius: 20px;
          width: fit-content;
        }

        /* Navegación */
        .sidebar-nav {
          flex: 1;
          padding: 12px 8px;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .sidebar-nav::-webkit-scrollbar { width: 4px; }
        .sidebar-nav::-webkit-scrollbar-track { background: transparent; }
        .sidebar-nav::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius: 4px; }

        .nav-section-label {
          font-size: 10px;
          font-weight: 600;
          color: rgba(255,255,255,0.35);
          text-transform: uppercase;
          letter-spacing: 0.8px;
          padding: 4px 8px 8px;
        }

        .nav-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 9px 10px;
          border-radius: 8px;
          color: rgba(255,255,255,0.7);
          text-decoration: none;
          font-size: 13px;
          transition: background 0.15s, color 0.15s;
          cursor: pointer;
          border: none;
          background: none;
          width: 100%;
          text-align: left;
          white-space: nowrap;
        }

        .nav-item:hover {
          background: rgba(255,255,255,0.1);
          color: #fff;
        }

        .nav-item.active {
          background: var(--celeste);
          color: #fff;
        }

        .nav-item.collapsed {
          justify-content: center;
          padding: 10px;
        }

        .nav-icon {
          display: flex;
          align-items: center;
          flex-shrink: 0;
        }

        .nav-label { flex: 1; }

        .nav-badge {
          background: var(--amarillo);
          color: #3A2F00;
          font-size: 10px;
          font-weight: 700;
          padding: 1px 6px;
          border-radius: 10px;
          min-width: 18px;
          text-align: center;
        }

        /* Footer sidebar */
        .sidebar-footer {
          padding: 8px;
          border-top: 1px solid rgba(255,255,255,0.08);
        }

        .logout-btn { color: rgba(255,255,255,0.6); }
        .logout-btn:hover { background: rgba(231,76,60,0.2) !important; color: #ff8a80 !important; }

        /* ── SIDEBAR MÓVIL ── */
        .sidebar-mobile {
          display: none;
          width: var(--sidebar-w);
          background: var(--azul);
          position: fixed;
          top: 0; left: -100%; bottom: 0;
          z-index: 200;
          transition: left 0.25s ease;
          overflow: hidden;
        }

        .sidebar-mobile.open { left: 0; }

        .mobile-overlay {
          display: none;
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.4);
          z-index: 199;
        }

        /* ── MAIN ── */
        .main-wrapper {
          flex: 1;
          margin-left: var(--sidebar-w);
          display: flex;
          flex-direction: column;
          min-height: 100vh;
          transition: margin-left 0.2s ease;
        }

        .sidebar-collapsed ~ .main-wrapper {
          margin-left: var(--sidebar-collapsed);
        }

        .main-header {
          height: var(--header-h);
          background: #fff;
          border-bottom: 1px solid #CBE0F0;
          display: flex;
          align-items: center;
          padding: 0 20px;
          gap: 12px;
          position: sticky;
          top: 0;
          z-index: 50;
        }

        .mobile-menu-btn {
          display: none;
          background: none;
          border: none;
          cursor: pointer;
          color: var(--azul);
          padding: 6px;
          border-radius: 6px;
        }

        .mobile-menu-btn:hover { background: #F0F6FC; }

        .header-title {
          flex: 1;
          font-size: 15px;
          font-weight: 600;
          color: var(--azul);
        }

        .header-actions { display: flex; align-items: center; gap: 8px; }

        .header-icon-btn {
          position: relative;
          background: none;
          border: none;
          cursor: pointer;
          color: var(--azul);
          width: 36px;
          height: 36px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background 0.2s;
        }

        .header-icon-btn:hover { background: #F0F6FC; }

        .notif-dot {
          position: absolute;
          top: 6px; right: 6px;
          width: 7px; height: 7px;
          background: var(--amarillo);
          border-radius: 50%;
          border: 1.5px solid #fff;
        }

        .main-content {
          flex: 1;
          padding: 24px;
          overflow-y: auto;
        }

        /* ── RESPONSIVE ── */
        @media (max-width: 768px) {
          .sidebar { display: none; }
          .sidebar-mobile { display: flex; flex-direction: column; }
          .mobile-overlay { display: block; }
          .main-wrapper { margin-left: 0 !important; }
          .mobile-menu-btn { display: flex; }
          .main-content { padding: 16px; }
        }
      `}</style>
    </div>
  )
}


