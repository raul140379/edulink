'use client'

import { useEffect, useState } from 'react'
import {
  LayoutDashboard, UserCircle, GraduationCap, BookOpen, ClipboardList, Clock, Bell, Megaphone, Users
} from 'lucide-react'
import DashboardShell, { MenuGroup } from '@/components/layout/DashboardShell'
import { useDistrictConfig } from '@/hooks/useDistrictConfig'

const ESTUDIANTE_ROLES = ['STUDENT', 'STUDENT_GOV', 'GOBIERNO_NUCLEO', 'GOBIERNO_DISTRITO']
const GOBIERNO_ROLES   = ['STUDENT_GOV', 'GOBIERNO_NUCLEO', 'GOBIERNO_DISTRITO']
const STUDENT_ONLY_ROLES = ['STUDENT', 'STUDENT_GOV']

const menuGroups: MenuGroup[] = [
  {
    label: 'Inicio', icon: <LayoutDashboard size={15}/>, roles: ESTUDIANTE_ROLES,
    items: [{ label: 'Inicio', href: '/dashboard/estudiantes', icon: <LayoutDashboard size={15}/>, roles: ESTUDIANTE_ROLES }],
  },
  {
    label: 'Mi Perfil', icon: <UserCircle size={15}/>, roles: STUDENT_ONLY_ROLES,
    items: [{ label: 'Mi Perfil', href: '/dashboard/estudiantes/perfil', icon: <UserCircle size={15}/>, roles: STUDENT_ONLY_ROLES }],
  },
  {
    label: 'Mis Materias', icon: <GraduationCap size={15}/>, roles: STUDENT_ONLY_ROLES,
    items: [{ label: 'Mis Materias', href: '/dashboard/estudiantes/materias', icon: <GraduationCap size={15}/>, roles: STUDENT_ONLY_ROLES }],
  },
  {
    label: 'Calificaciones', icon: <BookOpen size={15}/>, roles: STUDENT_ONLY_ROLES,
    items: [{ label: 'Calificaciones', href: '/dashboard/estudiantes/calificaciones', icon: <BookOpen size={15}/>, roles: STUDENT_ONLY_ROLES }],
  },
  {
    label: 'Tareas', icon: <ClipboardList size={15}/>, roles: STUDENT_ONLY_ROLES,
    items: [{ label: 'Tareas', href: '/dashboard/estudiantes/tareas', icon: <ClipboardList size={15}/>, roles: STUDENT_ONLY_ROLES }],
  },
  {
    label: 'Horario', icon: <Clock size={15}/>, roles: STUDENT_ONLY_ROLES,
    items: [{ label: 'Horario', href: '/dashboard/estudiantes/horario', icon: <Clock size={15}/>, roles: STUDENT_ONLY_ROLES }],
  },
  {
    label: 'Notificaciones', icon: <Bell size={15}/>, roles: STUDENT_ONLY_ROLES,
    items: [{ label: 'Notificaciones', href: '/dashboard/estudiantes/notificaciones', icon: <Bell size={15}/>, roles: STUDENT_ONLY_ROLES }],
  },
  {
    label: 'Comunicados', icon: <Megaphone size={15}/>, roles: GOBIERNO_ROLES,
    items: [{ label: 'Comunicados', href: '/dashboard/estudiantes/comunicados', icon: <Megaphone size={15}/>, roles: GOBIERNO_ROLES }],
  },
  {
    label: 'Designar Gobierno', icon: <Users size={15}/>, roles: ['GOBIERNO_DISTRITO'],
    items: [{ label: 'Designar Gobierno', href: '/dashboard/estudiantes/gobierno/nueva', icon: <Users size={15}/>, roles: ['GOBIERNO_DISTRITO'] }],
  },
]

const LEVEL_LABEL: Record<string, string> = {
  GOBIERNO_DISTRITO: 'Gobierno Estudiantil de Distrito',
  GOBIERNO_NUCLEO:   'Gobierno Estudiantil de Núcleo',
}

export default function EstudiantesLayout({ children }: { children: React.ReactNode }) {
  const district = useDistrictConfig()
  const [role, setRole] = useState<string | null>(null)

  useEffect(() => {
    const raw = localStorage.getItem('user')
    if (raw) setRole(JSON.parse(raw).role)
  }, [])

  const isDistrictLevel = role === 'GOBIERNO_DISTRITO' || role === 'GOBIERNO_NUCLEO'

  return (
    <DashboardShell
      allowedRoles={ESTUDIANTE_ROLES}
      brandName={isDistrictLevel ? `${district.name} · ${LEVEL_LABEL[role as string]}` : 'U.E. Naciones Unidas'}
      brandLoc={district.location || 'Bolivia'}
      logoSrc={isDistrictLevel ? (district.logoUrl || '/escudo-el-torno.png') : '/logo-nnuu.jpeg'}
      homeHref="/dashboard/estudiantes"
      profileHref={isDistrictLevel ? '/dashboard/estudiantes' : '/dashboard/estudiantes/perfil'}
      notificationsHref={isDistrictLevel ? undefined : '/dashboard/estudiantes/notificaciones'}
      menuGroups={menuGroups}
      theme={{ primary: '#1A7DB8', navbar: '#1565A0', accent: '#F5C518', hover: '#2B93CE' }}
    >
      {children}
    </DashboardShell>
  )
}
