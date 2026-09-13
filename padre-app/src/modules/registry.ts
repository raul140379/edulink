import { LucideIcon, CalendarCheck, Bell, CalendarPlus, ClipboardList } from 'lucide-react'

// Cada módulo del rol Padre es una entrada acá — sumar uno nuevo más
// adelante es agregar un objeto a este array y su ruta en app/(protected)/,
// nada más del shell/login necesita tocarse. Mismo patrón que maestro-app.
export interface ModuleDef {
  id: string
  label: string
  href: string
  icon: LucideIcon
  enabled: boolean
}

export const MODULES: ModuleDef[] = [
  { id: 'asistencia',      label: 'Asistencia',        href: '/asistencia',       icon: CalendarCheck, enabled: true },
  { id: 'notificaciones',  label: 'Notificaciones',    href: '/notificaciones',   icon: Bell,          enabled: true },
  { id: 'licencia-nueva',  label: 'Solicitar Licencia', href: '/licencia-nueva',  icon: CalendarPlus,  enabled: true },
  { id: 'licencia-mias',   label: 'Mis Solicitudes',   href: '/licencia-mias',    icon: ClipboardList, enabled: true },
]
