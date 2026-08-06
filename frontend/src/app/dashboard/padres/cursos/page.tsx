'use client'

import { useEffect, useState } from 'react'
import { Layers } from 'lucide-react'
import Card from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import Table, { Column } from '@/components/ui/Table'
import { useToast } from '@/components/ui/ToastProvider'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

const GRADE_LABELS: Record<string, string> = { PRIMERO: '1°', SEGUNDO: '2°', TERCERO: '3°', CUARTO: '4°', QUINTO: '5°', SEXTO: '6°' }
const SHIFT_LABELS: Record<string, string> = { MORNING: 'Mañana', AFTERNOON: 'Tarde', NIGHT: 'Noche' }
const LEVEL_LABELS: Record<string, string> = { INICIAL: 'Inicial', PRIMARIA: 'Primaria', SECUNDARIA: 'Secundaria' }

interface Course {
  id: number; level: string; grade: string; parallel: string; shift: string
  shiftDirector?: { firstName: string; lastName: string } | null
  tutor?: { teacher: { firstName: string; lastName: string } } | null
  _count?: { assignments: number }
}

// Solo lectura — Junta Escolar puede ver cursos del colegio (mismo permiso
// backend que ya usa Familias/Tesorería por curso), sin crear/editar/eliminar.
export default function CursosPage() {
  const toast = useToast()
  const [courses, setCourses] = useState<Course[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('token')
    fetch(`${API_URL}/api/courses`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : [])
      .then(setCourses)
      .catch(() => toast('Error de conexión', 'error'))
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const columns: Column<Course>[] = [
    { key: 'curso', header: 'Curso', render: c => (
      <span className="font-medium text-brand-700">{LEVEL_LABELS[c.level] || c.level} — {GRADE_LABELS[c.grade] || c.grade} &quot;{c.parallel}&quot;</span>
    ) },
    { key: 'turno', header: 'Turno', render: c => <Badge tone="neutral">{SHIFT_LABELS[c.shift] || c.shift}</Badge> },
    { key: 'estudiantes', header: 'Estudiantes', render: c => <span className="text-[12.5px] text-neutral-500">{c._count?.assignments ?? '—'}</span> },
    { key: 'tutor', header: 'Maestro Tutor', render: c => c.tutor
      ? <span className="text-[12.5px]">{c.tutor.teacher.lastName} {c.tutor.teacher.firstName}</span>
      : <span className="text-[11px] text-neutral-400 italic">Sin tutor</span>
    },
  ]

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-brand-700 mb-1">Cursos</h1>
        <p className="text-[13px] text-neutral-500">Cursos registrados en el colegio</p>
      </div>

      <Card padded={false} className="overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16"><p className="text-sm text-neutral-500">Cargando...</p></div>
        ) : courses.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-neutral-500">
            <Layers size={40} className="text-neutral-300"/>
            <p className="text-[13px]">No hay cursos registrados</p>
          </div>
        ) : (
          <div className="p-4">
            <Table columns={columns} rows={courses} rowKey={c => c.id} />
          </div>
        )}
      </Card>
    </div>
  )
}
