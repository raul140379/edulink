'use client'

import { useEffect, useState } from 'react'
import { Layers, School as SchoolIcon } from 'lucide-react'
import Card from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

interface School {
  id: number; name: string; isActive: boolean
  shifts: string[]; levels: string[]; tipo: string; area: string
  _count: { students: number; teachers: number }
}

interface Nucleo {
  id: number; name: string; location: string | null
  schools: School[]
}

const TIPO_LABELS: Record<string, string>  = { FISCAL: 'Fiscal', CONVENIO: 'Convenio', PRIVADA: 'Privada' }
const LEVEL_LABELS: Record<string, string> = { INICIAL: 'Inicial', PRIMARIA: 'Primaria', SECUNDARIA: 'Secundaria' }
const SHIFT_LABELS: Record<string, string> = { MORNING: 'Mañana', AFTERNOON: 'Tarde', NIGHT: 'Noche' }
const SHIFT_ORDER: Record<string, number>  = { MORNING: 0, AFTERNOON: 1, NIGHT: 2 }

const shiftRank = (s: School) => Math.min(...(s.shifts.length ? s.shifts.map(t => SHIFT_ORDER[t] ?? 9) : [9]))

export default function NucleosPage() {
  const [nucleos, setNucleos] = useState<Nucleo[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('token')
    fetch(`${API_URL}/api/nucleos`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : [])
      .then((data: Nucleo[]) => {
        const sorted = data.map(n => ({
          ...n,
          schools: [...n.schools].sort((a, b) => shiftRank(a) - shiftRank(b) || a.name.localeCompare(b.name)),
        }))
        setNucleos(sorted)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="flex justify-center py-16"><p className="text-sm text-neutral-500">Cargando...</p></div>

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-brand-700 mb-1">Núcleos Escolares</h1>
        <p className="text-[13px] text-neutral-500">Unidades educativas agrupadas por núcleo</p>
      </div>

      {nucleos.length === 0 ? (
        <Card className="text-center py-12 text-neutral-500">
          <Layers size={40} className="mx-auto mb-3 text-neutral-300"/>
          <p>No hay núcleos registrados todavía</p>
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {nucleos.map(n => (
            <Card key={n.id} padded={false} className="overflow-hidden">
              <div className="flex items-center justify-between gap-3 px-4.5 py-3.5 bg-neutral-100 border-b border-neutral-100">
                <div className="flex items-center gap-2 text-sm font-bold text-brand-700">
                  <Layers size={16} className="text-info-500"/> Núcleo {n.name}
                  {n.location && <span className="text-[11px] font-normal text-neutral-500">· {n.location}</span>}
                </div>
                <Badge tone="brand">{n.schools.length} {n.schools.length === 1 ? 'colegio' : 'colegios'}</Badge>
              </div>

              {n.schools.length === 0 ? (
                <p className="text-[13px] text-neutral-500 text-center py-6">Sin colegios asignados a este núcleo</p>
              ) : (
                <div className="flex flex-col">
                  {n.schools.map(s => (
                    <div key={s.id} className="flex items-center gap-3 px-4.5 py-2.5 border-t border-neutral-100 first:border-t-0">
                      <SchoolIcon size={16} className="text-brand-700 shrink-0"/>
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] font-semibold text-brand-700 truncate">{s.name}</div>
                        <div className="flex gap-1.5 flex-wrap mt-1">
                          <Badge tone="info">{TIPO_LABELS[s.tipo] || s.tipo}</Badge>
                          {s.levels.map(l => <Badge key={l} tone="brand">{LEVEL_LABELS[l] || l}</Badge>)}
                          {s.shifts.map(t => <Badge key={t} tone="neutral">{SHIFT_LABELS[t] || t}</Badge>)}
                          {!s.isActive && <Badge tone="danger">Inactiva</Badge>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge tone="success">{s._count.students} est.</Badge>
                        <Badge tone="neutral">{s._count.teachers} doc.</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
