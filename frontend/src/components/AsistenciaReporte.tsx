'use client'

import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, ChevronDown, ChevronUp } from 'lucide-react'
import Card from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import { Input } from '@/components/ui/Input'
import { todayLocalStr } from '@/lib/localDate'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

interface TeacherRecord {
  teacher: { id: number; firstName: string; lastName: string; ci?: string }
  records: {
    id: number; date: string; checkIn: string | null
    checkOut: string | null; status: string; note: string | null
  }[]
  summary: { presente: number; retraso: number; ausente: number; licencia: number; total: number }
}

interface ReportData {
  period: { start: string; end: string; month: number; year: number; week: number | null }
  teachers: TeacherRecord[]
  totalRecords: number
}

type Tone = 'success' | 'warning' | 'danger' | 'brand'

const STATUS_CONFIG: Record<string, { label: string; tone: Tone }> = {
  PRESENTE: { label: 'Presente', tone: 'success' },
  RETRASO:  { label: 'Retraso',  tone: 'warning' },
  AUSENTE:  { label: 'Ausente',  tone: 'danger' },
  LICENCIA: { label: 'Licencia', tone: 'brand' },
}

const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

const fmtTime = (d: string | null) => d ? new Date(d).toLocaleTimeString('es-BO', { hour:'2-digit', minute:'2-digit' }) : '—'
const fmtDate = (d: string) => new Date(d).toLocaleDateString('es-BO', { weekday:'short', day:'2-digit', month:'short' })
const fmtDateFull = (d: string) => new Date(d).toLocaleDateString('es-BO', { weekday:'long', day:'2-digit', month:'long', year:'numeric' })

export default function AsistenciaReporte() {
  const [data,     setData]     = useState<ReportData | null>(null)
  const [loading,  setLoading]  = useState(false)
  const [month,    setMonth]    = useState(new Date().getMonth() + 1)
  const [year,     setYear]     = useState(new Date().getFullYear())
  const [mode,     setMode]     = useState<'diario' | 'semanal' | 'mensual'>('diario')
  const [week,     setWeek]     = useState(1)
  const [selDate,  setSelDate]  = useState(todayLocalStr())
  const [expanded, setExpanded] = useState<number | null>(null)
  const [search,   setSearch]   = useState('')

  const auth = () => ({ Authorization: `Bearer ${localStorage.getItem('token') || ''}` })

  const loadReport = async () => {
    setLoading(true)
    try {
      let url = ''
      if (mode === 'diario') {
        const d = new Date(selDate)
        const m = d.getMonth() + 1
        const y = d.getFullYear()
        url = `${API}/api/teacher-attendance/report?month=${m}&year=${y}&date=${selDate}`
      } else if (mode === 'semanal') {
        url = `${API}/api/teacher-attendance/report?month=${month}&year=${year}&week=${week}`
      } else {
        url = `${API}/api/teacher-attendance/report?month=${month}&year=${year}`
      }
      const res = await fetch(url, { headers: auth() })
      const d   = await res.json()
      if (res.ok) setData(d)
    } catch { console.error('Error al cargar reporte') }
    finally  { setLoading(false) }
  }

  useEffect(() => { loadReport() }, [month, year, mode, week, selDate])

  const prevMonth = () => { if (month===1){setMonth(12);setYear(y=>y-1)}else setMonth(m=>m-1) }
  const nextMonth = () => { if (month===12){setMonth(1);setYear(y=>y+1)}else setMonth(m=>m+1) }

  const filteredTeachers = data?.teachers.filter(t =>
    search==='' ||
    `${t.teacher.lastName} ${t.teacher.firstName}`.toLowerCase().includes(search.toLowerCase())
  ) || []

  const totals = filteredTeachers.reduce((acc, t) => ({
    presente: acc.presente + (t.summary.presente || 0),
    retraso:  acc.retraso  + (t.summary.retraso  || 0),
    ausente:  acc.ausente  + (t.summary.ausente  || 0),
    licencia: acc.licencia + (t.summary.licencia || 0),
    total:    acc.total    + (t.summary.total    || 0),
  }), { presente:0, retraso:0, ausente:0, licencia:0, total:0 })

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-brand-700 mb-1">Reporte de Asistencia</h1>
        <p className="text-[13px] text-neutral-500">Control de asistencia de maestros — U.E. Naciones Unidas</p>
      </div>

      {/* Controles */}
      <Card className="flex flex-wrap gap-4 items-center mb-5">
        <div className="flex gap-1.5">
          {(['diario','semanal','mensual'] as const).map(m => (
            <button
              key={m} onClick={() => setMode(m)}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-colors ${mode === m ? 'bg-brand-700 text-white' : 'bg-neutral-100 text-brand-700 hover:bg-brand-100'}`}
            >
              {m.charAt(0).toUpperCase()+m.slice(1)}
            </button>
          ))}
        </div>

        {mode === 'diario' && (
          <input
            type="date" value={selDate} onChange={e => setSelDate(e.target.value)}
            className="px-3 py-1.5 border border-neutral-300 rounded-lg text-[13px] text-brand-700 outline-none focus:border-info-500"
          />
        )}

        {(mode === 'semanal' || mode === 'mensual') && (
          <div className="flex items-center gap-2">
            <button onClick={prevMonth} className="bg-neutral-100 rounded-lg w-8 h-8 flex items-center justify-center text-brand-700 hover:bg-brand-100 transition-colors">
              <ChevronLeft size={16}/>
            </button>
            <span className="text-sm font-bold text-brand-700 min-w-[130px] text-center">{MONTHS[month-1]} {year}</span>
            <button onClick={nextMonth} className="bg-neutral-100 rounded-lg w-8 h-8 flex items-center justify-center text-brand-700 hover:bg-brand-100 transition-colors">
              <ChevronRight size={16}/>
            </button>
          </div>
        )}

        {mode === 'semanal' && (
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-neutral-500">Semana:</span>
            {[1,2,3,4,5].map(w => (
              <button
                key={w} onClick={() => setWeek(w)}
                className={`w-8 h-8 rounded-lg text-xs font-semibold transition-colors ${week === w ? 'bg-brand-700 text-white' : 'bg-neutral-100 text-brand-700 hover:bg-brand-100'}`}
              >
                {w}
              </button>
            ))}
          </div>
        )}

        <Input
          placeholder="Buscar maestro..." value={search} onChange={e => setSearch(e.target.value)}
          className="!w-[200px] ml-auto"
        />
      </Card>

      {mode === 'diario' && (
        <div className="bg-brand-100 border border-neutral-300 rounded-lg px-4 py-2 mb-4 text-[13px] font-semibold text-brand-700 capitalize">
          📅 {fmtDateFull(selDate)}
        </div>
      )}

      {/* Totales */}
      {data && (
        <div className="grid grid-cols-5 gap-2.5 mb-5">
          {[
            { label:'Presente',   value: totals.presente, tone: 'success' as Tone },
            { label:'Retraso',    value: totals.retraso,  tone: 'warning' as Tone },
            { label:'Ausente',    value: totals.ausente,  tone: 'danger'  as Tone },
            { label:'Licencia',   value: totals.licencia, tone: 'brand'   as Tone },
            { label:'Total días', value: totals.total,    tone: 'brand'   as Tone },
          ].map(s => (
            <Card key={s.label} className="text-center">
              <div className={`text-2xl font-extrabold ${s.tone === 'success' ? 'text-success-700' : s.tone === 'warning' ? 'text-[#BA7517]' : s.tone === 'danger' ? 'text-danger-600' : 'text-brand-700'}`}>
                {String(s.value)}
              </div>
              <div className="mt-0.5"><Badge tone={s.tone}>{s.label}</Badge></div>
            </Card>
          ))}
        </div>
      )}

      {/* Lista de maestros */}
      {loading ? (
        <div className="flex justify-center py-16"><p className="text-sm text-neutral-500">Cargando...</p></div>
      ) : filteredTeachers.length === 0 ? (
        <Card className="text-center py-12 text-neutral-500">No hay registros para el período seleccionado</Card>
      ) : (
        <div className="flex flex-col gap-2.5">
          {filteredTeachers.map(t => {
            const isOpen = expanded === t.teacher.id
            const pct    = t.summary.total > 0 ? Math.round(((t.summary.presente || 0) / t.summary.total) * 100) : 0
            return (
              <Card key={t.teacher.id} padded={false} className="overflow-hidden">
                <div className="flex items-center px-4.5 py-3.5 cursor-pointer gap-4" onClick={() => setExpanded(isOpen ? null : t.teacher.id)}>
                  <div className="w-[38px] h-[38px] rounded-full bg-brand-700 text-white flex items-center justify-center font-bold text-sm shrink-0">
                    {t.teacher.lastName.charAt(0)}
                  </div>
                  <div className="flex-1">
                    <div className="font-bold text-sm text-brand-700">{t.teacher.lastName} {t.teacher.firstName}</div>
                    {t.teacher.ci && <div className="text-xs text-neutral-500">CI: {t.teacher.ci}</div>}
                  </div>

                  {mode === 'diario' && t.records[0] ? (
                    <div className="flex gap-5 items-center">
                      <div className="text-center">
                        <div className="text-[10px] text-neutral-500 mb-0.5">Entrada</div>
                        <div className="text-[15px] font-extrabold text-success-700">{fmtTime(t.records[0].checkIn)}</div>
                      </div>
                      <div className="text-center">
                        <div className="text-[10px] text-neutral-500 mb-0.5">Salida</div>
                        <div className="text-[15px] font-extrabold text-danger-600">{fmtTime(t.records[0].checkOut)}</div>
                      </div>
                      <Badge tone={STATUS_CONFIG[t.records[0].status]?.tone || 'neutral'}>{STATUS_CONFIG[t.records[0].status]?.label}</Badge>
                    </div>
                  ) : (
                    <div className="flex gap-2 items-center flex-wrap">
                      {[
                        { key:'presente', label:'P', tone:'success' as Tone, val:t.summary.presente||0 },
                        { key:'retraso',  label:'R', tone:'warning' as Tone, val:t.summary.retraso||0 },
                        { key:'ausente',  label:'A', tone:'danger'  as Tone, val:t.summary.ausente||0 },
                        { key:'licencia', label:'L', tone:'brand'   as Tone, val:t.summary.licencia||0 },
                      ].map(s => (
                        <div key={s.key} className="text-center min-w-[36px]">
                          <div className={`text-sm font-extrabold ${s.tone === 'success' ? 'text-success-700' : s.tone === 'warning' ? 'text-[#BA7517]' : s.tone === 'danger' ? 'text-danger-600' : 'text-brand-700'}`}>{String(s.val)}</div>
                          <Badge tone={s.tone}>{s.label}</Badge>
                        </div>
                      ))}
                      <div className="ml-2">
                        <div className="text-[11px] text-neutral-500 mb-0.5 text-right">{String(pct)}% asistencia</div>
                        <div className="w-20 h-1.5 bg-neutral-100 rounded overflow-hidden">
                          <div className={`h-full rounded ${pct>=80?'bg-success-500':pct>=60?'bg-warning-500':'bg-danger-500'}`} style={{ width: `${pct}%` }}/>
                        </div>
                      </div>
                    </div>
                  )}
                  {mode !== 'diario' && (isOpen ? <ChevronUp size={15} className="text-neutral-500"/> : <ChevronDown size={15} className="text-neutral-500"/>)}
                </div>

                {isOpen && mode !== 'diario' && (
                  <div className="border-t border-neutral-100 bg-neutral-100/40">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="bg-neutral-100">
                          <th className="px-3.5 py-2.5 text-left text-[11px] font-semibold text-brand-700 uppercase tracking-wide">Fecha</th>
                          <th className="px-3.5 py-2.5 text-center text-[11px] font-semibold text-brand-700 uppercase tracking-wide">Estado</th>
                          <th className="px-3.5 py-2.5 text-center text-[11px] font-semibold text-brand-700 uppercase tracking-wide">Entrada</th>
                          <th className="px-3.5 py-2.5 text-center text-[11px] font-semibold text-brand-700 uppercase tracking-wide">Salida</th>
                          <th className="px-3.5 py-2.5 text-left text-[11px] font-semibold text-brand-700 uppercase tracking-wide">Observación</th>
                        </tr>
                      </thead>
                      <tbody>
                        {t.records.map(r => {
                          const st = STATUS_CONFIG[r.status] || STATUS_CONFIG['AUSENTE']
                          return (
                            <tr key={r.id} className="border-t border-neutral-100">
                              <td className="px-3.5 py-2.5 text-[13px] text-brand-700">{fmtDate(r.date)}</td>
                              <td className="px-3.5 py-2.5 text-center"><Badge tone={st.tone}>{st.label}</Badge></td>
                              <td className="px-3.5 py-2.5 text-center text-[13px] font-semibold text-success-700">{fmtTime(r.checkIn)}</td>
                              <td className="px-3.5 py-2.5 text-center text-[13px] font-semibold text-danger-600">{fmtTime(r.checkOut)}</td>
                              <td className="px-3.5 py-2.5 text-xs text-neutral-500">{r.note||'—'}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
