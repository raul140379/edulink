'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Building2, Megaphone, ArrowRight } from 'lucide-react'
import Card, { CardHeader, CardTitle } from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

interface School { id: number; name: string; isActive: boolean }
type ComunicadoType = 'COMUNICADO' | 'CONVOCATORIA' | 'AVISO'
interface Comunicado { id: number; title: string; type: ComunicadoType; publishedAt: string }

const TYPE_LABELS: Record<ComunicadoType, string> = { COMUNICADO: 'Comunicado', CONVOCATORIA: 'Convocatoria', AVISO: 'Aviso' }
const TYPE_TONE: Record<ComunicadoType, 'brand' | 'warning' | 'danger'> = { COMUNICADO: 'brand', CONVOCATORIA: 'warning', AVISO: 'danger' }

// Home del Gobierno Estudiantil de Núcleo — análogo a padres/_JuntaNucleoHome.tsx
// pero desde la óptica estudiantil.
export default function GobiernoNucleoHome() {
  const [user, setUser] = useState<any>(null)
  const [schools, setSchools] = useState<School[]>([])
  const [comunicados, setComunicados] = useState<Comunicado[]>([])
  const [loading, setLoading] = useState(true)

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : ''

  useEffect(() => {
    const raw = localStorage.getItem('user')
    if (raw) setUser(JSON.parse(raw))
    const headers = { Authorization: `Bearer ${token}` }
    Promise.all([
      fetch(`${API_URL}/api/schools`, { headers }).then(r => r.ok ? r.json() : []),
      fetch(`${API_URL}/api/comunicados`, { headers }).then(r => r.ok ? r.json() : []),
    ]).then(([s, c]) => { setSchools(s); setComunicados(c) })
      .catch(() => {}).finally(() => setLoading(false))
  }, [])

  const greeting = () => {
    const h = new Date().getHours()
    return h < 12 ? 'Buenos días' : h < 18 ? 'Buenas tardes' : 'Buenas noches'
  }

  return (
    <div>
      <div className="bg-brand-700 rounded-2xl px-7 py-6 flex items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-white text-xl font-bold mb-1.5">{greeting()}, {user?.email?.split('@')[0]} 👋</h1>
          <p className="text-info-500 text-[13px]">Gobierno Estudiantil de Núcleo</p>
        </div>
        <div className="bg-accent-500 text-[#3A2F00] text-xs font-bold px-3.5 py-1.5 rounded-full whitespace-nowrap shrink-0">
          Gestión {new Date().getFullYear()}
        </div>
      </div>

      <div className="grid gap-4 mb-6" style={{ gridTemplateColumns: '1.3fr 1fr' }}>
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Building2 size={16}/> Colegios de tu núcleo</CardTitle></CardHeader>
          {loading ? (
            <p className="text-sm text-neutral-500 py-6 text-center">Cargando...</p>
          ) : schools.length === 0 ? (
            <p className="text-sm text-neutral-500 py-6 text-center">No hay colegios en tu núcleo todavía</p>
          ) : (
            <div className="flex flex-col gap-2">
              {schools.map(s => (
                <div key={s.id} className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg bg-neutral-100/60">
                  <span className="text-[13.5px] font-semibold text-brand-700 truncate">{s.name}</span>
                  {!s.isActive && <Badge tone="danger">Inactiva</Badge>}
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Megaphone size={16}/> Accesos rápidos</CardTitle></CardHeader>
          <div className="flex flex-col gap-1">
            <Link href="/dashboard/estudiantes/comunicados" className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[13px] text-brand-700 hover:bg-neutral-100 transition-colors">
              <Megaphone size={16}/> Publicar comunicado / convocatoria
            </Link>
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Megaphone size={16}/> Comunicados recientes</CardTitle>
          <Link href="/dashboard/estudiantes/comunicados" className="text-[12.5px] font-semibold text-brand-600 flex items-center gap-1 hover:text-brand-700">
            Ver todos <ArrowRight size={13}/>
          </Link>
        </CardHeader>
        {loading ? (
          <p className="text-sm text-neutral-500 py-6 text-center">Cargando...</p>
        ) : comunicados.length === 0 ? (
          <p className="text-sm text-neutral-500 py-6 text-center">No hay comunicados publicados todavía</p>
        ) : (
          <div className="flex flex-col gap-2">
            {comunicados.slice(0, 3).map(c => (
              <div key={c.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-neutral-100/60">
                <Badge tone={TYPE_TONE[c.type]}>{TYPE_LABELS[c.type]}</Badge>
                <span className="text-[13.5px] font-medium text-brand-700 flex-1 truncate">{c.title}</span>
                <span className="text-[11px] text-neutral-500 shrink-0">{new Date(c.publishedAt).toLocaleDateString('es-BO')}</span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
