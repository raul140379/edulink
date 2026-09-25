import { LucideIcon, CalendarCheck, Bell } from 'lucide-react'

// Cada módulo del rol Estudiante es una entrada acá — sumar uno nuevo más
// adelante es agregar un objeto a este array y su ruta en app/(protected)/,
// nada más del shell/login necesita tocarse. Mismo patrón que
// maestro-app/padre-app/regente-app.
export interface ModuleDef {
  id: string
  label: string
  href: string
  icon: LucideIcon
  enabled: boolean
}

export const MODULES: ModuleDef[] = [
  { id: 'asistencia',     label: 'Asistencia',     href: '/asistencia',     icon: CalendarCheck, enabled: true },
  { id: 'notificaciones', label: 'Notificaciones', href: '/notificaciones', icon: Bell,          enabled: true },
]
