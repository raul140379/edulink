'use client'

import {
  LayoutDashboard, UserCircle, GraduationCap, BookOpen, ClipboardList, Clock, Bell
} from 'lucide-react'
import DashboardShell, { MenuGroup } from '@/components/layout/DashboardShell'

const ESTUDIANTE_ROLES = ['STUDENT', 'STUDENT_GOV']

const menuGroups: MenuGroup[] = [
  {
    label: 'Inicio', icon: <LayoutDashboard size={15}/>, roles: ESTUDIANTE_ROLES,
    items: [{ label: 'Inicio', href: '/dashboard/estudiantes', icon: <LayoutDashboard size={15}/>, roles: ESTUDIANTE_ROLES }],
  },
  {
    label: 'Mi Perfil', icon: <UserCircle size={15}/>, roles: ESTUDIANTE_ROLES,
    items: [{ label: 'Mi Perfil', href: '/dashboard/estudiantes/perfil', icon: <UserCircle size={15}/>, roles: ESTUDIANTE_ROLES }],
  },
  {
    label: 'Mis Materias', icon: <GraduationCap size={15}/>, roles: ESTUDIANTE_ROLES,
    items: [{ label: 'Mis Materias', href: '/dashboard/estudiantes/materias', icon: <GraduationCap size={15}/>, roles: ESTUDIANTE_ROLES }],
  },
  {
    label: 'Calificaciones', icon: <BookOpen size={15}/>, roles: ESTUDIANTE_ROLES,
    items: [{ label: 'Calificaciones', href: '/dashboard/estudiantes/calificaciones', icon: <BookOpen size={15}/>, roles: ESTUDIANTE_ROLES }],
  },
  {
    label: 'Tareas', icon: <ClipboardList size={15}/>, roles: ESTUDIANTE_ROLES,
    items: [{ label: 'Tareas', href: '/dashboard/estudiantes/tareas', icon: <ClipboardList size={15}/>, roles: ESTUDIANTE_ROLES }],
  },
  {
    label: 'Horario', icon: <Clock size={15}/>, roles: ESTUDIANTE_ROLES,
    items: [{ label: 'Horario', href: '/dashboard/estudiantes/horario', icon: <Clock size={15}/>, roles: ESTUDIANTE_ROLES }],
  },
  {
    label: 'Notificaciones', icon: <Bell size={15}/>, roles: ESTUDIANTE_ROLES,
    items: [{ label: 'Notificaciones', href: '/dashboard/estudiantes/notificaciones', icon: <Bell size={15}/>, roles: ESTUDIANTE_ROLES }],
  },
]

export default function EstudiantesLayout({ children }: { children: React.ReactNode }) {
  return (
    <DashboardShell
      allowedRoles={ESTUDIANTE_ROLES}
      brandName="U.E. Naciones Unidas"
      brandLoc="El Torno · Santa Cruz"
      logoSrc="/logo-nnuu.jpeg"
      homeHref="/dashboard/estudiantes"
      profileHref="/dashboard/estudiantes/perfil"
      notificationsHref="/dashboard/estudiantes/notificaciones"
      menuGroups={menuGroups}
      theme={{ primary: '#1A7DB8', navbar: '#1565A0', accent: '#F5C518', hover: '#2B93CE' }}
    >
      {children}
    </DashboardShell>
  )
}
