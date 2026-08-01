'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { UserPlus, Search } from 'lucide-react'
import Card from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import Table, { Column } from '@/components/ui/Table'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

const RELATION_LABELS: Record<string, string> = {
  PADRE: 'Padre', MADRE: 'Madre', TUTOR_LEGAL: 'Tutor legal', OTRO: 'Otro',
}

interface FamilyRow {
  id: number; firstName: string; lastName: string; ci: string | null; phone: string | null
  user: { id: number; email: string; isActive: boolean } | null
  students: { relationType: string; isTutor: boolean; student: { id: number; firstName: string; lastName: string } }[]
}

// Listado de familias registradas por Junta Escolar/Delegado — dos vistas:
// "Todos" (cualquier padre/madre/tercero vinculado) y "Solo tutores" (los
// únicos que pueden recibir cargos o ser parte del directorio/delegados).
export default function FamiliasPage() {
  const [rows, setRows] = useState<FamilyRow[]>([])
  const [loading, setLoading] = useState(true)
  const [onlyTutors, setOnlyTutors] = useState(false)
  const [search, setSearch] = useState('')

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : ''

  const fetchRows = () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (search) params.set('search', search)
    if (onlyTutors) params.set('isTutor', 'true')
    fetch(`${API_URL}/api/parents?${params}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : [])
      .then(setRows)
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(fetchRows, [onlyTutors])

  const columns: Column<FamilyRow>[] = [
    { key: 'name', header: 'Nombre', render: r => (
      <div>
        <div className="font-semibold text-brand-700">{r.lastName} {r.firstName}</div>
        {r.ci && <div className="text-[11px] text-neutral-500">CI {r.ci}</div>}
      </div>
    ) },
    { key: 'students', header: 'Estudiante(s)', render: r => (
      <div className="flex flex-col gap-0.5">
        {r.students.map(s => (
          <span key={s.student.id} className="text-[12.5px]">
            {s.student.lastName} {s.student.firstName}
            {s.isTutor && <Badge tone="success" className="ml-1.5">Tutor</Badge>}
          </span>
        ))}
        {r.students.length === 0 && <span className="text-neutral-500 italic text-[12px]">Sin vincular</span>}
      </div>
    ) },
    { key: 'access', header: 'Acceso', render: r => r.user
      ? <Badge tone={r.user.isActive ? 'success' : 'danger'}>{r.user.isActive ? 'Activo' : 'Inactivo'}</Badge>
      : <span className="text-[12px] text-neutral-500 italic">Sin cuenta</span>
    },
  ]

  return (
    <div>
      <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-brand-700 mb-1">Familias registradas</h1>
          <p className="text-[13px] text-neutral-500">Padres, madres y tutores registrados en el colegio</p>
        </div>
        <Link href="/dashboard/padres/familias/nueva">
          <Button><UserPlus size={16}/> Registrar Padre</Button>
        </Link>
      </div>

      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="flex gap-1 bg-neutral-100 rounded-lg p-1">
          <button
            onClick={() => setOnlyTutors(false)}
            className={`px-3 py-1.5 rounded-md text-[12.5px] font-semibold transition-colors ${!onlyTutors ? 'bg-white text-brand-700 shadow-sm' : 'text-neutral-500'}`}
          >
            Todos
          </button>
          <button
            onClick={() => setOnlyTutors(true)}
            className={`px-3 py-1.5 rounded-md text-[12.5px] font-semibold transition-colors ${onlyTutors ? 'bg-white text-brand-700 shadow-sm' : 'text-neutral-500'}`}
          >
            Solo tutores
          </button>
        </div>
        <div className="flex gap-2 flex-1 min-w-[220px]">
          <Input label="" placeholder="Buscar por nombre o CI" value={search} onChange={e => setSearch(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); fetchRows() } }} />
          <Button variant="secondary" onClick={fetchRows}><Search size={14}/></Button>
        </div>
      </div>

      <Table columns={columns} rows={rows} rowKey={r => r.id} loading={loading} emptyLabel="No hay familias registradas todavía" />
    </div>
  )
}
