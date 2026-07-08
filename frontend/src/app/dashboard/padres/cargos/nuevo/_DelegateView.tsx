'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Plus, Users } from 'lucide-react'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

interface Parent {
  id: number; firstName: string; lastName: string; ci?: string
  students: { student: { id: number; firstName: string; lastName: string } }[]
}

interface AcademicYear {
  id: number; year: number; isActive: boolean
}

interface Course {
  id: number; level: string; grade: string; parallel: string; shift: string
  assignments: { student: { id: number; firstName: string; lastName: string; parents: { isTutor: boolean; parent: Parent }[] } }[]
}

const TYPE_OPTIONS = [
  { value: 'MULTA_REUNION',    label: 'Multa Reunión de Curso' },
  { value: 'ACTIVIDAD',        label: 'Actividad' },
  { value: 'MATERIAL_ESCOLAR', label: 'Material Escolar' },
  { value: 'OTRO',             label: 'Otro' },
]

const GRADE_LABELS: Record<string, string> = { PRIMERO: '1°', SEGUNDO: '2°', TERCERO: '3°', CUARTO: '4°', QUINTO: '5°', SEXTO: '6°' }
const LEVEL_LABELS: Record<string, string> = { INICIAL: 'Inicial', PRIMARIA: 'Primaria', SECUNDARIA: 'Secundaria' }

export default function DelegateNuevoCargoPage() {
  const router = useRouter()

  const [course,        setCourse]        = useState<Course | null>(null)
  const [parents,       setParents]       = useState<Parent[]>([])
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([])
  const [loading,       setLoading]       = useState(true)
  const [saving,        setSaving]        = useState(false)
  const [error,         setError]         = useState('')
  const [success,       setSuccess]       = useState('')
  const [bulk,          setBulk]          = useState(false)
  const [selectedParents, setSelectedParents] = useState<number[]>([])

  const [form, setForm] = useState({
    title:          '',
    description:    '',
    amount:         '',
    type:           'MULTA_REUNION',
    dueDate:        '',
    parentId:       '',
    studentId:      '',
    academicYearId: '',
  })

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : ''

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      try {
        const [cRes, yRes] = await Promise.all([
          fetch(`${API_URL}/api/delegates/my-course`, { headers: { Authorization: `Bearer ${token}` } }),
          fetch(`${API_URL}/api/academic`,             { headers: { Authorization: `Bearer ${token}` } }),
        ])
        const [cData, yData] = await Promise.all([cRes.json(), yRes.json()])

        if (cRes.ok) {
          setCourse(cData)
          // Extraer tutores legales únicos
          const parentMap = new Map<number, Parent>()
          for (const a of cData.assignments) {
            for (const ps of a.student.parents) {
              if (ps.isTutor && !parentMap.has(ps.parent.id)) {
                parentMap.set(ps.parent.id, {
                  ...ps.parent,
                  students: a.student ? [{ student: a.student }] : []
                })
              }
            }
          }
          setParents(Array.from(parentMap.values()))
        }

        if (yRes.ok) {
          setAcademicYears(yData)
          const active = yData.find((y: AcademicYear) => y.isActive)
          if (active) setForm(f => ({ ...f, academicYearId: String(active.id) }))
        }
      } catch { setError('Error de conexión') }
      finally  { setLoading(false) }
    }
    fetchData()
  }, [])

  const handleSave = async () => {
    if (!form.title || !form.amount || !form.academicYearId) {
      setError('Título, monto y gestión son requeridos'); return
    }
    if (!bulk && !form.parentId) {
      setError('Selecciona un tutor'); return
    }
    if (bulk && selectedParents.length === 0) {
      setError('Selecciona al menos un tutor'); return
    }

    setSaving(true); setError('')
    try {
      if (bulk) {
        const res  = await fetch(`${API_URL}/api/treasury/bulk`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            title:          form.title,
            description:    form.description || undefined,
            amount:         parseFloat(form.amount),
            type:           form.type,
            dueDate:        form.dueDate || undefined,
            academicYearId: parseInt(form.academicYearId),
            parentIds:      selectedParents,
          }),
        })
        const data = await res.json()
        if (!res.ok) { setError(data.message); return }
        setSuccess(data.message)
        setTimeout(() => router.push('/dashboard/padres/tesoreria'), 1500)
      } else {
        const res  = await fetch(`${API_URL}/api/treasury`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            title:          form.title,
            description:    form.description || undefined,
            amount:         parseFloat(form.amount),
            type:           form.type,
            target:         'TUTOR',
            dueDate:        form.dueDate || undefined,
            parentId:       parseInt(form.parentId),
            academicYearId: parseInt(form.academicYearId),
          }),
        })
        const data = await res.json()
        if (!res.ok) { setError(data.message); return }
        setSuccess('Cargo registrado correctamente')
        setTimeout(() => router.push('/dashboard/padres/tesoreria'), 1500)
      }
    } catch { setError('Error de conexión') }
    finally  { setSaving(false) }
  }

  const toggleParent = (id: number) =>
    setSelectedParents(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id])

  return (
    <div className="container">
      <div className="page-header">
        <button className="back-btn" onClick={() => router.back()}>
          <ArrowLeft size={16}/> Volver
        </button>
        <div>
          <h1>Nuevo Cargo</h1>
          {course && <p>{LEVEL_LABELS[course.level]} — {GRADE_LABELS[course.grade]} {course.parallel}</p>}
        </div>
      </div>

      {success && <div className="alert suc">{success}</div>}
      {error   && <div className="alert err">{error}</div>}

      {loading ? (
        <div className="center"><div className="spinner"/></div>
      ) : (
        <div className="form-card">
          {/* Modo */}
          <div className="mode-toggle">
            <button className={`mode-btn ${!bulk ? 'active' : ''}`} onClick={() => setBulk(false)}>
              Cargo individual
            </button>
            <button className={`mode-btn ${bulk ? 'active' : ''}`} onClick={() => setBulk(true)}>
              <Users size={14}/> Cargo a todo el curso
            </button>
          </div>

          {bulk && (
            <div className="info-box">
              💡 Se creará el mismo cargo para todos los tutores seleccionados del curso.
            </div>
          )}

          <div className="section-lbl">Datos del cargo</div>
          <div className="form-grid">
            <div className="fg fg-full">
              <label>Título *</label>
              <input type="text" placeholder="Ej: Multa reunión marzo, Material didáctico..."
                value={form.title} onChange={e => setForm({...form, title: e.target.value})}/>
            </div>
            <div className="fg">
              <label>Tipo de cargo *</label>
              <select value={form.type} onChange={e => setForm({...form, type: e.target.value})}>
                {TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div className="fg">
              <label>Monto (Bs.) *</label>
              <input type="number" step="0.01" min="0" placeholder="0.00"
                value={form.amount} onChange={e => setForm({...form, amount: e.target.value})}/>
            </div>
            <div className="fg">
              <label>Gestión *</label>
              <select value={form.academicYearId} onChange={e => setForm({...form, academicYearId: e.target.value})}>
                <option value="">Selecciona gestión</option>
                {academicYears.map(y => (
                  <option key={y.id} value={y.id}>{y.year}{y.isActive ? ' (Activa)' : ''}</option>
                ))}
              </select>
            </div>
            <div className="fg">
              <label>Fecha de vencimiento</label>
              <input type="date" value={form.dueDate}
                onChange={e => setForm({...form, dueDate: e.target.value})}/>
            </div>
            <div className="fg fg-full">
              <label>Descripción</label>
              <input type="text" placeholder="Descripción adicional (opcional)"
                value={form.description} onChange={e => setForm({...form, description: e.target.value})}/>
            </div>
          </div>

          {/* Individual */}
          {!bulk && (
            <>
              <div className="section-lbl">Asignar a tutor del curso</div>
              <div className="fg">
                <label>Tutor legal *</label>
                <select value={form.parentId} onChange={e => setForm({...form, parentId: e.target.value})}>
                  <option value="">Selecciona un tutor</option>
                  {parents.map(p => (
                    <option key={p.id} value={p.id}>{p.lastName} {p.firstName}{p.ci ? ` — CI: ${p.ci}` : ''}</option>
                  ))}
                </select>
              </div>
            </>
          )}

          {/* Masivo */}
          {bulk && (
            <>
              <div className="section-lbl">Seleccionar tutores ({selectedParents.length} seleccionados)</div>
              <div className="bulk-actions">
                <button className="btn-sm" onClick={() => setSelectedParents(parents.map(p => p.id))}>Seleccionar todos</button>
                <button className="btn-sm" onClick={() => setSelectedParents([])}>Limpiar</button>
              </div>
              <div className="parents-select">
                {parents.map(p => (
                  <label key={p.id} className={`parent-option ${selectedParents.includes(p.id) ? 'selected' : ''}`}>
                    <input type="checkbox" checked={selectedParents.includes(p.id)} onChange={() => toggleParent(p.id)}/>
                    <div>
                      <div className="parent-name">{p.lastName} {p.firstName}</div>
                      {p.ci && <div className="parent-ci">CI: {p.ci}</div>}
                    </div>
                  </label>
                ))}
              </div>
            </>
          )}

          <div className="form-actions">
            <button className="btn-outline" onClick={() => router.back()}>Cancelar</button>
            <button className="btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? <span className="spinsm"/> : <Plus size={14}/>}
              {saving ? 'Registrando...' : bulk ? `Crear ${selectedParents.length} cargos` : 'Registrar cargo'}
            </button>
          </div>
        </div>
      )}

      <style>{`
        .container{max-width:700px;margin:0 auto}
        .page-header{display:flex;align-items:center;gap:16px;margin-bottom:24px}
        .page-header h1{font-size:20px;font-weight:700;color:#1A3A7C;margin-bottom:4px}
        .page-header p{font-size:13px;color:#6B8BB0}
        .back-btn{display:flex;align-items:center;gap:6px;background:none;border:none;cursor:pointer;color:#6B8BB0;font-size:13px;padding:0}
        .back-btn:hover{color:#1A3A7C}
        .alert{padding:10px 14px;border-radius:8px;font-size:13px;margin-bottom:16px}
        .alert.suc{background:#E1F5EE;border:1px solid #9FE1CB;color:#0F6E56}
        .alert.err{background:#FFF0F0;border:1px solid #FFBBBB;color:#C0392B}
        .center{display:flex;justify-content:center;padding:48px}
        .form-card{background:#fff;border:1px solid #CBE0F0;border-radius:14px;padding:24px;display:flex;flex-direction:column;gap:18px}
        .mode-toggle{display:flex;background:#F0F6FC;border-radius:10px;padding:4px;gap:4px}
        .mode-btn{flex:1;padding:8px;border:none;border-radius:8px;font-size:13px;cursor:pointer;background:transparent;color:#6B8BB0;display:flex;align-items:center;justify-content:center;gap:6px;transition:all .15s}
        .mode-btn.active{background:#fff;color:#1A3A7C;font-weight:600;box-shadow:0 1px 4px rgba(0,0,0,.1)}
        .info-box{background:#F0F6FC;border:1px solid #CBE0F0;border-radius:8px;padding:12px;font-size:12px;color:#6B8BB0;line-height:1.6}
        .section-lbl{font-size:12px;font-weight:700;color:#1A3A7C;text-transform:uppercase;letter-spacing:.6px;padding-bottom:4px;border-bottom:1px solid #F0F6FC}
        .form-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
        .fg-full{grid-column:1/-1}
        .fg{display:flex;flex-direction:column;gap:6px}
        .fg label{font-size:11px;font-weight:700;color:#1A3A7C;text-transform:uppercase;letter-spacing:.6px}
        .fg input,.fg select{padding:10px 12px;border:1.5px solid #CBE0F0;border-radius:8px;font-size:13px;color:#1A3A7C;outline:none}
        .fg input:focus,.fg select:focus{border-color:#4A9FD4;box-shadow:0 0 0 3px rgba(74,159,212,.12)}
        .bulk-actions{display:flex;gap:8px}
        .btn-sm{padding:6px 12px;background:#fff;color:#1A3A7C;border:1.5px solid #CBE0F0;border-radius:6px;font-size:12px;cursor:pointer}
        .parents-select{display:flex;flex-direction:column;gap:6px;max-height:280px;overflow-y:auto;border:1.5px solid #CBE0F0;border-radius:8px;padding:8px}
        .parent-option{display:flex;align-items:center;gap:10px;padding:10px;border-radius:6px;cursor:pointer;border:1px solid transparent}
        .parent-option:hover{background:#F0F6FC}
        .parent-option.selected{background:#E0ECF8;border-color:#CBE0F0}
        .parent-option input{accent-color:#1A3A7C;cursor:pointer;width:16px;height:16px;flex-shrink:0}
        .parent-name{font-size:13px;font-weight:500;color:#1A3A7C}
        .parent-ci{font-size:11px;color:#6B8BB0}
        .form-actions{display:flex;justify-content:flex-end;gap:10px;padding-top:8px;border-top:1px solid #F0F6FC}
        .btn-primary{display:flex;align-items:center;gap:6px;padding:10px 20px;background:#1A3A7C;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:500;cursor:pointer}
        .btn-primary:hover:not(:disabled){background:#4A9FD4}
        .btn-primary:disabled{opacity:.6;cursor:not-allowed}
        .btn-outline{display:flex;align-items:center;gap:6px;padding:10px 16px;background:#fff;color:#1A3A7C;border:1.5px solid #CBE0F0;border-radius:8px;font-size:13px;cursor:pointer}
        .btn-outline:hover{background:#F0F6FC}
        .spinner{width:24px;height:24px;border:2px solid rgba(26,58,124,.2);border-top-color:#1A3A7C;border-radius:50%;animation:spin .7s linear infinite}
        .spinsm{width:14px;height:14px;border:2px solid rgba(255,255,255,.3);border-top-color:#fff;border-radius:50%;animation:spin .7s linear infinite;display:inline-block}
        @keyframes spin{to{transform:rotate(360deg)}}
        @media(max-width:600px){.form-grid{grid-template-columns:1fr}}
      `}</style>
    </div>
  )
}