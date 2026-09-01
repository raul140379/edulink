import { LucideIcon, ClipboardCheck, Bell } from 'lucide-react'

// Cada módulo del rol Maestro es una entrada acá — sumar uno nuevo (ej.
// "práctico" o "evaluación programada" más adelante) es agregar un objeto a
// este array, nada más del shell/login/navegación necesita tocarse.
export interface ModuleDef {
  id: string
  label: string
  icon: LucideIcon
  enabled: boolean
}

export const MODULES: ModuleDef[] = [
  { id: 'asistencia',      label: 'Asistencia',    icon: ClipboardCheck, enabled: true },
  { id: 'notificaciones',  label: 'Notificar',     icon: Bell,           enabled: true },
  // Próximos, ya pensados en la arquitectura, no construidos todavía:
  // { id: 'practico',   label: 'Práctico',   icon: FileEdit,  enabled: false },
  // { id: 'evaluacion', label: 'Evaluación', icon: Calendar,  enabled: false },
]
