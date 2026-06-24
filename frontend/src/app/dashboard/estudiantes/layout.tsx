'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import {
  LayoutDashboard, Bell, LogOut, Menu, X,
  ChevronRight, BookOpen, ClipboardList, Clock,
  UserCircle, GraduationCap
} from 'lucide-react'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

interface User { id: number; email: string; role: string }

const menuItems = [
  { label: 'Mi Perfil',      href: '/dashboard/estudiantes/perfil',         icon: <UserCircle size={18}/> },
  { label: 'Inicio',         href: '/dashboard/estudiantes',                icon: <LayoutDashboard size={18}/> },
  { label: 'Mis Materias',   href: '/dashboard/estudiantes/materias',       icon: <GraduationCap size={18}/> },
  { label: 'Calificaciones', href: '/dashboard/estudiantes/calificaciones', icon: <BookOpen size={18}/> },
  { label: 'Tareas',         href: '/dashboard/estudiantes/tareas',         icon: <ClipboardList size={18}/> },
  { label: 'Horario',        href: '/dashboard/estudiantes/horario',        icon: <Clock size={18}/> },
  { label: 'Notificaciones', href: '/dashboard/estudiantes/notificaciones', icon: <Bell size={18}/> },
]

export default function EstudiantesLayout({ children }: { children: React.ReactNode }) {
  const router   = useRouter()
  const pathname = usePathname()
  const [user,        setUser]        = useState<User | null>(null)
  const [studentName, setStudentName] = useState('')
  const [courseLabel, setCourseLabel] = useState('')
  const [collapsed,   setCollapsed]   = useState(false)
  const [mobileOpen,  setMobileOpen]  = useState(false)
  const [unread,      setUnread]      = useState(0)

  const GRADE_LABEL: Record<string, string> = {
    PRIMERO:'1°', SEGUNDO:'2°', TERCERO:'3°', CUARTO:'4°', QUINTO:'5°', SEXTO:'6°',
  }

  useEffect(() => {
     // PWA manifest del estudiante
    const link = document.querySelector('link[rel="manifest"]') as HTMLLinkElement
    if (link) link.href = '/manifest-student.json'
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', '#1A7DB8')
    document.querySelector('meta[name="apple-mobile-web-app-title"]')?.setAttribute('content', 'Estudiante NNUU')

    const userData = localStorage.getItem('user')
    const token    = localStorage.getItem('token')
    if (!userData || !token) { router.push('/login'); return }
    const parsed = JSON.parse(userData)
    if (!['STUDENT', 'STUDENT_GOV', 'SUPER_ADMIN'].includes(parsed.role)) {
      router.push('/login'); return
    }
    setUser(parsed)

    fetch(`${API_URL}/api/students/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => {
        if (d.firstName) setStudentName(`${d.lastName} ${d.firstName}`)
        if (d.course) setCourseLabel(`${GRADE_LABEL[d.course.grade] || d.course.grade} "${d.course.parallel}"`)
      }).catch(() => {})

    fetch(`${API_URL}/api/students/my-notifications`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setUnread(d.filter((n: any) => !n.isRead).length) })
      .catch(() => {})
  }, [router])

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    router.push('/login')
  }

  if (!user) return null

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
              <span className="brand-name">Estudiante</span>
              <span className="brand-loc">U.E. Naciones Unidas</span>
            </div>
          )}
        </div>
        <button className="collapse-btn" onClick={() => setCollapsed(!collapsed)}>
          {collapsed ? <ChevronRight size={16}/> : <X size={16}/>}
        </button>
      </div>

      {/* Perfil */}
      <div className="user-profile">
        <div className="user-avatar">
          {studentName ? studentName[0].toUpperCase() : 'E'}
        </div>
        {!collapsed && (
          <div className="user-info">
            {studentName && <span className="user-name">{studentName}</span>}
            <span className="user-email">{user.email}</span>
            {courseLabel && <span className="user-role-badge">{courseLabel}</span>}
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="sidebar-nav">
        {!collapsed && <span className="nav-section-label">Menú</span>}
        {menuItems.map(item => {
          const isActive = pathname === item.href
          return (
            <Link key={item.href} href={item.href}
              className={`nav-item ${isActive ? 'active' : ''} ${collapsed ? 'collapsed' : ''}`}
              onClick={() => setMobileOpen(false)}
              title={collapsed ? item.label : undefined}>
              <span className="nav-icon">{item.icon}</span>
              {!collapsed && <span className="nav-label">{item.label}</span>}
              {!collapsed && item.label === 'Notificaciones' && unread > 0 && (
                <span className="notif-badge">{unread}</span>
              )}
              {collapsed && item.label === 'Notificaciones' && unread > 0 && (
                <span className="notif-dot"/>
              )}
            </Link>
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

  return (
    <div className="dashboard-root">
      {mobileOpen && <div className="mobile-overlay" onClick={() => setMobileOpen(false)}/>}

      <aside className={`sidebar ${collapsed ? 'sidebar-collapsed' : ''}`}>{sidebarContent}</aside>
      <aside className={`sidebar-mobile ${mobileOpen ? 'open' : ''}`}>{sidebarContent}</aside>

      <div className="main-wrapper">
        <header className="main-header">
          <button className="mobile-menu-btn" onClick={() => setMobileOpen(true)}><Menu size={20}/></button>
          <div className="header-title">
            {menuItems.find(i => pathname === i.href)?.icon}
            {menuItems.find(i => pathname === i.href)?.label || 'Estudiante'}
          </div>
          <div className="header-info">
            {studentName && <span className="header-name">🎓 {studentName}</span>}
            <span className="header-badge">{courseLabel || 'Estudiante'}</span>
          </div>
        </header>
        <main className="main-content">{children}</main>
      </div>

      <style>{`
        *, *::before, *::after { margin:0; padding:0; box-sizing:border-box; }
        :root { --student:#1A7DB8; --student-dark:#1565A0; --student-accent:#F5C518; --sidebar-w:240px; --sidebar-collapsed:64px; --header-h:56px; }
        .dashboard-root { display:flex; min-height:100vh; background:#F0F7FC; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; }
        .sidebar { width:var(--sidebar-w); background:var(--student); display:flex; flex-direction:column; position:fixed; top:0; left:0; bottom:0; z-index:100; transition:width 0.2s ease; overflow:hidden; box-shadow:2px 0 12px rgba(26,125,184,0.25); }
        .sidebar-collapsed { width:var(--sidebar-collapsed); }
        .sidebar-inner { display:flex; flex-direction:column; height:100%; overflow:hidden; }
        .sidebar-header { display:flex; align-items:center; justify-content:space-between; padding:16px 12px; border-bottom:1px solid rgba(255,255,255,0.12); min-height:64px; gap:8px; }
        .sidebar-brand { display:flex; align-items:center; gap:10px; overflow:hidden; }
        .brand-logo { width:36px; height:36px; flex-shrink:0; background:#fff; border-radius:50%; display:flex; align-items:center; justify-content:center; overflow:hidden; }
        .brand-info { display:flex; flex-direction:column; overflow:hidden; }
        .brand-name { font-size:12px; font-weight:700; color:#fff; white-space:nowrap; }
        .brand-loc { font-size:10px; color:rgba(255,255,255,0.65); white-space:nowrap; }
        .collapse-btn { background:rgba(255,255,255,0.15); border:none; color:#fff; width:28px; height:28px; border-radius:6px; cursor:pointer; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
        .collapse-btn:hover { background:rgba(255,255,255,0.25); }
        .user-profile { display:flex; align-items:center; gap:10px; padding:14px 12px; border-bottom:1px solid rgba(255,255,255,0.12); }
        .user-avatar { width:38px; height:38px; border-radius:50%; background:var(--student-accent); color:#1A3A7C; font-size:15px; font-weight:800; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
        .user-info { display:flex; flex-direction:column; gap:2px; overflow:hidden; }
        .user-name { font-size:12px; font-weight:700; color:#fff; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .user-email { font-size:11px; color:rgba(255,255,255,0.6); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .user-role-badge { font-size:10px; font-weight:700; padding:2px 8px; border-radius:20px; background:rgba(255,255,255,0.2); color:#fff; width:fit-content; margin-top:1px; }
        .sidebar-nav { flex:1; padding:12px 8px; overflow-y:auto; display:flex; flex-direction:column; gap:2px; }
        .nav-section-label { font-size:10px; font-weight:600; color:rgba(255,255,255,0.4); text-transform:uppercase; letter-spacing:0.8px; padding:4px 8px 8px; }
        .nav-item { display:flex; align-items:center; gap:10px; padding:9px 10px; border-radius:8px; color:rgba(255,255,255,0.75); text-decoration:none; font-size:13px; transition:background 0.15s,color 0.15s; cursor:pointer; border:none; background:none; width:100%; text-align:left; white-space:nowrap; position:relative; }
        .nav-item:hover { background:rgba(255,255,255,0.15); color:#fff; }
        .nav-item.active { background:rgba(255,255,255,0.22); color:#fff; font-weight:700; border-left:3px solid var(--student-accent); }
        .nav-item.collapsed { justify-content:center; padding:10px; }
        .nav-icon { display:flex; align-items:center; flex-shrink:0; }
        .nav-label { flex:1; }
        .notif-badge { background:var(--student-accent); color:#1A3A7C; font-size:10px; font-weight:800; padding:1px 7px; border-radius:20px; min-width:18px; text-align:center; }
        .notif-dot { position:absolute; top:8px; right:8px; width:8px; height:8px; border-radius:50%; background:var(--student-accent); }
        .sidebar-footer { padding:8px; border-top:1px solid rgba(255,255,255,0.12); }
        .logout-btn { color:rgba(255,255,255,0.6); }
        .logout-btn:hover { background:rgba(231,76,60,0.2) !important; color:#ff8a80 !important; }
        .sidebar-mobile { display:none; width:var(--sidebar-w); background:var(--student); position:fixed; top:0; left:-100%; bottom:0; z-index:200; transition:left 0.25s ease; overflow:hidden; }
        .sidebar-mobile.open { left:0; }
        .mobile-overlay { display:none; position:fixed; inset:0; background:rgba(0,0,0,0.4); z-index:199; }
        .main-wrapper { flex:1; margin-left:var(--sidebar-w); display:flex; flex-direction:column; min-height:100vh; transition:margin-left 0.2s ease; }
        .sidebar-collapsed ~ .main-wrapper { margin-left:var(--sidebar-collapsed); }
        .main-header { height:var(--header-h); background:#fff; border-bottom:1px solid #CBE0F0; display:flex; align-items:center; padding:0 20px; gap:12px; position:sticky; top:0; z-index:50; }
        .mobile-menu-btn { display:none; background:none; border:none; cursor:pointer; color:var(--student); padding:6px; border-radius:6px; }
        .mobile-menu-btn:hover { background:#E3F2FD; }
        .header-title { flex:1; font-size:15px; font-weight:600; color:var(--student); display:flex; align-items:center; gap:8px; }
        .header-info { display:flex; flex-direction:column; align-items:flex-end; gap:3px; }
        .header-name { font-size:13px; font-weight:700; color:var(--student-dark); white-space:nowrap; }
        .header-badge { background:#E3F2FD; color:var(--student); padding:3px 10px; border-radius:20px; font-size:10px; font-weight:700; white-space:nowrap; }
        .main-content { flex:1; padding:24px; overflow-y:auto; }
        @media (max-width:768px) {
          .sidebar { display:none; }
          .sidebar-mobile { display:flex; flex-direction:column; }
          .mobile-overlay { display:block; }
          .main-wrapper { margin-left:0 !important; }
          .mobile-menu-btn { display:flex; }
          .main-content { padding:16px; }
          .header-name { display:none; }
        }
      `}</style>
    </div>
  )
}