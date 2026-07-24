'use client'

import { useEffect, useState } from 'react'
import Card from '@/components/ui/Card'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

interface ScheduleItem {
  id: number; dayOfWeek: number; period: number
  startTime: string; endTime: string; status: string
  teacherSubjectCourse: {
    teacher: { firstName: string; lastName: string }
    subject:  { name: string; campo?: string }
  }
}

interface Student {
  id: number; firstName: string; lastName: string
  course?: { id: number; grade: string; parallel: string; level: string; shift: string }
}

const GRADES: Record<string,string> = { PRIMERO:'1°', SEGUNDO:'2°', TERCERO:'3°', CUARTO:'4°', QUINTO:'5°', SEXTO:'6°' }
const SHIFTS: Record<string,string> = { MORNING:'Mañana', AFTERNOON:'Tarde' }
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

export default function ParentHorarioPage() {
  const [students,  setStudents]  = useState<Student[]>([])
  const [selStudent,setSelStudent]= useState<Student | null>(null)
  const [schedule,  setSchedule]  = useState<ScheduleItem[]>([])
  const [loading,   setLoading]   = useState(false)
  const [view,      setView]      = useState<'grilla'|'lista'>('grilla')
  const [todayDay,  setTodayDay]  = useState(0)

  const auth = () => ({ Authorization: `Bearer ${localStorage.getItem('token') || ''}` })

  useEffect(() => {
    const d = new Date().getDay()
    setTodayDay(d === 0 ? 7 : d)

    fetch(`${API}/api/parents/my-students`, { headers: auth() })
      .then(r=>r.json())
      .then(d=>{ if(Array.isArray(d)) { setStudents(d); if(d.length>0) setSelStudent(d[0]) } })
      .catch(()=>{})
  }, [])

  useEffect(() => {
    if (!selStudent?.course?.id) return
    setLoading(true)
    fetch(`${API}/api/schedules/course/${selStudent.course.id}`, { headers: auth() })
      .then(r=>r.json())
      .then(data=>{ if(data.schedule) setSchedule(data.schedule.flatMap((d:any)=>d.periods)||[]) })
      .catch(()=>{})
      .finally(()=>setLoading(false))
  }, [selStudent])

  const days    = [...new Set(schedule.map(s=>s.dayOfWeek))].sort()
  const periods = [...new Set(schedule.map(s=>s.period))].sort((a,b)=>a-b)
  const getCell = (day:number, period:number) => schedule.find(s=>s.dayOfWeek===day&&s.period===period)

  const byDay: Record<number,ScheduleItem[]> = {}
  schedule.forEach(s=>{ if(!byDay[s.dayOfWeek]) byDay[s.dayOfWeek]=[]; byDay[s.dayOfWeek].push(s) })

  const clasesHoy = schedule.filter(s=>s.dayOfWeek===todayDay).sort((a,b)=>a.period-b.period)

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-xl font-bold text-brand-700 mb-1">Horario Escolar</h1>
        <p className="text-[13px] text-neutral-500">Consulta el horario semanal de tus hijos</p>
      </div>

      {students.length > 1 && (
        <Card className="flex gap-2 flex-wrap items-center mb-4">
          <span className="text-xs font-bold text-brand-700">Seleccionar hijo:</span>
          {students.map(s => (
            <button
              key={s.id} onClick={() => setSelStudent(s)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors ${selStudent?.id === s.id ? 'bg-brand-700 text-white' : 'bg-neutral-100 text-brand-700 hover:bg-brand-100'}`}
            >
              {s.lastName} {s.firstName}
            </button>
          ))}
        </Card>
      )}

      {selStudent && (
        <div className="bg-brand-100 border border-neutral-300 rounded-lg px-4 py-2 mb-4 text-xs text-brand-700 flex gap-4 flex-wrap">
          <span>👨‍🎓 <strong>{selStudent.lastName} {selStudent.firstName}</strong></span>
          {selStudent.course && (
            <>
              <span>Curso: <strong>{GRADES[selStudent.course.grade]} &quot;{selStudent.course.parallel}&quot;</strong></span>
              <span>Turno: <strong>{SHIFTS[selStudent.course.shift]||selStudent.course.shift}</strong></span>
            </>
          )}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16"><p className="text-sm text-neutral-500">Cargando...</p></div>
      ) : schedule.length === 0 ? (
        <Card className="text-center py-12 border-dashed">
          <div className="text-4xl mb-3">📅</div>
          <p className="text-neutral-500">El horario del curso aún no ha sido publicado.</p>
        </Card>
      ) : (
        <>
          {clasesHoy.length > 0 && (
            <Card className="!bg-brand-100 !border-brand-300 mb-5">
              <div className="font-bold text-[13px] text-brand-700 mb-2.5">📅 Hoy — {DAYS[todayDay]}</div>
              <div className="flex flex-wrap gap-2">
                {clasesHoy.map(item => (
                  <div key={item.id} className="bg-white rounded-lg px-3 py-2 border border-neutral-300 flex items-center gap-2">
                    <span className="text-lg">{SUBJECT_EMOJI[item.teacherSubjectCourse.subject.name]||'📚'}</span>
                    <div>
                      <div className="text-xs font-bold text-brand-700">{item.teacherSubjectCourse.subject.name}</div>
                      <div className="text-[10px] text-neutral-500">
                        P{item.period} · {item.startTime}–{item.endTime} · {item.teacherSubjectCourse.teacher.lastName}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

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
                      <th
                        key={d}
                        className={`p-2.5 text-xs font-bold text-center border border-neutral-300 ${d === todayDay ? 'bg-brand-700 text-white' : 'bg-neutral-100 text-brand-700'}`}
                      >
                        {DAYS[d]}
                        {d === todayDay && <div className="text-[9px] font-normal opacity-80">Hoy</div>}
                      </th>
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
                              className={`p-2 border align-top ${cell ? 'bg-brand-100/40 border-neutral-300' : day === todayDay ? 'bg-brand-100/20 border-neutral-300' : 'bg-neutral-100/30 border-neutral-300'}`}
                              style={{ minWidth: 110 }}
                            >
                              {cell ? (
                                <div>
                                  <div className="text-lg mb-0.5">{SUBJECT_EMOJI[cell.teacherSubjectCourse.subject.name]||'📚'}</div>
                                  <div className="text-[11px] font-bold text-brand-700 leading-tight">{cell.teacherSubjectCourse.subject.name}</div>
                                  <div className="text-[10px] text-neutral-500 mt-0.5">{cell.teacherSubjectCourse.teacher.lastName}</div>
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
              {Object.entries(byDay).sort(([a],[b]) => parseInt(a) - parseInt(b)).map(([day, items]) => {
                const isToday = parseInt(day) === todayDay
                return (
                  <Card key={day} padded={false} className={`overflow-hidden ${isToday ? '!border-brand-700' : ''}`}>
                    <div className={`px-4 py-2.5 font-bold text-[13px] flex items-center gap-2 border-b border-neutral-100 ${isToday ? 'bg-brand-700 text-white' : 'bg-neutral-100 text-brand-700'}`}>
                      📅 {DAYS[parseInt(day)]}
                      {isToday && <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full">Hoy</span>}
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
                            <div className="text-xs text-neutral-500 mt-0.5">
                              {item.teacherSubjectCourse.teacher.lastName} {item.teacherSubjectCourse.teacher.firstName}
                            </div>
                          </div>
                          <div className="bg-brand-100 text-brand-700 px-2.5 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap">
                            {item.startTime} — {item.endTime}
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}
