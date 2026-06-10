'use client'

import { useState, useEffect } from 'react'
import { Save, BookOpen, Users, CheckCircle, AlertCircle } from 'lucide-react'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

interface Trimester { id: number; number: number; name: string | null }
interface TeacherSubject {
  id: number; subjectId: number; courseId: number
  subject: { id: number; name: string }
  course:  { id: number; grade: string; parallel: string; level: string }
}
interface Student { id: number; firstName: string; lastName: string; kardex: string | null }

const GRADES_LABELS: Record<string, string> = {
  PRIMERO: '1°', SEGUNDO: '2°', TERCERO: '3°',
  CUARTO: '4°', QUINTO: '5°', SEXTO: '6°',
}

export default function TeacherNotasPage() {
  const [teacherId,         setTeacherId]         = useState<number | null>(null)
  const [trimestres,        setTrimestres]        = useState<Trimester[]>([])
  const [materias,          setMaterias]          = useState<TeacherSubject[]>([])
  const [selectedTrimestre, setSelectedTrimestre] = useState<Trimester | null>(null)
  const [selectedMateria,   setSelectedMateria]   = useState<TeacherSubject | null>(null)
  const [students,          setStudents]          = useState<Student[]>([])
  const [grades,            setGrades]            = useState<Record<number, string>>({})
  const [loadingStudents,   setLoadingStudents]   = useState(false)
  const [saving,            setSaving]            = useState(false)
  const [toast,             setToast]             = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const year = new Date().getFullYear()

  const token = () => typeof window !== 'undefined' ? localStorage.getItem('token') : ''

  const showToast = (type: 'ok' | 'err', text: string) => {
    setToast({ type, text })
    setTimeout(() => setToast(null), 4000)
  }

  // Cargar datos iniciales
  useEffect(() => {
    const init = async () => {
      try {
        const meRes = await fetch(`${API}/api/auth/me`, {
          headers: { Authorization: `Bearer ${token()}` },
        })
        const me = await meRes.json()
        const tid = me.teacher?.id
        if (!tid) { showToast('err', 'No se encontró el perfil del maestro'); return }
        setTeacherId(tid)

        const [trimRes, matRes] = await Promise.all([
          fetch(`${API}/api/notas/trimestres?year=${year}`, { headers: { Authorization: `Bearer ${token()}` } }),
          fetch(`${API}/api/notas/teacher-subjects/${tid}`, { headers: { Authorization: `Bearer ${token()}` } }),
        ])

        const trimData = await trimRes.json()
        const matData  = await matRes.json()

        setTrimestres(Array.isArray(trimData) ? trimData : [])
        setMaterias(Array.isArray(matData) ? matData : [])
        if (Array.isArray(trimData) && trimData.length > 0) setSelectedTrimestre(trimData[0])
      } catch { showToast('err', 'Error al cargar datos iniciales') }
    }
    init()
  }, [])

  // Cargar estudiantes y notas cuando cambia materia o trimestre
  useEffect(() => {
    if (!selectedMateria || !selectedTrimestre) return
    const load = async () => {
      setLoadingStudents(true); setStudents([]); setGrades({})
      try {
        const [studRes, notasRes] = await Promise.all([
          fetch(`${API}/api/notas/course-students/${selectedMateria.courseId}?year=${year}`, { headers: { Authorization: `Bearer ${token()}` } }),
          fetch(`${API}/api/notas/course/${selectedMateria.courseId}?trimesterId=${selectedTrimestre.id}`, { headers: { Authorization: `Bearer ${token()}` } }),
        ])
        const studData  = await studRes.json()
        const notasData = await notasRes.json()
        setStudents(Array.isArray(studData) ? studData : [])
        const map: Record<number, string> = {}
        if (Array.isArray(notasData)) {
          notasData.filter((n: any) => n.subjectId === selectedMateria.subjectId)
            .forEach((n: any) => { map[n.studentId] = String(n.value) })
        }
        setGrades(map)
      } catch { showToast('err', 'Error al cargar estudiantes') }
      finally  { setLoadingStudents(false) }
    }
    load()
  }, [selectedMateria, selectedTrimestre])

  const handleGradeChange = (studentId: number, val: string) => {
    if (val !== '' && val !== '-') {
      const num = parseFloat(val)
      if (isNaN(num) || num < 0 || num > 100) return
    }
    setGrades(prev => ({ ...prev, [studentId]: val }))
  }

  const handleSave = async () => {
    if (!selectedMateria || !selectedTrimestre || !teacherId) return
    const payload = students
      .filter(s => grades[s.id] !== undefined && grades[s.id] !== '')
      .map(s => ({
        studentId:   s.id,
        subjectId:   selectedMateria.subjectId,
        courseId:    selectedMateria.courseId,
        teacherId,
        trimesterId: selectedTrimestre.id,
        value:       parseFloat(grades[s.id]),
      }))
    if (payload.length === 0) { showToast('err', 'No hay notas para guardar'); return }
    setSaving(true)
    try {
      const res  = await fetch(`${API}/api/notas/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ notas: payload }),
      })
      const data = await res.json()
      if (res.ok) showToast('ok', `${data.saved} notas guardadas correctamente`)
      else showToast('err', data.error || 'Error al guardar')
    } catch { showToast('err', 'Error de conexión') }
    finally  { setSaving(false) }
  }

  const notasIngresadas = students.filter(s => grades[s.id] !== undefined && grades[s.id] !== '').length
  const aprobados       = students.filter(s => { const v = parseFloat(grades[s.id]); return !isNaN(v) && v >= 51 }).length
  const reprobados      = notasIngresadas - aprobados

  const courseLabel = selectedMateria
    ? `${GRADES_LABELS[selectedMateria.course.grade] || selectedMateria.course.grade} "${selectedMateria.course.parallel}"`
    : ''

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Registro de Notas</h1>
          <p>Gestión {year} · Escala 0–100 · Aprobado ≥ 51</p>
        </div>
      </div>

      {toast && (
        <div className={`alert ${toast.type === 'ok' ? 'suc' : 'err'}`}>
          {toast.type === 'ok' ? <CheckCircle size={14}/> : <AlertCircle size={14}/>}
          {toast.text}
        </div>
      )}

      {/* Filtros */}
      <div className="filter-card">
        <div className="filter-group">
          <div className="filter-label">Trimestre</div>
          {trimestres.length === 0 ? (
            <span className="no-data">Sin trimestres configurados</span>
          ) : (
            <div className="trim-btns">
              {trimestres.map(t => (
                <button key={t.id} className={`trim-btn ${selectedTrimestre?.id === t.id ? 'active' : ''}`}
                  onClick={() => setSelectedTrimestre(t)}>
                  {t.name || `${t.number}° Trimestre`}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="filter-group" style={{flex:1,minWidth:'240px'}}>
          <div className="filter-label">Materia</div>
          <select value={selectedMateria?.id ?? ''}
            onChange={e => setSelectedMateria(materias.find(m => m.id === parseInt(e.target.value)) ?? null)}
            className="filter-select">
            <option value="">— Seleccionar materia —</option>
            {materias.map(m => (
              <option key={m.id} value={m.id}>
                {m.subject.name} · {GRADES_LABELS[m.course.grade] || m.course.grade} "{m.course.parallel}"
              </option>
            ))}
          </select>
          {materias.length === 0 && <span className="warn-text">No tienes materias asignadas aún.</span>}
        </div>
      </div>

      {!selectedMateria && (
        <div className="empty-state"><BookOpen size={48} color="#CBE0F0"/><p>Selecciona un trimestre y una materia para comenzar</p></div>
      )}

      {selectedMateria && loadingStudents && (
        <div className="center"><div className="spinner"/></div>
      )}

      {selectedMateria && !loadingStudents && students.length > 0 && (
        <>
          <div className="stats-grid">
            <div className="stat-card"><div className="stat-num" style={{color:'#1A3A7C'}}>{students.length}</div><div className="stat-lbl">Estudiantes</div></div>
            <div className="stat-card"><div className="stat-num" style={{color:'#0F6E56'}}>{aprobados}</div><div className="stat-lbl">Aprobados</div></div>
            <div className="stat-card"><div className="stat-num" style={{color:'#C0392B'}}>{reprobados}</div><div className="stat-lbl">Reprobados</div></div>
            <div className="stat-card"><div className="stat-num" style={{color:'#BA7517'}}>{students.length - notasIngresadas}</div><div className="stat-lbl">Sin nota</div></div>
          </div>

          <div className="table-card">
            <div className="table-header">
              <div style={{display:'flex',alignItems:'center',gap:'8px',fontSize:'13px',color:'#6B8BB0',flexWrap:'wrap'}}>
                <Users size={14}/>
                <strong style={{color:'#1A3A7C'}}>{courseLabel}</strong>
                <span>·</span><span>{selectedMateria.subject.name}</span>
                <span>·</span><span>{selectedTrimestre?.name || `${selectedTrimestre?.number}° Trimestre`}</span>
              </div>
              <button className="btn-save" onClick={handleSave} disabled={saving}>
                <Save size={14}/>{saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>

            <table>
              <thead>
                <tr>
                  <th>#</th><th>Estudiante</th><th>Kardex</th>
                  <th style={{textAlign:'center'}}>Nota (0–100)</th>
                  <th style={{textAlign:'center'}}>Estado</th>
                </tr>
              </thead>
              <tbody>
                {students.map((student, i) => {
                  const val       = grades[student.id] ?? ''
                  const num       = parseFloat(val)
                  const tieneNota = val !== ''
                  const aprobado  = tieneNota && !isNaN(num) && num >= 51
                  return (
                    <tr key={student.id}>
                      <td className="muted">{i + 1}</td>
                      <td style={{fontWeight:500}}>{student.lastName} {student.firstName}</td>
                      <td className="muted mono">{student.kardex ?? '—'}</td>
                      <td style={{textAlign:'center'}}>
                        <input type="number" min={0} max={100} step={0.5}
                          value={val} onChange={e => handleGradeChange(student.id, e.target.value)}
                          placeholder="—" className="grade-input"/>
                      </td>
                      <td style={{textAlign:'center'}}>
                        {!tieneNota ? <span className="muted">—</span>
                          : aprobado ? <span className="status-badge apr">Aprobado</span>
                          : <span className="status-badge rep">Reprobado</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>

            <div className="table-footer">
              <span className="muted">{notasIngresadas} de {students.length} notas ingresadas</span>
              <button className="btn-save" onClick={handleSave} disabled={saving}>
                <Save size={14}/>{saving ? 'Guardando...' : 'Guardar todas las notas'}
              </button>
            </div>
          </div>
        </>
      )}

      {selectedMateria && !loadingStudents && students.length === 0 && (
        <div className="empty-state">
          <Users size={36} color="#CBE0F0"/>
          <p>No hay estudiantes inscritos en este curso para la gestión {year}.</p>
        </div>
      )}

      <style>{`
        .page-header{margin-bottom:24px}
        .page-header h1{font-size:20px;font-weight:700;color:#633806;margin-bottom:4px}
        .page-header p{font-size:13px;color:#6B8BB0}
        .alert{display:flex;align-items:center;gap:8px;padding:10px 14px;border-radius:8px;font-size:13px;margin-bottom:16px}
        .alert.suc{background:#E1F5EE;border:1px solid #9FE1CB;color:#0F6E56}
        .alert.err{background:#FFF0F0;border:1px solid #FFBBBB;color:#C0392B}
        .filter-card{background:#fff;border:1px solid #CBE0F0;border-radius:12px;padding:20px;margin-bottom:20px;display:flex;flex-wrap:wrap;gap:20px}
        .filter-group{display:flex;flex-direction:column;gap:8px}
        .filter-label{font-size:11px;font-weight:700;color:#6B8BB0;text-transform:uppercase;letter-spacing:.6px}
        .trim-btns{display:flex;gap:8px;flex-wrap:wrap}
        .trim-btn{padding:7px 16px;border-radius:8px;font-size:13px;font-weight:500;border:1.5px solid #CBE0F0;background:#fff;color:#1A3A7C;cursor:pointer;transition:all .15s}
        .trim-btn:hover{border-color:#4A9FD4;background:#F0F6FC}
        .trim-btn.active{background:#633806;color:#fff;border-color:#633806}
        .filter-select{padding:9px 12px;border:1.5px solid #CBE0F0;border-radius:8px;font-size:13px;color:#1A3A7C;outline:none;width:100%}
        .filter-select:focus{border-color:#4A9FD4}
        .no-data{font-size:13px;color:#6B8BB0;font-style:italic}
        .warn-text{font-size:12px;color:#BA7517}
        .stats-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px}
        .stat-card{background:#fff;border:1px solid #CBE0F0;border-radius:12px;padding:16px;text-align:center}
        .stat-num{font-size:28px;font-weight:800}
        .stat-lbl{font-size:12px;color:#6B8BB0;margin-top:4px}
        .table-card{background:#fff;border:1px solid #CBE0F0;border-radius:12px;overflow:hidden}
        .table-header{display:flex;align-items:center;justify-content:space-between;padding:14px 18px;border-bottom:1px solid #F0F6FC;flex-wrap:wrap;gap:10px}
        table{width:100%;border-collapse:collapse}
        thead tr{background:#F0F6FC}
        th{padding:10px 14px;text-align:left;font-size:11px;font-weight:600;color:#1A3A7C;text-transform:uppercase;letter-spacing:.5px}
        td{padding:11px 14px;font-size:13px;color:#1A3A7C;border-top:1px solid #F0F6FC}
        tr:hover td{background:#FAFCFF}
        .muted{color:#6B8BB0;font-size:12px}
        .mono{font-family:monospace}
        .grade-input{width:80px;text-align:center;padding:6px 8px;border:1.5px solid #CBE0F0;border-radius:8px;font-size:13px;color:#1A3A7C;outline:none}
        .grade-input:focus{border-color:#4A9FD4;box-shadow:0 0 0 3px rgba(74,159,212,.12)}
        .status-badge{padding:3px 10px;border-radius:20px;font-size:11px;font-weight:600}
        .status-badge.apr{background:#E1F5EE;color:#0F6E56}
        .status-badge.rep{background:#FFF0F0;color:#C0392B}
        .table-footer{display:flex;align-items:center;justify-content:space-between;padding:12px 18px;background:#F8FBFF;border-top:1px solid #F0F6FC}
        .btn-save{display:flex;align-items:center;gap:6px;padding:8px 16px;background:#633806;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:500;cursor:pointer}
        .btn-save:hover:not(:disabled){background:#7A4A0A}
        .btn-save:disabled{opacity:.6;cursor:not-allowed}
        .empty-state{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:60px;gap:12px;color:#6B8BB0;font-size:13px}
        .center{display:flex;justify-content:center;padding:48px}
        .spinner{width:24px;height:24px;border:2px solid rgba(99,56,6,.2);border-top-color:#633806;border-radius:50%;animation:spin .7s linear infinite}
        @keyframes spin{to{transform:rotate(360deg)}}
        @media(max-width:600px){.stats-grid{grid-template-columns:1fr 1fr}.filter-card{flex-direction:column}}
      `}</style>
    </div>
  )
}