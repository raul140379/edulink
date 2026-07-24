'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Plus, BookOpen, Users, CheckCircle,
  Trash2, Edit3, Link, FileText, Clock, ChevronRight, Save
} from 'lucide-react'
import Card from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import { Input, Select, Textarea } from '@/components/ui/Input'
import Table, { Column } from '@/components/ui/Table'
import { useConfirm } from '@/components/ui/ConfirmProvider'
import { useToast } from '@/components/ui/ToastProvider'

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
  { value: 'EVALUACION', label: 'Examen',  dim: 'SABER', tone: 'brand' as const },
  { value: 'TRABAJO',    label: 'Tarea',   dim: 'HACER', tone: 'success' as const },
]

export default function TeacherTareasPage() {
  const confirm = useConfirm()
  const toast   = useToast()
  const [teacherId,  setTeacherId]  = useState<number|null>(null)
  const [trimestres, setTrimestres] = useState<Trimester[]>([])
  const [materias,   setMaterias]   = useState<TeacherSubject[]>([])
  const [selTrim,    setSelTrim]    = useState<Trimester|null>(null)
  const [selMateria, setSelMateria] = useState<TeacherSubject|null>(null)
  const [tasks,      setTasks]      = useState<Task[]>([])
  const [students,   setStudents]   = useState<Student[]>([])
  const [loading,    setLoading]    = useState(false)

  const [showModal,  setShowModal]  = useState(false)
  const [editTask,   setEditTask]   = useState<Task|null>(null)
  const [form, setForm] = useState({
    title:'', description:'', type:'EVALUACION', maxScore:'40',
    dueDate:'', attachmentUrl:'', assignToAll: true, studentIds:[] as number[]
  })
  const [saving, setSaving] = useState(false)

  const [selTask,   setSelTask]   = useState<Task|null>(null)
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [grades,    setGrades]    = useState<Record<number,string>>({})
  const [notes,     setNotes]     = useState<Record<number,string>>({})
  const [grading,   setGrading]   = useState(false)

  const year  = new Date().getFullYear()
  const auth  = () => ({ Authorization: `Bearer ${localStorage.getItem('token') || ''}` })

  useEffect(() => {
    const init = async () => {
      try {
        const me = await fetch(`${API}/api/auth/me`,{headers:auth()}).then(r=>r.json())
        const tid = me.teacher?.id
        if (!tid) { toast('No se encontró el perfil del maestro', 'error'); return }
        setTeacherId(tid)
        const [trims, mats] = await Promise.all([
          fetch(`${API}/api/notas/trimestres?year=${year}`,{headers:auth()}).then(r=>r.json()),
          fetch(`${API}/api/notas/teacher-subjects/${tid}`,{headers:auth()}).then(r=>r.json()),
        ])
        setTrimestres(Array.isArray(trims)?trims:[])
        setMaterias(Array.isArray(mats)?mats:[])
        if (Array.isArray(trims)&&trims.length>0) setSelTrim(trims[0])
      } catch { toast('Error al cargar datos', 'error') }
    }
    init()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
    } catch { toast('Error al cargar tareas', 'error') }
    finally { setLoading(false) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[selMateria,selTrim])

  useEffect(()=>{ loadData() },[loadData])

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
    } catch { toast('Error al cargar calificaciones', 'error') }
  }

  const saveGrades = async () => {
    if (!selTask||!selMateria||!selTrim||!teacherId) return
    setGrading(true)
    try {
      const payload = students
        .filter(s => grades[s.id] !== undefined && grades[s.id] !== '')
        .map(s => ({ studentId: s.id, score: parseFloat(grades[s.id]), note: notes[s.id]||null }))

      if (payload.length === 0) { toast('No hay calificaciones para guardar', 'error'); return }

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
      if (!res.ok) { toast(data.message||'Error', 'error'); return }
      toast(data.message||'Calificaciones guardadas', 'success')
      openGrading(selTask)
    } catch { toast('Error de conexión', 'error') }
    finally { setGrading(false) }
  }

  const handleSaveTask = async () => {
    if (!form.title||!selMateria||!selTrim) { toast('Completa los campos requeridos', 'error'); return }
    setSaving(true)
    try {
      const body = {
        title:         form.title,
        description:   form.description||null,
        type:          form.type,
        maxScore:      form.type==='EVALUACION' ? 45 : 40,
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
      if (!res.ok) { toast(data.message||'Error', 'error'); return }
      toast(data.message||'Tarea guardada', 'success')
      setShowModal(false); setEditTask(null)
      resetForm()
      loadData()
    } catch { toast('Error de conexión', 'error') }
    finally { setSaving(false) }
  }

  const handleDeleteTask = async (taskId: number) => {
    if (!await confirm('¿Eliminar esta tarea? Se eliminarán también las calificaciones.', { danger: true })) return
    try {
      const res = await fetch(`${API}/api/tasks/${taskId}`,{method:'DELETE',headers:auth()})
      if (res.ok) { toast('Tarea eliminada', 'success'); loadData() }
    } catch { toast('Error al eliminar', 'error') }
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
    title:'', description:'', type:'EVALUACION', maxScore:'45',
    dueDate:'', attachmentUrl:'', assignToAll:true, studentIds:[]
  })

  const typeInfo = (type: string) => TASK_TYPES.find(t=>t.value===type) || TASK_TYPES[0]
  const courseLabel = selMateria
    ? `${GRADES[selMateria.course.grade]||selMateria.course.grade} "${selMateria.course.parallel}"`
    : ''

  const calificados = selTask
    ? students.filter(s=>grades[s.id]!==undefined&&grades[s.id]!=='').length
    : 0

  const gradeColumns: Column<Student>[] = [
    { key: 'num', header: '#', render: (s) => <span className="text-xs text-neutral-500">{students.indexOf(s) + 1}</span> },
    { key: 'estudiante', header: 'Estudiante', render: s => <span className="font-medium text-brand-700">{s.lastName} {s.firstName}</span> },
    { key: 'kardex', header: 'Kardex', render: s => <span className="text-xs text-neutral-500 font-mono">{s.kardex ?? '—'}</span> },
    {
      key: 'nota', header: `Nota (0–${selTask?.maxScore ?? 0})`, className: 'text-center', render: s => (
        <input
          type="number" min={0} max={selTask?.maxScore} step={0.5}
          value={grades[s.id] ?? ''} placeholder="—"
          className="w-20 text-center px-2 py-1.5 border border-neutral-300 rounded-lg text-[13px] text-brand-700 outline-none focus:border-info-500"
          onChange={e => {
            const v = e.target.value
            if (v === '' || parseFloat(v) <= (selTask?.maxScore ?? 0)) setGrades(p => ({ ...p, [s.id]: v }))
          }}
        />
      )
    },
    {
      key: 'comentario', header: 'Comentario', render: s => (
        <input
          type="text" value={notes[s.id] || ''} placeholder="Comentario opcional"
          className="w-full px-2 py-1.5 border border-neutral-300 rounded-lg text-xs text-brand-700 outline-none focus:border-info-500"
          onChange={e => setNotes(p => ({ ...p, [s.id]: e.target.value }))}
        />
      )
    },
    {
      key: 'estado', header: 'Estado', className: 'text-center', render: s => {
        const sub = submissions.find(sub => sub.student.id === s.id)
        return sub?.status === 'CALIFICADO' ? <Badge tone="success">Calificado</Badge> : <Badge tone="neutral">Pendiente</Badge>
      }
    },
  ]

  return (
    <div>
      <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-brand-700 mb-1">Tareas y Exámenes</h1>
          <p className="text-xs text-neutral-500">Gestión {year} · Exámenes → Saber · Tareas → Hacer</p>
        </div>
        {selMateria && !selTask && (
          <Button onClick={()=>{resetForm();setEditTask(null);setShowModal(true)}}>
            <Plus size={15}/> Nueva tarea/examen
          </Button>
        )}
      </div>

      <Card className="flex flex-wrap gap-5 mb-5">
        <div className="flex flex-col gap-2">
          <div className="text-[11px] font-bold text-neutral-500 uppercase tracking-wide">Trimestre</div>
          <div className="flex gap-2 flex-wrap">
            {trimestres.map(t=>(
              <button
                key={t.id}
                onClick={()=>{setSelTrim(t);setSelTask(null)}}
                className={`px-4 py-1.5 rounded-lg text-[13px] font-medium border transition-colors ${selTrim?.id===t.id ? 'bg-brand-700 text-white border-brand-700' : 'bg-white text-brand-700 border-neutral-300 hover:border-brand-500'}`}
              >
                {t.name||`${t.number}° Trimestre`}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-2 flex-1" style={{ minWidth: 240 }}>
          <div className="text-[11px] font-bold text-neutral-500 uppercase tracking-wide">Materia</div>
          <Select
            value={selMateria?.id??''}
            onChange={e=>{setSelMateria(materias.find(m=>m.id===parseInt(e.target.value))??null);setSelTask(null)}}
          >
            <option value="">— Seleccionar materia —</option>
            {materias.map(m=>(
              <option key={m.id} value={m.id}>
                {m.subject.name} · {GRADES[m.course.grade]||m.course.grade} &quot;{m.course.parallel}&quot;
              </option>
            ))}
          </Select>
        </div>
      </Card>

      {!selMateria && (
        <Card className="flex flex-col items-center gap-3 py-14 text-neutral-500">
          <BookOpen size={48} className="text-neutral-300"/>
          <p>Selecciona un trimestre y una materia</p>
        </Card>
      )}

      {selMateria && loading && <div className="flex justify-center py-12"><p className="text-sm text-neutral-500">Cargando...</p></div>}

      {selTask && (
        <Card className="mb-5">
          <div className="flex items-center gap-3.5 mb-4 flex-wrap">
            <Button variant="secondary" size="sm" onClick={()=>setSelTask(null)}>← Volver</Button>
            <div>
              <div className="text-[15px] font-bold text-brand-700">{selTask.title}</div>
              <div className="flex items-center gap-2.5 text-xs text-neutral-500 mt-1 flex-wrap">
                <Badge tone={typeInfo(selTask.type).tone}>{typeInfo(selTask.type).label} → {typeInfo(selTask.type).dim}</Badge>
                <span>Puntaje máximo: {selTask.maxScore}</span>
                {selTask.trimester && <span>{selTask.trimester.number}° Trimestre</span>}
              </div>
            </div>
            <Button onClick={saveGrades} loading={grading} className="ml-auto">
              {!grading && <Save size={14}/>} {grading?'Guardando...':'Guardar calificaciones'}
            </Button>
          </div>

          {selTask.attachmentUrl && (
            <a href={selTask.attachmentUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs text-info-500 hover:underline mb-3">
              <Link size={13}/> Ver documento adjunto
            </a>
          )}

          <div className="text-xs text-neutral-500 flex gap-2 mb-3">
            <span>{students.length} estudiantes</span>
            <span>·</span>
            <span>{calificados} calificados</span>
            <span>·</span>
            <span>{students.length - calificados} pendientes</span>
          </div>

          <Table columns={gradeColumns} rows={students} rowKey={s => s.id} />

          <div className="flex items-center justify-between pt-3 mt-3 border-t border-neutral-100">
            <span className="text-xs text-neutral-500">{calificados} de {students.length} calificados</span>
            <Button onClick={saveGrades} loading={grading}>
              {!grading && <Save size={14}/>} {grading?'Guardando...':'Guardar calificaciones'}
            </Button>
          </div>
        </Card>
      )}

      {selMateria && !loading && !selTask && (
        <>
          {tasks.length === 0 ? (
            <Card className="flex flex-col items-center gap-3 py-14 text-neutral-500">
              <FileText size={40} className="text-neutral-300"/>
              <p>No hay tareas ni exámenes para este trimestre y materia.</p>
              <Button onClick={()=>{resetForm();setShowModal(true)}}>
                <Plus size={14}/> Crear primera tarea
              </Button>
            </Card>
          ) : (
            <div className="grid gap-3.5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
              {tasks.map(task=>{
                const ti = typeInfo(task.type)
                const calTotal = task._count.submissions
                return (
                  <Card key={task.id} className="flex flex-col gap-2.5">
                    <div className="flex items-center justify-between">
                      <Badge tone={ti.tone}>{ti.label} → {ti.dim}</Badge>
                      <div className="flex gap-1.5">
                        <button onClick={()=>openEdit(task)} className="p-1.5 rounded-md text-neutral-500 hover:bg-neutral-100 hover:text-brand-700 transition-colors"><Edit3 size={14}/></button>
                        <button onClick={()=>handleDeleteTask(task.id)} className="p-1.5 rounded-md text-neutral-500 hover:bg-danger-100 hover:text-danger-600 transition-colors"><Trash2 size={14}/></button>
                      </div>
                    </div>
                    <div className="text-sm font-bold text-brand-700">{task.title}</div>
                    {task.description && <div className="text-xs text-neutral-500 leading-relaxed">{task.description}</div>}
                    <div className="flex gap-2.5 flex-wrap text-[11px] text-neutral-500 items-center">
                      {task.dueDate && <span className="flex items-center gap-1"><Clock size={11}/> {new Date(task.dueDate).toLocaleDateString('es-BO')}</span>}
                      <span>Puntaje máx: {task.maxScore}</span>
                      <span className="flex items-center gap-1"><Users size={11}/> {calTotal} estudiantes</span>
                    </div>
                    {task.attachmentUrl && (
                      <a href={task.attachmentUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-info-500 hover:underline">
                        <Link size={11}/> Ver documento adjunto
                      </a>
                    )}
                    <Button variant="secondary" size="sm" onClick={()=>openGrading(task)} className="mt-1">
                      <CheckCircle size={13}/> Calificar <ChevronRight size={12}/>
                    </Button>
                  </Card>
                )
              })}
            </div>
          )}
        </>
      )}

      {/* Modal crear/editar tarea */}
      <Modal
        open={showModal} onClose={()=>{setShowModal(false);setEditTask(null)}}
        title={`${editTask?'Editar':'Nueva'} Tarea / Examen`}
        footer={
          <>
            <Button variant="secondary" onClick={()=>{setShowModal(false);setEditTask(null)}}>Cancelar</Button>
            <Button onClick={handleSaveTask} loading={saving}>
              {!saving && <Save size={14}/>}
              {saving?'Guardando...':editTask?'Actualizar':'Crear tarea'}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <div>
            <label className="text-[11px] font-bold text-brand-700 uppercase tracking-wide block mb-1.5">Tipo *</label>
            <div className="flex gap-2">
              {TASK_TYPES.map(t=>(
                <button
                  key={t.value}
                  onClick={()=>setForm(p=>({...p,type:t.value,maxScore:String(t.value==='EVALUACION'?45:40)}))}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border text-[13px] transition-colors ${form.type===t.value ? 'bg-brand-700 border-brand-700 text-white' : 'bg-white border-neutral-300 text-brand-700 hover:border-brand-500'}`}
                >
                  {t.label} <span className="text-[10px] opacity-80">→ {t.dim}</span>
                </button>
              ))}
            </div>
          </div>

          <Input
            label="Título" required placeholder="Ej: Examen parcial 1 / Trabajo grupal"
            value={form.title} onChange={e=>setForm(p=>({...p,title:e.target.value}))}
          />

          <Textarea
            label="Descripción" rows={2} placeholder="Instrucciones o descripción..."
            value={form.description} onChange={e=>setForm(p=>({...p,description:e.target.value}))}
          />

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Puntaje máximo" type="number" readOnly value={form.type==='EVALUACION'?45:40}
              hint={form.type==='EVALUACION'?'Examen → Saber (máx 45 pts)':'Tarea → Hacer (máx 40 pts)'}
              className="!bg-neutral-100 !cursor-not-allowed !text-neutral-500"
            />
            <Input
              label="Fecha de entrega" type="date" value={form.dueDate}
              onChange={e=>setForm(p=>({...p,dueDate:e.target.value}))}
            />
          </div>

          <Input
            label="Enlace de documento (Google Drive, OneDrive, etc.)" type="url" placeholder="https://drive.google.com/..."
            value={form.attachmentUrl} onChange={e=>setForm(p=>({...p,attachmentUrl:e.target.value}))}
          />

          {!editTask && (
            <div>
              <label className="text-[11px] font-bold text-brand-700 uppercase tracking-wide block mb-1.5">Asignar a</label>
              <div className="flex gap-2">
                <button
                  onClick={()=>setForm(p=>({...p,assignToAll:true,studentIds:[]}))}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border text-[13px] transition-colors ${form.assignToAll ? 'bg-brand-700 border-brand-700 text-white' : 'bg-white border-neutral-300 text-brand-700 hover:border-brand-500'}`}
                >
                  <Users size={13}/> Todo el curso
                </button>
                <button
                  onClick={()=>setForm(p=>({...p,assignToAll:false}))}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border text-[13px] transition-colors ${!form.assignToAll ? 'bg-brand-700 border-brand-700 text-white' : 'bg-white border-neutral-300 text-brand-700 hover:border-brand-500'}`}
                >
                  Estudiantes específicos
                </button>
              </div>
              {!form.assignToAll && (
                <div className="flex flex-col gap-1.5 max-h-[200px] overflow-y-auto border border-neutral-300 rounded-lg p-2.5 mt-2">
                  {students.map(s=>(
                    <label key={s.id} className="flex items-center gap-2 text-[13px] text-brand-700 cursor-pointer px-1 py-1 hover:bg-neutral-100 rounded-md">
                      <input
                        type="checkbox"
                        checked={form.studentIds.includes(s.id)}
                        onChange={e=>{
                          setForm(p=>({...p,
                            studentIds: e.target.checked
                              ? [...p.studentIds, s.id]
                              : p.studentIds.filter(id=>id!==s.id)
                          }))
                        }}
                        className="w-4 h-4 accent-[var(--color-brand-700)]"
                      />
                      {s.lastName} {s.firstName}
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </Modal>
    </div>
  )
}
