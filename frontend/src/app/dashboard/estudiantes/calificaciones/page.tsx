'use client'

import { useEffect, useState } from 'react'
import { BookOpen, TrendingUp, CheckCircle, AlertCircle, Award } from 'lucide-react'
import Card from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import Table, { Column } from '@/components/ui/Table'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

interface Trimestre { id: number; number: number; name?: string }

interface NotaMateria {
  subjectId:   number
  subjectName: string
  campo:       string | null
  teacher:     string
  trimestres:  Record<number, number>
  avg:         number | null
}

interface GradesData {
  course:       { grade: string; parallel: string; level: string; shift: string } | null
  academicYear: { year: number } | null
  trimestres:   Trimestre[]
  notas:        NotaMateria[]
}

const CAMPO_LABEL: Record<string, string> = {
  VIDA_TIERRA_TERRITORIO:        'Vida, Tierra y Territorio',
  COMUNIDAD_SOCIEDAD:            'Comunidad y Sociedad',
  COSMOS_PENSAMIENTO:            'Cosmos y Pensamiento',
  CIENCIA_TECNOLOGIA_PRODUCCION: 'Ciencia, Tecnología y Producción',
}

const CAMPO_TONE: Record<string, 'success' | 'brand' | 'warning' | 'info'> = {
  VIDA_TIERRA_TERRITORIO:        'success',
  COMUNIDAD_SOCIEDAD:            'brand',
  COSMOS_PENSAMIENTO:            'warning',
  CIENCIA_TECNOLOGIA_PRODUCCION: 'info',
}

export default function CalificacionesPage() {
  const [data,         setData]         = useState<GradesData | null>(null)
  const [loading,      setLoading]      = useState(true)
  const [selectedTrim, setSelectedTrim] = useState<'todos' | number>('todos')
  const [filterCampo,  setFilterCampo]  = useState<string>('todos')

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) return
    fetch(`${API_URL}/api/students/my-grades`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  if (loading) return <div className="flex justify-center py-16"><p className="text-sm text-neutral-500">Cargando...</p></div>

  if (!data || !data.notas.length) return (
    <Card className="text-center py-12 border-dashed flex flex-col items-center gap-2">
      <BookOpen size={40} className="opacity-40"/>
      <p className="text-[15px] text-neutral-500">No hay calificaciones registradas aún.</p>
    </Card>
  )

  const { trimestres, notas, course, academicYear } = data

  const notasConPromedio = notas.filter(n => n.avg !== null)
  const promedioGeneral  = notasConPromedio.length
    ? (notasConPromedio.reduce((s, n) => s + (n.avg ?? 0), 0) / notasConPromedio.length).toFixed(1)
    : '—'
  const aprobadas  = notasConPromedio.filter(n => (n.avg ?? 0) >= 51).length
  const reprobadas = notasConPromedio.filter(n => (n.avg ?? 0) < 51).length

  const camposDisponibles = [...new Set(notas.map(n => n.campo).filter(Boolean))] as string[]
  const notasFiltradas = notas.filter(n =>
    filterCampo === 'todos' || n.campo === filterCampo
  )

  const scoreClass = (v?: number | null) => {
    if (v === undefined || v === null) return 'text-neutral-500'
    return v >= 51 ? 'text-success-700' : 'text-danger-600'
  }

  const trimLabel = (t: Trimestre) => t.name || `${t.number}er Trim.`

  const columns: Column<NotaMateria>[] = [
    { key: 'materia', header: 'Materia', render: n => <span className="font-semibold text-brand-700">{n.subjectName}</span> },
    {
      key: 'campo', header: 'Campo', render: n => n.campo
        ? <Badge tone={CAMPO_TONE[n.campo] || 'neutral'}>{CAMPO_LABEL[n.campo] || n.campo}</Badge>
        : <span className="text-neutral-500">—</span>
    },
    { key: 'maestro', header: 'Maestro/a', render: n => <span className="text-xs text-neutral-500">{n.teacher}</span> },
    ...(selectedTrim === 'todos'
      ? trimestres.map((t): Column<NotaMateria> => ({
          key: `trim-${t.id}`, header: trimLabel(t), className: 'text-center', render: n => {
            const val = n.trimestres[t.id]
            return val !== undefined
              ? <span className={`font-bold text-[15px] ${scoreClass(val)}`}>{val}</span>
              : <span className="text-neutral-300">—</span>
          }
        }))
      : [{
          key: 'nota', header: 'Nota', className: 'text-center', render: (n: NotaMateria) => {
            const val = n.trimestres[selectedTrim as number]
            return val !== undefined
              ? <span className={`font-bold text-[15px] ${scoreClass(val)}`}>{val}</span>
              : <span className="text-neutral-300">—</span>
          }
        }] as Column<NotaMateria>[]),
    {
      key: 'promedio', header: 'Promedio', className: 'text-center', render: n => (
        <span className={`font-extrabold text-base ${scoreClass(n.avg)}`}>{n.avg?.toFixed(1) ?? '—'}</span>
      )
    },
    {
      key: 'estado', header: 'Estado', className: 'text-center', render: n => {
        if (n.avg === null || n.avg === undefined) return <span className="text-neutral-300 text-xs">Sin notas</span>
        return <Badge tone={n.avg >= 51 ? 'success' : 'danger'}>{n.avg >= 51 ? 'Aprobado' : 'Reprobado'}</Badge>
      }
    },
  ]

  return (
    <div>
      {/* Header */}
      <div
        className="rounded-xl px-6 py-5 mb-6 text-white"
        style={{ background: 'linear-gradient(135deg, var(--color-brand-700), var(--color-brand-500))' }}
      >
        <div className="flex items-center gap-1.5 text-[13px] text-white/75 mb-1">
          <BookOpen size={14}/> Calificaciones
        </div>
        <div className="text-xl font-extrabold">
          {academicYear ? `Gestión ${academicYear.year}` : 'Mis Calificaciones'}
        </div>
        {course && (
          <div className="text-[13px] text-white/80 mt-1">
            {course.grade} {course.parallel} · {course.level} · Turno {course.shift}
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <Card className="flex flex-col gap-2">
          <div className="flex items-center gap-2 text-brand-700"><TrendingUp size={20}/><span className="text-[11px] font-semibold uppercase tracking-wide">Promedio General</span></div>
          <div className="text-[28px] font-extrabold text-brand-700">{promedioGeneral}</div>
        </Card>
        <Card className="flex flex-col gap-2">
          <div className="flex items-center gap-2 text-success-700"><CheckCircle size={20}/><span className="text-[11px] font-semibold uppercase tracking-wide">Aprobadas</span></div>
          <div className="text-[28px] font-extrabold text-brand-700">{aprobadas}</div>
        </Card>
        <Card className="flex flex-col gap-2">
          <div className="flex items-center gap-2 text-danger-600"><AlertCircle size={20}/><span className="text-[11px] font-semibold uppercase tracking-wide">Reprobadas</span></div>
          <div className="text-[28px] font-extrabold text-brand-700">{reprobadas}</div>
        </Card>
      </div>

      {/* Filtros */}
      <div className="flex gap-3 flex-wrap mb-5">
        <div className="flex gap-1.5 items-center flex-wrap">
          <span className="text-xs text-neutral-500 font-semibold">Trimestre:</span>
          {[{ label: 'Todos', value: 'todos' as const }, ...trimestres.map(t => ({ label: trimLabel(t), value: t.id as number | 'todos' }))].map(opt => (
            <button
              key={String(opt.value)}
              onClick={() => setSelectedTrim(opt.value as 'todos' | number)}
              className={`px-3 py-1 rounded-full text-xs transition-colors ${selectedTrim === opt.value ? 'bg-brand-700 text-white font-semibold' : 'bg-neutral-100 text-brand-700 hover:bg-brand-100'}`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        {camposDisponibles.length > 1 && (
          <div className="flex gap-1.5 items-center flex-wrap">
            <span className="text-xs text-neutral-500 font-semibold">Campo:</span>
            <button
              onClick={() => setFilterCampo('todos')}
              className={`px-3 py-1 rounded-full text-xs transition-colors ${filterCampo === 'todos' ? 'bg-brand-700 text-white font-semibold' : 'bg-neutral-100 text-brand-700 hover:bg-brand-100'}`}
            >
              Todos
            </button>
            {camposDisponibles.map(c => (
              <button
                key={c}
                onClick={() => setFilterCampo(c)}
                className={`px-3 py-1 rounded-full text-xs transition-colors ${filterCampo === c ? 'bg-brand-700 text-white font-semibold' : 'bg-neutral-100 text-brand-700 hover:bg-brand-100'}`}
              >
                {CAMPO_LABEL[c] || c}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Tabla de notas */}
      <Card padded={false} className="overflow-hidden">
        <div className="flex items-center gap-2 px-4.5 py-3.5 border-b border-neutral-100">
          <Award size={16} className="text-brand-700"/>
          <span className="font-bold text-sm text-brand-700">Detalle por Materia</span>
        </div>
        <div className="p-4">
          <Table columns={columns} rows={notasFiltradas} rowKey={n => n.subjectId} />
        </div>
      </Card>
    </div>
  )
}
