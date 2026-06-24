'use client'

import { useEffect, useState } from 'react'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

interface Course {
  id: number; grade: string; parallel: string; level: string; shift: string
}

interface StudentAtt {
  studentId: number; firstName: string; lastName: string; gender: string
  status: 'PRESENTE' | 'AUSENTE' | 'RETRASO' | 'LICENCIA' | null
  note: string
  attendance: any
}

interface Summary {
  total: number; presentes: number; ausentes: number
  retrasos: number; licencias: number; registrado: boolean
}

const GRADES: Record<string,string> = { PRIMERO:'1°', SEGUNDO:'2°', TERCERO:'3°', CUARTO:'4°', QUINTO:'5°', SEXTO:'6°' }
const SHIFTS: Record<string,string> = { MORNING:'Mañana', AFTERNOON:'Tarde' }

const STATUS_CONFIG = {
  PRESENTE: { label:'Presente', emoji:'✅', bg:'#E1F5EE', color:'#0F6E56', border:'#9FE1CB' },
  AUSENTE:  { label:'Ausente',  emoji:'❌', bg:'#FFF0F0', color:'#C0392B', border:'#FFBBBB' },
  RETRASO:  { label:'Retraso',  emoji:'⏰', bg:'#FFFBEA', color:'#BA7517', border:'#F5C518' },
  LICENCIA: { label:'Licencia', emoji:'📋', bg:'#F0F0FF', color:'#6B21A8', border:'#C4B5FD' },
}

type StatusKey = keyof typeof STATUS_CONFIG

export default function AsistenciaEstudiantesPage() {
  const [courses,   setCourses]   = useState<Course[]>([])
  const [selCourse, setSelCourse] = useState<Course | null>(null)
  const [students,  setStudents]  = useState<StudentAtt[]>([])
  const [summary,   setSummary]   = useState<Summary | null>(null)
  const [date,      setDate]      = useState(() => new Date().toISOString().split('T')[0])
  const [loading,   setLoading]   = useState(false)
  const [saving,    setSaving]    = useState<number | null>(null)
  const [closing,   setClosing]   = useState(false)
  const [toast,     setToast]     = useState<{type:'ok'|'err'; text:string} | null>(null)

  const token = () => localStorage.getItem('token') || ''
  const auth  = () => ({ Authorization: `Bearer ${token()}` })

  const notify = (type: 'ok'|'err', text: string) => {
    setToast({type, text}); setTimeout(() => setToast(null), 3500)
  }

  const updateSummary = (list: StudentAtt[]) => {
    setSummary({
      total:      list.length,
      presentes:  list.filter(s => s.status === 'PRESENTE').length,
      ausentes:   list.filter(s => s.status === 'AUSENTE').length,
      retrasos:   list.filter(s => s.status === 'RETRASO').length,
      licencias:  list.filter(s => s.status === 'LICENCIA').length,
      registrado: list.some(s => s.status !== null),
    })
  }

  // Cargar cursos del maestro
  useEffect(() => {
    fetch(`${API}/api/student-attendance/my-courses`, { headers: auth() })
      .then(r => r.json())
      .then(d => {
        if (Array.isArray(d)) {
          setCourses(d)
          if (d.length === 1) setSelCourse(d[0])
        }
      })
      .catch(() => {})
  }, [])

  // Cargar asistencia cuando cambia curso o fecha
  useEffect(() => {
    if (!selCourse) return
    setLoading(true)
    fetch(`${API}/api/student-attendance/course/${selCourse.id}?date=${date}`, { headers: auth() })
      .then(r => r.json())
      .then(d => {
        if (d.students) {
          const mapped = d.students.map((s: any) => ({
            ...s,
            status: s.attendance ? s.attendance.status : null,
          }))
          setStudents(mapped)
          updateSummary(mapped)
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [selCourse, date])

  // Guardar estado individual al tocar
  const setStatus = async (studentId: number, status: StatusKey) => {
    if (!selCourse) return

    const current    = students.find(s => s.studentId === studentId)
    const newStatus: StatusKey | null = current?.status === status ? null : status

    const updated = students.map(s => s.studentId === studentId ? { ...s, status: newStatus } : s)
    setStudents(updated)
    updateSummary(updated)

    if (!newStatus) return

    setSaving(studentId)
    try {
      const res  = await fetch(`${API}/api/student-attendance/course/${selCourse.id}`, {
        method:  'POST',
        headers: { ...auth(), 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          date,
          attendances: [{ studentId, status: newStatus, note: current?.note || '' }]
        })
      })
      const data = await res.json()
      if (!res.ok) { notify('err', data.message) }
      else if (data.notifications > 0) {
        notify('ok', `${STATUS_CONFIG[newStatus].emoji} Guardado · ${data.notifications} notif. enviada`)
      }
    } catch { notify('err', 'Error al guardar') }
    finally { setSaving(null) }
  }

  // Marcar todos con un estado
  const markAll = async (status: StatusKey) => {
    if (!selCourse || students.length === 0) return
    const updated = students.map(s => ({ ...s, status }))
    setStudents(updated)
    updateSummary(updated)

    try {
      const res  = await fetch(`${API}/api/student-attendance/course/${selCourse.id}`, {
        method:  'POST',
        headers: { ...auth(), 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          date,
          attendances: updated.map(s => ({ studentId: s.studentId, status, note: s.note || '' }))
        })
      })
      const data = await res.json()
      if (res.ok) notify('ok', data.message)
      else notify('err', data.message)
    } catch { notify('err', 'Error al guardar') }
  }

  // Cerrar asistencia — marca AUSENTE a los sin registro
  const handleClose = async () => {
    if (!selCourse) return
    const sinRegistro = students.filter(s => s.status === null).length
    if (sinRegistro === 0) {
      notify('ok', 'Todos los estudiantes ya tienen asistencia registrada')
      return
    }
    if (!confirm(`¿Cerrar asistencia? ${sinRegistro} estudiante(s) sin registrar serán marcados como AUSENTE automáticamente y se notificará a sus padres.`)) return

    setClosing(true)
    try {
      const res  = await fetch(`${API}/api/student-attendance/course/${selCourse.id}/close`, {
        method:  'POST',
        headers: { ...auth(), 'Content-Type': 'application/json' },
        body:    JSON.stringify({ date })
      })
      const data = await res.json()
      if (!res.ok) { notify('err', data.message); return }
      notify('ok', data.message)
      const updated = students.map(s => s.status === null ? { ...s, status: 'AUSENTE' as const } : s)
      setStudents(updated)
      updateSummary(updated)
    } catch { notify('err', 'Error de conexión') }
    finally { setClosing(false) }
  }

  const registrados   = students.filter(s => s.status !== null).length
  const sinRegistrar  = students.filter(s => s.status === null).length
  const today         = new Date().toISOString().split('T')[0]

  return (
    <div style={{ paddingBottom: 70 }}>
      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)',
          zIndex: 999, padding: '10px 20px', borderRadius: 10, fontSize: 13, fontWeight: 600,
          background: toast.type === 'ok' ? '#0F6E56' : '#C0392B',
          color: '#fff', boxShadow: '0 4px 20px rgba(0,0,0,.3)', whiteSpace: 'nowrap',
        }}>
          {toast.type === 'ok' ? '✅' : '❌'} {toast.text}
        </div>
      )}

      {/* Header */}
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: '#1A3A7C', marginBottom: 4 }}>
          Asistencia de Estudiantes
        </h1>
        <p style={{ fontSize: 13, color: '#6B8BB0' }}>
          Toca el estado para registrar — se guarda automáticamente
        </p>
      </div>

      {/* Selector de curso */}
      {courses.length > 1 && (
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: '#1A3A7C', textTransform: 'uppercase', letterSpacing: '.5px', display: 'block', marginBottom: 6 }}>
            Curso
          </label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {courses.map(c => (
              <button key={c.id} onClick={() => setSelCourse(c)} style={{
                padding: '8px 14px', borderRadius: 20, border: 'none', cursor: 'pointer',
                fontSize: 13, fontWeight: 600,
                background: selCourse?.id === c.id ? '#1A3A7C' : '#F0F6FC',
                color:      selCourse?.id === c.id ? '#fff'    : '#1A3A7C',
              }}>
                {GRADES[c.grade]} &quot;{c.parallel}&quot; {SHIFTS[c.shift]}
              </button>
            ))}
          </div>
        </div>
      )}

      {selCourse && (
        <div style={{ background: '#E0ECF8', borderRadius: 8, padding: '8px 14px', marginBottom: 12, fontSize: 12, color: '#1A3A7C', fontWeight: 600 }}>
          📚 {GRADES[selCourse.grade]} &quot;{selCourse.parallel}&quot; · {selCourse.level} · {SHIFTS[selCourse.shift]}
        </div>
      )}

      {/* Selector de fecha */}
      <div style={{ marginBottom: 16 }}>
        <label style={{ fontSize: 11, fontWeight: 700, color: '#1A3A7C', textTransform: 'uppercase', letterSpacing: '.5px', display: 'block', marginBottom: 6 }}>
          Fecha
        </label>
        <input type="date" value={date} onChange={e => setDate(e.target.value)} max={today}
          style={{ padding: '10px 12px', border: '1.5px solid #CBE0F0', borderRadius: 8, fontSize: 14, color: '#1A3A7C', outline: 'none', width: '100%' }}/>
      </div>

      {/* Resumen */}
      {summary && summary.registrado && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 16 }}>
          {([
            { label: 'Presentes', value: summary.presentes, ...STATUS_CONFIG.PRESENTE },
            { label: 'Ausentes',  value: summary.ausentes,  ...STATUS_CONFIG.AUSENTE  },
            { label: 'Retrasos',  value: summary.retrasos,  ...STATUS_CONFIG.RETRASO  },
            { label: 'Licencias', value: summary.licencias, ...STATUS_CONFIG.LICENCIA },
          ]).map(s => (
            <div key={s.label} style={{ background: s.bg, border: `1px solid ${s.border}`, borderRadius: 8, padding: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: 10, color: s.color, fontWeight: 600 }}>{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Marcar todos */}
      {students.length > 0 && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#6B8BB0', textTransform: 'uppercase' }}>
            Marcar todos:
          </span>
          {(Object.keys(STATUS_CONFIG) as StatusKey[]).map(s => (
            <button key={s} onClick={() => markAll(s)} style={{
              padding: '5px 12px', borderRadius: 20,
              border: `1px solid ${STATUS_CONFIG[s].border}`,
              background: STATUS_CONFIG[s].bg, color: STATUS_CONFIG[s].color,
              fontSize: 12, fontWeight: 600, cursor: 'pointer',
            }}>
              {STATUS_CONFIG[s].emoji} {STATUS_CONFIG[s].label}
            </button>
          ))}
        </div>
      )}

      {/* Lista de estudiantes */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
          <div className="spinner"/>
        </div>
      ) : !selCourse ? (
        <div style={{ textAlign: 'center', padding: 48, color: '#6B8BB0' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📚</div>
          <p>Selecciona un curso para registrar asistencia</p>
        </div>
      ) : students.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 48, color: '#6B8BB0' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>👥</div>
          <p>No hay estudiantes inscritos en este curso</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {students.map((s, i) => {
            const cfg      = s.status ? STATUS_CONFIG[s.status] : null
            const isSaving = saving === s.studentId
            return (
              <div key={s.studentId} style={{
                background: '#fff',
                border: `1.5px solid ${cfg ? cfg.border : '#CBE0F0'}`,
                borderRadius: 12, padding: '10px 12px',
                display: 'flex', alignItems: 'center', gap: 10,
                transition: 'border-color .15s',
                opacity: isSaving ? 0.7 : 1,
              }}>
                {/* Número */}
                <div style={{ fontSize: 12, color: '#6B8BB0', minWidth: 22, textAlign: 'center', fontWeight: 600 }}>
                  {i + 1}
                </div>

                {/* Avatar */}
                <div style={{
                  width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
                  background: s.gender === 'FEMENINO' ? '#FFE0EC' : '#E0ECF8',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17,
                }}>
                  {s.gender === 'FEMENINO' ? '👧' : '👦'}
                </div>

                {/* Nombre y estado */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#1A3A7C', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {s.lastName} {s.firstName}
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: cfg ? cfg.color : '#CBD5E1', marginTop: 1 }}>
                    {isSaving
                      ? '⏳ Guardando...'
                      : cfg
                        ? `${cfg.emoji} ${cfg.label}`
                        : '— Sin registrar'}
                  </div>
                </div>

                {/* Botones de estado */}
                <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                  {(Object.keys(STATUS_CONFIG) as StatusKey[]).map(st => {
                    const isActive = s.status === st
                    return (
                      <button key={st} onClick={() => setStatus(s.studentId, st)}
                        disabled={isSaving}
                        style={{
                          width: 34, height: 34, borderRadius: 8, border: 'none',
                          cursor: isSaving ? 'not-allowed' : 'pointer',
                          fontSize: 17, display: 'flex', alignItems: 'center', justifyContent: 'center',
                          background: isActive ? STATUS_CONFIG[st].bg : '#F8FBFF',
                          outline: isActive ? `2px solid ${STATUS_CONFIG[st].border}` : 'none',
                          transform: isActive ? 'scale(1.15)' : 'scale(1)',
                          transition: 'all .15s',
                        }}>
                        {STATUS_CONFIG[st].emoji}
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Barra inferior fija */}
      {students.length > 0 && (
        <div style={{
          position: 'fixed', bottom: 0, left: 0, right: 0,
          background: '#fff', borderTop: '1px solid #CBE0F0',
          padding: '10px 16px', zIndex: 100,
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, color: registrados > 0 ? '#0F6E56' : '#6B8BB0', fontWeight: 600 }}>
              {registrados > 0
                ? `✅ ${registrados} de ${students.length} registrados`
                : '⬜ Ningún estudiante registrado aún'}
            </div>
            {summary && registrados > 0 && (
              <div style={{ fontSize: 11, color: '#6B8BB0', marginTop: 1 }}>
                {summary.presentes}P · {summary.ausentes}A · {summary.retrasos}R · {summary.licencias}L
                {sinRegistrar > 0 && <span style={{ color: '#C0392B' }}> · {sinRegistrar} sin registrar</span>}
              </div>
            )}
          </div>

          {/* Botón cerrar asistencia — solo si hay sin registrar */}
          {sinRegistrar > 0 && (
            <button onClick={handleClose} disabled={closing} style={{
              padding: '8px 14px', borderRadius: 8, border: 'none',
              cursor: closing ? 'not-allowed' : 'pointer',
              background: closing ? '#6B8BB0' : '#C0392B',
              color: '#fff', fontSize: 12, fontWeight: 700,
              whiteSpace: 'nowrap', opacity: closing ? 0.6 : 1,
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              {closing ? '⏳ Cerrando...' : `🔒 Cerrar (${sinRegistrar} ausentes)`}
            </button>
          )}

          {/* Indicador de cerrado */}
          {sinRegistrar === 0 && registrados > 0 && (
            <div style={{
              padding: '6px 12px', borderRadius: 8,
              background: '#E1F5EE', color: '#0F6E56',
              fontSize: 12, fontWeight: 700,
            }}>
              🔒 Asistencia completa
            </div>
          )}
        </div>
      )}

      <style>{`
        .spinner{width:24px;height:24px;border:2px solid rgba(26,58,124,.2);border-top-color:#1A3A7C;border-radius:50%;animation:spin .7s linear infinite}
        @keyframes spin{to{transform:rotate(360deg)}}
      `}</style>
    </div>
  )
}
