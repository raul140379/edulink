'use client'

import { useEffect, useState } from 'react'
import {
  LayoutDashboard, Users, GraduationCap, BookOpen,
  ClipboardList, Clock, DollarSign, Bell, FileBarChart,
  Settings, ShieldCheck, Calendar, ClipboardCheck, Building2, Megaphone
} from 'lucide-react'
import DashboardShell, { MenuGroup } from '@/components/layout/DashboardShell'

const ADMIN_ROLES = ['SUPER_ADMIN', 'DIRECTOR', 'REGENTE', 'SECRETARY']
const DISTRICT_ROLES = ['SUPER_ADMIN', 'DIRECTOR_DISTRITAL']

const menuGroups: MenuGroup[] = [
  {
    label: 'Dashboard',
    icon:  <LayoutDashboard size={15}/>,
    roles: [...ADMIN_ROLES, ...DISTRICT_ROLES],
    items: [
      { label: 'Dashboard', href: '/dashboard/admin', icon: <LayoutDashboard size={15}/>, roles: [...ADMIN_ROLES, ...DISTRICT_ROLES] },
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
    roles: ['SUPER_ADMIN','DIRECTOR','SECRETARY', ...DISTRICT_ROLES],
    items: [
      { label: 'Colegios',      href: '/dashboard/admin/colegios',      icon: <Building2 size={16}/>, roles: DISTRICT_ROLES },
      { label: 'Comunicados',   href: '/dashboard/admin/comunicados',   icon: <Megaphone size={16}/>, roles: DISTRICT_ROLES },
      { label: 'Usuarios',      href: '/dashboard/admin/usuarios',      icon: <Users size={16}/>,    roles: ['SUPER_ADMIN','DIRECTOR','SECRETARY', ...DISTRICT_ROLES] },
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
  const [isDistrict, setIsDistrict] = useState(false)

  useEffect(() => {
    try {
      const user = JSON.parse(localStorage.getItem('user') || 'null')
      setIsDistrict(!!user && DISTRICT_ROLES.includes(user.role))
    } catch {
      setIsDistrict(false)
    }
  }, [])

  return (
    <DashboardShell
      allowedRoles={[...ADMIN_ROLES, ...DISTRICT_ROLES]}
      brandName={isDistrict ? 'Distrito Educativo El Torno' : 'U.E. Naciones Unidas'}
      brandLoc="El Torno · Santa Cruz"
      logoSrc={isDistrict ? '/escudo-el-torno.png' : '/logo-nnuu.jpeg'}
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
