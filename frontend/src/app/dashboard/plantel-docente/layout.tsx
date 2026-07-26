'use client'

import {
  LayoutDashboard, UserCircle, Calendar, ClipboardCheck, Clock,
  BookOpen, FileText, Users, Bell, DollarSign
} from 'lucide-react'
import DashboardShell, { MenuGroup } from '@/components/layout/DashboardShell'
import { useDistrictConfig } from '@/hooks/useDistrictConfig'

const DOCENTE_ROLES = ['TEACHER', 'TEACHER_TUTOR']

const menuGroups: MenuGroup[] = [
  {
    label: 'Mi Curso', icon: <LayoutDashboard size={15}/>, roles: DOCENTE_ROLES,
    items: [{ label: 'Mi Curso', href: '/dashboard/plantel-docente', icon: <LayoutDashboard size={15}/>, roles: DOCENTE_ROLES }],
  },
  {
    label: 'Mi Perfil', icon: <UserCircle size={15}/>, roles: DOCENTE_ROLES,
    items: [{ label: 'Mi Perfil', href: '/dashboard/plantel-docente/perfil', icon: <UserCircle size={15}/>, roles: DOCENTE_ROLES }],
  },
  {
    label: 'Mi Horario', icon: <Calendar size={15}/>, roles: ['TEACHER'],
    items: [{ label: 'Mi Horario', href: '/dashboard/plantel-docente/horario', icon: <Calendar size={15}/>, roles: ['TEACHER'] }],
  },
  {
    label: 'Asistencia', icon: <ClipboardCheck size={15}/>, roles: ['TEACHER'],
    items: [{ label: 'Asistencia', href: '/dashboard/plantel-docente/asistencia-estudiantes', icon: <ClipboardCheck size={15}/>, roles: ['TEACHER'] }],
  },
  {
    label: 'Carga Horaria', icon: <Clock size={15}/>, roles: DOCENTE_ROLES,
    items: [{ label: 'Carga Horaria', href: '/dashboard/plantel-docente/workload', icon: <Clock size={15}/>, roles: DOCENTE_ROLES }],
  },
  {
    label: 'Mis Notas', icon: <BookOpen size={15}/>, roles: DOCENTE_ROLES,
    items: [{ label: 'Mis Notas', href: '/dashboard/plantel-docente/notas', icon: <BookOpen size={15}/>, roles: DOCENTE_ROLES }],
  },
  {
    label: 'Tareas', icon: <FileText size={15}/>, roles: ['TEACHER'],
    items: [{ label: 'Tareas y Exámenes', href: '/dashboard/plantel-docente/tareas', icon: <FileText size={15}/>, roles: ['TEACHER'] }],
  },
  {
    label: 'Estado de Cuenta', icon: <DollarSign size={15}/>, roles: ['TEACHER_TUTOR'],
    items: [{ label: 'Estado de Cuenta', href: '/dashboard/plantel-docente/tesoreria', icon: <DollarSign size={15}/>, roles: ['TEACHER_TUTOR'] }],
  },
  {
    label: 'Reuniones', icon: <Users size={15}/>, roles: DOCENTE_ROLES,
    items: [{ label: 'Reuniones', href: '/dashboard/plantel-docente/reuniones', icon: <Users size={15}/>, roles: DOCENTE_ROLES }],
  },
  {
    label: 'Notificaciones', icon: <Bell size={15}/>, roles: DOCENTE_ROLES,
    items: [{ label: 'Notificaciones', href: '/dashboard/plantel-docente/notificaciones', icon: <Bell size={15}/>, roles: DOCENTE_ROLES }],
  },
]

export default function PlantelDocenteLayout({ children }: { children: React.ReactNode }) {
  const district = useDistrictConfig()
  return (
    <DashboardShell
      allowedRoles={DOCENTE_ROLES}
      brandName="U.E. Naciones Unidas"
      brandLoc={district.location || 'Bolivia'}
      logoSrc="/logo-nnuu.jpeg"
      homeHref="/dashboard/plantel-docente"
      profileHref="/dashboard/plantel-docente/perfil"
      notificationsHref="/dashboard/plantel-docente/notificaciones"
      menuGroups={menuGroups}
      theme={{ primary: '#1565C0', navbar: '#0F4E96', accent: '#1976D2', hover: '#2196F3' }}
    >
      {children}
    </DashboardShell>
  )
}
