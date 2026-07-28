'use client'

import { useEffect, useState } from 'react'
import { ClipboardList, Clock, CheckCircle, BookOpen, Filter, PartyPopper } from 'lucide-react'
import Card from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import { Select } from '@/components/ui/Input'
import { useGamification } from '../_gamification/GamificationContext'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

interface Task {
  id:           number
  title:        string
  description:  string | null
  type:         string
  maxScore:     number
  dueDate:      string | null
  subject:      { id: number; name: string; campo?: string | null }
  teacher:      string
  trimester:    { id: number; number: number; name?: string } | null
  submissionId: number | null
  score:        number | null
  status:       string
  note:         string | null
  submittedAt:  string | null
  gradedAt:     string | null
}

const TYPE_LABEL: Record<string, string> = {
  EVALUACION: 'Evaluación',
  TRABAJO:    'Trabajo',
  SER:        'Ser',
  DECIDIR:    'Decidir',
}

const TYPE_TONE: Record<string, 'danger' | 'brand' | 'success' | 'warning'> = {
  EVALUACION: 'danger',
  TRABAJO:    'brand',
  SER:        'success',
  DECIDIR:    'warning',
}

const STATUS_LABEL: Record<string, string> = { PENDIENTE: 'Pendiente', ENTREGADO: 'Entregado', CALIFICADO: 'Calificado' }
const STATUS_TONE: Record<string, 'warning' | 'brand' | 'success'> = { PENDIENTE: 'warning', ENTREGADO: 'brand', CALIFICADO: 'success' }

export default function TareasPage() {
  const { applyServerUpdate } = useGamification()
  const [tasks,         setTasks]         = useState<Task[]>([])
  const [loading,       setLoading]       = useState(true)
  const [filterStatus,  setFilterStatus]  = useState<'todos' | 'PENDIENTE' | 'ENTREGADO' | 'CALIFICADO'>('todos')
  const [filterType,    setFilterType]    = useState<string>('todos')
  const [filterSubject, setFilterSubject] = useState<string>('todos')
  const [deliveringId,  setDeliveringId]  = useState<number | null>(null)
  const [celebratingId, setCelebratingId] = useState<number | null>(null)

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) return
    fetch(`${API_URL}/api/students/my-tasks`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(d => { setTasks(Array.isArray(d) ? d : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const handleDeliver = async (task: Task) => {
    if (!task.submissionId || deliveringId) return
    setDeliveringId(task.submissionId)
    const token = localStorage.getItem('token')
    try {
      const res = await fetch(`${API_URL}/api/students/tasks/${task.submissionId}/deliver`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) return
      const data = await res.json()
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: 'ENTREGADO', submittedAt: data.submission.submittedAt } : t))
      setCelebratingId(task.id)
      if (data.onTime) {
        applyServerUpdate({ xp: data.xp, level: data.level, xpIntoLevel: data.xpIntoLevel, xpForNextLevel: data.xpForNextLevel, progressPct: data.progressPct })
      }
      setTimeout(() => setCelebratingId(null), 900)
    } finally {
      setDeliveringId(null)
    }
  }

  const materias    = [...new Set(tasks.map(t => t.subject.name))]
  const tipos       = [...new Set(tasks.map(t => t.type))]
  const pendientes  = tasks.filter(t => t.status === 'PENDIENTE').length
  const calificadas = tasks.filter(t => t.status === 'CALIFICADO').length
  const promedio    = tasks.filter(t => t.score !== null).length
    ? (tasks.filter(t => t.score !== null).reduce((s, t) => s + (t.score ?? 0), 0) /
       tasks.filter(t => t.score !== null).length).toFixed(1)
    : '—'

  const tareasFiltradas = tasks.filter(t => {
    if (filterStatus  !== 'todos' && t.status       !== filterStatus)      return false
    if (filterType    !== 'todos' && t.type         !== filterType)        return false
    if (filterSubject !== 'todos' && t.subject.name !== filterSubject)     return false
    return true
  }).sort((a, b) => {
    const campoA = a.subject.campo || 'ZZZ'
    const campoB = b.subject.campo || 'ZZZ'
    if (campoA !== campoB) return campoA.localeCompare(campoB)
    return a.subject.name.localeCompare(b.subject.name)
  })

  const formatDate = (d?: string | null) => {
    if (!d) return null
    return new Date(d).toLocaleDateString('es-BO', { day:'2-digit', month:'short', year:'numeric' })
  }

  const isOverdue = (dueDate?: string | null, status?: string) => {
    if (!dueDate || status !== 'PENDIENTE') return false
    return new Date(dueDate) < new Date()
  }

  if (loading) return <div className="flex justify-center py-16"><p className="text-sm text-neutral-500">Cargando...</p></div>

  return (
    <div>
      {/* Header */}
      <div
        className="rounded-xl px-6 py-5 mb-6 text-white"
        style={{ background: 'linear-gradient(90deg, #3B5BDB, #5B7CF0)' }}
      >
        <div className="flex items-center gap-1.5 text-[13px] text-white/75 mb-1"><ClipboardList size={14}/> Tareas y Actividades</div>
        <div className="text-xl font-extrabold">📝 Lo que tenés pendiente</div>
        <div className="text-[13px] text-white/80 mt-1">
          {pendientes === 0 ? '¡Sin pendientes, la estás rompiendo! 🔥' : `Dale, te quedan ${pendientes} por entregar 💪`}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <Card className="flex flex-col gap-2">
          <div className="flex items-center gap-2 text-[#BA7517]">
            <Clock size={18}/>
            <span className="text-[11px] font-semibold uppercase tracking-wide bg-accent-500 px-2 py-0.5 rounded-full" style={{ color: '#3A2F00' }}>Pendientes</span>
          </div>
          <div className="text-[28px] font-extrabold text-brand-700">{pendientes}</div>
        </Card>
        <Card className="flex flex-col gap-2">
          <div className="flex items-center gap-2 text-success-700">
            <CheckCircle size={18}/>
            <span className="text-[11px] font-semibold uppercase tracking-wide bg-accent-500 px-2 py-0.5 rounded-full" style={{ color: '#3A2F00' }}>Calificadas</span>
          </div>
          <div className="text-[28px] font-extrabold text-brand-700">{calificadas}</div>
        </Card>
        <Card className="flex flex-col gap-2">
          <div className="flex items-center gap-2 text-brand-700">
            <BookOpen size={18}/>
            <span className="text-[11px] font-semibold uppercase tracking-wide bg-accent-500 px-2 py-0.5 rounded-full" style={{ color: '#3A2F00' }}>Promedio</span>
          </div>
          <div className="text-[28px] font-extrabold text-brand-700">{promedio}</div>
        </Card>
      </div>

      {/* Filtros */}
      <Card className="flex flex-wrap gap-4 items-center mb-5">
        <div className="flex items-center gap-1.5">
          <Filter size={14} className="text-neutral-500"/>
          <span className="text-xs text-neutral-500 font-semibold">Filtros:</span>
        </div>

        <div className="flex gap-1.5 items-center">
          <span className="text-[11px] text-neutral-500">Estado:</span>
          {[
            { label:'Todos',      value:'todos'      },
            { label:'Pendiente',  value:'PENDIENTE'  },
            { label:'Entregado',  value:'ENTREGADO'  },
            { label:'Calificado', value:'CALIFICADO' },
          ].map(opt => (
            <button
              key={opt.value} onClick={() => setFilterStatus(opt.value as 'todos' | 'PENDIENTE' | 'ENTREGADO' | 'CALIFICADO')}
              className={`px-3 py-1 rounded-full text-xs transition-colors ${filterStatus === opt.value ? 'bg-brand-700 text-white font-semibold' : 'bg-neutral-100 text-brand-700 hover:bg-brand-100'}`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="flex gap-1.5 items-center flex-wrap">
          <span className="text-[11px] text-neutral-500">Tipo:</span>
          <button
            onClick={() => setFilterType('todos')}
            className={`px-3 py-1 rounded-full text-xs transition-colors ${filterType === 'todos' ? 'bg-brand-700 text-white font-semibold' : 'bg-neutral-100 text-brand-700 hover:bg-brand-100'}`}
          >
            Todos
          </button>
          {tipos.map(t => (
            <button
              key={t} onClick={() => setFilterType(t)}
              className={`px-3 py-1 rounded-full text-xs transition-colors ${filterType === t ? 'bg-brand-700 text-white font-semibold' : 'bg-neutral-100 text-brand-700 hover:bg-brand-100'}`}
            >
              {TYPE_LABEL[t] || t}
            </button>
          ))}
        </div>

        {materias.length > 1 && (
          <div className="flex gap-1.5 items-center">
            <span className="text-[11px] text-neutral-500">Materia:</span>
            <Select value={filterSubject} onChange={e => setFilterSubject(e.target.value)} className="!h-8 !text-xs w-auto">
              <option value="todos">Todas</option>
              {materias.map(m => <option key={m} value={m}>{m}</option>)}
            </Select>
          </div>
        )}
      </Card>

      {/* Lista de tareas */}
      {tareasFiltradas.length === 0 ? (
        <Card className="text-center py-12">
          <ClipboardList size={40} className="mx-auto mb-3 opacity-40"/>
          <div className="text-[15px] text-neutral-500">
            {tasks.length === 0 ? '¡Sin tareas por acá, la estás rompiendo! 🔥' : 'Nada por acá con esos filtros — probá con otro 🔍'}
          </div>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {tareasFiltradas.map(task => {
            const overdue = isOverdue(task.dueDate, task.status)
            const pct     = task.score !== null ? Math.round((task.score / task.maxScore) * 100) : null
            const passed  = task.score !== null && task.score >= (task.maxScore * 0.51)

            return (
              <Card key={task.id} padded={false} className={`relative overflow-hidden ${overdue ? '!border-danger-100' : ''} ${celebratingId === task.id ? 'gm-bounce-once' : ''}`}>
                {celebratingId === task.id && <span className="gm-float-emoji">🎉</span>}
                <div className="flex items-stretch">
                  <div className={`w-1 shrink-0 ${TYPE_TONE[task.type] === 'danger' ? 'bg-danger-500' : TYPE_TONE[task.type] === 'success' ? 'bg-success-500' : TYPE_TONE[task.type] === 'warning' ? 'bg-warning-500' : 'bg-brand-700'}`}/>
                  <div className="flex-1 px-4.5 py-4 flex gap-4 items-center">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <Badge tone={TYPE_TONE[task.type] || 'neutral'}>{TYPE_LABEL[task.type] || task.type}</Badge>
                        <Badge tone={STATUS_TONE[task.status] || 'warning'}>{STATUS_LABEL[task.status] || task.status}</Badge>
                        {overdue && <Badge tone="danger">Vencido</Badge>}
                      </div>
                      <div className="text-[15px] font-bold text-brand-700 mb-1">{task.title}</div>
                      {task.description && <div className="text-xs text-neutral-500 mb-1.5 leading-relaxed">{task.description}</div>}
                      <div className="flex gap-4 flex-wrap">
                        <span className="text-xs text-neutral-500">📚 {task.subject.name}</span>
                        <span className="text-xs text-neutral-500">👤 {task.teacher}</span>
                        {task.trimester && <span className="text-xs text-neutral-500">📅 {task.trimester.name || `${task.trimester.number}er Trimestre`}</span>}
                        {task.dueDate && (
                          <span className={`text-xs ${overdue ? 'text-danger-600 font-semibold' : 'text-neutral-500'}`}>
                            ⏰ Entrega: {formatDate(task.dueDate)}
                          </span>
                        )}
                      </div>
                      {task.note && (
                        <div className="mt-2 px-3 py-2 rounded-lg bg-neutral-100 text-xs text-brand-700">💬 {task.note}</div>
                      )}
                    </div>

                    <div className="shrink-0 text-center" style={{ minWidth: 80 }}>
                      {task.score !== null ? (
                        <div>
                          <div className={`text-[32px] font-extrabold ${passed ? 'text-success-700' : 'text-danger-600'}`}>{task.score}</div>
                          <div className="text-[11px] text-neutral-500">de {task.maxScore}</div>
                          {pct !== null && (
                            <div className="mt-1.5">
                              <div className="h-1 bg-neutral-100 rounded overflow-hidden" style={{ width: 70 }}>
                                <div className={`h-full rounded ${passed ? 'bg-success-500' : 'bg-danger-500'}`} style={{ width: `${Math.min(pct, 100)}%` }}/>
                              </div>
                              <div className="text-[10px] text-neutral-500 mt-0.5">{pct}%</div>
                            </div>
                          )}
                        </div>
                      ) : task.status === 'ENTREGADO' ? (
                        <div className="flex flex-col items-center gap-1">
                          <CheckCircle size={22} className="text-brand-600" />
                          <div className="text-[11px] text-brand-600 font-semibold">Entregada</div>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-2">
                          <div>
                            <div className="text-[11px] text-[#BA7517] font-semibold">Sin nota</div>
                            <div className="text-[10px] text-neutral-500 mt-0.5">Máx: {task.maxScore}</div>
                          </div>
                          <button
                            onClick={() => handleDeliver(task)}
                            disabled={deliveringId === task.submissionId}
                            className="flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full border border-neutral-300 text-neutral-500 hover:border-brand-600 hover:text-brand-600 hover:bg-brand-100 transition-colors disabled:opacity-50"
                          >
                            <PartyPopper size={12} /> Marcar lista
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      <style>{`
        @keyframes gm-bounce-once { 0%,100% { transform: scale(1); } 35% { transform: scale(1.015); } 60% { transform: scale(0.995); } }
        .gm-bounce-once { animation: gm-bounce-once 400ms ease-out; }
        @keyframes gm-float-fade { from { opacity: 1; transform: translateY(0); } to { opacity: 0; transform: translateY(-28px); } }
        .gm-float-emoji { position: absolute; top: 6px; right: 22px; font-size: 18px; animation: gm-float-fade 900ms ease-out forwards; pointer-events: none; z-index: 5; }
      `}</style>
    </div>
  )
}
