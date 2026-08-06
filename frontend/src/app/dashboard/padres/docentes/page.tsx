'use client'

import { useEffect, useState } from 'react'
import { Search, GraduationCap } from 'lucide-react'
import Card from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import Table, { Column } from '@/components/ui/Table'
import { useToast } from '@/components/ui/ToastProvider'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

interface Teacher {
  id: number; firstName: string; lastName: string; ci?: string; phone?: string; email?: string
  specialty?: string; isActive: boolean; _count: { assignments: number }
}

// Solo lectura — mismo permiso backend (TEACHER_VIEW_ALL) que ya usa Junta
// Escolar en otras pantallas; sin crear/editar/eliminar (eso sigue siendo
// exclusivo de Admin).
export default function DocentesPage() {
  const toast = useToast()
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [loading, setLoading]   = useState(true)
  const [search, setSearch]     = useState('')

  const fetchTeachers = () => {
    setLoading(true)
    const token = localStorage.getItem('token')
    const params = new URLSearchParams()
    if (search) params.set('search', search)
    fetch(`${API_URL}/api/teachers?${params}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : [])
      .then(setTeachers)
      .catch(() => toast('Error de conexión', 'error'))
      .finally(() => setLoading(false))
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(fetchTeachers, [])

  const columns: Column<Teacher>[] = [
    { key: 'nombre', header: 'Docente', render: t => (
      <div>
        <div className="font-medium text-brand-700">{t.lastName} {t.firstName}</div>
        {t.ci && <div className="text-[11px] text-neutral-500">CI {t.ci}</div>}
      </div>
    ) },
    { key: 'especialidad', header: 'Especialidad', render: t => t.specialty
      ? <Badge tone="brand">{t.specialty}</Badge>
      : <span className="text-[11px] text-neutral-400 italic">—</span>
    },
    { key: 'contacto', header: 'Contacto', render: t => (
      <div className="text-[12px] text-neutral-500">
        {t.phone && <div>{t.phone}</div>}
        {t.email && <div>{t.email}</div>}
        {!t.phone && !t.email && '—'}
      </div>
    ) },
    { key: 'cursos', header: 'Cursos a cargo', render: t => <span className="text-[12.5px] text-neutral-500">{t._count?.assignments ?? 0}</span> },
    { key: 'estado', header: 'Estado', render: t => <Badge tone={t.isActive ? 'success' : 'danger'}>{t.isActive ? 'Activo' : 'Inactivo'}</Badge> },
  ]

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-brand-700 mb-1">Docentes</h1>
        <p className="text-[13px] text-neutral-500">Maestros registrados en el colegio</p>
      </div>

      <Card className="flex gap-2.5 flex-wrap items-center mb-4">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-info-500 pointer-events-none"/>
          <Input placeholder="Buscar por nombre o CI..." value={search} onChange={e => setSearch(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && fetchTeachers()} className="pl-9" />
        </div>
        <Button variant="secondary" onClick={fetchTeachers}>Buscar</Button>
      </Card>

      <Card padded={false} className="overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16"><p className="text-sm text-neutral-500">Cargando...</p></div>
        ) : teachers.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-neutral-500">
            <GraduationCap size={40} className="text-neutral-300"/>
            <p className="text-[13px]">No se encontraron docentes</p>
          </div>
        ) : (
          <div className="p-4">
            <Table columns={columns} rows={teachers} rowKey={t => t.id} />
          </div>
        )}
      </Card>
    </div>
  )
}
