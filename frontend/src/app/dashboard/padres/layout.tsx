'use client'

import { useEffect, useState } from 'react'
import {
  LayoutDashboard, UserCircle, Calendar, BookOpen, Users,
  DollarSign, ClipboardCheck, ClipboardList, FileBarChart, Bell, Megaphone, Layers, UserCog,
} from 'lucide-react'
import DashboardShell, { MenuGroup } from '@/components/layout/DashboardShell'
import { useDistrictConfig } from '@/hooks/useDistrictConfig'

const PADRES_ROLES = ['PARENT', 'JUNTA_ESCOLAR', 'DELEGATE', 'JUNTA_NUCLEO', 'JUNTA_DISTRITO']
const JUNTA_ROLES  = ['JUNTA_ESCOLAR', 'JUNTA_NUCLEO', 'JUNTA_DISTRITO']

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
    label: 'Notificaciones', icon: <Bell size={15}/>, roles: ['PARENT', 'JUNTA_ESCOLAR', 'JUNTA_NUCLEO', 'JUNTA_DISTRITO'],
    items: [{ label: 'Notificaciones', href: '/dashboard/padres/notificaciones', icon: <Bell size={15}/>, roles: ['PARENT', 'JUNTA_ESCOLAR', 'JUNTA_NUCLEO', 'JUNTA_DISTRITO'] }],
  },
  {
    label: 'Comunicados', icon: <Megaphone size={15}/>, roles: JUNTA_ROLES,
    items: [{ label: 'Comunicados', href: '/dashboard/padres/comunicados', icon: <Megaphone size={15}/>, roles: JUNTA_ROLES }],
  },
  {
    label: 'Núcleos', icon: <Layers size={15}/>, roles: ['JUNTA_DISTRITO', 'JUNTA_NUCLEO'],
    items: [{ label: 'Núcleos', href: '/dashboard/padres/nucleos', icon: <Layers size={15}/>, roles: ['JUNTA_DISTRITO', 'JUNTA_NUCLEO'] }],
  },
  {
    label: 'Gestionar Junta', icon: <UserCog size={15}/>, roles: ['JUNTA_DISTRITO', 'JUNTA_NUCLEO'],
    items: [{ label: 'Gestionar Junta', href: '/dashboard/padres/junta', icon: <UserCog size={15}/>, roles: ['JUNTA_DISTRITO', 'JUNTA_NUCLEO'] }],
  },
  {
    label: 'Designar Junta', icon: <Users size={15}/>, roles: ['JUNTA_DISTRITO', 'JUNTA_NUCLEO'],
    items: [{ label: 'Designar Junta', href: '/dashboard/padres/junta/nueva', icon: <Users size={15}/>, roles: ['JUNTA_DISTRITO', 'JUNTA_NUCLEO'] }],
  },
]

const LEVEL_LABEL: Record<string, string> = {
  JUNTA_DISTRITO: 'Junta de Distrito',
  JUNTA_NUCLEO:   'Junta de Núcleo',
}

export default function PadresLayout({ children }: { children: React.ReactNode }) {
  const district = useDistrictConfig()
  const [role, setRole] = useState<string | null>(null)

  useEffect(() => {
    const raw = localStorage.getItem('user')
    if (raw) setRole(JSON.parse(raw).role)
  }, [])

  const isDistrictLevel = role === 'JUNTA_DISTRITO' || role === 'JUNTA_NUCLEO'

  return (
    <DashboardShell
      allowedRoles={PADRES_ROLES}
      brandName={isDistrictLevel ? `${district.name} · ${LEVEL_LABEL[role as string]}` : 'U.E. Naciones Unidas'}
      brandLoc={district.location || 'Bolivia'}
      logoSrc={isDistrictLevel ? (district.logoUrl || '/escudo-el-torno.png') : '/logo-nnuu.jpeg'}
      homeHref="/dashboard/padres"
      profileHref="/dashboard/padres/perfil"
      notificationsHref={isDistrictLevel ? undefined : '/dashboard/padres/notificaciones'}
      menuGroups={menuGroups}
      theme={{ primary: '#136272', navbar: '#0C4955', accent: '#1A7789', hover: '#2790A5', bg: '#D7EFF4' }}
    >
      {children}
    </DashboardShell>
  )
}
