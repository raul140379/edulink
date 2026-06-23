'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import {
  LayoutDashboard, Users, GraduationCap, BookOpen,
  ClipboardList, Clock, DollarSign, Bell, FileBarChart,
  Settings, LogOut, Menu, X, ShieldCheck, ChevronRight,
  Calendar, UserCircle, ChevronDown, ChevronUp, ClipboardCheck
} from 'lucide-react'

interface User {
  id:          number
  email:       string
  role:        string
  permissions: string[]
}

interface MenuItem {
  label: string
  href:  string
  icon:  React.ReactNode
  roles: string[]
}

interface MenuGroup {
  label:  string
  icon:   React.ReactNode
  items:  MenuItem[]
  roles:  string[]
}

const menuGroups: MenuGroup[] = [
  {
    label: 'General',
    icon:  <LayoutDashboard size={14}/>,
    roles: ['SUPER_ADMIN','DIRECTOR','REGENTE','SECRETARY'],
    items: [
      { label: 'Inicio',           href: '/dashboard/admin',            icon: <LayoutDashboard size={16}/>, roles: ['SUPER_ADMIN','DIRECTOR','REGENTE','SECRETARY'] },
      { label: 'Mi Perfil',        href: '/dashboard/admin/perfil',     icon: <UserCircle size={16}/>,      roles: ['SUPER_ADMIN','DIRECTOR','REGENTE','SECRETARY'] },
      { label: 'Gestión Académica',href: '/dashboard/admin/gestion',    icon: <Calendar size={16}/>,        roles: ['SUPER_ADMIN','DIRECTOR','SECRETARY'] },
      { label: 'Usuarios',         href: '/dashboard/admin/usuarios',   icon: <Users size={16}/>,           roles: ['SUPER_ADMIN','DIRECTOR','SECRETARY'] },
    ]
  },
  {
    label: 'Académico',
    icon:  <BookOpen size={14}/>,
    roles: ['SUPER_ADMIN','DIRECTOR','REGENTE','SECRETARY'],
    items: [
      { label: 'Cursos',        href: '/dashboard/admin/cursos',        icon: <BookOpen size={16}/>,    roles: ['SUPER_ADMIN','DIRECTOR','REGENTE','SECRETARY'] },
      { label: 'Materias',      href: '/dashboard/admin/materias',      icon: <BookOpen size={16}/>,    roles: ['SUPER_ADMIN','DIRECTOR','SECRETARY'] },
      { label: 'Inscripciones', href: '/dashboard/admin/inscripciones', icon: <ClipboardList size={16}/>, roles: ['SUPER_ADMIN','DIRECTOR','SECRETARY'] },
      { label: 'Notas',         href: '/dashboard/admin/notas',         icon: <ClipboardList size={16}/>, roles: ['SUPER_ADMIN','DIRECTOR','REGENTE','SECRETARY'] },
      { label: 'Horarios',      href: '/dashboard/admin/horarios',      icon: <Clock size={16}/>,       roles: ['SUPER_ADMIN','DIRECTOR','REGENTE','SECRETARY'] },
    ]
  },
  {
    label: 'Personal',
    icon:  <Users size={14}/>,
    roles: ['SUPER_ADMIN','DIRECTOR','REGENTE','SECRETARY'],
    items: [
      { label: 'Estudiantes',     href: '/dashboard/admin/estudiantes', icon: <GraduationCap size={16}/>, roles: ['SUPER_ADMIN','DIRECTOR','REGENTE','SECRETARY'] },
      { label: 'Padres / Tutores',href: '/dashboard/admin/padres',      icon: <Users size={16}/>,         roles: ['SUPER_ADMIN','DIRECTOR','REGENTE','SECRETARY'] },
      { label: 'Maestros',        href: '/dashboard/admin/maestros',    icon: <GraduationCap size={16}/>, roles: ['SUPER_ADMIN','DIRECTOR','SECRETARY'] },
      { label: 'Asistencia', href: '/dashboard/admin/asistencia', icon: <ClipboardCheck size={16}/>, roles: ['SUPER_ADMIN','DIRECTOR','SECRETARY'] },
      { label: 'Portero', href: '/dashboard/admin/portero', icon: <ShieldCheck size={16}/>, roles: ['SUPER_ADMIN','DIRECTOR'] },
      
    ]
  },
  {
    label: 'Económico',
    icon:  <DollarSign size={14}/>,
    roles: ['SUPER_ADMIN','DIRECTOR','SECRETARY'],
    items: [
      { label: 'Tesorería', href: '/dashboard/admin/tesoreria', icon: <DollarSign size={16}/>,  roles: ['SUPER_ADMIN','DIRECTOR','SECRETARY'] },
      { label: 'Reportes',  href: '/dashboard/admin/reportes',  icon: <FileBarChart size={16}/>, roles: ['SUPER_ADMIN','DIRECTOR','SECRETARY'] },
    ]
  },
  {
    label: 'Comunicación',
    icon:  <Bell size={14}/>,
    roles: ['SUPER_ADMIN','DIRECTOR','REGENTE','SECRETARY'],
    items: [
      { label: 'Notificaciones', href: '/dashboard/admin/notificaciones', icon: <Bell size={16}/>, roles: ['SUPER_ADMIN','DIRECTOR','REGENTE','SECRETARY'] },
    ]
  },
  {
    label: 'Sistema',
    icon:  <Settings size={14}/>,
    roles: ['SUPER_ADMIN'],
    items: [
    { label: 'Configuración',  href: '/dashboard/admin/configuracion',  icon: <Settings size={16}/>,    roles: ['SUPER_ADMIN'] },
   { label: 'Gestionar Porteros', href: '/dashboard/admin/portero',         icon: <ShieldCheck size={16}/>, roles: ['SUPER_ADMIN','DIRECTOR'] },
{ label: 'Vista Portero',      href: '/dashboard/portero',               icon: <ShieldCheck size={16}/>, roles: ['SUPER_ADMIN'] },
    { label: 'Reporte Accesos', href: '/dashboard/admin/portero/reporte', icon: <FileBarChart size={16}/>, roles: ['SUPER_ADMIN','DIRECTOR'] },
  ]
  },
]

const roleLabels: Record<string, string> = {
  SUPER_ADMIN: 'Super Administrador', DIRECTOR: 'Director',
  JUNTA_ESCOLAR: 'Junta Escolar', REGENTE: 'Regente',
  SECRETARY: 'Secretaria', TEACHER: 'Maestro',
  DELEGATE: 'Delegado', PARENT: 'Padre / Tutor',
  STUDENT: 'Estudiante', STUDENT_GOV: 'Gobierno Estudiantil', STAFF: 'Personal',
}

const roleBadgeColors: Record<string, { bg: string; color: string }> = {
  SUPER_ADMIN:   { bg: '#1A3A7C', color: '#fff' },
  DIRECTOR:      { bg: '#0F6E56', color: '#fff' },
  JUNTA_ESCOLAR: { bg: '#712B13', color: '#fff' },
  REGENTE:       { bg: '#3C3489', color: '#fff' },
  SECRETARY:     { bg: '#712B13', color: '#fff' },
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router   = useRouter()
  const pathname = usePathname()
  const [user,        setUser]        = useState<User | null>(null)
  const [collapsed,   setCollapsed]   = useState(false)
  const [mobileOpen,  setMobileOpen]  = useState(false)
  const [openGroups,  setOpenGroups]  = useState<Record<string, boolean>>({
    General: false, Académico: false, Personal: false,
    Económico: false, Comunicación: false, Sistema: false,
  })

  useEffect(() => {
    const userData = localStorage.getItem('user')
    const token    = localStorage.getItem('token')
    if (!userData || !token) { router.push('/login'); return }
    setUser(JSON.parse(userData))
  }, [])

  // Auto-abrir el grupo que contiene la ruta activa
 useEffect(() => {
  const newState: Record<string, boolean> = {
    General: false, Académico: false, Personal: false,
    Económico: false, Comunicación: false, Sistema: false,
  }
  menuGroups.forEach(g => {
    const hasActive = g.items.some(i => pathname === i.href || 
      (i.href !== '/dashboard/admin' && pathname.startsWith(i.href + '/')))
    if (hasActive) newState[g.label] = true
  })
  setOpenGroups(newState)
}, [pathname])

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    router.push('/login')
  }

  const toggleGroup = (label: string) => {
    if (collapsed) return
    setOpenGroups(prev => ({ ...prev, [label]: !prev[label] }))
  }

  if (!user) return null

  const badgeStyle = roleBadgeColors[user.role] || { bg: '#444', color: '#fff' }

  const sidebarContent = (
    <div className="sidebar-inner">
      {/* Header */}
      <div className="sidebar-header">
        <div className="sidebar-brand">
          <div className="brand-logo">
            <Image src="/logo-nnuu.jpeg" alt="Logo UE" width={36} height={36}
              style={{ objectFit:'contain', borderRadius:'50%' }}/>
          </div>
          {!collapsed && (
            <div className="brand-info">
              <span className="brand-name">U.E. Naciones Unidas</span>
              <span className="brand-loc">El Torno · Santa Cruz</span>
            </div>
          )}
        </div>
        <button className="collapse-btn" onClick={() => setCollapsed(!collapsed)}>
          {collapsed ? <ChevronRight size={16}/> : <X size={16}/>}
        </button>
      </div>

      {/* Perfil */}
      <div className="user-profile">
        <div className="user-avatar">{user.email.charAt(0).toUpperCase()}</div>
        {!collapsed && (
          <div className="user-info">
            <span className="user-email">{user.email}</span>
            <span className="user-role-badge"
              style={{ background: badgeStyle.bg, color: badgeStyle.color }}>
              {roleLabels[user.role] || user.role}
            </span>
          </div>
        )}
      </div>

      {/* Menú agrupado */}
      <nav className="sidebar-nav">
        {menuGroups.map(group => {
          // Filtrar por rol
          const visibleItems = group.items.filter(i => i.roles.includes(user.role))
          if (visibleItems.length === 0) return null
          if (!group.roles.includes(user.role)) return null

          const isOpen     = openGroups[group.label]
          const hasActive  = visibleItems.some(i => pathname === i.href || pathname.startsWith(i.href + '/'))

          return (
            <div key={group.label} className="menu-group">
              {/* Cabecera del grupo */}
              {!collapsed ? (
                <button
                  className={`group-header ${hasActive ? 'has-active' : ''}`}
                  onClick={() => toggleGroup(group.label)}
                >
                  <span className="group-icon">{group.icon}</span>
                  <span className="group-label">{group.label}</span>
                  <span className="group-chevron">
                    {isOpen ? <ChevronUp size={12}/> : <ChevronDown size={12}/>}
                  </span>
                </button>
              ) : (
                <div className="group-divider" title={group.label}/>
              )}

              {/* Items del grupo */}
              {(isOpen || collapsed) && (
                <div className="group-items">
                  {visibleItems.map(item => {
                    const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
                    return (
                      <Link key={item.href} href={item.href}
                        className={`nav-item ${isActive ? 'active' : ''} ${collapsed ? 'collapsed' : ''}`}
                        onClick={() => setMobileOpen(false)}
                        title={collapsed ? item.label : undefined}>
                        <span className="nav-icon">{item.icon}</span>
                        {!collapsed && <span className="nav-label">{item.label}</span>}
                      </Link>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="sidebar-footer">
        <button className={`nav-item logout-btn ${collapsed ? 'collapsed' : ''}`} onClick={handleLogout}>
          <span className="nav-icon"><LogOut size={18}/></span>
          {!collapsed && <span className="nav-label">Cerrar sesión</span>}
        </button>
      </div>
    </div>
  )

  // Título activo para el header
  const activeLabel = menuGroups
    .flatMap(g => g.items)
    .find(i => pathname === i.href || pathname.startsWith(i.href + '/'))?.label || 'Dashboard'

  return (
    <div className="dashboard-root">
      {mobileOpen && <div className="mobile-overlay" onClick={() => setMobileOpen(false)}/>}

      <aside className={`sidebar ${collapsed ? 'sidebar-collapsed' : ''}`}>{sidebarContent}</aside>
      <aside className={`sidebar-mobile ${mobileOpen ? 'open' : ''}`}>{sidebarContent}</aside>

      <div className="main-wrapper">
        <header className="main-header">
          <button className="mobile-menu-btn" onClick={() => setMobileOpen(true)}><Menu size={20}/></button>
          <div className="header-title">{activeLabel}</div>
          <div className="header-actions">
            <button className="header-icon-btn">
              <Bell size={18}/>
              <span className="notif-dot"/>
            </button>
          </div>
        </header>
        <main className="main-content">{children}</main>
      </div>

      <style>{`
        *,*::before,*::after{margin:0;padding:0;box-sizing:border-box}
        :root{--azul:#1A3A7C;--celeste:#4A9FD4;--amarillo:#F5C518;--sidebar-w:240px;--sidebar-collapsed:64px;--header-h:56px}
        .dashboard-root{display:flex;min-height:100vh;background:#F0F6FC;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}
        .sidebar{width:var(--sidebar-w);background:var(--azul);display:flex;flex-direction:column;position:fixed;top:0;left:0;bottom:0;z-index:100;transition:width 0.2s ease;overflow:hidden}
        .sidebar-collapsed{width:var(--sidebar-collapsed)}
        .sidebar-inner{display:flex;flex-direction:column;height:100%;overflow:hidden}
        .sidebar-header{display:flex;align-items:center;justify-content:space-between;padding:16px 12px;border-bottom:1px solid rgba(255,255,255,0.08);min-height:64px;gap:8px}
        .sidebar-brand{display:flex;align-items:center;gap:10px;overflow:hidden}
        .brand-logo{width:36px;height:36px;flex-shrink:0;background:#fff;border-radius:50%;display:flex;align-items:center;justify-content:center;overflow:hidden}
        .brand-info{display:flex;flex-direction:column;overflow:hidden}
        .brand-name{font-size:12px;font-weight:600;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .brand-loc{font-size:10px;color:#7BBFE8;white-space:nowrap}
        .collapse-btn{background:rgba(255,255,255,0.1);border:none;color:#fff;width:28px;height:28px;border-radius:6px;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0}
        .collapse-btn:hover{background:rgba(255,255,255,0.2)}
        .user-profile{display:flex;align-items:center;gap:10px;padding:14px 12px;border-bottom:1px solid rgba(255,255,255,0.08)}
        .user-avatar{width:36px;height:36px;border-radius:50%;background:var(--amarillo);color:#3A2F00;font-size:14px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0}
        .user-info{display:flex;flex-direction:column;gap:4px;overflow:hidden}
        .user-email{font-size:11px;color:#7BBFE8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .user-role-badge{font-size:10px;font-weight:500;padding:2px 7px;border-radius:20px;width:fit-content}
        .sidebar-nav{flex:1;padding:8px;overflow-y:auto;display:flex;flex-direction:column;gap:2px}
        .sidebar-nav::-webkit-scrollbar{width:4px}
        .sidebar-nav::-webkit-scrollbar-track{background:transparent}
        .sidebar-nav::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.15);border-radius:4px}
        .menu-group{display:flex;flex-direction:column;gap:1px}
        .group-header{display:flex;align-items:center;gap:8px;padding:7px 10px;background:none;border:none;color:rgba(255,255,255,0.45);cursor:pointer;width:100%;text-align:left;border-radius:6px;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.6px;transition:all .15s;margin-top:4px}
        .group-header:hover{background:rgba(255,255,255,0.05);color:rgba(255,255,255,0.7)}
        .group-header.has-active{color:rgba(255,255,255,0.7)}
        .group-icon{display:flex;align-items:center;flex-shrink:0}
        .group-label{flex:1}
        .group-chevron{display:flex;align-items:center;opacity:.6}
        .group-divider{height:1px;background:rgba(255,255,255,0.08);margin:6px 8px}
        .group-items{display:flex;flex-direction:column;gap:1px;background:rgba(0,0,0,0.2);border-radius:8px;padding:4px;margin:0 0 4px 0}
        .nav-item{display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:7px;color:rgba(255,255,255,0.65);text-decoration:none;font-size:13px;transition:background .15s,color .15s;cursor:pointer;border:none;background:none;width:100%;text-align:left;white-space:nowrap}
        .nav-item:hover{background:rgba(255,255,255,0.1);color:#fff}
        .nav-item.active{background:var(--celeste);color:#fff;font-weight:600}
        .nav-item.collapsed{justify-content:center;padding:10px}
        .nav-icon{display:flex;align-items:center;flex-shrink:0}
        .nav-label{flex:1}
        .sidebar-footer{padding:8px;border-top:1px solid rgba(255,255,255,0.08);flex-shrink:0}
        .logout-btn{color:rgba(255,255,255,0.6)}
        .logout-btn:hover{background:rgba(231,76,60,0.2)!important;color:#ff8a80!important}
        .sidebar-mobile{display:none;width:var(--sidebar-w);background:var(--azul);position:fixed;top:0;left:-100%;bottom:0;z-index:200;transition:left .25s ease;overflow:hidden}
        .sidebar-mobile.open{left:0}
        .mobile-overlay{display:none;position:fixed;inset:0;background:rgba(0,0,0,0.4);z-index:199}
        .main-wrapper{flex:1;margin-left:var(--sidebar-w);display:flex;flex-direction:column;min-height:100vh;transition:margin-left .2s ease}
        .sidebar-collapsed~.main-wrapper{margin-left:var(--sidebar-collapsed)}
        .main-header{height:var(--header-h);background:#fff;border-bottom:1px solid #CBE0F0;display:flex;align-items:center;padding:0 20px;gap:12px;position:sticky;top:0;z-index:50}
        .mobile-menu-btn{display:none;background:none;border:none;cursor:pointer;color:var(--azul);padding:6px;border-radius:6px}
        .mobile-menu-btn:hover{background:#F0F6FC}
        .header-title{flex:1;font-size:15px;font-weight:600;color:var(--azul)}
        .header-actions{display:flex;align-items:center;gap:8px}
        .header-icon-btn{position:relative;background:none;border:none;cursor:pointer;color:var(--azul);width:36px;height:36px;border-radius:8px;display:flex;align-items:center;justify-content:center}
        .header-icon-btn:hover{background:#F0F6FC}
        .notif-dot{position:absolute;top:6px;right:6px;width:7px;height:7px;background:var(--amarillo);border-radius:50%;border:1.5px solid #fff}
        .main-content{flex:1;padding:24px;overflow-y:auto}
        @media(max-width:768px){.sidebar{display:none}.sidebar-mobile{display:flex;flex-direction:column}.mobile-overlay{display:block}.main-wrapper{margin-left:0!important}.mobile-menu-btn{display:flex}.main-content{padding:16px}}
      `}</style>
    </div>
  )
}