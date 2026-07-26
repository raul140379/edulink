'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Building2, Layers, GraduationCap, Users, Megaphone, Plus,
  ArrowRight, UserCog,
} from 'lucide-react'
import Card, { CardHeader, CardTitle } from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import { useDistrictConfig } from '@/hooks/useDistrictConfig'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

interface Nucleo { id: number; name: string; location: string | null }

interface School {
  id: number
  name: string
  isActive: boolean
  nucleo: { id: number; name: string } | null
  _count: { students: number; teachers: number; parents: number }
}

type ComunicadoType = 'COMUNICADO' | 'CONVOCATORIA' | 'AVISO'

interface Comunicado {
  id: number
  title: string
  type: ComunicadoType
  isPublished: boolean
  publishedAt: string
}

const TYPE_LABELS: Record<ComunicadoType, string> = {
  COMUNICADO: 'Comunicado', CONVOCATORIA: 'Convocatoria', AVISO: 'Aviso',
}
const TYPE_TONE: Record<ComunicadoType, 'brand' | 'warning' | 'danger'> = {
  COMUNICADO: 'brand', CONVOCATORIA: 'warning', AVISO: 'danger',
}

export default function DistrictHome() {
  const district = useDistrictConfig()
  const [user, setUser] = useState<any>(null)
  const [schools, setSchools] = useState<School[]>([])
  const [nucleos, setNucleos] = useState<Nucleo[]>([])
  const [comunicados, setComunicados] = useState<Comunicado[]>([])
  const [loading, setLoading] = useState(true)

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : ''

  useEffect(() => {
    const userData = localStorage.getItem('user')
    if (userData) setUser(JSON.parse(userData))
    fetchAll()
  }, [])

  const fetchAll = async () => {
    setLoading(true)
    try {
      const headers = { Authorization: `Bearer ${token}` }
      const [sRes, nRes, cRes] = await Promise.all([
        fetch(`${API_URL}/api/schools`, { headers }),
        fetch(`${API_URL}/api/nucleos`, { headers }),
        fetch(`${API_URL}/api/comunicados`, { headers }),
      ])
      const [sData, nData, cData] = await Promise.all([sRes.json(), nRes.json(), cRes.json()])
      if (sRes.ok) setSchools(sData)
      if (nRes.ok) setNucleos(nData)
      if (cRes.ok) setComunicados(cData)
    } catch { console.error('Error cargando el panel distrital') }
    finally { setLoading(false) }
  }

  const greeting = () => {
    const h = new Date().getHours()
    if (h < 12) return 'Buenos días'
    if (h < 18) return 'Buenas tardes'
    return 'Buenas noches'
  }

  const totals = schools.reduce(
    (acc, s) => ({
      students: acc.students + s._count.students,
      teachers: acc.teachers + s._count.teachers,
      parents:  acc.parents + s._count.parents,
    }),
    { students: 0, teachers: 0, parents: 0 },
  )

  const statCards = [
    { label: 'Núcleos escolares',  value: nucleos.length,      icon: Layers,        bg: 'bg-brand-100',   fg: 'text-brand-700',   href: null },
    { label: 'Unidades educativas', value: schools.length,     icon: Building2,     bg: 'bg-info-500/15', fg: 'text-info-500',    href: '/dashboard/admin/colegios' },
    { label: 'Estudiantes',         value: totals.students,    icon: GraduationCap, bg: 'bg-success-100', fg: 'text-success-700', href: '/dashboard/admin/estudiantes' },
    { label: 'Maestros',            value: totals.teachers,    icon: Users,         fg: 'text-accent-600', bg: 'bg-accent-500/15', href: '/dashboard/admin/maestros' },
  ]

  return (
    <div>
      {/* Saludo */}
      <div className="bg-brand-700 rounded-2xl px-7 py-6 flex items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-white text-xl font-bold mb-1.5">{greeting()}, {user?.email?.split('@')[0]} 👋</h1>
          <p className="text-info-500 text-[13px]">Panel del {district.name} — visión general de todas las unidades educativas</p>
        </div>
        <div className="bg-accent-500 text-[#3A2F00] text-xs font-bold px-3.5 py-1.5 rounded-full whitespace-nowrap shrink-0">
          Gestión {new Date().getFullYear()}
        </div>
      </div>

      {/* Estadísticas */}
      <div className="grid gap-4 mb-6" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
        {statCards.map((s) => {
          const Icon = s.icon
          const content = (
            <Card className="flex items-center gap-4 h-full">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${s.bg} ${s.fg}`}>
                <Icon size={22} />
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-[22px] font-bold text-brand-700">{loading ? '...' : s.value}</span>
                <span className="text-[13px] font-medium text-brand-700">{s.label}</span>
              </div>
            </Card>
          )
          return s.href
            ? <Link key={s.label} href={s.href} className="hover:shadow-md transition-shadow rounded-xl">{content}</Link>
            : <div key={s.label}>{content}</div>
        })}
      </div>

      <div className="grid gap-4 mb-6" style={{ gridTemplateColumns: '1.3fr 1fr' }}>
        {/* Unidades educativas */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Building2 size={16} /> Unidades educativas</CardTitle>
            <Link href="/dashboard/admin/colegios" className="text-[12.5px] font-semibold text-brand-600 flex items-center gap-1 hover:text-brand-700">
              Ver todas <ArrowRight size={13} />
            </Link>
          </CardHeader>
          {loading ? (
            <p className="text-sm text-neutral-500 py-6 text-center">Cargando...</p>
          ) : schools.length === 0 ? (
            <p className="text-sm text-neutral-500 py-6 text-center">No hay unidades educativas registradas todavía</p>
          ) : (
            <div className="flex flex-col gap-2">
              {schools.map((s) => (
                <div key={s.id} className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg bg-neutral-100/60">
                  <div className="min-w-0">
                    <div className="text-[13.5px] font-semibold text-brand-700 truncate">{s.name}</div>
                    <div className="text-[11px] text-neutral-500">{s.nucleo ? `Núcleo ${s.nucleo.name}` : 'Sin núcleo asignado'}</div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {!s.isActive && <Badge tone="danger">Inactiva</Badge>}
                    <Badge tone="info">{s._count.students} est.</Badge>
                    <Badge tone="neutral">{s._count.teachers} doc.</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Accesos rápidos */}
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><UserCog size={16} /> Accesos rápidos</CardTitle></CardHeader>
          <div className="flex flex-col gap-1">
            <Link href="/dashboard/admin/colegios" className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[13px] text-brand-700 hover:bg-neutral-100 transition-colors">
              <Building2 size={16} /> Registrar unidad educativa
            </Link>
            <Link href="/dashboard/admin/comunicados" className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[13px] text-brand-700 hover:bg-neutral-100 transition-colors">
              <Megaphone size={16} /> Publicar comunicado
            </Link>
            <Link href="/dashboard/admin/usuarios" className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[13px] text-brand-700 hover:bg-neutral-100 transition-colors">
              <Users size={16} /> Gestionar usuarios
            </Link>
          </div>
        </Card>
      </div>

      {/* Comunicados recientes */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Megaphone size={16} /> Comunicados recientes</CardTitle>
          <div className="flex items-center gap-3">
            <Link href="/dashboard/admin/comunicados" className="text-[12.5px] font-semibold text-brand-600 flex items-center gap-1 hover:text-brand-700">
              Ver todos <ArrowRight size={13} />
            </Link>
            <Button size="sm" onClick={() => window.location.href = '/dashboard/admin/comunicados'}>
              <Plus size={14} /> Nuevo
            </Button>
          </div>
        </CardHeader>
        {loading ? (
          <p className="text-sm text-neutral-500 py-6 text-center">Cargando...</p>
        ) : comunicados.length === 0 ? (
          <p className="text-sm text-neutral-500 py-6 text-center">No hay comunicados publicados todavía</p>
        ) : (
          <div className="flex flex-col gap-2">
            {comunicados.slice(0, 3).map((c) => (
              <div key={c.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-neutral-100/60">
                <Badge tone={TYPE_TONE[c.type]}>{TYPE_LABELS[c.type]}</Badge>
                <span className="text-[13.5px] font-medium text-brand-700 flex-1 truncate">{c.title}</span>
                {!c.isPublished && <Badge tone="neutral">Despublicado</Badge>}
                <span className="text-[11px] text-neutral-500 shrink-0">{new Date(c.publishedAt).toLocaleDateString('es-BO')}</span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
