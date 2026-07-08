'use client'

import {
  LayoutDashboard, Users, GraduationCap, BookOpen,
  ClipboardList, Clock, DollarSign, Bell, FileBarChart,
  Settings, ShieldCheck, Calendar, ClipboardCheck
} from 'lucide-react'
import DashboardShell, { MenuGroup } from '@/components/layout/DashboardShell'

const ADMIN_ROLES = ['SUPER_ADMIN', 'DIRECTOR', 'REGENTE', 'SECRETARY']

const menuGroups: MenuGroup[] = [
  {
    label: 'Dashboard',
    icon:  <LayoutDashboard size={15}/>,
    roles: ADMIN_ROLES,
    items: [
      { label: 'Dashboard', href: '/dashboard/admin', icon: <LayoutDashboard size={15}/>, roles: ADMIN_ROLES },
    ]
  },
  {
    label: 'Académico',
    icon:  <BookOpen size={15}/>,
    roles: ADMIN_ROLES,
    items: [
      { label: 'Estudiantes',       href: '/dashboard/admin/estudiantes',   icon: <GraduationCap size={16}/>, roles: ADMIN_ROLES },
      { label: 'Maestros',          href: '/dashboard/admin/maestros',      icon: <GraduationCap size={16}/>, roles: ['SUPER_ADMIN','DIRECTOR','SECRETARY'] },
      { label: 'Cursos',            href: '/dashboard/admin/cursos',        icon: <BookOpen size={16}/>,      roles: ADMIN_ROLES },
      { label: 'Materias',          href: '/dashboard/admin/materias',      icon: <BookOpen size={16}/>,      roles: ['SUPER_ADMIN','DIRECTOR','SECRETARY'] },
      { label: 'Inscripciones',     href: '/dashboard/admin/inscripciones', icon: <ClipboardList size={16}/>, roles: ['SUPER_ADMIN','DIRECTOR','SECRETARY'] },
      { label: 'Gestión Académica', href: '/dashboard/admin/gestion',       icon: <Calendar size={16}/>,      roles: ['SUPER_ADMIN','DIRECTOR','SECRETARY'] },
      { label: 'Horarios',          href: '/dashboard/admin/horarios',      icon: <Clock size={16}/>,         roles: ADMIN_ROLES },
      { label: 'Calificaciones',    href: '/dashboard/admin/notas',         icon: <ClipboardList size={16}/>, roles: ADMIN_ROLES },
    ]
  },
  {
    label: 'Comunicación',
    icon:  <Bell size={15}/>,
    roles: ADMIN_ROLES,
    items: [
      { label: 'Notificaciones', href: '/dashboard/admin/notificaciones', icon: <Bell size={16}/>, roles: ADMIN_ROLES },
    ]
  },
  {
    label: 'Administración',
    icon:  <Users size={15}/>,
    roles: ADMIN_ROLES,
    items: [
      { label: 'Padres / Tutores',  href: '/dashboard/admin/padres',     icon: <Users size={16}/>,         roles: ADMIN_ROLES },
      { label: 'Asistencia de Maestros', href: '/dashboard/admin/asistencia', icon: <ClipboardCheck size={16}/>, roles: ['SUPER_ADMIN','DIRECTOR','SECRETARY'] },
      { label: 'Portero',           href: '/dashboard/admin/portero',    icon: <ShieldCheck size={16}/>,   roles: ['SUPER_ADMIN','DIRECTOR'] },
    ]
  },
  {
    label: 'Hacienda',
    icon:  <DollarSign size={15}/>,
    roles: ['SUPER_ADMIN','DIRECTOR','SECRETARY'],
    items: [
      { label: 'Pagos', href: '/dashboard/admin/tesoreria', icon: <DollarSign size={16}/>, roles: ['SUPER_ADMIN','DIRECTOR','SECRETARY'] },
    ]
  },
  {
    label: 'Sistema',
    icon:  <Settings size={15}/>,
    roles: ['SUPER_ADMIN','DIRECTOR','SECRETARY'],
    items: [
      { label: 'Usuarios',      href: '/dashboard/admin/usuarios',      icon: <Users size={16}/>,    roles: ['SUPER_ADMIN','DIRECTOR','SECRETARY'] },
      { label: 'Configuración', href: '/dashboard/admin/configuracion', icon: <Settings size={16}/>, roles: ['SUPER_ADMIN'] },
    ]
  },
  {
    label: 'Reportes',
    icon:  <FileBarChart size={15}/>,
    roles: ['SUPER_ADMIN','DIRECTOR','SECRETARY'],
    items: [
      { label: 'Reportes', href: '/dashboard/admin/reportes', icon: <FileBarChart size={16}/>, roles: ['SUPER_ADMIN','DIRECTOR','SECRETARY'] },
    ]
  },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <DashboardShell
      allowedRoles={ADMIN_ROLES}
      brandName="U.E. Naciones Unidas"
      brandLoc="El Torno · Santa Cruz"
      logoSrc="/logo-nnuu.jpeg"
      homeHref="/dashboard/admin"
      profileHref="/dashboard/admin/perfil"
      notificationsHref="/dashboard/admin/notificaciones"
      menuGroups={menuGroups}
      theme={{ primary: '#1A3A7C', navbar: '#15316B', accent: '#2A57A8', hover: '#3768C4' }}
    >
      {children}
    </DashboardShell>
  )
}
