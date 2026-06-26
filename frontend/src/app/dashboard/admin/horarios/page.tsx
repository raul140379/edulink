 'use client' 

import { useEffect, useState } from 'react'
import { Clock, Plus, Save, X, Edit2, Sun, Snowflake, Zap } from 'lucide-react'
import { useRouter } from 'next/navigation'

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
  const router = useRouter()
  const [schedules,    setSchedules]    = useState<SchoolSchedule[]>([])
  const [loading,      setLoading]      = useState(true)
  const [showModal,    setShowModal]    = useState(false)
  const [editing,      setEditing]      = useState<SchoolSchedule | null>(null)
  const [periodos,     setPeriodos]     = useState<Record<number, Periodo[]>>({})
  const [toast,        setToast]        = useState<{type:'ok'|'err'|'warn'; text:string} | null>(null)
  const [generatingAll,setGeneratingAll]= useState(false)
  const [resultAll,    setResultAll]    = useState<GenerateResult[]>([])
  const [showResults,  setShowResults]  = useState(false)
  const [form,         setForm]         = useState({
    shift: 'MORNING', name: '', startTime: '07:45', exitTime: '12:55',
    periods: 7, periodDuration: 40, breakDuration: 15, breakAfter: '2,4', isWinter: false
  })

  const token = () => localStorage.getItem('token') || ''
  const auth  = () => ({ Authorization: `Bearer ${token()}` })

  const showToast = (type: 'ok'|'err'|'warn', text: string) => {
    setToast({type, text}); setTimeout(()=>setToast(null), 4000)
  }

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
    if (!form.name || !form.startTime) { showToast('err', 'Completa todos los campos'); return }
    try {
      const url    = editing ? `${API}/api/schedules/school-schedules/${editing.id}` : `${API}/api/schedules/school-schedules`
      const method = editing ? 'PUT' : 'POST'
      const res    = await fetch(url, {
        method, headers: { ...auth(), 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      })
      const data = await res.json()
      if (!res.ok) { showToast('err', data.message); return }
      showToast('ok', editing ? 'Horario actualizado' : 'Horario creado correctamente')
      setShowModal(false)
      loadSchedules()
    } catch { showToast('err', 'Error de conexión') }
  }

  const toggleActive = async (s: SchoolSchedule) => {
    if (s.isActive) return
    try {
      await fetch(`${API}/api/schedules/school-schedules/${s.id}`, {
        method: 'PUT', headers: { ...auth(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: true })
      })
      showToast('ok', `${s.name} activado correctamente`)
      loadSchedules()
    } catch { showToast('err', 'Error') }
  }

  const handleGenerateAll = async () => {
    if (!confirm('¿Generar y publicar el horario de todos los cursos SIN horario publicado?')) return
    setGeneratingAll(true)
    setResultAll([])
    setShowResults(true)
    try {
      const resC    = await fetch(`${API}/api/courses`, { headers: auth() })
      const courses = await resC.json()
      if (!Array.isArray(courses)) { showToast('err', 'Error al obtener cursos'); return }

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
      showToast('ok', `Completado: ${ok} publicados, ${skip} omitidos, ${err} errores`)

    } catch { showToast('err', 'Error al obtener cursos') }
    finally  { setGeneratingAll(false) }
  }

  const morning   = schedules.filter(s => s.shift === 'MORNING')
  const afternoon = schedules.filter(s => s.shift === 'AFTERNOON')

  return (
    <div>
      {/* Toast */}
      {toast && (
        <div style={{
          position:'fixed',top:16,right:16,zIndex:999,padding:'10px 16px',borderRadius:8,fontSize:13,
          background:toast.type==='ok'?'#E1F5EE':toast.type==='warn'?'#FFFBEA':'#FFF0F0',
          border:`1px solid ${toast.type==='ok'?'#9FE1CB':toast.type==='warn'?'#F5C518':'#FFBBBB'}`,
          color:toast.type==='ok'?'#0F6E56':toast.type==='warn'?'#7A6000':'#C0392B',
          boxShadow:'0 4px 12px rgba(0,0,0,.1)',maxWidth:400,
        }}>
          {toast.text}
        </div>
      )}

      {/* Header */}
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:24,flexWrap:'wrap',gap:12}}>
        <div>
          <h1 style={{fontSize:20,fontWeight:700,color:'#1A3A7C',marginBottom:4}}>Configuración de Horarios</h1>
          <p style={{fontSize:13,color:'#6B8BB0'}}>Gestiona los horarios institucionales por turno</p>
        </div>
        <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
          <button onClick={()=>router.push('/dashboard/admin/horarios/aulas')} style={{
            display:'flex',alignItems:'center',gap:8,padding:'10px 18px',
            background:'#fff',color:'#1A3A7C',border:'1.5px solid #CBE0F0',borderRadius:8,
            fontSize:13,fontWeight:600,cursor:'pointer'
          }}>
            🚪 Gestionar Aulas
          </button>
          <button onClick={()=>router.push('/dashboard/admin/horarios/planificacion')} style={{
  display:'flex',alignItems:'center',gap:8,padding:'10px 18px',
  background:'#8B1A7C',color:'#fff',border:'none',borderRadius:8,
  fontSize:13,fontWeight:600,cursor:'pointer'
}}>
  📅 Planificación Global
</button>
          <button onClick={handleGenerateAll} disabled={generatingAll} style={{
            display:'flex',alignItems:'center',gap:8,padding:'10px 18px',
            background:'#8B1A7C',color:'#fff',border:'none',borderRadius:8,
            fontSize:13,fontWeight:600,cursor:'pointer',opacity:generatingAll?0.6:1
          }}>
            <Zap size={15}/> {generatingAll?'Generando...':'⚡ Generar Todos'}
          </button>
          <button onClick={()=>router.push('/dashboard/admin/horarios/curso')} style={{
            display:'flex',alignItems:'center',gap:8,padding:'10px 18px',
            background:'#0F6E56',color:'#fff',border:'none',borderRadius:8,
            fontSize:13,fontWeight:600,cursor:'pointer'
          }}>
            Asignar por Curso →
          </button>
          <button onClick={openCreate} style={{
            display:'flex',alignItems:'center',gap:8,padding:'10px 18px',
            background:'#1A3A7C',color:'#fff',border:'none',borderRadius:8,
            fontSize:13,fontWeight:600,cursor:'pointer'
          }}>
            <Plus size={16}/> Nuevo Horario
          </button>
        </div>
      </div>

      {/* Resultado de generación masiva */}
      {showResults && resultAll.length > 0 && (
        <div style={{background:'#fff',border:'1px solid #CBE0F0',borderRadius:10,padding:'14px 18px',marginBottom:20}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}>
            <span style={{fontSize:13,fontWeight:700,color:'#1A3A7C'}}>
              Resultado de generación masiva {generatingAll && <span style={{color:'#6B8BB0',fontWeight:400}}>(en progreso...)</span>}
            </span>
            <button onClick={()=>setShowResults(false)} style={{background:'none',border:'none',cursor:'pointer',color:'#6B8BB0',fontSize:12}}>
              Ocultar
            </button>
          </div>
          <div style={{display:'flex',flexDirection:'column',gap:4,maxHeight:240,overflowY:'auto'}}>
            {resultAll.map((r, i) => (
              <div key={i} style={{
                display:'flex',gap:8,alignItems:'center',fontSize:12,
                padding:'4px 8px',borderRadius:6,
                background: r.status==='ok'?'#F0FBF5':r.status==='skip'?'#FFFBEA':'#FFF0F0',
              }}>
                <span>{r.status==='ok'?'✅':r.status==='skip'?'⏭️':'❌'}</span>
                <span style={{fontWeight:600,minWidth:80}}>
                  {GRADES[r.course.grade]} &quot;{r.course.parallel}&quot;
                </span>
                <span style={{color:'#6B8BB0',fontSize:11}}>{SHIFTS[r.course.shift]}</span>
                <span style={{color: r.status==='ok'?'#0F6E56':r.status==='skip'?'#7A6000':'#C0392B'}}>
                  {r.msg}
                </span>
              </div>
            ))}
          </div>
          {!generatingAll && (
            <div style={{marginTop:10,fontSize:12,color:'#6B8BB0',display:'flex',gap:16}}>
              <span>✅ {resultAll.filter(r=>r.status==='ok').length} publicados</span>
              <span>⏭️ {resultAll.filter(r=>r.status==='skip').length} omitidos</span>
              <span>❌ {resultAll.filter(r=>r.status==='error').length} errores</span>
            </div>
          )}
        </div>
      )}

      {loading ? (
        <div style={{display:'flex',justifyContent:'center',padding:48}}><div className="spinner"/></div>
      ) : schedules.length === 0 ? (
        <div style={{background:'#fff',border:'1px dashed #CBE0F0',borderRadius:12,padding:48,textAlign:'center',color:'#6B8BB0'}}>
          <Clock size={40} style={{marginBottom:12,opacity:.3}}/>
          <p>No hay horarios configurados. Crea el primero.</p>
          <button onClick={openCreate} style={{marginTop:16,padding:'8px 16px',background:'#1A3A7C',color:'#fff',border:'none',borderRadius:8,cursor:'pointer',fontSize:13}}>
            <Plus size={14}/> Crear horario
          </button>
        </div>
      ) : (
        <>
          {morning.length > 0 && (
            <div style={{marginBottom:24}}>
              <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:12}}>
                <Sun size={18} color="#BA7517"/>
                <span style={{fontWeight:700,fontSize:15,color:'#BA7517'}}>Turno Mañana</span>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(420px,1fr))',gap:16}}>
                {morning.map(s => <ScheduleCard key={s.id} s={s} periodos={periodos[s.id]||[]} onEdit={openEdit} onToggle={toggleActive}/>)}
              </div>
            </div>
          )}

          {afternoon.length > 0 && (
            <div style={{marginBottom:24}}>
              <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:12}}>
                <Clock size={18} color="#1A3A7C"/>
                <span style={{fontWeight:700,fontSize:15,color:'#1A3A7C'}}>Turno Tarde / BTH</span>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(420px,1fr))',gap:16}}>
                {afternoon.map(s => <ScheduleCard key={s.id} s={s} periodos={periodos[s.id]||[]} onEdit={openEdit} onToggle={toggleActive}/>)}
              </div>
            </div>
          )}
        </>
      )}

      {/* Modal */}
      {showModal && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.4)',zIndex:500,display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
          <div style={{background:'#fff',borderRadius:14,width:'100%',maxWidth:480,maxHeight:'90vh',overflow:'auto',boxShadow:'0 20px 60px rgba(0,0,0,.15)'}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'18px 20px',borderBottom:'1px solid #CBE0F0'}}>
              <h2 style={{fontSize:16,fontWeight:700,color:'#1A3A7C',margin:0}}>
                {editing ? 'Editar Horario' : 'Nuevo Horario'}
              </h2>
              <button onClick={()=>setShowModal(false)} style={{background:'none',border:'none',cursor:'pointer',color:'#6B8BB0'}}>
                <X size={18}/>
              </button>
            </div>
            <div style={{padding:20,display:'flex',flexDirection:'column',gap:14}}>

              <div style={{display:'flex',flexDirection:'column',gap:6}}>
                <label style={{fontSize:11,fontWeight:700,color:'#1A3A7C',textTransform:'uppercase',letterSpacing:'.5px'}}>Nombre *</label>
                <input value={form.name} onChange={e=>setForm(p=>({...p,name:e.target.value}))}
                  placeholder="Ej: Normal Mañana, Invierno Tarde"
                  style={{padding:'10px 12px',border:'1.5px solid #CBE0F0',borderRadius:8,fontSize:13,color:'#1A3A7C',outline:'none'}}/>
              </div>

              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                <div style={{display:'flex',flexDirection:'column',gap:6}}>
                  <label style={{fontSize:11,fontWeight:700,color:'#1A3A7C',textTransform:'uppercase',letterSpacing:'.5px'}}>Turno</label>
                  <select value={form.shift} onChange={e=>setForm(p=>({...p,shift:e.target.value}))}
                    style={{padding:'10px 12px',border:'1.5px solid #CBE0F0',borderRadius:8,fontSize:13,color:'#1A3A7C',outline:'none'}}>
                    <option value="MORNING">Mañana</option>
                    <option value="AFTERNOON">Tarde / BTH</option>
                  </select>
                </div>
                <div style={{display:'flex',flexDirection:'column',gap:6}}>
                  <label style={{fontSize:11,fontWeight:700,color:'#1A3A7C',textTransform:'uppercase',letterSpacing:'.5px'}}>Tipo</label>
                  <select value={form.isWinter?'invierno':'normal'} onChange={e=>setForm(p=>({...p,isWinter:e.target.value==='invierno'}))}
                    style={{padding:'10px 12px',border:'1.5px solid #CBE0F0',borderRadius:8,fontSize:13,color:'#1A3A7C',outline:'none'}}>
                    <option value="normal">Normal</option>
                    <option value="invierno">Invierno</option>
                  </select>
                </div>
              </div>

              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                <div style={{display:'flex',flexDirection:'column',gap:6}}>
                  <label style={{fontSize:11,fontWeight:700,color:'#1A3A7C',textTransform:'uppercase',letterSpacing:'.5px'}}>Hora de Entrada</label>
                  <input type="time" value={form.startTime} onChange={e=>setForm(p=>({...p,startTime:e.target.value}))}
                    style={{padding:'10px 12px',border:'1.5px solid #CBE0F0',borderRadius:8,fontSize:13,color:'#1A3A7C',outline:'none'}}/>
                </div>
                <div style={{display:'flex',flexDirection:'column',gap:6}}>
                  <label style={{fontSize:11,fontWeight:700,color:'#1A3A7C',textTransform:'uppercase',letterSpacing:'.5px'}}>Hora de Salida</label>
                  <input type="time" value={form.exitTime} onChange={e=>setForm(p=>({...p,exitTime:e.target.value}))}
                    style={{padding:'10px 12px',border:'1.5px solid #CBE0F0',borderRadius:8,fontSize:13,color:'#1A3A7C',outline:'none'}}/>
                </div>
              </div>

              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12}}>
                <div style={{display:'flex',flexDirection:'column',gap:6}}>
                  <label style={{fontSize:11,fontWeight:700,color:'#1A3A7C',textTransform:'uppercase',letterSpacing:'.5px'}}>Periodos</label>
                  <select value={form.periods} onChange={e=>setForm(p=>({...p,periods:parseInt(e.target.value)}))}
                    style={{padding:'10px 12px',border:'1.5px solid #CBE0F0',borderRadius:8,fontSize:13,color:'#1A3A7C',outline:'none'}}>
                    <option value={6}>6 periodos</option>
                    <option value={7}>7 periodos</option>
                  </select>
                </div>
                <div style={{display:'flex',flexDirection:'column',gap:6}}>
                  <label style={{fontSize:11,fontWeight:700,color:'#1A3A7C',textTransform:'uppercase',letterSpacing:'.5px'}}>Min/periodo</label>
                  <input type="number" value={form.periodDuration} min={30} max={60}
                    onChange={e=>setForm(p=>({...p,periodDuration:parseInt(e.target.value)}))}
                    style={{padding:'10px 12px',border:'1.5px solid #CBE0F0',borderRadius:8,fontSize:13,color:'#1A3A7C',outline:'none'}}/>
                </div>
                <div style={{display:'flex',flexDirection:'column',gap:6}}>
                  <label style={{fontSize:11,fontWeight:700,color:'#1A3A7C',textTransform:'uppercase',letterSpacing:'.5px'}}>Min/recreo</label>
                  <input type="number" value={form.breakDuration} min={5} max={30}
                    onChange={e=>setForm(p=>({...p,breakDuration:parseInt(e.target.value)}))}
                    style={{padding:'10px 12px',border:'1.5px solid #CBE0F0',borderRadius:8,fontSize:13,color:'#1A3A7C',outline:'none'}}/>
                </div>
              </div>

              <div style={{display:'flex',flexDirection:'column',gap:6}}>
                <label style={{fontSize:11,fontWeight:700,color:'#1A3A7C',textTransform:'uppercase',letterSpacing:'.5px'}}>Recreo después del periodo (separado por comas)</label>
                <input value={form.breakAfter} onChange={e=>setForm(p=>({...p,breakAfter:e.target.value}))}
                  placeholder="2,4"
                  style={{padding:'10px 12px',border:'1.5px solid #CBE0F0',borderRadius:8,fontSize:13,color:'#1A3A7C',outline:'none'}}/>
                <span style={{fontSize:11,color:'#6B8BB0'}}>Ej: "2,4" = recreo después del 2do y 4to periodo</span>
              </div>

            </div>
            <div style={{display:'flex',justifyContent:'flex-end',gap:10,padding:'14px 20px',borderTop:'1px solid #CBE0F0'}}>
              <button onClick={()=>setShowModal(false)} style={{padding:'9px 16px',background:'#fff',border:'1.5px solid #CBE0F0',borderRadius:8,fontSize:13,cursor:'pointer',color:'#1A3A7C'}}>
                Cancelar
              </button>
              <button onClick={handleSave} style={{display:'flex',alignItems:'center',gap:6,padding:'9px 18px',background:'#1A3A7C',color:'#fff',border:'none',borderRadius:8,fontSize:13,fontWeight:600,cursor:'pointer'}}>
                <Save size={14}/> {editing?'Actualizar':'Crear'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .spinner{width:24px;height:24px;border:2px solid rgba(26,58,124,.2);border-top-color:#1A3A7C;border-radius:50%;animation:spin .7s linear infinite}
        @keyframes spin{to{transform:rotate(360deg)}}
      `}</style>
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
    <div style={{
      background:'#fff', border:`1px solid ${s.isActive?'#CBE0F0':'#E0E0E0'}`,
      borderRadius:12, overflow:'hidden', opacity:s.isActive?1:0.6
    }}>

      {/* Header */}
      <div style={{padding:'14px 18px',borderBottom:'1px solid #F0F6FC',display:'flex',alignItems:'center',gap:10}}>
        {s.isWinter ? <Snowflake size={16} color="#4A9FD4"/> : <Sun size={16} color="#BA7517"/>}
        <div style={{flex:1}}>
          <div style={{fontWeight:700,fontSize:14,color:'#1A3A7C'}}>{s.name}</div>
          <div style={{fontSize:12,color:'#6B8BB0'}}>
            {s.startTime} — {s.exitTime} · {s.periods} periodos · {s.periodDuration} min/periodo
          </div>
        </div>
        <div style={{display:'flex',gap:6}}>
          <button onClick={()=>onEdit(s)}
            style={{background:'#F0F6FC',border:'none',borderRadius:7,padding:'6px 10px',cursor:'pointer',color:'#1A3A7C',display:'flex',alignItems:'center',gap:4,fontSize:12}}>
            <Edit2 size={12}/> Editar
          </button>
          <button onClick={()=>!s.isActive && onToggle(s)} style={{
            background:s.isActive?'#E1F5EE':'#F0F6FC', border:'none', borderRadius:7,
            padding:'6px 10px', cursor:s.isActive?'default':'pointer',
            color:s.isActive?'#0F6E56':'#6B8BB0', fontSize:12, fontWeight:600
          }}>
            {s.isActive ? '✅ Activo' : 'Activar'}
          </button>
        </div>
      </div>

      {/* Recreos */}
      <div style={{padding:'10px 18px',borderBottom:'1px solid #F0F6FC',background:'#FFFDF0'}}>
        <div style={{fontSize:11,fontWeight:700,color:'#7A6000',textTransform:'uppercase',letterSpacing:'.5px',marginBottom:6}}>
          ☕ Recreos
        </div>
        <div style={{display:'flex',flexWrap:'wrap',gap:10,alignItems:'center'}}>
          <div style={{fontSize:12,color:'#7A6000'}}>
            <span style={{fontWeight:600}}>{cantidadRecreos}</span> recreo{cantidadRecreos!==1?'s':''}{' '}
            × <span style={{fontWeight:600}}>{s.breakDuration} min</span> c/u
            {' '}= <span style={{fontWeight:700}}>{totalMinReceso} min total</span>
          </div>
          <div style={{fontSize:12,color:'#7A6000'}}>
            Después del periodo: <span style={{fontWeight:600}}>{s.breakAfter}</span>
          </div>
        </div>
        <div style={{display:'flex',flexWrap:'wrap',gap:8,marginTop:8}}>
          <div style={{
            background:'#FFF8DC',border:'1px solid #F5C518',borderRadius:20,
            padding:'2px 10px',fontSize:11,color:'#7A6000',fontWeight:600
          }}>
            +{minExtraPeriodo} min efectivos/periodo
          </div>
          <div style={{
            background:'#1A3A7C',borderRadius:20,
            padding:'2px 10px',fontSize:11,color:'#fff',fontWeight:600
          }}>
            ⏱ Duración efectiva: {duracionEfectiva} min/periodo
          </div>
        </div>
      </div>

      {/* Periodos con recreos intercalados */}
      {periodos.length > 0 && (
        <div style={{padding:'12px 18px'}}>
          <div style={{fontSize:11,fontWeight:700,color:'#6B8BB0',textTransform:'uppercase',letterSpacing:'.5px',marginBottom:8}}>
            Distribución de periodos
          </div>
          <div style={{display:'flex',flexWrap:'wrap',gap:6,alignItems:'center'}}>
            {periodos.map(p => (
              <div key={p.period} style={{display:'flex',alignItems:'center',gap:4}}>
                <div style={{
                  background:'#F0F6FC',borderRadius:8,padding:'4px 10px',
                  fontSize:12,color:'#1A3A7C',fontWeight:600,
                }}>
                  P{p.period}: {p.startTime}–{p.endTime}
                </div>
                {breakPeriods.includes(p.period) && (
                  <div style={{
                    background:'#FFFBEA',border:'1px solid #F5C518',borderRadius:8,
                    padding:'4px 8px',fontSize:11,color:'#7A6000',fontWeight:600,
                    display:'flex',alignItems:'center',gap:3
                  }}>
                    ☕ {s.breakDuration}min
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}