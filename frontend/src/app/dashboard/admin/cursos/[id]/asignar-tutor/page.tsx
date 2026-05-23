'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, GraduationCap, Check } from 'lucide-react'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

interface Teacher {
  id:        number
  firstName: string
  lastName:  string
  ci?:       string
  specialty?: string
  courseTutor?: { id: number } // si ya es tutor de otro curso
}

export default function AsignarTutorPage() {
  const params = useParams()
  const router = useRouter()
  const id     = params.id as string

  const [teachers,    setTeachers]    = useState<Teacher[]>([])
  const [currentTutor, setCurrentTutor] = useState<number | null>(null)
  const [selected,    setSelected]    = useState<number | null>(null)
  const [loading,     setLoading]     = useState(true)
  const [saving,      setSaving]      = useState(false)
  const [error,       setError]       = useState('')
  const [success,     setSuccess]     = useState('')

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : ''

  useEffect(() => {
  const fetchData = async () => {
    setLoading(true)
    try {
      const [cRes, tRes] = await Promise.all([
        fetch(`${API_URL}/api/courses/${id}`,  { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_URL}/api/teachers`,       { headers: { Authorization: `Bearer ${token}` } }),
      ])
      const [cData, tData] = await Promise.all([cRes.json(), tRes.json()])
      
      if (cRes.ok && cData.tutor) {
        setCurrentTutor(cData.tutor.teacher.id)
        setSelected(cData.tutor.teacher.id)
      }

      if (tRes.ok && cRes.ok) {
        // Filtrar solo maestros que dictan en este curso
        const teacherIdsInCourse = cData.teacherSubjects?.map((ts: any) => ts.teacher.id) || []
        const filtered = tData.filter((t: Teacher) => teacherIdsInCourse.includes(t.id))
        setTeachers(filtered)
      }
    } catch { setError('Error de conexión') }
    finally  { setLoading(false) }
  }
  fetchData()
}, [id])

  const handleSave = async () => {
    if (!selected) { setError('Selecciona un maestro'); return }
    setSaving(true); setError('')
    try {
      const res  = await fetch(`${API_URL}/api/courses/${id}/assign-tutor`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ teacherId: selected }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.message); return }
      setSuccess(data.message)
      setTimeout(() => router.push(`/dashboard/admin/cursos/${id}`), 1500)
    } catch { setError('Error de conexión') }
    finally  { setSaving(false) }
  }

  const handleRemove = async () => {
    if (!confirm('¿Quitar el maestro tutor de este curso?')) return
    setSaving(true); setError('')
    try {
      const res  = await fetch(`${API_URL}/api/courses/${id}/assign-tutor`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (!res.ok) { setError(data.message); return }
      setSuccess(data.message)
      setTimeout(() => router.push(`/dashboard/admin/cursos/${id}`), 1500)
    } catch { setError('Error de conexión') }
    finally  { setSaving(false) }
  }

  return (
    <div className="container">
      <div className="page-header">
        <button className="back-btn" onClick={() => router.back()}>
          <ArrowLeft size={16}/> Volver
        </button>
        <h1>Asignar Maestro Tutor</h1>
      </div>

      {success && <div className="alert suc">{success}</div>}
      {error   && <div className="alert err">{error}</div>}

      {loading ? (
        <div className="center"><div className="spinner"/></div>
      ) : (
        <div className="form-card">
          <div className="info-box">
            💡 El maestro tutor es el responsable del curso. Solo puede haber uno por curso y un maestro no puede ser tutor de más de un curso.
          </div>

          <div className="section-lbl">Selecciona el maestro tutor</div>
          <div className="teachers-list">
            {teachers.filter(t => t.isActive !== false).map(t => {
              const isCurrentTutor = t.id === currentTutor
              const isTutorElsewhere = t.courseTutor && t.id !== currentTutor
              return (
                <label key={t.id}
                  className={`teacher-option ${selected === t.id ? 'selected' : ''} ${isTutorElsewhere ? 'disabled' : ''}`}>
                  <input type="radio" name="teacher" value={t.id}
                    checked={selected === t.id}
                    disabled={!!isTutorElsewhere}
                    onChange={() => !isTutorElsewhere && setSelected(t.id)}/>
                  <div className="teacher-info">
                    <div className="teacher-name">
                      {t.lastName} {t.firstName}
                      {isCurrentTutor && <span className="current-badge">Tutor actual</span>}
                      {isTutorElsewhere && <span className="other-badge">Tutor de otro curso</span>}
                    </div>
                    {t.ci        && <div className="teacher-sub">CI: {t.ci}</div>}
                    {t.specialty && <div className="teacher-sub">Especialidad: {t.specialty}</div>}
                  </div>
                  {selected === t.id && <Check size={16} color="#0F6E56"/>}
                </label>
              )
            })}
          </div>

          <div className="form-actions">
            {currentTutor && (
              <button className="btn-danger" onClick={handleRemove} disabled={saving}>
                Quitar tutor
              </button>
            )}
            <div style={{flex:1}}/>
            <button className="btn-outline" onClick={() => router.back()}>Cancelar</button>
            <button className="btn-primary" onClick={handleSave} disabled={saving || !selected}>
              {saving ? <span className="spinsm"/> : <GraduationCap size={14}/>}
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </div>
      )}

      <style>{`
        .container{max-width:600px;margin:0 auto}
        .page-header{display:flex;align-items:center;gap:16px;margin-bottom:24px}
        .page-header h1{font-size:20px;font-weight:700;color:#1A3A7C}
        .back-btn{display:flex;align-items:center;gap:6px;background:none;border:none;cursor:pointer;color:#6B8BB0;font-size:13px;padding:0}
        .back-btn:hover{color:#1A3A7C}
        .alert{padding:10px 14px;border-radius:8px;font-size:13px;margin-bottom:16px}
        .alert.suc{background:#E1F5EE;border:1px solid #9FE1CB;color:#0F6E56}
        .alert.err{background:#FFF0F0;border:1px solid #FFBBBB;color:#C0392B}
        .center{display:flex;justify-content:center;padding:48px}
        .form-card{background:#fff;border:1px solid #CBE0F0;border-radius:14px;padding:24px;display:flex;flex-direction:column;gap:16px}
        .info-box{background:#F0F6FC;border:1px solid #CBE0F0;border-radius:8px;padding:12px;font-size:12px;color:#6B8BB0;line-height:1.6}
        .section-lbl{font-size:12px;font-weight:700;color:#1A3A7C;text-transform:uppercase;letter-spacing:.6px;padding-bottom:4px;border-bottom:1px solid #F0F6FC}
        .teachers-list{display:flex;flex-direction:column;gap:8px;max-height:400px;overflow-y:auto}
        .teacher-option{display:flex;align-items:center;gap:12px;padding:12px;border:1.5px solid #CBE0F0;border-radius:8px;cursor:pointer}
        .teacher-option:hover{background:#F0F6FC}
        .teacher-option.selected{border-color:#0F6E56;background:#E1F5EE}
        .teacher-option.disabled{opacity:.5;cursor:not-allowed;background:#F8F8F8}
        .teacher-option input{accent-color:#0F6E56;cursor:pointer;width:16px;height:16px;flex-shrink:0}
        .teacher-info{flex:1}
        .teacher-name{font-size:13px;font-weight:600;color:#1A3A7C;display:flex;align-items:center;gap:8px;flex-wrap:wrap}
        .teacher-sub{font-size:11px;color:#6B8BB0;margin-top:2px}
        .current-badge{font-size:10px;background:#E1F5EE;color:#0F6E56;padding:2px 7px;border-radius:10px;font-weight:500}
        .other-badge{font-size:10px;background:#FFF0F0;color:#C0392B;padding:2px 7px;border-radius:10px;font-weight:500}
        .form-actions{display:flex;align-items:center;gap:10px;padding-top:8px;border-top:1px solid #F0F6FC}
        .btn-primary{display:flex;align-items:center;gap:6px;padding:10px 20px;background:#1A3A7C;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:500;cursor:pointer}
        .btn-primary:hover:not(:disabled){background:#4A9FD4}
        .btn-primary:disabled{opacity:.6;cursor:not-allowed}
        .btn-outline{display:flex;align-items:center;gap:6px;padding:10px 16px;background:#fff;color:#1A3A7C;border:1.5px solid #CBE0F0;border-radius:8px;font-size:13px;cursor:pointer}
        .btn-outline:hover{background:#F0F6FC}
        .btn-danger{display:flex;align-items:center;gap:6px;padding:10px 16px;background:#FFF0F0;color:#C0392B;border:1.5px solid #FFBBBB;border-radius:8px;font-size:13px;cursor:pointer}
        .btn-danger:hover{background:#FFE0E0}
        .spinner{width:24px;height:24px;border:2px solid rgba(26,58,124,.2);border-top-color:#1A3A7C;border-radius:50%;animation:spin .7s linear infinite}
        .spinsm{width:14px;height:14px;border:2px solid rgba(255,255,255,.3);border-top-color:#fff;border-radius:50%;animation:spin .7s linear infinite;display:inline-block}
        @keyframes spin{to{transform:rotate(360deg)}}
      `}</style>
    </div>
  )
}