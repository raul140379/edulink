'use client'

import { useEffect, useState } from 'react'
import {
  LayoutDashboard, UserCircle, Calendar, BookOpen, Users,
  DollarSign, ClipboardCheck, ClipboardList, FileBarChart, Bell, Megaphone, Layers, UserCog,
  UserPlus, CalendarClock, GraduationCap, AlertCircle, Clock, Hash, UserCheck, Users2,
} from 'lucide-react'
import DashboardShell, { MenuGroup } from '@/components/layout/DashboardShell'
import { useDistrictConfig } from '@/hooks/useDistrictConfig'

const PADRES_ROLES = ['PARENT', 'JUNTA_ESCOLAR', 'DELEGATE', 'JUNTA_NUCLEO', 'JUNTA_DISTRITO']

// Junta Escolar es el único rol reorganizado en 6 categorías (Inicio, Personas,
// Académico, Tesorería, Comunicación, Reportes) — Padre/Delegado/Junta de
// Núcleo-Distrito conservan su navegación tal como estaba, sin cambios.
const NON_JE_ROLES = PADRES_ROLES.filter((r) => r !== 'JUNTA_ESCOLAR')

const menuGroups: MenuGroup[] = [
  {
    label: 'Inicio', icon: <LayoutDashboard size={15}/>, roles: PADRES_ROLES,
    items: [{ label: 'Inicio', href: '/dashboard/padres', icon: <LayoutDashboard size={15}/>, roles: PADRES_ROLES }],
  },
  {
    // Directorio/Delegados/Cuentas de Tutor (gestión de usuarios) + Familias
    // (datos de padres/tutores) + Mi Perfil, todo agrupado bajo "Personas".
    label: 'Personas', icon: <Users size={15}/>, roles: ['JUNTA_ESCOLAR'],
    items: [
      { label: 'Directorio',       href: '/dashboard/padres/junta',          icon: <UserCog size={15}/>,   roles: ['JUNTA_ESCOLAR'] },
      { label: 'Designar cargo',   href: '/dashboard/padres/junta/nueva',    icon: <Users size={15}/>,     roles: ['JUNTA_ESCOLAR'] },
      { label: 'Delegados',        href: '/dashboard/padres/delegados',      icon: <Users size={15}/>,     roles: ['JUNTA_ESCOLAR'] },
      { label: 'Cuentas de Tutor', href: '/dashboard/padres/tutores',        icon: <Users size={15}/>,     roles: ['JUNTA_ESCOLAR'] },
      { label: 'Familias',         href: '/dashboard/padres/familias',       icon: <UserPlus size={15}/>,  roles: ['JUNTA_ESCOLAR'] },
      { label: 'Registrar Padre',  href: '/dashboard/padres/familias/nueva', icon: <UserPlus size={15}/>,  roles: ['JUNTA_ESCOLAR'] },
      { label: 'Padres registrados', href: '/dashboard/padres/personas/registrados', icon: <UserCheck size={15}/>, roles: ['JUNTA_ESCOLAR'] },
      { label: 'Todos los tutores',  href: '/dashboard/padres/personas/tutores',     icon: <Users2 size={15}/>,    roles: ['JUNTA_ESCOLAR'] },
      { label: 'Mi Perfil',        href: '/dashboard/padres/perfil',         icon: <UserCircle size={15}/>, roles: ['JUNTA_ESCOLAR'] },
    ],
  },
  {
    label: 'Académico', icon: <GraduationCap size={15}/>, roles: ['JUNTA_ESCOLAR'],
    items: [
      { label: 'Asistencia',          href: '/dashboard/padres/asistencia',          icon: <ClipboardCheck size={15}/>, roles: ['JUNTA_ESCOLAR'] },
      { label: 'Escanear QR',         href: '/dashboard/padres/asistencia/escanear', icon: <ClipboardCheck size={15}/>, roles: ['JUNTA_ESCOLAR'] },
      { label: 'Asistencia Maestros', href: '/dashboard/padres/asistencia-maestros', icon: <ClipboardCheck size={15}/>, roles: ['JUNTA_ESCOLAR'] },
      { label: 'Cursos',              href: '/dashboard/padres/cursos',              icon: <Layers size={15}/>,         roles: ['JUNTA_ESCOLAR'] },
      { label: 'Estudiantes',         href: '/dashboard/padres/estudiantes',         icon: <Users size={15}/>,          roles: ['JUNTA_ESCOLAR'] },
      { label: 'Docentes',            href: '/dashboard/padres/docentes',            icon: <GraduationCap size={15}/>,  roles: ['JUNTA_ESCOLAR'] },
      { label: 'Horarios',            href: '/dashboard/padres/horarios',            icon: <Calendar size={15}/>,       roles: ['JUNTA_ESCOLAR'] },
    ],
  },
  {
    label: 'Tesorería', icon: <DollarSign size={15}/>, roles: ['JUNTA_ESCOLAR'],
    items: [
      { label: 'Dashboard',             href: '/dashboard/padres/tesoreria',            icon: <DollarSign size={15}/>,    roles: ['JUNTA_ESCOLAR'] },
      { label: 'Nuevo Cargo',           href: '/dashboard/padres/cargos/nuevo',         icon: <ClipboardList size={15}/>, roles: ['JUNTA_ESCOLAR'] },
      { label: 'Cobros',                href: '/dashboard/padres/tesoreria/cobros',     icon: <DollarSign size={15}/>,    roles: ['JUNTA_ESCOLAR'] },
      { label: 'Deudas',                href: '/dashboard/padres/tesoreria/deudas',     icon: <AlertCircle size={15}/>,   roles: ['JUNTA_ESCOLAR'] },
      { label: 'Historial',             href: '/dashboard/padres/tesoreria/historial',  icon: <Clock size={15}/>,         roles: ['JUNTA_ESCOLAR'] },
      { label: 'Kardex',                href: '/dashboard/padres/tesoreria/kardex',     icon: <Hash size={15}/>,          roles: ['JUNTA_ESCOLAR'] },
      { label: 'Reportes Financieros',  href: '/dashboard/padres/tesoreria/reportes',   icon: <FileBarChart size={15}/>,  roles: ['JUNTA_ESCOLAR'] },
      { label: 'Cargos Obligatorios',   href: '/dashboard/padres/tesoreria/obligatorios', icon: <ClipboardList size={15}/>, roles: ['JUNTA_ESCOLAR'] },
    ],
  },
  {
    label: 'Comunicación', icon: <Megaphone size={15}/>, roles: ['JUNTA_ESCOLAR'],
    items: [
      { label: 'Comunicados',     href: '/dashboard/padres/comunicados',    icon: <Megaphone size={15}/>,    roles: ['JUNTA_ESCOLAR'] },
      { label: 'Convocatoria',    href: '/dashboard/padres/convocatoria',   icon: <CalendarClock size={15}/>, roles: ['JUNTA_ESCOLAR'] },
      { label: 'Notificaciones',  href: '/dashboard/padres/notificaciones', icon: <Bell size={15}/>,          roles: ['JUNTA_ESCOLAR'] },
    ],
  },
  {
    label: 'Reportes', icon: <FileBarChart size={15}/>, roles: ['JUNTA_ESCOLAR'],
    items: [
      { label: 'Académicos',  href: '/dashboard/padres/reportes/academicos',  icon: <GraduationCap size={15}/>,  roles: ['JUNTA_ESCOLAR'] },
      { label: 'Tesorería',   href: '/dashboard/padres/tesoreria/reportes',   icon: <DollarSign size={15}/>,     roles: ['JUNTA_ESCOLAR'] },
      { label: 'Asistencia',  href: '/dashboard/padres/reportes/asistencia',  icon: <ClipboardCheck size={15}/>, roles: ['JUNTA_ESCOLAR'] },
    ],
  },

  // ── Resto de roles (Padre/Delegado/Junta de Núcleo-Distrito) — sin cambios ──
  {
    label: 'Mi Perfil', icon: <UserCircle size={15}/>, roles: NON_JE_ROLES,
    items: [{ label: 'Mi Perfil', href: '/dashboard/padres/perfil', icon: <UserCircle size={15}/>, roles: NON_JE_ROLES }],
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
    label: 'Tesorería', icon: <DollarSign size={15}/>, roles: NON_JE_ROLES,
    items: [{ label: 'Tesorería', href: '/dashboard/padres/tesoreria', icon: <DollarSign size={15}/>, roles: NON_JE_ROLES }],
  },
  {
    label: 'Asistencia', icon: <ClipboardCheck size={15}/>, roles: ['DELEGATE'],
    items: [{ label: 'Asistencia', href: '/dashboard/padres/asistencia', icon: <ClipboardCheck size={15}/>, roles: ['DELEGATE'] }],
  },
  {
    label: 'Nuevo Cargo', icon: <ClipboardList size={15}/>, roles: ['DELEGATE'],
    items: [{ label: 'Nuevo Cargo', href: '/dashboard/padres/cargos/nuevo', icon: <ClipboardList size={15}/>, roles: ['DELEGATE'] }],
  },
  {
    label: 'Familias', icon: <UserPlus size={15}/>, roles: ['DELEGATE'],
    items: [
      { label: 'Listado',        href: '/dashboard/padres/familias',       icon: <Users size={15}/>,   roles: ['DELEGATE'] },
      { label: 'Registrar Padre', href: '/dashboard/padres/familias/nueva', icon: <UserPlus size={15}/>, roles: ['DELEGATE'] },
    ],
  },
  {
    label: 'Notificaciones', icon: <Bell size={15}/>, roles: ['PARENT', 'JUNTA_NUCLEO', 'JUNTA_DISTRITO'],
    items: [{ label: 'Notificaciones', href: '/dashboard/padres/notificaciones', icon: <Bell size={15}/>, roles: ['PARENT', 'JUNTA_NUCLEO', 'JUNTA_DISTRITO'] }],
  },
  {
    label: 'Comunicados', icon: <Megaphone size={15}/>, roles: ['JUNTA_NUCLEO', 'JUNTA_DISTRITO'],
    items: [{ label: 'Comunicados', href: '/dashboard/padres/comunicados', icon: <Megaphone size={15}/>, roles: ['JUNTA_NUCLEO', 'JUNTA_DISTRITO'] }],
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
