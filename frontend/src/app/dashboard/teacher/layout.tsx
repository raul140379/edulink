'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import {
  LayoutDashboard, Bell,
  LogOut, Menu, X, ChevronRight, BookOpen, Users, Clock, UserCircle, FileText
} from 'lucide-react'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

interface User {
  id:    number
  email: string
  role:  string
}
const menuItems = [
  { label: 'Mi Perfil',       href: '/dashboard/teacher/perfil',         icon: <UserCircle size={18}/> },
  { label: 'Mi Curso',        href: '/dashboard/teacher',                 icon: <LayoutDashboard size={18}/> },
  { label: 'Carga Horaria',   href: '/dashboard/teacher/workload',        icon: <Clock size={18}/> },
  { label: 'Mis Notas',       href: '/dashboard/teacher/notas',           icon: <BookOpen size={18}/> },
  { label: 'Tareas y Exámenes', href: '/dashboard/teacher/tareas',        icon: <FileText size={18}/> },
  { label: 'Reuniones',       href: '/dashboard/teacher/reuniones',       icon: <Users size={18}/> },
  { label: 'Notificaciones',  href: '/dashboard/teacher/notificaciones',  icon: <Bell size={18}/> },
]

export default function TeacherLayout({ children }: { children: React.ReactNode }) {
  const router   = useRouter()
  const pathname = usePathname()
  const [user,       setUser]       = useState<User | null>(null)
  const [teacherName,setTeacherName]= useState('')
  const [collapsed,  setCollapsed]  = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    const userData = localStorage.getItem('user')
    const token    = localStorage.getItem('token')
    if (!userData || !token) { router.push('/login'); return }
    const parsed = JSON.parse(userData)
    if (parsed.role !== 'TEACHER' && parsed.role !== 'SUPER_ADMIN') {
      router.push('/login'); return
    }
    setUser(parsed)

    // Obtener nombre del maestro
    fetch(`${API_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(data => {
        const t = data.teacher
        if (t) setTeacherName(`${t.lastName} ${t.firstName}`)
      })
      .catch(() => {})
  }, [])

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    router.push('/login')
  }

  if (!user) return null

  const sidebarContent = (
    <div className="sidebar-inner">
      <div className="sidebar-header">
        <div className="sidebar-brand">
          <div className="brand-logo">
            <Image src="/logo-nnuu.jpeg" alt="Logo UE" width={36} height={36}
              style={{ objectFit:'contain', borderRadius:'50%' }}/>
          </div>
          {!collapsed && (
            <div className="brand-info">
              <span className="brand-name">Maestro</span>
              <span className="brand-loc">U.E. Naciones Unidas</span>
            </div>
          )}
        </div>
        <button className="collapse-btn" onClick={() => setCollapsed(!collapsed)}>
          {collapsed ? <ChevronRight size={16}/> : <X size={16}/>}
        </button>
      </div>

      <div className="user-profile">
        <div className="user-avatar">{user.email.charAt(0).toUpperCase()}</div>
        {!collapsed && (
          <div className="user-info">
            {teacherName && <span className="user-name">{teacherName}</span>}
            <span className="user-email">{user.email}</span>
            <span className="user-role-badge">Maestro</span>
          </div>
        )}
      </div>

      <nav className="sidebar-nav">
        {!collapsed && <span className="nav-section-label">Menú</span>}
        {menuItems.map(item => {
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
      </nav>

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
            <BookOpen size={16} color="#633806"/>
            {menuItems.find(i => pathname === i.href || pathname.startsWith(i.href + '/'))?.label || 'Mi Curso'}
          </div>
          <div className="header-info">
            {teacherName && <span className="header-name">👨‍🏫 {teacherName}</span>}
            <span className="header-badge">Maestro</span>
          </div>
        </header>
        <main className="main-content">{children}</main>
      </div>

      <style>{`
        *, *::before, *::after { margin:0; padding:0; box-sizing:border-box; }
        :root { --teacher:#633806; --amarillo:#F5C518; --sidebar-w:240px; --sidebar-collapsed:64px; --header-h:56px; }
        .dashboard-root { display:flex; min-height:100vh; background:#F0F6FC; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; }
        .sidebar { width:var(--sidebar-w); background:var(--teacher); display:flex; flex-direction:column; position:fixed; top:0; left:0; bottom:0; z-index:100; transition:width 0.2s ease; overflow:hidden; }
        .sidebar-collapsed { width:var(--sidebar-collapsed); }
        .sidebar-inner { display:flex; flex-direction:column; height:100%; overflow:hidden; }
        .sidebar-header { display:flex; align-items:center; justify-content:space-between; padding:16px 12px; border-bottom:1px solid rgba(255,255,255,0.08); min-height:64px; gap:8px; }
        .sidebar-brand { display:flex; align-items:center; gap:10px; overflow:hidden; }
        .brand-logo { width:36px; height:36px; flex-shrink:0; background:#fff; border-radius:50%; display:flex; align-items:center; justify-content:center; overflow:hidden; }
        .brand-info { display:flex; flex-direction:column; overflow:hidden; }
        .brand-name { font-size:12px; font-weight:600; color:#fff; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .brand-loc { font-size:10px; color:rgba(255,255,255,0.6); white-space:nowrap; }
        .collapse-btn { background:rgba(255,255,255,0.1); border:none; color:#fff; width:28px; height:28px; border-radius:6px; cursor:pointer; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
        .collapse-btn:hover { background:rgba(255,255,255,0.2); }
        .user-profile { display:flex; align-items:center; gap:10px; padding:14px 12px; border-bottom:1px solid rgba(255,255,255,0.08); }
        .user-avatar { width:36px; height:36px; border-radius:50%; background:var(--amarillo); color:#3A2F00; font-size:14px; font-weight:700; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
        .user-info { display:flex; flex-direction:column; gap:3px; overflow:hidden; }
        .user-name { font-size:12px; font-weight:700; color:#fff; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .user-email { font-size:11px; color:rgba(255,255,255,0.6); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .user-role-badge { font-size:10px; font-weight:600; padding:2px 7px; border-radius:20px; background:var(--amarillo); color:#3A2F00; width:fit-content; }
        .sidebar-nav { flex:1; padding:12px 8px; overflow-y:auto; display:flex; flex-direction:column; gap:2px; }
        .nav-section-label { font-size:10px; font-weight:600; color:rgba(255,255,255,0.35); text-transform:uppercase; letter-spacing:0.8px; padding:4px 8px 8px; }
        .nav-item { display:flex; align-items:center; gap:10px; padding:9px 10px; border-radius:8px; color:rgba(255,255,255,0.7); text-decoration:none; font-size:13px; transition:background 0.15s,color 0.15s; cursor:pointer; border:none; background:none; width:100%; text-align:left; white-space:nowrap; }
        .nav-item:hover { background:rgba(255,255,255,0.1); color:#fff; }
        .nav-item.active { background:rgba(255,255,255,0.2); color:#fff; font-weight:600; }
        .nav-item.collapsed { justify-content:center; padding:10px; }
        .nav-icon { display:flex; align-items:center; flex-shrink:0; }
        .nav-label { flex:1; }
        .sidebar-footer { padding:8px; border-top:1px solid rgba(255,255,255,0.08); }
        .logout-btn { color:rgba(255,255,255,0.6); }
        .logout-btn:hover { background:rgba(231,76,60,0.2) !important; color:#ff8a80 !important; }
        .sidebar-mobile { display:none; width:var(--sidebar-w); background:var(--teacher); position:fixed; top:0; left:-100%; bottom:0; z-index:200; transition:left 0.25s ease; overflow:hidden; }
        .sidebar-mobile.open { left:0; }
        .mobile-overlay { display:none; position:fixed; inset:0; background:rgba(0,0,0,0.4); z-index:199; }
        .main-wrapper { flex:1; margin-left:var(--sidebar-w); display:flex; flex-direction:column; min-height:100vh; transition:margin-left 0.2s ease; }
        .sidebar-collapsed ~ .main-wrapper { margin-left:var(--sidebar-collapsed); }
        .main-header { height:var(--header-h); background:#fff; border-bottom:1px solid #CBE0F0; display:flex; align-items:center; padding:0 20px; gap:12px; position:sticky; top:0; z-index:50; }
        .mobile-menu-btn { display:none; background:none; border:none; cursor:pointer; color:var(--teacher); padding:6px; border-radius:6px; }
        .mobile-menu-btn:hover { background:#F0F6FC; }
        .header-title { flex:1; font-size:15px; font-weight:600; color:var(--teacher); display:flex; align-items:center; gap:8px; }
        .header-info { display:flex; flex-direction:column; align-items:flex-end; gap:3px; }
        .header-name { font-size:13px; font-weight:700; color:#633806; white-space:nowrap; }
        .header-badge { background:#FDF0E6; color:var(--teacher); padding:3px 10px; border-radius:20px; font-size:10px; font-weight:600; white-space:nowrap; }
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