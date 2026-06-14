'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Plus, X, BookOpen, Users, CheckCircle, AlertCircle,
  Trash2, Edit3, Link, FileText, Clock, ChevronRight, Save
} from 'lucide-react'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

interface Trimester    { id: number; number: number; name: string | null }
interface TeacherSubject {
  id: number; subjectId: number; courseId: number
  subject: { id: number; name: string }
  course:  { id: number; grade: string; parallel: string; level: string }
}
interface Student      { id: number; firstName: string; lastName: string; kardex: string | null }
interface Task {
  id: number; title: string; description: string | null; type: string
  maxScore: number; dueDate: string | null; attachmentUrl: string | null
  subject: { id: number; name: string }
  teacher: { id: number; firstName: string; lastName: string }
  trimester: { id: number; number: number; name: string } | null
  _count: { submissions: number }
}
interface Submission {
  id: number; score: number | null; note: string | null; status: string
  student: { id: number; firstName: string; lastName: string; kardex: string | null }
}

const GRADES: Record<string,string> = {
  PRIMERO:'1°',SEGUNDO:'2°',TERCERO:'3°',CUARTO:'4°',QUINTO:'5°',SEXTO:'6°'
}

const TASK_TYPES = [
  { value: 'EVALUACION', label: 'Examen',  dim: 'SABER', color: '#1A3A7C', bg: '#EAF0FF' },
  { value: 'TRABAJO',    label: 'Tarea',   dim: 'HACER', color: '#0F6E56', bg: '#E6F4F1' },
]

export default function TeacherTareasPage() {
  const [teacherId,  setTeacherId]  = useState<number|null>(null)
  const [trimestres, setTrimestres] = useState<Trimester[]>([])
  const [materias,   setMaterias]   = useState<TeacherSubject[]>([])
  const [selTrim,    setSelTrim]    = useState<Trimester|null>(null)
  const [selMateria, setSelMateria] = useState<TeacherSubject|null>(null)
  const [tasks,      setTasks]      = useState<Task[]>([])
  const [students,   setStudents]   = useState<Student[]>([])
  const [loading,    setLoading]    = useState(false)
  const [toast,      setToast]      = useState<{type:'ok'|'err';text:string}|null>(null)

  // Modal crear tarea
  const [showModal,  setShowModal]  = useState(false)
  const [editTask,   setEditTask]   = useState<Task|null>(null)
  const [form, setForm] = useState({
    title:'', description:'', type:'EVALUACION', maxScore:'100',
    dueDate:'', attachmentUrl:'', assignToAll: true, studentIds:[] as number[]
  })
  const [saving, setSaving] = useState(false)

  // Panel de calificaciones
  const [selTask,   setSelTask]   = useState<Task|null>(null)
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [grades,    setGrades]    = useState<Record<number,string>>({})
  const [notes,     setNotes]     = useState<Record<number,string>>({})
  const [grading,   setGrading]   = useState(false)

  const year  = new Date().getFullYear()
  const token = () => typeof window !== 'undefined' ? localStorage.getItem('token')||'' : ''
  const auth  = () => ({ Authorization: `Bearer ${token()}` })

  const showToast = (type:'ok'|'err', text:string) => {
    setToast({type,text}); setTimeout(()=>setToast(null),4000)
  }

  // Carga inicial
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
      } catch { showToast('err','Error al cargar datos') }
    }
    init()
  }, [])

  // Cargar tareas y estudiantes
  const loadData = useCallback(async () => {
    if (!selMateria||!selTrim) return
    setLoading(true); setTasks([]); setSelTask(null)
    try {
      const [tasksRes, studsRes] = await Promise.all([
        fetch(`${API}/api/tasks/by-course/${selMateria.courseId}?subjectId=${selMateria.subjectId}&trimesterId=${selTrim.id}`,{headers:auth()}).then(r=>r.json()),
        fetch(`${API}/api/notas/course-students/${selMateria.courseId}?year=${year}`,{headers:auth()}).then(r=>r.json()),
      ])
      setTasks(Array.isArray(tasksRes)?tasksRes:[])
      setStudents(Array.isArray(studsRes)?studsRes:[])
    } catch { showToast('err','Error al cargar tareas') }
    finally { setLoading(false) }
  },[selMateria,selTrim])

  useEffect(()=>{ loadData() },[loadData])

  // Abrir panel de calificaciones
  const openGrading = async (task: Task) => {
    setSelTask(task)
    try {
      const subs = await fetch(`${API}/api/tasks/${task.id}/submissions`,{headers:auth()}).then(r=>r.json())
      setSubmissions(Array.isArray(subs)?subs:[])
      const gMap: Record<number,string> = {}
      const nMap: Record<number,string> = {}
      if (Array.isArray(subs)) {
        subs.forEach((s:Submission) => {
          if (s.score!=null) gMap[s.student.id] = String(s.score)
          if (s.note)        nMap[s.student.id] = s.note
        })
      }
      setGrades(gMap); setNotes(nMap)
    } catch { showToast('err','Error al cargar calificaciones') }
  }

  // Guardar calificaciones
  const saveGrades = async () => {
    if (!selTask||!selMateria||!selTrim||!teacherId) return
    setGrading(true)
    try {
      const payload = students
        .filter(s => grades[s.id] !== undefined && grades[s.id] !== '')
        .map(s => ({ studentId: s.id, score: parseFloat(grades[s.id]), note: notes[s.id]||null }))

      if (payload.length === 0) { showToast('err','No hay calificaciones para guardar'); return }

      const res = await fetch(`${API}/api/tasks/${selTask.id}/submissions/bulk`,{
        method:'PATCH', headers:{...auth(),'Content-Type':'application/json'},
        body: JSON.stringify({
          submissions: payload,
          courseId:    selMateria.courseId,
          subjectId:   selMateria.subjectId,
          teacherId,
          trimesterId: selTrim.id,
        })
      })
      const data = await res.json()
      if (!res.ok) { showToast('err',data.message||'Error'); return }
      showToast('ok',data.message||'Calificaciones guardadas')
      openGrading(selTask)
    } catch { showToast('err','Error de conexión') }
    finally { setGrading(false) }
  }

  // Crear / editar tarea
  const handleSaveTask = async () => {
    if (!form.title||!selMateria||!selTrim) { showToast('err','Completa los campos requeridos'); return }
    setSaving(true)
    try {
      const body = {
        title:         form.title,
        description:   form.description||null,
        type:          form.type,
        maxScore:      parseFloat(form.maxScore)||100,
        dueDate:       form.dueDate||null,
        attachmentUrl: form.attachmentUrl||null,
        courseId:      selMateria.courseId,
        subjectId:     selMateria.subjectId,
        trimesterId:   selTrim.id,
        studentIds:    form.assignToAll ? [] : form.studentIds,
      }

      const url    = editTask ? `${API}/api/tasks/${editTask.id}` : `${API}/api/tasks`
      const method = editTask ? 'PUT' : 'POST'
      const res    = await fetch(url,{
        method, headers:{...auth(),'Content-Type':'application/json'},
        body: JSON.stringify(body)
      })
      const data = await res.json()
      if (!res.ok) { showToast('err',data.message||'Error'); return }
      showToast('ok', data.message||'Tarea guardada')
      setShowModal(false); setEditTask(null)
      resetForm()
      loadData()
    } catch { showToast('err','Error de conexión') }
    finally { setSaving(false) }
  }

  const handleDeleteTask = async (taskId: number) => {
    if (!confirm('¿Eliminar esta tarea? Se eliminarán también las calificaciones.')) return
    try {
      const res = await fetch(`${API}/api/tasks/${taskId}`,{method:'DELETE',headers:auth()})
      if (res.ok) { showToast('ok','Tarea eliminada'); loadData() }
    } catch { showToast('err','Error al eliminar') }
  }

  const openEdit = (task: Task) => {
    setEditTask(task)
    setForm({
      title:         task.title,
      description:   task.description||'',
      type:          task.type,
      maxScore:      String(task.maxScore),
      dueDate:       task.dueDate ? task.dueDate.slice(0,10) : '',
      attachmentUrl: task.attachmentUrl||'',
      assignToAll:   true,
      studentIds:    [],
    })
    setShowModal(true)
  }

  const resetForm = () => setForm({
    title:'', description:'', type:'EVALUACION', maxScore:'100',
    dueDate:'', attachmentUrl:'', assignToAll:true, studentIds:[]
  })

  const typeInfo = (type: string) => TASK_TYPES.find(t=>t.value===type) || TASK_TYPES[0]
  const courseLabel = selMateria
    ? `${GRADES[selMateria.course.grade]||selMateria.course.grade} "${selMateria.course.parallel}"`
    : ''

  const calificados = selTask
    ? students.filter(s=>grades[s.id]!==undefined&&grades[s.id]!=='').length
    : 0

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Tareas y Exámenes</h1>
          <p>Gestión {year} · Exámenes → Saber · Tareas → Hacer</p>
        </div>
        {selMateria && !selTask && (
          <button className="btn-primary" onClick={()=>{resetForm();setEditTask(null);setShowModal(true)}}>
            <Plus size={15}/> Nueva tarea/examen
          </button>
        )}
      </div>

      {toast && (
        <div className={`alert ${toast.type==='ok'?'suc':'err'}`}>
          {toast.type==='ok'?<CheckCircle size={14}/>:<AlertCircle size={14}/>} {toast.text}
        </div>
      )}

      {/* Filtros */}
      <div className="filter-card">
        <div className="filter-group">
          <div className="filter-label">Trimestre</div>
          <div className="trim-btns">
            {trimestres.map(t=>(
              <button key={t.id} className={`trim-btn${selTrim?.id===t.id?' active':''}`}
                onClick={()=>{setSelTrim(t);setSelTask(null)}}>
                {t.name||`${t.number}° Trimestre`}
              </button>
            ))}
          </div>
        </div>
        <div className="filter-group" style={{flex:1,minWidth:240}}>
          <div className="filter-label">Materia</div>
          <select className="filter-select" value={selMateria?.id??''}
            onChange={e=>{setSelMateria(materias.find(m=>m.id===parseInt(e.target.value))??null);setSelTask(null)}}>
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

      {/* Panel de calificaciones */}
      {selTask && (
        <div className="grading-panel">
          <div className="grading-header">
            <button className="btn-back" onClick={()=>setSelTask(null)}>← Volver</button>
            <div>
              <div className="grading-title">{selTask.title}</div>
              <div className="grading-sub">
                <span className={`type-badge`} style={{background:typeInfo(selTask.type).bg,color:typeInfo(selTask.type).color}}>
                  {typeInfo(selTask.type).label} → {typeInfo(selTask.type).dim}
                </span>
                <span>Puntaje máximo: {selTask.maxScore}</span>
                {selTask.trimester && <span>{selTask.trimester.number}° Trimestre</span>}
              </div>
            </div>
            <button className="btn-save-grades" onClick={saveGrades} disabled={grading}>
              <Save size={14}/> {grading?'Guardando...':'Guardar calificaciones'}
            </button>
          </div>

          {selTask.attachmentUrl && (
            <a href={selTask.attachmentUrl} target="_blank" rel="noopener noreferrer" className="attachment-link">
              <Link size={13}/> Ver documento adjunto
            </a>
          )}

          <div className="grading-stats">
            <span>{students.length} estudiantes</span>
            <span>·</span>
            <span>{calificados} calificados</span>
            <span>·</span>
            <span>{students.length - calificados} pendientes</span>
          </div>

          <table className="grade-table">
            <thead>
              <tr>
                <th>#</th><th>Estudiante</th><th>Kardex</th>
                <th style={{textAlign:'center'}}>Nota (0–{selTask.maxScore})</th>
                <th>Comentario</th>
                <th style={{textAlign:'center'}}>Estado</th>
              </tr>
            </thead>
            <tbody>
              {students.map((s,i)=>{
                const sub  = submissions.find(sub=>sub.student.id===s.id)
                const val  = grades[s.id]??''
                const nota = parseFloat(val)
                return (
                  <tr key={s.id}>
                    <td className="muted">{i+1}</td>
                    <td style={{fontWeight:500}}>{s.lastName} {s.firstName}</td>
                    <td className="muted mono">{s.kardex??'—'}</td>
                    <td style={{textAlign:'center'}}>
                      <input type="number" min={0} max={selTask.maxScore} step={0.5}
                        value={val} placeholder="—" className="grade-input"
                        onChange={e=>{
                          const v = e.target.value
                          if (v===''||parseFloat(v)<=selTask.maxScore) setGrades(p=>({...p,[s.id]:v}))
                        }}/>
                    </td>
                    <td>
                      <input type="text" value={notes[s.id]||''} placeholder="Comentario opcional"
                        className="note-input"
                        onChange={e=>setNotes(p=>({...p,[s.id]:e.target.value}))}/>
                    </td>
                    <td style={{textAlign:'center'}}>
                      {sub?.status==='CALIFICADO'
                        ? <span className="badge apr">Calificado</span>
                        : <span className="badge sin">Pendiente</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          <div className="grading-footer">
            <span className="muted">{calificados} de {students.length} calificados</span>
            <button className="btn-save-grades" onClick={saveGrades} disabled={grading}>
              <Save size={14}/> {grading?'Guardando...':'Guardar calificaciones'}
            </button>
          </div>
        </div>
      )}

      {/* Lista de tareas */}
      {selMateria && !loading && !selTask && (
        <>
          {tasks.length === 0 ? (
            <div className="empty-state">
              <FileText size={40} color="#CBE0F0"/>
              <p>No hay tareas ni exámenes para este trimestre y materia.</p>
              <button className="btn-primary" onClick={()=>{resetForm();setShowModal(true)}}>
                <Plus size={14}/> Crear primera tarea
              </button>
            </div>
          ) : (
            <div className="tasks-grid">
              {tasks.map(task=>{
                const ti = typeInfo(task.type)
                const calTotal = task._count.submissions
                return (
                  <div key={task.id} className="task-card">
                    <div className="task-top">
                      <span className="type-badge" style={{background:ti.bg,color:ti.color}}>
                        {ti.label} → {ti.dim}
                      </span>
                      <div style={{display:'flex',gap:6}}>
                        <button className="btn-icon" onClick={()=>openEdit(task)}><Edit3 size={14}/></button>
                        <button className="btn-icon danger" onClick={()=>handleDeleteTask(task.id)}><Trash2 size={14}/></button>
                      </div>
                    </div>
                    <div className="task-title">{task.title}</div>
                    {task.description && <div className="task-desc">{task.description}</div>}
                    <div className="task-meta">
                      {task.dueDate && (
                        <span><Clock size={11}/> {new Date(task.dueDate).toLocaleDateString('es-BO')}</span>
                      )}
                      <span>Puntaje máx: {task.maxScore}</span>
                      <span><Users size={11}/> {calTotal} estudiantes</span>
                    </div>
                    {task.attachmentUrl && (
                      <a href={task.attachmentUrl} target="_blank" rel="noopener noreferrer" className="task-link">
                        <Link size={11}/> Ver documento adjunto
                      </a>
                    )}
                    <button className="btn-grade" onClick={()=>openGrading(task)}>
                      <CheckCircle size={13}/> Calificar <ChevronRight size={12}/>
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {/* Modal crear/editar tarea */}
      {showModal && (
        <div className="overlay" onClick={()=>{setShowModal(false);setEditTask(null)}}>
          <div className="modal" onClick={e=>e.stopPropagation()}>
            <div className="mhead">
              <h2>{editTask?'Editar':'Nueva'} Tarea / Examen</h2>
              <button onClick={()=>{setShowModal(false);setEditTask(null)}}><X size={18}/></button>
            </div>
            <div className="mbody">
              <div className="fg">
                <label>Tipo *</label>
                <div style={{display:'flex',gap:8}}>
                  {TASK_TYPES.map(t=>(
                    <button key={t.value}
                      className={`type-btn${form.type===t.value?' selected':''}`}
                      style={form.type===t.value?{background:t.color,color:'#fff',borderColor:t.color}:{}}
                      onClick={()=>setForm(p=>({...p,type:t.value}))}>
                      {t.label} <span style={{fontSize:10,opacity:.8}}>→ {t.dim}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="fg">
                <label>Título *</label>
                <input type="text" placeholder="Ej: Examen parcial 1 / Trabajo grupal"
                  value={form.title} onChange={e=>setForm(p=>({...p,title:e.target.value}))}/>
              </div>
              <div className="fg">
                <label>Descripción</label>
                <textarea rows={2} placeholder="Instrucciones o descripción..."
                  value={form.description} onChange={e=>setForm(p=>({...p,description:e.target.value}))}/>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                <div className="fg">
                  <label>Puntaje máximo *</label>
                  <input type="number" min={1} max={100} value={form.maxScore}
                    onChange={e=>setForm(p=>({...p,maxScore:e.target.value}))}/>
                </div>
                <div className="fg">
                  <label>Fecha de entrega</label>
                  <input type="date" value={form.dueDate}
                    onChange={e=>setForm(p=>({...p,dueDate:e.target.value}))}/>
                </div>
              </div>
              <div className="fg">
                <label>Enlace de documento (Google Drive, OneDrive, etc.)</label>
                <input type="url" placeholder="https://drive.google.com/..."
                  value={form.attachmentUrl} onChange={e=>setForm(p=>({...p,attachmentUrl:e.target.value}))}/>
              </div>
              {!editTask && (
                <div className="fg">
                  <label>Asignar a</label>
                  <div style={{display:'flex',gap:8}}>
                    <button className={`type-btn${form.assignToAll?' selected':''}`}
                      style={form.assignToAll?{background:'#1A3A7C',color:'#fff',borderColor:'#1A3A7C'}:{}}
                      onClick={()=>setForm(p=>({...p,assignToAll:true,studentIds:[]}))}>
                      <Users size={13}/> Todo el curso
                    </button>
                    <button className={`type-btn${!form.assignToAll?' selected':''}`}
                      style={!form.assignToAll?{background:'#633806',color:'#fff',borderColor:'#633806'}:{}}
                      onClick={()=>setForm(p=>({...p,assignToAll:false}))}>
                      Estudiantes específicos
                    </button>
                  </div>
                  {!form.assignToAll && (
                    <div className="students-select">
                      {students.map(s=>(
                        <label key={s.id} className="student-check">
                          <input type="checkbox"
                            checked={form.studentIds.includes(s.id)}
                            onChange={e=>{
                              setForm(p=>({...p,
                                studentIds: e.target.checked
                                  ? [...p.studentIds, s.id]
                                  : p.studentIds.filter(id=>id!==s.id)
                              }))
                            }}/>
                          {s.lastName} {s.firstName}
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="mfoot">
              <button className="btn-outline" onClick={()=>{setShowModal(false);setEditTask(null)}}>Cancelar</button>
              <button className="btn-primary" onClick={handleSaveTask} disabled={saving}>
                {saving?<span className="spinsm"/>:<Save size={14}/>}
                {saving?'Guardando...':editTask?'Actualizar':'Crear tarea'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .page-header{display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:24px;gap:16px;flex-wrap:wrap}
        .page-header h1{font-size:20px;font-weight:700;color:#633806;margin-bottom:4px}
        .page-header p{font-size:12px;color:#6B8BB0}
        .alert{display:flex;align-items:center;gap:8px;padding:10px 14px;border-radius:8px;font-size:13px;margin-bottom:16px}
        .alert.suc{background:#E1F5EE;border:1px solid #9FE1CB;color:#0F6E56}
        .alert.err{background:#FFF0F0;border:1px solid #FFBBBB;color:#C0392B}
        .filter-card{background:#fff;border:1px solid #CBE0F0;border-radius:12px;padding:20px;margin-bottom:20px;display:flex;flex-wrap:wrap;gap:20px}
        .filter-group{display:flex;flex-direction:column;gap:8px}
        .filter-label{font-size:11px;font-weight:700;color:#6B8BB0;text-transform:uppercase;letter-spacing:.6px}
        .trim-btns{display:flex;gap:8px;flex-wrap:wrap}
        .trim-btn{padding:7px 16px;border-radius:8px;font-size:13px;font-weight:500;border:1.5px solid #CBE0F0;background:#fff;color:#1A3A7C;cursor:pointer}
        .trim-btn:hover{border-color:#4A9FD4}
        .trim-btn.active{background:#633806;color:#fff;border-color:#633806}
        .filter-select{padding:9px 12px;border:1.5px solid #CBE0F0;border-radius:8px;font-size:13px;color:#1A3A7C;outline:none;width:100%}
        .tasks-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:14px}
        .task-card{background:#fff;border:1px solid #CBE0F0;border-radius:12px;padding:16px;display:flex;flex-direction:column;gap:10px}
        .task-top{display:flex;align-items:center;justify-content:space-between}
        .type-badge{font-size:11px;font-weight:700;padding:3px 10px;border-radius:20px}
        .task-title{font-size:14px;font-weight:700;color:#1A3A7C}
        .task-desc{font-size:12px;color:#6B8BB0;line-height:1.5}
        .task-meta{display:flex;gap:10px;flex-wrap:wrap;font-size:11px;color:#6B8BB0;align-items:center}
        .task-meta span{display:flex;align-items:center;gap:3px}
        .task-link{display:inline-flex;align-items:center;gap:5px;font-size:12px;color:#4A9FD4;text-decoration:none}
        .task-link:hover{text-decoration:underline}
        .btn-grade{display:flex;align-items:center;gap:6px;padding:8px 14px;background:#F0F6FC;border:1.5px solid #CBE0F0;border-radius:8px;color:#1A3A7C;font-size:13px;cursor:pointer;margin-top:4px}
        .btn-grade:hover{border-color:#633806;color:#633806}
        .btn-icon{background:none;border:none;cursor:pointer;padding:5px;border-radius:6px;color:#6B8BB0}
        .btn-icon:hover{background:#F0F6FC;color:#1A3A7C}
        .btn-icon.danger:hover{background:#FFF0F0;color:#C0392B}
        .grading-panel{background:#fff;border:1px solid #CBE0F0;border-radius:12px;padding:20px;margin-bottom:20px}
        .grading-header{display:flex;align-items:center;gap:14px;margin-bottom:16px;flex-wrap:wrap}
        .btn-back{padding:7px 14px;border:1.5px solid #CBE0F0;border-radius:8px;background:#fff;color:#1A3A7C;font-size:13px;cursor:pointer;white-space:nowrap}
        .btn-back:hover{border-color:#633806;color:#633806}
        .grading-title{font-size:15px;font-weight:700;color:#1A3A7C}
        .grading-sub{display:flex;align-items:center;gap:10px;font-size:12px;color:#6B8BB0;margin-top:4px;flex-wrap:wrap}
        .btn-save-grades{display:inline-flex;align-items:center;gap:6px;padding:8px 16px;background:#633806;color:#fff;border:none;border-radius:8px;font-size:13px;cursor:pointer;margin-left:auto;white-space:nowrap}
        .btn-save-grades:disabled{opacity:.6}
        .attachment-link{display:inline-flex;align-items:center;gap:6px;font-size:12px;color:#4A9FD4;text-decoration:none;margin-bottom:12px}
        .grading-stats{font-size:12px;color:#6B8BB0;display:flex;gap:8px;margin-bottom:12px}
        .grade-table{width:100%;border-collapse:collapse;margin-bottom:12px}
        .grade-table th{padding:8px 12px;text-align:left;font-size:10px;font-weight:600;color:#1A3A7C;text-transform:uppercase;background:#F0F6FC;border-bottom:1px solid #CBE0F0}
        .grade-table td{padding:8px 12px;font-size:13px;color:#1A3A7C;border-top:1px solid #F8FBFF}
        .grade-table tr:hover td{background:#FAFCFF}
        .grade-input{width:80px;text-align:center;padding:6px 8px;border:1.5px solid #CBE0F0;border-radius:8px;font-size:13px;color:#1A3A7C;outline:none}
        .grade-input:focus{border-color:#4A9FD4}
        .note-input{width:100%;padding:6px 8px;border:1.5px solid #CBE0F0;border-radius:8px;font-size:12px;color:#1A3A7C;outline:none}
        .note-input:focus{border-color:#4A9FD4}
        .grading-footer{display:flex;align-items:center;justify-content:space-between;padding-top:12px;border-top:1px solid #F0F6FC}
        .badge{display:inline-flex;align-items:center;gap:4px;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:600}
        .badge.apr{background:#E1F5EE;color:#0F6E56}
        .badge.sin{background:#F5F5F5;color:#888}
        .muted{color:#6B8BB0;font-size:12px}
        .mono{font-family:monospace}
        .empty-state{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:60px;gap:12px;color:#6B8BB0;font-size:13px}
        .center{display:flex;justify-content:center;padding:48px}
        .spinner{width:24px;height:24px;border:2px solid rgba(99,56,6,.2);border-top-color:#633806;border-radius:50%;animation:spin .7s linear infinite}
        @keyframes spin{to{transform:rotate(360deg)}}
        .overlay{position:fixed;inset:0;background:rgba(0,0,0,0.4);z-index:500;display:flex;align-items:center;justify-content:center;padding:16px}
        .modal{background:#fff;border-radius:14px;width:100%;max-width:500px;max-height:90vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,0.15)}
        .mhead{display:flex;align-items:center;justify-content:space-between;padding:18px 20px;border-bottom:1px solid #CBE0F0;position:sticky;top:0;background:#fff;z-index:1}
        .mhead h2{font-size:16px;font-weight:600;color:#1A3A7C}
        .mhead button{background:none;border:none;cursor:pointer;color:#6B8BB0;padding:4px;border-radius:6px}
        .mbody{padding:20px;display:flex;flex-direction:column;gap:14px}
        .mfoot{display:flex;justify-content:flex-end;gap:10px;padding:16px 20px;border-top:1px solid #CBE0F0;position:sticky;bottom:0;background:#fff}
        .fg{display:flex;flex-direction:column;gap:6px}
        .fg label{font-size:11px;font-weight:700;color:#1A3A7C;text-transform:uppercase;letter-spacing:.6px}
        .fg input,.fg select,.fg textarea{padding:10px 12px;border:1.5px solid #CBE0F0;border-radius:8px;font-size:13px;color:#1A3A7C;outline:none;font-family:inherit}
        .fg input:focus,.fg select:focus,.fg textarea:focus{border-color:#4A9FD4}
        .fg textarea{resize:vertical}
        .type-btn{padding:7px 14px;border:1.5px solid #CBE0F0;border-radius:8px;background:#fff;color:#1A3A7C;font-size:13px;cursor:pointer;display:flex;align-items:center;gap:5px}
        .btn-primary{display:flex;align-items:center;gap:6px;padding:9px 16px;background:#633806;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:500;cursor:pointer}
        .btn-primary:hover:not(:disabled){background:#7A4A0A}
        .btn-primary:disabled{opacity:.6;cursor:not-allowed}
        .btn-outline{display:flex;align-items:center;gap:6px;padding:9px 14px;background:#fff;color:#1A3A7C;border:1.5px solid #CBE0F0;border-radius:8px;font-size:13px;cursor:pointer}
        .students-select{display:flex;flex-direction:column;gap:6px;max-height:200px;overflow-y:auto;border:1px solid #CBE0F0;border-radius:8px;padding:10px}
        .student-check{display:flex;align-items:center;gap:8px;font-size:13px;color:#1A3A7C;cursor:pointer;padding:4px}
        .student-check:hover{background:#F8FBFF;border-radius:6px}
        .spinsm{width:14px;height:14px;border:2px solid rgba(255,255,255,.3);border-top-color:#fff;border-radius:50%;animation:spin .7s linear infinite;display:inline-block}
        @media(max-width:600px){.tasks-grid{grid-template-columns:1fr}}
      `}</style>
    </div>
  )
}