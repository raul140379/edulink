'use client'

import {
  LayoutDashboard, UserCircle, Calendar, BookOpen, Users,
  DollarSign, ClipboardCheck, ClipboardList, FileBarChart, Bell
} from 'lucide-react'
import DashboardShell, { MenuGroup } from '@/components/layout/DashboardShell'

const PADRES_ROLES = ['PARENT', 'JUNTA_ESCOLAR', 'DELEGATE']

const menuGroups: MenuGroup[] = [
  {
    label: 'Inicio', icon: <LayoutDashboard size={15}/>, roles: PADRES_ROLES,
    items: [{ label: 'Inicio', href: '/dashboard/padres', icon: <LayoutDashboard size={15}/>, roles: PADRES_ROLES }],
  },
  {
    label: 'Mi Perfil', icon: <UserCircle size={15}/>, roles: PADRES_ROLES,
    items: [{ label: 'Mi Perfil', href: '/dashboard/padres/perfil', icon: <UserCircle size={15}/>, roles: PADRES_ROLES }],
  },
  {
    label: 'Horario', icon: <Calendar size={15}/>, roles: ['PARENT'],
    items: [{ label: 'Horario', href: '/dashboard/padres/horario', icon: <Calendar size={15}/>, roles: ['PARENT'] }],
  },
  {
    label: 'Calificaciones', icon: <BookOpen size={15}/>, roles: ['PARENT'],
    items: [{ label: 'Calificaciones', href: '/dashboard/padres/calificaciones', icon: <BookOpen size={15}/>, roles: ['PARENT'] }],
  },
  {
    label: 'Maestros', icon: <Users size={15}/>, roles: ['PARENT'],
    items: [{ label: 'Maestros', href: '/dashboard/padres/maestros', icon: <Users size={15}/>, roles: ['PARENT'] }],
  },
  {
    label: 'Tesorería', icon: <DollarSign size={15}/>, roles: PADRES_ROLES,
    items: [{ label: 'Tesorería', href: '/dashboard/padres/tesoreria', icon: <DollarSign size={15}/>, roles: PADRES_ROLES }],
  },
  {
    label: 'Asistencia Maestros', icon: <ClipboardCheck size={15}/>, roles: ['JUNTA_ESCOLAR'],
    items: [{ label: 'Asistencia Maestros', href: '/dashboard/padres/asistencia-maestros', icon: <ClipboardCheck size={15}/>, roles: ['JUNTA_ESCOLAR'] }],
  },
  {
    label: 'Asistencia', icon: <ClipboardCheck size={15}/>, roles: ['DELEGATE'],
    items: [{ label: 'Asistencia', href: '/dashboard/padres/asistencia', icon: <ClipboardCheck size={15}/>, roles: ['DELEGATE'] }],
  },
  {
    label: 'Nuevo Cargo', icon: <ClipboardList size={15}/>, roles: ['JUNTA_ESCOLAR', 'DELEGATE'],
    items: [{ label: 'Nuevo Cargo', href: '/dashboard/padres/cargos/nuevo', icon: <ClipboardList size={15}/>, roles: ['JUNTA_ESCOLAR', 'DELEGATE'] }],
  },
  {
    label: 'Delegados', icon: <Users size={15}/>, roles: ['JUNTA_ESCOLAR'],
    items: [{ label: 'Delegados', href: '/dashboard/padres/delegados', icon: <Users size={15}/>, roles: ['JUNTA_ESCOLAR'] }],
  },
  {
    label: 'Reportes', icon: <FileBarChart size={15}/>, roles: ['JUNTA_ESCOLAR'],
    items: [{ label: 'Reportes', href: '/dashboard/padres/reportes', icon: <FileBarChart size={15}/>, roles: ['JUNTA_ESCOLAR'] }],
  },
  {
    label: 'Notificaciones', icon: <Bell size={15}/>, roles: ['PARENT', 'JUNTA_ESCOLAR'],
    items: [{ label: 'Notificaciones', href: '/dashboard/padres/notificaciones', icon: <Bell size={15}/>, roles: ['PARENT', 'JUNTA_ESCOLAR'] }],
  },
]

export default function PadresLayout({ children }: { children: React.ReactNode }) {
  return (
    <DashboardShell
      allowedRoles={PADRES_ROLES}
      brandName="U.E. Naciones Unidas"
      brandLoc="El Torno · Santa Cruz"
      logoSrc="/logo-nnuu.jpeg"
      homeHref="/dashboard/padres"
      profileHref="/dashboard/padres/perfil"
      notificationsHref="/dashboard/padres/notificaciones"
      menuGroups={menuGroups}
      theme={{ primary: '#00838F', navbar: '#006D75', accent: '#0097A7', hover: '#00ACC1' }}
    >
      {children}
    </DashboardShell>
  )
}
