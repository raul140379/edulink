'use client'
 
import { useState, useEffect, useCallback } from 'react'
import {
  BookOpen, Users, ChevronRight, Plus, Trash2,
  CheckCircle, AlertCircle, Lock, Edit3, X, Save
} from 'lucide-react'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

interface Trimester  { id: number; number: number; name: string | null; isClosed: boolean }
interface TeacherSubject {
  id: number; subjectId: number; courseId: number
  subject: { id: number; name: string }
  course:  { id: number; grade: string; parallel: string; level: string }
}
interface Student    { id: number; firstName: string; lastName: string; kardex: string | null }
interface NotaItem   { id: number; dimension: 'SABER'|'HACER'; titulo: string; puntaje: number; maxPuntaje: number; fecha: string|null }
interface Nota {
  id: number; saber: number|null; hacer: number|null; ser: number|null
  autoEvaluacion: number|null; total: number|null; cerrado: boolean
  items: NotaItem[]
}

const GRADES: Record<string,string> = {
  PRIMERO:'1°',SEGUNDO:'2°',TERCERO:'3°',CUARTO:'4°',QUINTO:'5°',SEXTO:'6°'
}

export default function TeacherNotasPage() {
  const [teacherId,  setTeacherId]  = useState<number|null>(null)
  const [trimestres, setTrimestres] = useState<Trimester[]>([])
  const [materias,   setMaterias]   = useState<TeacherSubject[]>([])
  const [selTrim,    setSelTrim]    = useState<Trimester|null>(null)
  const [selMateria, setSelMateria] = useState<TeacherSubject|null>(null)
  const [students,   setStudents]   = useState<Student[]>([])
  const [notas,      setNotas]      = useState<Record<number,Nota>>({})
  const [selStudent, setSelStudent] = useState<Student|null>(null)
  const [loading,    setLoading]    = useState(false)
  const [trimBlockMsg, setTrimBlockMsg] = useState<string|null>(null)
  const [toast,      setToast]      = useState<{type:'ok'|'err';text:string}|null>(null)
  const year = new Date().getFullYear()

  const token = () => typeof window !== 'undefined' ? localStorage.getItem('token')||'' : ''
  const auth  = () => ({ Authorization: `Bearer ${token()}` })

  const showToast = (type:'ok'|'err', text:string) => {
    setToast({type,text}); setTimeout(()=>setToast(null),4000)
  }

  useEffect(() => {
    const init = async () => {
      try {
        const me = await fetch(`${API}/api/auth/me`,{headers:auth()}).then(r=>r.json())
        const tid = me.teacher?.id
        if (!tid) { showToast('err','No se encontró el perfil del maestro'); return }
        setTeacherId(tid)
        const [trims, mats] = await Promise.all([
          fetch(`${API}/api/notas/trimestres?year=${year}`,{headers:auth()}).then(r=>r.json()),
          fetch(`${API}/api/notas/teacher-subjects/${tid}`,{headers:auth()}).then(r=>r.json()),
        ])
        setTrimestres(Array.isArray(trims)?trims:[])
        setMaterias(Array.isArray(mats)?mats:[])
        if (Array.isArray(trims)&&trims.length>0) setSelTrim(trims[0])
      } catch { showToast('err','Error al cargar datos iniciales') }
    }
    init()
  }, [])

const loadStudentsAndNotas = useCallback(async () => {
  
    if (!selMateria||!selTrim) return
    setLoading(true); setStudents([]); setNotas({}); setSelStudent(null)
    try {
      const [studs, notasArr] = await Promise.all([
        fetch(`${API}/api/notas/course-students/${selMateria.courseId}?year=${year}`,{headers:auth()}).then(r=>r.json()),
        fetch(`${API}/api/notas/course/${selMateria.courseId}?trimesterId=${selTrim.id}`,{headers:auth()}).then(r=>r.json()),
      ])
      setStudents(Array.isArray(studs)?studs:[])
      const map: Record<number,Nota> = {}
      if (Array.isArray(notasArr)) {
        notasArr.filter((n:any)=>n.subjectId===selMateria.subjectId)
          .forEach((n:any)=>{ map[n.studentId]=n })
      }
      setNotas(map)

      // 1. Verificar si el trimestre está cerrado por el director
      if (selTrim.isClosed) {
        setTrimBlockMsg(`🔒 El ${selTrim.number}° Trimestre fue cerrado por la dirección. No se pueden modificar notas.`)
      } else if (selTrim.number > 1) {
        // 2. Verificar trimestre anterior
        const trimAnterior = trimestres.find(t => t.number === selTrim.number - 1)
        if (trimAnterior) {
          const notasAnt = await fetch(
            `${API}/api/notas/course/${selMateria.courseId}?trimesterId=${trimAnterior.id}`,
            {headers:auth()}
          ).then(r=>r.json())
          const notasAntMateria = Array.isArray(notasAnt)
            ? notasAnt.filter((n:any) => n.subjectId === selMateria.subjectId)
            : []
          if (notasAntMateria.length === 0) {
            setTrimBlockMsg(`⚠️ El ${selTrim.number - 1}° Trimestre no tiene notas registradas. Debes completarlo antes.`)
          } else if (!notasAntMateria.every((n:any) => n.cerrado)) {
            setTrimBlockMsg(`⚠️ El ${selTrim.number - 1}° Trimestre no está completamente cerrado. Ciérralo antes de continuar.`)
          } else {
            setTrimBlockMsg(null)
          }
        }
      } else {
        setTrimBlockMsg(null)
      }

    } catch { showToast('err','Error al cargar estudiantes') }
    finally { setLoading(false) }
  },[selMateria, selTrim, trimestres])

  useEffect(()=>{ loadStudentsAndNotas() },[loadStudentsAndNotas])

  const openDetalle = async (student: Student) => {
    if (!selMateria||!selTrim||!teacherId) return
    let nota = notas[student.id]
    if (!nota) {
      try {
        const res = await fetch(`${API}/api/notas/init`,{
          method:'POST', headers:{...auth(),'Content-Type':'application/json'},
          body: JSON.stringify({
            studentId: student.id, subjectId: selMateria.subjectId,
            courseId: selMateria.courseId, teacherId, trimesterId: selTrim.id
          })
        })
        nota = await res.json()
        setNotas(prev=>({...prev,[student.id]:{...nota,items:[]}}))
      } catch { showToast('err','Error al inicializar nota'); return }
    }
    try {
      const det = await fetch(`${API}/api/notas/detalle/${nota.id}`,{headers:auth()}).then(r=>r.json())
      setNotas(prev=>({...prev,[student.id]:det}))
    } catch {}
    setSelStudent(student)
  }

  const refreshNota = async (notaId:number, studentId:number) => {
    try {
      const det = await fetch(`${API}/api/notas/detalle/${notaId}`,{headers:auth()}).then(r=>r.json())
      setNotas(prev=>({...prev,[studentId]:det}))
    } catch {}
  }

  const nota = selStudent ? notas[selStudent.id] : null

  const totalSinNota = students.filter(s=>!notas[s.id]?.total).length
  const aprobados    = students.filter(s=>{ const t=notas[s.id]?.total; return t!=null&&t>=51 }).length
  const reprobados   = students.filter(s=>{ const t=notas[s.id]?.total; return t!=null&&t<51 }).length

  const courseLabel = selMateria
    ? `${GRADES[selMateria.course.grade]||selMateria.course.grade} "${selMateria.course.parallel}"`
    : ''

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Registro de Notas</h1>
          <p>Gestión {year} · Saber(45) + Hacer(40) + Ser(10) + Autoevaluación(5) = 100 pts · Aprobado ≥ 51</p>
        </div>
      </div>

      {toast && (
        <div className={`alert ${toast.type==='ok'?'suc':'err'}`}>
          {toast.type==='ok'?<CheckCircle size={14}/>:<AlertCircle size={14}/>} {toast.text}
        </div>
      )}

      <div className="filter-card">
        <div className="filter-group">
          <div className="filter-label">Trimestre</div>
          <div className="trim-btns">
            {trimestres.map(t=>(
              <button key={t.id} className={`trim-btn${selTrim?.id===t.id?' active':''}`}
                onClick={()=>setSelTrim(t)}>
                {t.name||`${t.number}° Trimestre`}
              </button>
            ))}
          </div>
        </div>
        <div className="filter-group" style={{flex:1,minWidth:240}}>
          <div className="filter-label">Materia</div>
          <select className="filter-select" value={selMateria?.id??''}
            onChange={e=>setSelMateria(materias.find(m=>m.id===parseInt(e.target.value))??null)}>
            <option value="">— Seleccionar materia —</option>
            {materias.map(m=>(
              <option key={m.id} value={m.id}>
                {m.subject.name} · {GRADES[m.course.grade]||m.course.grade} "{m.course.parallel}"
              </option>
            ))}
          </select>
        </div>
      </div>

      {!selMateria && (
        <div className="empty-state"><BookOpen size={48} color="#CBE0F0"/><p>Selecciona un trimestre y una materia</p></div>
      )}

      {selMateria && loading && <div className="center"><div className="spinner"/></div>}

      {selMateria && !loading && students.length > 0 && !selStudent && (
        <>
          {trimBlockMsg && (
            <div className="trim-block-msg">{trimBlockMsg}</div>
          )}
          <div className="stats-grid">
            <div className="stat-card"><div className="stat-num" style={{color:'#1A3A7C'}}>{students.length}</div><div className="stat-lbl">Estudiantes</div></div>
            <div className="stat-card"><div className="stat-num" style={{color:'#0F6E56'}}>{aprobados}</div><div className="stat-lbl">Aprobados</div></div>
            <div className="stat-card"><div className="stat-num" style={{color:'#C0392B'}}>{reprobados}</div><div className="stat-lbl">Reprobados</div></div>
            <div className="stat-card"><div className="stat-num" style={{color:'#BA7517'}}>{totalSinNota}</div><div className="stat-lbl">Sin nota</div></div>
          </div>

          <div className="table-card">
            <div className="table-header">
              <div style={{display:'flex',alignItems:'center',gap:8,fontSize:13,color:'#6B8BB0'}}>
                <Users size={14}/>
                <strong style={{color:'#1A3A7C'}}>{courseLabel}</strong>
                <span>·</span><span>{selMateria.subject.name}</span>
                <span>·</span><span>{selTrim?.name||`${selTrim?.number}° Trimestre`}</span>
              </div>
            </div>
            <table>
              <thead>
                <tr>
                  <th>#</th><th>Estudiante</th><th>Kardex</th>
                  <th style={{textAlign:'center'}}>Saber/45</th>
                  <th style={{textAlign:'center'}}>Hacer/40</th>
                  <th style={{textAlign:'center'}}>Ser/10</th>
                  <th style={{textAlign:'center'}}>AutoEval/5</th>
                  <th style={{textAlign:'center'}}>Total</th>
                  <th style={{textAlign:'center'}}>Estado</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {students.map((s,i)=>{
                  const n = notas[s.id]
                  const total = n?.total
                  const aprobado = total!=null && total>=51
                  return (
                    <tr key={s.id}>
                      <td className="muted">{i+1}</td>
                      <td style={{fontWeight:500}}>{s.lastName} {s.firstName}</td>
                      <td className="muted mono">{s.kardex??'—'}</td>
                      <td style={{textAlign:'center'}}>{n?.saber!=null?n.saber.toFixed(1):<span className="muted">—</span>}</td>
                      <td style={{textAlign:'center'}}>{n?.hacer!=null?n.hacer.toFixed(1):<span className="muted">—</span>}</td>
                      <td style={{textAlign:'center'}}>{n?.ser!=null?n.ser.toFixed(1):<span className="muted">—</span>}</td>
                      <td style={{textAlign:'center'}}>{n?.autoEvaluacion!=null?n.autoEvaluacion.toFixed(1):<span className="muted">—</span>}</td>
                      <td style={{textAlign:'center'}}>
                        {total!=null
                          ? <strong style={{color:aprobado?'#0F6E56':'#C0392B'}}>{total.toFixed(1)}</strong>
                          : <span className="muted">—</span>}
                      </td>
                      <td style={{textAlign:'center'}}>
                        {n?.cerrado
                          ? <span className="badge cerrado"><Lock size={10}/> Cerrado</span>
                          : total!=null
                            ? aprobado
                              ? <span className="badge apr">Aprobado</span>
                              : <span className="badge rep">Reprobado</span>
                            : <span className="badge sin">Sin nota</span>}
                      </td>
                      <td>
                        <button
                          className="btn-detalle"
                          onClick={()=>!trimBlockMsg && openDetalle(s)}
                          disabled={!!trimBlockMsg}
                          style={trimBlockMsg ? {opacity:0.4, cursor:'not-allowed'} : {}}>
                          <Edit3 size={13}/> Editar <ChevronRight size={12}/>
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {selStudent && nota && (
        <DetalleNota
          student={selStudent} nota={nota}
          selMateria={selMateria!} selTrim={selTrim!}
          teacherId={teacherId!} token={token()}
          onBack={()=>setSelStudent(null)}
          onRefresh={()=>refreshNota(nota.id, selStudent.id)}
          showToast={showToast}
        />
      )}

      <style>{`
        .page-header{margin-bottom:24px}
        .page-header h1{font-size:20px;font-weight:700;color:#1565C0;margin-bottom:4px}
        .page-header p{font-size:12px;color:#6B8BB0}
        .alert{display:flex;align-items:center;gap:8px;padding:10px 14px;border-radius:8px;font-size:13px;margin-bottom:16px}
        .alert.suc{background:#E1F5EE;border:1px solid #9FE1CB;color:#0F6E56}
        .alert.err{background:#FFF0F0;border:1px solid #FFBBBB;color:#C0392B}
        .filter-card{background:#fff;border:1px solid #CBE0F0;border-radius:12px;padding:20px;margin-bottom:20px;display:flex;flex-wrap:wrap;gap:20px}
        .filter-group{display:flex;flex-direction:column;gap:8px}
        .filter-label{font-size:11px;font-weight:700;color:#6B8BB0;text-transform:uppercase;letter-spacing:.6px}
        .trim-btns{display:flex;gap:8px;flex-wrap:wrap}
        .trim-btn{padding:7px 16px;border-radius:8px;font-size:13px;font-weight:500;border:1.5px solid #CBE0F0;background:#fff;color:#1A3A7C;cursor:pointer;transition:all .15s}
        .trim-btn:hover{border-color:#4A9FD4}
        .trim-btn.active{background:#1565C0;color:#fff;border-color:#1565C0}
        .filter-select{padding:9px 12px;border:1.5px solid #CBE0F0;border-radius:8px;font-size:13px;color:#1A3A7C;outline:none;width:100%}
        .stats-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px}
        .stat-card{background:#fff;border:1px solid #CBE0F0;border-radius:12px;padding:16px;text-align:center}
        .stat-num{font-size:28px;font-weight:800}
        .stat-lbl{font-size:12px;color:#6B8BB0;margin-top:4px}
        .table-card{background:#fff;border:1px solid #CBE0F0;border-radius:12px;overflow:hidden;margin-bottom:20px}
        .table-header{display:flex;align-items:center;justify-content:space-between;padding:14px 18px;border-bottom:1px solid #F0F6FC;flex-wrap:wrap;gap:10px}
        table{width:100%;border-collapse:collapse}
        thead tr{background:#F0F6FC}
        th{padding:10px 14px;text-align:left;font-size:11px;font-weight:600;color:#1A3A7C;text-transform:uppercase;letter-spacing:.5px}
        td{padding:10px 14px;font-size:13px;color:#1A3A7C;border-top:1px solid #F0F6FC}
        tr:hover td{background:#FAFCFF}
        .muted{color:#6B8BB0;font-size:12px}
        .mono{font-family:monospace}
        .badge{display:inline-flex;align-items:center;gap:4px;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:600}
        .badge.apr{background:#E1F5EE;color:#0F6E56}
        .badge.rep{background:#FFF0F0;color:#C0392B}
        .badge.sin{background:#F5F5F5;color:#888}
        .badge.cerrado{background:#FFF3E0;color:#E67E22}
        .btn-detalle{display:inline-flex;align-items:center;gap:4px;padding:5px 12px;border:1.5px solid #CBE0F0;border-radius:8px;background:#fff;color:#1A3A7C;font-size:12px;cursor:pointer}
        .btn-detalle:hover{border-color:#1565C0;color:#1565C0}
        .empty-state{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:60px;gap:12px;color:#6B8BB0;font-size:13px}
        .center{display:flex;justify-content:center;padding:48px}
        .spinner{width:24px;height:24px;border:2px solid rgba(99,56,6,.2);border-top-color:#1565C0;border-radius:50%;animation:spin .7s linear infinite}
        @keyframes spin{to{transform:rotate(360deg)}}
        .trim-block-msg{background:#FFF3E0;border:1px solid #F39C12;border-radius:10px;padding:14px 18px;font-size:13px;color:#7D4E00;margin-bottom:16px;font-weight:500}
        @media(max-width:600px){.stats-grid{grid-template-columns:1fr 1fr}}
      `}</style>
    </div>
  )
}

function DetalleNota({
  student, nota, selMateria, selTrim, teacherId, token, onBack, onRefresh, showToast
}: {
  student: Student; nota: Nota; selMateria: TeacherSubject; selTrim: Trimester
  teacherId: number; token: string; onBack: ()=>void
  onRefresh: ()=>void; showToast:(t:'ok'|'err',m:string)=>void
}) {
  const [newSaber, setNewSaber] = useState({titulo:'', puntaje:'', maxPuntaje:'45', fecha:''})
  const [newHacer, setNewHacer] = useState({titulo:'', puntaje:'', maxPuntaje:'40', fecha:''})
  const [editItem, setEditItem] = useState<NotaItem|null>(null)
  const [serVal,   setSerVal]   = useState(nota.ser!=null?String(nota.ser):'')
  const [saving,   setSaving]   = useState(false)
  const auth = { Authorization:`Bearer ${token}`, 'Content-Type':'application/json' }

  const itemsSaber = nota.items.filter(i=>i.dimension==='SABER')
  const itemsHacer = nota.items.filter(i=>i.dimension==='HACER')

  const addItem = async (dimension: 'SABER'|'HACER') => {
    const newItem = dimension==='SABER' ? newSaber : newHacer
    const maxPts  = dimension==='SABER' ? 45 : 40
    if (!newItem.titulo||newItem.puntaje==='') { showToast('err','Completa título y puntaje'); return }
    const pts = parseFloat(newItem.puntaje)
    if (pts<0||pts>maxPts) { showToast('err',`Puntaje debe ser entre 0 y ${maxPts}`); return }
    setSaving(true)
    try {
      const res = await fetch(`${API}/api/notas/items`,{
        method:'POST', headers:auth,
        body: JSON.stringify({ notaId:nota.id, dimension, titulo:newItem.titulo, puntaje:pts, maxPuntaje:maxPts, fecha:newItem.fecha||null })
      })
      const data = await res.json()
      if (!res.ok) { showToast('err',data.error||'Error'); return }
      showToast('ok','Ítem agregado')
      if (dimension==='SABER') setNewSaber({titulo:'',puntaje:'',maxPuntaje:'45',fecha:''})
      else setNewHacer({titulo:'',puntaje:'',maxPuntaje:'40',fecha:''})
      onRefresh()
    } catch { showToast('err','Error de conexión') }
    finally { setSaving(false) }
  }

  const deleteItem = async (itemId:number) => {
    if (!confirm('¿Eliminar este ítem?')) return
    try {
      const res = await fetch(`${API}/api/notas/items/${itemId}`,{ method:'DELETE', headers:auth })
      const data = await res.json()
      if (!res.ok) { showToast('err',data.error||'Error'); return }
      showToast('ok','Ítem eliminado')
      onRefresh()
    } catch { showToast('err','Error de conexión') }
  }

  const saveEdit = async () => {
    if (!editItem) return
    setSaving(true)
    try {
      const res = await fetch(`${API}/api/notas/items/${editItem.id}`,{
        method:'PUT', headers:auth,
        body: JSON.stringify({ titulo:editItem.titulo, puntaje:editItem.puntaje, maxPuntaje:editItem.maxPuntaje, fecha:editItem.fecha })
      })
      const data = await res.json()
      if (!res.ok) { showToast('err',data.error||'Error'); return }
      showToast('ok','Ítem actualizado')
      setEditItem(null)
      onRefresh()
    } catch { showToast('err','Error de conexión') }
    finally { setSaving(false) }
  }

  const saveSer = async () => {
    const val = parseFloat(serVal)
    if (isNaN(val)||val<0||val>10) { showToast('err','Ser debe estar entre 0 y 10'); return }
    setSaving(true)
    try {
      const res = await fetch(`${API}/api/notas/${nota.id}/ser`,{
        method:'PUT', headers:auth, body:JSON.stringify({ser:val})
      })
      const data = await res.json()
      if (!res.ok) { showToast('err',data.error||'Error'); return }
      showToast('ok','Nota Ser guardada')
      onRefresh()
    } catch { showToast('err','Error de conexión') }
    finally { setSaving(false) }
  }

  const cerrar = async () => {
    if (!confirm('¿Cerrar el trimestre? Esta acción no se puede deshacer.')) return
    try {
      const res = await fetch(`${API}/api/notas/${nota.id}/cerrar`,{method:'PUT',headers:auth})
      const data = await res.json()
      if (!res.ok) { showToast('err',data.error||'Error'); return }
      showToast('ok','Trimestre cerrado')
      onRefresh()
    } catch { showToast('err','Error de conexión') }
  }

  const total    = nota.total
  const aprobado = total!=null && total>=51

  return (
    <div className="detalle-wrap">
      <div className="det-header">
        <button className="btn-back" onClick={onBack}>← Volver</button>
        <div>
          <div className="det-title">{student.lastName} {student.firstName}</div>
          <div className="det-sub">{selMateria.subject.name} · {selTrim.name||`${selTrim.number}° Trimestre`}</div>
        </div>
        {nota.cerrado
          ? <span className="badge cerrado" style={{marginLeft:'auto'}}><Lock size={12}/> Trimestre cerrado</span>
          : total!=null && (
            <button className="btn-cerrar" onClick={cerrar}><Lock size={13}/> Cerrar trimestre</button>
          )}
      </div>

      {/* Resumen dimensiones */}
      <div className="dim-grid">
        <DimCard label="Saber"          max={45} value={nota.saber}          color="#1A3A7C" items={itemsSaber.length}/>
        <DimCard label="Hacer"          max={40} value={nota.hacer}          color="#0F6E56" items={itemsHacer.length}/>
        <DimCard label="Ser"            max={10} value={nota.ser}            color="#1565C0" items={null}/>
        <DimCard label="Autoevaluación" max={5}  value={nota.autoEvaluacion} color="#4A9FD4" items={null}/>
        <div className="dim-card total-card">
          <div className="dim-label">TOTAL</div>
          <div className="dim-value" style={{color:aprobado?'#0F6E56':'#C0392B',fontSize:32}}>
            {total!=null?total.toFixed(1):'—'}
          </div>
          <div className="dim-max">/ 100</div>
          {total!=null && <span className={`badge ${aprobado?'apr':'rep'}`}>{aprobado?'Aprobado':'Reprobado'}</span>}
        </div>
      </div>
 
      {/* SABER — siempre solo lectura, se alimenta desde Tareas y Exámenes */}
      <ItemsReadOnly label="Saber" color="#1A3A7C" items={itemsSaber} maxPts={45}
        hint="Los ítems de Saber se registran automáticamente desde el módulo de Tareas y Exámenes."/>

      {/* HACER — siempre solo lectura, se alimenta desde Tareas y Exámenes */}
      <ItemsReadOnly label="Hacer" color="#0F6E56" items={itemsHacer} maxPts={40}
        hint="Los ítems de Hacer se registran automáticamente desde el módulo de Tareas y Exámenes."/>

      {/* SER */}
      <div className="section-card">
        <div className="section-title" style={{color:'#1565C0'}}>
          Ser <span className="dim-badge" style={{background:'#FFF3E6',color:'#1565C0'}}>máx 10 pts</span>
        </div>
        {nota.cerrado
          ? <div className="readonly-val">{nota.ser!=null?nota.ser:'—'} / 10</div>
          : <div style={{display:'flex',alignItems:'center',gap:12}}>
              <input type="number" min={0} max={10} step={0.5}
                value={serVal} onChange={e=>setSerVal(e.target.value)}
                placeholder="0 – 10" className="dim-input"/>
              <button className="btn-guardar" onClick={saveSer} disabled={saving}>
                <Save size={13}/> Guardar
              </button>
            </div>}
        <p className="dim-hint">Valores, ética, actitud y convivencia. Lo ingresa el maestro al finalizar el trimestre.</p>
      </div>

      {/* AUTOEVALUACIÓN */}
      <div className="section-card">
        <div className="section-title" style={{color:'#4A9FD4'}}>
          Autoevaluación <span className="dim-badge" style={{background:'#EAF5FF',color:'#4A9FD4'}}>máx 5 pts</span>
        </div>
        <div className="readonly-val">{nota.autoEvaluacion!=null?nota.autoEvaluacion:'—'} / 5</div>
        <p className="dim-hint">La ingresa el propio estudiante desde su dashboard.</p>
      </div>

      <style>{`
        .detalle-wrap{background:#fff;border:1px solid #CBE0F0;border-radius:12px;padding:24px;margin-bottom:20px}
        .det-header{display:flex;align-items:center;gap:16px;margin-bottom:20px;flex-wrap:wrap}
        .btn-back{padding:7px 14px;border:1.5px solid #CBE0F0;border-radius:8px;background:#fff;color:#1A3A7C;font-size:13px;cursor:pointer;white-space:nowrap}
        .btn-back:hover{border-color:#1565C0;color:#1565C0}
        .det-title{font-size:16px;font-weight:700;color:#1A3A7C}
        .det-sub{font-size:12px;color:#6B8BB0}
        .btn-cerrar{display:inline-flex;align-items:center;gap:6px;padding:7px 14px;background:#E67E22;color:#fff;border:none;border-radius:8px;font-size:13px;cursor:pointer;margin-left:auto;white-space:nowrap}
        .dim-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:12px;margin-bottom:20px}
        .dim-card{background:#F8FBFF;border:1px solid #CBE0F0;border-radius:10px;padding:14px;text-align:center}
        .total-card{border-color:#1A3A7C}
        .dim-label{font-size:10px;font-weight:700;color:#6B8BB0;text-transform:uppercase;letter-spacing:.6px;margin-bottom:6px}
        .dim-value{font-size:24px;font-weight:800}
        .dim-max{font-size:11px;color:#6B8BB0;margin-top:2px}
        .dim-items{font-size:11px;color:#6B8BB0;margin-top:4px}
        .section-card{background:#fff;border:1px solid #CBE0F0;border-radius:10px;padding:16px;margin-bottom:14px}
        .section-title{font-size:14px;font-weight:700;margin-bottom:12px;display:flex;align-items:center;gap:8px}
        .dim-badge{font-size:10px;font-weight:600;padding:2px 8px;border-radius:20px}
        .items-table{width:100%;border-collapse:collapse;margin-bottom:12px}
        .items-table th{padding:7px 10px;text-align:left;font-size:10px;font-weight:600;color:#6B8BB0;text-transform:uppercase;background:#F8FBFF;border-bottom:1px solid #F0F6FC}
        .items-table td{padding:8px 10px;font-size:13px;color:#1A3A7C;border-top:1px solid #F8FBFF}
        .porc{font-size:11px;color:#6B8BB0}
        .add-row{display:flex;gap:8px;flex-wrap:wrap;align-items:center;padding:12px;background:#F8FBFF;border-radius:8px;border:1px dashed #CBE0F0}
        .add-input{padding:7px 10px;border:1.5px solid #CBE0F0;border-radius:7px;font-size:13px;color:#1A3A7C;outline:none}
        .add-input:focus{border-color:#4A9FD4}
        .add-input.sm{width:80px}
        .add-input.md{width:160px}
        .dim-input{width:90px;padding:7px 10px;border:1.5px solid #CBE0F0;border-radius:8px;font-size:14px;color:#1A3A7C;outline:none;text-align:center}
        .btn-guardar{display:inline-flex;align-items:center;gap:6px;padding:7px 14px;background:#1565C0;color:#fff;border:none;border-radius:8px;font-size:13px;cursor:pointer}
        .btn-guardar:disabled{opacity:.6}
        .btn-add{display:inline-flex;align-items:center;gap:5px;padding:7px 14px;background:#1A3A7C;color:#fff;border:none;border-radius:8px;font-size:13px;cursor:pointer}
        .btn-icon{background:none;border:none;cursor:pointer;padding:4px;border-radius:6px;color:#6B8BB0}
        .btn-icon:hover{background:#F0F6FC;color:#C0392B}
        .readonly-val{font-size:20px;font-weight:700;color:#1A3A7C;margin-bottom:8px}
        .dim-hint{font-size:12px;color:#6B8BB0;margin-top:8px}
        .badge{display:inline-flex;align-items:center;gap:4px;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:600}
        .badge.apr{background:#E1F5EE;color:#0F6E56}
        .badge.rep{background:#FFF0F0;color:#C0392B}
        .badge.cerrado{background:#FFF3E0;color:#E67E22}
        @media(max-width:700px){.dim-grid{grid-template-columns:repeat(2,1fr)}.add-row{flex-direction:column}}
      `}</style>
    </div>
  )
}

function DimCard({label,max,value,color,items}:{label:string;max:number;value:number|null;color:string;items:number|null}) {
  return (
    <div className="dim-card">
      <div className="dim-label">{label}</div>
      <div className="dim-value" style={{color}}>{value!=null?value.toFixed(1):'—'}</div>
      <div className="dim-max">/ {max}</div>
      {items!=null && <div className="dim-items">{items} ítem{items!==1?'s':''}</div>}
    </div>
  )
}

function ItemsSection({label,color,bgColor,dimension,maxPts,items,editItem,setEditItem,onDelete,onSaveEdit,saving,newItem,setNewItem,onAdd}:{
  label:string;color:string;bgColor:string;dimension:'SABER'|'HACER';maxPts:number
  items:NotaItem[];editItem:NotaItem|null;setEditItem:(i:NotaItem|null)=>void
  onDelete:(id:number)=>void;onSaveEdit:()=>void;saving:boolean
  newItem:any;setNewItem:(v:any)=>void;onAdd:()=>void
}) {
  return (
    <div className="section-card">
      <div className="section-title" style={{color}}>
        {label} <span className="dim-badge" style={{background:bgColor,color}}>máx {maxPts} pts</span>
      </div>
      {items.length>0 && (
        <table className="items-table">
          <thead>
            <tr><th>Título</th><th>Fecha</th><th>Puntaje</th><th>Máx</th><th>→ pts escala</th><th></th></tr>
          </thead>
          <tbody>
            {items.map(item=>(
              <tr key={item.id}>
                {editItem?.id===item.id ? (
                  <>
                    <td><input className="add-input md" value={editItem.titulo} onChange={e=>setEditItem({...editItem,titulo:e.target.value})}/></td>
                    <td><input type="date" className="add-input" value={editItem.fecha?.slice(0,10)||''} onChange={e=>setEditItem({...editItem,fecha:e.target.value})}/></td>
                    <td><input type="number" min={0} max={editItem.maxPuntaje} className="add-input sm" value={editItem.puntaje} onChange={e=>setEditItem({...editItem,puntaje:parseFloat(e.target.value)})}/></td>
                    <td><span className="muted">{editItem.maxPuntaje}</span></td>
                    <td className="porc">{Math.round((editItem.puntaje/editItem.maxPuntaje)*maxPts*100)/100}</td>
                    <td style={{display:'flex',gap:4}}>
                      <button className="btn-guardar" onClick={onSaveEdit} disabled={saving}><Save size={12}/></button>
                      <button className="btn-icon" onClick={()=>setEditItem(null)}><X size={12}/></button>
                    </td>
                  </>
                ) : (
                  <>
                    <td>{item.titulo}</td>
                    <td className="muted">{item.fecha?new Date(item.fecha).toLocaleDateString('es-BO'):'—'}</td>
                    <td><strong>{item.puntaje}</strong></td>
                    <td className="muted">{item.maxPuntaje}</td>
                    <td className="porc">{Math.round((item.puntaje/item.maxPuntaje)*maxPts*100)/100} pts</td>
                    <td style={{display:'flex',gap:4}}>
                      <button className="btn-icon" onClick={()=>setEditItem(item)}><Edit3 size={13}/></button>
                      <button className="btn-icon" onClick={()=>onDelete(item.id)}><Trash2 size={13}/></button>
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div className="add-row">
        <input className="add-input md" placeholder={`Título (ej: Examen 1)`}
          value={newItem.titulo} onChange={e=>setNewItem({...newItem,titulo:e.target.value})}/>
        <input type="number" min={0} max={maxPts} className="add-input sm" placeholder="Nota"
          value={newItem.puntaje} onChange={e=>setNewItem({...newItem,puntaje:e.target.value})}/>
        <span style={{fontSize:13,color:'#6B8BB0'}}>/ {maxPts}</span>
        <input type="date" className="add-input"
          value={newItem.fecha} onChange={e=>setNewItem({...newItem,fecha:e.target.value})}/>
        <button className="btn-add" onClick={onAdd} disabled={saving}><Plus size={13}/> Agregar</button>
      </div>
    </div>
  )
}

function ItemsReadOnly({label, color, items, maxPts, hint}: {
  label: string; color: string; items: NotaItem[]; maxPts: number; hint?: string
}) {
  return (
    <div className="section-card">
      <div className="section-title" style={{color}}>
        {label}
        <span className="dim-badge" style={{background:'#F0F6FC',color:'#6B8BB0',fontSize:10,marginLeft:6}}>
          Solo lectura
        </span>
      </div>
      {hint && <p className="dim-hint" style={{marginBottom:10,color:'#6B8BB0',fontStyle:'italic'}}>{hint}</p>}
      {items.length === 0
        ? <p className="dim-hint">Sin ítems registrados. Crea tareas o exámenes desde el módulo correspondiente.</p>
        : <table className="items-table">
            <thead><tr><th>Título</th><th>Fecha</th><th>Puntaje</th><th>Máx</th><th>→ pts</th></tr></thead>
            <tbody>
              {items.map(i=>(
                <tr key={i.id}>
                  <td>{i.titulo}</td>
                  <td className="muted">{i.fecha?new Date(i.fecha).toLocaleDateString('es-BO'):'—'}</td>
                  <td><strong>{i.puntaje}</strong></td>
                  <td className="muted">{i.maxPuntaje}</td>
                  <td className="porc">{Math.round((i.puntaje/i.maxPuntaje)*maxPts*100)/100} pts</td>
                </tr>
              ))}
            </tbody>
          </table>}
    </div>
  )
}




