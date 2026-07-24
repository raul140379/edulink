'use client'

import { useEffect, useState } from 'react'
import Card from '@/components/ui/Card'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

interface ScheduleItem {
  id: number; dayOfWeek: number; period: number
  startTime: string; endTime: string; status: string
  course: { id: number; grade: string; parallel: string; level: string; shift: string }
  teacherSubjectCourse: {
    subject: { name: string; campo?: string }
  }
}

const GRADES: Record<string,string> = { PRIMERO:'1°', SEGUNDO:'2°', TERCERO:'3°', CUARTO:'4°', QUINTO:'5°', SEXTO:'6°' }
const DAYS = ['', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

const SUBJECT_EMOJI: Record<string,string> = {
  'Matemática':                                  '🔢',
  'Lenguas Castellana y Originaria':             '📖',
  'Lengua Extranjera':                           '🌍',
  'Ciencias Sociales':                           '🏛️',
  'Ciencias Naturales: Biología':                '🧬',
  'Física':                                      '⚛️',
  'Química':                                     '🧪',
  'Educación Física y Deportes':                 '⚽',
  'Educación Musical':                           '🎵',
  'Artes Plásticas y Visuales':                  '🎨',
  'Cosmovisiones y Filosofía':                   '🌌',
  'Valores, Espiritualidad y Religiones':        '☮️',
  'Psicología':                                  '🧠',
  'Técnica Tecnológica General':                 '⚙️',
  'Técnica Tecnológica General y Especializada': '🔧',
}

export default function TeacherHorarioPage() {
  const [schedule, setSchedule] = useState<ScheduleItem[]>([])
  const [loading,  setLoading]  = useState(true)
  const [view,     setView]     = useState<'grilla'|'lista'>('grilla')

  const auth = () => ({ Authorization: `Bearer ${localStorage.getItem('token') || ''}` })

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const res  = await fetch(`${API}/api/schedules/my-schedule`, { headers: auth() })
        const data = await res.json()
        if (res.ok) {
          const items = data.flatMap((d:any) => d.periods || [])
          setSchedule(items)
        }
      } catch { console.error('Error') }
      finally { setLoading(false) }
    }
    load()
  }, [])

  const days    = [...new Set(schedule.map(s => s.dayOfWeek))].sort()
  const periods = [...new Set(schedule.map(s => s.period))].sort((a,b)=>a-b)

  const getCell = (day: number, period: number) =>
    schedule.find(s => s.dayOfWeek === day && s.period === period)

  const byDay: Record<number, ScheduleItem[]> = {}
  schedule.forEach(s => {
    if (!byDay[s.dayOfWeek]) byDay[s.dayOfWeek] = []
    byDay[s.dayOfWeek].push(s)
  })

  const totalClases   = schedule.length
  const totalCursos   = new Set(schedule.map(s => s.course.id)).size
  const totalMaterias = new Set(schedule.map(s => s.teacherSubjectCourse.subject.name)).size

  if (loading) return <div className="flex justify-center py-16"><p className="text-sm text-neutral-500">Cargando...</p></div>

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-brand-700 mb-1">Mi Horario Semanal</h1>
        <p className="text-[13px] text-neutral-500">Distribución de clases por día y periodo</p>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-5">
        <Card>
          <div className="text-2xl font-extrabold text-brand-700">{totalClases}</div>
          <div className="text-[11px] font-semibold text-brand-700 mt-0.5">Total clases/semana</div>
        </Card>
        <Card>
          <div className="text-2xl font-extrabold text-brand-700">{totalCursos}</div>
          <div className="text-[11px] font-semibold text-brand-700 mt-0.5">Cursos</div>
        </Card>
        <Card>
          <div className="text-2xl font-extrabold text-success-700">{totalMaterias}</div>
          <div className="text-[11px] font-semibold text-success-700 mt-0.5">Materias</div>
        </Card>
      </div>

      {schedule.length === 0 ? (
        <Card className="text-center py-12 border-dashed">
          <div className="text-4xl mb-3">📅</div>
          <p className="text-neutral-500">No tienes horario asignado aún.</p>
          <p className="text-xs text-neutral-500 mt-1">Contacta al administrador para que asigne tu horario.</p>
        </Card>
      ) : (
        <>
          <div className="flex gap-2 mb-4">
            {(['grilla','lista'] as const).map(v => (
              <button
                key={v} onClick={() => setView(v)}
                className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-colors ${view === v ? 'bg-brand-700 text-white' : 'bg-neutral-100 text-brand-700 hover:bg-brand-100'}`}
              >
                {v === 'grilla' ? '📊 Grilla' : '📋 Lista'}
              </button>
            ))}
          </div>

          {view === 'grilla' && (
            <div className="overflow-x-auto rounded-[10px] border border-neutral-300">
              <table className="border-collapse w-full" style={{ minWidth: 600 }}>
                <thead>
                  <tr>
                    <th className="p-2.5 bg-neutral-100 text-xs font-bold text-brand-700 text-center border border-neutral-300">Periodo</th>
                    {days.map(d => (
                      <th key={d} className="p-2.5 bg-neutral-100 text-xs font-bold text-brand-700 text-center border border-neutral-300">{DAYS[d]}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {periods.map(period => {
                    const firstCell = schedule.find(s => s.period === period)
                    return (
                      <tr key={period}>
                        <td className="p-2 border border-neutral-300 align-top text-center bg-neutral-100/60 font-bold text-[11px] whitespace-nowrap">
                          <div className="text-brand-700">P{period}</div>
                          {firstCell && (
                            <>
                              <div className="text-[10px] text-neutral-500">{firstCell.startTime}</div>
                              <div className="text-[10px] text-neutral-500">{firstCell.endTime}</div>
                            </>
                          )}
                        </td>
                        {days.map(day => {
                          const cell = getCell(day, period)
                          return (
                            <td
                              key={day}
                              className={`p-2 align-top ${cell ? 'bg-brand-100/40 border border-neutral-300' : 'bg-neutral-100/30 border border-dashed border-neutral-300'}`}
                              style={{ minWidth: 120 }}
                            >
                              {cell ? (
                                <div>
                                  <div className="text-base mb-0.5">{SUBJECT_EMOJI[cell.teacherSubjectCourse.subject.name]||'📚'}</div>
                                  <div className="text-[11px] font-bold text-brand-700 leading-tight">{cell.teacherSubjectCourse.subject.name}</div>
                                  <div className="text-[10px] text-neutral-500 mt-0.5">{GRADES[cell.course.grade]} &quot;{cell.course.parallel}&quot;</div>
                                </div>
                              ) : (
                                <div className="text-center text-neutral-300 text-lg">—</div>
                              )}
                            </td>
                          )
                        })}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {view === 'lista' && (
            <div className="flex flex-col gap-3">
              {Object.entries(byDay).sort(([a],[b]) => parseInt(a) - parseInt(b)).map(([day, items]) => (
                <Card key={day} padded={false} className="overflow-hidden">
                  <div className="bg-brand-100 px-4 py-2.5 font-bold text-[13px] text-brand-700 border-b border-neutral-300/60">
                    📅 {DAYS[parseInt(day)]}
                  </div>
                  <div className="flex flex-col">
                    {items.sort((a,b) => a.period - b.period).map(item => (
                      <div key={item.id} className="flex items-center gap-3.5 px-4 py-3 border-t border-neutral-100 first:border-t-0">
                        <div className="text-center min-w-[50px]">
                          <div className="text-[11px] font-bold text-brand-700">P{item.period}</div>
                          <div className="text-[10px] text-neutral-500">{item.startTime}</div>
                          <div className="text-[10px] text-neutral-500">{item.endTime}</div>
                        </div>
                        <div className="text-xl">{SUBJECT_EMOJI[item.teacherSubjectCourse.subject.name]||'📚'}</div>
                        <div className="flex-1">
                          <div className="font-bold text-[13px] text-brand-700">{item.teacherSubjectCourse.subject.name}</div>
                          <div className="text-xs text-neutral-500 mt-0.5">{GRADES[item.course.grade]} &quot;{item.course.parallel}&quot;</div>
                        </div>
                        <div className="bg-brand-100 text-brand-700 px-2.5 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap">
                          {item.startTime} — {item.endTime}
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
