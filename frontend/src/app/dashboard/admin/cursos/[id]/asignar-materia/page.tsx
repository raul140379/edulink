'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Plus, Trash2, BookOpen } from 'lucide-react'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

interface Subject {
  id: number
  name: string
  code?: string
  level: string
  campo?: string
  gradeConfigs?: { hoursPerWeek: number }[]
}

interface Teacher {
  id: number; firstName: string; lastName: string; ci?: string; specialty?: string
}

interface Assignment {
  id:      number
  subject: { id: number; name: string; code?: string }
  teacher: { id: number; firstName: string; lastName: string }
}

interface Course {
  id: number; level: string; grade: string; parallel: string; shift: string
  teacherSubjects: Assignment[]
}

const GRADE_LABELS: Record<string, string> = { PRIMERO: '1°', SEGUNDO: '2°', TERCERO: '3°', CUARTO: '4°', QUINTO: '5°', SEXTO: '6°' }
const LEVEL_LABELS: Record<string, string> = { INICIAL: 'Inicial', PRIMARIA: 'Primaria', SECUNDARIA: 'Secundaria' }
const SHIFT_LABELS: Record<string, string> = { MORNING: 'Mañana', AFTERNOON: 'Tarde', NIGHT: 'Noche' }

export default function AsignarMateriaPage() {
  const params = useParams()
  const router = useRouter()
  const id     = params.id as string

  const [course,    setCourse]    = useState<Course | null>(null)
  const [subjects,  setSubjects]  = useState<Subject[]>([])
  const [teachers,  setTeachers]  = useState<Teacher[]>([])
  const [loading,   setLoading]   = useState(true)
  const [saving,    setSaving]    = useState(false)
  const [success,   setSuccess]   = useState('')
  const [error,     setError]     = useState('')
  const [form,      setForm]      = useState({ subjectId: '', teacherId: '' })

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : ''

  const notify = (msg: string, type: 'success' | 'error' = 'success') => {
    if (type === 'success') { setSuccess(msg); setTimeout(() => setSuccess(''), 3000) }
    else                    { setError(msg);   setTimeout(() => setError(''),   4000) }
  }

  const fetchData = async () => {
  setLoading(true)
  try {
    // 1. Primero obtener el curso (necesitamos level y grade)
    const cRes  = await fetch(`${API_URL}/api/courses/${id}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    const cData = await cRes.json()
    if (cRes.ok) setCourse(cData)
    else { notify('Curso no encontrado', 'error'); return }

    // 2. Con level y grade ya disponibles, pedir subjects y teachers en paralelo
    const [sRes, tRes] = await Promise.all([
      fetch(`${API_URL}/api/subjects?level=${cData.level}&grade=${cData.grade}`,
        { headers: { Authorization: `Bearer ${token}` } }),
      fetch(`${API_URL}/api/teachers`,
        { headers: { Authorization: `Bearer ${token}` } }),
    ])
    const [sData, tData] = await Promise.all([sRes.json(), tRes.json()])

    if (sRes.ok) setSubjects(sData)
    if (tRes.ok) setTeachers(tData)

  } catch { notify('Error de conexión', 'error') }
  finally  { setLoading(false) }
}

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchData() }, [id])

  const handleAssign = async () => {
    if (!form.subjectId || !form.teacherId) {
      notify('Selecciona materia y maestro', 'error'); return
    }
    setSaving(true); setError('')
    try {
      const res  = await fetch(`${API_URL}/api/subjects/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          subjectId: parseInt(form.subjectId),
          teacherId: parseInt(form.teacherId),
          courseId:  parseInt(id),
        }),
      })
      const data = await res.json()
      if (!res.ok) { notify(data.message, 'error'); return }
      notify(data.message)
      setForm({ subjectId: '', teacherId: '' })
      fetchData()
    } catch { notify('Error de conexión', 'error') }
    finally  { setSaving(false) }
  }

  const handleRemove = async (assignId: number, subjectName: string) => {
    if (!confirm(`¿Quitar la materia "${subjectName}" de este curso?`)) return
    try {
      const res  = await fetch(`${API_URL}/api/subjects/assign/${assignId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await res.json()
      if (res.ok) { notify(data.message); fetchData() }
      else notify(data.message, 'error')
    } catch { notify('Error al eliminar', 'error') }
  }

  if (loading) return <div className="center"><div className="spinner"/></div>
  if (!course) return <div className="center"><p>Curso no encontrado</p></div>

  // Materias ya asignadas
  const assignedSubjectIds = course.teacherSubjects.map(ts => ts.subject.id)

  return (
    <div className="container">
      <div className="page-header">
        <button className="back-btn" onClick={() => router.back()}>
          <ArrowLeft size={16}/> Volver
        </button>
        <div>
          <h1>Asignar Materias</h1>
          <p>{LEVEL_LABELS[course.level]} — {GRADE_LABELS[course.grade]} {course.parallel} · {SHIFT_LABELS[course.shift]}</p>
        </div>
      </div>

      {success && <div className="alert suc">{success}</div>}
      {error   && <div className="alert err">{error}</div>}

      {/* Formulario asignar */}
      <div className="form-card">
        <div className="section-lbl">Nueva asignación</div>
        <div className="form-row">
          <div className="fg">
            <label>Materia *</label>
           <select value={form.subjectId} onChange={e => setForm({...form, subjectId: e.target.value})}>
  <option value="">Selecciona una materia</option>
  {subjects.map(s => {
    const hours     = s.gradeConfigs?.[0]?.hoursPerWeek
    const isAssigned = assignedSubjectIds.includes(s.id)
    return (
      <option key={s.id} value={s.id} disabled={isAssigned}>
        {s.name}
        {hours      ? ` — ${hours}h/sem` : ''}
        {isAssigned ? ' ✓ Ya asignada'   : ''}
      </option>
    )
  })}
</select>
          </div>
          <div className="fg">
            <label>Maestro *</label>
            <select value={form.teacherId} onChange={e => setForm({...form, teacherId: e.target.value})}>
              <option value="">Selecciona un maestro</option>
              {teachers.map(t => (
                <option key={t.id} value={t.id}>
                  {t.lastName} {t.firstName}{t.specialty ? ` — ${t.specialty}` : ''}
                </option>
              ))}
            </select>
          </div>
          <button className="btn-primary assign-btn" onClick={handleAssign} disabled={saving}>
            {saving ? <span className="spinsm"/> : <Plus size={14}/>}
            {saving ? 'Asignando...' : 'Asignar'}
          </button>
        </div>
      </div>

      {/* Lista de asignaciones actuales */}
      <div className="section-card">
        <div className="section-title">
          <BookOpen size={15}/> Materias asignadas ({course.teacherSubjects.length})
        </div>
        {course.teacherSubjects.length === 0 ? (
          <div className="no-data">No hay materias asignadas a este curso</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Materia</th>
                <th>Código</th>
                <th>Maestro</th>
                <th>Acción</th>
              </tr>
            </thead>
            <tbody>
              {course.teacherSubjects.map((ts, i) => (
                <tr key={ts.id}>
                  <td className="muted">{i + 1}</td>
                  <td><div className="subject-name">{ts.subject.name}</div></td>
                  <td className="muted">{ts.subject.code || '—'}</td>
                  <td>{ts.teacher.lastName} {ts.teacher.firstName}</td>
                  <td>
                    <button className="icon-btn del" onClick={() => handleRemove(ts.id, ts.subject.name)}
                      title="Quitar asignación">
                      <Trash2 size={13}/>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <style>{`
        .container{max-width:700px;margin:0 auto}
        .page-header{display:flex;align-items:flex-start;gap:16px;margin-bottom:24px;flex-wrap:wrap}
        .page-header h1{font-size:20px;font-weight:700;color:#1A3A7C;margin-bottom:4px}
        .page-header p{font-size:13px;color:#6B8BB0}
        .back-btn{display:flex;align-items:center;gap:6px;background:none;border:none;cursor:pointer;color:#6B8BB0;font-size:13px;padding:0}
        .back-btn:hover{color:#1A3A7C}
        .alert{padding:10px 14px;border-radius:8px;font-size:13px;margin-bottom:16px}
        .alert.suc{background:#E1F5EE;border:1px solid #9FE1CB;color:#0F6E56}
        .alert.err{background:#FFF0F0;border:1px solid #FFBBBB;color:#C0392B}
        .center{display:flex;justify-content:center;align-items:center;padding:48px;color:#6B8BB0}
        .form-card{background:#fff;border:1px solid #CBE0F0;border-radius:12px;padding:20px;margin-bottom:16px;display:flex;flex-direction:column;gap:14px}
        .section-lbl{font-size:12px;font-weight:700;color:#1A3A7C;text-transform:uppercase;letter-spacing:.6px;padding-bottom:4px;border-bottom:1px solid #F0F6FC}
        .form-row{display:grid;grid-template-columns:1fr 1fr auto;gap:12px;align-items:flex-end}
        .fg{display:flex;flex-direction:column;gap:6px}
        .fg label{font-size:11px;font-weight:700;color:#1A3A7C;text-transform:uppercase;letter-spacing:.6px}
        .fg select{padding:10px 12px;border:1.5px solid #CBE0F0;border-radius:8px;font-size:13px;color:#1A3A7C;outline:none}
        .fg select:focus{border-color:#4A9FD4;box-shadow:0 0 0 3px rgba(74,159,212,.12)}
        .assign-btn{height:42px;white-space:nowrap}
        .section-card{background:#fff;border:1px solid #CBE0F0;border-radius:12px;overflow:hidden}
        .section-title{display:flex;align-items:center;gap:8px;padding:14px 18px;border-bottom:1px solid #F0F6FC;font-size:13px;font-weight:700;color:#1A3A7C}
        .no-data{padding:20px 18px;font-size:13px;color:#6B8BB0;font-style:italic}
        table{width:100%;border-collapse:collapse}
        thead tr{background:#F0F6FC}
        th{padding:10px 14px;text-align:left;font-size:11px;font-weight:600;color:#1A3A7C;text-transform:uppercase;letter-spacing:.5px}
        td{padding:11px 14px;font-size:13px;color:#1A3A7C;border-top:1px solid #F0F6FC}
        tr:hover td{background:#FAFCFF}
        .muted{color:#6B8BB0;font-size:12px}
        .subject-name{font-weight:500;color:#1A3A7C}
        .icon-btn{width:28px;height:28px;border:none;border-radius:6px;cursor:pointer;display:flex;align-items:center;justify-content:center}
        .icon-btn.del{background:#FFF0F0;color:#C0392B}
        .icon-btn:hover{opacity:.75}
        .btn-primary{display:flex;align-items:center;gap:6px;padding:10px 16px;background:#1A3A7C;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:500;cursor:pointer}
        .btn-primary:hover:not(:disabled){background:#4A9FD4}
        .btn-primary:disabled{opacity:.6;cursor:not-allowed}
        .spinner{width:24px;height:24px;border:2px solid rgba(26,58,124,.2);border-top-color:#1A3A7C;border-radius:50%;animation:spin .7s linear infinite}
        .spinsm{width:14px;height:14px;border:2px solid rgba(255,255,255,.3);border-top-color:#fff;border-radius:50%;animation:spin .7s linear infinite;display:inline-block}
        @keyframes spin{to{transform:rotate(360deg)}}
        @media(max-width:600px){.form-row{grid-template-columns:1fr}}
      `}</style>
    </div>
  )
}