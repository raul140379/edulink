'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { Menu, X, ChevronDown, Bell, UserCircle, Settings } from 'lucide-react'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

interface User {
  id:    number
  email: string
  role:  string
}

export interface MenuItem {
  label: string
  href:  string
  icon:  React.ReactNode
  roles: string[]
}

export interface MenuGroup {
  label: string
  icon:  React.ReactNode
  items: MenuItem[]
  roles: string[]
}

export interface DashboardTheme {
  /** Fondo de la barra de marca (arriba del todo) */
  primary: string
  /** Fondo de la barra de menú (Académico, Comunicación, ...) */
  navbar: string
  /** Color de acento del ítem activo / botones */
  accent: string
  /** Color de hover sobre ítems interactivos (opcional, cae a accent si no se pasa) */
  hover?: string
  /** Fondo del área de contenido (opcional, cae al gris neutro de siempre si no se pasa) */
  bg?: string
  /** Texto secundario (opcional, cae al gris-azulado de siempre si no se pasa) */
  textSecondary?: string
  /** Bordes (opcional, cae al celeste de siempre si no se pasa) */
  border?: string
  /** Fondos suaves de tarjeta/fila (opcional, cae al celeste claro de siempre si no se pasa) */
  bgSoft?: string
}

interface DashboardShellProps {
  allowedRoles:     string[]
  brandName:        string
  brandLoc:         string
  logoSrc?:         string
  homeHref:         string
  profileHref:      string
  notificationsHref?: string
  menuGroups:       MenuGroup[]
  theme:            DashboardTheme
  children:         React.ReactNode
}

function extractDisplayName(me: any, fallbackEmail: string): string {
  const profile = me?.parent || me?.teacher || me?.teacherTutor || me?.student || me?.staff
  if (profile?.firstName) return profile.firstName.split(' ')[0]
  return fallbackEmail.split('@')[0]
}

export default function DashboardShell({
  allowedRoles, brandName, brandLoc, logoSrc, homeHref, profileHref, notificationsHref, menuGroups, theme, children,
}: DashboardShellProps) {
  const router   = useRouter()
  const pathname = usePathname()
  const [user,        setUser]        = useState<User | null>(null)
  const [displayName, setDisplayName] = useState<string>('')
  const [openGroup,   setOpenGroup]   = useState<string | null>(null)
  const [mobileOpen,  setMobileOpen]  = useState(false)
  const navRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const userData = localStorage.getItem('user')
    const token    = localStorage.getItem('token')
    if (!userData || !token) { router.push('/login'); return }

    const parsed = JSON.parse(userData)
    if (!allowedRoles.includes(parsed.role)) { router.push('/login'); return }

    setUser(parsed)
    setDisplayName(parsed.email.split('@')[0])

    fetch(`${API_URL}/api/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then(res => res.ok ? res.json() : null)
      .then(me => { if (me) setDisplayName(extractDisplayName(me, parsed.email)) })
      .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Cerrar desplegables al cambiar de ruta
  useEffect(() => {
    setOpenGroup(null)
    setMobileOpen(false)
  }, [pathname])

  // Cerrar al hacer clic afuera / con Escape
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) setOpenGroup(null)
    }
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpenGroup(null) }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onEsc)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onEsc)
    }
  }, [])

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    router.push('/login')
  }

  if (!user) return null

  const visibleGroups = menuGroups
    .map(g => ({ ...g, items: g.items.filter(i => i.roles.includes(user.role)) }))
    .filter(g => g.items.length > 0 && g.roles.includes(user.role))

  const allMenuItems = visibleGroups.flatMap(g => g.items)
  const activeItem = allMenuItems.find(i => pathname === i.href)
    ?? allMenuItems
      .filter(i => pathname.startsWith(i.href + '/'))
      .sort((a, b) => b.href.length - a.href.length)[0]

  return (
    <div
      className="dashboard-root"
      style={{
        '--dsh-primary': theme.primary,
        '--dsh-navbar': theme.navbar,
        '--dsh-accent': theme.accent,
        '--dsh-hover': theme.hover || theme.accent,
        '--dsh-bg': theme.bg || '#F5F7F8',
        // Igual truco que --color-brand-700 más abajo: si no se pasan, la
        // propiedad queda ausente del inline style y el elemento hereda el
        // --color-neutral-500/300/100 fijo de :root (el gris-azulado de
        // siempre) — sin esto, un var() a mitad de cascada no se re-resuelve
        // por panel, hay que re-declarar el token final en el mismo nodo.
        ...(theme.textSecondary ? { '--color-neutral-500': theme.textSecondary } : {}),
        ...(theme.border        ? { '--color-neutral-300': theme.border }        : {}),
        ...(theme.bgSoft        ? { '--color-neutral-100': theme.bgSoft }        : {}),
        // Re-declarar los tokens de marca de Tailwind (components/ui/*) en el
        // MISMO nodo donde cambian los --dsh-*: un var() anidado solo se
        // resuelve una vez, en el elemento donde el custom property final se
        // DECLARA (aquí :root en globals.css) — no se re-evalúa por cada
        // descendiente. Sin esto, Button/Card/Badge quedarían siempre con el
        // navy del admin sin importar el panel.
        '--color-brand-700': theme.primary,
        '--color-brand-600': theme.accent,
        '--color-brand-500': theme.hover || theme.accent,
        '--color-brand-100': `color-mix(in srgb, ${theme.primary} 10%, white)`,
      } as React.CSSProperties}
    >
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

        <button className="mobile-menu-btn" onClick={() => setMobileOpen(v => !v)}>
          {mobileOpen ? <X size={20}/> : <Menu size={20}/>}
        </button>

        <div className="topbar-actions">
          {notificationsHref && (
            <Link href={notificationsHref} className="action-pill" title="Notificaciones">
              <Bell size={17}/>
              <span className="notif-dot"/>
            </Link>
          )}
          <Link href={profileHref} className="action-pill" title="Mi perfil">
            <UserCircle size={17}/>
            <span className="action-label">{displayName}</span>
          </Link>
          <button className="action-pill logout" onClick={handleLogout} title="Cerrar sesión">
            <Settings size={17}/>
            <span className="action-label">Salir</span>
          </button>
        </div>
      </header>

      <nav className={`navbar ${mobileOpen ? 'mobile-open' : ''}`} ref={navRef}>
        {visibleGroups.map(group => {
          const isDirectLink = group.items.length === 1
          const hasActive = group.items.some(i => i.href === activeItem?.href)

          if (isDirectLink) {
            const item = group.items[0]
            return (
              <Link key={group.label} href={item.href} className={`nav-top-item ${hasActive ? 'active' : ''}`}>
                {group.icon} {group.label}
              </Link>
            )
          }

          return (
            <div key={group.label} className="nav-dropdown-wrap">
              <button
                className={`nav-top-item ${hasActive ? 'active' : ''}`}
                onClick={() => setOpenGroup(v => v === group.label ? null : group.label)}
              >
                {group.icon} {group.label} <ChevronDown size={13} className={openGroup === group.label ? 'chev-open' : ''}/>
              </button>
              {openGroup === group.label && (
                <div className="nav-dropdown">
                  {group.items.map(item => {
                    const isActive = item.href === activeItem?.href
                    return (
                      <Link key={item.href} href={item.href} className={`dropdown-item ${isActive ? 'active' : ''}`}>
                        {item.icon} {item.label}
                      </Link>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </nav>

      {activeItem && (
        <div className="breadcrumb">
          <Link href={homeHref}>Inicio</Link>
          <span className="crumb-sep">/</span>
          <span className="crumb-current">{activeItem.label}</span>
        </div>
      )}

      <main className="main-content">{children}</main>

      <footer className="dsh-footer">
        © {new Date().getFullYear()} {brandName} · EduLink
      </footer>

      <style>{`
        *,*::before,*::after{box-sizing:border-box}
        .dashboard-root{min-height:100vh;display:flex;flex-direction:column;background:var(--dsh-bg);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}
        .topbar{height:60px;background:var(--dsh-primary);display:flex;align-items:center;justify-content:space-between;padding:0 20px;position:sticky;top:0;z-index:200}
        .topbar-brand{display:flex;align-items:center;gap:10px}
        .brand-logo{width:32px;height:32px;flex-shrink:0;background:#fff;border-radius:50%;display:flex;align-items:center;justify-content:center;overflow:hidden}
        .brand-info{display:flex;flex-direction:column;line-height:1.2}
        .brand-name{font-size:13px;font-weight:700;color:#fff}
        .brand-loc{font-size:10.5px;color:rgba(255,255,255,.65)}
        .mobile-menu-btn{display:none;background:none;border:none;color:#fff;cursor:pointer;padding:6px}
        .topbar-actions{display:flex;align-items:center;gap:6px}
        .action-pill{position:relative;display:flex;align-items:center;gap:6px;height:34px;padding:0 10px;border-radius:8px;color:#fff;background:rgba(255,255,255,.1);text-decoration:none;border:none;cursor:pointer;font-size:12.5px;font-weight:600;transition:background .15s}
        .action-pill:hover{background:var(--dsh-hover)}
        .action-pill.logout:hover{background:rgba(231,76,60,.6)}
        .action-label{white-space:nowrap}
        .notif-dot{position:absolute;top:5px;right:6px;width:6px;height:6px;background:#F5C518;border-radius:50%;border:1.5px solid var(--dsh-primary)}
        .navbar{background:var(--dsh-navbar);display:flex;flex-wrap:wrap;align-items:stretch;padding:0 16px;position:sticky;top:60px;z-index:150}
        .nav-top-item{display:flex;align-items:center;gap:6px;padding:11px 14px;font-size:13.5px;font-weight:600;color:rgba(255,255,255,.78);background:none;border:none;cursor:pointer;text-decoration:none;white-space:nowrap;border-bottom:2.5px solid transparent;transition:background .15s,color .15s}
        .nav-top-item:hover{color:#fff;background:var(--dsh-hover)}
        .nav-top-item.active{color:#fff;background:rgba(255,255,255,.14);border-bottom-color:var(--dsh-accent)}
        .chev-open{transform:rotate(180deg);transition:transform .15s}
        .nav-dropdown-wrap{position:relative}
        .nav-dropdown{position:absolute;top:100%;left:0;background:#fff;border-radius:0 0 10px 10px;box-shadow:0 12px 28px -10px rgba(0,0,0,.28);min-width:230px;padding:6px;z-index:160}
        .dropdown-item{display:flex;align-items:center;gap:9px;padding:9px 12px;font-size:13px;color:#333;text-decoration:none;background:none;border:none;width:100%;text-align:left;cursor:pointer;border-radius:6px;transition:background .15s,color .15s}
        .dropdown-item:hover{background:var(--dsh-hover);color:#fff}
        .dropdown-item.active{color:var(--dsh-primary);font-weight:600;background:#EEF2F8}
        .breadcrumb{display:flex;align-items:center;gap:8px;padding:12px 24px 0;font-size:12.5px;color:#8B959C}
        .breadcrumb a{color:#8B959C;text-decoration:none}
        .breadcrumb a:hover{color:var(--dsh-primary)}
        .crumb-sep{opacity:.6}
        .crumb-current{color:var(--dsh-primary);font-weight:600}
        .main-content{flex:1;padding:20px 24px}
        .dsh-footer{padding:14px 24px;text-align:center;font-size:11.5px;color:#9AA6AC;border-top:1px solid #E1E7EA;background:#fff}
        @media(max-width:860px){
          .mobile-menu-btn{display:flex}
          .action-label{display:none}
          .navbar{display:none;flex-direction:column;position:static}
          .navbar.mobile-open{display:flex}
          .nav-top-item{border-bottom:1px solid rgba(255,255,255,.1);border-radius:0}
          .nav-dropdown-wrap{width:100%}
          .nav-dropdown{position:static;box-shadow:none;border-radius:0;background:rgba(0,0,0,.15)}
          .dropdown-item{color:#fff}
          .dropdown-item:hover{background:rgba(255,255,255,.1)}
          .breadcrumb{padding:12px 16px 0}
          .main-content{padding:16px}
        }
      `}</style>
    </div>
  )
}
