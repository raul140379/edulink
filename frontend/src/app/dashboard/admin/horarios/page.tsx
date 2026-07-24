'use client'

import { useEffect, useState } from 'react'
import { Clock, Plus, Save, Edit2, Sun, Snowflake, Zap } from 'lucide-react'
import { useRouter } from 'next/navigation'
import Card from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import { Input, Select } from '@/components/ui/Input'
import { useConfirm } from '@/components/ui/ConfirmProvider'
import { useToast } from '@/components/ui/ToastProvider'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

interface SchoolSchedule {
  id:             number
  shift:          string
  name:           string
  startTime:      string
  exitTime:       string
  periods:        number
  periodDuration: number
  breakDuration:  number
  breakAfter:     string
  isWinter:       boolean
  isActive:       boolean
}

interface Periodo {
  period:    number
  startTime: string
  endTime:   string
}

interface GenerateResult {
  course: { id: number; grade: string; parallel: string; shift: string }
  status: 'ok' | 'error' | 'skip'
  msg:    string
}

const GRADES: Record<string,string> = { PRIMERO:'1°', SEGUNDO:'2°', TERCERO:'3°', CUARTO:'4°', QUINTO:'5°', SEXTO:'6°' }
const SHIFTS: Record<string,string> = { MORNING:'Mañana', AFTERNOON:'Tarde' }

export default function HorariosPage() {
  const router  = useRouter()
  const confirm = useConfirm()
  const toast   = useToast()

  const [schedules,    setSchedules]    = useState<SchoolSchedule[]>([])
  const [loading,      setLoading]      = useState(true)
  const [showModal,    setShowModal]    = useState(false)
  const [editing,      setEditing]      = useState<SchoolSchedule | null>(null)
  const [periodos,     setPeriodos]     = useState<Record<number, Periodo[]>>({})
  const [generatingAll,setGeneratingAll]= useState(false)
  const [resultAll,    setResultAll]    = useState<GenerateResult[]>([])
  const [showResults,  setShowResults]  = useState(false)
  const [form,         setForm]         = useState({
    shift: 'MORNING', name: '', startTime: '07:45', exitTime: '12:55',
    periods: 7, periodDuration: 40, breakDuration: 15, breakAfter: '2,4', isWinter: false
  })

  const token = () => localStorage.getItem('token') || ''
  const auth  = () => ({ Authorization: `Bearer ${token()}` })

  const loadSchedules = async () => {
    setLoading(true)
    try {
      const res  = await fetch(`${API}/api/schedules/school-schedules`, { headers: auth() })
      const data = await res.json()
      if (res.ok) {
        setSchedules(data)
        data.forEach(async (s: SchoolSchedule) => {
          const r = await fetch(`${API}/api/schedules/periodos/${s.id}`, { headers: auth() })
          const d = await r.json()
          if (r.ok) setPeriodos(prev => ({ ...prev, [s.id]: d.periodos }))
        })
      }
    } catch { console.error('Error') }
    finally  { setLoading(false) }
  }

  useEffect(() => { loadSchedules() }, [])

  const openCreate = () => {
    setEditing(null)
    setForm({ shift:'MORNING', name:'', startTime:'07:45', exitTime:'12:55', periods:7, periodDuration:40, breakDuration:15, breakAfter:'2,4', isWinter:false })
    setShowModal(true)
  }

  const openEdit = (s: SchoolSchedule) => {
    setEditing(s)
    setForm({
      shift: s.shift, name: s.name, startTime: s.startTime, exitTime: s.exitTime,
      periods: s.periods, periodDuration: s.periodDuration, breakDuration: s.breakDuration,
      breakAfter: s.breakAfter, isWinter: s.isWinter
    })
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!form.name || !form.startTime) { toast('Completa todos los campos', 'error'); return }
    try {
      const url    = editing ? `${API}/api/schedules/school-schedules/${editing.id}` : `${API}/api/schedules/school-schedules`
      const method = editing ? 'PUT' : 'POST'
      const res    = await fetch(url, {
        method, headers: { ...auth(), 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      })
      const data = await res.json()
      if (!res.ok) { toast(data.message, 'error'); return }
      toast(editing ? 'Horario actualizado' : 'Horario creado correctamente', 'success')
      setShowModal(false)
      loadSchedules()
    } catch { toast('Error de conexión', 'error') }
  }

  const toggleActive = async (s: SchoolSchedule) => {
    if (s.isActive) return
    try {
      await fetch(`${API}/api/schedules/school-schedules/${s.id}`, {
        method: 'PUT', headers: { ...auth(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: true })
      })
      toast(`${s.name} activado correctamente`, 'success')
      loadSchedules()
    } catch { toast('Error', 'error') }
  }

  const handleGenerateAll = async () => {
    if (!await confirm('¿Generar y publicar el horario de todos los cursos SIN horario publicado?')) return
    setGeneratingAll(true)
    setResultAll([])
    setShowResults(true)
    try {
      const resC    = await fetch(`${API}/api/courses`, { headers: auth() })
      const courses = await resC.json()
      if (!Array.isArray(courses)) { toast('Error al obtener cursos', 'error'); return }

      const results: GenerateResult[] = []

      for (const course of courses) {
        try {
          const resS  = await fetch(`${API}/api/schedules/course/${course.id}`, { headers: auth() })
          const dataS = await resS.json()
          const periods = dataS.schedule?.flatMap((d:any) => d.periods) || []
          const yaPublicado = periods.some((p:any) => p.status === 'PUBLICADO')

          if (yaPublicado) {
            results.push({ course, status: 'skip', msg: 'Ya tiene horario publicado — omitido' })
            setResultAll([...results])
            continue
          }

          const resG  = await fetch(`${API}/api/schedules/generate/${course.id}`, {
            method: 'POST', headers: auth()
          })
          const dataG = await resG.json()

          if (!resG.ok) {
            results.push({ course, status: 'error', msg: dataG.message || 'Error al generar' })
            setResultAll([...results])
            continue
          }

          if (dataG.created === 0) {
            results.push({ course, status: 'skip', msg: 'Sin materias asignadas — omitido' })
            setResultAll([...results])
            continue
          }

          const resP  = await fetch(`${API}/api/schedules/publish/${course.id}`, {
            method: 'POST', headers: auth()
          })
          const dataP = await resP.json()

          results.push({
            course,
            status: resP.ok ? 'ok' : 'error',
            msg:    resP.ok ? `${dataP.count} periodos publicados` : dataP.message
          })
          setResultAll([...results])

        } catch {
          results.push({ course, status: 'error', msg: 'Error de conexión' })
          setResultAll([...results])
        }
      }

      const ok   = results.filter(r => r.status === 'ok').length
      const err  = results.filter(r => r.status === 'error').length
      const skip = results.filter(r => r.status === 'skip').length
      toast(`Completado: ${ok} publicados, ${skip} omitidos, ${err} errores`, 'success')

    } catch { toast('Error al obtener cursos', 'error') }
    finally  { setGeneratingAll(false) }
  }

  const morning   = schedules.filter(s => s.shift === 'MORNING')
  const afternoon = schedules.filter(s => s.shift === 'AFTERNOON')

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-brand-700 mb-1">Configuración de Horarios</h1>
          <p className="text-[13px] text-neutral-500">Gestiona los horarios institucionales por turno</p>
        </div>
        <div className="flex gap-2.5 flex-wrap">
          <Button variant="secondary" onClick={()=>router.push('/dashboard/admin/horarios/aulas')}>🚪 Gestionar Aulas</Button>
          <Button className="!bg-[#8B1A7C] !border-[#8B1A7C]" onClick={()=>router.push('/dashboard/admin/horarios/planificacion')}>📅 Planificación Global</Button>
          <Button className="!bg-[#8B1A7C] !border-[#8B1A7C]" onClick={handleGenerateAll} disabled={generatingAll} loading={generatingAll}>
            {!generatingAll && <Zap size={15}/>} {generatingAll?'Generando...':'⚡ Generar Todos'}
          </Button>
          <Button className="!bg-success-700 !border-success-700" onClick={()=>router.push('/dashboard/admin/horarios/curso')}>Asignar por Curso →</Button>
          <Button onClick={openCreate}><Plus size={16}/> Nuevo Horario</Button>
        </div>
      </div>

      {showResults && resultAll.length > 0 && (
        <Card className="mb-5">
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-[13px] font-bold text-brand-700">
              Resultado de generación masiva {generatingAll && <span className="text-neutral-500 font-normal">(en progreso...)</span>}
            </span>
            <button onClick={()=>setShowResults(false)} className="text-neutral-500 text-xs hover:text-brand-700">Ocultar</button>
          </div>
          <div className="flex flex-col gap-1 max-h-[240px] overflow-y-auto">
            {resultAll.map((r, i) => (
              <div key={i} className={`flex gap-2 items-center text-xs px-2 py-1 rounded-md ${r.status==='ok'?'bg-success-100/60':r.status==='skip'?'bg-warning-100/60':'bg-danger-100/60'}`}>
                <span>{r.status==='ok'?'✅':r.status==='skip'?'⏭️':'❌'}</span>
                <span className="font-semibold min-w-[80px]">{GRADES[r.course.grade]} &quot;{r.course.parallel}&quot;</span>
                <span className="text-neutral-500 text-[11px]">{SHIFTS[r.course.shift]}</span>
                <span className={r.status==='ok'?'text-success-700':r.status==='skip'?'text-[#7A6000]':'text-danger-600'}>{r.msg}</span>
              </div>
            ))}
          </div>
          {!generatingAll && (
            <div className="mt-2.5 text-xs text-neutral-500 flex gap-4">
              <span>✅ {resultAll.filter(r=>r.status==='ok').length} publicados</span>
              <span>⏭️ {resultAll.filter(r=>r.status==='skip').length} omitidos</span>
              <span>❌ {resultAll.filter(r=>r.status==='error').length} errores</span>
            </div>
          )}
        </Card>
      )}

      {loading ? (
        <div className="flex justify-center py-12"><p className="text-sm text-neutral-500">Cargando...</p></div>
      ) : schedules.length === 0 ? (
        <div className="bg-white border border-dashed border-neutral-300 rounded-xl p-12 text-center text-neutral-500">
          <Clock size={40} className="mb-3 opacity-30 mx-auto"/>
          <p>No hay horarios configurados. Crea el primero.</p>
          <Button onClick={openCreate} className="mt-4"><Plus size={14}/> Crear horario</Button>
        </div>
      ) : (
        <>
          {morning.length > 0 && (
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <Sun size={18} className="text-[#BA7517]"/>
                <span className="font-bold text-[15px] text-[#BA7517]">Turno Mañana</span>
              </div>
              <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(420px, 1fr))' }}>
                {morning.map(s => <ScheduleCard key={s.id} s={s} periodos={periodos[s.id]||[]} onEdit={openEdit} onToggle={toggleActive}/>)}
              </div>
            </div>
          )}

          {afternoon.length > 0 && (
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <Clock size={18} className="text-brand-700"/>
                <span className="font-bold text-[15px] text-brand-700">Turno Tarde / BTH</span>
              </div>
              <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(420px, 1fr))' }}>
                {afternoon.map(s => <ScheduleCard key={s.id} s={s} periodos={periodos[s.id]||[]} onEdit={openEdit} onToggle={toggleActive}/>)}
              </div>
            </div>
          )}
        </>
      )}

      <Modal
        open={showModal} onClose={()=>setShowModal(false)} title={editing ? 'Editar Horario' : 'Nuevo Horario'}
        footer={
          <>
            <Button variant="secondary" onClick={()=>setShowModal(false)}>Cancelar</Button>
            <Button onClick={handleSave}><Save size={14}/> {editing?'Actualizar':'Crear'}</Button>
          </>
        }
      >
        <div className="flex flex-col gap-3.5">
          <Input
            label="Nombre" required value={form.name} onChange={e=>setForm(p=>({...p,name:e.target.value}))}
            placeholder="Ej: Normal Mañana, Invierno Tarde"
          />

          <div className="grid grid-cols-2 gap-3">
            <Select label="Turno" value={form.shift} onChange={e=>setForm(p=>({...p,shift:e.target.value}))}>
              <option value="MORNING">Mañana</option>
              <option value="AFTERNOON">Tarde / BTH</option>
            </Select>
            <Select label="Tipo" value={form.isWinter?'invierno':'normal'} onChange={e=>setForm(p=>({...p,isWinter:e.target.value==='invierno'}))}>
              <option value="normal">Normal</option>
              <option value="invierno">Invierno</option>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input label="Hora de Entrada" type="time" value={form.startTime} onChange={e=>setForm(p=>({...p,startTime:e.target.value}))}/>
            <Input label="Hora de Salida" type="time" value={form.exitTime} onChange={e=>setForm(p=>({...p,exitTime:e.target.value}))}/>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Select label="Periodos" value={form.periods} onChange={e=>setForm(p=>({...p,periods:parseInt(e.target.value)}))}>
              <option value={6}>6 periodos</option>
              <option value={7}>7 periodos</option>
            </Select>
            <Input label="Min/periodo" type="number" value={form.periodDuration} min={30} max={60}
              onChange={e=>setForm(p=>({...p,periodDuration:parseInt(e.target.value)}))}/>
            <Input label="Min/recreo" type="number" value={form.breakDuration} min={5} max={30}
              onChange={e=>setForm(p=>({...p,breakDuration:parseInt(e.target.value)}))}/>
          </div>

          <Input
            label="Recreo después del periodo (separado por comas)" value={form.breakAfter}
            onChange={e=>setForm(p=>({...p,breakAfter:e.target.value}))}
            placeholder="2,4" hint='Ej: "2,4" = recreo después del 2do y 4to periodo'
          />
        </div>
      </Modal>
    </div>
  )
}

function ScheduleCard({ s, periodos, onEdit, onToggle }: {
  s: SchoolSchedule; periodos: Periodo[]
  onEdit: (s: SchoolSchedule) => void
  onToggle: (s: SchoolSchedule) => void
}) {
  const recreos          = s.breakAfter ? s.breakAfter.split(',').filter(Boolean) : []
  const cantidadRecreos  = recreos.length
  const totalMinReceso   = cantidadRecreos * s.breakDuration
  const minExtraPeriodo  = s.periods > 0 ? Math.round((totalMinReceso / s.periods) * 10) / 10 : 0
  const duracionEfectiva = Math.round((s.periodDuration + minExtraPeriodo) * 10) / 10
  const breakPeriods     = s.breakAfter.split(',').map(Number)

  return (
    <Card padded={false} className={`overflow-hidden ${!s.isActive ? 'opacity-60' : ''}`}>
      <div className="px-4.5 py-3.5 border-b border-neutral-100 flex items-center gap-2.5">
        {s.isWinter ? <Snowflake size={16} className="text-info-500"/> : <Sun size={16} className="text-[#BA7517]"/>}
        <div className="flex-1">
          <div className="font-bold text-sm text-brand-700">{s.name}</div>
          <div className="text-xs text-neutral-500">{s.startTime} — {s.exitTime} · {s.periods} periodos · {s.periodDuration} min/periodo</div>
        </div>
        <div className="flex gap-1.5">
          <Button variant="secondary" size="sm" onClick={()=>onEdit(s)}><Edit2 size={12}/> Editar</Button>
          <button
            onClick={()=>!s.isActive && onToggle(s)}
            className={`rounded-md px-2.5 py-1.5 text-xs font-semibold ${s.isActive ? 'bg-success-100 text-success-700 cursor-default' : 'bg-neutral-100 text-neutral-500 cursor-pointer'}`}
          >
            {s.isActive ? '✅ Activo' : 'Activar'}
          </button>
        </div>
      </div>

      <div className="px-4.5 py-2.5 border-b border-neutral-100 bg-warning-100/40">
        <div className="text-[11px] font-bold text-[#7A6000] uppercase tracking-wide mb-1.5">☕ Recreos</div>
        <div className="flex flex-wrap gap-2.5 items-center">
          <div className="text-xs text-[#7A6000]">
            <span className="font-semibold">{cantidadRecreos}</span> recreo{cantidadRecreos!==1?'s':''}{' '}
            × <span className="font-semibold">{s.breakDuration} min</span> c/u
            {' '}= <span className="font-bold">{totalMinReceso} min total</span>
          </div>
          <div className="text-xs text-[#7A6000]">Después del periodo: <span className="font-semibold">{s.breakAfter}</span></div>
        </div>
        <div className="flex flex-wrap gap-2 mt-2">
          <Badge tone="warning">+{minExtraPeriodo} min efectivos/periodo</Badge>
          <Badge tone="brand">⏱ Duración efectiva: {duracionEfectiva} min/periodo</Badge>
        </div>
      </div>

      {periodos.length > 0 && (
        <div className="px-4.5 py-3">
          <div className="text-[11px] font-bold text-neutral-500 uppercase tracking-wide mb-2">Distribución de periodos</div>
          <div className="flex flex-wrap gap-1.5 items-center">
            {periodos.map(p => (
              <div key={p.period} className="flex items-center gap-1">
                <div className="bg-neutral-100 rounded-lg px-2.5 py-1 text-xs text-brand-700 font-semibold">P{p.period}: {p.startTime}–{p.endTime}</div>
                {breakPeriods.includes(p.period) && (
                  <Badge tone="warning">☕ {s.breakDuration}min</Badge>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  )
}
