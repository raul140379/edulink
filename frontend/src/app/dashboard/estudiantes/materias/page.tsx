'use client'

import { useEffect, useState } from 'react'
import { BookOpen, Clock, CheckCircle, AlertCircle, User } from 'lucide-react'
import Card from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

interface Trimestre { id: number; number: number; name?: string }

interface Materia {
  subjectId:    number
  subjectName:  string
  campo:        string | null
  hoursPerWeek: number
  teacher:      { id: number; firstName: string; lastName: string; specialty: string | null }
  trimestres:   Trimestre[]
  notas:        Record<number, number>
  avg:          number | null
  aprobado:     boolean | null
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

export default function MateriasPage() {
  const [materias,    setMaterias]    = useState<Materia[]>([])
  const [loading,     setLoading]     = useState(true)
  const [filterCampo, setFilterCampo] = useState<string>('todos')

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) return
    fetch(`${API_URL}/api/students/my-subjects`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(d => { setMaterias(Array.isArray(d) ? d : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const campos     = [...new Set(materias.map(m => m.campo).filter(Boolean))] as string[]
  const aprobadas  = materias.filter(m => m.aprobado === true).length
  const reprobadas = materias.filter(m => m.aprobado === false).length
  const totalHoras = materias.reduce((s, m) => s + (m.hoursPerWeek || 0), 0)

  const filtradas = materias.filter(m =>
    filterCampo === 'todos' || m.campo === filterCampo
  )

  const trimLabel = (t: Trimestre) => t.name || `${t.number}er T.`

  if (loading) return <div className="flex justify-center py-16"><p className="text-sm text-neutral-500">Cargando...</p></div>

  return (
    <div>
      {/* Header */}
      <div
        className="rounded-2xl px-7 py-6 mb-5 text-white"
        style={{ background: 'linear-gradient(135deg, var(--color-brand-700), var(--color-brand-500))' }}
      >
        <div className="flex items-center gap-1.5 text-[13px] text-white/80 mb-1">
          <BookOpen size={14}/> Mis Materias
        </div>
        <div className="text-[22px] font-extrabold">Plan de Estudios</div>
        <div className="text-[13px] text-white/80 mt-1">Materias, maestros y calificaciones de tu curso</div>
      </div>

      {/* Stats */}
      <div className="grid gap-3 mb-5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
        <Card className="!bg-brand-700 !border-brand-700 flex items-center gap-3">
          <BookOpen size={26} className="text-white"/>
          <div><div className="text-[11px] text-white/75 uppercase tracking-wide mb-0.5">Total Materias</div><div className="text-xl font-bold text-white">{materias.length}</div></div>
        </Card>
        <Card className="flex items-center gap-3">
          <Clock size={26} className="text-brand-700"/>
          <div><div className="text-[11px] text-neutral-500 uppercase tracking-wide mb-0.5">Horas / semana</div><div className="text-xl font-bold text-brand-700">{totalHoras}</div></div>
        </Card>
        <Card className="flex items-center gap-3">
          <CheckCircle size={26} className="text-success-700"/>
          <div><div className="text-[11px] text-neutral-500 uppercase tracking-wide mb-0.5">Aprobadas</div><div className="text-xl font-bold text-success-700">{aprobadas}</div></div>
        </Card>
        <Card className="flex items-center gap-3">
          <AlertCircle size={26} className="text-danger-600"/>
          <div><div className="text-[11px] text-neutral-500 uppercase tracking-wide mb-0.5">Reprobadas</div><div className="text-xl font-bold text-danger-600">{reprobadas}</div></div>
        </Card>
      </div>

      {/* Filtro campo */}
      {campos.length > 1 && (
        <Card className="flex gap-2 flex-wrap items-center mb-5">
          <span className="text-[11px] text-neutral-500 font-semibold">Campo:</span>
          <button
            onClick={() => setFilterCampo('todos')}
            className={`px-3 py-1 rounded-full text-xs transition-colors ${filterCampo === 'todos' ? 'bg-brand-700 text-white font-semibold' : 'bg-neutral-100 text-brand-700 hover:bg-brand-100'}`}
          >
            Todos
          </button>
          {campos.map(c => (
            <button
              key={c}
              onClick={() => setFilterCampo(c)}
              className={`px-3 py-1 rounded-full text-xs transition-colors ${filterCampo === c ? 'bg-brand-700 text-white font-semibold' : 'bg-neutral-100 text-brand-700 hover:bg-brand-100'}`}
            >
              {CAMPO_LABEL[c] || c}
            </button>
          ))}
        </Card>
      )}

      {/* Lista de materias */}
      {filtradas.length === 0 ? (
        <Card className="text-center py-12 border-dashed">
          <BookOpen size={40} className="mx-auto mb-3 opacity-30"/>
          <div className="text-neutral-500">No hay materias registradas aún.</div>
        </Card>
      ) : (
        <div className="flex flex-col gap-3.5">
          {filtradas.map(m => (
            <Card key={m.subjectId} padded={false} className="overflow-hidden">
              {/* Header */}
              <div className="flex items-center gap-3.5 p-4.5 bg-neutral-100/60 border-b border-neutral-300/60">
                <div className="flex items-center gap-3.5 flex-1">
                  <div className="w-12 h-12 rounded-[10px] shrink-0 bg-brand-700 text-white flex items-center justify-center text-[11px] font-extrabold text-center leading-tight p-1">
                    {m.subjectName.split(' ').slice(0,2).map(w => w[0]).join('')}
                  </div>
                  <div className="flex-1">
                    <div className="text-[15px] font-bold text-brand-700 mb-1">{m.subjectName}</div>
                    <div className="flex gap-1.5 flex-wrap">
                      {m.campo && <Badge tone={CAMPO_TONE[m.campo] || 'neutral'}>{CAMPO_LABEL[m.campo] || m.campo}</Badge>}
                      {m.hoursPerWeek > 0 && <Badge tone="info"><Clock size={9}/> {m.hoursPerWeek} hrs/sem</Badge>}
                    </div>
                  </div>
                </div>
                <div className="shrink-0 text-center" style={{ minWidth: 70 }}>
                  {m.avg !== null ? (
                    <>
                      <div className={`text-[26px] font-extrabold ${m.aprobado ? 'text-success-700' : 'text-danger-600'}`}>{m.avg.toFixed(1)}</div>
                      <div className="text-[10px] text-neutral-500 mb-1">promedio</div>
                      <Badge tone={m.aprobado ? 'success' : 'danger'}>{m.aprobado ? 'Aprobado' : 'Reprobado'}</Badge>
                    </>
                  ) : (
                    <span className="text-[11px] text-neutral-500">Sin notas</span>
                  )}
                </div>
              </div>

              {/* Maestro + Notas por trimestre */}
              <div className="flex flex-col">
                <div className="flex items-center gap-2 px-4.5 py-2.5 border-b border-neutral-100 bg-neutral-100/30">
                  <User size={13} className="text-neutral-500"/>
                  <span className="text-xs text-neutral-500">Maestro/a:</span>
                  <span className="text-[13px] font-semibold text-brand-700">{m.teacher.lastName} {m.teacher.firstName}</span>
                  {m.teacher.specialty && <span className="text-[11px] text-neutral-500">— {m.teacher.specialty}</span>}
                </div>

                {m.trimestres.length > 0 && (
                  <div className="flex">
                    {m.trimestres.map(t => {
                      const nota = m.notas[t.id]
                      return (
                        <div key={t.id} className="flex-1 px-4 py-3 text-center border-r border-neutral-100">
                          <div className="text-[10px] text-neutral-500 font-semibold mb-1.5 uppercase">{trimLabel(t)}</div>
                          <div className={`text-xl font-extrabold ${nota === undefined ? 'text-neutral-300' : nota >= 51 ? 'text-success-700' : 'text-danger-600'}`}>
                            {nota !== undefined ? nota : '—'}
                          </div>
                        </div>
                      )
                    })}
                    <div className="flex-1 px-4 py-3 text-center bg-neutral-100/40">
                      <div className="text-[10px] text-neutral-500 font-semibold mb-1.5 uppercase">Promedio</div>
                      <div className={`text-xl font-extrabold ${m.avg === null ? 'text-neutral-300' : m.aprobado ? 'text-success-700' : 'text-danger-600'}`}>
                        {m.avg?.toFixed(1) ?? '—'}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
